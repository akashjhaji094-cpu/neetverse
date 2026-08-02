import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Loader2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { PremiumPopup } from "@/components/PremiumPopup";
import { MathContent } from "@/components/MathContent";
import { formatQuestionHtml } from "@/lib/questionFormatter";

interface ExplanationBlockProps {
  questionId: string;
  /** Explanation already present in the row, if any. */
  fallback?: string | null;
  source?: "questions" | "pyq_questions";
  className?: string;
}

/**
 * "See Explanation" for any reviewed question. Trial + premium users get a
 * full AI-written, LaTeX-safe solution (generated once, then cached in the
 * database). Free users get an upgrade popup instead.
 */
export function ExplanationBlock({ questionId, fallback, source = "questions", className }: ExplanationBlockProps) {
  const { hasAccess } = useFeatureAccess();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [html, setHtml] = useState<string | null>(
    fallback && fallback.trim().length > 40 ? fallback : null
  );
  const [showPremium, setShowPremium] = useState(false);

  const load = async () => {
    if (!hasAccess) {
      setShowPremium(true);
      return;
    }
    setOpen(true);
    if (html || loading) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("explain-question", {
        body: { questionId, source },
      });
      if (fnError) throw fnError;
      if ((data as any)?.explanation) {
        setHtml((data as any).explanation as string);
      } else if ((data as any)?.error === "premium_required") {
        setShowPremium(true);
        setOpen(false);
      } else if ((data as any)?.error === "rate_limited") {
        setError("Bahut requests aa gayi — thodi der baad try karo.");
      } else {
        setError("Explanation abhi generate nahi ho paya. Dobara try karo.");
      }
    } catch {
      setError("Explanation abhi generate nahi ho paya. Dobara try karo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      {!open && (
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          {hasAccess ? <Lightbulb className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          See Explanation
        </Button>
      )}

      {open && (
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-primary flex items-center gap-2">
              <Lightbulb className="w-4 h-4" /> Explanation
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Solution likhi ja rahi hai…
              </div>
            )}
            {!loading && error && (
              <div className="space-y-2">
                <p className="text-destructive">{error}</p>
                <Button size="sm" variant="outline" onClick={() => { setHtml(null); load(); }}>
                  Retry
                </Button>
              </div>
            )}
            {!loading && html && (
              <MathContent html={formatQuestionHtml(html)} className="neet-question leading-relaxed" />
            )}
          </CardContent>
        </Card>
      )}

      <PremiumPopup open={showPremium} onClose={() => setShowPremium(false)} plan="free" />
    </div>
  );
}