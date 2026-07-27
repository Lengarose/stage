import { useState, useEffect } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend } from "recharts";
import { User, Target, TrendingUp, Star, Shield, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

export default function PlayerStats() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [stats, setStats] = useState([]);
  const [myClub, setMyClub] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState("all");

  useEffect(() => {
    async function load() {
      const { club } = await resolveMyPlayerAndClub();
      if (!club?.id) { setLoading(false); return; }

      const [clubPlayers, allStats] = await Promise.all([
        stageClient.entities.Player.filter({ club_id: club.id }),
        stageClient.entities.MatchPlayerStat.filter({ club_id: club.id }),
      ]);

      setMyClub(club);
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
        <p className="text-muted-foreground">{t("commonPages.psNeedClub")}</p>
      </div>
    );
  }

  const playerAgg = players.map(p => {
    const ps = stats.filter(s => s.player_email === p.email);
    const matches = ps.length;
    const goals = ps.reduce((a, s) => a + (s.goals || 0), 0);
    const assists = ps.reduce((a, s) => a + (s.assists || 0), 0);
    const avgRating = matches > 0 ? (ps.reduce((a, s) => a + (s.rating || 6), 0) / matches) : 0;
    return { name: p.gamertag || p.email, email: p.email, matches, goals, assists, avgRating: parseFloat(avgRating.toFixed(1)), position: p.position };
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
      { stat: t("commonPages.goals"), value: Math.min(goals * 10, 100) },
      { stat: t("commonPages.assists"), value: Math.min(assists * 12, 100) },
      { stat: t("commonPages.prRating"), value: Math.min(((avgRating - 5) / 5) * 100, 100) },
      { stat: t("commonPages.matches"), value: Math.min(matches * 5, 100) },
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
      <div className="flex items-center gap-4 flex-wrap justify-between">
        <div>
          <h1 className="font-heading leading-relaxed text-3xl font-bold text-foreground">{t("commonPages.psTitle")}</h1>
          <p className="font-subtitle text-muted-foreground text-sm mt-1 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-primary" /> {t("commonPages.psPlayersCount", { name: myClub.name, count: players.length })}
          </p>
        </div>
        <Select value={selectedPlayer} onValueChange={setSelectedPlayer}>
          <SelectTrigger className="bg-secondary border-border w-48">
            <SelectValue placeholder={t("commonPages.psAllPlayers")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("commonPages.psAllPlayers")}</SelectItem>
            {players.map(p => (
              <SelectItem key={p.email} value={p.email}>{p.gamertag || p.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedPlayer === "all" ? (
        <Tabs defaultValue="goals" className="w-full">
          <TabsList className="bg-secondary border border-border mb-6">
            <TabsTrigger value="goals" className="leading-relaxed">{t("commonPages.psTabGoals")}</TabsTrigger>
            <TabsTrigger value="assists" className="leading-relaxed">{t("commonPages.psTabAssists")}</TabsTrigger>
            <TabsTrigger value="rating" className="leading-relaxed">{t("commonPages.psTabRating")}</TabsTrigger>
            <TabsTrigger value="table" className="leading-relaxed">{t("commonPages.psTabTable")}</TabsTrigger>
          </TabsList>

          <TabsContent value="goals">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="leading-relaxed text-lg font-bold text-foreground mb-4">{t("commonPages.psGoalsPerPlayer")}</h2>
              {playerAgg.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={playerAgg} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="goals" name={t("commonPages.goals")} fill="hsl(145,70%,50%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </TabsContent>

          <TabsContent value="assists">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="leading-relaxed text-lg font-bold text-foreground mb-4">{t("commonPages.psAssistsPerPlayer")}</h2>
              {playerAgg.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={playerAgg} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="assists" name={t("commonPages.assists")} fill="hsl(189,100%,52%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rating">
            <div className="bg-card border border-border rounded-2xl p-6">
              <h2 className="leading-relaxed text-lg font-bold text-foreground mb-4">{t("commonPages.psAvgMatchRating")}</h2>
              {playerAgg.length === 0 ? <EmptyState /> : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[...playerAgg].sort((a, b) => b.avgRating - a.avgRating)} margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis domain={[5, 10]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avgRating" name={t("commonPages.psAvgRating")} fill="hsl(45,95%,55%)" radius={[6, 6, 0, 0]} />
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
                    <th className="text-left px-3 py-3">{t("commonPages.prPlayer")}</th>
                    <th className="text-left px-3 py-3">{t("commonPages.psPos")}</th>
                    <th className="px-3 py-3 text-center">{t("commonPages.psMp")}</th>
                    <th className="px-3 py-3 text-center text-success">G</th>
                    <th className="px-3 py-3 text-center text-primary">A</th>
                    <th className="px-3 py-3 text-center text-warning">{t("commonPages.prRating")}</th>
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
        <div className="space-y-6">
          {(() => {
            const agg = playerAgg.find(p => p.email === selectedPlayer) || {};
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard icon={Target} label={t("commonPages.goals")} value={agg.goals || 0} color="text-success" />
                <StatCard icon={TrendingUp} label={t("commonPages.assists")} value={agg.assists || 0} color="text-primary" />
                <StatCard icon={Star} label={t("commonPages.psAvgRating")} value={agg.avgRating > 0 ? agg.avgRating : "—"} color="text-warning" />
                <StatCard icon={Trophy} label={t("commonPages.matches")} value={agg.matches || 0} color="text-accent" />
              </div>
            );
          })()}

          {timeline.length > 0 ? (
            <div className="grid lg:grid-cols-2 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="leading-relaxed text-base font-bold text-foreground mb-4">{t("commonPages.psGoalsAssistsPerMatch")}</h3>
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
                    <Bar dataKey="goals" name={t("commonPages.goals")} fill="hsl(145,70%,50%)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="assists" name={t("commonPages.assists")} fill="hsl(189,100%,52%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="leading-relaxed text-base font-bold text-foreground mb-4">{t("commonPages.psRatingOverTime")}</h3>
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
                    <Line dataKey="rating" name={t("commonPages.prRating")} stroke="hsl(45,95%,55%)" strokeWidth={2} dot={{ fill: "hsl(45,95%,55%)", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {radarData.length > 0 && (
                <div className="bg-card border border-border rounded-2xl p-6 lg:col-span-2">
                  <h3 className="leading-relaxed text-base font-bold text-foreground mb-4">{t("commonPages.psPerformanceRadar")}</h3>
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
              <p className="text-muted-foreground">{t("commonPages.psNoPlayerStats")}</p>
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
  const { t } = useTranslation();
  return (
    <div className="py-12 text-center text-muted-foreground text-sm">
      {t("commonPages.psNoStatsYet")}
    </div>
  );
}
