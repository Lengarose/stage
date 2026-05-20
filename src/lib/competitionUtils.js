import { stageClient } from "@/api/stageClient";

export const COMPETITIONS = [
  {
    slug: "supreme",
    name: "STAGE Supreme League",
    tier: 1,
    color: "#FFD700",
    textColor: "text-yellow-400",
    borderColor: "border-yellow-400/40",
    bgColor: "bg-yellow-400/10",
    badgeClass: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    description: "The pinnacle of STAGE competition. Only the elite qualify.",
  },
  {
    slug: "elite",
    name: "STAGE Elite League",
    tier: 2,
    color: "#00E5BD",
    textColor: "text-primary",
    borderColor: "border-primary/40",
    bgColor: "bg-primary/10",
    badgeClass: "text-primary border-primary/30 bg-primary/5",
    description: "The proving ground. Earn your place in the Supreme League.",
  },
  {
    slug: "challenger",
    name: "STAGE Challenger League",
    tier: 3,
    color: "#A78BFA",
    textColor: "text-violet-400",
    borderColor: "border-violet-400/40",
    bgColor: "bg-violet-400/10",
    badgeClass: "text-violet-400 border-violet-400/30 bg-violet-400/5",
    description: "Where every STAGE career begins. Rise through the ranks.",
  },
];

export function getCompetitionMeta(slug) {
  return COMPETITIONS.find(c => c.slug === slug) || COMPETITIONS[2];
}

export function sortStandings(standings) {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
    return a.club_name.localeCompare(b.club_name);
  });
}

// Generate round-robin fixtures for a list of clubs (double round-robin = home & away)
export function generateRoundRobinPairs(clubs) {
  const pairs = [];
  for (let i = 0; i < clubs.length; i++) {
    for (let j = i + 1; j < clubs.length; j++) {
      pairs.push({ home: clubs[i], away: clubs[j] });
      pairs.push({ home: clubs[j], away: clubs[i] });
    }
  }
  return pairs;
}

// Assign pairs to matchdays using round-robin scheduling (circle method)
export function assignMatchdays(clubs) {
  const n = clubs.length;
  const isOdd = n % 2 !== 0;
  const list = isOdd ? [...clubs, null] : [...clubs]; // null = bye
  const numTeams = list.length;
  const rounds = numTeams - 1;
  const matchesPerRound = numTeams / 2;
  const matchdays = [];

  for (let round = 0; round < rounds; round++) {
    const day = [];
    for (let match = 0; match < matchesPerRound; match++) {
      const home = list[match === 0 ? 0 : (round + match) % (numTeams - 1) + 1];
      const away = list[(round + numTeams - 1 - match) % (numTeams - 1) + 1];
      if (home && away) day.push({ home, away });
    }
    matchdays.push(day);
  }

  // Return rounds (first half) + reverse for second half (home/away swapped)
  const secondHalf = matchdays.map(day => day.map(m => ({ home: m.away, away: m.home })));
  return [...matchdays, ...secondHalf];
}

// ─── Internal helpers ──────────────────────────────────────────────────────────

function circleMethod(clubs) {
  const n = clubs.length;
  if (n % 2 !== 0) throw new Error("circleMethod requires an even number of clubs");
  const circle = clubs.slice();
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const day = [];
    for (let i = 0; i < n / 2; i++) {
      day.push({ home: circle[i], away: circle[n - 1 - i] });
    }
    rounds.push(day);
    // Rotate circle[1..n-1]: last element moves to position 1
    const last = circle[n - 1];
    for (let i = n - 1; i > 1; i--) circle[i] = circle[i - 1];
    circle[1] = last;
  }
  return rounds;
}

function fixtureBase(season) {
  const now = new Date();
  return {
    season_id: season.id,
    competition_id: season.competition_id,
    competition_name: season.competition_name,
    competition_tier: season.competition_tier,
    competition_slug: season.competition_slug,
    season_number: season.season_number,
    status: "scheduled",
    stats_processed: false,
    home_score: 0,
    away_score: 0,
    scheduling_status: "open",
    window_start: now.toISOString(),
    window_end: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    window_days: 5,
    proposal_count: 0,
  };
}

function standingToClub(s) {
  return { id: s.club_id, name: s.club_name, logo_url: s.club_logo_url || "", tag: s.club_tag || "" };
}

