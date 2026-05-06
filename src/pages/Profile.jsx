import { useState, useEffect, useRef } from "react";
import { stageClient } from "@/api/stageClient";
import {
  User, Shield, Save, Plus, LogOut,
  Camera, Loader2, Edit2, Check, X,
  Swords, Bell, UserCheck, ExternalLink,
  ArrowLeft, Settings, Move
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import BannerSelector from "../components/BannerSelector";
import ClubOnboardingModal from "../components/ClubOnboardingModal";
import PlayerFeed from "../components/PlayerFeed";
import ImagePositionEditor from "../components/ImagePositionEditor";
import PlayerTrophyCabinet from "../components/profile/PlayerTrophyCabinet";
import { getBannerStyle } from "@/lib/storeItems";
import { Palette } from "lucide-react";
import { COUNTRIES } from "../lib/countries";

const POSITIONS = ["GK","CB","LB","RB","CDM","CM","CAM","LM","RM","LW","RW","ST","CF"];

// Which view is active: "profile" | "edit_player" | "club" | "edit_club" | "notifications" | "requests" | "feed"
export default function Profile() {
  const _navigate = useNavigate();
  const [view, setView] = useState("profile"); // default: public profile view
  const [user, setUser] = useState(null);
  const [player, setPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [_clubs, setClubs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingClub, setSavingClub] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState(null);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);
  const [pvpMatches, setPvpMatches] = useState([]);
  const [profileTab, setProfileTab] = useState("posts");
  const avatarInputRef = useRef();

  const [playerForm, setPlayerForm] = useState({
    gamertag: "", position: "CM", platform: "PlayStation",
    overall_rating: 70, country: "", country_code: "", bio: "", shirt_number: "",
  });

  const [clubForm, setClubForm] = useState({
    name: "", tag: "", platform: "PlayStation", region: "Europe", description: "", country_code: "",
  });

  const [_clubDialogOpen, setClubDialogOpen] = useState(false);
  const [clubOnboardingOpen, setClubOnboardingOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const isAuthed = await stageClient.auth.isAuthenticated();
      if (!isAuthed) { setLoading(false); return; }
      const u = await stageClient.auth.me();
      setUser(u);
      const [pl, cl, ownedClubs] = await Promise.all([
        stageClient.entities.Player.filter({ email: u.email }),
        stageClient.entities.Club.list("-rating", 200),
        stageClient.entities.Club.filter({ owner_email: u.email }),
      ]);
      setClubs(cl);
      if (pl.length > 0) {
        const p = pl[0];
        setPlayer(p);
        setPlayerForm({
          gamertag: p.gamertag || "",
          position: p.position || "CM",
          platform: p.platform || "PlayStation",
          overall_rating: p.overall_rating || 70,
          country: p.country || "",
          country_code: p.country_code || "",
          bio: p.bio || "",
          shirt_number: p.shirt_number ?? "",
        });
        // Load PvP matches in background
        stageClient.entities.Match.filter({ home_player_id: p.id, status: "completed" }, "-updated_date", 30).then(pvpHome => {
          stageClient.entities.Match.filter({ away_player_id: p.id, status: "completed" }, "-updated_date", 30).then(pvpAway => {
            const allPvp = [...pvpHome, ...pvpAway].filter(m => m.mode === "solo" || (!m.mode && m.home_player_id));
            const pvpMap = new Map();
            allPvp.forEach(m => pvpMap.set(m.id, m));
            setPvpMatches([...pvpMap.values()].sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date)));
          });
        });

        let memberClub = p.club_id ? (cl.find(c => c.id === p.club_id) || null) : null;
        if (!memberClub && p.club_id) {
          const direct = await stageClient.entities.Club.filter({ id: p.club_id });
          memberClub = direct[0] || null;
        }
        const ownedClub = ownedClubs[0] || null;
        const resolvedClub = memberClub || ownedClub;
        if (resolvedClub) {
          setMyClub(resolvedClub);
          setClubForm({
            name: resolvedClub.name || "",
            tag: resolvedClub.tag || "",
            platform: resolvedClub.platform || "PlayStation",
            region: resolvedClub.region || "Europe",
            description: resolvedClub.description || "",
            country_code: resolvedClub.country_code || "",
          });
        }
      } else {
        // No player yet — go to edit to create one
        setView("edit_player");
      }
      const [notifs, joinReqs] = await Promise.all([
        stageClient.entities.Notification.filter({ recipient_email: u.email }, "-created_date", 30),
        pl.length > 0 && pl[0].club_id
          ? stageClient.entities.JoinRequest.filter({ club_id: pl[0].club_id, status: "pending" }, "-created_date", 30)
          : Promise.resolve([]),
      ]);
      setNotifications(notifs);
      setJoinRequests(joinReqs);
      setLoading(false);
    }
    load();
  }, []);

  async function savePlayer() {
    setSaving(true);
    const formToSave = {
      ...playerForm,
      shirt_number: playerForm.shirt_number !== "" ? Number(playerForm.shirt_number) : null,
    };
    if (player) {
      await stageClient.entities.Player.update(player.id, formToSave);
      setPlayer(prev => ({ ...prev, ...formToSave }));
    } else {
      const created = await stageClient.entities.Player.create({
        ...formToSave,
        email: user.email,
        credits: 500,
        stc: 50_000,
        subscription: "rookie",
      });
      setPlayer(created);
    }
    setSaving(false);
    setView("profile");
  }

  async function saveClub() {
    if (!myClub) return;
    setSavingClub(true);
    await stageClient.entities.Club.update(myClub.id, {
      name: clubForm.name,
      tag: clubForm.tag,
      platform: clubForm.platform,
      region: clubForm.region,
      description: clubForm.description,
      country_code: clubForm.country_code,
    });
    setMyClub(prev => ({ ...prev, ...clubForm }));
    setSavingClub(false);
    setView("club");
  }

  async function uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file || !player) return;
    setUploadingAvatar(true);
    const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
    setUploadingAvatar(false);
    setPendingAvatar(file_url);
    e.target.value = "";
  }

  async function _saveAvatar(url, position, zoom) {
    if (!player) return;
    await stageClient.entities.Player.update(player.id, { avatar_url: url, avatar_position: position, avatar_zoom: zoom || 150 });
    setPlayer(prev => ({ ...prev, avatar_url: url, avatar_position: position, avatar_zoom: zoom || 150 }));
    setPendingAvatar(null);
  }

  async function _createClub() {
    if (!user || !player) return;
    const club = await stageClient.entities.Club.create({
      user_id: user.id,
      owner_email: user.email,
      name: clubForm.name,
      tag: (clubForm.tag || "").toUpperCase(),
      platform: clubForm.platform,
      region: clubForm.region,
      country_code: clubForm.country_code,
      description: clubForm.description || "",
      logo_url: null,
      wins: 0, losses: 0, draws: 0, goals_scored: 0, goals_conceded: 0,
      rating: 1500, peak_rating: 1500, matches_ranked: 0, is_provisional: 1,
      trophies: 0, credits: 0, stc: 30000000,
      wage_budget_stc: 5000000, transfer_budget_stc: 10000000,
      stadium_level: 0, stadium_capacity: 5000,
      tier: "Silver", win_streak: 0, loss_streak: 0, status: "active",
    });
    if (!club?.id) return;
    await stageClient.entities.Player.update(player.id, {
      club_id: club.id,
      club_roles: ["president", "captain"],
      role: "captain",
    });
    const refreshed = await stageClient.entities.Player.filter({ email: user.email });
    if (refreshed[0]) setPlayer(refreshed[0]);
    setMyClub(club);
    setClubForm({
      name: club.name || "",
      tag: club.tag || "",
      platform: club.platform || "PlayStation",
      region: club.region || "Europe",
      description: club.description || "",
      country_code: club.country_code || "",
    });
    setClubDialogOpen(false);
    setView("club");
  }

  async function leaveClub() {
    if (!player) return;
    await stageClient.entities.Player.update(player.id, { club_id: null, role: "member", club_roles: ["member"], status: "free_agent" });
    setPlayer(prev => ({ ...prev, club_id: null, role: "member", club_roles: ["member"], status: "free_agent" }));
    setMyClub(null);
    setView("profile");
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full min-h-screen bg-[#06091a]"><div className="w-8 h-8 border-4 border-white/10 border-t-blue-400 rounded-full animate-spin" /></div>;
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  const OUTCOME_STYLE = {
    W: "bg-success/15 text-success border-success/30",
    L: "bg-destructive/15 text-destructive border-destructive/30",
    D: "bg-warning/15 text-warning border-warning/30",
  };

  // ─── Public Player Profile View ───
  if (view === "profile") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* Banner */}
        <div className="relative h-48 sm:h-64 overflow-hidden" style={{ marginLeft: "calc(-50vw + 50%)", width: "100vw" }}>
          <div className="w-full h-full" style={getBannerStyle(player?.banner_id, player?.banner_position)} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to top, hsl(var(--background)) 0%, hsl(var(--background) / 0.6) 35%, transparent 70%)" }} />
          {/* Top-right action icons */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={() => setView("notifications")} className="relative p-2 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-colors">
                <Bell className="w-5 h-5 text-white" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">{unreadCount}</span>
              </button>
            )}
            {joinRequests.length > 0 && (
              <button onClick={() => setView("requests")} className="relative p-2 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-colors">
                <UserCheck className="w-5 h-5 text-white" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-warning text-background text-[9px] flex items-center justify-center font-bold">{joinRequests.length}</span>
              </button>
            )}
            <button onClick={() => stageClient.auth.logout()} className="p-2 rounded-full bg-black/60 backdrop-blur-sm hover:bg-black/80 transition-colors">
              <LogOut className="w-5 h-5 text-white/70" />
            </button>
          </div>
        </div>

        {/* Profile header */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-end justify-between -mt-16 mb-4 relative z-10">
            {/* Avatar */}
            <button
              onClick={() => player?.avatar_url && setAvatarLightboxOpen(true)}
              className="w-24 h-24 rounded-full border-2 border-white/20 shadow-2xl shadow-blue-500/20 flex items-center justify-center overflow-hidden shrink-0 bg-[#0d1225]"
            >
              {player?.avatar_url
                ? <div className="w-full h-full" style={{ backgroundImage: `url(${player.avatar_url})`, backgroundSize: player.avatar_zoom ? `${player.avatar_zoom}%` : "cover", backgroundPosition: player.avatar_position || "50% 50%" }} />
                : <User className="w-9 h-9 text-white/40" />
              }
            </button>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Button size="sm" variant="outline" onClick={() => setView("edit_player")} className="gap-1.5 h-9 px-3 text-xs border-white/20 text-white hover:bg-white/10 bg-transparent">
                <Settings className="w-3.5 h-3.5" /> Edit Profile
              </Button>
              {myClub && (
                <Button size="sm" variant="outline" onClick={() => setView("club")} className="gap-1.5 h-9 px-3 text-xs border-white/20 text-white hover:bg-white/10 bg-transparent">
                  <Shield className="w-3.5 h-3.5" /> My Club
                </Button>
              )}
            </div>
          </div>

          {/* Name + meta */}
          <div className="space-y-1.5 mb-5">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-heading text-2xl sm:text-3xl font-black text-white uppercase tracking-tight" style={{ letterSpacing: "-0.02em" }}>
                {player?.gamertag || user?.full_name || "New Player"}
              </h1>
              {player?.shirt_number && (
                <span className="font-heading text-xl font-black text-white/30 border border-white/15 rounded-lg px-2 py-0.5 shrink-0">
                  #{player.shirt_number}
                </span>
              )}
            </div>
            {(player?.club_roles?.length > 0 || player?.role) && (
              <div className="flex flex-wrap gap-1">
                {(player?.club_roles?.length > 0 ? player.club_roles : [player?.role]).filter(r => r !== 'manager').map(r => (
                  <span key={r} className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize",
                    r === "president" ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" :
                    r === "captain" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
                    "bg-white/10 text-white/60 border border-white/10"
                  )}>{r}</span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 text-[11px] text-white/50 uppercase tracking-wider flex-wrap">
              {player?.position && <span>{player.position}</span>}
              {player?.platform && <span>{player.platform}</span>}
              {player?.country && <span>{player.country}</span>}
              {myClub && (
                <Link to={`/clubs/${myClub.id}`} className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                  <Shield className="w-3 h-3" />{myClub.name}
                </Link>
              )}
            </div>
            {player?.bio && <p className="text-sm text-white/70 mt-1 break-words">{player.bio}</p>}
          </div>
        </div>

        {/* Tabs */}
        {player && (
          <div className="max-w-5xl mx-auto">
            <Tabs value={profileTab} onValueChange={setProfileTab} className="w-full">
              <TabsList className="w-full rounded-none border-b border-white/10 bg-transparent h-auto p-0 gap-0">
                {["posts", "stats", "matches", "trophies"].map(tab => (
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
                <PlayerFeed currentUser={user} player={player} isOwner={true} />
              </TabsContent>

              {/* Stats */}
              <TabsContent value="stats" className="px-3 sm:px-4 pt-4">
                <div className="space-y-4">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-blue-500/20 border border-blue-500/30 flex flex-col items-center justify-center shrink-0">
                      <span className="font-heading text-xl font-black text-blue-400 leading-none">{player.overall_rating || 70}</span>
                      <span className="text-[8px] uppercase tracking-wider text-white/40 mt-0.5">OVR</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{player.gamertag}</p>
                      <p className="text-xs text-white/50">{player.position} · {player.platform}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <StatBox label="Wins" value={player.wins_count || 0} accent="success" />
                    <StatBox label="Losses" value={player.losses_count || 0} accent="destructive" />
                    <StatBox label="Goals" value={player.goals || 0} accent="success" />
                    <StatBox label="Assists" value={player.assists || 0} accent="accent" />
                    <StatBox label="Avg Rating" value={(player.avg_match_rating || 6).toFixed(1)} accent="warning" />
                    <StatBox label="MOTM" value={player.man_of_the_match || 0} />
                    <StatBox label="Clean Sheets" value={player.clean_sheets || 0} />
                    <StatBox label="Matches" value={player.matches_played || 0} />
                  </div>
                </div>
              </TabsContent>

              {/* Matches */}
              <TabsContent value="matches" className="px-3 sm:px-4 pt-4">
                <div className="space-y-2">
                  {pvpMatches.length === 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                      <Swords className="w-10 h-10 text-white/20 mx-auto mb-3" />
                      <p className="text-sm text-white/40">No PvP matches recorded yet.</p>
                    </div>
                  )}
                  {pvpMatches.slice(0, 30).map(m => {
                    const isHome = m.home_player_id === player.id;
                    const opponent = isHome ? m.away_player_name : m.home_player_name;
                    const myScore = isHome ? m.home_score : m.away_score;
                    const theirScore = isHome ? m.away_score : m.home_score;
                    const outcome = myScore > theirScore ? "W" : myScore < theirScore ? "L" : "D";
                    const scoreStr = isHome ? `${m.home_score}–${m.away_score}` : `${m.away_score}–${m.home_score}`;
                    const dateStr = m.updated_date
                      ? new Date(m.updated_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
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
              </TabsContent>

              {/* Trophies */}
              <TabsContent value="trophies" className="px-3 sm:px-4 pt-4 pb-4">
                <PlayerTrophyCabinet player={player} />
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Dialogs */}
        {player?.avatar_url && (
          <Dialog open={avatarLightboxOpen} onOpenChange={setAvatarLightboxOpen}>
            <DialogContent className="bg-[#0d1225] border-white/10 max-w-sm p-4">
              <DialogHeader><DialogTitle className="text-white">{player?.gamertag}</DialogTitle></DialogHeader>
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-48 h-48 rounded-full overflow-hidden border-2 border-white/20"
                  style={{ backgroundImage: `url(${player.avatar_url})`, backgroundSize: player.avatar_zoom ? `${player.avatar_zoom}%` : "cover", backgroundPosition: player.avatar_position || "50% 50%" }}
                />
                <Button size="sm" variant="outline" onClick={() => { setAvatarLightboxOpen(false); setAvatarEditorOpen(true); }} className="gap-1.5 border-white/20 text-white hover:bg-white/10 bg-transparent">
                  <Move className="w-3.5 h-3.5" /> Reposition Photo
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {!player && (
          <div className="max-w-2xl mx-auto px-4 mt-6">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6 text-center">
              <h2 className="font-bold text-white text-lg mb-2">Welcome to STAGE!</h2>
              <p className="text-white/50 text-sm mb-4">Create your player profile to get started.</p>
              <Button onClick={() => setView("edit_player")} className="bg-blue-600 hover:bg-blue-500 text-white">Create Profile</Button>
            </div>
          </div>
        )}

        {player && !myClub && (
          <div className="max-w-2xl mx-auto px-4 mt-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">You're not in a club yet</p>
                <p className="text-xs text-white/50">Create your own club or join an existing one to compete in tournaments and leagues.</p>
              </div>
              <Button size="sm" onClick={() => setClubOnboardingOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white shrink-0 gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Get Started
              </Button>
            </div>
          </div>
        )}

        <ClubOnboardingModal
          open={clubOnboardingOpen}
          player={player}
          onComplete={async (club) => {
            setClubOnboardingOpen(false);
            if (club) {
              setMyClub(club);
              const refreshed = await stageClient.entities.Player.filter({ email: user.email });
              if (refreshed[0]) setPlayer(refreshed[0]);
            }
          }}
        />

        {/* Avatar re-position editor */}
        <ImagePositionEditor
          open={avatarEditorOpen}
          onClose={() => setAvatarEditorOpen(false)}
          imageUrl={player?.avatar_url}
          aspect="avatar"
          initialPosition={player?.avatar_position}
          initialZoom={player?.avatar_zoom}
          onConfirm={async (url, position, zoom) => {
            await stageClient.entities.Player.update(player.id, { avatar_url: url, avatar_position: position, avatar_zoom: zoom || 150 });
            setPlayer(prev => ({ ...prev, avatar_url: url, avatar_position: position, avatar_zoom: zoom || 150 }));
            setAvatarEditorOpen(false);
          }}
        />
      </div>
    );
  }

  // ─── Edit Player View ───
  if (view === "edit_player") {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          {player && (
            <button onClick={() => setView("profile")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <h1 className="font-heading text-2xl font-black text-foreground uppercase">{player ? "Edit Profile" : "Create Profile"}</h1>
        </div>

        {/* Avatar section */}
        {player && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Profile Photo & Banner</h2>
            <div className="flex items-start gap-4">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-full bg-secondary border-4 border-card flex items-center justify-center overflow-hidden">
                  {player?.avatar_url
                    ? <div className="w-full h-full" style={{ backgroundImage: `url(${player.avatar_url})`, backgroundSize: player.avatar_zoom ? `${player.avatar_zoom}%` : "cover", backgroundPosition: player.avatar_position || "50% 50%" }} />
                    : <User className="w-9 h-9 text-muted-foreground" />
                  }
                </div>
                <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button onClick={() => avatarInputRef.current?.click()} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors" title="Upload photo">
                    {uploadingAvatar ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
                  </button>
                </div>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={uploadAvatar} />
              </div>
              <div className="space-y-2 pt-1">
                {player?.avatar_url && (
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAvatarEditorOpen(true)}>
                    <Move className="w-3.5 h-3.5" /> Reposition Photo
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setBannerDialogOpen(true)}>
                  <Palette className="w-3.5 h-3.5" /> Change Banner
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Player info form */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="text-xl font-bold text-foreground">Player Info</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Gamertag</label>
              <Input value={playerForm.gamertag} onChange={e => setPlayerForm(f => ({ ...f, gamertag: e.target.value }))} className="bg-secondary border-border" placeholder="Your gamertag" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Position</label>
              <Select value={playerForm.position} onValueChange={v => setPlayerForm(f => ({ ...f, position: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Platform</label>
              <Select value={playerForm.platform} onValueChange={v => setPlayerForm(f => ({ ...f, platform: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PlayStation">PlayStation</SelectItem>
                  <SelectItem value="Xbox">Xbox</SelectItem>
                  <SelectItem value="PC">PC</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Country <span className="text-destructive">*</span></label>
              <Select value={playerForm.country} onValueChange={v => {
                const found = COUNTRIES.find(c => c.name === v);
                setPlayerForm(f => ({ ...f, country: v, country_code: found?.code || "" }));
              }}>
                <SelectTrigger className={`bg-secondary border-border ${!playerForm.country ? "border-destructive/50" : ""}`}>
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!playerForm.country && <p className="text-[11px] text-destructive mt-1">Please select your country</p>}
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Overall Rating</label>
              <Input type="number" min={1} max={99} value={playerForm.overall_rating} onChange={e => setPlayerForm(f => ({ ...f, overall_rating: parseInt(e.target.value) || 70 }))} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Shirt Number</label>
              <Input
                type="number" min={1} max={99}
                value={playerForm.shirt_number}
                onChange={e => {
                  const v = e.target.value === "" ? "" : Math.min(99, Math.max(1, parseInt(e.target.value) || 1));
                  setPlayerForm(f => ({ ...f, shirt_number: v }));
                }}
                placeholder="e.g. 10"
                className="bg-secondary border-border"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Account Email</label>
              <Input value={user?.email || ""} disabled className="bg-secondary border-border opacity-50" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Bio</label>
            <Textarea value={playerForm.bio} onChange={e => setPlayerForm(f => ({ ...f, bio: e.target.value }))} className="bg-secondary border-border resize-none" rows={3} placeholder="Tell the community about yourself..." />
          </div>
          <Button onClick={savePlayer} disabled={saving || !playerForm.gamertag || !playerForm.country} className="bg-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : player ? "Save Changes" : "Create Profile"}
          </Button>
        </div>

        <BannerSelector
          open={bannerDialogOpen}
          onClose={() => setBannerDialogOpen(false)}
          currentBannerId={player?.banner_id}
          currentBannerPosition={player?.banner_position}
          currentBannerZoom={player?.banner_zoom}
          previewData={{ name: player?.gamertag || user?.full_name, subtitle: player?.position, avatarUrl: player?.avatar_url, type: "player" }}
          onSelect={async (bannerId, position, zoom) => {
            const update = { banner_id: bannerId };
            if (position) update.banner_position = position;
            if (zoom) update.banner_zoom = zoom;
            if (player) await base44.entities.Player.update(player.id, update);
            setPlayer(prev => ({ ...prev, ...update }));
            setBannerDialogOpen(false);
          }}
        />

        {/* Avatar editor for new upload */}
        <ImagePositionEditor
          open={!!pendingAvatar}
          onClose={() => setPendingAvatar(null)}
          imageUrl={pendingAvatar}
          aspect="avatar"
          onConfirm={async (url, position, zoom) => {
            await stageClient.entities.Player.update(player.id, { avatar_url: url, avatar_position: position, avatar_zoom: zoom || 150 });
            setPlayer(prev => ({ ...prev, avatar_url: url, avatar_position: position, avatar_zoom: zoom || 150 }));
            setPendingAvatar(null);
          }}
        />

        {/* Avatar re-position editor (existing photo) */}
        <ImagePositionEditor
          open={avatarEditorOpen && !pendingAvatar}
          onClose={() => setAvatarEditorOpen(false)}
          imageUrl={player?.avatar_url}
          aspect="avatar"
          initialPosition={player?.avatar_position}
          initialZoom={player?.avatar_zoom}
          onConfirm={async (url, position, zoom) => {
            await stageClient.entities.Player.update(player.id, { avatar_url: url, avatar_position: position, avatar_zoom: zoom || 150 });
            setPlayer(prev => ({ ...prev, avatar_url: url, avatar_position: position, avatar_zoom: zoom || 150 }));
            setAvatarEditorOpen(false);
          }}
        />


      </div>
    );
  }

  // ─── My Club View ───
  if (view === "club") {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("profile")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="font-heading text-2xl font-black text-foreground uppercase">My Club</h1>
        </div>

        {myClub ? (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden shrink-0">
                  {myClub.logo_url
                    ? <img src={myClub.logo_url} alt={myClub.name} className="w-full h-full object-cover" />
                    : <Shield className="w-8 h-8 text-primary" />
                  }
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">{myClub.name}</h2>
                  <p className="text-sm text-muted-foreground">[{myClub.tag}] · {myClub.platform} · {myClub.region}</p>
                  {myClub.description && <p className="text-sm text-muted-foreground mt-1">{myClub.description}</p>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="Wins" value={myClub.wins || 0} accent="success" />
                <StatBox label="Matches" value={(myClub.wins || 0) + (myClub.losses || 0) + (myClub.draws || 0)} />
                <StatBox label="Trophies" value={myClub.trophies || 0} accent="accent" />
              </div>
              <div className="flex gap-3 flex-wrap">
                <Link to={`/clubs/${myClub.id}`}>
                  <Button className="bg-primary text-primary-foreground gap-1.5">
                    <Shield className="w-4 h-4" /> View Club Page
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => setView("edit_club")} className="gap-1.5">
                  <Edit2 className="w-4 h-4" /> Edit Club
                </Button>
                <Button variant="outline" onClick={leaveClub} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  Leave Club
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">You're not in a club yet.</p>
              <Button onClick={() => setClubOnboardingOpen(true)} className="bg-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> Create or Join a Club
              </Button>
            </div>
            <ClubOnboardingModal
              open={clubOnboardingOpen}
              player={player}
              onComplete={async (club) => {
                setClubOnboardingOpen(false);
                if (club) {
                  setMyClub(club);
                  const refreshed = await stageClient.entities.Player.filter({ email: user.email });
                  if (refreshed[0]) setPlayer(refreshed[0]);
                  setView("club");
                }
              }}
            />
          </div>
        )}
      </div>
    );
  }

  // ─── Edit Club View ───
  if (view === "edit_club" && myClub) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("club")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="font-heading text-2xl font-black text-foreground uppercase">Edit Club</h1>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Club Name</label>
              <Input value={clubForm.name} onChange={e => setClubForm(f => ({ ...f, name: e.target.value }))} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Tag (max 5 chars)</label>
              <Input value={clubForm.tag} maxLength={5} onChange={e => setClubForm(f => ({ ...f, tag: e.target.value.toUpperCase() }))} className="bg-secondary border-border" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Platform</label>
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
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Region</label>
              <Select value={clubForm.region} onValueChange={v => setClubForm(f => ({ ...f, region: v }))}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Europe","North America","South America","Asia","Oceania","Middle East"].map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Country</label>
              <Select value={clubForm.country_code || ""} onValueChange={v => setClubForm(f => ({ ...f, country_code: v }))}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">Club Bio / Description</label>
            <Textarea value={clubForm.description} onChange={e => setClubForm(f => ({ ...f, description: e.target.value }))} className="bg-secondary border-border resize-none" rows={3} placeholder="Describe your club..." />
          </div>
          <Button onClick={saveClub} disabled={savingClub || !clubForm.name || !clubForm.tag} className="bg-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-2" /> {savingClub ? "Saving..." : "Save Club"}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Notifications View ───
  if (view === "notifications") {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("profile")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="font-heading text-2xl font-black text-foreground uppercase">Notifications</h1>
        </div>
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No notifications yet.</p>
            </div>
          ) : notifications.map(n => (
            <div key={n.id} className={cn("bg-card border rounded-xl px-4 py-3 flex items-start gap-3 transition-all", n.read ? "border-border opacity-70" : "border-primary/30 bg-primary/5")}>
              <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", n.read ? "bg-muted-foreground/30" : "bg-primary")} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{n.title}</p>
                {n.body && <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>}
                <p className="text-[10px] text-muted-foreground/60 mt-1">{n.created_date ? new Date(n.created_date).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : ""}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {n.link && <a href={n.link} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-colors"><ExternalLink className="w-3.5 h-3.5" /></a>}
                {!n.read && (
                  <button onClick={async () => {
                    await stageClient.entities.Notification.update(n.id, { read: true });
                    setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                  }} className="p-1.5 rounded-lg hover:bg-success/10 text-success transition-colors">
                    <Check className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Join Requests View ───
  if (view === "requests") {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("profile")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h1 className="font-heading text-2xl font-black text-foreground uppercase">Join Requests</h1>
          <span className="w-5 h-5 rounded-full bg-warning text-background text-[9px] flex items-center justify-center font-bold">{joinRequests.length}</span>
        </div>
        <div className="space-y-2">
          {joinRequests.map(req => (
            <div key={req.id} className="bg-card border border-warning/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0 font-bold text-sm text-primary">
                {req.player_gamertag?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{req.player_gamertag}</p>
                {req.message && <p className="text-xs text-muted-foreground truncate">"{req.message}"</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={async () => {
                  await stageClient.entities.JoinRequest.update(req.id, { status: "approved" });
                  await stageClient.entities.Player.update(req.player_id, { club_id: req.club_id, role: "member", club_roles: ["member"], status: "active" });
                  await stageClient.entities.Notification.create({ recipient_email: req.player_email, type: "join_approved", title: `Welcome to ${req.club_name}!`, body: "Your join request was approved.", link: `/clubs/${req.club_id}`, read: false });
                  setJoinRequests(prev => prev.filter(r => r.id !== req.id));
                }} className="bg-success/20 text-success border border-success/30 hover:bg-success/30 text-xs h-7">
                  <Check className="w-3 h-3 mr-1" /> Accept
                </Button>
                <Button size="sm" onClick={async () => {
                  await stageClient.entities.JoinRequest.update(req.id, { status: "rejected" });
                  await stageClient.entities.Notification.create({ recipient_email: req.player_email, type: "join_rejected", title: `Request to ${req.club_name} declined`, body: "Your join request was not accepted.", read: false });
                  setJoinRequests(prev => prev.filter(r => r.id !== req.id));
                }} className="bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 text-xs h-7">
                  <X className="w-3 h-3 mr-1" /> Decline
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function StatBox({ label, value, accent }) {
  const accentClass = {
    success: "text-green-400",
    destructive: "text-red-400",
    accent: "text-blue-400",
    warning: "text-yellow-400",
  }[accent] || "text-white";

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4 text-center">
      <p className={cn("font-heading text-2xl sm:text-3xl font-black leading-none", accentClass)}>{value}</p>
      <p className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}