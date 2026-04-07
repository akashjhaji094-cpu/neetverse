import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { neetSubjects } from "@/data/neetChapters";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  FileText,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Upload,
  Brain,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ParsedPdfQuestion {
  question_number: number;
  question_text: string;
  options: string[];
  correct_option_index: number | null;
  explanation: string | null;
  has_diagram: boolean;
}

const extractTextFromPdf = async (file: File): Promise<{ text: string; pageCount: number }> => {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageCount = pdf.numPages;
  let fullText = "";

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += `\n--- Page ${i} ---\n${pageText}`;
  }

  return { text: fullText, pageCount };
};

export const PdfUpload = () => {
  const [subjectId, setSubjectId] = useState<string>("biology");
  const [chapterId, setChapterId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [questions, setQuestions] = useState<ParsedPdfQuestion[]>([]);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parseStep, setParseStep] = useState<string>("");
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    withAnswers: 0,
    withExplanations: 0,
    withDiagrams: 0,
  });

  const selectedSubject = neetSubjects.find((s) => s.id === subjectId) || neetSubjects[0];

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF file");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast.error("File too large. Maximum 20MB allowed.");
      return;
    }

    setFileName(file.name);
    setParsing(true);
    setQuestions([]);
    setParseStep("Reading PDF...");

    try {
      // Step 1: Extract text from PDF
      setParseStep("📄 Extracting text from PDF...");
      const { text, pageCount } = await extractTextFromPdf(file);

      if (text.trim().length < 50) {
        toast.error("Could not extract enough text from PDF. The PDF might be image-based.");
        setParsing(false);
        return;
      }

      toast.info(`Extracted text from ${pageCount} pages. Now parsing with AI...`);

      // Step 2: Send to AI for parsing
      setParseStep(`🧠 AI is analyzing ${pageCount} pages...`);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in first");
        setParsing(false);
        return;
      }

      const response = await supabase.functions.invoke("parse-pdf-questions", {
        body: { text, pageCount },
      });

      if (response.error) throw response.error;

      const result = response.data;
      if (!result.success) {
        throw new Error(result.error || "Failed to parse questions");
      }

      const parsed: ParsedPdfQuestion[] = result.questions || [];

      if (parsed.length === 0) {
        toast.error("No questions could be extracted from this PDF");
        setParsing(false);
        return;
      }

      setQuestions(parsed);
      setStats({
        total: parsed.length,
        withAnswers: parsed.filter((q) => q.correct_option_index !== null).length,
        withExplanations: parsed.filter((q) => q.explanation).length,
        withDiagrams: parsed.filter((q) => q.has_diagram).length,
      });

      toast.success(`🎉 Extracted ${parsed.length} questions! Review them below.`);
    } catch (error: any) {
      console.error("PDF parse error:", error);
      toast.error(`Failed to parse PDF: ${error.message}`);
    } finally {
      setParsing(false);
      setParseStep("");
    }
  };

  const handleSaveToBackend = async () => {
    if (!chapterId) {
      toast.error("Please select a chapter");
      return;
    }
    if (questions.length === 0) {
      toast.error("No questions to save");
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const questionsToSave = questions.map((q, i) => {
        setUploadProgress(Math.floor(((i + 1) / questions.length) * 100));
        return {
          question_text: q.question_text,
          options: q.options,
          correct_option_index: q.correct_option_index,
          explanation: q.explanation,
          images: [],
          difficulty: "auto_medium",
          subject_id: subjectId,
          chapter_id: chapterId,
          source_file: fileName,
        };
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to save questions");
        return;
      }

      const response = await supabase.functions.invoke("import-questions", {
        body: { questions: questionsToSave },
      });

      if (response.error) throw response.error;

      toast.success(
        `✅ Saved ${questionsToSave.length} questions to ${selectedSubject.name} - ${selectedSubject.chapters.find((c) => c.id === chapterId)?.name}`
      );

      setQuestions([]);
      setFileName("");
      setStats({ total: 0, withAnswers: 0, withExplanations: 0, withDiagrams: 0 });
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {questions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <FileCheck className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Questions</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold">{stats.withAnswers}</p>
                <p className="text-xs text-muted-foreground">With Answers</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Brain className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold">{stats.withExplanations}</p>
                <p className="text-xs text-muted-foreground">With Explanations</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold">{stats.withDiagrams}</p>
                <p className="text-xs text-muted-foreground">With Diagrams</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              PDF Import Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Subject</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={subjectId}
                onChange={(e) => {
                  setSubjectId(e.target.value);
                  setChapterId("");
                }}
                disabled={uploading || parsing}
              >
                {neetSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Chapter</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
                disabled={uploading || parsing}
              >
                <option value="">Select chapter</option>
                {selectedSubject.chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Upload PDF</label>
              <Input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={uploading || parsing}
              />
              {fileName && (
                <p className="text-xs text-muted-foreground">📎 {fileName}</p>
              )}
            </div>

            {parsing && (
              <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium text-primary">Processing...</span>
                </div>
                <p className="text-xs text-muted-foreground">{parseStep}</p>
                <p className="text-xs text-muted-foreground italic">
                  This may take 30-60 seconds for large PDFs
                </p>
              </div>
            )}

            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Saving to database...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            <Button
              type="button"
              disabled={!questions.length || !chapterId || uploading || parsing}
              className="w-full"
              onClick={handleSaveToBackend}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Save {questions.length} Questions
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Extracted Questions Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!questions.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Upload a PDF to extract questions</p>
                <p className="text-xs mt-2">
                  AI will automatically detect questions, options, answers & explanations
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[600px] pr-4">
                <div className="space-y-3">
                  {questions.map((q, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-border bg-card/60 p-4 text-sm space-y-2 hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium flex-1">
                          <span className="text-primary font-bold mr-2">
                            Q{q.question_number}.
                          </span>
                          {q.question_text}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {q.has_diagram && (
                            <Badge variant="outline" className="text-xs">📊</Badge>
                          )}
                          {q.correct_option_index !== null ? (
                            <Badge variant="default" className="bg-green-600 text-xs">
                              Ans: ({q.correct_option_index + 1})
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">No Ans</Badge>
                          )}
                        </div>
                      </div>

                      {/* Options */}
                      <div className="space-y-1 pl-4">
                        {q.options.map((opt, optIdx) => (
                          <div
                            key={optIdx}
                            className={`text-xs py-1 px-2 rounded ${
                              q.correct_option_index === optIdx
                                ? "bg-green-500/10 text-green-700 dark:text-green-400 font-semibold border border-green-500/20"
                                : "text-muted-foreground"
                            }`}
                          >
                            ({optIdx + 1}) {opt}
                          </div>
                        ))}
                      </div>

                      {/* Explanation toggle */}
                      {q.explanation && (
                        <div>
                          <button
                            onClick={() => setExpandedQ(expandedQ === idx ? null : idx)}
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            {expandedQ === idx ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                            {expandedQ === idx ? "Hide" : "Show"} Explanation
                          </button>
                          {expandedQ === idx && (
                            <div className="mt-2 p-3 rounded bg-muted/50 text-xs text-muted-foreground leading-relaxed">
                              {q.explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
