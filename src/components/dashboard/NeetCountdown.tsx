import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "lucide-react";

// NEET UG 2027 — assumed: 2 May 2027, 2:00 PM IST
const NEET_DATE = new Date("2027-05-02T14:00:00+05:30").getTime();

function computeRemaining() {
  const now = Date.now();
  let diff = Math.max(0, NEET_DATE - now);
  const days = Math.floor(diff / 86400000); diff -= days * 86400000;
  const hours = Math.floor(diff / 3600000); diff -= hours * 3600000;
  const minutes = Math.floor(diff / 60000); diff -= minutes * 60000;
  const seconds = Math.floor(diff / 1000);
  return { days, hours, minutes, seconds };
}

export function NeetCountdown() {
  const [t, setT] = useState(computeRemaining());
  useEffect(() => {
    const i = setInterval(() => setT(computeRemaining()), 1000);
    return () => clearInterval(i);
  }, []);

  const Block = ({ value, label }: { value: number; label: string }) => (
    <div className="flex-1 text-center bg-white/10 backdrop-blur rounded-xl py-2 px-1">
      <div className="text-2xl lg:text-3xl font-black tabular-nums text-white leading-none">
        {value.toString().padStart(2, "0")}
      </div>
      <div className="text-[9px] lg:text-[10px] font-semibold tracking-wider uppercase text-white/80 mt-1">
        {label}
      </div>
    </div>
  );

  return (
    <Card className="overflow-hidden border-0 shadow-md">
      <CardContent className="p-0">
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 p-4 lg:p-5 text-white">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-full bg-white/15">
                <Calendar className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase text-white/70">Countdown to</p>
                <h3 className="font-bold text-base">NEET UG 2027</h3>
              </div>
            </div>
            <p className="text-[11px] text-white/80 font-medium hidden sm:block">2 May 2027 · 2:00 PM</p>
          </div>
          <div className="flex gap-2">
            <Block value={t.days} label="Days" />
            <Block value={t.hours} label="Hours" />
            <Block value={t.minutes} label="Minutes" />
            <Block value={t.seconds} label="Seconds" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}