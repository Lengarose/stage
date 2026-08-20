import { stageClient } from "@/api/stageClient";
import { asWallClockDateTimeString } from "@/lib/momentDate";
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

function isMissingFunctionError(error, functionName) {
  const message = String(error?.message || error?.error || "");
  return message.includes(`Function '${functionName}' not found`) || message.includes("not found");
}

function parseJsonList(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeTournament(row) {
  if (!row) return row;
  return {
    ...row,
    start_date: asWallClockDateTimeString(row.start_date),
    end_date: asWallClockDateTimeString(row.end_date),
    registered_clubs: parseJsonList(row.registered_clubs),
    registered_players: parseJsonList(row.registered_players),
    registration_proofs: parseJsonObject(row.registration_proofs),
  };
}

function normalizeMatch(row) {
  if (!row) return row;
  return {
    ...row,
    group: row.group ?? row.group_number,
  };
}

export async function fetchTournamentMatches(tournamentId) {
  try {
    const rows = await stageClient.http.get(`/public/tournaments/${encodeURIComponent(tournamentId)}/matches`);
    return Array.isArray(rows) ? rows.map(normalizeMatch) : [];
  } catch (error) {
    return stageClient.entities.Match.filter({ tournament_id: tournamentId }, "round");
  }
}

export async function fetchTournamentPublic(tournamentId) {
  try {
    return normalizeTournament(await stageClient.http.get(`/public/tournaments/${encodeURIComponent(tournamentId)}`));
  } catch (error) {
    const rows = await stageClient.entities.Tournament.filter({ id: tournamentId }, null, 1);
    return normalizeTournament(rows[0] || null);
  }
}

export async function registerTournamentClub(tournamentId, clubId, options = {}) {
  const payload = typeof options === "string"
    ? { registration_proof_url: options }
    : {
        registration_proof_url: options.registrationProofUrl || options.registration_proof_url || null,
        ea_club_name: options.eaClubName || options.ea_club_name || null,
      };
  return stageClient.functions.invoke("tournamentRegistration", {
    tournament_id: tournamentId,
    club_id: clubId,
    ...payload,
  });
}

export async function reviewTournamentClubRegistration(tournamentId, clubId, action, reason = "") {
  return stageClient.functions.invoke("tournamentRegistrationReview", {
    tournament_id: tournamentId,
    club_id: clubId,
    action,
    reason,
  });
}

export async function setAdminTournamentClubs(tournamentId, clubIds) {
  return stageClient.functions.invoke("adminSetTournamentClubs", {
    tournament_id: tournamentId,
    club_ids: clubIds,
  });
}

export async function registerTournamentPlayer(tournamentId, playerId, registrationProofUrl = null) {
  return stageClient.functions.invoke("tournamentRegistration", {
    tournament_id: tournamentId,
    player_id: playerId,
    registration_proof_url: registrationProofUrl,
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
  try {
    const result = await stageClient.functions.invoke("generateTournamentDraw", { tournament_id: tournamentId });
    return {
      matches: result?.data?.matches || await fetchTournamentMatches(tournamentId),
      tournament: result?.data?.tournament || null,
    };
  } catch (error) {
    if (!isMissingFunctionError(error, "generateTournamentDraw")) throw error;
    const { matches, numGroups } = buildTournamentMatches(tournament, registeredClubs);
    await stageClient.entities.Match.bulkCreate(matches.map(match => ({
      ...match,
      tournament_id: tournamentId,
      status: "scheduled",
    })));
    await stageClient.entities.Tournament.update(tournamentId, { num_groups: numGroups });
    return {
      matches: await fetchTournamentMatches(tournamentId),
      tournament: { ...tournament, num_groups: numGroups },
    };
  }
}

export async function clearTournamentDraw(matches) {
  await Promise.all(matches.map(match => stageClient.entities.Match.delete(match.id)));
}

export async function initializeTournamentDraw(tournamentId, tournament, registeredClubs) {
  try {
    const result = await stageClient.functions.invoke("startTournament", { tournament_id: tournamentId });
    const updatedTournament = result?.data?.tournament || null;
    return {
      matches: result?.data?.matches || await fetchTournamentMatches(tournamentId),
      tournamentPatch: updatedTournament || { status: "in_progress", current_round: 1 },
      tournament: updatedTournament,
      notified: result?.data?.notified || 0,
    };
  } catch (error) {
    if (!isMissingFunctionError(error, "startTournament")) throw error;
    const existingMatches = await fetchTournamentMatches(tournamentId);
    if (existingMatches.length === 0) {
      await generateTournamentDraw(tournamentId, tournament, registeredClubs);
    }
    await stageClient.entities.Tournament.update(tournamentId, {
      status: "in_progress",
      current_round: 1,
    });
    return {
      matches: await fetchTournamentMatches(tournamentId),
      tournamentPatch: { status: "in_progress", current_round: 1 },
      tournament: { ...tournament, status: "in_progress", current_round: 1 },
      notified: 0,
    };
  }
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
  return stageClient.functions.invoke("adminDeleteTournament", { tournament_id: tournamentId });
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

export async function createTournamentFinalAndThirdPlace(tournamentId) {
  const res = await stageClient.functions.invoke("createFinalAndThirdPlace", { tournamentId });
  const [matches, tournament] = await Promise.all([
    fetchTournamentMatches(tournamentId),
    fetchTournamentPublic(tournamentId),
  ]);
  return { ...res?.data, matches, tournament };
}

export async function officializeTournament(tournamentId) {
  const res = await stageClient.functions.invoke("officializeTournament", { tournamentId });
  const [matches, tournaments] = await Promise.all([
    fetchTournamentMatches(tournamentId),
    stageClient.entities.Tournament.filter({ id: tournamentId }, null, 1),
  ]);
  return { ...res?.data, matches, tournament: tournaments[0] || res?.data?.tournament || null };
}
