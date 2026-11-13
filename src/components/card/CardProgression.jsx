import { useCardProgression } from "@/hooks/useCardProgression";
export function CardLevelBadge({playerId,className=""}) {
  const {card,error}=useCardProgression(playerId);
  return <span className={`inline-flex items-center gap-1 border border-blue-200/30 bg-[#112039] px-2 py-1 text-xs font-bold text-white ${className}`} title={error || "STAGE Card Level — earned through official match participation"}>LV <strong>{card?.level ?? "—"}</strong></span>;
}
/** Photo overlay: the white V sits just in front of the first blue level digit. */
export function CardLevelPhotoMark({ playerId, className = "" }) {
  const { card, error } = useCardProgression(playerId);
  return <span className={`pointer-events-none inline-flex items-end whitespace-nowrap ${className}`} title={error || "STAGE Card Level — earned through official match participation"} aria-label={`STAGE Level ${card?.level ?? "unavailable"}`}>
    <span className="relative z-[1] font-heading text-lg font-black leading-none text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">LV</span>
    <span className="relative z-0 -mb-px -ml-[0.2em] font-heading text-[26px] font-black leading-[0.8] text-blue-400/50 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)] sm:text-[30px]">{card?.level ?? "—"}</span>
  </span>;
}
export default function CardProgression({playerId}) {
  const {card,error}=useCardProgression(playerId);
  return <section className="border border-white/15 bg-[#0b1423] p-4 text-white" aria-label="STAGE Card progression">
    <div className="flex items-center justify-between gap-4"><h3 className="font-heading uppercase tracking-widest">STAGE Card Level</h3><strong className="text-2xl">{card?.level ?? "—"}</strong></div>
    {error ? <p role="alert" className="mt-2 text-sm text-red-200">Progression unavailable. {error}</p> : card ? <>
      <progress aria-label="Card XP progress" className="my-3 h-1.5 w-full accent-blue-200" max={card.xp_to_next_level || 1} value={card.level===100 ? 1 : card.xp_in_level}/>
      <p className="text-xs text-white/65">{card.level===100 ? "Maximum level reached" : `${card.xp_in_level} / ${card.xp_to_next_level} XP towards Level ${card.level+1}`} · {card.total_xp.toLocaleString()} total XP</p>
    </> : <p className="my-3 text-sm text-white/50">Loading progression…</p>}
    <p className="mt-3 text-xs leading-relaxed text-white/55">100 XP for each confirmed Regional League, Regional Cup or GOST match actually played. Card Level is separate from match ratings. A higher level does not automatically change accepted pay.</p>
  </section>;
}
