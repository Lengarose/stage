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
  const resolvedImageUrl = imageUrl || club?.logo_url;
  const resolvedPosition = imagePosition || club?.logo_position || "50% 50%";
  const resolvedZoom = imageZoom ?? club?.logo_zoom;

  return (
    <Component
      className={cn(
        "relative w-[184px] sm:w-[240px] aspect-square shrink-0 overflow-hidden rounded-full border border-white/15 bg-[#0d1528] text-left shadow-[0_14px_24px_rgba(0,0,0,0.7),0_0_40px_-12px_rgba(255,255,255,0.45)]",
        className
      )}
      {...props}
    >
      {resolvedImageUrl ? (
        <div
          className="absolute inset-0 rounded-full bg-cover bg-center"
          style={{
            backgroundImage: `url(${resolvedImageUrl})`,
            backgroundPosition: resolvedPosition,
            backgroundSize: resolvedZoom ? `${resolvedZoom}%` : "cover",
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-[#0d1528]">
          <Shield className="w-14 h-14 text-amber-400/30" />
        </div>
      )}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1] rounded-full bg-gradient-to-b from-white/10 via-transparent to-black/20 shadow-[inset_0_2px_3px_rgba(255,255,255,0.55),inset_0_-10px_15px_rgba(0,0,0,0.75),inset_2px_0_4px_rgba(255,255,255,0.12)]" />
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
