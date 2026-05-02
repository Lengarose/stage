/**
 * TrophyScrollBar — horizontal scroll of all trophies.
 * Shows locked/unlocked state. Clicking an unlocked trophy starts drag-to-place.
 */
import { Lock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const RARITY_GLOW = {
  common:    "rgba(255,255,255,0.15)",
  rare:      "rgba(96,165,250,0.4)",
  epic:      "rgba(168,85,247,0.4)",
  legendary: "rgba(251,191,36,0.5)",
};

export default function TrophyScrollBar({ allTrophies, unlockedIds, onDragStart }) {
  return (
    <div className="mt-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-1">
        Trophy Collection
      </p>
      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin">
        {allTrophies.map(trophy => {
          const unlocked = unlockedIds.has(trophy.id);
          const glow = RARITY_GLOW[trophy.rarity] || RARITY_GLOW.common;
          return (
            <div
              key={trophy.id}
              className={cn(
                "flex flex-col items-center gap-1.5 shrink-0 rounded-xl p-2 border transition-all duration-200 select-none",
                unlocked
                  ? "border-amber-500/30 bg-amber-500/5 cursor-grab active:cursor-grabbing hover:scale-105"
                  : "border-border/40 bg-secondary/30 cursor-not-allowed opacity-50 grayscale"
              )}
              style={{ width: 72 }}
              draggable={unlocked}
              onDragStart={unlocked ? (e) => onDragStart(e, trophy) : undefined}
              title={unlocked ? `${trophy.name} — drag to place` : `${trophy.name} — win a tournament to unlock`}
            >
              <div
                className="relative w-12 h-12 flex items-center justify-center"
                style={{ filter: unlocked ? `drop-shadow(0 0 8px ${glow})` : "none" }}
              >
                {trophy.image_url ? (
                  <img src={trophy.image_url} alt={trophy.name} className="w-full h-full object-contain" />
                ) : (
                  <Trophy className="w-8 h-8 text-amber-400" />
                )}
                {!unlocked && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-[9px] text-center leading-tight text-foreground/70 w-full truncate px-0.5">
                {trophy.name}
              </p>
              {!unlocked && (
                <p className="text-[8px] text-muted-foreground/50">Locked</p>
              )}
            </div>
          );
        })}
        {allTrophies.length === 0 && (
          <p className="text-xs text-muted-foreground py-4">No trophies in the library yet.</p>
        )}
      </div>
    </div>
  );
}