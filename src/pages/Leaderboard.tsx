import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Award, Crown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderRow {
  user_id: string;
  name: string;
  totalScore: number;
  testsTaken: number;
  avgScore: number;
  bestScore: number;
}

type Period = "week" | "month" | "all";

function periodCutoffISO(period: Period): string | null {
  if (period === "all") return null;
  const days = period === "week" ? 7 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const Leaderboard = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("all");

  const { data: leaders, isLoading } = useQuery({
    queryKey: ["leaderboard-all-v3", period],
    queryFn: async () => {
      let query = supabase
        .from("attempts")
        .select("id, user_id, type, finished_at, score")
        .not("finished_at", "is", null);

      const cutoff = periodCutoffISO(period);
      if (cutoff) query = query.gte("finished_at", cutoff);

      const { data: attempts } = await query;

      if (!attempts || attempts.length === 0) return [];

      // FIXED: previously this recomputed score with a DIFFERENT formula
      // (+1 / -0.25) than the rest of the app. Every attempt already has a
      // correctly-computed +4/-1 NEET score stored on it (Test.tsx,
      // Practice.tsx, and the OMR scanner all write it the same way) — so
      // we just sum that directly instead of recalculating it differently
      // here, which was producing leaderboard numbers that didn't match
      // what the student sees on their own Test History / Mock results.
      const byUser = new Map<string, { total: number; count: number; best: number }>();
      attempts.forEach((a: any) => {
        const score = Number(a.score ?? 0);
        const cur = byUser.get(a.user_id) || { total: 0, count: 0, best: -Infinity };
        cur.total += score;
        cur.count += 1;
        cur.best = Math.max(cur.best, score);
        byUser.set(a.user_id, cur);
      });

      const userIds = Array.from(byUser.keys());
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p.name || p.email?.split("@")[0] || "Aspirant"])
      );

      const rows: LeaderRow[] = userIds.map((uid) => {
        const stats = byUser.get(uid)!;
        return {
          user_id: uid,
          name: profileMap.get(uid) || "Aspirant",
          totalScore: Math.round(stats.total * 100) / 100,
          testsTaken: stats.count,
          avgScore: Math.round((stats.total / stats.count) * 100) / 100,
          bestScore: Math.round(stats.best * 100) / 100,
        };
      });

      rows.sort((a, b) => b.totalScore - a.totalScore);
      return rows;
    },
  });

  const sortedByAvg = [...(leaders || [])].sort((a, b) => b.avgScore - a.avgScore);
  const sortedByBest = [...(leaders || [])].sort((a, b) => b.bestScore - a.bestScore);

  const myRank = leaders?.findIndex((r) => r.user_id === user?.id);
  const myRow = leaders?.find((r) => r.user_id === user?.id);
  const totalAspirants = leaders?.length || 0;
  const myPercentile =
    myRank !== undefined && myRank >= 0 && totalAspirants > 0
      ? Math.round(((totalAspirants - myRank - 1) / totalAspirants) * 100)
      : null;

  const renderTable = (rows: LeaderRow[], scoreKey: keyof LeaderRow, scoreLabel: string) => (
    <div className="space-y-2">
      {rows.slice(0, 50).map((row, idx) => {
        const isMe = row.user_id === user?.id;
        const rank = idx + 1;
        return (
          <div
            key={row.user_id}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl border transition-all",
              isMe
                ? "bg-primary/10 border-primary shadow-md"
                : "bg-card hover:bg-muted/50"
            )}
          >
            <div className="flex-shrink-0 w-10 text-center">
              {rank === 1 && <Crown className="h-6 w-6 text-yellow-500 mx-auto" />}
              {rank === 2 && <Medal className="h-6 w-6 text-gray-400 mx-auto" />}
              {rank === 3 && <Award className="h-6 w-6 text-orange-600 mx-auto" />}
              {rank > 3 && <span className="font-bold text-muted-foreground">#{rank}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">
                {row.name} {isMe && <span className="text-xs text-primary">(You)</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.testsTaken} tests • Best: {row.bestScore} • Avg: {row.avgScore}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-primary">{row[scoreKey] as number}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{scoreLabel}</p>
            </div>
          </div>
        );
      })}
      {rows.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No attempts in this period yet. Be the first on the leaderboard!</p>
        </div>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Trophy className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">Leaderboard</h1>
            <p className="text-muted-foreground">Practice + Mock • NEET scoring (+4 correct / −1 wrong)</p>
          </div>
        </div>

        {/* Period selector */}
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="grid grid-cols-3 w-full sm:w-72">
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="all">All Time</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* My rank card */}
        {myRank !== undefined && myRank >= 0 && myRow && (
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-3xl font-black text-primary">#{myRank + 1}</p>
                  <p className="text-xs text-muted-foreground">Your Rank</p>
                </div>
                <div>
                  <p className="text-3xl font-black">{myPercentile}%</p>
                  <p className="text-xs text-muted-foreground">Percentile</p>
                </div>
                <div>
                  <p className="text-3xl font-black">{myRow.totalScore}</p>
                  <p className="text-xs text-muted-foreground">Total Score</p>
                </div>
                <div>
                  <p className="text-3xl font-black">{myRow.testsTaken}</p>
                  <p className="text-xs text-muted-foreground">Tests Taken</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{totalAspirants}</p>
            <p className="text-xs text-muted-foreground">Active Aspirants</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Trophy className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-2xl font-bold">{leaders?.[0]?.totalScore ?? 0}</p>
            <p className="text-xs text-muted-foreground">Top Score</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Award className="h-5 w-5 mx-auto mb-1 text-orange-600" />
            <p className="text-2xl font-bold">
              {leaders && leaders.length > 0
                ? Math.round(leaders.reduce((s, r) => s + r.avgScore, 0) / leaders.length)
                : 0}
            </p>
            <p className="text-xs text-muted-foreground">Average Score</p>
          </CardContent></Card>
        </div>

        {/* Rankings tabs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="total">
              <TabsList className="grid grid-cols-3 mb-4">
                <TabsTrigger value="total">Total Score</TabsTrigger>
                <TabsTrigger value="best">Best Score</TabsTrigger>
                <TabsTrigger value="avg">Average</TabsTrigger>
              </TabsList>
              <TabsContent value="total">
                {isLoading ? <p className="text-center py-8 text-muted-foreground">Loading…</p> : renderTable(leaders || [], "totalScore", "Total")}
              </TabsContent>
              <TabsContent value="best">
                {isLoading ? <p className="text-center py-8 text-muted-foreground">Loading…</p> : renderTable(sortedByBest, "bestScore", "Best")}
              </TabsContent>
              <TabsContent value="avg">
                {isLoading ? <p className="text-center py-8 text-muted-foreground">Loading…</p> : renderTable(sortedByAvg, "avgScore", "Avg")}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Leaderboard;
