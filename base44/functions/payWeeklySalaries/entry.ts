/**
 * payWeeklySalaries — automatic weekly salary payout (runs every Monday at 00:00 UTC).
 * Pays all active contracts based on their weekly_salary_stc.
 * Replaces monthly batching with true weekly automation.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both admin-triggered and automation-triggered (no user)
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const paid = [];
    const errors = [];

    // Get all active contracts with a weekly salary
    const activeContracts = await base44.asServiceRole.entities.PlayerContract.filter({ status: 'active' });
    const salaryContracts = activeContracts.filter(c => (c.weekly_salary_stc || 0) > 0);

    for (const contract of salaryContracts) {
      try {
        const lastPaid = contract.last_salary_paid_at ? new Date(contract.last_salary_paid_at) : new Date(contract.start_date || contract.created_date);
        const msPerWeek = 7 * 24 * 60 * 60 * 1000;
        const weeksSincePaid = Math.floor((now - lastPaid) / msPerWeek);

        if (weeksSincePaid < 1) continue; // nothing owed yet

        const amount = weeksSincePaid * (contract.weekly_salary_stc || 0);

        // Get player
        const players = await base44.asServiceRole.entities.Player.filter({ id: contract.user_id });
        const player = players[0];
        if (!player) continue;

        // Get club
        const clubs = await base44.asServiceRole.entities.Club.filter({ id: contract.team_id });
        const club = clubs[0];

        // Deduct from club STC
        const clubStc = club?.stc || 0;
        const actualAmount = Math.min(amount, clubStc); // can't pay more than club has
        if (actualAmount <= 0) continue;

        // Update club balance
        if (club) {
          await base44.asServiceRole.entities.Club.update(club.id, {
            stc: Math.max(0, clubStc - actualAmount),
          });
        }

        // Credit player
        await base44.asServiceRole.entities.Player.update(player.id, {
          stc: (player.stc || 0) + actualAmount,
        });

        // Record transaction
        await base44.asServiceRole.entities.STCTransaction.create({
          player_id: player.id,
          player_email: player.email,
          club_id: contract.team_id,
          amount: actualAmount,
          type: 'salary',
          description: `Weekly salary (${weeksSincePaid} week${weeksSincePaid > 1 ? 's' : ''}) from ${club?.name || 'club'}`,
          reference_id: contract.id,
        });

        // Update last_salary_paid_at on contract
        await base44.asServiceRole.entities.PlayerContract.update(contract.id, {
          last_salary_paid_at: now.toISOString(),
        });

        // Notify player
        await base44.asServiceRole.entities.Notification.create({
          recipient_email: player.email,
          type: 'achievement',
          title: `💰 Weekly salary: +${actualAmount.toLocaleString()} STC`,
          body: `${club?.name || 'Your club'} paid your ${weeksSincePaid}-week${weeksSincePaid > 1 ? 's' : ''} salary.`,
          link: '/lifestyle',
          read: false,
        });

        paid.push({ player: player.gamertag, amount: actualAmount, weeks: weeksSincePaid });
      } catch (err) {
        errors.push({ contract_id: contract.id, error: err.message });
      }
    }

    return Response.json({ success: true, paid_count: paid.length, paid, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});