import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { neetSubjects } from "@/data/neetChapters";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Upload,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Brain,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ParsedQuestion {
  question_number: number;
  question_text: string;
  options: string[];
  correct_option_index: number | null;
  explanation: string | null;
  has_diagram: boolean;
}

const cleanPdf2HtmlText = (html: string): string => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Remove scripts, styles, sidebar
  doc.querySelectorAll("script, style, #sidebar").forEach((el) => el.remove());

  const pageContainer = doc.getElementById("page-container");
  if (!pageContainer) {
    // Fallback: get body text
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  }

  // Get all text nodes from pages, preserving some structure
  const pages = pageContainer.querySelectorAll(".pf");
  const textParts: string[] = [];

  pages.forEach((page) => {
    const textContent = page.textContent || "";
    textParts.push(textContent);
  });

  let rawText = textParts.join("\n\n");

  // Fix pdf2htmlEX character spacing: merge single-char-space patterns
  // e.g., "C h e m i s t r y" → "Chemistry"
  rawText = rawText.replace(
    /(?<=[A-Za-z0-9]) (?=[A-Za-z0-9]) (?=[A-Za-z0-9])/g,
    ""
  );

  // Multiple passes to clean up character spacing
  for (let i = 0; i < 5; i++) {
    rawText = rawText.replace(
      /(\b[A-Za-z])\s([A-Za-z]\b)/g,
      (_, a, b) => {
        // Only merge if both are single chars
        return a + b;
      }
    );
  }

  // Clean up excessive whitespace
  rawText = rawText.replace(/[ \t]+/g, " ");
  rawText = rawText.replace(/\n{3,}/g, "\n\n");

  return rawText.trim();
};

