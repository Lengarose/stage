import { useState, useEffect, useMemo } from "react";
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
  acceptTournamentRules,
  copyOrCreateTournamentInviteLink,
  registerTournamentClub,
  registerTournamentPlayer,
  simulateTournamentScore,
  withdrawTournamentClub,
} from "@/api/tournamentActions";
import { Trophy, ArrowLeft, Users, Calendar, Shield, Check, Play, Flag, BookOpen, Download, Coins, ExternalLink, Image as ImageIcon, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  calculateGroupStandings,
  getLeagueTournamentFixtureMatches,
  getSwissUclDisplayMatches,
  matchSide,
  matchWinnerSide,
  sameParticipant,
} from "../lib/tournamentEngine";
import { COUNTRIES } from "../lib/countries";
import TournamentStages from "../components/TournamentStages";
import { canScheduleTournamentMatch } from "@/lib/tournamentStages";
import TournamentStandingsTabs from "../components/TournamentStandingsTabs";
import TournamentLeaderboard from "../components/TournamentLeaderboard";
import MatchStatsModal from "../components/MatchStatsModal";
import EditTournamentDialog from "../components/EditTournamentDialog";
import PlayerRegistrantList from "../components/PlayerRegistrantList";
import { isWallClockPast, toMysqlDateTime, toDatetimeLocalValue } from "@/lib/momentDate";
import { swalAlert, swalConfirm } from "@/lib/swal";
import { getTournamentEntryCost } from "@/lib/subscriptionUtils";
import { getClubManagerEmails } from "@/lib/scheduleEngine";
import { createInboxEventId } from "@/lib/inboxEventId";
import { tournamentGameDayWebPath } from "@/lib/tournamentGameDay";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveTournamentRules } from "@/lib/tournamentRuleTemplates";
import { isGostOfficialTournament, isTournamentOwner } from "@/lib/tournamentOwnership";

function requiresClubTournamentAdminReview(tournament) {
  if (!tournament || tournament.participant_type === "player") return false;
  return !String(tournament.creator_gamertag || "").trim();
}

