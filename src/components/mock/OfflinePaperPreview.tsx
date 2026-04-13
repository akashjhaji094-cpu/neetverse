import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Loader2, Download } from "lucide-react";
import { Question } from "@/lib/supabase";
import neetverseLogo from "@/assets/neetverse-logo.jpg";

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
  const containerRef = useRef<HTMLDivElement>(null);

  const labels = ["A", "B", "C", "D"];

  // Load MathJax and typeset
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Load MathJax
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

      // Wait a tick for DOM to paint
      await new Promise((r) => setTimeout(r, 300));

      // Typeset
      const mj = (window as any).MathJax;
      if (mj?.typesetPromise && containerRef.current) {
        try {
          await mj.typesetPromise([containerRef.current]);
        } catch {}
      }

      if (cancelled) return;
      setLoadingStatus("Loading images...");

      // Wait for all images
      const imgs = containerRef.current?.querySelectorAll("img") || [];
      await Promise.all(
        Array.from(imgs).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) resolve();
              else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }
            })
        )
      );

      if (cancelled) return;
      setReady(true);
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Generate OMR columns
  const omrCols = totalQuestions <= 90 ? 6 : 9;
  const omrPerCol = Math.ceil(totalQuestions / omrCols);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Fixed toolbar - hidden on print */}
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
        style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
      >
        {/* ===== HEADER ===== */}
        <div className="px-[12mm] pt-[12mm]">
          <div className="text-center border-b-4 border-double border-black pb-3 mb-4">
            <div className="flex items-center justify-center gap-3 mb-1">
              <img src={neetverseLogo} alt="NEETVerse" className="w-12 h-12 rounded-lg print:w-10 print:h-10" />
              <div>
                <h1 className="text-3xl font-black tracking-widest" style={{ color: "#1a1a6e" }}>
                  NEETVerse
                </h1>
                <p className="text-[9pt] text-gray-500 -mt-1">Your Universe of NEET Preparation</p>
              </div>
            </div>
            <h2 className="text-lg font-bold uppercase tracking-wide mt-2">{title}</h2>
            <div className="flex justify-between text-[10pt] mt-2 pt-2 border-t border-gray-300 font-semibold">
              <span>Total Questions: {totalQuestions}</span>
              <span>Maximum Marks: {totalMarks}</span>
              <span>Duration: {duration}</span>
            </div>
          </div>

          {/* Student info */}
          <div className="flex gap-4 mb-3 text-[10pt]">
            <div className="flex-1 border-b border-black pb-1">
              <span className="font-bold">Name:</span> ___________________________
            </div>
            <div className="border-b border-black pb-1">
              <span className="font-bold">Date:</span> _______________
            </div>
            <div className="border-b border-black pb-1">
              <span className="font-bold">Roll No:</span> ___________
            </div>
          </div>

          {/* Instructions */}
          <div className="border border-black p-3 mb-4 bg-gray-50 text-[9.5pt]" style={{ pageBreakInside: "avoid" }}>
            <h4 className="text-[10pt] font-bold underline mb-1">General Instructions</h4>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>This question paper contains <strong>{totalQuestions}</strong> questions.</li>
              <li>Each question carries <strong>4 marks</strong>. For each wrong answer, <strong>1 mark</strong> will be deducted.</li>
              <li>No marks will be deducted for unattempted questions.</li>
              <li>Use the OMR sheet at the end to mark your answers.</li>
              <li>Use of calculator is <strong>NOT</strong> permitted.</li>
              <li>Duration of the test is <strong>{duration}</strong>.</li>
            </ul>
          </div>
        </div>

        {/* ===== QUESTIONS ===== */}
        <div className="px-[12mm]">
          {subjectGroups.map((group) => {
            const sectionQs = questions.slice(group.startIdx, group.endIdx);
            return (
              <div key={group.name} className="mb-2">
                <div
                  className="text-center font-bold text-[12pt] uppercase tracking-wide py-1.5 my-3 border-t-2 border-b border-black bg-gray-100"
                  style={{ pageBreakAfter: "avoid" }}
                >
                  {group.name} (Q.{group.startIdx + 1} – Q.{group.endIdx})
                </div>
                {sectionQs.map((q, i) => {
                  const qNum = group.startIdx + i + 1;
                  const options = (q.options as string[]) || [];
                  const images = (q.images as string[]) || [];
                  const content = q.raw_html || q.question_text;
                  return (
                    <div key={q.id} className="mb-3" style={{ pageBreakInside: "avoid" }}>
                      <div className="mb-1">
                        <span className="font-bold mr-1">Q.{qNum}</span>
                        <span dangerouslySetInnerHTML={{ __html: content }} />
                      </div>
                      {images.length > 0 && (
                        <div className="ml-7 my-1">
                          {images.map((src, ii) => (
                            <img
                              key={ii}
                              src={src}
                              className="max-w-[90%] max-h-[180px] border border-gray-300 rounded"
                              alt={`Q${qNum} image`}
                              loading="eager"
                            />
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-x-5 gap-y-0.5 ml-7 mt-1">
                        {options.map((opt, oi) => (
                          <div key={oi} className="flex gap-1 items-baseline">
                            <span className="font-bold min-w-[22px]">({labels[oi]})</span>
                            <span dangerouslySetInnerHTML={{ __html: opt }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* ===== OMR SHEET ===== */}
        <div className="px-[10mm] pt-[10mm]" style={{ pageBreakBefore: "always" }}>
          <div className="text-center pb-2 mb-2 border-b-[3px] border-red-600">
            <div className="flex items-center justify-center gap-2">
              <img src={neetverseLogo} alt="NEETVerse" className="w-10 h-10 rounded-lg" />
              <div>
                <h2 className="text-2xl font-black tracking-[4px] text-red-600">NEETVerse</h2>
                <p className="text-sm font-bold text-red-600">OMR Answer Sheet</p>
              </div>
            </div>
            <div className="flex justify-between text-[9pt] mt-2 pt-1 border-t border-red-300">
              <span>Name: _______________________________</span>
              <span>Date: _______________</span>
              <span>Roll No: ___________</span>
            </div>
          </div>

          {/* Subject markers for full mock */}
          {totalQuestions === 180 && (
            <div className="flex justify-center gap-6 text-[8pt] font-bold text-red-600 mb-2">
              <span>Physics: Q.1–45</span>
              <span>Chemistry: Q.46–90</span>
              <span>Biology: Q.91–180</span>
            </div>
          )}

          <div className="flex gap-[3px] flex-nowrap">
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
                            className="bg-red-600 text-white px-[2px] py-[2px] text-[6.5pt] border border-red-600"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: end - start }).map((_, i) => (
                        <tr key={i}>
                          <td className="border border-gray-300 px-[2px] py-[1px] text-center font-bold text-[7pt] w-[18px]">
                            {start + i + 1}
                          </td>
                          {[0, 1, 2, 3].map((b) => (
                            <td
                              key={b}
                              className="border border-gray-300 px-[2px] py-[1px] text-center text-[8pt] text-gray-400 w-[16px]"
                            >
                              ◯
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

          <div className="flex justify-between text-[7pt] text-red-600 font-bold mt-2 pt-1 border-t-2 border-red-600">
            <span>Total Questions: {totalQuestions}</span>
            <span>Fill the correct bubble completely ●</span>
            <span>NEETVerse — neetverse.lovable.app</span>
          </div>
        </div>

        {/* ===== ANSWER KEY ===== */}
        <div className="px-[10mm] pt-[10mm]" style={{ pageBreakBefore: "always" }}>
          <div className="text-center pb-2 mb-3 border-b-[3px]" style={{ borderColor: "#1a1a6e" }}>
            <div className="flex items-center justify-center gap-2">
              <img src={neetverseLogo} alt="NEETVerse" className="w-10 h-10 rounded-lg" />
              <div>
                <h2 className="text-2xl font-black tracking-[4px]" style={{ color: "#1a1a6e" }}>
                  NEETVerse
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
                        <th
                          className="text-white px-1 py-[2px] text-[7pt] border"
                          style={{ background: "#1a1a6e", borderColor: "#1a1a6e" }}
                        >
                          Q
                        </th>
                        <th
                          className="text-white px-1 py-[2px] text-[7pt] border"
                          style={{ background: "#1a1a6e", borderColor: "#1a1a6e" }}
                        >
                          Ans
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: end - start }).map((_, i) => {
                        const q = questions[start + i];
                        const ans =
                          q?.correct_option_index != null
                            ? labels[q.correct_option_index]
                            : "—";
                        return (
                          <tr key={i}>
                            <td className="border border-gray-300 px-1 py-[1px] text-center font-bold text-[7.5pt]">
                              {start + i + 1}
                            </td>
                            <td
                              className="border border-gray-300 px-1 py-[1px] text-center font-bold text-[8pt]"
                              style={{ color: "#1a1a6e" }}
                            >
                              {ans}
                            </td>
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

        {/* Footer */}
        <div className="text-center text-[8pt] text-gray-400 py-4 border-t border-gray-200 mx-[10mm] mt-4">
          Generated by NEETVerse — neetverse.lovable.app — All the best! 🎯
        </div>
      </div>
    </div>
  );
};
