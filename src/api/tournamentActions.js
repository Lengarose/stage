import { stageClient } from "@/api/stageClient";
import {
  generateKnockoutRound1,
  generateLeagueMatches,
  generateGroupStageMatches,
  generateUCLLeaguePhase,
} from "@/lib/tournamentEngine";
import { seedClubs } from "@/lib/rankingEngine";

function buildTournamentMatches(tournament, registeredClubs) {
  const seededClubs = seedClubs(registeredClubs);
  const type = tournament.type;
  const numGroups = type === "group_stage"
    ? Math.max(1, Math.ceil(seededClubs.length / 4))
    : (tournament.num_groups || 2);

  let matches = [];
  if (type === "knockout") matches = generateKnockoutRound1(seededClubs);
  else if (type === "league") matches = generateLeagueMatches(seededClubs);
  else if (type === "group_stage") matches = generateGroupStageMatches(seededClubs, numGroups);
  else if (type === "double_elimination") matches = generateKnockoutRound1(seededClubs);
  else if (type === "swiss_ucl") matches = generateUCLLeaguePhase(seededClubs);

  return { matches, numGroups };
}

export async function fetchTournamentMatches(tournamentId) {
  return stageClient.entities.Match.filter({ tournament_id: tournamentId }, "round");
}

export async function registerTournamentClub(tournamentId, clubId) {
  return stageClient.functions.invoke("tournamentRegistration", {
    tournament_id: tournamentId,
    club_id: clubId,
  });
}

export async function registerTournamentPlayer(tournamentId, playerId) {
  return stageClient.functions.invoke("tournamentRegistration", {
    tournament_id: tournamentId,
    player_id: playerId,
  });
}

export function notifyTournamentRegistration(tournamentId, clubId) {
  return stageClient.functions.invoke("tournamentRegistrationNotify", {
    action: "register",
    tournament_id: tournamentId,
    club_id: clubId,
  });
}

export async function generateTournamentDraw(tournamentId, tournament, registeredClubs) {
  const { matches, numGroups } = buildTournamentMatches(tournament, registeredClubs);
  await stageClient.entities.Match.bulkCreate(matches.map(match => ({
    ...match,
    tournament_id: tournamentId,
    status: "scheduled",
  })));
  await stageClient.entities.Tournament.update(tournamentId, { num_groups: numGroups });
  return fetchTournamentMatches(tournamentId);
}

export async function clearTournamentDraw(matches) {
  await Promise.all(matches.map(match => stageClient.entities.Match.delete(match.id)));
}

export async function initializeTournamentDraw(tournamentId, tournament, registeredClubs) {
  const existingMatches = await fetchTournamentMatches(tournamentId);
  if (existingMatches.length > 0) {
    await stageClient.entities.Tournament.update(tournamentId, {
      status: "in_progress",
      current_round: 1,
    });
    return {
      matches: existingMatches,
      tournamentPatch: { status: "in_progress", current_round: 1 },
    };
  }

  const { matches, numGroups } = buildTournamentMatches(tournament, registeredClubs);
  await stageClient.entities.Match.bulkCreate(matches.map(match => ({
    ...match,
    tournament_id: tournamentId,
  })));
  await stageClient.entities.Tournament.update(tournamentId, {
    status: "in_progress",
    current_round: 1,
    num_groups: numGroups,
  });

  if (tournament.type === "group_stage") {
    const groupAssignments = {};
    for (let groupIndex = 0; groupIndex < numGroups; groupIndex += 1) {
      const groupSize = Math.ceil(registeredClubs.length / numGroups);
      const startIndex = groupIndex * groupSize;
      const endIndex = Math.min(startIndex + groupSize, registeredClubs.length);
      groupAssignments[`group${String.fromCharCode(65 + groupIndex)}`] = registeredClubs
        .slice(startIndex, endIndex)
        .map(club => club.id);
    }
    await stageClient.functions.invoke("assignGroups", { tournamentId, groupAssignments });
  }

  return {
    matches: await fetchTournamentMatches(tournamentId),
    tournamentPatch: { status: "in_progress", current_round: 1, num_groups: numGroups },
  };
}

export async function withdrawTournamentClub(tournamentId, clubId) {
  return stageClient.functions.invoke("tournamentWithdrawal", {
    tournament_id: tournamentId,
    club_id: clubId,
  });
}

export async function cancelTournamentById(tournamentId) {
  return stageClient.functions.invoke("tournamentCancellation", { tournament_id: tournamentId });
}

export async function deleteTournamentById(tournamentId) {
  return stageClient.entities.Tournament.delete(tournamentId);
}

export async function simulateTournamentScore(tournamentId, matchId) {
  await stageClient.functions.invoke("simulateScore", { matchId, tournamentId });
  return fetchTournamentMatches(tournamentId);
}

export async function advanceTournamentRound(tournamentId) {
  await stageClient.functions.invoke("advanceRound", { tournamentId });
  const [matches, tournaments] = await Promise.all([
    fetchTournamentMatches(tournamentId),
    stageClient.entities.Tournament.filter({ id: tournamentId }, null, 1),
  ]);
  return { matches, tournament: tournaments[0] || null };
}