function fixtureClubFields(prefix, club) {
  return {
    [`${prefix}_club_id`]: club.id || club.club_id,
    [`${prefix}_club_name`]: club.name || club.club_name,
    [`${prefix}_club_logo_url`]: club.logo_url || club.club_logo_url || "",
    [`${prefix}_club_tag`]: club.tag || club.club_tag || "",
  };
}

// ─── League phase (8-matchday format for 36 clubs) ─────────────────────────────

/**
 * Generate 8-matchday fixtures from standings.
 * Matchdays 1-4: circle method rounds 0-3.
 * Matchdays 5-8: same rounds with home/away swapped → perfect 4H/4A balance.
 */
export async function generateLeaguePhaseFixtures(season, standings) {
  const clubs = sortStandings(standings).map(standingToClub);
  if (clubs.length < 4) throw new Error("Need at least 4 clubs to generate fixtures.");
  // Ensure even number for circle method
  const n = clubs.length % 2 === 0 ? clubs.length : clubs.length - 1;
  const evenClubs = clubs.slice(0, n);
  const allRounds = circleMethod(evenClubs);
  const numUniqueRounds = Math.min(4, Math.floor(allRounds.length / 2));

  const matchdays = [
    ...allRounds.slice(0, numUniqueRounds),
    ...allRounds.slice(0, numUniqueRounds).map(day =>
      day.map(({ home, away }) => ({ home: away, away: home }))
    ),
  ];

  const base = fixtureBase(season);
  const ops = matchdays.flatMap((day, mdIdx) =>
    day.map(({ home, away }) =>
      stageClient.entities.CompetitionFixture.create({
        ...base,
        ...fixtureClubFields("home", home),
        ...fixtureClubFields("away", away),
        phase: "league",
        matchday: mdIdx + 1,
      })
    )
  );

  await Promise.all(ops);
  await stageClient.entities.CompetitionSeason.update(season.id, {
    status: "league_phase",
    league_matchday_total: matchdays.length,
    num_league_matchdays: matchdays.length,
    current_matchday: 1,
    fixtures_generated: true,
  });
}

// ─── Playoff round (positions 9-24, 8 two-legged ties) ────────────────────────

export async function generatePlayoffRound(season, standings) {
  const sorted = sortStandings(standings);
  const total = sorted.length;
  // Positions 9-24 → indices 8-23
  const participants = sorted.slice(8, 24);
  if (participants.length < 8) throw new Error("Not enough clubs for playoff round (need positions 9-24).");

  const base = fixtureBase(season);
  const ops = [];

  // Mark positions 25-36 as eliminated
  sorted.slice(24).forEach((s, i) =>
    ops.push(stageClient.entities.CompetitionStanding.update(s.id, {
      is_eliminated: true,
      final_position: 25 + i,
    }))
  );
  // Mark positions 1-8 as direct knockout qualifiers
  sorted.slice(0, 8).forEach((s, i) =>
    ops.push(stageClient.entities.CompetitionStanding.update(s.id, {
      is_direct_knockout: true,
      final_position: i + 1,
    }))
  );
  // Mark positions 9-24 as playoff qualified
  participants.forEach(s =>
    ops.push(stageClient.entities.CompetitionStanding.update(s.id, { is_playoff_qualified: true }))
  );

  // Create 8 ties: position 9v24, 10v23, 11v22, 12v21, 13v20, 14v19, 15v18, 16v17
  for (let i = 0; i < 8; i++) {
    const higher = participants[i];       // higher seed (pos 9+i)
    const lower = participants[15 - i];   // lower seed (pos 24-i)
    const tieId = `playoff-${season.id}-${i + 1}`;

    // Leg 1: lower seed (worse position) is home
    ops.push(stageClient.entities.CompetitionFixture.create({
      ...base,
      ...fixtureClubFields("home", lower),
      ...fixtureClubFields("away", higher),
      phase: "playoff_round", tie_id: tieId, leg: 1, bracket_position: i + 1,
    }));
    // Leg 2: higher seed (better position) is home
    ops.push(stageClient.entities.CompetitionFixture.create({
      ...base,
      ...fixtureClubFields("home", higher),
      ...fixtureClubFields("away", lower),
      phase: "playoff_round", tie_id: tieId, leg: 2, bracket_position: i + 1,
    }));
  }

  await Promise.all(ops);
  await stageClient.entities.CompetitionSeason.update(season.id, { status: "playoff_round" });
}

