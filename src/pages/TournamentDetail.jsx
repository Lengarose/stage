import { useState, useEffect, useRef } from "react";
import TournamentResultDialog from "../components/TournamentResultDialog";
import { useParams, Link, useNavigate } from "react-router-dom";
import { stageClient, resolveMyPlayerAndClub } from "@/api/stageClient";
import {
  cancelTournamentById,
  clearTournamentDraw,
  createTournamentFinalAndThirdPlace,
  deleteTournamentById,
  fetchTournamentPublic,
  fetchTournamentMatches,
  generateTournamentDraw,
  initializeTournamentDraw,
  notifyTournamentRegistration,
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
import DressingRoom from "../components/DressingRoom";
import TournamentWinnerPressRoomDialog from "../components/TournamentWinnerPressRoomDialog";
import { toMysqlDateTime, toDatetimeLocalValue } from "@/lib/momentDate";
import { swalAlert, swalConfirm } from "@/lib/swal";
import { getTournamentEntryCost } from "@/lib/subscriptionUtils";

export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [clubs, setClubs] = useState([]);
  const [allClubs, setAllClubs] = useState([]);
  const [matches, setMatches] = useState([]);
  const [myPlayer, setMyPlayer] = useState(null);
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
  const registrationProofInputRef = useRef(null);

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
      { label: `${match.home_club_name || "Home"} proof`, url: homeSub?.proof_url, score: scoreFromSubmission(homeSub) },
      { label: `${match.away_club_name || "Away"} proof`, url: awaySub?.proof_url, score: scoreFromSubmission(awaySub) },
      { label: "Match proof", url: !homeSub?.proof_url && !awaySub?.proof_url ? (match.proof_url || match.forfeit_proof_url) : null, score: null },
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
      await swalAlert("Please upload an image.");
      e.target.value = "";
      return;
    }
    setUploadingRegistrationProof(true);
    try {
      const result = await stageClient.integrations.Core.UploadFile({ file });
      setRegistrationProofUrl(result?.file_url || "");
    } catch (err) {
      await swalAlert(err?.message || "Could not upload registration photo.");
    } finally {
      setUploadingRegistrationProof(false);
      e.target.value = "";
    }
  }

  const renderRegistrationProofUpload = (kind) => (
    <div className="w-full sm:w-72 rounded-lg border border-white/15 bg-black/25 p-2.5 text-left">
      <input
        ref={registrationProofInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={uploadRegistrationProof}
      />
      <button
        type="button"
        onClick={() => registrationProofInputRef.current?.click()}
        disabled={uploadingRegistrationProof}
        className="w-full inline-flex items-center justify-between gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/15 disabled:opacity-60"
      >
        <span className="inline-flex items-center gap-2">
          <Upload className="w-3.5 h-3.5" />
          {kind === "player" ? "Ultimate Team photo" : "Pro Club photo"}
        </span>
        <span className="text-[10px] text-white/60">
          {uploadingRegistrationProof ? "Uploading" : registrationProofUrl ? "Ready" : "Required"}
        </span>
      </button>
      {registrationProofUrl && (
        <a href={registrationProofUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-success underline underline-offset-2">
          <ImageIcon className="w-3 h-3" /> View uploaded photo
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
  const [dressingRoomMatch, setDressingRoomMatch] = useState(null);
  const [dressingRoomOpen, setDressingRoomOpen] = useState(false);
  const [visibleRound, setVisibleRound] = useState(null);
  const [winnerPressRoomOpen, setWinnerPressRoomOpen] = useState(false);
  const [winnerConferenceDone, setWinnerConferenceDone] = useState(false);
  const [takeoverClub, setTakeoverClub] = useState(null);
  const [activeTab, setActiveTab] = useState("bracket");
  const [advancingRound, setAdvancingRound] = useState(false);

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
        const { player: myPl } = isAuthed
          ? await resolveMyPlayerAndClub().catch(() => ({ player: null, club: null }))
          : { player: null, club: null };
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

        setIsBasic(u?.role === "admin");
        setTournamentEntryCost(u?.role === "admin" ? 0 : getTournamentEntryCost());
        setIsAdmin(u?.role === "admin");
        setIsCreator(Boolean(u?.email && t?.creator_email === u.email));
        if (t?.status === 'completed' && t?.winner_club_id) {
          const existingConfs = await stageClient.entities.PressConference
            .filter({ match_id: t.id })
            .catch(() => []);
          setWinnerConferenceDone(existingConfs.some(c => c.context === 'tournament_winner'));
        }
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

  async function registerClub() {
    const effectiveId = takeoverClub ? takeoverClub.id : myPlayer?.club_id;
    if (!effectiveId || !tournament) return;
    if (tournament.start_date && new Date(tournament.start_date) < new Date()) {
      await swalAlert("Registration is closed. This tournament's start date has already passed.");
      return;
    }
    const current = tournament.registered_clubs || [];
    if (current.includes(effectiveId)) return;
    if (current.length >= tournament.max_teams) return;
    if (!registrationProofUrl) {
      await swalAlert("Upload a Pro Club photo before registering.");
      return;
    }
    
    const entryCost = tournament.entry_credits ?? 50;
    const entryFeeSTC = tournament.entry_fee_stc ?? 0;
    const clubData = takeoverClub || allClubs.find(c => c.id === effectiveId);

    // Country restriction check
    if (tournament.country_code) {
      if (!clubData?.country_code || clubData.country_code !== tournament.country_code) {
        const countryName = COUNTRIES.find(c => c.code === tournament.country_code)?.name || tournament.country_code;
        await swalAlert(`This tournament is restricted to clubs from ${countryName}. Your club's country does not match.`);
        return;
      }
    }

    // Check credits
    if (!takeoverClub && (clubData?.credits ?? 0) < entryCost) {
      await swalAlert(`Your club doesn't have enough credits to join this tournament. Need ${entryCost} club credits.`);
      return;
    }

    // Check STC
    if (entryFeeSTC > 0 && (clubData?.stc ?? 0) < entryFeeSTC) {
      await swalAlert(`Your club doesn't have enough STC to join this tournament. Need ${entryFeeSTC.toLocaleString()} STC, have ${(clubData?.stc ?? 0).toLocaleString()} STC.`);
      return;
    }

    // Lock both credits and STC
    try {
      const res = await registerTournamentClub(tournament.id, effectiveId, registrationProofUrl);
      
      if (!res.data.success) {
        await swalAlert(res.data.error || 'Registration failed');
        return;
      }

      const { new_club_stc, new_club_credits } = res.data;
      setAllClubs(prev => prev.map(c =>
        c.id === effectiveId
          ? { ...c, stc: new_club_stc ?? c.stc, credits: new_club_credits ?? c.credits }
          : c
      ));

      const updated = [...current, effectiveId];
      setTournament(prev => ({ ...prev, registered_clubs: updated }));
      setClubs(allClubs.filter(c => updated.includes(c.id)));

      // Notify all club players about registration
      notifyTournamentRegistration(tournament.id, effectiveId).catch(() => {});

      if (updated.length >= tournament.max_teams) {
        await swalAlert("Tournament is full. The creator or an admin can now generate the draw and start it officially.");
      }
      setRegistrationProofUrl("");
    } catch (err) {
      await swalAlert('Registration failed: ' + (err?.message || 'Unknown error'));
    }
  }

  async function registerPlayer() {
    if (!myPlayer || !tournament) return;
    if (!registrationProofUrl) {
      await swalAlert("Upload your Ultimate Team photo before registering.");
      return;
    }
    const entryCost = tournament.entry_credits ?? 50;
    const entryFeeSTC = tournament.entry_fee_stc ?? 0;
    const currentCredits = myPlayer.credits ?? 50;
    if (currentCredits < entryCost) { await swalAlert("Not enough credits."); return; }
    if (entryFeeSTC > 0 && (myPlayer.stc ?? 0) < entryFeeSTC) {
      await swalAlert(`Not enough STC. Need ${entryFeeSTC.toLocaleString()} STC.`);
      return;
    }
    if (tournament.start_date && new Date(tournament.start_date) < new Date()) {
      await swalAlert("Registration is closed.");
      return;
    }
    try {
      const res = await registerTournamentPlayer(tournament.id, myPlayer.id, registrationProofUrl);
      if (!res.data.success) {
        await swalAlert(res.data.error || 'Registration failed');
        return;
      }
      const updated = [...(tournament.registered_players || []), myPlayer.id];
      setMyPlayer(prev => ({
        ...prev,
        credits: res.data.new_player_credits ?? prev.credits,
        stc: res.data.new_player_stc ?? prev.stc,
      }));
      setTournament(prev => ({ ...prev, registered_players: updated }));
      setRegistrationProofUrl("");
    } catch (err) {
      await swalAlert('Registration failed: ' + (err?.message || 'Unknown error'));
    }
  }

  async function generateDraw() {
    if (!tournament) return;
    if (registeredCount < 2) { await swalAlert("Need at least 2 registered participants to generate a draw."); return; }
    try {
      const result = await generateTournamentDraw(id, tournament, registeredClubs);
      if (result.tournament) setTournament(prev => ({ ...prev, ...result.tournament }));
      setMatches(result.matches || []);
    } catch (err) {
      await swalAlert(err?.message || "Could not generate draw.");
    }
  }

  async function clearDraw() {
    if (!(await swalConfirm("Clear the current draw? This will delete all generated matchups."))) return;
    await clearTournamentDraw(matches);
    setMatches([]);
  }

  async function initializeTournament(t, registeredClubs) {
    if (!(await swalConfirm("Start this tournament officially? Registered players will be notified."))) return;
    try {
      const result = await initializeTournamentDraw(id, t, registeredClubs);
      setTournament(prev => ({ ...prev, ...(result.tournament || result.tournamentPatch) }));
      setMatches(result.matches);
      await swalAlert(`Tournament started. ${result.notified || 0} players notified.`);
    } catch (err) {
      await swalAlert(err?.message || "Could not start tournament.");
    }
  }

  async function _scheduleAllMatches() {
    if (!isOrganizer || !tournament) return;
    const unscheduledMatches = matches.filter(m => !m.scheduled_date);
    if (unscheduledMatches.length === 0) {
      await swalAlert("All matches are already scheduled.");
      return;
    }
    const baseDate = new Date(tournament.start_date || new Date());
    const shuffled = [...unscheduledMatches].sort(() => Math.random() - 0.5);
    const timeStep = 2 * 60 * 60 * 1000;
    for (let i = 0; i < shuffled.length; i++) {
      const schedDate = new Date(baseDate.getTime() + i * timeStep);
      await stageClient.entities.Match.update(shuffled[i].id, { scheduled_date: toMysqlDateTime(schedDate) });
    }
    const refreshed = await fetchTournamentMatches(id);
    setMatches(refreshed);
    await swalAlert(`Scheduled ${shuffled.length} matches starting from ${baseDate.toLocaleString()}!`);
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
          <p className="text-xs font-black uppercase tracking-widest text-foreground">Group Draw</p>
          <p className="text-[11px] text-muted-foreground">Top teams advance into the knockout bracket.</p>
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
  await swalAlert("Result submitted! Opponent has 24h to confirm.");
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
        club_id: myPlayer.club_id,
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
    if (!myPlayer?.club_id) return;
    await stageClient.entities.Match.update(match.id, {
      forfeit_claimed_by: myPlayer.club_id,
      forfeit_proof_url: proofUrl || null,
      forfeit_status: "pending",
      status: "disputed",
      admin_notes: `Forfeit claimed by ${myPlayer.club_id === match.home_club_id ? match.home_club_name : match.away_club_name}`,
    });
    const refreshed = await fetchTournamentMatches(id);
    setMatches(refreshed);
    setForfeitDialogOpen(false);
    setForfeitMatch(null);
    setForfeitProof("");
    await swalAlert("Forfeit claim submitted. An admin will review and approve.");
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
      ? `Withdraw from the tournament? Entry credits + ${entryFeeSTC.toLocaleString()} STC will be refunded.`
      : "Withdraw from the tournament? Entry credits will be refunded.";
    if (!(await swalConfirm(confirmMsg))) return;

    const clubData = takeoverClub || allClubs.find(c => c.id === effectiveId);
    const res = await withdrawTournamentClub(tournament.id, effectiveId);
    if (!res?.data?.success) {
      await swalAlert(res?.data?.error || "Withdrawal failed");
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
    if (!(await swalConfirm("Are you sure you want to cancel this tournament? This cannot be undone."))) return;
    const res = await cancelTournamentById(id);
    if (!res?.data?.success) {
      await swalAlert(res?.data?.error || 'Cancellation failed');
      return;
    }
    // Reload clubs so the info strip reflects the refunded balances
    const freshClubs = await stageClient.entities.Club.list("-rating", 200).catch(() => allClubs);
    setAllClubs(freshClubs);
    setTournament(prev => ({ ...prev, status: "cancelled" }));
  }

  async function deleteTournament() {
    if (!(await swalConfirm("Permanently DELETE this tournament and all its matches? This cannot be undone."))) return;
    try {
      const res = await deleteTournamentById(id);
      if (!res?.data?.success) {
        await swalAlert(res?.data?.error || "Tournament deletion failed");
        return;
      }
      window.location.href = "/tournaments";
    } catch (err) {
      await swalAlert(err?.data?.error || err?.message || "Tournament deletion failed");
    }
  }

  async function advanceRound() {
    if (advancingRound) return;
    setAdvancingRound(true);
    try {
      const shouldCreateFinalAndThirdPlace = advanceButtonLabel === "Create Final & 3rd Place";
      const result = shouldCreateFinalAndThirdPlace
        ? await createTournamentFinalAndThirdPlace(id)
        : await advanceTournamentRound(id);
      setMatches(result.matches || []);
      if (result.tournament) setTournament(result.tournament);
      setVisibleRound(result.tournament?.current_round ?? null);
      if (shouldCreateFinalAndThirdPlace) {
        await swalAlert(result.skipped_existing
          ? "Final and 3rd place match are already created."
          : "Final and 3rd place match are ready.");
      }
    } catch (err) {
      await swalAlert(err?.data?.error || err?.message || "Could not start the next round.");
    } finally {
      setAdvancingRound(false);
    }
  }

  async function officializeCurrentTournament() {
    if (!(await swalConfirm("Officialize this tournament, distribute prize money, and award the trophy?"))) return;
    try {
      const result = await officializeTournament(id);
      setMatches(result.matches || []);
      if (result.tournament) setTournament(result.tournament);
      await swalAlert("Tournament officialized. Prize money and trophy have been awarded.");
    } catch (err) {
      await swalAlert(err?.data?.error || err?.message || "Could not officialize the tournament.");
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!tournament) return <div className="p-6 lg:p-10 text-center"><p className="text-muted-foreground">Tournament not found.</p><Link to="/tournaments"><Button variant="outline" className="mt-4">Back</Button></Link></div>;

  const isPlayerTournament = tournament.participant_type === "player";
  const registeredClubs = allClubs.filter(c => tournament.registered_clubs?.includes(c.id));
  const effectiveClubId = takeoverClub ? takeoverClub.id : myPlayer?.club_id;
  const myClubRegistered = tournament.registered_clubs?.includes(effectiveClubId);
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
  const knockoutHasResults = knockoutMatches.some(m => m.status === "completed" || m.status === "forfeit");
  const qualifiedGroupClubIds = new Set(
    groupStandingsData.flatMap(group => (group.standings || []).slice(0, 2).map(club => String(club.id)))
  );
  const expectedGroupKnockoutMatchCount = groupStandingsData
    .flatMap(group => (group.standings || []).slice(0, 2))
    .length;
  const groupKnockoutNeedsRepair = isGroupStageTournament
    && groupStageComplete
    && knockoutStarted
    && !knockoutHasResults
    && (
      knockoutMatches.length !== expectedGroupKnockoutMatchCount
      || knockoutMatches.some((match) => {
        const homeId = String(match.home_club_id || "");
        const awayId = String(match.away_club_id || "");
        return !homeId || !awayId || homeId === awayId || !qualifiedGroupClubIds.has(homeId) || !qualifiedGroupClubIds.has(awayId);
      })
    );
  const canStartGroupNextRound = canManageTournament
    && tournament.status === "in_progress"
    && groupStageComplete
    && (!knockoutStarted || groupKnockoutNeedsRepair);
  const currentRoundMatches = matches.filter(m => Number(m.round) === Number(tournament.current_round || 1));
  const currentRoundComplete = currentRoundMatches.length > 0
    && currentRoundMatches.every(m => m.status === "completed" || m.status === "forfeit");
  const canAdvanceActiveRound = canManageTournament
    && tournament.status === "in_progress"
    && currentRoundComplete
    && knockoutStarted
    && !groupKnockoutNeedsRepair;
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
  const activeRoundType = String(currentRoundMatches[0]?.type || "").toLowerCase();
  const advanceButtonLabel = !finalMatch && activeRoundType === "semi_final"
    ? "Create Final & 3rd Place"
    : "Advance Tournament";
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
    if (matchType === "ucl_league" || matchType === "league") return `Matchday ${round}`;
    if (matchType === "ucl_playoff") return "Playoffs";
    if (matchType === "ucl_r16") return "Round of 16";
    if (matchType === "ucl_qf") return "Quarter-Finals";
    if (matchType === "ucl_sf") return "Semi-Finals";
    if (matchType === "round_of_16") return "Round of 16";
    if (matchType === "quarter_final") return "Quarter-Finals";
    if (matchType === "semi_final") return "Semi-Finals";
    if (matchType === "third_place") return "Third Place";
    if (matchType === "final") return "Final";
    if (matchType === "swiss") return `Round ${round}`;
    // Fallback: for generic tournaments infer from total rounds
    const totalRounds = rounds.length;
    const roundIndex = rounds.indexOf(round);
    const remaining = totalRounds - 1 - roundIndex;
    if (remaining === 0) return "Final";
    if (remaining === 1) return "Semi-Finals";
    if (remaining === 2) return "Quarter-Finals";
    if (remaining === 3) return "Round of 16";
    return `Round ${round}`;
  }

  // Determine the "current" round to show by default (latest with incomplete or last)
  const activeRound = (() => {
    if (visibleRound !== null) return visibleRound;
    const incomplete = rounds.find(r => matches.filter(m => m.round === r).some(m => m.status !== "completed" && m.status !== "forfeit"));
    return incomplete ?? rounds[rounds.length - 1] ?? null;
  })();
  const currentRoundMatches = activeRound === null
    ? []
    : matches.filter(m => Number(m.round) === Number(activeRound));
  const currentRoundComplete = currentRoundMatches.length > 0
    && currentRoundMatches.every(m => m.status === "completed" || m.status === "forfeit");
  const activeRoundType = String(currentRoundMatches[0]?.type || "").toLowerCase();
  const canAdvanceActiveRound = canManageTournament
    && tournament.status === "in_progress"
    && currentRoundComplete
    && knockoutStarted
    && !groupKnockoutNeedsRepair;
  const advanceButtonLabel = !finalMatch && activeRoundType === "semi_final"
    ? "Create Final & 3rd Place"
    : "Advance Tournament";
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
    { value: "bracket", label: "Bracket / Matches" },
    ...(tournament.type === "group_stage" ? [{ value: "standings", label: "Group Standings" }] : []),
    ...(tournament.type === "league" ? [{ value: "league_standings", label: "League Table" }] : []),
    ...(tournament.type === "swiss_ucl" ? [{ value: "ucl_standings", label: "SL Table" }] : []),
    { value: "leaderboard", label: "Stats" },
    { value: "teams", label: isPlayerTournament ? "Players" : "Teams" },
    ...(isAdmin && matches.some(m => m.status === "disputed")
      ? [{ value: "admin", label: `Disputes (${matches.filter(m => m.status === "disputed").length})`, danger: true }]
      : []),
  ];

  return (
    <div className="min-h-screen">
      {/* ── HERO ─────────────────────────────────────── */}
      <div className="relative w-full overflow-hidden" style={heroStyle}>
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/40 to-black/85 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 lg:px-8">
          <button type="button" onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/90 transition-colors pt-4 pb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Tournaments
          </button>

          <div className="flex flex-col sm:flex-row items-end gap-5 pb-8 pt-2">
            {tournament.trophy_url && (
              <div className="shrink-0 hidden sm:block">
                <img src={tournament.trophy_url} alt="Trophy"
                  className="w-24 h-24 object-contain drop-shadow-[0_0_24px_rgba(251,191,36,0.8)] animate-pulse-glow" />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border"
                  style={{ borderColor: `${accentColor}60`, color: accentColor, backgroundColor: `${accentColor}18` }}>
                  {tournament.type?.replace(/_/g, " ")}
                </span>
                <span className={cn("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border",
                  tournament.status === "registration" ? "border-success/50 text-success bg-success/10" :
                  tournament.status === "in_progress" ? "border-primary/50 text-primary bg-primary/10" :
                  tournament.status === "completed" ? "border-warning/50 text-warning bg-warning/10" :
                  "border-white/20 text-white/50 bg-white/5"
                )}>
                  {tournament.status?.replace(/_/g, " ")}
                </span>
                {tournament.platform && <span className="text-[10px] text-white/40 uppercase tracking-widest">{tournament.platform}</span>}
                {tournament.region && <span className="text-[10px] text-white/40 uppercase tracking-widest">{tournament.region}</span>}
                {tournament.country_code && (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-warning/40 text-warning bg-warning/10">
                    🌍 {COUNTRIES.find(c => c.code === tournament.country_code)?.name || tournament.country_code}
                  </span>
                )}
              </div>

              <h1 className="font-heading font-black text-3xl sm:text-5xl lg:text-6xl uppercase text-white leading-none tracking-tight"
                style={{ transform: "skewX(-6deg)", textShadow: "0 2px 32px rgba(0,0,0,0.9)" }}>
                {tournament.name}
              </h1>
              {tournament.description && (
                <p className="text-sm text-white/55 mt-2 max-w-xl line-clamp-2">{tournament.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-white/55">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {registeredCount}/{tournament.max_teams} {isPlayerTournament ? "players" : "teams"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {tournament.start_date ? new Date(tournament.start_date).toLocaleDateString() : "TBD"}
                </span>
                {isAdmin && (
                  <Link to={isPlayerTournament ? `/tournaments/${id}/players` : `/tournaments/${id}/clubs`}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/25 border border-primary/40 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/35 transition-colors">
                    <Users className="w-3 h-3" /> {isPlayerTournament ? "Registered Players" : "Registered Clubs"}
                  </Link>
                )}
              </div>
            </div>

            <div className="shrink-0 flex flex-col gap-2 items-stretch sm:items-end">
              {!isPlayerTournament && tournament.status === "registration" && (myPlayer?.club_id || takeoverClub) && !myClubRegistered && !isFull && (() => {
                const clubData = takeoverClub || allClubs.find(c => c.id === myPlayer?.club_id);
                const entryCost = tournament.entry_credits ?? 50;
                const entryFeeSTC = tournament.entry_fee_stc ?? 0;
                const canAfford = (clubData?.credits ?? 0) >= entryCost && (clubData?.stc ?? 0) >= entryFeeSTC;
                return (
                  <>
                    {renderRegistrationProofUpload("club")}
                    <Button onClick={registerClub} disabled={uploadingRegistrationProof || !registrationProofUrl || (!takeoverClub && !canAfford)}
                      className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg">
                      <Shield className="w-4 h-4 mr-2" />
                      {takeoverClub ? `Register ${takeoverClub.name}` : "Register My Club"}
                      <span className="ml-1 opacity-70 text-xs">({entryCost}✧{entryFeeSTC > 0 ? ` + ${entryFeeSTC.toLocaleString()}STC` : ""})</span>
                    </Button>
                  </>
                );
              })()}

              {isPlayerTournament && tournament.status === "registration" && myPlayer && !myPlayerRegistered && !isFull && (
                <>
                  {renderRegistrationProofUpload("player")}
                  <Button onClick={registerPlayer} disabled={uploadingRegistrationProof || !registrationProofUrl || (myPlayer.credits ?? 50) < (tournament.entry_credits ?? 50)}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg">
                    <Users className="w-4 h-4 mr-2" /> Register as Player
                    <span className="ml-1 opacity-70 text-xs">({tournament.entry_credits ?? 50}✧)</span>
                  </Button>
                </>
              )}

              {!isPlayerTournament && myClubRegistered && tournament.status === "registration" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-success flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" /> {takeoverClub ? `${takeoverClub.name} registered` : "Registered"}
                  </span>
                  <Button size="sm" variant="outline" onClick={withdrawFromTournament}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 bg-transparent text-xs h-7">
                    Withdraw
                  </Button>
                </div>
              )}
              {isPlayerTournament && myPlayerRegistered && tournament.status === "registration" && (
                <span className="text-xs text-success flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Registered</span>
              )}

              {(tournament.custom_rules || tournament.rules_file_url) && (
                <Button type="button" variant="outline" size="sm" onClick={() => {
                  if (tournament.rules_file_url && !tournament.custom_rules) window.open(tournament.rules_file_url, '_blank');
                  else setRulesModalOpen(true);
                }} className="border-white/20 text-white/60 hover:bg-white/10 bg-transparent text-xs">
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                  {tournament.rules_file_url && !tournament.custom_rules ? "Download Rules" : "View Rules"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── INFO STRIP ────────────────────────────────── */}
      {(tournament.entry_fee_stc > 0 || (!isPlayerTournament && myPlayer?.club_id)) && (
        <div className="border-b border-border bg-card/60">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2.5 flex flex-wrap items-center gap-5">
            {tournament.entry_fee_stc > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <Coins className="w-3.5 h-3.5" />
                Prize: {tournament.prize_pool_stc
                  ? `${tournament.prize_pool_stc.toLocaleString()} STC`
                  : `${(tournament.entry_fee_stc * registeredCount).toLocaleString()} STC`}
                {tournament.prize_winner_stc && (
                  <span className="text-success/55 ml-1">
                    (1st: {tournament.prize_winner_stc.toLocaleString()} | 2nd: {(tournament.prize_runner_up_stc || 0).toLocaleString()} | 3rd: {(tournament.prize_semi_final_stc || 0).toLocaleString()})
                  </span>
                )}
              </span>
            )}
            {!isPlayerTournament && myPlayer?.club_id && (() => {
              const myClubData = allClubs.find(c => c.id === myPlayer.club_id);
              if (!myClubData) return null;
              return (
                <>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Shield className="w-3 h-3 text-warning" /> Credits: <strong className="text-warning">{(myClubData.credits ?? 0).toLocaleString()}</strong>
                  </span>
                  {(tournament.entry_fee_stc ?? 0) > 0 && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Coins className="w-3 h-3 text-success" /> STC: <strong className="text-success">{(myClubData.stc ?? 0).toLocaleString()}</strong>
                    </span>
                  )}
                </>
              );
            })()}
            {/* Player tournament registration */}
            {isPlayerTournament && tournament.status === "registration" && myPlayer && !myPlayerRegistered && !isFull && (
              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                {renderRegistrationProofUpload("player")}
                <Button onClick={registerPlayer} className="bg-accent text-accent-foreground leading-relaxed hover:bg-accent/90" disabled={uploadingRegistrationProof || !registrationProofUrl || (myPlayer.credits ?? 50) < (tournament.entry_credits ?? 50) || ((tournament.entry_fee_stc ?? 0) > 0 && (myPlayer.stc ?? 0) < (tournament.entry_fee_stc ?? 0))}>
                  <Users className="w-4 h-4 mr-2" /> Register as Player <span className="ml-1 opacity-70 text-xs">({tournament.entry_credits ?? 50} credits{(tournament.entry_fee_stc ?? 0) > 0 ? ` + ${(tournament.entry_fee_stc ?? 0).toLocaleString()} STC` : ''})</span>
                </Button>
              </div>
            )}

            {canStartGroupNextRound && (
              <Button type="button" onClick={advanceRound} disabled={advancingRound} size="sm"
                className="bg-success/10 text-success border border-success/30 text-xs animate-pulse">
                <Play className="w-3 h-3 mr-1.5" /> {advancingRound ? "Working..." : groupKnockoutNeedsRepair ? "Repair Knockout Round" : "Start Next Round"}
              </Button>
            )}

            {canAdvanceActiveRound && !canOfficializeTournament && (
              <Button type="button" onClick={advanceRound} disabled={advancingRound} size="sm"
                className="bg-success/10 text-success border border-success/30 text-xs animate-pulse">
                <Play className="w-3 h-3 mr-1.5" /> {advancingRound ? "Working..." : advanceButtonLabel}
              </Button>
            )}

            {canOfficializeTournament && (
              <Button type="button" onClick={officializeCurrentTournament} size="sm"
                className="bg-warning/15 text-warning border border-warning/40 text-xs animate-pulse">
                <Trophy className="w-3 h-3 mr-1.5" /> Officialize Tournament
              </Button>
            )}

            {canManageTournament && ["registration", "in_progress"].includes(tournament.status) && registeredCount >= 2 && matches.length === 0 && (
              <Button type="button" onClick={generateDraw} size="sm" className="bg-primary/10 text-primary border border-primary/30 text-xs hover:bg-primary/20">
                🎲 Generate Draw
              </Button>
            )}

            {canManageTournament && ["registration", "in_progress"].includes(tournament.status) && matches.length > 0 && !allMatchesPlayed && !groupStageComplete && (
              <Button type="button" onClick={clearDraw} size="sm" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10 text-xs">
                🔄 Regenerate Draw
              </Button>
            )}

            {canManageTournament && tournament.status === "registration" && registeredCount >= 2 && (
              <Button type="button" onClick={() => initializeTournament(tournament, registeredClubs)} size="sm"
                className="bg-primary text-primary-foreground text-xs">
                <Play className="w-3 h-3 mr-1.5" /> Start Tournament
              </Button>
            )}

            {canManageTournament && ["registration", "in_progress"].includes(tournament.status) && !allMatchesPlayed && (
              <Button type="button" onClick={cancelTournament} size="sm" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10 text-xs">
                Cancel
              </Button>
            )}

            {canManageTournament && !allMatchesPlayed && (
              <Button type="button" onClick={() => setEditDialogOpen(true)} size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 text-xs">
                Edit
              </Button>
            )}

            {isAdmin && ["cancelled", "registration", "completed"].includes(tournament.status) && (
              <Button type="button" onClick={deleteTournament} size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs">
                {tournament.status === "completed" ? "End & Delete" : "Delete"}
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
              <p className="text-[10px] uppercase tracking-widest text-warning/50 font-black">Champion</p>
              <h2 className="font-heading text-lg font-black text-warning uppercase leading-tight truncate"
                style={{ transform: "skewX(-4deg)" }}>
                {winnerClub.name}
              </h2>
              {winnerPoints !== null && <p className="text-xs text-warning/55">{winnerPoints} points · {winnerClub.platform}</p>}
            </div>
            {(winnerClub.owner_email === user?.email || (takeoverClub && takeoverClub.id === tournament.winner_club_id)) && !winnerConferenceDone && (
              <Button type="button" onClick={() => setWinnerPressRoomOpen(true)} size="sm"
                className="shrink-0 bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20 text-xs">
                🎙️ Press Conference
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── TAB NAVIGATION ────────────────────────────── */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex gap-0 overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.value} type="button" onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "shrink-0 px-4 pb-3 pt-2.5 text-[11px] uppercase tracking-widest font-bold border-b-2 transition-all whitespace-nowrap",
                  activeTab === tab.value
                    ? tab.danger ? "border-destructive text-destructive" : "border-primary text-primary"
                    : tab.danger
                      ? "border-transparent text-destructive/70 hover:text-destructive"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                {tab.label}
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
              <span className="text-xs font-heading uppercase tracking-widest text-primary font-bold">⭐ UCL Controls</span>
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
                  Next phase will be generated automatically after result processing.
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                Phase: <strong className="text-foreground capitalize">{tournament.ucl_phase || "league"}</strong>
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
                ? <p className="text-muted-foreground text-sm">Use the <span className="text-primary font-semibold">Generate Draw</span> button above to preview matchups.</p>
                : <p className="text-muted-foreground text-sm">Bracket will appear once the tournament starts.</p>
              }
            </div>
          ) : hasKnockoutTree ? (
            <div className="bg-card border border-border rounded-2xl p-6">
              {tournament.status === "registration" && matches.length > 0 && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary flex items-center gap-2">
                  Draw preview — tournament has not started yet.
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
                onDressingRoom={(match) => { setDressingRoomMatch(match); setDressingRoomOpen(true); }}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {tournament.status === "registration" && matches.length > 0 && (
                <div className="px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary flex items-center gap-2">
                  Draw preview — tournament has not started yet.
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
                                    className="bg-destructive/10 text-destructive text-xs border border-destructive/30 h-6 px-2">Resolve</Button>
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
                                <Button size="sm" type="button" variant="outline" onClick={() => { setDressingRoomMatch(match); setDressingRoomOpen(true); }}
                                  className="border-primary/20 text-primary/80 hover:bg-primary/5 text-xs h-7">Dressing Room</Button>
                                <Button size="sm" type="button" variant="outline" onClick={() => { setScheduleMatch(match); setScheduleDate(toDatetimeLocalValue(match.scheduled_date)); setScheduleDialogOpen(true); }}
                                  className="border-border text-xs text-muted-foreground h-7">Schedule</Button>
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
                                  className="border-primary/30 text-primary hover:bg-primary/5 text-xs h-7">Stream</Button>
                                <Button size="sm" type="button" variant="outline" onClick={() => { setForfeitMatch(match); setForfeitDialogOpen(true); }}
                                  className="border-destructive/30 text-destructive text-xs h-7">
                                  <Flag className="w-3 h-3 mr-1" /> Forfeit
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
                  <p className="text-muted-foreground text-sm">No players registered yet.</p>
                </div>
              );
              return <PlayerRegistrantList playerIds={registeredPlayerIds} />;
            })()
          ) : (
            registeredClubs.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-10 text-center">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No teams registered yet.</p>
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
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" /> Disputes & Forfeit Requests
            </h3>
            {matches.filter(m => m.status === "disputed").length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-10 text-center">
                <Check className="w-10 h-10 text-success mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">No disputed matches. All clear!</p>
              </div>
            ) : (
              matches.filter(m => m.status === "disputed").map(match => (
                <div key={match.id} className="bg-card border border-destructive/30 rounded-xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-foreground">{match.home_club_name} vs {match.away_club_name}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-black uppercase tracking-widest">
                      {match.forfeit_claimed_by ? "Forfeit Claim" : "Disputed"}
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
                        className="bg-warning/10 text-warning border border-warning/30 text-xs">✅ Approve Forfeit</Button>
                    )}
                    <Button size="sm" type="button" onClick={() => { setActiveDispute(match); setDisputeDialogOpen(true); }}
                      className="bg-destructive/10 text-destructive border border-destructive/30 text-xs">Set Final Score</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* ── DIALOGS (all unchanged) ────────────────────── */}
      <MatchStatsModal match={statsMatch} open={statsModalOpen} onClose={() => { setStatsModalOpen(false); setStatsMatch(null); }} />

      {winnerPressRoomOpen && winnerClub && (
        <TournamentWinnerPressRoomDialog
          open={winnerPressRoomOpen}
          onClose={() => { setWinnerPressRoomOpen(false); setWinnerConferenceDone(true); }}
          tournament={tournament}
          winnerClub={winnerClub}
          user={user}
        />
      )}

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
            <DialogTitle className="text-xl text-warning">Claim Forfeit Win</DialogTitle>
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
                <Flag className="w-4 h-4 mr-2" /> Submit Forfeit Claim
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-xl text-destructive">Resolve Disputed Match</DialogTitle>
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
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Admin Notes</label>
                <Input value={disputeForm.admin_notes} onChange={e => setDisputeForm(f => ({ ...f, admin_notes: e.target.value }))}
                  className="bg-secondary border-border text-xs" placeholder="Reason for decision..." />
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
            <DialogTitle className="text-xl">Add Live Stream Link</DialogTitle>
          </DialogHeader>
          {streamMatch && (
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">{streamMatch.home_club_name} vs {streamMatch.away_club_name}</p>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">Stream URL</label>
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

      <Dialog open={dressingRoomOpen} onOpenChange={setDressingRoomOpen}>
        <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">🪑 Dressing Room</DialogTitle>
          </DialogHeader>
          {dressingRoomMatch && (
            <DressingRoom clubId={myClubId} currentPlayerEmail={user?.email} isAdmin={isAdmin} />
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
