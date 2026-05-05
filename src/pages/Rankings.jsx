import { useState, useEffect } from "react";
import { stageClient } from "@/api/stageClient";
import { useTranslation } from '@/hooks/useTranslation';
import { BarChart3, Trophy, User, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const TIERS = {
  1: {
    color: "#FFD700",
    glow: "rgba(255,215,0,0.6)",
    bg: "linear-gradient(135deg, #FFD700 0%, #B8860B 60%, #7a5500 100%)",
    height: 140,
    badgeSize: 90,
    crownSize: 32,
  },
  2: {
    color: "#C0C0C0",
    glow: "rgba(192,192,192,0.5)",
    bg: "linear-gradient(135deg, #E8E8E8 0%, #A0A0A0 60%, #5a5a5a 100%)",
    height: 100,
    badgeSize: 76,
    crownSize: 26,
  },
  3: {
    color: "#CD7F32",
    glow: "rgba(205,127,50,0.5)",
    bg: "linear-gradient(135deg, #CD7F32 0%, #8B4513 60%, #4a2000 100%)",
    height: 70,
    badgeSize: 68,
    crownSize: 22,
  },
};

const TIER_COLORS = {
  Bronze: "#CD7F32",
  Silver: "#C0C0C0",
  Gold: "#FFD700",
  Elite: "#00BFFF",
  "World Class": "#bf00ff",
};

const FORM_COLORS = { W: "bg-success", D: "bg-warning", L: "bg-destructive" };

function Crown({ color, size }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 40 28" fill="none">
      <polygon points="2,26 10,6 20,16 30,6 38,26" fill={color} opacity="0.95" />
      <circle cx="2" cy="26" r="3" fill={color} />
      <circle cx="20" cy="16" r="3" fill={color} />
      <circle cx="38" cy="26" r="3" fill={color} />
      <circle cx="10" cy="6" r="2.5" fill={color} />
      <circle cx="30" cy="6" r="2.5" fill={color} />
      <rect x="2" y="25" width="36" height="3" rx="1.5" fill={color} opacity="0.6" />
    </svg>
  );
}

function LaurelWreath({ color, size }) {
  const leaves = 9;
  const r = size * 0.46;
  const cx = size / 2;
  const cy = size / 2;
  const leftLeaves = Array.from({ length: leaves }, (_, i) => {
    const angle = 110 + (i * 120) / (leaves - 1);
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad), angle };
  });
  const rightLeaves = Array.from({ length: leaves }, (_, i) => {
    const angle = 70 - (i * 120) / (leaves - 1);
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad), angle };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", top: 0, left: 0 }}>
      {leftLeaves.map((l, i) => (
        <ellipse key={`ll${i}`} cx={l.x} cy={l.y} rx={size * 0.07} ry={size * 0.035} fill={color} opacity={0.8 - i * 0.04} transform={`rotate(${l.angle + 90}, ${l.x}, ${l.y})`} />
      ))}
      {rightLeaves.map((l, i) => (
        <ellipse key={`rl${i}`} cx={l.x} cy={l.y} rx={size * 0.07} ry={size * 0.035} fill={color} opacity={0.8 - i * 0.04} transform={`rotate(${l.angle + 90}, ${l.x}, ${l.y})`} />
      ))}
      {[-1, 0, 1].map((offset, i) => (
        <text key={i} x={cx + offset * size * 0.13} y={cy + r + size * 0.08} textAnchor="middle" fontSize={size * 0.08} fill={color} opacity="0.9">★</text>
      ))}
    </svg>
  );
}