// ─── Aggregate tie winner ──────────────────────────────────────────────────────

/**
 * Returns the aggregate winner club object, or null if tied (admin must set winner_club_id on leg2).
 * leg1.home_club is the lower seed, leg2.home_club is the higher seed.
 */
export function getAggregateWinner(leg1, leg2) {
  // Admin override: winner_club_id on leg2 is the tie winner (for ET / penalties)
  if (leg2.winner_club_id) {
    const isHome = leg2.winner_club_id === leg2.home_club_id;
    return {
      club_id: leg2.winner_club_id,
      club_name: isHome ? leg2.home_club_name : leg2.away_club_name,
      club_logo_url: isHome ? leg2.home_club_logo_url : leg2.away_club_logo_url,
      club_tag: isHome ? leg2.home_club_tag : leg2.away_club_tag,
    };
  }
  const l1home = leg1.home_score ?? 0;
  const l1away = leg1.away_score ?? 0;
  const l2home = leg2.home_score ?? 0;
  const l2away = leg2.away_score ?? 0;
  // leg1.home_club goals across both legs: l1home + l2away
  // leg1.away_club goals across both legs: l1away + l2home
  const lowerSeedGoals = l1home + l2away;
  const higherSeedGoals = l1away + l2home;
  if (lowerSeedGoals === higherSeedGoals) return null; // genuinely tied → admin must set winner
  return lowerSeedGoals > higherSeedGoals
    ? { club_id: leg1.home_club_id, club_name: leg1.home_club_name, club_logo_url: leg1.home_club_logo_url || "", club_tag: leg1.home_club_tag || "" }
    : { club_id: leg1.away_club_id, club_name: leg1.away_club_name, club_logo_url: leg1.away_club_logo_url || "", club_tag: leg1.away_club_tag || "" };
}

// ─── Round of 16 ──────────────────────────────────────────────────────────────

/**
 * Generate R16 fixtures.
 * Seeds 1-8 = direct qualifiers (league pos 1-8).
 * Seeds 9-16 = playoff winners (by original bracket position: tie1 winner=seed9, tie8 winner=seed16).
 * Draw: 1v16, 2v15, 3v14, 4v13, 5v12, 6v11, 7v10, 8v9.
 * Lower seed hosts leg 1; higher seed hosts leg 2.
 */
export async function generateKnockoutR16(season, standings, playoffFixtures) {
  const sorted = sortStandings(standings);
  const directQualifiers = sorted.slice(0, 8); // seeds 1-8

  // Group playoff fixtures by tie (bracket_position)
  const tieMap = {};
  playoffFixtures.forEach(f => {
    if (!tieMap[f.bracket_position]) tieMap[f.bracket_position] = [];
    tieMap[f.bracket_position].push(f);
  });

  // Get winner of each playoff tie (bracket_positions 1-8)
  const playoffWinners = [];
  for (let bp = 1; bp <= 8; bp++) {
    const legs = (tieMap[bp] || []).sort((a, b) => (a.leg ?? 1) - (b.leg ?? 1));
    const [leg1, leg2] = legs;
    if (!leg1 || !leg2) throw new Error(`Playoff tie ${bp} is missing a leg — ensure both legs are completed.`);
    const winner = getAggregateWinner(leg1, leg2);
    if (!winner) throw new Error(`Playoff tie ${bp} is still tied on aggregate — set the winner on leg 2 first.`);
    playoffWinners.push(winner); // index 0 = winner of tie 1 (was 9v24) = "seed 9"
  }

  // R16 draw: seed 1 vs seed 16, 2 vs 15, ..., 8 vs 9
  // seed 1-8 = directQualifiers[0..7]
  // seed 9 = playoffWinners[0] (winner of tie1 = was 9v24)
  // seed 16 = playoffWinners[7] (winner of tie8 = was 16v17)
  const base = fixtureBase(season);
  const ops = [];

  for (let i = 0; i < 8; i++) {
    const higher = directQualifiers[i];                     // seed i+1
    const lowerWinner = playoffWinners[7 - i];              // seed 16-i
    const tieId = `r16-${season.id}-${i + 1}`;

    // Leg 1: playoff winner (lower seed) is home
    ops.push(stageClient.entities.CompetitionFixture.create({
      ...base,
      ...fixtureClubFields("home", lowerWinner),
      ...fixtureClubFields("away", higher),
      phase: "knockout_r16", tie_id: tieId, leg: 1, bracket_position: i + 1,
    }));
    // Leg 2: direct qualifier (higher seed) is home
    ops.push(stageClient.entities.CompetitionFixture.create({
      ...base,
      ...fixtureClubFields("home", higher),
      ...fixtureClubFields("away", lowerWinner),
      phase: "knockout_r16", tie_id: tieId, leg: 2, bracket_position: i + 1,
    }));
  }

  await Promise.all(ops);
  await stageClient.entities.CompetitionSeason.update(season.id, { status: "knockout_r16" });
}

