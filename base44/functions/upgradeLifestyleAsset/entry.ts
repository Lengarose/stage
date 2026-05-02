/**
 * upgradeLifestyleAsset
 * Applies an upgrade to an owned lifestyle asset (property or vehicle).
 * Body: { purchase_id, upgrade_id }
 *
 * Cost formula: basePrice * slotMultiplier * 3^currentLevel
 * (exponential scaling — high economy, no cheap upgrades at high levels)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PROPERTY_UPGRADES = [
  { id: "interior",   base_cost_multiplier: 0.10 },
  { id: "rooms",      base_cost_multiplier: 0.15 },
  { id: "luxury",     base_cost_multiplier: 0.20 },
  { id: "smart_home", base_cost_multiplier: 0.08 },
  { id: "security",   base_cost_multiplier: 0.07 },
  { id: "pool",       base_cost_multiplier: 0.12 },
  { id: "gym",        base_cost_multiplier: 0.09 },
  { id: "cinema",     base_cost_multiplier: 0.10 },
];

const VEHICLE_UPGRADES = [
  { id: "engine",     base_cost_multiplier: 0.25 },
  { id: "exhaust",    base_cost_multiplier: 0.10 },
  { id: "suspension", base_cost_multiplier: 0.12 },
  { id: "wrap",       base_cost_multiplier: 0.08 },
  { id: "wheels",     base_cost_multiplier: 0.09 },
  { id: "interior_v", base_cost_multiplier: 0.11 },
  { id: "nitro",      base_cost_multiplier: 0.22 },
  { id: "rarity",     base_cost_multiplier: 0.40 },
];

// Cost = basePrice * multiplier * 3^currentLevel — rounded to nearest 50K
function calcUpgradeCost(basePrice, multiplier, currentLevel) {
  const raw = basePrice * multiplier * Math.pow(3, currentLevel);
  return Math.max(50_000, Math.round(raw / 50_000) * 50_000);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { purchase_id, upgrade_id } = await req.json();
    if (!purchase_id || !upgrade_id) {
      return Response.json({ error: 'purchase_id and upgrade_id required' }, { status: 400 });
    }

    const purchaseArr = await base44.asServiceRole.entities.LifestylePurchase.filter({ id: purchase_id });
    const purchase = purchaseArr[0];
    if (!purchase) return Response.json({ error: 'Asset not found' }, { status: 404 });

    const playerArr = await base44.entities.Player.filter({ email: user.email });
    const player = playerArr[0];
    if (!player || purchase.player_id !== player.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Defaulted assets cannot be upgraded
    if (purchase.is_defaulted) {
      return Response.json({ error: 'Asset is defaulted. Pay overdue maintenance first.' }, { status: 400 });
    }

    const itemArr = await base44.asServiceRole.entities.LifestyleItem.filter({ id: purchase.item_id });
    const item = itemArr[0];
    if (!item) return Response.json({ error: 'Item not found' }, { status: 404 });

    const allUpgrades = item.category === 'vehicle' ? VEHICLE_UPGRADES : PROPERTY_UPGRADES;
    const upgradeDef = allUpgrades.find(u => u.id === upgrade_id);
    if (!upgradeDef) return Response.json({ error: 'Invalid upgrade_id' }, { status: 400 });

    const maxLevel = item.max_upgrade_level || 8;
    const currentLevel = purchase.upgrade_level || 0;
    if (currentLevel >= maxLevel) {
      return Response.json({ error: 'Asset is at max upgrade level' }, { status: 400 });
    }

    const existingSlots = purchase.upgrade_slots || [];
    if (existingSlots.find(s => s.id === upgrade_id)) {
      return Response.json({ error: 'Upgrade already applied' }, { status: 400 });
    }

    const cost = calcUpgradeCost(purchase.price_paid_stc, upgradeDef.base_cost_multiplier, currentLevel);

    const playerStc = player.stc || 0;
    if (playerStc < cost) {
      return Response.json({ error: 'Insufficient STC', required: cost, balance: playerStc }, { status: 400 });
    }

    const newStc = playerStc - cost;
    await base44.asServiceRole.entities.Player.update(player.id, { stc: newStc });

    const newSlots = [...existingSlots, {
      id: upgrade_id,
      applied_at: new Date().toISOString(),
      cost_paid: cost,
    }];
    const newLevel = currentLevel + 1;
    const newValue = (purchase.current_value_stc || purchase.price_paid_stc) + cost;

    // Each upgrade also bumps maintenance cost by 8%
    const currentMaint = purchase.weekly_maintenance_stc || 0;
    const newMaint = currentMaint > 0 ? Math.round(currentMaint * 1.08 / 5000) * 5000 : currentMaint;

    await base44.asServiceRole.entities.LifestylePurchase.update(purchase_id, {
      upgrade_level: newLevel,
      upgrade_slots: newSlots,
      current_value_stc: newValue,
      weekly_maintenance_stc: newMaint,
    });

    await base44.asServiceRole.entities.STCTransaction.create({
      player_id: player.id,
      player_email: player.email,
      amount: -cost,
      type: 'lifestyle_upgrade',
      description: `Upgrade [${upgrade_id}] on ${purchase.item_name} → Level ${newLevel}`,
      reference_id: purchase_id,
    });

    return Response.json({
      success: true,
      new_stc_balance: newStc,
      upgrade_level: newLevel,
      cost,
      new_value: newValue,
      new_maintenance: newMaint,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});