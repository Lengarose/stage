import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "@/lib/momentDate";
import { Radio } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { getMatchSideNames } from "@/lib/gameDayPresentation";
import GameDayCrest from "./GameDayCrest";

function parseDate(d) {
  if (!d) return null;
  const p = typeof d === "string" ? parseISO(d) : new Date(d);
  return isValid(p) ? p : null;
}

const STATUS_BADGE = {
  scheduled: { key: "scheduled" },
  in_progress: { key: "live" },
  awaiting_confirmation: { key: "pending" },
};

export default function GameDayCard({ game, selected, onClick, myClub, _myPlayer, tournament }) {
  const { t } = useTranslation();
  const date = parseDate(game.scheduled_date);
  const status = STATUS_BADGE[game.status] || { label: game.status };
  const { home, away, isClub } = getMatchSideNames(game, t("matchFlow.tbd"));
  const isMyClubInvolved = myClub && (game.home_club_id === myClub.id || game.away_club_id === myClub.id);
  const homeLogo = isClub && myClub && game.home_club_id === myClub.id ? myClub.logo_url : null;
  const awayLogo = isClub && myClub && game.away_club_id === myClub.id ? myClub.logo_url : null;

  function deriveCompetition(match, tournament) {
    if (!match.tournament_id || match.tournament_id === "ranked") return t("matchFlow.rankedMatch");
    if (!tournament) return t("matchFlow.tournament");
    if (tournament.type === "knockout") return `${tournament.name} · ${t("matchFlow.knockout")}`;
    if (tournament.type === "league") return `${tournament.name} · ${t("matchFlow.leagueFormat")}`;
    if (tournament.type === "group_stage") return `${tournament.name} · ${t("matchFlow.groupStage")}`;
    if (tournament.type === "swiss" || tournament.type === "swiss_ucl") return `${tournament.name} · ${t("matchFlow.swiss")}`;
    if (tournament.type === "double_elimination") return `${tournament.name} · ${t("matchFlow.doubleElim")}`;
    return tournament.name || t("matchFlow.tournament");
  }
  const competition = game.competition_context || deriveCompetition(game, tournament);
  const live = game.status === "in_progress";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-[246px] max-w-[330px] shrink-0 items-center gap-3 border px-4 py-2.5 text-left transition-all [clip-path:polygon(14px_0,100%_0,calc(100%_-_14px)_100%,0_100%)]",
        selected
          ? "border-[#f5c542] bg-gradient-to-r from-[#f5c542]/20 via-[#0a1628] to-black shadow-[0_0_22px_rgba(245,197,66,0.22)]"
          : "border-[#00e5ff]/20 bg-gradient-to-r from-[#071827]/70 via-black/50 to-[#06111d]/80 hover:border-[#00e5ff]/60 hover:bg-[#00e5ff]/10",
      )}
    >
      <div className="flex items-center -space-x-2">
        <GameDayCrest name={home} imageUrl={homeLogo} size="sm" />
        <GameDayCrest name={away} imageUrl={awayLogo} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-[11px] font-black uppercase tracking-wide text-white">
          {home} <span className="text-[#f5c542]">vs</span> {away}
        </p>
        <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.16em] text-white/45">
          {date ? `${format(date, "EEE HH:mm")} · ` : ""}
          {status.key ? t(`matchFlow.${status.key}`) : status.label}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {live || game.home_stream_url || game.away_stream_url ? (
          <Radio className="h-3 w-3 text-[#00e5ff] motion-safe:animate-pulse" />
        ) : null}
        {isMyClubInvolved ? (
          <span className="text-[8px] font-black uppercase tracking-widest text-[#f5c542]">{t("matchFlow.yourClub")}</span>
        ) : (
          <span className="max-w-[72px] truncate text-[8px] uppercase tracking-widest text-white/35">{competition}</span>
        )}
      </div>
    </button>
  );
}
