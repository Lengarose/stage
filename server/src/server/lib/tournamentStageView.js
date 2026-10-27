'use strict';

const { isConfirmedResult } = require('./tournamentStatistics');
const { standings } = require('./tournamentProgression');

const LABELS = {
  group: 'Group Stage',
  league: 'League Phase',
  playoff: 'Knockout Playoff Round',
  r16: 'Round of 16',
  qf: 'Quarterfinals',
  sf: 'Semifinals',
  final: 'Final',
  third: 'Third-Place Playoff',
};
const TYPE_ALIASES = {
  group_stage: 'group',
  ucl_league: 'league',
  ucl_playoff: 'playoff',
  ucl_r16: 'r16',
  round_of_16: 'r16',
  ucl_qf: 'qf',
  quarter_final: 'qf',
  ucl_sf: 'sf',
  semi_final: 'sf',
  third_place: 'third',
  'third-place': 'third',
  bronze: 'third',
};
const SCHEDULABLE = new Set(['unscheduled', 'scheduled', 'in_progress', 'awaiting_confirmation']);
const VOID_STATUSES = new Set(['cancelled', 'canceled', 'void', 'voided', 'abandoned']);
const FIXTURE_STATUSES = new Set(['unscheduled', 'scheduled', 'in_progress']);
const CLASSIFICATIONS = new Set(['fixtures', 'results', 'all', 'unresolved']);
const REASONS = {
  draw_not_made: 'Draw not made yet.',
  awaiting_qualification: 'Awaiting qualification from the previous stage.',
  draw_preview: 'Draw preview — tournament has not started yet.',
};

function parseList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function stageLabel(key) {
  if (LABELS[key]) return LABELS[key];
  if (String(key).startsWith('last-')) return `Round of ${key.slice(5)}`;
  if (String(key).startsWith('swiss-')) return `Round ${key.slice(6)}`;
  if (String(key).startsWith('round-')) return `Round ${key.slice(6)}`;
  return String(key).replace(/_/g, ' ');
}

function knockoutKey(size) {
  if (size <= 2) return 'final';
  if (size <= 4) return 'sf';
  if (size <= 8) return 'qf';
  if (size <= 16) return 'r16';
  return `last-${size}`;
}

function participantCount(tournament, matches) {
  const registered = tournament.participant_type === 'player'
    ? parseList(tournament.registered_players)
    : parseList(tournament.registered_clubs);
  const fromDraw = matches.length ? registered.length : 0;
  return Math.max(2, fromDraw || Number(tournament.max_teams) || 2);
}

function knockoutEnabled(tournament) {
  return Number(tournament.knockout_enabled ?? 1) !== 0;
}

function twoLegged(tournament, key) {
  if (['final', 'third', 'group', 'league'].includes(key) || String(key).startsWith('swiss-') || String(key).startsWith('round-')) return false;
  if (!['playoff', 'r16', 'qf', 'sf', 'last-32'].includes(key) && !String(key).startsWith('last-')) return false;
  if (tournament.type === 'swiss_ucl') return key !== 'final';
  if (tournament.type === 'group_stage') return Number(tournament.knockout_legs ?? 2) !== 1;
  return Number(tournament.knockout_legs ?? 1) === 2;
}

function stageTypeFor(tournament, key) {
  if (key === 'group') return 'group';
  if (key === 'league') return tournament.type === 'swiss_ucl' ? 'ucl_league' : 'league';
  if (key === 'playoff') return 'playoff';
  if (key === 'third') return 'third_place';
  if (key === 'final') return 'final';
  if (String(key).startsWith('swiss-')) return 'swiss';
  return 'knockout';
}

function classifyMatch(match) {
  const status = String(match?.status || '').toLowerCase();
  if (status === 'bye') return 'result';
  if (status === 'disputed') return 'disputed';
  if (status === 'postponed') return 'postponed';
  if (VOID_STATUSES.has(status)) return 'void';
  if (isConfirmedResult(match)) return 'result';
  if (status === 'awaiting_confirmation' || status === 'completed' || status === 'pending') return 'unconfirmed';
  if (FIXTURE_STATUSES.has(status)) return 'fixture';
  return 'unresolved';
}

function matchesFilter(classification) {
  if (classification === 'fixtures') return (row) => row.classification === 'fixture';
  if (classification === 'results') return (row) => row.classification === 'result';
  if (classification === 'unresolved') return (row) => !['fixture', 'result'].includes(row.classification);
  return () => true;
}

