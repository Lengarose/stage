import { useState, useEffect } from "react";
import TournamentResultDialog from "../components/TournamentResultDialog";
import { useParams, Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { stageClient } from "@/api/stageClient";
import { Trophy, ArrowLeft, Users, Calendar, Crown, Shield, Check, Play, AlertTriangle, Flag, BookOpen, Download, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  generateKnockoutRound1, generateLeagueMatches, generateGroupStageMatches,
  generateNextKnockoutRound, calculateGroupStandings,
  generateUCLLeaguePhase, calculateUCLStandings, generateUCLPlayoffMatches, generateUCLKnockoutLegs, getAggregateWinner
} from "../lib/tournamentEngine";
import { COUNTRIES } from "../lib/countries";
import { awardTournamentTrophy } from "@/lib/awardTrophy";
import { seedClubs } from "@/lib/rankingEngine";
import KnockoutBracket from "../components/KnockoutBracket";
import TournamentStandingsTabs from "../components/TournamentStandingsTabs";
import TournamentLeaderboard from "../components/TournamentLeaderboard";
import MatchStatsModal from "../components/MatchStatsModal";
import EditTournamentDialog from "../components/EditTournamentDialog";
import TournamentCountdown from "../components/TournamentCountdown";
import PlayerRegistrantList from "../components/PlayerRegistrantList";
import DressingRoom from "../components/DressingRoom";
import TournamentWinnerPressRoomDialog from "../components/TournamentWinnerPressRoomDialog";

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
  const [resultForm, setResultForm] = useState({ home_score: "", away_score: "", video_url: "" });
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

  useEffect(() => {
    async function load() {
      try {
        const isAuthed = await stageClient.auth.isAuthenticated().catch(() => false);
        if (!isAuthed) return;
        const u = await stageClient.auth.me().catch(() => null);
        if (!u) return;
        setUser(u);

        // Each call gets its own fallback so a single failure can never block
        // the rest of the page from rendering — the spinner used to stick
        // forever when (for example) the tournament id was stale and the
        // backend returned a non-2xx the SDK didn't recover from.
        const [tData, clubData, matchData, plData] = await Promise.all([
          stageClient.entities.Tournament.filter({ id }, null, 1).catch(() => []),
          stageClient.entities.Club.list("-rating", 200).catch(() => []),
          stageClient.entities.Match.filter({ tournament_id: id }, "round").catch(() => []),
          stageClient.entities.Player.filter({ email: u.email }).catch(() => []),
        ]);
        const t = tData[0] || null;
        setTournament(t);
        setAllClubs(clubData);
        setMatches(matchData);
        if (t) {
          setClubs(clubData.filter(c => t.registered_clubs?.includes(c.id)));
        }
        if (plData.length > 0) {
          setMyPlayer(plData[0]);
          if (plData[0].club_id) {
            const clubPlayers = await stageClient.entities.Player.filter({ club_id: plData[0].club_id }).catch(() => []);
            setMyClubPlayers(clubPlayers);
          }
        }

        const subs = await stageClient.entities.UserPurchase
          .filter({ buyer_email: u.email, item_type: "subscription" })
          .catch(() => []);
        const subIds = subs.map(s => s.item_id);
        const isElite = subIds.includes("sub_elite");
        const isPro = subIds.includes("sub_pro") || isElite;
        setIsBasic(u.role === "admin" || isPro);
        const cost = u.role === "admin" ? 0 : isElite ? 30 : isPro ? 40 : 50;
        setTournamentEntryCost(cost);
        setIsAdmin(u.role === "admin");
        setIsCreator(t?.creator_email === u.email);
        if (t?.status === 'completed' && t?.winner_club_id) {
          const existingConfs = await stageClient.entities.PressConference
            .filter({ match_id: t.id })
            .catch(() => []);
          setWinnerConferenceDone(existingConfs.some(c => c.context === 'tournament_winner'));
        }
        if (u.role === "admin") {
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

    const unsub = stageClient.entities.Match.subscribe((event) => {
      if (event.data?.tournament_id === id) {
        stageClient.entities.Match.filter({ tournament_id: id }, "round").then(setMatches);
      }
    });

    return () => { unsub(); };
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
      alert("Registration is closed. This tournament's start date has already passed.");
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
        alert(`This tournament is restricted to clubs from ${countryName}. Your club's country does not match.`);
        return;
      }
    }

    // Check credits
    if (!takeoverClub && (clubData?.credits ?? 0) < entryCost) {
      alert(`Your club doesn't have enough credits to join this tournament. Need ${entryCost} club credits.`);
      return;
    }

    // Check STC
    if (entryFeeSTC > 0 && (clubData?.stc ?? 0) < entryFeeSTC) {
      alert(`Your club doesn't have enough STC to join this tournament. Need ${entryFeeSTC.toLocaleString()} STC, have ${(clubData?.stc ?? 0).toLocaleString()} STC.`);
      return;
    }

    // Lock both credits and STC
    try {
      const res = await stageClient.functions.invoke('tournamentRegistration', {
        tournament_id: tournament.id,
        club_id: effectiveId,
      });
      
      if (!res.data.success) {
        alert(res.data.error || 'Registration failed');
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
      stageClient.functions.invoke('tournamentRegistrationNotify', {
        action: 'register',
        tournament_id: tournament.id,
        club_id: effectiveId,
      }).catch(() => {}); // fire-and-forget

      if (updated.length >= tournament.max_teams) {
        await initializeTournament({ ...tournament, registered_clubs: updated }, allClubs.filter(c => updated.includes(c.id)));
      }
    } catch (err) {
      alert('Registration failed: ' + (err?.message || 'Unknown error'));
    }
  }

  async function generateDraw() {
    if (!tournament) return;
    const t = tournament;
    const seededClubs = seedClubs(allClubs.filter(c => t.registered_clubs?.includes(c.id)));
    if (seededClubs.length < 2) { alert("Need at least 2 registered teams to generate a draw."); return; }
    let generatedMatches = [];
    const type = t.type;
    const numGroups = type === "group_stage" ? Math.max(1, Math.ceil(seededClubs.length / 4)) : (t.num_groups || 2);
    if (type === "knockout") generatedMatches = generateKnockoutRound1(seededClubs);
    else if (type === "league") generatedMatches = generateLeagueMatches(seededClubs);
    else if (type === "group_stage") generatedMatches = generateGroupStageMatches(seededClubs, numGroups);
    else if (type === "double_elimination") generatedMatches = generateKnockoutRound1(seededClubs);
    else if (type === "swiss_ucl") generatedMatches = generateUCLLeaguePhase(seededClubs);
    await base44.entities.Match.bulkCreate(generatedMatches.map(m => ({ ...m, tournament_id: id, status: "scheduled" })));
    await base44.entities.Tournament.update(id, { num_groups: numGroups });
    const newMatches = await base44.entities.Match.filter({ tournament_id: id }, "round");
    setMatches(newMatches);
  }

  async function clearDraw() {
    if (!window.confirm("Clear the current draw? This will delete all generated matchups.")) return;
    await Promise.all(matches.map(m => stageClient.entities.Match.delete(m.id)));
    setMatches([]);
  }

  async function initializeTournament(t, registeredClubs) {
    // If draw already generated, just start the tournament
    const existingMatches = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
    if (existingMatches.length > 0) {
      await stageClient.entities.Tournament.update(id, { status: "in_progress", current_round: 1 });
      setTournament(prev => ({ ...prev, status: "in_progress", current_round: 1 }));
      setMatches(existingMatches);
      return;
    }
    const seededClubs = seedClubs(registeredClubs);
    let generatedMatches = [];
    const type = t.type;
    const numGroups = type === "group_stage" ? Math.max(1, Math.ceil(seededClubs.length / 4)) : (t.num_groups || 2);
    if (type === "knockout") generatedMatches = generateKnockoutRound1(seededClubs);
    else if (type === "league") generatedMatches = generateLeagueMatches(seededClubs);
    else if (type === "group_stage") generatedMatches = generateGroupStageMatches(seededClubs, numGroups);
    else if (type === "double_elimination") generatedMatches = generateKnockoutRound1(seededClubs);
    else if (type === "swiss_ucl") generatedMatches = generateUCLLeaguePhase(seededClubs);

    await stageClient.entities.Match.bulkCreate(generatedMatches.map(m => ({ ...m, tournament_id: id })));
    await stageClient.entities.Tournament.update(id, { status: "in_progress", current_round: 1, num_groups: numGroups });
    setTournament(prev => ({ ...prev, status: "in_progress", current_round: 1, num_groups: numGroups }));

    // Assign groups for group stage tournaments
    if (type === "group_stage") {
      const groupAssignments = {};
      for (let g = 0; g < numGroups; g++) {
        const startIdx = g * Math.ceil(registeredClubs.length / numGroups);
        const endIdx = Math.min(startIdx + Math.ceil(registeredClubs.length / numGroups), registeredClubs.length);
        groupAssignments[`groupA`] = registeredClubs.slice(startIdx, endIdx).map(c => c.id);
        if (g === 1) groupAssignments[`groupB`] = registeredClubs.slice(startIdx, endIdx).map(c => c.id);
      }
      await stageClient.functions.invoke('assignGroups', { tournamentId: id, groupAssignments });
    }

    const newMatches = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
    setMatches(newMatches);
  }

  async function _scheduleAllMatches() {
    if (!isOrganizer || !tournament) return;
    const unscheduledMatches = matches.filter(m => !m.scheduled_date);
    if (unscheduledMatches.length === 0) {
      alert("All matches are already scheduled.");
      return;
    }
    const baseDate = new Date(tournament.start_date || new Date());
    const shuffled = [...unscheduledMatches].sort(() => Math.random() - 0.5);
    const timeStep = 2 * 60 * 60 * 1000;
    for (let i = 0; i < shuffled.length; i++) {
      const schedDate = new Date(baseDate.getTime() + i * timeStep);
      await stageClient.entities.Match.update(shuffled[i].id, { scheduled_date: schedDate.toISOString() });
    }
    const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
    setMatches(refreshed);
    alert(`Scheduled ${shuffled.length} matches starting from ${baseDate.toLocaleString()}!`);
  }

  async function _proposeSchedule() {
    if (!scheduleMatch || !scheduleDate) return;
    const schedDate = new Date(scheduleDate);
    await stageClient.entities.Match.update(scheduleMatch.id, { scheduled_date: schedDate.toISOString() });
    const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
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
    const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
    setMatches(refreshed);
    setDisputeDialogOpen(false);
    setActiveDispute(null);
    setDisputeForm({ home_score: "", away_score: "", admin_notes: "" });
  }

  /*async function submitResult() {
    if (!activeMatch) return;
    const hs = parseInt(resultForm.home_score);
    const as_ = parseInt(resultForm.away_score);
    if (isNaN(hs) || isNaN(as_)) return;

    // Stats validation: total goals must not exceed the submitted score
    const myGoals = Object.values(playerStats).reduce((sum, s) => sum + (s.goals || 0), 0);
    const isHome = activeMatch.home_club_id === myPlayer?.club_id;
    const myScore = isHome ? hs : as_;
    if (myGoals > myScore) {
      alert(`Total goals entered (${myGoals}) exceeds your team's score (${myScore}). Please check the stats.`);
      return;
    }

    const submittedScore = `${hs}-${as_}`;
    const otherSubmitted = isHome ? activeMatch.result_away_submitted : activeMatch.result_home_submitted;
    const otherScore = isHome ? activeMatch.away_submitted_score : activeMatch.home_submitted_score;
    const proofData = resultForm.proof_url ? { proof_url: resultForm.proof_url } : {};
    const now = new Date().toISOString();
    const mySubmitData = isHome
      ? { result_home_submitted: true, home_submitted_score: submittedScore, ...proofData }
      : { result_away_submitted: true, away_submitted_score: submittedScore, ...proofData };

    if (otherSubmitted && otherScore) {
      if (otherScore === submittedScore) {
        // Both agree → complete
        const winnerId = hs > as_ ? activeMatch.home_club_id : as_ > hs ? activeMatch.away_club_id : null;
        await stageClient.entities.Match.update(activeMatch.id, {
          ...mySubmitData, home_score: hs, away_score: as_,
          winner_club_id: winnerId, status: "completed",
          ...(resultForm.video_url ? { video_url: resultForm.video_url } : {}),
        });
        for (const [email, stat] of Object.entries(playerStats)) {
          if (stat.goals > 0 || stat.assists > 0 || stat.rating) {
            const player = myClubPlayers.find(p => p.email === email);
            await stageClient.entities.MatchPlayerStat.create({
              tournament_id: id, match_id: activeMatch.id, club_id: myPlayer.club_id,
              player_email: email, player_gamertag: player?.gamertag || email,
              goals: stat.goals || 0, assists: stat.assists || 0, rating: parseFloat(stat.rating) || 6.0,
            });
          }
        }
        const updatedMatches = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
        setMatches(updatedMatches);
        const roundMatches = updatedMatches.filter(m => m.round === tournament.current_round);
        const allDone = roundMatches.every(m => m.status === "completed");
        // Auto-advance guard: only proceed if next round doesn't exist yet
        const existingNext = updatedMatches.filter(m => m.round === tournament.current_round + 1);
        if (allDone && existingNext.length === 0) {
          if (tournament.type === "knockout" || tournament.type === "double_elimination") {
            const nextRoundMatches = generateNextKnockoutRound(updatedMatches, tournament.current_round);
            if (nextRoundMatches.length === 0) {
              const finalMatch = updatedMatches.find(m => m.round === tournament.current_round && m.status === "completed");
              if (finalMatch) {
                const winnerName = finalMatch.winner_club_id === finalMatch.home_club_id ? finalMatch.home_club_name : finalMatch.away_club_name;
                await stageClient.entities.Tournament.update(id, { status: "completed", winner_club_id: finalMatch.winner_club_id, winner_club_name: winnerName });
                setTournament(prev => ({ ...prev, status: "completed", winner_club_id: finalMatch.winner_club_id, winner_club_name: winnerName }));
                awardTournamentTrophy({ ...tournament, id }, finalMatch.winner_club_id).catch(() => {});
              }
            } else {
              for (const m of nextRoundMatches) await stageClient.entities.Match.create({ ...m, tournament_id: id });
              await stageClient.entities.Tournament.update(id, { current_round: tournament.current_round + 1 });
              setTournament(prev => ({ ...prev, current_round: prev.current_round + 1 }));
            }
          } else if (tournament.type === "swiss") {
            const swissRounds = tournament.swiss_rounds || Math.ceil(Math.log2(tournament.max_teams || 8));
            if (tournament.current_round < swissRounds) {
              const clubIds = tournament.registered_clubs || [];
              const clubsMap = Object.fromEntries(allClubs.map(c => [c.id, c]));
              const nextSwiss = generateSwissNextRound(clubIds, updatedMatches, tournament.current_round, clubsMap);
              for (const m of nextSwiss) await stageClient.entities.Match.create({ ...m, tournament_id: id });
              await stageClient.entities.Tournament.update(id, { current_round: tournament.current_round + 1 });
              setTournament(prev => ({ ...prev, current_round: prev.current_round + 1 }));
            } else {
              const scores = {};
              updatedMatches.filter(m => m.type === "swiss" && m.status === "completed").forEach(m => {
                if (m.winner_club_id) scores[m.winner_club_id] = (scores[m.winner_club_id] || 0) + 3;
                else { scores[m.home_club_id] = (scores[m.home_club_id] || 0) + 1; scores[m.away_club_id] = (scores[m.away_club_id] || 0) + 1; }
              });
              const winnerId = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0];
              const winnerClub = allClubs.find(c => c.id === winnerId);
              if (winnerId) {
                await stageClient.entities.Tournament.update(id, { status: "completed", winner_club_id: winnerId, winner_club_name: winnerClub?.name || "Unknown" });
                setTournament(prev => ({ ...prev, status: "completed", winner_club_id: winnerId, winner_club_name: winnerClub?.name || "Unknown" }));
                awardTournamentTrophy({ ...tournament, id }, winnerId).catch(() => {});
              }
            }
          }
          const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
          setMatches(refreshed);
        }
      } else {
        // Disagreement → disputed, notify admins/both teams
        await stageClient.entities.Match.update(activeMatch.id, { ...mySubmitData, status: "disputed" });
        // Notify both clubs
        for (const clubId of [activeMatch.home_club_id, activeMatch.away_club_id]) {
          const players = await stageClient.entities.Player.filter({ club_id: clubId });
          for (const p of players) {
            await stageClient.entities.Notification.create({
              recipient_email: p.email, type: "result_submitted",
              title: "⚠️ Match Score Disputed",
              body: `${activeMatch.home_club_name} vs ${activeMatch.away_club_name}: Scores don't match. An admin will resolve this.`,
              link: `/tournaments/${id}`, related_id: activeMatch.id, read: false,
            });
          }
        }
        alert(`Score disputed! You submitted ${submittedScore}, opponent submitted ${otherScore}. An admin will resolve this.`);
        const updatedMatches = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
        setMatches(updatedMatches);
      }
    } else {
      // First submission — save timestamp + move to awaiting_confirmation
      await stageClient.entities.Match.update(activeMatch.id, {
        ...mySubmitData,
        status: "awaiting_confirmation",
        first_submission_at: now,
        first_submitter_club_id: isHome ? activeMatch.home_club_id : activeMatch.away_club_id,
      });
      // Notify opponent
      const opponentClubId = isHome ? activeMatch.away_club_id : activeMatch.home_club_id;
      const opponentPlayers = await stageClient.entities.Player.filter({ club_id: opponentClubId });
      for (const p of opponentPlayers) {
        await stageClient.entities.Notification.create({
          recipient_email: p.email, type: "result_submitted",
          title: "Opponent Submitted Match Result",
          body: `${activeMatch.home_club_name} vs ${activeMatch.away_club_name}: Your opponent submitted ${submittedScore}. Please confirm within 24h.`,
          link: `/tournaments/${id}`, related_id: activeMatch.id, read: false,
        });
      }
      alert("Result submitted! Your opponent has 24 hours to confirm the score.");
      const updatedMatches = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
      setMatches(updatedMatches);
    }
    setResultDialogOpen(false);
    setActiveMatch(null);
    setResultForm({ home_score: "", away_score: "", video_url: "", proof_url: "" });
    setPlayerStats({});
  }*/

  async function submitResult() {
  if (!activeMatch) return;

  const hs = parseInt(resultForm.home_score);
  const as_ = parseInt(resultForm.away_score);
  if (isNaN(hs) || isNaN(as_)) return;

  const isHome = activeMatch.home_club_id === myPlayer?.club_id;
  const submittedScore = `${hs}-${as_}`;
  const now = new Date().toISOString();

  if (!validatePlayerGoals(hs, as_, isHome)) return;

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

function validatePlayerGoals(hs, as_, isHome) {
  const myGoals = Object.values(playerStats).reduce(
    (sum, s) => sum + (s.goals || 0),
    0
  );
  const myScore = isHome ? hs : as_;

  if (myGoals > myScore) {
    alert(
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

  const mySubmitData = isHome
    ? { result_home_submitted: true, home_submitted_score: submittedScore, ...proofData }
    : { result_away_submitted: true, away_submitted_score: submittedScore, ...proofData };

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
  await maybeAdvanceTournament();
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

  alert(
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
  alert("Result submitted! Opponent has 24h to confirm.");
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

async function maybeAdvanceTournament() {
  // swiss_ucl handles its own phase advancement via the UCL Controls panel — never auto-complete it
  if (tournament.type === "swiss_ucl") return;

  const updatedMatches = await stageClient.entities.Match.filter(
    { tournament_id: id },
    "round"
  );

  const roundMatches = updatedMatches.filter(
    (m) => m.round === tournament.current_round
  );

  const allDone = roundMatches.every((m) => m.status === "completed" || m.status === "forfeit");
  if (!allDone) return;

  const existingNext = updatedMatches.filter(
    (m) => m.round === tournament.current_round + 1
  );
  if (existingNext.length > 0) return;

  if (tournament.type === "knockout" || tournament.type === "double_elimination") {
    const nextRoundMatches = generateNextKnockoutRound(updatedMatches, tournament.current_round);
    if (nextRoundMatches.length === 0) {
      const finalMatch = updatedMatches.find(m => m.round === tournament.current_round && (m.status === "completed" || m.status === "forfeit"));
      if (finalMatch) {
        const winnerName = finalMatch.winner_club_id === finalMatch.home_club_id ? finalMatch.home_club_name : finalMatch.away_club_name;
        await stageClient.entities.Tournament.update(id, { status: "completed", winner_club_id: finalMatch.winner_club_id, winner_club_name: winnerName });
        setTournament(prev => ({ ...prev, status: "completed", winner_club_id: finalMatch.winner_club_id, winner_club_name: winnerName }));
        awardTournamentTrophy({ ...tournament, id }, finalMatch.winner_club_id).catch(() => {});

        // Distribute prize pool
        if (tournament.entry_fee_stc > 0) {
          try {
            await stageClient.functions.invoke('distributeTournamentPrizes', { tournament_id: id });
          } catch (err) {
            console.error('Prize distribution failed:', err);
          }
        }
      }
    } else {
      for (const m of nextRoundMatches) await stageClient.entities.Match.create({ ...m, tournament_id: id });
      await stageClient.entities.Tournament.update(id, { current_round: tournament.current_round + 1 });
      setTournament(prev => ({ ...prev, current_round: prev.current_round + 1 }));
    }
  }
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
    const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
    setMatches(refreshed);
    setForfeitDialogOpen(false);
    setForfeitMatch(null);
    setForfeitProof("");
    alert("Forfeit claim submitted. An admin will review and approve.");
  }

  async function approveForfeit(match) {
    const winnerClubId = match.forfeit_claimed_by;
    const _winnerName = winnerClubId === match.home_club_id ? match.home_club_name : match.away_club_name;
    await base44.entities.Match.update(match.id, {
      status: "forfeit",
      winner_club_id: winnerClubId,
      forfeit_status: "approved",
    });
    const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
    setMatches(refreshed);
    setDisputeDialogOpen(false);
    setActiveDispute(null);
  }

  async function generateUCLPlayoff() {
    const leagueMatches = matches.filter(m => m.type === "ucl_league");
    const standings = calculateUCLStandings(leagueMatches);
    const clubs9to24 = standings.slice(8, 24).map(s => ({ id: s.id, name: s.name }));
    if (clubs9to24.length < 16) { alert("Not enough teams ranked 9-24 yet."); return; }
    const playoffMatches = generateUCLPlayoffMatches(clubs9to24);
    for (const m of playoffMatches) await stageClient.entities.Match.create({ ...m, tournament_id: id });
    await stageClient.entities.Tournament.update(id, { current_round: 9, ucl_phase: "playoff" });
    setTournament(prev => ({ ...prev, current_round: 9, ucl_phase: "playoff" }));
    const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
    setMatches(refreshed);
  }

  async function generateUCLR16() {
    const leagueMatches = matches.filter(m => m.type === "ucl_league");
    const standings = calculateUCLStandings(leagueMatches);
    const top8 = standings.slice(0, 8).map(s => ({ id: s.id, name: s.name }));
    // Determine playoff winners by aggregate (with optional leg3)
    const playoffByTie = {};
    matches.filter(m => m.type === "ucl_playoff").forEach(m => {
      if (!playoffByTie[m.group]) playoffByTie[m.group] = [];
      playoffByTie[m.group].push(m);
    });
    const playoffWinners = [];
    for (let i = 0; i < 8; i++) {
      const legs = (playoffByTie[i] || []).sort((a, b) => a.round - b.round);
      const leg1 = legs[0], leg2 = legs[1], leg3 = legs[2];
      const winner = getAggregateWinner(leg1, leg2, leg3);
      if (winner) playoffWinners.push(winner);
    }
    const r16Teams = [...top8, ...playoffWinners];
    const r16Matches = generateUCLKnockoutLegs(r16Teams, 11, "ucl_r16");
    for (const m of r16Matches) await stageClient.entities.Match.create({ ...m, tournament_id: id });
    await stageClient.entities.Tournament.update(id, { current_round: 11, ucl_phase: "r16" });
    setTournament(prev => ({ ...prev, current_round: 11, ucl_phase: "r16" }));
    const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
    setMatches(refreshed);
  }

  async function generateUCLNextKnockoutPhase(phaseLabel, startRound, matchType, tieMatchType) {
    // Determine winners from previous 2-legged phase (with optional leg3)
    const prevByTie = {};
    matches.filter(m => m.type === tieMatchType).forEach(m => {
      if (!prevByTie[m.group]) prevByTie[m.group] = [];
      prevByTie[m.group].push(m);
    });
    const winners = [];
    for (const tieLegs of Object.values(prevByTie)) {
      const sorted = tieLegs.sort((a, b) => a.round - b.round);
      const winner = getAggregateWinner(sorted[0], sorted[1], sorted[2]);
      if (winner) winners.push(winner);
    }
    const half = Math.floor(winners.length / 2);
    const legMatches = [];
    for (let i = 0; i < half; i++) {
      const a = winners[i], b = winners[half + i];
      legMatches.push({ home_club_id: b.id, home_club_name: b.name, away_club_id: a.id, away_club_name: a.name, round: startRound, type: matchType, group: i, status: "scheduled", home_score: 0, away_score: 0 });
      legMatches.push({ home_club_id: a.id, home_club_name: a.name, away_club_id: b.id, away_club_name: b.name, round: startRound + 1, type: matchType, group: i, status: "scheduled", home_score: 0, away_score: 0 });
    }
    for (const m of legMatches) await stageClient.entities.Match.create({ ...m, tournament_id: id });
    await stageClient.entities.Tournament.update(id, { current_round: startRound, ucl_phase: phaseLabel });
    setTournament(prev => ({ ...prev, current_round: startRound, ucl_phase: phaseLabel }));
    const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
    setMatches(refreshed);
  }

  async function generateUCLFinal() {
    const sfByTie = {};
    matches.filter(m => m.type === "ucl_sf").forEach(m => {
      if (!sfByTie[m.group]) sfByTie[m.group] = [];
      sfByTie[m.group].push(m);
    });
    const finalists = [];
    for (const legs of Object.values(sfByTie)) {
      const sorted = legs.sort((a, b) => a.round - b.round);
      const winner = getAggregateWinner(sorted[0], sorted[1], sorted[2]);
      if (winner) finalists.push(winner);
    }
    if (finalists.length < 2) { alert("Not enough finalists determined yet."); return; }
    const finalRound = Math.max(...matches.map(m => m.round)) + 1;
    await stageClient.entities.Match.create({
      home_club_id: finalists[0].id, home_club_name: finalists[0].name,
      away_club_id: finalists[1].id, away_club_name: finalists[1].name,
      round: finalRound, match_type: "final", status: "scheduled", home_score: 0, away_score: 0,
      tournament_id: id,
    });
    await stageClient.entities.Tournament.update(id, { current_round: finalRound, ucl_phase: "final" });
    setTournament(prev => ({ ...prev, ucl_phase: "final", current_round: finalRound }));
    const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
    setMatches(refreshed);
  }

  async function refreshMatches() {
    const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
    setMatches(refreshed);
  }

  async function simulateScore(match) {
    await stageClient.functions.invoke('simulateScore', { matchId: match.id, tournamentId: id });
    const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, 'round');
    setMatches(refreshed);
  }

  async function withdrawFromTournament() {
    const effectiveId = takeoverClub ? takeoverClub.id : myPlayer?.club_id;
    if (!effectiveId || !tournament) return;
    const entryFeeSTC = tournament.entry_fee_stc ?? 0;
    const confirmMsg = entryFeeSTC > 0
      ? `Withdraw from the tournament? Entry credits + ${entryFeeSTC.toLocaleString()} STC will be refunded.`
      : "Withdraw from the tournament? Entry credits will be refunded.";
    if (!window.confirm(confirmMsg)) return;
    
    const updated = (tournament.registered_clubs || []).filter(cid => cid !== effectiveId);
    await stageClient.entities.Tournament.update(tournament.id, { registered_clubs: updated });
    
    const clubData = takeoverClub || allClubs.find(c => c.id === effectiveId);
    if (clubData) {
      const entryCost = tournament.entry_credits ?? 50;
      const refundStc = entryFeeSTC;
      const newCredits = (clubData.credits || 0) + entryCost;
      const newStc = (clubData.stc || 0) + refundStc;
      await stageClient.entities.Club.update(effectiveId, { credits: newCredits, stc: newStc });
      
      if (refundStc > 0) {
        await stageClient.entities.STCTransaction.create({
          club_id: effectiveId,
          amount: refundStc,
          type: 'tournament_entry',
          description: `Tournament withdrawal refund: ${tournament.name}`,
          reference_id: tournament.id,
        });
      }
    }
    
    setTournament(prev => ({ ...prev, registered_clubs: updated }));
    setClubs(allClubs.filter(c => updated.includes(c.id)));
  }

  async function cancelTournament() {
    if (!window.confirm("Are you sure you want to cancel this tournament? This cannot be undone.")) return;
    await stageClient.entities.Tournament.update(id, { status: "cancelled" });
    setTournament(prev => ({ ...prev, status: "cancelled" }));

  }

  async function deleteTournament() {
    if (!window.confirm("Permanently DELETE this tournament and all its matches? This cannot be undone.")) return;
    await stageClient.entities.Tournament.delete(id);
    window.location.href = "/tournaments";
  }

  async function advanceRound() {
    await stageClient.functions.invoke('advanceRound', { tournamentId: id });
    const refreshed = await stageClient.entities.Match.filter({ tournament_id: id }, "round");
    setMatches(refreshed);
    const updated = await stageClient.entities.Tournament.filter({ id }, null, 1);
    setTournament(updated[0]);
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
  const myClubId = effectiveClubId;
  const allMatchesPlayed = matches.length > 0 && matches.every(m => m.status === "completed" || m.status === "forfeit");
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
                  <Button onClick={registerClub} disabled={!takeoverClub && !canAfford}
                    className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg">
                    <Shield className="w-4 h-4 mr-2" />
                    {takeoverClub ? `Register ${takeoverClub.name}` : "Register My Club"}
                    <span className="ml-1 opacity-70 text-xs">({entryCost}✧{entryFeeSTC > 0 ? ` + ${entryFeeSTC.toLocaleString()}STC` : ""})</span>
                  </Button>
                );
              })()}

              {isPlayerTournament && tournament.status === "registration" && myPlayer && !myPlayerRegistered && !isFull && (
                <Button onClick={async () => {
                  const entryCost = tournament.entry_credits ?? 50;
                  if ((myPlayer.credits ?? 500) < entryCost) { alert("Not enough credits."); return; }
                  if (tournament.start_date && new Date(tournament.start_date) < new Date()) { alert("Registration is closed."); return; }
                  const updated = [...(tournament.registered_players || []), myPlayer.id];
                  if (entryCost > 0) {
                    const res = await stageClient.functions.invoke('spendCredits', { amount: entryCost, target: 'player' });
                    setMyPlayer(prev => ({ ...prev, credits: res.data.new_balance }));
                  }
                  await stageClient.entities.Tournament.update(tournament.id, { registered_players: updated });
                  setTournament(prev => ({ ...prev, registered_players: updated }));
                }} disabled={(myPlayer.credits ?? 500) < (tournament.entry_credits ?? 50)}
                className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg">
                  <Users className="w-4 h-4 mr-2" /> Register as Player
                  <span className="ml-1 opacity-70 text-xs">({tournament.entry_credits ?? 50}✧)</span>
                </Button>
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
      {(tournament.prize_description || tournament.entry_fee_stc > 0 || (!isPlayerTournament && myPlayer?.club_id)) && (
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
                    (1st: {tournament.prize_winner_stc.toLocaleString()} | 2nd: {(tournament.prize_runner_up_stc || 0).toLocaleString()})
                  </span>
                )}
              </span>
            )}
            {tournament.prize_description && (
              <span className="flex items-center gap-1.5 text-xs text-warning">
                <Crown className="w-3.5 h-3.5" /> {tournament.prize_description}
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
              <Button onClick={async () => {
                const entryCost = tournament.entry_credits ?? 50;
                const entryFeeSTC = tournament.entry_fee_stc ?? 0;
                const currentCredits = myPlayer.credits ?? 500;
                if (currentCredits < entryCost) { alert("Not enough credits."); return; }
                if (entryFeeSTC > 0 && (myPlayer.stc ?? 0) < entryFeeSTC) {
                  alert(`Not enough STC. Need ${entryFeeSTC.toLocaleString()} STC.`);
                  return;
                }
                if (tournament.start_date && new Date(tournament.start_date) < new Date()) { alert("Registration is closed."); return; }
                try {
                  const res = await stageClient.functions.invoke('tournamentRegistration', {
                    tournament_id: tournament.id,
                    player_id: myPlayer.id,
                  });
                  if (!res.data.success) {
                    alert(res.data.error || 'Registration failed');
                    return;
                  }
                  const updated = [...(tournament.registered_players || []), myPlayer.id];
                  setMyPlayer(prev => ({
                    ...prev,
                    credits: res.data.new_player_credits ?? prev.credits,
                    stc: res.data.new_player_stc ?? prev.stc,
                  }));
                  setTournament(prev => ({ ...prev, registered_players: updated }));
                } catch (err) {
                  alert('Registration failed: ' + (err?.message || 'Unknown error'));
                }
              }} className="bg-accent text-accent-foreground leading-relaxed hover:bg-accent/90" disabled={(myPlayer.credits ?? 500) < (tournament.entry_credits ?? 50) || ((tournament.entry_fee_stc ?? 0) > 0 && (myPlayer.stc ?? 0) < (tournament.entry_fee_stc ?? 0))}>
                <Users className="w-4 h-4 mr-2" /> Register as Player <span className="ml-1 opacity-70 text-xs">({tournament.entry_credits ?? 50} credits{(tournament.entry_fee_stc ?? 0) > 0 ? ` + ${(tournament.entry_fee_stc ?? 0).toLocaleString()} STC` : ''})</span>
              </Button>
            )}

            {isCreator && tournament.status === "in_progress" && (tournament.type === "knockout" || tournament.type === "double_elimination") && (() => {
              const crm = matches.filter(m => m.round === tournament.current_round);
              const allDone = crm.length > 0 && crm.every(m => m.status === "completed" || m.status === "forfeit");
              return allDone && (
                <Button type="button" onClick={advanceRound} size="sm"
                  className="bg-success/10 text-success border border-success/30 text-xs animate-pulse">
                  ⬆️ Advance to Round {tournament.current_round + 1}
                </Button>
              );
            })()}

            {isCreator && ["registration", "in_progress"].includes(tournament.status) && (tournament.registered_clubs?.length || 0) >= 2 && matches.length === 0 && (
              <Button type="button" onClick={generateDraw} size="sm" className="bg-primary/10 text-primary border border-primary/30 text-xs hover:bg-primary/20">
                🎲 Generate Draw
              </Button>
            )}

            {isCreator && ["registration", "in_progress"].includes(tournament.status) && matches.length > 0 && !allMatchesPlayed && (
              <Button type="button" onClick={clearDraw} size="sm" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10 text-xs">
                🔄 Regenerate Draw
              </Button>
            )}

            {isOrganizer && tournament.status === "registration" && isFull && (
              <Button type="button" onClick={() => initializeTournament(tournament, registeredClubs)} size="sm"
                className="bg-primary text-primary-foreground text-xs">
                <Play className="w-3 h-3 mr-1.5" /> Start Tournament
              </Button>
            )}

            {isOrganizer && ["registration", "in_progress"].includes(tournament.status) && !allMatchesPlayed && (
              <Button type="button" onClick={cancelTournament} size="sm" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10 text-xs">
                Cancel
              </Button>
            )}

            {isCreator && !allMatchesPlayed && (
              <Button type="button" onClick={() => setEditDialogOpen(true)} size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10 text-xs">
                Edit
              </Button>
            )}

            {isOrganizer && ["cancelled", "registration"].includes(tournament.status) && (
              <Button type="button" onClick={deleteTournament} size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs">
                Delete
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
                        const choice = window.confirm(`Tie! ${leg1.home_club_name} vs ${leg1.away_club_name} (agg ${agg_A}-${agg_B}).\n\nOK = ${leg1.home_club_name} hosts leg 3. Cancel = ${leg1.away_club_name} hosts.`);
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
              {allLeagueDone && !playoffExists && (
                <Button type="button" onClick={generateUCLPlayoff} className="bg-primary/10 text-primary border border-primary/30 text-xs animate-pulse">
                  🎲 Generate Playoff Draw (9–24)
                </Button>
              )}
              {allPlayoffDone && !r16Exists && (
                <Button type="button" onClick={generateUCLR16} className="bg-primary/10 text-primary border border-primary/30 text-xs animate-pulse">
                  🎲 Generate Round of 16
                </Button>
              )}
              {allR16Done && !qfExists && (
                <Button type="button" onClick={() => generateUCLNextKnockoutPhase("qf", Math.max(...matches.map(m=>m.round))+1, "ucl_qf", "ucl_r16")}
                  className="bg-primary/10 text-primary border border-primary/30 text-xs animate-pulse">
                  🎲 Generate Quarter-Finals
                </Button>
              )}
              {allQFDone && !sfExists && (
                <Button type="button" onClick={() => generateUCLNextKnockoutPhase("sf", Math.max(...matches.map(m=>m.round))+1, "ucl_sf", "ucl_qf")}
                  className="bg-primary/10 text-primary border border-primary/30 text-xs animate-pulse">
                  🎲 Generate Semi-Finals
                </Button>
              )}
              {allSFDone && !finalExists && (
                <Button type="button" onClick={generateUCLFinal} className="bg-warning/10 text-warning border border-warning/30 text-xs animate-pulse">
                  🏆 Generate Final
                </Button>
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
              {tournament.status === "registration" && isCreator && (tournament.registered_clubs?.length || 0) >= 2
                ? <p className="text-muted-foreground text-sm">Use the <span className="text-primary font-semibold">Generate Draw</span> button above to preview matchups.</p>
                : <p className="text-muted-foreground text-sm">Bracket will appear once the tournament starts.</p>
              }
            </div>
          ) : (tournament.type === "knockout" || tournament.type === "double_elimination") ? (
            <div className="bg-card border border-border rounded-2xl p-6">
              {tournament.status === "registration" && matches.length > 0 && (
                <div className="mb-4 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-xs text-primary flex items-center gap-2">
                  Draw preview — tournament has not started yet.
                </div>
              )}
              <KnockoutBracket
                matches={matches}
                myClubId={myClubId}
                onSubmit={(match) => { setActiveMatch(match); setResultDialogOpen(true); }}
                onSchedule={(match) => { setScheduleMatch(match); setScheduleDate(match.scheduled_date ? new Date(match.scheduled_date).toISOString().slice(0,16) : ""); setScheduleDialogOpen(true); }}
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
                                <Button size="sm" type="button" variant="outline" onClick={() => { setScheduleMatch(match); setScheduleDate(match.scheduled_date ? new Date(match.scheduled_date).toISOString().slice(0,16) : ""); setScheduleDialogOpen(true); }}
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
                    {(match.proof_url || match.forfeit_proof_url) && (
                      <a href={match.proof_url || match.forfeit_proof_url} target="_blank" rel="noreferrer"
                        className="text-primary underline flex items-center gap-1">📎 View Proof</a>
                    )}
                    {match.admin_notes && <p className="italic">{match.admin_notes}</p>}
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
                {(activeDispute.proof_url || activeDispute.forfeit_proof_url) && (
                  <a href={activeDispute.proof_url || activeDispute.forfeit_proof_url} target="_blank" rel="noreferrer"
                    className="text-primary underline flex items-center gap-1 mt-1">📎 View Proof</a>
                )}
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
