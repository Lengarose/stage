import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend } from "recharts";
import { User, Target, TrendingUp, Star, Shield, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const CHART_COLORS = ["hsl(189,100%,52%)", "hsl(145,70%,50%)", "hsl(45,95%,55%)", "hsl(0,72%,51%)", "hsl(200,90%,45%)", "hsl(270,70%,60%)"];

export default function PlayerStats() {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [stats, setStats] = useState([]);
  const [myClub, setMyClub] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState("all");

  useEffect(() => {
    async function load() {
      const user = await base44.auth.me();
      const myPlData = await base44.entities.Player.filter({ email: user.email });
      const myPl = myPlData[0];
      if (!myPl?.club_id) { setLoading(false); return; }

      const [clubData, clubPlayers, allStats] = await Promise.all([
        base44.entities.Club.filter({ id: myPl.club_id }),
        base44.entities.Player.filter({ club_id: myPl.club_id }),
        base44.entities.MatchPlayerStat.filter({ club_id: myPl.club_id }),
      ]);

      setMyClub(clubData[0] || null);
      setPlayers(clubPlayers);
      setStats(allStats);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (!myClub) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6">
        <Shield className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">You need to be in a club to view team stats.</p>
      </div>
    );
  }

  // Aggregate per player for the overview
  const playerAgg = players.map(p => {
    const ps = stats.filter(s => s.player_email === p.email);
    const matches = ps.length;
    const goals = ps.reduce((a, s) => a + (s.goals || 0), 0);
    const assists = ps.reduce((a, s) => a + (s.assists || 0), 0);
    const avgRating = matches > 0 ? (ps.reduce((a, s) => a + (s.rating || 6), 0) / matches) : 0;
    return { name: p.gamertag || p.email, email: p.email, matches, goals, assists, avgRating: parseFloat(avgRating.toFixed(1)), position: p.position };
  }).sort((a, b) => b.goals - a.goals);

  // Per-player match timeline (for line chart)
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

  // Radar data for selected player
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

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap justify-between">
        <div>
          <h1 className="leading-relaxed text-3xl font-bold text-foreground">Player Statistics</h1>
          <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-primary" /> {myClub.name} · {players.length} players
          </p>
        </div>
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
          <TabsList className="bg-secondary border border-border mb-6">
            <TabsTrigger value="goals" className="leading-relaxed">⚽ Goals</TabsTrigger>
            <TabsTrigger value="assists" className="leading-relaxed">🎯 Assists</TabsTrigger>
            <TabsTrigger value="rating" className="leading-relaxed">⭐ Rating</TabsTrigger>
            <TabsTrigger value="table" className="leading-relaxed">📋 Table</TabsTrigger>
          </TabsList>

          <TabsContent value="goals">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="leading-relaxed text-lg font-bold text-foreground mb-4">Goals per Player</h2>
              {playerAgg.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={300}>
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
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="leading-relaxed text-lg font-bold text-foreground mb-4">Assists per Player</h2>
              {playerAgg.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={300}>
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
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="leading-relaxed text-lg font-bold text-foreground mb-4">Average Match Rating</h2>
              {playerAgg.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={300}>
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
        /* Individual player view */
        <div className="space-y-6">
          {/* Summary cards */}
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

          {/* Timeline chart */}
          {timeline.length > 0 ? (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="leading-relaxed text-base font-bold text-foreground mb-4">Goals & Assists per Match</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={timeline} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="match" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="bg-card border border-border rounded-lg p-2 text-xs">
                        <p className="font-bold mb-1">{label}</p>
                        {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>)}
                      </div>
                    ) : null} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="goals" name="Goals" fill="hsl(145,70%,50%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="assists" name="Assists" fill="hsl(189,100%,52%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="leading-relaxed text-base font-bold text-foreground mb-4">Rating Over Time</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={timeline} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="match" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis domain={[4, 10]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="bg-card border border-border rounded-lg p-2 text-xs">
                        <p className="font-bold mb-1">{label}</p>
                        {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>)}
                      </div>
                    ) : null} />
                    <Line dataKey="rating" name="Rating" stroke="hsl(45,95%,55%)" strokeWidth={2} dot={{ fill: "hsl(45,95%,55%)", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {radarData.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-6 lg:col-span-2">
                  <h3 className="leading-relaxed text-base font-bold text-foreground mb-4">Performance Radar</h3>
                  <ResponsiveContainer width="100%" height={260}>
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
              <p className="text-muted-foreground">No match stats recorded for this player yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <Icon className={cn("w-5 h-5 mx-auto mb-1.5", color)} />
      <p className="leading-relaxed font-bold text-2xl text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="py-12 text-center text-muted-foreground text-sm">
      No match stats recorded yet. Submit match results with player stats to see charts here.
    </div>
  );
}