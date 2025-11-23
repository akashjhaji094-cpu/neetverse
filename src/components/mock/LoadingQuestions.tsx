import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface LoadingQuestionsProps {
  totalQuestions: number;
}

export const LoadingQuestions = ({ totalQuestions }: LoadingQuestionsProps) => {
  const [currentCount, setCurrentCount] = useState(0);

  useEffect(() => {
    if (currentCount >= totalQuestions) return;

    const increment = Math.ceil(totalQuestions / 60); // Complete in ~1 second (60 frames)
    const timer = setTimeout(() => {
      setCurrentCount(prev => Math.min(prev + increment, totalQuestions));
    }, 16); // ~60fps

    return () => clearTimeout(timer);
  }, [currentCount, totalQuestions]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 pb-8">
          <div className="flex flex-col items-center space-y-6">
            <div className="relative">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 rounded-full bg-primary/20 animate-pulse" />
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-bold">Preparing Your Test</h3>
              <p className="text-muted-foreground">Fetching questions from database...</p>
            </div>

            <div className="w-full space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Loading Questions</span>
                <span className="text-2xl font-bold text-primary animate-fade-in">
                  {currentCount}
                </span>
              </div>
              
              <div className="relative w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${(currentCount / totalQuestions) * 100}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                </div>
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Physics: 45</span>
                <span>Chemistry: 45</span>
                <span>Biology: 90</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 w-full text-center text-xs">
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="font-bold text-primary">180</div>
                <div className="text-muted-foreground">Questions</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="font-bold text-primary">3 hrs</div>
                <div className="text-muted-foreground">Duration</div>
              </div>
              <div className="p-2 rounded-lg bg-muted/50">
                <div className="font-bold text-primary">720</div>
                <div className="text-muted-foreground">Max Marks</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