// ─── Generic knockout round advancement ───────────────────────────────────────

const PHASE_SEQUENCE = {
  knockout_r16: "knockout_qf",
  knockout_qf: "knockout_sf",
  knockout_sf: "knockout_final",
};

/**
 * From completed fixtures of currentPhase, determine winners and generate nextPhase fixtures.
 * For the Final: generates a SINGLE leg (no tie_id, no leg number).
 */
export async function generateNextKnockoutRound(season, currentFixtures, currentPhase) {
  const nextPhase = PHASE_SEQUENCE[currentPhase];
  if (!nextPhase) throw new Error(`No next phase after ${currentPhase}`);

  // Group by bracket_position and sort legs
  const tieMap = {};
  currentFixtures.filter(f => f.phase === currentPhase).forEach(f => {
    const bp = f.bracket_position;
    if (!tieMap[bp]) tieMap[bp] = [];
    tieMap[bp].push(f);
  });

  const sortedBPs = Object.keys(tieMap).map(Number).sort((a, b) => a - b);
  const winners = [];
  for (const bp of sortedBPs) {
    const legs = tieMap[bp].sort((a, b) => (a.leg ?? 1) - (b.leg ?? 1));
    const [leg1, leg2] = legs;
    if (!leg1) throw new Error(`Bracket position ${bp} has no fixtures.`);
    // Single-leg final doesn't have leg2
    if (!leg2) {
      const winner = getAggregateWinner(leg1, leg1); // single leg: same fixture for both
      throw new Error(`Expected two legs at bracket position ${bp}`);
    }
    const winner = getAggregateWinner(leg1, leg2);
    if (!winner) throw new Error(`Tie at bracket position ${bp} is still on aggregate — set the winner on leg 2 first.`);
    winners.push({ ...winner, _bp: bp });
  }

  const base = fixtureBase(season);
  const ops = [];
  const n = winners.length;

  if (nextPhase === "knockout_final") {
    // Single match — no legs, no tie_id
    const [w1, w2] = winners;
    if (!w1 || !w2) throw new Error("Need exactly 2 semi-final winners.");
    ops.push(stageClient.entities.CompetitionFixture.create({
      ...base,
      ...fixtureClubFields("home", w1),
      ...fixtureClubFields("away", w2),
      phase: "knockout_final",
      bracket_position: 1,
    }));
  } else {
    // Two-legged ties: 1 vs n, 2 vs n-1, ...
    const numTies = n / 2;
    for (let i = 0; i < numTies; i++) {
      const seeded = winners[i];         // "higher seed" (better bracket position)
      const unseeded = winners[n - 1 - i]; // "lower seed"
      const tieId = `${nextPhase}-${season.id}-${i + 1}`;

      // Leg 1: "lower seed" (unseeded) is home
      ops.push(stageClient.entities.CompetitionFixture.create({
        ...base,
        ...fixtureClubFields("home", unseeded),
        ...fixtureClubFields("away", seeded),
        phase: nextPhase, tie_id: tieId, leg: 1, bracket_position: i + 1,
      }));
      // Leg 2: "higher seed" (seeded) is home
      ops.push(stageClient.entities.CompetitionFixture.create({
        ...base,
        ...fixtureClubFields("home", seeded),
        ...fixtureClubFields("away", unseeded),
        phase: nextPhase, tie_id: tieId, leg: 2, bracket_position: i + 1,
      }));
    }
  }

  await Promise.all(ops);
  await stageClient.entities.CompetitionSeason.update(season.id, { status: nextPhase });
}

