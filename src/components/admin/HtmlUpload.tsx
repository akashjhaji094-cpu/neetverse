import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { neetSubjects } from "@/data/neetChapters";
import { neetPlanner } from "@/data/neetPlanner";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { parseHtmlFile, type ParsedQuestion } from "@/lib/htmlQuestionParser";
import {
  Upload,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
} from "lucide-react";

// Load MathJax once
const loadMathJax = () => {
  if (document.getElementById('mathjax-script')) return;
  const config = document.createElement('script');
  config.type = 'text/javascript';
  config.textContent = `window.MathJax = {
    tex: { inlineMath: [['$','$'],['\\\\(','\\\\)']], displayMath: [['$$','$$'],['\\\\[','\\\\]']], processEscapes: true },
    options: { ignoreHtmlClass: "tex2jax_ignore", processHtmlClass: "tex2jax_process" },
    startup: { typeset: false }
  };`;
  document.head.appendChild(config);
  const script = document.createElement('script');
  script.id = 'mathjax-script';
  script.async = true;
  script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
  document.head.appendChild(script);
};

const typesetMath = (el: HTMLElement | null) => {
  if (!el || !(window as any).MathJax?.typesetPromise) return;
  (window as any).MathJax.typesetPromise([el]).catch(() => {});
};

