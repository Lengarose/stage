import { cn } from "@/lib/utils";
import { Shield, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import TransferBadge from "./TransferBadge";
import { useTranslation } from "@/hooks/useTranslation";

export default function TransferPlayerList({ players, selectedId, onSelect, canManage, canOffer, getOfferBlockReason, onOffer }) {
  const { t } = useTranslation();
  if (players.length === 0) {
    return (
      <div className="border border-white/10 bg-[#071018] px-6 py-12 text-center">
        <Shield className="mx-auto mb-3 h-10 w-10 text-[#f5c542]/30" />
        <p className="font-heading text-sm font-black uppercase tracking-[0.22em] text-white/55">{t("competitionFlow.noPlayersFound")}</p>
        <p className="mt-2 text-xs text-white/35">{t("commonPages.tryAdjustingFilters")}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {players.map(({ player, badge, badgeType, contract, days_left }) => {
        const isSelected = selectedId === player.id;
        const blockReason = getOfferBlockReason?.(player, contract) || null;
        const canOfferPlayer = canManage && !blockReason && (canOffer ? canOffer(player, contract) : true);

        return (
          <button
            key={player.id}
            type="button"
            onClick={() => onSelect({ player, badge, badgeType, contract, days_left })}
            className={cn(
              "group relative flex min-h-24 w-full items-center gap-4 overflow-hidden border px-4 py-3 text-left shadow-[0_18px_50px_rgba(0,0,0,0.18)] transition-all",
              isSelected
                ? "border-[#f5c542]/50 bg-[linear-gradient(135deg,rgba(245,197,66,0.16),rgba(0,229,255,0.06),rgba(0,0,0,0.42))]"
                : "border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.045),rgba(0,0,0,0.38))] hover:border-[#f5c542]/30 hover:bg-black/50"
            )}
          >
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-[#071018]">
              {player.avatar_url
                ? <img src={player.avatar_url} alt={player.gamertag} className="h-full w-full object-cover" style={{ objectPosition: player.avatar_position || "50% 50%" }} />
                : <span className="font-heading text-sm font-black text-[#f5c542]">{(player.gamertag || "?")[0].toUpperCase()}</span>}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className={cn("min-w-0 truncate font-heading text-lg font-black uppercase tracking-wide", isSelected ? "text-[#f5c542]" : "text-white")}>
                  {player.gamertag}
                </span>
                <TransferBadge type={badgeType} daysLeft={days_left} />
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2">
                {(player.position || player.secondary_position) && (
                  <span className="rounded-sm bg-[#00e5ff]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#00e5ff]">
                    {[player.position, player.secondary_position].filter(Boolean).join(" / ")}
                  </span>
                )}
                {player.overall_rating && (
                  <span className="text-[11px] font-medium text-white/50">
                    {t("commonPages.ovr")} {player.overall_rating}
                  </span>
                )}
                {player.platform && (
                  <span className="hidden text-[11px] text-white/40 sm:inline">
                    {player.platform}
                  </span>
                )}
              </div>
            </div>

            <div className="shrink-0" onClick={e => e.stopPropagation()}>
              {blockReason ? (
                <span className="flex items-center gap-1 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider text-white/45">
                  <FileText className="h-3 w-3" /> {blockReason === "signed" ? t("commonPages.underContract") : t("commonPages.sent")}
                </span>
              ) : canOfferPlayer ? (
                <Button
                  size="sm"
                  onClick={() => onOffer({ player, badgeType })}
                  className="h-9 gap-1 border border-[#f5c542]/45 bg-[#f5c542]/14 px-2.5 text-xs font-heading font-black uppercase tracking-[0.12em] text-[#f5c542] shadow-none hover:bg-[#f5c542]/20 hover:text-[#ffe27a]"
                >
                  <FileText className="h-3 w-3" />
                  <span className="hidden sm:inline">{t("commonPages.offer")}</span>
                </Button>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
