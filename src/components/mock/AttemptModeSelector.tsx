import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Printer, ArrowLeft } from "lucide-react";
import neetverseLogo from "@/assets/neetverse-logo.jpg";

interface AttemptModeSelectorProps {
  totalQuestions: number;
  testLabel: string;
  onOnline: () => void;
  onOffline: () => void;
  onBack: () => void;
}

export const AttemptModeSelector = ({ totalQuestions, testLabel, onOnline, onOffline, onBack }: AttemptModeSelectorProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center gap-4">
          <img src={neetverseLogo} alt="NEETVerse" className="w-20 h-20 rounded-2xl shadow-lg" />
          <div className="text-center">
            <h2 className="text-2xl font-bold">{testLabel}</h2>
            <p className="text-muted-foreground">{totalQuestions} Questions Ready</p>
          </div>
        </div>

        <div className="text-center">
          <h3 className="text-lg font-semibold mb-1">How do you want to attempt?</h3>
          <p className="text-sm text-muted-foreground">Choose your preferred mode</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Online */}
          <Card
            className="cursor-pointer border-2 border-transparent hover:border-primary transition-all hover:shadow-lg group"
            onClick={onOnline}
          >
            <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3 text-center">
              <div className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Monitor className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-lg">Attempt Online</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Timer, auto-scoring & analytics
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Offline */}
          <Card
            className="cursor-pointer border-2 border-transparent hover:border-primary transition-all hover:shadow-lg group"
            onClick={onOffline}
          >
            <CardContent className="pt-6 pb-6 flex flex-col items-center gap-3 text-center">
              <div className="p-4 rounded-2xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Printer className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h4 className="font-bold text-lg">Attempt Offline</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Print question paper with OMR
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center">
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
          </Button>
        </div>
      </div>
    </div>
  );
};