export const HtmlUpload = () => {
  const [subjectId, setSubjectId] = useState<string>("physics");
  const [chapterId, setChapterId] = useState<string>("");
  const [topicId, setTopicId] = useState<string>("");
  const [availableTopics, setAvailableTopics] = useState<{ id: string; name: string }[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    withAnswers: 0,
    withImages: 0,
    unmatched: 0,
  });

  const previewRef = useRef<HTMLDivElement>(null);

  const selectedSubject =
    neetPlanner.find((s) => s.id === subjectId) || neetPlanner[0];
  const selectedChapter = selectedSubject.chapters.find((c) => c.id === chapterId);
  // Group chapters by section (Physical/Organic/Inorganic, Botany/Zoology)
  const chaptersBySection = selectedSubject.chapters.reduce<Record<string, typeof selectedSubject.chapters>>(
    (acc, c) => { (acc[c.section] ||= []).push(c); return acc; },
    {}
  );

  // Load MathJax on mount, typeset when questions change
  useEffect(() => { loadMathJax(); }, []);

  // Load topics whenever chapter changes
  useEffect(() => {
    setTopicId("");
    setAvailableTopics([]);
    if (!chapterId) return;
    // chapterId here is a static slug from neetPlanner. We need the real DB uuid.
    (async () => {
      const { data: chap } = await supabase.from("chapters").select("id").eq("slug", chapterId).maybeSingle();
      if (!chap?.id) return;
      const { data } = await supabase.from("topics").select("id, name, position").eq("chapter_id", chap.id).order("position");
      setAvailableTopics((data || []).map((t: any) => ({ id: t.id, name: t.name })));
    })();
  }, [chapterId]);

  useEffect(() => {
    if (questions.length > 0) {
      const timer = setTimeout(() => typesetMath(previewRef.current), 200);
      return () => clearTimeout(timer);
    }
  }, [questions, expandedQ]);

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const MAX_FILES = 10;
    if (files.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files at a time`);
      return;
    }

    let totalSizeMB = 0;
    for (let i = 0; i < files.length; i++) {
      totalSizeMB += files[i].size / (1024 * 1024);
    }
    if (totalSizeMB > 50) {
      toast.error("Total file size too large (max 50MB)");
      return;
    }

    setQuestions([]);
    setStats({ total: 0, withAnswers: 0, withImages: 0, unmatched: 0 });

    try {
      const names: string[] = [];
      const allQuestions: ParsedQuestion[] = [];
      let totalMatched = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        names.push(file.name);
        const htmlContent = await file.text();
        const result = parseHtmlFile(htmlContent, file.name);
        allQuestions.push(...result.questions);
        totalMatched += result.matchedAnswers;
        
        if (result.questions.length === 0) {
          toast.warning(`No questions found in ${file.name}`);
        }
      }

      setFileNames(names);

      if (allQuestions.length === 0) {
        toast.error("No questions found in any uploaded file");
        return;
      }

      setQuestions(allQuestions);

      const withImages = allQuestions.filter((q) => q.images.length > 0).length;
      const unmatched = allQuestions.filter((q) => q.correct_option_index === null).length;

      setStats({
        total: allQuestions.length,
        withAnswers: totalMatched,
        withImages,
        unmatched,
      });

      toast.success(
        `Parsed ${allQuestions.length} questions from ${files.length} file(s). ${totalMatched} answers matched.`
      );
    } catch (error: any) {
      console.error("Parse error:", error);
      toast.error(`Failed to parse: ${error.message}`);
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
          explanation: null,
          images: q.images,
          difficulty: "auto_medium",
          subject_id: subjectId,
          chapter_id: chapterId,
          source_file: fileNames.join(", "),
          raw_html: q.question_html,
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

      // If a topic was picked, also tag every inserted question with that topic
      if (topicId && (response.data as any)?.inserted_ids?.length) {
        const ids: string[] = (response.data as any).inserted_ids;
        const rows = ids.map((qid) => ({ question_id: qid, topic_id: topicId }));
        await supabase.from("question_topics").upsert(rows, { onConflict: "question_id,topic_id" });
      }

      setUploadProgress(100);
      toast.success(
        `Saved ${questionsToSave.length} questions to ${selectedSubject.name} → ${selectedChapter?.name}`
      );

      setQuestions([]);
      setFileNames([]);
      setStats({ total: 0, withAnswers: 0, withImages: 0, unmatched: 0 });
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
                <p className="text-xs text-muted-foreground">Answers Matched</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <ImageIcon className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold">{stats.withImages}</p>
                <p className="text-xs text-muted-foreground">With Images</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold">{stats.unmatched}</p>
                <p className="text-xs text-muted-foreground">Unmatched Ans</p>
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
              <Upload className="h-5 w-5 text-primary" />
              Import Settings
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
                disabled={uploading}
              >
                {neetPlanner.map((subject) => (
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
                disabled={uploading}
              >
                <option value="">Select chapter</option>
                {Object.entries(chaptersBySection).map(([section, chs]) => (
                  <optgroup key={section} label={section}>
                    {chs.map((chapter) => (
                      <option key={chapter.id} value={chapter.id}>{chapter.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                HTML Files (up to 10)
              </label>
              <Input
                type="file"
                accept=".html,.htm"
                onChange={handleFileChange}
                disabled={uploading}
                multiple
              />
              {fileNames.length > 0 && (
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
              disabled={!questions.length || !chapterId || uploading}
              className="w-full"
              onClick={handleSaveToBackend}
            >
              {uploading
                ? "Saving..."
                : `Confirm & Save ${questions.length} Questions`}
            </Button>
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Parsed Questions Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!questions.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Upload HTML files to parse questions</p>
                <p className="text-xs mt-2">
                  No AI — instant client-side parsing. Supports up to 10 files.
                </p>
              </div>
            ) : (
              <div ref={previewRef} className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
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
                        <span dangerouslySetInnerHTML={{ __html: expandedQ === idx ? q.question_html : (q.question_html.length > 200 ? q.question_html.substring(0, 200) + '...' : q.question_html) }} />
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {q.correct_option_index !== null ? (
                          <Badge variant="default">
                            Ans: ({q.correct_option_index + 1})
                          </Badge>
                        ) : (
                          <Badge variant="destructive">No Match</Badge>
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
                            ({optIdx + 1})
                          </span>
                          <span dangerouslySetInnerHTML={{ __html: q.options_html[optIdx] || opt }} />
                        </div>
                      ))}
                    </div>

                    {/* Expanded details */}
                    {expandedQ === idx && (
                      <>
                        {/* Images */}
                        {q.images.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-medium text-primary">Images:</p>
                            {q.images.map((src, imgIdx) => (
                              <img
                                key={imgIdx}
                                src={src}
                                alt={`Q${q.question_number} diagram`}
                                className="max-w-full h-auto max-h-48 rounded border border-border"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ))}
                          </div>
                        )}

                        {/* Answer value from answer key */}
                        <div className="mt-3 p-3 bg-muted/50 rounded-md text-xs">
                          <p className="font-medium text-primary mb-1">
                            Answer Key Value:
                          </p>
                          <p className="text-muted-foreground">
                            {q.answer_value || "Not found in answer key"}
                          </p>
                        </div>

                        {/* Badges */}
                        <div className="flex gap-2 mt-2">
                          {q.has_diagram && (
                            <Badge variant="outline" className="text-xs">
                              📊 Has Image
                            </Badge>
                          )}
                          {q.correct_option_index !== null && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              ✅ Answer Matched
                            </Badge>
                          )}
                          {q.correct_option_index === null && q.answer_value && (
                            <Badge variant="outline" className="text-xs text-amber-600">
                              ⚠️ Answer not matched to option
                            </Badge>
                          )}
                        </div>
                      </>
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