function PodiumCard({ club, rank, isCenter }) {
  const t = TIERS[rank];
  const badgeSize = t.badgeSize;
  const tierColor = TIER_COLORS[club.tier] || t.color;

  return (
    <div className="flex flex-col items-center" style={{ minWidth: isCenter ? 160 : 130 }}>
      <div className="mb-1" style={{ filter: `drop-shadow(0 0 8px ${t.glow})` }}>
        <Crown color={t.color} size={t.crownSize} />
      </div>
      <div className="relative mb-3" style={{ width: badgeSize + 24, height: badgeSize + 24 }}>
        <LaurelWreath color={t.color} size={badgeSize + 24} />
        <div className="absolute inset-0 rounded-full" style={{ margin: 6, boxShadow: `0 0 20px ${t.glow}, 0 0 40px ${t.glow}`, borderRadius: "50%" }} />
        <div className="absolute flex items-center justify-center rounded-full overflow-hidden" style={{ inset: 12, background: t.bg, border: `3px solid ${t.color}`, boxShadow: `inset 0 0 16px rgba(0,0,0,0.4)` }}>
          <img
            src={club.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(club.tag || club.name)}&background=1a1a2e&color=fff&size=128&bold=true&font-size=0.4`}
            alt={club.name}
            className="w-full h-full object-cover"
            style={{ objectPosition: club.logo_position || "50% 50%" }}
          />
        </div>
        <div className="absolute bottom-0 right-0 flex items-center justify-center rounded-full border-2 font-black" style={{ width: isCenter ? 30 : 26, height: isCenter ? 30 : 26, background: t.bg, borderColor: t.color, color: "white", fontSize: isCenter ? 14 : 12, boxShadow: `0 2px 8px ${t.glow}`, fontFamily: "Anton, sans-serif" }}>
          {rank}
        </div>
      </div>
      <p className="font-bold text-center truncate max-w-[120px]" style={{ color: t.color, fontSize: isCenter ? 15 : 12, textShadow: `0 0 12px ${t.glow}` }}>
        {club.name}
      </p>
      <p className="text-xs font-mono mt-0.5 font-semibold" style={{ color: tierColor }}>{club.tier || "Silver"}</p>
      <p className="text-xs text-muted-foreground font-mono">{club.rating || 1500} ELO</p>
      {club.is_provisional && <span className="text-[9px] px-1 py-0.5 rounded bg-warning/20 text-warning font-medium mt-0.5">PROV</span>}
      <div className="mt-4 w-full rounded-t-xl flex items-center justify-center" style={{ height: t.height, background: `linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)`, border: `1px solid ${t.color}40`, borderBottom: "none", boxShadow: `0 -4px 20px ${t.glow}`, width: isCenter ? 140 : 110 }}>
        <span className="text-4xl font-black opacity-80" style={{ color: t.color }}>{rank}</span>
      </div>
    </div>
  );
}

function PlayerPodiumCard({ player, rank, isCenter }) {
  const t = TIERS[rank];
  const badgeSize = t.badgeSize;

  return (
    <div className="flex flex-col items-center" style={{ minWidth: isCenter ? 160 : 130 }}>
      <div className="mb-1" style={{ filter: `drop-shadow(0 0 8px ${t.glow})` }}>
        <Crown color={t.color} size={t.crownSize} />
      </div>
      <div className="relative mb-3" style={{ width: badgeSize + 24, height: badgeSize + 24 }}>
        <LaurelWreath color={t.color} size={badgeSize + 24} />
        <div className="absolute inset-0 rounded-full" style={{ margin: 6, boxShadow: `0 0 20px ${t.glow}, 0 0 40px ${t.glow}`, borderRadius: "50%" }} />
        <div className="absolute flex items-center justify-center rounded-full overflow-hidden" style={{ inset: 12, background: t.bg, border: `3px solid ${t.color}`, boxShadow: `inset 0 0 16px rgba(0,0,0,0.4)` }}>
          <img
            src={player.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(player.gamertag)}&background=0d1b2a&color=fff&size=128&bold=true`}
            alt={player.gamertag}
            className="w-full h-full object-cover"
            style={{ objectPosition: player.avatar_position || "50% 50%" }}
          />
        </div>
        <div className="absolute bottom-0 right-0 flex items-center justify-center rounded-full border-2 font-black" style={{ width: isCenter ? 30 : 26, height: isCenter ? 30 : 26, background: t.bg, borderColor: t.color, color: "white", fontSize: isCenter ? 14 : 12, boxShadow: `0 2px 8px ${t.glow}`, fontFamily: "Anton, sans-serif" }}>
          {rank}
        </div>
      </div>
      <p className="font-bold text-center truncate max-w-[120px]" style={{ color: t.color, fontSize: isCenter ? 15 : 12, textShadow: `0 0 12px ${t.glow}` }}>
        {player.gamertag}
      </p>
      <p className="text-xs text-muted-foreground font-mono mt-0.5">{player.overall_rating || 70} OVR</p>
      <p className="text-xs text-muted-foreground">{player.position} · {player.platform}</p>
      <div className="mt-4 w-full rounded-t-xl flex items-center justify-center" style={{ height: t.height, background: `linear-gradient(180deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)`, border: `1px solid ${t.color}40`, borderBottom: "none", boxShadow: `0 -4px 20px ${t.glow}`, width: isCenter ? 140 : 110 }}>
        <span className="text-4xl font-black opacity-80" style={{ color: t.color }}>{rank}</span>
      </div>
    </div>
  );
}

