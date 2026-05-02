import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

const PRICE_TO_TIER = {
        'price_1TOZpL2fnaWmNMFQ9s0urzOD': { tier: 'pro',   billing: 'monthly' },
        'price_1TOZpM2fnaWmNMFQWeNwttmB': { tier: 'pro',   billing: 'yearly'  },
        'price_1TOZpM2fnaWmNMFQRUPsGVfB': { tier: 'elite', billing: 'monthly' },
        'price_1TOZpM2fnaWmNMFQXayEAcHW': { tier: 'elite', billing: 'yearly'  },
      };

// Admin-only: manually re-apply subscription from Stripe for a given email
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email } = await req.json();
    if (!email) return Response.json({ error: 'email is required' }, { status: 400 });

    // Find player in DB
    const players = await base44.asServiceRole.entities.Player.filter({ email }, null, 1);
    const player = players[0];
    if (!player) return Response.json({ error: 'Player not found in DB' }, { status: 404 });

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email, limit: 5 });
    if (customers.data.length === 0) {
      return Response.json({ error: 'No Stripe customer found for this email' }, { status: 404 });
    }

    // Get active subscriptions for this customer
    let activeSubscription = null;
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'active', limit: 5 });
      if (subs.data.length > 0) {
        activeSubscription = subs.data[0];
        break;
      }
    }

    if (!activeSubscription) {
      return Response.json({ error: 'No active subscription found in Stripe for this email' }, { status: 404 });
    }

    const priceId = activeSubscription.items?.data?.[0]?.price?.id;
    const mapped = PRICE_TO_TIER[priceId];
    if (!mapped) {
      return Response.json({ error: `Unknown price ID: ${priceId}` }, { status: 400 });
    }

    const { tier, billing } = mapped;
    const expiresAt = new Date(activeSubscription.current_period_end * 1000).toISOString();
    const monthlyCredits = tier === 'elite' ? 300 : tier === 'pro' ? 100 : 0;

    await base44.asServiceRole.entities.Player.update(player.id, {
      subscription: tier,
      subscription_expires_at: expiresAt,
      subscription_billing: billing,
      stripe_subscription_id: activeSubscription.id,
      stripe_customer_id: activeSubscription.customer,
      credits: (player.credits || 0) + monthlyCredits,
    });

    await base44.asServiceRole.entities.Notification.create({
      recipient_email: email,
      type: 'result_confirmed',
      title: `🌟 STAGE ${tier.toUpperCase()} activated!`,
      body: `Your ${tier.toUpperCase()} subscription is active until ${new Date(expiresAt).toLocaleDateString()}. ${monthlyCredits > 0 ? `+${monthlyCredits} credits added!` : ''}`,
      link: '/store',
      read: false,
    });

    return Response.json({
      success: true,
      player_id: player.id,
      gamertag: player.gamertag,
      tier,
      billing,
      expires_at: expiresAt,
      credits_added: monthlyCredits,
    });
  } catch (error) {
    console.error('fixSubscription error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});