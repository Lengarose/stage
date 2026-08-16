import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Clock, Users, Shield, Star, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import TransferBadge from "./TransferBadge";
import { calculatePlayerValue, formatSTC, getValueTier } from "@/lib/playerValue";
import { useTranslation } from "@/hooks/useTranslation";

const CONTRACT_TYPE_LABELS = {
  trial:     { label: "Trial", desc: "Short-term evaluation" },
  academy:   { label: "Academy", desc: "Development squad" },
  squad:     { label: "Squad",  desc: "Regular squad member" },
  important: { label: "Important", desc: "Key squad player" },
  star:      { label: "Star",   desc: "Top team player" },
};

export default function TransferDetailPanel({ entry, canManage, canOffer, canRequestLoan, getOfferBlockReason, onOffer, onRequestLoan, windowOpen }) {
  const { t } = useTranslation();
  if (!entry) {
    return (
      <div className="border border-white/10 bg-[#071018] p-10 text-center flex flex-col items-center justify-center h-full min-h-[220px]">
        <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">{t("commonPages.selectPlayer")}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">{t("commonPages.selectPlayerDetails")}</p>
      </div>
    );
  }

  const { player, badgeType, contract, days_left } = entry;
  const blockReason = getOfferBlockReason?.(player, contract) || null;
  const canOfferPlayer = canManage && !blockReason && (canOffer ? canOffer(player, contract) : true);
  const marketValue = calculatePlayerValue(player);
  const valueTier = getValueTier(marketValue);

  return (
    <div className="overflow-hidden border border-[#f5c542]/20 bg-[#05080f]">
      {/* Top banner — shorter so it doesn't eat into the name */}
      <div className="relative h-8 bg-gradient-to-br from-primary/20 via-secondary to-background">
        <div className="absolute inset-0 fc-stripe opacity-40" />
      </div>

      <div className="px-5 pb-5">
        <div className="mb-1 -mt-5 flex items-end gap-4">
          <div className="relative z-10 h-14 w-14 shrink-0 overflow-hidden rounded-full border-4 border-card bg-secondary shadow-xl">
            {player.avatar_url
              ? <img src={player.avatar_url} alt={player.gamertag} className="w-full h-full object-cover" style={{ objectPosition: player.avatar_position || "50% 50%" }} />
              : <div className="w-full h-full flex items-center justify-center bg-primary/10">
                  <span className="text-xl font-black text-primary">{(player.gamertag || "?")[0].toUpperCase()}</span>
                </div>}
          </div>
        </div>

        {/* Name and badge — fully below the banner overlap zone */}
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-heading font-black text-xl text-foreground uppercase leading-tight">
              {player.gamertag}
            </h2>
            {player.is_verified && <Star className="w-4 h-4 text-warning fill-warning shrink-0" />}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <TransferBadge type={badgeType} daysLeft={days_left} />
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: t("commonPages.position"), value: [player.position, player.secondary_position].filter(Boolean).join(" / ") || "—" },
            { label: t("commonPages.ovr"), value: player.overall_rating || "—" },
            { label: t("commonPages.platform"), value: player.platform || "—" },
          ].map(s => (
            <div key={s.label} className="bg-secondary rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className="font-bold text-foreground text-sm mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Market Value */}
        <div className="flex items-center justify-between bg-secondary/60 rounded-xl px-4 py-2.5 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">{t("commonPages.marketValue")}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-xs font-semibold", valueTier.color)}>{valueTier.label}</span>
            <span className="font-light text-foreground text-sm tracking-tight">{formatSTC(marketValue)}</span>
          </div>
        </div>

        {/* Club / contract info */}
        {blockReason === "signed" ? (
          <div className="bg-secondary rounded-xl p-3 mb-4 flex items-center gap-3">
            <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("commonPages.currentClub")}</p>
              <p className="text-sm font-semibold text-foreground truncate">{t("commonPages.underContract")}</p>
            </div>
            {contract && (
              <div className="ml-auto text-right">
                <p className="text-[10px] text-muted-foreground">{t("commonPages.gamesLeft")}</p>
                <p className="text-sm font-bold text-warning">
                  {Math.max(0, (contract.max_games || 0) - (contract.games_played || 0))}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-success/10 border border-success/20 rounded-xl p-3 mb-4 flex items-center gap-3">
            <Users className="w-4 h-4 text-success shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">{t("commonPages.status")}</p>
              <p className="text-sm font-semibold text-success">{t("commonPages.freeAgentAvailable")}</p>
            </div>
          </div>
        )}

        {/* Bio */}
        {player.bio && (
          <div className="mb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">{t("commonPages.bio")}</p>
            <p className="text-sm text-foreground/80 leading-relaxed">{player.bio}</p>
          </div>
        )}

        {/* Country + win stats */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {[
            { label: t("commonPages.country"), value: player.country || "—" },
            { label: t("commonPages.goals"), value: player.goals ?? 0 },
            { label: t("commonPages.assists"), value: player.assists ?? 0 },
            { label: t("commonPages.matches"), value: player.matches_played ?? 0 },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between px-3 py-2 bg-secondary/60 rounded-lg">
              <span className="text-xs text-muted-foreground">{s.label}</span>
              <span className="text-xs font-bold text-foreground">{s.value}</span>
            </div>
          ))}
        </div>

        {/* Transfer window note */}
        {windowOpen === false && (
          <div className="flex items-start gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-2.5 mb-4 text-xs text-blue-400">
            <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>{t("commonPages.transferWindowClosed")}</span>
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex flex-col gap-2">
          {canOfferPlayer && (
            <Button
              onClick={() => onOffer({ player, badgeType })}
              className="w-full gap-2 rounded-none bg-gradient-to-b from-[#ffe27a] to-[#c9a227] font-heading text-sm font-black uppercase tracking-[0.18em] text-black hover:from-[#fff0a8] hover:to-[#d4ad30]"
            >
              <FileText className="w-4 h-4" />
              {t("commonPages.sendContractOffer")}
            </Button>
          )}
          {canManage && canRequestLoan && (
            <Button
              type="button"
              onClick={() => onRequestLoan?.({ player, badgeType, contract })}
              className="w-full gap-2 rounded-none border border-[#f5c542]/40 bg-transparent font-heading text-sm font-black uppercase tracking-[0.18em] text-[#f5c542] hover:bg-[#f5c542]/10"
            >
              <FileText className="w-4 h-4" />
              {t("commonPages.requestLoan") || "Request Loan"}
            </Button>
          )}
          {blockReason && !canRequestLoan && (
            <div className="w-full text-center py-2.5 rounded-xl bg-muted border border-border text-sm text-muted-foreground font-medium">
              {blockReason === "signed" ? t("commonPages.underContract") : t("commonPages.offerAlreadySent")}
            </div>
          )}
          <Link to={`/players/${player.id}`} className="w-full">
            <Button variant="outline" className="w-full gap-2 border-border">
              <ExternalLink className="w-4 h-4" />
              {t("commonPages.viewFullProfile")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
