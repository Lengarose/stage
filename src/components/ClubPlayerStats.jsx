import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend
} from "recharts";
import { User, Target, TrendingUp, Star, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-secondary border border-border rounded-xl p-4 text-center">
      <Icon className={cn("w-5 h-5 mx-auto mb-1.5", color)} />
      <p className="leading-relaxed font-bold text-2xl text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-3 text-xs shadow-xl">
      <p className="leading-relaxed font-bold text-foreground mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function ClubPlayerStats({ players, clubId }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState("all");

  useEffect(() => {
    async function load() {
      const data = await stageClient.entities.MatchPlayerStat.filter({ club_id: clubId });
      setStats(data);
      setLoading(false);
    }
    load();
  }, [clubId, players]);

  if (loading) {
    return <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  // Aggregate per player — use Player entity fields directly
  const playerAgg = players.map(p => {
    const matches = p.matches_played_club || 0;
    const goals = p.goals || 0;
    const assists = p.assists || 0;
    const avgRating = matches > 0 ? parseFloat((p.avg_match_rating || 6).toFixed(1)) : 0;
    return { name: p.gamertag || p.email, email: p.email, matches, goals, assists, avgRating, position: p.position };
  }).sort((a, b) => b.goals - a.goals);

  function getPlayerTimeline(email) {
    return stats
      .filter(s => s.player_email === email)
      .map((s, i) => ({
        match: `M${i + 1}`,
        goals: s.goals || 0,
        assists: s.assists || 0,
        rating: parseFloat((s.rating || 6).toFixed(1)),
      }));
  }

  const selectedPlayerData = selectedPlayer !== "all" ? players.find(p => p.email === selectedPlayer) : null;
  const timeline = selectedPlayer !== "all" ? getPlayerTimeline(selectedPlayer) : [];

  const radarData = selectedPlayerData ? (() => {
    const ps = stats.filter(s => s.player_email === selectedPlayer);
    const matches = ps.length || 1;
    const goals = ps.reduce((a, s) => a + (s.goals || 0), 0);
    const assists = ps.reduce((a, s) => a + (s.assists || 0), 0);
    const avgRating = ps.reduce((a, s) => a + (s.rating || 6), 0) / matches;
    return [
      { stat: "Goals", value: Math.min(goals * 10, 100) },
      { stat: "Assists", value: Math.min(assists * 12, 100) },
      { stat: "Rating", value: Math.min(((avgRating - 5) / 5) * 100, 100) },
      { stat: "Matches", value: Math.min(matches * 5, 100) },
    ];
  })() : [];

  const EmptyState = () => (
    <div className="py-10 text-center text-muted-foreground text-sm">
      No match stats recorded yet. Submit match results with player stats to see charts here.
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Player selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">{players.length} players · {stats.length} stat entries</p>
        <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
          <SelectTrigger className="bg-secondary border-border w-48">
            <SelectValue placeholder="All Players" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">👥 All Players</SelectItem>
            {players.map(p => (
              <SelectItem key={p.email} value={p.email}>{p.gamertag || p.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedPlayer === "all" ? (
        <Tabs defaultValue="goals" className="w-full">
          <TabsList className="bg-secondary border border-border mb-4">
            <TabsTrigger value="goals" className="leading-relaxed">⚽ Goals</TabsTrigger>
            <TabsTrigger value="assists" className="leading-relaxed">🎯 Assists</TabsTrigger>
            <TabsTrigger value="rating" className="leading-relaxed">⭐ Rating</TabsTrigger>
            <TabsTrigger value="table" className="leading-relaxed">📋 Table</TabsTrigger>
          </TabsList>

          <TabsContent value="goals">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="leading-relaxed text-base font-bold text-foreground mb-4">Goals per Player</h3>
              {playerAgg.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={playerAgg} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="goals" name="Goals" fill="hsl(145,70%,50%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </TabsContent>

          <TabsContent value="assists">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="leading-relaxed text-base font-bold text-foreground mb-4">Assists per Player</h3>
              {playerAgg.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={playerAgg} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="assists" name="Assists" fill="hsl(189,100%,52%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rating">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="leading-relaxed text-base font-bold text-foreground mb-4">Average Match Rating</h3>
              {playerAgg.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={[...playerAgg].sort((a, b) => b.avgRating - a.avgRating)} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis domain={[5, 10]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avgRating" name="Avg Rating" fill="hsl(45,95%,55%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </TabsContent>

          <TabsContent value="table">
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground uppercase tracking-wider">
                    <th className="text-left px-5 py-3">#</th>
                    <th className="text-left px-3 py-3">Player</th>
                    <th className="text-left px-3 py-3">Pos</th>
                    <th className="px-3 py-3 text-center">MP</th>
                    <th className="px-3 py-3 text-center text-success">G</th>
                    <th className="px-3 py-3 text-center text-primary">A</th>
                    <th className="px-3 py-3 text-center text-warning">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {playerAgg.map((p, i) => (
                    <tr key={p.email} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3 text-muted-foreground leading-relaxed font-bold">{i + 1}</td>
                      <td className="px-3 py-3 leading-relaxed font-semibold text-foreground">{p.name}</td>
                      <td className="px-3 py-3 text-xs text-primary leading-relaxed font-bold">{p.position}</td>
                      <td className="px-3 py-3 text-center text-muted-foreground">{p.matches}</td>
                      <td className="px-3 py-3 text-center leading-relaxed font-bold text-success">{p.goals}</td>
                      <td className="px-3 py-3 text-center leading-relaxed font-bold text-primary">{p.assists}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={cn("leading-relaxed font-bold", p.avgRating >= 7.5 ? "text-success" : p.avgRating >= 6.5 ? "text-warning" : "text-muted-foreground")}>
                          {p.avgRating > 0 ? p.avgRating : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {playerAgg.length === 0 && <EmptyState />}
            </div>
          </TabsContent>
        </Tabs>
      ) : (
        <div className="space-y-5">
          {(() => {
            const agg = playerAgg.find(p => p.email === selectedPlayer) || {};
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={Target} label="Goals" value={agg.goals || 0} color="text-success" />
                <StatCard icon={TrendingUp} label="Assists" value={agg.assists || 0} color="text-primary" />
                <StatCard icon={Star} label="Avg Rating" value={agg.avgRating > 0 ? agg.avgRating : "—"} color="text-warning" />
                <StatCard icon={Trophy} label="Matches" value={agg.matches || 0} color="text-accent" />
              </div>
            );
          })()}

          {timeline.length > 0 ? (
            <div className="grid lg:grid-cols-2 gap-5">
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="leading-relaxed text-base font-bold text-foreground mb-4">Goals & Assists per Match</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={timeline} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="match" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="goals" name="Goals" fill="hsl(145,70%,50%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="assists" name="Assists" fill="hsl(189,100%,52%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="leading-relaxed text-base font-bold text-foreground mb-4">Rating Over Time</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={timeline} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="match" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis domain={[4, 10]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line dataKey="rating" name="Rating" stroke="hsl(45,95%,55%)" strokeWidth={2} dot={{ fill: "hsl(45,95%,55%)", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {radarData.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-5 lg:col-span-2">
                  <h3 className="leading-relaxed text-base font-bold text-foreground mb-4">Performance Radar</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(var(--border))" />
                      <PolarAngleAxis dataKey="stat" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                      <Radar name={selectedPlayerData?.gamertag} dataKey="value" stroke="hsl(189,100%,52%)" fill="hsl(189,100%,52%)" fillOpacity={0.15} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <User className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No match stats recorded for this player yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}