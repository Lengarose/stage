import { cn } from "@/lib/utils";
import { clubInitials } from "@/lib/gameDayPresentation";

const SIZE = {
  sm: "h-9 w-10 text-[9px]",
  md: "h-24 w-28 text-2xl sm:h-28 sm:w-32",
  lg: "h-32 w-36 text-3xl sm:h-40 sm:w-44 md:h-44 md:w-52 md:text-4xl",
};

export default function GameDayCrest({ name, imageUrl, size = "md", glow = false, className }) {
  const initials = clubInitials(name);
  const clip = "polygon(12% 0, 100% 0, 88% 100%, 0 100%)";

  return (
    <div
      className={cn(
        "relative shrink-0",
        SIZE[size] || SIZE.md,
        glow && "drop-shadow-[0_0_28px_rgba(238,243,251,0.45)]",
        className,
      )}
    >
      <div
        className="absolute inset-0 bg-gradient-to-br from-white via-[#8eeeff] to-[#aeb8c6]"
        style={{ clipPath: clip }}
      />
      <div
        className="absolute inset-[2px] overflow-hidden bg-[#111827]"
        style={{ clipPath: clip }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#2d3440] via-[#0d121b] to-[#111827]">
            <span className="font-heading font-black tracking-tight text-[#eef3fb]">{initials}</span>
          </div>
        )}
      </div>
    </div>
  );
}