// ─── Process a completed fixture ───────────────────────────────────────────────

// Process a completed fixture: update standings then re-sort positions
export async function processFixtureResult(fixture) {
  if (fixture.stats_processed) return;

  const homeScore = fixture.home_score ?? 0;
  const awayScore = fixture.away_score ?? 0;

  // Award ranking points for every confirmed match (league + knockout)
  const _rankingUpdate = (async () => {
    try {
      const { updateClubRankingAfterMatch } = await import("./rankingEngine");
      const [[homeClub], [awayClub]] = await Promise.all([
        stageClient.entities.Club.filter({ id: fixture.home_club_id }, null, 1).catch(() => []),
        stageClient.entities.Club.filter({ id: fixture.away_club_id }, null, 1).catch(() => []),
      ]);
      if (homeClub && awayClub) {
        await updateClubRankingAfterMatch({
          homeClub, awayClub, homeScore, awayScore,
          competitionType: "competition",
          competitionSlug: fixture.competition_slug || null,
          division:        null,
          phase:           fixture.phase || "league",
          matchId:         fixture.id,
        });
      }
    } catch { /* non-fatal: ranking failure must not block result processing */ }
  })();

  // Knockout / playoff fixtures: mark processed only, no league-table update
  if (fixture.phase !== "league") {
    await Promise.all([
      stageClient.entities.CompetitionFixture.update(fixture.id, { stats_processed: true }),
      _rankingUpdate,
    ]);
    return;
  }

  const [homeRow] = await stageClient.entities.CompetitionStanding.filter(
    { season_id: fixture.season_id, club_id: fixture.home_club_id }, null, 1
  );
  const [awayRow] = await stageClient.entities.CompetitionStanding.filter(
    { season_id: fixture.season_id, club_id: fixture.away_club_id }, null, 1
  );
  if (!homeRow || !awayRow) return;

  const isDraw = homeScore === awayScore;
  const homeWin = homeScore > awayScore;

  const homeUpdate = {
    played: (homeRow.played || 0) + 1,
    wins: (homeRow.wins || 0) + (homeWin ? 1 : 0),
    draws: (homeRow.draws || 0) + (isDraw ? 1 : 0),
    losses: (homeRow.losses || 0) + (!homeWin && !isDraw ? 1 : 0),
    goals_for: (homeRow.goals_for || 0) + homeScore,
    goals_against: (homeRow.goals_against || 0) + awayScore,
    points: (homeRow.points || 0) + (homeWin ? 3 : isDraw ? 1 : 0),
    form: [homeWin ? "W" : isDraw ? "D" : "L", ...(homeRow.form || [])].slice(0, 5),
  };
  homeUpdate.goal_difference = homeUpdate.goals_for - homeUpdate.goals_against;

  const awayUpdate = {
    played: (awayRow.played || 0) + 1,
    wins: (awayRow.wins || 0) + (!homeWin && !isDraw ? 1 : 0),
    draws: (awayRow.draws || 0) + (isDraw ? 1 : 0),
    losses: (awayRow.losses || 0) + (homeWin ? 1 : 0),
    goals_for: (awayRow.goals_for || 0) + awayScore,
    goals_against: (awayRow.goals_against || 0) + homeScore,
    points: (awayRow.points || 0) + (!homeWin && !isDraw ? 3 : isDraw ? 1 : 0),
    form: [!homeWin && !isDraw ? "W" : isDraw ? "D" : "L", ...(awayRow.form || [])].slice(0, 5),
  };
  awayUpdate.goal_difference = awayUpdate.goals_for - awayUpdate.goals_against;

  await Promise.all([
    stageClient.entities.CompetitionStanding.update(homeRow.id, homeUpdate),
    stageClient.entities.CompetitionStanding.update(awayRow.id, awayUpdate),
    stageClient.entities.CompetitionFixture.update(fixture.id, { stats_processed: true }),
    _rankingUpdate,
  ]);

  // Re-sort all positions in the season
  const allStandings = await stageClient.entities.CompetitionStanding.filter({ season_id: fixture.season_id }, null, 200);
  const sorted = sortStandings(allStandings.map(s =>
    s.id === homeRow.id ? { ...s, ...homeUpdate } : s.id === awayRow.id ? { ...s, ...awayUpdate } : s
  ));
  await Promise.all(
    sorted.map((s, i) => stageClient.entities.CompetitionStanding.update(s.id, { position: i + 1 }))
  );
}

