import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { neetSubjects } from "@/data/neetChapters";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Upload, FileCheck, AlertCircle, CheckCircle2, Image as ImageIcon } from "lucide-react";

interface ParsedQuestion {
  number: number;
  text: string;
  options: string[];
  optionImages: (string | null)[];
  questionImages: string[];
  answer?: string;
  correctIndex?: number | null;
}

const sanitizeMathText = (value: string): string => {
  return value
    .replace(/\$/g, "")
    .replace(/\\\(/g, "")
    .replace(/\\\)/g, "")
    .replace(/\\\[/g, "")
    .replace(/\\\]/g, "")
    .replace(/\\mathsf\{([^}]*)\}/g, "$1")
    .replace(/\\mathrm\{([^}]*)\}/g, "$1")
    .replace(/\\text\{([^}]*)\}/g, "$1")
    .replace(/\\mathring\{([^}]*)\}/g, "$1")
    .replace(/\\mathbb\{([^}]*)\}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
};

const extractImageSrc = (element: Element): string | null => {
  const img = element.querySelector("img");
  if (!img) return null;
  
  const src = img.getAttribute("src") || "";
  if (src.startsWith("data:image")) {
    return src; // Return base64 data URLs as-is
  }
  return null;
};

const findCorrectOptionIndex = (
  answerText: string,
  options: string[]
): number | null => {
  if (!answerText || !options.length) return null;

  const cleanAnswer = sanitizeMathText(answerText.toLowerCase().trim());

  // Try exact match first
  for (let i = 0; i < options.length; i++) {
    const cleanOption = sanitizeMathText(options[i].toLowerCase().trim());
    // Remove option labels like (1), (2), etc.
    const optionWithoutLabel = cleanOption.replace(/^\(\d+\)\s*/, "");
    
    if (
      cleanOption === cleanAnswer ||
      optionWithoutLabel === cleanAnswer ||
      cleanOption.includes(cleanAnswer) ||
      cleanAnswer.includes(optionWithoutLabel)
    ) {
      return i;
    }
  }

  // Try fuzzy matching for short answers
  if (cleanAnswer.length < 50) {
    for (let i = 0; i < options.length; i++) {
      const cleanOption = sanitizeMathText(options[i].toLowerCase().trim());
      const optionWithoutLabel = cleanOption.replace(/^\(\d+\)\s*/, "");
      
      const similarity = 
        cleanAnswer.split(" ").filter((word) => optionWithoutLabel.includes(word)).length;
      
      if (similarity > 0 && cleanAnswer.split(" ").length <= 5) {
        return i;
      }
    }
  }

  return null;
};

const parseQuestionsFromHtml = (html: string): ParsedQuestion[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // Extract answer key
  const answerMap = new Map<number, string>();
  const answerItems = Array.from(doc.querySelectorAll(".answer-item"));

  answerItems.forEach((item) => {
    const numberText = item.querySelector(".answer-number")?.textContent || "";
    const valueText = item.querySelector(".answer-value")?.textContent || "";
    const match = numberText.match(/(\d+)/);
    if (!match) return;
    const qNum = Number(match[1]);
    if (!Number.isNaN(qNum)) {
      answerMap.set(qNum, sanitizeMathText(valueText));
    }
  });

  // Extract questions
  const questionNodes = Array.from(doc.querySelectorAll(".question-item"));

  return questionNodes.map((node, index) => {
    const numberRaw = node.querySelector(".question-number")?.textContent || "";
    const numberMatch = numberRaw.match(/(\d+)/);
    const number = numberMatch ? Number(numberMatch[1]) : index + 1;

    // Get question text and images
    const contentNode = node.querySelector(".question-content") || node;
    const rawQuestion = contentNode.textContent || "";
    
    // Extract question images
    const questionImageNodes = Array.from(
      contentNode.querySelectorAll(".question-image")
    );
    const questionImages = questionImageNodes
      .map((img) => extractImageSrc(img))
      .filter((src): src is string => src !== null);

    // Extract options with images
    const optionNodes = Array.from(node.querySelectorAll(".option"));
    const options: string[] = [];
    const optionImages: (string | null)[] = [];

    optionNodes.forEach((opt) => {
      const label = opt.querySelector(".option-label")?.textContent || "";
      const text = opt.querySelector(".option-text")?.textContent || "";
      const full = `${label} ${text}`.trim();
      options.push(sanitizeMathText(full));

      // Check for option image
      const optImg = opt.querySelector(".option-image");
      optionImages.push(optImg ? extractImageSrc(optImg) : null);
    });

    const answer = answerMap.get(number);
    const correctIndex = answer ? findCorrectOptionIndex(answer, options) : null;

    return {
      number,
      text: sanitizeMathText(rawQuestion),
      options,
      optionImages,
      questionImages,
      answer,
      correctIndex,
    };
  });
};