function emptyStageStatus(tournament, index) {
  if (index === 0) return { status: 'draw_not_made', reason: { code: 'draw_not_made', message: REASONS.draw_not_made } };
  if (tournament.participant_type !== 'player') {
    return {
      status: 'awaiting_qualification',
      reason: { code: 'awaiting_round_completion', message: 'Awaiting completion of the previous round before the draw.' },
    };
  }
  return { status: 'awaiting_qualification', reason: { code: 'awaiting_qualification', message: REASONS.awaiting_qualification } };
}

function stageStatus(tournament, index, rows) {
  if (!rows.length) return emptyStageStatus(tournament, index);
  const classes = rows.map(classifyMatch);
  const results = classes.filter((item) => item === 'result').length;
  if (results === rows.length) return { status: 'completed', reason: null };
  if (results > 0) return { status: 'in_progress', reason: null };
  const started = ['in_progress', 'completed'].includes(String(tournament.status || '').toLowerCase());
  if (!started) return { status: 'draw_preview', reason: { code: 'draw_preview', message: REASONS.draw_preview } };
  return { status: 'fixtures_available', reason: null };
}

function buildStageCatalogue(tournament, matches = []) {
  const type = String(tournament.type || '');
  const count = participantCount(tournament, matches);
  const stages = [];
  const add = (key, label = stageLabel(key)) => {
    if (!stages.some((stage) => stage.key === key)) {
      stages.push({
        key,
        id: key,
        label,
        stage_type: stageTypeFor(tournament, key),
        two_legged: twoLegged(tournament, key),
        legs: twoLegged(tournament, key) ? 2 : 1,
        matches: [],
      });
    }
  };

  if (type === 'league') add('league');
  else if (type === 'swiss') {
    const rounds = Number(tournament.total_rounds || Math.ceil(Math.log2(count)));
    for (let round = 1; round <= rounds; round += 1) add(`swiss-${round}`, `Round ${round}`);
  } else {
    if (type === 'group_stage') add('group');
    if (type === 'swiss_ucl') ['league', 'playoff', 'r16', 'qf', 'sf', 'final'].forEach((key) => add(key));
    else if (!(type === 'group_stage' && !knockoutEnabled(tournament))) {
      const qualifiers = type === 'group_stage' ? Math.min(count, Number(tournament.num_groups || 2) * 2) : count;
      for (let size = 2 ** Math.ceil(Math.log2(qualifiers)); size >= 2; size /= 2) add(knockoutKey(size));
    }
  }

  const genericRounds = [...new Set(matches
    .filter((match) => ['knockout', 'double_elimination', ''].includes(String(match.type || '')))
    .map((match) => Number(match.round || 1)))].sort((a, b) => a - b);
  const eliminationStages = stages.filter((stage) => !['group', 'league'].includes(stage.key));
  const thirdEligible = ['knockout', 'group_stage'].includes(type) && knockoutEnabled(tournament);
  if (thirdEligible && count >= 4 && stages.some((stage) => stage.key === 'sf')) add('third');

  for (const match of [...matches].sort((a, b) => Number(a.round || 1) - Number(b.round || 1) || String(a.id).localeCompare(String(b.id)))) {
    const matchType = String(match.type || '').toLowerCase();
    let key = TYPE_ALIASES[matchType] || matchType;
    if (key === 'third' && !thirdEligible) continue;
    if (type === 'league' && (!matchType || matchType === 'league')) key = 'league';
    if (matchType === 'swiss') key = `swiss-${match.round || 1}`;
    if (['knockout', 'double_elimination', ''].includes(matchType) && type !== 'league') {
      const index = genericRounds.indexOf(Number(match.round || 1));
      key = eliminationStages[index]?.key || `round-${match.round || 1}`;
    }
    if (!key) key = `round-${match.round || 1}`;
    add(key, String(key).startsWith('round-') ? `Round ${match.round || 1}` : stageLabel(key));
    stages.find((stage) => stage.key === key).matches.push(match);
  }

  const third = stages.findIndex((stage) => stage.key === 'third');
  if (third >= 0) {
    const [stage] = stages.splice(third, 1);
    const finalIndex = stages.findIndex((item) => item.key === 'final');
    stages.splice(finalIndex < 0 ? stages.length : finalIndex, 0, stage);
  }

  return stages.map((stage, index) => {
    const status = stageStatus(tournament, index, stage.matches);
    const rounds = [...new Set(stage.matches.map((match) => Number(match.round || 1)))].sort((a, b) => a - b);
    const groups = type === 'group_stage' && stage.key === 'group'
      ? Array.from({ length: Math.max(1, Number(tournament.num_groups || 1)) }, (_, group) => ({
        group_number: group,
        label: `Group ${String.fromCharCode(65 + group)}`,
      }))
      : [...new Set(stage.matches.map((match) => match.group_number ?? match.group).filter((group) => group != null))]
        .sort((a, b) => Number(a) - Number(b))
        .map((group) => ({ group_number: Number(group), label: `Group ${String.fromCharCode(65 + Number(group))}` }));
    const classes = stage.matches.map(classifyMatch);
    return {
      key: stage.key,
      id: stage.key,
      label: stage.label,
      order: index,
      stage_type: stage.stage_type,
      status: status.status,
      reason: status.reason,
      legs: stage.legs,
      two_legged: stage.two_legged,
      previous_stage_key: stages[index - 1]?.key || null,
      next_stage_key: stages[index + 1]?.key || null,
      groups,
      matchdays: ['group', 'league'].includes(stage.key) || stage.stage_type === 'ucl_league' ? rounds : [],
      fixture_state: stage.matches.length
        ? (status.status === 'draw_preview' ? 'preview' : 'active')
        : 'none',
      match_count: stage.matches.length,
      fixture_count: classes.filter((item) => item === 'fixture').length,
      result_count: classes.filter((item) => item === 'result').length,
      unresolved_count: classes.filter((item) => !['fixture', 'result'].includes(item)).length,
      matches: stage.matches,
      round_numbers: rounds,
    };
  });
}

