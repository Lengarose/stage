// The frontend can be updated before the connected server. Keep known balances
// usable without treating missing financial details as zero or "no contract".
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const numeric = value => value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value));
const rows = value => Array.isArray(value) && value.every(object);

export function readWalletBalance(value) {
  if (!object(value) || !numeric(value.balance)) throw new Error('Invalid wallet balance response');
  const available = {
    credits: numeric(value.credits),
    agreements: rows(value.agreements),
    payroll: rows(value.payroll),
    summary: rows(value.summary),
    stakes: numeric(value.locked_stc) && numeric(value.locked_match_count),
    lifestyle: object(value.passive_income) && ['asset_count','due_assets','collectable_stc'].every(key => numeric(value.passive_income[key])),
  };
  return {
    ...value,
    balance: Number(value.balance),
    credits: available.credits ? Number(value.credits) : null,
    agreements: available.agreements ? value.agreements : [],
    payroll: available.payroll ? value.payroll : [],
    summary: available.summary ? value.summary : [],
    managed_clubs: rows(value.managed_clubs) ? value.managed_clubs : [],
    categories: Array.isArray(value.categories) ? value.categories.filter(c => typeof c === 'string') : [],
    passive_income: available.lifestyle ? value.passive_income : {asset_count:0,due_assets:0,collectable_stc:0},
    history_filters_available: value.history_filters_available === true,
    available,
    incomplete: Object.values(available).some(flag => !flag),
  };
}

export function readWalletHistory(value) {
  if (!object(value) || !rows(value.transactions) || !numeric(value.total)) throw new Error('Invalid wallet history response');
  return value;
}
