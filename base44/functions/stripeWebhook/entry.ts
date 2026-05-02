import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('Missing stripe-signature header', { status: 400 });
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // ── ONE-TIME CREDIT PURCHASE ──────────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const meta = session.metadata || {};

      // Handle subscription checkout completion
      if (meta.type === 'subscription') {
        // subscription activation is handled by invoice.paid
        console.log('Subscription checkout completed, waiting for invoice.paid');
        return Response.json({ received: true });
      }

      // One-time credit purchase
      const userEmail = meta.user_email;
      const credits = parseInt(meta.credits || '0');
      const creditTarget = meta.credit_target || 'player';
      const playerId = meta.player_id;
      const clubId = meta.club_id;

      if (!userEmail || credits <= 0) {
        console.error('Missing metadata in session:', session.id);
        return Response.json({ received: true });
      }

      if (creditTarget === 'club' && clubId) {
        const clubs = await base44.asServiceRole.entities.Club.filter({ id: clubId }, null, 1);
        const club = clubs[0];
        if (club) {
          await base44.asServiceRole.entities.Club.update(clubId, { credits: (club.credits || 0) + credits });
          console.log(`Added ${credits} credits to club ${clubId}`);
        }
      } else if (playerId) {
        const players = await base44.asServiceRole.entities.Player.filter({ id: playerId }, null, 1);
        const player = players[0];
        if (player) {
          await base44.asServiceRole.entities.Player.update(playerId, { credits: (player.credits || 0) + credits });
          console.log(`Added ${credits} credits to player ${playerId}`);
        }
      }

      await base44.asServiceRole.entities.Notification.create({
        recipient_email: userEmail,
        type: 'result_confirmed',
        title: `💳 +${credits} STAGE Credits added!`,
        body: `Your purchase of ${credits} credits has been confirmed.`,
        link: '/store',
        read: false,
      });
    }

    // ── SUBSCRIPTION INVOICE PAID (new or renewal) ────────────────

    console.log('Type =>',event.type)
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      const subId = invoice.subscription;
      if (!subId) return Response.json({ received: true });

      const subscription = await stripe.subscriptions.retrieve(subId);
      const meta = subscription.metadata || {};
      const playerEmail = invoice.customer_email || meta.user_email;

      console.log('subscription: ',subscription,', meta: ',meta,', playerEmail: ',playerEmail);

      // Map price IDs to tier/billing as fallback when metadata is missing
      const PRICE_TO_TIER = {
        'price_1TOZpL2fnaWmNMFQ9s0urzOD': { tier: 'pro',   billing: 'monthly' },
        'price_1TOZpM2fnaWmNMFQWeNwttmB': { tier: 'pro',   billing: 'yearly'  },
        'price_1TOZpM2fnaWmNMFQRUPsGVfB': { tier: 'elite', billing: 'monthly' },
        'price_1TOZpM2fnaWmNMFQXayEAcHW': { tier: 'elite', billing: 'yearly'  },
      };
      const priceId = subscription.items?.data?.[0]?.price?.id;
      const fromPrice = PRICE_TO_TIER[priceId] || {};

      const tier    = meta.subscription_tier    || fromPrice.tier;
      const billing = meta.subscription_billing || fromPrice.billing;
      let   playerId = meta.player_id;

      console.log('tier: ',tier,', billing: ',billing,', playerId: ',playerId);


      if (!playerEmail || !tier) {
        console.log('Cannot determine tier or email, skipping:', subId);
        return Response.json({ received: true });
      }

      // Fallback: find player by email if player_id missing from metadata
      if (!playerId) {
        console.log('player_id missing from metadata, looking up by email:', playerEmail);
        const found = await base44.asServiceRole.entities.Player.filter({ email: playerEmail }, null, 1);
        if (found[0]) playerId = found[0].id;
      }

      if (!playerId) {
        console.log('Player not found for email:', playerEmail);
        return Response.json({ received: true });
      }

      // Calculate expiry: end of current period
      const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

      // Give monthly credits on each renewal
      const monthlyCredits = tier === 'elite' ? 300 : tier === 'pro' ? 100 : 0;

      const players = await base44.asServiceRole.entities.Player.filter({ id: playerId }, null, 1);
      const player = players[0];
       console.log(player,`Subscription activated: ${tier} (${billing}) for ${playerEmail}, expires ${expiresAt}`);
      if (player) {
        await base44.asServiceRole.entities.Player.update(playerId, {
          subscription: tier,
          subscription_expires_at: expiresAt,
          subscription_billing: billing,
          stripe_subscription_id: subId,
          stripe_customer_id: invoice.customer,
          credits: (player.credits || 0) + monthlyCredits,
        });
        console.log(`Subscription activated: ${tier} (${billing}) for ${playerEmail}, expires ${expiresAt}`);

        await base44.asServiceRole.entities.Notification.create({
          recipient_email: playerEmail,
          type: 'result_confirmed',
          title: `🌟 STAGE ${tier.toUpperCase()} activated!`,
          body: `Your ${tier.toUpperCase()} subscription is active until ${new Date(expiresAt).toLocaleDateString()}. ${monthlyCredits > 0 ? `+${monthlyCredits} credits added!` : ''}`,
          link: '/store',
          read: false,
        });
      }
    }

    // ── SUBSCRIPTION CANCELLED / EXPIRED ─────────────────────────
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const meta = subscription.metadata || {};
      const playerId = meta.player_id;

      if (playerId) {
        await base44.asServiceRole.entities.Player.update(playerId, {
          subscription: 'rookie',
          subscription_expires_at: null,
          subscription_billing: null,
          stripe_subscription_id: null,
        });
        console.log(`Subscription cancelled for player ${playerId}`);

        const playerEmail = meta.user_email;
        if (playerEmail) {
          await base44.asServiceRole.entities.Notification.create({
            recipient_email: playerEmail,
            type: 'result_confirmed',
            title: '⚠️ Subscription ended',
            body: 'Your subscription has been cancelled and you have been moved to the YOUTH plan.',
            link: '/store',
            read: false,
          });
        }
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});