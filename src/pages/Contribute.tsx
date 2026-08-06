import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ManualQuestionForm } from "@/components/questions/ManualQuestionForm";
import { ExplanationContributeForm } from "@/components/questions/ExplanationContributeForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PenSquare, Lightbulb } from "lucide-react";
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

  const { data: myExplanations, refetch: refetchExpl } = useQuery({
    queryKey: ["my-explanation-submissions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("explanation_submissions")
        .select("id, status, created_at, content")
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
            <h1 className="text-2xl lg:text-3xl font-bold">Contribute</h1>
            <p className="text-muted-foreground">Question ya explanation daalo — admin verify karke sabke liye live kar dega</p>
          </div>
        </div>

        <Tabs defaultValue="question">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="question" className="gap-2 flex-1 sm:flex-none">
              <PenSquare className="h-4 w-4" /> Question
            </TabsTrigger>
            <TabsTrigger value="explanation" className="gap-2 flex-1 sm:flex-none">
              <Lightbulb className="h-4 w-4" /> Explanation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="question" className="mt-4">
            <ManualQuestionForm mode="contribute" onSaved={() => refetch()} />
          </TabsContent>

          <TabsContent value="explanation" className="mt-4 space-y-5">
            <ExplanationContributeForm onSaved={() => refetchExpl()} />

            {!!myExplanations?.length && (
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <h3 className="font-semibold">Your explanation submissions</h3>
                  {myExplanations.map((s: any) => (
                    <div key={s.id} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                      <Badge variant={s.status === "approved" ? "default" : s.status === "rejected" ? "destructive" : "secondary"}>
                        {s.status}
                      </Badge>
                      <span className="flex-1">{s.content.replace(/<[^>]*>/g, " ").slice(0, 120)}</span>
                      <span className="text-xs text-muted-foreground">{format(new Date(s.created_at), "d MMM")}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

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