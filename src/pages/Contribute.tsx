import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ManualQuestionForm } from "@/components/questions/ManualQuestionForm";
import { PenSquare } from "lucide-react";
import { format } from "date-fns";

const Contribute = () => {
  const { user } = useAuth();

  const { data: mine, refetch } = useQuery({
    queryKey: ["my-submissions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("question_submissions")
        .select("id, status, created_at, question_text")
        .eq("submitted_by", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <DashboardLayout title="Contribute a Question">
      <div className="p-4 lg:p-6 space-y-5 max-w-4xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <PenSquare className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Contribute a Question</h1>
            <p className="text-muted-foreground">Apna question daalo — admin verify karke sabke liye live kar dega</p>
          </div>
        </div>

        <ManualQuestionForm mode="contribute" onSaved={() => refetch()} />

        {!!mine?.length && (
          <Card>
            <CardContent className="pt-6 space-y-2">
              <h3 className="font-semibold">Your submissions</h3>
              {mine.map((s: any) => (
                <div key={s.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                  <Badge variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "secondary"}>
                    {s.status}
                  </Badge>
                  <span className="flex-1">
                    {s.question_text.replace(/<[^>]*>/g, " ").slice(0, 120)}
                  </span>
                  <span className="text-xs text-muted-foreground">{format(new Date(s.created_at), "d MMM")}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Contribute;