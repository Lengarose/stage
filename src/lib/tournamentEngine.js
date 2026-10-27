import { calculateStandings } from './standingsCore.js';
import { isStageResult } from './tournamentStages.js';
// Tournament Engine — auto-generate matches for any format

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function knockoutRoundType(matchCount) {
  const count = Number(matchCount) || 0;
  if (count >= 32) return "round_of_64";
  if (count >= 16) return "round_of_32";
  if (count >= 8) return "round_of_16";
  if (count >= 4) return "quarter_final";
  if (count >= 2) return "semi_final";
  return "final";
}

// Single elimination: pair clubs in round 1 and name that round (quarter-final, round of 16, …).
export function generateKnockoutRound1(clubs) {
  const shuffled = shuffleArray(clubs);
  const pairCount = Math.floor(shuffled.length / 2);
  const type = knockoutRoundType(pairCount);
  const matches = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1]) {
      matches.push({
        home_club_id: shuffled[i].id,
        home_club_name: shuffled[i].name,
        away_club_id: shuffled[i + 1].id,
        away_club_name: shuffled[i + 1].name,
        round: 1,
        type,
        group_number: i / 2,
        status: "scheduled",
        home_score: 0,
        away_score: 0,
      });
    }
  }
  return matches;
}

// League: every team plays every other team TWICE (home & away)
export function generateLeagueMatches(clubs) {
  const matches = [];
  for (let i = 0; i < clubs.length; i++) {
    for (let j = i + 1; j < clubs.length; j++) {
      // Leg 1: clubs[i] hosts
      matches.push({
        home_club_id: clubs[i].id,
        home_club_name: clubs[i].name,
        away_club_id: clubs[j].id,
        away_club_name: clubs[j].name,
        round: 1,
        type: "league",
        status: "scheduled",
        home_score: 0,
        away_score: 0,
      });
      // Leg 2 (return fixture): clubs[j] hosts
      matches.push({
        home_club_id: clubs[j].id,
        home_club_name: clubs[j].name,
        away_club_id: clubs[i].id,
        away_club_name: clubs[i].name,
        round: 2,
        type: "league",
        status: "scheduled",
        home_score: 0,
        away_score: 0,
      });
    }
  }
  return matches;
}

export function isLeagueTournamentFixtureMatch(match) {
  return String(match?.type || "").toLowerCase() === "league";
}

export function getLeagueTournamentFixtureMatches(matches) {
  if (!Array.isArray(matches)) return [];
  return matches.filter(isLeagueTournamentFixtureMatch);
}

const SWISS_UCL_DISPLAY_MATCH_TYPES = new Set(["ucl_league", "ucl_playoff", "ucl_r16", "ucl_qf", "ucl_sf", "final"]);

export function getSwissUclDisplayMatches(matches) {
  if (!Array.isArray(matches)) return [];
  return matches.filter((match) => SWISS_UCL_DISPLAY_MATCH_TYPES.has(String(match?.type || "").toLowerCase()));
}

// League standings from all league matches
export function calculateLeagueStandings(matches, options = {}) {
  return calculateStandings(matches, { ...options, phase: 'league' }).rows;
}

// Group Stage: split clubs into groups, round-robin within each group
export function generateGroupStageMatches(clubs, numGroups = 2) {
  const groups = Array.from({ length: numGroups }, () => []);
  const shuffled = shuffleArray(clubs);
  shuffled.forEach((club, i) => groups[i % numGroups].push(club));

  const matches = [];
  groups.forEach((group, gIdx) => {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        matches.push({
          home_club_id: group[i].id,
          home_club_name: group[i].name,
          away_club_id: group[j].id,
          away_club_name: group[j].name,
          round: 1,
          group: gIdx,
          type: "group",
          status: "scheduled",
          home_score: 0,
          away_score: 0,
        });
      }
    }
  });
  return matches;
}

// Calculate total rounds for knockout
export function knockoutRounds(numTeams) {
  return Math.ceil(Math.log2(numTeams));
}

