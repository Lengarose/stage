/**
 * payMonthlyRent — scheduled monthly.
 * Processes all active rentals:
 * - Deducts monthly rent
 * - Renews expiry by 30 days
 * - If player can't afford: issues warning, marks rent_active=false (expired)
 * - Clears already-expired rentals
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch (_) { /* scheduled = allowed */ }

    const now = new Date();
    const msPerMonth = 30 * 24 * 60 * 60 * 1000;

    const allRentals = await base44.asServiceRole.entities.LifestylePurchase.filter({
      purchase_type: 'rent',
      rent_active: true,
    });

    const paid = [];
    const expired = [];
    const skipped = [];

    for (const rental of allRentals) {
      // Auto-expire if past expiry date and no recent payment
      const expiry = rental.rent_expiry_at ? new Date(rental.rent_expiry_at) : null;
      const lastPaid = rental.last_rent_paid_at ? new Date(rental.last_rent_paid_at) : new Date(rental.created_date);
      const isDue = (now - lastPaid) >= msPerMonth;

      // Already expired
      if (expiry && now > expiry) {
        await base44.asServiceRole.entities.LifestylePurchase.update(rental.id, {
          rent_active: false,
          is_defaulted: true,
        });
        const playerArr = await base44.asServiceRole.entities.Player.filter({ id: rental.player_id });
        const player = playerArr[0];
        if (player) {
          await base44.asServiceRole.entities.Notification.create({
            recipient_email: player.email,
            type: 'announcement',
            title: `⏰ Rental expired: ${rental.item_name}`,
            body: `Your rental of ${rental.item_name} has expired and been removed from your assets.`,
            link: '/lifestyle',
            read: false,
          });
        }
        expired.push({ item: rental.item_name });
        continue;
      }

      if (!isDue) {
        skipped.push({ item: rental.item_name });
        continue;
      }

      const monthsDue = Math.max(1, Math.floor((now - lastPaid) / msPerMonth));
      const amount = monthsDue * (rental.monthly_rent_stc || 0);
      if (amount <= 0) continue;

      const playerArr = await base44.asServiceRole.entities.Player.filter({ id: rental.player_id });
      const player = playerArr[0];
      if (!player) continue;

      if ((player.stc || 0) < amount) {
        // Can't pay — expire the rental immediately
        await base44.asServiceRole.entities.LifestylePurchase.update(rental.id, {
          rent_active: false,
          is_defaulted: true,
        });
        await base44.asServiceRole.entities.Notification.create({
          recipient_email: player.email,
          type: 'announcement',
          title: `❌ Rental cancelled — insufficient STC: ${rental.item_name}`,
          body: `You couldn't afford the ${amount.toLocaleString()} STC rent for ${rental.item_name}. The rental has been terminated. Top up your STC and rent again from the store.`,
          link: '/lifestyle',
          read: false,
        });
        expired.push({ player: player.gamertag, item: rental.item_name, amount_due: amount });
        continue;
      }

      const newStc = (player.stc || 0) - amount;
      const newExpiry = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await base44.asServiceRole.entities.Player.update(player.id, { stc: newStc });
      await base44.asServiceRole.entities.LifestylePurchase.update(rental.id, {
        last_rent_paid_at: now.toISOString(),
        rent_expiry_at: newExpiry.toISOString(),
        is_defaulted: false,
      });
      await base44.asServiceRole.entities.STCTransaction.create({
        player_id: player.id,
        player_email: player.email,
        amount: -amount,
        type: 'rent_payment',
        description: `Monthly rent (${monthsDue}mo): ${rental.item_name}`,
        reference_id: rental.id,
      });
      await base44.asServiceRole.entities.Notification.create({
        recipient_email: player.email,
        type: 'announcement',
        title: `✅ Rent paid: ${rental.item_name}`,
        body: `-${amount.toLocaleString()} STC rent paid. Renewed until ${newExpiry.toLocaleDateString('en-GB')}.`,
        link: '/lifestyle',
        read: false,
      });

      paid.push({ player: player.gamertag, item: rental.item_name, amount });
    }

    return Response.json({
      success: true,
      paid_count: paid.length,
      expired_count: expired.length,
      skipped_count: skipped.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});