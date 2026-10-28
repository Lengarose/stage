import { Link } from 'react-router-dom';
import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";
import { calculateStandings } from '@/lib/standingsCore';
import StandingsWarnings from './StandingsWarnings';
import { useTranslation } from '@/hooks/useTranslation';

// Zones:  top 8 = auto qualify (green), 9-24 = playoff (amber), 25-36 = eliminated (red)
const ZONE_CONFIG = [
  { from: 1, to: 8, label: "Auto Qualify", color: "bg-success/10 border-l-2 border-l-success", badge: "bg-success/20 text-success" },
  { from: 9, to: 24, label: "Playoff", color: "bg-warning/5 border-l-2 border-l-warning", badge: "bg-warning/20 text-warning" },
  { from: 25, to: 36, label: "Eliminated", color: "bg-destructive/5 border-l-2 border-l-destructive/50", badge: "bg-destructive/10 text-destructive" },
];

function getZone(rank) {
  return ZONE_CONFIG.find(z => rank >= z.from && rank <= z.to) || ZONE_CONFIG[2];
}

export default function UCLStandings({ matches, registeredClubs, tournament }) {
  const { t } = useTranslation();
  const { rows: sorted, issues } = calculateStandings(matches, { ...tournament, tournament_id: tournament?.id, participants: registeredClubs, phase: 'ucl_league' });
  // The existing draw engine defines 36 entrants, eight games each and 8/16 zones.
  // Nonstandard historical configurations remain visible, without invented zones.
  const standard = sorted.length === 36 && Number(tournament?.league_phase_rounds || 8) === 8;
  const showZones = standard && !issues.length && sorted.every(r => r.P === 8)
    && sorted.every((r, i) => i === 0 || i >= 24 || r.rank === i + 1)
    && matches.some(m => ['ucl_playoff','ucl_r16','ucl_qf','ucl_sf','final'].includes(m.type));

  return (
    <div className="relative space-y-3 overflow-hidden border border-cyan-200/15 bg-background p-4 shadow-[0_0_38px_rgba(148,163,184,0.08)]">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/55 to-transparent" />
      {showZones ? (
        <div className="flex flex-wrap gap-2">
          {ZONE_CONFIG.map(z => (
            <div key={z.label} className={cn("border px-3 py-1 text-xs font-medium", z.badge)}>
              {z.from === z.to ? `#${z.from}` : `#${z.from}–#${z.to}`} · {z.label}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground px-1">
          {standard ? 'Qualification zones await all confirmed league-phase results and resolved qualifying ties.' : 'This roster does not match the supported 36-participant, eight-round UCL configuration. Qualification requires review.'}
        </div>
      )}
      <StandingsWarnings issues={issues} />

      <div className="overflow-x-auto border border-white/10 bg-black/20">
        <table className="w-full min-w-[620px] text-xs">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.035] text-xs text-muted-foreground uppercase tracking-wider">
              <th className="px-2 py-2 text-left w-7">#</th>
              <th className="px-2 py-2 text-left">{tournament?.participant_type === 'player' ? t('competitionFlow.player', 'Player') : t('competitionFlow.club', 'Club')}</th>
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
            {sorted.map((row) => {
              const rank = row.rank;
              const zone = getZone(rank);
              const isZoneBoundary = rank === 8 || rank === 24;
              return (
                <tr
                  key={row.id}
                  className={cn(
                    "border-b border-border/40 transition-colors hover:bg-secondary/30",
                    showZones && zone.color,
                    showZones && isZoneBoundary && "border-b-2"
                  )}
                >
                  <td className="px-2 py-1.5 text-center">
                    {rank <= 3 ? (
                      <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mx-auto",
                        rank === 1 ? "bg-warning/20 text-warning" :
                        rank === 2 ? "bg-muted-foreground/20 text-muted-foreground" :
                        "bg-amber-700/20 text-amber-600"
                      )}>{rank}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">{rank}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {row.avatar_url && <img src={row.avatar_url} alt="" className="mr-2 inline-block h-6 w-6 object-cover" />}
                    <Link to={`/${tournament?.participant_type === 'player' ? 'players' : 'clubs'}/${encodeURIComponent(row.id)}`} className="inline-flex min-h-10 items-center font-semibold text-foreground">{row.name}</Link>
                  </td>
                  <td className="px-1.5 py-1.5 text-center text-muted-foreground">{row.P}</td>
                  <td className="px-1.5 py-1.5 text-center text-success font-medium">{row.W}</td>
                  <td className="px-1.5 py-1.5 text-center text-muted-foreground">{row.D}</td>
                  <td className="px-1.5 py-1.5 text-center text-destructive">{row.L}</td>
                  <td className="px-1.5 py-1.5 text-center text-muted-foreground">{row.GF}</td>
                  <td className="px-1.5 py-1.5 text-center text-muted-foreground">{row.GA}</td>
                  <td className="px-1.5 py-1.5 text-center text-muted-foreground">{row.GD > 0 ? `+${row.GD}` : row.GD}</td>
                  <td className="px-1.5 py-1.5 text-center">
                    <span className="font-bold text-primary">{row.Pts}</span>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  No registered participants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
