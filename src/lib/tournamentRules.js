export const TOURNAMENT_CREDIT_COST = 50;

export const TOURNAMENT_PRIZE_SPLIT = {
  winner: 0.7,
  runnerUp: 0.2,
  thirdPlace: 0.1,
};

export const TOURNAMENT_FORMAT_RULES = {
  knockout: {
    label: "Knockout",
    defaultMaxTeams: 8,
    allowedMaxTeams: [8, 16, 32, 64],
    minTeams: 8,
    hint: "Single bracket. Starts at 8 teams minimum.",
  },
  league: {
    label: "League",
    defaultMaxTeams: 20,
    allowedMaxTeams: [4, 8, 10, 12, 16, 18, 20],
    minTeams: 4,
    hint: "Round-robin table. Defaults to 20 teams.",
  },
  group_stage: {
    label: "Group Stage",
    defaultMaxTeams: 16,
    allowedMaxTeams: [8, 16, 24, 32],
    minTeams: 8,
    hint: "Groups first, then knockout bracket.",
  },
  double_elimination: {
    label: "Double Elim.",
    defaultMaxTeams: 8,
    allowedMaxTeams: [8, 16, 32],
    minTeams: 8,
    hint: "Bracket format. Starts at 8 teams minimum.",
  },
  swiss_ucl: {
    label: "Swiss UCL",
    defaultMaxTeams: 36,
    allowedMaxTeams: [36],
    minTeams: 36,
    hint: "UCL-style league phase linked to 36 teams.",
  },
};

export function getTournamentFormatRule(format) {
  return TOURNAMENT_FORMAT_RULES[format] || TOURNAMENT_FORMAT_RULES.knockout;
}

export function getDefaultTournamentMaxTeams(format) {
  return getTournamentFormatRule(format).defaultMaxTeams;
}

export function getTournamentMaxTeamOptions(format) {
  return getTournamentFormatRule(format).allowedMaxTeams;
}

export function normalizeTournamentMaxTeams(format, maxTeams) {
  const rule = getTournamentFormatRule(format);
  const requested = Number(maxTeams);
  if (rule.allowedMaxTeams.includes(requested)) return requested;
  const lowerOrEqual = rule.allowedMaxTeams.filter(n => n <= requested).pop();
  return lowerOrEqual || rule.defaultMaxTeams;
}

export function calculateTournamentPrizeBreakdown(entryFeeStc, maxTeams) {
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

export function applyTournamentFormat(form, format) {
  return {
    ...form,
    type: format,
    max_teams: String(getDefaultTournamentMaxTeams(format)),
  };
}
