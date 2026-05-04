import { base44 } from '@/api/base44Client';

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
// Throttle: don't re-check within the same session more than once per hour
const SESSION_KEY = 'salary_last_checked';

function shouldCheck() {
  const last = sessionStorage.getItem(SESSION_KEY);
  if (!last) return true;
  return Date.now() - Number(last) > 60 * 60 * 1000;
}

/**
 * Checks if the player has any weekly salary due and pays it out.
 * Deducts from the club's STC, credits the player's STC wallet.
 * Returns the total amount paid (0 if nothing was due).
 */
export async function processPlayerSalary(player) {
  if (!player?.id) return 0;
  if (!shouldCheck()) return 0;

  sessionStorage.setItem(SESSION_KEY, String(Date.now()));

  try {
    const contracts = await base44.entities.PlayerContract.filter({ user_id: player.id, status: 'active' });
    const salaryContracts = contracts.filter(c => (c.weekly_salary_stc || 0) > 0);
    if (salaryContracts.length === 0) return 0;

    const now = new Date();
    let totalPaid = 0;

    for (const contract of salaryContracts) {
      const reference = contract.last_salary_paid_at || contract.start_date || contract.created_date;
      if (!reference) continue;

      const lastPaid = new Date(reference);
      const weeksDue = Math.floor((now - lastPaid) / MS_PER_WEEK);
      if (weeksDue < 1) continue;

      const gross = weeksDue * contract.weekly_salary_stc;

      // Fetch club fresh to get current balance
      const clubs = await base44.entities.Club.filter({ id: contract.team_id }, null, 1);
      const club = clubs[0];
      if (!club) continue;

      const actualAmount = Math.min(gross, club.stc || 0);
      if (actualAmount <= 0) continue;

      // Deduct from club
      await base44.entities.Club.update(club.id, {
        stc: Math.max(0, (club.stc || 0) - actualAmount),
      });

      // Credit player (fetch fresh to avoid stale stc value)
      const freshPlayers = await base44.entities.Player.filter({ id: player.id }, null, 1);
      const freshPlayer = freshPlayers[0] || player;
      await base44.entities.Player.update(player.id, {
        stc: (freshPlayer.stc || 0) + actualAmount,
      });

      // Record transaction
      await base44.entities.STCTransaction.create({
        player_id:    player.id,
        player_email: player.email,
        club_id:      contract.team_id,
        amount:       actualAmount,
        type:         'salary',
        description:  `Weekly salary (${weeksDue}wk) — ${club.name}`,
        reference_id: contract.id,
      });

      // Mark contract as paid
      await base44.entities.PlayerContract.update(contract.id, {
        last_salary_paid_at: now.toISOString(),
      });

      totalPaid += actualAmount;
    }

    return totalPaid;
  } catch (err) {
    console.error('[salaryProcessor] error:', err);
    return 0;
  }
}