const Admin = () => {
  const [subjectId, setSubjectId] = useState<string>("physics");
  const [chapterId, setChapterId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    withAnswers: 0,
    withImages: 0,
    matchedAnswers: 0,
  });

  const selectedSubject = neetSubjects.find((s) => s.id === subjectId) || neetSubjects[0];

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setFileName(file.name);
    const parsed = parseQuestionsFromHtml(text);
    setQuestions(parsed);

    // Calculate stats
    const withAnswers = parsed.filter((q) => q.answer).length;
    const withImages = parsed.filter(
      (q) => q.questionImages.length > 0 || q.optionImages.some((img) => img)
    ).length;
    const matchedAnswers = parsed.filter((q) => q.correctIndex !== null).length;

    setStats({
      total: parsed.length,
      withAnswers,
      withImages,
      matchedAnswers,
    });

    toast.success(`Parsed ${parsed.length} questions from ${file.name}`);
  };

  const uploadImageToStorage = async (
    base64Data: string,
    questionNum: number,
    type: "question" | "option",
    optionIndex?: number
  ): Promise<string | null> => {
    try {
      // Extract base64 data
      const match = base64Data.match(/^data:image\/(png|jpg|jpeg|gif|webp);base64,(.+)$/);
      if (!match) return null;

      const [, ext, base64] = match;
      const fileName = `q${questionNum}_${type}${optionIndex !== undefined ? `_opt${optionIndex}` : ""}.${ext}`;
      const filePath = `${chapterId}/${fileName}`;

      // Convert base64 to blob
      const byteString = atob(base64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], { type: `image/${ext}` });

      const { data, error } = await supabase.storage
        .from("question-images")
        .upload(filePath, blob, {
          upsert: true,
          contentType: `image/${ext}`,
        });

      if (error) throw error;

      const { data: publicURL } = supabase.storage
        .from("question-images")
        .getPublicUrl(data.path);

      return publicURL.publicUrl;
    } catch (error) {
      console.error("Image upload error:", error);
      return null;
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
      const questionsToSave = [];

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        setUploadProgress(Math.floor(((i + 1) / questions.length) * 100));

        // Upload question images
        const uploadedQuestionImages: string[] = [];
        for (const imgData of q.questionImages) {
          if (imgData.startsWith("data:image")) {
            const url = await uploadImageToStorage(imgData, q.number, "question");
            if (url) uploadedQuestionImages.push(url);
          }
        }

        // Upload option images
        const uploadedOptions = await Promise.all(
          q.options.map(async (opt, idx) => {
            const optImg = q.optionImages[idx];
            if (optImg && optImg.startsWith("data:image")) {
              const url = await uploadImageToStorage(optImg, q.number, "option", idx);
              return url ? `${opt}|IMG:${url}` : opt;
            }
            return opt;
          })
        );

        questionsToSave.push({
          question_text: q.text,
          options: uploadedOptions,
          correct_option_index: q.correctIndex,
          explanation: null,
          images: uploadedQuestionImages,
          difficulty: "auto_medium",
          subject_id: subjectId,
          chapter_id: chapterId,
          source_file: fileName,
        });
      }

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
        `Successfully saved ${questionsToSave.length} questions to ${selectedSubject.name} - ${selectedSubject.chapters.find((c) => c.id === chapterId)?.name}`
      );

      // Reset form
      setQuestions([]);
      setFileName("");
      setStats({ total: 0, withAnswers: 0, withImages: 0, matchedAnswers: 0 });
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="section-padding">
        <div className="container-custom space-y-6">
          <header className="space-y-2">
            <div className="flex items-center gap-2">
              <Upload className="w-6 h-6 text-primary" />
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                Admin Panel
              </p>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold">
              HTML Question Importer
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Upload NEET-style HTML files to extract questions, options with images, and
              automatically match answer keys. All data is cleaned and saved to your backend.
            </p>
          </header>

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
                    <p className="text-2xl font-bold">{stats.matchedAnswers}</p>
                    <p className="text-xs text-muted-foreground">Matched Answers</p>
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
                    <p className="text-2xl font-bold">
                      {stats.total - stats.matchedAnswers}
                    </p>
                    <p className="text-xs text-muted-foreground">Need Review</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Import Settings</CardTitle>
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
                    disabled={uploading}
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
                  <label className="text-sm font-medium">HTML File</label>
                  <Input
                    type="file"
                    accept=".html,.htm"
                    onChange={handleFileChange}
                    disabled={uploading}
                  />
                  {fileName && (
                    <p className="text-xs text-muted-foreground">Loaded: {fileName}</p>
                  )}
                </div>

                {uploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Uploading...</span>
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
                  {uploading ? "Saving..." : "Save to Backend"}
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 flex flex-col">
              <CardHeader>
                <CardTitle>Parsed Questions Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!questions.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Upload an HTML file to see parsed questions</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {questions.slice(0, 15).map((q) => (
                      <div
                        key={q.number}
                        className="rounded-md border border-border bg-card/60 p-4 text-sm space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium flex-1">
                            <span className="text-primary mr-2">Q{q.number}.</span>
                            {q.text}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {q.questionImages.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                <ImageIcon className="w-3 h-3 mr-1" />
                                {q.questionImages.length}
                              </Badge>
                            )}
                            {q.correctIndex !== null ? (
                              <Badge variant="default" className="text-xs bg-green-500">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Matched
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                No Match
                              </Badge>
                            )}
                          </div>
                        </div>

                        {q.options.length > 0 && (
                          <ul className="list-none space-y-1.5 text-muted-foreground ml-2">
                            {q.options.map((opt, idx) => (
                              <li
                                key={idx}
                                className={`flex items-start gap-2 ${
                                  q.correctIndex === idx
                                    ? "text-green-600 dark:text-green-400 font-medium"
                                    : ""
                                }`}
                              >
                                <span className="flex-shrink-0">
                                  {q.correctIndex === idx ? "✓" : "•"}
                                </span>
                                <span className="flex-1">{opt}</span>
                                {q.optionImages[idx] && (
                                  <ImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                )}
                              </li>
                            ))}
                          </ul>
                        )}

                        {q.answer && (
                          <div className="text-xs pt-2 border-t border-border">
                            <span className="font-semibold text-foreground">Answer Key: </span>
                            <span className="text-muted-foreground">{q.answer}</span>
                            {q.correctIndex !== null && (
                              <span className="ml-2 text-green-600 dark:text-green-400">
                                → Option {q.correctIndex + 1}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    {questions.length > 15 && (
                      <p className="text-sm text-muted-foreground text-center">
                        ... and {questions.length - 15} more questions
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Admin;
