import { Flame, Calendar, Trophy, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

export function StreakTracker() {
  const { user } = useAuth();

  const { data: streakData } = useQuery({
    queryKey: ['user-streak', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching streak:', error);
      }
      
      return data || { current_streak: 0, longest_streak: 0, last_activity_date: null };
    },
    enabled: !!user,
  });

  const currentStreak = streakData?.current_streak || 0;
  const longestStreak = streakData?.longest_streak || 0;

  // Generate last 7 days for visual
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return {
      day: date.toLocaleDateString('en', { weekday: 'short' }),
      date: date.getDate(),
      isActive: i >= 7 - currentStreak, // Simple visualization
      isToday: i === 6,
    };
  });

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                <Flame className="h-6 w-6" />
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium">Current Streak</p>
                <p className="text-4xl font-bold">{currentStreak} days</p>
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-white/80 text-sm">
                <Trophy className="h-4 w-4" />
                <span>Best: {longestStreak} days</span>
              </div>
            </div>
          </div>

          {/* Week View */}
          <div className="flex justify-between gap-2 mt-4">
            {last7Days.map((day, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-xs text-white/70">{day.day}</span>
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                    day.isActive
                      ? "bg-white text-orange-500"
                      : "bg-white/20 text-white/60",
                    day.isToday && "ring-2 ring-white ring-offset-2 ring-offset-orange-500"
                  )}
                >
                  {day.date}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats Footer */}
        <div className="p-4 bg-card grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Calendar className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">This Week</p>
              <p className="font-semibold">{Math.min(currentStreak, 7)} days</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Consistency</p>
              <p className="font-semibold">{currentStreak > 0 ? 'Active' : 'Start today!'}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
