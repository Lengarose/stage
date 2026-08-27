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
        "flex w-full min-w-[246px] max-w-none shrink-0 items-center gap-3 border px-4 py-2.5 text-left transition-all",
        selected
          ? "border-[#f8fbff] bg-gradient-to-r from-white/22 via-[#18202b] to-black shadow-[0_0_24px_rgba(238,243,251,0.24)]"
          : "border-white/12 bg-gradient-to-r from-[#151b25]/76 via-black/45 to-[#101723]/80 hover:border-[#f8fbff]/55 hover:bg-white/10",
      )}
    >
      <div className="flex items-center -space-x-2">
        <GameDayCrest name={home} imageUrl={homeLogo} size="sm" />
        <GameDayCrest name={away} imageUrl={awayLogo} size="sm" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-heading text-[11px] font-black uppercase tracking-wide text-white">
          {home} <span className="text-[#f8fbff]">vs</span> {away}
        </p>
        <p className="mt-0.5 truncate text-[10px] uppercase tracking-[0.16em] text-white/45">
          {date ? `${format(date, "EEE HH:mm")} · ` : ""}
          {status.key ? t(`matchFlow.${status.key}`) : status.label}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {live || game.home_stream_url || game.away_stream_url ? (
          <Radio className="h-3 w-3 text-[#8eeeff] motion-safe:animate-pulse" />
        ) : null}
        {isMyClubInvolved ? (
          <span className="text-[8px] font-black uppercase tracking-widest text-[#f8fbff]">{t("matchFlow.yourClub")}</span>
        ) : (
          <span className="max-w-[72px] truncate text-[8px] uppercase tracking-widest text-white/35">{competition}</span>
        )}
      </div>
    </button>
  );
}
