import MatchupBackdrop from "./MatchupBackdrop";
import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "@/lib/momentDate";
import { Trophy, AlertTriangle, FileText } from "lucide-react";
import SchedulePortrait from "./SchedulePortrait";
import { Link } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";
import {penaltyOutcome, isOfficialDisplayResult} from '@/lib/penaltyOutcome';

function fmtDate(d) {
  if (!d) return "—";
  const parsed = typeof d === "string" ? parseISO(d) : new Date(d);
  if (!isValid(parsed)) return "—";
  return format(parsed, "EEEE d MMMM yyyy · HH:mm");
}

const OUTCOME_STYLE = {
  W: "bg-success/15 text-success border-success/30",
  L: "bg-destructive/15 text-destructive border-destructive/30",
  D: "bg-warning/15 text-warning border-warning/30",
};

export default function MatchDetail({ event, myPlayer, myClub }) {
  const { t } = useTranslation();
  if (!event) {
    return (
      <div className="bg-card border border-border rounded-none p-8 flex flex-col items-center justify-center gap-3 text-center min-h-[620px]">
        <Trophy className="w-8 h-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("matchFlow.selectMatchDetails")}</p>
      </div>
    );
  }

  if (event.type === "contract_reminder") return <ContractReminderDetail event={event} />;
  if (event.type === "contract_end") return <ContractEndDetail event={event} />;
  if (event.type === "tournament_start") return <TournamentStartDetail event={event} />;

  const m = event.matchData || event.fixtureData;
  if (!m) return null;
  const tournament = event.tournament;
  const stats = event.playerStats;

  const homeScore = m.home_score ?? 0;
  const awayScore = m.away_score ?? 0;
  const completed = isOfficialDisplayResult(m) || m.status === "awaiting_confirmation";

  return (
    <div className="min-h-[620px] bg-card border border-border rounded-none overflow-hidden">
      {/* Competition bar */}
      <div className="px-4 py-2.5 bg-secondary/60 border-b border-border flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{event.competition}</span>
        <StatusBadge status={m.status} />
      </div>

      {/* Large portraits, followed by the stacked fixture names. */}
      <div className="agenda-matchup-panel relative isolate overflow-hidden px-5 py-8 sm:px-6">
        <MatchupBackdrop event={event} detail />
        <div className="flex items-center justify-between gap-3">
          <SchedulePortrait image={event.homeAvatarUrl} photo={event.homePhoto} className="w-16 sm:w-20" />
          <div className="flex min-w-0 flex-col items-center gap-2">
            {completed ? <>
              <div aria-label={`${homeScore} – ${awayScore}`} className="flex items-center gap-2 font-heading text-4xl font-bold tracking-wide text-foreground">
                <span className="font-heading">{homeScore}</span><span aria-hidden="true" className="h-[3px] w-4 shrink-0 bg-current opacity-80" /><span className="font-heading">{awayScore}</span>
              </div>
              {event.result && <span className={cn("rounded-none border px-2 py-1 text-xs font-bold", OUTCOME_STYLE[event.result.outcome])}>
                {event.result.outcome === "W" ? t("matchFlow.win") : event.result.outcome === "L" ? t("matchFlow.loss") : t("matchFlow.draw")}
              </span>}
            </> : <span className="text-xs text-muted-foreground">{t("matchFlow.versus")}</span>}
          </div>
          <SchedulePortrait image={event.awayAvatarUrl} photo={event.awayPhoto} className="w-16 sm:w-20" />
        </div>
        <h2 className="mt-7 flex min-w-0 flex-col items-start gap-2 font-heading text-3xl font-bold leading-tight text-foreground [overflow-wrap:anywhere] sm:text-4xl">
          <span>{event.homeName || m.home_club_name || m.home_player_name || t("matchFlow.tbd")}</span>
          <span className="block">
            <span className="mr-2 font-sans text-xs font-normal lowercase text-muted-foreground">{t("matchFlow.versus")}</span>
            {event.awayName || m.away_club_name || m.away_player_name || t("matchFlow.tbd")}
          </span>
        </h2>
      </div>

      {/* Info rows */}
      {penaltyOutcome(m)&&<p className="p-3 text-xs text-primary">{penaltyOutcome(m)}</p>}
      <div className="border-t border-border divide-y divide-border">
        <InfoRow label={t("matchFlow.dateTime")} value={fmtDate(event.date)} />
        <InfoRow label={t("matchFlow.venue")} value={event.venue} />
        <InfoRow label={t("matchFlow.round")} value={m.round ? t("matchFlow.roundValue", { round: m.round }) : "—"} />
        {m.video_url && (
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">{t("matchFlow.matchVideo")}</span>
            <a href={m.video_url} target="_blank" rel="noreferrer" className="text-primary underline">{t("matchFlow.watch")}</a>
          </div>
        )}
        {tournament && (
          <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">{t("matchFlow.tournament")}</span>
            <Link to={`/tournaments/${tournament.id}`} className="text-primary hover:underline truncate max-w-[160px]">{tournament.name}</Link>
          </div>
        )}
      </div>

      {event.competitionHref && <div className="border-t border-border px-4 py-3"><Link className="inline-flex min-h-11 items-center text-sm font-semibold text-orange-600 dark:text-orange-300" to={event.competitionHref}>Open Regional Cup →</Link></div>}
      {event.matchData?.id && <div className="border-t border-border p-4"><Link to={`/game-day?match=${encodeURIComponent(event.matchData.id)}`} className="flex min-h-11 items-center justify-between rounded-none border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-foreground hover:bg-primary/20">{t("matchFlow.agendaOpenGameDay", "Open GameDay")}<span aria-hidden="true">→</span></Link></div>}
      {/* Player rating & stats */}
      {stats && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">{t("matchFlow.yourPerformance")}</p>
          <div className="grid grid-cols-3 gap-2">
            <StatMini label={t("matchFlow.rating")} value={Number.isFinite(Number(stats.rating)) ? Number(stats.rating).toFixed(1) : "—"} highlight />
            <StatMini label={t("matchFlow.goals")} value={stats.goals ?? 0} />
            <StatMini label={t("matchFlow.assists")} value={stats.assists ?? 0} />
          </div>
        </div>
      )}

      {m.notes && (() => {
        // notes field may contain raw JSON used internally — only show plain human text
        let displayNotes = null;
        try {
          const parsed = JSON.parse(m.notes);
          // It's internal system JSON (reminders, stats, etc.) — suppress it
          if (typeof parsed === "object") displayNotes = null;
          else displayNotes = String(parsed);
        } catch {
          // Not JSON — safe to show as plain text if it looks human-readable
          const trimmed = m.notes.trim();
          if (trimmed && !trimmed.startsWith("{") && !trimmed.startsWith("[")) {
            displayNotes = trimmed;
          }
        }
        return displayNotes ? (
          <div className="border-t border-border px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{t("matchFlow.notes")}</p>
            <p className="text-xs text-foreground">{displayNotes}</p>
          </div>
        ) : null;
      })()}
    </div>
  );
}