// Process a completed regional league fixture and update RegionalLeagueStanding rows
export async function processRegionalLeagueFixtureResult(fixture) {
  if (fixture.stats_processed) return;

  const homeScore = fixture.home_score ?? 0;
  const awayScore = fixture.away_score ?? 0;

  // Non-fatal ranking update
  const _rankingUpdate = (async () => {
    try {
      const { updateClubRankingAfterMatch } = await import("./rankingEngine");
      const [[homeClub], [awayClub]] = await Promise.all([
        stageClient.entities.Club.filter({ id: fixture.home_club_id }, null, 1).catch(() => []),
        stageClient.entities.Club.filter({ id: fixture.away_club_id }, null, 1).catch(() => []),
      ]);
      if (homeClub && awayClub) {
        await updateClubRankingAfterMatch({
          homeClub, awayClub, homeScore, awayScore,
          competitionType: "regional_league",
          competitionSlug: null,
          division:        fixture.division || 1,
          phase:           "league",
          matchId:         fixture.id,
        });
      }
    } catch { /* non-fatal */ }
  })();

  const [[homeRow], [awayRow]] = await Promise.all([
    (stageClient.entities.RegionalLeagueStanding?.filter(
      { league_id: fixture.league_id, club_id: fixture.home_club_id }, null, 1
    ) ?? Promise.resolve([])).catch(() => []),
    (stageClient.entities.RegionalLeagueStanding?.filter(
      { league_id: fixture.league_id, club_id: fixture.away_club_id }, null, 1
    ) ?? Promise.resolve([])).catch(() => []),
  ]);

  if (!homeRow || !awayRow) { await _rankingUpdate; return; }

  const isDraw  = homeScore === awayScore;
  const homeWin = homeScore > awayScore;

  const homeUpdate = {
    played:        (homeRow.played  || 0) + 1,
    wins:          (homeRow.wins    || 0) + (homeWin  ? 1 : 0),
    draws:         (homeRow.draws   || 0) + (isDraw   ? 1 : 0),
    losses:        (homeRow.losses  || 0) + (!homeWin && !isDraw ? 1 : 0),
    goals_for:     (homeRow.goals_for     || 0) + homeScore,
    goals_against: (homeRow.goals_against || 0) + awayScore,
    points:        (homeRow.points  || 0) + (homeWin ? 3 : isDraw ? 1 : 0),
    form:          [homeWin ? "W" : isDraw ? "D" : "L", ...(homeRow.form || [])].slice(0, 5),
  };
  homeUpdate.goal_difference = homeUpdate.goals_for - homeUpdate.goals_against;

  const awayUpdate = {
    played:        (awayRow.played  || 0) + 1,
    wins:          (awayRow.wins    || 0) + (!homeWin && !isDraw ? 1 : 0),
    draws:         (awayRow.draws   || 0) + (isDraw   ? 1 : 0),
    losses:        (awayRow.losses  || 0) + (homeWin  ? 1 : 0),
    goals_for:     (awayRow.goals_for     || 0) + awayScore,
    goals_against: (awayRow.goals_against || 0) + homeScore,
    points:        (awayRow.points  || 0) + (!homeWin && !isDraw ? 3 : isDraw ? 1 : 0),
    form:          [!homeWin && !isDraw ? "W" : isDraw ? "D" : "L", ...(awayRow.form || [])].slice(0, 5),
  };
  awayUpdate.goal_difference = awayUpdate.goals_for - awayUpdate.goals_against;

  await Promise.all([
    stageClient.entities.RegionalLeagueStanding.update(homeRow.id, homeUpdate),
    stageClient.entities.RegionalLeagueStanding.update(awayRow.id, awayUpdate),
    (stageClient.entities.RegionalLeagueFixture?.update(fixture.id, { stats_processed: true }) ?? Promise.resolve()),
    _rankingUpdate,
  ]);

  // Re-sort positions
  const allRows = await (stageClient.entities.RegionalLeagueStanding?.filter(
    { league_id: fixture.league_id }, null, 100
  ) ?? Promise.resolve([])).catch(() => []);

  const sorted = allRows
    .map(s => s.id === homeRow.id ? { ...s, ...homeUpdate }
             : s.id === awayRow.id ? { ...s, ...awayUpdate } : s)
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdDiff = ((b.goals_for || 0) - (b.goals_against || 0)) - ((a.goals_for || 0) - (a.goals_against || 0));
      if (gdDiff !== 0) return gdDiff;
      if ((b.goals_for || 0) !== (a.goals_for || 0)) return (b.goals_for || 0) - (a.goals_for || 0);
      return (a.club_name || "").localeCompare(b.club_name || "");
    });

  await Promise.all(
    sorted.map((s, i) => stageClient.entities.RegionalLeagueStanding.update(s.id, { position: i + 1 }))
  );
}

