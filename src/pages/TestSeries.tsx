import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PremiumPopup } from "@/components/PremiumPopup";
import { format, isFuture } from "date-fns";
import {
  ArrowLeft, CalendarClock, Clock, Layers, ListChecks, Loader2, Lock, Play, Trophy,
} from "lucide-react";

const TestSeriesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const access = useFeatureAccess();
  const [openSeries, setOpenSeries] = useState<any | null>(null);
  const [showPremium, setShowPremium] = useState(false);

  const { data: series, isLoading } = useQuery({
    queryKey: ["test-series"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("test_series").select("*").eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: tests, isLoading: testsLoading } = useQuery({
    queryKey: ["series-tests", openSeries?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("series_tests").select("*")
        .eq("series_id", openSeries.id).eq("is_published", true)
        .order("position").order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!openSeries,
  });

  const { data: attempts } = useQuery({
    queryKey: ["my-series-attempts", user?.id, openSeries?.id],
    queryFn: async () => {
      const ids = (tests || []).map((t: any) => t.id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("series_attempts").select("id, test_id, score, total_questions, finished_at")
        .eq("user_id", user!.id).in("test_id", ids).not("finished_at", "is", null);
      return data || [];
    },
    enabled: !!user && !!tests?.length,
  });

  const attemptByTest = useMemo(() => {
    const m = new Map<string, any>();
    (attempts || []).forEach((a: any) => {
      const prev = m.get(a.test_id);
      if (!prev || new Date(a.finished_at) > new Date(prev.finished_at)) m.set(a.test_id, a);
    });
    return m;
  }, [attempts]);

  const locked = (s: any) => s.access_type === "paid" && !access.hasAccess;

  const startTest = (t: any) => {
    if (locked(openSeries)) { setShowPremium(true); return; }
    if (t.scheduled_at && isFuture(new Date(t.scheduled_at))) return;
    navigate(`/test-series/${t.id}`);
  };

  /* ---------- series detail ---------- */
  if (openSeries) {
    const upcoming = (tests || []).filter((t: any) => t.scheduled_at && isFuture(new Date(t.scheduled_at)));
    return (
      <DashboardLayout title={openSeries.title}>
        <div className="p-4 lg:p-6 space-y-5 max-w-4xl">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setOpenSeries(null)}>
            <ArrowLeft className="h-4 w-4" /> All series
          </Button>

          {openSeries.banner_url && (
            <img src={openSeries.banner_url} alt={openSeries.title} loading="lazy"
              className="w-full h-40 object-cover rounded-2xl" />
          )}

          <div className="space-y-1">
            <h1 className="text-2xl font-bold">{openSeries.title}</h1>
            {openSeries.description && <p className="text-muted-foreground">{openSeries.description}</p>}
          </div>

          {upcoming.length > 0 && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <p className="font-semibold flex items-center gap-2 text-sm">
                  <CalendarClock className="h-4 w-4 text-primary" /> Upcoming schedule
                </p>
                {upcoming.map((t: any) => (
                  <div key={t.id} className="flex justify-between text-sm">
                    <span>{t.title}</span>
                    <span className="text-muted-foreground">{format(new Date(t.scheduled_at), "d MMM, HH:mm")}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {testsLoading ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : !tests?.length ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              Is series me abhi koi test publish nahi hua.
            </CardContent></Card>
          ) : (
            <div className="space-y-3">
              {tests.map((t: any) => {
                const att = attemptByTest.get(t.id);
                const notYet = t.scheduled_at && isFuture(new Date(t.scheduled_at));
                return (
                  <Card key={t.id}>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold">{t.title}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><ListChecks className="h-3 w-3" />{t.question_count} Q</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t.duration_minutes} min</span>
                          <span>+{t.marks_correct} / -{t.marks_wrong}</span>
                          {att && <Badge variant="secondary">Scored {att.score}/{att.total_questions * t.marks_correct}</Badge>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {att && (
                          <Button size="sm" variant="outline" className="gap-1.5"
                            onClick={() => navigate(`/test-series/result/${att.id}`)}>
                            <Trophy className="h-3.5 w-3.5" /> Result
                          </Button>
                        )}
                        <Button size="sm" className="gap-1.5" disabled={notYet || t.question_count === 0}
                          onClick={() => startTest(t)}>
                          {locked(openSeries) ? <Lock className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                          {notYet ? "Scheduled" : att ? "Reattempt" : "Start"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
        <PremiumPopup open={showPremium} onOpenChange={setShowPremium} />
      </DashboardLayout>
    );
  }

  /* ---------- series list ---------- */
  return (
    <DashboardLayout title="Test Series">
      <div className="p-4 lg:p-6 space-y-5 max-w-4xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Layers className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Test Series</h1>
            <p className="text-muted-foreground">Scheduled full-length tests with rank &amp; deep analysis</p>
          </div>
        </div>

        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : !series?.length ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            Abhi koi test series live nahi hai — jaldi aayegi.
          </CardContent></Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {series.map((s: any) => (
              <Card key={s.id} className="overflow-hidden cursor-pointer hover:shadow-md transition"
                onClick={() => setOpenSeries(s)}>
                {s.banner_url && (
                  <img src={s.banner_url} alt={s.title} loading="lazy" className="w-full h-28 object-cover" />
                )}
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold flex-1">{s.title}</p>
                    <Badge variant={s.access_type === "paid" ? "default" : "secondary"}>
                      {s.access_type === "paid" ? "Premium" : "Free"}
                    </Badge>
                  </div>
                  {s.description && <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
                  {s.starts_at && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" /> Starts {format(new Date(s.starts_at), "d MMM yyyy")}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      <PremiumPopup open={showPremium} onOpenChange={setShowPremium} />
    </DashboardLayout>
  );
};

export default TestSeriesPage;