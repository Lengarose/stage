import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";
import UCLStandings from "./UCLStandings";
import { calculateLeagueStandings } from "../lib/tournamentEngine";

/**
 * Renders the standings tab content for league, group_stage, and swiss_ucl tournaments.
 * Highlights zones (champion / qualify / eliminated) once all matches are complete.
 * Mobile-friendly: compact padding, smaller fonts, scrollable container.
 */
export default function TournamentStandingsTabs({ tournament, matches, registeredClubs, groupStandingsData }) {
  const type = tournament?.type;

  // ── League Standings ──────────────────────────────────────────────────────
  const LeagueStandings = () => {
    const standings = calculateLeagueStandings(matches);
    if (standings.length === 0) return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Standings will appear as matches are completed.</p>
      </div>
    );
    const allDone = matches.length > 0 && matches.every(m => m.status === "completed" || m.status === "forfeit");
    const total = standings.length;
    const relegZone = total >= 6 ? 3 : total >= 4 ? 2 : total >= 3 ? 1 : 0;
    return (
      <div className="space-y-3">
        {allDone && (
          <div className="flex flex-wrap gap-2">
            <div className="text-xs px-2.5 py-1 rounded-full font-medium bg-warning/20 text-warning">🏆 #1 · Champion</div>
            {relegZone > 0 && <div className="text-xs px-2.5 py-1 rounded-full font-medium bg-destructive/10 text-destructive">Bottom {relegZone} · Eliminated</div>}
          </div>
        )}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-2 py-2.5">#</th>
                <th className="text-left px-2 py-2.5">Club</th>
                <th className="px-1.5 py-2.5 text-center">P</th>
                <th className="px-1.5 py-2.5 text-center">W</th>
                <th className="px-1.5 py-2.5 text-center">D</th>
                <th className="px-1.5 py-2.5 text-center">L</th>
                <th className="hidden sm:table-cell px-1.5 py-2.5 text-center">GF</th>
                <th className="hidden sm:table-cell px-1.5 py-2.5 text-center">GA</th>
                <th className="px-1.5 py-2.5 text-center">GD</th>
                <th className="px-1.5 py-2.5 text-center font-bold text-foreground">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, i) => {
                const isChamp = allDone && i === 0;
                const isElim = allDone && relegZone > 0 && i >= total - relegZone;
                const isBoundary = allDone && relegZone > 0 && i === total - relegZone - 1;
                return (
                  <tr key={row.id} className={cn(
                    "border-b border-border/50",
                    isChamp && "bg-warning/10 border-l-2 border-l-warning",
                    isElim && "bg-destructive/5 border-l-2 border-l-destructive/50",
                    isBoundary && "border-b-2 border-b-destructive/30"
                  )}>
                    <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-2 font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        {isChamp && <Trophy className="w-3 h-3 text-warning shrink-0" />}
                        <span className="truncate">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-1.5 py-2 text-center text-muted-foreground">{row.P}</td>
                    <td className="px-1.5 py-2 text-center text-success">{row.W}</td>
                    <td className="px-1.5 py-2 text-center text-muted-foreground">{row.D}</td>
                    <td className="px-1.5 py-2 text-center text-destructive">{row.L}</td>
                    <td className="hidden sm:table-cell px-1.5 py-2 text-center text-muted-foreground">{row.GF}</td>
                    <td className="hidden sm:table-cell px-1.5 py-2 text-center text-muted-foreground">{row.GA}</td>
                    <td className="px-1.5 py-2 text-center text-muted-foreground">{row.GD > 0 ? "+" : ""}{row.GD}</td>
                    <td className="px-1.5 py-2 text-center font-bold text-primary">{row.Pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Group Stage Standings ──────────────────────────────────────────────────
  const GroupStandings = () => {
    const groupMatches = matches.filter(m => m.type === "group_stage" || !m.type);
    const allGroupDone = groupMatches.length > 0 && groupMatches.every(m => m.status === "completed" || m.status === "forfeit");

    if (groupStandingsData.length === 0) return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Group standings will appear as matches are completed.</p>
      </div>
    );
    return (
      <div className="space-y-6">
        {allGroupDone && (
          <div className="flex flex-wrap gap-2">
            <div className="text-xs px-2.5 py-1 rounded-full font-medium bg-success/20 text-success">#1–#2 · Qualify</div>
            <div className="text-xs px-2.5 py-1 rounded-full font-medium bg-destructive/10 text-destructive">Bottom · Eliminated</div>
          </div>
        )}
        {groupStandingsData.map((group) => {
          const groupSize = group.standings.length;
          return (
            <div key={group.groupIndex}>
              <h3 className="leading-relaxed text-base font-bold text-foreground mb-2">Group {group.groupName}</h3>
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="text-left px-2 py-2">#</th>
                      <th className="text-left px-2 py-2">Club</th>
                      <th className="px-1.5 py-2 text-center">P</th>
                      <th className="px-1.5 py-2 text-center">W</th>
                      <th className="px-1.5 py-2 text-center">D</th>
                      <th className="px-1.5 py-2 text-center">L</th>
                      <th className="px-1.5 py-2 text-center">GD</th>
                      <th className="px-1.5 py-2 text-center font-bold text-foreground">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.standings.map((row, i) => {
                      const qualifies = allGroupDone && i < 2;
                      const eliminated = allGroupDone && i >= groupSize - 1 && groupSize > 2;
                      const isBoundary = allGroupDone && i === 1;
                      return (
                        <tr key={row.id} className={cn(
                          "border-b border-border/50",
                          qualifies && "bg-success/10 border-l-2 border-l-success",
                          eliminated && "bg-destructive/5 border-l-2 border-l-destructive/50",
                          isBoundary && "border-b-2 border-b-destructive/20"
                        )}>
                          <td className="px-2 py-2 text-muted-foreground">{i + 1}</td>
                          <td className="px-2 py-2 font-medium text-foreground max-w-[90px] truncate">
                            <div className="flex items-center gap-1.5">
                              {qualifies && <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />}
                              <span className="truncate">{row.name}</span>
                            </div>
                          </td>
                          <td className="px-1.5 py-2 text-center text-muted-foreground">{row.played}</td>
                          <td className="px-1.5 py-2 text-center text-success">{row.wins}</td>
                          <td className="px-1.5 py-2 text-center text-muted-foreground">{row.draws}</td>
                          <td className="px-1.5 py-2 text-center text-destructive">{row.losses}</td>
                          <td className="px-1.5 py-2 text-center text-muted-foreground">{row.goalDiff > 0 ? "+" : ""}{row.goalDiff}</td>
                          <td className="px-1.5 py-2 text-center font-bold text-primary">{row.points}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {type === "league" && (
        <TabsContent value="league_standings">
          <LeagueStandings />
        </TabsContent>
      )}
      {type === "swiss_ucl" && (
        <TabsContent value="ucl_standings">
          <UCLStandings matches={matches} registeredClubs={registeredClubs} />
        </TabsContent>
      )}
      {type === "group_stage" && (
        <TabsContent value="standings">
          <GroupStandings />
        </TabsContent>
      )}
    </>
  );
}