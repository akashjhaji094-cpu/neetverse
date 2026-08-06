import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MathContent } from "@/components/MathContent";
import { formatQuestionHtml, formatOptionHtml } from "@/lib/questionFormatter";
import { sanitizeLatex } from "@/lib/latexSanitize";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, X, Loader2, Inbox, User } from "lucide-react";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Review queue for student-written explanations. Approving copies the text
 * into `question_explanations` (source = "community"), which is exactly where
 * the "See Explanation" button reads from — so approval instantly makes it
 * live everywhere, with no AI call and no extra cost.
 */
export function ExplanationSubmissionsReview() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data: rows, isLoading } = useQuery({
    queryKey: ["explanation-submissions", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("explanation_submissions")
        .select("*, subjects(name), chapters(name), topics(name), questions(question_text, options, correct_option_index)")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const review = useMutation({
    mutationFn: async ({ row, approve }: { row: any; approve: boolean }) => {
      if (approve) {
        const content = sanitizeLatex(edits[row.id] ?? row.content).html;
        const { error } = await supabase.from("question_explanations").upsert(
          { question_id: row.question_id, content, source: "community" },
          { onConflict: "question_id" }
        );
        if (error) throw error;
      }
      const { error: upErr } = await supabase.from("explanation_submissions").update({
        status: approve ? "approved" : "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_note: notes[row.id] || null,
        content: approve ? sanitizeLatex(edits[row.id] ?? row.content).html : row.content,
      }).eq("id", row.id);
      if (upErr) throw upErr;
    },
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Approved — See Explanation me live ho gaya" : "Rejected");
      qc.invalidateQueries({ queryKey: ["explanation-submissions"] });
    },
    onError: (e: any) => toast.error(e?.message || "Review failed"),
  });

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Explanation Submissions</h2>
          <p className="text-sm text-muted-foreground">
            Students ke likhe explanations. Approve karte hi wo "See Explanation" me sabko dikhne lagega.
          </p>
        </div>

        <Tabs value={status} onValueChange={(v) => setStatus(v as any)}>
          <TabsList>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="py-10 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </div>
        ) : !rows?.length ? (
          <div className="py-10 text-center text-muted-foreground">
            <Inbox className="h-6 w-6 mx-auto mb-2" />
            Kuch nahi hai yahan.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r: any) => (
              <div key={r.id} className="rounded-xl border p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="gap-1">
                    <User className="h-3 w-3" /> {r.submitter_name || "Unknown"}
                  </Badge>
                  <span>{r.subjects?.name} • {r.chapters?.name} • {r.topics?.name}</span>
                  <span>• {format(new Date(r.created_at), "d MMM yyyy, HH:mm")}</span>
                </div>

                <MathContent
                  html={formatQuestionHtml(r.questions?.question_text)}
                  className="neet-question text-sm leading-relaxed"
                />
                {Array.isArray(r.questions?.options) && (
                  <ul className="grid gap-1 sm:grid-cols-2 text-sm">
                    {(r.questions.options as string[]).map((o, i) => (
                      <li key={i} className={`rounded-lg border px-3 py-2 ${i === r.questions.correct_option_index ? "border-primary bg-primary/5 font-medium" : ""}`}>
                        <span className="font-semibold mr-1">{LETTERS[i]}.</span>
                        <MathContent as="span" html={formatOptionHtml(o)} />
                      </li>
                    ))}
                  </ul>
                )}

                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="mb-1 text-xs font-semibold text-primary">Submitted explanation (rendered)</p>
                  <MathContent
                    html={formatQuestionHtml(sanitizeLatex(edits[r.id] ?? r.content).html)}
                    className="neet-question text-sm leading-relaxed"
                  />
                </div>

                {status === "pending" && (
                  <div className="space-y-2">
                    <Textarea
                      rows={5}
                      value={edits[r.id] ?? r.content}
                      onChange={(e) => setEdits({ ...edits, [r.id]: e.target.value })}
                    />
                    <Textarea
                      rows={2}
                      placeholder="Review note (optional)"
                      value={notes[r.id] || ""}
                      onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1.5" disabled={review.isPending}
                        onClick={() => review.mutate({ row: r, approve: true })}>
                        <Check className="h-3.5 w-3.5" /> Approve & publish
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5" disabled={review.isPending}
                        onClick={() => review.mutate({ row: r, approve: false })}>
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                )}
                {r.review_note && status !== "pending" && (
                  <p className="text-xs text-muted-foreground">Note: {r.review_note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
