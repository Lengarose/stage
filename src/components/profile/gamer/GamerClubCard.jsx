import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export default function GamerClubCard({ club, winRate = 0, onLogoClick, className }) {
  const rating = Math.min(99, Math.max(50, Math.round(winRate || 50)));

  return (
    <button
      type="button"
      onClick={onLogoClick}
      className={cn(
        "relative w-[132px] sm:w-[156px] aspect-[3/4] rounded-2xl overflow-hidden shrink-0 text-left",
        "border border-amber-400/30 shadow-[0_0_40px_-8px_rgba(255,184,0,0.45)]",
        "bg-gradient-to-br from-amber-500/10 via-[#0d1528] to-cyan-500/10",
        "transition-transform hover:scale-[1.02] active:scale-[0.98]",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent z-[1]" />
      {club?.logo_url ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${club.logo_url})`,
            backgroundPosition: club.logo_position || "50% 50%",
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Shield className="w-14 h-14 text-amber-400/30" />
        </div>
      )}
      <div className="absolute top-2 right-2 z-[2] min-w-[42px] rounded-lg bg-gradient-to-br from-cyan-300 to-teal-500 px-2 py-1 text-center shadow-lg">
        <p className="text-[8px] font-black uppercase tracking-wider text-black/70 leading-none">WR</p>
        <p className="font-heading text-xl font-black text-black leading-none">{rating}</p>
      </div>
      <div className="absolute bottom-0 inset-x-0 z-[2] p-3">
        {club?.tag ? (
          <p className="font-heading text-lg font-black uppercase leading-none tracking-tight text-amber-300">[{club.tag}]</p>
        ) : null}
        <p className="text-[10px] font-bold text-white/50 mt-0.5 truncate">{club?.platform || "—"}</p>
      </div>
    </button>
  );
}