function legNumber(stage, match) {
  if (!stage.two_legged) return null;
  if (match.leg != null && match.leg !== '') return Number(match.leg);
  if (match.leg_number != null && match.leg_number !== '') return Number(match.leg_number);
  const index = stage.round_numbers.indexOf(Number(match.round || 1));
  return index >= 0 ? index + 1 : 1;
}

function legLabel(leg) {
  if (leg === 1) return 'First leg';
  if (leg === 2) return 'Second leg';
  return `Decider ${leg}`;
}

function sideId(match, side, player) {
  return match[`${side}_${player ? 'player' : 'club'}_id`] || null;
}

function tieId(stage, match, player) {
  if (!stage.two_legged) return String(match.id);
  if (match.group_number != null || match.group != null) return `tie:${match.group_number ?? match.group}`;
  const home = sideId(match, 'home', player);
  const away = sideId(match, 'away', player);
  return `tie:${[home, away].filter(Boolean).map(String).sort().join(':') || match.id}`;
}

function participantView(match, side, player, profiles) {
  const id = sideId(match, side, player);
  const storedName = match[`${side}_${player ? 'player' : 'club'}_name`] || null;
  if (!id) return { id: null, type: player ? 'player' : 'club', name: storedName, badge: null, placeholder: true };
  const profile = profiles.get(String(id));
  return {
    id: String(id),
    type: player ? 'player' : 'club',
    name: profile?.name || storedName,
    badge: profile?.badge || null,
    placeholder: false,
  };
}

function aggregateFor(stage, match, presented, player) {
  if (!stage.two_legged) return null;
  const home = sideId(match, 'home', player);
  const away = sideId(match, 'away', player);
  if (!home || !away) return null;
  const legs = presented
    .filter((row) => row.tie_id === tieId(stage, match, player))
    .sort((a, b) => Number(a.leg || 0) - Number(b.leg || 0))
    .slice(0, 2);
  if (legs.length < 2 || legs.some((row) => row.classification !== 'result' || row.score == null)) return null;
  return legs.reduce((total, row) => {
    const sameHome = String(row.home.id) === String(home);
    return {
      home: total.home + Number(sameHome ? row.score.home : row.score.away),
      away: total.away + Number(sameHome ? row.score.away : row.score.home),
    };
  }, { home: 0, away: 0 });
}

