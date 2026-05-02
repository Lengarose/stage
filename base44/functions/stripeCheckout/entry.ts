import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

const PRICE_MAP = {
  credits_100:  { credits: 100, amount: 99,   name: '100 STAGE Credits' },
  credits_300:  { credits: 300, amount: 249,  name: '300 STAGE Credits' },
  credits_700:  { credits: 700, amount: 499,  name: '700 STAGE Credits' },
  credits_1500: { credits: 1500, amount: 999, name: '1500 STAGE Credits' },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { packId, creditTarget, successUrl, cancelUrl } = await req.json();

    const pack = PRICE_MAP[packId];
    if (!pack) return Response.json({ error: 'Invalid pack ID' }, { status: 400 });

    // Get player record for metadata
    const players = await base44.entities.Player.filter({ email: user.email });
    const player = players[0];

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price_data: { currency: 'eur', unit_amount: pack.amount, product_data: { name: pack.name } }, quantity: 1 }],
      success_url: successUrl || `${req.headers.get('origin')}/store?payment=success&pack=${packId}&target=${creditTarget}`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/store?payment=cancelled`,
      customer_email: user.email,
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        user_email: user.email,
        pack_id: packId,
        credits: String(pack.credits),
        credit_target: creditTarget || 'player',
        player_id: player?.id || '',
        club_id: player?.club_id || '',
      },
    });

    return Response.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});