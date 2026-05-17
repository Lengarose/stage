function normalizeCountryCode(value) {
  return String(value || '').trim().toUpperCase();
}

function getPlayerId(player) {
  return String(player?.id || player?.player_id || '').trim();
}

function getPlayerCountry(player) {
  return normalizeCountryCode(player?.country || player?.country_code || player?.nationality);
}

function toDate(value) {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function canVoteForCandidate({ voter, candidate, election, now = new Date() } = {}) {
  if (!voter || !candidate || !election) {
    return { ok: false, reason: 'missing_input' };
  }

  if (election.status !== 'voting_open') {
    return { ok: false, reason: 'election_not_open' };
  }

  const electionCountry = normalizeCountryCode(election.country || election.country_code);
  if (!electionCountry) {
    return { ok: false, reason: 'missing_election_country' };
  }

  const voterId = getPlayerId(voter);
  const candidateId = getPlayerId(candidate);
  if (!voterId) {
    return { ok: false, reason: 'missing_voter' };
  }
  if (!candidateId) {
    return { ok: false, reason: 'missing_candidate' };
  }
  if (voterId === candidateId) {
    return { ok: false, reason: 'self_vote' };
  }

  if (getPlayerCountry(voter) !== electionCountry) {
    return { ok: false, reason: 'voter_country_mismatch' };
  }

  if (getPlayerCountry(candidate) !== electionCountry) {
    return { ok: false, reason: 'candidate_country_mismatch' };
  }

  const votingOpensAt = toDate(election.voting_opens_at);
  const voteTime = toDate(now);
  if (votingOpensAt && voteTime && voteTime < votingOpensAt) {
    return { ok: false, reason: 'voting_not_open_yet' };
  }

  const voterCreatedAt = toDate(voter.created_date || voter.created_at);
  if (votingOpensAt && voterCreatedAt && voterCreatedAt > votingOpensAt) {
    return { ok: false, reason: 'voter_created_after_open' };
  }

  const votingClosesAt = toDate(election.voting_closes_at);
  if (votingClosesAt && voteTime && voteTime > votingClosesAt) {
    return { ok: false, reason: 'voting_closed' };
  }

  return { ok: true };
}

function validateSquadSelection({ playerIds, maxSquadSize = 26 } = {}) {
  if (!Array.isArray(playerIds)) {
    return { ok: false, reason: 'invalid_player_ids' };
  }

  const cleanIds = playerIds.map((playerId) => String(playerId || '').trim());
  if (cleanIds.some((playerId) => !playerId)) {
    return { ok: false, reason: 'blank_player_id' };
  }

  if (new Set(cleanIds).size !== cleanIds.length) {
    return { ok: false, reason: 'duplicate_players' };
  }

  if (cleanIds.length > maxSquadSize) {
    return { ok: false, reason: 'too_many_players' };
  }

  return { ok: true, playerIds: cleanIds };
}

function chooseElectionWinner(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  return [...rows].sort((left, right) => {
    const voteDelta = Number(right.vote_count || 0) - Number(left.vote_count || 0);
    if (voteDelta !== 0) return voteDelta;

    const ratingDelta = Number(right.overall_rating || 0) - Number(left.overall_rating || 0);
    if (ratingDelta !== 0) return ratingDelta;

    return String(left.player_id || '').localeCompare(String(right.player_id || ''));
  })[0];
}

function rankOwnerCandidates(rows = [], countryCode) {
  const country = normalizeCountryCode(countryCode);
  return rows
    .filter((row) => normalizeCountryCode(row.country_code) === country)
    .sort((left, right) => {
      const rankingDelta = Number(right.club_ranking_points || 0) - Number(left.club_ranking_points || 0);
      if (rankingDelta !== 0) return rankingDelta;

      const ratingDelta = Number(right.squad_avg_rating || 0) - Number(left.squad_avg_rating || 0);
      if (ratingDelta !== 0) return ratingDelta;

      return String(left.club_name || left.club_id || '').localeCompare(String(right.club_name || right.club_id || ''));
    })
    .slice(0, 5);
}

function getTopPlayersByPosition(players = [], limitPerPosition = 3) {
  const byPosition = new Map();
  for (const player of players) {
    const position = String(player.position || 'ANY').trim().toUpperCase() || 'ANY';
    const list = byPosition.get(position) || [];
    list.push(player);
    byPosition.set(position, list);
  }

  return [...byPosition.entries()].flatMap(([, positionPlayers]) => (
    positionPlayers
      .sort((left, right) => {
        const overallDelta = Number(right.overall_rating || 0) - Number(left.overall_rating || 0);
        if (overallDelta !== 0) return overallDelta;

        const matchRatingDelta = Number(right.avg_match_rating || 0) - Number(left.avg_match_rating || 0);
        if (matchRatingDelta !== 0) return matchRatingDelta;

        const matchesDelta = Number(right.matches_played || 0) - Number(left.matches_played || 0);
        if (matchesDelta !== 0) return matchesDelta;

        return String(left.gamertag || left.id || '').localeCompare(String(right.gamertag || right.id || ''));
      })
      .slice(0, limitPerPosition)
  ));
}

module.exports = {
  normalizeCountryCode,
  canVoteForCandidate,
  validateSquadSelection,
  chooseElectionWinner,
  rankOwnerCandidates,
  getTopPlayersByPosition,
};
