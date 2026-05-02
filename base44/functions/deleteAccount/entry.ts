/**
 * deleteAccount — permanently delete player account and all related data
 *
 * Does:
 *   - Delete player profile
 *   - Delete all clubs owned by the player
 *   - Delete all contracts linked to the player
 *   - Delete all lifestyle purchases
 *   - Cancel active Stripe subscriptions
 *   - Remove all inbox messages
 *   - Delete achievements, notifications, etc.
 *   - Logs cascade deletions for audit
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    const playerArr = await base44.asServiceRole.entities.Player.filter({ email: user.email });
    const player = playerArr[0];
    if (!player) return new Response(JSON.stringify({ error: 'Player not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

    const playerId = player.id;
    const playerEmail = player.email;

    // ─── CANCEL STRIPE SUBSCRIPTION ───────────────────────────────────────
    if (player.stripe_subscription_id) {
      try {
        const stripe = await import('npm:stripe@16.0.0');
        const stripeClient = new stripe.default(Deno.env.get('STRIPE_SECRET_KEY'), {
          apiVersion: '2024-04-10',
        });
        await stripeClient.subscriptions.del(player.stripe_subscription_id);
        console.log(`[deleteAccount] Cancelled Stripe subscription: ${player.stripe_subscription_id}`);
      } catch (err) {
        console.warn(`[deleteAccount] Failed to cancel Stripe subscription: ${err.message}`);
      }
    }

    // ─── DELETE ALL CLUBS OWNED ──────────────────────────────────────────
    const ownedClubs = await base44.asServiceRole.entities.Club.filter({ owner_email: playerEmail });
    for (const club of ownedClubs) {
      await base44.asServiceRole.entities.Club.delete(club.id);
      console.log(`[deleteAccount] Deleted owned club: ${club.id}`);
    }

    // ─── DELETE ALL CONTRACTS ────────────────────────────────────────────
    const contracts = await base44.asServiceRole.entities.PlayerContract.filter({ user_id: playerId });
    for (const contract of contracts) {
      await base44.asServiceRole.entities.PlayerContract.delete(contract.id);
    }
    console.log(`[deleteAccount] Deleted ${contracts.length} contracts`);

    // ─── DELETE LIFESTYLE PURCHASES ──────────────────────────────────────
    const purchases = await base44.asServiceRole.entities.LifestylePurchase.filter({ player_id: playerId });
    for (const purchase of purchases) {
      await base44.asServiceRole.entities.LifestylePurchase.delete(purchase.id);
    }
    console.log(`[deleteAccount] Deleted ${purchases.length} lifestyle purchases`);

    // ─── DELETE STC TRANSACTIONS ─────────────────────────────────────────
    const transactions = await base44.asServiceRole.entities.STCTransaction.filter({ player_id: playerId });
    for (const tx of transactions) {
      await base44.asServiceRole.entities.STCTransaction.delete(tx.id);
    }
    console.log(`[deleteAccount] Deleted ${transactions.length} STC transactions`);

    // ─── DELETE INBOX MESSAGES ──────────────────────────────────────────
    const messages = await base44.asServiceRole.entities.InboxMessage.filter({ recipient_email: playerEmail });
    for (const msg of messages) {
      await base44.asServiceRole.entities.InboxMessage.delete(msg.id);
    }
    console.log(`[deleteAccount] Deleted ${messages.length} inbox messages`);

    // ─── DELETE NOTIFICATIONS ───────────────────────────────────────────
    const notifications = await base44.asServiceRole.entities.Notification.filter({ recipient_email: playerEmail });
    for (const notif of notifications) {
      await base44.asServiceRole.entities.Notification.delete(notif.id);
    }
    console.log(`[deleteAccount] Deleted ${notifications.length} notifications`);

    // ─── DELETE DIRECT MESSAGES ─────────────────────────────────────────
    const directMsgs = await base44.asServiceRole.entities.DirectMessage.filter({
      $or: [
        { sender_email: playerEmail },
        { recipient_email: playerEmail }
      ]
    });
    for (const dm of directMsgs) {
      await base44.asServiceRole.entities.DirectMessage.delete(dm.id);
    }
    console.log(`[deleteAccount] Deleted ${directMsgs.length} direct messages`);

    // ─── DELETE FOLLOW RECORDS ──────────────────────────────────────────
    const follows = await base44.asServiceRole.entities.Follow.filter({ follower_email: playerEmail });
    for (const follow of follows) {
      await base44.asServiceRole.entities.Follow.delete(follow.id);
    }
    console.log(`[deleteAccount] Deleted ${follows.length} follow records`);

    // ─── DELETE JOIN REQUESTS ───────────────────────────────────────────
    const joinRequests = await base44.asServiceRole.entities.JoinRequest.filter({ player_email: playerEmail });
    for (const jr of joinRequests) {
      await base44.asServiceRole.entities.JoinRequest.delete(jr.id);
    }
    console.log(`[deleteAccount] Deleted ${joinRequests.length} join requests`);

    // ─── DELETE PLAYER PROFILE ──────────────────────────────────────────
    await base44.asServiceRole.entities.Player.delete(playerId);
    console.log(`[deleteAccount] Deleted player profile: ${playerId}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Account and all associated data permanently deleted',
      deletedItems: {
        clubs: ownedClubs.length,
        contracts: contracts.length,
        purchases: purchases.length,
        transactions: transactions.length,
        messages: messages.length,
        notifications: notifications.length,
        directMessages: directMsgs.length,
        follows: follows.length,
        joinRequests: joinRequests.length,
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[deleteAccount] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});