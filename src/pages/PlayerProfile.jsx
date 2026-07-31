import { useState, useEffect } from "react";
import PlayerFeed from "../components/PlayerFeed";
import { useParams, Link } from "react-router-dom";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import {
  ArrowLeft, Swords,
  Gamepad2, Settings,
  Coins, FileText, Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatSTC, calculatePlayerValue, getValueTier } from "@/lib/playerValue";
import { TrendingUp } from "lucide-react";
import { postContractNews } from "@/lib/notify";
import PlayerTrophyCabinet from "@/components/profile/PlayerTrophyCabinet";
import PlayerAchievementsSection from "@/components/rewards/PlayerAchievementsSection";
import PlayerLifestyleTab from "@/components/lifestyle/PlayerLifestyleTab";
import EafcClubLinkPanel from "@/components/dashboard/EafcClubLinkPanel";
import FutMatchLogPanel from "@/components/dashboard/FutMatchLogPanel";
import DashboardFutChart from "@/components/dashboard/DashboardFutChart";
import DashboardFormStrip from "@/components/dashboard/DashboardFormStrip";
import GamerProfileHero from "@/components/profile/gamer/GamerProfileHero";
import GamerProfileStatsPanel from "@/components/profile/gamer/GamerProfileStatsPanel";
import { GamerProfileShell, GamerSectionCard, GamerTabNav } from "@/components/profile/gamer/GamerProfileUI";
import { loadFutMatches, loadEafcSummary, buildFutFormStrip, buildFutWeeklyBuckets } from "@/lib/dashboardData";
import { CONTRACT_TYPES, getContractProgress } from "@/lib/contractTypes";
import OfferContractDialog from "@/components/contracts/OfferContractDialog";
import TransferPaymentDialog from "@/components/contracts/TransferPaymentDialog";
import { ensureContractOfferInbox } from "@/lib/contractOfferDelivery";
import { isTransferWindowOpen } from "@/lib/transferWindow";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/AuthContext";

function formatPositions(player) {
  return [player?.position, player?.secondary_position].filter(Boolean).join(" / ");
}

function normalizeClubRoles(roles) {
  if (Array.isArray(roles)) return roles;
  if (typeof roles === "string") {
    try {
      const parsed = JSON.parse(roles);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return roles.split(",").map((role) => role.trim()).filter(Boolean);
    }
  }
  return [];
}

function getVisibleClubRole(player, club, contracts = []) {
  const roles = normalizeClubRoles(player?.club_roles);
  const hasOwnershipContract = contracts.some((contract) => (
    contract?.contract_type === "ownership" &&
    ["active", "pending", "pending_window", "negotiating"].includes(contract?.status)
  ));
  const isClubCreator = Boolean(
    player && (
      roles.includes("president") ||
      roles.includes("owner") ||
      player.role === "president" ||
      player.role === "owner" ||
      hasOwnershipContract ||
      (club && player.email && club.owner_email && player.email.toLowerCase() === club.owner_email.toLowerCase()) ||
      (club && player.user_id && club.user_id && player.user_id === club.user_id)
    )
  );
  if (isClubCreator) return "president";
  if (roles.includes("captain") || player?.role === "captain") return "captain";
  if (roles.includes("vice-captain") || player?.role === "vice-captain") return "vice-captain";
  return player?.role && !["manager", "member", "owner"].includes(player.role) ? player.role : "";
}

