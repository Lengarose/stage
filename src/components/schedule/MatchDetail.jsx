import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "@/lib/momentDate";
import { Shield, Trophy, AlertTriangle, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "@/hooks/useTranslation";

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
      <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center min-h-[260px]">
        <Trophy className="w-8 h-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("matchFlow.selectMatchDetails")}</p>
      </div>
    );
  }

  if (event.type === "contract_reminder") return <ContractReminderDetail event={event} />;
  if (event.type === "contract_end") return <ContractEndDetail event={event} />;
  if (event.type === "tournament_start") return <TournamentStartDetail event={event} />;

  const m = event.matchData;
  if (!m) return null;
  const tournament = event.tournament;
  const stats = event.playerStats;

  const homeScore = m.home_score ?? 0;
  const awayScore = m.away_score ?? 0;
  const completed = m.status === "completed" || m.status === "awaiting_confirmation" || m.status === "forfeit";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Competition bar */}
      <div className="px-4 py-2.5 bg-secondary/60 border-b border-border flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{event.competition}</span>
        <StatusBadge status={m.status} />
      </div>

      {/* Score section */}
      <div className="px-5 py-6">
        <div className="flex items-center justify-between gap-3">
          {/* Home */}
          <TeamBlock name={m.home_club_name || m.home_player_name} avatarUrl={event.homeAvatarUrl} isHome />
          {/* Score */}
          <div className="flex flex-col items-center shrink-0">
            {completed ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-4xl font-bold text-foreground">{homeScore}</span>
                  <span className="text-muted-foreground text-xl">–</span>
                  <span className="font-heading text-4xl font-bold text-foreground">{awayScore}</span>
                </div>
                {event.result && (
                  <span className={cn("mt-1.5 text-xs font-bold px-3 py-0.5 rounded border", OUTCOME_STYLE[event.result.outcome])}>
                    {event.result.outcome === "W" ? t("matchFlow.win") : event.result.outcome === "L" ? t("matchFlow.loss") : t("matchFlow.draw")}
                  </span>
                )}
              </>
            ) : (
              <div className="text-center">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{m.status === "scheduled" ? t("matchFlow.versus") : m.status}</span>
              </div>
            )}
          </div>
          {/* Away */}
          <TeamBlock name={m.away_club_name || m.away_player_name} avatarUrl={event.awayAvatarUrl} />
        </div>
      </div>

      {/* Info rows */}
      <div className="border-t border-border divide-y divide-border">
        <InfoRow label={t("matchFlow.dateTime")} value={fmtDate(m.scheduled_date)} />
        <InfoRow label={t("matchFlow.venue")} value={event.venue} />
        <InfoRow label={t("matchFlow.round")} value={m.round ? t("matchFlow.roundValue", { round: m.round }) : "—"} />
        {m.video_url && (
          <div className="px-4 py-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">{t("matchFlow.matchVideo")}</span>
            <a href={m.video_url} target="_blank" rel="noreferrer" className="text-primary underline">{t("matchFlow.watch")}</a>
          </div>
        )}
        {tournament && (
          <div className="px-4 py-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">{t("matchFlow.tournament")}</span>
            <Link to={`/tournaments/${tournament.id}`} className="text-primary hover:underline truncate max-w-[160px]">{tournament.name}</Link>
          </div>
        )}
      </div>

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

function TeamBlock({ name, avatarUrl, isHome }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
        {avatarUrl
          ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
          : <Shield className="w-5 h-5 text-muted-foreground" />
        }
      </div>
      <span className="text-xs font-semibold text-foreground text-center leading-tight truncate w-full text-center">
        {name || t("matchFlow.tbd")}
      </span>
      {isHome && <span className="text-[9px] uppercase tracking-widest text-primary">{t("matchFlow.home")}</span>}
      {!isHome && <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{t("matchFlow.away")}</span>}
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
    <div className="px-4 py-3 flex items-center justify-between text-xs">
      <span className="text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-foreground font-medium text-right">{value || "—"}</span>
    </div>
  );
}

function StatMini({ label, value, highlight }) {
  return (
    <div className={cn("rounded-lg p-2 text-center border", highlight ? "bg-primary/10 border-primary/20" : "bg-secondary border-border")}>
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
    <div className="bg-card border border-accent/30 rounded-xl overflow-hidden">
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
    <div className="bg-card border border-warning/30 rounded-xl overflow-hidden">
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
    <div className="bg-card border border-border rounded-xl overflow-hidden">
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
