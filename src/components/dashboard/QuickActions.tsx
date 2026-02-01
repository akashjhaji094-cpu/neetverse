import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Target, 
  BookOpen, 
  Play, 
  Clock,
  ChevronRight,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface ActionCard {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  action: () => void;
  color: string;
  bgColor: string;
}

export function QuickActions() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Check for in-progress tests
  const { data: inProgressTest } = useQuery({
    queryKey: ['in-progress-test', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data } = await supabase
        .from('in_progress_tests')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();
      
      return data;
    },
    enabled: !!user,
  });

  const actions: ActionCard[] = [
    {
      icon: Target,
      title: "Quick Practice",
      subtitle: "10 random questions",
      action: () => navigate('/practice'),
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      icon: BookOpen,
      title: "Mock Test",
      subtitle: "Full NEET simulation",
      action: () => navigate('/test'),
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      icon: Zap,
      title: "Daily Challenge",
      subtitle: "Today's questions",
      action: () => navigate('/practice'),
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Resume Test Banner */}
        {inProgressTest && (
          <button
            onClick={() => navigate('/practice')}
            className="w-full p-4 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-white flex items-center justify-between group hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Clock className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-semibold">Continue Test</p>
                <p className="text-sm text-white/80">
                  {inProgressTest.current_question_index + 1}/{inProgressTest.total_questions} questions
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          </button>
        )}

        {/* Action Cards */}
        <div className="grid grid-cols-1 gap-2">
          {actions.map((action, i) => {
            const Icon = action.icon;
            return (
              <Button
                key={i}
                variant="ghost"
                className="w-full h-auto p-4 justify-start hover:bg-muted/50"
                onClick={action.action}
              >
                <div className={`p-2 rounded-lg ${action.bgColor} mr-3`}>
                  <Icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium">{action.title}</p>
                  <p className="text-sm text-muted-foreground">{action.subtitle}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
