const TARGET_TYPES = new Set(["min", "exact", "range"]);

export const FOUNDER_PLAYER_WEEKLY_SALARY_MIN = 40_000;
export const FOUNDER_PLAYER_WEEKLY_SALARY_MAX = 250_000; // 250K STC

export function isFounderPlayerWageAllowed(weeklySalary) {
  const weekly = Number(weeklySalary);
  return Number.isFinite(weekly)
    && weekly >= FOUNDER_PLAYER_WEEKLY_SALARY_MIN
    && weekly <= FOUNDER_PLAYER_WEEKLY_SALARY_MAX;
}

export function founderPlayerWageError(weeklySalary) {
  if (isFounderPlayerWageAllowed(weeklySalary)) return null;
  return `Founder Player wage must be between ${FOUNDER_PLAYER_WEEKLY_SALARY_MIN.toLocaleString()} and ${FOUNDER_PLAYER_WEEKLY_SALARY_MAX.toLocaleString()} STC per week`;
}

export function normalizePerformanceTargets(value) {
  if (Array.isArray(value)) return value.filter((row) => row && row.stat);
  if (value && Array.isArray(value.targets)) return value.targets.filter((row) => row && row.stat);
  return [];
}

export function normalizeFounderPlayerTerms(input = {}) {
  const weekly = Math.max(0, Number(input.weekly_salary_stc) || 0);
  const bonus = Math.max(0, Number(input.signing_bonus_stc) || 0);
  const targets = normalizePerformanceTargets(input.performance_targets).map((row) => ({
    stat: String(row.stat),
    type: TARGET_TYPES.has(row.type) ? row.type : "min",
    value: Number(row.value) || 0,
    value_max: Number(row.value_max) || 0,
  }));
  return {
    weekly_salary_stc: weekly,
    signing_bonus_stc: bonus,
    performance_targets: targets,
  };
}
