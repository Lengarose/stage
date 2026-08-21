import { useState, useEffect, useRef, useId } from "react";
import TournamentResultDialog from "../components/TournamentResultDialog";
import { useParams, Link, useNavigate } from "react-router-dom";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import {
  advanceTournamentRound,
  cancelTournamentById,
  clearTournamentDraw,
  deleteTournamentById,
  fetchTournamentPublic,
  fetchTournamentMatches,
  generateTournamentDraw,
  initializeTournamentDraw,
  officializeTournament,
  registerTournamentClub,
  registerTournamentPlayer,
  simulateTournamentScore,
  withdrawTournamentClub,
} from "@/api/tournamentActions";
import { Trophy, ArrowLeft, Users, Calendar, Shield, Check, Play, AlertTriangle, Flag, BookOpen, Download, Coins, ExternalLink, Image as ImageIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  calculateGroupStandings,
} from "../lib/tournamentEngine";
import { COUNTRIES } from "../lib/countries";
import KnockoutBracket from "../components/KnockoutBracket";
import TournamentStandingsTabs from "../components/TournamentStandingsTabs";
import TournamentLeaderboard from "../components/TournamentLeaderboard";
import MatchStatsModal from "../components/MatchStatsModal";
import EditTournamentDialog from "../components/EditTournamentDialog";
import PlayerRegistrantList from "../components/PlayerRegistrantList";
import { isWallClockPast, toMysqlDateTime, toDatetimeLocalValue } from "@/lib/momentDate";
import { swalAlert, swalConfirm } from "@/lib/swal";
import { getTournamentEntryCost } from "@/lib/subscriptionUtils";
import { useTranslation } from "@/hooks/useTranslation";