function presentMatch(stage, match, tournament, profiles, viewer, homeClubs) {
  const player = tournament.participant_type === 'player';
  const classification = classifyMatch(match);
  const leg = legNumber(stage, match);
  const home = participantView(match, 'home', player, profiles);
  const away = participantView(match, 'away', player, profiles);
  const confirmed = classification === 'result' && match.home_score != null && match.away_score != null && String(match.status).toLowerCase() !== 'bye';
  const groupNumber = match.group_number ?? match.group ?? null;
  const section = sectionFor(stage, match, leg, groupNumber);
  const row = {
    id: match.id,
    tournament_id: tournament.id,
    stage_key: stage.key,
    group_number: groupNumber == null ? null : Number(groupNumber),
    group_label: groupNumber == null ? null : `Group ${String.fromCharCode(65 + Number(groupNumber))}`,
    matchday: ['group', 'league'].includes(stage.key) || stage.stage_type === 'ucl_league' ? Number(match.round || 1) : null,
    round: Number(match.round || 1),
    tie_id: tieId(stage, match, player),
    leg,
    leg_label: leg == null ? null : legLabel(leg),
    section_key: section.key,
    section_label: section.label,
    type: match.type || null,
    status: match.status || null,
    result_state: match.result_state || null,
    stats_processed: match.stats_processed || 0,
    classification,
    fixture_state: stage.fixture_state === 'preview' && classification !== 'result' ? 'preview' : 'active',
    preview: stage.fixture_state === 'preview' && classification !== 'result',
    home,
    away,
    score: confirmed ? { home: Number(match.home_score), away: Number(match.away_score) } : null,
    aggregate: match.aggregate_home_score == null ? null : { home: Number(match.aggregate_home_score), away: Number(match.aggregate_away_score) },
    penalties: Number(match.decided_on_penalties) === 1 ? { winner_side: match.penalty_winner_side || null } : null,
    forfeit: String(match.status || '').toLowerCase() === 'forfeit',
    bye: String(match.status || '').toLowerCase() === 'bye',
    extra_time: match.extra_time == null ? null : match.extra_time,
    scheduling_status: match.scheduling_status || null,
    links: {
      match_id: match.id,
      game_day_path: `/game-day?match=${encodeURIComponent(String(match.id))}`,
      schedule_match_path: `/api/stage/matches/${encodeURIComponent(String(match.id))}`,
    },
  };
  if (viewer) {
    row.can_schedule = participantCanScheduleMatch({
      match,
      auth: viewer,
      homeClub: homeClubs.get(String(match.home_club_id || '')) || null,
    });
  }
  return row;
}

function sectionFor(stage, match, leg, groupNumber) {
  if (['group', 'league'].includes(stage.key) || stage.stage_type === 'ucl_league') {
    const group = stage.key === 'group' && groupNumber != null ? `Group ${String.fromCharCode(65 + Number(groupNumber))} · ` : '';
    return { key: `md-${groupNumber ?? 'x'}-${match.round || 1}`, label: `${group}Matchday ${match.round || 1}` };
  }
  if (leg != null) return { key: `leg-${leg}`, label: legLabel(leg) };
  return { key: 'matches', label: 'Matches' };
}

function presentStageMatches(stage, tournament, profiles, viewer, homeClubs) {
  const player = tournament.participant_type === 'player';
  const drafts = stage.matches.map((match) => presentMatch(stage, match, tournament, profiles, viewer, homeClubs));
  const withAggregate = drafts.map((row, index) => ({
    ...row,
    aggregate: aggregateFor(stage, stage.matches[index], drafts, player),
  }));
  return withAggregate.sort((a, b) => a.round - b.round
    || Number(a.leg || 0) - Number(b.leg || 0)
    || Number(a.group_number || 0) - Number(b.group_number || 0)
    || String(a.id).localeCompare(String(b.id)));
}

function formFromConfirmed(matches, player) {
  const table = new Map();
  for (const match of matches) {
    if (!isConfirmedResult(match) || match.home_score == null || match.away_score == null) continue;
    for (const side of ['home', 'away']) {
      const id = sideId(match, side, player);
      if (!id) continue;
      if (!table.has(String(id))) table.set(String(id), { played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0 });
      const row = table.get(String(id));
      const own = Number(match[`${side}_score`]);
      const opp = Number(match[`${side === 'home' ? 'away' : 'home'}_score`]);
      row.played += 1;
      row.goals_for += own;
      row.goals_against += opp;
      if (own > opp) row.wins += 1;
      else if (own === opp) row.draws += 1;
      else row.losses += 1;
    }
  }
  return table;
}

function membersFromMatches(matches, player) {
  const members = new Map();
  for (const match of matches) {
    for (const side of ['home', 'away']) {
      const id = sideId(match, side, player);
      if (!id || members.has(String(id))) continue;
      members.set(String(id), { id: String(id), name: match[`${side}_${player ? 'player' : 'club'}_name`] || '' });
    }
  }
  return members;
}

function qualificationFor(tournament, stage, rank, total) {
  if (stage.status !== 'completed') return null;
  if (stage.key === 'group' && knockoutEnabled(tournament)) return rank <= 2 ? 'knockout' : 'eliminated';
  if (stage.stage_type === 'ucl_league' && total >= 24) {
    if (rank <= 8) return 'round_of_16';
    if (rank <= 24) return 'playoff';
    return 'eliminated';
  }
  if (tournament.type === 'league' && rank === 1) return 'champion';
  return null;
}

