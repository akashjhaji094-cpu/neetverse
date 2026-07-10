import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play, X } from "lucide-react";

interface OfflineTestTimerProps {
  durationMinutes: number;
  paperTitle: string;
  onDone: () => void;
}

export function OfflineTestTimer({ durationMinutes, paperTitle, onDone }: OfflineTestTimerProps) {
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (paused || finished) return;
    const t = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { setFinished(true); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [paused, finished]);

  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  const pctLeft = (secondsLeft / (durationMinutes * 60)) * 100;
  const isLow = pctLeft < 10;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 gap-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-2">{paperTitle}</p>
        <div className={`text-6xl md:text-7xl font-black font-mono tabular-nums ${isLow ? "text-red-600" : "text-foreground"}`}>
          {h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`}
        </div>
        {finished && <p className="text-red-600 font-bold mt-3 text-lg">⏰ Time's up! Put your pen down.</p>}
        {!finished && isLow && <p className="text-red-600 font-semibold mt-3 text-sm">Less than 10% time remaining</p>}
      </div>

      <div className="w-full max-w-sm h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full transition-all duration-1000 ${isLow ? "bg-red-500" : "bg-primary"}`} style={{ width: `${Math.max(0, pctLeft)}%` }} />
      </div>

      <div className="flex gap-3">
        {!finished && (
          <Button variant="outline" size="lg" onClick={() => setPaused((p) => !p)} className="gap-2">
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "Resume" : "Pause"}
          </Button>
        )}
        <Button size="lg" onClick={onDone} className="gap-2">
          <X className="h-4 w-4" /> {finished ? "Done" : "End & Go to Scan"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground text-center max-w-xs">
        When you're done, come back here and tap "Scan OMR" to upload your filled sheet.
      </p>
    </div>
  );
}