// Generate next knockout round from completed matches
export function generateNextKnockoutRound(completedMatches, round) {
  const roundMatches = completedMatches
    .filter(m => m.round === round && (m.status === "completed" || m.status === "forfeit") && m.winner_club_id);
  const winners = roundMatches
    .map(m => ({
      id: m.winner_club_id,
      name: m.winner_club_id === m.home_club_id ? m.home_club_name : m.away_club_name,
    }));
  const losers = roundMatches.map(m => ({
      id: m.winner_club_id === m.home_club_id ? m.away_club_id : m.home_club_id,
      name: m.winner_club_id === m.home_club_id ? m.away_club_name : m.home_club_name,
  }));

  if (roundMatches.some(m => String(m.type || "").includes("final"))) return [];

  const matches = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (winners[i + 1]) {
      const isFinalRound = winners.length === 2;
      matches.push({
        home_club_id: winners[i].id,
        home_club_name: winners[i].name,
        away_club_id: winners[i + 1].id,
        away_club_name: winners[i + 1].name,
        round: round + 1,
        type: isFinalRound ? "final" : "knockout",
        status: "scheduled",
        home_score: 0,
        away_score: 0,
      });
      if (isFinalRound && losers[i] && losers[i + 1]) {
        matches.push({
          home_club_id: losers[i].id,
          home_club_name: losers[i].name,
          away_club_id: losers[i + 1].id,
          away_club_name: losers[i + 1].name,
          round: round + 1,
          type: "third_place",
          status: "scheduled",
          home_score: 0,
          away_score: 0,
        });
      }
    }
  }
  return matches;
}

export function isPlayerParticipant(participantType) {
  return String(participantType || "").toLowerCase() === "player";
}

export function sameParticipant(left, right) {
  if (left == null || right == null || left === "" || right === "") return false;
  return String(left) === String(right);
}

export function matchSide(match, side, participantType = "club") {
  const player = isPlayerParticipant(participantType);
  const primaryId = player ? match?.[`${side}_player_id`] : match?.[`${side}_club_id`];
  const primaryName = player ? match?.[`${side}_player_name`] : match?.[`${side}_club_name`];
  const fallbackId = player ? match?.[`${side}_club_id`] : match?.[`${side}_player_id`];
  const fallbackName = player ? match?.[`${side}_club_name`] : match?.[`${side}_player_name`];
  return {
    id: primaryId || fallbackId || null,
    name: primaryName || fallbackName || "",
  };
}

