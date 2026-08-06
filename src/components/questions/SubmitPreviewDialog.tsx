import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MathContent } from "@/components/MathContent";
import { formatQuestionHtml, formatOptionHtml } from "@/lib/questionFormatter";
import { sanitizeLatex } from "@/lib/latexSanitize";
import { AlertTriangle, CheckCircle2, Loader2, Pencil } from "lucide-react";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export interface PreviewPayload {
  /** Question stem HTML (already built). Optional for explanation-only previews. */
  questionHtml?: string | null;
  questionImage?: string | null;
  options?: string[];
  optionImages?: (string | null)[];
  correctIndex?: number | null;
  explanationHtml?: string | null;
  explanationImage?: string | null;
  meta?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payload: PreviewPayload;
  submitting?: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
}

/**
 * The single "this is exactly how it will look" gate that every manual
 * question / explanation submission passes through. It re-runs the LaTeX
 * sanitizer, lists whatever it auto-fixed, and renders through MathContent so
 * MathJax typesets the preview identically to the live app.
 */
export function SubmitPreviewDialog({ open, onOpenChange, payload, submitting, confirmLabel = "Confirm & submit", onConfirm }: Props) {
  const q = sanitizeLatex(payload.questionHtml);
  const e = sanitizeLatex(payload.explanationHtml);
  const opts = (payload.options || []).map((o) => sanitizeLatex(o));
  const issues = [...q.issues, ...e.issues, ...opts.flatMap((o) => o.issues)];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Preview — aisa dikhega</DialogTitle>
        </DialogHeader>

        {payload.meta && <p className="text-xs text-muted-foreground">{payload.meta}</p>}

        {issues.length > 0 && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-1">
            <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" /> Auto-fixed formatting
            </p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {issues.map((i, idx) => <li key={idx}>{i.message}</li>)}
            </ul>
          </div>
        )}

        <div className="space-y-4 rounded-xl border p-4">
          {q.html && (
            <MathContent html={formatQuestionHtml(q.html)} className="neet-question text-sm leading-relaxed" />
          )}
          {payload.questionImage && (
            <img src={payload.questionImage} alt="Question" loading="lazy" className="max-h-60 rounded-lg border" />
          )}

          {opts.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {opts.map((o, i) => (
                <li
                  key={i}
                  className={`rounded-lg border px-3 py-2 text-sm ${i === payload.correctIndex ? "border-primary bg-primary/5 font-medium" : ""}`}
                >
                  <span className="font-semibold mr-1">{LETTERS[i]}.</span>
                  <MathContent as="span" html={formatOptionHtml(o.html)} />
                  {payload.optionImages?.[i] && (
                    <img src={payload.optionImages[i]!} alt={`Option ${LETTERS[i]}`} loading="lazy" className="mt-1 max-h-24 rounded" />
                  )}
                </li>
              ))}
            </ul>
          )}

          {e.html && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="mb-1 text-xs font-semibold text-primary">Explanation</p>
              <MathContent html={formatQuestionHtml(e.html)} className="neet-question text-sm leading-relaxed" />
            </div>
          )}
          {payload.explanationImage && (
            <img src={payload.explanationImage} alt="Explanation" loading="lazy" className="max-h-60 rounded-lg border" />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="gap-1.5">
            <Pencil className="h-4 w-4" /> Further edit
          </Button>
          <Button onClick={onConfirm} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}