function decorateStandings(engineRows, matches, player, profiles, tournament, stage) {
  const form = formFromConfirmed(matches, player);
  const members = membersFromMatches(matches, player);
  const seen = new Set();
  const rows = engineRows.map((row, index) => {
    seen.add(String(row.id));
    const record = form.get(String(row.id)) || { played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0 };
    const profile = profiles.get(String(row.id));
    return {
      rank: index + 1,
      id: String(row.id),
      name: profile?.name || row.name || members.get(String(row.id))?.name || null,
      badge: profile?.badge || null,
      ...record,
      goal_difference: record.goals_for - record.goals_against,
      points: row.points,
      qualification: qualificationFor(tournament, stage, index + 1, engineRows.length),
    };
  });
  const rest = [...members.values()]
    .filter((member) => !seen.has(member.id))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)) || a.id.localeCompare(b.id));
  for (const member of rest) {
    const profile = profiles.get(member.id);
    rows.push({
      rank: null,
      id: member.id,
      name: profile?.name || member.name || null,
      badge: profile?.badge || null,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
      qualification: null,
    });
  }
  return rows;
}

function stageStandings(tournament, stage, profiles) {
  if (!['group', 'league'].includes(stage.key) && stage.stage_type !== 'ucl_league') return null;
  const player = tournament.participant_type === 'player';
  const confirmed = stage.matches.filter(isConfirmedResult);
  if (stage.key === 'group') {
    const count = Math.max(1, Number(tournament.num_groups || 1));
    return {
      source: 'tournament_progression.standings',
      groups: Array.from({ length: count }, (_, group) => {
        const rows = stage.matches.filter((match) => Number(match.group_number ?? match.group ?? 0) === group);
        return {
          group_number: group,
          label: `Group ${String.fromCharCode(65 + group)}`,
          rows: decorateStandings(standings(rows.filter(isConfirmedResult), player), rows, player, profiles, tournament, stage),
        };
      }),
    };
  }
  return {
    source: 'tournament_progression.standings',
    groups: [{
      group_number: null,
      label: stage.label,
      rows: decorateStandings(standings(confirmed, player), stage.matches, player, profiles, tournament, stage),
    }],
  };
}

function publicStage(stage) {
  const { matches, round_numbers, ...rest } = stage;
  return rest;
}

function parseStagePage(query = {}) {
  const limit = query.limit === undefined ? 20 : Number(query.limit);
  const offset = query.offset === undefined ? 0 : Number(query.offset);
  const classification = query.classification === undefined ? 'all' : String(query.classification);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    const error = new Error('limit must be an integer from 1 to 100');
    error.status = 400;
    throw error;
  }
  if (!Number.isInteger(offset) || offset < 0) {
    const error = new Error('offset must be an integer of 0 or more');
    error.status = 400;
    throw error;
  }
  if (!CLASSIFICATIONS.has(classification)) {
    const error = new Error('classification must be fixtures, results, all, or unresolved');
    error.status = 400;
    throw error;
  }
  return { limit, offset, classification };
}

function pageStageMatches(rows, page) {
  const filtered = rows.filter(matchesFilter(page.classification));
  const slice = filtered.slice(page.offset, page.offset + page.limit);
  return {
    classification: page.classification,
    order: ['round', 'leg', 'group_number', 'id'],
    total: filtered.length,
    limit: page.limit,
    offset: page.offset,
    has_more: page.offset + slice.length < filtered.length,
    matches: slice,
  };
}

function participantCanScheduleMatch({ match, auth, homeClub }) {
  if (!auth?.userId) return false;
  const status = String(match?.status || '').toLowerCase();
  if (!SCHEDULABLE.has(status)) return false;
  if (String(match?.scheduling_status || '').toLowerCase() === 'home_proposed') return false;
  if (match?.home_player_id) {
    if (!match.away_player_id) return false;
    return String(match.home_player_id) === String(auth.playerId || '');
  }
  if (!match?.home_club_id || !match?.away_club_id || !homeClub) return false;
  const userId = String(auth.userId);
  const email = String(auth.email || '').toLowerCase();
  return [homeClub.president_user_id, homeClub.user_id].filter(Boolean).map(String).includes(userId)
    || Boolean(email && String(homeClub.owner_email || '').toLowerCase() === email);
}

module.exports = {
  buildStageCatalogue,
  classifyMatch,
  presentStageMatches,
  publicStage,
  stageStandings,
  parseStagePage,
  pageStageMatches,
  participantCanScheduleMatch,
};