export function matchWinnerSide(match, participantType = "club") {
  if(match&&isStageResult(match)&&Number(match.decided_on_penalties)===1&&['home','away'].includes(match.penalty_winner_side))return match.penalty_winner_side;
  const home = matchSide(match, "home", participantType);
  const away = matchSide(match, "away", participantType);
  const winnerId = isPlayerParticipant(participantType)
    ? (match?.winner_player_id || match?.winner_club_id)
    : (match?.winner_club_id || match?.winner_player_id);
  if (sameParticipant(winnerId, home.id)) return "home";
  if (sameParticipant(winnerId, away.id)) return "away";
  const homeScore = Number(match?.home_score);
  const awayScore = Number(match?.away_score);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

function knockoutSideFields(participant, prefix, participantType) {
  if (!participant?.id) return null;
  if (isPlayerParticipant(participantType)) {
    return {
      [`${prefix}_player_id`]: participant.id,
      [`${prefix}_player_name`]: participant.name || "",
      [`${prefix}_club_id`]: null,
      [`${prefix}_club_name`]: null,
      mode: "player",
    };
  }
  return {
    [`${prefix}_club_id`]: participant.id,
    [`${prefix}_club_name`]: participant.name || "",
    mode: "club",
  };
}

function scheduledTieMatch(home, away, round, type, participantType, tieIndex = null) {
  const homeFields = knockoutSideFields(home, "home", participantType);
  const awayFields = knockoutSideFields(away, "away", participantType);
  if (!homeFields || !awayFields || sameParticipant(home.id, away.id)) return null;
  return {
    ...homeFields,
    ...awayFields,
    round,
    type,
    group_number: tieIndex,
    status: "unscheduled",
    home_score: 0,
    away_score: 0,
  };
}

export function resolveTwoLegTie(legs, participantType = "club") {
  const totals = new Map();
  for (const leg of legs || []) {
    for (const side of ["home", "away"]) {
      const participant = matchSide(leg, side, participantType);
      if (!participant.id) continue;
      const score = Number(side === "home" ? leg.home_score : leg.away_score) || 0;
      const current = totals.get(String(participant.id)) || { ...participant, goals: 0 };
      current.goals += score;
      if (!current.name && participant.name) current.name = participant.name;
      totals.set(String(participant.id), current);
    }
  }
  const sides = [...totals.values()];
  if (sides.length < 2) return null;
  const ranked = [...sides].sort((a, b) => b.goals - a.goals || String(a.name || "").localeCompare(String(b.name || "")));
  if (ranked[0].goals !== ranked[1].goals) {
    return { winner: ranked[0], loser: ranked[1] };
  }
  const lastLeg = [...legs].sort((a, b) => Number(b.round || 0) - Number(a.round || 0))[0];
  const result = matchWinnerSide(lastLeg, participantType);
  if (result !== "home" && result !== "away") return null;
  const winner = matchSide(lastLeg, result, participantType);
  const loser = sides.find((side) => !sameParticipant(side.id, winner.id));
  if (!winner.id || !loser?.id) return null;
  return { winner, loser };
}

const TWO_LEG_KNOCKOUT_TYPES = ["ucl_sf", "ucl_qf", "ucl_r16", "semi_final", "quarter_final", "round_of_16"];
const TWO_LEG_NEXT = {
  round_of_16: "quarter_final",
  quarter_final: "semi_final",
  semi_final: "final",
  ucl_r16: "ucl_qf",
  ucl_qf: "ucl_sf",
  ucl_sf: "final",
};
const SINGLE_LEG_TYPES = new Set(["knockout", "round_of_64", "round_of_32", "round_of_16", "quarter_final", "semi_final"]);
const GROUP_CHAIN = ["round_of_16", "quarter_final", "semi_final"];
const UCL_CHAIN = ["ucl_r16", "ucl_qf", "ucl_sf"];

function phaseUsesTwoLegs(matches, type) {
  const rounds = new Set((matches || []).filter((match) => match.type === type).map((match) => Number(match.round || 0)));
  return rounds.size >= 2;
}

function buildSingleEliminationContinuation(matches, participantType) {
  const rows = (matches || []).filter((match) => SINGLE_LEG_TYPES.has(String(match.type || "")));
  if (!rows.length) return null;
  if (rows.some((match) => phaseUsesTwoLegs(matches, match.type))) return null;
  const finished = (match) => ["completed", "forfeit"].includes(String(match?.status || ""));
  const latestRound = Math.max(...rows.map((match) => Number(match.round || 0)));
  const latest = rows.filter((match) => Number(match.round || 0) === latestRound && !["final", "third_place"].includes(String(match.type || "")));
  if (!latest.length || latest.some((match) => !finished(match))) return [];
  if (rows.some((match) => Number(match.round || 0) > latestRound)) return [];
  if ((matches || []).some((match) => String(match.type || "") === "final")) return [];

  const winners = [];
  const losers = [];
  for (const match of latest) {
    const result = matchWinnerSide(match, participantType);
    if (result !== "home" && result !== "away") return [];
    winners.push(matchSide(match, result, participantType));
    losers.push(matchSide(match, result === "home" ? "away" : "home", participantType));
  }
  const nextRound = latestRound + 1;
  if (winners.length === 2) {
    return [
      scheduledTieMatch(winners[0], winners[1], nextRound, "final", participantType, 0),
      scheduledTieMatch(losers[0], losers[1], nextRound, "third_place", participantType, 1),
    ].filter(Boolean);
  }
  const nextType = knockoutRoundType(Math.floor(winners.length / 2));
  const created = [];
  for (let index = 0; index < winners.length; index += 2) {
    if (!winners[index + 1]) continue;
    created.push(scheduledTieMatch(winners[index], winners[index + 1], nextRound, nextType, participantType, index / 2));
  }
  return created.filter(Boolean);
}

function placeholderMatch(round, type, index) {
  return {
    id: `placeholder-${type}-${round}-${index}`,
    round,
    type,
    group_number: index,
    placeholder: true,
    status: "unscheduled",
  };
}

function appendTwoLegPlaceholders(source, chain) {
  const rows = source.filter((match) => chain.includes(String(match.type || "")) || ["final", "third_place"].includes(String(match.type || "")));
  if (!rows.length || rows.some((match) => match.type === "final")) return source;
  const present = chain.filter((phase) => rows.some((match) => match.type === phase));
  const furthest = present[present.length - 1];
  if (!furthest) return source;
  let cursor = Math.max(...source.map((match) => Number(match.round || 1)));
  const extras = [];
  const phaseRows = rows.filter((match) => match.type === furthest);
  let ties = new Set(phaseRows.map((match) => String(match.group_number ?? match.group ?? match.id))).size;
  const phaseRounds = new Set(phaseRows.map((match) => Number(match.round || 0)));
  if (phaseRounds.size < 2) {
    cursor += 1;
    phaseRows.forEach((leg, index) => extras.push(placeholderMatch(cursor, furthest, leg.group_number ?? index)));
  }
  for (const phase of chain.slice(chain.indexOf(furthest) + 1)) {
    ties = Math.max(1, Math.floor(ties / 2));
    cursor += 1;
    for (let index = 0; index < ties; index += 1) extras.push(placeholderMatch(cursor, phase, index));
    cursor += 1;
    for (let index = 0; index < ties; index += 1) extras.push(placeholderMatch(cursor, phase, index));
  }
  cursor += 1;
  extras.push(placeholderMatch(cursor, "final", 0), placeholderMatch(cursor, "third_place", 1));
  return [...source, ...extras];
}

function appendSingleLegPlaceholders(source) {
  const relevant = source.filter((match) => SINGLE_LEG_TYPES.has(String(match.type || "")) || ["final", "third_place"].includes(String(match.type || "")));
  if (!relevant.length || relevant.some((match) => match.type === "final")) return source;
  if (relevant.some((match) => phaseUsesTwoLegs(source, match.type))) return source;
  const rounds = [...new Set(relevant.map((match) => Number(match.round || 1)))].sort((a, b) => a - b);
  const widest = Math.max(...rounds.map((round) => relevant.filter((match) => Number(match.round || 1) === round && match.type !== "third_place").length));
  const plan = [];
  let count = widest;
  while (count >= 1) {
    plan.push({ type: knockoutRoundType(count), matchCount: count });
    if (count === 1) break;
    count = Math.floor(count / 2);
  }
  const extras = [];
  let cursor = Math.max(...rounds);
  for (let index = rounds.length; index < plan.length; index += 1) {
    cursor += 1;
    const stage = plan[index];
    if (stage.type === "final") {
      extras.push(placeholderMatch(cursor, "final", 0), placeholderMatch(cursor, "third_place", 1));
    } else {
      for (let matchIndex = 0; matchIndex < stage.matchCount; matchIndex += 1) {
        extras.push(placeholderMatch(cursor, stage.type, matchIndex));
      }
    }
  }
  return [...source, ...extras];
}

export function projectKnockoutBracket(matches, tournamentType = "knockout") {
  const source = Array.isArray(matches) ? matches : [];
  const type = String(tournamentType || "").toLowerCase();
  if (type === "league") return source;
  if (type === "swiss_ucl") return appendTwoLegPlaceholders(source, UCL_CHAIN);
  if (type === "group_stage") return appendTwoLegPlaceholders(source, GROUP_CHAIN);
  return appendSingleLegPlaceholders(source);
}

export function buildKnockoutContinuation(matches, participantType = "club") {
  const single = buildSingleEliminationContinuation(matches, participantType);
  if (single) return single;
  const rows = Array.isArray(matches) ? matches : [];
  const finished = (match) => ["completed", "forfeit"].includes(String(match?.status || ""));
  const phase = TWO_LEG_KNOCKOUT_TYPES.find((type) => rows.some((match) => match.type === type) && phaseUsesTwoLegs(rows, type));
  if (!phase) return [];
  const phaseMatches = rows.filter((match) => match.type === phase);
  if (!phaseMatches.length || phaseMatches.some((match) => !finished(match))) return [];
  const nextType = TWO_LEG_NEXT[phase];
  if (rows.some((match) => match.type === "final")) return [];
  if (nextType && nextType !== "final" && rows.some((match) => match.type === nextType)) return [];

  const byTie = new Map();
  for (const match of phaseMatches) {
    const key = String(match.group_number ?? match.group ?? match.id);
    if (!byTie.has(key)) byTie.set(key, []);
    byTie.get(key).push(match);
  }
  const keys = [...byTie.keys()].sort((a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b)));
  const results = keys.map((key) => resolveTwoLegTie(byTie.get(key), participantType));
  if (results.some((result) => !result)) return [];

  const nextRound = Math.max(...phaseMatches.map((match) => Number(match.round || 0))) + 1;
  if (results.length === 2) {
    return [
      scheduledTieMatch(results[0].winner, results[1].winner, nextRound, "final", participantType),
      scheduledTieMatch(results[0].loser, results[1].loser, nextRound, "third_place", participantType),
    ].filter(Boolean);
  }

  const winners = results.map((result) => result.winner);
  const type = nextType || "semi_final";
  const created = [];
  for (let index = 0; index < winners.length; index += 2) {
    const home = winners[index];
    const away = winners[index + 1];
    if (!away) continue;
    const tieIndex = index / 2;
    if (type === "final") {
      created.push(scheduledTieMatch(home, away, nextRound, "final", participantType));
      continue;
    }
    created.push(scheduledTieMatch(home, away, nextRound, type, participantType, tieIndex));
    created.push(scheduledTieMatch(away, home, nextRound + 1, type, participantType, tieIndex));
  }
  return created.filter(Boolean);
}

