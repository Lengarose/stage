'use strict';

const VERSION = 'club_board_v1';
const XP_VERSION = 'stage_card_v1';
const WEEK_MS = 7 * 86400000;
const bands = Object.freeze([{
  from: 1,
  to: 5,
  min: 5000,
  max: 15000
}, {
  from: 6,
  to: 10,
  min: 10000,
  max: 25000
}, {
  from: 11,
  to: 25,
  min: 15000,
  max: 40000
}, {
  from: 26,
  to: 50,
  min: 25000,
  max: 70000
}, {
  from: 51,
  to: 75,
  min: 40000,
  max: 100000
}, {
  from: 76,
  to: 100,
  min: 60000,
  max: 150000
}]);
function fail(message, status = 422, details) {
  throw Object.assign(new Error(message), {
    status,
    details
  });
}
function money(value, name = 'Amount') {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || Math.abs(Math.round(amount * 100) - amount * 100) > 0.000001 || amount > Number.MAX_SAFE_INTEGER / 100) fail(`${name} must be a nonnegative amount with at most two decimals`);
  return amount;
}
function xpForLevel(level) {
  if (!Number.isInteger(level) || level < 1 || level > 100) fail('Card level must be between 1 and 100');
  if (level === 1) return 0;
  return level <= 5 ? 200 : level <= 10 ? 300 : level <= 25 ? 500 : level <= 50 ? 800 : level <= 75 ? 1200 : 1600;
}
function progression(totalXp = 0) {
  if (!Number.isSafeInteger(totalXp) || totalXp < 0) fail('Card XP must be a nonnegative integer');
  let level = 1,
    threshold = 0;
  while (level < 100 && totalXp >= threshold + xpForLevel(level + 1)) {
    threshold += xpForLevel(level + 1);
    level++;
  }
  return {
    policy_version: XP_VERSION,
    level,
    total_xp: totalXp,
    level_start_xp: threshold,
    xp_in_level: level === 100 ? 0 : totalXp - threshold,
    xp_to_next_level: level === 100 ? 0 : xpForLevel(level + 1),
    max_level: 100
  };
}
function salaryBand(totalXp = 0) {
  const card = progression(totalXp);
  return {
    ...bands.find(b => card.level >= b.from && card.level <= b.to),
    level: card.level
  };
}
function playerTerms(input, totalXp, kind = 'signing') {
  const range = salaryBand(totalXp),
    weekly = money(input.weekly_salary_stc, 'Weekly salary'),
    bonus = money(input.signing_bonus_stc ?? 0, 'Signing bonus');
  if (weekly < range.min || weekly > range.max) fail(`Player salary must be between ${range.min} and ${range.max} STC per week`, 422, {
    range
  });
  if (!['signing', 'renewal', 'amendment'].includes(kind)) fail('Choose signing, renewal or amendment');
  if (kind !== 'signing' && bonus !== 0) fail('Renewals and salary amendments do not include a new bonus');
  if (bonus > weekly * 4) fail('A player signing bonus cannot exceed four weekly salaries');
  const role = input.squad_role || 'squad';
  if (!['trial', 'academy', 'squad', 'important', 'star'].includes(role)) fail('Choose a supported squad role');
  return {
    weekly_salary_stc: weekly,
    signing_bonus_stc: bonus,
    squad_role: role,
    range
  };
}
function managementOffer({
  current = 0,
  grade = 'unassessed',
  wageBudget = 0
} = {}) {
  const factors = {
    below: 1,
    meets: 1,
    exceeds: 1.1,
    exceptional: 1.2,
    unassessed: 1
  };
  if (!Object.hasOwn(factors, grade)) fail('A published objective assessment is required');
  const ceiling = Math.floor(money(wageBudget, 'Wage budget') * 10) / 100;
  const proposed = Math.round((current > 0 ? money(current) * factors[grade] : 5000) * 100) / 100;
  return {
    opening_weekly_salary_stc: Math.min(proposed, ceiling),
    minimum_weekly_salary_stc: current > 0 ? null : 4000,
    maximum_weekly_salary_stc: current > 0 ? ceiling : Math.min(6000, ceiling),
    management_ceiling_stc: ceiling,
    term_weeks: 12,
    grade,
    signing_bonus_stc: 0,
    financially_constrained: ceiling < proposed
  };
}
module.exports = {
  VERSION,
  XP_VERSION,
  WEEK_MS,
  bands,
  money,
  fail,
  xpForLevel,
  progression,
  salaryBand,
  playerTerms,
  managementOffer
};
