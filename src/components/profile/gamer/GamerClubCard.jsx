import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export function GamerClubPhotoFrame({
  club,
  imageUrl,
  imagePosition,
  imageZoom,
  winRate = 0,
  as: Component = "div",
  className,
  children,
  ...props
}) {
  const rating = Math.min(99, Math.max(50, Math.round(winRate || 50)));
  const resolvedImageUrl = imageUrl || club?.logo_url;
  const resolvedPosition = imagePosition || club?.logo_position || "50% 50%";
  const resolvedZoom = imageZoom ?? club?.logo_zoom;

  return (
    <Component
      className={cn(
        "relative w-[132px] sm:w-[156px] aspect-[3/4] rounded-2xl overflow-hidden shrink-0 text-left",
        "border border-amber-400/30 shadow-[0_0_40px_-8px_rgba(255,184,0,0.45)]",
        "bg-gradient-to-br from-amber-500/10 via-[#0d1528] to-cyan-500/10",
        className
      )}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent z-[1]" />
      {resolvedImageUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${resolvedImageUrl})`,
            backgroundPosition: resolvedPosition,
            backgroundSize: resolvedZoom ? `${resolvedZoom}%` : "cover",
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
      {children}
    </Component>
  );
}

export default function GamerClubCard({ club, winRate = 0, onLogoClick, className }) {
  return (
    <GamerClubPhotoFrame
      as="button"
      type="button"
      club={club}
      winRate={winRate}
      onClick={onLogoClick}
      className={cn("transition-transform hover:scale-[1.02] active:scale-[0.98]", className)}
    />
  );
}
