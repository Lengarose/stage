import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Clock, ExternalLink, FileText, Search, Shield, Star, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import TransferBadge from "./TransferBadge";
import { calculatePlayerValue, formatSTC, getValueTier } from "@/lib/playerValue";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

const PAGE_SIZE = 8;

function PlayerPortrait({ player, className }) {
  return (
    <div className={cn("overflow-hidden border border-white/10 bg-black/40", className)}>
      {player?.avatar_url ? (
        <img
          src={player.avatar_url}
          alt={player.gamertag || ""}
          className="h-full w-full object-cover"
          style={{ objectPosition: player.avatar_position || "50% 50%" }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_45%_20%,rgba(0,229,255,0.18),rgba(5,8,15,0.92)_58%)]">
          <UserRound className="h-9 w-9 text-white/28" />
        </div>
      )}
    </div>
  );
}

function metricValue(value, fallback = "0") {
  return value === null || value === undefined || value === "" ? fallback : value;
}

function TransferScoutCard({ entry, active, onSelect }) {
  const { player, badgeType, days_left } = entry;
  const ovr = Number(player.overall_rating || 0);

  return (
    <button
      type="button"
      onClick={() => onSelect(entry)}
      className={cn(
        "group relative grid h-[88px] grid-cols-[56px_minmax(0,1fr)_46px] gap-2 overflow-hidden border p-2 text-left transition-all",
        "bg-[linear-gradient(135deg,rgba(10,17,29,0.90),rgba(3,8,13,0.76))]",
        "hover:border-cyan-300/55 hover:bg-[linear-gradient(135deg,rgba(0,229,255,0.13),rgba(245,197,66,0.06),rgba(3,8,13,0.82))]",
        active
          ? "border-cyan-300/70 shadow-[0_0_0_1px_rgba(0,229,255,0.22),0_0_34px_-16px_rgba(0,229,255,0.9)]"
          : "border-white/10 shadow-[0_18px_60px_-46px_rgba(0,229,255,0.6)]"
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(0,229,255,0.16),transparent_34%),radial-gradient(circle_at_85%_88%,rgba(245,197,66,0.10),transparent_38%)] opacity-80" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/55 to-transparent" />

      <PlayerPortrait player={player} className="relative h-[70px] w-14" />

      <div className="relative min-w-0 self-center">
        <div className="mb-1 flex min-w-0 items-center gap-1.5">
          <TransferBadge type={badgeType} daysLeft={days_left} />
          {player.is_verified ? <Star className="h-3.5 w-3.5 shrink-0 fill-[#f5c542] text-[#f5c542]" /> : null}
        </div>
        <p className="truncate text-[9px] uppercase tracking-[0.2em] text-white/38">{player.country || player.platform || "Global"}</p>
        <h3 className="mt-0.5 truncate font-heading text-lg font-black uppercase leading-none text-white">
          {player.gamertag || "Unknown"}
        </h3>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-white/52">
          <span className="font-heading text-xs font-black text-cyan-200">{player.position || "POS"}</span>
          {player.secondary_position ? <span>{player.secondary_position}</span> : null}
          <span className="text-white/18">|</span>
          <span>{metricValue(player.matches_played)} MP</span>
        </div>
      </div>

      <div className="relative flex flex-col items-end justify-between">
        <div className="border border-[#f5c542]/40 bg-[#f5c542] px-2 py-1.5 text-center text-black shadow-[0_0_28px_-14px_rgba(245,197,66,0.9)]">
          <p className="text-[8px] font-black uppercase leading-none">OVR</p>
          <p className="font-heading text-lg font-black leading-none">{ovr || "-"}</p>
        </div>
        <div className="text-right leading-none">
          <p className="text-[8px] uppercase tracking-[0.14em] text-white/35">Form</p>
          <p className="font-heading text-xs font-black text-white">{metricValue(player.avg_match_rating, "0.0")}</p>
        </div>
      </div>
    </button>
  );
}

function DetailMetric({ label, value, accent = "text-white" }) {
  return (
    <div className="border-b border-white/8 py-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-white/45">{label}</span>
        <span className={cn("text-xs font-semibold", accent)}>{value}</span>
      </div>
    </div>
  );
}

