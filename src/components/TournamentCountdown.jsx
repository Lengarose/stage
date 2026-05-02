import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export default function TournamentCountdown({ startDate }) {
  const [timeLeft, setTimeLeft] = useState(null);

  useEffect(() => {
    if (!startDate) return;
    function calc() {
      const diff = new Date(startDate) - new Date();
      if (diff <= 0) { setTimeLeft(null); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ days, hours, mins, secs });
    }
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [startDate]);

  if (!startDate || !timeLeft) return null;

  const localTime = new Date(startDate).toLocaleString(undefined, {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  return (
    <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20 flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary animate-pulse" />
        <span className="text-xs uppercase tracking-wider text-primary font-semibold">Starts In</span>
      </div>
      <div className="flex items-center gap-2">
        {[
          { v: timeLeft.days, label: "d" },
          { v: timeLeft.hours, label: "h" },
          { v: timeLeft.mins, label: "m" },
          { v: timeLeft.secs, label: "s" },
        ].map(({ v, label }) => (
          <div key={label} className="flex items-baseline gap-0.5">
            <span className="text-xl font-bold font-heading text-foreground tabular-nums">{String(v).padStart(2, "0")}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <span className="text-xs text-muted-foreground ml-auto">{localTime}</span>
    </div>
  );
}