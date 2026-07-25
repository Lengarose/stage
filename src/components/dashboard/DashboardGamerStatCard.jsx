import { cn } from "@/lib/utils";

const ACCENTS = {
  cyan: "from-cyan-400/20 to-teal-500/10 border-cyan-400/25 text-cyan-300",
  gold: "from-amber-400/20 to-yellow-500/10 border-amber-400/25 text-amber-300",
  green: "from-emerald-400/20 to-green-500/10 border-emerald-400/25 text-emerald-300",
  violet: "from-violet-400/20 to-purple-500/10 border-violet-400/25 text-violet-300",
  rose: "from-rose-400/20 to-red-500/10 border-rose-400/25 text-rose-300",
};

export default function DashboardGamerStatCard({ label, value, sub, accent = "cyan", icon: Icon, className }) {
  return (
    <div className={cn(
      "relative rounded-xl border bg-gradient-to-br p-4 min-w-0 overflow-hidden",
      ACCENTS[accent] || ACCENTS.cyan,
      className
    )}>
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-white/[0.04] blur-xl pointer-events-none" />
      {Icon ? (
        <Icon className="w-4 h-4 opacity-50 mb-2" />
      ) : null}
      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/40 mb-1">{label}</p>
      <p className="font-heading font-black text-2xl leading-none text-white">{value}</p>
      {sub ? <p className="text-[10px] text-white/45 mt-1">{sub}</p> : null}
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