function emptyStandingRow(id, name) {
  return { id, name: name || "", P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
}

// Group stage standings calculation
export function calculateGroupStandings(matches, numGroups, participantType = "club") {
  const groups = Array.from({ length: numGroups }, () => ({}));

  matches.filter(m => ["group", "group_stage"].includes(String(m.type || "")) && (m.group !== undefined || m.group_number !== undefined) && (m.status === "completed" || m.status === "forfeit")).forEach(m => {
    const g = Number(m.group_number ?? m.group ?? 0);
    if (g >= groups.length || g < 0) return;
    const home = matchSide(m, "home", participantType);
    const away = matchSide(m, "away", participantType);
    if (!home.id || !away.id || sameParticipant(home.id, away.id)) return;
    if (!groups[g][home.id]) groups[g][home.id] = emptyStandingRow(home.id, home.name);
    if (!groups[g][away.id]) groups[g][away.id] = emptyStandingRow(away.id, away.name);

    const h = groups[g][home.id];
    const a = groups[g][away.id];
    if (!h.name && home.name) h.name = home.name;
    if (!a.name && away.name) a.name = away.name;
    h.P++; a.P++;
    h.GF += m.home_score || 0; h.GA += m.away_score || 0;
    a.GF += m.away_score || 0; a.GA += m.home_score || 0;
    h.GD = h.GF - h.GA; a.GD = a.GF - a.GA;

    const result = matchWinnerSide(m, participantType);
    if (result === "home") { h.W++; h.Pts += 3; a.L++; }
    else if (result === "away") { a.W++; a.Pts += 3; h.L++; }
    else { h.D++; h.Pts++; a.D++; a.Pts++; }
  });

  return groups.map(g =>
    Object.values(g).sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || String(a.name || "").localeCompare(String(b.name || "")))
  );
}

