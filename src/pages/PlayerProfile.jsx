import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlayerFeed from "../components/PlayerFeed";
import { useParams, Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import {
  ArrowLeft, User, Shield, Target, Swords,
  Gamepad2, Flag, Settings,
  Coins, FileText, Clock
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getBannerStyle } from "@/lib/storeItems";
import { cn } from "@/lib/utils";
import { formatSTC } from "@/lib/playerValue";
import { notify, postContractNews } from "@/lib/notify";
import PlayerTrophyCabinet from "@/components/profile/PlayerTrophyCabinet";
import PlayerAchievementsSection from "@/components/rewards/PlayerAchievementsSection";
import PlayerLifestyleTab from "@/components/lifestyle/PlayerLifestyleTab";
import { CONTRACT_TYPES, getContractProgress } from "@/lib/contractTypes";
import OfferContractDialog from "@/components/contracts/OfferContractDialog";
import TransferPaymentDialog from "@/components/contracts/TransferPaymentDialog";

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
  // Contract & transfer state
  const [activeContract, setActiveContract] = useState(null);
  const [playerContracts, setPlayerContracts] = useState([]);
  const [viewerClub, setViewerClub] = useState(null);
  const [windowOpen, setWindowOpen] = useState(null);
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [transferPayOpen, setTransferPayOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      if (!id) return;
      const user = await stageClient.auth.me();
      setCurrentUser(user);

      const [players, follows, allFollowers] = await Promise.all([
        stageClient.entities.Player.filter({ id }),
        stageClient.entities.Follow.filter({ follower_email: user.email, target_id: id, target_type: "player" }),
        stageClient.entities.Follow.filter({ target_id: id }),
      ]);
      setFollowersCount(allFollowers.length);

      const enrichedFollowers = await Promise.all(
        allFollowers.filter(f => f.follower_player_id).map(async (f) => {
          const pl = await stageClient.entities.Player.filter({ id: f.follower_player_id });
          return { ...f, _player_id: f.follower_player_id, _player_name: pl[0]?.gamertag, avatar_url: pl[0]?.avatar_url };
        })
      );
      setFollowersList(enrichedFollowers);

      const myPlArr = await stageClient.entities.Player.filter({ email: user.email });
      if (myPlArr.length > 0) setMyPlayer(myPlArr[0]);

      if (players.length > 0 && players[0].id && players[0].email) {
        const p = players[0];
        setPlayer(p);
        if (p.club_id) {
          const [clubs, tmHome, tmAway] = await Promise.all([
            stageClient.entities.Club.filter({ id: p.club_id }),
            stageClient.entities.Match.filter({ home_club_id: p.club_id, status: "scheduled" }, "round", 20),
            stageClient.entities.Match.filter({ away_club_id: p.club_id, status: "scheduled" }, "round", 20),
          ]);
          if (clubs.length > 0) setClub(clubs[0]);
          setUpcomingMatches([...tmHome, ...tmAway]);
        }

        // Load player's contracts for display + conflict check
      const contractArr = await stageClient.entities.PlayerContract.filter({ user_id: p.id });
      const LIVE = ["active", "pending", "pending_window", "negotiating"];
      setPlayerContracts(contractArr.filter(c => LIVE.includes(c.status)));
      setActiveContract(contractArr.find(c => c.status === "active") || null);

      // Load viewer's club if in club mode
      const acctMode = localStorage.getItem("stage-account-mode") || "player";
      if (acctMode === "club" && myPlArr[0]?.club_id) {
        try {
          const vcArr = await stageClient.entities.Club.filter({ id: myPlArr[0].club_id });
          setViewerClub(vcArr[0] || null);
        } catch { }
      }

      // Transfer window
      try {
        const winRes = await stageClient.functions.invoke("transferWindowActions", { action: "get_current" });
        setWindowOpen(winRes?.data?.window?.status === "open");
      } catch { setWindowOpen(false); }

      const matchStats = await stageClient.entities.MatchPlayerStat.filter({ player_email: p.email });
        const matchIds = [...new Set(matchStats.map(s => s.match_id))];
        let filteredStats = matchStats;
        if (matchIds.length > 0) {
          const matchRecords = await Promise.all(
            matchIds.slice(0, 50).map(mid => stageClient.entities.Match.filter({ id: mid }))
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
          stageClient.entities.Match.filter({ home_player_id: p.id, status: "completed" }, "-updated_date", 50),
          stageClient.entities.Match.filter({ away_player_id: p.id, status: "completed" }, "-updated_date", 50),
        ]);
        const allPvp = [...pvpHome, ...pvpAway].filter(m => m.mode === "solo" || (!m.mode && m.home_player_id));
        const pvpMap = new Map();
        allPvp.forEach(m => pvpMap.set(m.id, m));
        setPvpMatches([...pvpMap.values()].sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date)));
      }

      if (follows.length > 0 && follows[0].target_id) { setIsFollowing(true); setFollowId(follows[0].id); }

      const playerFollowing = await stageClient.entities.Follow.filter({ follower_email: players[0]?.email });
      const validFollows = playerFollowing.filter(f => f.target_id && typeof f.target_id === 'string' && f.target_id.trim());
      setFollowingCount(playerFollowing.length);
      setFollowingList(validFollows);
      setLoading(false);
    }
    load();
  }, [id]);

  async function toggleFollow() {
    if (isFollowing && followId) {
      await stageClient.entities.Follow.delete(followId);
      setIsFollowing(false); setFollowId(null);
      setFollowersCount(c => c - 1);
    } else {
      const f = await stageClient.entities.Follow.create({
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


  async function handleOfferContract(terms) {
    if (!viewerClub || !player) return;
    const typeMeta = CONTRACT_TYPES[terms.contract_type] || CONTRACT_TYPES.squad;
    let recipientEmail = player.email;
    if (!recipientEmail) {
      try { const f = await base44.entities.Player.filter({ id: player.id }); recipientEmail = f[0]?.email || null; } catch { }
    }
    const fmt = n => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n/1_000).toFixed(0)}K` : `${n}`;
    const newContract = await stageClient.entities.PlayerContract.create({
      team_id: viewerClub.id, user_id: player.id,
      contract_type: terms.contract_type, offer_note: terms.offer_note || "",
      offered_by: myPlayer?.id || "",
      max_games: typeMeta.max_games, max_days: typeMeta.max_days,
      weekly_salary_stc:   terms.weekly_salary_stc   || 0,
      signing_bonus_stc:   terms.signing_bonus_stc   || 0,
      transfer_fee_stc:    0,
      performance_targets: terms.performance_targets || [],
      captaincy_offered:   terms.captaincy_offered   || false,
      status: "pending",
    });
    if (recipientEmail) {
      try {
        const salary = terms.weekly_salary_stc || 0;
        const bonus  = terms.signing_bonus_stc  || 0;
        let body = `Dear ${player.gamertag},\n\n${viewerClub.name} is pleased to extend an official contract offer to you.\n\n`;
        body += `Type: ${terms.contract_type} Contract · Duration: ${typeMeta.max_games} games / ${typeMeta.max_days} days\n`;
        if (salary > 0) body += `Weekly Salary: ${fmt(salary)} STC/wk\n`;
        if (bonus  > 0) body += `Signing Bonus: ${fmt(bonus)} STC\n`;
        if (terms.captaincy_offered) body += `Captaincy offered ⭐\n`;
        if (terms.offer_note) body += `\nMessage: "${terms.offer_note}"\n`;
        body += `\nPlease respond using the buttons below.\n\nBest regards,\n${viewerClub.name} Management`;
        await stageClient.entities.InboxMessage.create({
          recipient_email: recipientEmail, sender_email: myPlayer?.email || "",
          sender_gamertag: viewerClub.name, sender_avatar_url: viewerClub.logo_url || "",
          sender_club_name: viewerClub.name,
          subject: `📄 Contract Offer from ${viewerClub.name}`, body,
          message_type: "contract_offer", action_type: "contract_negotiation",
          related_entity_id: newContract.id, status: "pending", is_read: false,
          metadata: { contract_id: newContract.id, club_id: viewerClub.id, club_name: viewerClub.name, contract_type: terms.contract_type },
        });
      } catch { }
    }
    notify(recipientEmail, "contract_offer",
      `📋 Contract Offer from ${viewerClub.name}`,
      `${viewerClub.name} has sent you a ${terms.contract_type} contract offer. Open your inbox to review.`,
      "/inbox"
    );
    postContractNews({
      title: `📄 ${viewerClub.name} offered a contract to ${player.gamertag}`,
      body: `${viewerClub.name} sent a ${terms.contract_type} contract offer to ${player.gamertag}.`,
      club_name: viewerClub.name, club_logo_url: viewerClub.logo_url || "",
      player_name: player.gamertag, player_avatar_url: player.avatar_url || "",
      link: `/players/${player.id}`,
    });
    setOfferDialogOpen(false);
    setPlayerContracts(prev => [...prev, newContract]);
  }

  if (loading || !id) {
    return <div className="flex items-center justify-center h-full min-h-screen bg-[#06091a]"><div className="w-8 h-8 border-4 border-white/10 border-t-blue-400 rounded-full animate-spin" /></div>;
  }

  if (!player) {
    return (
      <div className="p-6 text-center">
        <p className="text-white/50">Player not found.</p>
        <Link to="/search"><Button variant="outline" className="mt-4">Back to Search</Button></Link>
      </div>
    );
  }

  const isOwner = currentUser?.email === player.email;

  const OUTCOME_STYLE = {
    W: "bg-success/15 text-success border-success/30",
    L: "bg-destructive/15 text-destructive border-destructive/30",
    D: "bg-warning/15 text-warning border-warning/30",
  };

  return (
    <div className="min-h-screen bg-[#06091a] text-white">
      {/* Back nav */}
      <div className="px-4 pt-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
      </div>

      {/* ── Banner ── */}
      <div className="relative w-full h-52 sm:h-72 md:h-80 mt-2 overflow-hidden">
        <div className="absolute inset-0" style={getBannerStyle(player.banner_id, player.banner_position)} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06091a] via-[#06091a]/30 to-transparent" />
      </div>

      {/* ── Profile Header ── */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-end justify-between -mt-20 mb-4 relative z-10">
          {/* Avatar */}
          <button
            onClick={() => player.avatar_url && setAvatarLightboxOpen(true)}
            className="w-24 h-24 rounded-full border-2 border-white/20 shadow-2xl shadow-blue-500/20 flex items-center justify-center overflow-hidden shrink-0"
          >
            {player.avatar_url
              ? <div className="w-full h-full" style={{ backgroundImage: `url(${player.avatar_url})`, backgroundSize: "cover", backgroundPosition: player.avatar_position || "50% 50%" }} />
              : <User className="w-9 h-9 text-white/40" />
            }
          </button>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isOwner ? (
              <Link to="/profile">
                <Button size="sm" variant="outline" className="gap-1.5 h-9 px-3 text-xs border-white/20 text-white hover:bg-white/10 bg-transparent">
                  <Settings className="w-3.5 h-3.5" /> Edit Profile
                </Button>
              </Link>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={toggleFollow}
                  className={cn("h-9 px-4 text-xs", isFollowing ? "bg-white/10 border border-white/20 text-white" : "bg-blue-600 hover:bg-blue-500 text-white")}
                >
                  {isFollowing ? "Unfollow" : "Follow"}
                </Button>
                {/* Club owner actions */}
                {viewerClub && (
                  <>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => setOfferDialogOpen(true)}
                      className="gap-1.5 h-9 px-3 text-xs border-primary/40 text-primary hover:bg-primary/10 bg-transparent"
                    >
                      <FileText className="w-3.5 h-3.5" /> Offer Contract
                    </Button>
                    {player.club_id && player.club_id !== viewerClub.id && club && (
                      <Button
                        size="sm" variant="outline"
                        onClick={() => setTransferPayOpen(true)}
                        className="gap-1.5 h-9 px-3 text-xs border-warning/40 text-warning hover:bg-warning/10 bg-transparent"
                      >
                        <Coins className="w-3.5 h-3.5" /> Transfer Fee
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Name + meta */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-heading text-3xl sm:text-4xl font-black text-white uppercase tracking-tight leading-none" style={{ letterSpacing: "-0.02em" }}>
              {player.gamertag}
            </h1>
            {player.shirt_number && (
              <span className="font-heading text-2xl font-black text-white/30 border border-white/15 rounded-lg px-2.5 py-0.5 shrink-0">
                #{player.shirt_number}
              </span>
            )}
          </div>
          {player.role && (
            <span className={cn("inline-block text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-widest",
              player.role === "captain" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-white/10 text-white/60 border border-white/10"
            )}>
              {player.role}
            </span>
          )}
          <div className="flex items-center gap-3 text-xs text-white/50 flex-wrap font-medium uppercase tracking-wider">
            {player.position && <span className="flex items-center gap-1.5"><Target className="w-3 h-3" />{player.position}</span>}
            {player.platform && <span className="flex items-center gap-1.5"><Gamepad2 className="w-3 h-3" />{player.platform}</span>}
            {player.country && <span className="flex items-center gap-1.5"><Flag className="w-3 h-3" />{player.country}</span>}
            {club && (
              <Link to={`/clubs/${club.id}`} className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors">
                <Shield className="w-3 h-3" />{club.name}
              </Link>
            )}
          </div>
          {player.bio && <p className="text-sm text-white/60 leading-relaxed break-words">{player.bio}</p>}

          {/* Active contract info — visible to all */}
          {activeContract && (() => {
            const progress = getContractProgress(activeContract);
            return (
              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {activeContract.weekly_salary_stc > 0 && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-success/10 border border-success/20 text-success font-medium">
                    <Coins className="w-2.5 h-2.5" />{formatSTC(activeContract.weekly_salary_stc)}/wk
                  </span>
                )}
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 font-medium capitalize">
                  <FileText className="w-2.5 h-2.5" />{activeContract.contract_type} contract
                </span>
                {progress && progress.daysLeft > 0 && (
                  <span className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium",
                    progress.daysLeft <= 7 ? "bg-warning/10 border-warning/20 text-warning" : "bg-white/5 border-white/10 text-white/50"
                  )}>
                    <Clock className="w-2.5 h-2.5" />{progress.daysLeft}d left
                  </span>
                )}
                {progress && progress.gamesLeft > 0 && (
                  <span className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium",
                    progress.gamesLeft <= 10 ? "bg-warning/10 border-warning/20 text-warning" : "bg-white/5 border-white/10 text-white/50"
                  )}>
                    <Gamepad2 className="w-2.5 h-2.5" />{progress.gamesLeft} games left
                  </span>
                )}
              </div>
            );
          })()}

          <div className="flex items-center gap-3 text-sm">
            <button onClick={() => setFollowersModalOpen(true)} className="hover:opacity-70 transition-opacity">
              <span className="font-bold text-white">{followersCount}</span>
              <span className="text-white/40 ml-1 text-xs">followers</span>
            </button>
            <span className="text-white/20">·</span>
            <button onClick={() => setFollowingModalOpen(true)} className="hover:opacity-70 transition-opacity">
              <span className="font-bold text-white">{followingCount}</span>
              <span className="text-white/40 ml-1 text-xs">following</span>
            </button>
          </div>

        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="max-w-2xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none border-b border-white/10 bg-transparent h-auto p-0 gap-0">
            {["posts", "stats", "matches", "trophies", "lifestyle"].map(tab => (
              <TabsTrigger
                key={tab}
                value={tab}
                className={cn(
                  "flex-1 rounded-none border-b-2 border-transparent pb-3 pt-3 text-[10px] sm:text-xs uppercase tracking-widest font-bold text-white/40 transition-colors min-w-0",
                  "data-[state=active]:border-blue-400 data-[state=active]:text-blue-400 data-[state=active]:bg-transparent"
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
              <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 flex items-center gap-3">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center shrink-0">
                  <span className="font-heading text-lg sm:text-xl font-black text-primary leading-none">{player.overall_rating || 70}</span>
                  <span className="text-[8px] uppercase tracking-wider text-white/40 mt-0.5">OVR</span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white truncate">{player.gamertag}</p>
                  <p className="text-xs text-white/40">{player.position} · {player.platform}</p>
                  <p className="text-[10px] text-white/40 mt-0.5 uppercase tracking-wider">Ranked / Tournament stats only</p>
                </div>
              </div>


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
                    <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">PvP Record</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                        <p className="font-heading text-2xl font-black text-success">{pvpW}</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Wins</p>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                        <p className="font-heading text-2xl font-black text-warning">{pvpD}</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Draws</p>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                        <p className="font-heading text-2xl font-black text-destructive">{pvpL}</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Losses</p>
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
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Upcoming</p>
                  <div className="space-y-2">
                    {upcomingMatches.map(m => {
                      const isHome = m.home_club_id === club?.id;
                      const oppName = isHome ? m.away_club_name : m.home_club_name;
                      const dateStr = m.scheduled_date ? new Date(m.scheduled_date).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "TBD";
                      return (
                        <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Swords className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">vs {oppName}</p>
                            <p className="text-xs text-white/40">Round {m.round}</p>
                          </div>
                          <p className="text-xs text-white/40 shrink-0">{dateStr}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {pvpMatches.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">PvP Match History</p>
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
                        <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl px-3 py-3 flex items-center gap-2 sm:gap-3">
                          <span className={cn("text-xs font-bold px-2 py-1 rounded border shrink-0", OUTCOME_STYLE[outcome])}>{outcome}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">vs {opponent || "Unknown"}</p>
                            <p className="text-[10px] text-white/40">{dateStr}</p>
                          </div>
                          <span className="text-sm font-bold text-white shrink-0">{scoreStr}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {upcomingMatches.length === 0 && pvpMatches.length === 0 && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-10 text-center">
                  <Swords className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-sm text-white/40">No matches recorded yet.</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Trophies */}
          <TabsContent value="trophies" className="px-3 sm:px-4 pt-4 pb-4 space-y-6">
            <PlayerAchievementsSection playerId={player?.id} />
            <PlayerTrophyCabinet player={player} currentUserEmail={currentUser?.email} />
          </TabsContent>

          {/* Lifestyle */}
          <TabsContent value="lifestyle" className="px-3 sm:px-4 pt-4 pb-4">
            <PlayerLifestyleTab player={player} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Offer Contract Dialog */}
      <OfferContractDialog
        open={offerDialogOpen}
        onClose={() => setOfferDialogOpen(false)}
        player={player}
        playerContracts={playerContracts}
        existingActiveContract={null}
        onOffer={handleOfferContract}
        windowOpen={windowOpen}
        club={viewerClub}
      />

      {/* Transfer Payment Dialog */}
      <TransferPaymentDialog
        open={transferPayOpen}
        onClose={() => setTransferPayOpen(false)}
        player={player}
        targetClub={club}
        myClub={viewerClub}
        onPaid={() => {}}
      />

      {/* Lightbox */}
      {player.avatar_url && (
        <Dialog open={avatarLightboxOpen} onOpenChange={setAvatarLightboxOpen}>
          <DialogContent className="bg-[#0d1225] border-white/10 max-w-sm p-4">
            <DialogHeader><DialogTitle>{player.gamertag}</DialogTitle></DialogHeader>
            <div className="flex items-center justify-center">
              <img src={player.avatar_url} alt={player.gamertag} className="w-64 h-64 rounded-full object-cover" style={{ objectPosition: player.avatar_position || "50% 50%" }} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Followers Modal */}
      <Dialog open={followersModalOpen} onOpenChange={setFollowersModalOpen}>
        <DialogContent className="max-w-md bg-[#0d1225] border-white/10">
          <DialogHeader><DialogTitle>Followers</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <FollowList items={followersList} emptyLabel="No followers yet." onClose={() => setFollowersModalOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Following Modal */}
      <Dialog open={followingModalOpen} onOpenChange={setFollowingModalOpen}>
        <DialogContent className="max-w-md bg-[#0d1225] border-white/10">
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
  }[accent] || "text-white";

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
      <p className={cn("font-heading text-3xl font-black leading-none", accentClass)}>{value}</p>
      <p className="text-xs text-white/40 uppercase tracking-wider mt-1">{label}</p>
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
    return <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center"><p className="text-white/40 text-sm">{emptyLabel}</p></div>;
  }

  return (
    <>
      <input
        type="text"
        placeholder="Search by gamertag..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full mb-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-center text-sm text-white/40 py-4">No results found.</p>}
        {filtered.map(item => {
          const name = item.target_name || item._player_name || item.follower_email || "Unknown";
          const imageUrl = item.avatar_url || item.logo_url;
          const targetId = item._player_id || item._target_id || item.target_id;
          const targetType = item.target_type === "club" ? "clubs" : "players";
          return (
            <button
              key={item.id}
              onClick={() => { onClose?.(); navigate(`/${targetType}/${targetId}`); }}
              className="w-full text-left bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-blue-400/30 transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                {imageUrl ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-primary">{(name[0] || "?").toUpperCase()}</span>}
              </div>
              <p className="text-sm font-medium text-white truncate">{name}</p>
            </button>
          );
        })}
      </div>
    </>
  );
}