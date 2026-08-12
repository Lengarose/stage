import { useState, useEffect } from "react";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import {
  User, Shield, Save, Plus, LogOut,
  Loader2, Edit2, Check, X,
  Swords, Bell, UserCheck, ExternalLink,
  ArrowLeft, Settings, Move, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import SubscriptionProgress from "../components/profile/SubscriptionProgress";
import ClubOnboardingModal from "../components/ClubOnboardingModal";
import ProfileCompletionModal from "../components/ProfileCompletionModal";
import PlayerFeed from "../components/PlayerFeed";
import ImagePositionEditor from "../components/ImagePositionEditor";
import PlayerTrophyCabinet from "../components/profile/PlayerTrophyCabinet";
import EafcClubLinkPanel from "@/components/dashboard/EafcClubLinkPanel";
import FutMatchLogPanel from "@/components/dashboard/FutMatchLogPanel";
import GamerProfileHero from "@/components/profile/gamer/GamerProfileHero";
import GamerProfileStatsPanel from "@/components/profile/gamer/GamerProfileStatsPanel";
import { GamerProfileShell, GamerSectionCard, GamerTabNav } from "@/components/profile/gamer/GamerProfileUI";
import ProfileEditShell from "@/components/profile/ProfileEditShell";
import ClubProfileEdit from "@/components/club/ClubProfileEdit";
import { loadEafcSummary, loadFutMatches } from "@/lib/dashboardData";
import { COUNTRIES } from "../lib/countries";
import PresidentContractDialog from "@/components/contracts/PresidentContractDialog";
import { useTranslation } from "@/hooks/useTranslation";
import { asObject, asObjectArray } from "@/lib/safeData";
import { isPresidentAccountIntent, readAccountIntent } from "@/lib/accountIntent";
import { getSignedClubIdForPlayer } from "@/lib/contractOfferVisibility";
import { normalizePlayerContracts } from "@/lib/playerContractFields";
import { getFootballRoleBadges, getPlayerManagementBadges } from "@/lib/playerProfileStatus";

const POSITIONS = ["GK","CB","LB","RB","CDM","CM","CAM","LM","RM","LW","RW","ST","CF"];

function formatPositions(player) {
  return [player?.position, player?.secondary_position].filter(Boolean).join(" / ");
}

// Which view is active: "profile" | "edit_player" | "club" | "edit_club" | "notifications" | "requests" | "feed"
export default function Profile({
  tournamentMode = false,
  tournamentId = null,
  initialView = "profile",
} = {}) {
  const { t } = useTranslation();
  const _navigate = useNavigate();
  const [view, setView] = useState(initialView);
  const [user, setUser] = useState(null);
  const [player, setPlayer] = useState(null);
  // `myClub` is the management club this Player presides over.
  // `signedClub` is the football squad currently attached through player-side
  // membership or contracts. Keep management status separate from positions.
  const [myClub, setMyClub] = useState(null);
  const [signedClub, setSignedClub] = useState(null);
  const [accountIntent, setAccountIntent] = useState("player");
  const homePath = tournamentMode && tournamentId ? `/tournaments/${tournamentId}` : "/dashboard";
  const homeLabel = tournamentMode ? t("nav.tournament") : t("nav.dashboard");
  const myClubHref = myClub?.id
    ? (tournamentMode ? "/tournaments/profile-club" : `/clubs/${myClub.id}`)
    : null;
  const [_clubs, setClubs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [identityClaims, setIdentityClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [avatarEditorOpen, setAvatarEditorOpen] = useState(false);
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);
  const [pvpMatches, setPvpMatches] = useState([]);
  const [profileTab, setProfileTab] = useState("posts");
  const [presidentContractPrompt, setPresidentContractPrompt] = useState(null);
  const [playerContracts, setPlayerContracts] = useState([]);
  const [clubMemberships, setClubMemberships] = useState([]);

  const [playerForm, setPlayerForm] = useState({
    gamertag: "", position: "CM", secondary_position: "none", platform: "PlayStation",
    overall_rating: 70, country: "", country_code: "", bio: "", shirt_number: "",
  });

  const [claimForm, setClaimForm] = useState({
    platform: "PlayStation",
    platform_handle: "",
    ea_id: "",
    discord_handle: "",
    proof_url: "",
    notes: "",
  });

  const [clubForm, setClubForm] = useState({
    name: "", tag: "", platform: "PlayStation", region: "Europe", description: "", country_code: "",
  });

  const [_clubDialogOpen, setClubDialogOpen] = useState(false);
  const [clubOnboardingOpen, setClubOnboardingOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [futMatches, setFutMatches] = useState([]);
  const [eafcSummary, setEafcSummary] = useState(null);
  const canPromptForClubOnboarding = isPresidentAccountIntent(accountIntent);
  const canUsePlayerProfile = accountIntent !== "president";

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const isAuthed = await stageClient.auth.isAuthenticated();
        if (!isAuthed) return;
        const { user: rawUser, player: rawPlayer, presidentClub: rawPresidentClub } = await resolveMyPlayerAndClub().catch(() => ({}));
        const u = asObject(rawUser);
        const resolvedPlayer = asObject(rawPlayer);
        const resolvedPresidentClub = asObject(rawPresidentClub);
        if (!u || !alive) return;
        setUser(u);
        const storedIntent = readAccountIntent(u.id);
        const effectiveIntent = resolvedPresidentClub && !resolvedPlayer && storedIntent === "player"
          ? "president"
          : storedIntent;
        setAccountIntent(effectiveIntent);
        const cl = await stageClient.entities.Club.list("-rating", 200).catch(() => []);
        if (!alive) return;
        setClubs(asObjectArray(cl));
        if (resolvedPlayer) {
          const p = resolvedPlayer;
          setPlayer(p);

          // Resolve signed club from player membership/contracts. The hero may
          // still show the management club separately through status badges.
          stageClient.entities.PlayerContract.filter({ user_id: p.id })
            .catch(() => [])
            .then((contractRows) => {
              const normalizedContracts = normalizePlayerContracts(contractRows);
              if (alive) setPlayerContracts(normalizedContracts);
              const signedClubId = getSignedClubIdForPlayer(p, normalizedContracts);
              return signedClubId ? stageClient.entities.Club.get(signedClubId).catch(() => null) : null;
            })
            .then((clubRecord) => { if (alive) setSignedClub(asObject(clubRecord)); })
            .catch(() => { if (alive) setSignedClub(null); });
          stageClient.entities.ClubMembership
            .filter({ player_id: p.id, status: "active" }, "-created_date", 20)
            .then((rows) => { if (alive) setClubMemberships(asObjectArray(rows)); })
            .catch(() => { if (alive) setClubMemberships([]); });

          stageClient.identityClaims
            .list({ player_id: p.id }, "-created_date", 20)
            .then(rows => { if (alive) setIdentityClaims(asObjectArray(rows)); })
            .catch(() => { if (alive) setIdentityClaims([]); });
          setPlayerForm({
            gamertag: p.gamertag || "",
            position: p.position || "CM",
            secondary_position: p.secondary_position || "none",
            platform: p.platform || "PlayStation",
            overall_rating: p.overall_rating || 70,
            country: p.country || "",
            country_code: p.country_code || "",
            bio: p.bio || "",
            shirt_number: p.shirt_number ?? "",
          });
          // Load PvP matches in background.
          Promise.all([
            stageClient.entities.Match.filter({ home_player_id: p.id, status: "completed" }, "-updated_date", 30).catch(() => []),
            stageClient.entities.Match.filter({ away_player_id: p.id, status: "completed" }, "-updated_date", 30).catch(() => []),
          ]).then(([pvpHome, pvpAway]) => {
            if (!alive) return;
            const allPvp = [...asObjectArray(pvpHome), ...asObjectArray(pvpAway)].filter(m => m.mode === "solo" || (!m.mode && m.home_player_id));
            const pvpMap = new Map();
            allPvp.forEach(m => { if (m.id) pvpMap.set(m.id, m); });
            setPvpMatches([...pvpMap.values()].sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0)));
          });

          Promise.all([
            loadFutMatches(p, 20).catch(() => []),
            p.eafc_club_id ? loadEafcSummary(p).catch(() => null) : Promise.resolve(null),
          ]).then(([futRows, eafcData]) => {
            if (!alive) return;
            setFutMatches(asObjectArray(futRows));
            setEafcSummary(asObject(eafcData));
          });

          if (resolvedPresidentClub) {
            setMyClub(resolvedPresidentClub);
            setClubForm({
              name: resolvedPresidentClub.name || "",
              tag: resolvedPresidentClub.tag || "",
              platform: resolvedPresidentClub.platform || "PlayStation",
              region: resolvedPresidentClub.region || "Europe",
              description: resolvedPresidentClub.description || "",
              country_code: resolvedPresidentClub.country_code || "",
            });
          } else {
            setMyClub(null);
          }
        } else if (resolvedPresidentClub) {
          setMyClub(resolvedPresidentClub);
          setView("club");
        } else if (effectiveIntent !== "president") {
          setView("edit_player");
        }
        const [notifs, joinReqs] = await Promise.all([
          stageClient.entities.Notification.filter({ recipient_email: u.email }, "-created_date", 30).catch(() => []),
          resolvedPresidentClub?.id
            ? stageClient.entities.JoinRequest.filter({ club_id: resolvedPresidentClub.id, status: "pending" }, "-created_date", 30).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (alive) {
          setNotifications(asObjectArray(notifs));
          setJoinRequests(asObjectArray(joinReqs));
        }
      } catch (err) {
        console.error("[Profile] Failed to load profile", err);
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, []);

  async function savePlayer() {
    setSaving(true);
    const formToSave = {
      ...playerForm,
      secondary_position: playerForm.secondary_position === "none" ? null : playerForm.secondary_position,
      shirt_number: playerForm.shirt_number !== "" ? Number(playerForm.shirt_number) : null,
    };
    if (player) {
      const saved = await stageClient.entities.Player.update(player.id, formToSave);
      setPlayer(asObject(saved) || ((prev) => ({ ...prev, ...formToSave })));
      setPlayerForm(f => ({
        ...f,
        secondary_position: (saved?.secondary_position || formToSave.secondary_position) || "none",
      }));
    } else {
      const created = await stageClient.entities.Player.create({
        ...formToSave,
        email: user.email,
        credits: 50,
        stc: 50_000,
        subscription: "free",
      });
      setPlayer(asObject(created));
      setPlayerForm(f => ({
        ...f,
        secondary_position: created?.secondary_position || "none",
      }));
    }
    setSaving(false);
    setView("profile");
  }

  async function submitIdentityClaim() {
    if (!player || !claimForm.platform_handle.trim()) return;
    setSubmittingClaim(true);
    try {
      const created = await stageClient.identityClaims.submit({
        player_id: player.id,
        platform: claimForm.platform,
        platform_handle: claimForm.platform_handle.trim(),
        ea_id: claimForm.ea_id.trim() || null,
        discord_handle: claimForm.discord_handle.trim() || null,
        proof_url: claimForm.proof_url.trim() || null,
        notes: claimForm.notes.trim() || null,
      });
      setIdentityClaims(prev => asObject(created) ? [created, ...asObjectArray(prev)] : asObjectArray(prev));
      setClaimForm(f => ({ ...f, proof_url: "", notes: "" }));
    } finally {
      setSubmittingClaim(false);
    }
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
      stc: 2500000,
      wage_budget_stc: 250000, transfer_budget_stc: 1000000,
      stadium_level: 0, stadium_capacity: 5000,
      tier: "Silver", win_streak: 0, loss_streak: 0, status: "active",
    });
    if (!club?.id) return;
    const refreshedPl = user.player_id
      ? await stageClient.entities.Player.get(user.player_id).catch(() => null)
      : null;
    const refreshed = refreshedPl ? [refreshedPl] : [];
    if (asObject(refreshed[0])) setPlayer(refreshed[0]);
    setMyClub(asObject(club));
    setClubForm({
      name: club.name || "",
      tag: club.tag || "",
      platform: club.platform || "PlayStation",
      region: club.region || "Europe",
      description: club.description || "",
      country_code: club.country_code || "",
    });
    setClubDialogOpen(false);
    setPresidentContractPrompt({
      club,
      president: club.president || { id: club.president_id, display_name: club.president_name || user.email },
      contractId: club.president_contract_id || club.owner_contract_id || null,
    });
  }

  async function leaveClub() {
    if (!player) return;
    await stageClient.entities.Player.update(player.id, { club_id: null, role: "member", club_roles: ["member"], status: "free_agent" });
    setPlayer(prev => ({ ...asObject(prev), club_id: null, role: "member", club_roles: ["member"], status: "free_agent" }));
    // Leaving a squad ends the Player-side membership only. The presided club
    // (`myClub`) is a management status on this Player and is untouched.
    setSignedClub(null);
    setView("profile");
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full min-h-screen bg-[#06091a]"><div className="w-8 h-8 border-4 border-white/10 border-t-blue-400 rounded-full animate-spin" /></div>;
  }

  const safeNotifications = asObjectArray(notifications);
  const safeJoinRequests = asObjectArray(joinRequests);
  const safeIdentityClaims = asObjectArray(identityClaims);
  const safePvpMatches = asObjectArray(pvpMatches);
  const safeFutMatches = asObjectArray(futMatches);
  const unreadCount = safeNotifications.filter(n => !n.read).length;
  const _latestIdentityClaim = safeIdentityClaims[0] || null;
  const pendingIdentityClaim = safeIdentityClaims.find(c => c.status === "pending");
  const profileRoleBadges = getFootballRoleBadges(player);
  const profileManagementBadges = getPlayerManagementBadges({
    player,
    club: myClub,
    memberships: clubMemberships,
    contracts: playerContracts,
  });

  const OUTCOME_STYLE = {
    W: "bg-success/15 text-success border-success/30",
    L: "bg-destructive/15 text-destructive border-destructive/30",
    D: "bg-warning/15 text-warning border-warning/30",
  };

  // ─── Public Player Profile View ───
  if (view === "profile") {
    const profileTabs = [
      { id: "posts", label: t("commonPages.profTab_posts") },
      { id: "showcase", label: t("commonPages.profTab_showcase") },
      { id: "stats", label: t("commonPages.profTab_stats") },
      { id: "career", label: t("commonPages.gamerTabCareer") },
      { id: "matches", label: t("commonPages.profTab_matches") },
      { id: "trophies", label: t("commonPages.profTab_trophies") },
    ];

    return (
      <GamerProfileShell>
        <PresidentContractDialog
          open={!!presidentContractPrompt}
          club={presidentContractPrompt?.club}
          president={presidentContractPrompt?.president}
          contractId={presidentContractPrompt?.contractId}
          onSigned={() => {
            setPresidentContractPrompt(null);
            setView("club");
          }}
          onClose={() => setPresidentContractPrompt(null)}
        />

        <GamerProfileHero
          player={player}
          user={user}
          club={signedClub || myClub}
          roleBadges={profileRoleBadges}
          managementBadges={profileManagementBadges}
          formatPositions={formatPositions}
          onAvatarClick={player?.avatar_url ? () => setAvatarLightboxOpen(true) : undefined}
          verifiedHandle={
            Number(player?.is_verified) === 1 && player?.verified_platform_handle
              ? `${player.verified_platform || "Platform"} · ${player.verified_platform_handle}`
              : null
          }
          topActions={(
            <>
              {unreadCount > 0 ? (
                <button type="button" onClick={() => setView("notifications")} className="relative p-2.5 rounded-full border border-white/10 bg-black/40 backdrop-blur-md hover:bg-black/60 transition-colors">
                  <Bell className="w-4 h-4 text-white" />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-primary text-[9px] flex items-center justify-center font-bold">{unreadCount}</span>
                </button>
              ) : null}
              {safeJoinRequests.length > 0 ? (
                <button type="button" onClick={() => setView("requests")} className="relative p-2.5 rounded-full border border-white/10 bg-black/40 backdrop-blur-md hover:bg-black/60 transition-colors">
                  <UserCheck className="w-4 h-4 text-white" />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-warning text-[9px] flex items-center justify-center font-bold">{safeJoinRequests.length}</span>
                </button>
              ) : null}
              {canUsePlayerProfile ? (
                <button type="button" onClick={() => setView("edit_player")} className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md hover:bg-black/60 text-white/80 text-xs font-bold uppercase tracking-wider">
                  <Settings className="w-4 h-4" /> {t("commonPages.profEditProfile")}
                </button>
              ) : null}
              <button type="button" onClick={() => stageClient.auth.logout()} className="p-2.5 rounded-full border border-white/10 bg-black/40 backdrop-blur-md hover:bg-black/60 transition-colors">
                <LogOut className="w-4 h-4 text-white/70" />
              </button>
            </>
          )}
          sideActions={(
            <>
              <Link to={homePath}>
                <Button type="button" size="sm" className="font-heading uppercase text-xs bg-gradient-to-r from-cyan-500/80 to-teal-500/80 hover:from-cyan-400 hover:to-teal-400 text-black font-black">
                  {homeLabel}
                </Button>
              </Link>
              {myClub ? (
                tournamentMode && myClubHref ? (
                  <Link to={myClubHref}>
                    <Button type="button" size="sm" variant="outline" className="gap-1.5 h-9 px-3 text-xs border-white/15 text-white hover:bg-white/10 bg-white/[0.03] font-heading uppercase">
                      <Shield className="w-3.5 h-3.5" /> {t("nav.myClub")}
                    </Button>
                  </Link>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => setView("club")} className="gap-1.5 h-9 px-3 text-xs border-white/15 text-white hover:bg-white/10 bg-white/[0.03] font-heading uppercase">
                    <Shield className="w-3.5 h-3.5" /> {t("nav.myClub")}
                  </Button>
                )
              ) : null}
            </>
          )}
        />

        <div className="max-w-6xl mx-auto px-4 mt-6 space-y-5 pb-10">
          {!tournamentMode ? <SubscriptionProgress player={player} /> : null}

          {player && Number(player.is_verified) === 1 ? (
            <GamerSectionCard title={t("commonPages.profIdentityVerified")}>
              <p className="text-xs text-white/50">
                {t("commonPages.profIdentityVerifiedDesc", { handle: player.verified_platform_handle || t("commonPages.profAPlatformIdentity") })}
              </p>
            </GamerSectionCard>
          ) : null}

          {player && pendingIdentityClaim ? (
            <GamerSectionCard title={t("commonPages.profIdentityReview")}>
              <p className="text-xs text-white/50">
                {pendingIdentityClaim.platform} · {pendingIdentityClaim.platform_handle}
              </p>
            </GamerSectionCard>
          ) : null}

          {player && Number(player.is_verified) !== 1 && !pendingIdentityClaim ? (
            <GamerSectionCard title={t("commonPages.profClaimIdentity")}>
              <p className="text-xs text-white/50 mb-3">{t("commonPages.profClaimIdentityDesc")}</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <Select value={claimForm.platform} onValueChange={v => setClaimForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger className="bg-black/30 border-white/10 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PlayStation">PlayStation</SelectItem>
                    <SelectItem value="Xbox">Xbox</SelectItem>
                    <SelectItem value="PC">PC</SelectItem>
                    <SelectItem value="EA">EA</SelectItem>
                    <SelectItem value="Discord">Discord</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={claimForm.platform_handle} onChange={e => setClaimForm(f => ({ ...f, platform_handle: e.target.value }))} className="bg-black/30 border-white/10 text-white" placeholder={t("commonPages.profHandlePlaceholder")} />
                <Input value={claimForm.ea_id} onChange={e => setClaimForm(f => ({ ...f, ea_id: e.target.value }))} className="bg-black/30 border-white/10 text-white" placeholder={t("commonPages.profEaIdPlaceholder")} />
                <Input value={claimForm.discord_handle} onChange={e => setClaimForm(f => ({ ...f, discord_handle: e.target.value }))} className="bg-black/30 border-white/10 text-white" placeholder={t("commonPages.profDiscordPlaceholder")} />
              </div>
              <Button size="sm" onClick={submitIdentityClaim} disabled={submittingClaim || !claimForm.platform_handle.trim()} className="gap-1.5 mt-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
                {submittingClaim ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {t("commonPages.profSubmitClaim")}
              </Button>
            </GamerSectionCard>
          ) : null}

          {player ? (
            <>
              <GamerTabNav tabs={profileTabs} active={profileTab} onChange={setProfileTab} />

              {profileTab === "posts" ? (
                <div className="pt-2">
                  <PlayerFeed currentUser={user} player={player} isOwner={true} />
                </div>
              ) : null}

              {profileTab === "showcase" ? (
                <div className="pt-2 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <GamerSectionCard title={t("commonPages.profTab_showcase")}>
                    <div className="space-y-3">
                      <p className="font-heading text-2xl font-black uppercase text-white leading-none">
                        {player.gamertag || user?.full_name || "Player"}
                      </p>
                      {player.bio ? (
                        <p className="text-sm text-white/60 leading-relaxed">{player.bio}</p>
                      ) : (
                        <p className="text-sm text-white/40">{t("commonPages.profBioPlaceholder")}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {profileManagementBadges.map((badge) => (
                          <span key={badge.id} className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-200">
                            {badge.label}
                          </span>
                        ))}
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/55">
                          {formatPositions(player)}
                        </span>
                      </div>
                    </div>
                  </GamerSectionCard>
                  <GamerSectionCard title={t("commonPages.currentClub")}>
                    {signedClub || myClub ? (
                      <Link to={signedClub?.id ? `/clubs/${signedClub.id}` : (myClubHref || `/clubs/${myClub.id}`)} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:border-cyan-400/30 transition-colors">
                        <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                          {(signedClub || myClub).logo_url ? (
                            <img src={(signedClub || myClub).logo_url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Shield className="h-5 w-5 text-cyan-300/80" />
                          )}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-white truncate">{(signedClub || myClub).name}</span>
                          <span className="block text-xs text-white/40 truncate">{(signedClub || myClub).tag ? `[${(signedClub || myClub).tag}]` : t("commonPages.cdClubOffice")}</span>
                        </span>
                      </Link>
                    ) : (
                      <p className="text-sm text-white/40">{t("commonPages.profNotClub")}</p>
                    )}
                  </GamerSectionCard>
                </div>
              ) : null}

              {profileTab === "stats" ? (
                <div className="pt-2">
                  <GamerProfileStatsPanel player={player} t={t} />
                </div>
              ) : null}

              {profileTab === "career" ? (
                <div className="pt-2 space-y-4">
                  <EafcClubLinkPanel player={player} eafcSummary={eafcSummary} onPlayerUpdate={setPlayer} />
                  <FutMatchLogPanel playerId={player.id} initialMatches={safeFutMatches} />
                </div>
              ) : null}

              {profileTab === "matches" ? (
                <div className="pt-2 space-y-2">
                  {safePvpMatches.length === 0 ? (
                    <GamerSectionCard>
                      <div className="py-8 text-center">
                        <Swords className="w-10 h-10 text-white/20 mx-auto mb-3" />
                        <p className="text-sm text-white/40">{t("commonPages.profNoPvp")}</p>
                      </div>
                    </GamerSectionCard>
                  ) : (
                    safePvpMatches.slice(0, 30).map(m => {
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
                        <div key={m.id} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 flex items-center gap-2 sm:gap-3">
                          <span className={cn("text-xs font-bold px-2 py-1 rounded border shrink-0", OUTCOME_STYLE[outcome])}>{outcome}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">vs {opponent || "Unknown"}</p>
                            <p className="text-[10px] text-white/40">{dateStr}</p>
                          </div>
                          <span className="text-sm font-bold text-white shrink-0">{scoreStr}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}

              {profileTab === "trophies" ? (
                <div className="pt-2">
                  <PlayerTrophyCabinet player={player} />
                </div>
              ) : null}
            </>
          ) : null}
        </div>

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
                  <Move className="w-3.5 h-3.5" /> {t("commonPages.profRepositionPhoto")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {!player && canUsePlayerProfile && (
          <div className="max-w-2xl mx-auto px-4 mt-6">
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6 text-center">
              <h2 className="font-bold text-white text-lg mb-2">{t("commonPages.profWelcome")}</h2>
              <p className="text-white/50 text-sm mb-4">{t("commonPages.profWelcomeDesc")}</p>
              <Button onClick={() => setView("edit_player")} className="bg-blue-600 hover:bg-blue-500 text-white">{t("commonPages.profCreateProfile")}</Button>
            </div>
          </div>
        )}

        {player && (!player.gamertag || !player.position || !player.platform) && (
          <div className="max-w-2xl mx-auto px-4 mt-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <User className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">{t("commonPages.profNotPlayer")}</p>
                <p className="text-xs text-white/50">{t("commonPages.profNotPlayerDesc")}</p>
              </div>
              <Button size="sm" onClick={() => setProfileModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white shrink-0 gap-1.5">
                <Edit2 className="w-3.5 h-3.5" /> {t("commonPages.complete")}
              </Button>
            </div>
          </div>
        )}

        {player && player.gamertag && player.position && player.platform && !myClub && canPromptForClubOnboarding && (
          <div className="max-w-2xl mx-auto px-4 mt-4">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">{t("commonPages.profNotClub")}</p>
                <p className="text-xs text-white/50">{t("commonPages.profNotClubDesc")}</p>
              </div>
              <Button size="sm" onClick={() => setClubOnboardingOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white shrink-0 gap-1.5">
                <Plus className="w-3.5 h-3.5" /> {t("commonPages.getStarted")}
              </Button>
            </div>
          </div>
        )}

        <ProfileCompletionModal
          open={profileModalOpen}
          player={player}
          allowClubOnboarding={canPromptForClubOnboarding}
          onComplete={async (club) => {
            setProfileModalOpen(false);
            if (asObject(club)) setMyClub(club);
            const refreshedPl = user?.player_id
              ? await stageClient.entities.Player.get(user.player_id).catch(() => null)
              : null;
            if (asObject(refreshedPl)) setPlayer(refreshedPl);
          }}
        />

        <ClubOnboardingModal
          open={clubOnboardingOpen && canPromptForClubOnboarding}
          player={player}
          onComplete={async (club) => {
            setClubOnboardingOpen(false);
            if (club) {
              setMyClub(asObject(club));
              const refreshedPl = user.player_id
      ? await stageClient.entities.Player.get(user.player_id).catch(() => null)
      : null;
    const refreshed = refreshedPl ? [refreshedPl] : [];
              if (asObject(refreshed[0])) setPlayer(refreshed[0]);
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
          previewPlayer={player}
          onConfirm={async (url, position, zoom) => {
            await stageClient.entities.Player.update(player.id, { avatar_url: url, avatar_position: position, avatar_zoom: zoom || 150 });
            setPlayer(prev => ({ ...asObject(prev), avatar_url: url, avatar_position: position, avatar_zoom: zoom || 150 }));
            setAvatarEditorOpen(false);
          }}
        />
      </GamerProfileShell>
    );
  }

  // ─── Edit Player View ───
  if (view === "edit_player") {
    const playerInfoForm = (
      <>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.profGamertag")}</label>
            <Input value={playerForm.gamertag} onChange={e => setPlayerForm(f => ({ ...f, gamertag: e.target.value }))} className="bg-secondary border-border" placeholder={t("commonPages.profGamertagPlaceholder")} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.profMainPosition")}</label>
            <Select value={playerForm.position} onValueChange={v => setPlayerForm(f => ({ ...f, position: v, secondary_position: f.secondary_position === v ? "none" : f.secondary_position }))}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {POSITIONS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.profSecondPosition")}</label>
            <Select value={playerForm.secondary_position} onValueChange={v => setPlayerForm(f => ({ ...f, secondary_position: v }))}>
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("commonPages.profNone")}</SelectItem>
                {POSITIONS.filter(p => p !== playerForm.position).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.platform")}</label>
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
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.country")} <span className="text-destructive">*</span></label>
            <Select value={playerForm.country} onValueChange={v => {
              const found = COUNTRIES.find(c => c.name === v);
              setPlayerForm(f => ({ ...f, country: v, country_code: found?.code || "" }));
            }}>
              <SelectTrigger className={`bg-secondary border-border ${!playerForm.country ? "border-destructive/50" : ""}`}>
                <SelectValue placeholder={t("commonPages.profSelectCountry")} />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => <SelectItem key={c.code} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {!playerForm.country && <p className="text-[11px] text-destructive mt-1">{t("commonPages.profCountryRequired")}</p>}
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.profOverallRating")}</label>
            <Input type="number" min={1} max={99} value={playerForm.overall_rating} onChange={e => setPlayerForm(f => ({ ...f, overall_rating: parseInt(e.target.value) || 70 }))} className="bg-secondary border-border" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.profShirtNumber")}</label>
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
            <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.profAccountEmail")}</label>
            <Input value={user?.email || ""} disabled className="bg-secondary border-border opacity-50" />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">{t("commonPages.bio")}</label>
          <Textarea value={playerForm.bio} onChange={e => setPlayerForm(f => ({ ...f, bio: e.target.value }))} className="bg-secondary border-border resize-none" rows={3} placeholder={t("commonPages.profBioPlaceholder")} />
        </div>
      </>
    );

    if (!player) {
      return (
        <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
          <div className="flex items-center gap-3">
            <h1 className="font-heading text-2xl font-black text-foreground uppercase">{t("commonPages.profCreateProfile")}</h1>
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            <h2 className="text-xl font-bold text-foreground">{t("commonPages.profPlayerInfo")}</h2>
            {playerInfoForm}
            <Button onClick={savePlayer} disabled={saving || !playerForm.gamertag || !playerForm.country} className="bg-primary text-primary-foreground">
              <Save className="w-4 h-4 mr-2" /> {saving ? t("commonPages.profSaving") : t("commonPages.profCreateProfile")}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <ProfileEditShell
        title={t("commonPages.profEditProfile")}
        infoTitle={t("commonPages.profPlayerInfo")}
        onBack={() => setView("profile")}
        photoUrl={player.avatar_url}
        photoPosition={player.avatar_position}
        photoZoom={player.avatar_zoom}
        bannerUrl={player.banner_url}
        bannerPosition={player.banner_position}
        bannerZoom={player.banner_zoom}
        bannerPreview={{ name: player.gamertag || user?.full_name, subtitle: player.position, avatarUrl: player.avatar_url, type: "player" }}
        onPhotoChange={async ({ url, position, zoom }) => {
          await stageClient.entities.Player.update(player.id, { avatar_url: url, avatar_position: position, avatar_zoom: zoom || 150 });
          setPlayer((prev) => ({ ...asObject(prev), avatar_url: url, avatar_position: position, avatar_zoom: zoom || 150 }));
        }}
        onBannerChange={async (update) => {
          setPlayer((prev) => ({ ...asObject(prev), ...update }));
          try {
            await stageClient.entities.Player.update(player.id, update);
          } catch (err) {
            console.error("Failed to save banner:", err);
          }
        }}
        footer={(
          <Button onClick={savePlayer} disabled={saving || !playerForm.gamertag || !playerForm.country} className="bg-primary text-primary-foreground">
            <Save className="w-4 h-4 mr-2" /> {saving ? t("commonPages.profSaving") : t("commonPages.profSaveChanges")}
          </Button>
        )}
      >
        {playerInfoForm}
      </ProfileEditShell>
    );
  }

  // ─── My Club View ───
  if (view === "club") {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("profile")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("commonPages.profBack")}
          </button>
          <h1 className="font-heading text-2xl font-black text-foreground uppercase">{t("nav.myClub")}</h1>
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
                <StatBox label={t("commonPages.profWins")} value={myClub.wins || 0} accent="success" />
                <StatBox label={t("commonPages.matches")} value={(myClub.wins || 0) + (myClub.losses || 0) + (myClub.draws || 0)} />
                <StatBox label={t("commonPages.profTrophies")} value={myClub.trophies || 0} accent="accent" />
              </div>
              <div className="flex gap-3 flex-wrap">
                <Link to={myClubHref || `/clubs/${myClub.id}`}>
                  <Button className="bg-primary text-primary-foreground gap-1.5">
                    <Shield className="w-4 h-4" /> {t("commonPages.profViewClubPage")}
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => setView("edit_club")} className="gap-1.5">
                  <Edit2 className="w-4 h-4" /> {t("commonPages.profEditClub")}
                </Button>
                <Button variant="outline" onClick={leaveClub} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  {t("commonPages.profLeaveClub")}
                </Button>
              </div>
            </div>
          </div>
        ) : canPromptForClubOnboarding ? (
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-2xl p-8 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">{t("commonPages.profNotClub")}</p>
              <Button onClick={() => setClubOnboardingOpen(true)} className="bg-primary text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" /> {t("commonPages.profCreateOrJoin")}
              </Button>
            </div>
            <ClubOnboardingModal
              open={clubOnboardingOpen && canPromptForClubOnboarding}
              player={player}
              onComplete={async (club) => {
                setClubOnboardingOpen(false);
                if (club) {
                  setMyClub(asObject(club));
                  const refreshedPl = user.player_id
      ? await stageClient.entities.Player.get(user.player_id).catch(() => null)
      : null;
    const refreshed = refreshedPl ? [refreshedPl] : [];
                  if (asObject(refreshed[0])) setPlayer(refreshed[0]);
                  setView("club");
                }
              }}
            />
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-0">{t("commonPages.profNotClub")}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Edit Club View ───
  if (view === "edit_club" && myClub) {
    return (
      <ClubProfileEdit
        club={myClub}
        onBack={() => setView("club")}
        onSaved={(updated) => {
          setMyClub((prev) => ({ ...asObject(prev), ...updated }));
          setClubForm((f) => ({
            ...f,
            name: updated.name ?? f.name,
            tag: updated.tag ?? f.tag,
            platform: updated.platform ?? f.platform,
            region: updated.region ?? f.region,
            country_code: updated.country_code ?? f.country_code,
            description: updated.description ?? f.description,
          }));
        }}
      />
    );
  }

  // ─── Notifications View ───
  if (view === "notifications") {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("profile")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("commonPages.profBack")}
          </button>
          <h1 className="font-heading text-2xl font-black text-foreground uppercase">{t("commonPages.notifTitle")}</h1>
        </div>
        <div className="space-y-2">
          {safeNotifications.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">{t("commonPages.notifEmpty")}</p>
            </div>
          ) : safeNotifications.map(n => (
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
                    setNotifications(prev => asObjectArray(prev).map(x => x.id === n.id ? { ...x, read: true } : x));
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
            <ArrowLeft className="w-4 h-4" /> {t("commonPages.profBack")}
          </button>
          <h1 className="font-heading text-2xl font-black text-foreground uppercase">{t("commonPages.profJoinRequests")}</h1>
          <span className="w-5 h-5 rounded-full bg-warning text-background text-[9px] flex items-center justify-center font-bold">{safeJoinRequests.length}</span>
        </div>
        <div className="space-y-2">
          {safeJoinRequests.map(req => (
            <div key={req.id} className="bg-card border border-warning/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0 font-bold text-sm text-primary">
                {req.player_gamertag?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{req.player_gamertag}</p>
                {req.message && <p className="text-xs text-muted-foreground truncate">"{req.message}"</p>}
                <p className="text-[11px] text-primary mt-1">{t("commonPages.profApprovalsNote")}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Link to={`/clubs/${req.club_id}`}>
                  <Button size="sm" className="bg-success/20 text-success border border-success/30 hover:bg-success/30 text-xs h-7">
                    <Check className="w-3 h-3 mr-1" /> {t("commonPages.profOperations")}
                  </Button>
                </Link>
                <Button size="sm" onClick={async () => {
                  await stageClient.entities.JoinRequest.update(req.id, { status: "rejected" });
                  await stageClient.entities.Notification.create({ recipient_email: req.player_email, type: "join_rejected", title: `Request to ${req.club_name} declined`, body: "Your join request was not accepted.", read: false });
                  setJoinRequests(prev => asObjectArray(prev).filter(r => r.id !== req.id));
                }} className="bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 text-xs h-7">
                  <X className="w-3 h-3 mr-1" /> {t("commonPages.profDecline")}
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
