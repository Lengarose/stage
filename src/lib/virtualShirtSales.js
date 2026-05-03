import { base44 } from '@/api/base44Client';
import { calculateShirtPrice } from './shirtEconomy';

const TIER_MULTIPLIER = {
  starter: 1.0,
  mid:     1.15,
  premium: 1.30,
  luxury:  1.50,
  elite:   1.75,
};

const TIER_ORDER = ["starter", "mid", "premium", "luxury", "elite"];

function highestTier(purchases) {
  let max = 0;
  for (const p of purchases) {
    const i = TIER_ORDER.indexOf(p.item_tier || 'starter');
    if (i > max) max = i;
  }
  return TIER_ORDER[max];
}

function computeSalesCount(stat, player, isMotm, lifestyleTier, hasActiveContract) {
  const ovr = player.overall_rating || 70;
  // OVR 70 → ~0.7, OVR 80 → 1.4, OVR 90 → 2.1, OVR 99 → 2.8
  const base = Math.max(0.3, (ovr - 65) / 7);

  const goalBonus   = (stat.goals   || 0) * 3;
  const assistBonus = (stat.assists || 0) * 2;
  const motmBonus   = isMotm ? 5 : 0;
  const ratingBonus = Math.max(0, ((stat.rating || 6.0) - 6.0) * 1.5);
  const contractBoost = hasActiveContract ? 1.1 : 1.0;

  const tier = lifestyleTier || 'starter';
  const multiplier = (TIER_MULTIPLIER[tier] || 1.0) * contractBoost;

  const raw = (base + goalBonus + assistBonus + motmBonus + ratingBonus) * multiplier;
  return Math.max(0, Math.round(raw));
}

/**
 * Called once after a club match is confirmed completed.
 * Generates virtual ShirtSale records and adds shirt revenue to each club.
 */
export async function generateMatchShirtSales(game) {
  if (game.mode !== 'club' || !game.home_club_id) return;

  try {
    const stats = await base44.entities.MatchPlayerStat.filter({ match_id: game.id });
    if (!stats || stats.length === 0) return;

    const emails = [...new Set(stats.map(s => s.player_email).filter(Boolean))];
    if (emails.length === 0) return;

    // Fetch players by email in parallel
    const playerResults = await Promise.all(
      emails.map(email =>
        base44.entities.Player.filter({ email }, null, 1)
          .then(r => r[0] || null)
          .catch(() => null)
      )
    );
    const emailToPlayer = {};
    playerResults.filter(Boolean).forEach(p => { emailToPlayer[p.email] = p; });

    // Fetch lifestyle purchases per player
    const lifestyleResults = await Promise.all(
      playerResults.filter(Boolean).map(p =>
        base44.entities.LifestylePurchase.filter({ player_id: p.id }, null, 50)
          .catch(() => [])
      )
    );
    const playerIdToTier = {};
    playerResults.filter(Boolean).forEach((p, i) => {
      playerIdToTier[p.id] = highestTier(lifestyleResults[i] || []);
    });

    // Fetch active contracts per player
    const contractResults = await Promise.all(
      playerResults.filter(Boolean).map(p =>
        base44.entities.PlayerContract.filter({ user_id: p.id, status: 'active' }, null, 1)
          .then(r => r.length > 0)
          .catch(() => false)
      )
    );
    const playerIdToContract = {};
    playerResults.filter(Boolean).forEach((p, i) => {
      playerIdToContract[p.id] = contractResults[i];
    });

    // Determine MOTM = highest-rated player in this match
    let topRating = -1;
    let motmEmail = null;
    for (const stat of stats) {
      const r = stat.rating || 6.0;
      if (r > topRating) { topRating = r; motmEmail = stat.player_email; }
    }

    // Fetch both clubs
    const clubIds = [...new Set([game.home_club_id, game.away_club_id].filter(Boolean))];
    const clubArr = await Promise.all(
      clubIds.map(id => base44.entities.Club.filter({ id }, null, 1).then(r => r[0] || null).catch(() => null))
    );
    const clubMap = {};
    clubArr.filter(Boolean).forEach(c => { clubMap[c.id] = c; });

    const clubRevenue = {};
    const salePromises = [];

    for (const stat of stats) {
      const player = emailToPlayer[stat.player_email];
      if (!player?.shirt_number || !player.club_id) continue;

      const isMotm = stat.player_email === motmEmail && topRating >= 7.0;
      const lifestyleTier = playerIdToTier[player.id] || 'starter';
      const hasContract = playerIdToContract[player.id] || false;

      const count = computeSalesCount(stat, player, isMotm, lifestyleTier, hasContract);
      if (count === 0) continue;

      const price = calculateShirtPrice(player);
      clubRevenue[player.club_id] = (clubRevenue[player.club_id] || 0) + price * count;

      for (let i = 0; i < count; i++) {
        salePromises.push(
          base44.entities.ShirtSale.create({
            player_id:       player.id,
            player_gamertag: player.gamertag,
            shirt_number:    player.shirt_number,
            club_id:         player.club_id,
            buyer_email:     'virtual_fan',
            price_stc:       price,
          }).catch(() => null)
        );
      }
    }

    await Promise.all(salePromises);

    // Credit revenue to each club
    await Promise.all(
      Object.entries(clubRevenue).map(async ([clubId, revenue]) => {
        if (revenue <= 0) return;
        const club = clubMap[clubId];
        if (!club) return;
        try {
          await base44.entities.Club.update(clubId, { stc: (club.stc || 0) + revenue });
          await base44.entities.STCTransaction.create({
            club_id:     clubId,
            amount:      revenue,
            type:        'shirt_revenue',
            description: `Shirt sales — ${game.home_club_name} vs ${game.away_club_name}`,
            reference_id: game.id,
          });
        } catch (_) {}
      })
    );

  } catch (err) {
    console.error('[virtualShirtSales] error:', err);
  }
}
