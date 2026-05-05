import { cn } from "@/lib/utils";
import { format, parseISO, isValid } from "date-fns";
import { Shield, Trophy, Radio } from "lucide-react";

function parseDate(d) {
  if (!d) return null;
  const p = typeof d === "string" ? parseISO(d) : new Date(d);
  return isValid(p) ? p : null;
}

const STATUS_BADGE = {
  scheduled: { label: "Scheduled", cls: "bg-primary/10 text-primary" },
  in_progress: { label: "Live", cls: "bg-success/10 text-success animate-pulse" },
  awaiting_confirmation: { label: "Pending", cls: "bg-warning/10 text-warning" },
};

export default function GameDayCard({ game, selected, onClick, myClub, _myPlayer, tournament }) {
  const date = parseDate(game.scheduled_date);
  const status = STATUS_BADGE[game.status] || { label: game.status, cls: "bg-secondary text-muted-foreground" };

  // Determine matchup display
  const isClubMatch = game.mode === "club";
  const home = isClubMatch ? game.home_club_name : game.home_player_name;
  const away = isClubMatch ? game.away_club_name : game.away_player_name;
  const isMyClubInvolved = myClub && (game.home_club_id === myClub.id || game.away_club_id === myClub.id);

  // Determine competition label — same logic as Schedule and ClubDetail
  function deriveCompetition(match, t) {
    if (!match.tournament_id || match.tournament_id === "ranked") return "Ranked Match";
    if (!t) return "Tournament";
    if (t.type === "knockout") return `${t.name} · Knockout`;
    if (t.type === "league") return `${t.name} · League`;
    if (t.type === "group_stage") return `${t.name} · Group Stage`;
    if (t.type === "swiss" || t.type === "swiss_ucl") return `${t.name} · Swiss`;
    if (t.type === "double_elimination") return `${t.name} · Double Elim.`;
    return t.name || "Tournament";
  }
  const competition = game.competition_context || deriveCompetition(game, tournament);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-all",
        selected
          ? "bg-primary/10 border-primary/40 shadow-lg"
          : "bg-card border-border hover:border-primary/30"
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          {date && (
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {format(date, "EEEE d MMMM")} • {format(date, "HH:mm")}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary shrink-0" />
            <h3 className="text-sm font-bold text-foreground">
              {home || "TBD"} vs {away || "TBD"}
            </h3>
          </div>
        </div>
        <span className={cn("text-[10px] px-2 py-1 rounded-full font-medium whitespace-nowrap shrink-0", status.cls)}>
          {status.label}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Trophy className="w-3 h-3" />
          <span className="capitalize">{competition}</span>
        </div>
        {game.home_score !== undefined && game.away_score !== undefined && (
          <span className="font-bold text-foreground">
            {game.home_score} - {game.away_score}
          </span>
        )}
      </div>

      {(isMyClubInvolved || game.home_stream_url || game.away_stream_url) && (
        <div className="mt-2 pt-2 border-t border-border flex items-center gap-2 flex-wrap">
          {isMyClubInvolved && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              Your Club
            </span>
          )}
          {(game.home_stream_url || game.away_stream_url) && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 animate-pulse" /> Live Stream
            </span>
          )}
        </div>
      )}
    </button>
  );
}