import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  Shield, Users, Trophy, ArrowLeft,
  UserPlus, Check, X, Camera, Send, Loader2, Coins, Wand2, ZoomIn, LogOut,
  Trash2, Settings, Swords, Save, Edit2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRIES } from "../lib/countries";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AvatarGenerator from "../components/AvatarGenerator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import BannerSelector from "../components/BannerSelector";
import ImagePositionEditor from "../components/ImagePositionEditor";
import { getBannerStyle } from "@/lib/storeItems";
import DressingRoom from "../components/DressingRoom";
import FormationPitch from "../components/FormationPitch";
import ClubFeed from "../components/ClubFeed";
import ClubForm from "../components/ClubForm";
import ClubPlayerStats from "../components/ClubPlayerStats";
import ContractsTab from "../components/contracts/ContractsTab";
import ClubFinanceTab from "../components/club/ClubFinanceTab";
import StadiumUpgrade from "../components/club/StadiumUpgrade";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { ClubTrophyCabinetDisplay } from "@/components/profile/PlayerTrophyCabinet";

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
  const [myJoinRequest, setMyJoinRequest] = useState(null);
  const [joinMsg, setJoinMsg] = useState("");
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [myJoinRequestCount, setMyJoinRequestCount] = useState(0);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [sendingJoinRequest, setSendingJoinRequest] = useState(false);
  const [myClubData, setMyClubData] = useState(null);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [logoPreviewOpen, setLogoPreviewOpen] = useState(false);
  const [pendingLogo, setPendingLogo] = useState(null);
  const [aiLogoOpen, setAiLogoOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playerFollowMap, setPlayerFollowMap] = useState({});
  const [followersModalOpen, setFollowersModalOpen] = useState(false);
  const [followersList, setFollowersList] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [editClubOpen, setEditClubOpen] = useState(false);
  const [clubForm, setClubForm] = useState({ name: "", tag: "", platform: "", region: "", description: "", country_code: "" });
  const [savingClub, setSavingClub] = useState(false);
  const navigate = useNavigate();
  const logoInputRef  = useRef();
  const pendingFileRef = useRef(null);

  const isMember = !!myPlayer?.club_id && myPlayer.club_id === id;
  const isCaptain = isMember && (myPlayer?.role === "captain" || myPlayer?.role === "vice-captain");
  const isAdminTakeover = currentUser?.role === "admin" && localStorage.getItem("admin_takeover_club_id") === id;
  const isOwner = club?.owner_email === currentUser?.email || isAdminTakeover;
  const isPresident = isMember && myPlayer?.club_roles?.includes("president");
  const canEdit = isOwner || isCaptain;

  useEffect(() => {
    async function load() {
      const user = await base44.auth.me();
      setCurrentUser(user);

      const [clubData, playerData, myPl] = await Promise.all([
        base44.entities.Club.filter({ id }, null, 1),
        base44.entities.Player.filter({ club_id: id }),
        base44.entities.Player.filter({ email: user.email }),
      ]);

      const [matchesHome, matchesAway, followData, allFollowersData] = await Promise.all([
        base44.entities.Match.filter({ home_club_id: id, status: "completed" }, "round", 30),
        base44.entities.Match.filter({ away_club_id: id, status: "completed" }, "round", 30),
        base44.entities.Follow.filter({ follower_email: user.email, target_id: id, target_type: "club" }),
        base44.entities.Follow.filter({ target_id: id, target_type: "club" }),
      ]);

      const [tmHome, tmAway] = await Promise.all([
        base44.entities.Match.filter({ home_club_id: id, status: "scheduled" }, "round", 30),
        base44.entities.Match.filter({ away_club_id: id, status: "scheduled" }, "round", 30),
      ]);

      const allMatchesRaw = [...matchesHome, ...matchesAway, ...tmHome, ...tmAway];
      const tIds = [...new Set(allMatchesRaw.map(m => m.tournament_id).filter(tid => tid && tid !== "ranked"))];
      let tMap = {};
      if (tIds.length > 0) {
        const tResults = await Promise.all(tIds.map(tid => base44.entities.Tournament.filter({ id: tid }, null, 1)));
        tResults.forEach(arr => { if (arr[0]) tMap[arr[0].id] = arr[0]; });
      }
      setTournamentMap(tMap);

      const playerFollows = playerData.length > 0
        ? await base44.entities.Follow.filter({ follower_email: user.email, target_type: "player" })
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
          const myClubArr = await base44.entities.Club.filter({ id: myPl[0].club_id });
          if (myClubArr.length > 0) setMyClubData(myClubArr[0]);
        }
      }

      if (myPl.length > 0 && (
        myPl[0].role === "captain" ||
        myPl[0].role === "vice-captain" ||
        myPl[0].club_roles?.includes("president") ||
        clubData[0]?.owner_email === user.email
      )) {
        const reqs = await base44.entities.JoinRequest.filter({ club_id: id, status: "pending" });
        setJoinRequests(reqs);
      }

      const myReqs = await base44.entities.JoinRequest.filter({ player_email: user.email, club_id: id });
      setMyJoinRequestCount(myReqs.length);
      if (myReqs.length > 0) {
        const sorted = [...myReqs].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        setMyJoinRequest(sorted[0]);
      }

      setLoading(false);
    }
    load();

    const unsubPlayer = base44.entities.Player.subscribe((event) => {
      if (event.type === "update" && event.data.club_id === id) {
        setPlayers(prev => prev.map(p => p.id === event.id ? event.data : p));
      }
    });
    return () => { unsubPlayer(); };
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
        target_type: "club",
        target_name: club?.name,
      });
      setIsFollowing(true); setFollowId(f.id);
      setFollowersCount(c => c + 1);
    }
  }

  async function sendJoinRequest() {
    if (!myPlayer) return;
    setSendingJoinRequest(true);
    const req = await base44.entities.JoinRequest.create({
      player_id: myPlayer.id,
      player_email: currentUser.email,
      player_gamertag: myPlayer.gamertag,
      club_id: id,
      club_name: club?.name,
      message: joinMsg,
      status: "pending",
    });
    setMyJoinRequest(req);
    setMyJoinRequestCount(c => c + 1);
    setJoinDialogOpen(false);
    setJoinMsg("");
    setSendingJoinRequest(false);
  }

  async function assignRole(targetPlayer, role) {
    const currentHolders = players.filter(p => (p.club_roles?.includes(role) || p.role === role) && p.id !== targetPlayer.id);
    await Promise.all(currentHolders.map(p =>
      base44.entities.Player.update(p.id, {
        club_roles: (p.club_roles || []).filter(r => r !== role),
        role: p.role === role ? "member" : p.role,
      })
    ));
    const otherRoles = (targetPlayer.club_roles || []).filter(r => r !== "captain" && r !== "vice-captain");
    const newRoles = [...new Set([...otherRoles, role])];
    const primaryRole = newRoles.includes("captain") ? "captain" : newRoles.includes("vice-captain") ? "vice-captain" : "member";
    await base44.entities.Player.update(targetPlayer.id, { club_roles: newRoles, role: primaryRole });
    const updated = await base44.entities.Player.filter({ club_id: id });
    setPlayers(updated);
  }

  async function handleJoinRequest(reqId, action) {
    const req = joinRequests.find(r => r.id === reqId);
    if (!req) return;
    await base44.entities.JoinRequest.update(reqId, { status: action });
    setJoinRequests(prev => prev.filter(r => r.id !== reqId));
    if (action === "approved") {
      await base44.entities.Player.update(req.player_id, { club_id: id, role: "member", club_roles: ["member"] });
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

  async function handleDeleteClub() {
    setDeleting(true);
    await base44.functions.invoke("deleteClub", { club_id: id });
    setDeleting(false);
    setDeleteDialogOpen(false);
    navigate("/clubs");
  }

  async function saveLogo(localUrl, position, zoom) {
    const file = pendingFileRef.current;
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Club.update(id, { logo_url: file_url, logo_position: position });
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
    return <div className="flex items-center justify-center h-full min-h-screen"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  if (!club) {
    return <div className="p-6 text-center"><p className="text-muted-foreground">Club not found.</p><Link to="/clubs"><Button variant="outline" className="mt-4">Back</Button></Link></div>;
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
    <div className="min-h-screen bg-background">
      {/* Dialogs */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Club</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Are you sure you want to delete <strong className="text-foreground">{club?.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClub} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {deleting ? "Deleting..." : "Delete Club"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Back */}
      <div className="px-4 pt-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
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
        className="w-full h-40 sm:h-56 mt-2 relative group cursor-pointer"
        style={getBannerStyle(club?.banner_id, club?.banner_position)}
        onClick={() => canEdit && setBannerDialogOpen(true)}
      >
        {canEdit && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <span className="flex items-center gap-2 text-white text-sm font-medium bg-black/40 px-3 py-1.5 rounded-full">
              <Camera className="w-4 h-4" /> Change Banner
            </span>
          </div>
        )}
      </div>

      {/* Profile header */}
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-end justify-between -mt-10 mb-4">
          {/* Logo */}
          <div className="relative group shrink-0">
            <div
              className="w-20 h-20 rounded-full bg-primary/10 border-4 border-background flex items-center justify-center overflow-hidden cursor-pointer"
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
                {myPlayer && (
                  <button onClick={() => setAiLogoOpen(true)} className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-lg z-10" title="Generate AI Logo">
                    <Wand2 className="w-3 h-3 text-primary-foreground" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {canEdit && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditClubOpen(true)}>
                <Edit2 className="w-3.5 h-3.5" /> Edit Club
              </Button>
            )}
            {!isMember && (
              <Button
                size="sm"
                onClick={toggleFollow}
                className={cn(isFollowing ? "bg-secondary text-foreground border border-border hover:bg-secondary/80" : "bg-primary text-primary-foreground")}
              >
                {isFollowing ? "Unfollow" : "Follow"}
              </Button>
            )}
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => setDeleteDialogOpen(true)} className="border-destructive/40 text-destructive hover:bg-destructive/10">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Club name + info */}
        <div className="space-y-1 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-heading text-2xl font-black text-foreground uppercase tracking-tight" style={{ letterSpacing: "-0.02em" }}>
              {club.name}
            </h1>
            <span className="text-sm px-2 py-0.5 rounded-lg bg-primary/10 text-primary font-mono">[{club.tag}]</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            <span>{club.platform}</span>
            <span>·</span>
            <span>{club.region}</span>
            <span>·</span>
            <span className="text-foreground font-medium">{club.rating || 1000} Rating</span>
          </div>
          {club.description && <p className="text-sm text-foreground/80 mt-1">{club.description}</p>}
          {/* Form display */}
          <div className="mt-1">
            <ClubForm matches={matches} clubId={id} />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-6 border-y border-border py-3 mb-0 flex-wrap">
          <div className="text-center">
            <p className="font-heading text-xl font-black text-foreground">{totalGames}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Matches</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <button onClick={() => setFollowersModalOpen(true)} className="text-center hover:opacity-70 transition-opacity">
            <p className="font-heading text-xl font-black text-foreground">{followersCount}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Followers</p>
          </button>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="font-heading text-xl font-black text-foreground">{players.length}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Squad</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="font-heading text-xl font-black text-foreground">{club.trophies || 0}</p>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Trophies</p>
          </div>
          {isMember && (
            <>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="font-heading text-xl font-black text-warning">{(club.credits ?? 0).toLocaleString()}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Credits</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="font-heading text-xl font-black text-success font-light">{((club.stc ?? 0) / 1_000_000).toFixed(2)}M</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">STC</p>
              </div>
            </>
          )}
        </div>

        {/* Join request area */}
        {!isMember && !isOwner && (
          <div className="pt-3">
            {!myJoinRequest && (
              !myPlayer ? (
                <Button size="sm" variant="outline" disabled className="opacity-50 w-full">
                  <UserPlus className="w-4 h-4 mr-1.5" /> Create a Player Profile to Join
                </Button>
              ) : (
                <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-primary text-primary-foreground w-full">
                      <UserPlus className="w-4 h-4 mr-1.5" /> Request to Join
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader><DialogTitle>Request to Join {club.name}</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-4">
                      <Textarea value={joinMsg} onChange={e => setJoinMsg(e.target.value)} className="bg-secondary border-border" placeholder="Why do you want to join? (optional)" />
                      <Button onClick={sendJoinRequest} disabled={sendingJoinRequest} className="w-full bg-primary text-primary-foreground">
                        {sendingJoinRequest ? "Sending..." : <><Send className="w-4 h-4 mr-2" /> Send Request</>}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )
            )}
            {myJoinRequest && myJoinRequest.status !== "rejected" && (
              <span className={cn("inline-block text-xs px-3 py-1.5 rounded-full border font-medium",
                myJoinRequest.status === "pending" ? "border-warning/30 bg-warning/10 text-warning" :
                myJoinRequest.status === "approved" ? "border-success/30 bg-success/10 text-success" :
                "border-destructive/30 bg-destructive/10 text-destructive"
              )}>
                {myJoinRequest.status === "pending" ? "Request Pending..." : myJoinRequest.status === "approved" ? "Request Approved" : "Request Declined"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="max-w-2xl mx-auto mt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full rounded-none border-b border-border bg-transparent h-auto p-0 gap-0 flex-wrap">
            {[
              "posts", "stats", "matches", "squad", "formation", "trophies",
              ...(isOwner ? ["stadium", "contracts", "finance"] : []),
              ...((isCaptain || isOwner) && joinRequests.length > 0 ? ["requests"] : [])
            ].map(tab => (
              <TabsTrigger
                key={tab}
                value={tab}
                className={cn(
                  "flex-1 min-w-fit rounded-none border-b-2 border-transparent pb-3 pt-3 text-xs uppercase tracking-widest font-bold text-muted-foreground transition-colors",
                  "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent"
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
                <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-success">{wins}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Wins</p>
                </div>
                <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-warning">{draws}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Draws</p>
                </div>
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-destructive">{losses}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Losses</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-primary">{winRate}%</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Win Rate</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-foreground">{totalGames}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Matches</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-foreground">{club.goals_scored || 0}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Goals Scored</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="font-heading text-3xl font-black text-foreground">{club.goals_conceded || 0}</p>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Goals Conceded</p>
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
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Upcoming</p>
                  <div className="space-y-2">
                    {tournamentMatches.map(m => {
                      const isHome = m.home_club_id === id;
                      const oppName = isHome ? m.away_club_name : m.home_club_name;
                      const dateStr = m.scheduled_date ? new Date(m.scheduled_date).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "TBD";
                      const competition = deriveCompetitionLabel(m, tournamentMap);
                      return (
                        <div key={m.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Trophy className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">vs {oppName}</p>
                            <p className="text-xs text-muted-foreground">{competition}</p>
                          </div>
                          <p className="text-xs text-muted-foreground shrink-0">{dateStr}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Past Matches</p>
                {matches.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-8 text-center">
                    <Swords className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No matches recorded yet.</p>
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
                        <div key={m.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                          <span className={cn("text-xs font-bold px-2 py-0.5 rounded border shrink-0", OUTCOME_STYLE[result])}>{result}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">vs {oppName}</p>
                            <p className="text-xs text-muted-foreground">{competition}</p>
                          </div>
                          <p className="font-bold text-foreground">{myScore} – {oppScore}</p>
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
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Users className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No players registered yet.</p>
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

          {/* Trophies */}
          <TabsContent value="trophies" className="px-4 pt-4">
            <ClubTrophyCabinetDisplay clubId={id} currentUserEmail={currentUser?.email} club={club} canEditOverride={canEdit} />
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

          {/* Finance — owner only */}
          {isOwner && (
            <TabsContent value="finance" className="px-4 pt-4">
              <ClubFinanceTab club={club} />
            </TabsContent>
          )}

          {/* Join Requests */}
          {(isCaptain || isOwner) && (
            <TabsContent value="requests" className="px-4 pt-4">
              <div className="space-y-3">
                {joinRequests.map(req => (
                  <div key={req.id} className="bg-card border border-border rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-foreground">{req.player_gamertag}</p>
                      <p className="text-xs text-muted-foreground">{req.player_email}</p>
                      {req.message && <p className="text-sm text-muted-foreground mt-2 italic">"{req.message}"</p>}
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
        currentBannerId={club?.banner_id || "banner_default"}
        userEmail={currentUser?.email}
        previewData={{ name: club?.name, subtitle: `${club?.platform} · ${club?.region}`, avatarUrl: club?.logo_url, type: "club" }}
        onSelect={async (bannerId, position) => {
          const update = { banner_id: bannerId };
          if (position) update.banner_position = position;
          await base44.entities.Club.update(id, update);
          setClub(prev => ({ ...prev, ...update }));
          setBannerDialogOpen(false);
        }}
      />

      <Dialog open={followersModalOpen} onOpenChange={setFollowersModalOpen}>
        <DialogContent className="max-w-md">
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

      <AvatarGenerator
        open={aiLogoOpen}
        onClose={() => setAiLogoOpen(false)}
        player={myPlayer}
        onSelect={(url) => { setAiLogoOpen(false); setPendingLogo(url); }}
      />

      <Dialog open={logoPreviewOpen} onOpenChange={setLogoPreviewOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>{club.name} Logo</DialogTitle></DialogHeader>
          <div className="flex items-center justify-center p-4">
            <img src={club.logo_url} alt={club.name} className="w-64 h-64 rounded-2xl object-cover" style={{ objectPosition: club.logo_position || "50% 50%" }} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Club Dialog */}
      <Dialog open={editClubOpen} onOpenChange={setEditClubOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-xl font-bold">Edit Club</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Club Name</label>
                <Input value={clubForm.name} onChange={e => setClubForm(f => ({ ...f, name: e.target.value }))} className="bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Tag (max 5)</label>
                <Input value={clubForm.tag} maxLength={5} onChange={e => setClubForm(f => ({ ...f, tag: e.target.value.toUpperCase() }))} className="bg-secondary border-border" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Platform</label>
                <Select value={clubForm.platform} onValueChange={v => setClubForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PlayStation">PlayStation</SelectItem>
                    <SelectItem value="Xbox">Xbox</SelectItem>
                    <SelectItem value="PC">PC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Region</label>
                <Select value={clubForm.region} onValueChange={v => setClubForm(f => ({ ...f, region: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Europe","North America","South America","Asia","Oceania","Middle East"].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Country</label>
                <Select value={clubForm.country_code || ""} onValueChange={v => setClubForm(f => ({ ...f, country_code: v }))}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">Bio / Description</label>
              <Textarea value={clubForm.description} onChange={e => setClubForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary border-border resize-none" rows={3} placeholder="Describe your club..." />
            </div>
            <Button
              onClick={async () => {
                setSavingClub(true);
                await base44.entities.Club.update(id, {
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

function PlayerCard({ player, currentUser, myPlayer, isPresident, onAssignRole, initialFollowing = false, initialFollowId = null }) {
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [followId, setFollowId] = useState(initialFollowId);

  async function toggleFollow(e) {
    e.preventDefault();
    if (isFollowing && followId) {
      await base44.entities.Follow.delete(followId);
      setIsFollowing(false); setFollowId(null);
    } else {
      const myPlayerData = await base44.entities.Player.filter({ email: currentUser.email });
      const f = await base44.entities.Follow.create({
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
    <Link to={`/players/${player.id}`} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all block">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center shrink-0 overflow-hidden">
          {player.avatar_url
            ? <img src={player.avatar_url} alt={player.gamertag} className="w-full h-full object-cover" />
            : <span className="font-bold text-sm text-primary">{player.position}</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{player.gamertag}</p>
          <p className="text-xs text-muted-foreground capitalize">{player.role === 'manager' ? 'member' : (player.role || 'member')}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-primary">{player.overall_rating}</p>
          <p className="text-[10px] text-muted-foreground uppercase">OVR</p>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
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
    return <div className="bg-card border border-border rounded-xl p-8 text-center"><p className="text-muted-foreground text-sm">{emptyLabel}</p></div>;
  }

  return (
    <>
      <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)}
        className="w-full mb-3 px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">No results found.</p>}
        {filtered.map(item => {
          const name = item.target_name || item._player_name || item.follower_email || "Unknown";
          const imageUrl = item.avatar_url || item.logo_url;
          return (
            <button key={item.id} onClick={() => { onClose?.(); navigate(`/players/${item._player_id || item.target_id}`); }}
              className="w-full text-left bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:border-primary/30 transition-all">
              <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 overflow-hidden">
                {imageUrl ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" /> : <span className="text-xs font-bold text-primary">{(name[0] || "?").toUpperCase()}</span>}
              </div>
              <p className="text-sm font-bold text-foreground truncate">{name}</p>
            </button>
          );
        })}
      </div>
    </>
  );
}