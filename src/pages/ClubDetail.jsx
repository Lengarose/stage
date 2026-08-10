import { useState, useEffect, useRef, useId } from "react";
import { useParams, Link } from "react-router-dom";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import {
  Shield, Users, Trophy, ArrowLeft,
  Check, X, Send, Loader2, LogOut,
  Trash2, Swords, Edit2, ClipboardList, Clock, MessageCircle,
  Bell, BellOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import BannerSelector from "../components/BannerSelector";
import ImagePositionEditor from "../components/ImagePositionEditor";
import ClubFeed from "../components/ClubFeed";
import ClubForm from "../components/ClubForm";
import ClubPlayerStats from "../components/ClubPlayerStats";
import ContractsTab from "../components/contracts/ContractsTab";
import ClubFinanceTab from "../components/club/ClubFinanceTab";
import ClubOperations from "@/components/club/ClubOperations";
import ShirtSalesPanel from "../components/ShirtSalesPanel";
import StadiumUpgrade from "../components/club/StadiumUpgrade";
import { cn } from "@/lib/utils";
import { getContractTargetPlayerId, getContractType, normalizePlayerContracts } from "@/lib/playerContractFields";
import { mergeActiveContractPlayersIntoSquad } from "@/lib/clubSquadContracts";
import { getClubPresidentContactEmail, isClubPresidentForUser, isAdminUser as isClubAccessAdmin } from "@/lib/clubPresidentAccess";
import { asObject, asObjectArray } from "@/lib/safeData";
import { useNavigate } from "react-router-dom";
import { ClubTrophyCabinetDisplay } from "@/components/profile/PlayerTrophyCabinet";
import ClubAchievementsTab from "@/components/rewards/ClubAchievementsTab";
import { useChatChannel } from "@/lib/ChatNotificationsContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/AuthContext";
import GamerClubProfileHero from "@/components/profile/gamer/GamerClubProfileHero";
import GamerClubTabNav from "@/components/profile/gamer/GamerClubTabNav";
import { GamerClubPhotoFrame } from "@/components/profile/gamer/GamerClubCard";
import { GamerProfileShell, GamerStatTile } from "@/components/profile/gamer/GamerProfileUI";
import ClubProfileEdit from "@/components/club/ClubProfileEdit";
import { getPrimaryClubRole, mergeStaffRolesIntoPlayers, normalizeClubRole } from "@/lib/clubStaffRoles";

const POSITION_OPTIONS = [
  "GK", "RB", "RWB", "CB", "LB", "LWB", "CDM", "CM", "CAM",
  "RM", "LM", "RW", "LW", "CF", "ST",
];

const CONSOLE_OPTIONS = ["PlayStation", "Xbox", "PC"];

const CLUB_ROLE_LABEL_KEYS = {
  president: "commonPages.cdPresident",
  captain: "commonPages.cdCaptain",
  vice_captain: "commonPages.cdViceCaptain",
  member: "commonPages.cdMember",
};

const CLUB_ROLE_FALLBACK_LABELS = {
  president: "President",
  captain: "Captain",
  vice_captain: "Vice-Captain",
  member: "Member",
};

function clubRoleLabel(t, role) {
  const normalized = normalizeClubRole(role) || "member";
  const key = CLUB_ROLE_LABEL_KEYS[normalized] || CLUB_ROLE_LABEL_KEYS.member;
  const translated = t(key);
  return translated === key ? (CLUB_ROLE_FALLBACK_LABELS[normalized] || normalized.replace(/_/g, " ")) : translated;
}

function ClubPresidentChip({ club, president }) {
  const { t } = useTranslation();
  const presidentId = president?.id || club?.president_id;
  if (!presidentId) return null;
  const name = president?.display_name || t("commonPages.cdPresident");
  return (
    <Link
      to={`/presidents/${presidentId}`}
      className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-black/45 backdrop-blur-md px-2.5 py-1.5 hover:bg-black/60 hover:border-amber-300/30 transition-colors max-w-[220px]"
      title={t("commonPages.presProfileMenu")}
    >
      <span
        className="w-8 h-8 rounded-full border border-white/20 bg-[#101827] overflow-hidden shrink-0 flex items-center justify-center"
        style={president?.avatar_url ? {
          backgroundImage: `url(${president.avatar_url})`,
          backgroundSize: `${president.avatar_zoom || 150}%`,
          backgroundPosition: president.avatar_position || "50% 50%",
          backgroundRepeat: "no-repeat",
        } : undefined}
        aria-hidden
      >
        {!president?.avatar_url ? <Shield className="w-3.5 h-3.5 text-amber-300/80" /> : null}
      </span>
      <span className="font-heading text-sm font-black uppercase tracking-wide text-white truncate">
        {name}
      </span>
    </Link>
  );
}

export default function ClubDetail({ overrideClubId, tournamentId = null } = {}) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const params = useParams();
  const id = overrideClubId || params.id;
  const limitedTournamentId =
    tournamentId ||
    (authUser?.access_mode === "tournament_limited" ? authUser?.limited_tournament_id : null) ||
    null;
  const clubsListPath = limitedTournamentId ? "/tournaments/clubs" : "/clubs";
  const [club, setClub] = useState(null);
  const [president, setPresident] = useState(null);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tournamentMatches, setTournamentMatches] = useState([]);
  const [tournamentMap, setTournamentMap] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [trialRequestSent, setTrialRequestSent] = useState(false);
  const [sendingTrial, setSendingTrial] = useState(false);
  const [trialMsg, setTrialMsg] = useState("");
  const [trialPosition, setTrialPosition] = useState("");
  const [trialConsole, setTrialConsole] = useState("");
  const [trialExperience, setTrialExperience] = useState("");
  const [showTrialPreview, setShowTrialPreview] = useState(false);
  const [trialDialogOpen, setTrialDialogOpen] = useState(false);
  const [_myClubData, setMyClubData] = useState(null);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [logoPreviewOpen, setLogoPreviewOpen] = useState(false);
  const [pendingLogo, setPendingLogo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [historyRows,   setHistoryRows]   = useState([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [editClubOpen, setEditClubOpen] = useState(false);
  const [clubChatMessages, setClubChatMessages] = useState([]);
  const [clubChatInput, setClubChatInput] = useState("");
  const [sendingClubChat, setSendingClubChat] = useState(false);
  const [operationStaffRoles, setOperationStaffRoles] = useState([]);
  const navigate = useNavigate();
  const logoInputRef  = useRef();
  const logoInputId = useId();
  const pendingFileRef = useRef(null);

  const isMember = !!myPlayer?.club_id && myPlayer.club_id === id;
  const isCaptain = isMember && (myPlayer?.role === "captain" || myPlayer?.role === "vice-captain");
  const isAdminUser = isClubAccessAdmin(currentUser);
  const isAdminTakeover = isAdminUser && localStorage.getItem("admin_takeover_club_id") === id;
  const accountMode = localStorage.getItem("stage-account-mode") || "player";
  const isOwner = isClubPresidentForUser({
    user: currentUser,
    club,
    includeLegacyOwnerEmail: accountMode === "club",
  }) || isAdminTakeover;
  const isPresident = isMember && myPlayer?.club_roles?.includes("president");
  const isViceCaptain = isMember && (myPlayer?.role === "vice-captain" || myPlayer?.club_roles?.includes("vice-captain"));
  const canEdit = isOwner || isCaptain;
  const canOpenOperations = isMember || isOwner || isPresident || isCaptain || isViceCaptain || operationStaffRoles.length > 0 || isAdminTakeover;
  const CLUB_CHAT_CHANNEL = `club:${id}`;
  // Register the club chat channel with the global notifications provider,
  // mark it "open" while the page is mounted, and expose mute toggle.
  const {
    isMuted: isClubChatMuted,
    toggleMuted: toggleClubChatMuted,
    unreadCount: clubChatUnreadCount,
  } = useChatChannel(CLUB_CHAT_CHANNEL);

  useEffect(() => {
    async function load() {
      try {
        const user = asObject(await stageClient.auth.me().catch(() => null));
        setCurrentUser(user);
        const userEmail = user?.email || "";

        const { player: resolvedPlayer = null, presidentClub = null } = await resolveMyPlayerAndClub().catch(() => ({}));
        const myPlResolved = asObject(resolvedPlayer);
        const [clubRecordRaw, initialPlayerRows, staffRoleRows, activeContractRows] = await Promise.all([
          stageClient.entities.Club.get(id).catch(() => null),
          stageClient.entities.Player.filter({ club_id: id }).catch(() => []),
          stageClient.entities.ClubStaffRole.filter({ club_id: id }, "-created_date", 200).catch(() => []),
          stageClient.entities.PlayerContract.filter({ team_id: id, status: "active" }, "-created_date", 200).catch(() => []),
        ]);

        const c = asObject(clubRecordRaw);
        let presidentRecord = null;
        if (c?.president_id) {
          presidentRecord = asObject(await stageClient.entities.President.get(c.president_id).catch(() => null));
        } else if (c?.id) {
          const byClub = await stageClient.entities.President.filter({ club_id: c.id }, null, 1).catch(() => []);
          presidentRecord = asObject(asObjectArray(byClub)[0]);
        }
        setPresident(presidentRecord);
        const staffRows = asObjectArray(staffRoleRows);
        const myPl = myPlResolved ? [myPlResolved] : [];
        let playerData = asObjectArray(initialPlayerRows).filter((player) => player.id);
        const playerIds = new Set(playerData.map((player) => player.id).filter(Boolean));

        const safeActiveContracts = normalizePlayerContracts(activeContractRows);
        const liveOwnershipContracts = safeActiveContracts.filter((contract) =>
          getContractType(contract) === "ownership"
        );
        if (liveOwnershipContracts.length > 0) {
          const ownershipPlayers = await Promise.all(
            liveOwnershipContracts
              .filter((contract) => {
                const playerId = getContractTargetPlayerId(contract);
                return playerId && !playerIds.has(playerId);
              })
              .map((contract) => stageClient.entities.Player.get(getContractTargetPlayerId(contract)).catch(() => null))
          );
          const normalizedOwners = asObjectArray(ownershipPlayers).map((ownerPlayer) => ({
            ...ownerPlayer,
            club_id: ownerPlayer.club_id || id,
            club_roles: Array.isArray(ownerPlayer.club_roles) && ownerPlayer.club_roles.includes("president")
              ? ownerPlayer.club_roles
              : ["president"],
            role: ownerPlayer.role === "captain" || ownerPlayer.role === "owner" || !ownerPlayer.role
              ? "president"
              : ownerPlayer.role,
          }));
          playerData = [...playerData, ...normalizedOwners];
        }

        const activeContractPlayerIds = [
          ...new Set(safeActiveContracts.map(getContractTargetPlayerId).filter(Boolean)),
        ];
        const visiblePlayerIds = new Set(playerData.map((player) => player.id).filter(Boolean));
        const missingContractPlayerIds = activeContractPlayerIds.filter((playerId) => !visiblePlayerIds.has(playerId));
        if (missingContractPlayerIds.length > 0) {
          const contractedPlayerRows = await Promise.all(
            missingContractPlayerIds.map((playerId) =>
              stageClient.entities.Player.get(playerId).catch(() => null)
            )
          );
          playerData = mergeActiveContractPlayersIntoSquad(
            playerData,
            safeActiveContracts,
            asObjectArray(contractedPlayerRows),
            id
          );
        }

        const [matchesHomeRaw, matchesAwayRaw, tmHomeRaw, tmAwayRaw] = await Promise.all([
          stageClient.profileMatches.list({ home_club_id: id, status: "completed" }, "round", 30).catch(() => []),
          stageClient.profileMatches.list({ away_club_id: id, status: "completed" }, "round", 30).catch(() => []),
          stageClient.profileMatches.list({ home_club_id: id, status: "scheduled" }, "round", 30).catch(() => []),
          stageClient.profileMatches.list({ away_club_id: id, status: "scheduled" }, "round", 30).catch(() => []),
        ]);

        const matchesHome = asObjectArray(matchesHomeRaw);
        const matchesAway = asObjectArray(matchesAwayRaw);
        const tmHome = asObjectArray(tmHomeRaw);
        const tmAway = asObjectArray(tmAwayRaw);
        const allMatchesRaw = [...matchesHome, ...matchesAway, ...tmHome, ...tmAway];
        const tIds = [...new Set(allMatchesRaw.map((match) => match.tournament_id).filter((tid) => tid && tid !== "ranked"))];
        const tMap = {};
        if (tIds.length > 0) {
          const tournamentResults = await Promise.all(
            tIds.map((tid) => stageClient.entities.Tournament.filter({ id: tid }, null, 1).catch(() => []))
          );
          tournamentResults.forEach((rows) => {
            const [tournament] = asObjectArray(rows);
            if (tournament?.id) tMap[tournament.id] = tournament;
          });
        }
        setTournamentMap(tMap);

        setClub(c);
        setPlayers(mergeStaffRolesIntoPlayers(playerData, staffRows));

        const allMatches = [...matchesHome, ...matchesAway].sort(
          (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
        );
        setMatches(allMatches);
        setTournamentMatches([...tmHome, ...tmAway].sort((a, b) => new Date(a.scheduled_date || 0) - new Date(b.scheduled_date || 0)));

        if (myPl.length > 0) {
          const mine = myPl[0];
          setMyPlayer(mine);
          setOperationStaffRoles(staffRows.filter((role) =>
            role.user_id === user?.id || role.player_id === mine.id
          ));
          if (mine.club_id && mine.club_id !== id) {
            const myClubRecord = asObject(await stageClient.entities.Club.get(mine.club_id).catch(() => null));
            if (myClubRecord) setMyClubData(myClubRecord);
          }
        } else {
          setMyPlayer(null);
          setOperationStaffRoles([]);
        }

        const isCanonicalPresidentForThisClub = isClubPresidentForUser({
          user,
          club: c,
          presidentClub,
        });
        if ((myPl.length > 0 && (
          myPl[0].role === "captain" ||
          myPl[0].role === "vice-captain" ||
          myPl[0].club_roles?.includes("president")
        )) || isCanonicalPresidentForThisClub) {
          const reqs = await stageClient.entities.JoinRequest.filter({ club_id: id, status: "pending" }).catch(() => []);
          setJoinRequests(asObjectArray(reqs));
        } else {
          setJoinRequests([]);
        }

        if (myPl.length > 0 && userEmail) {
          const existingTrials = asObjectArray(await stageClient.entities.InboxMessage.filter(
            { sender_email: userEmail, message_type: "trial_request" }, null, 20
          ).catch(() => []));
          const sentToThisClub = existingTrials.some((message) => (
            asObject(message.metadata)?.club_id === id || message.related_entity_id === id
          ));
          setTrialRequestSent(sentToThisClub);
        } else {
          setTrialRequestSent(false);
        }

        const clubChatRows = await stageClient.entities.ChatMessage
          .filter({ match_id: CLUB_CHAT_CHANNEL }, "created_date", 300)
          .catch(() => []);
        setClubChatMessages(asObjectArray(clubChatRows));
      } catch (err) {
        console.error("ClubDetail load failed:", err);
        setClub(null);
      } finally {
        setLoading(false);
      }
    }
    load();

    const unsubPlayer = stageClient.entities.Player.subscribe((event) => {
      const row = asObject(event.data);
      if (!row || row.club_id !== id || !row.id) return;
      if (row._entity === "player" || row.gamertag) {
        if (event.type === "delete") {
          setPlayers((prev) => asObjectArray(prev).filter((p) => p.id !== event.id));
        } else if (event.type === "update") {
          setPlayers((prev) => asObjectArray(prev).map((p) => (p.id === event.id ? row : p)));
        } else if (event.type === "create") {
          setPlayers((prev) => {
            const safePrev = asObjectArray(prev);
            return safePrev.some((p) => p.id === row.id) ? safePrev : [row, ...safePrev];
          });
        }
      }
    }, { club_id: id });
    return () => { unsubPlayer(); };
  }, [id]);

  async function sendTrialRequest() {
    if (!myPlayer || !club) return;
    const gamerTag = myPlayer.gamertag || "Unknown";
    let recipientEmail = String(getClubPresidentContactEmail({ club })).trim().toLowerCase();
    if (!recipientEmail) {
      const contact = await stageClient.functions.invoke("resolveClubContact", { club_id: id }).catch(() => null);
      recipientEmail = String(contact?.data?.recipient_email || "").trim().toLowerCase();
    }
    if (!recipientEmail) {
      console.error("Trial request aborted: club president contact email is missing", club);
      return;
    }
    const preferredPosition = trialPosition || myPlayer.position || "N/A";
    const consoleName = trialConsole || myPlayer.platform || "N/A";
    const experienceText = trialExperience.trim() || "No experience details shared.";
    const customNote = trialMsg.trim();
    const formattedRequest = [
      `Hello ${club.name} management team,`,
      "",
      `My name is ${gamerTag}, and I would like to request a trial with your club.`,
      "",
      "Player Profile",
      `- GamerTag: ${gamerTag}`,
      `- Preferred Position: ${preferredPosition}`,
      `- Console: ${consoleName}`,
      `- Overall: ${myPlayer.overall_rating || "N/A"}`,
      "",
      "Experience",
      experienceText,
      "",
      customNote ? `Additional Message\n${customNote}\n` : "",
      "I am motivated, active, and ready to prove myself. Thank you for your consideration.",
    ].filter(Boolean).join("\n");

    setSendingTrial(true);
    try {
      await stageClient.functions.invoke("sendInboxMessage", {
        recipient_email:   recipientEmail,
        sender_email:      currentUser.email,
        sender_gamertag:   gamerTag,
        sender_avatar_url: myPlayer.avatar_url || "",
        subject:           `⚽ Trial Request from ${gamerTag}`,
        body:              formattedRequest,
        message_type:      "trial_request",
        action_type:       "trial_response",
        related_entity_id: id,
        status:            "pending",
        is_read:           false,
        metadata: {
          player_id:        myPlayer.id,
          player_gamertag:  gamerTag,
          player_email:     currentUser.email,
          player_avatar_url: myPlayer.avatar_url || "",
          player_position:  preferredPosition,
          player_console:   consoleName,
          player_experience: experienceText,
          trial_note:       customNote,
          player_overall:   myPlayer.overall_rating || 70,
          club_id:          id,
          club_name:        club.name,
          club_logo_url:    club.logo_url || "",
        },
        send_notification: true,
      });
      setTrialRequestSent(true);
      setTrialDialogOpen(false);
      setTrialMsg("");
      setTrialPosition("");
      setTrialConsole("");
      setTrialExperience("");
      setShowTrialPreview(false);
    } catch (err) {
      console.error("Failed to send trial request:", err);
    } finally {
      setSendingTrial(false);
    }
  }

  useEffect(() => {
    const unsub = stageClient.entities.ChatMessage.subscribe((event) => {
      const payload = asObject(event.data);
      if (!payload || payload.match_id !== CLUB_CHAT_CHANNEL || !payload.id) return;
      if (event.type === "delete") {
        setClubChatMessages((prev) => asObjectArray(prev).filter((m) => m.id !== event.id));
        return;
      }
      setClubChatMessages((prev) => {
        const safePrev = asObjectArray(prev);
        const idx = safePrev.findIndex((m) => m.id === payload.id);
        if (idx >= 0) {
          const next = [...safePrev];
          next[idx] = { ...next[idx], ...payload };
          return next;
        }
        return [...safePrev, payload].sort(
          (a, b) => new Date(a.created_date || 0).getTime() - new Date(b.created_date || 0).getTime()
        );
      });
    }, { match_id: CLUB_CHAT_CHANNEL });
    return () => unsub();
  }, [CLUB_CHAT_CHANNEL]);

  async function sendClubChatMessage() {
    const content = clubChatInput.trim();
    if (!content || !currentUser?.email) return;
    setSendingClubChat(true);
    try {
      await stageClient.entities.ChatMessage.create({
        match_id: CLUB_CHAT_CHANNEL,
        sender_email: currentUser.email,
        content,
      });
      setClubChatInput("");
      const latest = await stageClient.entities.ChatMessage
        .filter({ match_id: CLUB_CHAT_CHANNEL }, "created_date", 300)
        .catch(() => []);
      setClubChatMessages(asObjectArray(latest));
    } finally {
      setSendingClubChat(false);
    }
  }

  async function assignRole(targetPlayer, role) {
    const target = asObject(targetPlayer);
    if (!target?.id) return;
    const currentHolders = asObjectArray(players).filter((player) => (
      (Array.isArray(player.club_roles) && player.club_roles.includes(role)) || player.role === role
    ) && player.id !== target.id);
    await Promise.all(currentHolders.map(p =>
      stageClient.entities.Player.update(p.id, {
        club_roles: Array.isArray(p.club_roles) ? p.club_roles.filter(r => r !== role) : [],
        role: p.role === role ? "member" : p.role,
      })
    ));
    const otherRoles = Array.isArray(target.club_roles)
      ? target.club_roles.filter(r => r !== "captain" && r !== "vice-captain")
      : [];
    const newRoles = [...new Set([...otherRoles, role])];
    const primaryRole = newRoles.includes("captain") ? "captain" : newRoles.includes("vice-captain") ? "vice-captain" : "member";
    await stageClient.entities.Player.update(target.id, { club_roles: newRoles, role: primaryRole });
    const updated = await stageClient.entities.Player.filter({ club_id: id }).catch(() => []);
    setPlayers(asObjectArray(updated));
  }

  function handleStaffRolesChanged(staffRows = []) {
    const safeStaffRows = asObjectArray(staffRows);
    setPlayers((prev) => mergeStaffRolesIntoPlayers(asObjectArray(prev), safeStaffRows));
    setOperationStaffRoles(safeStaffRows.filter((role) =>
      role.user_id === currentUser?.id || role.player_id === myPlayer?.id
    ));
  }

  function handlePlayerReleasedFromContract(playerId) {
    if (!playerId) return;
    setPlayers((prev) => asObjectArray(prev).filter((player) => player.id !== playerId));
  }

  async function declineJoinRequest(reqId) {
    const req = asObjectArray(joinRequests).find(r => r.id === reqId);
    if (!req) return;
    await stageClient.entities.JoinRequest.update(reqId, { status: "rejected" });
    setJoinRequests(prev => asObjectArray(prev).filter(r => r.id !== reqId));
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
      (stageClient.entities.CompetitionStanding?.filter({ club_id: id }, null, 100) ?? Promise.resolve([])).catch(() => []),
      (stageClient.entities.RegionalLeagueStanding?.filter({ club_id: id }, null, 100) ?? Promise.resolve([])).catch(() => []),
    ]);
    const comp = asObjectArray(compRows).map(r => ({
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
    const league = asObjectArray(leagueRows).map(r => ({
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
    navigate(clubsListPath);
  }

  async function saveLogo(localUrl, position, zoom) {
    const file = pendingFileRef.current;
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await stageClient.integrations.Core.UploadFile({ file });
      const logoZoom = zoom || 150;
      await stageClient.entities.Club.update(id, { logo_url: file_url, logo_position: position, logo_zoom: logoZoom });
      setClub(prev => ({ ...prev, logo_url: file_url, logo_position: position, logo_zoom: logoZoom }));
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
    return <div className="p-6 text-center"><p className="text-white/50">{t("commonPages.cdClubNotFound")}</p><Link to={clubsListPath}><Button variant="outline" className="mt-4">{t("commonPages.profBack")}</Button></Link></div>;
  }

  const safePlayers = asObjectArray(players);
  const safeMatches = asObjectArray(matches);
  const safeTournamentMatches = asObjectArray(tournamentMatches);
  const safeJoinRequests = asObjectArray(joinRequests);
  const safeClubChatMessages = asObjectArray(clubChatMessages);
  const safeHistoryRows = asObjectArray(historyRows);
  const confirmedMatches = safeMatches.filter(m => m.status === "completed");
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
  const tabLabels = {
    posts: t("commonPages.profTab_posts"),
    stats: t("commonPages.profTab_stats"),
    matches: t("commonPages.matches"),
    chat: t("commonPages.cdChat"),
    squad: t("nav.squad"),
    trophies: t("commonPages.profTab_trophies"),
    history: t("commonPages.cdHistory"),
    operations: t("commonPages.profOperations"),
    requests: `${t("commonPages.profJoinRequests")} (${safeJoinRequests.length})`,
    stadium: t("commonPages.cdStadium"),
    contracts: t("commonPages.contracts"),
    finance: t("commonPages.cdFinance"),
    shirts: t("commonPages.cdShirts"),
  };
  const tabGroups = [
    { label: t("nav.profile"), tabs: ["posts", "stats", "matches", "chat"] },
    { label: t("nav.squad"), tabs: ["squad", "trophies", "history"] },
    { label: t("commonPages.profOperations"), tabs: [
      ...(canOpenOperations ? ["operations"] : []),
      ...((isCaptain || isOwner) && safeJoinRequests.length > 0 && !limitedTournamentId ? ["requests"] : []),
    ] },
    {
      label: t("commonPages.cdClubOffice"),
      tabs: isOwner && !limitedTournamentId ? ["stadium", "contracts", "finance", "shirts"] : [],
    },
  ].filter(group => group.tabs.length > 0);
  function changeClubTab(tab) {
    setActiveTab(tab);
    if (tab === "history") loadHistory();
  }

  if (editClubOpen && club) {
    return (
      <GamerProfileShell>
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="bg-[#0d1225] border-white/10">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">{t("commonPages.cdDeleteClub")}</AlertDialogTitle>
              <AlertDialogDescription className="text-white/50">
                {t("commonPages.cdDeleteConfirm", { name: club?.name })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-white/20">{t("commonPages.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteClub} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {deleting ? t("commonPages.cdDeleting") : t("commonPages.cdDeleteClub")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <ClubProfileEdit
          club={club}
          onBack={() => setEditClubOpen(false)}
          onSaved={(updated) => {
            setClub((prev) => ({ ...prev, ...updated }));
          }}
          canDelete={isOwner}
          onDelete={() => setDeleteDialogOpen(true)}
        />
      </GamerProfileShell>
    );
  }

  return (
    <GamerProfileShell>
      {/* Dialogs */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-[#0d1225] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">{t("commonPages.cdDeleteClub")}</AlertDialogTitle>
            <AlertDialogDescription className="text-white/50">
              {t("commonPages.cdDeleteConfirm", { name: club?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/20">{t("commonPages.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteClub} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              {deleting ? t("commonPages.cdDeleting") : t("commonPages.cdDeleteClub")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <GamerClubProfileHero
        club={club}
        wins={wins}
        draws={draws}
        losses={losses}
        winRate={winRate}
        memberCount={safePlayers.length}
        onBannerClick={() => canEdit && setBannerDialogOpen(true)}
        onLogoClick={() => {
          if (club.logo_url) setLogoPreviewOpen(true);
        }}
        logoUploadHtmlFor={canEdit ? logoInputId : undefined}
        logoUploading={uploadingLogo}
        topLeftActions={(
          <>
            <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/75 backdrop-blur-md hover:bg-black/60 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" /> {t("commonPages.profBack")}
            </button>
            {isAdminTakeover ? (
              <div className="flex items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-3 py-2">
                <Shield className="w-3.5 h-3.5 text-warning shrink-0" />
                <span className="hidden sm:inline text-xs text-warning font-medium">{t("commonPages.cdAdminTakeover")}</span>
                <button type="button" onClick={() => { localStorage.removeItem('admin_takeover_club_id'); localStorage.setItem('stage_admin_effective_role_id', '0'); navigate('/admin'); }} className="text-xs text-warning/70 hover:text-warning flex items-center gap-1">
                  <LogOut className="w-3 h-3" /> {t("commonPages.cdExit")}
                </button>
              </div>
            ) : null}
          </>
        )}
        topActions={canEdit ? (
          <button
            type="button"
            onClick={() => setEditClubOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-white/10 bg-black/40 backdrop-blur-md hover:bg-black/60 text-white/80 text-xs font-bold uppercase tracking-wider"
          >
            <Edit2 className="w-4 h-4" /> {t("commonPages.profEditClub")}
          </button>
        ) : null}
        infoAside={<ClubPresidentChip club={club} president={president} />}
        sideActions={null}
      >
        <div className="mt-1">
          <ClubForm matches={safeMatches} clubId={id} />
        </div>
      </GamerClubProfileHero>

      <div className="max-w-6xl mx-auto px-4 mt-6 space-y-5 pb-10">
        {/* Trial request — visible to signed-in players who are not members */}
        {!isMember && !isOwner && myPlayer ? (
          <div>
            {trialRequestSent ? (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-warning/30 bg-warning/10 text-warning font-medium">
                <Clock className="w-3 h-3" /> {t("commonPages.cdTrialSent")}
              </span>
            ) : (
              <Dialog open={trialDialogOpen} onOpenChange={setTrialDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" size="sm" variant="outline" className="border-white/20 text-white/60 hover:text-white hover:border-white/40 text-xs gap-1.5 h-7 px-3">
                    <ClipboardList className="w-3 h-3" /> {t("commonPages.cdRequestTrial")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#0d1225] border-white/10 max-h-[85vh] overflow-y-auto">
                  <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary" /> {t("commonPages.cdRequestTrialAt", { name: club.name })}</DialogTitle></DialogHeader>
                  <div className="space-y-4 mt-2">
                    <p className="text-sm text-white/60 leading-relaxed">
                      {t("commonPages.cdTrialIntro", { name: club.name })}
                    </p>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-white/50">{t("commonPages.cdPlayerName")}</label>
                      <Input
                        value={myPlayer?.gamertag || ""}
                        readOnly
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-white/50">{t("commonPages.position")}</label>
                        <Select value={trialPosition || (myPlayer?.position || "")} onValueChange={setTrialPosition}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white">
                            <SelectValue placeholder={t("commonPages.cdSelectPosition")} />
                          </SelectTrigger>
                          <SelectContent>
                            {POSITION_OPTIONS.map((pos) => (
                              <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs uppercase tracking-widest text-white/50">{t("commonPages.cdWhichConsole")}</label>
                        <Select value={trialConsole || (myPlayer?.platform || "")} onValueChange={setTrialConsole}>
                          <SelectTrigger className="bg-white/5 border-white/10 text-white">
                            <SelectValue placeholder={t("commonPages.cdSelectConsole")} />
                          </SelectTrigger>
                          <SelectContent>
                            {CONSOLE_OPTIONS.map((consoleName) => (
                              <SelectItem key={consoleName} value={consoleName}>{consoleName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-white/50">{t("commonPages.cdExperience")}</label>
                      <Textarea
                        value={trialExperience}
                        onChange={e => setTrialExperience(e.target.value)}
                        className="bg-white/5 border-white/10 resize-none"
                        rows={3}
                        placeholder={t("commonPages.cdExperiencePlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-white/50">{t("commonPages.cdAdditionalMessage")}</label>
                    <Textarea
                      value={trialMsg}
                      onChange={e => setTrialMsg(e.target.value)}
                      className="bg-white/5 border-white/10 resize-none"
                      rows={3}
                        placeholder={t("commonPages.cdAdditionalPlaceholder")}
                    />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowTrialPreview(true)}
                      disabled={!trialExperience.trim()}
                      className="w-full border-white/20 text-white hover:border-primary/40 hover:text-primary"
                    >
                      {t("commonPages.cdShowRequestMessage")}
                    </Button>
                    {showTrialPreview && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                        <p className="text-xs uppercase tracking-widest text-primary/90 font-semibold">{t("commonPages.cdRequestPreview")}</p>
                        <pre className="whitespace-pre-wrap text-sm text-white/85 leading-relaxed font-sans">
{`Hello ${club.name} management team,

My name is ${myPlayer?.gamertag || "Unknown"}, and I would like to request a trial with your club.

Player Profile
- GamerTag: ${myPlayer?.gamertag || "Unknown"}
- Preferred Position: ${trialPosition || myPlayer?.position || "N/A"}
- Console: ${trialConsole || myPlayer?.platform || "N/A"}
- Overall: ${myPlayer?.overall_rating || "N/A"}

Experience
${trialExperience.trim() || "No experience details shared."}

${trialMsg.trim() ? `Additional Message\n${trialMsg.trim()}\n\n` : ""}I am motivated, active, and ready to prove myself. Thank you for your consideration.`}
                        </pre>
                      </div>
                    )}
                    <Button onClick={sendTrialRequest} disabled={sendingTrial || !trialExperience.trim()} className="w-full bg-primary text-primary-foreground gap-2">
                      {sendingTrial ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {sendingTrial ? t("commonPages.cdSending") : t("commonPages.cdSendTrialRequest")}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        ) : null}

        {canEdit ? (
          <input
            id={logoInputId}
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploadingLogo}
            onChange={uploadLogo}
          />
        ) : null}

        <GamerClubTabNav
          groups={tabGroups}
          activeTab={activeTab}
          tabLabels={tabLabels}
          onChange={changeClubTab}
          badgeForTab={(tab) => (tab === "chat" && clubChatUnreadCount > 0 ? (clubChatUnreadCount > 99 ? "99+" : String(clubChatUnreadCount)) : null)}
        />

        <Tabs value={activeTab} onValueChange={changeClubTab} className="w-full">
          {/* Posts */}
          <TabsContent value="posts" className="mt-0 px-4 pt-4">
            <ClubFeed club={club} currentUser={currentUser} myPlayer={myPlayer} isMember={isMember} />
          </TabsContent>

          {/* Stats */}
          <TabsContent value="stats" className="pt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <GamerStatTile label={t("commonPages.profWins")} value={wins} accent="green" />
                <GamerStatTile label={t("commonPages.cdDraws")} value={draws} accent="gold" />
                <GamerStatTile label={t("commonPages.profLosses")} value={losses} accent="rose" />
                <GamerStatTile label={t("commonPages.cdWinRate")} value={`${winRate}%`} accent="cyan" sub={`${totalGames} ${t("commonPages.matches").toLowerCase()}`} />
                <GamerStatTile label={t("commonPages.cdGoalsScored")} value={club.goals_scored || 0} accent="green" />
                <GamerStatTile label={t("commonPages.cdGoalsConceded")} value={club.goals_conceded || 0} accent="rose" />
              </div>
              <ClubPlayerStats players={safePlayers} clubId={id} />
            </div>
          </TabsContent>

          {/* Matches */}
          <TabsContent value="matches" className="px-4 pt-4">
            <div className="space-y-6">
              {safeTournamentMatches.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">{t("commonPages.homeUpcoming")}</p>
                  <div className="space-y-2">
                    {safeTournamentMatches.map(m => {
                      const isHome = m.home_club_id === id;
                      const oppName = isHome ? m.away_club_name : m.home_club_name;
                      const dateStr = m.scheduled_date ? new Date(m.scheduled_date).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "TBD";
                      const competition = deriveCompetitionLabel(m, tournamentMap, t);
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
                <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">{t("commonPages.cdPastMatches")}</p>
                {safeMatches.length === 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                    <Swords className="w-10 h-10 text-white/20 mx-auto mb-3" />
                    <p className="text-sm text-white/40">{t("commonPages.cdNoMatches")}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {safeMatches.map(m => {
                      const isHome = m.home_club_id === id;
                      const myScore = isHome ? m.home_score : m.away_score;
                      const oppScore = isHome ? m.away_score : m.home_score;
                      const oppName = isHome ? m.away_club_name : m.home_club_name;
                      const result = myScore > oppScore ? "W" : myScore < oppScore ? "L" : "D";
                      const competition = deriveCompetitionLabel(m, tournamentMap, t);
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

          <TabsContent value="chat" className="px-4 pt-4">
            <div className="rounded-xl border border-white/10 bg-white/[0.02]">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold text-white">{t("commonPages.cdClubChat")}</p>
                <button
                  type="button"
                  onClick={toggleClubChatMuted}
                  title={isClubChatMuted ? t("commonPages.cdUnmute") : t("commonPages.cdMute")}
                  aria-label={isClubChatMuted ? t("commonPages.cdUnmute") : t("commonPages.cdMute")}
                  className={cn(
                    "ml-auto p-1.5 rounded-md hover:bg-white/10 transition-colors",
                    isClubChatMuted ? "text-white/40" : "text-primary"
                  )}
                >
                  {isClubChatMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
                </button>
              </div>
              <div className="max-h-[45vh] overflow-y-auto p-3 space-y-2">
                {safeClubChatMessages.length === 0 ? (
                  <p className="text-sm text-white/45 text-center py-6">{t("commonPages.cdNoMessages")}</p>
                ) : (
                  safeClubChatMessages.map((msg) => {
                    const mine = msg.sender_email === currentUser?.email;
                    return (
                      <div key={msg.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                        <div
                          className={cn(
                            "max-w-[85%] rounded-lg px-3 py-2 border",
                            mine ? "bg-primary/15 border-primary/35" : "bg-white/[0.03] border-white/10"
                          )}
                        >
                          <p className="text-[11px] text-white/50 mb-1">{msg.sender_email}</p>
                          <p className="text-sm text-white whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="p-3 border-t border-white/10 flex items-center gap-2">
                <Input
                  value={clubChatInput}
                  onChange={(e) => setClubChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendClubChatMessage();
                    }
                  }}
                  placeholder={t("commonPages.cdChatPlaceholder")}
                  className="bg-white/5 border-white/10 text-white"
                />
                <Button
                  type="button"
                  onClick={sendClubChatMessage}
                  disabled={sendingClubChat || !clubChatInput.trim()}
                  className="gap-1.5"
                >
                  {sendingClubChat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {t("commonPages.cdSend")}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* Squad */}
          <TabsContent value="squad" className="px-4 pt-4">
            {safePlayers.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">{t("commonPages.cdNoPlayers")}</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {safePlayers.map(p => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    currentUser={currentUser}
                    myPlayer={myPlayer}
                    isPresident={isPresident}
                    onAssignRole={assignRole}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Trophies & Achievements */}
          <TabsContent value="trophies" className="px-4 pt-4 pb-6">
            <div className="space-y-6">
              <ClubAchievementsTab clubId={id} />
              <ClubTrophyCabinetDisplay clubId={id} currentUserEmail={currentUser?.email} club={club} canEditOverride={canEdit} />
            </div>
          </TabsContent>

          {/* Club Operations — private staff workspace */}
          {canOpenOperations && (
            <TabsContent value="operations" className="px-4 pt-4 pb-6">
              <ClubOperations
                club={club}
                players={safePlayers}
                currentUser={currentUser}
                myPlayer={myPlayer}
                upcomingFixtures={safeTournamentMatches}
                defaultFormation={club.formation}
                onStaffRolesChanged={handleStaffRolesChanged}
              />
            </TabsContent>
          )}

          {/* Season History */}
          <TabsContent value="history" className="px-4 pt-4 pb-6">
            {!historyLoaded ? (
              <p className="text-xs text-white/40 py-8 text-center">{t("commonPages.cdLoadingHistory")}</p>
            ) : safeHistoryRows.length === 0 ? (
              <p className="text-xs text-white/40 py-8 text-center">{t("commonPages.cdNoHistory")}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/40 uppercase tracking-widest border-b border-white/10">
                      <th className="text-left py-2 pr-3 font-semibold">{t("commonPages.cdCompetition")}</th>
                      <th className="text-left py-2 pr-3 font-semibold">{t("commonPages.cdSeason")}</th>
                      <th className="text-center py-2 px-2 font-semibold">{t("commonPages.cdPos")}</th>
                      <th className="text-center py-2 px-2 font-semibold">W</th>
                      <th className="text-center py-2 px-2 font-semibold">D</th>
                      <th className="text-center py-2 px-2 font-semibold">L</th>
                      <th className="text-center py-2 px-2 font-semibold">Pts</th>
                      <th className="text-center py-2 pl-2 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {safeHistoryRows.map((r, i) => (
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

          {/* Contracts — president only */}
          {isOwner && (
            <TabsContent value="contracts" className="px-4 pt-4">
              <ContractsTab
                club={club}
                players={safePlayers}
                myPlayer={myPlayer}
                canManage={true}
                onPlayerReleased={handlePlayerReleasedFromContract}
              />
            </TabsContent>
          )}

          {/* Stadium — president only */}
          {isOwner && (
            <TabsContent value="stadium" className="px-4 pt-4">
              <StadiumUpgrade
                club={club}
                canEdit={isOwner}
                onUpdate={(updates) => setClub(prev => ({ ...prev, ...updates }))}
              />
            </TabsContent>
          )}

          {/* Finance + Shirts — president only */}
          {isOwner && (
            <>
              <TabsContent value="finance" className="px-4 pt-4">
                <ClubFinanceTab club={club} />
              </TabsContent>
              <TabsContent value="shirts" className="px-4 pt-4 pb-6">
                <ShirtSalesPanel club={club} players={safePlayers} />
              </TabsContent>
            </>
          )}

          {/* Join Requests */}
          {(isCaptain || isOwner) && (
            <TabsContent value="requests" className="px-4 pt-4">
              <div className="space-y-3">
                {safeJoinRequests.map(req => (
                  <div key={req.id} className="bg-white/5 border border-white/10 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-white">{req.player_gamertag}</p>
                      <p className="text-xs text-white/40">{req.player_email}</p>
                      {req.message && <p className="text-sm text-white/40 mt-2 italic">"{req.message}"</p>}
                      <p className="text-xs text-primary/80 mt-2">{t("commonPages.cdApprovalsNote")}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => setActiveTab("operations")} className="bg-success/20 text-success hover:bg-success/30 border-0">
                        <Check className="w-4 h-4 mr-1" /> {t("commonPages.cdOpenOperations")}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => declineJoinRequest(req.id)} className="border-destructive/30 text-destructive hover:bg-destructive/10">
                        <X className="w-4 h-4 mr-1" /> {t("commonPages.profDecline")}
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

      <ImagePositionEditor
        open={!!pendingLogo}
        onClose={() => { setPendingLogo(null); pendingFileRef.current = null; }}
        imageUrl={pendingLogo}
        aspect="avatar"
        initialPosition={club?.logo_position}
        initialZoom={club?.logo_zoom}
        previewClub={club}
        onConfirm={(url, position, zoom) => saveLogo(url, position, zoom)}
      />


      <Dialog open={logoPreviewOpen} onOpenChange={setLogoPreviewOpen}>
        <DialogContent className="bg-[#0d1225] border-white/10 max-w-sm">
          <DialogHeader><DialogTitle>{t("commonPages.cdLogoTitle", { name: club.name })}</DialogTitle></DialogHeader>
          <div className="flex items-center justify-center p-4">
            <GamerClubPhotoFrame
              club={club}
              imageUrl={club.logo_url}
              imagePosition={club.logo_position}
              imageZoom={club.logo_zoom}
              winRate={club.win_rate || 50}
              className="w-56 sm:w-64"
            />
          </div>
        </DialogContent>
      </Dialog>

    </GamerProfileShell>
  );
}

function deriveCompetitionLabel(match, tournamentMap = {}, tr = (k) => k) {
  const safeMatch = asObject(match);
  if (!safeMatch?.tournament_id || safeMatch.tournament_id === "ranked") return tr("commonPages.cdRankedMatch");
  const tour = asObject(tournamentMap[safeMatch.tournament_id]);
  if (!tour) return tr("commonPages.cdTournament");
  if (tour.type === "knockout") return `${tour.name} · ${tr("commonPages.cdKnockout")}`;
  if (tour.type === "league") return `${tour.name} · ${tr("commonPages.homeLeagues")}`;
  if (tour.type === "group_stage") return `${tour.name} · ${tr("commonPages.cdGroupStage")}`;
  if (tour.type === "swiss" || tour.type === "swiss_ucl") return `${tour.name} · ${tr("commonPages.cdSwiss")}`;
  if (tour.type === "double_elimination") return `${tour.name} · ${tr("commonPages.cdDoubleElim")}`;
  return tour.name || tr("commonPages.cdTournament");
}

function PlayerCard({ player: rawPlayer, currentUser, myPlayer: _myPlayer, isPresident, onAssignRole }) {
  const { t } = useTranslation();
  const player = asObject(rawPlayer);
  if (!player?.id) return null;
  const playerRoles = Array.isArray(player.club_roles) ? player.club_roles.map(normalizeClubRole) : [];
  const primaryRole = getPrimaryClubRole(player);
  const isPresidentRole = primaryRole === "president";
  const isCaptainRole = primaryRole === "captain";
  const isViceCaptainRole = primaryRole === "vice_captain";
  const isStaffRole = ["recruiter", "finance_manager", "match_coordinator"].includes(primaryRole);
  const roleLabel = clubRoleLabel(t, primaryRole);

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
          <div className="mt-1 flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em]",
                isPresidentRole
                  ? "border border-blue-300/40 bg-blue-400/10 text-blue-200"
                  : isCaptainRole
                    ? "border border-amber-300/40 bg-amber-400/10 text-amber-200"
                    : isViceCaptainRole
                      ? "border border-primary/30 bg-primary/10 text-primary"
                      : isStaffRole
                        ? "border border-cyan-300/30 bg-cyan-400/10 text-cyan-200"
                        : "text-white/40"
              )}
            >
              {isPresidentRole && <Shield className="h-3 w-3" />}
              {roleLabel}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-lg text-primary">{player.overall_rating}</p>
          <p className="text-[10px] text-white/40 uppercase">OVR</p>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 text-xs text-white/40">
        <span>{player.goals || 0} {t("commonPages.goals").toLowerCase()}</span>
        <span>{player.assists || 0} {t("commonPages.assists").toLowerCase()}</span>
        <span>{player.matches_played || 0} {t("commonPages.matches").toLowerCase()}</span>
      </div>
      {isPresident && currentUser?.email !== player.email && !playerRoles.includes("president") && (
        <div className="mt-3 flex gap-2" onClick={e => e.preventDefault()}>
          <button
            onClick={() => onAssignRole(player, "captain")}
            disabled={playerRoles.includes("captain") || normalizeClubRole(player.role) === "captain"}
            className={cn("flex-1 text-xs py-1.5 rounded-lg border transition-all",
              playerRoles.includes("captain") || normalizeClubRole(player.role) === "captain"
                ? "border-warning/30 bg-warning/10 text-warning cursor-default"
                : "border-warning/30 text-warning hover:bg-warning/10"
            )}
          >
            {playerRoles.includes("captain") || normalizeClubRole(player.role) === "captain" ? t("commonPages.cdCaptain") : t("commonPages.cdMakeCaptain")}
          </button>
          <button
            onClick={() => onAssignRole(player, "vice-captain")}
            disabled={playerRoles.includes("vice_captain") || normalizeClubRole(player.role) === "vice_captain"}
            className={cn("flex-1 text-xs py-1.5 rounded-lg border transition-all",
              playerRoles.includes("vice_captain") || normalizeClubRole(player.role) === "vice_captain"
                ? "border-primary/30 bg-primary/10 text-primary cursor-default"
                : "border-primary/30 text-primary hover:bg-primary/10"
            )}
          >
            {playerRoles.includes("vice_captain") || normalizeClubRole(player.role) === "vice_captain" ? t("commonPages.cdViceCaptain") : t("commonPages.cdMakeViceCaptain")}
          </button>
        </div>
      )}
    </Link>
  );
}
