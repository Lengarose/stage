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
import { formatSTC } from "@/lib/playerValue";
import { postContractNews } from "@/lib/notify";
import PlayerTrophyCabinet from "@/components/profile/PlayerTrophyCabinet";
import PlayerAchievementsSection from "@/components/rewards/PlayerAchievementsSection";
import PlayerLifestyleTab from "@/components/lifestyle/PlayerLifestyleTab";
import PlayerShowcase from "@/components/scouting/PlayerShowcase";
import GamerProfileHero from "@/components/profile/gamer/GamerProfileHero";
import { GamerProfileShell, GamerSectionCard, GamerTabNav } from "@/components/profile/gamer/GamerProfileUI";
import PlayerCareerSummary from "@/components/profile/PlayerCareerSummary";
import PlayerTransferHistory from "@/components/profile/PlayerTransferHistory";
import { CONTRACT_TYPES, getContractProgress } from "@/lib/contractTypes";
import OfferContractDialog from "@/components/contracts/OfferContractDialog";
import RequestLoanDialog from "@/components/transfer/RequestLoanDialog";
import TransferPaymentDialog from "@/components/contracts/TransferPaymentDialog";
import { ensureContractOfferInbox } from "@/lib/contractOfferDelivery";
import { canShowContractOfferButton, canShowLoanRequestButton, getSignedClubIdForPlayer } from "@/lib/contractOfferVisibility";
import { getPlayingClubId } from "@/lib/playerLoanDisplay";
import { getContractType, normalizePlayerContracts } from "@/lib/playerContractFields";
import { getClubPresidentContactEmail } from "@/lib/clubPresidentAccess";
import { canCreateContractOffer } from "@/lib/transferWindowAccess";
import { useTransferWindowStatus } from "@/lib/useTransferWindowStatus";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/AuthContext";
import { asObject, asObjectArray } from "@/lib/safeData";
import { getPlayerManagementBadges, getVisibleFootballRole } from "@/lib/playerProfileStatus";
import { getPlayerProfileTabs } from "@/lib/playerProfileTabs";

function formatPositions(player) {
  return [player?.position, player?.secondary_position].filter(Boolean).join(" / ");
}

