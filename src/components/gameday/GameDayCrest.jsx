import { cn } from "@/lib/utils";
import { clubInitials } from "@/lib/gameDayPresentation";

const SIZE = {
  sm: "h-9 w-9 text-[9px]",
  md: "h-24 w-24 text-2xl sm:h-28 sm:w-28",
  lg: "h-32 w-32 text-3xl sm:h-40 sm:w-40 md:h-44 md:w-44 md:text-4xl",
};

export default function GameDayCrest({ name, imageUrl, size = "md", glow = false, className }) {
  const initials = clubInitials(name);
  const clip = "polygon(50% 0%, 94% 18%, 94% 72%, 50% 100%, 6% 72%, 6% 18%)";

  return (
    <div
      className={cn(
        "relative shrink-0",
        SIZE[size] || SIZE.md,
        glow && "drop-shadow-[0_0_28px_rgba(245,197,66,0.35)]",
        className,
      )}
    >
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#ffe27a] via-[#c9a227] to-[#7a5c12]"
        style={{ clipPath: clip }}
      />
      <div
        className="absolute inset-[3px] overflow-hidden bg-[#071018]"
        style={{ clipPath: clip }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-b from-[#12304a] to-[#071018]">
            <span className="font-heading font-black tracking-tight text-[#f5c542]">{initials}</span>
          </div>
        )}
      </div>
    </div>
  );
}
