import { cn } from "@/lib/utils";
import { Trophy } from "lucide-react";

// Zones:  top 8 = auto qualify (green), 9-24 = playoff (amber), 25-36 = eliminated (red)
const ZONE_CONFIG = [
  { from: 1, to: 8, label: "Auto Qualify", color: "bg-success/10 border-l-2 border-l-success", badge: "bg-success/20 text-success" },
  { from: 9, to: 24, label: "Playoff", color: "bg-warning/5 border-l-2 border-l-warning", badge: "bg-warning/20 text-warning" },
  { from: 25, to: 36, label: "Eliminated", color: "bg-destructive/5 border-l-2 border-l-destructive/50", badge: "bg-destructive/10 text-destructive" },
];

function getZone(rank) {
  return ZONE_CONFIG.find(z => rank >= z.from && rank <= z.to) || ZONE_CONFIG[2];
}

export default function UCLStandings({ matches, registeredClubs }) {
  const leagueMatches = matches.filter(m => m.type === "swiss_ucl" || m.type === "ucl_league");
  const leagueRounds = [...new Set(leagueMatches.map(m => m.round))];
  const allRoundsDone = leagueRounds.length >= 8 && leagueMatches.every(m => m.status === "completed" || m.status === "forfeit");
  const showZones = allRoundsDone;

  const table = {};
  registeredClubs.forEach(c => {
    table[c.id] = { id: c.id, name: c.name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
  });

  matches
    .filter(m => (m.type === "swiss_ucl" || m.type === "ucl_league") && (m.status === "completed" || m.status === "forfeit"))
    .forEach(m => {
      if (!table[m.home_club_id]) table[m.home_club_id] = { id: m.home_club_id, name: m.home_club_name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
      if (!table[m.away_club_id]) table[m.away_club_id] = { id: m.away_club_id, name: m.away_club_name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
      const h = table[m.home_club_id], a = table[m.away_club_id];
      h.P++; a.P++;
      h.GF += m.home_score || 0; h.GA += m.away_score || 0;
      a.GF += m.away_score || 0; a.GA += m.home_score || 0;
      h.GD = h.GF - h.GA; a.GD = a.GF - a.GA;
      if (m.winner_club_id === m.home_club_id) { h.W++; h.Pts += 3; a.L++; }
      else if (m.winner_club_id === m.away_club_id) { a.W++; a.Pts += 3; h.L++; }
      else { h.D++; h.Pts++; a.D++; a.Pts++; }
    });

  const sorted = Object.values(table).sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF);

  return (
    <div className="space-y-3">
      {showZones ? (
        <div className="flex flex-wrap gap-2">
          {ZONE_CONFIG.map(z => (
            <div key={z.label} className={cn("text-xs px-2.5 py-1 rounded-full font-medium", z.badge)}>
              {z.from === z.to ? `#${z.from}` : `#${z.from}–#${z.to}`} · {z.label}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground px-1">
          Zone highlighting will appear once all 8 rounds are completed ({leagueRounds.length}/8 rounds played).
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider bg-secondary/40">
              <th className="px-2 py-2 text-left w-7">#</th>
              <th className="px-2 py-2 text-left">Club</th>
              <th className="px-1.5 py-2 text-center">P</th>
              <th className="px-1.5 py-2 text-center">W</th>
              <th className="px-1.5 py-2 text-center">D</th>
              <th className="px-1.5 py-2 text-center">L</th>
              <th className="hidden sm:table-cell px-1.5 py-2 text-center">GF</th>
              <th className="hidden sm:table-cell px-1.5 py-2 text-center">GA</th>
              <th className="px-1.5 py-2 text-center">GD</th>
              <th className="px-1.5 py-2 text-center font-bold text-foreground">Pts</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, i) => {
              const rank = i + 1;
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
                    <span className="font-semibold text-foreground">{row.name}</span>
                  </td>
                  <td className="px-1.5 py-1.5 text-center text-muted-foreground">{row.P}</td>
                  <td className="px-1.5 py-1.5 text-center text-success font-medium">{row.W}</td>
                  <td className="px-1.5 py-1.5 text-center text-muted-foreground">{row.D}</td>
                  <td className="px-1.5 py-1.5 text-center text-destructive">{row.L}</td>
                  <td className="hidden sm:table-cell px-1.5 py-1.5 text-center text-muted-foreground">{row.GF}</td>
                  <td className="hidden sm:table-cell px-1.5 py-1.5 text-center text-muted-foreground">{row.GA}</td>
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
                  Standings will appear as matches are played.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}