export default function TournamentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, language } = useTranslation();
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
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleMatch, setScheduleMatch] = useState(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [statsMatch, setStatsMatch] = useState(null);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [groupStandingsData, setGroupStandingsData] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeDispute, setActiveDispute] = useState(null);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [disputeForm, setDisputeForm] = useState({ home_score: "", away_score: "", admin_notes: "" });
  const [forfeitMatch, setForfeitMatch] = useState(null);
  const [forfeitDialogOpen, setForfeitDialogOpen] = useState(false);
  const [forfeitProof, setForfeitProof] = useState("");
  const [clubRegistrationOpen, setClubRegistrationOpen] = useState(false);
  const [eaClubName, setEaClubName] = useState("");
  const [registeringClub, setRegisteringClub] = useState(false);

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

  const [isCreator, setIsCreator] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rulesChecked, setRulesChecked] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [streamMatch, setStreamMatch] = useState(null);
  const [streamDialogOpen, setStreamDialogOpen] = useState(false);
  const [streamUrl, setStreamUrl] = useState("");
  const [takeoverClub, setTakeoverClub] = useState(null);
  const [activeTab, setActiveTab] = useState("bracket");
  const [inviteBusy, setInviteBusy] = useState(false);

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
          fetchTournamentMatches(id).then(rows => ({ rows, error: null })).catch(error => ({ rows: [], error: error.message || 'Could not load the complete tournament fixture feed.' })),
        ]);
        const t = tData[0] || null;
        setTournament(t ? { ...t, standings_load_error: matchData.error } : null);
        setAllClubs(clubData);
        setMatches(matchData.rows);
        if (t) {
          setClubs(clubData.filter(c => t.registered_clubs?.includes(c.id)));
        }
        if (myPl) {
          setMyPlayer(myPl);
        }

        setIsBasic(u?.role === "admin");
        setTournamentEntryCost(u?.role === "admin" ? 0 : getTournamentEntryCost());
        setIsAdmin(u?.role === "admin");
        setIsCreator(isTournamentOwner(t, u, myPl));
        if (u?.role === "admin") {
          const tcId = localStorage.getItem('admin_takeover_club_id');
          if (tcId) {
            const tcArr = await stageClient.entities.Club.filter({ id: tcId }).catch(() => []);
            if (tcArr.length > 0) {
              setTakeoverClub(tcArr[0]);
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
      const standings = calculateGroupStandings(matches, tournament.num_groups || 2, tournament.participant_type);
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
  }, [matches, tournament?.type, tournament?.num_groups, tournament?.participant_type]);

  useEffect(() => {
    let stopped = false;
    async function refreshTournament() {
      try {
        const [nextTournament, nextMatches] = await Promise.all([fetchTournamentPublic(id), fetchTournamentMatches(id)]);
        if (!stopped) { setTournament(nextTournament); setMatches(nextMatches); }
      } catch (error) {
        if (!stopped) setTournament(previous => previous ? { ...previous, standings_load_error: error.message || 'Complete fixture feed unavailable' } : previous);
      }
    }
    const timer = window.setInterval(refreshTournament, 15000);
    window.addEventListener("focus", refreshTournament);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener("focus", refreshTournament); };
  }, [id]);

  async function registerClub() {
    const effectiveId = takeoverClub ? takeoverClub.id : (myClub?.id || myPlayer?.club_id);
    if (!effectiveId || !tournament) return;
    if (!hasSavedRulesAcceptance) {
      await swalAlert(t("tournamentDetail.saveRulesFirst") || "Save your rules acceptance before registering.");
      return;
    }
    const requiresAdminReview = requiresClubTournamentAdminReview(tournament);
    const cleanEaClubName = eaClubName.trim();
    if (requiresAdminReview && !cleanEaClubName) {
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
      const res = await registerTournamentClub(
        tournament.id,
        effectiveId,
        {
          ...(requiresAdminReview ? { eaClubName: cleanEaClubName } : {}),
          rulesAccepted: true,
          tournament,
        },
      );
      
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
      } else {
        await swalAlert("Club registered. This tournament is now visible in your club fixtures.");
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
    if (!tournament) return;
    if (!myPlayer) {
      await swalAlert(t("tournamentDetail.needPlayerProfile") || "Create your player profile before registering.");
      return;
    }
    if (!hasSavedRulesAcceptance) {
      await swalAlert(t("tournamentDetail.saveRulesFirst") || "Save your rules acceptance before registering.");
      return;
    }
    const entryCost = tournament.entry_credits ?? 50;
    const entryFeeSTC = tournament.entry_fee_stc ?? 0;
    const currentCredits = user?.credits ?? 0;
    if (currentCredits < entryCost) {
      await swalAlert(t("tournamentDetail.notEnoughCredits"));
      return;
    }
    if (entryFeeSTC > 0 && (myPlayer.stc ?? 0) < entryFeeSTC) {
      await swalAlert(t("tournamentDetail.notEnoughStc", { amount: entryFeeSTC.toLocaleString() }));
      return;
    }
    if (isWallClockPast(tournament.start_date)) {
      await swalAlert(t("tournamentDetail.registrationClosed"));
      return;
    }
    try {
      const res = await registerTournamentPlayer(tournament.id, myPlayer.id, {
        rulesAccepted: true,
        rulesTemplateId: tournament.rules_template_id || null,
        tournament,
      });
      if (!res?.data?.success) {
        await swalAlert(res?.data?.error || t("tournamentDetail.registrationFailed"));
        return;
      }
      const updated = [...(tournament.registered_players || []).map(String), String(myPlayer.id)];
      setMyPlayer((prev) => ({
        ...prev,
        stc: res.data.new_player_stc ?? prev.stc,
      }));
      if (res.data.new_user_credits != null) {
        setUser((prev) => (prev ? { ...prev, credits: res.data.new_user_credits } : prev));
      }
      setTournament((prev) => ({ ...prev, registered_players: updated }));
      await swalAlert(t("tournamentDetail.registered") || "Registered successfully.");
    } catch (err) {
      await swalAlert(t("tournamentDetail.registrationFailed") + ": " + (err?.message || t("tournamentDetail.unknownError")));
    }
  }

  async function saveRulesAcceptance() {
    if (!tournament || !rulesChecked || savingRules) return;
    setSavingRules(true);
    try {
      const payload = isPlayerTournament
        ? {
            playerId: myPlayer?.id,
            rulesAccepted: true,
            rulesTemplateId: tournament.rules_template_id || rules?.templateId || null,
            tournament,
          }
        : {
            clubId: takeoverClub?.id || myClub?.id || myPlayer?.club_id,
            rulesAccepted: true,
            rulesTemplateId: tournament.rules_template_id || rules?.templateId || null,
            tournament,
          };
      if (isPlayerTournament && !payload.playerId) {
        await swalAlert(t("tournamentDetail.needPlayerProfile") || "Create your player profile before registering.");
        return;
      }
      if (!isPlayerTournament && !payload.clubId) {
        await swalAlert(t("tournamentDetail.needClub") || "Join or create a club before registering.");
        return;
      }
      const res = await acceptTournamentRules(tournament.id, payload);
      if (!res?.data?.success) {
        await swalAlert(res?.data?.error || t("tournamentDetail.rulesSaveFailed") || "Could not save rules acceptance.");
        return;
      }
      setTournament((prev) => ({
        ...(prev || {}),
        registration_proofs: res.data.registration_proofs || prev?.registration_proofs,
      }));
      setRulesChecked(true);
    } catch (err) {
      await swalAlert((t("tournamentDetail.rulesSaveFailed") || "Could not save rules acceptance.") + ": " + (err?.message || t("tournamentDetail.unknownError")));
    } finally {
      setSavingRules(false);
    }
  }

  async function copyInviteLink() {
    if (!tournament) return;
    const allowed = isTournamentOwner(tournament, user, myPlayer);
    if (!allowed) return;
    setInviteBusy(true);
    try {
      const url = await copyOrCreateTournamentInviteLink(id);
      try {
        await navigator.clipboard.writeText(url);
        await swalAlert(t("tournamentDetail.inviteLinkCopied"));
      } catch {
        await swalAlert(`${t("tournamentDetail.inviteLinkCopied")}\n${url}`);
      }
    } catch (err) {
      await swalAlert(err?.message || t("tournamentDetail.inviteLinkFailed"));
    } finally {
      setInviteBusy(false);
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

  async function proposeSchedule() {
    if (!scheduleMatch || !scheduleDate) return;
    if (!canScheduleTournamentMatch(scheduleMatch, tournament, user, myPlayer, allClubs)) {
      await swalAlert("Only the home team can propose the tournament fixture time.");
      return;
    }

    const proposedDate = toMysqlDateTime(scheduleDate);
    if (!proposedDate) {
      await swalAlert("Choose a valid date and time.");
      return;
    }

    const awayPlayer = tournament.participant_type === "player"
      ? await stageClient.entities.Player.get(scheduleMatch.away_player_id).catch(() => null)
      : null;
    const awayEmails = tournament.participant_type === "player"
      ? [scheduleMatch.away_player_email || awayPlayer?.email].filter(Boolean)
      : await getClubManagerEmails(scheduleMatch.away_club_id);
    if (!awayEmails.length) {
      await swalAlert(tournament?.participant_type === "player"
        ? "Could not find the away player to notify."
        : "Could not find an away club manager to notify.");
      return;
    }

    const homeName = scheduleMatch.home_player_name || scheduleMatch.home_club_name || myClub?.name || "Home participant";
    const awayName = scheduleMatch.away_player_name || scheduleMatch.away_club_name || "Away participant";
    const displayDate = new Date(scheduleDate).toLocaleString();

    try {
      await stageClient.entities.Match.update(scheduleMatch.id, {
        scheduling_status: "home_proposed",
        home_proposed_date: proposedDate,
        away_proposed_date: null,
        last_proposed_by: "home",
        proposal_count: Number(scheduleMatch.proposal_count || 0) + 1,
      });
    } catch (error) {
      await swalAlert(error?.message || "This fixture cannot be scheduled yet.");
      return;
    }

    await Promise.all(awayEmails.map((email) => {
      const event_id = createInboxEventId();
      return stageClient.functions.invoke("sendInboxMessage", {
        recipient_email: email,
        sender_email: user?.email || myPlayer?.email || null,
        sender_gamertag: myPlayer?.gamertag || myClub?.name || homeName,
        sender_avatar_url: myClub?.logo_url || myPlayer?.avatar_url || null,
        sender_club_name: myClub?.name || homeName,
        subject: `Tournament fixture time proposed: ${homeName} vs ${awayName}`,
        body: `${homeName} proposed ${displayDate} for ${tournament?.name || "this tournament"}.\n\nAccept or decline this time from your inbox. If you decline, the fixture stays open and the home team can propose another time.`,
        message_type: "tournament_schedule",
        action_type: "accept_decline",
        event_id,
        related_entity_id: scheduleMatch.id,
        related_entity_type: "tournament_match_schedule",
        metadata: {
          match_id: scheduleMatch.id,
          tournament_id: tournament?.id || id,
          proposed_date: proposedDate,
          fixture_type: "tournament",
          match_context: tournament?.name || "Tournament fixture",
          home_club_id: scheduleMatch.home_club_id,
          home_club_name: homeName,
          away_club_id: scheduleMatch.away_club_id,
          away_club_name: awayName,
        },
        send_notification: true,
      });
    }));

    const refreshed = await fetchTournamentMatches(id);
    setMatches(refreshed);
    setScheduleDialogOpen(false);
    setScheduleMatch(null);
    setScheduleDate("");
    await swalAlert("Schedule proposal sent to the away team.");
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

  function openGameDay(match) {
    if (!match?.id) return;
    navigate(tournamentGameDayWebPath(match.id));
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
    if (!(await swalConfirm(['completed','archived'].includes(tournament.status)?'Archive this tournament? Results, honours and financial history will be preserved.':t("tournamentDetail.deleteConfirm")))) return;
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

  async function stampMatchWinner(match) {
    if (!match?.id) return;
    const result = matchWinnerSide(match, tournament?.participant_type);
    if (result !== "home" && result !== "away") return;
    const winner = matchSide(match, result, tournament?.participant_type);
    const loser = matchSide(match, result === "home" ? "away" : "home", tournament?.participant_type);
    if (!winner.id) return;
    if (tournament?.participant_type === "player") {
      if (sameParticipant(match.winner_player_id, winner.id)) return;
      await stageClient.entities.Match.update(match.id, {
        winner_player_id: winner.id,
        winner_player_name: winner.name,
        loser_player_id: loser.id,
        loser_player_name: loser.name,
      });
      return;
    }
    if (sameParticipant(match.winner_club_id, winner.id)) return;
    await stageClient.entities.Match.update(match.id, {
      winner_club_id: winner.id,
      winner_club_name: winner.name,
      loser_club_id: loser.id,
      loser_club_name: loser.name,
    });
  }

  async function officializeCurrentTournament() {
    if (!(await swalConfirm(t("tournamentDetail.officializeConfirm")))) return;
    try {
      const latestFinal = matches.find(match => String(match.type || "").toLowerCase() === "final");
      const latestThird = matches.find(match => ["third_place", "third-place", "bronze"].includes(String(match.type || "").toLowerCase()));
      await stampMatchWinner(latestFinal);
      await stampMatchWinner(latestThird);
      const result = await officializeTournament(id);
      setMatches(result.matches || []);
      if (result.tournament) setTournament(result.tournament);
      await swalAlert(t("tournamentDetail.officializeSuccess"));
    } catch (err) {
      await swalAlert(err?.data?.error || err?.message || t("tournamentDetail.officializeFailed"));
    }
  }

  async function endLeagueTournament() {
    if (!(await swalConfirm("End this league tournament from the final table?"))) return;
    try {
      const result = await advanceTournamentRound(id);
      if (result.matches) setMatches(result.matches);
      if (result.tournament) setTournament(result.tournament);
      setActiveTab("league_standings");
      await swalAlert(`${result.winner?.name || "The table leader"} is champion. Prizes and trophies have been processed.`);
    } catch (err) {
      await swalAlert(err?.data?.error || err?.message || "Could not end tournament.");
    }
  }

  const rules = useMemo(
    () => (tournament ? resolveTournamentRules(tournament, language) : null),
    [tournament, language],
  );

  if (loading) return <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  if (!tournament) return <div className="p-6 lg:p-10 text-center"><p className="text-muted-foreground">{t("tournamentDetail.tournamentNotFound")}</p><Link to="/tournaments"><Button variant="outline" className="mt-4">{t("tournamentDetail.back")}</Button></Link></div>;

  const isPlayerTournament = tournament.participant_type === "player";
  const requiresClubRegistrationReview = requiresClubTournamentAdminReview(tournament);
  const registeredClubs = allClubs.filter(c => tournament.registered_clubs?.includes(c.id));
  const effectiveClub = takeoverClub || myClub || allClubs.find(c => c.id === myPlayer?.club_id) || null;
  const effectiveClubId = effectiveClub?.id || null;
  const myClubRegistered = tournament.registered_clubs?.includes(effectiveClubId);
  const clubRegistrationProofs = tournament.registration_proofs?.club || {};
  const playerRegistrationProofs = tournament.registration_proofs?.player || {};
  const myClubRegistrationProof = effectiveClubId ? clubRegistrationProofs[String(effectiveClubId)] : null;
  const myPlayerRegistrationProof = myPlayer?.id ? playerRegistrationProofs[String(myPlayer.id)] : null;
  const myClubRegistrationStatus = String(myClubRegistrationProof?.status || "").toLowerCase();
  const myClubRegistrationPending = myClubRegistrationStatus === "pending";
  const myPlayerRegistered = (tournament.registered_players || []).map(String).includes(String(myPlayer?.id || ""));
  const hasSavedRulesAcceptance = Boolean(
    isPlayerTournament
      ? myPlayerRegistrationProof?.rules_accepted_at
      : myClubRegistrationProof?.rules_accepted_at
  );
  const registeredCount = isPlayerTournament
    ? (tournament.registered_players?.length || 0)
    : (tournament.registered_clubs?.length || 0);
  const isFull = registeredCount >= tournament.max_teams;
  const entryCreditsNeeded = tournament.entry_credits ?? 50;
  const entryStcNeeded = tournament.entry_fee_stc ?? 0;
  const canAffordPlayerEntry =
    (user?.credits ?? 0) >= entryCreditsNeeded
    && (entryStcNeeded <= 0 || (myPlayer?.stc ?? 0) >= entryStcNeeded);
  const showRegistrationConsent = tournament.status === "registration" && !isFull && (
    (!isPlayerTournament && effectiveClubId && !myClubRegistered && !myClubRegistrationPending)
    || (isPlayerTournament && myPlayer && !myPlayerRegistered)
  );
  const showRulesConsentPanel = showRegistrationConsent && rules?.body && !hasSavedRulesAcceptance;
  const isOrganizer = isTournamentOwner(tournament, user, myPlayer);
  const canManageTournament = tournament.status!=='archived' && (isAdmin || isCreator || isOrganizer);
  const canShareInvite = isGostOfficialTournament(tournament)
    ? isAdmin && String(tournament.status || "").toLowerCase() !== "cancelled"
    : isOrganizer && String(tournament.status || "").toLowerCase() !== "cancelled";
  const isLeagueTournament = tournament.type === "league";
  const isGroupStageTournament = tournament.type === "group_stage";
  const leagueMatches = isLeagueTournament
    ? getLeagueTournamentFixtureMatches(matches)
    : [];
  const fixtureMatches = isLeagueTournament ? leagueMatches : matches;
  const visibleFixtureMatches = tournament.type === "swiss_ucl"
    ? getSwissUclDisplayMatches(matches)
    : fixtureMatches;
  const leagueMatchesComplete = leagueMatches.length > 0
    && leagueMatches.every(m => m.status === "completed" || m.status === "forfeit");
  const tournamentWinnerId = isPlayerTournament ? tournament.winner_player_id : tournament.winner_club_id;
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
  const finalResult = finalMatch && ["completed", "forfeit"].includes(String(finalMatch.status || ""))
    ? matchWinnerSide(finalMatch, tournament.participant_type)
    : null;
  const finalWinner = finalResult === "home" || finalResult === "away"
    ? matchSide(finalMatch, finalResult, tournament.participant_type)
    : null;
  const finalWinnerId = finalWinner?.id || (isPlayerTournament ? finalMatch?.winner_player_id : finalMatch?.winner_club_id);
  const thirdPlaceResult = thirdPlaceMatch && ["completed", "forfeit"].includes(String(thirdPlaceMatch.status || ""))
    ? matchWinnerSide(thirdPlaceMatch, tournament.participant_type)
    : null;
  const thirdPlaceWinnerId = (thirdPlaceResult === "home" || thirdPlaceResult === "away")
    ? matchSide(thirdPlaceMatch, thirdPlaceResult, tournament.participant_type).id
    : (isPlayerTournament ? thirdPlaceMatch?.winner_player_id : thirdPlaceMatch?.winner_club_id);
  const finalComplete = Boolean(finalMatch && ["completed", "forfeit"].includes(String(finalMatch.status || "")) && finalWinnerId);
  const thirdPlaceComplete = !thirdPlaceMatch || Boolean(["completed", "forfeit"].includes(String(thirdPlaceMatch.status || "")) && thirdPlaceWinnerId);
  const canOfficializeTournament = canManageTournament
    && !isLeagueTournament
    && tournament.status === "in_progress"
    && finalComplete
    && thirdPlaceComplete;
  const canEndLeagueTournament = canManageTournament
    && isLeagueTournament
    && tournament.status === "in_progress"
    && leagueMatchesComplete
    && !tournamentWinnerId;
  const allMatchesPlayed = visibleFixtureMatches.length > 0
    && visibleFixtureMatches.every(m => m.status === "completed" || m.status === "forfeit")
    && (!isGroupStageTournament || knockoutStarted);
  const winnerClub = allMatchesPlayed && tournament.winner_club_id ? clubs.find(c => c.id === tournament.winner_club_id) || allClubs.find(c => c.id === tournament.winner_club_id) : null;
  const championName = isPlayerTournament
    ? (tournament.winner_player_name || finalWinner?.name || "")
    : (tournament.winner_club_name || winnerClub?.name || finalWinner?.name || "");
  // Compute winner points for display
  const winnerPoints = (() => {
    if (!allMatchesPlayed || !tournament.winner_club_id) return null;
    let pts = 0;
    visibleFixtureMatches.forEach(m => {
      const hs = m.home_score ?? 0, as_ = m.away_score ?? 0;
      if (m.home_club_id === tournament.winner_club_id) pts += hs > as_ ? 3 : hs === as_ ? 1 : 0;
      if (m.away_club_id === tournament.winner_club_id) pts += as_ > hs ? 3 : as_ === hs ? 1 : 0;
    });
    return pts;
  })();


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
    { value: "bracket", label: "Stages" },
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
    <div className="h-full min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-background">
      {/* ── HERO CONTENT ──────────────────────────────── */}
      <div className="relative border-b border-cyan-400/10 bg-[#050b14]">
        <div className="absolute inset-0" style={heroStyle} />
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
              {showRulesConsentPanel && (
                <div className="w-full max-w-md bg-black/35 p-4 text-left ring-1 ring-white/10"
                  style={{ clipPath: "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)" }}>
                  <p className="font-heading text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">{rules.title}</p>
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">{rules.body}</p>
                  </div>
                  {rules.rulesFileUrl && (
                    <a href={rules.rulesFileUrl} target="_blank" rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-cyan-200 hover:text-white">
                      <Download className="w-3.5 h-3.5" /> {rules.fileLabel}
                    </a>
                  )}
                  <label className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-white">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-cyan-300"
                      checked={rulesChecked}
                      onChange={(event) => setRulesChecked(event.target.checked)}
                    />
                    <span>{rules.acceptanceLabel}</span>
                  </label>
                  <Button
                    type="button"
                    onClick={saveRulesAcceptance}
                    disabled={!rulesChecked || savingRules}
                    className="mt-3 h-10 w-full rounded-none bg-cyan-400 text-black hover:bg-cyan-300 disabled:opacity-55"
                    style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}
                  >
                    {savingRules
                      ? (t("tournamentDetail.savingRules") || "Saving...")
                      : (t("tournamentDetail.saveRules") || "Save")}
                  </Button>
                </div>
              )}
              {hasSavedRulesAcceptance && showRegistrationConsent && (
                <span className="inline-flex items-center gap-1.5 text-xs text-success">
                  <Check className="w-3.5 h-3.5" />
                  {t("tournamentDetail.rulesSaved") || "Rules accepted"}
                </span>
              )}
              {!isPlayerTournament && tournament.status === "registration" && effectiveClubId && !myClubRegistered && !myClubRegistrationPending && !isFull && (() => {
                const clubData = effectiveClub;
                const entryCost = tournament.entry_credits ?? 50;
                const entryFeeSTC = tournament.entry_fee_stc ?? 0;
                const canAfford = (user?.credits ?? 0) >= entryCost && (clubData?.stc ?? 0) >= entryFeeSTC;
                return (
                    <Button
                      onClick={() => {
                        if (requiresClubRegistrationReview) {
                          setClubRegistrationOpen(true);
                        } else {
                          registerClub();
                        }
                      }}
                      disabled={registeringClub || !hasSavedRulesAcceptance || (!takeoverClub && !canAfford)}
                      className="h-10 min-w-[210px] rounded-none border border-cyan-200/25 bg-black/24 px-7 font-heading text-xs font-black uppercase tracking-[0.12em] text-cyan-50/95 shadow-[0_0_24px_-16px_rgba(0,229,255,0.9)] backdrop-blur-md transition-all hover:border-cyan-200/55 hover:bg-cyan-300/10 hover:text-white hover:shadow-[0_0_24px_-10px_rgba(0,229,255,0.9)] focus-visible:ring-2 focus-visible:ring-cyan-300/50 disabled:border-white/10 disabled:text-white/45 disabled:opacity-55"
                      style={{ clipPath: "polygon(8% 0, 100% 0, 92% 100%, 0 100%)" }}>
                      {registeringClub ? "Registering..." : (takeoverClub ? t("tournamentDetail.registerClubNamed", { name: takeoverClub.name }) : t("tournamentDetail.registerMyClub"))}
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
                <Button
                  type="button"
                  onClick={registerPlayer}
                  disabled={!hasSavedRulesAcceptance || !canAffordPlayerEntry}
                  className="h-12 rounded-none bg-gradient-to-r from-cyan-500 to-blue-500 px-5 font-heading text-sm font-black uppercase tracking-wide text-white shadow-[0_0_24px_rgba(34,211,238,0.18)] hover:from-cyan-400 hover:to-blue-400 disabled:opacity-55"
                  style={{ clipPath: "polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" }}
                >
                    <Users className="w-4 h-4 mr-2" /> {t("tournamentDetail.registerAsPlayer")}
                    <span className="ml-1 opacity-70 text-xs">({entryCreditsNeeded}✧{entryStcNeeded > 0 ? ` + ${entryStcNeeded.toLocaleString()} STC` : ""})</span>
                  </Button>
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

              {(rules?.body || tournament.rules_file_url) && (
                <Button type="button" variant="outline" size="sm" onClick={() => setRulesModalOpen(true)} className="rounded-none border-white/15 bg-black/25 text-xs text-white/60 hover:bg-white/10"
                  style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}>
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                  {t("tournamentDetail.viewRules")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {canShareInvite && (
        <div className="border-y border-cyan-300/25 bg-cyan-300/5">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-cyan-50/90">
              {t("tournamentDetail.inviteLinkHint")}
            </p>
            <Button
              type="button"
              onClick={copyInviteLink}
              disabled={inviteBusy}
              className="h-10 rounded-none bg-cyan-400 px-5 font-heading text-xs font-black uppercase tracking-[0.12em] text-black hover:bg-cyan-300 disabled:opacity-55"
              style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}
            >
              <Link2 className="w-4 h-4 mr-2" />
              {inviteBusy ? t("tournamentDetail.copyingInvite") : t("tournamentDetail.inviteLink")}
            </Button>
          </div>
        </div>
      )}

      {/* ── INFO STRIP ────────────────────────────────── */}
      {(tournament.entry_fee_stc > 0 || effectiveClubId || (isPlayerTournament && myPlayer) || canManageTournament) && (
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
            {isPlayerTournament && myPlayer && (
              <>
                <span className="inline-flex min-h-10 items-center gap-2 bg-black/20 px-4 text-xs text-white/65 ring-1 ring-cyan-300/10"
                  style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}>
                  <Shield className="w-3 h-3 text-amber-300" />
                  <span className="font-heading uppercase tracking-[0.16em] text-white/40">{t("tournamentDetail.credits")}</span>
                  <strong className={cn("text-amber-200", (user?.credits ?? 0) < entryCreditsNeeded && "text-red-300")}>
                    {(user?.credits ?? 0).toLocaleString()}
                  </strong>
                  <span className="text-white/35">/ {entryCreditsNeeded}</span>
                </span>
                {entryStcNeeded > 0 && (
                  <span className="inline-flex min-h-10 items-center gap-2 bg-black/20 px-4 text-xs text-white/65 ring-1 ring-cyan-300/10"
                    style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}>
                    <Coins className="w-3 h-3 text-amber-300" />
                    <span className="font-heading uppercase tracking-[0.16em] text-white/40">STC</span>
                    <strong className={cn("text-amber-200", (myPlayer?.stc ?? 0) < entryStcNeeded && "text-red-300")}>
                      {(myPlayer?.stc ?? 0).toLocaleString()}
                    </strong>
                    <span className="text-white/35">/ {entryStcNeeded.toLocaleString()}</span>
                  </span>
                )}
              </>
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
                <Button
                  type="button"
                  onClick={registerPlayer}
                  className="h-10 rounded-none bg-cyan-400 text-black leading-relaxed hover:bg-cyan-300 disabled:opacity-55"
                  style={{ clipPath: "polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)" }}
                  disabled={!hasSavedRulesAcceptance || !canAffordPlayerEntry}
                >
                  <Users className="w-4 h-4 mr-2" /> {t("tournamentDetail.registerAsPlayer")} <span className="ml-1 opacity-70 text-xs">({entryCreditsNeeded} credits{entryStcNeeded > 0 ? ` + ${entryStcNeeded.toLocaleString()} STC` : ""})</span>
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

            {canEndLeagueTournament && (
              <Button type="button" onClick={endLeagueTournament} size="sm"
                className="h-9 rounded-none border border-amber-300/30 bg-amber-300/10 text-xs text-amber-200 hover:bg-amber-300/15"
                style={{ clipPath: "polygon(9px 0, 100% 0, calc(100% - 9px) 100%, 0 100%)" }}>
                <Trophy className="w-3 h-3 mr-1.5" /> End Tournament
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
                {['completed','archived'].includes(tournament.status) ? 'Archive' : t("tournamentDetail.delete")}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── CHAMPION BANNER ───────────────────────────── */}
      {championName && (
        <div className="border-b border-warning/25 bg-gradient-to-r from-warning/8 via-warning/12 to-transparent">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex items-center gap-4">
            {tournament.trophy_url && (
              <img src={tournament.trophy_url} alt="Trophy"
                className="w-12 h-12 object-contain shrink-0 drop-shadow-[0_0_16px_rgba(251,191,36,0.9)] animate-pulse-glow" />
            )}
            <div className="w-11 h-11 rounded-xl border-2 border-warning/40 overflow-hidden bg-secondary shrink-0">
              {winnerClub?.logo_url
                ? <img src={winnerClub.logo_url} alt={championName} className="w-full h-full object-cover" style={{ objectPosition: winnerClub.logo_position || "50% 50%" }} />
                : <Trophy className="w-5 h-5 text-warning m-3" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-warning/50 font-black">{t("tournamentDetail.champion")}</p>
              <h2 className="font-heading text-lg font-black text-warning uppercase leading-tight truncate"
                style={{ transform: "skewX(-4deg)" }}>
                {championName}
              </h2>
              {winnerPoints !== null && winnerClub && <p className="text-xs text-warning/55">{t("tournamentDetail.pointsPlatform", { points: winnerPoints, platform: winnerClub.platform })}</p>}
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


        {activeTab === "bracket" && (
          <TournamentStages
            tournament={tournament} matches={visibleFixtureMatches} clubs={allClubs} user={user} player={myPlayer} isAdmin={isAdmin}
            onSchedule={match => { setScheduleMatch(match); setScheduleDate(toDatetimeLocalValue(match.scheduled_date || match.home_proposed_date)); setScheduleDialogOpen(true); }}
            onGameDay={openGameDay}
            onStats={match => { setStatsMatch(match); setStatsModalOpen(true); }}
            onSimulate={simulateScore}
            onResolve={match => { setActiveDispute(match); setDisputeDialogOpen(true); }}
            renderStandings={stage => <div className="[&_*]:!rounded-none [&_*]:![clip-path:none]"><TournamentStandingsTabs tournament={tournament} matches={matches} registeredClubs={registeredClubs} groupStandingsData={groupStandingsData} activeTab={stage === "group" ? "standings" : tournament.type === "swiss_ucl" ? "ucl_standings" : "league_standings"} /></div>}
          />
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
                <div className="relative overflow-hidden border border-cyan-200/15 bg-[#07121f]/90 p-10 text-center"
                  style={{ clipPath: "polygon(18px 0, 100% 0, calc(100% - 18px) 100%, 0 100%)" }}>
                  <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/55 to-transparent" />
                  <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">{t("commonPages.cdNoPlayers")}</p>
                </div>
              );
              return <PlayerRegistrantList playerIds={registeredPlayerIds} />;
            })()
          ) : (
            registeredClubs.length === 0 ? (
              <div className="relative overflow-hidden border border-cyan-200/15 bg-[#07121f]/90 p-10 text-center"
                style={{ clipPath: "polygon(18px 0, 100% 0, calc(100% - 18px) 100%, 0 100%)" }}>
                <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/55 to-transparent" />
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">{t("commonPages.tdNoTeams")}</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {registeredClubs.map((club, i) => (
                  <Link key={club.id} to={`/clubs/${club.id}`} className="block group">
                    <div className="relative flex min-h-[86px] items-center gap-3 overflow-hidden border border-cyan-200/12 bg-[#07121f]/90 p-4 transition-all hover:border-cyan-200/35 hover:bg-cyan-300/[0.045]"
                      style={{ clipPath: "polygon(14px 0, 100% 0, calc(100% - 14px) 100%, 0 100%)" }}>
                      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-slate-200/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                      <span className="flex h-8 w-9 shrink-0 items-center justify-center border border-cyan-200/15 bg-white/[0.04] text-xs font-black text-muted-foreground"
                        style={{ clipPath: "polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%)" }}>{i + 1}</span>
                      <div className="w-11 h-11 bg-secondary border border-cyan-200/15 overflow-hidden shrink-0"
                        style={{ clipPath: "polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)" }}>
                        {club.logo_url
                          ? <img src={club.logo_url} alt={club.name} className="w-full h-full object-cover" style={{ objectPosition: club.logo_position || "50% 50%" }} />
                          : <Shield className="w-5 h-5 text-muted-foreground m-2.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-heading text-sm font-black uppercase tracking-wide text-foreground truncate">{club.name} <span className="text-xs text-primary font-mono">[{club.tag}]</span></p>
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
            {rules?.body && (
              <div className="bg-secondary/50 rounded-xl p-4">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{rules.body}</p>
              </div>
            )}
            {rules?.rulesFileUrl && (
              <a href={rules.rulesFileUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-4 py-3 rounded-xl border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 transition-colors font-medium text-sm">
                <Download className="w-4 h-4" /> {rules.fileLabel}
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
              disabled={registeringClub || !hasSavedRulesAcceptance || (requiresClubRegistrationReview && !eaClubName.trim())}
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

      <Dialog open={scheduleDialogOpen} onOpenChange={(open) => {
        setScheduleDialogOpen(open);
        if (!open) {
          setScheduleMatch(null);
          setScheduleDate("");
        }
      }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{t("nav.schedule")}</DialogTitle>
          </DialogHeader>
          {scheduleMatch && (
            <div className="space-y-4 mt-2">
              <div className="rounded-xl border border-border/70 bg-secondary/30 p-3">
                <p className="text-sm font-bold text-foreground">
                  {scheduleMatch.home_player_name || scheduleMatch.home_club_name} vs {scheduleMatch.away_player_name || scheduleMatch.away_club_name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Home team proposes the date and time. Away team accepts or declines from their inbox.
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1">
                  Proposed date and time
                </label>
                <Input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(event) => setScheduleDate(event.target.value)}
                  className="bg-secondary border-border"
                />
              </div>
              <Button
                type="button"
                onClick={proposeSchedule}
                disabled={!scheduleDate}
                className="w-full bg-primary text-primary-foreground"
              >
                Send to Away Team
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
    </div>
  );
}
