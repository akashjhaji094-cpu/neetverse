import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { compressImage, formatBytes } from "@/lib/imageCompress";
import { ImagePlus, Loader2, Plus, Trash2, X, CheckCircle2 } from "lucide-react";

export type QuestionKind = "mcq" | "assertion_reason" | "statement" | "match_column";

const KIND_LABELS: Record<QuestionKind, string> = {
  mcq: "Normal MCQ",
  assertion_reason: "Assertion – Reason",
  statement: "Statement based",
  match_column: "Match the Column",
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI"];
const LETTERS = ["A", "B", "C", "D", "E", "F"];

interface Props {
  /** admin = saves straight into the question bank. contribute = goes to review queue. */
  mode: "admin" | "contribute";
  onSaved?: (questionId: string | null) => void;
}

interface ImgState {
  url: string | null;
  uploading: boolean;
}

const emptyImg: ImgState = { url: null, uploading: false };

export function ManualQuestionForm({ mode, onSaved }: Props) {
  const { user } = useAuth();

  const [subjects, setSubjects] = useState<any[]>([]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [kind, setKind] = useState<QuestionKind>("mcq");
  const [difficulty, setDifficulty] = useState("auto_medium");

  const [stem, setStem] = useState("");
  const [questionImage, setQuestionImage] = useState<ImgState>(emptyImg);

  // Assertion–Reason
  const [assertion, setAssertion] = useState("");
  const [reason, setReason] = useState("");

  // Statement based
  const [statements, setStatements] = useState<string[]>(["", ""]);

  // Match the column
  const [colHeads, setColHeads] = useState<[string, string]>(["Column I", "Column II"]);
  const [matchRows, setMatchRows] = useState<{ left: string; right: string }[]>([
    { left: "", right: "" },
    { left: "", right: "" },
  ]);

  const [options, setOptions] = useState<string[]>(["", "", "", ""]);
  const [optionImages, setOptionImages] = useState<ImgState[]>([emptyImg, emptyImg, emptyImg, emptyImg]);
  const [correctIndex, setCorrectIndex] = useState<number | null>(null);

  const [explanation, setExplanation] = useState("");
  const [explanationImage, setExplanationImage] = useState<ImgState>(emptyImg);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("subjects").select("id,name").order("name").then(({ data }) => setSubjects(data || []));
  }, []);

  useEffect(() => {
    if (!subjectId) { setChapters([]); setChapterId(""); return; }
    supabase.from("chapters").select("id,name").eq("subject_id", subjectId).order("name")
      .then(({ data }) => setChapters(data || []));
  }, [subjectId]);

  const uploadImage = async (file: File, setter: (s: ImgState) => void) => {
    setter({ url: null, uploading: true });
    try {
      const original = file.size;
      const blob = await compressImage(file);
      const ext = "jpg";
      const path = `manual/${user?.id || "anon"}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("question-images").upload(path, blob, {
        contentType: blob.type || "image/jpeg",
        upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("question-images").getPublicUrl(path);
      setter({ url: data.publicUrl, uploading: false });
      toast.success(`Image added (${formatBytes(original)} → ${formatBytes(blob.size)})`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Image upload failed");
      setter({ url: null, uploading: false });
    }
  };

  const buildQuestionHtml = (): string => {
    const stemHtml = stem.trim();
    if (kind === "assertion_reason") {
      return [
        stemHtml,
        `Assertion (A): ${assertion.trim()}`,
        `Reason (R): ${reason.trim()}`,
      ].filter(Boolean).join("\n");
    }
    if (kind === "statement") {
      const lines = statements
        .map((s, i) => (s.trim() ? `Statement ${ROMAN[i]}: ${s.trim()}` : ""))
        .filter(Boolean);
      return [stemHtml, ...lines].filter(Boolean).join("\n");
    }
    if (kind === "match_column") {
      const rows = matchRows
        .filter((r) => r.left.trim() || r.right.trim())
        .map((r, i) => `<tr><td>(${LETTERS[i]}) ${r.left.trim()}</td><td>(${ROMAN[i]}) ${r.right.trim()}</td></tr>`)
        .join("");
      return `${stemHtml}<table class="match-table"><thead><tr><th>${colHeads[0]}</th><th>${colHeads[1]}</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    return stemHtml;
  };

  const validationError = useMemo(() => {
    if (!subjectId) return "Subject select karo";
    if (!chapterId) return "Chapter select karo";
    if (kind === "assertion_reason" && (!assertion.trim() || !reason.trim())) return "Assertion aur Reason dono bharo";
    if (kind === "statement" && statements.filter((s) => s.trim()).length < 2) return "Kam se kam 2 statements chahiye";
    if (kind === "match_column" && matchRows.filter((r) => r.left.trim() && r.right.trim()).length < 2)
      return "Kam se kam 2 match rows chahiye";
    if (kind === "mcq" && !stem.trim() && !questionImage.url) return "Question text ya image daalo";
    const filled = options.filter((o, i) => o.trim() || optionImages[i]?.url);
    if (filled.length < 2) return "Kam se kam 2 options chahiye";
    if (correctIndex === null) return "Correct answer mark karo";
    return null;
  }, [subjectId, chapterId, kind, assertion, reason, statements, matchRows, stem, questionImage, options, optionImages, correctIndex]);

  const reset = () => {
    setStem(""); setAssertion(""); setReason("");
    setStatements(["", ""]);
    setMatchRows([{ left: "", right: "" }, { left: "", right: "" }]);
    setOptions(["", "", "", ""]);
    setOptionImages([emptyImg, emptyImg, emptyImg, emptyImg]);
    setCorrectIndex(null);
    setExplanation("");
    setQuestionImage(emptyImg);
    setExplanationImage(emptyImg);
  };

  const handleSave = async () => {
    if (validationError) { toast.error(validationError); return; }
    if (!user) { toast.error("Pehle login karo"); return; }
    setSaving(true);
    try {
      const questionHtml = buildQuestionHtml();
      const structured = {
        kind,
        assertion: assertion || undefined,
        reason: reason || undefined,
        statements: kind === "statement" ? statements.filter((s) => s.trim()) : undefined,
        matchColumns: kind === "match_column" ? { heads: colHeads, rows: matchRows } : undefined,
      };
      const optImgs = optionImages.map((o) => o.url);

      if (mode === "admin") {
        const { data, error } = await supabase.from("questions").insert({
          subject_id: subjectId,
          chapter_id: chapterId,
          question_text: questionHtml,
          question_type: kind,
          options: options.map((o) => o.trim()) as any,
          option_images: (optImgs.some(Boolean) ? optImgs : null) as any,
          correct_option_index: correctIndex,
          explanation: explanation.trim() || null,
          explanation_image_url: explanationImage.url,
          images: (questionImage.url ? [questionImage.url] : []) as any,
          difficulty: difficulty as any,
          structured_data: structured as any,
          source_file: "manual-admin",
        }).select("id").single();
        if (error) throw error;
        toast.success("Question bank me save ho gaya ✅");
        onSaved?.(data?.id ?? null);
      } else {
        const { error } = await supabase.from("question_submissions").insert({
          submitted_by: user.id,
          submitter_name: (user.user_metadata as any)?.name || user.email,
          subject_id: subjectId,
          chapter_id: chapterId,
          question_type: kind,
          difficulty,
          question_text: questionHtml,
          question_image: questionImage.url,
          options: options.map((o) => o.trim()) as any,
          option_images: (optImgs.some(Boolean) ? optImgs : null) as any,
          correct_option_index: correctIndex,
          explanation: explanation.trim() || null,
          explanation_image_url: explanationImage.url,
          structured_data: structured as any,
        });
        if (error) throw error;
        toast.success("Submit ho gaya! Admin verify karega, phir live ho jayega 🎉");
        onSaved?.(null);
      }
      reset();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Meta */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label>Subject</Label>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
            <SelectContent>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Chapter</Label>
          <Select value={chapterId} onValueChange={setChapterId} disabled={!subjectId}>
            <SelectTrigger><SelectValue placeholder="Select chapter" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Question type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as QuestionKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(KIND_LABELS) as QuestionKind[]).map((k) => (
                <SelectItem key={k} value={k}>{KIND_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Difficulty</Label>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto_easy">Easy</SelectItem>
              <SelectItem value="auto_medium">Medium</SelectItem>
              <SelectItem value="auto_hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Question body */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-1.5">
            <Label>{kind === "mcq" ? "Question" : "Question intro (optional)"}</Label>
            <Textarea
              rows={3}
              value={stem}
              onChange={(e) => setStem(e.target.value)}
              placeholder={
                kind === "match_column"
                  ? "Match the following columns:"
                  : kind === "statement"
                    ? "Given below are two statements:"
                    : "Type the question... LaTeX supported: $x^2$"
              }
            />
          </div>

          <ImageField label="Question image" state={questionImage} onPick={(f) => uploadImage(f, setQuestionImage)} onClear={() => setQuestionImage(emptyImg)} />

          {kind === "assertion_reason" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Assertion (A)</Label>
                <Textarea rows={3} value={assertion} onChange={(e) => setAssertion(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Reason (R)</Label>
                <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
          )}

          {kind === "statement" && (
            <div className="space-y-2">
              <Label>Statements</Label>
              {statements.map((s, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <Badge variant="secondary" className="mt-2 shrink-0">{ROMAN[i]}</Badge>
                  <Textarea
                    rows={2}
                    value={s}
                    onChange={(e) => setStatements(statements.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={`Statement ${ROMAN[i]}`}
                  />
                  {statements.length > 2 && (
                    <Button variant="ghost" size="icon" onClick={() => setStatements(statements.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              {statements.length < 6 && (
                <Button variant="outline" size="sm" onClick={() => setStatements([...statements, ""])} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add statement
                </Button>
              )}
            </div>
          )}

          {kind === "match_column" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input value={colHeads[0]} onChange={(e) => setColHeads([e.target.value, colHeads[1]])} />
                <Input value={colHeads[1]} onChange={(e) => setColHeads([colHeads[0], e.target.value])} />
              </div>
              {matchRows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <Input
                    value={r.left}
                    placeholder={`(${LETTERS[i]})`}
                    onChange={(e) => setMatchRows(matchRows.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)))}
                  />
                  <Input
                    value={r.right}
                    placeholder={`(${ROMAN[i]})`}
                    onChange={(e) => setMatchRows(matchRows.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))}
                  />
                  {matchRows.length > 2 ? (
                    <Button variant="ghost" size="icon" onClick={() => setMatchRows(matchRows.filter((_, j) => j !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : <span />}
                </div>
              ))}
              {matchRows.length < 6 && (
                <Button variant="outline" size="sm" onClick={() => setMatchRows([...matchRows, { left: "", right: "" }])} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add row
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Options */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <Label>Options — tick the correct one</Label>
          {options.map((o, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-3">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={correctIndex === i ? "default" : "outline"}
                  size="icon"
                  className="shrink-0 h-9 w-9"
                  onClick={() => setCorrectIndex(i)}
                  aria-label={`Mark option ${LETTERS[i]} correct`}
                >
                  {correctIndex === i ? <CheckCircle2 className="h-4 w-4" /> : <span className="text-xs font-bold">{LETTERS[i]}</span>}
                </Button>
                <Input
                  value={o}
                  placeholder={`Option ${LETTERS[i]}`}
                  onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                />
              </div>
              <ImageField
                compact
                label="Option image"
                state={optionImages[i]}
                onPick={(f) => uploadImage(f, (s) => setOptionImages((prev) => prev.map((x, j) => (j === i ? s : x))))}
                onClear={() => setOptionImages((prev) => prev.map((x, j) => (j === i ? emptyImg : x)))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Explanation */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="space-y-1.5">
            <Label>Explanation (optional)</Label>
            <Textarea rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          </div>
          <ImageField label="Explanation image" state={explanationImage} onPick={(f) => uploadImage(f, setExplanationImage)} onClear={() => setExplanationImage(emptyImg)} />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleSave} disabled={saving || !!validationError} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {mode === "admin" ? "Save to question bank" : "Submit for review"}
        </Button>
        {validationError && <span className="text-sm text-muted-foreground">{validationError}</span>}
      </div>
    </div>
  );
}

function ImageField({
  label, state, onPick, onClear, compact,
}: {
  label: string;
  state: ImgState;
  onPick: (f: File) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={compact ? "" : "space-y-1.5"}>
      {!compact && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ""; }}
      />
      {state.url ? (
        <div className="relative inline-block">
          <img src={state.url} alt={label} loading="lazy" className="max-h-32 rounded-lg border" />
          <Button variant="secondary" size="icon" className="absolute -top-2 -right-2 h-6 w-6" onClick={onClear}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="gap-1.5" disabled={state.uploading} onClick={() => ref.current?.click()}>
          {state.uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {state.uploading ? "Uploading..." : compact ? "Add option image" : `Add ${label.toLowerCase()}`}
        </Button>
      )}
    </div>
  );
}