export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tournament, setTournament] = useState(null);
  const [clubs, setClubs] = useState([]);
  const [allClubs, setAllClubs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
  const [myClub, setMyClub] = useState(null);
  const [user, setUser] = useState(null);
  const [_isBasic, setIsBasic] = useState(false);
  const [_tournamentEntryCost, setTournamentEntryCost] = useState(50);
  const [loading, setLoading] = useState(true);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [activeMatch, setActiveMatch] = useState(null);
  const [resultForm, setResultForm] = useState({ home_score: "", away_score: "", video_url: "", proof_url: "" });
  const [_scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleMatch, setScheduleMatch] = useState(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [statsMatch, setStatsMatch] = useState(null);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [myClubPlayers, setMyClubPlayers] = useState([]);
  const [groupStandingsData, setGroupStandingsData] = useState([]);
  const [playerStats, setPlayerStats] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeDispute, setActiveDispute] = useState(null);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeForm, setDisputeForm] = useState({ home_score: "", away_score: "", admin_notes: "" });
  const [forfeitMatch, setForfeitMatch] = useState(null);
  const [forfeitDialogOpen, setForfeitDialogOpen] = useState(false);
  const [forfeitProof, setForfeitProof] = useState("");
  const [registrationProofUrl, setRegistrationProofUrl] = useState("");
  const [uploadingRegistrationProof, setUploadingRegistrationProof] = useState(false);
  const [clubRegistrationOpen, setClubRegistrationOpen] = useState(false);
  const [eaClubName, setEaClubName] = useState("");
  const [registeringClub, setRegisteringClub] = useState(false);
  const registrationProofInputRef = useRef(null);
  const registrationProofInputId = useId();

  const parseSubmission = (raw) => {
    if (!raw) return null;
    if (typeof raw === "object") return raw;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const scoreFromSubmission = (submission) => {
    if (!submission) return null;
    if (submission.home_score == null || submission.away_score == null) return null;
    return `${submission.home_score}-${submission.away_score}`;
  };

  const proofLinksForMatch = (match) => {
    const homeSub = parseSubmission(match.home_submission);
    const awaySub = parseSubmission(match.away_submission);
    return [
      { label: t("tournamentDetail.homeProof", { name: match.home_club_name || t("tournamentDetail.home") }), url: homeSub?.proof_url, score: scoreFromSubmission(homeSub) },
      { label: t("tournamentDetail.awayProof", { name: match.away_club_name || t("tournamentDetail.away") }), url: awaySub?.proof_url, score: scoreFromSubmission(awaySub) },
      { label: t("tournamentDetail.matchProof"), url: !homeSub?.proof_url && !awaySub?.proof_url ? (match.proof_url || match.forfeit_proof_url) : null, score: null },
    ].filter(link => link.url);
  };

  const adminNoteText = (notes) => {
    if (!notes) return "";
    try {
      const parsed = typeof notes === "string" ? JSON.parse(notes) : notes;
      return parsed?.reason || parsed?.proof_verification?.reason || String(notes);
    } catch {
      return String(notes);
    }
  };

  const renderProofLinks = (match) => {
    const links = proofLinksForMatch(match);
    if (!links.length) return null;
    return (
      <div className="flex flex-wrap gap-2 mt-2">
        {links.map(link => (
          <a
            key={`${match.id}-${link.label}`}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-primary underline underline-offset-2"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            {link.label}{link.score ? ` (${link.score})` : ""}
            <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>
    );
  };

  async function uploadRegistrationProof(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      await swalAlert(t("tournamentDetail.uploadImageOnly"));
      e.target.value = "";
      return;
    }
    setUploadingRegistrationProof(true);
    try {
      const result = await stageClient.integrations.Core.UploadFile({ file });
      setRegistrationProofUrl(result?.file_url || "");
    } catch (err) {
      await swalAlert(err?.message || t("tournamentDetail.uploadFailed"));
    } finally {
      setUploadingRegistrationProof(false);
      e.target.value = "";
    }
  }

  const renderPlayerRegistrationProofUpload = () => (
    <div className="w-full sm:w-72 rounded-lg border border-white/15 bg-black/25 p-2.5 text-left">
      <input
        id={registrationProofInputId}
        ref={registrationProofInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={uploadingRegistrationProof}
        onChange={uploadRegistrationProof}
      />
      <label
        htmlFor={uploadingRegistrationProof ? undefined : registrationProofInputId}
        className="w-full inline-flex items-center justify-between gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15 cursor-pointer touch-manipulation aria-disabled:opacity-60"
      >
        <span className="inline-flex items-center gap-2">
          <Upload className="w-3.5 h-3.5" />
          {t("tournamentDetail.utPhoto")}
        </span>
        <span className="text-[10px] text-white/60">
          {uploadingRegistrationProof ? t("tournamentDetail.uploading") : registrationProofUrl ? t("tournamentDetail.ready") : t("tournamentDetail.required")}
        </span>
      </label>
      {registrationProofUrl && (
        <a href={registrationProofUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-success underline underline-offset-2">
          <ImageIcon className="w-3 h-3" /> {t("tournamentDetail.viewUploadedPhoto")}
        </a>
      )}
    </div>
  );
  const [isCreator, setIsCreator] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [streamMatch, setStreamMatch] = useState(null);
  const [streamDialogOpen, setStreamDialogOpen] = useState(false);
  const [streamUrl, setStreamUrl] = useState("");
  const [visibleRound, setVisibleRound] = useState(null);
  const [takeoverClub, setTakeoverClub] = useState(null);
  const [activeTab, setActiveTab] = useState("bracket");
  const [autoAdvancingRound, setAutoAdvancingRound] = useState(false);
  const autoAdvanceAttemptsRef = useRef(new Set());

  useEffect(() => {
    async function load() {
      try {
        const isAuthed = await stageClient.auth.isAuthenticated().catch(() => false);
        const u = isAuthed ? await stageClient.auth.me().catch(() => null) : null;
        setUser(u);

        // Each call gets its own fallback so a single failure can never block
        // the rest of the page from rendering — the spinner used to stick
        // forever when (for example) the tournament id was stale and the
        // backend returned a non-2xx the SDK didn't recover from.
        const { player: myPl, club: myResolvedClub } = isAuthed
          ? await resolveMyPlayerAndClub().catch(() => ({ player: null, club: null }))
          : { player: null, club: null };
        setMyClub(myResolvedClub || null);
        const [tData, clubData, matchData] = await Promise.all([
          fetchTournamentPublic(id).then(t => t ? [t] : []).catch(() => []),
          stageClient.entities.Club.list("-rating", 200).catch(() => []),
          fetchTournamentMatches(id).catch(() => []),
        ]);
        const t = tData[0] || null;
        setTournament(t);
        setAllClubs(clubData);
        setMatches(matchData);
        if (t) {
          setClubs(clubData.filter(c => t.registered_clubs?.includes(c.id)));
        }
        if (myPl) {
          setMyPlayer(myPl);
          if (myPl.club_id) {
            const clubPlayers = await stageClient.entities.Player.filter({ club_id: myPl.club_id }).catch(() => []);
            setMyClubPlayers(clubPlayers);
          }
        }
        if (!myPl?.club_id && myResolvedClub?.id) {
          const clubPlayers = await stageClient.entities.Player.filter({ club_id: myResolvedClub.id }).catch(() => []);
          setMyClubPlayers(clubPlayers);
        }

        setIsBasic(u?.role === "admin");
        setTournamentEntryCost(u?.role === "admin" ? 0 : getTournamentEntryCost());
        setIsAdmin(u?.role === "admin");
        setIsCreator(Boolean(u?.email && t?.creator_email === u.email));
        if (u?.role === "admin") {
          const tcId = localStorage.getItem('admin_takeover_club_id');
          if (tcId) {
            const tcArr = await stageClient.entities.Club.filter({ id: tcId }).catch(() => []);
            if (tcArr.length > 0) {
              setTakeoverClub(tcArr[0]);
              const tcPlayers = await stageClient.entities.Player.filter({ club_id: tcId }).catch(() => []);
              setMyClubPlayers(tcPlayers);
            }
          }
        }
      } catch (err) {
        console.error('[TournamentDetail.load]', err);
      } finally {
        setLoading(false);
      }
    }
    load();

    const unsubMatches = stageClient.entities.Match.subscribe((event) => {
      if (event.data?.tournament_id === id) {
        fetchTournamentMatches(id).then(setMatches);
      }
    });
    const unsubTournament = stageClient.entities.Tournament.subscribe((event) => {
      if (event.data?.id === id) {
        setTournament(prev => ({ ...(prev || {}), ...event.data }));
      }
    }, { id });

    return () => {
      unsubMatches();
      unsubTournament();
    };
  }, [id]);

  useEffect(() => {
    if (tournament?.type === "group_stage" && matches.length > 0) {
      const standings = calculateGroupStandings(matches, tournament.num_groups || 2);
      const formatted = standings.map((group, idx) => ({
        groupIndex: idx,
        groupName: String.fromCharCode(65 + idx),
        standings: group.map(club => ({
          id: club.id,
          name: club.name,
          played: club.P,
          wins: club.W,
          draws: club.D,
          losses: club.L,
          goalDiff: club.GD,
          points: club.Pts,
        })),
      }));
      setGroupStandingsData(formatted);
    }
  }, [matches, tournament?.type, tournament?.num_groups]);

  useEffect(() => {
    if (loading || !tournament || autoAdvancingRound) return;
    if (tournament.status !== "in_progress") return;

    const canManage = isAdmin || isCreator || tournament.organizer_email === user?.email;
    if (!canManage) return;

    const isFinished = (match) => ["completed", "forfeit"].includes(String(match.status || ""));
    const tournamentType = String(tournament.type || "").toLowerCase();
    const finalMatch = matches.find(match => String(match.type || "").toLowerCase() === "final");
    const thirdPlaceMatch = matches.find(match => ["third_place", "third-place", "bronze"].includes(String(match.type || "").toLowerCase()));
    const finalWinnerId = tournament.participant_type === "player" ? finalMatch?.winner_player_id : finalMatch?.winner_club_id;
    const thirdPlaceWinnerId = tournament.participant_type === "player" ? thirdPlaceMatch?.winner_player_id : thirdPlaceMatch?.winner_club_id;
    const finalComplete = finalMatch && isFinished(finalMatch) && finalWinnerId;
    const thirdPlaceComplete = !thirdPlaceMatch || (isFinished(thirdPlaceMatch) && thirdPlaceWinnerId);
    if (finalComplete && thirdPlaceComplete) return;

    const currentRound = Number(tournament.current_round || 1);
    const groupMatches = tournamentType === "group_stage"
      ? matches.filter(match => ["group", "group_stage"].includes(String(match.type || "")))
      : [];
    const knockoutMatches = tournamentType === "group_stage"
      ? matches.filter(match => !["group", "group_stage"].includes(String(match.type || "")))
      : matches;
    const groupStageComplete = tournamentType === "group_stage"
      && groupMatches.length > 0
      && groupMatches.every(isFinished);
    const currentRoundMatches = matches.filter(match => Number(match.round || 1) === currentRound);
    const currentRoundComplete = currentRoundMatches.length > 0 && currentRoundMatches.every(isFinished);
    const shouldAdvance = tournamentType === "group_stage"
      ? groupStageComplete && (knockoutMatches.length === 0 || currentRoundComplete)
      : currentRoundComplete;

    if (!shouldAdvance) return;

    const signature = [
      tournament.id,
      currentRound,
      matches.length,
      matches.map(match => `${match.id}:${match.status}:${match.winner_club_id || match.winner_player_id || ""}`).join("|"),
    ].join(":");
    if (autoAdvanceAttemptsRef.current.has(signature)) return;
    autoAdvanceAttemptsRef.current.add(signature);

    setAutoAdvancingRound(true);
    advanceTournamentRound(tournament.id)
      .then((result) => {
        if (result.matches) setMatches(result.matches);
        if (result.tournament) setTournament(result.tournament);
        setVisibleRound(result.tournament?.current_round ?? null);
      })
      .catch((err) => {
        console.warn("[TournamentDetail.autoAdvanceRound]", err?.data?.error || err?.message || err);
      })
      .finally(() => setAutoAdvancingRound(false));
  }, [autoAdvancingRound, isAdmin, isCreator, loading, matches, tournament, user?.email]);

  async function registerClub() {
    const effectiveId = takeoverClub ? takeoverClub.id : (myClub?.id || myPlayer?.club_id);
    if (!effectiveId || !tournament) return;
    const cleanEaClubName = eaClubName.trim();
    if (!cleanEaClubName) {
      await swalAlert("Enter your EA FC Pro Clubs name so admins can verify your club.");
      return;
    }
    if (isWallClockPast(tournament.start_date)) {
      await swalAlert(t("tournamentDetail.registrationClosedPast"));
      return;
    }
    const current = tournament.registered_clubs || [];
    if (current.includes(effectiveId)) return;
    if (current.length >= tournament.max_teams) return;
    
    const entryCost = tournament.entry_credits ?? 50;
    const entryFeeSTC = tournament.entry_fee_stc ?? 0;
    const clubData = takeoverClub || allClubs.find(c => c.id === effectiveId);

    // Country restriction check
    if (tournament.country_code) {
      if (!clubData?.country_code || clubData.country_code !== tournament.country_code) {
        const countryName = COUNTRIES.find(c => c.code === tournament.country_code)?.name || tournament.country_code;
        await swalAlert(t("tournamentDetail.countryRestricted", { country: countryName }));
        return;
      }
    }

    // Check user-scoped credits (shared pot for player + club tournaments)
    if (!takeoverClub && (user?.credits ?? 0) < entryCost) {
      await swalAlert(t("tournamentDetail.notEnoughCredits"));
      return;
    }

    // Check STC
    if (entryFeeSTC > 0 && (clubData?.stc ?? 0) < entryFeeSTC) {
      await swalAlert(t("tournamentDetail.notEnoughClubStc", { need: entryFeeSTC.toLocaleString(), have: (clubData?.stc ?? 0).toLocaleString() }));
      return;
    }

    // Lock both credits and STC
    setRegisteringClub(true);
    try {
      const res = await registerTournamentClub(tournament.id, effectiveId, { eaClubName: cleanEaClubName });
      
      if (!res.data.success) {
        await swalAlert(res.data.error || t("tournamentDetail.registrationFailed"));
        return;
      }

      const { new_club_stc, new_user_credits } = res.data;
      setAllClubs(prev => prev.map(c =>
        c.id === effectiveId
          ? { ...c, stc: new_club_stc ?? c.stc }
          : c
      ));
      if (new_user_credits != null) {
        setUser((prev) => (prev ? { ...prev, credits: new_user_credits } : prev));
      }

      const refreshedTournament = await fetchTournamentPublic(tournament.id).catch(() => null);
      const updated = refreshedTournament?.registered_clubs || res.data.registered_clubs || current;
      if (refreshedTournament) {
        setTournament(refreshedTournament);
      } else {
        setTournament(prev => ({ ...prev, registered_clubs: updated }));
      }
      setClubs(allClubs.filter(c => updated.includes(c.id)));

      if (res.data.pending_review) {
        await swalAlert("Registration submitted. Admin will review the EA FC club name before your club appears in the tournament.");
      } else if (updated.length >= tournament.max_teams) {
        await swalAlert(t("tournamentDetail.tournamentFull"));
      }
      setEaClubName("");
      setClubRegistrationOpen(false);
    } catch (err) {
      await swalAlert(t("tournamentDetail.registrationFailed") + ": " + (err?.message || t("tournamentDetail.unknownError")));
    } finally {
      setRegisteringClub(false);
    }
  }

  async function registerPlayer() {
    if (!myPlayer || !tournament) return;
    if (!registrationProofUrl) {
      await swalAlert(t("tournamentDetail.uploadUtPhoto"));
      return;
    }
    const entryCost = tournament.entry_credits ?? 50;
    const entryFeeSTC = tournament.entry_fee_stc ?? 0;
    const currentCredits = user?.credits ?? 0;
    if (currentCredits < entryCost) { await swalAlert(t("tournamentDetail.notEnoughCredits")); return; }
    if (entryFeeSTC > 0 && (myPlayer.stc ?? 0) < entryFeeSTC) {
      await swalAlert(t("tournamentDetail.notEnoughStc", { amount: entryFeeSTC.toLocaleString() }));
      return;
    }
    if (isWallClockPast(tournament.start_date)) {
      await swalAlert(t("tournamentDetail.registrationClosed"));
      return;
    }
    try {
      const res = await registerTournamentPlayer(tournament.id, myPlayer.id, registrationProofUrl);
      if (!res.data.success) {
        await swalAlert(res.data.error || t("tournamentDetail.registrationFailed"));
        return;
      }
      const updated = [...(tournament.registered_players || []), myPlayer.id];
      setMyPlayer(prev => ({
        ...prev,
        stc: res.data.new_player_stc ?? prev.stc,
      }));
      if (res.data.new_user_credits != null) {
        setUser((prev) => (prev ? { ...prev, credits: res.data.new_user_credits } : prev));
      }
      setTournament(prev => ({ ...prev, registered_players: updated }));
      setRegistrationProofUrl("");
    } catch (err) {
      await swalAlert(t("tournamentDetail.registrationFailed") + ": " + (err?.message || t("tournamentDetail.unknownError")));
    }
  }

  async function generateDraw() {
    if (!tournament) return;
    if (registeredCount < 2) { await swalAlert(t("tournamentDetail.needTwoParticipants")); return; }
    try {
      const result = await generateTournamentDraw(id, tournament, registeredClubs);
      if (result.tournament) setTournament(prev => ({ ...prev, ...result.tournament }));
      setMatches(result.matches || []);
    } catch (err) {
      await swalAlert(err?.message || t("tournamentDetail.generateDrawFailed"));
    }
  }

  async function clearDraw() {
    if (!(await swalConfirm(t("tournamentDetail.clearDrawConfirm")))) return;
    await clearTournamentDraw(matches);
    setMatches([]);
  }

  async function initializeTournament(tournamentData, registeredClubs) {
    if (!(await swalConfirm(t("tournamentDetail.startOfficialConfirm")))) return;
    try {
      const result = await initializeTournamentDraw(id, tournamentData, registeredClubs);
      setTournament(prev => ({ ...prev, ...(result.tournament || result.tournamentPatch) }));
      setMatches(result.matches);
      await swalAlert(t("tournamentDetail.tournamentStartedNotify", { count: result.notified || 0 }));
    } catch (err) {
      await swalAlert(err?.message || t("tournamentDetail.generateDrawFailed"));
    }
  }

  async function _scheduleAllMatches() {
    if (!isOrganizer || !tournament) return;
    const unscheduledMatches = matches.filter(m => !m.scheduled_date);
    if (unscheduledMatches.length === 0) {
      await swalAlert(t("tournamentDetail.allMatchesScheduled"));
      return;
    }
    const baseDate = tournament.start_date ? toDatetimeLocalValue(tournament.start_date) : new Date();
    const parsedBaseDate = baseDate instanceof Date ? baseDate : new Date(baseDate);
    const shuffled = [...unscheduledMatches].sort(() => Math.random() - 0.5);
    const timeStep = 2 * 60 * 60 * 1000;
    for (let i = 0; i < shuffled.length; i++) {
      const schedDate = new Date(parsedBaseDate.getTime() + i * timeStep);
      await stageClient.entities.Match.update(shuffled[i].id, { scheduled_date: toMysqlDateTime(schedDate) });
    }
    const refreshed = await fetchTournamentMatches(id);
    setMatches(refreshed);
    await swalAlert(`Scheduled ${shuffled.length} matches starting from ${parsedBaseDate.toLocaleString()}!`);
  }

  async function _proposeSchedule() {
    if (!scheduleMatch || !scheduleDate) return;
    await stageClient.entities.Match.update(scheduleMatch.id, { scheduled_date: toMysqlDateTime(scheduleDate) });
    const refreshed = await fetchTournamentMatches(id);
    setMatches(refreshed);
    setScheduleDialogOpen(false);
    setScheduleMatch(null);
    setScheduleDate("");
  }

  async function resolveDispute(match, homeScore, awayScore) {
    const hs = parseInt(homeScore);
    const as_ = parseInt(awayScore);
    if (isNaN(hs) || isNaN(as_)) return;
    const winnerId = hs > as_ ? match.home_club_id : as_ == hs ? null: match.away_club_id;
    const winner_name = hs > as_ ? match.home_club_name: as_ == hs ? null : match.away_club_name ;
    const loserId = hs < as_ ? match.away_club_id : as_ == hs ? null  :match.home_club_id;
    const loser_name = hs < as_ ? match.away_club_name: as_ == hs ? null : match.home_club_name;
    await stageClient.entities.Match.update(match.id, {
      home_score: hs, away_score: as_, winner_club_id: winnerId,winner_club_name:winner_name, loser_club_id:loserId, loser_club_name:loser_name,
      status: "completed", admin_notes: disputeForm.admin_notes || ""
    });
    const refreshed = await fetchTournamentMatches(id);
    setMatches(refreshed);
    setDisputeDialogOpen(false);
    setActiveDispute(null);
    setDisputeForm({ home_score: "", away_score: "", admin_notes: "" });
  }

  async function submitResult() {
  if (!activeMatch) return;

  const hs = parseInt(resultForm.home_score);
  const as_ = parseInt(resultForm.away_score);
  if (isNaN(hs) || isNaN(as_)) return;

  const isHome = activeMatch.home_club_id === myPlayer?.club_id;
  const submittedScore = `${hs}-${as_}`;
  const now = new Date().toISOString();

  if (!(await validatePlayerGoals(hs, as_, isHome))) return;

  const context = buildSubmissionContext({
    hs,
    as_,
    isHome,
    submittedScore,
    now,
  });

  if (context.otherSubmitted && context.otherScore) {
    if (context.otherScore === submittedScore) {
      await handleAgreement(context);
    } else {
      await handleDispute(context);
    }
  } else {
    await handleFirstSubmission(context);
  }

  await refreshMatches();
  resetUI();
}

function GroupStageVisual({ matches, registeredClubs, numGroups }) {
  const groups = Array.from({ length: Math.max(1, Number(numGroups) || 2) }, (_, index) => ({
    index,
    name: String.fromCharCode(65 + index),
    clubs: [],
  }));
  const clubMap = Object.fromEntries(registeredClubs.map(club => [club.id, club]));

  matches
    .filter(match => match.group !== undefined && match.group !== null)
    .forEach(match => {
      const group = groups[Number(match.group)];
      if (!group) return;
      [
        { id: match.home_club_id, name: match.home_club_name },
        { id: match.away_club_id, name: match.away_club_name },
      ].forEach(team => {
        if (!team.id || group.clubs.some(club => club.id === team.id)) return;
        group.clubs.push({ ...team, ...clubMap[team.id] });
      });
    });

  if (!groups.some(group => group.clubs.length)) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-foreground">{t("commonPages.tdGroupDraw")}</p>
          <p className="text-[11px] text-muted-foreground">{t("commonPages.tdGroupDrawDesc")}</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 rounded px-2 py-1">
          {groups.length} groups
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        {groups.map(group => (
          <div key={group.name} className="rounded-xl border border-border bg-secondary/30 overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-widest text-primary">Group {group.name}</span>
              <span className="text-[10px] text-muted-foreground">{group.clubs.length} teams</span>
            </div>
            <div className="divide-y divide-border/50">
              {group.clubs.map((club, index) => (
                <div key={club.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-5 text-[10px] font-bold text-muted-foreground">{index + 1}</span>
                  <div className="w-7 h-7 rounded-lg bg-card border border-border overflow-hidden flex items-center justify-center shrink-0">
                    {club.logo_url
                      ? <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" style={{ objectPosition: club.logo_position || "50% 50%" }} />
                      : <Shield className="w-3.5 h-3.5 text-muted-foreground" />}
                  </div>
                  <span className="text-sm font-bold text-foreground truncate">{club.name}</span>
                  {club.tag && <span className="ml-auto text-[10px] text-muted-foreground font-mono">[{club.tag}]</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function validatePlayerGoals(hs, as_, isHome) {
  const myGoals = Object.values(playerStats).reduce(
    (sum, s) => sum + (s.goals || 0),
    0
  );
  const myScore = isHome ? hs : as_;

  if (myGoals > myScore) {
    await swalAlert(
      `Total goals entered (${myGoals}) exceeds your team's score (${myScore}).`
    );
    return false;
  }
  return true;
}

function buildSubmissionContext({ hs, as_, isHome, submittedScore, now }) {
  const proofData = resultForm.proof_url
    ? { proof_url: resultForm.proof_url }
    : {};
  const submissionPayload = {
    home_score: hs,
    away_score: as_,
    player_stats: [],
    goal_events: [],
    proof_url: resultForm.proof_url || null,
    submitted_at: now,
  };

  const mySubmitData = isHome
    ? { result_home_submitted: true, home_submitted_score: submittedScore, home_submission: submissionPayload, ...proofData }
    : { result_away_submitted: true, away_submitted_score: submittedScore, away_submission: submissionPayload, ...proofData };

  return {
    hs,
    as_,
    isHome,
    submittedScore,
    now,
    mySubmitData,
    otherSubmitted: isHome
      ? activeMatch.result_away_submitted
      : activeMatch.result_home_submitted,
    otherScore: isHome
      ? activeMatch.away_submitted_score
      : activeMatch.home_submitted_score,
  };
}

async function handleAgreement(ctx) {
  const { hs, as_, mySubmitData } = ctx;

    const winnerId = hs > as_ ? activeMatch.home_club_id : as_ == hs ? null: activeMatch.away_club_id;
    const winner_name = hs > as_ ? activeMatch.home_club_name: as_ == hs ? null : activeMatch.away_club_name ;
    const loserId = hs < as_ ? activeMatch.away_club_id : as_ == hs ? null  :activeMatch.home_club_id;
    const loser_name = hs < as_ ? activeMatch.away_club_name: as_ == hs ? null : activeMatch.home_club_name;

  await stageClient.entities.Match.update(activeMatch.id, {
    ...mySubmitData,
    home_score: hs,
    away_score: as_,
    winner_club_id: winnerId,
    winner_club_name:winner_name, 
    loser_club_id:loserId, 
    loser_club_name:loser_name,
    status: "completed",
    ...(resultForm.video_url && { video_url: resultForm.video_url }),
  });

  await savePlayerStats();
  // Notify both clubs that the result is confirmed
  await notifyClubs(
    [activeMatch.home_club_id, activeMatch.away_club_id],
    `✅ Result Confirmed: ${activeMatch.home_club_name} ${hs}-${as_} ${activeMatch.away_club_name}`,
    `Both sides agreed on the score. Match is now complete.`
  );
}

async function handleDispute(ctx) {
  await stageClient.entities.Match.update(activeMatch.id, {
    ...ctx.mySubmitData,
    status: "disputed",
  });

  await notifyClubs(
    [activeMatch.home_club_id, activeMatch.away_club_id],
    "⚠️ Match Score Disputed",
    `${activeMatch.home_club_name} vs ${activeMatch.away_club_name}: Scores don't match.`
  );

  await swalAlert(
    `Score disputed! You submitted ${ctx.submittedScore}, opponent submitted ${ctx.otherScore}.`
  );
}

async function handleFirstSubmission(ctx) {
  await stageClient.entities.Match.update(activeMatch.id, {
    ...ctx.mySubmitData,
    status: "awaiting_confirmation",
    first_submission_at: ctx.now,
    first_submitter_club_id: ctx.isHome
      ? activeMatch.home_club_id
      : activeMatch.away_club_id,
  });

  const opponentClubId = ctx.isHome
    ? activeMatch.away_club_id
    : activeMatch.home_club_id;

  await savePlayerStats();
  await notifyClubs(
    [opponentClubId],
    "Opponent Submitted Match Result",
    `${activeMatch.home_club_name} vs ${activeMatch.away_club_name}: ${ctx.submittedScore}`
  );
  await swalAlert(t("tournamentDetail.resultSubmitted"));
}

async function savePlayerStats() {
  const entries = Object.entries(playerStats).filter(
    ([, s]) => s.goals > 0 || s.assists > 0 || s.rating
  );

  await Promise.all(
    entries.map(async ([email, stat]) => {
      const player = myClubPlayers.find((p) => p.email === email);

      return stageClient.entities.MatchPlayerStat.create({
        tournament_id: id,
        match_id: activeMatch.id,
        club_id: myClub?.id || myPlayer?.club_id || null,
        player_email: email,
        player_gamertag: player?.gamertag || email,
        goals: stat.goals || 0,
        assists: stat.assists || 0,
        rating: parseFloat(stat.rating) || 6.0,
      });
    })
  );
}

async function notifyClubs(_clubIds, _title, _body) {
  // Notifications removed
}

function resetUI() {
  setResultDialogOpen(false);
  setActiveMatch(null);
  setResultForm({
    home_score: "",
    away_score: "",
    video_url: "",
    proof_url: "",
  });
  setPlayerStats({});
}

  async function claimForfeit(match, proofUrl) {
    const claimClubId = myClub?.id || myPlayer?.club_id;
    if (!claimClubId) return;
    await stageClient.entities.Match.update(match.id, {
      forfeit_claimed_by: claimClubId,
      forfeit_proof_url: proofUrl || null,
      forfeit_status: "pending",
      status: "disputed",
      admin_notes: `Forfeit claimed by ${claimClubId === match.home_club_id ? match.home_club_name : match.away_club_name}`,
    });
    const refreshed = await fetchTournamentMatches(id);
    setMatches(refreshed);
    setForfeitDialogOpen(false);
    setForfeitMatch(null);
    setForfeitProof("");
    await swalAlert(t("tournamentDetail.forfeitSubmitted"));
  }

  async function approveForfeit(match) {
    const winnerClubId = match.forfeit_claimed_by;
    const _winnerName = winnerClubId === match.home_club_id ? match.home_club_name : match.away_club_name;
    await stageClient.entities.Match.update(match.id, {
      status: "forfeit",
      winner_club_id: winnerClubId,
      forfeit_status: "approved",
    });
    const refreshed = await fetchTournamentMatches(id);
    setMatches(refreshed);
    setDisputeDialogOpen(false);
    setActiveDispute(null);
  }

  async function refreshMatches() {
    const refreshed = await fetchTournamentMatches(id);
    setMatches(refreshed);
  }

  async function simulateScore(match) {
    setMatches(await simulateTournamentScore(id, match.id));
  }

  async function withdrawFromTournament() {
    const effectiveId = takeoverClub ? takeoverClub.id : myPlayer?.club_id;
    if (!effectiveId || !tournament) return;
    const entryFeeSTC = tournament.entry_fee_stc ?? 0;
    const confirmMsg = entryFeeSTC > 0
      ? t("tournamentDetail.withdrawConfirmStc", { amount: entryFeeSTC.toLocaleString() })
      : t("tournamentDetail.withdrawConfirmRefund");
    if (!(await swalConfirm(confirmMsg))) return;

    const clubData = takeoverClub || allClubs.find(c => c.id === effectiveId);
    const res = await withdrawTournamentClub(tournament.id, effectiveId);
    if (!res?.data?.success) {
      await swalAlert(res?.data?.error || t("tournamentDetail.withdrawalFailed"));
      return;
    }

    const updated = res.data.registered_clubs || [];
    setTournament(prev => ({ ...prev, registered_clubs: updated }));
    setClubs(allClubs.filter(c => updated.includes(c.id)));
    if (clubData) {
      setAllClubs(prev => prev.map(c =>
        c.id === effectiveId
          ? { ...c, stc: res.data.club_stc ?? c.stc, credits: res.data.club_credits ?? c.credits }
          : c
      ));
    }
  }

  async function cancelTournament() {
    if (!(await swalConfirm(t("tournamentDetail.cancelConfirm")))) return;
    const res = await cancelTournamentById(id);
    if (!res?.data?.success) {
      await swalAlert(res?.data?.error || t("tournamentDetail.cancellationFailed"));
      return;
    }
    // Reload clubs so the info strip reflects the refunded balances
    const freshClubs = await stageClient.entities.Club.list("-rating", 200).catch(() => allClubs);
    setAllClubs(freshClubs);
    setTournament(prev => ({ ...prev, status: "cancelled" }));
  }

  async function deleteTournament() {
    if (!(await swalConfirm(t("tournamentDetail.deleteConfirm")))) return;
    try {
      const res = await deleteTournamentById(id);
      if (!res?.data?.success) {
        await swalAlert(res?.data?.error || t("tournamentDetail.deleteFailed"));
        return;
      }
      window.location.href = "/tournaments";
    } catch (err) {
      await swalAlert(err?.data?.error || err?.message || t("tournamentDetail.deleteFailed"));
    }
  }

  async function officializeCurrentTournament() {
    if (!(await swalConfirm(t("tournamentDetail.officializeConfirm")))) return;
    try {
      const result = await officializeTournament(id);
      setMatches(result.matches || []);
      if (result.tournament) setTournament(result.tournament);
      await swalAlert(t("tournamentDetail.officializeSuccess"));
    } catch (err) {
      await swalAlert(err?.data?.error || err?.message || t("tournamentDetail.officializeFailed"));
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!tournament) return <div className="p-6 lg:p-10 text-center"><p className="text-muted-foreground">{t("tournamentDetail.tournamentNotFound")}</p><Link to="/tournaments"><Button variant="outline" className="mt-4">{t("tournamentDetail.back")}</Button></Link></div>;

  const isPlayerTournament = tournament.participant_type === "player";
  const registeredClubs = allClubs.filter(c => tournament.registered_clubs?.includes(c.id));
  const effectiveClub = takeoverClub || myClub || allClubs.find(c => c.id === myPlayer?.club_id) || null;
  const effectiveClubId = effectiveClub?.id || null;
  const myClubRegistered = tournament.registered_clubs?.includes(effectiveClubId);
  const clubRegistrationProofs = tournament.registration_proofs?.club || {};
  const myClubRegistrationProof = effectiveClubId ? clubRegistrationProofs[String(effectiveClubId)] : null;
  const myClubRegistrationStatus = String(myClubRegistrationProof?.status || "").toLowerCase();
  const myClubRegistrationPending = myClubRegistrationStatus === "pending";
  const myPlayerRegistered = tournament.registered_players?.includes(myPlayer?.id);
  const registeredCount = isPlayerTournament
    ? (tournament.registered_players?.length || 0)
    : (tournament.registered_clubs?.length || 0);
  const isFull = registeredCount >= tournament.max_teams;
  const isOrganizer = tournament.organizer_email === user?.email;
  const canManageTournament = isAdmin || isCreator || isOrganizer;
  const myClubId = effectiveClubId;
  const isGroupStageTournament = tournament.type === "group_stage";
  const groupMatches = isGroupStageTournament
    ? matches.filter(m => ["group", "group_stage"].includes(String(m.type || "")))
    : [];
  const knockoutMatches = isGroupStageTournament
    ? matches.filter(m => !["group", "group_stage"].includes(String(m.type || "")))
    : matches;
  const groupStageComplete = isGroupStageTournament
    && groupMatches.length > 0
    && groupMatches.every(m => m.status === "completed" || m.status === "forfeit");
  const knockoutStarted = isGroupStageTournament && knockoutMatches.length > 0;
  const finalMatch = matches.find(m => String(m.type || "").toLowerCase() === "final");
  const thirdPlaceMatch = matches.find(m => ["third_place", "third-place", "bronze"].includes(String(m.type || "").toLowerCase()));
  const finalWinnerId = isPlayerTournament ? finalMatch?.winner_player_id : finalMatch?.winner_club_id;
  const thirdPlaceWinnerId = isPlayerTournament ? thirdPlaceMatch?.winner_player_id : thirdPlaceMatch?.winner_club_id;
  const finalComplete = finalMatch && (finalMatch.status === "completed" || finalMatch.status === "forfeit") && finalWinnerId;
  const thirdPlaceComplete = !thirdPlaceMatch || ((thirdPlaceMatch.status === "completed" || thirdPlaceMatch.status === "forfeit") && thirdPlaceWinnerId);
  const canOfficializeTournament = canManageTournament
    && tournament.status === "in_progress"
    && finalComplete
    && thirdPlaceComplete;
  const allMatchesPlayed = matches.length > 0
    && matches.every(m => m.status === "completed" || m.status === "forfeit")
    && (!isGroupStageTournament || knockoutStarted);
  const winnerClub = allMatchesPlayed && tournament.winner_club_id ? clubs.find(c => c.id === tournament.winner_club_id) || allClubs.find(c => c.id === tournament.winner_club_id) : null;
  // Compute winner points for display
  const winnerPoints = (() => {
    if (!allMatchesPlayed || !tournament.winner_club_id) return null;
    let pts = 0;
    matches.forEach(m => {
      const hs = m.home_score ?? 0, as_ = m.away_score ?? 0;
      if (m.home_club_id === tournament.winner_club_id) pts += hs > as_ ? 3 : hs === as_ ? 1 : 0;
      if (m.away_club_id === tournament.winner_club_id) pts += as_ > hs ? 3 : as_ === hs ? 1 : 0;
    });
    return pts;
  })();

  // Group rounds
  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);

  // UCL / generic round label helper
  function getRoundLabel(round, matchType) {
    if (matchType === "ucl_league" || matchType === "league") return t("tournamentDetail.matchday", { round });
    if (matchType === "ucl_playoff") return t("tournamentDetail.playoffs");
    if (matchType === "ucl_r16" || matchType === "round_of_16") return t("tournamentDetail.roundOf16");
    if (matchType === "ucl_qf" || matchType === "quarter_final") return t("tournamentDetail.quarterFinals");
    if (matchType === "ucl_sf" || matchType === "semi_final") return t("tournamentDetail.semiFinals");
    if (matchType === "third_place") return t("tournamentDetail.thirdPlace");
    if (matchType === "final") return t("tournamentDetail.final");
    if (matchType === "swiss") return t("tournamentDetail.roundN", { round });
    // Fallback: for generic tournaments infer from total rounds
    const totalRounds = rounds.length;
    const roundIndex = rounds.indexOf(round);
    const remaining = totalRounds - 1 - roundIndex;
    if (remaining === 0) return t("tournamentDetail.final");
    if (remaining === 1) return t("tournamentDetail.semiFinals");
    if (remaining === 2) return t("tournamentDetail.quarterFinals");
    if (remaining === 3) return t("tournamentDetail.roundOf16");
    return t("tournamentDetail.roundN", { round });
  }

  // Determine the "current" round to show by default (latest with incomplete or last)
  const activeRound = (() => {
    if (visibleRound !== null) return visibleRound;
    const incomplete = rounds.find(r => matches.filter(m => m.round === r).some(m => m.status !== "completed" && m.status !== "forfeit"));
    return incomplete ?? rounds[rounds.length - 1] ?? null;
  })();
  const hasKnockoutTree = tournament.type === "knockout" || tournament.type === "double_elimination"
    || (tournament.type === "group_stage" && matches.some(m => !["group", "group_stage"].includes(String(m.type || ""))));
  const bracketMatches = tournament.type === "group_stage"
    ? matches.filter(m => !["group", "group_stage"].includes(String(m.type || "")))
    : matches;

  const TYPE_COLOR = {
    knockout: "#ef4444",
    league: "#3b82f6",
    group_stage: "#22c55e",
    swiss_ucl: "#f59e0b",
    double_elimination: "#a855f7",
  };
  const accentColor = TYPE_COLOR[tournament.type] || "#3b82f6";
  const heroStyle = tournament.banner_url
    ? { backgroundImage: `url(${tournament.banner_url})`, backgroundSize: "cover", backgroundPosition: tournament.banner_position || "50% 50%" }
    : { background: `linear-gradient(135deg, ${tournament.banner_color || "#0f1923"} 0%, ${accentColor}22 100%)` };

  const tabs = [
    { value: "bracket", label: t("tournamentDetail.tabBracket") },
    ...(tournament.type === "group_stage" ? [{ value: "standings", label: t("tournamentDetail.tabGroupStandings") }] : []),
    ...(tournament.type === "league" ? [{ value: "league_standings", label: t("tournamentDetail.tabLeagueTable") }] : []),
    ...(tournament.type === "swiss_ucl" ? [{ value: "ucl_standings", label: t("tournamentDetail.tabSlTable") }] : []),
    { value: "leaderboard", label: t("tournamentDetail.tabStats") },
    { value: "teams", label: isPlayerTournament ? t("tournamentDetail.tabPlayers") : t("tournamentDetail.tabTeams") },
    ...(isAdmin && matches.some(m => m.status === "disputed")
      ? [{ value: "admin", label: t("tournamentDetail.tabDisputes", { count: matches.filter(m => m.status === "disputed").length }), danger: true }]
      : []),
  ];

  return (
    <div className="min-h-screen">
      {/* ── HERO ─────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden border-b border-cyan-400/10" style={heroStyle}>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(1,8,18,0.98)_0%,rgba(1,8,18,0.64)_42%,rgba(1,8,18,0.86)_100%)] pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background via-background/70 to-transparent pointer-events-none" />
        <div className="absolute inset-0 opacity-35 pointer-events-none bg-[radial-gradient(ellipse_at_50%_0%,rgba(103,232,249,0.24),transparent_45%)]" />

        <div className="relative max-w-7xl mx-auto px-4 lg:px-8">
          <button type="button" onClick={() => navigate(-1)}
            className="mt-4 inline-flex h-10 max-w-[240px] items-center justify-center gap-2 border border-cyan-200/25 bg-black/24 px-4 font-heading text-xs font-black uppercase tracking-[0.12em] text-cyan-50/95 shadow-[0_0_24px_-16px_rgba(0,229,255,0.9)] backdrop-blur-md transition-all hover:border-cyan-200/55 hover:bg-cyan-300/10 hover:text-white hover:shadow-[0_0_24px_-10px_rgba(0,229,255,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            style={{ clipPath: "polygon(10% 0, 100% 0, 90% 100%, 0 100%)" }}>
            <ArrowLeft className="w-4 h-4 text-cyan-200/90" /> Back
          </button>

          <div className="grid gap-6 pb-10 pt-7 lg:grid-cols-[160px_minmax(0,1fr)_auto] lg:items-end">
            {tournament.trophy_url && (
              <div className="relative hidden h-40 w-36 shrink-0 place-items-center sm:grid">
                <img src={tournament.trophy_url} alt="Trophy"
                  className="relative h-36 w-36 object-contain drop-shadow-[0_0_26px_rgba(255,255,255,0.35)]" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ring-1"
                  style={{ borderColor: `${accentColor}60`, color: accentColor, backgroundColor: `${accentColor}18`, clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}>
                  {tournament.type?.replace(/_/g, " ")}
                </span>
                <span className={cn("px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ring-1",
                  tournament.status === "registration" ? "text-cyan-200 ring-cyan-300/35 bg-cyan-300/10" :
                  tournament.status === "in_progress" ? "text-cyan-200 ring-cyan-300/35 bg-cyan-300/10" :
                  tournament.status === "completed" ? "text-amber-200 ring-amber-300/35 bg-amber-300/10" :
                  "text-white/50 ring-white/15 bg-white/5"
                )}
                  style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}>
                  {tournament.status?.replace(/_/g, " ")}
                </span>
                {tournament.platform && <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">{tournament.platform}</span>}
                {tournament.region && <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">{tournament.region}</span>}
                {tournament.country_code && (
                  <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55 ring-1 ring-white/15 bg-white/[0.06]"
                    style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}>
                    🌍 {COUNTRIES.find(c => c.code === tournament.country_code)?.name || tournament.country_code}
                  </span>
                )}
              </div>

              <h1 className="font-heading font-black text-3xl sm:text-5xl lg:text-6xl uppercase text-white leading-none tracking-tight"
                style={{ transform: "skewX(-6deg)", textShadow: "0 2px 32px rgba(0,0,0,0.9)" }}>
                {tournament.name}
              </h1>
              {tournament.description && (
                <p className="font-subtitle text-sm text-white/55 mt-2 max-w-xl line-clamp-2">{tournament.description}</p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-white/55">
                <span className="inline-flex items-center gap-2 bg-white/[0.06] px-3 py-1.5 ring-1 ring-white/10"
                  style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}>
                  <Users className="w-3.5 h-3.5" />
                  {registeredCount}/{tournament.max_teams} {isPlayerTournament ? t("tournamentDetail.players") : t("tournamentDetail.teams")}
                </span>
                <span className="inline-flex items-center gap-2 bg-white/[0.06] px-3 py-1.5 ring-1 ring-white/10"
                  style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}>
                  <Calendar className="w-3.5 h-3.5" />
                  {tournament.start_date ? new Date(tournament.start_date).toLocaleDateString() : t("tournamentDetail.tbd")}
                </span>
                {isAdmin && (
                  <Link to={isPlayerTournament ? `/tournaments/${id}/players` : `/tournaments/${id}/clubs`}
                    className="inline-flex items-center gap-2 bg-primary/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary ring-1 ring-primary/35 transition-colors hover:bg-primary/30"
                    style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}>
                    <Users className="w-3 h-3" /> {isPlayerTournament ? t("tournamentDetail.registeredPlayers") : t("tournamentDetail.registeredClubs")}
                  </Link>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-stretch gap-3 lg:items-end">
              {!isPlayerTournament && tournament.status === "registration" && effectiveClubId && !myClubRegistered && !myClubRegistrationPending && !isFull && (() => {
                const clubData = effectiveClub;
                const entryCost = tournament.entry_credits ?? 50;
                const entryFeeSTC = tournament.entry_fee_stc ?? 0;
                const canAfford = (user?.credits ?? 0) >= entryCost && (clubData?.stc ?? 0) >= entryFeeSTC;
                return (
                    <Button onClick={() => setClubRegistrationOpen(true)} disabled={!takeoverClub && !canAfford}
                      className="h-10 min-w-[210px] rounded-none border border-cyan-200/25 bg-black/24 px-7 font-heading text-xs font-black uppercase tracking-[0.12em] text-cyan-50/95 shadow-[0_0_24px_-16px_rgba(0,229,255,0.9)] backdrop-blur-md transition-all hover:border-cyan-200/55 hover:bg-cyan-300/10 hover:text-white hover:shadow-[0_0_24px_-10px_rgba(0,229,255,0.9)] focus-visible:ring-2 focus-visible:ring-cyan-300/50 disabled:border-white/10 disabled:text-white/45 disabled:opacity-55"
                      style={{ clipPath: "polygon(8% 0, 100% 0, 92% 100%, 0 100%)" }}>
                      {takeoverClub ? t("tournamentDetail.registerClubNamed", { name: takeoverClub.name }) : t("tournamentDetail.registerMyClub")}
                    </Button>
                );
              })()}

              {!isPlayerTournament && myClubRegistrationPending && tournament.status === "registration" && (
                <div className="bg-warning/10 px-4 py-3 text-xs text-warning shadow-lg ring-1 ring-warning/30"
                  style={{ clipPath: "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)" }}>
                  <span className="font-black uppercase tracking-wider">Pending admin approval</span>
                  <p className="mt-1 text-warning/75">Your EA FC club name is waiting for verification.</p>
                </div>
              )}

              {isPlayerTournament && tournament.status === "registration" && myPlayer && !myPlayerRegistered && !isFull && (
                <>
                  {renderPlayerRegistrationProofUpload()}
                  <Button onClick={registerPlayer} disabled={uploadingRegistrationProof || !registrationProofUrl || (user?.credits ?? 0) < (tournament.entry_credits ?? 50)}
                  className="h-12 rounded-none bg-gradient-to-r from-cyan-500 to-blue-500 px-5 font-heading text-sm font-black uppercase tracking-wide text-white shadow-[0_0_24px_rgba(34,211,238,0.18)] hover:from-cyan-400 hover:to-blue-400"
                  style={{ clipPath: "polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" }}>
                    <Users className="w-4 h-4 mr-2" /> {t("tournamentDetail.registerAsPlayer")}
                    <span className="ml-1 opacity-70 text-xs">({tournament.entry_credits ?? 50}✧)</span>
                  </Button>
                </>
              )}

              {!isPlayerTournament && myClubRegistered && tournament.status === "registration" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-success flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> {takeoverClub ? t("tournamentDetail.registeredNamed", { name: takeoverClub.name }) : t("tournamentDetail.registered")}
                  </span>
                  <Button size="sm" variant="outline" onClick={withdrawFromTournament}
                    className="h-8 rounded-none border-red-300/35 bg-transparent text-xs text-red-200 hover:bg-red-400/10"
                    style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}>
                    {t("tournamentDetail.withdraw")}
                  </Button>
                </div>
              )}
              {isPlayerTournament && myPlayerRegistered && tournament.status === "registration" && (
                <span className="text-xs text-success flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> {t("tournamentDetail.registered")}</span>
              )}

              {(tournament.custom_rules || tournament.rules_file_url) && (
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  if (tournament.rules_file_url && !tournament.custom_rules) window.open(tournament.rules_file_url, '_blank');
                  else setRulesModalOpen(true);
                }} className="rounded-none border-white/15 bg-black/25 text-xs text-white/60 hover:bg-white/10"
                  style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}>
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                  {tournament.rules_file_url && !tournament.custom_rules ? t("tournamentDetail.downloadRules") : t("tournamentDetail.viewRules")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── INFO STRIP ────────────────────────────────── */}
      {(tournament.entry_fee_stc > 0 || (!isPlayerTournament && effectiveClubId)) && (
        <div className="border-y border-cyan-300/10 bg-[#06111f]/95">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 flex flex-wrap items-center gap-3">
            {tournament.entry_fee_stc > 0 && (
              <span className="inline-flex min-h-10 items-center gap-2 bg-black/20 px-4 text-xs text-white/65 ring-1 ring-cyan-300/10"
                style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}>
                <Coins className="w-3.5 h-3.5 text-amber-300" />
                <span className="font-heading uppercase tracking-[0.16em] text-white/40">{t("tournamentDetail.prize")}</span>
                <strong className="text-amber-200">{tournament.prize_pool_stc
                  ? `${tournament.prize_pool_stc.toLocaleString()} STC`
                  : `${(tournament.entry_fee_stc * registeredCount).toLocaleString()} STC`}</strong>
                {tournament.prize_winner_stc && (
                  <span className="ml-1 text-white/35">
                    ({t("tournamentDetail.prizeBreakdown", {
                      first: tournament.prize_winner_stc.toLocaleString(),
                      second: (tournament.prize_runner_up_stc || 0).toLocaleString(),
                      third: (tournament.prize_semi_final_stc || 0).toLocaleString(),
                    })})
                  </span>
                )}
              </span>
            )}
            {!isPlayerTournament && effectiveClubId && (() => {
              const myClubData = effectiveClub || allClubs.find(c => c.id === effectiveClubId);
              if (!myClubData) return null;
              return (
                <>
                  <span className="inline-flex min-h-10 items-center gap-2 bg-black/20 px-4 text-xs text-white/65 ring-1 ring-cyan-300/10"
                    style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}>
                    <Shield className="w-3 h-3 text-amber-300" />
                    <span className="font-heading uppercase tracking-[0.16em] text-white/40">{t("tournamentDetail.credits")}</span>
                    <strong className="text-amber-200">{(user?.credits ?? 0).toLocaleString()}</strong>
                  </span>
                  {(tournament.entry_fee_stc ?? 0) > 0 && (
                    <span className="inline-flex min-h-10 items-center gap-2 bg-black/20 px-4 text-xs text-white/65 ring-1 ring-cyan-300/10"
                      style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}>
                      <Coins className="w-3 h-3 text-amber-300" />
                      <span className="font-heading uppercase tracking-[0.16em] text-white/40">STC</span>
                      <strong className="text-amber-200">{(myClubData.stc ?? 0).toLocaleString()}</strong>
                    </span>
                  )}
                </>
              );
            })()}
            {/* Player tournament registration */}
            {isPlayerTournament && tournament.status === "registration" && myPlayer && !myPlayerRegistered && !isFull && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                {renderPlayerRegistrationProofUpload()}
                <Button onClick={registerPlayer} className="h-10 rounded-none bg-cyan-400 text-black leading-relaxed hover:bg-cyan-300" style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }} disabled={uploadingRegistrationProof || !registrationProofUrl || (user?.credits ?? 0) < (tournament.entry_credits ?? 50) || ((tournament.entry_fee_stc ?? 0) > 0 && (myPlayer.stc ?? 0) < (tournament.entry_fee_stc ?? 0))}>
                  <Users className="w-4 h-4 mr-2" /> {t("tournamentDetail.registerAsPlayer")} <span className="ml-1 opacity-70 text-xs">({tournament.entry_credits ?? 50} credits{(tournament.entry_fee_stc ?? 0) > 0 ? ` + ${(tournament.entry_fee_stc ?? 0).toLocaleString()} STC` : ''})</span>
                </Button>
              </div>
            )}

            {canOfficializeTournament && (
              <Button type="button" onClick={officializeCurrentTournament} size="sm"
                className="h-9 rounded-none border border-amber-300/30 bg-amber-300/10 text-xs text-amber-200 hover:bg-amber-300/15"
                style={{ clipPath: "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)" }}>
                <Trophy className="w-3 h-3 mr-1.5" /> {t("tournamentDetail.officializeTournament")}
              </Button>
            )}

            {canManageTournament && ["registration", "in_progress"].includes(tournament.status) && registeredCount >= 2 && matches.length === 0 && (
              <Button type="button" onClick={generateDraw} size="sm" className="h-9 rounded-none border border-cyan-300/25 bg-cyan-300/10 text-xs text-cyan-100 hover:bg-cyan-300/15"
                style={{ clipPath: "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)" }}>
                🎲 {t("tournamentDetail.generateDraw")}
              </Button>
            )}

            {canManageTournament && ["registration", "in_progress"].includes(tournament.status) && matches.length > 0 && !allMatchesPlayed && !groupStageComplete && (
              <Button type="button" onClick={clearDraw} size="sm" variant="outline" className="h-9 rounded-none border-cyan-300/25 bg-transparent text-xs text-cyan-100 hover:bg-cyan-300/10"
                style={{ clipPath: "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)" }}>
                🔄 {t("tournamentDetail.regenerateDraw")}
              </Button>
            )}

            {canManageTournament && tournament.status === "registration" && registeredCount >= 2 && (
              <Button type="button" onClick={() => initializeTournament(tournament, registeredClubs)} size="sm"
                className="h-9 rounded-none bg-cyan-400 text-xs text-black hover:bg-cyan-300"
                style={{ clipPath: "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)" }}>
                <Play className="w-3 h-3 mr-1.5" /> {t("tournamentDetail.startTournament")}
              </Button>
            )}

            {canManageTournament && ["registration", "in_progress"].includes(tournament.status) && !allMatchesPlayed && (
              <Button type="button" onClick={cancelTournament} size="sm" variant="outline" className="h-9 rounded-none border-white/15 bg-transparent text-xs text-white/55 hover:bg-white/10"
                style={{ clipPath: "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)" }}>
                {t("competitionFlow.cancel")}
              </Button>
            )}

            {canManageTournament && !allMatchesPlayed && (
              <Button type="button" onClick={() => setEditDialogOpen(true)} size="sm" variant="outline" className="h-9 rounded-none border-cyan-300/25 bg-transparent text-xs text-cyan-100 hover:bg-cyan-300/10"
                style={{ clipPath: "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)" }}>
                {t("tournamentDetail.edit")}
              </Button>
            )}

            {isAdmin && ["cancelled", "registration", "completed"].includes(tournament.status) && (
              <Button type="button" onClick={deleteTournament} size="sm" variant="outline" className="h-9 rounded-none border-red-300/35 bg-transparent text-xs text-red-200 hover:bg-red-400/10"
                style={{ clipPath: "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)" }}>
                {tournament.status === "completed" ? t("tournamentDetail.endAndDelete") : t("tournamentDetail.delete")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── CHAMPION BANNER ───────────────────────────── */}
      {allMatchesPlayed && winnerClub && (
        <div className="border-b border-warning/25 bg-gradient-to-r from-warning/8 via-warning/12 to-transparent">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex items-center gap-4">
            {tournament.trophy_url && (
              <img src={tournament.trophy_url} alt="Trophy"
                className="w-12 h-12 object-contain shrink-0 drop-shadow-[0_0_16px_rgba(251,191,36,0.9)] animate-pulse-glow" />
            )}
            <div className="w-11 h-11 rounded-xl border-2 border-warning/40 overflow-hidden bg-secondary shrink-0">
              {winnerClub.logo_url
                ? <img src={winnerClub.logo_url} alt={winnerClub.name} className="w-full h-full object-cover" style={{ objectPosition: winnerClub.logo_position || "50% 50%" }} />
                : <Shield className="w-5 h-5 text-warning m-3" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-warning/50 font-black">{t("tournamentDetail.champion")}</p>
              <h2 className="font-heading text-lg font-black text-warning uppercase leading-tight truncate"
                style={{ transform: "skewX(-4deg)" }}>
                {winnerClub.name}
              </h2>
              {winnerPoints !== null && <p className="text-xs text-warning/55">{t("tournamentDetail.pointsPlatform", { points: winnerPoints, platform: winnerClub.platform })}</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── TAB NAVIGATION ────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#050b14]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex min-w-max items-center gap-6 overflow-x-auto pt-4">
            {tabs.map(tab => (
              <button key={tab.value} type="button" onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "relative shrink-0 pb-3 pt-1 font-heading text-[11px] font-black uppercase tracking-[0.16em] transition-colors whitespace-nowrap",
                  activeTab === tab.value
                    ? tab.danger ? "text-red-200" : "text-cyan-100"
                    : tab.danger
                      ? "text-red-200/45 hover:text-red-100"
                      : "text-white/45 hover:text-white/75"
                )}>
                {tab.label}
                {activeTab === tab.value && (
                  <span className={cn(
                    "absolute inset-x-0 -bottom-px h-[2px]",
                    tab.danger
                      ? "bg-gradient-to-r from-red-300 via-red-200 to-transparent"
                      : "bg-gradient-to-r from-cyan-300 via-blue-400 to-transparent"
                  )} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-5">

        {/* UCL Controls */}
        {tournament.type === "swiss_ucl" && isOrganizer && tournament.status === "in_progress" && activeTab === "bracket" && (() => {
          const leagueMatchdays = [...new Set(matches.filter(m => m.type === "ucl_league").map(m => m.round))];
          const allLeagueDone = leagueMatchdays.length === 8 && matches.filter(m => m.type === "ucl_league").every(m => m.status === "completed" || m.status === "forfeit");
          const playoffExists = matches.some(m => m.type === "ucl_playoff");
          const allPlayoffDone = playoffExists && matches.filter(m => m.type === "ucl_playoff").every(m => m.status === "completed" || m.status === "forfeit");
          const r16Exists = matches.some(m => m.type === "ucl_r16");
          const allR16Done = r16Exists && matches.filter(m => m.type === "ucl_r16").every(m => m.status === "completed" || m.status === "forfeit");
          const qfExists = matches.some(m => m.type === "ucl_qf");
          const allQFDone = qfExists && matches.filter(m => m.type === "ucl_qf").every(m => m.status === "completed" || m.status === "forfeit");
          const sfExists = matches.some(m => m.type === "ucl_sf");
          const allSFDone = sfExists && matches.filter(m => m.type === "ucl_sf").every(m => m.status === "completed" || m.status === "forfeit");
          const finalExists = matches.some(m => m.type === "final");
          return (
            <div className="bg-card border border-primary/20 rounded-xl p-4 flex flex-wrap items-center gap-3">
              <span className="text-xs font-heading uppercase tracking-widest text-primary font-bold">⭐ {t("tournamentDetail.uclControls")}</span>
              {["ucl_playoff","ucl_r16","ucl_qf","ucl_sf"].map(mType => {
                const byTie = {};
                matches.filter(m => m.type === mType).forEach(m => {
                  if (!byTie[m.group]) byTie[m.group] = [];
                  byTie[m.group].push(m);
                });
                return Object.entries(byTie).map(([group, legs]) => {
                  const sorted = legs.sort((a, b) => a.round - b.round);
                  const leg1 = sorted[0], leg2 = sorted[1], leg3 = sorted[2];
                  if (!leg1 || !leg2) return null;
                  if (leg1.status !== "completed" || leg2.status !== "completed") return null;
                  if (leg3) return null;
                  const agg_A = (leg1.home_score||0)+(leg2.away_score||0);
                  const agg_B = (leg1.away_score||0)+(leg2.home_score||0);
                  if (agg_A !== agg_B) return null;
                  const maxRound = Math.max(...matches.map(m => m.round));
                  return (
                    <Button key={`${mType}-${group}-leg3`} type="button"
                      onClick={async () => {
                        const choice = await swalConfirm(
                          `Tie on aggregate (${agg_A}-${agg_B}). Pick the host for leg 3.`,
                          {
                            title: `${leg1.home_club_name} vs ${leg1.away_club_name}`,
                            confirmText: `${leg1.home_club_name} hosts`,
                            cancelText: `${leg1.away_club_name} hosts`,
                            icon: "question",
                          }
                        );
                        const homeClub = choice ? { id: leg1.home_club_id, name: leg1.home_club_name } : { id: leg1.away_club_id, name: leg1.away_club_name };
                        const awayClub = choice ? { id: leg1.away_club_id, name: leg1.away_club_name } : { id: leg1.home_club_id, name: leg1.home_club_name };
                        await stageClient.entities.Match.create({
                          home_club_id: homeClub.id, home_club_name: homeClub.name,
                          away_club_id: awayClub.id, away_club_name: awayClub.name,
                          round: maxRound + 1, type: mType, group: parseInt(group),
                          status: "scheduled", home_score: 0, away_score: 0, tournament_id: id,
                        });
                        const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
                        setMatches(refreshed);
                      }}
                      className="bg-warning/10 text-warning border border-warning/30 text-xs animate-pulse">
                      ⚖️ {leg1.home_club_name} vs {leg1.away_club_name} — Tied! Schedule Leg 3
                    </Button>
                  );
                });
              })}
              {(
                (allLeagueDone && !playoffExists) ||
                (allPlayoffDone && !r16Exists) ||
                (allR16Done && !qfExists) ||
                (allQFDone && !sfExists) ||
                (allSFDone && !finalExists)
              ) && (
                <span className="rounded border border-success/30 bg-success/5 px-2.5 py-1 text-xs font-semibold text-success">
                  {t("tournamentDetail.uclNextPhaseAuto")}
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {t("tournamentDetail.phase")}: <strong className="text-foreground capitalize">{tournament.ucl_phase || "league"}</strong>
              </span>
            </div>
          );
        })()}

        {/* ── BRACKET TAB ─── */}
        {activeTab === "bracket" && (
          matches.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center">
              <Trophy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              {tournament.status === "registration" && canManageTournament && registeredCount >= 2
                ? <p className="text-muted-foreground text-sm">{t("tournamentDetail.bracketEmptyGeneratePrefix")} <span className="text-primary font-semibold">{t("tournamentDetail.generateDraw")}</span> {t("tournamentDetail.bracketEmptyGenerateSuffix")}</p>
                : <p className="text-muted-foreground text-sm">{t("tournamentDetail.bracketEmptyWaiting")}</p>
              }
            </div>
          ) : hasKnockoutTree ? (
            <div className="bg-card border border-border rounded-2xl p-6">
              {tournament.status === "registration" && matches.length > 0 && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary flex items-center gap-2">
                  {t("tournamentDetail.drawPreview")}
                </div>
              )}
              {tournament.type === "group_stage" && (
                <div className="mb-5">
                  <GroupStageVisual matches={matches} registeredClubs={registeredClubs} numGroups={tournament.num_groups || 2} />
                </div>
              )}
              <KnockoutBracket
                matches={bracketMatches}
                myClubId={myClubId}
                onSubmit={(match) => { setActiveMatch(match); setResultDialogOpen(true); }}
                onSchedule={(match) => { setScheduleMatch(match); setScheduleDate(toDatetimeLocalValue(match.scheduled_date)); setScheduleDialogOpen(true); }}
                onViewStats={(match) => { setStatsMatch(match); setStatsModalOpen(true); }}
                onAddStream={(match) => { setStreamMatch(match); setStreamUrl(match.stream_url || ""); setStreamDialogOpen(true); }}
                onForfeit={(match) => { setForfeitMatch(match); setForfeitDialogOpen(true); }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {tournament.status === "registration" && matches.length > 0 && (
                <div className="px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary flex items-center gap-2">
                  {t("tournamentDetail.drawPreview")}
                </div>
              )}

              {tournament.type === "group_stage" && (
                <GroupStageVisual matches={matches} registeredClubs={registeredClubs} numGroups={tournament.num_groups || 2} />
              )}

              {/* Round selector pills */}
              {rounds.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {rounds.map(round => {
                    const rm = matches.filter(m => m.round === round);
                    const label = getRoundLabel(round, rm[0]?.type);
                    const isActive = round === activeRound;
                    const hasMyMatch = rm.some(m => m.home_club_id === myClubId || m.away_club_id === myClubId);
                    const allDone = rm.every(m => m.status === "completed" || m.status === "forfeit");
                    return (
                      <button type="button" key={round} onClick={() => setVisibleRound(round)} className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                        isActive ? "bg-primary text-primary-foreground border-primary"
                          : "bg-secondary text-muted-foreground border-border hover:border-primary/40 hover:text-foreground",
                        hasMyMatch && !isActive && "border-primary/30 text-primary/80",
                        allDone && !isActive && "opacity-50"
                      )}>
                        {label}
                        {hasMyMatch && !allDone && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-primary inline-block align-middle" />}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Active round matches */}
              {activeRound !== null && (() => {
                const roundMatches = matches.filter(m => m.round === activeRound);
                return (
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-primary/10 text-primary text-[10px] flex items-center justify-center font-black">{activeRound}</span>
                      {getRoundLabel(activeRound, roundMatches[0]?.type)}
                    </h3>
                    <div className="space-y-2">
                      {roundMatches.map(match => {
                        const isMyMatch = match.home_club_id === myClubId || match.away_club_id === myClubId;
                        const homeClubData = allClubs.find(c => c.id === match.home_club_id);
                        const awayClubData = allClubs.find(c => c.id === match.away_club_id);
                        return (
                          <div key={match.id} className={cn(
                            "bg-card border rounded-xl px-4 py-3 transition-all",
                            isMyMatch ? "border-primary/25" : "border-border",
                            match.status === "completed" && "opacity-80"
                          )}>
                            {/* EA FC-style match row */}
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-9 h-9 rounded-lg bg-secondary border border-border overflow-hidden shrink-0">
                                  {homeClubData?.logo_url
                                    ? <img src={homeClubData.logo_url} alt={match.home_club_name} className="w-full h-full object-cover" style={{ objectPosition: homeClubData.logo_position || "50% 50%" }} />
                                    : <Shield className="w-4 h-4 text-muted-foreground m-2.5" />}
                                </div>
                                <p className={cn("font-bold text-sm truncate",
                                  match.status === "completed" && match.winner_club_id === match.home_club_id ? "text-success" :
                                  match.status === "completed" && match.winner_club_id && match.winner_club_id !== match.home_club_id ? "text-muted-foreground" :
                                  "text-foreground"
                                )}>{match.home_club_name}</p>
                              </div>

                              <div className="shrink-0 text-center min-w-[64px] px-2">
                                {match.status === "completed" || match.status === "forfeit" ? (
                                  <span className="font-heading font-black text-lg tabular-nums text-foreground">{match.home_score} – {match.away_score}</span>
                                ) : (
                                  <span className="text-muted-foreground text-xs font-bold uppercase tracking-widest">vs</span>
                                )}
                                {match.scheduled_date && match.status === "scheduled" && (
                                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">{new Date(match.scheduled_date).toLocaleDateString()}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-2.5 justify-end min-w-0">
                                <p className={cn("font-bold text-sm truncate text-right",
                                  match.status === "completed" && match.winner_club_id === match.away_club_id ? "text-success" :
                                  match.status === "completed" && match.winner_club_id && match.winner_club_id !== match.away_club_id ? "text-muted-foreground" :
                                  "text-foreground"
                                )}>{match.away_club_name}</p>
                                <div className="w-9 h-9 rounded-lg bg-secondary border border-border overflow-hidden shrink-0">
                                  {awayClubData?.logo_url
                                    ? <img src={awayClubData.logo_url} alt={match.away_club_name} className="w-full h-full object-cover" style={{ objectPosition: awayClubData.logo_position || "50% 50%" }} />
                                    : <Shield className="w-4 h-4 text-muted-foreground m-2.5" />}
                                </div>
                              </div>
                            </div>

                            {/* Status / action strip */}
                            {match.status === "awaiting_confirmation" && (
                              <div className="mt-2 text-xs text-warning flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Awaiting opponent confirmation (24h timeout)
                              </div>
                            )}
                            {match.status === "disputed" && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-xs text-destructive font-bold">⚠️ Score disputed</span>
                                {isAdmin && (
                                  <Button size="sm" type="button" onClick={() => { setActiveDispute(match); setDisputeDialogOpen(true); }}
                                    className="bg-destructive/10 text-destructive text-xs border border-destructive/30 h-6 px-2">{t("commonPages.tdResolve")}</Button>
                                )}
                              </div>
                            )}
                            {match.status === "forfeit" && (
                              <div className="mt-2 text-xs text-warning flex items-center gap-1">
                                <Flag className="w-3 h-3" /> Decided by forfeit
                              </div>
                            )}

                            {isMyMatch && (match.status === "scheduled" || match.status === "in_progress" || match.status === "awaiting_confirmation") && (
                              <div className="mt-3 pt-2.5 border-t border-border/60 flex flex-wrap gap-1.5 justify-end">
                                <Button size="sm" type="button" variant="outline" onClick={() => { setScheduleMatch(match); setScheduleDate(toDatetimeLocalValue(match.scheduled_date)); setScheduleDialogOpen(true); }}
                                  className="border-border text-xs text-muted-foreground h-7">{t("nav.schedule")}</Button>
                                {match.status !== "awaiting_confirmation" && (
                                  <Button size="sm" type="button" onClick={() => { setActiveMatch(match); setResultDialogOpen(true); }}
                                    className="bg-primary/10 text-primary hover:bg-primary/20 border-0 text-xs h-7">
                                    Submit Result
                                  </Button>
                                )}
                                {match.status === "awaiting_confirmation" && !((match.home_club_id === myClubId && match.result_home_submitted) || (match.away_club_id === myClubId && match.result_away_submitted)) && (
                                  <Button size="sm" type="button" onClick={() => { setActiveMatch(match); setResultDialogOpen(true); }}
                                    className="bg-warning/10 text-warning hover:bg-warning/20 border border-warning/30 text-xs h-7">
                                    Confirm Score
                                  </Button>
                                )}
                                <Button size="sm" type="button" variant="outline" onClick={() => { setStreamMatch(match); setStreamUrl(match.stream_url || ""); setStreamDialogOpen(true); }}
                                  className="border-primary/30 text-primary hover:bg-primary/5 text-xs h-7">{t("commonPages.tdStream")}</Button>
                                <Button size="sm" type="button" variant="outline" onClick={() => { setForfeitMatch(match); setForfeitDialogOpen(true); }}
                                  className="border-destructive/30 text-destructive text-xs h-7">
                                  <Flag className="w-3 h-3 mr-1" /> {t("tournamentDetail.forfeit")}
                                </Button>
                              </div>
                            )}

                            {match.status === "completed" && (
                              <div className="mt-2.5 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {match.stream_url && (
                                    <a href={match.stream_url} target="_blank" rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80">
                                      <span className="w-1.5 h-1.5 rounded-full bg-primary" /> Watch Live
                                    </a>
                                  )}
                                  {match.video_url && (
                                    <a href={match.video_url} target="_blank" rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                                      <Play className="w-3 h-3" /> Match Video
                                    </a>
                                  )}
                                </div>
                                <Button size="sm" type="button" variant="outline" onClick={() => { setStatsMatch(match); setStatsModalOpen(true); }}
                                  className="border-border text-xs text-muted-foreground h-7">📊 Stats</Button>
                              </div>
                            )}

                            {isAdmin && match.status !== "completed" && match.status !== "forfeit" && (
                              <div className="mt-2.5 pt-2.5 border-t border-border/40 flex justify-end">
                                <Button size="sm" type="button" onClick={() => simulateScore(match)}
                                  className="bg-accent/10 text-accent border border-accent/30 text-xs h-7">
                                  Simulate Score
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )
        )}

        {/* ── STANDINGS TABS ─── */}
        {(activeTab === "standings" || activeTab === "league_standings" || activeTab === "ucl_standings") && (
          <TournamentStandingsTabs
            tournament={tournament}
            matches={matches}
            registeredClubs={registeredClubs}
            groupStandingsData={groupStandingsData}
            activeTab={activeTab}
          />
        )}

        {/* ── LEADERBOARD TAB ─── */}
        {activeTab === "leaderboard" && (
          <TournamentLeaderboard tournamentId={id} />
        )}

        {/* ── TEAMS TAB ─── */}
        {activeTab === "teams" && (
          isPlayerTournament ? (
            (() => {
              const registeredPlayerIds = tournament.registered_players || [];
              if (registeredPlayerIds.length === 0) return (
                <div className="bg-card border border-border rounded-xl p-10 text-center">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">{t("commonPages.cdNoPlayers")}</p>
                </div>
              );
              return <PlayerRegistrantList playerIds={registeredPlayerIds} />;
            })()
          ) : (
            registeredClubs.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-10 text-center">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">{t("commonPages.tdNoTeams")}</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {registeredClubs.map((club, i) => (
                  <Link key={club.id} to={`/clubs/${club.id}`} className="block group">
                    <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:border-primary/30 transition-all">
                      <span className="w-7 h-7 rounded bg-secondary flex items-center justify-center text-xs font-black text-muted-foreground shrink-0">{i + 1}</span>
                      <div className="w-10 h-10 rounded-lg bg-secondary border border-border overflow-hidden shrink-0">
                        {club.logo_url
                          ? <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" style={{ objectPosition: club.logo_position || "50% 50%" }} />
                          : <Shield className="w-5 h-5 text-muted-foreground m-2.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-foreground truncate">{club.name} <span className="text-xs text-primary font-mono">[{club.tag}]</span></p>
                        <p className="text-xs text-muted-foreground">{club.platform} · Rating: {club.rating || 0}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )
        )}

        {/* ── ADMIN TAB ─── */}
        {isAdmin && activeTab === "admin" && (
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-destructive flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" /> {t("tournamentDetail.disputesForfeitRequests")}
            </h3>
            {matches.filter(m => m.status === "disputed").length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-10 text-center">
                <Check className="w-10 h-10 text-success mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">{t("commonPages.tdNoDisputes")}</p>
              </div>
            ) : (
              matches.filter(m => m.status === "disputed").map(match => (
                <div key={match.id} className="bg-card border border-destructive/30 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-foreground">{match.home_club_name} vs {match.away_club_name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-black uppercase tracking-widest">
                      {match.forfeit_claimed_by ? t("tournamentDetail.forfeitClaim") : t("tournamentDetail.disputed")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1 bg-destructive/5 border border-destructive/15 rounded-lg p-3">
                    {match.home_submitted_score && <p>🏠 {match.home_club_name}: <strong className="text-foreground font-mono">{match.home_submitted_score}</strong></p>}
                    {match.away_submitted_score && <p>✈️ {match.away_club_name}: <strong className="text-foreground font-mono">{match.away_submitted_score}</strong></p>}
                    {match.forfeit_claimed_by && (
                      <p>🚩 Claimed by: <strong className="text-foreground">{match.forfeit_claimed_by === match.home_club_id ? match.home_club_name : match.away_club_name}</strong></p>
                    )}
                    {renderProofLinks(match)}
                    {match.admin_notes && <p className="italic">{adminNoteText(match.admin_notes)}</p>}
                  </div>
                  <div className="flex gap-2">
                    {match.forfeit_claimed_by && (
                      <Button size="sm" type="button" onClick={() => approveForfeit(match)}
                        className="bg-warning/10 text-warning border border-warning/30 text-xs">✅ {t("tournamentDetail.approveForfeit")}</Button>
                    )}
                    <Button size="sm" type="button" onClick={() => { setActiveDispute(match); setDisputeDialogOpen(true); }}
                      className="bg-destructive/10 text-destructive border border-destructive/30 text-xs">{t("commonPages.tdSetFinalScore")}</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* ── DIALOGS (all unchanged) ────────────────────── */}
      <MatchStatsModal match={statsMatch} open={statsModalOpen} onClose={() => { setStatsModalOpen(false); setStatsMatch(null); }} />

      <Dialog open={rulesModalOpen} onOpenChange={setRulesModalOpen}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" /> {tournament.name} — Rules
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {tournament.custom_rules && (
              <div className="bg-secondary/50 rounded-xl p-4">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{tournament.custom_rules}</p>
              </div>
            )}
            {tournament.rules_file_url && (
              <a href={tournament.rules_file_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors font-medium text-sm">
                <Download className="w-4 h-4" /> Download Rules Document
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={clubRegistrationOpen} onOpenChange={(open) => {
        setClubRegistrationOpen(open);
        if (!open) setEaClubName("");
      }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border-cyan-300/15 bg-[#050b14] p-0 text-white shadow-[0_0_60px_rgba(34,211,238,0.12)] sm:max-w-lg">
          <div className="relative overflow-hidden border-b border-cyan-300/10 px-6 pb-5 pt-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(34,211,238,0.18),transparent_42%)]" />
            <div className="relative flex items-start gap-4">
              <div className="grid h-14 w-12 shrink-0 place-items-center bg-cyan-300/10 ring-1 ring-cyan-300/25"
                style={{ clipPath: "polygon(14% 0, 100% 0, 86% 100%, 0 100%)" }}>
                <Shield className="h-6 w-6 text-cyan-200" />
              </div>
              <div className="min-w-0">
                <p className="font-heading text-[10px] font-black uppercase tracking-[0.22em] text-cyan-200/55">Tournament entry</p>
                <DialogHeader>
                  <DialogTitle className="mt-1 font-heading text-2xl font-black uppercase leading-none tracking-wide text-white">
                    Register Your Club
                  </DialogTitle>
                </DialogHeader>
              </div>
            </div>
          </div>
          <div className="space-y-5 px-6 pb-6 pt-5">
            <div className="bg-cyan-300/[0.06] p-4 ring-1 ring-cyan-300/15"
              style={{ clipPath: "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)" }}>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Admin verification</p>
              <p className="mt-2 text-sm leading-relaxed text-white/62">
                Enter the exact EA FC Pro Clubs name your team uses in-game. Admin will use it to verify that your club exists before approving this entry.
              </p>
            </div>
            <div>
              <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-white/45">
                EA FC Pro Clubs name
              </label>
              <Input
                value={eaClubName}
                onChange={(event) => setEaClubName(event.target.value)}
                placeholder="e.g. The Hooded F.C."
                className="h-12 rounded-none border-cyan-300/15 bg-white/[0.06] text-white placeholder:text-white/30 focus-visible:ring-cyan-300/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/25 p-3 ring-1 ring-cyan-300/12"
                style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Credits</p>
                <p className="font-heading text-2xl font-black text-amber-200">{tournament.entry_credits ?? 50}</p>
              </div>
              <div className="bg-black/25 p-3 ring-1 ring-cyan-300/12"
                style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">Club STC</p>
                <p className="font-heading text-2xl font-black text-amber-200">{(tournament.entry_fee_stc ?? 0).toLocaleString()}</p>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-white/45">
              Your registration will be reviewed by admin. If it is approved, your club can continue into tournament preparation and fixtures.
            </p>
            <Button
              type="button"
              onClick={registerClub}
              disabled={registeringClub || !eaClubName.trim()}
              className="h-12 w-full rounded-none bg-cyan-400 font-heading text-sm font-black uppercase tracking-[0.16em] text-black hover:bg-cyan-300 disabled:opacity-45"
              style={{ clipPath: "polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" }}
            >
              {registeringClub ? "Registering..." : "Submit Registration"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {editDialogOpen && (
        <EditTournamentDialog
          tournament={tournament}
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          onSave={(updates) => setTournament(prev => ({ ...prev, ...updates }))}
        />
      )}

      <Dialog open={forfeitDialogOpen} onOpenChange={setForfeitDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl text-warning">{t("tournamentDetail.claimForfeitWin")}</DialogTitle>
          </DialogHeader>
          {forfeitMatch && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">{forfeitMatch.home_club_name} vs {forfeitMatch.away_club_name}</p>
              <div className="bg-warning/5 border border-warning/20 rounded-lg p-3 text-xs text-warning">
                ⚠️ Only claim a forfeit if your opponent is a genuine no-show.
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Proof URL (optional)</label>
                <Input value={forfeitProof} onChange={e => setForfeitProof(e.target.value)}
                  className="bg-secondary border-border text-xs" placeholder="https://..." />
              </div>
              <Button type="button" onClick={() => claimForfeit(forfeitMatch, forfeitProof)}
                className="w-full bg-warning/10 text-warning border border-warning/30">
                <Flag className="w-4 h-4 mr-2" /> {t("tournamentDetail.submitForfeitClaim")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl text-destructive">{t("tournamentDetail.resolveDisputedMatch")}</DialogTitle>
          </DialogHeader>
          {activeDispute && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">{activeDispute.home_club_name} vs {activeDispute.away_club_name}</p>
              <div className="space-y-1 text-xs text-muted-foreground bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                {activeDispute.home_submitted_score && <p>🏠 {activeDispute.home_club_name}: <strong>{activeDispute.home_submitted_score}</strong></p>}
                {activeDispute.away_submitted_score && <p>✈️ {activeDispute.away_club_name}: <strong>{activeDispute.away_submitted_score}</strong></p>}
                {renderProofLinks(activeDispute)}
              </div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Enter the correct final score:</p>
              <div className="flex items-center gap-4">
                <div className="flex-1 text-center">
                  <p className="font-bold text-foreground text-sm mb-1">{activeDispute.home_club_name}</p>
                  <Input type="number" min="0" value={disputeForm.home_score}
                    onChange={e => setDisputeForm(f => ({ ...f, home_score: e.target.value }))}
                    className="bg-secondary border-border text-center text-xl font-bold" placeholder="0" />
                </div>
                <span className="text-2xl text-muted-foreground font-bold">–</span>
                <div className="flex-1 text-center">
                  <p className="font-bold text-foreground text-sm mb-1">{activeDispute.away_club_name}</p>
                  <Input type="number" min="0" value={disputeForm.away_score}
                    onChange={e => setDisputeForm(f => ({ ...f, away_score: e.target.value }))}
                    className="bg-secondary border-border text-center text-xl font-bold" placeholder="0" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">{t("commonPages.tdAdminNotes")}</label>
                <Input value={disputeForm.admin_notes} onChange={e => setDisputeForm(f => ({ ...f, admin_notes: e.target.value }))}
                  className="bg-secondary border-border text-xs" placeholder={t("tournamentDetail.reasonPlaceholder")} />
              </div>
              <Button type="button" onClick={() => resolveDispute(activeDispute, disputeForm.home_score, disputeForm.away_score)}
                disabled={disputeForm.home_score === "" || disputeForm.away_score === ""}
                className="w-full bg-destructive text-destructive-foreground">
                Confirm Admin Decision
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={streamDialogOpen} onOpenChange={setStreamDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl">{t("commonPages.tdAddStreamLink")}</DialogTitle>
          </DialogHeader>
          {streamMatch && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">{streamMatch.home_club_name} vs {streamMatch.away_club_name}</p>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">{t("commonPages.tdStreamUrl")}</label>
                <Input value={streamUrl} onChange={e => setStreamUrl(e.target.value)}
                  placeholder="https://twitch.tv/... or https://youtube.com/..."
                  className="bg-secondary border-border text-xs" />
              </div>
              <p className="text-xs text-muted-foreground">Supported: Twitch, YouTube, Kick</p>
              <Button type="button" onClick={async () => {
                if (streamUrl.trim()) {
                  await stageClient.entities.Match.update(streamMatch.id, { stream_url: streamUrl });
                  setMatches(prev => prev.map(m => m.id === streamMatch.id ? { ...m, stream_url: streamUrl } : m));
                }
                setStreamDialogOpen(false); setStreamMatch(null); setStreamUrl("");
              }} disabled={!streamUrl.trim()} className="w-full bg-primary text-primary-foreground">
                Save Stream Link
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <TournamentResultDialog
        open={resultDialogOpen}
        onClose={setResultDialogOpen}
        activeMatch={activeMatch}
        resultForm={resultForm}
        setResultForm={setResultForm}
        myClubPlayers={myClubPlayers}
        playerStats={playerStats}
        setPlayerStats={setPlayerStats}
        uploadingProof={uploadingProof}
        setUploadingProof={setUploadingProof}
        uploadingVideo={uploadingVideo}
        setUploadingVideo={setUploadingVideo}
        onSubmit={submitResult}
      />
    </div>
  );
}
