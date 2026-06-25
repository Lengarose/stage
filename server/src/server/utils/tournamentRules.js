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
  double_elimination: {
    defaultMaxTeams: 8,
    allowedMaxTeams: [8, 16, 32],
  },
  swiss_ucl: {
    defaultMaxTeams: 36,
    allowedMaxTeams: [36],
  },
};

function getTournamentFormatRule(format) {
  return TOURNAMENT_FORMAT_RULES[format] || TOURNAMENT_FORMAT_RULES.knockout;
}

function normalizeTournamentMaxTeams(format, maxTeams) {
  const rule = getTournamentFormatRule(format);
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

function normalizeTournamentEconomics(body = {}) {
  const type = body.type || 'knockout';
  const maxTeams = normalizeTournamentMaxTeams(type, body.max_teams);
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
  normalizeTournamentMaxTeams,
  calculateTournamentPrizeBreakdown,
  normalizeTournamentEconomics,
};