// ─── UCL Swiss Format ────────────────────────────────────────────────────────
// 36 teams, 8 matchday rounds (4H 4A each), then playoff (9-24), then knockout

export function generateUCLLeaguePhase(clubs) {
  if (clubs.length !== 36) throw new Error('Swiss UCL requires 36 registered participants.');
  if (clubs.length < 2) return [];
  const shuffled = shuffleArray([...clubs]);
  const n = shuffled.length;
  // Pad to even if needed
  const teams = n % 2 === 0 ? shuffled : [...shuffled, null];
  const size = teams.length;
  const homeCount = Object.fromEntries(shuffled.map(c => [c.id, 0]));
  const allMatches = [];

  // Circle method: fix teams[0], rotate teams[1..size-1]
  const fixed = teams[0];
  const circle = teams.slice(1); // length size-1

  for (let round = 1; round <= 8; round++) {
    const offset = (round - 1) % circle.length;
    const rot = [...circle.slice(offset), ...circle.slice(0, offset)];
    const roundTeams = [fixed, ...rot]; // length = size

    for (let i = 0; i < size / 2; i++) {
      const a = roundTeams[i];
      const b = roundTeams[size - 1 - i];
      if (!a || !b) continue;
      let home, away;
      if (homeCount[a.id] <= homeCount[b.id]) {
        home = a; away = b; homeCount[a.id]++;
      } else {
        home = b; away = a; homeCount[b.id]++;
      }
      allMatches.push({
        home_club_id: home.id, home_club_name: home.name,
        away_club_id: away.id, away_club_name: away.name,
        round, type: "ucl_league", status: "scheduled",
        home_score: 0, away_score: 0,
      });
    }
  }
  return allMatches;
}

