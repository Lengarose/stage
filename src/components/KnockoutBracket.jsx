import { Shield, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

function MatchCard({ match, myClubId, onSubmit, onSchedule, onViewStats, onAddStream, onForfeit, onDressingRoom }) {
  const isMyMatch = match?.home_club_id === myClubId || match?.away_club_id === myClubId;
  const completed = match?.status === "completed";
  const homeWon = completed && match.winner_club_id === match.home_club_id;
  const awayWon = completed && match.winner_club_id === match.away_club_id;
  const pending = match?.status === "scheduled" || match?.status === "in_progress" || match?.status === "awaiting_confirmation";

  if (!match) {
    return (
      <div className="w-56 bg-card border border-border/40 rounded-xl p-3 opacity-40">
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center"><Shield className="w-3 h-3 text-muted-foreground" /></div>
            <span className="text-xs text-muted-foreground">TBD</span>
          </div>
          <span className="text-sm font-bold text-muted-foreground/40">-</span>
        </div>
        <div className="border-t border-dashed border-border/30 my-1" />
        <div className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center"><Shield className="w-3 h-3 text-muted-foreground" /></div>
            <span className="text-xs text-muted-foreground">TBD</span>
          </div>
          <span className="text-sm font-bold text-muted-foreground/40">-</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "w-56 bg-card border rounded-xl overflow-hidden transition-all",
      isMyMatch ? "border-primary/50 shadow-md shadow-primary/10" : "border-border/60",
    )}>
      {/* Status bar */}
      {isMyMatch && pending && (
        <div className="px-3 py-1 bg-primary/10 border-b border-primary/20 flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-widest font-bold text-primary">Your Match</span>
          {match.scheduled_date && (
            <span className="text-[9px] text-muted-foreground">{new Date(match.scheduled_date).toLocaleDateString()}</span>
          )}
        </div>
      )}

      {/* Teams */}
      <div className="px-3 py-2 space-y-0">
        {/* Home */}
        <div className={cn(
          "flex items-center justify-between py-2 gap-2",
          homeWon && "opacity-100",
          awayWon && "opacity-40",
        )}>
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0",
              homeWon ? "bg-success/20" : "bg-secondary"
            )}>
              <Shield className={cn("w-3 h-3", homeWon ? "text-success" : "text-primary")} />
            </div>
            <span className="text-xs font-bold text-foreground truncate">{match.home_club_name || "TBD"}</span>
          </div>
          {completed ? (
            <span className={cn("text-base font-black shrink-0 w-5 text-center", homeWon ? "text-success" : "text-muted-foreground")}>
              {match.home_score}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/40 font-bold shrink-0">—</span>
          )}
        </div>

        {/* Divider with VS */}
        <div className="flex items-center gap-2">
          <div className="flex-1 border-t border-dashed border-border/30" />
          <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-wider">vs</span>
          <div className="flex-1 border-t border-dashed border-border/30" />
        </div>

        {/* Away */}
        <div className={cn(
          "flex items-center justify-between py-2 gap-2",
          awayWon && "opacity-100",
          homeWon && "opacity-40",
        )}>
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("w-6 h-6 rounded-full flex items-center justify-center shrink-0",
              awayWon ? "bg-success/20" : "bg-secondary"
            )}>
              <Shield className={cn("w-3 h-3", awayWon ? "text-success" : "text-muted-foreground")} />
            </div>
            <span className="text-xs font-bold text-foreground truncate">{match.away_club_name || "TBD"}</span>
          </div>
          {completed ? (
            <span className={cn("text-base font-black shrink-0 w-5 text-center", awayWon ? "text-success" : "text-muted-foreground")}>
              {match.away_score}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground/40 font-bold shrink-0">—</span>
          )}
        </div>
      </div>

      {/* Actions */}
      {completed && (
        <button onClick={() => onViewStats && onViewStats(match)}
          className="w-full text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-secondary/40 hover:bg-secondary py-1.5 border-t border-border/50 transition-colors">
          📊 Stats
        </button>
      )}
      {isMyMatch && pending && (
        <div className="border-t border-border/50">
          <button onClick={() => onDressingRoom && onDressingRoom(match)}
            className="w-full text-[10px] uppercase tracking-wider font-semibold text-primary/80 bg-primary/5 hover:bg-primary/10 py-1.5 border-b border-border/50 transition-colors">
            Dressing Room
          </button>
          <div className="grid grid-cols-2">
            <button onClick={() => onSchedule(match)}
              className="text-xs uppercase tracking-wider font-semibold text-muted-foreground bg-secondary/40 hover:bg-secondary py-2.5 transition-colors border-r border-border/50">
                Schedule
            </button>
            {match.status !== "awaiting_confirmation" ? (
              <button onClick={() => onSubmit(match)}
                className="text-xs uppercase tracking-wider font-semibold text-primary bg-primary/5 hover:bg-primary/10 py-2.5 transition-colors">
                Result
              </button>
            ) : !((match.home_club_id === myClubId && match.result_home_submitted) || (match.away_club_id === myClubId && match.result_away_submitted)) ? (
              <button onClick={() => onSubmit(match)}
                className="text-xs uppercase tracking-wider font-semibold text-warning bg-warning/5 hover:bg-warning/10 py-2.5 transition-colors">
                Confirm
              </button>
            ) : <div />}
          </div>
          <div className="grid grid-cols-2 border-t border-border/50">
            <button onClick={() => onAddStream && onAddStream(match)}
              className="text-xs uppercase tracking-wider font-semibold text-primary/70 bg-secondary/30 hover:bg-secondary/60 py-2.5 transition-colors border-r border-border/50">
                Stream
            </button>
            <button onClick={() => onForfeit && onForfeit(match)}
              className="text-xs uppercase tracking-wider font-semibold text-destructive bg-destructive/5 hover:bg-destructive/10 py-2.5 transition-colors">
              🚩 Forfeit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Connector({ count }) {
  // Vertical connector lines between rounds
  return (
    <div className="flex flex-col items-center justify-around" style={{ height: count * 88 + (count - 1) * 32 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-6 flex items-center">
          <div className="w-full h-px bg-border" />
        </div>
      ))}
    </div>
  );
}

export default function KnockoutBracket({ matches, myClubId, onSubmit, onSchedule, onViewStats, onAddStream, onForfeit, onDressingRoom }) {
  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);

  if (rounds.length === 0) return null;

  const lastRound = rounds[rounds.length - 1];

  function getRoundLabel(round) {
    const remaining = lastRound - round;
    if (remaining === 0) return "Final";
    if (remaining === 1) return "Semi-Finals";
    if (remaining === 2) return "Quarter-Finals";
    if (remaining === 3) return "Round of 16";
    return `Round ${round}`;
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex items-start gap-0 min-w-max">
        {rounds.map((round, rIdx) => {
          const roundMatches = matches.filter(m => m.round === round);
          const isLast = round === lastRound;

          return (
            <div key={round} className="flex items-start">
              {/* Round column */}
              <div className="flex flex-col">
                {/* Round label */}
                <div className="mb-3 px-2">
                  <span className={cn(
                    "text-xs leading-relaxed uppercase tracking-wider font-bold",
                    isLast ? "text-warning" : "text-muted-foreground"
                  )}>
                    {isLast && <Trophy className="w-3 h-3 inline mr-1 text-warning" />}
                    {getRoundLabel(round)}
                  </span>
                </div>
                {/* Matches */}
                <div className="flex flex-col gap-8">
                  {roundMatches.map(match => (
                    <div key={match.id} className="flex items-center">
                      <MatchCard match={match} myClubId={myClubId} onSubmit={onSubmit} onSchedule={onSchedule} onViewStats={onViewStats} onAddStream={onAddStream} onForfeit={onForfeit} onDressingRoom={onDressingRoom} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Connectors between rounds */}
              {rIdx < rounds.length - 1 && (
                <div className="flex flex-col mt-7">
                  <div className="flex flex-col gap-8">
                    {roundMatches.map((_, i) => (
                      <div key={i} className="flex items-center" style={{ height: 56 }}>
                        {/* Right line from match */}
                        <div className="w-4 h-px bg-border" />
                        {/* Vertical merge line */}
                        {i % 2 === 0 && (
                          <div className="relative w-0">
                            <div className="absolute left-0 top-0 w-px bg-border" style={{ height: 88 + 32 }} />
                          </div>
                        )}
                        {/* Left line to next round */}
                        <div className="w-4 h-px bg-border" style={{ marginLeft: i % 2 === 0 ? 0 : 0 }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}