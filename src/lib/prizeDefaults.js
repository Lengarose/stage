import regionalTemplate from '../../server/src/server/lib/regionalRewardTemplate.json' with { type: 'json' };
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
  const division = Number(source.division) === 2 ? 2 : 1;
  return {...regionalTemplate, ...regionalTemplate.divisions[division], division};
}

export function getPrizePreset(sourceType, source = {}) {
  return sourceType === "regional_league"
    ? getRegionalPrizePreset(source)
    : getCompetitionPrizePreset(source);
}

export function getDefaultRewardRowsForSource(sourceType, source = {}, maxPositions = sourceType === 'regional_league' ? 20 : 36) {
  if (sourceType === 'regional_league') {
    const preset = getRegionalPrizePreset(source);
    const count = Number(maxPositions);
    if (!Number.isInteger(count) || count < 1 || count > regionalTemplate.max_clubs) throw new Error('Regional rewards support 1-20 finishing positions.');
    return Array.from({length:count}, (_,i) => ({ position:i+1, position_label:defaultLeaguePosition(i+1), badge_type:i === 0 ? 'winner' : 'participant', stc_amount:preset.first_stc-i*preset.step_stc, is_default:true }));
  }
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

export function defaultLeaguePosition(position) {
  const suffix = position % 100 >= 11 && position % 100 <= 13 ? 'th' : ({1:'st',2:'nd',3:'rd'}[position % 10] || 'th');
  return `${position}${suffix} Place`;
}

export function calculatePrizePool(sourceType, source = {}, maxPositions = sourceType === 'regional_league' ? 20 : 36) {
  return getDefaultRewardRowsForSource(sourceType, source, maxPositions)
    .reduce((sum, row) => sum + Number(row.stc_amount || 0), 0);
}

export function formatStcCompact(value) {
  const amount = Number(value || 0);
  if (amount >= 1000000) return `${Number((amount / 1000000).toFixed(1)).toLocaleString()}M STC`;
  if (amount >= 1000) return `${Number((amount / 1000).toFixed(1)).toLocaleString()}K STC`;
  return `${amount.toLocaleString()} STC`;
}
