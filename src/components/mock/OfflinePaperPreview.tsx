import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Loader2, Download, Camera } from "lucide-react";
import { Question } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import neetverseLogo from "@/assets/neetverse-logo.jpg";
import { formatQuestionHtml } from "@/lib/questionFormatter";

interface SubjectGroup {
  name: string;
  startIdx: number;
  endIdx: number;
}

interface OfflinePaperPreviewProps {
  questions: Question[];
  title: string;
  totalQuestions: number;
  totalMarks: number;
  duration: string;
  subjectGroups: SubjectGroup[];
  onBack: () => void;
}

export const OfflinePaperPreview = ({
  questions,
  title,
  totalQuestions,
  totalMarks,
  duration,
  subjectGroups,
  onBack,
}: OfflinePaperPreviewProps) => {
  const [ready, setReady] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Loading MathJax...");
  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [chapterMap, setChapterMap] = useState<Record<string, { name: string; subjectId: string }>>({});
  const [subjectMap, setSubjectMap] = useState<Record<string, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const labels = ["A", "B", "C", "D"];

  // Fetch chapter & subject names for "Topics covered" section
  useEffect(() => {
    const fetchMeta = async () => {
      const chapterIds = Array.from(new Set(questions.map(q => q.chapter_id).filter(Boolean)));
      const subjectIds = Array.from(new Set(questions.map(q => q.subject_id).filter(Boolean)));
      if (chapterIds.length === 0) return;
      const [chRes, subRes] = await Promise.all([
        supabase.from("chapters").select("id, name, subject_id").in("id", chapterIds),
        supabase.from("subjects").select("id, name").in("id", subjectIds),
      ]);
      const cm: Record<string, { name: string; subjectId: string }> = {};
      (chRes.data || []).forEach(c => { cm[c.id] = { name: c.name, subjectId: c.subject_id }; });
      const sm: Record<string, string> = {};
      (subRes.data || []).forEach(s => { sm[s.id] = s.name; });
      setChapterMap(cm);
      setSubjectMap(sm);
    };
    fetchMeta();
  }, [questions]);

  // Build "Topics covered" grouped by subject -> unique chapter list
  const topicsBySubject: Record<string, string[]> = {};
  questions.forEach(q => {
    const subj = subjectMap[q.subject_id] || "General";
    const chap = chapterMap[q.chapter_id]?.name;
    if (!chap) return;
    if (!topicsBySubject[subj]) topicsBySubject[subj] = [];
    if (!topicsBySubject[subj].includes(chap)) topicsBySubject[subj].push(chap);
  });

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const MJ = (window as any).MathJax;
      if (!MJ) {
        setLoadingStatus("Loading MathJax engine...");
        await new Promise<void>((resolve) => {
          (window as any).MathJax = {
            tex: {
              inlineMath: [["$", "$"], ["\\(", "\\)"]],
              displayMath: [["$$", "$$"], ["\\[", "\\]"]],
            },
            startup: {
              ready: () => {
                (window as any).MathJax.startup.defaultReady();
                resolve();
              },
            },
          };
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
          script.async = true;
          document.head.appendChild(script);
        });
      }

      if (cancelled) return;
      setLoadingStatus("Rendering formulas...");
      await new Promise((r) => setTimeout(r, 300));

      const mj = (window as any).MathJax;
      if (mj?.typesetPromise && containerRef.current) {
        try { await mj.typesetPromise([containerRef.current]); } catch {}
      }

      if (cancelled) return;
      setLoadingStatus("Loading images...");

      const imgs = containerRef.current?.querySelectorAll("img") || [];
      await Promise.all(
        Array.from(imgs).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) resolve();
              else { img.onload = () => resolve(); img.onerror = () => resolve(); }
            })
        )
      );

      if (cancelled) return;
      setReady(true);
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const handlePrint = useCallback(() => { window.print(); }, []);

  // OMR Scanner Logic
  const handleOMRScan = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Process OMR - detect filled bubbles
        const detectedAnswers = processOMR(imageData, canvas.width, canvas.height, totalQuestions);
        
        // Generate report
        const report = generateReport(detectedAnswers, questions, subjectGroups);
        setScanResult(report);
        setShowScanner(true);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [questions, totalQuestions, subjectGroups]);

  // OMR Processing - detect dark bubbles in grid positions
  const processOMR = (imageData: ImageData, w: number, h: number, totalQ: number): (number | null)[] => {
    const data = imageData.data;
    const answers: (number | null)[] = [];

    // OMR grid parameters - estimate positions based on A4 proportions
    const cols = totalQ <= 90 ? 6 : 9;
    const perCol = Math.ceil(totalQ / cols);
    
    // OMR area roughly in lower 70% of page, after header
    const omrTop = h * 0.15;
    const omrBottom = h * 0.92;
    const omrLeft = w * 0.03;
    const omrRight = w * 0.97;
    
    const colWidth = (omrRight - omrLeft) / cols;
    const rowHeight = (omrBottom - omrTop) / perCol;

    for (let q = 0; q < totalQ; q++) {
      const col = Math.floor(q / perCol);
      const row = q % perCol;
      
      const cellLeft = omrLeft + col * colWidth;
      const cellTop = omrTop + row * rowHeight;
      
      // Each cell has 5 columns: Q, A, B, C, D
      const bubbleWidth = colWidth / 5;
      
      let darkest = -1;
      let darkestValue = 255;

      for (let opt = 0; opt < 4; opt++) {
        const bx = cellLeft + (opt + 1) * bubbleWidth + bubbleWidth * 0.2;
        const by = cellTop + rowHeight * 0.2;
        const bw = bubbleWidth * 0.6;
        const bh = rowHeight * 0.6;

        // Sample darkness in bubble region
        let totalDarkness = 0;
        let pixelCount = 0;

        for (let y = Math.floor(by); y < Math.min(Math.floor(by + bh), h); y++) {
          for (let x = Math.floor(bx); x < Math.min(Math.floor(bx + bw), w); x++) {
            const idx = (y * w + x) * 4;
            const gray = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
            totalDarkness += gray;
            pixelCount++;
          }
        }

        const avgBrightness = pixelCount > 0 ? totalDarkness / pixelCount : 255;
        if (avgBrightness < darkestValue && avgBrightness < 160) {
          darkestValue = avgBrightness;
          darkest = opt;
        }
      }

      answers.push(darkest >= 0 ? darkest : null);
    }

    return answers;
  };

  // Generate detailed report
  const generateReport = (
    detected: (number | null)[],
    qs: Question[],
    groups: SubjectGroup[]
  ) => {
    let totalCorrect = 0;
    let totalWrong = 0;
    let totalSkipped = 0;

    const subjectReports = groups.map((group) => {
      let correct = 0, wrong = 0, skipped = 0;
      const questionDetails: any[] = [];

      for (let i = group.startIdx; i < group.endIdx && i < qs.length; i++) {
        const q = qs[i];
        const userAns = detected[i];
        const correctAns = q.correct_option_index;

        if (userAns === null) {
          skipped++;
          totalSkipped++;
          questionDetails.push({ qNum: i + 1, status: 'skipped', userAns: null, correctAns });
        } else if (userAns === correctAns) {
          correct++;
          totalCorrect++;
          questionDetails.push({ qNum: i + 1, status: 'correct', userAns, correctAns });
        } else {
          wrong++;
          totalWrong++;
          questionDetails.push({ qNum: i + 1, status: 'wrong', userAns, correctAns });
        }
      }

      const score = correct * 4 - wrong * 1;
      const maxScore = (group.endIdx - group.startIdx) * 4;

      return {
        name: group.name,
        correct,
        wrong,
        skipped,
        score,
        maxScore,
        percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
        questionDetails,
      };
    });

    const totalScore = totalCorrect * 4 - totalWrong * 1;
    const maxScore = totalQuestions * 4;

    return {
      totalScore,
      maxScore,
      totalCorrect,
      totalWrong,
      totalSkipped,
      percentage: maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0,
      subjects: subjectReports,
    };
  };

  // OMR columns
  const omrCols = totalQuestions <= 90 ? 6 : 9;
  const omrPerCol = Math.ceil(totalQuestions / omrCols);

  // Scan Result View
  if (showScanner && scanResult) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="sticky top-0 z-50 bg-white border-b shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <Button variant="ghost" onClick={() => { setShowScanner(false); setScanResult(null); }} size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Paper
            </Button>
            <Button onClick={() => window.print()} size="sm" className="gap-2">
              <Printer className="h-4 w-4" /> Print Report
            </Button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Score Card */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-6 text-center" style={{ background: "linear-gradient(135deg, #1a1a6e, #3b82f6)" }}>
              <img src={neetverseLogo} alt="NEETVerse" className="w-14 h-14 rounded-xl mx-auto mb-2" />
              <h1 className="text-2xl font-black text-white tracking-wider">NEETVerse</h1>
              <p className="text-white/80 text-sm">OMR Scan Report — {title}</p>
              <div className="mt-4 bg-white/20 backdrop-blur rounded-xl p-4 inline-block">
                <p className="text-5xl font-black text-white">{scanResult.totalScore}</p>
                <p className="text-white/80 text-sm">out of {scanResult.maxScore}</p>
              </div>
            </div>

            {/* Overall Stats */}
            <div className="grid grid-cols-4 divide-x border-b">
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{scanResult.totalCorrect}</p>
                <p className="text-xs text-gray-500 uppercase font-semibold">Correct</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{scanResult.totalWrong}</p>
                <p className="text-xs text-gray-500 uppercase font-semibold">Wrong</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-gray-500">{scanResult.totalSkipped}</p>
                <p className="text-xs text-gray-500 uppercase font-semibold">Skipped</p>
              </div>
              <div className="p-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{scanResult.percentage}%</p>
                <p className="text-xs text-gray-500 uppercase font-semibold">Accuracy</p>
              </div>
            </div>

            {/* Subject-wise breakdown */}
            <div className="p-6 space-y-4">
              <h3 className="font-bold text-lg">Subject-wise Analysis</h3>
              {scanResult.subjects.map((sub: any) => (
                <div key={sub.name} className="border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-base">{sub.name}</h4>
                    <span className="font-bold text-lg" style={{ color: "#1a1a6e" }}>
                      {sub.score}/{sub.maxScore}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div className="bg-green-50 rounded-lg p-2">
                      <p className="font-bold text-green-600">{sub.correct}</p>
                      <p className="text-[10px] text-green-700">Correct</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2">
                      <p className="font-bold text-red-600">{sub.wrong}</p>
                      <p className="text-[10px] text-red-700">Wrong</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="font-bold text-gray-600">{sub.skipped}</p>
                      <p className="text-[10px] text-gray-700">Skipped</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2">
                      <p className="font-bold text-blue-600">{sub.percentage}%</p>
                      <p className="text-[10px] text-blue-700">Score %</p>
                    </div>
                  </div>

                  {/* Strength/Weakness */}
                  <div className="mt-3 text-sm">
                    {sub.percentage >= 70 && (
                      <p className="text-green-600 font-semibold">✅ Strong — Keep it up!</p>
                    )}
                    {sub.percentage >= 40 && sub.percentage < 70 && (
                      <p className="text-yellow-600 font-semibold">⚠️ Average — Needs more practice</p>
                    )}
                    {sub.percentage < 40 && (
                      <p className="text-red-600 font-semibold">❌ Weak — Focus on this subject</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Question-wise details */}
            <div className="p-6 border-t">
              <h3 className="font-bold text-lg mb-4">Question-wise Details</h3>
              {scanResult.subjects.map((sub: any) => (
                <div key={sub.name} className="mb-4">
                  <h4 className="font-bold text-sm uppercase text-gray-500 mb-2">{sub.name}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {sub.questionDetails.map((qd: any) => (
                      <div
                        key={qd.qNum}
                        className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold border ${
                          qd.status === 'correct'
                            ? 'bg-green-100 text-green-700 border-green-300'
                            : qd.status === 'wrong'
                            ? 'bg-red-100 text-red-700 border-red-300'
                            : 'bg-gray-100 text-gray-500 border-gray-300'
                        }`}
                        title={`Q${qd.qNum}: ${qd.status === 'skipped' ? 'Skipped' : `Your: ${labels[qd.userAns]}, Correct: ${labels[qd.correctAns]}`}`}
                      >
                        {qd.qNum}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300" /> Correct</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> Wrong</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-300" /> Skipped</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Hidden canvas for OMR processing */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleOMRScan}
      />

      {/* Fixed toolbar */}
      <div className="print:hidden sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={onBack} size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            {!ready && (
              <span className="text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {loadingStatus}
              </span>
            )}
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={!ready}
              size="sm"
              className="gap-2"
            >
              <Camera className="h-4 w-4" />
              Scan OMR
            </Button>
            <Button onClick={handlePrint} disabled={!ready} className="gap-2">
              {ready ? (
                <>
                  <Download className="h-4 w-4" />
                  Download / Print PDF
                </>
              ) : (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing...
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Paper content */}
      <div
        ref={containerRef}
        className="max-w-[210mm] mx-auto bg-white shadow-xl my-4 print:my-0 print:shadow-none"
        style={{ fontFamily: "'Times New Roman', Georgia, serif", color: "#111" }}
      >
        {/* ===== HEADER (clean, exam-style) ===== */}
        <div className="px-[15mm] pt-[12mm]">
          {/* Brand wordmark */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <img src={neetverseLogo} alt="NEETVerse" className="w-10 h-10 rounded-md" />
              <h1 className="text-3xl font-black tracking-[3px]" style={{ color: "#dc2626" }}>
                NEETVERSE
              </h1>
            </div>
            <p className="text-[8pt] text-gray-500 italic">neetverse.lovable.app</p>
          </div>
          <div className="h-[2px] w-full mb-3" style={{ background: "#dc2626" }} />

          {/* Paper title */}
          <h2 className="text-center text-[16pt] font-bold mb-1" style={{ color: "#111" }}>
            {title}
          </h2>

          {/* Date / Time / Marks row */}
          <div className="grid grid-cols-3 text-[10pt] mb-3">
            <span><b>Date:</b> {today}</span>
            <span className="text-center"><b>Time:</b> {duration}</span>
            <span className="text-right"><b>Total Marks:</b> {totalQuestions} × 4 = {totalMarks}</span>
          </div>

          {/* Topics covered */}
          {Object.keys(topicsBySubject).length > 0 && (
            <div className="mb-3 text-[9.5pt]">
              <h3 className="font-bold text-[10.5pt] mb-1" style={{ color: "#dc2626" }}>Topics covered</h3>
              {Object.entries(topicsBySubject).map(([subj, chapters]) => (
                <p key={subj} className="leading-snug mb-0.5">
                  <b>{subj}</b> — {chapters.join(", ")}
                </p>
              ))}
            </div>
          )}

          {/* Subject / Question count table */}
          <table className="w-full border-collapse text-[10pt] mb-3">
            <tbody>
              {subjectGroups.map((g) => (
                <tr key={g.name}>
                  <td className="border border-gray-700 px-2 py-1 font-bold" style={{ background: "#fef2f2" }}>
                    Subject: {g.name}
                  </td>
                  <td className="border border-gray-700 px-2 py-1 font-bold text-right" style={{ background: "#fef2f2" }}>
                    No. of Questions: {g.endIdx - g.startIdx}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Student info bar */}
          <div className="grid grid-cols-3 gap-3 mb-3 text-[9.5pt]">
            <div className="border-b border-gray-700 pb-0.5"><b>Name:</b></div>
            <div className="border-b border-gray-700 pb-0.5"><b>Roll No:</b></div>
            <div className="border-b border-gray-700 pb-0.5"><b>Batch:</b></div>
          </div>

          <div className="h-[1px] w-full bg-gray-400 mb-2" />
        </div>

        {/* ===== QUESTIONS — single column, exam-paper style ===== */}
        <div className="px-[15mm]">
          {subjectGroups.map((group) => {
            const sectionQs = questions.slice(group.startIdx, group.endIdx);
            return (
              <div key={group.name} className="mb-3">
                {/* Section divider */}
                <div
                  className="text-center font-bold text-[11pt] py-1 my-3 border-y-2"
                  style={{
                    borderColor: "#dc2626",
                    color: "#dc2626",
                    background: "#fef2f2",
                    pageBreakAfter: "avoid",
                  }}
                >
                  SECTION — {group.name.toUpperCase()} &nbsp;(Q. {group.startIdx + 1} – {group.endIdx})
                </div>

                {/* TWO-COLUMN questions with center divider */}
                <div
                  style={{
                    columnCount: 2,
                    columnGap: "8mm",
                    columnRule: "1px solid #999",
                  }}
                >
                  {sectionQs.map((q, i) => {
                    const qNum = group.startIdx + i + 1;
                    const options = (q.options as string[]) || [];
                    const images = (q.images as string[]) || [];
                    const content = formatQuestionHtml(q.raw_html || q.question_text);
                    return (
                      <div
                        key={q.id}
                        className="mb-3 neet-question-block"
                        style={{
                          breakInside: "avoid",
                          pageBreakInside: "avoid",
                          ["WebkitColumnBreakInside" as any]: "avoid",
                          display: "inline-block",
                          width: "100%",
                        }}
                      >
                        <div className="text-[10pt] leading-snug">
                          <span className="font-bold mr-1">{qNum}.</span>
                          <span dangerouslySetInnerHTML={{ __html: content }} />
                        </div>
                        {images.length > 0 && (
                          <div className="my-1.5 ml-4">
                            {images.map((src, ii) => (
                              <img
                                key={ii}
                                src={src}
                                className="max-w-full max-h-[140px] border border-gray-300"
                                alt={`Q${qNum} image`}
                                loading="eager"
                              />
                            ))}
                          </div>
                        )}
                        <div className="grid grid-cols-1 gap-y-0 text-[9.5pt] ml-4 mt-0.5">
                          {options.map((opt, oi) => (
                            <div key={oi} className="flex gap-1.5 items-baseline leading-snug py-[1px]">
                              <span className="font-semibold whitespace-nowrap">({oi + 1})</span>
                              <span dangerouslySetInnerHTML={{ __html: opt }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Page footer on question pages */}
        <div className="px-[15mm] py-2 mt-3 text-[8pt] text-gray-500 border-t border-gray-300 mx-[10mm]">
          <div className="flex justify-between">
            <span><b style={{ color: "#dc2626" }}>NEETVerse</b> — Your Universe of NEET Preparation</span>
            <span>neetverse.lovable.app</span>
          </div>
        </div>

        {/* ===== OMR SHEET with Alignment Markers ===== */}
        <div className="px-[8mm] pt-[8mm] relative" style={{ pageBreakBefore: "always" }}>
          {/* Corner alignment markers */}
          <div className="absolute top-[5mm] left-[5mm] w-[10mm] h-[10mm]">
            <div className="w-full h-full border-t-[3px] border-l-[3px] border-black" />
            <div className="absolute top-[1mm] left-[1mm] w-[4mm] h-[4mm] bg-black" />
          </div>
          <div className="absolute top-[5mm] right-[5mm] w-[10mm] h-[10mm]">
            <div className="w-full h-full border-t-[3px] border-r-[3px] border-black" />
            <div className="absolute top-[1mm] right-[1mm] w-[4mm] h-[4mm] bg-black" />
          </div>
          <div className="absolute bottom-[5mm] left-[5mm] w-[10mm] h-[10mm]">
            <div className="w-full h-full border-b-[3px] border-l-[3px] border-black" />
            <div className="absolute bottom-[1mm] left-[1mm] w-[4mm] h-[4mm] bg-black" />
          </div>
          <div className="absolute bottom-[5mm] right-[5mm] w-[10mm] h-[10mm]">
            <div className="w-full h-full border-b-[3px] border-r-[3px] border-black" />
            <div className="absolute bottom-[1mm] right-[1mm] w-[4mm] h-[4mm] bg-black" />
          </div>

          {/* OMR Header */}
          <div className="text-center pb-2 mb-2 border-b-[3px] border-red-600 mx-[6mm]">
            <div className="flex items-center justify-center gap-2">
              <img src={neetverseLogo} alt="NEETVerse" className="w-10 h-10 rounded-lg" />
              <div>
                <h2 className="text-2xl font-black tracking-[4px] text-red-600">NEETVERSE</h2>
                <p className="text-[9pt] font-black text-red-600 tracking-[2px] uppercase">OMR Answer Sheet</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[8pt] mt-2 pt-1 border-t border-red-200">
              <span className="text-left">Name: ________________________________</span>
              <span className="text-center">Date: ________________</span>
              <span className="text-right">Roll No: _____________</span>
            </div>
          </div>

          {/* Subject markers */}
          {totalQuestions === 180 && (
            <div className="flex justify-center gap-6 text-[7.5pt] font-black text-red-600 mb-1 mx-[6mm]">
              <span>⚛ Physics: Q.1–45</span>
              <span>🧪 Chemistry: Q.46–90</span>
              <span>🧬 Biology: Q.91–180</span>
            </div>
          )}

          {/* OMR Grid */}
          <div className="flex gap-[2px] flex-nowrap mx-[6mm]">
            {Array.from({ length: omrCols }).map((_, c) => {
              const start = c * omrPerCol;
              const end = Math.min(start + omrPerCol, totalQuestions);
              return (
                <div key={c} className="flex-1 min-w-0">
                  <table className="w-full border-collapse text-[7pt]">
                    <thead>
                      <tr>
                        {["Q", "A", "B", "C", "D"].map((h) => (
                          <th
                            key={h}
                            className="bg-red-600 text-white px-[1px] py-[2px] text-[6pt] border border-red-600 font-black"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: end - start }).map((_, i) => (
                        <tr key={i} className={i % 5 === 4 ? "border-b-2 border-red-200" : ""}>
                          <td className="border border-gray-300 px-[1px] py-[0.5px] text-center font-black text-[6.5pt] w-[16px]" style={{ color: "#1a1a6e" }}>
                            {start + i + 1}
                          </td>
                          {[0, 1, 2, 3].map((b) => (
                            <td
                              key={b}
                              className="border border-gray-300 px-[1px] py-[0.5px] text-center text-[7pt] w-[14px]"
                            >
                              <span className="text-gray-400">◯</span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          {/* OMR Footer */}
          <div className="mx-[6mm] mt-2 pt-1 border-t-2 border-red-600">
            <div className="flex justify-between text-[7pt] text-red-600 font-bold">
              <span>Total Questions: {totalQuestions}</span>
              <span>Fill ● completely • No overwriting</span>
              <span>NEETVerse — neetverse.lovable.app</span>
            </div>
            <p className="text-center text-[6.5pt] text-gray-400 mt-1">
              📱 Scan this filled OMR using NEETVerse app to get instant results
            </p>
          </div>
        </div>

        {/* ===== ANSWER KEY ===== */}
        <div className="px-[10mm] pt-[10mm]" style={{ pageBreakBefore: "always" }}>
          <div className="text-center pb-2 mb-3 border-b-[3px]" style={{ borderColor: "#1a1a6e" }}>
            <div className="flex items-center justify-center gap-2">
              <img src={neetverseLogo} alt="NEETVerse" className="w-10 h-10 rounded-lg" />
              <div>
                <h2 className="text-2xl font-black tracking-[4px]" style={{ color: "#1a1a6e" }}>
                  NEETVERSE
                </h2>
                <p className="text-sm font-bold" style={{ color: "#1a1a6e" }}>
                  Answer Key — {title}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-1 flex-nowrap">
            {Array.from({ length: omrCols }).map((_, c) => {
              const start = c * omrPerCol;
              const end = Math.min(start + omrPerCol, totalQuestions);
              return (
                <div key={c} className="flex-1 min-w-0">
                  <table className="w-full border-collapse text-[8pt]">
                    <thead>
                      <tr>
                        <th className="text-white px-1 py-[2px] text-[7pt] border" style={{ background: "#1a1a6e", borderColor: "#1a1a6e" }}>Q</th>
                        <th className="text-white px-1 py-[2px] text-[7pt] border" style={{ background: "#1a1a6e", borderColor: "#1a1a6e" }}>Ans</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: end - start }).map((_, i) => {
                        const q = questions[start + i];
                        const ans = q?.correct_option_index != null ? labels[q.correct_option_index] : "—";
                        return (
                          <tr key={i}>
                            <td className="border border-gray-300 px-1 py-[1px] text-center font-bold text-[7.5pt]">{start + i + 1}</td>
                            <td className="border border-gray-300 px-1 py-[1px] text-center font-bold text-[8pt]" style={{ color: "#1a1a6e" }}>{ans}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between text-[7pt] font-bold mt-2 pt-1 border-t-2" style={{ color: "#1a1a6e", borderColor: "#1a1a6e" }}>
            <span>+4 for correct, −1 for incorrect</span>
            <span>NEETVerse — neetverse.lovable.app</span>
          </div>
        </div>

        {/* Final Footer */}
        <div className="mx-[10mm] mt-4 pt-2 pb-4 border-t">
          <div className="h-0.5 w-full mb-2" style={{ background: "linear-gradient(90deg, #1a1a6e, #3b82f6, #1a1a6e)" }} />
          <div className="text-center text-[8pt] text-gray-400">
            <p className="font-semibold">Generated by NEETVerse — Infinity Practice</p>
            <p>neetverse.lovable.app — All the best! 🎯</p>
          </div>
        </div>
      </div>
    </div>
  );
};
