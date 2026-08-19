import { useState, useEffect, useRef, useId } from "react";
import { useParams, Link } from "react-router-dom";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import {
  Shield, Users, ArrowLeft,
  Check, X, Send, Loader2, LogOut,
  Trash2, Edit2, MessageCircle, ClipboardList,
  Bell, BellOff,
  MoreHorizontal, Eye, BarChart3, FileText, UserCheck,
  UserMinus, BadgeX, Target, Footprints, Activity, History, Lock,
  Image as ImageIcon, Upload, Sparkles, RotateCcw, Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import BannerSelector from "../components/BannerSelector";
import ImagePositionEditor from "../components/ImagePositionEditor";
import ClubFeed from "../components/ClubFeed";
import ClubForm from "../components/ClubForm";
import ContractsTab from "../components/contracts/ContractsTab";
import ClubFinanceTab from "../components/club/ClubFinanceTab";
import ShirtSalesPanel from "../components/ShirtSalesPanel";
import StadiumUpgrade from "../components/club/StadiumUpgrade";
import { cn } from "@/lib/utils";
import { getContractTargetPlayerId, getContractType, normalizePlayerContracts } from "@/lib/playerContractFields";
import { mergeActiveContractPlayersIntoSquad } from "@/lib/clubSquadContracts";
import { applyLoanAnnotations, canExercisePurchaseOption, canProposeEarlyEnd, isEarlyEndWaitingOnClub, isLoanRecallable, isPurchaseAwaitingPlayer, splitSquadByLoan } from "@/lib/playerLoanDisplay";
import { isClubPresidentForUser, isAdminUser as isClubAccessAdmin } from "@/lib/clubPresidentAccess";
import { asObject, asObjectArray } from "@/lib/safeData";
import { buildClubPlayerStatMap, formatClubRating, getClubPlayerStats, getClubStatValue } from "@/lib/clubPlayerStats";
import { useNavigate } from "react-router-dom";
import { ClubTrophyCabinetDisplay } from "@/components/profile/PlayerTrophyCabinet";
import ClubAchievementsTab from "@/components/rewards/ClubAchievementsTab";
import { useChatChannel } from "@/lib/ChatNotificationsContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/AuthContext";
import { swalConfirm, swalError, swalPrompt } from "@/lib/swal";
import GamerClubProfileHero from "@/components/profile/gamer/GamerClubProfileHero";
import { GamerClubPhotoFrame } from "@/components/profile/gamer/GamerClubCard";
import GamerClubTabNav from "@/components/profile/gamer/GamerClubTabNav";
import { GamerHeroAction, GamerProfileShell } from "@/components/profile/gamer/GamerProfileUI";
import ClubProfileEdit from "@/components/club/ClubProfileEdit";
import { getPrimaryClubRole, mergeStaffRolesIntoPlayers, normalizeClubRole } from "@/lib/clubStaffRoles";
import { buildClubTabGroups, clubTabLabels } from "@/lib/clubOfficeTabs";
import { hasStagePlus } from "@/lib/subscriptionUtils";
import { getPlayerNationality, normalizeCountryCode } from "@/lib/countryDisplay";

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

const CONTRACT_EXPIRING_SOON_MS = 14 * 24 * 60 * 60 * 1000;

function clubRoleLabel(t, role) {
  const normalized = normalizeClubRole(role) || "member";
  const key = CLUB_ROLE_LABEL_KEYS[normalized] || CLUB_ROLE_LABEL_KEYS.member;
  const translated = t(key);
  return translated === key ? (CLUB_ROLE_FALLBACK_LABELS[normalized] || normalized.replace(/_/g, " ")) : translated;
}

function getNextFixture(fixtures = []) {
  const now = Date.now();
  const scheduled = asObjectArray(fixtures)
    .filter((fixture) => fixture?.id)
    .sort((a, b) => new Date(a.scheduled_date || a.match_date || 0) - new Date(b.scheduled_date || b.match_date || 0));
  return scheduled.find((fixture) => {
    const time = new Date(fixture.scheduled_date || fixture.match_date || 0).getTime();
    return Number.isFinite(time) && time >= now;
  }) || scheduled[0] || null;
}

function getPlayerContracts(contracts = [], playerId) {
  return normalizePlayerContracts(contracts).filter((contract) =>
    String(getContractTargetPlayerId(contract) || "") === String(playerId || "")
  );
}

function normalizePresidentPlayer(player) {
  if (!player?.id) return null;
  return {
    ...player,
    player_id: player.id,
    display_name: player.gamertag || player.display_name,
    profile_path: `/players/${player.id}`,
  };
}

async function resolvePresidentRecord(club) {
  const c = asObject(club);
  if (!c?.id) return null;

  if (c.president_player_id) {
    const presidentPlayer = asObject(await stageClient.entities.Player.get(c.president_player_id).catch(() => null));
    const normalizedPlayer = normalizePresidentPlayer(presidentPlayer);
    if (normalizedPlayer) return normalizedPlayer;
  }

  let presidentRecord = null;
  if (c.president_id) {
    presidentRecord = asObject(await stageClient.entities.President.get(c.president_id).catch(() => null));
  }
  if (!presidentRecord?.id) {
    const byClub = await stageClient.entities.President.filter({ club_id: c.id }, null, 1).catch(() => []);
    presidentRecord = asObject(asObjectArray(byClub)[0]);
  }
  if (!presidentRecord?.id) return null;

  if (!presidentRecord.avatar_url && (presidentRecord.user_id || presidentRecord.email)) {
    const [playerMatch] = asObjectArray(await stageClient.entities.Player
      .filter(
        presidentRecord.user_id
          ? { user_id: presidentRecord.user_id }
          : { email: presidentRecord.email },
        null,
        1,
      )
      .catch(() => []));
    if (playerMatch?.avatar_url) {
      return {
        ...presidentRecord,
        avatar_url: playerMatch.avatar_url,
        avatar_zoom: playerMatch.avatar_zoom,
        avatar_position: playerMatch.avatar_position,
        player_id: playerMatch.id,
        profile_path: `/players/${playerMatch.id}`,
      };
    }
  }

  return presidentRecord;
}

function ClubPresidentChip({ club, president }) {
  const { t } = useTranslation();
  const presidentId = president?.player_id || president?.id || club?.president_player_id || club?.president_id;
  if (!presidentId) return null;
  const name = t("commonPages.cdPresident");
  const profilePath = president?.profile_path || (club?.president_player_id ? `/players/${club.president_player_id}` : `/presidents/${presidentId}`);
  return (
    <Link
      to={profilePath}
      className="inline-flex max-w-[240px] items-center gap-3 border border-cyan-200/25 bg-black/24 px-4 py-2 text-cyan-50/95 backdrop-blur-md transition-all hover:border-cyan-200/55 hover:bg-cyan-300/10 hover:shadow-[0_0_24px_-10px_rgba(0,229,255,0.9)]"
      style={{ clipPath: "polygon(10% 0, 100% 0, 90% 100%, 0 100%)" }}
      title={t("commonPages.presProfileMenu")}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden border border-cyan-200/25 bg-[#101827]"
        style={{ clipPath: "polygon(16% 0, 100% 0, 84% 100%, 0 100%)", ...(president?.avatar_url ? {
          backgroundImage: `url(${president.avatar_url})`,
          backgroundSize: `${president.avatar_zoom || 150}%`,
          backgroundPosition: president.avatar_position || "50% 50%",
          backgroundRepeat: "no-repeat",
        } : {}) }}
        aria-hidden
      >
        {!president?.avatar_url ? <Shield className="w-3.5 h-3.5 text-amber-300/80" /> : null}
      </span>
      <span className="truncate font-heading text-sm font-black uppercase tracking-[0.08em] text-white">
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
  const [fixtureAvailabilityRows, setFixtureAvailabilityRows] = useState([]);
  const [fixtureMatchStatRows, setFixtureMatchStatRows] = useState([]);
  const [clubContracts, setClubContracts] = useState([]);
  const [clubPlayerStatRows, setClubPlayerStatRows] = useState([]);
  const [, setTournamentMap] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [myPlayer, setMyPlayer] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [_myClubData, setMyClubData] = useState(null);
  const [bannerDialogOpen, setBannerDialogOpen] = useState(false);
  const [logoPreviewOpen, setLogoPreviewOpen] = useState(false);
  const [pendingLogo, setPendingLogo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
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
    if (activeTab !== "chat") return;
    const onSquad = (!!myPlayer?.club_id && myPlayer.club_id === id)
      || asObjectArray(players).some((player) => player.id && player.id === myPlayer?.id);
    if (!onSquad) setActiveTab("posts");
  }, [activeTab, myPlayer, players, id]);

  useEffect(() => {
    async function load() {
      try {
        const user = asObject(await stageClient.auth.me().catch(() => null));
      setCurrentUser(user);

        const { player: resolvedPlayer = null, presidentClub = null } = await resolveMyPlayerAndClub().catch(() => ({}));
        const myPlResolved = asObject(resolvedPlayer);
        const [clubRecordRaw, initialPlayerRows, staffRoleRows, contractRows, availabilityRows, playerStatRows] = await Promise.all([
          stageClient.entities.Club.get(id).catch(() => null),
          stageClient.entities.Player.filter({ club_id: id }).catch(() => []),
          stageClient.entities.ClubStaffRole.filter({ club_id: id }, "-created_date", 200).catch(() => []),
          stageClient.entities.PlayerContract.filter({ team_id: id }, "-created_date", 200).catch(() => []),
          stageClient.entities.ClubFixtureAvailability.filter({ club_id: id }, "-updated_date", 300).catch(() => []),
          stageClient.entities.MatchPlayerStat.filter({ club_id: id }, "-created_date", 1000).catch(() => []),
        ]);

        const c = asObject(clubRecordRaw);
        const presidentRecord = await resolvePresidentRecord(c);
        setPresident(presidentRecord);
        const staffRows = asObjectArray(staffRoleRows);
      const myPl = myPlResolved ? [myPlResolved] : [];
        let playerData = asObjectArray(initialPlayerRows).filter((player) => player.id);
        const playerIds = new Set(playerData.map((player) => player.id).filter(Boolean));

        const safeContractRows = normalizePlayerContracts(contractRows);
        const safeActiveContracts = safeContractRows.filter((contract) => contract.status === "active");
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

        const [incomingLoans, outgoingLoans] = await Promise.all([
          stageClient.entities.PlayerLoan.filter({ loan_club_id: id, status: "ACTIVE" }).catch(() => []),
          stageClient.entities.PlayerLoan.filter({ parent_club_id: id, status: "ACTIVE" }).catch(() => []),
        ]);
        const loans = [...asObjectArray(incomingLoans), ...asObjectArray(outgoingLoans)];
        const loanPlayerIds = [...new Set(loans.map((loan) => loan.player_id).filter(Boolean))];
        const presentIds = new Set(playerData.map((player) => player.id));
        const missingLoanIds = loanPlayerIds.filter((playerId) => !presentIds.has(playerId));
        if (missingLoanIds.length) {
          const extraPlayers = await Promise.all(
            missingLoanIds.map((playerId) => stageClient.entities.Player.get(playerId).catch(() => null))
          );
          playerData = [...playerData, ...asObjectArray(extraPlayers)];
        }
        playerData = applyLoanAnnotations(playerData, loans, id);

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
        setClubContracts(safeContractRows);
        setFixtureAvailabilityRows(asObjectArray(availabilityRows));
        setClubPlayerStatRows(asObjectArray(playerStatRows));

      const allMatches = [...matchesHome, ...matchesAway].sort(
        (a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0)
      );
      const completedMatchIds = [...new Set(allMatches
        .filter((match) => match?.id && match.status === "completed")
        .map((match) => match.id)
      )];
      const fixtureStatResults = completedMatchIds.length
        ? await Promise.all(
            completedMatchIds.map((matchId) =>
              stageClient.entities.MatchPlayerStat.filter({ match_id: matchId }, "-created_date", 50).catch(() => [])
            )
          )
        : [];
      setFixtureMatchStatRows(fixtureStatResults.flatMap((rows) => asObjectArray(rows)));
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
    const onSquad = isMember || asObjectArray(players).some((player) => player.id && player.id === myPlayer?.id);
    if (!content || !currentUser?.email || !onSquad) return;
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

  function handlePlayerCardBackgroundChanged(updatedPlayer) {
    const updated = asObject(updatedPlayer);
    if (!updated?.id) return;
    setPlayers((prev) => asObjectArray(prev).map((player) => (
      player.id === updated.id ? { ...player, ...updated } : player
    )));
    if (myPlayer?.id === updated.id) setMyPlayer((prev) => ({ ...prev, ...updated }));
  }

  function handleClubStatsTileBackgroundChanged(updatedClub) {
    const updated = asObject(updatedClub);
    if (!updated?.id) return;
    setClub((prev) => ({ ...prev, ...updated }));
  }

  async function removePlayerRole(targetPlayer) {
    const target = asObject(targetPlayer);
    if (!target?.id) return;
    const confirmMessage = t("commonPages.cdRemoveRoleConfirm");
    if (!(await swalConfirm(confirmMessage === "commonPages.cdRemoveRoleConfirm" ? "Remove this player's club role?" : confirmMessage))) return;
    await stageClient.entities.Player.update(target.id, { club_roles: [], role: "member" });
    setPlayers((prev) => asObjectArray(prev).map((player) => (
      player.id === target.id ? { ...player, club_roles: [], role: "member" } : player
    )));
  }

  async function releaseSquadPlayer(targetPlayer, contract = null) {
    const target = asObject(targetPlayer);
    if (!target?.id) return;
    const confirmMessage = t("commonPages.cdReleasePlayerConfirm");
    if (!(await swalConfirm(confirmMessage === "commonPages.cdReleasePlayerConfirm" ? "Release this player from the club?" : confirmMessage))) return;
    if (contract?.id) {
      await stageClient.functions.invoke("contractManagement", { action: "terminate", contract_id: contract.id });
    } else {
      await stageClient.entities.Player.update(target.id, {
        club_id: null,
        club_roles: [],
        role: "member",
        dressing_room_seat: null,
        is_ready: false,
      });
    }
    setPlayers((prev) => asObjectArray(prev).filter((player) => player.id !== target.id));
    if (contract?.id) {
      setClubContracts((prev) => normalizePlayerContracts(prev).map((row) => (
        row.id === contract.id ? { ...row, status: "terminated" } : row
      )));
    }
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

  async function handleDeleteClub() {
    setDeleting(true);
    await stageClient.functions.invoke("deleteClub", { club_id: id });
    setDeleting(false);
    setDeleteDialogOpen(false);
    navigate(clubsListPath);
  }

  async function handleRecallLoan(player) {
    const loanId = player?.loan_id;
    if (!loanId) return;
    const confirmed = await swalConfirm(
      t("commonPages.recallPlayerConfirm") || "Recall this player from the loan? Playing rights return immediately. The loan fee is not refunded.",
      {
        title: t("commonPages.recallPlayer") || "Recall player",
        confirmText: t("commonPages.recallPlayer") || "Recall",
        cancelText: t("commonPages.cancel") || "Cancel",
      }
    );
    if (!confirmed) return;
    try {
      await stageClient.http.post(`/player-loans/${encodeURIComponent(loanId)}/recall`, {});
      setPlayers((prev) => asObjectArray(prev).map((row) => {
        if (row.id !== player.id) return row;
        const next = { ...row, selectable: true };
        delete next.loan_id;
        delete next.loan_status;
        delete next.on_loan_club_id;
        delete next.on_loan_club_name;
        delete next.loan_end_date;
        delete next.recall_allowed;
        delete next.recall_after_date;
        delete next.loan_recallable;
        delete next.early_end_proposed_by_club_id;
        return next;
      }));
    } catch (err) {
      await swalError(err?.data?.code || err?.message || (t("commonPages.loanActionFailed") || "Could not recall this player."));
    }
  }

  // Exercising an option to buy is its own loan endpoint, not a contract offer:
  // the player still has to accept the permanent terms before ownership moves.
  async function handleExerciseOption(player) {
    const loanId = player?.loan_id;
    if (!loanId) return;
    const salaryText = await swalPrompt(
      t("commonPages.exerciseOptionSalaryPrompt") || "Weekly salary (STC) for the permanent contract",
      {
        title: t("commonPages.exerciseOption") || "Exercise option to buy",
        confirmText: t("commonPages.continue") || "Continue",
        cancelText: t("commonPages.cancel") || "Cancel",
      }
    );
    if (salaryText === null) return;
    const weeklySalary = Number(salaryText);
    if (!Number.isFinite(weeklySalary) || weeklySalary < 0) {
      await swalError(t("commonPages.invalidAmount") || "Enter a valid amount.");
      return;
    }
    const daysText = await swalPrompt(
      t("commonPages.exerciseOptionDaysPrompt") || "Contract length in days (leave empty to keep the current end date)",
      {
        title: t("commonPages.exerciseOption") || "Exercise option to buy",
        confirmText: t("commonPages.exerciseOption") || "Exercise option",
        cancelText: t("commonPages.cancel") || "Cancel",
      }
    );
    if (daysText === null) return;
    const days = daysText === "" ? 0 : Number(daysText);
    if (!Number.isFinite(days) || days < 0) {
      await swalError(t("commonPages.invalidAmount") || "Enter a valid number of days.");
      return;
    }
    try {
      await stageClient.http.post(`/player-loans/${encodeURIComponent(loanId)}/exercise-option`, {
        weekly_salary_stc: weeklySalary,
        max_days: days,
      });
      setPlayers((prev) => asObjectArray(prev).map((row) => (
        row.id === player.id
          ? { ...row, purchase_offer_status: "AWAITING_PLAYER", can_exercise_purchase_option: false }
          : row
      )));
    } catch (err) {
      await swalError(err?.data?.code || err?.message || (t("commonPages.loanActionFailed") || "Could not exercise this option."));
    }
  }

  function clearLoanFields(row) {
    const next = { ...row, selectable: true };
    delete next.loan_id;
    delete next.loan_badge;
    delete next.loan_status;
    delete next.on_loan_club_id;
    delete next.on_loan_club_name;
    delete next.loan_from_club_id;
    delete next.loan_from_club_name;
    delete next.loan_end_date;
    delete next.recall_allowed;
    delete next.recall_after_date;
    delete next.loan_recallable;
    delete next.early_end_proposed_by_club_id;
    return next;
  }

  async function handleProposeEarlyEnd(player) {
    const loanId = player?.loan_id;
    if (!loanId) return;
    const confirmed = await swalConfirm(
      t("commonPages.requestReturnConfirm") || "Request an early return of this player? The other club must accept. The loan fee is not refunded.",
      {
        title: t("commonPages.requestReturn") || "Request return",
        confirmText: t("commonPages.requestReturn") || "Request return",
        cancelText: t("commonPages.cancel") || "Cancel",
      }
    );
    if (!confirmed) return;
    try {
      await stageClient.http.post(`/player-loans/${encodeURIComponent(loanId)}/early-end`, {
        actor_club_id: id,
      });
      setPlayers((prev) => asObjectArray(prev).map((row) => (
        row.id === player.id
          ? { ...row, early_end_proposed_by_club_id: id }
          : row
      )));
    } catch (err) {
      await swalError(err?.data?.code || err?.message || (t("commonPages.loanActionFailed") || "Could not request this return."));
    }
  }

  async function handleAcceptEarlyEnd(player) {
    const loanId = player?.loan_id;
    if (!loanId) return;
    const confirmed = await swalConfirm(
      t("commonPages.acceptReturnConfirm") || "Accept the early return? Playing rights go back to the parent club immediately. The loan fee is not refunded.",
      {
        title: t("commonPages.acceptReturn") || "Accept return",
        confirmText: t("commonPages.acceptReturn") || "Accept return",
        cancelText: t("commonPages.cancel") || "Cancel",
      }
    );
    if (!confirmed) return;
    try {
      await stageClient.http.post(`/player-loans/${encodeURIComponent(loanId)}/early-end-accept`, {
        actor_club_id: id,
      });
      setPlayers((prev) => asObjectArray(prev).flatMap((row) => {
        if (row.id !== player.id) return [row];
        if (player.loan_status === "loaned_in" && String(row.club_id) !== String(id)) return [];
        return [clearLoanFields(row)];
      }));
    } catch (err) {
      await swalError(err?.data?.code || err?.message || (t("commonPages.loanActionFailed") || "Could not accept this return."));
    }
  }

  async function handleRejectEarlyEnd(player) {
    const loanId = player?.loan_id;
    if (!loanId) return;
    try {
      await stageClient.http.post(`/player-loans/${encodeURIComponent(loanId)}/early-end-reject`, {
        actor_club_id: id,
      });
      setPlayers((prev) => asObjectArray(prev).map((row) => (
        row.id === player.id
          ? { ...row, early_end_proposed_by_club_id: null }
          : row
      )));
    } catch (err) {
      await swalError(err?.data?.code || err?.message || (t("commonPages.loanActionFailed") || "Could not reject this return."));
    }
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
  const { selectable: selectablePlayers, onLoan: onLoanPlayers } = splitSquadByLoan(safePlayers);
  const safeMatches = asObjectArray(matches);
  const safeTournamentMatches = asObjectArray(tournamentMatches);
  const safeJoinRequests = asObjectArray(joinRequests);
  const safeClubChatMessages = asObjectArray(clubChatMessages);
  const safeFixtureAvailabilityRows = asObjectArray(fixtureAvailabilityRows);
  const safeFixtureMatchStatRows = asObjectArray(fixtureMatchStatRows);
  const safeClubContracts = normalizePlayerContracts(clubContracts);
  const safeClubPlayerStatRows = asObjectArray(clubPlayerStatRows);
  const clubPlayerStatsById = buildClubPlayerStatMap(safePlayers, safeClubPlayerStatRows, id);
  const nextFixture = getNextFixture(safeTournamentMatches);
  const nextFixtureAvailabilityRows = nextFixture
    ? safeFixtureAvailabilityRows.filter((row) => String(row.fixture_id) === String(nextFixture.id))
    : [];
  const availabilityByPlayerId = new Map(nextFixtureAvailabilityRows.map((row) => [String(row.player_id), row]));
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
  const tabLabels = {
    ...clubTabLabels(t),
    requests: `${t("commonPages.profJoinRequests")} (${safeJoinRequests.length})`,
  };
  const canSeeClubChat = isMember || safePlayers.some((player) => player.id && player.id === myPlayer?.id);
  const canOpenClubOffice = canOpenOperations && (isOwner || isCaptain || isPresident || isViceCaptain || isAdminTakeover);
  const tabGroups = buildClubTabGroups({
    t,
    canOpenClubOffice,
    showChat: canSeeClubChat,
  });
  function changeClubTab(tab) {
    if (tab === "chat" && !canSeeClubChat) return;
    if (tab === "club-office" && !canOpenClubOffice) return;
    setActiveTab(tab);
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
            <GamerHeroAction onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 text-cyan-200/90" /> {t("commonPages.profBack")}
            </GamerHeroAction>
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
          <GamerHeroAction onClick={() => setEditClubOpen(true)}>
            <Edit2 className="h-4 w-4 text-cyan-200/90" />
            {t("commonPages.profEditClub")}
          </GamerHeroAction>
        ) : null}
        infoAside={<ClubPresidentChip club={club} president={president} />}
        sideActions={null}
      >
          <div className="mt-1">
          <ClubForm matches={safeMatches} clubId={id} />
          </div>
      </GamerClubProfileHero>

      <div className="max-w-6xl mx-auto px-4 mt-6 space-y-5 pb-10">
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

          {canSeeClubChat ? <TabsContent value="chat" className="px-4 pt-4">
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
          </TabsContent> : null}

          {/* Squad */}
          <TabsContent value="squad" className="px-4 pt-4">
            {safePlayers.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center">
                <Users className="w-10 h-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">{t("commonPages.cdNoPlayers")}</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {selectablePlayers.map(p => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    currentUser={currentUser}
                    myPlayer={myPlayer}
                    isPresident={isPresident}
                      isOwner={isOwner}
                      isClubMember={isMember}
                      isCaptain={isCaptain || isViceCaptain}
                      isStaff={operationStaffRoles.length > 0}
                      nextFixture={nextFixture}
                      availability={availabilityByPlayerId.get(String(p.id))}
                      contracts={getPlayerContracts(safeClubContracts, p.id)}
                      clubStats={getClubPlayerStats(clubPlayerStatsById, p)}
                    onAssignRole={assignRole}
                      onRemoveRole={removePlayerRole}
                      onRelease={releaseSquadPlayer}
                      canRequestReturn={(isPresident || isOwner) && Boolean(p.loan_id) && canProposeEarlyEnd({
                        status: "ACTIVE",
                        parent_club_id: p.loan_from_club_id,
                        loan_club_id: id,
                        early_end_proposed_by_club_id: p.early_end_proposed_by_club_id,
                      }, id)}
                      canRespondToReturn={(isPresident || isOwner) && Boolean(p.loan_id) && isEarlyEndWaitingOnClub({
                        status: "ACTIVE",
                        early_end_proposed_by_club_id: p.early_end_proposed_by_club_id,
                      }, id)}
                      onRequestReturn={() => handleProposeEarlyEnd(p)}
                      onAcceptReturn={() => handleAcceptEarlyEnd(p)}
                      onRejectReturn={() => handleRejectEarlyEnd(p)}
                      canExerciseOption={(isPresident || isOwner) && Boolean(p.loan_id) && canExercisePurchaseOption({
                        status: "ACTIVE",
                        loan_club_id: id,
                        purchase_type: p.purchase_type,
                        purchase_offer_status: p.purchase_offer_status,
                        purchase_option_deadline: p.purchase_option_deadline,
                        end_date: p.loan_end_date,
                      }, id)}
                      purchaseAwaitingPlayer={Boolean(p.loan_id) && isPurchaseAwaitingPlayer({
                        status: "ACTIVE",
                        purchase_offer_status: p.purchase_offer_status,
                      })}
                      onExerciseOption={() => handleExerciseOption(p)}
                      onCardBackgroundChanged={handlePlayerCardBackgroundChanged}
                  />
                ))}
                </div>
                {onLoanPlayers.length ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-wider text-white/40">{t("commonPages.onLoan") || "On loan"}</p>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {onLoanPlayers.map(p => (
                        <PlayerCard
                          key={p.id}
                          player={p}
                          currentUser={currentUser}
                          myPlayer={myPlayer}
                          isPresident={isPresident}
                          isOwner={isOwner}
                          isClubMember={isMember}
                          isCaptain={isCaptain || isViceCaptain}
                          isStaff={operationStaffRoles.length > 0}
                          nextFixture={nextFixture}
                          availability={availabilityByPlayerId.get(String(p.id))}
                          contracts={getPlayerContracts(safeClubContracts, p.id)}
                          clubStats={getClubPlayerStats(clubPlayerStatsById, p)}
                          onAssignRole={assignRole}
                          onRemoveRole={removePlayerRole}
                          onRelease={releaseSquadPlayer}
                          canRecallLoan={(isPresident || isOwner) && Boolean(p.loan_id) && isLoanRecallable({
                            status: "ACTIVE",
                            recall_allowed: p.recall_allowed,
                            recall_after_date: p.recall_after_date,
                          })}
                          onRecallLoan={() => handleRecallLoan(p)}
                          canRequestReturn={(isPresident || isOwner) && Boolean(p.loan_id) && canProposeEarlyEnd({
                            status: "ACTIVE",
                            parent_club_id: id,
                            loan_club_id: p.on_loan_club_id,
                            early_end_proposed_by_club_id: p.early_end_proposed_by_club_id,
                          }, id)}
                          canRespondToReturn={(isPresident || isOwner) && Boolean(p.loan_id) && isEarlyEndWaitingOnClub({
                            status: "ACTIVE",
                            early_end_proposed_by_club_id: p.early_end_proposed_by_club_id,
                          }, id)}
                          onRequestReturn={() => handleProposeEarlyEnd(p)}
                          onAcceptReturn={() => handleAcceptEarlyEnd(p)}
                          onRejectReturn={() => handleRejectEarlyEnd(p)}
                          onCardBackgroundChanged={handlePlayerCardBackgroundChanged}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
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

          {/* Stats */}
          <TabsContent value="stats" className="px-4 pt-4 pb-6">
            <ClubStatsTables
              club={club}
              players={safePlayers}
              clubPlayerStatsById={clubPlayerStatsById}
              myPlayer={myPlayer}
              canCustomize={canOpenClubOffice}
              canUseStatsTileBackgrounds={isAdminTakeover || hasStagePlus(myPlayer?.subscription)}
              onClubChanged={handleClubStatsTileBackgroundChanged}
            />
          </TabsContent>

          {/* Fixtures */}
          <TabsContent value="fixtures" className="px-4 pt-4 pb-6">
            <ClubFixturesPanel
              clubId={id}
              clubPlayers={safePlayers}
                myPlayer={myPlayer}
              canSetAvailability={isMember}
              canViewTeamAvailability={isOwner || isCaptain || isPresident || isViceCaptain || isAdminTakeover}
              availabilityRows={safeFixtureAvailabilityRows}
              matchPlayerStats={safeFixtureMatchStatRows}
              onAvailabilityRowsChange={setFixtureAvailabilityRows}
              matches={safeMatches}
              tournamentMatches={safeTournamentMatches}
              t={t}
              />
            </TabsContent>

          {/* Club Office — president/captain only */}
          {canOpenClubOffice ? (
            <TabsContent value="club-office" className="px-4 pt-4 pb-6">
              <ClubOfficePanel
                club={club}
                players={safePlayers}
                myPlayer={myPlayer}
                isOwner={isOwner}
                onPlayerReleased={handlePlayerReleasedFromContract}
                onClubUpdate={(updates) => setClub(prev => ({ ...prev, ...updates }))}
              />
            </TabsContent>
          ) : null}
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

const CLUB_OFFICE_SECTIONS = [
  { id: "contracts", label: "Contracts", icon: FileText },
  { id: "finance", label: "Finance", icon: BarChart3 },
  { id: "stadium", label: "Stadium", icon: Shield },
  { id: "shirts", label: "Shirts", icon: Users },
  { id: "audit", label: "Audit Log", icon: History },
];

function ClubOfficePanel({ club, players, myPlayer, isOwner, onPlayerReleased, onClubUpdate }) {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState("contracts");
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState(null);
  const [auditRefreshKey, setAuditRefreshKey] = useState(0);

  useEffect(() => {
    if (activeSection !== "audit" || !club?.id) return;
    let alive = true;
    async function loadAudit() {
      setAuditLoading(true);
      setAuditError(null);
      try {
        const rows = await stageClient.entities.ClubOperationAuditLog
          .filter({ club_id: club.id }, "-created_date", 100)
          .catch(() => []);
        if (alive) setAuditLogs(asObjectArray(rows));
      } catch (err) {
        if (alive) setAuditError(err?.message || "Could not load audit log.");
      } finally {
        if (alive) setAuditLoading(false);
      }
    }
    loadAudit();
    return () => { alive = false; };
  }, [activeSection, club?.id, auditRefreshKey]);

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CLUB_OFFICE_SECTIONS.map(({ id: sectionId, label, icon: Icon }) => (
          <button
            key={sectionId}
            type="button"
            onClick={() => setActiveSection(sectionId)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-black uppercase tracking-[0.16em] transition-colors",
              activeSection === sectionId
                ? "border-[#f5c542]/45 bg-[#f5c542]/10 text-[#f5c542]"
                : "border-white/10 bg-white/[0.03] text-white/45 hover:border-white/20 hover:text-white/70"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
              </div>

      {activeSection === "contracts" ? (
        isOwner ? (
          <ContractsTab
            club={club}
            players={players}
            myPlayer={myPlayer}
            canManage={true}
            onPlayerReleased={onPlayerReleased}
          />
        ) : (
          <OfficeLockedSection title="Contracts" />
        )
      ) : null}

      {activeSection === "finance" ? (
        isOwner ? <ClubFinanceTab club={club} /> : <OfficeLockedSection title="Finance" />
      ) : null}

      {activeSection === "stadium" ? (
        isOwner ? (
          <StadiumUpgrade
            club={club}
            canEdit={true}
            onUpdate={onClubUpdate}
          />
        ) : (
          <OfficeLockedSection title="Stadium" />
        )
      ) : null}

      {activeSection === "shirts" ? (
        isOwner ? <ShirtSalesPanel club={club} players={players} /> : <OfficeLockedSection title="Shirts" />
      ) : null}

      {activeSection === "audit" ? (
        <ClubOfficeAuditLog
          logs={auditLogs}
          loading={auditLoading}
          error={auditError}
          onRefresh={() => setAuditRefreshKey((value) => value + 1)}
          t={t}
        />
      ) : null}
              </div>
  );
}

function OfficeLockedSection({ title }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
      <Lock className="mx-auto h-8 w-8 text-white/25" />
      <h3 className="mt-3 font-heading text-sm font-black uppercase tracking-[0.18em] text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/45">
        This section contains president-only actions and financial controls.
      </p>
    </section>
  );
}

function ClubOfficeAuditLog({ logs, loading, error, onRefresh, t }) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
          <h3 className="font-heading text-sm font-black uppercase tracking-[0.18em] text-white">Audit Log</h3>
          <p className="mt-1 text-xs text-white/40">Recent office and club operation changes.</p>
              </div>
        <Button type="button" size="sm" variant="outline" onClick={onRefresh} className="text-xs">
          {t("commonPages.coopRefreshAudit") || "Refresh"}
        </Button>
              </div>
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
              </div>
      ) : error ? (
        <p className="px-4 py-8 text-center text-sm text-destructive">{error}</p>
      ) : logs.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-white/45">{t("commonPages.coopNoAuditHistory") || "No audit history yet."}</p>
      ) : (
        <div className="divide-y divide-white/5">
          {logs.map((log) => (
            <div key={log.id} className="px-4 py-3">
              <p className="text-sm font-semibold capitalize text-white">{String(log.action || "update").replace(/_/g, " ")}</p>
              <p className="mt-1 text-xs text-white/45">
                {log.actor_email || t("commonPages.coopSystem") || "System"} · {log.created_date ? new Date(log.created_date).toLocaleString() : ""}
              </p>
              {log.reason ? <p className="mt-1 text-xs text-white/45">{log.reason}</p> : null}
            </div>
          ))}
            </div>
      )}
    </section>
  );
}

function formatRating(value) {
  return formatClubRating(value);
}

function rolePillClass(role) {
  const normalized = normalizeClubRole(role);
  if (normalized === "president") return "border-blue-300/40 bg-blue-400/10 text-blue-200";
  if (normalized === "captain") return "border-amber-300/40 bg-amber-400/10 text-amber-200";
  if (normalized === "vice_captain") return "border-[#00e5ff]/35 bg-[#00e5ff]/10 text-[#7defff]";
  if (["recruiter", "finance_manager", "match_coordinator"].includes(normalized)) {
    return "border-cyan-300/30 bg-cyan-400/10 text-cyan-200";
  }
  return "border-white/10 bg-white/5 text-white/55";
}

function isContractExpiringSoon(contract) {
  if (!contract?.end_date) return false;
  const end = new Date(contract.end_date).getTime();
  return Number.isFinite(end) && end >= Date.now() && end <= Date.now() + CONTRACT_EXPIRING_SOON_MS;
}

function getSquadContractSummary(contracts = []) {
  const safeContracts = normalizePlayerContracts(contracts);
  const active = safeContracts.find((contract) => contract.status === "active");
  if (active) {
    if (getContractType(active) === "trial") return { key: "trial", label: "Trial", className: "border-cyan-300/35 bg-cyan-400/10 text-cyan-200" };
    if (isContractExpiringSoon(active)) return { key: "expiring", label: "Expiring Soon", className: "border-amber-300/35 bg-amber-400/10 text-amber-200" };
    return { key: "active", label: "Active Contract", className: "border-emerald-300/35 bg-emerald-400/10 text-emerald-200" };
  }
  const pending = safeContracts.find((contract) => ["pending", "pending_window", "negotiating"].includes(contract.status));
  if (pending) {
    if (getContractType(pending) === "trial") return { key: "trial", label: "Trial", className: "border-cyan-300/35 bg-cyan-400/10 text-cyan-200" };
    return { key: "pending", label: "Pending Offer", className: "border-[#f5c542]/35 bg-[#f5c542]/10 text-[#f5c542]" };
  }
  return { key: "none", label: "No Contract", className: "border-white/10 bg-white/5 text-white/50" };
}

function getSquadAvailabilitySummary(row, nextFixture) {
  if (!nextFixture?.id) {
    return { key: "no_match", label: "No match scheduled", className: "border-white/10 bg-white/5 text-white/45" };
  }
  const status = String(row?.status || "no_response").toLowerCase();
  if (status === "available") return { key: "available", label: "Available", className: "border-emerald-300/35 bg-emerald-400/10 text-emerald-200" };
  if (status === "maybe") return { key: "maybe", label: "Maybe", className: "border-amber-300/35 bg-amber-400/10 text-amber-200" };
  if (status === "unavailable") return { key: "unavailable", label: "Unavailable", className: "border-red-300/35 bg-red-400/10 text-red-200" };
  return { key: "no_response", label: "No Response", className: "border-white/10 bg-white/5 text-white/50" };
}

function StatusPill({ className, children }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.11em]", className)}>
      {children}
    </span>
  );
}

const COUNTRY_FLAG_PALETTES = {
  AR: ["#74acdf", "#ffffff", "#f6b40e"],
  AT: ["#ed2939", "#ffffff", "#ed2939"],
  AU: ["#012169", "#ffffff", "#e4002b"],
  BE: ["#050505", "#f5d547", "#d72638"],
  BR: ["#009b3a", "#ffdf00", "#002776"],
  CA: ["#d52b1e", "#f7f7f7", "#d52b1e"],
  CH: ["#ff0000", "#ffffff", "#ff0000"],
  CI: ["#f77f00", "#ffffff", "#009e60"],
  CM: ["#007a5e", "#fcd116", "#ce1126"],
  DE: ["#050505", "#dd0000", "#ffce00"],
  FR: ["#123c8c", "#f7f7f7", "#d72638"],
  CD: ["#19a7e0", "#f5d547", "#d72638"],
  CG: ["#009543", "#fbd116", "#dc241f"],
  CO: ["#fcd116", "#003893", "#ce1126"],
  ES: ["#aa151b", "#f1bf00", "#aa151b"],
  GH: ["#ce1126", "#fcd116", "#006b3f"],
  IT: ["#008c45", "#f7f7f7", "#cd212a"],
  MA: ["#c1272d", "#006233", "#c1272d"],
  MX: ["#006847", "#ffffff", "#ce1126"],
  NL: ["#ae1c28", "#f7f7f7", "#21468b"],
  NG: ["#008751", "#ffffff", "#008751"],
  PL: ["#ffffff", "#dc143c", "#dc143c"],
  PT: ["#006600", "#ffcc00", "#ff0000"],
  SN: ["#00853f", "#fdef42", "#e31b23"],
  US: ["#3c3b6e", "#f7f7f7", "#b22234"],
  GB: ["#f7f7f7", "#c8102e", "#012169"],
  ENG: ["#f7f7f7", "#c8102e", "#f7f7f7"],
  SCO: ["#005eb8", "#ffffff", "#005eb8"],
  WAL: ["#ffffff", "#00a650", "#c8102e"],
  NIR: ["#ffffff", "#c8102e", "#ffffff"],
};

function getCountryFlagStyle(code) {
  const colors = COUNTRY_FLAG_PALETTES[normalizeCountryCode(code)];
  if (!colors) {
    return {
      background: "linear-gradient(135deg, rgba(0,229,255,0.18), rgba(255,255,255,0.08) 48%, rgba(245,197,66,0.12))",
    };
  }
  return {
    background: [
      `linear-gradient(120deg, ${colors[0]}88 0%, ${colors[0]}88 30%, transparent 30%)`,
      `linear-gradient(120deg, transparent 0%, transparent 34%, ${colors[1]}78 34%, ${colors[1]}78 64%, transparent 64%)`,
      `linear-gradient(120deg, transparent 0%, transparent 70%, ${colors[2]}88 70%, ${colors[2]}88 100%)`,
      "linear-gradient(90deg, rgba(0,0,0,0.64), rgba(0,0,0,0.28), rgba(0,0,0,0.64))",
    ].join(", "),
  };
}

function NationalityRow({ player }) {
  const nationality = getPlayerNationality(player);
  return (
    <div
      className="flex items-center justify-between gap-2 overflow-hidden border border-white/10 px-3 py-1.5"
      style={getCountryFlagStyle(nationality.code)}
    >
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/82 drop-shadow">Nationality</span>
      <span className="flex min-w-0 items-center border border-white/15 bg-black/55 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-[0_0_18px_rgba(0,0,0,0.28)]">
        <span className="truncate">{nationality.label}</span>
      </span>
          </div>
  );
}

function StatusRow({ label, summary }) {
  return (
    <div className="flex items-center justify-between gap-2 border border-white/10 bg-black/20 px-3 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">{label}</span>
      <StatusPill className={summary.className}>{summary.label}</StatusPill>
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 border border-white/10 bg-black/20 px-3 py-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/38">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-0.5 truncate font-heading text-xs font-black uppercase text-white">{value ?? "--"}</p>
    </div>
  );
}

function StatCell({ label, value }) {
  return (
    <div className="border-r border-white/10 px-2 py-1.5 text-center last:border-r-0">
      <p className="font-heading text-base font-black leading-none text-white">{value ?? "--"}</p>
      <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/35">{label}</p>
    </div>
  );
}

function BackgroundSlider({ label, value, min, max, onChange }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/45">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full accent-[#f5c542]"
      />
    </label>
  );
}

function getPlayerCardBackgroundUrl(player) {
  const type = String(player?.player_card_background_type || "default").toLowerCase();
  if (type === "default") return "";
  return String(player?.player_card_background_url || "").trim();
}

function getClubStatsTileBackgroundUrl(club) {
  const type = String(club?.stats_tile_background_type || "default").toLowerCase();
  if (type === "default") return "";
  return String(club?.stats_tile_background_url || "").trim();
}

function parseStatsTileBackgrounds(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function getClubStatsTileBackgroundConfig(club, statKey) {
  const backgrounds = parseStatsTileBackgrounds(club?.stats_tile_backgrounds);
  const config = asObject(backgrounds[statKey]);
  const type = String(config?.type || "default").toLowerCase();
  if (type !== "default" && config?.url) {
    return {
      type,
      background_id: config.background_id || null,
      url: String(config.url || "").trim(),
      position: config.position || "50% 50%",
      zoom: Number(config.zoom) || 120,
    };
  }
  const fallbackUrl = getClubStatsTileBackgroundUrl(club);
  return fallbackUrl
    ? {
        type: club?.stats_tile_background_type || "custom",
        background_id: club?.stats_tile_background_id || null,
        url: fallbackUrl,
        position: club?.stats_tile_background_position || "50% 50%",
        zoom: Number(club?.stats_tile_background_zoom) || 120,
      }
    : { type: "default", background_id: null, url: "", position: "50% 50%", zoom: 120 };
}

function formatClubStatValue(value, stat) {
  if (stat === "rating") return formatRating(value);
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function buildClubLeaderboard(players, stat, clubPlayerStatsById) {
  return asObjectArray(players)
    .filter((player) => player?.id)
    .map((player) => ({ player, value: getClubStatValue(player, stat, clubPlayerStatsById) }))
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return String(a.player.gamertag || "").localeCompare(String(b.player.gamertag || ""));
    })
    .slice(0, 10);
}

function ClubStatsTables({
  club,
  players = [],
  clubPlayerStatsById,
  myPlayer,
  canCustomize = false,
  canUseStatsTileBackgrounds = false,
  onClubChanged,
}) {
  const [activeBackgroundTable, setActiveBackgroundTable] = useState(null);
  const tables = [
    { title: "Top Scorers", stat: "goals", label: "G" },
    { title: "Top Assists", stat: "assists", label: "A" },
    { title: "Best Average Rating", stat: "rating", label: "AVG" },
    { title: "Most Appearances", stat: "matches", label: "MP" },
  ];
  const activeTable = tables.find((table) => table.stat === activeBackgroundTable) || null;

  return (
    <>
      <div className="mb-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300/70">Club Stats</p>
          <h2 className="font-heading text-xl font-black uppercase text-white">Leaderboards</h2>
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {tables.map((table) => {
          const backgroundConfig = getClubStatsTileBackgroundConfig(club, table.stat);
          return (
            <ClubLeaderboardTable
              key={table.stat}
              title={table.title}
              stat={table.stat}
              label={table.label}
              rows={buildClubLeaderboard(players, table.stat, clubPlayerStatsById)}
              backgroundConfig={backgroundConfig}
              canCustomize={canCustomize}
              canUseStatsTileBackgrounds={canUseStatsTileBackgrounds}
              onChangeBackground={() => setActiveBackgroundTable(table.stat)}
            />
          );
        })}
      </div>
      <ClubStatsTileBackgroundDialog
        club={club}
        statKey={activeTable?.stat}
        statTitle={activeTable?.title}
        statConfig={activeTable ? getClubStatsTileBackgroundConfig(club, activeTable.stat) : null}
        open={Boolean(activeTable)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setActiveBackgroundTable(null);
        }}
        canUseStatsTileBackgrounds={canUseStatsTileBackgrounds}
        myPlayer={myPlayer}
        onClubChanged={onClubChanged}
      />
    </>
  );
}

function ClubLeaderboardTable({
  title,
  stat,
  label,
  rows,
  backgroundConfig,
  canCustomize,
  canUseStatsTileBackgrounds,
  onChangeBackground,
}) {
  const backgroundUrl = backgroundConfig?.url || "";
  const backgroundPosition = backgroundConfig?.position || "50% 50%";
  const backgroundZoom = Number(backgroundConfig?.zoom) || 120;
  return (
    <section
      className="relative overflow-hidden border border-cyan-300/20 bg-[#06111d] shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
      style={{ clipPath: "polygon(3% 0, 100% 0, 97% 100%, 0 100%)" }}
    >
      {backgroundUrl ? (
        <div
          aria-hidden
          className="absolute inset-0 bg-no-repeat opacity-45"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            backgroundPosition,
            backgroundSize: `${backgroundZoom}%`,
          }}
        />
      ) : null}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-cyan-400/14 via-black/72 to-blue-950/75" />
      <div aria-hidden className="absolute inset-x-8 top-0 h-px bg-cyan-200/45" />
      <div className="relative z-[1] flex items-center justify-between gap-2 border-b border-cyan-300/15 px-6 py-3">
        <h3 className="min-w-0 flex-1 truncate font-heading text-xs font-black uppercase tracking-[0.16em] text-white sm:text-sm sm:tracking-[0.2em]">{title}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className="border border-[#f5c542]/35 bg-[#f5c542]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#f5c542]"
            style={{ clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)" }}
          >
            {label}
          </span>
          {canCustomize ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex h-8 w-8 items-center justify-center border border-cyan-300/20 bg-black/35 text-cyan-100/65 transition hover:border-cyan-200/50 hover:text-cyan-50"
                  style={{ clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" }}
                  aria-label={`${title} actions`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-white/10 bg-[#071018] text-white">
                <DropdownMenuItem className="cursor-pointer text-xs font-semibold" onSelect={onChangeBackground}>
                  {canUseStatsTileBackgrounds ? <ImageIcon className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  Change background
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="relative z-[1] px-6 py-8 text-center text-sm text-white/45">No player stats yet.</p>
      ) : (
        <div className="relative z-[1] max-h-[354px] overflow-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b border-cyan-300/10 text-[10px] uppercase tracking-[0.16em] text-cyan-100/45">
                <th className="w-12 px-6 py-2 text-left font-black">#</th>
                <th className="px-2 py-2 text-left font-black">Player</th>
                <th className="w-20 px-6 py-2 text-right font-black">{label}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-300/10">
              {rows.map(({ player, value }, index) => (
                <tr key={player.id} className="text-white/80 transition-colors hover:bg-cyan-300/5">
                  <td className="px-6 py-2.5 font-heading text-xs font-black text-cyan-100/45">{index + 1}</td>
                  <td className="min-w-0 px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden border border-cyan-200/20 bg-black/35"
                        style={{ clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)" }}
                      >
                        {player.avatar_url ? (
                          <img src={player.avatar_url} alt={player.gamertag} className="h-full w-full object-cover" style={{ objectPosition: player.avatar_position || "50% 50%" }} />
                        ) : (
                          <span className="font-heading text-xs font-black text-[#f5c542]">
                            {String(player.gamertag || "?").slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-white">{player.gamertag || "Player"}</p>
                        <p className="text-[11px] text-white/35">{[player.position, player.secondary_position].filter(Boolean).join(" / ") || "--"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-2.5 text-right font-heading text-base font-black text-[#f5c542]">
                    {formatClubStatValue(value, stat)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ClubStatsTileBackgroundDialog({
  club,
  statKey,
  statTitle,
  statConfig,
  open,
  onOpenChange,
  canUseStatsTileBackgrounds,
  myPlayer,
  onClubChanged,
}) {
  const [backgrounds, setBackgrounds] = useState([]);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [backgroundSaving, setBackgroundSaving] = useState(null);
  const [customBackgroundFile, setCustomBackgroundFile] = useState(null);
  const [customBackgroundPreview, setCustomBackgroundPreview] = useState("");
  const [customBackgroundX, setCustomBackgroundX] = useState(50);
  const [customBackgroundY, setCustomBackgroundY] = useState(50);
  const [customBackgroundZoom, setCustomBackgroundZoom] = useState(120);
  const [backgroundError, setBackgroundError] = useState("");

  useEffect(() => {
    if (!open || !canUseStatsTileBackgrounds) return;
    let cancelled = false;
    setBackgroundLoading(true);
    stageClient.entities.PlayerCardBackground
      .filter({}, "sort_order", 100)
      .then((rows) => {
        if (!cancelled) setBackgrounds(asObjectArray(rows));
      })
      .catch(() => {
        if (!cancelled) setBackgrounds([]);
      })
      .finally(() => {
        if (!cancelled) setBackgroundLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, canUseStatsTileBackgrounds]);

  useEffect(() => {
    if (!customBackgroundFile) {
      setCustomBackgroundPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(customBackgroundFile);
    setCustomBackgroundPreview(url);
    setCustomBackgroundX(50);
    setCustomBackgroundY(50);
    setCustomBackgroundZoom(120);
    return () => URL.revokeObjectURL(url);
  }, [customBackgroundFile]);

  async function saveStatsTileBackground(payload, busyKey) {
    if (!club?.id || !statKey) return;
    setBackgroundSaving(busyKey);
    setBackgroundError("");
    try {
      const updated = await stageClient.http.patch(`/clubs/${encodeURIComponent(club.id)}/stats-tile-background`, {
        ...payload,
        stat_key: statKey,
      });
      onClubChanged?.({
        ...updated,
      });
      setCustomBackgroundFile(null);
      setCustomBackgroundPreview("");
      onOpenChange(false);
    } catch (err) {
      setBackgroundError(err?.message || "Could not update stats tile background.");
    } finally {
      setBackgroundSaving(null);
    }
  }

  async function uploadCustomBackground() {
    if (!statKey) return;
    if (!customBackgroundFile) {
      setBackgroundError("Choose an image first.");
      return;
    }
    setBackgroundSaving("custom");
    setBackgroundError("");
    try {
      const uploaded = await stageClient.integrations.Core.UploadFile({ file: customBackgroundFile });
      const payload = {
        type: "custom",
        image_url: uploaded.file_url,
        position: `${customBackgroundX}% ${customBackgroundY}%`,
        zoom: customBackgroundZoom,
      };
      const updated = await stageClient.http.patch(`/clubs/${encodeURIComponent(club.id)}/stats-tile-background`, {
        ...payload,
        stat_key: statKey,
      });
      onClubChanged?.({
        ...updated,
      });
      setCustomBackgroundFile(null);
      setCustomBackgroundPreview("");
      onOpenChange(false);
    } catch (err) {
      setBackgroundError(err?.message || "Could not upload stats tile background.");
    } finally {
      setBackgroundSaving(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] max-w-lg overflow-y-auto border-white/10 bg-[#071018] p-4 text-white sm:p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading text-xs font-black uppercase tracking-[0.18em] text-[#f5c542]">
            <ImageIcon className="h-3.5 w-3.5" /> {statTitle || "Stats"} background
          </DialogTitle>
        </DialogHeader>
        {!canUseStatsTileBackgrounds ? (
          <div className="rounded-lg border border-[#f5c542]/25 bg-[#f5c542]/10 p-4">
            <div className="mb-3 flex items-start gap-3">
              <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#f5c542]" />
              <div>
                <p className="font-heading text-base font-black uppercase text-white">STAGE Plus feature</p>
                <p className="mt-1 text-sm text-white/60">
                  Custom club stats tile backgrounds, personal uploads, and exclusive official designs are included with STAGE Plus.
                </p>
              </div>
            </div>
            <Link to="/store">
              <Button type="button" className="gap-2 bg-[#f5c542] font-black text-black hover:bg-[#f7d46a]">
                <Sparkles className="h-4 w-4" /> View STAGE Plus
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {backgroundError ? (
              <div className="rounded-md border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {backgroundError}
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] p-2.5">
              <div>
                <p className="font-heading text-xs font-black uppercase text-white">{statTitle || "Stats tile"}</p>
                <p className="text-xs text-white/45">This background applies only to this leaderboard tile.</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={Boolean(backgroundSaving)}
                onClick={() => saveStatsTileBackground({ type: "default" }, "default")}
                className="h-8 gap-1.5 border-white/15 bg-black/20 text-xs text-white hover:bg-white/10"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Official Stage+ designs</p>
              {backgroundLoading ? (
                <div className="flex items-center justify-center rounded-lg border border-white/10 py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#f5c542]" />
                </div>
              ) : backgrounds.length ? (
                <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                  {backgrounds.map((bg) => {
                    const selected = statConfig?.type === "official" && statConfig?.background_id === bg.id;
                    return (
                      <button
                        key={bg.id}
                        type="button"
                        disabled={Boolean(backgroundSaving)}
                        onClick={() => saveStatsTileBackground({ type: "official", background_id: bg.id }, bg.id)}
                        className={cn(
                          "overflow-hidden rounded-md border bg-black/30 text-left transition hover:border-[#f5c542]/50",
                          selected ? "border-[#f5c542]/70" : "border-white/10",
                        )}
                      >
                        <div className="aspect-[16/9] bg-black">
                          <img src={bg.image_url} alt={bg.name} className="h-full w-full object-cover" />
                        </div>
                        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                          <span className="truncate text-[11px] font-bold text-white">{bg.name}</span>
                          {backgroundSaving === bg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#f5c542]" /> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-white/40">
                  No official backgrounds are available yet.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Upload your own</p>
              <div className="flex flex-col gap-3">
                {customBackgroundPreview ? (
                  <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                    <div
                      className="relative h-[116px] overflow-hidden border border-cyan-300/35 bg-black"
                      style={{ clipPath: "polygon(7% 0, 100% 0, 93% 100%, 0 100%)" }}
                    >
                      <div
                        aria-hidden
                        className="absolute inset-0 bg-no-repeat"
                        style={{
                          backgroundImage: `url(${customBackgroundPreview})`,
                          backgroundPosition: `${customBackgroundX}% ${customBackgroundY}%`,
                          backgroundSize: `${customBackgroundZoom}%`,
                        }}
                      />
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-cyan-400/12 via-black/58 to-blue-950/80" />
                      <div className="relative z-[1] flex h-full flex-col justify-between p-3">
                        <p className="font-heading text-sm font-black uppercase text-white">{club?.name || "Club"}</p>
                        <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.16em] text-white/50">
                          <span>{statTitle || "Leaderboard tile"}</span>
                          <span>{myPlayer?.gamertag || "Stage+"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <BackgroundSlider label="Zoom" value={customBackgroundZoom} min={100} max={260} onChange={setCustomBackgroundZoom} />
                      <BackgroundSlider label="Horizontal" value={customBackgroundX} min={0} max={100} onChange={setCustomBackgroundX} />
                      <BackgroundSlider label="Vertical" value={customBackgroundY} min={0} max={100} onChange={setCustomBackgroundY} />
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[#f5c542]/35 bg-[#f5c542]/10 px-3 py-2 text-xs font-bold text-[#f5c542]">
                    <Upload className="h-4 w-4" />
                    <span className="truncate">{customBackgroundFile ? customBackgroundFile.name : "Choose image"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => setCustomBackgroundFile(event.target.files?.[0] || null)}
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!customBackgroundFile || Boolean(backgroundSaving)}
                    onClick={uploadCustomBackground}
                    className="h-10 gap-2 bg-[#f5c542] font-black text-black hover:bg-[#f7d46a]"
                  >
                    {backgroundSaving === "custom" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const FIXTURE_AVAILABILITY_LABELS = {
  available: "Available",
  unavailable: "Unavailable",
  maybe: "Maybe",
  no_response: "No Response",
};

function ClubFixturesPanel({
  clubId,
  clubPlayers = [],
  myPlayer,
  canSetAvailability = false,
  canViewTeamAvailability = false,
  availabilityRows = [],
  matchPlayerStats = [],
  onAvailabilityRowsChange,
  matches = [],
  tournamentMatches = [],
  t,
}) {
  const [busyAvailability, setBusyAvailability] = useState(null);
  const [expandedResponses, setExpandedResponses] = useState({});
  const [availabilityError, setAvailabilityError] = useState(null);
  const fixturesById = new Map();
  for (const fixture of [...asObjectArray(matches), ...asObjectArray(tournamentMatches)]) {
    if (!fixture?.id) continue;
    if (fixture.home_club_id !== clubId && fixture.away_club_id !== clubId) continue;
    const existing = fixturesById.get(fixture.id) || {};
    fixturesById.set(fixture.id, { ...existing, ...fixture });
  }
  const grouped = groupClubFixtures([...fixturesById.values()]);
  const availabilityByFixture = buildAvailabilityByFixture(availabilityRows);
  const statsByFixture = buildMatchStatsByFixture(matchPlayerStats);
  const playerById = new Map(asObjectArray(clubPlayers).filter((player) => player?.id).map((player) => [String(player.id), player]));

  async function setMyFixtureAvailability(fixture, status) {
    if (!myPlayer?.id || !fixtureCanSetAvailability(fixture)) return;
    const busyKey = `${fixture.id}:${status}`;
    setBusyAvailability(busyKey);
    setAvailabilityError(null);
    const existing = (availabilityByFixture.get(String(fixture.id)) || [])
      .find((row) => String(row.player_id) === String(myPlayer.id));
    const body = {
      club_id: clubId,
      fixture_id: fixture.id,
      fixture_type: fixture._fixtureType || fixture.fixture_type || "match",
      player_id: myPlayer.id,
      status,
    };
    try {
      const saved = existing
        ? await stageClient.http.patch(`/club-fixture-availabilities/${existing.id}`, body)
        : await stageClient.http.post("/club-fixture-availabilities", body);
      if (saved?.id) {
        onAvailabilityRowsChange?.((prev) => {
          const rows = asObjectArray(prev).filter((row) => row.id !== saved.id);
          return [saved, ...rows];
        });
      }
    } catch (err) {
      setAvailabilityError(err?.message || "Could not update availability.");
    } finally {
      setBusyAvailability(null);
    }
  }

  return (
    <div className="space-y-5">
      {availabilityError ? (
        <div className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {availabilityError}
        </div>
      ) : null}
      {grouped.length === 0 ? (
        <section className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <p className="text-sm text-white/45">No fixtures found.</p>
        </section>
      ) : grouped.map((group) => (
        <FixtureGroup
          key={group.key}
          group={group}
          clubId={clubId}
          clubPlayers={clubPlayers}
          myPlayer={myPlayer}
          canSetAvailability={canSetAvailability}
          canViewTeamAvailability={canViewTeamAvailability}
          availabilityByFixture={availabilityByFixture}
          statsByFixture={statsByFixture}
          playerById={playerById}
          expandedResponses={expandedResponses}
          onToggleResponses={(fixtureId) => setExpandedResponses((prev) => ({ ...prev, [fixtureId]: !prev[fixtureId] }))}
          busyAvailability={busyAvailability}
          onSetAvailability={setMyFixtureAvailability}
          t={t}
        />
      ))}
    </div>
  );
}

function buildAvailabilityByFixture(rows) {
  const map = new Map();
  for (const row of asObjectArray(rows)) {
    if (!row?.fixture_id) continue;
    const key = String(row.fixture_id);
    const current = map.get(key) || [];
    current.push(row);
    map.set(key, current);
  }
  return map;
}

function buildMatchStatsByFixture(rows) {
  const map = new Map();
  for (const row of asObjectArray(rows)) {
    if (!row?.match_id) continue;
    const key = String(row.match_id);
    const current = map.get(key) || [];
    current.push(row);
    map.set(key, current);
  }
  return map;
}

const CLUB_FIXTURE_GROUPS = [
  { key: "regional", title: "Regional League fixtures" },
  { key: "supreme", title: "Supreme League", parent: "Competitions" },
  { key: "elite", title: "Elite League", parent: "Competitions" },
  { key: "challenger", title: "Challenger League", parent: "Competitions" },
  { key: "tournament", title: "Tournaments" },
  { key: "gameday", title: "Arrange Game / Game Day" },
];

function fixtureText(fixture) {
  return [
    fixture.event_type,
    fixture.fixture_type,
    fixture._fixtureType,
    fixture.competition_type,
    fixture.competition_name,
    fixture.tournament_name,
    fixture.league_name,
    fixture.name,
    fixture.title,
  ].filter(Boolean).join(" ").toLowerCase();
}

function fixtureGroupKey(fixture) {
  const text = fixtureText(fixture);
  if (text.includes("regional")) return "regional";
  if (text.includes("supreme league")) return "supreme";
  if (text.includes("elite league")) return "elite";
  if (text.includes("challenger league")) return "challenger";
  if (text.includes("tournament") || (fixture.tournament_id && fixture.tournament_id !== "ranked")) return "tournament";
  return "gameday";
}

function fixtureDateValue(fixture) {
  const value = new Date(fixture.scheduled_date || fixture.match_date || fixture.created_date || fixture.updated_date || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function fixtureIsCompleted(fixture) {
  return fixture.status === "completed" || (fixture.home_score != null && fixture.away_score != null);
}

function fixtureIsTerminal(fixture) {
  return ["completed", "cancelled", "canceled", "forfeited", "forfeit"].includes(String(fixture.status || "").toLowerCase())
    || fixtureIsCompleted(fixture);
}

function fixtureCanSetAvailability(fixture) {
  return Boolean(fixture?.id) && !fixtureIsTerminal(fixture);
}

function sortClubFixtures(fixtures) {
  const now = Date.now();
  return fixtures.sort((a, b) => {
    const aDone = fixtureIsCompleted(a);
    const bDone = fixtureIsCompleted(b);
    if (aDone !== bDone) return aDone ? 1 : -1;
    const aDate = fixtureDateValue(a);
    const bDate = fixtureDateValue(b);
    if (!aDone) return (aDate || now) - (bDate || now);
    return bDate - aDate;
  });
}

function groupClubFixtures(fixtures) {
  const byGroup = new Map(CLUB_FIXTURE_GROUPS.map((group) => [group.key, { ...group, fixtures: [] }]));
  for (const fixture of fixtures) {
    byGroup.get(fixtureGroupKey(fixture)).fixtures.push(fixture);
  }
  return CLUB_FIXTURE_GROUPS
    .map((group) => ({ ...byGroup.get(group.key), fixtures: sortClubFixtures(byGroup.get(group.key).fixtures) }))
    .filter((group) => group.fixtures.length > 0);
}

function fixtureEventName(fixture, group) {
  return fixture.competition_name
    || fixture.tournament_name
    || fixture.league_name
    || fixture.event_name
    || fixture.name
    || group.title;
}

function fixtureDateLabel(fixture) {
  const raw = fixture.scheduled_date || fixture.match_date || fixture.created_date;
  if (!raw) return "TBD";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleString();
}

function parseFixtureGoalEvents(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function playerLookupKey(value) {
  return String(value || "").trim().toLowerCase();
}

function findFixtureEventPlayer(event, kind, playerById) {
  const id = event?.[`${kind}_player_id`] || event?.[`${kind}_id`];
  if (id && playerById.has(String(id))) return playerById.get(String(id));
  if (id) return { id, gamertag: event?.[`${kind}_gamertag`] };
  const email = playerLookupKey(event?.[`${kind}_email`]);
  const gamertag = playerLookupKey(event?.[`${kind}_gamertag`]);
  for (const player of playerById.values()) {
    if (email && playerLookupKey(player.email) === email) return player;
    if (gamertag && playerLookupKey(player.gamertag) === gamertag) return player;
  }
  return null;
}

function fixtureSideForClub(fixture, clubId) {
  if (String(clubId || "") === String(fixture.home_club_id || "")) return "home";
  if (String(clubId || "") === String(fixture.away_club_id || "")) return "away";
  return "";
}

function buildFixtureGoalTimeline(fixture, playerById, matchStats = []) {
  const statSideByPlayer = new Map();
  for (const stat of asObjectArray(matchStats)) {
    const side = fixtureSideForClub(fixture, stat.club_id);
    if (stat.player_id && side) statSideByPlayer.set(String(stat.player_id), side);
    if (stat.player_email && side) statSideByPlayer.set(`email:${playerLookupKey(stat.player_email)}`, side);
    if (stat.player_gamertag && side) statSideByPlayer.set(`tag:${playerLookupKey(stat.player_gamertag)}`, side);
  }

  function eventSide(event) {
    const directSide = fixtureSideForClub(fixture, event?.club_id);
    if (directSide) return directSide;
    const scorerId = event?.scorer_player_id || event?.scorer_id;
    if (scorerId && statSideByPlayer.has(String(scorerId))) return statSideByPlayer.get(String(scorerId));
    const scorerEmail = playerLookupKey(event?.scorer_email);
    if (scorerEmail && statSideByPlayer.has(`email:${scorerEmail}`)) return statSideByPlayer.get(`email:${scorerEmail}`);
    const scorerTag = playerLookupKey(event?.scorer_gamertag);
    if (scorerTag && statSideByPlayer.has(`tag:${scorerTag}`)) return statSideByPlayer.get(`tag:${scorerTag}`);
    return "";
  }

  const eventTimeline = [
    ...parseFixtureGoalEvents(fixture.home_goal_events),
    ...parseFixtureGoalEvents(fixture.away_goal_events),
  ]
    .map((event) => {
      const scorer = findFixtureEventPlayer(event, "scorer", playerById);
      const assist = findFixtureEventPlayer(event, "assist", playerById);
      return {
        ...event,
        scorer,
        assist,
        minute: event?.minute,
        scorerName: scorer?.gamertag || event?.scorer_gamertag || event?.scorer_name || "?",
        assistName: assist?.gamertag || event?.assist_gamertag || event?.assist_name || "",
        side: eventSide(event),
      };
    })
    .sort((a, b) => (Number(a.minute) || 999) - (Number(b.minute) || 999));
  if (eventTimeline.length > 0) return eventTimeline;

  return asObjectArray(matchStats)
    .filter((stat) => Number(stat.goals || 0) > 0 || Number(stat.assists || 0) > 0)
    .map((stat) => {
      const player = stat.player_id ? playerById.get(String(stat.player_id)) : null;
      return {
        statFallback: true,
        side: fixtureSideForClub(fixture, stat.club_id),
        scorer: player || (stat.player_id ? { id: stat.player_id, gamertag: stat.player_gamertag || stat.player_email } : null),
        scorerName: player?.gamertag || stat.player_gamertag || stat.player_email || "Player",
        goals: Number(stat.goals || 0),
        assists: Number(stat.assists || 0),
      };
    })
    .sort((a, b) => (b.goals - a.goals) || String(a.scorerName).localeCompare(String(b.scorerName)));
}

function FixtureGroup({
  group,
  clubId,
  clubPlayers,
  myPlayer,
  canSetAvailability,
  canViewTeamAvailability,
  availabilityByFixture,
  statsByFixture,
  playerById,
  expandedResponses,
  onToggleResponses,
  busyAvailability,
  onSetAvailability,
  t,
}) {
  return (
    <section
      className="relative overflow-hidden border border-cyan-300/18 bg-[#06111d] shadow-[0_22px_70px_rgba(0,0,0,0.28)]"
      style={{ clipPath: "polygon(1.5% 0, 100% 0, 98.5% 100%, 0 100%)" }}
    >
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(0,229,255,0.16),transparent_28%),linear-gradient(135deg,rgba(0,229,255,0.08),transparent_36%,rgba(245,197,66,0.06))]" />
      <div aria-hidden className="absolute inset-x-10 top-0 h-px bg-cyan-200/45" />
      <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3 border-b border-cyan-300/15 py-4 pl-8 pr-5 sm:pl-10 lg:pl-14 lg:pr-8">
        <div className="min-w-0">
          {group.parent ? (
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#00e5ff]/65">{group.parent}</p>
          ) : null}
          <h3 className="break-words font-heading text-base font-black uppercase tracking-[0.18em] text-white">{group.title}</h3>
        </div>
        <span className="shrink-0 border border-[#f5c542]/30 bg-[#f5c542]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[#f5c542]">
          {group.fixtures.length} {group.fixtures.length === 1 ? "fixture" : "fixtures"}
        </span>
      </div>
      <div className="relative z-[1] space-y-3 py-4 pl-6 pr-4 sm:pl-8 lg:pl-10 lg:pr-8">
        {group.fixtures.map((fixture) => (
          <FixtureRow
            key={fixture.id}
            fixture={fixture}
            group={group}
            clubId={clubId}
            clubPlayers={clubPlayers}
            myPlayer={myPlayer}
            canSetAvailability={canSetAvailability}
            canViewTeamAvailability={canViewTeamAvailability}
            availabilityRows={availabilityByFixture.get(String(fixture.id)) || []}
            matchStats={statsByFixture.get(String(fixture.id)) || []}
            playerById={playerById}
            responsesOpen={Boolean(expandedResponses[fixture.id])}
            onToggleResponses={() => onToggleResponses(fixture.id)}
            busyAvailability={busyAvailability}
            onSetAvailability={onSetAvailability}
            t={t}
          />
        ))}
      </div>
    </section>
  );
}

function FixtureRow({
  fixture,
  group,
  clubId,
  clubPlayers,
  myPlayer,
  canSetAvailability,
  canViewTeamAvailability,
  availabilityRows,
  matchStats = [],
  playerById,
  responsesOpen,
  onToggleResponses,
  busyAvailability,
  onSetAvailability,
  t,
}) {
  const isHome = fixture.home_club_id === clubId;
  const clubName = isHome ? fixture.home_club_name : fixture.away_club_name;
  const clubTag = isHome ? fixture.home_club_tag : fixture.away_club_tag;
  const opponent = isHome ? fixture.away_club_name : fixture.home_club_name;
  const opponentTag = isHome ? fixture.away_club_tag : fixture.home_club_tag;
  const mine = isHome ? fixture.home_score : fixture.away_score;
  const theirs = isHome ? fixture.away_score : fixture.home_score;
  const hasScore = mine != null && theirs != null;
  const completed = fixtureIsCompleted(fixture);
  const canManageAvailability = fixtureCanSetAvailability(fixture);
  const myAvailability = availabilityRows.find((row) => String(row.player_id) === String(myPlayer?.id));
  const myStatus = myAvailability?.status || "no_response";
  const counts = getFixtureAvailabilityCounts(availabilityRows, clubPlayers);
  const responseRows = buildFixtureResponseRows(availabilityRows, clubPlayers, playerById);
  const showMemberControls = canSetAvailability && myPlayer?.id && canManageAvailability;
  const showTeamSummary = canViewTeamAvailability && canManageAvailability;
  const eventName = fixtureEventName(fixture, group);
  const statusLabel = fixture.status || "scheduled";
  const goalTimeline = completed ? buildFixtureGoalTimeline(fixture, playerById, matchStats) : [];
  const currentSide = isHome ? "home" : "away";

  return (
    <article className="relative overflow-hidden border border-white/10 bg-black/24 p-3 sm:p-4">
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-cyan-400/[0.06] via-transparent to-[#f5c542]/[0.05]" />
      <div className="relative z-[1] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="border border-cyan-300/22 bg-cyan-300/8 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/70">
              {isHome ? "Home" : "Away"}
            </span>
            <span className="min-w-0 break-words text-[11px] font-black uppercase tracking-[0.14em] text-white/42">{eventName}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              "border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em]",
              completed
                ? "border-white/18 bg-white/[0.04] text-white/70"
                : "border-cyan-300/25 bg-cyan-300/8 text-cyan-100/75"
            )}>
              {completed ? "Completed" : statusLabel}
            </span>
            <span className="max-w-full break-words border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/50">
              {fixtureDateLabel(fixture)}
            </span>
            {!hasScore ? (
              <span className="border border-white/10 bg-black/35 px-3 py-1.5 font-heading text-xs font-black uppercase text-white/75">TBD</span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
          <div className="min-w-0">
            <p className="break-words font-heading text-xl font-black uppercase leading-tight text-white">
              {clubName || "Your club"}
              {clubTag ? <span className="ml-2 text-sm text-white/45">[{clubTag}]</span> : null}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/38">{isHome ? "Hosting" : "Travelling"}</p>
          </div>

          <div className="flex justify-start md:justify-center">
            <div className="min-w-[112px] text-center">
              <p className={cn(
                "font-heading font-black uppercase leading-none text-white",
                hasScore ? "text-4xl opacity-70 sm:text-5xl" : "text-3xl opacity-55 sm:text-4xl"
              )}>
                {hasScore ? (
                  <span className="inline-flex items-center justify-center gap-3 sm:gap-4">
                    <span>{mine}</span>
                    <span className="opacity-80">-</span>
                    <span>{theirs}</span>
                  </span>
                ) : "VS"}
              </p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.18em] text-white/35">
              {hasScore ? "Score" : "Fixture"}
            </p>
              {goalTimeline.length > 0 ? (
                <GoalTimeline events={goalTimeline} currentSide={currentSide} />
              ) : null}
            </div>
          </div>

          <div className="min-w-0 md:text-right">
            <p className="break-words font-heading text-xl font-black uppercase leading-tight text-white">
              {opponent || t("commonPages.cdCompetition")}
              {opponentTag ? <span className="ml-2 text-sm text-white/45">[{opponentTag}]</span> : null}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/38">Opponent</p>
          </div>
        </div>
      </div>

      {(showMemberControls || showTeamSummary) ? (
        <div className="relative z-[1] mt-4 grid gap-3 border border-white/10 bg-black/22 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          {showMemberControls ? (
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-100/45">My availability</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="border border-cyan-300/20 bg-cyan-300/8 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-cyan-100/75">
                  {FIXTURE_AVAILABILITY_LABELS[myStatus] || myStatus}
                </span>
                <Button
                  type="button"
                  disabled={busyAvailability === `${fixture.id}:available`}
                  onClick={() => onSetAvailability(fixture, "available")}
                  className={cn(
                    "h-8 gap-1.5 rounded-none px-3 text-[10px] font-black uppercase tracking-[0.12em]",
                    myStatus === "available"
                      ? "bg-white text-black hover:bg-white/90"
                      : "border border-white/14 bg-white/[0.04] text-white/70 hover:bg-white/10"
                  )}
                >
                  {busyAvailability === `${fixture.id}:available` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Available
                </Button>
                <Button
                  type="button"
                  disabled={busyAvailability === `${fixture.id}:unavailable`}
                  onClick={() => onSetAvailability(fixture, "unavailable")}
                  className={cn(
                    "h-8 gap-1.5 rounded-none px-3 text-[10px] font-black uppercase tracking-[0.12em]",
                    myStatus === "unavailable"
                      ? "bg-white text-black hover:bg-white/90"
                      : "border border-white/14 bg-white/[0.04] text-white/70 hover:bg-white/10"
                  )}
                >
                  {busyAvailability === `${fixture.id}:unavailable` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                  Unavailable
                </Button>
              </div>
            </div>
          ) : null}

          {showTeamSummary ? (
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <AvailabilityCount label="Available" value={counts.available} className="text-cyan-100/80" />
                <AvailabilityCount label="Unavailable" value={counts.unavailable} className="text-cyan-100/65" />
                <AvailabilityCount label="No Response" value={counts.no_response} className="text-white/55" />
                {counts.maybe > 0 ? <AvailabilityCount label="Maybe" value={counts.maybe} className="text-cyan-100/60" /> : null}
              </div>
              {responseRows.length > 0 ? (
                <button
                  type="button"
                  onClick={onToggleResponses}
                  className="mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#00e5ff] hover:text-[#7defff]"
                >
                  {responsesOpen ? "Hide responses" : "View responses"}
          </button>
              ) : null}
        </div>
          ) : null}
        </div>
      ) : null}

      {showTeamSummary && responsesOpen ? (
        <div className="relative z-[1] mt-2 grid gap-1.5 border border-white/10 bg-black/20 p-3 sm:grid-cols-2">
          {responseRows.map((row) => (
            <div key={row.player.id} className="flex items-center justify-between gap-2 rounded border border-white/10 bg-white/[0.03] px-2 py-1.5 text-xs">
              <span className="truncate text-white/75">{row.player.gamertag || row.player.email || "Player"}</span>
              <span className={cn("shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.12em]", fixtureAvailabilityClass(row.status))}>
                {FIXTURE_AVAILABILITY_LABELS[row.status] || row.status}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function groupGoalEventsByScorer(events) {
  const grouped = new Map();
  for (const event of asObjectArray(events)) {
    const key = event.scorer?.id || event.scorerName || "unknown";
    const current = grouped.get(key) || {
      scorer: event.scorer,
      scorerName: event.scorerName,
      minutes: [],
      assists: [],
      goals: 0,
      statFallback: Boolean(event.statFallback),
    };
    if (event.minute) current.minutes.push(Number(event.minute));
    if (event.assistName) {
      current.assists.push({ player: event.assist, name: event.assistName });
    }
    current.goals += Number(event.goals || 1);
    current.statFallback = current.statFallback || Boolean(event.statFallback);
    grouped.set(key, current);
  }
  return [...grouped.values()].map((group) => ({
    ...group,
    minutes: [...new Set(group.minutes)].sort((a, b) => a - b),
    assists: group.assists.filter((assist, index, arr) =>
      arr.findIndex((item) => (item.player?.id || item.name) === (assist.player?.id || assist.name)) === index
    ),
  }));
}

function GoalTimeline({ events, currentSide }) {
  const ownEvents = events.filter((event) => event.side === currentSide || (!event.side && currentSide === "home"));
  const opponentEvents = events.filter((event) => event.side && event.side !== currentSide);
  const ownScorers = groupGoalEventsByScorer(ownEvents);
  const opponentScorers = groupGoalEventsByScorer(opponentEvents);
  if (!ownScorers.length && !opponentScorers.length) return null;

  return (
    <div className="mt-3 grid min-w-[260px] gap-3 text-left md:grid-cols-2 md:text-center">
      <GoalScorerList scorers={ownScorers} align="left" />
      <GoalScorerList scorers={opponentScorers} align="right" />
    </div>
  );
}

function GoalScorerList({ scorers, align }) {
  if (!scorers.length) return <div className="hidden md:block" />;
  return (
    <div className={cn("min-w-0 space-y-1", align === "right" && "md:text-right")}>
      {scorers.map((scorer) => (
        <div key={scorer.scorer?.id || scorer.scorerName} className="min-w-0 text-[11px] leading-snug text-white/52">
          <PlayerEventName player={scorer.scorer} fallback={scorer.scorerName} />
          <span className="ml-1 text-white/45">
            {scorer.minutes.length
              ? scorer.minutes.map((minute) => `${minute}'`).join(", ")
              : `${scorer.goals} ${scorer.goals === 1 ? "goal" : "goals"}`}
          </span>
          {scorer.assists.length ? (
            <span className="block text-[10px] text-white/35">
              <Zap className="mr-1 inline h-3 w-3" />
              {scorer.assists.map((assist) => (
                <PlayerEventName key={assist.player?.id || assist.name} player={assist.player} fallback={assist.name} subtle />
              )).reduce((acc, item, index) => index === 0 ? [item] : [...acc, <span key={`sep-${index}`}> / </span>, item], [])}
            </span>
          ) : null}
        </div>
      ))}
      </div>
  );
}

function PlayerEventName({ player, fallback, subtle = false }) {
  const label = player?.gamertag || fallback || "?";
  const className = cn(
    "min-w-0 truncate font-black uppercase",
    subtle ? "text-white/55 hover:text-cyan-100" : "text-white/82 hover:text-cyan-100"
  );
  return player?.id ? (
    <Link to={`/players/${player.id}`} className={className}>
      {label}
    </Link>
  ) : (
    <span className={className}>{label}</span>
  );
}

function fixtureAvailabilityClass(status) {
  if (status === "available") return "border-emerald-300/40 bg-emerald-400/10 text-emerald-200";
  if (status === "unavailable") return "border-red-300/40 bg-red-400/10 text-red-200";
  if (status === "maybe") return "border-amber-300/40 bg-amber-400/10 text-amber-200";
  return "border-white/10 bg-white/5 text-white/45";
}

function getFixtureAvailabilityCounts(rows, players) {
  const responded = new Set();
  const counts = { available: 0, unavailable: 0, maybe: 0, no_response: 0 };
  for (const row of asObjectArray(rows)) {
    if (!row?.player_id) continue;
    const status = String(row.status || "no_response").toLowerCase();
    if (status === "available" || status === "unavailable" || status === "maybe") {
      counts[status] += 1;
      responded.add(String(row.player_id));
    }
  }
  counts.no_response = Math.max(0, asObjectArray(players).filter((player) => player?.id && !responded.has(String(player.id))).length);
  return counts;
}

function buildFixtureResponseRows(rows, players, playerById) {
  const rowsByPlayer = new Map(asObjectArray(rows).filter((row) => row?.player_id).map((row) => [String(row.player_id), row]));
  return asObjectArray(players)
    .filter((player) => player?.id)
    .map((player) => {
      const row = rowsByPlayer.get(String(player.id));
      return {
        player: playerById.get(String(player.id)) || player,
        status: row?.status || "no_response",
      };
    })
    .sort((a, b) => String(a.player.gamertag || "").localeCompare(String(b.player.gamertag || "")));
}

function AvailabilityCount({ label, value, className }) {
  return (
    <span className={cn("rounded-sm border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]", className)}>
      {value} {label}
    </span>
  );
}

function PlayerCard({
  player: rawPlayer,
  currentUser,
  myPlayer: _myPlayer,
  isPresident,
  isOwner = false,
  isClubMember = false,
  isCaptain = false,
  isStaff = false,
  nextFixture = null,
  availability = null,
  contracts = [],
  onAssignRole,
  onRemoveRole,
  onRelease,
  canRecallLoan = false,
  onRecallLoan,
  canRequestReturn = false,
  onRequestReturn,
  canRespondToReturn = false,
  onAcceptReturn,
  onRejectReturn,
  canExerciseOption = false,
  purchaseAwaitingPlayer = false,
  onExerciseOption,
  clubStats,
  onCardBackgroundChanged,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [statsOpen, setStatsOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [backgroundOpen, setBackgroundOpen] = useState(false);
  const [backgrounds, setBackgrounds] = useState([]);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [backgroundSaving, setBackgroundSaving] = useState(null);
  const [customBackgroundFile, setCustomBackgroundFile] = useState(null);
  const [customBackgroundPreview, setCustomBackgroundPreview] = useState("");
  const [customBackgroundX, setCustomBackgroundX] = useState(50);
  const [customBackgroundY, setCustomBackgroundY] = useState(50);
  const [customBackgroundZoom, setCustomBackgroundZoom] = useState(120);
  const [backgroundError, setBackgroundError] = useState("");
  const player = asObject(rawPlayer);
  const primaryRole = getPrimaryClubRole(player);
  const isPresidentRole = primaryRole === "president";
  const isCaptainRole = primaryRole === "captain";
  const isViceCaptainRole = primaryRole === "vice_captain";
  const roleLabel = clubRoleLabel(t, primaryRole);
  const playerContracts = normalizePlayerContracts(contracts);
  const contractSummary = getSquadContractSummary(playerContracts);
  const availabilitySummary = getSquadAvailabilitySummary(availability, nextFixture);
  const canManageRoles = isPresident || isOwner || isCaptain || isStaff;
  const canReleaseOrRemove = (isPresident || isOwner) && currentUser?.email !== player.email && !isPresidentRole;
  const canMakeCaptain = canManageRoles && !isPresidentRole && !isCaptainRole;
  const canMakeViceCaptain = canManageRoles && !isPresidentRole && !isViceCaptainRole;
  const canRemoveRole = canReleaseOrRemove && primaryRole !== "member";
  const canViewStats = isClubMember || canManageRoles || isOwner;
  const activeContract = playerContracts.find((contract) => contract.status === "active") || null;
  const profilePath = `/players/${player.id}`;
  const cardBackgroundUrl = getPlayerCardBackgroundUrl(player);
  const cardBackgroundPosition = player.player_card_background_position || "50% 50%";
  const savedCardBackgroundZoom = Number(player.player_card_background_zoom);
  const cardBackgroundZoom = Number.isFinite(savedCardBackgroundZoom) && savedCardBackgroundZoom > 0
    ? savedCardBackgroundZoom
    : 120;
  const canChangeOwnBackground = String(_myPlayer?.id || "") === String(player.id || "");
  const canUseCardBackgrounds = hasStagePlus(player.subscription || _myPlayer?.subscription);
  const clubAverageRating = formatRating(clubStats?.avgRating);
  const clubGoals = Number(clubStats?.goals || 0);
  const clubAssists = Number(clubStats?.assists || 0);
  const clubMatches = Number(clubStats?.matches || 0);
  const initials = String(player.gamertag || player.email || "?").slice(0, 2).toUpperCase();
  const menuItemClass = "cursor-pointer text-xs font-semibold";
  const dangerItemClass = "cursor-pointer text-xs font-semibold text-red-300 focus:bg-red-500/10 focus:text-red-200";
  const stopCardClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const openProfile = () => navigate(profilePath);

  useEffect(() => {
    if (!backgroundOpen || !canUseCardBackgrounds) return;
    let cancelled = false;
    setBackgroundLoading(true);
    stageClient.entities.PlayerCardBackground
      .filter({}, "sort_order", 100)
      .then((rows) => {
        if (!cancelled) setBackgrounds(asObjectArray(rows));
      })
      .catch(() => {
        if (!cancelled) setBackgrounds([]);
      })
      .finally(() => {
        if (!cancelled) setBackgroundLoading(false);
      });
    return () => { cancelled = true; };
  }, [backgroundOpen, canUseCardBackgrounds]);

  useEffect(() => {
    if (!customBackgroundFile) {
      setCustomBackgroundPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(customBackgroundFile);
    setCustomBackgroundPreview(url);
    setCustomBackgroundX(50);
    setCustomBackgroundY(50);
    setCustomBackgroundZoom(120);
    return () => URL.revokeObjectURL(url);
  }, [customBackgroundFile]);

  function onCardKeyDown(event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openProfile();
  }

  function handleMenuSelect(event, callback) {
    event.preventDefault();
    event.stopPropagation();
    callback?.();
  }

  async function saveCardBackground(payload, busyKey) {
    if (!canChangeOwnBackground) return;
    setBackgroundSaving(busyKey);
    setBackgroundError("");
    try {
      const updated = await stageClient.http.patch(`/players/${encodeURIComponent(player.id)}/card-background`, payload);
      onCardBackgroundChanged?.({
        ...updated,
        player_card_background_type: payload.type || updated.player_card_background_type || "default",
        player_card_background_id: payload.type === "official" ? payload.background_id : null,
        player_card_background_position: payload.position || updated.player_card_background_position || "50% 50%",
        player_card_background_zoom: payload.zoom || updated.player_card_background_zoom || 120,
      });
      setCustomBackgroundFile(null);
      setCustomBackgroundPreview("");
      setBackgroundOpen(false);
    } catch (err) {
      setBackgroundError(err?.message || "Could not update player card background.");
    } finally {
      setBackgroundSaving(null);
    }
  }

  async function uploadCustomBackground() {
    if (!customBackgroundFile) {
      setBackgroundError("Choose an image first.");
      return;
    }
    setBackgroundSaving("custom");
    setBackgroundError("");
    try {
      const uploaded = await stageClient.integrations.Core.UploadFile({ file: customBackgroundFile });
      const payload = {
        type: "custom",
        image_url: uploaded.file_url,
        position: `${customBackgroundX}% ${customBackgroundY}%`,
        zoom: customBackgroundZoom,
      };
      const updated = await stageClient.http.patch(`/players/${encodeURIComponent(player.id)}/card-background`, payload);
      onCardBackgroundChanged?.({
        ...updated,
        player_card_background_type: "custom",
        player_card_background_id: null,
        player_card_background_url: uploaded.file_url,
        player_card_background_position: payload.position,
        player_card_background_zoom: payload.zoom,
      });
      setCustomBackgroundFile(null);
      setCustomBackgroundPreview("");
      setBackgroundOpen(false);
    } catch (err) {
      setBackgroundError(err?.message || "Could not upload player card background.");
    } finally {
      setBackgroundSaving(null);
    }
  }

  if (!player?.id) return null;

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={openProfile}
        onKeyDown={onCardKeyDown}
        className="group relative min-h-[248px] cursor-pointer overflow-hidden border border-white/10 bg-[#071018] px-4 py-3 text-left shadow-[0_18px_45px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-0.5 hover:border-[#f5c542]/45 hover:shadow-[0_22px_60px_rgba(245,197,66,0.12)] focus:outline-none focus:ring-2 focus:ring-[#f5c542]/50 sm:px-5"
        style={{ clipPath: "polygon(7% 0, 100% 0, 93% 100%, 0 100%)" }}
      >
        {cardBackgroundUrl ? (
          <div
            aria-hidden
            className="absolute inset-0 bg-no-repeat opacity-55 transition-opacity group-hover:opacity-65"
            style={{
              backgroundImage: `url(${cardBackgroundUrl})`,
              backgroundPosition: cardBackgroundPosition,
              backgroundSize: `${cardBackgroundZoom}%`,
            }}
          />
        ) : null}
        {cardBackgroundUrl ? <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/55 to-black/75" /> : null}
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            background: [
              "linear-gradient(145deg, rgba(245,197,66,0.18), transparent 34%)",
              "radial-gradient(circle at 78% 0%, rgba(0,229,255,0.18), transparent 28%)",
              "linear-gradient(180deg, rgba(255,255,255,0.04), transparent 52%)",
            ].join(", "),
          }}
        />
        <div
          aria-hidden
          className="absolute inset-[1px] border border-[#f5c542]/10 opacity-70"
          style={{ clipPath: "polygon(7% 0, 100% 0, 93% 100%, 0 100%)" }}
        />
        <div className="relative z-[1] flex items-start justify-between gap-2 pl-1 pr-2 sm:pl-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div
              className="relative h-[58px] w-[58px] shrink-0 overflow-hidden border border-[#f5c542]/35 bg-black/35 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
              style={{ clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)" }}
            >
              {player.avatar_url ? (
                <img
                  src={player.avatar_url}
                  alt={player.gamertag}
                  className="h-full w-full object-cover"
                  style={{ objectPosition: player.avatar_position || "50% 50%" }}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#101827] font-heading text-base font-black text-[#f5c542]">
                  {initials}
                </div>
              )}
              <div className="absolute bottom-1 right-1 bg-black/75 px-1 py-0.5 text-[8px] font-black text-[#f5c542]">
                {player.position || "--"}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-[17px] font-black uppercase leading-tight text-white">
                {player.gamertag || "Player"}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <StatusPill className={rolePillClass(primaryRole)}>
                  {isPresidentRole ? <Shield className="h-2.5 w-2.5" /> : null}
                  {roleLabel}
                </StatusPill>
                {player.loan_badge === "LOAN" ? (
                  <StatusPill className="border-amber-300/35 bg-amber-400/10 text-amber-200">Loan</StatusPill>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-start gap-1">
            <div
              className="min-w-10 border border-[#f5c542]/35 bg-black/45 px-1.5 py-1 text-center"
              style={{ clipPath: "polygon(16% 0, 100% 0, 84% 100%, 0 100%)" }}
            >
              <p className="font-heading text-lg font-black leading-none text-[#f5c542]">{player.overall_rating || "--"}</p>
              <p className="mt-0.5 text-[8px] font-black uppercase tracking-[0.14em] text-white/45">OVR</p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={stopCardClick}
                  className="flex h-7 w-7 items-center justify-center border border-white/10 bg-black/35 text-white/70 transition-colors hover:border-[#f5c542]/35 hover:text-[#f5c542]"
                  style={{ clipPath: "polygon(18% 0, 100% 0, 82% 100%, 0 100%)" }}
                  aria-label="Player actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(event) => event.stopPropagation()}
                className="border-white/10 bg-[#071018] text-white"
              >
                <DropdownMenuItem className={menuItemClass} onSelect={(event) => handleMenuSelect(event, openProfile)}>
                  <Eye className="h-4 w-4" /> View profile
                </DropdownMenuItem>
                {canViewStats ? (
                  <DropdownMenuItem className={menuItemClass} onSelect={(event) => handleMenuSelect(event, () => setStatsOpen(true))}>
                    <BarChart3 className="h-4 w-4" /> View club stats
                  </DropdownMenuItem>
                ) : null}
                {canChangeOwnBackground ? (
                  <DropdownMenuItem className={menuItemClass} onSelect={(event) => handleMenuSelect(event, () => setBackgroundOpen(true))}>
                    {canUseCardBackgrounds ? <ImageIcon className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    Change background
                  </DropdownMenuItem>
                ) : null}
                {canManageRoles ? (
                  <>
                    <DropdownMenuItem className={menuItemClass} onSelect={(event) => handleMenuSelect(event, () => setContractOpen(true))}>
                      <FileText className="h-4 w-4" /> View contract
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/10" />
                    {canMakeCaptain ? (
                      <DropdownMenuItem className={menuItemClass} onSelect={(event) => handleMenuSelect(event, () => onAssignRole?.(player, "captain"))}>
                        <UserCheck className="h-4 w-4" /> Make captain
                      </DropdownMenuItem>
                    ) : null}
                    {canMakeViceCaptain ? (
                      <DropdownMenuItem className={menuItemClass} onSelect={(event) => handleMenuSelect(event, () => onAssignRole?.(player, "vice-captain"))}>
                        <UserCheck className="h-4 w-4" /> Make vice-captain
                      </DropdownMenuItem>
                    ) : null}
                  </>
                ) : null}
                {canReleaseOrRemove ? (
                  <>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem className={dangerItemClass} disabled={!activeContract && contractSummary.key !== "none"} onSelect={(event) => handleMenuSelect(event, () => onRelease?.(player, activeContract))}>
                      <UserMinus className="h-4 w-4" /> Release player
                    </DropdownMenuItem>
                    {canRemoveRole ? (
                      <DropdownMenuItem className={dangerItemClass} onSelect={(event) => handleMenuSelect(event, () => onRemoveRole?.(player))}>
                        <BadgeX className="h-4 w-4" /> Remove role
                      </DropdownMenuItem>
                    ) : null}
                  </>
                ) : null}
                {(canExerciseOption || canRecallLoan || canRequestReturn || canRespondToReturn || purchaseAwaitingPlayer) ? (
                  <>
                    <DropdownMenuSeparator className="bg-white/10" />
                    {canExerciseOption ? (
                      <DropdownMenuItem className={menuItemClass} onSelect={(event) => handleMenuSelect(event, onExerciseOption)}>
                        <FileText className="h-4 w-4" /> {t("commonPages.exerciseOption") || "Exercise option to buy"}
                      </DropdownMenuItem>
                    ) : null}
                    {canRecallLoan ? (
                      <DropdownMenuItem className={menuItemClass} onSelect={(event) => handleMenuSelect(event, onRecallLoan)}>
                        <UserMinus className="h-4 w-4" /> {t("commonPages.recallPlayer") || "Recall"}
                      </DropdownMenuItem>
                    ) : null}
                    {canRequestReturn ? (
                      <DropdownMenuItem className={menuItemClass} onSelect={(event) => handleMenuSelect(event, onRequestReturn)}>
                        <UserMinus className="h-4 w-4" /> {t("commonPages.requestReturn") || "Request return"}
                      </DropdownMenuItem>
                    ) : null}
                    {canRespondToReturn ? (
                      <>
                        <DropdownMenuItem className={menuItemClass} onSelect={(event) => handleMenuSelect(event, onAcceptReturn)}>
                          <Check className="h-4 w-4" /> {t("commonPages.acceptReturn") || "Accept return"}
                        </DropdownMenuItem>
                        <DropdownMenuItem className={menuItemClass} onSelect={(event) => handleMenuSelect(event, onRejectReturn)}>
                          <X className="h-4 w-4" /> {t("commonPages.rejectReturn") || "Reject"}
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="relative z-[1] mt-2.5 grid grid-cols-2 gap-1.5 pl-1 pr-2 sm:pl-2">
          <InfoTile icon={Footprints} label="Primary" value={player.position || "--"} />
          <InfoTile icon={Target} label="Secondary" value={player.secondary_position || "--"} />
        </div>

        <div className="relative z-[1] mt-2 grid gap-1.5 pl-1 pr-2 sm:pl-2">
          <StatusRow label="Contract" summary={contractSummary} />
          <StatusRow label="Next match" summary={availabilitySummary} />
          <NationalityRow player={player} />
        </div>

        <div
          className="relative z-[1] mt-2.5 grid grid-cols-4 overflow-hidden border border-white/10 bg-black/25"
          style={{ clipPath: "polygon(4% 0, 100% 0, 96% 100%, 0 100%)" }}
        >
          <StatCell label="AVG" value={clubAverageRating} />
          <StatCell label="G" value={clubGoals} />
          <StatCell label="A" value={clubAssists} />
          <StatCell label="MP" value={clubMatches} />
        </div>

        {player.loan_status === "loaned_out" ? (
          <p className="relative z-[1] mt-3 truncate text-[10px] text-white/45">
            {t("commonPages.onLoanAt") || "On loan at"} {player.on_loan_club_name || player.on_loan_club_id}
            {player.loan_end_date ? ` · ${player.loan_end_date}` : ""}
          </p>
        ) : null}
        {purchaseAwaitingPlayer ? (
          <p className="relative z-[1] mt-3 text-[10px] uppercase tracking-[0.16em] text-emerald-200/70">
            {t("commonPages.purchaseAwaitingPlayer") || "Awaiting player response"}
          </p>
        ) : null}
      </article>

      <Dialog open={statsOpen} onOpenChange={setStatsOpen}>
        <DialogContent className="max-w-sm border-white/10 bg-[#071018] text-white">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm font-black uppercase tracking-[0.18em] text-[#f5c542]">
              Club stats
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <InfoTile icon={Activity} label="Avg rating" value={clubAverageRating} />
            <InfoTile icon={Target} label="Goals" value={clubGoals} />
            <InfoTile icon={Footprints} label="Assists" value={clubAssists} />
            <InfoTile icon={ClipboardList} label="Matches" value={clubMatches} />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={backgroundOpen} onOpenChange={setBackgroundOpen}>
        <DialogContent
          className="max-h-[82vh] max-w-lg overflow-y-auto border-white/10 bg-[#071018] p-4 text-white sm:p-5"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading text-xs font-black uppercase tracking-[0.18em] text-[#f5c542]">
              <ImageIcon className="h-3.5 w-3.5" /> Change card background
            </DialogTitle>
          </DialogHeader>
          {!canUseCardBackgrounds ? (
            <div className="rounded-lg border border-[#f5c542]/25 bg-[#f5c542]/10 p-4">
              <div className="mb-3 flex items-start gap-3">
                <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#f5c542]" />
                <div>
                  <p className="font-heading text-base font-black uppercase text-white">STAGE Plus feature</p>
                  <p className="mt-1 text-sm text-white/60">
                    Custom player card backgrounds, personal uploads, and exclusive official designs are included with STAGE Plus.
                  </p>
                </div>
              </div>
              <Link to="/store" onClick={(event) => event.stopPropagation()}>
                <Button type="button" className="gap-2 bg-[#f5c542] font-black text-black hover:bg-[#f7d46a]">
                  <Sparkles className="h-4 w-4" /> View STAGE Plus
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {backgroundError ? (
                <div className="rounded-md border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {backgroundError}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] p-2.5">
                <div>
                  <p className="font-heading text-xs font-black uppercase text-white">Current card</p>
                  <p className="text-xs text-white/45">Images render under a dark game-card overlay for readability.</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={Boolean(backgroundSaving)}
                  onClick={() => saveCardBackground({ type: "default" }, "default")}
                  className="h-8 gap-1.5 border-white/15 bg-black/20 text-xs text-white hover:bg-white/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </Button>
              </div>

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Official Stage+ designs</p>
                {backgroundLoading ? (
                  <div className="flex items-center justify-center rounded-lg border border-white/10 py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-[#f5c542]" />
                  </div>
                ) : backgrounds.length ? (
                  <div className="grid max-h-52 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
                    {backgrounds.map((bg) => {
                      const selected = player.player_card_background_type === "official" && player.player_card_background_id === bg.id;
          return (
                        <button
                          key={bg.id}
                          type="button"
                          disabled={Boolean(backgroundSaving)}
                          onClick={() => saveCardBackground({ type: "official", background_id: bg.id }, bg.id)}
                          className={cn(
                            "overflow-hidden rounded-md border bg-black/30 text-left transition hover:border-[#f5c542]/50",
                            selected ? "border-[#f5c542]/70" : "border-white/10",
                          )}
                        >
                          <div className="aspect-[16/9] bg-black">
                            <img src={bg.image_url} alt={bg.name} className="h-full w-full object-cover" />
              </div>
                          <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                            <span className="truncate text-[11px] font-bold text-white">{bg.name}</span>
                            {backgroundSaving === bg.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#f5c542]" /> : null}
                          </div>
            </button>
          );
        })}
      </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-white/10 py-8 text-center text-sm text-white/40">
                    No official backgrounds are available yet.
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/45">Upload your own</p>
                <div className="flex flex-col gap-3">
                  {customBackgroundPreview ? (
                    <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                      <div
                        className="relative h-[116px] cursor-grab overflow-hidden border border-[#f5c542]/35 bg-black active:cursor-grabbing"
                        style={{ clipPath: "polygon(7% 0, 100% 0, 93% 100%, 0 100%)" }}
                      >
                        <div
                          aria-hidden
                          className="absolute inset-0 bg-no-repeat"
                          style={{
                            backgroundImage: `url(${customBackgroundPreview})`,
                            backgroundPosition: `${customBackgroundX}% ${customBackgroundY}%`,
                            backgroundSize: `${customBackgroundZoom}%`,
                          }}
                        />
                        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/45 to-black/70" />
                        <div className="relative z-[1] flex h-full flex-col justify-between p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-heading text-sm font-black uppercase text-white">{player.gamertag || "Player"}</p>
                              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#f5c542]">{player.position || "--"}</p>
                            </div>
                            <p className="font-heading text-lg font-black text-[#f5c542]">{player.overall_rating || "--"}</p>
                          </div>
                          <p className="text-[9px] uppercase tracking-[0.16em] text-white/45">Card frame preview</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <BackgroundSlider label="Zoom" value={customBackgroundZoom} min={100} max={260} onChange={setCustomBackgroundZoom} />
                        <BackgroundSlider label="Horizontal" value={customBackgroundX} min={0} max={100} onChange={setCustomBackgroundX} />
                        <BackgroundSlider label="Vertical" value={customBackgroundY} min={0} max={100} onChange={setCustomBackgroundY} />
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="flex min-h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-[#f5c542]/35 bg-[#f5c542]/10 px-3 py-2 text-xs font-bold text-[#f5c542]">
                    <Upload className="h-4 w-4" />
                    <span className="truncate">{customBackgroundFile ? customBackgroundFile.name : "Choose image"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) => setCustomBackgroundFile(event.target.files?.[0] || null)}
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!customBackgroundFile || Boolean(backgroundSaving)}
                    onClick={uploadCustomBackground}
                    className="h-10 gap-2 bg-[#f5c542] font-black text-black hover:bg-[#f7d46a]"
                  >
                    {backgroundSaving === "custom" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Save
                  </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={contractOpen} onOpenChange={setContractOpen}>
        <DialogContent className="max-w-sm border-white/10 bg-[#071018] text-white">
          <DialogHeader>
            <DialogTitle className="font-heading text-sm font-black uppercase tracking-[0.18em] text-[#f5c542]">
              Contract
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <StatusRow label="Status" summary={contractSummary} />
            {activeContract?.end_date ? (
              <p className="text-xs text-white/55">Ends {activeContract.end_date}</p>
            ) : (
              <p className="text-xs text-white/45">No financial terms are shown on squad cards.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
