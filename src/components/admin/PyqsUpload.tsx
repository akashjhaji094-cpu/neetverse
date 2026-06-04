import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, FileText, BookOpen } from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite worker import
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface ChapterRow { id: string; name: string; subject_id: string; }
interface SubjectRow { id: string; name: string; }

// Parse "1-A, 2-C\n3-B" style answer key into [0,2,1...]
function parseAnswerKey(raw: string): Map<number, number> {
  const map = new Map<number, number>();
  const letterIdx: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
  const re = /(\d+)\s*[-.:)\s]\s*([A-Da-d])/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const qn = parseInt(m[1], 10);
    const li = letterIdx[m[2].toUpperCase()];
    if (!isNaN(qn) && li !== undefined) map.set(qn, li);
  }
  return map;
}

// Render one PDF page to a JPEG blob (compressed but readable)
async function renderPageToJpeg(page: any, maxWidth = 1100, quality = 0.72): Promise<Blob> {
  const viewport1 = page.getViewport({ scale: 1 });
  const scale = Math.min(maxWidth / viewport1.width, 2);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", quality)
  );
}

export function PyqsUpload() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [chapters, setChapters] = useState<ChapterRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [chapterId, setChapterId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [solutionFile, setSolutionFile] = useState<File | null>(null);
  const [answerKey, setAnswerKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; phase: string }>({
    done: 0, total: 0, phase: "",
  });

  useEffect(() => {
    (async () => {
      const [c, s] = await Promise.all([
        supabase.from("chapters").select("id, name, subject_id").order("name"),
        supabase.from("subjects").select("id, name").order("name"),
      ]);
      setChapters((c.data || []) as ChapterRow[]);
      setSubjects((s.data || []) as SubjectRow[]);
    })();
  }, []);

  const subjMap = Object.fromEntries(subjects.map(s => [s.id, s.name]));
  const grouped: Record<string, ChapterRow[]> = {};
  chapters.forEach(c => {
    const sn = subjMap[c.subject_id] || "Other";
    (grouped[sn] = grouped[sn] || []).push(c);
  });

  const handleUpload = async () => {
    if (!user) { toast({ title: "Sign in required", variant: "destructive" }); return; }
    if (!chapterId) { toast({ title: "Pick a chapter", variant: "destructive" }); return; }
    if (!title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    if (!file) { toast({ title: "Upload a PDF", variant: "destructive" }); return; }
    const keyMap = parseAnswerKey(answerKey);
    if (keyMap.size === 0) {
      toast({ title: "Answer key empty", description: "Paste like: 1-A, 2-C, 3-B...", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const chapter = chapters.find(c => c.id === chapterId)!;

      // 1) Parse PDF
      setProgress({ done: 0, total: 0, phase: "Reading PDF..." });
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      const totalPages = pdf.numPages;
      // Skip first page (intro). Questions start at page 2.
      const questionPages = Math.max(0, totalPages - 1);
      if (questionPages === 0) throw new Error("PDF needs at least 2 pages (1 intro + questions).");

      // 2) Upload original question paper PDF + (optional) solution PDF to storage
      setProgress({ done: 0, total: questionPages, phase: "Uploading PDFs..." });
      const paperId = crypto.randomUUID();
      const paperPdfPath = `pyqs/${paperId}/paper.pdf`;
      const { error: paperUpErr } = await supabase.storage
        .from("question-images")
        .upload(paperPdfPath, file, { contentType: "application/pdf", upsert: true });
      if (paperUpErr) throw paperUpErr;
      const paperPdfUrl = supabase.storage.from("question-images").getPublicUrl(paperPdfPath).data.publicUrl;

      let solutionPdfUrl: string | null = null;
      if (solutionFile) {
        const solPath = `pyqs/${paperId}/solutions.pdf`;
        const { error: solErr } = await supabase.storage
          .from("question-images")
          .upload(solPath, solutionFile, { contentType: "application/pdf", upsert: true });
        if (solErr) throw solErr;
        solutionPdfUrl = supabase.storage.from("question-images").getPublicUrl(solPath).data.publicUrl;
      }

      // 3) Create paper row
      setProgress({ done: 0, total: questionPages, phase: "Creating paper..." });
      const { error: pErr } = await supabase.from("pyq_papers").insert({
        id: paperId,
        chapter_id: chapter.id,
        subject_id: chapter.subject_id,
        title: title.trim(),
        total_questions: questionPages,
        uploaded_by: user.id,
        paper_pdf_url: paperPdfUrl,
        solution_pdf_url: solutionPdfUrl,
      } as any);
      if (pErr) throw pErr;

      // 4) Render each page (skip 1) + upload + insert row
      const rowsToInsert: any[] = [];
      for (let p = 2; p <= totalPages; p++) {
        const qn = p - 1; // question number = page - 1
        setProgress({ done: qn - 1, total: questionPages, phase: `Processing question ${qn}/${questionPages}...` });
        const page = await pdf.getPage(p);
        const blob = await renderPageToJpeg(page);
        const path = `pyqs/${paperId}/${qn}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("question-images")
          .upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("question-images").getPublicUrl(path);
        const correct = keyMap.get(qn);
        if (correct === undefined) {
          throw new Error(`Answer key missing for question ${qn}. Paste e.g. "${qn}-A".`);
        }
        rowsToInsert.push({
          paper_id: paperId,
          chapter_id: chapter.id,
          subject_id: chapter.subject_id,
          page_number: qn,
          image_url: pub.publicUrl,
          correct_option_index: correct,
        });
      }

      // 5) Bulk insert questions in chunks
      setProgress({ done: questionPages, total: questionPages, phase: "Saving questions..." });
      for (let i = 0; i < rowsToInsert.length; i += 200) {
        const { error: qErr } = await supabase.from("pyq_questions").insert(rowsToInsert.slice(i, i + 200));
        if (qErr) throw qErr;
      }

      toast({ title: "PYQ uploaded!", description: `${questionPages} questions added to ${chapter.name}.` });
      setFile(null); setSolutionFile(null); setTitle(""); setAnswerKey(""); setChapterId("");
    } catch (e: any) {
      console.error(e);
      toast({ title: "Upload failed", description: e.message || "Unknown error", variant: "destructive" });
    } finally {
      setBusy(false);
      setProgress({ done: 0, total: 0, phase: "" });
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-5">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Upload PYQ Paper
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick a chapter, upload the PDF (page 1 is treated as intro and skipped), and paste the answer key as <code>1-A, 2-C, 3-B...</code>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Chapter</Label>
            <Select value={chapterId} onValueChange={setChapterId} disabled={busy}>
              <SelectTrigger><SelectValue placeholder="Select a chapter" /></SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {Object.entries(grouped).map(([subj, items]) => (
                  <div key={subj}>
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {subj}
                    </div>
                    {items.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Paper title</Label>
            <Input
              placeholder="e.g. NEET 2023 — Mechanics"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={120}
              disabled={busy}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>PDF file</Label>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="application/pdf"
              onChange={e => setFile(e.target.files?.[0] || null)}
              disabled={busy}
            />
            {file && <FileText className="h-4 w-4 text-primary" />}
          </div>
          <p className="text-xs text-muted-foreground">Page 1 ko intro maan ke skip karenge. Q1 = page 2.</p>
        </div>

        <div className="space-y-2">
          <Label>Solutions PDF <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="application/pdf"
              onChange={e => setSolutionFile(e.target.files?.[0] || null)}
              disabled={busy}
            />
            {solutionFile && <FileText className="h-4 w-4 text-primary" />}
          </div>
          <p className="text-xs text-muted-foreground">Users will be able to download this from their result screen.</p>
        </div>

        <div className="space-y-2">
          <Label>Answer key</Label>
          <Textarea
            rows={5}
            value={answerKey}
            onChange={e => setAnswerKey(e.target.value)}
            placeholder={"1-A, 2-C, 3-B, 4-D,\n5-A, 6-B, 7-C..."}
            disabled={busy}
            maxLength={20000}
          />
          <p className="text-xs text-muted-foreground">
            Parsed: <span className="font-mono">{parseAnswerKey(answerKey).size}</span> answers
          </p>
        </div>

        {busy && (
          <div className="space-y-1">
            <p className="text-sm">{progress.phase}</p>
            <div className="h-2 bg-muted rounded overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <Button onClick={handleUpload} disabled={busy} className="w-full">
          {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : <><Upload className="mr-2 h-4 w-4" /> Upload PYQ</>}
        </Button>
      </CardContent>
    </Card>
  );
}