// Create standing rows for all clubs in a season (called when season starts)
export async function initializeStandings(season, clubs) {
  await Promise.all(clubs.map((club, i) =>
    stageClient.entities.CompetitionStanding.create({
      season_id: season.id,
      competition_id: season.competition_id,
      competition_name: season.competition_name,
      competition_tier: season.competition_tier,
      competition_slug: season.competition_slug,
      season_number: season.season_number,
      club_id: club.id,
      club_name: club.name,
      club_logo_url: club.logo_url || "",
      club_tag: club.tag || "",
      platform: club.platform || season.platform,
      region: club.region || season.region,
      position: i + 1,
      played: 0, wins: 0, draws: 0, losses: 0,
      goals_for: 0, goals_against: 0, goal_difference: 0,
      points: 0, form: [],
    })
  ));
}

// Generate QualificationEntry rows when a regional league completes
export async function generateQualificationEntries(regionalLeague, standings) {
  const slots = Math.min(regionalLeague.promoted_slots || 2, standings.length);
  const sorted = sortStandings(standings);
  const entries = [];
  for (let i = 0; i < slots; i++) {
    const s = sorted[i];
    entries.push(stageClient.entities.QualificationEntry.create({
      source_type: "regional_league",
      regional_league_id: regionalLeague.id,
      regional_league_name: regionalLeague.name,
      regional_finish_position: i + 1,
      target_competition_id: regionalLeague.target_competition_id,
      target_competition_name: regionalLeague.target_competition_name,
      target_competition_tier: regionalLeague.target_competition_tier || null,
      target_season_id: regionalLeague.target_season_id || null,
      target_season_number: null,
      club_id: s.club_id,
      club_name: s.club_name,
      club_logo_url: s.club_logo_url || "",
      club_tag: s.club_tag || "",
      club_region: s.region || "",
      club_platform: s.platform || "",
      status: "pending",
    }));
  }
  await Promise.all(entries);
}

// Confirm a qualification entry: add club to season + create standing row
export async function confirmQualificationEntry(entry, season, adminEmail) {
  const club = await stageClient.entities.Club.filter({ id: entry.club_id }, null, 1).then(r => r[0]);
  if (!club) throw new Error("Club not found");

  const alreadyIn = (season.registered_club_ids || []).includes(entry.club_id);
  if (!alreadyIn) {
    await stageClient.entities.CompetitionSeason.update(season.id, {
      registered_club_ids: [...(season.registered_club_ids || []), entry.club_id],
      num_clubs: (season.num_clubs || 0) + 1,
    });
    await stageClient.entities.CompetitionStanding.create({
      season_id: season.id,
      competition_id: season.competition_id,
      competition_name: season.competition_name,
      competition_tier: season.competition_tier,
      competition_slug: season.competition_slug,
      season_number: season.season_number,
      club_id: club.id,
      club_name: club.name,
      club_logo_url: club.logo_url || "",
      club_tag: club.tag || "",
      platform: club.platform || season.platform,
      region: club.region || season.region,
      position: (season.num_clubs || 0) + 1,
      played: 0, wins: 0, draws: 0, losses: 0,
      goals_for: 0, goals_against: 0, goal_difference: 0,
      points: 0, form: [],
    });
  }

  await stageClient.entities.QualificationEntry.update(entry.id, {
    status: "confirmed",
    target_season_id: season.id,
    target_season_number: season.season_number,
    confirmed_by: adminEmail,
    confirmed_at: new Date().toISOString(),
  });
}

// ─── Cross-competition season-end qualification ────────────────────────────────