export default function Rankings() {
  const { t } = useTranslation();
  const [clubs, setClubs] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [clubData, playerData] = await Promise.all([
        stageClient.entities.Club.list("-rating", 100),
        stageClient.entities.Player.list("-overall_rating", 100),
      ]);
      setClubs(clubData);
      setPlayers(playerData);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const rankColors = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-primary shrink-0" />
          <div>
            <h1
              className="font-heading font-black text-5xl md:text-6xl text-foreground uppercase"
              style={{ transform: "skewX(-8deg)", letterSpacing: "-0.02em", transformOrigin: "left center" }}
            >
              {t("rankings.title")}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">Club ELO · Player ratings · Top performers</p>
          </div>
        </div>

        <Tabs defaultValue="clubs" className="w-full">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0 gap-0 mb-8">
            {[
              { value: "clubs", label: t("rankings.tabClubs"), icon: Trophy },
              { value: "players", label: t("rankings.tabPlayers"), icon: User },
            ].map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  "flex items-center gap-2 flex-1 rounded-none border-b-2 border-transparent pb-3 pt-3 text-xs uppercase tracking-widest font-bold text-muted-foreground transition-colors",
                  "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent"
                )}
              >
                <Icon className="w-4 h-4" /> {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* CLUBS TAB */}
          <TabsContent value="clubs">
            {clubs.length > 0 && (
              <div className="relative mb-12 overflow-x-auto">
                <div className="absolute inset-x-0 bottom-0 h-32 pointer-events-none" style={{ background: "radial-gradient(ellipse at center bottom, rgba(255,215,0,0.08) 0%, transparent 70%)" }} />
                <div className="flex items-end justify-center gap-0 sm:gap-2 min-w-[340px]">
                  {clubs[1] ? (
                    <Link to={`/clubs/${clubs[1].id}`}><PodiumCard club={clubs[1]} rank={2} isCenter={false} /></Link>
                  ) : <div className="w-28" />}
                  {clubs[0] && (
                    <Link to={`/clubs/${clubs[0].id}`} className="-mt-10 z-10">
                      <PodiumCard club={clubs[0]} rank={1} isCenter={true} />
                    </Link>
                  )}
                  {clubs[2] ? (
                    <Link to={`/clubs/${clubs[2].id}`} className="mt-6">
                      <PodiumCard club={clubs[2]} rank={3} isCenter={false} />
                    </Link>
                  ) : <div className="w-28" />}
                </div>
              </div>
            )}

            {clubs.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">{t("rankings.noClubs")}</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold tracking-widest uppercase text-foreground">{t("rankings.clubLeaderboard")}</h2>
                </div>
                <div className="divide-y divide-border">
                  {clubs.map((club, i) => {
                    const rank = i + 1;
                    const isTop3 = rank <= 3;
                    const total = (club.wins || 0) + (club.losses || 0) + (club.draws || 0);
                    const winRate = total > 0 ? Math.round(((club.wins || 0) / total) * 100) : 0;
                    const wld = `${club.wins || 0}W ${club.draws || 0}D ${club.losses || 0}L`;
                    const tierColor = TIER_COLORS[club.tier] || "#C0C0C0";
                    const form = club.form || [];
                    return (
                      <Link key={club.id} to={`/clubs/${club.id}`} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 hover:bg-secondary/50 transition-colors group">
                        <div className="w-7 sm:w-8 text-center font-black text-sm shrink-0" style={{ color: isTop3 ? rankColors[rank] : "hsl(var(--muted-foreground))" }}>{rank}</div>
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-black" style={{ background: isTop3 ? TIERS[rank].bg : "hsl(var(--secondary))", border: isTop3 ? `1.5px solid ${rankColors[rank]}` : "1.5px solid hsl(var(--border))" }}>
                          <img
                            src={club.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(club.tag || club.name)}&background=1a1a2e&color=fff&size=64&bold=true&font-size=0.4`}
                            alt={club.name}
                            className="w-full h-full object-cover"
                            style={{ objectPosition: club.logo_position || "50% 50%" }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">{club.name}</p>
                            {club.is_provisional && <span className="text-[9px] px-1.5 py-0.5 rounded bg-warning/20 text-warning font-medium shrink-0 hidden sm:inline">PROV</span>}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs font-semibold" style={{ color: tierColor }}>{club.tier || "Silver"}</span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">· {club.matches_ranked || 0} ranked</span>
                          </div>
                        </div>
                        <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{wld}</span>
                          <span className="text-foreground font-medium">{winRate}% WR</span>
                          <div className="flex items-center gap-0.5">
                            {form.map((r, fi) => <span key={fi} className={`w-2 h-2 rounded-full inline-block ${FORM_COLORS[r] || "bg-muted"}`} />)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-sm sm:text-base" style={{ color: isTop3 ? rankColors[rank] : tierColor }}>{club.rating || 1500}</p>
                          <p className="text-[10px] text-muted-foreground">ELO</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* PLAYERS TAB */}
          <TabsContent value="players">
            {players.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <User className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground font-medium">{t("rankings.noPlayers")}</p>
              </div>
            ) : (
              <>
                <div className="relative mb-12 overflow-x-auto">
                  <div className="absolute inset-x-0 bottom-0 h-32 pointer-events-none" style={{ background: "radial-gradient(ellipse at center bottom, rgba(255,215,0,0.08) 0%, transparent 70%)" }} />
                  <div className="flex items-end justify-center gap-0 sm:gap-2 min-w-[340px]">
                    {players[1] ? (
                      <Link to={`/players/${players[1].id}`}><PlayerPodiumCard player={players[1]} rank={2} isCenter={false} /></Link>
                    ) : <div className="w-28" />}
                    {players[0] && (
                      <Link to={`/players/${players[0].id}`} className="-mt-10 z-10">
                        <PlayerPodiumCard player={players[0]} rank={1} isCenter={true} />
                      </Link>
                    )}
                    {players[2] ? (
                      <Link to={`/players/${players[2].id}`} className="mt-6">
                        <PlayerPodiumCard player={players[2]} rank={3} isCenter={false} />
                      </Link>
                    ) : <div className="w-28" />}
                  </div>
                </div>
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-bold tracking-widest uppercase text-foreground">{t("rankings.playerLeaderboard")}</h2>
                  </div>
                  <div className="divide-y divide-border">
                    {players.map((player, i) => {
                      const rank = i + 1;
                      const isTop3 = rank <= 3;
                      const total = (player.wins_count || 0) + (player.losses_count || 0) + (player.draws_count || 0);
                      const winRate = total > 0 ? Math.round(((player.wins_count || 0) / total) * 100) : 0;
                      return (
                        <Link key={player.id} to={`/players/${player.id}`} className="flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 hover:bg-secondary/50 transition-colors group">
                          <div className="w-7 sm:w-8 text-center font-black text-sm shrink-0" style={{ color: isTop3 ? rankColors[rank] : "hsl(var(--muted-foreground))" }}>{rank}</div>
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden shrink-0" style={{ border: isTop3 ? `1.5px solid ${rankColors[rank]}` : "1.5px solid hsl(var(--border))" }}>
                            <img
                              src={player.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(player.gamertag)}&background=0d1b2a&color=fff&size=64&bold=true`}
                              alt={player.gamertag}
                              className="w-full h-full object-cover"
                              style={{ objectPosition: player.avatar_position || "50% 50%" }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">{player.gamertag}</p>
                            <p className="text-xs text-muted-foreground">{player.position} · {player.platform}</p>
                          </div>
                          <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{player.wins_count || 0}W {player.draws_count || 0}D {player.losses_count || 0}L</span>
                            <span className="text-foreground font-medium">{winRate}% WR</span>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-black text-sm sm:text-base" style={{ color: isTop3 ? rankColors[rank] : "hsl(var(--foreground))" }}>{player.overall_rating || 70}</p>
                            <p className="text-[10px] text-muted-foreground">OVR</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}