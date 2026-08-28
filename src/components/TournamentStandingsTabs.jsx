import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import UCLStandings from "./UCLStandings";
import { calculateLeagueStandings } from "../lib/tournamentEngine";

export default function TournamentStandingsTabs({ tournament, matches, registeredClubs, groupStandingsData, activeTab }) {
  const type = tournament?.type;
  const panelClip = { clipPath: "polygon(18px 0, 100% 0, calc(100% - 18px) 100%, 0 100%)" };

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
      <div className="relative overflow-hidden border border-cyan-200/15 bg-[#07121f]/90 p-4 shadow-[0_0_38px_rgba(148,163,184,0.08)]" style={panelClip}>
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/55 to-transparent" />
        {allDone && (
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="border border-amber-200/25 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">#1 · Champion</div>
            {relegZone > 0 && <div className="border border-red-200/20 bg-red-400/8 px-3 py-1 text-xs font-medium text-red-100/80">Bottom {relegZone} · Eliminated</div>}
          </div>
        )}
        <div className="overflow-x-auto border border-white/10 bg-black/20">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.035] text-xs text-muted-foreground uppercase tracking-wider">
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
                    "border-b border-white/10",
                    isChamp && "bg-amber-300/10 border-l-2 border-l-amber-200",
                    isElim && "bg-red-400/5 border-l-2 border-l-red-300/50",
                    isBoundary && "border-b-2 border-b-red-300/30"
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
                    <td className="px-1.5 py-2 text-center font-bold text-cyan-100">{row.Pts}</td>
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
    const groupMatches = matches.filter(m => m.type === "group" || m.type === "group_stage" || !m.type);
    const allGroupDone = groupMatches.length > 0 && groupMatches.every(m => m.status === "completed" || m.status === "forfeit");

    if (groupStandingsData.length === 0) return (
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Group standings will appear as matches are completed.</p>
      </div>
    );
    return (
      <div className="relative space-y-6 overflow-hidden border border-cyan-200/15 bg-[#07121f]/90 p-4 shadow-[0_0_38px_rgba(148,163,184,0.08)]" style={panelClip}>
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/55 to-transparent" />
        {allGroupDone && (
          <div className="flex flex-wrap gap-2">
            <div className="border border-cyan-200/25 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-100">#1-#2 · Qualify</div>
            <div className="border border-red-200/20 bg-red-400/8 px-3 py-1 text-xs font-medium text-red-100/80">Bottom · Eliminated</div>
          </div>
        )}
        {groupStandingsData.map((group) => {
          const groupSize = group.standings.length;
          return (
            <div key={group.groupIndex}>
              <h3 className="leading-relaxed text-base font-bold text-foreground mb-2">Group {group.groupName}</h3>
              <div className="overflow-x-auto border border-white/10 bg-black/20">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.035] text-xs text-muted-foreground uppercase tracking-wider">
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
                          "border-b border-white/10",
                          qualifies && "bg-cyan-300/10 border-l-2 border-l-cyan-200",
                          eliminated && "bg-red-400/5 border-l-2 border-l-red-300/50",
                          isBoundary && "border-b-2 border-b-red-300/20"
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
                          <td className="px-1.5 py-2 text-center font-bold text-cyan-100">{row.points}</td>
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
      {type === "league" && activeTab === "league_standings" && <LeagueStandings />}
      {type === "swiss_ucl" && activeTab === "ucl_standings" && (
        <UCLStandings matches={matches} registeredClubs={registeredClubs} />
      )}
      {type === "group_stage" && activeTab === "standings" && <GroupStandings />}
    </>
  );
}