/**
 * Called when a competition season is marked completed.
 * Creates QualificationEntry records for the season winner(s) per
 * CROSS_COMPETITION_QUALIFICATION_RULES (e.g. Elite winner → Supreme).
 * Skips if the club already has a pending/confirmed entry for the target competition.
 */
export async function processCompetitionSeasonEnd(season, standings, competitions) {
  const { CROSS_COMPETITION_QUALIFICATION_RULES } = await import("./qualificationConfig");
  const rule = CROSS_COMPETITION_QUALIFICATION_RULES.find(r => r.fromSlug === season.competition_slug);
  if (!rule) return; // Supreme has no upward path

  const targetComp = competitions.find(c => c.slug === rule.toSlug);
  if (!targetComp) return;

  const sorted = sortStandings(standings);
  const ops = [];

  for (const pos of rule.positions) {
    if (pos > sorted.length) continue;
    const s = sorted[pos - 1];

    // Deduplication: skip if an entry already exists for this club → target competition
    const existing = await stageClient.entities.QualificationEntry.filter(
      { club_id: s.club_id, target_competition_id: targetComp.id, status: "pending" }, null, 1
    ).catch(() => []);
    if (existing.length > 0) continue;

    ops.push(
      stageClient.entities.QualificationEntry.create({
        source_type: "competition_season",
        regional_league_id: null,
        regional_league_name: null,
        regional_finish_position: pos,
        target_competition_id: targetComp.id,
        target_competition_name: targetComp.name,
        target_competition_tier: targetComp.tier,
        target_season_id: null,
        target_season_number: null,
        club_id: s.club_id,
        club_name: s.club_name,
        club_logo_url: s.club_logo_url || "",
        club_tag: s.club_tag || "",
        club_region: s.region || "",
        club_platform: s.platform || "",
        status: "pending",
      })
    );
  }

  await Promise.all(ops);
  return { qualified: ops.length };
}

// ─── Regional league fixture generation (full round-robin, both legs) ─────────

/**
 * Generate home-and-away round-robin fixtures for a regional league.
 * Uses the circle method: n clubs → n-1 rounds per leg → 2*(n-1) matchdays total.
 * Each matchday window opens immediately (window_days = 4 by default).
 */
export async function generateRegionalLeagueFixtures(league, clubs, windowDays = 4) {
  if (!stageClient.entities.RegionalLeagueFixture) {
    throw new Error("RegionalLeagueFixture schema not published yet. Publish it on app.stageClient.com to enable fixture generation.");
  }
  if (clubs.length < 2) throw new Error("Need at least 2 clubs to generate fixtures.");
  const evenClubs = clubs.length % 2 === 0 ? clubs : [...clubs, { id: "__bye__", name: "BYE" }];
  const allRounds = circleMethod(evenClubs);

  const now = new Date();
  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000).toISOString();

  const leagueBase = {
    league_id:     league.id,
    league_name:   league.name,
    region_slug:   league.region_slug || "",
    division:      league.division || 1,
    season_number: league.season_number || 1,
    status:        "unscheduled",
    stats_processed: false,
    home_score: 0, away_score: 0,
    scheduling_status: "open",
    window_start: now.toISOString(),
    window_end:   windowEnd,
    window_days:  windowDays,
    proposal_count: 0,
  };

  // First leg (matchdays 1…n-1) + second leg mirror (matchdays n…2(n-1))
  const matchdays = [
    ...allRounds,
    ...allRounds.map(day => day.map(({ home, away }) => ({ home: away, away: home }))),
  ];

  const ops = matchdays.flatMap((day, mdIdx) =>
    day
      .filter(({ home, away }) => home.id !== "__bye__" && away.id !== "__bye__")
      .map(({ home, away }) =>
        stageClient.entities.RegionalLeagueFixture.create({
          ...leagueBase,
          home_club_id:       home.id,
          home_club_name:     home.name,
          home_club_logo_url: home.logo_url || "",
          home_club_tag:      home.tag || "",
          away_club_id:       away.id,
          away_club_name:     away.name,
          away_club_logo_url: away.logo_url || "",
          away_club_tag:      away.tag || "",
          matchday: mdIdx + 1,
        })
      )
  );

  await Promise.all(ops);
  await stageClient.entities.RegionalLeague.update(league.id, {
    status: "in_progress",
    num_clubs: clubs.length,
  });
}
