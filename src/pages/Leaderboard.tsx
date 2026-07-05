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

const Leaderboard = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("all");

  // Uses a SECURITY DEFINER RPC because the `attempts` table's RLS policy
  // ("Users can view their own attempts") only lets a regular user SELECT
  // their own rows — a plain client-side query here would silently return
  // nobody else's attempts, making the leaderboard show just yourself. The
  // RPC computes the aggregate server-side and returns only the safe,
  // already-aggregated fields (never raw per-question answers).
  const { data: leaders, isLoading } = useQuery({
    queryKey: ["leaderboard-all-v4", period],
    queryFn: async (): Promise<LeaderRow[]> => {
      const { data, error } = await supabase.rpc(
        "get_leaderboard" as any,
        { p_period: period } as any
      );
      if (error) throw error;
      return (data as unknown as LeaderRow[]) || [];
    },
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
