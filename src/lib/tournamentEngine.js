// Tournament Engine — auto-generate matches for any format

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Single/Double Elimination: pair clubs in round 1
export function generateKnockoutRound1(clubs) {
  const shuffled = shuffleArray(clubs);
  const matches = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    if (shuffled[i + 1]) {
      matches.push({
        home_club_id: shuffled[i].id,
        home_club_name: shuffled[i].name,
        away_club_id: shuffled[i + 1].id,
        away_club_name: shuffled[i + 1].name,
        round: 1,
        type: "knockout",
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

// League standings from all league matches
export function calculateLeagueStandings(matches) {
  const table = {};
  matches
    .filter(m => m.type === "league" && (m.status === "completed" || m.status === "forfeit"))
    .forEach(m => {
      if (!table[m.home_club_id]) table[m.home_club_id] = { id: m.home_club_id, name: m.home_club_name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
      if (!table[m.away_club_id]) table[m.away_club_id] = { id: m.away_club_id, name: m.away_club_name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
      const h = table[m.home_club_id], a = table[m.away_club_id];
      h.P++; a.P++;
      h.GF += m.home_score || 0; h.GA += m.away_score || 0;
      a.GF += m.away_score || 0; a.GA += m.home_score || 0;
      h.GD = h.GF - h.GA; a.GD = a.GF - a.GA;
      if (m.winner_club_id === m.home_club_id) { h.W++; h.Pts += 3; a.L++; }
      else if (m.winner_club_id === m.away_club_id) { a.W++; a.Pts += 3; h.L++; }
      else { h.D++; h.Pts++; a.D++; a.Pts++; }
    });
  return Object.values(table).sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF);
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
  const winners = completedMatches
    .filter(m => m.round === round && (m.status === "completed" || m.status === "forfeit") && m.winner_club_id)
    .map(m => ({
      id: m.winner_club_id,
      name: m.winner_club_id === m.home_club_id ? m.home_club_name : m.away_club_name,
    }));

  const matches = [];
  for (let i = 0; i < winners.length; i += 2) {
    if (winners[i + 1]) {
      matches.push({
        home_club_id: winners[i].id,
        home_club_name: winners[i].name,
        away_club_id: winners[i + 1].id,
        away_club_name: winners[i + 1].name,
        round: round + 1,
        type: round + 1 === knockoutRounds(completedMatches.length * 2) ? "final" : "knockout",
        status: "scheduled",
        home_score: 0,
        away_score: 0,
      });
    }
  }
  return matches;
}

// Group stage standings calculation
export function calculateGroupStandings(matches, numGroups) {
  const groups = Array.from({ length: numGroups }, () => ({}));

  matches.filter(m => m.group !== undefined && m.group !== null && (m.status === "completed" || m.status === "forfeit")).forEach(m => {
    const g = m.group;
    if (g >= groups.length) return;
    if (!groups[g][m.home_club_id]) groups[g][m.home_club_id] = { id: m.home_club_id, name: m.home_club_name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
    if (!groups[g][m.away_club_id]) groups[g][m.away_club_id] = { id: m.away_club_id, name: m.away_club_name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };

    const h = groups[g][m.home_club_id];
    const a = groups[g][m.away_club_id];
    h.P++; a.P++;
    h.GF += m.home_score || 0; h.GA += m.away_score || 0;
    a.GF += m.away_score || 0; a.GA += m.home_score || 0;
    h.GD = h.GF - h.GA; a.GD = a.GF - a.GA;

    if (m.winner_club_id === m.home_club_id) { h.W++; h.Pts += 3; a.L++; }
    else if (m.winner_club_id === m.away_club_id) { a.W++; a.Pts += 3; h.L++; }
    else { h.D++; h.Pts++; a.D++; a.Pts++; }
  });

  return groups.map(g =>
    Object.values(g).sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF)
  );
}

// ─── UCL Swiss Format ────────────────────────────────────────────────────────
// 36 teams, 8 matchday rounds (4H 4A each), then playoff (9-24), then knockout

export function generateUCLLeaguePhase(clubs) {
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
export function calculateUCLStandings(matches) {
  const table = {};
  matches
    .filter(m => m.type === "ucl_league" && (m.status === "completed" || m.status === "forfeit"))
    .forEach(m => {
      if (!table[m.home_club_id]) table[m.home_club_id] = { id: m.home_club_id, name: m.home_club_name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
      if (!table[m.away_club_id]) table[m.away_club_id] = { id: m.away_club_id, name: m.away_club_name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
      const h = table[m.home_club_id], a = table[m.away_club_id];
      h.P++; a.P++;
      h.GF += m.home_score || 0; h.GA += m.away_score || 0;
      a.GF += m.away_score || 0; a.GA += m.home_score || 0;
      h.GD = h.GF - h.GA; a.GD = a.GF - a.GA;
      if (m.winner_club_id === m.home_club_id) { h.W++; h.Pts += 3; a.L++; }
      else if (m.winner_club_id === m.away_club_id) { a.W++; a.Pts += 3; h.L++; }
      else { h.D++; h.Pts++; a.D++; a.Pts++; }
    });
  return Object.values(table).sort((a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF);
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