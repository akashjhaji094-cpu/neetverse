import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Target, 
  BookOpen, 
  Zap,
  ChevronRight,
} from "lucide-react";

export function QuickActions() {
  const navigate = useNavigate();

  const actions = [
    {
      icon: Target,
      title: "Practice Questions",
      subtitle: "Chapter-wise practice",
      action: () => navigate('/practice'),
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: BookOpen,
      title: "Biology Mock Test",
      subtitle: "90 Questions · NEET Pattern",
      action: () => navigate('/test'),
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/20",
    },
    {
      icon: Zap,
      title: "Notes & Study Material",
      subtitle: "PDFs & Resources",
      action: () => navigate('/notes'),
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {actions.map((action, i) => {
        const Icon = action.icon;
        return (
          <Card 
            key={i} 
            className="cursor-pointer card-3d animate-tilt-in"
            style={{ animationDelay: `${i * 80}ms` }}
            onClick={action.action}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${action.bgColor} icon-3d`}>
                <Icon className={`h-5 w-5 ${action.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{action.title}</p>
                <p className="text-xs text-muted-foreground">{action.subtitle}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
