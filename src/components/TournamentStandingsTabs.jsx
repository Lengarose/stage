import { Link } from 'react-router-dom';
import { isStageResult } from '@/lib/tournamentStages';
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import UCLStandings from "./UCLStandings";
import { calculateStandings } from "../lib/standingsCore";
import StandingsWarnings from './StandingsWarnings';
import { useTranslation } from '@/hooks/useTranslation';

export default function TournamentStandingsTabs({ tournament, matches, registeredClubs = [], groupStandingsData, activeTab }) {
  const { t } = useTranslation();
  const type = tournament?.type;
  const player = tournament?.participant_type === 'player';
  const ids = tournament?.[player ? 'registered_players' : 'registered_clubs'] || [];
  const participants = ids.map(id => tournament?.standing_participants?.find(p => String(p.id) === String(id)) || registeredClubs.find(c => String(c.id) === String(id)) || { id });
  const options = { ...tournament, tournament_id: tournament.id, participants };

  // ── League Standings ──────────────────────────────────────────────────────
  const LeagueStandings = () => {
    const { rows: standings, issues } = calculateStandings(matches, options);
    if (standings.length === 0) return (
      <div className="bg-card border border-border rounded-none p-8 text-center">
        <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">No registered participants yet.</p>
      </div>
    );
    const championId = player ? tournament.winner_player_id : tournament.winner_club_id;
    const allDone = ['completed','archived'].includes(tournament.status) && !issues.length && championId && String(championId) === String(standings[0]?.id);
    const total = standings.length;
    const relegZone = 0;
    return (
      <div className="relative overflow-hidden border border-cyan-200/15 bg-background p-4 shadow-[0_0_38px_rgba(148,163,184,0.08)]">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/55 to-transparent" />
        <StandingsWarnings issues={issues} />
        {tournament.status === 'completed' && standings.some((row,i) => i > 0 && row.rank === standings[i-1].rank) && <p role="status" className="mb-3 text-warning">{t('tournamentDetail.standingsTied', 'Finishing positions remain tied under the sporting criteria. Qualification and paid positions require review.')}</p>}
        {allDone && (
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="border border-amber-200/25 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">#1 · Champion</div>
            {relegZone > 0 && <div className="border border-red-200/20 bg-red-400/8 px-3 py-1 text-xs font-medium text-red-100/80">Bottom {relegZone} · Eliminated</div>}
          </div>
        )}
        <div className="overflow-x-auto border border-white/10 bg-black/20">
          <table className="w-full min-w-[620px] text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.035] text-xs text-muted-foreground uppercase tracking-wider">
                <th className="text-left px-2 py-2.5">#</th>
                <th className="text-left px-2 py-2.5">{player ? t('competitionFlow.player', 'Player') : t('competitionFlow.club', 'Club')}</th>
                <th className="px-1.5 py-2.5 text-center">P</th>
                <th className="px-1.5 py-2.5 text-center">W</th>
                <th className="px-1.5 py-2.5 text-center">D</th>
                <th className="px-1.5 py-2.5 text-center">L</th>
                <th className="px-1.5 py-2.5 text-center">GF</th>
                <th className="px-1.5 py-2.5 text-center">GA</th>
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
                    <td className="px-2 py-2 text-muted-foreground">{row.rank}</td>
                    <td className="px-2 py-2 font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        {isChamp && <Trophy className="w-3 h-3 text-warning shrink-0" />}
                        {row.avatar_url && <img src={row.avatar_url} alt="" className="h-6 w-6 object-cover" />}
                        <Link to={`/${player ? 'players' : 'clubs'}/${encodeURIComponent(row.id)}`} className="min-h-10 py-2 font-semibold">{row.name}</Link>
                      </div>
                    </td>
                    <td className="px-1.5 py-2 text-center text-muted-foreground">{row.P}</td>
                    <td className="px-1.5 py-2 text-center text-success">{row.W}</td>
                    <td className="px-1.5 py-2 text-center text-muted-foreground">{row.D}</td>
                    <td className="px-1.5 py-2 text-center text-destructive">{row.L}</td>
                    <td className="px-1.5 py-2 text-center text-muted-foreground">{row.GF}</td>
                    <td className="px-1.5 py-2 text-center text-muted-foreground">{row.GA}</td>
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
    const allGroupDone = groupMatches.length > 0 && groupMatches.every(isStageResult);

    if (groupStandingsData.length === 0) return (
      <div className="bg-card border border-border rounded-none p-8 text-center">
        <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground text-sm">Group standings will appear as matches are completed.</p>
      </div>
    );
    return (
      <div className="relative space-y-6 overflow-hidden border border-cyan-200/15 bg-background p-4 shadow-[0_0_38px_rgba(148,163,184,0.08)]">
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
                <table className="w-full min-w-[620px] text-xs">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.035] text-xs text-muted-foreground uppercase tracking-wider">
                      <th className="text-left px-2 py-2">#</th>
                      <th className="text-left px-2 py-2">{tournament?.participant_type === "player" ? "Player" : "Club"}</th>
                      <th className="px-1.5 py-2 text-center">P</th>
                      <th className="px-1.5 py-2 text-center">W</th>
                      <th className="px-1.5 py-2 text-center">D</th>
                      <th className="px-1.5 py-2 text-center">L</th>
                      <th className="px-1.5 py-2 text-center">GF</th>
                      <th className="px-1.5 py-2 text-center">GA</th>
                      <th className="px-1.5 py-2 text-center">GD</th>
                      <th className="px-1.5 py-2 text-center font-bold text-foreground">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.standings.map((row, i) => {
                      const profile = participants.find(p => String(p.id) === String(row.id));
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
                              {(profile?.avatar_url || profile?.logo_url) && <img src={profile.avatar_url || profile.logo_url} alt="" className="h-6 w-6 shrink-0 object-contain" />}
                              <Link to={`/${player ? 'players' : 'clubs'}/${encodeURIComponent(row.id)}`} className="min-h-10 py-2 font-semibold">{row.name}</Link>
                            </div>
                          </td>
                          <td className="px-1.5 py-2 text-center text-muted-foreground">{row.played}</td>
                          <td className="px-1.5 py-2 text-center text-success">{row.wins}</td>
                          <td className="px-1.5 py-2 text-center text-muted-foreground">{row.draws}</td>
                          <td className="px-1.5 py-2 text-center text-destructive">{row.losses}</td>
                          <td className="px-1.5 py-2 text-center text-muted-foreground">{row.goalsFor}</td>
                          <td className="px-1.5 py-2 text-center text-muted-foreground">{row.goalsAgainst}</td>
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
      {tournament.standings_load_error && <p role="alert" className="mb-3 text-warning">{t('tournamentDetail.standingsUnavailable', 'Standings are unavailable because the complete fixture feed could not be loaded.')}</p>}
      {!tournament.standings_load_error && type === "league" && activeTab === "league_standings" && <LeagueStandings />}
      {!tournament.standings_load_error && type === "swiss_ucl" && activeTab === "ucl_standings" && (
        <UCLStandings matches={matches} registeredClubs={participants} tournament={tournament} />
      )}
      {type === "group_stage" && activeTab === "standings" && <GroupStandings />}
    </>
  );
}