export default function TransferScoutBoard({
  entries,
  selected,
  onSelect,
  canManage,
  canOffer,
  canRequestLoan,
  getOfferBlockReason,
  onOffer,
  onRequestLoan,
  windowOpen,
}) {
  const { t } = useTranslation();
  const tx = (key, fallback) => {
    const value = t(key);
    return value && value !== key ? value : fallback;
  };
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageEntries = useMemo(() => {
    const start = safePage * PAGE_SIZE;
    return entries.slice(start, start + PAGE_SIZE);
  }, [entries, safePage]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  useEffect(() => {
    if (!pageEntries.length) return;
    const selectedOnPage = selected && pageEntries.some((item) => item.player.id === selected.player.id);
    if (!selectedOnPage) onSelect(pageEntries[0]);
  }, [onSelect, pageEntries, selected]);

  if (!entries.length) {
    return (
      <div className="grid min-h-[360px] place-items-center border border-white/10 bg-black/35 text-center">
        <div>
          <Search className="mx-auto mb-3 h-10 w-10 text-cyan-200/30" />
          <p className="font-heading text-sm font-black uppercase tracking-[0.22em] text-white/55">{t("competitionFlow.noPlayersFound")}</p>
          <p className="mt-2 text-xs text-white/35">{t("commonPages.tryAdjustingFilters")}</p>
        </div>
      </div>
    );
  }

  const entry = selected || pageEntries[0] || entries[0];
  const player = entry?.player || {};
  const marketValue = calculatePlayerValue(player);
  const valueTier = getValueTier(marketValue);
  const blockReason = getOfferBlockReason?.(player, entry?.contract) || null;
  const canOfferPlayer = canManage && !blockReason && (canOffer ? canOffer(player, entry?.contract) : true);

  return (
    <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)] xl:grid-cols-[minmax(0,1fr)_430px]">
      <section className="flex min-h-0 flex-col overflow-hidden border border-white/10 bg-black/32 backdrop-blur-sm">
        <div className="shrink-0 flex items-center justify-between border-b border-white/10 px-3 py-2">
          <div>
            <p className="font-heading text-sm font-black uppercase tracking-[0.2em] text-white">Scout List</p>
            <p className="text-xs text-white/42">First team quality, backups and expiring targets</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-cyan-200">{entries.length} reports</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/35">Page {safePage + 1} / {pageCount}</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="grid gap-2">
          <div className="grid gap-2 md:grid-cols-2">
          {pageEntries.map((item) => (
            <TransferScoutCard
              key={`${item.player.id}-${item.badgeType}-${item.contract?.id || "free"}`}
              entry={item}
              active={entry?.player?.id === item.player.id}
              onSelect={onSelect}
            />
          ))}
          </div>
          <div className="flex items-center justify-between border-t border-white/10 pt-2">
            <Button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              className="h-8 rounded-none border border-white/10 bg-white/[0.035] px-3 font-heading text-[11px] font-black uppercase tracking-[0.14em] text-white/70 hover:bg-white/10 disabled:opacity-35"
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(pageCount, 7) }).map((_, index) => {
                let pageIndex = index;
                if (pageCount > 7) {
                  const start = Math.min(Math.max(safePage - 3, 0), pageCount - 7);
                  pageIndex = start + index;
                }
                return (
                  <button
                    key={pageIndex}
                    type="button"
                    onClick={() => setPage(pageIndex)}
                    className={cn(
                      "h-2.5 w-2.5 border border-cyan-200/25 transition-all",
                      pageIndex === safePage ? "bg-[#f5c542] shadow-[0_0_16px_rgba(245,197,66,0.6)]" : "bg-white/10 hover:bg-cyan-200/45"
                    )}
                    aria-label={`Go to page ${pageIndex + 1}`}
                  />
                );
              })}
            </div>
            <Button
              type="button"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
              className="h-8 rounded-none border border-cyan-300/20 bg-cyan-300/10 px-3 font-heading text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100 hover:bg-cyan-300/18 disabled:opacity-35"
            >
              Next
            </Button>
          </div>
          </div>
        </div>
      </section>

      <aside className="min-h-0 overflow-y-auto overflow-x-hidden border border-cyan-300/20 bg-[linear-gradient(145deg,rgba(12,18,31,0.90),rgba(6,10,16,0.88))] shadow-[0_24px_90px_-58px_rgba(0,229,255,0.85)] backdrop-blur-sm">
        <div className="relative overflow-hidden border-b border-white/10 p-3">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(0,229,255,0.17),transparent_34%),radial-gradient(circle_at_94%_8%,rgba(245,197,66,0.14),transparent_28%)]" />
          <div className="relative grid min-w-0 grid-cols-[72px_minmax(0,1fr)_64px] gap-3">
            <PlayerPortrait player={player} className="h-[72px] w-[72px]" />
            <div className="min-w-0 self-center">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <TransferBadge type={entry.badgeType} daysLeft={entry.days_left} />
                {player.is_verified ? <Star className="h-4 w-4 fill-[#f5c542] text-[#f5c542]" /> : null}
              </div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/38">
                {[player.position, player.secondary_position].filter(Boolean).join(" / ") || "Unknown role"}
              </p>
              <h2 className="mt-1 truncate font-heading text-2xl font-black uppercase leading-none text-white">
                {player.gamertag || "Unknown"}
              </h2>
            </div>
            <div className="min-w-0 self-start border border-[#f5c542]/45 bg-[#f5c542] p-2.5 text-center text-black">
              <p className="text-[9px] font-black uppercase leading-none">OVR</p>
              <p className="font-heading text-2xl font-black leading-none">{player.overall_rating || "-"}</p>
            </div>
          </div>
        </div>

        <div className="p-3">
          <div className="mb-3 grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="min-w-0 overflow-hidden border border-white/10 bg-white/[0.035] p-2.5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/38">{t("commonPages.marketValue")}</p>
              <p className="mt-1 font-heading text-lg font-black text-[#f5c542]">{formatSTC(marketValue)}</p>
              <p className={cn("mt-0.5 text-xs font-semibold", valueTier.color)}>{valueTier.label}</p>
            </div>
            <div className="min-w-0 overflow-hidden border border-white/10 bg-white/[0.035] p-2.5">
              <p className="text-[10px] uppercase tracking-[0.22em] text-white/38">{t("commonPages.status")}</p>
              <p className="mt-1 break-words font-heading text-base font-black leading-tight text-cyan-200 xl:text-lg">
                {blockReason === "signed" ? t("commonPages.underContract") : t("commonPages.freeAgentAvailable")}
              </p>
            </div>
          </div>

          <div className="mb-3 grid min-w-0 gap-x-5 md:grid-cols-2">
            <div className="min-w-0">
              <p className="mb-1 font-heading text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Summary</p>
              <DetailMetric label={t("commonPages.platform")} value={player.platform || "-"} />
              <DetailMetric label={t("commonPages.country")} value={player.country || "-"} />
              <DetailMetric label={t("commonPages.matches")} value={metricValue(player.matches_played)} />
              <DetailMetric label={t("commonPages.goals")} value={metricValue(player.goals)} accent="text-emerald-300" />
              <DetailMetric label={t("commonPages.assists")} value={metricValue(player.assists)} accent="text-cyan-200" />
            </div>
            <div className="min-w-0">
              <p className="mb-1 font-heading text-xs font-black uppercase tracking-[0.2em] text-[#f5c542]">Report</p>
              <DetailMetric label="Average rating" value={metricValue(player.avg_match_rating, "0.0")} />
              <DetailMetric label="Clean sheets" value={metricValue(player.clean_sheets)} />
              <DetailMetric label="MOTM" value={metricValue(player.man_of_the_match)} />
              <DetailMetric label="Games left" value={entry.contract ? Math.max(0, (entry.contract.max_games || 0) - (entry.contract.games_played || 0)) : "-"} />
              <DetailMetric label="Scout completion" value={blockReason === "signed" ? "72%" : "100%"} accent={blockReason === "signed" ? "text-[#f5c542]" : "text-emerald-300"} />
            </div>
          </div>

          {player.bio ? (
            <div className="mb-3 border border-white/10 bg-black/25 p-3">
              <p className="mb-2 font-heading text-xs font-black uppercase tracking-[0.2em] text-white/58">{t("commonPages.bio")}</p>
              <p className="text-sm leading-relaxed text-white/68">{player.bio}</p>
            </div>
          ) : null}

          {windowOpen === false ? (
            <div className="mb-3 flex items-start gap-2 border border-cyan-300/20 bg-cyan-300/8 px-3 py-2 text-xs text-cyan-100/70">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t("commonPages.transferWindowClosed")}</span>
            </div>
          ) : null}

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            {canOfferPlayer ? (
              <Button
                type="button"
                onClick={() => onOffer({ player, badgeType: entry.badgeType })}
                className="h-9 flex-1 gap-2 rounded-none bg-gradient-to-b from-[#ffe27a] to-[#c9a227] font-heading text-[11px] font-black uppercase tracking-[0.14em] text-black hover:from-[#fff0a8] hover:to-[#d4ad30]"
              >
                <FileText className="h-4 w-4" />
                {t("commonPages.sendContractOffer")}
              </Button>
            ) : (
              <div className="flex h-9 flex-1 items-center justify-center gap-2 border border-white/10 bg-white/[0.035] px-3 font-heading text-[11px] font-black uppercase tracking-[0.14em] text-white/48">
                <Shield className="h-4 w-4" />
                {blockReason === "signed" ? t("commonPages.underContract") : t("commonPages.offerAlreadySent")}
              </div>
            )}
            {canManage && canRequestLoan ? (
              <Button
                type="button"
                onClick={() => onRequestLoan?.({ player, badgeType: entry.badgeType, contract: entry.contract })}
                className="h-9 flex-1 gap-2 rounded-none border border-cyan-300/35 bg-transparent font-heading text-[11px] font-black uppercase tracking-[0.14em] text-cyan-200 hover:bg-cyan-300/10"
              >
                <BarChart3 className="h-4 w-4" />
                {tx("commonPages.requestLoan", "Request Loan")}
              </Button>
            ) : null}
            <Link to={`/players/${player.id}`} className="sm:w-auto">
              <Button type="button" variant="outline" className="h-9 w-full rounded-none border-white/16 bg-transparent px-3 text-white/72 hover:bg-white/8">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