export const HtmlUpload = () => {
  const [subjectId, setSubjectId] = useState<string>("physics");
  const [chapterId, setChapterId] = useState<string>("");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    withAnswers: 0,
    withExplanations: 0,
    withDiagrams: 0,
  });

  const selectedSubject =
    neetSubjects.find((s) => s.id === subjectId) || neetSubjects[0];

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const MAX_FILES = 3;
    if (files.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files at a time`);
      return;
    }

    let totalSizeMB = 0;
    for (let i = 0; i < files.length; i++) {
      totalSizeMB += files[i].size / (1024 * 1024);
    }
    if (totalSizeMB > 10) {
      toast.error("Total file size too large (max 10MB)");
      return;
    }

    setParsing(true);
    setQuestions([]);
    setStats({ total: 0, withAnswers: 0, withExplanations: 0, withDiagrams: 0 });

    try {
      const names: string[] = [];
      let combinedText = "";

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        names.push(file.name);
        const htmlContent = await file.text();
        const extracted = cleanPdf2HtmlText(htmlContent);
        combinedText += extracted + "\n\n---FILE BREAK---\n\n";
      }

      setFileNames(names);

      if (combinedText.length < 50) {
        toast.error("No readable text found in the uploaded files");
        setParsing(false);
        return;
      }

      toast.info("AI is analyzing your files... This may take a moment");

      // Send to AI edge function
      const { data, error } = await supabase.functions.invoke(
        "parse-pdf-questions",
        {
          body: { text: combinedText },
        }
      );

      if (error) {
        throw new Error(error.message || "AI parsing failed");
      }

      if (!data?.success || !data?.questions?.length) {
        toast.error(data?.error || "No questions could be extracted");
        setParsing(false);
        return;
      }

      const parsed: ParsedQuestion[] = data.questions;
      setQuestions(parsed);

      const withAnswers = parsed.filter(
        (q) => q.correct_option_index !== null
      ).length;
      const withExplanations = parsed.filter(
        (q) => q.explanation !== null
      ).length;
      const withDiagrams = parsed.filter((q) => q.has_diagram).length;

      setStats({
        total: parsed.length,
        withAnswers,
        withExplanations,
        withDiagrams,
      });

      toast.success(
        `AI extracted ${parsed.length} questions from ${files.length} file(s)`
      );
    } catch (error: any) {
      console.error("Parse error:", error);
      toast.error(`Failed to parse: ${error.message}`);
    } finally {
      setParsing(false);
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
        setUploadProgress(Math.floor(((i + 1) / questions.length) * 50));
        return {
          question_text: q.question_text,
          options: q.options,
          correct_option_index: q.correct_option_index,
          explanation: q.explanation,
          images: [],
          difficulty: "auto_medium",
          subject_id: subjectId,
          chapter_id: chapterId,
          source_file: fileNames.join(", "),
        };
      });

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to save questions");
        return;
      }

      setUploadProgress(60);

      const response = await supabase.functions.invoke("import-questions", {
        body: { questions: questionsToSave },
      });

      if (response.error) throw response.error;

      setUploadProgress(100);
      toast.success(
        `Saved ${questionsToSave.length} questions to ${selectedSubject.name} - ${selectedSubject.chapters.find((c) => c.id === chapterId)?.name}`
      );

      setQuestions([]);
      setFileNames([]);
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
                <p className="text-xs text-muted-foreground">
                  With Explanations
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold">{stats.withDiagrams}</p>
                <p className="text-xs text-muted-foreground">Has Diagrams</p>
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
              <Brain className="h-5 w-5 text-primary" />
              AI Import Settings
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
              <label className="text-sm font-medium">
                HTML Files (up to 3)
              </label>
              <Input
                type="file"
                accept=".html,.htm"
                onChange={handleFileChange}
                disabled={uploading || parsing}
                multiple
              />
              {parsing && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>AI is extracting questions...</span>
                </div>
              )}
              {fileNames.length > 0 && !parsing && (
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">
                    Loaded {fileNames.length} file(s):
                  </p>
                  <ul className="list-disc list-inside">
                    {fileNames.map((name, idx) => (
                      <li key={idx}>{name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Saving...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            <Button
              type="button"
              disabled={
                !questions.length || !chapterId || uploading || parsing
              }
              className="w-full"
              onClick={handleSaveToBackend}
            >
              {uploading
                ? "Saving..."
                : parsing
                  ? "AI Parsing..."
                  : `Save ${questions.length} Questions`}
            </Button>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>AI Extracted Questions Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsing ? (
              <div className="text-center py-12">
                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-muted-foreground">
                  AI is reading and extracting questions...
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  This may take 30-60 seconds depending on file size
                </p>
              </div>
            ) : !questions.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Upload HTML files to extract questions using AI</p>
                <p className="text-xs mt-2">
                  Supports pdf2htmlEX converted files
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                {questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="rounded-md border border-border bg-card/60 p-4 text-sm space-y-3"
                  >
                    <div
                      className="flex items-start justify-between gap-2 cursor-pointer"
                      onClick={() =>
                        setExpandedQ(expandedQ === idx ? null : idx)
                      }
                    >
                      <div className="font-medium flex-1">
                        <span className="text-primary mr-2">
                          Q{q.question_number}.
                        </span>
                        {q.question_text.length > 120 && expandedQ !== idx
                          ? q.question_text.substring(0, 120) + "..."
                          : q.question_text}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {q.correct_option_index !== null ? (
                          <Badge variant="default">
                            Ans: {String.fromCharCode(65 + q.correct_option_index)}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">No Ans</Badge>
                        )}
                        {expandedQ === idx ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </div>

                    {/* Options always visible */}
                    <div className="space-y-1 pl-4">
                      {q.options.map((opt, optIdx) => (
                        <div
                          key={optIdx}
                          className={`text-xs py-1 px-2 rounded ${
                            q.correct_option_index === optIdx
                              ? "bg-green-500/10 text-green-600 dark:text-green-400 font-medium border border-green-500/20"
                              : ""
                          }`}
                        >
                          <span className="font-medium mr-1">
                            {String.fromCharCode(65 + optIdx)})
                          </span>
                          {opt}
                        </div>
                      ))}
                    </div>

                    {/* Explanation (expanded) */}
                    {expandedQ === idx && q.explanation && (
                      <div className="mt-3 p-3 bg-muted/50 rounded-md text-xs">
                        <p className="font-medium text-primary mb-1">
                          Explanation:
                        </p>
                        <p className="text-muted-foreground">
                          {q.explanation}
                        </p>
                      </div>
                    )}

                    {/* Badges */}
                    {expandedQ === idx && (
                      <div className="flex gap-2 mt-2">
                        {q.has_diagram && (
                          <Badge variant="outline" className="text-xs">
                            📊 Has Diagram
                          </Badge>
                        )}
                        {q.explanation && (
                          <Badge variant="outline" className="text-xs">
                            💡 Has Explanation
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