// Calculate UCL league standings from ucl_league matches
export function calculateUCLStandings(matches, options = {}) {
  return calculateStandings(matches, { ...options, phase: 'ucl_league' }).rows;
}

// Generate UCL Playoff draw (teams ranked 9-24, 2 legs each)
// seededClubs = ranks 9-16, unseededClubs = ranks 17-24 (higher seed hosts leg2)
export function generateUCLPlayoffMatches(rankedClubs9to24) {
  // rankedClubs9to24[0] = 9th, ...[15] = 24th
  // Seeded: 9-16, Unseeded: 17-24. Pair: 9v24, 10v23, ..., 16v17
  const matches = [];
  for (let i = 0; i < 8; i++) {
    const seeded = rankedClubs9to24[i];
    const unseeded = rankedClubs9to24[15 - i];
    // Leg 1 (round 9): unseeded hosts
    matches.push({
      home_club_id: unseeded.id, home_club_name: unseeded.name,
      away_club_id: seeded.id, away_club_name: seeded.name,
      round: 9, type: "ucl_playoff", group: i,
      status: "scheduled", home_score: 0, away_score: 0,
    });
    // Leg 2 (round 10): seeded hosts
    matches.push({
      home_club_id: seeded.id, home_club_name: seeded.name,
      away_club_id: unseeded.id, away_club_name: unseeded.name,
      round: 10, type: "ucl_playoff", group: i,
      status: "scheduled", home_score: 0, away_score: 0,
    });
  }
  return matches;
}

// Generate UCL R16: top8 + 8 playoff winners, 2 legs, seeded avoid same group
export function generateUCLKnockoutLegs(teams, startRound, matchType) {
  // teams[0..7] = seeded, teams[8..15] = unseeded (or just random pairs)
  const shuffledSeeded = shuffleArray(teams.slice(0, 8));
  const shuffledUnseeded = shuffleArray(teams.slice(8));
  const matches = [];
  for (let i = 0; i < Math.min(shuffledSeeded.length, shuffledUnseeded.length); i++) {
    const seed = shuffledSeeded[i];
    const unseed = shuffledUnseeded[i];
    // Leg 1: unseeded hosts
    matches.push({
      home_club_id: unseed.id, home_club_name: unseed.name,
      away_club_id: seed.id, away_club_name: seed.name,
      round: startRound, type: matchType, group: i,
      status: "scheduled", home_score: 0, away_score: 0,
    });
    // Leg 2: seeded hosts
    matches.push({
      home_club_id: seed.id, home_club_name: seed.name,
      away_club_id: unseed.id, away_club_name: unseed.name,
      round: startRound + 1, type: matchType, group: i,
      status: "scheduled", home_score: 0, away_score: 0,
    });
  }
  return matches;
}

// Determine winner of a 2-legged tie (+ optional 3rd game)
// Rules:
//   - After 2 legs: winner by aggregate only. Draw → 3rd game needed (returns null).
//   - After 3rd game: winner by score. If 3rd game is also a draw → away team in leg3 wins (away goals rule on leg3 only).
export function getAggregateWinner(leg1, leg2, leg3) {
  if (!leg1 || !leg2) return null;
  if (leg1.status !== "completed" || leg2.status !== "completed") return null;

  const clubA = leg1.home_club_id; // A was home in leg1
  const clubB = leg1.away_club_id; // B was home in leg2
  const agg_A = (leg1.home_score || 0) + (leg2.away_score || 0);
  const agg_B = (leg1.away_score || 0) + (leg2.home_score || 0);

  if (agg_A > agg_B) return { id: clubA, name: leg1.home_club_name, agg_A, agg_B };
  if (agg_B > agg_A) return { id: clubB, name: leg1.away_club_name, agg_A, agg_B };

  // Aggregate draw — check leg3
  if (!leg3 || leg3.status !== "completed") return null; // 3rd game still needed

  const leg3_home = leg3.home_club_id;
  const leg3_away = leg3.away_club_id;
  const s_home = leg3.home_score || 0;
  const s_away = leg3.away_score || 0;

  if (s_home > s_away) return { id: leg3_home, name: leg3.home_club_name };
  if (s_away > s_home) return { id: leg3_away, name: leg3.away_club_name };

  // 3rd game also a draw → away team in leg3 wins (away goals rule on leg3 only)
  return { id: leg3_away, name: leg3.away_club_name, via: "away_goals_leg3" };
}