export default function PlayerProfile({ overridePlayerId, tournamentId = null, editMode: _editMode } = {}) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const { windowOpen } = useTransferWindowStatus();
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
  const [presidedClub, setPresidedClub] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("posts");
  const [loading, setLoading] = useState(true);
  const [myPlayer, setMyPlayer] = useState(null);
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const [, setPvpMatches] = useState([]);
  const [, setClubStats] = useState(null);
  const [career, setCareer] = useState(null);
  const [careerLoading, setCareerLoading] = useState(false);
  const [avatarLightboxOpen, setAvatarLightboxOpen] = useState(false);
  // Contract & transfer state
  const [activeContract, setActiveContract] = useState(null);
  const [playerContracts, setPlayerContracts] = useState([]);
  const [viewerClub, setViewerClub] = useState(null);
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [loanDialogOpen, setLoanDialogOpen] = useState(false);
  const [activeLoan, setActiveLoan] = useState(null);
  const [ownerClub, setOwnerClub] = useState(null);
  const [transferPayOpen, setTransferPayOpen] = useState(false);
  const navigate = useNavigate();
  const visibleClubRole = getVisibleFootballRole(player);

  useEffect(() => {
    async function load() {
      if (!id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const user = await stageClient.auth.me().catch(() => null);
        setCurrentUser(user);

        const playerResult = await stageClient.entities.Player.get(id).catch(() => null);
        const p = asObject(playerResult);

        const resolved = await resolveMyPlayerAndClub().catch(() => ({}));
        const myPl = asObject(resolved?.player);
        const myClubResolved = asObject(resolved?.presidentClub || resolved?.club);
        if (myPl) setMyPlayer(myPl);

        const acctMode = localStorage.getItem("stage-account-mode") || "player";
        if (acctMode === "club" && myClubResolved) {
          setViewerClub(myClubResolved);
        }

        if (p?.id) {
          setPlayer(p);
          setCareerLoading(true);
          stageClient.http.get(`/player-careers/${p.id}`)
            .then(setCareer)
            .catch(() => setCareer(null))
            .finally(() => setCareerLoading(false));
          const contractArr = await stageClient.entities.PlayerContract.filter({ user_id: p.id }).catch(() => []);
          const safeContracts = normalizePlayerContracts(contractArr);
          const LIVE = ["active", "pending", "pending_window", "negotiating"];
          const liveContracts = safeContracts.filter(c => LIVE.includes(c.status));
          const signedClubId = getSignedClubIdForPlayer(p, safeContracts);
          const loanRows = await stageClient.entities.PlayerLoan.filter({ player_id: p.id, status: "ACTIVE" }).catch(() => []);
          const liveLoan = (Array.isArray(loanRows) ? loanRows : []).find((row) => String(row.status || "").toUpperCase() === "ACTIVE") || null;
          setActiveLoan(liveLoan);
          const playingClubId = getPlayingClubId(p, liveLoan ? [liveLoan] : []) || signedClubId;
          setPlayerContracts(liveContracts);
          setActiveContract(safeContracts.find(c => c.status === "active") || null);
          const presidentClubRows = await stageClient.entities.Club
            .filter({ president_player_id: p.id }, null, 1)
            .catch(() => []);
          const presidentClub = asObject(asObjectArray(presidentClubRows)[0]);
          setPresidedClub(presidentClub);

          if (playingClubId) {
            const [clubsRaw, ownerRaw, tmHomeRaw, tmAwayRaw] = await Promise.all([
              stageClient.entities.Club.get(playingClubId)
                .then((clubRecord) => clubRecord ? [clubRecord] : [])
                .catch(() => stageClient.entities.Club.filter({ id: playingClubId }).catch(() => [])),
              liveLoan?.parent_club_id
                ? stageClient.entities.Club.get(liveLoan.parent_club_id).catch(() => null)
                : Promise.resolve(null),
              stageClient.profileMatches.list({ home_club_id: playingClubId, status: "scheduled" }, "round", 20).catch(() => []),
              stageClient.profileMatches.list({ away_club_id: playingClubId, status: "scheduled" }, "round", 20).catch(() => []),
            ]);
            const clubs = asObjectArray(clubsRaw);
            if (clubs.length > 0) setClub(clubs[0]);
            setOwnerClub(asObject(ownerRaw));
            setUpcomingMatches(asObjectArray([...asObjectArray(tmHomeRaw), ...asObjectArray(tmAwayRaw)]));
          } else {
            setClub(presidentClub);
            setUpcomingMatches([]);
          }

          const matchStats = asObjectArray(
            p.email
              ? await stageClient.entities.MatchPlayerStat.filter({ player_email: p.email }).catch(() => [])
              : []
          );
          const matchIds = [...new Set(matchStats.map((stat) => stat.match_id).filter(Boolean))];
          let filteredStats = matchStats;
          if (matchIds.length > 0) {
            const matchRecords = await Promise.all(
              matchIds.slice(0, 50).map((matchId) => (
                stageClient.profileMatches.list({ id: matchId }, null, 1).catch(() => [])
              ))
            );
            const friendlyMatchIds = new Set(
              asObjectArray(matchRecords.flat()).filter((match) => match.type === "friendly").map((match) => match.id)
            );
            filteredStats = matchStats.filter((stat) => !friendlyMatchIds.has(stat.match_id));
          }
          const totalGoals = filteredStats.reduce((sum, row) => sum + (Number(row.goals) || 0), 0);
          const totalAssists = filteredStats.reduce((sum, row) => sum + (Number(row.assists) || 0), 0);
          const ratings = filteredStats.map((row) => Number(row.rating) || 0).filter((rating) => rating > 0);
          const avgRating = ratings.length > 0 ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
          setClubStats({ matches: filteredStats.length, goals: totalGoals, assists: totalAssists, avgRating });

          const [pvpHomeRaw, pvpAwayRaw] = await Promise.all([
            stageClient.profileMatches.list({ home_player_id: p.id, status: "completed" }, "-updated_date", 50).catch(() => []),
            stageClient.profileMatches.list({ away_player_id: p.id, status: "completed" }, "-updated_date", 50).catch(() => []),
          ]);
          const allPvp = asObjectArray([...asObjectArray(pvpHomeRaw), ...asObjectArray(pvpAwayRaw)])
            .filter(m => m.mode === "solo" || (!m.mode && m.home_player_id));
          const pvpMap = new Map();
          allPvp.forEach(m => { if (m.id) pvpMap.set(m.id, m); });
          setPvpMatches([...pvpMap.values()].sort((a, b) => new Date(b.updated_date || 0) - new Date(a.updated_date || 0)));

        } else {
          setPlayer(null);
          setPlayerContracts([]);
          setActiveContract(null);
          setClub(null);
          setPresidedClub(null);
          setUpcomingMatches([]);
          setPvpMatches([]);
          setClubStats(null);
          setCareer(null);
          setCareerLoading(false);
        }
      } catch (err) {
        console.error("PlayerProfile load failed:", err);
        setPlayer(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleOfferContract(terms) {
    if (!viewerClub?.id || !player?.id) return;
    if (!canCreateContractOffer(windowOpen)) return;
    const typeMeta = CONTRACT_TYPES[terms.contract_type] || CONTRACT_TYPES.squad;
    let recipientEmail = player.email;
    if (!recipientEmail) {
      try { const f = await stageClient.entities.Player.get(player.id); recipientEmail = f?.email || null; } catch { }
    }
    const result = await stageClient.functions.invoke("contractManagement", {
      action: "offer",
      team_id: viewerClub.id,
      target_player_id: player.id,
      contract_type: terms.contract_type, offer_note: terms.offer_note || "",
      max_games: typeMeta.max_games, max_days: typeMeta.max_days,
      weekly_salary_stc:   terms.weekly_salary_stc   || 0,
      signing_bonus_stc:   terms.signing_bonus_stc   || 0,
      transfer_fee_stc:    0,
      performance_targets: terms.performance_targets || [],
      captaincy_offered:   terms.captaincy_offered   || false,
      status: "pending",
    });
    const newContract = result?.data?.contract || result?.contract || null;
    const contractId = newContract?.id || result?.data?.contract_id || result?.contract_id;
    if (contractId) {
      await ensureContractOfferInbox({
        contractId,
        player: { ...player, email: recipientEmail || player.email },
        club: viewerClub,
        contractType: terms.contract_type,
        maxGames: typeMeta.max_games,
        maxDays: typeMeta.max_days,
        weeklySalary: terms.weekly_salary_stc,
        signingBonus: terms.signing_bonus_stc,
        offerNote: terms.offer_note,
        senderEmail: getClubPresidentContactEmail({ club: viewerClub }),
      }).catch((err) => console.warn("[PlayerProfile] inbox fallback failed:", err?.message || err));
    }
    postContractNews({
      title: `📄 ${viewerClub.name} offered a contract to ${player.gamertag}`,
      body: `${viewerClub.name} sent a ${terms.contract_type} contract offer to ${player.gamertag}.`,
      club_name: viewerClub.name, club_logo_url: viewerClub.logo_url || "",
      player_name: player.gamertag, player_avatar_url: player.avatar_url || "",
      link: `/players/${player.id}`,
    });
    setOfferDialogOpen(false);
    if (newContract) {
      setPlayerContracts(prev => normalizePlayerContracts([...prev, newContract]));
    } else {
      const refreshed = await stageClient.entities.PlayerContract.filter({ user_id: player.id }).catch(() => []);
      setPlayerContracts(normalizePlayerContracts(refreshed));
    }
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

  // The showcase is editable only by the player it belongs to. Matched on player
  // id rather than user id so an account holding several player rows still only
  // edits the profile actually being viewed.
  const isOwnProfile = Boolean(player?.id && myPlayer?.id && String(player.id) === String(myPlayer.id));

  const profileTabs = getPlayerProfileTabs({ context: "public", tournamentLimited: Boolean(limitedTournamentId), t });

  const roleBadges = visibleClubRole ? [visibleClubRole] : [];
  const managementClub = presidedClub || (club?.president_player_id === player?.id ? club : null);
  const managementBadges = getPlayerManagementBadges({ player, club: managementClub, contracts: playerContracts });
  const signedClubIdForProfile = getSignedClubIdForPlayer(player, playerContracts);
  const canOfferProfileContract = canCreateContractOffer(windowOpen) && canShowContractOfferButton({
    player,
    viewerClub,
    playerContracts,
    limitedTournamentId,
  });
  const canRequestProfileLoan = canShowLoanRequestButton({
    player,
    viewerClub,
    playerContracts,
    loans: activeLoan ? [activeLoan] : [],
    limitedTournamentId,
  });

  return (
    <GamerProfileShell>
      <GamerProfileHero
        player={player}
        user={null}
        club={club}
        roleBadges={roleBadges}
        managementBadges={managementBadges}
        formatPositions={formatPositions}
        onAvatarClick={player.avatar_url ? () => setAvatarLightboxOpen(true) : undefined}
        topLeftActions={(
          <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-white/75 backdrop-blur-md hover:bg-black/60 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> {t("commonPages.profBack")}
          </button>
        )}
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
                {viewerClub && !limitedTournamentId ? (
                  <>
                    {canOfferProfileContract ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setOfferDialogOpen(true)}
                        className="gap-1.5 h-9 px-3 text-xs border-cyan-400/30 text-cyan-300 hover:bg-cyan-500/10 bg-transparent font-heading uppercase"
                      >
                        <FileText className="w-3.5 h-3.5" /> {t("commonPages.offerContract")}
                      </Button>
                    ) : null}
                    {canRequestProfileLoan ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setLoanDialogOpen(true)}
                        className="gap-1.5 h-9 px-3 text-xs border-amber-400/30 text-amber-300 hover:bg-amber-500/10 bg-transparent font-heading uppercase"
                      >
                        <FileText className="w-3.5 h-3.5" /> {t("commonPages.requestLoan") || "Request Loan"}
                      </Button>
                    ) : null}
                    {windowOpen === true && signedClubIdForProfile && signedClubIdForProfile !== viewerClub.id && club ? (
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
      >
        {activeLoan ? (
          <p className="text-xs text-amber-200/80">
            {t("commonPages.onLoanFrom") || "On loan from"} {ownerClub?.name || activeLoan.parent_club_name || "parent club"}
            {activeLoan.end_date ? ` ${t("commonPages.until") || "until"} ${activeLoan.end_date}` : ""}
          </p>
        ) : null}
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
                <FileText className="w-2.5 h-2.5" />{getContractType(activeContract)} contract
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

        {activeTab === "career" ? (
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
            <PlayerCareerSummary career={career} loading={careerLoading} />
            <PlayerTransferHistory playerId={player?.id} />
          </div>
        ) : null}

        {activeTab === "trophies" ? (
          <div className="pt-2 space-y-6">
            <PlayerAchievementsSection playerId={player?.id} />
            <PlayerTrophyCabinet player={player} currentUserEmail={currentUser?.email} />
          </div>
        ) : null}

        {activeTab === "showcase" ? (
          <div className="pt-2">
            <GamerSectionCard shape="rounded">
              {/* Editable only on your own profile. The server checks the same
                  thing independently — this just decides which UI to show. */}
              <PlayerShowcase player={player} canEdit={isOwnProfile} />
            </GamerSectionCard>
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
      <RequestLoanDialog
        open={loanDialogOpen}
        onClose={() => setLoanDialogOpen(false)}
        player={player}
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
    </GamerProfileShell>
  );
}
