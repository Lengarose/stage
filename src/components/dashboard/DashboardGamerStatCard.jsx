import { cn } from "@/lib/utils";
import { GamerStatTile } from "@/components/profile/gamer/GamerProfileUI";

export default function DashboardGamerStatCard({ label, value, sub, accent = "cyan", icon: Icon, className }) {
  return (
    <div className={cn("relative min-w-0", className)}>
      {Icon ? (
        <Icon className="absolute right-3 top-3 z-[1] h-4 w-4 text-white/35" />
      ) : null}
      <GamerStatTile label={label} value={value} sub={sub} accent={accent} shape="angled" tinted />
    </div>
  );
}

export function DashboardRankRing({ rank, winRate, size = 88 }) {
  const pct = Math.min(100, Math.max(0, Number(winRate) || 0));
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#rankGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
        <defs>
          <linearGradient id="rankGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-xl font-black text-white leading-none">{rank ? `#${rank}` : "—"}</span>
        <span className="text-[8px] font-bold uppercase tracking-wider text-white/40 mt-0.5">{pct}% WR</span>
      </div>
    </div>
  );
}
