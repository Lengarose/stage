import { useRef } from "react";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE = {
  sm: { w: "w-14", img: "h-10 w-10", txt: "text-[8px]" },
  md: { w: "w-20", img: "h-14 w-14", txt: "text-[10px]" },
  lg: { w: "w-24", img: "h-16 w-16", txt: "text-xs" },
};

export default function TrophyCarousel({ trophies = [], selected, onSelect, size = "md" }) {
  const scrollRef = useRef(null);
  const s = SIZE[size] || SIZE.md;

  function scroll(dir) {
    scrollRef.current?.scrollBy({ left: dir * 180, behavior: "smooth" });
  }

  if (!trophies.length) return (
    <div className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded">
      No trophies in library yet. Add some from Admin → Trophies.
    </div>
  );

  return (
    <div className="relative group overflow-hidden">
      <button
        type="button"
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shadow transition-opacity opacity-0 group-hover:opacity-100"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {trophies.map(trophy => (
          <button
            key={trophy.id}
            type="button"
            onClick={() => onSelect?.(selected === trophy.id ? null : trophy.id)}
            className={cn(
              "flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded border transition-all",
              s.w,
              !onSelect && "pointer-events-none",
              selected === trophy.id
                ? "border-warning bg-warning/10"
                : "border-transparent hover:border-border hover:bg-secondary/60"
            )}
          >
            {trophy.image_url ? (
              <img
                src={trophy.image_url}
                alt={trophy.name}
                className={cn("object-contain drop-shadow-xl", s.img)}
              />
            ) : (
              <div className={cn("flex items-center justify-center text-warning/20", s.img)}>
                <Trophy className="w-7 h-7" />
              </div>
            )}
            <p className={cn(
              "text-center truncate w-full leading-tight",
              s.txt,
              selected === trophy.id ? "text-warning font-semibold" : "text-muted-foreground"
            )}>
              {trophy.name}
            </p>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shadow transition-opacity opacity-0 group-hover:opacity-100"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
