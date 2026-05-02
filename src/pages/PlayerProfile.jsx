import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlayerFeed from "../components/PlayerFeed";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  ArrowLeft, User, Shield, Target, Swords, Trophy,
  Gamepad2, Flag, TrendingUp, Medal, Settings
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getBannerStyle } from "@/lib/storeItems";
import { cn } from "@/lib/utils";
import { calculatePlayerValue, formatSTC, getValueTier } from "@/lib/playerValue";
import PlayerTrophyCabinet from "@/components/profile/PlayerTrophyCabinet";
import PlayerLifestyleTab from "@/components/lifestyle/PlayerLifestyleTab";

export default function PlayerProfile() {
  const { id } = useParams();
  const [player, setPlayer] = useState(null);
  const [club, setClub] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followId, setFollowId] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [activeTab, setActiveTab] = useState("posts");
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followingModalOpen, setFollowingModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myPlayer, setMyPlayer] = useState(null);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [pvpMatches, setPvpMatches] = useState([]);
  const [clubStats, setClubStats] = useState(null);
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      if (!id) return;
      const user = await base44.auth.me();
      setCurrentUser(user);

      const [players, follows, allFollowers] = await Promise.all([
        base44.entities.Player.filter({ id }),
        base44.entities.Follow.filter({ follower_email: user.email, target_id: id, target_type: "player" }),
        base44.entities.Follow.filter({ target_id: id }),
      ]);
      setFollowersCount(allFollowers.length);

      const enrichedFollowers = await Promise.all(
        allFollowers.filter(f => f.follower_player_id).map(async (f) => {
          const pl = await base44.entities.Player.filter({ id: f.follower_player_id });
          return { ...f, _player_id: f.follower_player_id, _player_name: pl[0]?.gamertag, avatar_url: pl[0]?.avatar_url };
        })
      );
      setFollowersList(enrichedFollowers);

      const myPlArr = await base44.entities.Player.filter({ email: user.email });
      if (myPlArr.length > 0) setMyPlayer(myPlArr[0]);

      if (players.length > 0 && players[0].id && players[0].email) {
        const p = players[0];
        setPlayer(p);
        if (p.club_id) {
          const [clubs, tmHome, tmAway] = await Promise.all([
            base44.entities.Club.filter({ id: p.club_id }),
            base44.entities.Match.filter({ home_club_id: p.club_id, status: "scheduled" }, "round", 20),
            base44.entities.Match.filter({ away_club_id: p.club_id, status: "scheduled" }, "round", 20),
          ]);
          if (clubs.length > 0) setClub(clubs[0]);
          setUpcomingMatches([...tmHome, ...tmAway]);
        }

        const matchStats = await base44.entities.MatchPlayerStat.filter({ player_email: p.email });
        const matchIds = [...new Set(matchStats.map(s => s.match_id))];
        let filteredStats = matchStats;
        if (matchIds.length > 0) {
          const matchRecords = await Promise.all(
            matchIds.slice(0, 50).map(mid => base44.entities.Match.filter({ id: mid }))
          );
          const validMatchIds = new Set(
            matchRecords.flat().filter(m => m.type !== "friendly" && m.type !== undefined).map(m => m.id)
          );
          filteredStats = matchStats.filter(s => validMatchIds.has(s.match_id));
        }
        const totalGoals = filteredStats.reduce((s, r) => s + (r.goals || 0), 0);
        const totalAssists = filteredStats.reduce((s, r) => s + (r.assists || 0), 0);
        const ratings = filteredStats.filter(r => r.rating > 0).map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
        setClubStats({ matches: filteredStats.length, goals: totalGoals, assists: totalAssists, avgRating });

        const [pvpHome, pvpAway] = await Promise.all([
          base44.entities.Match.filter({ home_player_id: p.id, status: "completed" }, "-updated_date", 50),
          base44.entities.Match.filter({ away_player_id: p.id, status: "completed" }, "-updated_date", 50),
        ]);
        const allPvp = [...pvpHome, ...pvpAway].filter(m => m.mode === "solo" || (!m.mode && m.home_player_id));
        const pvpMap = new Map();
        allPvp.forEach(m => pvpMap.set(m.id, m));
        setPvpMatches([...pvpMap.values()].sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date)));
      }

      if (follows.length > 0 && follows[0].target_id) { setIsFollowing(true); setFollowId(follows[0].id); }

      const playerFollowing = await base44.entities.Follow.filter({ follower_email: players[0]?.email });
      const validFollows = playerFollowing.filter(f => f.target_id && typeof f.target_id === 'string' && f.target_id.trim());
      setFollowingCount(playerFollowing.length);
      setFollowingList(validFollows);
      setLoading(false);
    }
    load();
  }, [id]);

  async function toggleFollow() {
    if (isFollowing && followId) {
      await base44.entities.Follow.delete(followId);
      setIsFollowing(false); setFollowId(null);
      setFollowersCount(c => c - 1);
    } else {
      const f = await base44.entities.Follow.create({
        follower_email: currentUser.email,
        follower_player_id: myPlayer?.id || "",
        target_id: id,
        target_type: "player",
        target_name: player?.gamertag,
      });
      setIsFollowing(true); setFollowId(f.id);
      setFollowersCount(c => c + 1);
    }
  }

  if (loading || !id) {
    return <div className="flex items-center justify-center h-full min-h-screen"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (!player) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Player not found.</p>
        <Link to="/search"><Button variant="outline" className="mt-4">Back to Search</Button></Link>
      </div>
    );
  }

  const isOwner = currentUser?.email === player.email;
  const totalMatches = clubStats?.matches ?? 0;

  const OUTCOME_STYLE = {
    W: "bg-success/15 text-success border-success/30",
    L: "bg-destructive/15 text-destructive border-destructive/30",
    D: "bg-warning/15 text-warning border-warning/30",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Back nav */}
      <div className="px-4 pt-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* ── Banner ── */}
      <div className="w-full h-36 sm:h-48 md:h-56 mt-2" style={getBannerStyle(player.banner_id, player.banner_position)} />

      {/* ── Profile Header ── */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-end justify-between -mt-10 mb-4">
          {/* Avatar */}
          <button
            onClick={() => player.avatar_url && setAvatarLightboxOpen(true)}
            className="w-20 h-20 rounded-full bg-secondary border-4 border-background flex items-center justify-center overflow-hidden shrink-0"
          >
            {player.avatar_url
              ? <div className="w-full h-full" style={{ backgroundImage: `url(${player.avatar_url})`, backgroundSize: "cover", backgroundPosition: player.avatar_position || "50% 50%" }} />
              : <User className="w-9 h-9 text-muted-foreground" />
            }
          </button>

          {/* Action button */}
          <div className="flex items-center gap-2">
            {isOwner ? (
              <Link to="/profile">
                <Button size="sm" variant="outline" className="gap-1.5 h-9 px-3 text-xs">
                  <Settings className="w-3.5 h-3.5" /> Edit Profile
                </Button>
              </Link>
            ) : (
              <Button
                size="sm"
                onClick={toggleFollow}
                className={cn("h-9 px-4 text-xs", isFollowing ? "bg-secondary text-foreground border border-border hover:bg-secondary/80" : "bg-primary text-primary-foreground")}
              >
                {isFollowing ? "Unfollow" : "Follow"}
              </Button>
            )}
          </div>
        </div>

        {/* Name + meta */}
        <div className="space-y-1.5 mb-4">
          <h1 className="font-heading text-xl sm:text-2xl font-black text-foreground uppercase tracking-tight" style={{ letterSpacing: "-0.02em" }}>
            {player.gamertag}
          </h1>
          {player.role && (
            <span className={cn("inline-block text-xs px-2 py-0.5 rounded-full font-medium",
              player.role === "captain" ? "bg-warning/10 text-warning border border-warning/20" : "bg-secondary text-muted-foreground"
            )}>
              {player.role}
            </span>
          )}
          <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground flex-wrap">
            {player.position && <span className="flex items-center gap-1"><Target className="w-3 h-3" />{player.position}</span>}
            {player.platform && <span className="flex items-center gap-1"><Gamepad2 className="w-3 h-3" />{player.platform}</span>}
            {player.country && <span className="flex items-center gap-1"><Flag className="w-3 h-3" />{player.country}</span>}
            {club && (
              <Link to={`/clubs/${club.id}`} className="flex items-center gap-1 text-primary hover:underline">
                <Shield className="w-3 h-3" />{club.name}
              </Link>
            )}
          </div>
          {player.bio && <p className="text-sm text-foreground/80 mt-1 break-words">{player.bio}</p>}
        </div>

        {/* Stats row */}
        <div className="flex items-center border-y border-border py-3 mb-0">
          <div className="flex-1 text-center py-1">
            <p className="font-heading text-xl font-black text-foreground">{totalMatches}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Matches</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <button onClick={() => setFollowersModalOpen(true)} className="flex-1 text-center py-1 hover:opacity-70 transition-opacity">
            <p className="font-heading text-xl font-black text-foreground">{followersCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Followers</p>
          </button>
          <div className="w-px h-8 bg-border" />
          <button onClick={() => setFollowingModalOpen(true)} className="flex-1 text-center py-1 hover:opacity-70 transition-opacity">
            <p className="font-heading text-xl font-black text-foreground">{followingCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Following</p>
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="max-w-2xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0 gap-0">
            {["posts", "stats", "matches", "trophies", "lifestyle"].map(tab => (
              <TabsTrigger
                key={tab}
                value={tab}
                className={cn(
                  "flex-1 rounded-none border-b-2 border-transparent pb-3 pt-3 text-[10px] sm:text-xs uppercase tracking-widest font-bold text-muted-foreground transition-colors min-w-0",
                  "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent"
                )}
              >
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Posts */}
          <TabsContent value="posts" className="mt-0 px-3 sm:px-4 pt-4">
            <PlayerFeed currentUser={currentUser} player={player} isOwner={isOwner} />
          </TabsContent>

          {/* Stats */}
          <TabsContent value="stats" className="px-3 sm:px-4 pt-4">
            <div className="space-y-4">
              {/* OVR card */}
              <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center shrink-0">
                  <span className="font-heading text-lg sm:text-xl font-black text-primary leading-none">{player.overall_rating || 70}</span>
                  <span className="text-[8px] uppercase tracking-wider text-muted-foreground mt-0.5">OVR</span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-foreground truncate">{player.gamertag}</p>
                  <p className="text-xs text-muted-foreground">{player.position} · {player.platform}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Ranked / Tournament stats only</p>
                </div>
              </div>

              {/* Market Value */}
              {(() => {
                const mv = calculatePlayerValue(player);
                const tier = getValueTier(mv);
                return (
                  <div className="bg-card border border-border rounded-xl p-3 sm:p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Market Value</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-semibold", tier.color)}>{tier.label}</span>
                      <span className="font-light text-foreground text-lg tracking-tight">{formatSTC(mv)}</span>
                    </div>
                  </div>
                );
              })()}

              {/* Stat grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <StatCard label="Matches" value={clubStats?.matches ?? 0} />
                <StatCard label="Goals" value={clubStats?.goals ?? 0} accent="success" />
                <StatCard label="Assists" value={clubStats?.assists ?? 0} accent="accent" />
                <StatCard label="Avg Rating" value={(clubStats?.avgRating || 6).toFixed(1)} accent="warning" />
                <StatCard label="MOTM" value={player.man_of_the_match || 0} />
                <StatCard label="Clean Sheets" value={player.clean_sheets || 0} />
              </div>

              {/* PvP summary */}
              {pvpMatches.length > 0 && (() => {
                const pvpW = pvpMatches.filter(m => m.home_player_id === player.id ? m.home_score > m.away_score : m.away_score > m.home_score).length;
                const pvpL = pvpMatches.filter(m => m.home_player_id === player.id ? m.home_score < m.away_score : m.away_score < m.home_score).length;
                const pvpD = pvpMatches.filter(m => m.home_score === m.away_score).length;
                return (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">PvP Record</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-center">
                        <p className="font-heading text-2xl font-black text-success">{pvpW}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Wins</p>
                      </div>
                      <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 text-center">
                        <p className="font-heading text-2xl font-black text-warning">{pvpD}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Draws</p>
                      </div>
                      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-center">
                        <p className="font-heading text-2xl font-black text-destructive">{pvpL}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Losses</p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </TabsContent>

          {/* Matches */}
          <TabsContent value="matches" className="px-3 sm:px-4 pt-4">
            <div className="space-y-4">
              {upcomingMatches.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Upcoming</p>
                  <div className="space-y-2">
                    {upcomingMatches.map(m => {
                      const isHome = m.home_club_id === club?.id;
                      const oppName = isHome ? m.away_club_name : m.home_club_name;
                      const dateStr = m.scheduled_date ? new Date(m.scheduled_date).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "TBD";
                      return (
                        <div key={m.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Swords className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">vs {oppName}</p>
                            <p className="text-xs text-muted-foreground">Round {m.round}</p>
                          </div>
                          <p className="text-xs text-muted-foreground shrink-0">{dateStr}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pvpMatches.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">PvP Match History</p>
                  <div className="space-y-2">
                    {pvpMatches.slice(0, 20).map(m => {
                      const isHome = m.home_player_id === player.id;
                      const opponent = isHome ? m.away_player_name : m.home_player_name;
                      const myScore = isHome ? m.home_score : m.away_score;
                      const theirScore = isHome ? m.away_score : m.home_score;
                      const outcome = myScore > theirScore ? "W" : myScore < theirScore ? "L" : "D";
                      const scoreStr = isHome ? `${m.home_score}–${m.away_score}` : `${m.away_score}–${m.home_score}`;
                      const dateStr = m.scheduled_date || m.updated_date
                        ? new Date(m.scheduled_date || m.updated_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                        : "—";
                      return (
                        <div key={m.id} className="bg-card border border-border rounded-xl px-3 py-3 flex items-center gap-2 sm:gap-3">
                          <span className={cn("text-xs font-bold px-2 py-1 rounded border shrink-0", OUTCOME_STYLE[outcome])}>{outcome}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">vs {opponent || "Unknown"}</p>
                            <p className="text-[10px] text-muted-foreground">{dateStr}</p>
                          </div>
                          <span className="text-sm font-bold text-foreground shrink-0">{scoreStr}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {upcomingMatches.length === 0 && pvpMatches.length === 0 && (
                <div className="bg-card border border-border rounded-xl p-10 text-center">
                  <Swords className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No matches recorded yet.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Trophies */}
          <TabsContent value="trophies" className="px-3 sm:px-4 pt-4 pb-4">
            <PlayerTrophyCabinet player={player} currentUserEmail={currentUser?.email} />
          </TabsContent>

          {/* Lifestyle */}
          <TabsContent value="lifestyle" className="px-3 sm:px-4 pt-4 pb-4">
            <PlayerLifestyleTab player={player} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Lightbox */}
      {player.avatar_url && (
        <Dialog open={avatarLightboxOpen} onOpenChange={setAvatarLightboxOpen}>
          <DialogContent className="bg-card border-border max-w-sm p-4">
            <DialogHeader><DialogTitle>{player.gamertag}</DialogTitle></DialogHeader>
            <div className="flex items-center justify-center">
              <img src={player.avatar_url} alt={player.gamertag} className="w-64 h-64 rounded-2xl object-cover" style={{ objectPosition: player.avatar_position || "50% 50%" }} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Followers Modal */}
      <Dialog open={followersModalOpen} onOpenChange={setFollowersModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Followers</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <FollowList items={followersList} emptyLabel="No followers yet." onClose={() => setFollowersModalOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Following Modal */}
      <Dialog open={followingModalOpen} onOpenChange={setFollowingModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Following</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <FollowList items={followingList} emptyLabel="Not following anyone yet." onClose={() => setFollowingModalOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  const accentClass = {
    success: "text-success",
    accent: "text-accent",
    warning: "text-warning",
  }[accent] || "text-foreground";

  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <p className={cn("font-heading text-3xl font-black leading-none", accentClass)}>{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

function FollowList({ items, emptyLabel, onClose }) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = items.filter(item => {
    const name = item.target_name || item._player_name || item.follower_email || "";
    return name.toLowerCase().includes(search.toLowerCase());
  });

  if (items.length === 0) {
    return <div className="bg-card border border-border rounded-xl p-8 text-center"><p className="text-muted-foreground text-sm">{emptyLabel}</p></div>;
  }

  return (
    <>
      <input
        type="text"
        placeholder="Search by gamertag..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full mb-3 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No results found.</p>}
        {filtered.map(item => {
          const name = item.target_name || item._player_name || item.follower_email || "Unknown";
          const imageUrl = item.avatar_url || item.logo_url;
          const targetId = item._player_id || item._target_id || item.target_id;
          const targetType = item.target_type === "club" ? "clubs" : "players";
          return (
            <button
              key={item.id}
              onClick={() => { onClose?.(); navigate(`/${targetType}/${targetId}`); }}
              className="w-full text-left bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:border-primary/30 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
                {imageUrl ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-primary">{(name[0] || "?").toUpperCase()}</span>}
              </div>
              <p className="text-sm font-medium text-foreground truncate">{name}</p>
            </button>
          );
        })}
      </div>
    </>
  );
}