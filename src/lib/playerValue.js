/** Purchase valuations are retired: recruitment uses player agreements only. */
export function calculatePlayerValue() { return null; }

export function formatSTC(value) {
  if (value === null || value === undefined) return '—';
  const v = Number(value);
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B STC`;
  if (v >= 1_000_000)     return `${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M STC`;
  if (v >= 1_000)         return `${(v / 1_000).toFixed(v >= 100_000 ? 0 : 1)}K STC`;
  return `${v.toLocaleString()} STC`;
}

/**
 * Suggest a weekly salary band from STAGE Card Level; legacy OVR/value arguments are ignored.
 */
export function suggestSalaryRange(contractType, _overallRating = 70, _marketValue = 0, cardLevel = 1) {
  const level=Math.max(1,Math.min(100,Number(cardLevel)||1));
  const bands=[[5,5000,15000],[10,10000,25000],[25,15000,40000],[50,25000,70000],[75,40000,100000],[100,60000,150000]];
  const [,min,max]=bands.find(([to])=>level<=to);
  return {min,max,label:'STAGE Card Level '+level,based_on_value:false};
}

export function suggestWeeklySalary(contractType, player) {
  const range = suggestSalaryRange(
    contractType,
    player?.overall_rating,
    player?.market_value_stc || player?.market_value,
    player?.card_level || 1,
  );
  const mid = (Number(range.min) + Number(range.max)) / 2;
  return Math.max(0, Math.round(mid / 1000) * 1000);
}

export function suggestSigningBonus(contractType, weeklySalary) {
  const weeks = { trial: 4, academy: 4, squad: 4, important: 4, star: 4 };
  const weekly = Math.max(0, Number(weeklySalary) || 0);
  const type = String(contractType || "").toLowerCase();
  return Math.round((weekly * (weeks[type] || 4)) / 1000) * 1000;
}