export default function PlayerProfile({ overridePlayerId, tournamentId = null, editMode: _editMode } = {}) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const params = useParams();
  const id = overridePlayerId || params.id;
  const limitedTournamentId =
    tournamentId ||
    (authUser?.access_mode === "tournament_limited" ? authUser?.limited_tournament_id : null) ||
    null;
  const playersListPath = limitedTournamentId ? "/tournaments/players" : "/search";
  const ownProfilePath = limitedTournamentId ? "/tournaments/profile-player" : "/profile";
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
  const [futMatches, setFutMatches] = useState([]);
  const [eafcSummary, setEafcSummary] = useState(null);
  const navigate = useNavigate();
  const visibleClubRole = getVisibleClubRole(player, club, playerContracts);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const user = await stageClient.auth.me();
      setCurrentUser(user);

      const [playerResult, follows, allFollowers] = await Promise.all([
        stageClient.entities.Player.get(id),
        stageClient.entities.Follow.filter({ follower_email: user.email, target_id: id, target_type: "player" }),
        stageClient.entities.Follow.filter({ target_id: id }),
      ]);
      const players = playerResult ? [playerResult] : [];
      setFollowersCount(allFollowers.length);

      const enrichedFollowers = await Promise.all(
        allFollowers.filter(f => f.follower_player_id).map(async (f) => {
          const pl = await stageClient.entities.Player.get(f.follower_player_id).catch(() => null);
          return { ...f, _player_id: f.follower_player_id, _player_name: pl?.gamertag, avatar_url: pl?.avatar_url };
        })
      );
      setFollowersList(enrichedFollowers);

      const { player: myPl, club: myClubResolved } = await resolveMyPlayerAndClub();
      if (myPl) setMyPlayer(myPl);

      if (players.length > 0 && players[0].id && players[0].email) {
        const p = players[0];
        setPlayer(p);
        if (p.club_id) {
          const [clubs, tmHome, tmAway] = await Promise.all([
            stageClient.entities.Club.get(p.club_id).then((clubRecord) => clubRecord ? [clubRecord] : []).catch(() => stageClient.entities.Club.filter({ id: p.club_id })),
            stageClient.profileMatches.list({ home_club_id: p.club_id, status: "scheduled" }, "round", 20),
            stageClient.profileMatches.list({ away_club_id: p.club_id, status: "scheduled" }, "round", 20),
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
      if (acctMode === "club" && myClubResolved) {
        setViewerClub(myClubResolved);
      }

      // Transfer window
      try {
        const winRes = await stageClient.functions.invoke("transferWindowActions", { action: "get_current" });
        setWindowOpen(isTransferWindowOpen(winRes?.data?.window));
      } catch { setWindowOpen(false); }

      const matchStats = await stageClient.entities.MatchPlayerStat.filter({ player_email: p.email });
        const matchIds = [...new Set(matchStats.map(s => s.match_id))];
        let filteredStats = matchStats;
        if (matchIds.length > 0) {
          const matchRecords = await Promise.all(
            matchIds.slice(0, 50).map(mid => (
              stageClient.profileMatches.list({ id: mid }, null, 1).catch(() => [])
            ))
          );
          const friendlyMatchIds = new Set(
            matchRecords.flat().filter(m => m.type === "friendly").map(m => m.id)
          );
          filteredStats = matchStats.filter(s => !friendlyMatchIds.has(s.match_id));
        }
        const totalGoals = filteredStats.reduce((s, r) => s + (r.goals || 0), 0);
        const totalAssists = filteredStats.reduce((s, r) => s + (r.assists || 0), 0);
        const ratings = filteredStats.filter(r => r.rating > 0).map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) : 0;
        setClubStats({ matches: filteredStats.length, goals: totalGoals, assists: totalAssists, avgRating });

        const [pvpHome, pvpAway] = await Promise.all([
          stageClient.profileMatches.list({ home_player_id: p.id, status: "completed" }, "-updated_date", 50),
          stageClient.profileMatches.list({ away_player_id: p.id, status: "completed" }, "-updated_date", 50),
        ]);
        const allPvp = [...pvpHome, ...pvpAway].filter(m => m.mode === "solo" || (!m.mode && m.home_player_id));
        const pvpMap = new Map();
        allPvp.forEach(m => pvpMap.set(m.id, m));
        setPvpMatches([...pvpMap.values()].sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date)));

        const [futRows, eafcData] = await Promise.all([
          loadFutMatches(p, 20),
          p.eafc_club_id ? loadEafcSummary(p) : Promise.resolve(null),
        ]);
        setFutMatches(futRows);
        setEafcSummary(eafcData);
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
      try { const f = await stageClient.entities.Player.get(player.id); recipientEmail = f?.email || null; } catch { }
    }
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
    // This legacy profile path creates contracts directly, unlike Transfer Market.
    // Do not add more delivery calls here; move offer creation to the server path.
    await ensureContractOfferInbox({
      contractId: newContract.id,
      player: { ...player, email: recipientEmail || player.email },
      club: viewerClub,
      contractType: terms.contract_type,
      maxGames: typeMeta.max_games,
      maxDays: typeMeta.max_days,
      weeklySalary: terms.weekly_salary_stc,
      signingBonus: terms.signing_bonus_stc,
      offerNote: terms.offer_note,
      senderEmail: myPlayer?.email,
    }).catch((err) => console.warn("[PlayerProfile] inbox fallback failed:", err?.message || err));
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
        <p className="text-white/50">{t("commonPages.ppNotFound")}</p>
        <Link to={playersListPath}><Button variant="outline" className="mt-4">{t("commonPages.ppBackToSearch")}</Button></Link>
      </div>
    );
  }

  const isOwner = currentUser?.email === player.email;

  const OUTCOME_STYLE = {
    W: "bg-success/15 text-success border-success/30",
    L: "bg-destructive/15 text-destructive border-destructive/30",
    D: "bg-warning/15 text-warning border-warning/30",
  };

  const profileTabs = [
    { id: "posts", label: t("commonPages.ppTab_posts") },
    { id: "stats", label: t("commonPages.ppTab_stats") },
    { id: "career", label: t("commonPages.ppTab_career") },
    { id: "matches", label: t("commonPages.ppTab_matches") },
    { id: "trophies", label: t("commonPages.ppTab_trophies") },
    ...(!limitedTournamentId ? [{ id: "lifestyle", label: t("commonPages.ppTab_lifestyle") }] : []),
  ];

  const marketValue = calculatePlayerValue(player);
  const valueTier = getValueTier(marketValue);
  const roleBadges = visibleClubRole ? [visibleClubRole] : [];

  let recentForm = [];
  try { recentForm = JSON.parse(player.form_last10 || "[]"); } catch { /* ignore */ }

  const pvpW = pvpMatches.filter(m => m.home_player_id === player.id ? m.home_score > m.away_score : m.away_score > m.home_score).length;
  const pvpL = pvpMatches.filter(m => m.home_player_id === player.id ? m.home_score < m.away_score : m.away_score < m.home_score).length;
  const pvpD = pvpMatches.filter(m => m.home_score === m.away_score).length;

  return (
    <GamerProfileShell>
      <div className="px-4 pt-4 max-w-6xl mx-auto">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("commonPages.profBack")}
        </button>
      </div>

      <GamerProfileHero
        player={player}
        user={null}
        club={club}
        roleBadges={roleBadges}
        formatPositions={formatPositions}
        onAvatarClick={player.avatar_url ? () => setAvatarLightboxOpen(true) : undefined}
        verifiedHandle={
          Number(player.is_verified) === 1 && player.verified_platform_handle
            ? `${player.verified_platform || "Platform"} · ${player.verified_platform_handle}`
            : null
        }
        topActions={null}
        sideActions={(
          <>
            {isOwner ? (
              <Link to={ownProfilePath}>
                <Button type="button" size="sm" variant="outline" className="gap-1.5 h-9 px-3 text-xs border-white/15 text-white hover:bg-white/10 bg-white/[0.03] font-heading uppercase">
                  <Settings className="w-3.5 h-3.5" /> {t("commonPages.profEditProfile")}
                </Button>
              </Link>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={toggleFollow}
                  className={cn("h-9 px-4 text-xs font-heading uppercase", isFollowing ? "bg-white/10 border border-white/20 text-white" : "bg-gradient-to-r from-cyan-500/80 to-teal-500/80 hover:from-cyan-400 hover:to-teal-400 text-black font-black")}
                >
                  {isFollowing ? t("commonPages.cdUnfollow") : t("commonPages.cdFollow")}
                </Button>
                {viewerClub && !limitedTournamentId ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setOfferDialogOpen(true)}
                      className="gap-1.5 h-9 px-3 text-xs border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/10 bg-transparent font-heading uppercase"
                    >
                      <FileText className="w-3.5 h-3.5" /> {t("commonPages.offerContract")}
                    </Button>
                    {player.club_id && player.club_id !== viewerClub.id && club ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setTransferPayOpen(true)}
                        className="gap-1.5 h-9 px-3 text-xs border-amber-400/30 text-amber-300 hover:bg-amber-500/10 bg-transparent font-heading uppercase"
                      >
                        <Coins className="w-3.5 h-3.5" /> {t("commonPages.ppTransferFee")}
                      </Button>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </>
        )}
        followers={(
          <div className="flex items-center gap-3 text-sm">
            <button type="button" onClick={() => setFollowersModalOpen(true)} className="hover:opacity-70 transition-opacity">
              <span className="font-bold text-white">{followersCount}</span>
              <span className="text-white/40 ml-1 text-xs">{t("commonPages.cdFollowersLower")}</span>
            </button>
            <span className="text-white/20">·</span>
            <button type="button" onClick={() => setFollowingModalOpen(true)} className="hover:opacity-70 transition-opacity">
              <span className="font-bold text-white">{followingCount}</span>
              <span className="text-white/40 ml-1 text-xs">{t("commonPages.ppFollowingLower")}</span>
            </button>
          </div>
        )}
      >
        {activeContract ? (() => {
          const progress = getContractProgress(activeContract);
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeContract.weekly_salary_stc > 0 ? (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                  <Coins className="w-2.5 h-2.5" />{formatSTC(activeContract.weekly_salary_stc)}/wk
                </span>
              ) : null}
              <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/50 font-medium capitalize">
                <FileText className="w-2.5 h-2.5" />{activeContract.contract_type} contract
              </span>
              {progress && progress.daysLeft > 0 ? (
                <span className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium",
                  progress.daysLeft <= 7 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-white/5 border-white/10 text-white/50"
                )}>
                  <Clock className="w-2.5 h-2.5" />{progress.daysLeft}d left
                </span>
              ) : null}
              {progress && progress.gamesLeft > 0 ? (
                <span className={cn("flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-medium",
                  progress.gamesLeft <= 10 ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : "bg-white/5 border-white/10 text-white/50"
                )}>
                  <Gamepad2 className="w-2.5 h-2.5" />{progress.gamesLeft} games left
                </span>
              ) : null}
            </div>
          );
        })() : null}
      </GamerProfileHero>

      <div className="max-w-6xl mx-auto px-4 mt-6 space-y-5 pb-10">
        <GamerTabNav tabs={profileTabs} active={activeTab} onChange={setActiveTab} />

        {activeTab === "posts" ? (
          <div className="pt-2">
            <PlayerFeed currentUser={currentUser} player={player} isOwner={isOwner} />
          </div>
        ) : null}

        {activeTab === "stats" ? (
          <div className="pt-2 space-y-4">
            <div className={cn("rounded-2xl border p-4 flex items-center gap-4", valueTier.bg, valueTier.border)}>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.22em] text-white/40 mb-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> {t("commonPages.marketValue")}
                </p>
                <p className={cn("font-heading text-3xl font-black leading-none", valueTier.color)}>{formatSTC(marketValue)}</p>
                <p className={cn("text-xs font-semibold mt-1", valueTier.color)}>{valueTier.label}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] uppercase tracking-wider text-white/40">OVR</p>
                <p className="font-heading text-2xl font-black text-cyan-400 leading-none">{player.overall_rating || 70}</p>
                <p className="text-[10px] text-white/40 mt-1">{player.position}</p>
              </div>
            </div>

            <GamerProfileStatsPanel player={{ ...player, matches_played: player.matches_played ?? clubStats?.matches ?? 0, goals: player.goals ?? clubStats?.goals ?? 0, assists: player.assists ?? clubStats?.assists ?? 0, avg_match_rating: player.avg_match_rating > 0 ? player.avg_match_rating : (clubStats?.avgRating || 6) }} t={t} />

            {recentForm.length > 0 ? (
              <GamerSectionCard title={t("commonPages.ppRecentForm", { count: recentForm.length })}>
                <div className="flex gap-1.5 flex-wrap">
                  {recentForm.map((r, i) => {
                    const col = r >= 8 ? "bg-amber-400/80 text-black" : r >= 7 ? "bg-emerald-500/80 text-black" : r >= 6 ? "bg-cyan-500/60 text-white" : "bg-white/10 text-white/60";
                    return (
                      <span key={i} className={cn("w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black", col)}>
                        {r.toFixed(1)}
                      </span>
                    );
                  })}
                </div>
              </GamerSectionCard>
            ) : null}

            {pvpMatches.length > 0 ? (
              <GamerSectionCard title={t("commonPages.ppPvpRecord")}>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
                    <p className="font-heading text-2xl font-black text-emerald-400">{pvpW}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">{t("commonPages.profWins")}</p>
                  </div>
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-center">
                    <p className="font-heading text-2xl font-black text-amber-400">{pvpD}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">{t("commonPages.cdDraws")}</p>
                  </div>
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center">
                    <p className="font-heading text-2xl font-black text-rose-400">{pvpL}</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">{t("commonPages.profLosses")}</p>
                  </div>
                </div>
              </GamerSectionCard>
            ) : null}
          </div>
        ) : null}

        {activeTab === "career" ? (
          <div className="pt-2 space-y-4">
            {player.eafc_club_id || futMatches.length > 0 ? (
              <>
                {player.eafc_club_id ? (
                  <div className="[&_.rounded-2xl]:border-white/10 [&_.rounded-2xl]:bg-white/[0.03]">
                    <EafcClubLinkPanel player={player} eafcSummary={eafcSummary} readOnly compact />
                  </div>
                ) : null}
                {futMatches.length > 0 ? (
                  <div className="space-y-4 [&_.rounded-2xl]:border-white/10 [&_.rounded-2xl]:bg-white/[0.03]">
                    <DashboardFormStrip
                      label={t("commonPages.dashboardFutForm")}
                      mode="outcome"
                      items={buildFutFormStrip(futMatches, 10)}
                    />
                    <DashboardFutChart
                      weekly={buildFutWeeklyBuckets(futMatches, 8)}
                      winsLabel={t("commonPages.dashboardFutWins")}
                      lossesLabel={t("commonPages.dashboardFutLosses")}
                      emptyLabel={t("commonPages.dashboardFutChartEmpty")}
                    />
                    <FutMatchLogPanel playerId={player.id} initialMatches={futMatches} readOnly compact />
                  </div>
                ) : null}
              </>
            ) : (
              <GamerSectionCard>
                <p className="text-sm text-white/40 text-center py-6">{t("commonPages.dashboardFutEmpty")}</p>
              </GamerSectionCard>
            )}
          </div>
        ) : null}

        {activeTab === "matches" ? (
          <div className="pt-2 space-y-4">
            {upcomingMatches.length > 0 ? (
              <GamerSectionCard title={t("commonPages.homeUpcoming")}>
                <div className="space-y-2">
                  {upcomingMatches.map(m => {
                    const isHome = m.home_club_id === club?.id;
                    const oppName = isHome ? m.away_club_name : m.home_club_name;
                    const dateStr = m.scheduled_date ? new Date(m.scheduled_date).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "TBD";
                    return (
                      <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0">
                          <Swords className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">vs {oppName}</p>
                          <p className="text-xs text-white/40">{t("commonPages.ppRound", { round: m.round })}</p>
                        </div>
                        <p className="text-xs text-white/40 shrink-0">{dateStr}</p>
                      </div>
                    );
                  })}
                </div>
              </GamerSectionCard>
            ) : null}

            {pvpMatches.length > 0 ? (
              <GamerSectionCard title={t("commonPages.ppPvpHistory")}>
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
                      <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 flex items-center gap-2 sm:gap-3">
                        <span className={cn("text-xs font-bold px-2 py-1 rounded border shrink-0", OUTCOME_STYLE[outcome])}>{outcome}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">vs {opponent || t("commonPages.homeUnknown")}</p>
                          <p className="text-[10px] text-white/40">{dateStr}</p>
                        </div>
                        <span className="text-sm font-bold text-white shrink-0">{scoreStr}</span>
                      </div>
                    );
                  })}
                </div>
              </GamerSectionCard>
            ) : null}

            {upcomingMatches.length === 0 && pvpMatches.length === 0 ? (
              <GamerSectionCard>
                <div className="py-10 text-center">
                  <Swords className="w-10 h-10 text-white/20 mx-auto mb-3" />
                  <p className="text-sm text-white/40">{t("commonPages.cdNoMatches")}</p>
                </div>
              </GamerSectionCard>
            ) : null}
          </div>
        ) : null}

        {activeTab === "trophies" ? (
          <div className="pt-2 space-y-6">
            <PlayerAchievementsSection playerId={player?.id} />
            <PlayerTrophyCabinet player={player} currentUserEmail={currentUser?.email} />
          </div>
        ) : null}

        {activeTab === "lifestyle" ? (
          <div className="pt-2">
            <PlayerLifestyleTab player={player} />
          </div>
        ) : null}
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
          <DialogHeader><DialogTitle>{t("commonPages.cdFollowers")}</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <FollowList items={followersList} emptyLabel={t("commonPages.cdNoFollowers")} onClose={() => setFollowersModalOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Following Modal */}
      <Dialog open={followingModalOpen} onOpenChange={setFollowingModalOpen}>
        <DialogContent className="max-w-md bg-[#0d1225] border-white/10">
          <DialogHeader><DialogTitle>{t("commonPages.ppFollowingTitle")}</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <FollowList items={followingList} emptyLabel={t("commonPages.ppNotFollowing")} onClose={() => setFollowingModalOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </GamerProfileShell>
  );
}

function FollowList({ items, emptyLabel, onClose }) {
  const { t } = useTranslation();
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
        placeholder={t("commonPages.searchGamertag")}
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full mb-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-center text-sm text-white/40 py-4">{t("commonPages.cdNoResults")}</p>}
        {filtered.map(item => {
          const name = item.target_name || item._player_name || item.follower_email || t("commonPages.homeUnknown");
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
