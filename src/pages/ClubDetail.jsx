import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { stageClient } from "@/api/stageClient";
import {
  Shield, Users, Trophy, ArrowLeft,
  Check, X, Camera, Send, Loader2, LogOut,
  Trash2, Swords, Save, Edit2, ClipboardList, Clock
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES } from "../lib/countries";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import BannerSelector from "../components/BannerSelector";
import ImagePositionEditor from "../components/ImagePositionEditor";
import { getBannerStyle } from "@/lib/storeItems";
import FormationPitch from "../components/FormationPitch";
import ClubFeed from "../components/ClubFeed";
import ClubForm from "../components/ClubForm";
import ClubPlayerStats from "../components/ClubPlayerStats";
import ContractsTab from "../components/contracts/ContractsTab";
import ClubFinanceTab from "../components/club/ClubFinanceTab";
import ShirtSalesPanel from "../components/ShirtSalesPanel";
import StadiumUpgrade from "../components/club/StadiumUpgrade";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/notify";
import { useNavigate } from "react-router-dom";
import { ClubTrophyCabinetDisplay } from "@/components/profile/PlayerTrophyCabinet";
import ClubAchievementsTab from "@/components/rewards/ClubAchievementsTab";

export default function ClubDetail() {
  const { id } = useParams();
  const [club, setClub] = useState(null);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tournamentMatches, setTournamentMatches] = useState([]);
  const [tournamentMap, setTournamentMap] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followId, setFollowId] = useState(null);
  const [followersCount, setFollowersCount] = useState(0);
  const [joinRequests, setJoinRequests] = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [trialRequestSent, setTrialRequestSent] = useState(false);
  const [sendingTrial, setSendingTrial] = useState(false);
  const [trialMsg, setTrialMsg] = useState("");
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [_myClubData, setMyClubData] = useState(null);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [logoPreviewOpen, setLogoPreviewOpen] = useState(false);
  const [pendingLogo, setPendingLogo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playerFollowMap, setPlayerFollowMap] = useState({});
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followersList, setFollowersList] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [historyRows,   setHistoryRows]   = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [editClubOpen, setEditClubOpen] = useState(false);
  const [clubForm, setClubForm] = useState({ name: "", tag: "", platform: "", region: "", description: "", country_code: "" });
  const [savingClub, setSavingClub] = useState(false);
  const navigate = useNavigate();
  const logoInputRef  = useRef();
  const pendingFileRef = useRef(null);

  const isMember = !!myPlayer?.club_id && myPlayer.club_id === id;
  const isCaptain = isMember && (myPlayer?.role === "captain" || myPlayer?.role === "vice-captain");
  const isAdminTakeover = currentUser?.role === "admin" && localStorage.getItem("admin_takeover_club_id") === id;
  const accountMode = localStorage.getItem("stage-account-mode") || "player";
  const isOwner = (club?.owner_email === currentUser?.email && accountMode === "club") || isAdminTakeover;
  const isPresident = isMember && myPlayer?.club_roles?.includes("president");
  const canEdit = isOwner || isCaptain;

  useEffect(() => {
    async function load() {
      const user = await stageClient.auth.me();
      setCurrentUser(user);

      const [clubData, playerData, myPl] = await Promise.all([
        stageClient.entities.Club.filter({ id }, null, 1),
        stageClient.entities.Player.filter({ club_id: id }),
        stageClient.entities.Player.filter({ email: user.email }),
      ]);

      const [matchesHome, matchesAway, followData, allFollowersData] = await Promise.all([
        stageClient.entities.Match.filter({ home_club_id: id, status: "completed" }, "round", 30),
        stageClient.entities.Match.filter({ away_club_id: id, status: "completed" }, "round", 30),
        stageClient.entities.Follow.filter({ follower_email: user.email, target_id: id, target_type: "club" }),
        stageClient.entities.Follow.filter({ target_id: id, target_type: "club" }),
      ]);

      const [tmHome, tmAway] = await Promise.all([
        stageClient.entities.Match.filter({ home_club_id: id, status: "scheduled" }, "round", 30),
        stageClient.entities.Match.filter({ away_club_id: id, status: "scheduled" }, "round", 30),
      ]);

      const allMatchesRaw = [...matchesHome, ...matchesAway, ...tmHome, ...tmAway];
      const tIds = [...new Set(allMatchesRaw.map(m => m.tournament_id).filter(tid => tid && tid !== "ranked"))];
      let tMap = {};
      if (tIds.length > 0) {
        const tResults = await Promise.all(tIds.map(tid => stageClient.entities.Tournament.filter({ id: tid }, null, 1)));
        tResults.forEach(arr => { if (arr[0]) tMap[arr[0].id] = arr[0]; });
      }
      setTournamentMap(tMap);

      const playerFollows = playerData.length > 0
        ? await stageClient.entities.Follow.filter({ follower_email: user.email, target_type: "player" })
        : [];
      const pfMap = {};
      for (const f of playerFollows) { pfMap[f.target_id] = f; }

      const c = clubData[0] || null;
      setClub(c);
      if (c) {
        setClubForm({
          name: c.name || "",
          tag: c.tag || "",
          platform: c.platform || "PlayStation",
          region: c.region || "Europe",
          description: c.description || "",
          country_code: c.country_code || "",
        });
      }
      setPlayers(playerData);
      setPlayerFollowMap(pfMap);

      const allMatches = [...matchesHome, ...matchesAway].sort(
        (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
      );
      setMatches(allMatches);
      setTournamentMatches([...tmHome, ...tmAway].sort((a, b) => new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0)));

      if (followData.length > 0) { setIsFollowing(true); setFollowId(followData[0].id); }
      setFollowersCount(allFollowersData.length);
      setFollowersList(allFollowersData);

      if (myPl.length > 0) {
        setMyPlayer(myPl[0]);
        if (myPl[0].club_id && myPl[0].club_id !== id) {
          const myClubArr = await stageClient.entities.Club.filter({ id: myPl[0].club_id });
          if (myClubArr.length > 0) setMyClubData(myClubArr[0]);
        }
      }

      if (myPl.length > 0 && (
        myPl[0].role === "captain" ||
        myPl[0].role === "vice-captain" ||
        myPl[0].club_roles?.includes("president") ||
        clubData[0]?.owner_email === user.email
      )) {
        const reqs = await stageClient.entities.JoinRequest.filter({ club_id: id, status: "pending" });
        setJoinRequests(reqs);
      }

      // Check if this player already sent a trial request to this club
      if (myPl.length > 0) {
        const existingTrials = await stageClient.entities.InboxMessage.filter(
          { sender_email: user.email, message_type: "trial_request" }, null, 20
        ).catch(() => []);
        const sentToThisClub = existingTrials.some(m => (m.metadata?.club_id === id || m.related_entity_id === id));
        if (sentToThisClub) setTrialRequestSent(true);
      }

      setLoading(false);
    }
    load();

    const unsubPlayer = stageClient.entities.Player.subscribe((event) => {
      if (event.type === "update" && event.data.club_id === id) {
        setPlayers(prev => prev.map(p => p.id === event.id ? event.data : p));
      }
    });
    return () => { unsubPlayer(); };
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
        target_type: "club",
        target_name: club?.name,
      });
      setIsFollowing(true); setFollowId(f.id);
      setFollowersCount(c => c + 1);
    }
  }

  async function sendTrialRequest() {
    if (!myPlayer || !club) return;
    setSendingTrial(true);
    try {
      await stageClient.entities.InboxMessage.create({
        recipient_email:   club.owner_email,
        sender_email:      currentUser.email,
        sender_gamertag:   myPlayer.gamertag,
        sender_avatar_url: myPlayer.avatar_url || "",
        subject:           `⚽ Trial Request from ${myPlayer.gamertag}`,
        body:              `${myPlayer.gamertag} is requesting a trial at ${club.name}.\n\nPosition: ${myPlayer.position || "N/A"} · OVR: ${myPlayer.overall_rating || "N/A"}\n\n${trialMsg ? `Message: "${trialMsg}"\n\n` : ""}You can offer a trial contract directly from your inbox below.`,
        message_type:      "trial_request",
        action_type:       "trial_response",
        related_entity_id: id,
        status:            "pending",
        is_read:           false,
        metadata: {
          player_id:        myPlayer.id,
          player_gamertag:  myPlayer.gamertag,
          player_email:     currentUser.email,
          player_avatar_url: myPlayer.avatar_url || "",
          player_position:  myPlayer.position || "",
          player_overall:   myPlayer.overall_rating || 70,
          club_id:          id,
          club_name:        club.name,
          club_logo_url:    club.logo_url || "",
        },
      });
      await notify(club.owner_email, "club_update",
        `⚽ Trial Request — ${myPlayer.gamertag}`,
        `${myPlayer.gamertag} is requesting a trial at ${club.name}. Check your inbox to respond.`,
        "/inbox"
      );
      setTrialRequestSent(true);
      setTrialDialogOpen(false);
      setTrialMsg("");
    } catch (err) {
      console.error("Failed to send trial request:", err);
    } finally {
      setSendingTrial(false);
    }
  }

  async function assignRole(targetPlayer, role) {
    const currentHolders = players.filter(p => (p.club_roles?.includes(role) || p.role === role) && p.id !== targetPlayer.id);
    await Promise.all(currentHolders.map(p =>
      stageClient.entities.Player.update(p.id, {
        club_roles: (p.club_roles || []).filter(r => r !== role),
        role: p.role === role ? "member" : p.role,
      })
    ));
    const otherRoles = (targetPlayer.club_roles || []).filter(r => r !== "captain" && r !== "vice-captain");
    const newRoles = [...new Set([...otherRoles, role])];
    const primaryRole = newRoles.includes("captain") ? "captain" : newRoles.includes("vice-captain") ? "vice-captain" : "member";
    await stageClient.entities.Player.update(targetPlayer.id, { club_roles: newRoles, role: primaryRole });
    const updated = await stageClient.entities.Player.filter({ club_id: id });
    setPlayers(updated);
  }

  async function handleJoinRequest(reqId, action) {
    const req = joinRequests.find(r => r.id === reqId);
    if (!req) return;
    await stageClient.entities.JoinRequest.update(reqId, { status: action });
    setJoinRequests(prev => prev.filter(r => r.id !== reqId));
    if (action === "approved") {
      await stageClient.entities.Player.update(req.player_id, { club_id: id, role: "member", club_roles: ["member"] });
      setPlayers(prev => [...prev, { id: req.player_id, email: req.player_email, gamertag: req.player_gamertag, club_id: id, role: "member", club_roles: ["member"] }]);
    }
  }

  function uploadLogo(e) {
    const file = e.target.files[0];
    if (!file) return;
    pendingFileRef.current = file;
    const localUrl = URL.createObjectURL(file);
    setPendingLogo(localUrl);
    e.target.value = "";
  }

  async function loadHistory() {
    if (historyLoaded) return;
    const [compRows, leagueRows] = await Promise.all([
      (base44.entities.CompetitionStanding?.filter({ club_id: id }, null, 100) ?? Promise.resolve([])).catch(() => []),
      (base44.entities.RegionalLeagueStanding?.filter({ club_id: id }, null, 100) ?? Promise.resolve([])).catch(() => []),
    ]);
    const comp = compRows.map(r => ({
      type: "competition",
      name: r.competition_name || "Competition",
      season: r.season_number || 0,
      pos: r.final_position || r.position || null,
      w: r.wins || 0, d: r.draws || 0, l: r.losses || 0,
      pts: r.points || 0,
      winner: r.final_position === 1,
      promoted: r.is_promoted || false,
      relegated: r.is_relegated || false,
    }));
    const league = leagueRows.map(r => ({
      type: "league",
      name: r.league_name || "League",
      season: r.season_number || 0,
      pos: r.final_position || r.position || null,
      w: r.wins || 0, d: r.draws || 0, l: r.losses || 0,
      pts: r.points || 0,
      winner: r.final_position === 1,
      promoted: r.is_promoted || false,
      relegated: r.is_relegated || false,
    }));
    const merged = [...comp, ...league].sort((a, b) => b.season - a.season);
    setHistoryRows(merged);
    setHistoryLoaded(true);
  }

  async function handleDeleteClub() {
    setDeleting(true);
    await stageClient.functions.invoke("deleteClub", { club_id: id });
    setDeleting(false);
    setDeleteDialogOpen(false);
    navigate("/clubs");
  }

  async function saveLogo(localUrl, position, _zoom) {
    const file = pendingFileRef.current;
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
      await stageClient.entities.Club.update(id, { logo_url: file_url, logo_position: position });
      setClub(prev => ({ ...prev, logo_url: file_url, logo_position: position }));
      URL.revokeObjectURL(localUrl);
      pendingFileRef.current = null;
    } catch (err) {
      console.error("Failed to save logo:", err);
    } finally {
      setUploadingLogo(false);
      setPendingLogo(null);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full min-h-screen bg-[#06091a]"><div className="w-8 h-8 border-4 border-white/10 border-t-blue-400 rounded-full animate-spin" /></div>;
  }

  if (!club) {
    return <div className="p-6 text-center"><p className="text-white/50">Club not found.</p><Link to="/clubs"><Button variant="outline" className="mt-4">Back</Button></Link></div>;
  }

  const confirmedMatches = matches.filter(m => m.status === "completed");
  const totalGames = confirmedMatches.length;
  const wins = confirmedMatches.filter(m => {
    const isHome = m.home_club_id === id;
    const myScore = isHome ? m.home_score : m.away_score;
    const oppScore = isHome ? m.away_score : m.home_score;
    return myScore > oppScore;
  }).length;
  const losses = confirmedMatches.filter(m => {
    const isHome = m.home_club_id === id;
    const myScore = isHome ? m.home_score : m.away_score;
    const oppScore = isHome ? m.away_score : m.home_score;
    return myScore < oppScore;
  }).length;
  const draws = totalGames - wins - losses;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  const OUTCOME_STYLE = {
    W: "bg-success/15 text-success border-success/30",
    L: "bg-destructive/15 text-destructive border-destructive/30",
    D: "bg-warning/15 text-warning border-warning/30",
  };

  return (
    <div className="min-h-screen bg-[#06091a] text-white">
      {/* Dialogs */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#0d1225] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Delete Club</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              Are you sure you want to delete <strong className="text-white">{club?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClub} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {deleting ? "Deleting..." : "Delete Club"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Back */}
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {isAdminTakeover && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/30 ml-auto">
            <Shield className="w-3.5 h-3.5 text-warning shrink-0" />
            <span className="text-xs text-warning font-medium">Admin Takeover</span>
            <button onClick={() => { localStorage.removeItem('admin_takeover_club_id'); window.location.href = '/admin'; }} className="text-xs text-warning/70 hover:text-warning ml-1 flex items-center gap-1">
              <LogOut className="w-3 h-3" /> Exit
            </button>
          </div>
        )}
      </div>

      {/* Banner */}
      <div
        className="relative h-52 sm:h-72 md:h-80 mt-2 overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.18)] group cursor-pointer"
        style={{ marginLeft: "calc(-50vw + 50%)", width: "100vw" }}
        onClick={() => canEdit && setBannerDialogOpen(true)}
      >
        <div className="absolute inset-0" style={getBannerStyle(club?.banner_url, club?.banner_position)} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 50%)" }} />
        {canEdit && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="flex items-center gap-2 text-white text-sm font-medium bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
              <Camera className="w-4 h-4" /> Change Banner
            </span>
          </div>
        )}
        {canEdit && (
          <div className="absolute top-4 right-4 z-10" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setEditClubOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-colors text-white/70 text-xs font-medium"
            >
              <Edit2 className="w-4 h-4" /> Edit Club
            </button>
          </div>
        )}
      </div>

      {/* Profile header */}
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-end justify-between -mt-20 mb-4 relative z-10">
          {/* Logo */}
          <div className="relative group shrink-0">
            <div
              className="w-24 h-24 rounded-full border-2 border-white/20 shadow-2xl shadow-blue-500/20 flex items-center justify-center overflow-hidden cursor-pointer"
              onClick={() => club.logo_url && setLogoPreviewOpen(true)}
            >
              {club.logo_url
                ? <div className="w-full h-full" style={{ backgroundImage: `url(${club.logo_url})`, backgroundSize: "cover", backgroundPosition: club.logo_position || "50% 50%" }} />
                : <Shield className="w-9 h-9 text-primary" />
              }
            </div>
            {canEdit && (
              <>
                <button
                  onClick={() => !uploadingLogo && logoInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  {uploadingLogo ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
                </button>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {!isMember && (
              <Button
                size="sm"
                onClick={toggleFollow}
                className={cn(isFollowing ? "bg-white/10 border border-white/20 text-white" : "bg-blue-600 hover:bg-blue-500 text-white")}
              >
                {isFollowing ? "Unfollow" : "Follow"}
              </Button>
            )}
          </div>
        </div>

        {/* Club name + info */}
        <div className="space-y-2 mb-5">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-heading text-3xl sm:text-4xl font-black text-white uppercase tracking-tight leading-none" style={{ letterSpacing: "-0.02em" }}>
              {club.name}
            </h1>
            <span className="text-xs px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-400 font-bold font-mono border border-blue-500/20">[{club.tag}]</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-white/50 flex-wrap font-medium uppercase tracking-wider">
            <span>{club.platform}</span>
            <span className="text-white/20">·</span>
            <span>{club.region}</span>
          </div>
          {club.description && <p className="text-sm text-white/60 leading-relaxed mt-1">{club.description}</p>}
          <div className="flex items-center gap-3 text-sm">
            <button onClick={() => setFollowersModalOpen(true)} className="hover:opacity-70 transition-opacity">
              <span className="font-bold text-white">{followersCount}</span>
              <span className="text-white/40 ml-1 text-xs">followers</span>
            </button>
          </div>
          {/* Form display */}
          <div className="mt-1">
            <ClubForm matches={matches} clubId={id} />
          </div>
        </div>


        {/* Trial request — visible to signed-in players who are not members */}
        {!isMember && !isOwner && myPlayer && (
          <div className="pt-2">
            {trialRequestSent ? (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-warning/30 bg-warning/10 text-warning font-medium">
                <Clock className="w-3 h-3" /> Trial Request Sent
              </span>
            ) : (
              <Dialog open={trialDialogOpen} onOpenChange={setTrialDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="border-white/20 text-white/60 hover:text-white hover:border-white/40 text-xs gap-1.5 h-7 px-3">
                    <ClipboardList className="w-3 h-3" /> Request Trial
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0d1225] border-white/10">
                  <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" /> Request Trial at {club.name}</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-2">
                    <p className="text-sm text-white/60 leading-relaxed">
                      Send a trial request to <span className="text-white font-medium">{club.name}</span>. The club owner will receive your request in their inbox and can respond with a <span className="text-primary font-medium">trial contract</span> (5 games / 14 days).
                    </p>
                    <Textarea
                      value={trialMsg}
                      onChange={e => setTrialMsg(e.target.value)}
                      className="bg-white/5 border-white/10 resize-none"
                      rows={3}
                      placeholder="Tell the club why you'd be a great fit... (optional)"
                    />
                    <Button onClick={sendTrialRequest} disabled={sendingTrial} className="w-full bg-primary text-primary-foreground gap-2">
                      {sendingTrial ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {sendingTrial ? "Sending..." : "Send Trial Request"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="max-w-5xl mx-auto mt-0">
        <Tabs value={activeTab} onValueChange={t => { setActiveTab(t); if (t === "history") loadHistory(); }} className="w-full">
          <TabsList className="w-full rounded-none border-b border-white/10 bg-transparent h-auto p-0 gap-0 flex-wrap">
            {[
              "posts", "stats", "matches", "squad", "formation", "trophies", "history",
              ...(isOwner ? ["stadium", "contracts", "finance", "shirts"] : []),
              ...((isCaptain || isOwner) && joinRequests.length > 0 ? ["requests"] : [])
            ].map(tab => (
              <TabsTrigger
                key={tab}
                value={tab}
                className={cn(
                  "flex-1 min-w-fit rounded-none border-b-2 border-transparent pb-3 pt-3 text-xs uppercase tracking-widest font-bold text-white/40 transition-colors",
                  "data-[state=active]:border-blue-400 data-[state=active]:text-blue-400 data-[state=active]:bg-transparent"
                )}
              >
                {tab === "requests" ? `Requests (${joinRequests.length})` : tab}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Posts */}
          <TabsContent value="posts" className="mt-0 px-4 pt-4">
            <ClubFeed club={club} currentUser={currentUser} myPlayer={myPlayer} isMember={isMember} />
          </TabsContent>

          {/* Stats */}
          <TabsContent value="stats" className="px-4 pt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-success">{wins}</p>
                  <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Wins</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-warning">{draws}</p>
                  <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Draws</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-destructive">{losses}</p>
                  <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Losses</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-primary">{winRate}%</p>
                  <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Win Rate</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-white">{totalGames}</p>
                  <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Matches</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-white">{club.goals_scored || 0}</p>
                  <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Goals Scored</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-white">{club.goals_conceded || 0}</p>
                  <p className="text-xs text-white/40 uppercase tracking-wider mt-1">Goals Conceded</p>
                </div>
              </div>
              <ClubPlayerStats players={players} clubId={id} />
            </div>
          </TabsContent>

          {/* Matches */}
          <TabsContent value="matches" className="px-4 pt-4">
            <div className="space-y-6">
              {tournamentMatches.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Upcoming</p>
                  <div className="space-y-2">
                    {tournamentMatches.map(m => {
                      const isHome = m.home_club_id === id;
                      const oppName = isHome ? m.away_club_name : m.home_club_name;
                      const dateStr = m.scheduled_date ? new Date(m.scheduled_date).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "TBD";
                      const competition = deriveCompetitionLabel(m, tournamentMap);
                      return (
                        <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Trophy className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">vs {oppName}</p>
                            <p className="text-xs text-white/40">{competition}</p>
                          </div>
                          <p className="text-xs text-white/40 shrink-0">{dateStr}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Past Matches</p>
                {matches.length === 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                    <Swords className="w-10 h-10 text-white/20 mx-auto mb-3" />
                    <p className="text-sm text-white/40">No matches recorded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {matches.map(m => {
                      const isHome = m.home_club_id === id;
                      const myScore = isHome ? m.home_score : m.away_score;
                      const oppScore = isHome ? m.away_score : m.home_score;
                      const oppName = isHome ? m.away_club_name : m.home_club_name;
                      const result = myScore > oppScore ? "W" : myScore < oppScore ? "L" : "D";
                      const competition = deriveCompetitionLabel(m, tournamentMap);
                      return (
                        <div key={m.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                          <span className={cn("text-xs font-bold px-2 py-0.5 rounded border shrink-0", OUTCOME_STYLE[result])}>{result}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">vs {oppName}</p>
                            <p className="text-xs text-white/40">{competition}</p>
                          </div>
                          <p className="font-bold text-white">{myScore} – {oppScore}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Squad */}
          <TabsContent value="squad" className="px-4 pt-4">
            {players.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No players registered yet.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {players.map(p => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    currentUser={currentUser}
                    myPlayer={myPlayer}
                    isPresident={isPresident}
                    onAssignRole={assignRole}
                    initialFollowing={!!playerFollowMap[p.id]}
                    initialFollowId={playerFollowMap[p.id]?.id || null}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Formation */}
          <TabsContent value="formation" className="px-4 pt-4">
            <FormationPitch
              club={club}
              players={players}
              canEdit={canEdit}
              currentUserEmail={currentUser?.email}
              onUpdate={(data) => setClub(prev => ({ ...prev, ...data }))}
            />
          </TabsContent>

          {/* Trophies & Achievements */}
          <TabsContent value="trophies" className="px-4 pt-4 pb-6">
            <div className="space-y-6">
              <ClubAchievementsTab clubId={id} />
              <ClubTrophyCabinetDisplay clubId={id} currentUserEmail={currentUser?.email} club={club} canEditOverride={canEdit} />
            </div>
          </TabsContent>

          {/* Season History */}
          <TabsContent value="history" className="px-4 pt-4 pb-6">
            {!historyLoaded ? (
              <p className="text-xs text-white/40 py-8 text-center">Loading history…</p>
            ) : historyRows.length === 0 ? (
              <p className="text-xs text-white/40 py-8 text-center">No season history yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/40 uppercase tracking-widest border-b border-white/10">
                      <th className="text-left py-2 pr-3 font-semibold">Competition</th>
                      <th className="text-left py-2 pr-3 font-semibold">Season</th>
                      <th className="text-center py-2 px-2 font-semibold">Pos</th>
                      <th className="text-center py-2 px-2 font-semibold">W</th>
                      <th className="text-center py-2 px-2 font-semibold">D</th>
                      <th className="text-center py-2 px-2 font-semibold">L</th>
                      <th className="text-center py-2 px-2 font-semibold">Pts</th>
                      <th className="text-center py-2 pl-2 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {historyRows.map((r, i) => (
                      <tr key={i} className="text-white/70 hover:bg-white/5 transition-colors">
                        <td className="py-2 pr-3 font-medium text-white">{r.name}</td>
                        <td className="py-2 pr-3 text-white/50">S{r.season}</td>
                        <td className="py-2 px-2 text-center font-bold">{r.pos ?? "—"}</td>
                        <td className="py-2 px-2 text-center text-emerald-400">{r.w}</td>
                        <td className="py-2 px-2 text-center">{r.d}</td>
                        <td className="py-2 px-2 text-center text-red-400">{r.l}</td>
                        <td className="py-2 px-2 text-center font-bold">{r.pts}</td>
                        <td className="py-2 pl-2 text-center">
                          {r.winner && <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-400 font-bold">W</span>}
                          {r.promoted && <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold ml-0.5">↑</span>}
                          {r.relegated && <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-400 font-bold ml-0.5">↓</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>

          {/* Contracts — owner only */}
          {isOwner && (
            <TabsContent value="contracts" className="px-4 pt-4">
              <ContractsTab club={club} players={players} myPlayer={myPlayer} canManage={true} />
            </TabsContent>
          )}

          {/* Stadium — owner only */}
          {isOwner && (
            <TabsContent value="stadium" className="px-4 pt-4">
              <StadiumUpgrade
                club={club}
                canEdit={isOwner}
                onUpdate={(updates) => setClub(prev => ({ ...prev, ...updates }))}
              />
            </TabsContent>
          )}

          {/* Finance + Shirts — owner only */}
          {isOwner && (
            <>
              <TabsContent value="finance" className="px-4 pt-4">
                <ClubFinanceTab club={club} />
              </TabsContent>
              <TabsContent value="shirts" className="px-4 pt-4 pb-6">
                <ShirtSalesPanel club={club} players={players} />
              </TabsContent>
            </>
          )}

          {/* Join Requests */}
          {(isCaptain || isOwner) && (
            <TabsContent value="requests" className="px-4 pt-4">
              <div className="space-y-3">
                {joinRequests.map(req => (
                  <div key={req.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-white">{req.player_gamertag}</p>
                      <p className="text-xs text-white/40">{req.player_email}</p>
                      {req.message && <p className="text-sm text-white/40 mt-2 italic">"{req.message}"</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => handleJoinRequest(req.id, "approved")} className="bg-success/20 text-success hover:bg-success/30 border-0">
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleJoinRequest(req.id, "rejected")} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                        <X className="w-4 h-4 mr-1" /> Decline
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Modals / overlays */}
      <BannerSelector
        open={bannerDialogOpen}
        onClose={() => setBannerDialogOpen(false)}
        currentBannerId={club?.banner_url}
        currentBannerPosition={club?.banner_position}
        currentBannerZoom={club?.banner_zoom}
        previewData={{ name: club?.name, subtitle: `${club?.platform} · ${club?.region}`, avatarUrl: club?.logo_url, type: "club" }}
        onSelect={async (bannerId, position, zoom) => {
          const update = { banner_url: bannerId };
          if (position) update.banner_position = position;
          if (zoom) update.banner_zoom = zoom;
          setBannerDialogOpen(false);
          setClub(prev => ({ ...prev, ...update }));
          try {
            await stageClient.entities.Club.update(id, update);
          } catch (err) {
            console.error("Failed to save banner:", err);
          }
        }}
      />

      <Dialog open={followersModalOpen} onOpenChange={setFollowersModalOpen}>
        <DialogContent className="max-w-md bg-[#0d1225] border-white/10 text-white">
          <DialogHeader><DialogTitle>Followers</DialogTitle></DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <FollowList items={followersList} emptyLabel="No followers yet." onClose={() => setFollowersModalOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>

      <ImagePositionEditor
        open={!!pendingLogo}
        onClose={() => { setPendingLogo(null); pendingFileRef.current = null; }}
        imageUrl={pendingLogo}
        aspect="avatar"
        onConfirm={(url, position, zoom) => saveLogo(url, position, zoom)}
      />


      <Dialog open={logoPreviewOpen} onOpenChange={setLogoPreviewOpen}>
        <DialogContent className="bg-[#0d1225] border-white/10 max-w-sm">
          <DialogHeader><DialogTitle>{club.name} Logo</DialogTitle></DialogHeader>
          <div className="flex items-center justify-center p-4">
            <img src={club.logo_url} alt={club.name} className="w-64 h-64 rounded-full object-cover" style={{ objectPosition: club.logo_position || "50% 50%" }} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Club Dialog */}
      <Dialog open={editClubOpen} onOpenChange={setEditClubOpen}>
        <DialogContent className="bg-[#0d1225] border-white/10 max-w-lg">
          <DialogHeader><DialogTitle className="text-xl font-bold">Edit Club</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">Club Name</label>
                <Input value={clubForm.name} onChange={e => setClubForm(f => ({ ...f, name: e.target.value }))} className="bg-white/5 border-white/10" />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">Tag (max 5)</label>
                <Input value={clubForm.tag} maxLength={5} onChange={e => setClubForm(f => ({ ...f, tag: e.target.value.toUpperCase() }))} className="bg-white/5 border-white/10" />
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">Platform</label>
                <Select value={clubForm.platform} onValueChange={v => setClubForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PlayStation">PlayStation</SelectItem>
                    <SelectItem value="Xbox">Xbox</SelectItem>
                    <SelectItem value="PC">PC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">Region</label>
                <Select value={clubForm.region} onValueChange={v => setClubForm(f => ({ ...f, region: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Europe","North America","South America","Asia","Oceania","Middle East"].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">Country</label>
                <Select value={clubForm.country_code || ""} onValueChange={v => setClubForm(f => ({ ...f, country_code: v }))}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider mb-1.5 block">Bio / Description</label>
              <Textarea value={clubForm.description} onChange={e => setClubForm(f => ({ ...f, description: e.target.value }))} className="bg-white/5 border-white/10 resize-none" rows={3} placeholder="Describe your club..." />
            </div>
            <Button
              onClick={async () => {
                setSavingClub(true);
                await stageClient.entities.Club.update(id, {
                  name: clubForm.name,
                  tag: clubForm.tag,
                  platform: clubForm.platform,
                  region: clubForm.region,
                  description: clubForm.description,
                  country_code: clubForm.country_code,
                });
                setClub(prev => ({ ...prev, ...clubForm }));
                setSavingClub(false);
                setEditClubOpen(false);
              }}
              disabled={savingClub || !clubForm.name || !clubForm.tag}
              className="w-full bg-primary text-primary-foreground"
            >
              <Save className="w-4 h-4 mr-2" /> {savingClub ? "Saving..." : "Save Changes"}
            </Button>
            {isOwner && (
              <Button
                variant="ghost"
                onClick={() => { setEditClubOpen(false); setDeleteDialogOpen(true); }}
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive border border-destructive/20 mt-1"
              >
                <Trash2 className="w-4 h-4 mr-2" /> Delete Club
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function deriveCompetitionLabel(match, tournamentMap = {}) {
  if (!match.tournament_id || match.tournament_id === "ranked") return "Ranked Match";
  const t = tournamentMap[match.tournament_id];
  if (!t) return "Tournament";
  if (t.type === "knockout") return `${t.name} · Knockout`;
  if (t.type === "league") return `${t.name} · League`;
  if (t.type === "group_stage") return `${t.name} · Group Stage`;
  if (t.type === "swiss" || t.type === "swiss_ucl") return `${t.name} · Swiss`;
  if (t.type === "double_elimination") return `${t.name} · Double Elim.`;
  return t.name || "Tournament";
}

function PlayerCard({ player, currentUser, myPlayer: _myPlayer, isPresident, onAssignRole, initialFollowing = false, initialFollowId = null }) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followId, setFollowId] = useState(initialFollowId);

  async function _toggleFollow(e) {
    e.preventDefault();
    if (isFollowing && followId) {
      await stageClient.entities.Follow.delete(followId);
      setIsFollowing(false); setFollowId(null);
    } else {
      const myPlayerData = await stageClient.entities.Player.filter({ email: currentUser.email });
      const f = await stageClient.entities.Follow.create({
        follower_email: currentUser.email,
        follower_player_id: myPlayerData[0]?.id || "",
        target_id: player.id,
        target_type: "player",
        target_name: player.gamertag,
      });
      setIsFollowing(true); setFollowId(f.id);
    }
  }

  return (
    <Link to={`/players/${player.id}`} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-blue-400/30 transition-all block">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center shrink-0 overflow-hidden">
          {player.avatar_url
            ? <img src={player.avatar_url} alt={player.gamertag} className="w-full h-full object-cover" />
            : <span className="font-bold text-sm text-primary">{player.position}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">{player.gamertag}</p>
          <p className="text-xs text-white/40 capitalize">{player.role === 'manager' ? 'member' : (player.role || 'member')}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-primary">{player.overall_rating}</p>
          <p className="text-[10px] text-white/40 uppercase">OVR</p>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-white/40">
        <span>{player.goals || 0} goals</span>
        <span>{player.assists || 0} assists</span>
        <span>{player.matches_played || 0} matches</span>
      </div>
      {isPresident && currentUser?.email !== player.email && !player.club_roles?.includes("president") && (
        <div className="mt-3 flex gap-2" onClick={e => e.preventDefault()}>
          <button
            onClick={() => onAssignRole(player, "captain")}
            disabled={player.club_roles?.includes("captain") || player.role === "captain"}
            className={cn("flex-1 text-xs py-1.5 rounded-lg border transition-all",
              player.club_roles?.includes("captain") || player.role === "captain"
                ? "border-warning/30 bg-warning/10 text-warning cursor-default"
                : "border-warning/30 text-warning hover:bg-warning/10"
            )}
          >
            {player.club_roles?.includes("captain") || player.role === "captain" ? "Captain" : "Make Captain"}
          </button>
          <button
            onClick={() => onAssignRole(player, "vice-captain")}
            disabled={player.club_roles?.includes("vice-captain") || player.role === "vice-captain"}
            className={cn("flex-1 text-xs py-1.5 rounded-lg border transition-all",
              player.club_roles?.includes("vice-captain") || player.role === "vice-captain"
                ? "border-primary/30 bg-primary/10 text-primary cursor-default"
                : "border-primary/30 text-primary hover:bg-primary/10"
            )}
          >
            {player.club_roles?.includes("vice-captain") || player.role === "vice-captain" ? "Vice-Captain" : "Make Vice-Captain"}
          </button>
        </div>
      )}
    </Link>
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
      <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full mb-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-center text-sm text-white/40 py-4">No results found.</p>}
        {filtered.map(item => {
          const name = item.target_name || item._player_name || item.follower_email || "Unknown";
          const imageUrl = item.avatar_url || item.logo_url;
          return (
            <button key={item.id} onClick={() => { onClose?.(); navigate(`/players/${item._player_id || item.target_id}`); }}
              className="w-full text-left bg-white/5 border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-blue-400/30 transition-all">
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                {imageUrl ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-primary">{(name[0] || "?").toUpperCase()}</span>}
              </div>
              <p className="text-sm font-bold text-white truncate">{name}</p>
            </button>
          );
        })}
      </div>
    </>
  );
}