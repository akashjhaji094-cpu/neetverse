import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import neetverseLogo from "@/assets/neetverse-logo.jpg";

interface LoadingQuestionsProps {
  totalQuestions: number;
}

export const LoadingQuestions = ({ totalQuestions }: LoadingQuestionsProps) => {
  const [currentCount, setCurrentCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Timer for elapsed seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Progress counter animation
  useEffect(() => {
    if (currentCount >= totalQuestions) return;

    const increment = Math.ceil(totalQuestions / 60);
    const timer = setTimeout(() => {
      setCurrentCount(prev => Math.min(prev + increment, totalQuestions));
    }, 16);

    return () => clearTimeout(timer);
  }, [currentCount, totalQuestions]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-4 border-primary/20 shadow-2xl">
        <CardContent className="pt-8 pb-10">
          <div className="flex flex-col items-center space-y-8">
            {/* Logo with spinning circle */}
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
              
              {/* Spinning circle around logo */}
              <div className="absolute -inset-4">
                <svg className="w-full h-full animate-spin" style={{ animationDuration: '3s' }}>
                  <circle
                    cx="50%"
                    cy="50%"
                    r="48%"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeDasharray="60 200"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              
              <img 
                src={neetverseLogo} 
                alt="NEETVerse" 
                className="relative w-32 h-32 rounded-2xl shadow-lg"
              />
            </div>
            
            {/* Timer display */}
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-primary tabular-nums">
                {formatTime(elapsedSeconds)}
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Preparing Your Test
              </h3>
              <p className="text-muted-foreground">
                Loading questions from database...
              </p>
              
              {/* Show message if loading takes more than 20 seconds */}
              {elapsedSeconds > 20 && (
                <p className="text-sm text-amber-500 animate-pulse font-medium mt-2">
                  Fetching hard... please wait 10 sec more
                </p>
              )}
            </div>

            {/* Progress bar */}
            <div className="w-full space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-muted-foreground">Loading Questions</span>
                <span className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
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

            {/* Stats cards */}
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
