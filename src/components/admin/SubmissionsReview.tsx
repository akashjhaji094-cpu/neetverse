import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { Check, X, Loader2, Inbox, User } from "lucide-react";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function SubmissionsReview() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const { data: rows, isLoading } = useQuery({
    queryKey: ["question-submissions", status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("question_submissions")
        .select("*, subjects(name), chapters(name)")
        .eq("status", status)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const review = useMutation({
    mutationFn: async ({ row, approve }: { row: any; approve: boolean }) => {
      let approvedId: string | null = null;
      if (approve) {
        const { data, error } = await supabase.from("questions").insert({
          subject_id: row.subject_id,
          chapter_id: row.chapter_id,
          question_text: row.question_text,
          question_type: row.question_type,
          options: row.options,
          option_images: row.option_images,
          correct_option_index: row.correct_option_index,
          explanation: row.explanation,
          explanation_image_url: row.explanation_image_url,
          images: (row.question_image ? [row.question_image] : []) as any,
          difficulty: (row.difficulty || "auto_medium") as any,
          structured_data: row.structured_data,
          source_file: `community:${row.submitter_name || row.submitted_by}`,
        }).select("id").single();
        if (error) throw error;
        approvedId = data.id;

        // NEW: ManualQuestionForm (contribute mode) stashes the submitter's
        // chosen topic at row.structured_data.topicId, because
        // question_submissions has no topic column of its own. Read it back
        // out here and tag the now-approved question with it — this is the
        // missing link that meant contributed questions never got a topic
        // even when the submitter picked one.
        const topicId = (row.structured_data as any)?.topicId;
        if (topicId) {
          const { error: topicErr } = await supabase.from("question_topics").insert({
            question_id: approvedId,
            topic_id: topicId,
            confidence: 1,
          });
          if (topicErr) {
            // Don't fail the whole approval over this — the question is
            // already live, just untagged. Surface it so it's not silent.
            console.error(topicErr);
            toast.error("Approved, but topic tagging failed: " + topicErr.message);
          }
        }
      }
      const { error: upErr } = await supabase.from("question_submissions").update({
        status: approve ? "approved" : "rejected",
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_note: notes[row.id] || null,
        approved_question_id: approvedId,
      }).eq("id", row.id);
      if (upErr) throw upErr;
    },
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Approved — question bank me add ho gaya" : "Rejected");
      qc.invalidateQueries({ queryKey: ["question-submissions"] });
    },
    onError: (e: any) => toast.error(e?.message || "Review failed"),
  });

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Community Submissions</h2>
          <p className="text-sm text-muted-foreground">
            Questions uploaded by students. Approve karte hi wo main question bank me chala jayega.
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
                  <span>{r.subjects?.name} • {r.chapters?.name}</span>
                  <span>• {r.question_type}</span>
                  <span>• {format(new Date(r.created_at), "d MMM yyyy, HH:mm")}</span>
                </div>

                <div
                  className="text-sm leading-relaxed whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: r.question_text }}
                />
                {r.question_image && (
                  <img src={r.question_image} alt="Question" loading="lazy" className="max-h-56 rounded-lg border" />
                )}

                <ul className="grid gap-1 sm:grid-cols-2 text-sm">
                  {(r.options || []).map((o: string, i: number) => (
                    <li
                      key={i}
                      className={`rounded-lg border px-3 py-2 ${i === r.correct_option_index ? "border-primary bg-primary/5 font-medium" : ""}`}
                    >
                      <span className="font-semibold mr-1">{LETTERS[i]}.</span>
                      <span dangerouslySetInnerHTML={{ __html: o }} />
                      {r.option_images?.[i] && (
                        <img src={r.option_images[i]} alt={`Option ${LETTERS[i]}`} loading="lazy" className="mt-1 max-h-24 rounded" />
                      )}
                    </li>
                  ))}
                </ul>

                {r.explanation && (
                  <p className="text-sm text-muted-foreground border-l-2 pl-3" dangerouslySetInnerHTML={{ __html: r.explanation }} />
                )}

                {status === "pending" && (
                  <div className="space-y-2">
                    <Textarea
                      rows={2}
                      placeholder="Review note (optional)"
                      value={notes[r.id] || ""}
                      onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1.5" disabled={review.isPending}
                        onClick={() => review.mutate({ row: r, approve: true })}>
                        <Check className="h-3.5 w-3.5" /> Approve
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
