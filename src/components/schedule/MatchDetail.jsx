import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { Shield, User, Trophy, AlertTriangle, FileText, Star } from "lucide-react";
import { Link } from "react-router-dom";

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
  if (!event) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center min-h-[260px]">
        <Trophy className="w-8 h-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Select a match to see details</p>
      </div>
    );
  }

  if (event.type === "contract_reminder") return <ContractReminderDetail event={event} />;
  if (event.type === "contract_end") return <ContractEndDetail event={event} />;
  if (event.type === "tournament_start") return <TournamentStartDetail event={event} />;

  const m = event.matchData;
  if (!m) return null;
  const t = event.tournament;
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
                    {event.result.outcome === "W" ? "WIN" : event.result.outcome === "L" ? "LOSS" : "DRAW"}
                  </span>
                )}
              </>
            ) : (
              <div className="text-center">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{m.status === "scheduled" ? "vs" : m.status}</span>
              </div>
            )}
          </div>
          {/* Away */}
          <TeamBlock name={m.away_club_name || m.away_player_name} avatarUrl={event.awayAvatarUrl} />
        </div>
      </div>

      {/* Info rows */}
      <div className="border-t border-border divide-y divide-border">
        <InfoRow label="Date & Time" value={fmtDate(m.scheduled_date)} />
        <InfoRow label="Venue" value={event.venue} />
        <InfoRow label="Round" value={m.round ? `Round ${m.round}` : "—"} />
        {m.video_url && (
          <div className="px-4 py-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">Match Video</span>
            <a href={m.video_url} target="_blank" rel="noreferrer" className="text-primary underline">Watch</a>
          </div>
        )}
        {t && (
          <div className="px-4 py-3 flex items-center justify-between text-xs">
            <span className="text-muted-foreground uppercase tracking-wider">Tournament</span>
            <Link to={`/tournaments/${t.id}`} className="text-primary hover:underline truncate max-w-[160px]">{t.name}</Link>
          </div>
        )}
      </div>

      {/* Player rating & stats */}
      {stats && (
        <div className="border-t border-border px-4 py-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Your Performance</p>
          <div className="grid grid-cols-3 gap-2">
            <StatMini label="Rating" value={stats.rating?.toFixed(1) ?? "—"} highlight />
            <StatMini label="Goals" value={stats.goals ?? 0} />
            <StatMini label="Assists" value={stats.assists ?? 0} />
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
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Notes</p>
            <p className="text-xs text-foreground">{displayNotes}</p>
          </div>
        ) : null;
      })()}
    </div>
  );
}

function TeamBlock({ name, avatarUrl, isHome }) {
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
      <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
        {avatarUrl
          ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
          : <Shield className="w-5 h-5 text-muted-foreground" />
        }
      </div>
      <span className="text-xs font-semibold text-foreground text-center leading-tight truncate w-full text-center">
        {name || "TBD"}
      </span>
      {isHome && <span className="text-[9px] uppercase tracking-widest text-primary">Home</span>}
      {!isHome && <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Away</span>}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    scheduled: ["Scheduled", "text-primary"],
    in_progress: ["Live", "text-success"],
    awaiting_confirmation: ["Pending Confirm", "text-warning"],
    disputed: ["Disputed", "text-destructive"],
    completed: ["Full Time", "text-muted-foreground"],
    forfeit: ["Forfeit", "text-destructive"],
  };
  const [label, cls] = map[status] || [status, "text-muted-foreground"];
  return <span className={cn("text-[10px] font-semibold uppercase tracking-wider", cls)}>{label}</span>;
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
  const t = event.tournamentData;
  if (!t) return null;
  const startLabel = t.start_date ? fmtDate(t.start_date) : "—";
  const now = new Date();
  const startDate = t.start_date ? new Date(t.start_date) : null;
  const diffDays = startDate ? Math.ceil((startDate - now) / (1000 * 60 * 60 * 24)) : null;
  return (
    <div className="bg-card border border-accent/30 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-accent/10 border-b border-accent/20 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-accent" />
        <span className="text-xs font-semibold text-accent uppercase tracking-wider">Tournament Start</span>
      </div>
      <div className="p-5 space-y-4">
        <p className="font-heading text-lg font-bold text-foreground">{t.name}</p>
        <div className="divide-y divide-border">
          <InfoRow label="Start Date" value={startLabel} />
          <InfoRow label="Platform" value={t.platform} />
          <InfoRow label="Region" value={t.region} />
          <InfoRow label="Type" value={t.type} />
          <InfoRow label="Max Teams" value={t.max_teams} />
          {diffDays !== null && diffDays > 0 && (
            <InfoRow label="Countdown" value={`In ${diffDays} day${diffDays !== 1 ? "s" : ""}`} />
          )}
          {diffDays === 0 && <InfoRow label="Countdown" value="Today!" />}
        </div>
        {t.id && (
          <a
            href={`/tournaments/${t.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Trophy className="w-3 h-3" /> View Tournament
          </a>
        )}
      </div>
    </div>
  );
}

function ContractReminderDetail({ event }) {
  const c = event.contractData;
  return (
    <div className="bg-card border border-warning/30 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-warning/10 border-b border-warning/20 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <span className="text-xs font-semibold text-warning uppercase tracking-wider">Contract Expiring Soon</span>
      </div>
      <div className="p-5 space-y-4">
        <div className="divide-y divide-border">
          <InfoRow label="Type" value={c?.contract_type} />
          <InfoRow label="Games Left" value={event.gamesLeft !== null ? `${event.gamesLeft} games` : "—"} />
          <InfoRow label="Days Left" value={event.daysLeft !== null ? `${event.daysLeft} days` : "—"} />
          <InfoRow label="End Date" value={c?.end_date || "—"} />
        </div>
        <p className="text-xs text-muted-foreground">Your contract is close to expiring. Contact your club captain or president to renew.</p>
      </div>
    </div>
  );
}

function ContractEndDetail({ event }) {
  const c = event.contractData;
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 bg-secondary/60 border-b border-border flex items-center gap-2">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contract End Date</span>
      </div>
      <div className="p-5">
        <div className="divide-y divide-border">
          <InfoRow label="Contract Type" value={c?.contract_type} />
          <InfoRow label="Max Games" value={c?.max_games} />
          <InfoRow label="Games Played" value={c?.games_played ?? 0} />
          <InfoRow label="End Date" value={c?.end_date || "—"} />
        </div>
      </div>
    </div>
  );
}