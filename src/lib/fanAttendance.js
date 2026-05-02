import { STADIUM_LEVELS } from './stadiumLevels';

/**
 * Fan attendance percentage based on a club's all-time record.
 *
 * Starts at 15 % for a brand-new club (no wins) and grows with victories.
 * Losing games slowly erodes the fan base.
 *
 *   base        = 15 %
 *   win bonus   = +2.5 % per win      (capped at +55 %)
 *   loss deduct = -0.8 % per loss     (capped at -10 %)
 *   streak bonus= +3 % per win streak (capped at +15 %)
 *   hard limits : 5 % – 95 %
 */
export function calcAttendancePct(club) {
  const wins      = club.wins       || 0;
  const losses    = club.losses     || 0;
  const winStreak = club.win_streak || 0;

  const base         = 15;
  const winBonus     = Math.min(wins      * 2.5, 55);
  const lossDeduct   = Math.min(losses    * 0.8, 10);
  const streakBonus  = Math.min(winStreak * 3,   15);

  const pct = base + winBonus - lossDeduct + streakBonus;
  return Math.min(95, Math.max(5, Math.round(pct)));
}

/**
 * Full attendance breakdown for a home game.
 * Returns: { count, capacity, pct, ticketPrice, revenue, levelName }
 */
export function calcAttendance(club) {
  const idx   = Math.min(Math.max(club.stadium_level || 0, 0), STADIUM_LEVELS.length - 1);
  const level = STADIUM_LEVELS[idx];
  const pct   = calcAttendancePct(club);
  const count = Math.round(level.capacity * pct / 100);

  return {
    count,
    capacity:    level.capacity,
    pct,
    ticketPrice: level.ticket_price_stc,
    revenue:     count * level.ticket_price_stc,
    levelName:   level.name,
  };
}
