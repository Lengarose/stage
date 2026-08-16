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
    <div className="space-y-1.5">
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
              "group flex min-h-14 w-full items-center gap-3 border px-3 py-2 text-left transition-colors",
              isSelected
                ? "border-[#f5c542]/50 bg-[#f5c542]/10"
                : "border-white/10 bg-black/30 hover:border-[#f5c542]/30 hover:bg-black/50"
            )}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-white/10 bg-[#071018]">
              {player.avatar_url
                ? <img src={player.avatar_url} alt={player.gamertag} className="h-full w-full object-cover" style={{ objectPosition: player.avatar_position || "50% 50%" }} />
                : <span className="font-heading text-sm font-black text-[#f5c542]">{(player.gamertag || "?")[0].toUpperCase()}</span>}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("truncate font-heading text-sm font-black uppercase tracking-wide", isSelected ? "text-[#f5c542]" : "text-white")}>
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
                <span className="flex items-center gap-1 rounded-sm bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider text-white/45">
                  <FileText className="h-3 w-3" /> {blockReason === "signed" ? t("commonPages.underContract") : t("commonPages.sent")}
                </span>
              ) : canOfferPlayer ? (
                <Button
                  size="sm"
                  onClick={() => onOffer({ player, badgeType })}
                  className="h-9 gap-1 rounded-sm bg-gradient-to-b from-[#ffe27a] to-[#c9a227] px-2.5 text-xs font-heading font-black uppercase tracking-[0.12em] text-black hover:from-[#fff0a8] hover:to-[#d4ad30]"
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
