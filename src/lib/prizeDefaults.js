const COMPETITION_PRIZES = {
  supreme: {
    winner: 25000000,
    runner_up: 10000000,
    semi_finalist: 5000000,
    quarter_finalist: 2000000,
    participant: 500000,
  },
  elite: {
    winner: 12000000,
    runner_up: 5000000,
    semi_finalist: 2000000,
    quarter_finalist: 1000000,
    participant: 250000,
  },
  challenger: {
    winner: 6000000,
    runner_up: 2500000,
    semi_finalist: 1000000,
    quarter_finalist: 500000,
    participant: 100000,
  },
};

const REGIONAL_PRIZES = {
  division_1: {
    winner: 4000000,
    runner_up: 1500000,
    semi_finalist: 750000,
    quarter_finalist: 300000,
    participant: 75000,
  },
  division_2: {
    winner: 2000000,
    runner_up: 750000,
    semi_finalist: 300000,
    quarter_finalist: 150000,
    participant: 50000,
  },
};

export function prizeTierForPosition(position) {
  const pos = Number(position);
  if (pos === 1) return "winner";
  if (pos === 2) return "runner_up";
  if (pos <= 4) return "semi_finalist";
  if (pos <= 8) return "quarter_finalist";
  return "participant";
}

export function prizeLabelForTier(tier) {
  return {
    winner: "Winner",
    runner_up: "Runner-up",
    semi_finalist: "Semi-finalist",
    quarter_finalist: "Quarter-finalist",
    participant: "Participation",
  }[tier] || "Participation";
}

export function badgeForPrizeTier(tier) {
  return {
    winner: "winner",
    runner_up: "finalist",
    semi_finalist: "semi_finalist",
    quarter_finalist: "top_4",
    participant: "participant",
  }[tier] || "participant";
}

export function getCompetitionPrizePreset(source = {}) {
  const slug = String(source.slug || source.competition_slug || "").toLowerCase();
  if (COMPETITION_PRIZES[slug]) return COMPETITION_PRIZES[slug];

  const name = String(source.name || source.sourceName || source.competition_name || "").toLowerCase();
  if (name.includes("supreme")) return COMPETITION_PRIZES.supreme;
  if (name.includes("elite")) return COMPETITION_PRIZES.elite;
  if (name.includes("challenger")) return COMPETITION_PRIZES.challenger;

  const tier = Number(source.tier || source.competition_tier || 0);
  if (tier === 1) return COMPETITION_PRIZES.supreme;
  if (tier === 2) return COMPETITION_PRIZES.elite;
  return COMPETITION_PRIZES.challenger;
}

export function getRegionalPrizePreset(source = {}) {
  return Number(source.division || 1) === 1 ? REGIONAL_PRIZES.division_1 : REGIONAL_PRIZES.division_2;
}

export function getPrizePreset(sourceType, source = {}) {
  return sourceType === "regional_league"
    ? getRegionalPrizePreset(source)
    : getCompetitionPrizePreset(source);
}

export function getDefaultRewardRowsForSource(sourceType, source = {}, maxPositions = 36) {
  const preset = getPrizePreset(sourceType, source);
  const count = Math.max(1, Number(maxPositions) || 1);
  return Array.from({ length: count }, (_, index) => {
    const position = index + 1;
    const tier = prizeTierForPosition(position);
    return {
      position,
      position_label: prizeLabelForTier(tier),
      badge_type: badgeForPrizeTier(tier),
      stc_amount: preset[tier] || 0,
      is_default: true,
    };
  });
}

export function calculatePrizePool(sourceType, source = {}, maxPositions = 36) {
  return getDefaultRewardRowsForSource(sourceType, source, maxPositions)
    .reduce((sum, row) => sum + Number(row.stc_amount || 0), 0);
}

export function formatStcCompact(value) {
  const amount = Number(value || 0);
  if (amount >= 1000000) return `${Number((amount / 1000000).toFixed(1)).toLocaleString()}M STC`;
  if (amount >= 1000) return `${Number((amount / 1000).toFixed(1)).toLocaleString()}K STC`;
  return `${amount.toLocaleString()} STC`;
}
