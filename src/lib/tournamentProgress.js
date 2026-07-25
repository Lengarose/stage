import { stageClient } from "@/api/stageClient";
import { calculateGroupStandings, calculateLeagueStandings } from "@/lib/tournamentEngine";
import { loadActiveTournaments } from "@/lib/dashboardData";

function parseJsonList(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isFinished(match) {
  return ["completed", "forfeit"].includes(String(match?.status || "").toLowerCase());
}

export function resolveTournamentParticipant(tournament, player, club) {
  const regPlayers = parseJsonList(tournament.registered_players);
  const regClubs = parseJsonList(tournament.registered_clubs);
  const isPlayerTournament = tournament.participant_type === "player" || regPlayers.length > 0;

  if (isPlayerTournament && player?.id && regPlayers.includes(player.id)) {
    return { type: "player", id: player.id };
  }
  if (club?.id && regClubs.includes(club.id)) {
    return { type: "club", id: club.id };
  }
  if (player?.id && regPlayers.includes(player.id)) {
    return { type: "player", id: player.id };
  }
  return null;
}

function matchIncludesParticipant(match, participant) {
  if (!participant) return false;
  if (participant.type === "player") {
    return match.home_player_id === participant.id || match.away_player_id === participant.id;
  }
  return match.home_club_id === participant.id || match.away_club_id === participant.id;
}

function winnerId(match, participantType) {
  return participantType === "player" ? match.winner_player_id : match.winner_club_id;
}

function homeId(match, participantType) {
  return participantType === "player" ? match.home_player_id : match.home_club_id;
}

function awayId(match, participantType) {
  return participantType === "player" ? match.away_player_id : match.away_club_id;
}

function calculateGenericLeagueStandings(matches, participantType) {
  const table = {};
  matches
    .filter((m) => String(m.type || "").toLowerCase() === "league" && isFinished(m))
    .forEach((m) => {
      const hId = homeId(m, participantType);
      const aId = awayId(m, participantType);
      if (!hId || !aId) return;
      const hName = participantType === "player" ? m.home_player_name : m.home_club_name;
      const aName = participantType === "player" ? m.away_player_name : m.away_club_name;
      if (!table[hId]) table[hId] = { id: hId, name: hName, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
      if (!table[aId]) table[aId] = { id: aId, name: aName, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
      const h = table[hId];
      const a = table[aId];
      h.P++;
      a.P++;
      h.GF += m.home_score || 0;
      h.GA += m.away_score || 0;
      a.GF += m.away_score || 0;
      a.GA += m.home_score || 0;
      h.GD = h.GF - h.GA;
      a.GD = a.GF - a.GA;
      const w = winnerId(m, participantType);
      if (w === hId) {
        h.W++;
        h.Pts += 3;
        a.L++;
      } else if (w === aId) {
        a.W++;
        a.Pts += 3;
        h.L++;
      } else {
        h.D++;
        a.D++;
        h.Pts++;
        a.Pts++;
      }
    });
  return Object.values(table).sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF);
}

function calculateGenericGroupStandings(matches, numGroups, participantType) {
  if (participantType === "club") {
    return calculateGroupStandings(matches, numGroups);
  }

  const groups = Array.from({ length: numGroups }, () => ({}));
  matches
    .filter((m) => ["group", "group_stage"].includes(String(m.type || "")) && isFinished(m))
    .forEach((m) => {
      const g = Number(m.group_number ?? m.group ?? 0);
      if (g >= groups.length) return;
      const hId = m.home_player_id;
      const aId = m.away_player_id;
      if (!hId || !aId) return;
      if (!groups[g][hId]) groups[g][hId] = { id: hId, name: m.home_player_name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
      if (!groups[g][aId]) groups[g][aId] = { id: aId, name: m.away_player_name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
      const h = groups[g][hId];
      const a = groups[g][aId];
      h.P++;
      a.P++;
      h.GF += m.home_score || 0;
      h.GA += m.away_score || 0;
      a.GF += m.away_score || 0;
      a.GA += m.home_score || 0;
      h.GD = h.GF - h.GA;
      a.GD = a.GF - a.GA;
      const w = m.winner_player_id;
      if (w === hId) {
        h.W++;
        h.Pts += 3;
        a.L++;
      } else if (w === aId) {
        a.W++;
        a.Pts += 3;
        h.L++;
      } else {
        h.D++;
        a.D++;
        h.Pts++;
        a.Pts++;
      }
    });

  return groups.map((g) =>
    Object.values(g).sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF)
  );
}

export function computeTournamentProgress(tournament, matches, participant) {
  if (!participant) return { label: null };

  const type = String(tournament.type || "").toLowerCase();
  const currentRound = Number(tournament.current_round || 1);
  const totalRounds = Number(tournament.total_rounds || 0);
  const myMatches = matches.filter((m) => matchIncludesParticipant(m, participant));
  const participantType = participant.type;

  const knockoutMine = myMatches.filter((m) => {
    const mt = String(m.type || "").toLowerCase();
    return ["knockout", "final", "semi", "quarter", "r16", "r32", "third_place"].includes(mt) || Number(m.round || 0) > 0;
  });

  let eliminated = false;
  for (const m of knockoutMine.filter(isFinished)) {
    const winner = winnerId(m, participantType);
    if (winner && winner !== participant.id) {
      eliminated = true;
      break;
    }
  }

  if (type === "group_stage" || type === "group") {
    const numGroups = Number(tournament.num_groups || 2);
    const groupTables = calculateGenericGroupStandings(matches, numGroups, participantType);
    const groupMatch = myMatches.find((m) => m.group_number != null || m.group != null);
    const groupIdx = Number(groupMatch?.group_number ?? groupMatch?.group ?? -1);
    if (groupIdx >= 0 && groupTables[groupIdx]) {
      const idx = groupTables[groupIdx].findIndex((row) => row.id === participant.id);
      if (idx >= 0) {
        const groupLabel = String.fromCharCode(65 + groupIdx);
        return {
          label: `Group ${groupLabel} · #${idx + 1}`,
          detail: `${groupTables[groupIdx][idx].Pts} pts`,
          eliminated: false,
          groupPosition: idx + 1,
        };
      }
    }
  }

  if (type === "league") {
    const table = participantType === "club"
      ? calculateLeagueStandings(matches)
      : calculateGenericLeagueStandings(matches, participantType);
    const idx = table.findIndex((row) => row.id === participant.id);
    if (idx >= 0) {
      return {
        label: `#${idx + 1}`,
        detail: `${table[idx].Pts} pts · ${table[idx].P} played`,
        leaguePosition: idx + 1,
        eliminated: false,
      };
    }
  }

  if (eliminated) {
    return { label: "Eliminated", detail: null, eliminated: true };
  }

  const upcoming = myMatches
    .filter((m) => !isFinished(m))
    .sort((a, b) => Number(a.round || 99) - Number(b.round || 99))[0];
  const activeRound = upcoming?.round || currentRound;
  const roundLabel = totalRounds
    ? `Round ${activeRound}/${totalRounds}`
    : `Round ${activeRound}`;

  if (String(upcoming?.type || "").toLowerCase() === "final") {
    return { label: "Final", detail: null, round: activeRound, eliminated: false };
  }

  return {
    label: roundLabel,
    detail: tournament.status === "open" || tournament.status === "registration" ? "Registered" : "In progress",
    round: activeRound,
    totalRounds,
    eliminated: false,
  };
}

export async function loadActiveTournamentsWithProgress(player, club) {
  const tournaments = await loadActiveTournaments(player, club);
  return Promise.all(
    tournaments.map(async (tournament) => {
      const matches = await stageClient.entities.Match.filter({ tournament_id: tournament.id }, "round", 200).catch(() => []);
      const participant = resolveTournamentParticipant(tournament, player, club);
      const progress = computeTournamentProgress(tournament, matches, participant);
      return { ...tournament, progress, participant };
    })
  );
}
