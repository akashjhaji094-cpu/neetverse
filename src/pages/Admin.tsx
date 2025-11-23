import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { neetSubjects } from "@/data/neetChapters";

interface ParsedQuestion {
  number: number;
  text: string;
  options: string[];
  answer?: string;
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
    .replace(/\s+/g, " ")
    .trim();
};

const parseQuestionsFromHtml = (html: string): ParsedQuestion[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

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

  const questionNodes = Array.from(doc.querySelectorAll(".question-item"));

  return questionNodes.map((node, index) => {
    const numberRaw = node.querySelector(".question-number")?.textContent || "";
    const numberMatch = numberRaw.match(/(\d+)/);
    const number = numberMatch ? Number(numberMatch[1]) : index + 1;

    const contentNode = node.querySelector(".question-content") || node;
    const rawQuestion = contentNode.textContent || "";

    const optionNodes = Array.from(node.querySelectorAll(".option"));
    const options = optionNodes.map((opt) => {
      const label = opt.querySelector(".option-label")?.textContent || "";
      const text = opt.querySelector(".option-text")?.textContent || "";
      const full = `${label} ${text}`.trim();
      return sanitizeMathText(full);
    });

    return {
      number,
      text: sanitizeMathText(rawQuestion),
      options,
      answer: answerMap.get(number),
    };
  });
};

const Admin = () => {
  const [subjectId, setSubjectId] = useState<string>("physics");
  const [chapterId, setChapterId] = useState<string>("");
  const [fileName, setFileName] = useState<string>("");
  const [rawPreview, setRawPreview] = useState<string>("");
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);

  const selectedSubject = neetSubjects.find((s) => s.id === subjectId) || neetSubjects[0];

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setFileName(file.name);
    setRawPreview(text.slice(0, 2000));
    const parsed = parseQuestionsFromHtml(text);
    setQuestions(parsed);
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="section-padding">
        <div className="container-custom space-y-6">
          <header className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Admin Panel
            </p>
            <h1 className="text-3xl md:text-4xl font-bold">HTML Question Importer</h1>
            <p className="text-muted-foreground max-w-2xl">
              Upload NEET-style HTML practice files (like the ones you shared). We&apos;ll parse
              clean questions, options and answer keys without extra symbols like $, (, or /.
            </p>
          </header>

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
                  />
                  {fileName && (
                    <p className="text-xs text-muted-foreground">Loaded: {fileName}</p>
                  )}
                </div>

                <Button type="button" disabled={!questions.length || !chapterId} className="w-full">
                  Save to backend (coming soon)
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 flex flex-col">
              <CardHeader>
                <CardTitle>Parsed Questions Preview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!questions.length ? (
                  <p className="text-sm text-muted-foreground">
                    Upload an HTML file to see a clean preview of detected questions and
                    answer keys.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Parsed <span className="font-semibold text-foreground">{questions.length}</span>{" "}
                      questions. Showing first 10 below.
                    </p>
                    <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2">
                      {questions.slice(0, 10).map((q) => (
                        <div
                          key={q.number}
                          className="rounded-md border border-border bg-card/60 p-3 text-sm space-y-2"
                        >
                          <div className="font-medium">
                            Q{q.number}. {q.text}
                          </div>
                          {q.options.length > 0 && (
                            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                              {q.options.map((opt, idx) => (
                                <li key={idx}>{opt}</li>
                              ))}
                            </ul>
                          )}
                          {q.answer && (
                            <p className="text-xs text-foreground">
                              <span className="font-semibold">Answer:</span> {q.answer}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {rawPreview && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Raw HTML (truncated)</p>
                    <Textarea
                      readOnly
                      className="h-40 text-xs font-mono"
                      value={rawPreview}
                    />
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
