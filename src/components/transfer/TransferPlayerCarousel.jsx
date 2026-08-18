import { useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import TransferCardThreeFx from "./TransferCardThreeFx";
import { GamerPlayerPhotoFrame } from "@/components/profile/gamer/GamerProfileUI";
import TransferBadge from "./TransferBadge";
import { stepCarouselIndex, visibleCarouselSlots } from "@/lib/transferCarousel";
import { useTranslation } from "@/hooks/useTranslation";

const SLOT_X = { "-2": -250, "-1": -150, 0: 0, 1: 150, 2: 250 };
const SLOT_Z = { "-2": -150, "-1": -65, 0: 70, 1: -65, 2: -150 };
const SLOT_ROT = { "-2": 38, "-1": 24, 0: 0, 1: -24, 2: -38 };
const SLOT_SCALE = { "-2": 0.72, "-1": 0.86, 0: 1.06, 1: 0.86, 2: 0.72 };

export default function TransferPlayerCarousel({ entries = [], selectedId, onSelect }) {
  const { t } = useTranslation();
  const pointer = useRef({ x: 0, active: false });
  const entriesRef = useRef(entries);
  const centerRef = useRef(0);
  const center = Math.max(0, entries.findIndex((entry) => entry.player?.id === selectedId));
  entriesRef.current = entries;
  centerRef.current = center;
  const slots = useMemo(
    () => visibleCarouselSlots(entries.length, center, 2),
    [entries.length, center],
  );

  function go(direction) {
    const list = entriesRef.current;
    if (list.length < 2) return;
    const nextIndex = stepCarouselIndex(centerRef.current, list.length, direction);
    onSelect?.(list[nextIndex]);
  }

  useEffect(() => {
    function onKey(event) {
      if (event.target?.closest?.("input, textarea, select, [contenteditable=true]")) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSelect]);

  if (entries.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center border border-white/10 bg-[#071018]/30 px-6 text-center">
        <Shield className="mb-3 h-10 w-10 text-[#f5c542]/30" />
        <p className="font-heading text-sm font-black uppercase tracking-[0.22em] text-white/55">
          {t("competitionFlow.noPlayersFound")}
        </p>
        <p className="mt-2 text-xs text-white/35">{t("commonPages.tryAdjustingFilters")}</p>
      </div>
    );
  }

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent"
      onPointerDown={(event) => {
        pointer.current = { x: event.clientX, active: true };
      }}
      onPointerUp={(event) => {
        if (!pointer.current.active) return;
        const delta = event.clientX - pointer.current.x;
        pointer.current.active = false;
        if (delta > 56) go(-1);
        if (delta < -56) go(1);
      }}
      onPointerCancel={() => { pointer.current.active = false; }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: [
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(245,197,66,0.55), transparent 55%)",
            "radial-gradient(ellipse 40% 60% at 15% 50%, rgba(0,229,255,0.22), transparent 60%)",
            "radial-gradient(ellipse 40% 60% at 85% 50%, rgba(0,229,255,0.22), transparent 60%)",
            "repeating-linear-gradient(90deg, #08150f 0px, #08150f 56px, #0b1c13 56px, #0b1c13 112px)",
          ].join(", "),
        }}
      />

      <button
        type="button"
        aria-label="Previous player"
        onClick={() => go(-1)}
        disabled={entries.length < 2}
        className="absolute left-2 top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-[#f5c542]/40 bg-black/50 text-[#f5c542] disabled:opacity-30 sm:left-6"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        aria-label="Next player"
        onClick={() => go(1)}
        disabled={entries.length < 2}
        className="absolute right-2 top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center border border-[#f5c542]/40 bg-black/50 text-[#f5c542] disabled:opacity-30 sm:right-6"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div
        className="relative z-[1] mx-auto flex min-h-0 w-full flex-1 items-center justify-center"
        style={{ perspective: "1400px", transformStyle: "preserve-3d" }}
      >
        {slots.map(({ index, offset }) => {
          const entry = entries[index];
          const player = entry?.player;
          if (!player) return null;
          const focused = offset === 0;
          const x = SLOT_X[offset] ?? offset * 150;
          const z = SLOT_Z[offset] ?? -80;
          const rot = SLOT_ROT[offset] ?? 0;
          const scale = SLOT_SCALE[offset] ?? 0.8;
          return (
            <button
              key={`${player.id}-${offset}`}
              type="button"
              onClick={() => onSelect?.(entry, { openDetails: true })}
              className={cn(
                "absolute origin-center cursor-pointer motion-safe:transition-[transform,opacity] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]",
              )}
              style={{
                transform: `translateX(${x}px) translateZ(${z}px) rotateY(${rot}deg) scale(${scale})`,
                transformStyle: "preserve-3d",
                zIndex: 20 - Math.abs(offset),
                opacity: 1 - Math.abs(offset) * 0.18,
              }}
            >
              <div className="relative">
                {Math.abs(offset) <= 1 ? <TransferCardThreeFx active={focused} /> : null}
                <GamerPlayerPhotoFrame
                  player={player}
                  className={cn(
                    "relative z-[2] w-[150px] sm:w-[180px] md:w-[200px]",
                    focused
                      ? "border-[#f5c542]/70 shadow-[0_0_48px_-6px_rgba(245,197,66,0.55)]"
                      : "border-cyan-400/20 shadow-none",
                  )}
                >
                  <div className="absolute left-2 top-2 z-[3]">
                    <TransferBadge type={entry.badgeType} daysLeft={entry.days_left} />
                  </div>
                </GamerPlayerPhotoFrame>
              </div>
              <p className={cn(
                "mt-3 max-w-[200px] truncate text-center font-heading uppercase tracking-wide",
                focused ? "text-base text-white sm:text-xl" : "text-xs text-white/50",
              )}
              >
                {player.gamertag}
              </p>
            </button>
          );
        })}
      </div>

      <div className="relative z-[1] shrink-0 pb-4 text-center">
        <p className="font-heading text-[11px] font-black uppercase tracking-[0.28em] text-[#f5c542]">
          {center + 1} / {entries.length}
        </p>
      </div>
    </div>
  );
}
