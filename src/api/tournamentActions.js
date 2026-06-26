import { stageClient } from "@/api/stageClient";
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

export async function generateTournamentDraw(tournamentId) {
  const result = await stageClient.functions.invoke("generateTournamentDraw", { tournament_id: tournamentId });
  return {
    matches: result?.data?.matches || await fetchTournamentMatches(tournamentId),
    tournament: result?.data?.tournament || null,
  };
}

export async function clearTournamentDraw(matches) {
  await Promise.all(matches.map(match => stageClient.entities.Match.delete(match.id)));
}

export async function initializeTournamentDraw(tournamentId, tournament, registeredClubs) {
  void tournament;
  void registeredClubs;
  const result = await stageClient.functions.invoke("startTournament", { tournament_id: tournamentId });
  const updatedTournament = result?.data?.tournament || null;
  return {
    matches: result?.data?.matches || await fetchTournamentMatches(tournamentId),
    tournamentPatch: updatedTournament || { status: "in_progress", current_round: 1 },
    tournament: updatedTournament,
    notified: result?.data?.notified || 0,
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
