import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import neetverseLogo from "@/assets/neetverse-logo.jpg";

interface LoadingQuestionsProps {
  totalQuestions: number;
}

export const LoadingQuestions = ({ totalQuestions }: LoadingQuestionsProps) => {
  const [currentCount, setCurrentCount] = useState(0);

  useEffect(() => {
    if (currentCount >= totalQuestions) return;

    const increment = Math.max(1, Math.ceil(totalQuestions / (60 * 20))); // Complete in ~20 seconds at 60fps
    const timer = setTimeout(() => {
      setCurrentCount(prev => Math.min(prev + increment, totalQuestions));
    }, 16); // ~60fps

    return () => clearTimeout(timer);
  }, [currentCount, totalQuestions]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-4 border-primary/20 shadow-2xl">
        <CardContent className="pt-8 pb-10">
          <div className="flex flex-col items-center space-y-8">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
              <img 
                src={neetverseLogo} 
                alt="NEETVerse" 
                className="relative w-32 h-32 rounded-2xl shadow-lg animate-[pulse_2s_ease-in-out_infinite]"
              />
              <div className="absolute -inset-1 bg-gradient-to-r from-primary via-primary/50 to-primary rounded-2xl opacity-50 blur animate-[spin_3s_linear_infinite]" />
            </div>
            
            <div className="text-center space-y-3">
              <h3 className="text-3xl font-bold text-gradient">Preparing Your Test</h3>
              <p className="text-muted-foreground animate-pulse">Fetching questions from the database...</p>
            </div>

            <div className="w-full space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-muted-foreground">Loading Questions</span>
                <span className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent animate-[pulse_1s_ease-in-out_infinite]">
                  {currentCount}
                </span>
              </div>
              
              <div className="relative w-full h-3 bg-muted/50 rounded-full overflow-hidden border border-primary/20">
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-primary via-primary/80 to-primary transition-all duration-300 ease-out"
                  style={{ width: `${(currentCount / totalQuestions) * 100}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[shimmer_1.5s_ease-in-out_infinite]" />
                </div>
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Physics: 45</span>
                <span>Chemistry: 45</span>
                <span>Biology: 90</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full text-center text-xs">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <div className="font-bold text-xl text-primary">{totalQuestions}</div>
                <div className="text-muted-foreground mt-1">Questions</div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <div className="font-bold text-xl text-primary">3 hrs</div>
                <div className="text-muted-foreground mt-1">Duration</div>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <div className="font-bold text-xl text-primary">{totalQuestions * 4}</div>
                <div className="text-muted-foreground mt-1">Max Marks</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