function StatusBadge({ status }) {
  const { t } = useTranslation();
  const map = {
    scheduled: ["scheduled", "text-primary"],
    in_progress: ["live", "text-success"],
    awaiting_confirmation: ["pendingConfirm", "text-warning"],
    disputed: ["disputed", "text-destructive"],
    completed: ["fullTime", "text-muted-foreground"],
    forfeit: ["forfeit", "text-destructive"],
  };
  const [key, cls] = map[status] || [status, "text-muted-foreground"];
  return <span className={cn("text-[10px] font-semibold uppercase tracking-wider", cls)}>{map[status] ? t(`matchFlow.${key}`) : key}</span>;
}

function InfoRow({ label, value }) {
  return (
    <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-foreground font-medium text-right">{value || "—"}</span>
    </div>
  );
}

function StatMini({ label, value, highlight }) {
  return (
    <div className={cn("rounded-none p-2 text-center border", highlight ? "bg-primary/10 border-primary/20" : "bg-secondary border-border")}>
      <p className={cn("font-bold text-base", highlight ? "text-primary" : "text-foreground")}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function TournamentStartDetail({ event }) {
  const { t } = useTranslation();
  const tournament = event.tournamentData;
  if (!tournament) return null;
  const startLabel = tournament.start_date ? fmtDate(tournament.start_date) : "—";
  const now = new Date();
  const startDate = tournament.start_date ? new Date(tournament.start_date) : null;
  const diffDays = startDate ? Math.ceil((startDate - now) / (1000 * 60 * 60 * 24)) : null;
  return (
    <div className="bg-card border border-accent/30 rounded-none overflow-hidden">
      <div className="px-4 py-2.5 bg-accent/10 border-b border-accent/20 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-accent" />
        <span className="text-xs font-semibold text-accent uppercase tracking-wider">{t("matchFlow.tournamentStart")}</span>
      </div>
      <div className="p-5 space-y-4">
        <p className="font-heading text-lg font-bold text-foreground">{tournament.name}</p>
        <div className="divide-y divide-border">
          <InfoRow label={t("matchFlow.startDate")} value={startLabel} />
          <InfoRow label={t("matchFlow.platform")} value={tournament.platform} />
          <InfoRow label={t("matchFlow.region")} value={tournament.region} />
          <InfoRow label={t("matchFlow.type")} value={tournament.type} />
          <InfoRow label={t("matchFlow.maxTeams")} value={tournament.max_teams} />
          {diffDays !== null && diffDays > 0 && (
            <InfoRow label={t("matchFlow.countdown")} value={t("matchFlow.inDays", { count: diffDays })} />
          )}
          {diffDays === 0 && <InfoRow label={t("matchFlow.countdown")} value={t("matchFlow.today")} />}
        </div>
        {tournament.id && (
          <a
            href={`/tournaments/${tournament.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Trophy className="w-3 h-3" /> {t("matchFlow.viewTournament")}
          </a>
        )}
      </div>
    </div>
  );
}

function ContractReminderDetail({ event }) {
  const { t } = useTranslation();
  const c = event.contractData;
  return (
    <div className="bg-card border border-warning/30 rounded-none overflow-hidden">
      <div className="px-4 py-2.5 bg-warning/10 border-b border-warning/20 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <span className="text-xs font-semibold text-warning uppercase tracking-wider">{t("matchFlow.contractExpiringSoon")}</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="divide-y divide-border">
          <InfoRow label={t("matchFlow.type")} value={c?.contract_type} />
          <InfoRow label={t("matchFlow.gamesLeft")} value={event.gamesLeft !== null ? t("matchFlow.gamesUnit", { count: event.gamesLeft }) : "—"} />
          <InfoRow label={t("matchFlow.daysLeft")} value={event.daysLeft !== null ? t("matchFlow.daysUnit", { count: event.daysLeft }) : "—"} />
          <InfoRow label={t("matchFlow.endDate")} value={c?.end_date || "—"} />
        </div>
        <p className="text-xs text-muted-foreground">{t("matchFlow.contractExpiringMessage")}</p>
      </div>
    </div>
  );
}

function ContractEndDetail({ event }) {
  const { t } = useTranslation();
  const c = event.contractData;
  return (
    <div className="bg-card border border-border rounded-none overflow-hidden">
      <div className="px-4 py-2.5 bg-secondary/60 border-b border-border flex items-center gap-2">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("matchFlow.contractEndDate")}</span>
      </div>
      <div className="p-5">
        <div className="divide-y divide-border">
          <InfoRow label={t("matchFlow.contractType")} value={c?.contract_type} />
          <InfoRow label={t("matchFlow.maxGames")} value={c?.max_games} />
          <InfoRow label={t("matchFlow.gamesPlayed")} value={c?.games_played ?? 0} />
          <InfoRow label={t("matchFlow.endDate")} value={c?.end_date || "—"} />
        </div>
      </div>
    </div>
  );
}
