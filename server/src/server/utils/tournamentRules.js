const TOURNAMENT_CREDIT_COST = 50;

const TOURNAMENT_PRIZE_SPLIT = {
  winner: 0.7,
  runnerUp: 0.2,
  thirdPlace: 0.1,
};

const TOURNAMENT_FORMAT_RULES = {
  knockout: {
    defaultMaxTeams: 8,
    allowedMaxTeams: [8, 16, 32, 64],
  },
  league: {
    defaultMaxTeams: 20,
    allowedMaxTeams: [4, 8, 10, 12, 16, 18, 20],
  },
  group_stage: {
    defaultMaxTeams: 16,
    allowedMaxTeams: [8, 16, 24, 32],
  },
  swiss_ucl: {
    defaultMaxTeams: 36,
    allowedMaxTeams: [36],
  },
};

const DISABLED_TOURNAMENT_FORMATS = new Set(['double_elimination']);

function createDisabledFormatError(format) {
  const error = new Error(`${format} is no longer available for new tournaments.`);
  error.statusCode = 400;
  return error;
}

function normalizeTournamentFormat(format, options = {}) {
  const type = String(format || 'knockout').toLowerCase();
  if (DISABLED_TOURNAMENT_FORMATS.has(type)) {
    if (options.allowDisabled) return type;
    throw createDisabledFormatError('Double Elimination');
  }
  return TOURNAMENT_FORMAT_RULES[type] ? type : 'knockout';
}

function getTournamentFormatRule(format) {
  return TOURNAMENT_FORMAT_RULES[format] || TOURNAMENT_FORMAT_RULES.knockout;
}

function normalizeTournamentMaxTeams(format, maxTeams, options = {}) {
  const type = normalizeTournamentFormat(format, options);
  const rule = getTournamentFormatRule(type);
  const requested = Number(maxTeams);
  if (rule.allowedMaxTeams.includes(requested)) return requested;
  const lowerOrEqual = rule.allowedMaxTeams.filter(n => n <= requested).pop();
  return lowerOrEqual || rule.defaultMaxTeams;
}

function calculateTournamentPrizeBreakdown(entryFeeStc, maxTeams) {
  const entryFee = Math.max(0, Number(entryFeeStc) || 0);
  const teams = Math.max(0, Number(maxTeams) || 0);
  const pool = entryFee * teams;
  const winner = Math.floor(pool * TOURNAMENT_PRIZE_SPLIT.winner);
  const runnerUp = Math.floor(pool * TOURNAMENT_PRIZE_SPLIT.runnerUp);
  return {
    entryFee,
    pool,
    winner,
    runnerUp,
    thirdPlace: Math.max(0, pool - winner - runnerUp),
    participation: 0,
  };
}

function normalizeTournamentEconomics(body = {}, options = {}) {
  const allowDisabled = Boolean(options.allowDisabled);
  const type = normalizeTournamentFormat(body.type || 'knockout', { allowDisabled });
  const maxTeams = normalizeTournamentMaxTeams(type, body.max_teams, { allowDisabled });
  const entryFee = Math.max(0, Number(body.entry_fee_stc) || 0);
  const prizes = calculateTournamentPrizeBreakdown(entryFee, maxTeams);

  return {
    ...body,
    type,
    max_teams: maxTeams,
    entry_credits: TOURNAMENT_CREDIT_COST,
    entry_fee_stc: prizes.entryFee,
    prize_description: '',
    prize_pool_stc: prizes.pool,
    prize_winner_stc: prizes.winner,
    prize_runner_up_stc: prizes.runnerUp,
    prize_semi_final_stc: prizes.thirdPlace,
    prize_participation_stc: 0,
  };
}

module.exports = {
  TOURNAMENT_CREDIT_COST,
  TOURNAMENT_PRIZE_SPLIT,
  TOURNAMENT_FORMAT_RULES,
  normalizeTournamentFormat,
  normalizeTournamentMaxTeams,
  calculateTournamentPrizeBreakdown,
  normalizeTournamentEconomics,
};
