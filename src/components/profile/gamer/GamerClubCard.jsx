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
  const rating = Math.min(99, Math.max(0, Math.round(Number(winRate) || 0)));
  const ratingLabel = rating === 0 ? "0" : String(rating);
  const resolvedImageUrl = imageUrl || club?.logo_url;
  const resolvedPosition = imagePosition || club?.logo_position || "50% 50%";
  const resolvedZoom = imageZoom ?? club?.logo_zoom;

  return (
    <Component
      className={cn(
        "relative w-[168px] sm:w-[208px] aspect-[4/5] rounded-none overflow-hidden shrink-0 text-left",
        "border border-amber-300/40 shadow-[0_0_50px_-8px_rgba(255,184,0,0.62),0_0_90px_-42px_rgba(0,229,255,0.7)]",
        "bg-gradient-to-br from-amber-500/10 via-[#0d1528] to-cyan-500/10",
        "[clip-path:polygon(12%_0,100%_0,88%_100%,0_100%)]",
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
      <div className="absolute top-3 right-3 z-[2] min-w-[40px] bg-gradient-to-br from-cyan-300 to-teal-500 px-2 py-1.5 text-center shadow-lg [clip-path:polygon(13%_0,100%_0,87%_100%,0_100%)]">
        <p className="text-[7px] font-black uppercase tracking-wider text-black/70 leading-none">WR</p>
        <p className="font-heading text-[19px] font-black text-black leading-none">{ratingLabel}</p>
      </div>
      <div className="absolute bottom-0 inset-x-0 z-[2] px-4 pb-3 pt-8">
        {club?.tag ? (
          <p className="font-heading text-xl font-black uppercase leading-none tracking-normal text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">[{club.tag}]</p>
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
