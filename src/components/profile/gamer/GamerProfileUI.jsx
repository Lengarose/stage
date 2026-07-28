import { cn } from "@/lib/utils";

const ACCENT = {
  cyan: "from-cyan-400 to-teal-500",
  gold: "from-amber-300 to-yellow-500",
  green: "from-emerald-400 to-green-500",
  rose: "from-rose-400 to-red-500",
  violet: "from-violet-400 to-purple-500",
  sky: "from-sky-400 to-blue-500",
};

export function GamerProfileShell({ children, className }) {
  return (
    <div className={cn("min-h-screen bg-[#060912] text-white relative overflow-x-hidden", className)}>
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 0%, rgba(0,229,255,0.12), transparent 40%), radial-gradient(circle at 80% 10%, rgba(255,184,0,0.08), transparent 35%), linear-gradient(180deg, #060912 0%, #0a101c 100%)",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

export function GamerPlayerPhotoFrame({
  player,
  imageUrl,
  imagePosition,
  imageZoom,
  positionLabel,
  overallRating,
  shirtNumber,
  as: Component = "div",
  className,
  children,
  ...props
}) {
  const ovr = player?.overall_rating || 70;
  const position = positionLabel || player?.position || "—";
  const resolvedImageUrl = imageUrl || player?.avatar_url;
  const resolvedZoom = imageZoom ?? player?.avatar_zoom;
  const resolvedPosition = imagePosition || player?.avatar_position || "50% 20%";
  const resolvedOverall = overallRating || ovr;
  const resolvedShirtNumber = shirtNumber ?? player?.shirt_number;

  return (
    <Component
      className={cn(
        "relative w-[132px] sm:w-[156px] aspect-[3/4] rounded-2xl overflow-hidden shrink-0 text-left",
        "border border-cyan-400/30 shadow-[0_0_40px_-8px_rgba(0,229,255,0.55)]",
        "bg-gradient-to-br from-cyan-500/10 via-[#0d1528] to-amber-500/10",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-[1]" />
      {resolvedImageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${resolvedImageUrl})`,
            backgroundSize: resolvedZoom ? `${resolvedZoom}%` : "cover",
            backgroundPosition: resolvedPosition,
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/20 text-4xl font-black">?</div>
      )}
      <div className="absolute top-2 right-2 z-[2] min-w-[42px] rounded-lg bg-gradient-to-br from-amber-300 to-yellow-500 px-2 py-1 text-center shadow-lg">
        <p className="text-[8px] font-black uppercase tracking-wider text-black/70 leading-none">OVR</p>
        <p className="font-heading text-xl font-black text-black leading-none">{resolvedOverall}</p>
      </div>
      <div className="absolute bottom-0 inset-x-0 z-[2] p-3">
        <p className="font-heading text-lg font-black uppercase leading-none tracking-tight">{position}</p>
        {resolvedShirtNumber != null && resolvedShirtNumber !== "" ? (
          <p className="text-[10px] font-bold text-white/50 mt-0.5">#{resolvedShirtNumber}</p>
        ) : null}
      </div>
      {children}
    </Component>
  );
}

export function GamerPlayerCard({ player, onAvatarClick, className }) {
  return (
    <GamerPlayerPhotoFrame
      as="button"
      type="button"
      player={player}
      onClick={onAvatarClick}
      className={cn("transition-transform hover:scale-[1.02] active:scale-[0.98]", className)}
    />
  );
}

export function GamerRecordStrip({ wins = 0, draws = 0, losses = 0, className }) {
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1", className)}>
      <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-black text-emerald-400">{wins}W</span>
      <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black text-white/60">{draws}D</span>
      <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-[10px] font-black text-rose-400">{losses}L</span>
    </div>
  );
}

export function GamerMetaPill({ children, className }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/60", className)}>
      {children}
    </span>
  );
}

export function GamerTabNav({ tabs, active, onChange, className }) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto pb-1 scrollbar-none", className)}>
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-[10px] sm:text-xs font-black uppercase tracking-[0.18em] transition-all",
              isActive
                ? "bg-gradient-to-r from-cyan-500/25 to-teal-500/20 text-cyan-300 border border-cyan-400/40 shadow-[0_0_20px_-6px_rgba(0,229,255,0.8)]"
                : "bg-white/[0.03] text-white/40 border border-white/10 hover:text-white/70 hover:border-white/20"
            )}
          >
            {tab.label}
            {tab.badge ? (
              <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-cyan-500 text-black text-[9px] font-black normal-case tracking-normal">
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function GamerStatTile({ label, value, accent = "cyan", sub, className }) {
  return (
    <div className={cn("rounded-xl border border-white/10 bg-white/[0.03] p-3 min-w-0", className)}>
      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/40 mb-1">{label}</p>
      <p className={cn("font-heading text-2xl font-black leading-none bg-gradient-to-r bg-clip-text text-transparent", ACCENT[accent] || ACCENT.cyan)}>
        {value}
      </p>
      {sub ? <p className="text-[10px] text-white/40 mt-1">{sub}</p> : null}
    </div>
  );
}

export function GamerAttributeBar({ label, value, max = 99, accent = "cyan" }) {
  const pct = Math.max(0, Math.min(100, (Number(value) / max) * 100));
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-white/50">{label}</span>
        <span className="font-heading text-sm font-black text-white">{Math.round(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r transition-all duration-500", ACCENT[accent] || ACCENT.cyan)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function GamerSectionCard({ title, action, children, className }) {
  return (
    <section className={cn("rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm overflow-hidden", className)}>
      {title ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-white/[0.02]">
          <h3 className="font-heading text-sm font-black uppercase tracking-[0.16em] text-white/90">{title}</h3>
          {action}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function gamerStatScore(value, cap) {
  const n = Number(value) || 0;
  if (!cap) return Math.min(99, n);
  return Math.min(99, Math.round((n / cap) * 99));
}
