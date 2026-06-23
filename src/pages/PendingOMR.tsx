import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Question } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, FileText, Loader2, Inbox } from "lucide-react";
import { format } from "date-fns";
import { OfflinePaperPreview } from "@/components/mock/OfflinePaperPreview";

interface PendingAttempt {
  id: string;
  config: any;
  question_ids: string[];
  started_at: string;
}

const PendingOMR = () => {
  const { user } = useAuth();
  const [active, setActive] = useState<{ attemptId: string; questions: Question[]; testType: string; questionCount: number } | null>(null);

  const { data: pending, isLoading, refetch } = useQuery({
    queryKey: ["pending-omr", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("attempts")
        .select("id, config, question_ids, started_at")
        .eq("user_id", user.id)
        .eq("type", "mock")
        .eq("omr_status", "pending")
        .order("started_at", { ascending: false });
      return (data || []) as unknown as PendingAttempt[];
    },
    enabled: !!user,
  });

  const handleContinue = async (attempt: PendingAttempt) => {
    if (!attempt.question_ids || attempt.question_ids.length === 0) return;
    const { data: qRows } = await supabase
      .from("questions")
      .select("id, chapter_id, subject_id, question_text, options, correct_option_index, explanation, images, difficulty, raw_html")
      .in("id", attempt.question_ids);

    // .in() does NOT guarantee row order — re-order to match the original paper
    const byId = new Map((qRows || []).map((q: any) => [q.id, q]));
    const ordered = attempt.question_ids.map((id) => byId.get(id)).filter(Boolean) as Question[];

    setActive({
      attemptId: attempt.id,
      questions: ordered,
      testType: attempt.config?.type || "custom",
      questionCount: ordered.length,
    });
  };

  if (active) {
    const isBioOnly = active.testType === "full-bio" && active.questionCount === 90;
    const testLabel = isBioOnly ? "Biology Mock Test" : "Full NEET Mock Test";
    const totalMarks = active.questionCount * 4;
    const dur = isBioOnly ? "60 Minutes" : "3 Hours";
    const subjectGroups = isBioOnly
      ? [{ name: "Biology", startIdx: 0, endIdx: 90 }]
      : [
          { name: "Physics", startIdx: 0, endIdx: 45 },
          { name: "Chemistry", startIdx: 45, endIdx: 90 },
          { name: "Biology", startIdx: 90, endIdx: 180 },
        ];

    return (
      <OfflinePaperPreview
        questions={active.questions}
        title={testLabel}
        totalQuestions={active.questionCount}
        totalMarks={totalMarks}
        duration={dur}
        subjectGroups={subjectGroups}
        selectedChapterIds="all"
        attemptId={active.attemptId}
        onBack={() => { setActive(null); refetch(); }}
      />
    );
  }

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-orange-500/10 rounded-xl">
            <Inbox className="h-7 w-7 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Pending OMR Vault</h1>
            <p className="text-muted-foreground">Papers you've generated but haven't scanned yet</p>
          </div>
        </div>

        {isLoading ? (
          <Card><CardContent className="p-10 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading...
          </CardContent></Card>
        ) : !pending || pending.length === 0 ? (
          <Card><CardContent className="p-10 text-center text-muted-foreground">
            No pending papers — every offline test you generate will show up here until you scan it.
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {pending.map((p) => {
              const isBio = p.config?.type === "full-bio" && p.config?.questionCount === 90;
              const name = isBio ? "Biology Mock Test" : p.config?.type === "full-bio" ? "Full Syllabus Mock" : "Custom Mock Test";
              return (
                <Card key={p.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-semibold text-sm">{name}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.config?.questionCount || p.question_ids?.length || 0} questions • Generated {format(new Date(p.started_at), "d MMM yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">Not Scanned</Badge>
                      <Button size="sm" className="gap-1.5" onClick={() => handleContinue(p)}>
                        <Camera className="h-3.5 w-3.5" /> Scan Now
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PendingOMR;
