/**
 * checkExpiredContracts — runs daily via automation.
 *
 * - If games_played >= max_games  → mark as "completed"
 * - If today >= end_date          → mark as "expired"
 * - Logs warning when < 10 games left or < 7 days left
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CONTRACT_META = {
  trial:     { label: "Trial",            max_games: 5,   max_days: 14  },
  academy:   { label: "Academy",          max_games: 20,  max_days: 30  },
  squad:     { label: "Squad Player",     max_games: 100, max_days: 90  },
  important: { label: "Important Player", max_games: 250, max_days: 120 },
  star:      { label: "Star Player",      max_games: 400, max_days: 180 },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const activeContracts = await base44.asServiceRole.entities.PlayerContract.filter({ status: "active" });
    if (activeContracts.length === 0) return Response.json({ checked: 0, expired: 0, completed: 0, warned: 0 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const toComplete = [];
    const toExpire = [];
    const toWarn = [];

    for (const contract of activeContracts) {
      const meta = CONTRACT_META[contract.contract_type];
      if (!meta) continue;

      const gamesPlayed = contract.games_played || 0;
      const gamesLeft = meta.max_games - gamesPlayed;

      let daysLeft = null;
      if (contract.end_date) {
        const end = new Date(contract.end_date);
        end.setHours(0, 0, 0, 0);
        daysLeft = Math.floor((end - today) / (1000 * 60 * 60 * 24));
      }

      if (gamesPlayed >= meta.max_games) {
        toComplete.push({ contract, meta, gamesPlayed });
      } else if (daysLeft !== null && daysLeft <= 0) {
        toExpire.push({ contract, meta, gamesPlayed });
      } else if (gamesLeft <= 10 || (daysLeft !== null && daysLeft <= 7)) {
        toWarn.push({ contract, meta, gamesLeft, daysLeft });
      }
    }

    // Batch-fetch all unique player and club IDs we need
    const allContractsToProcess = [...toComplete, ...toExpire, ...toWarn];
    const playerIds = [...new Set(allContractsToProcess.map(i => i.contract.user_id).filter(Boolean))];
    const clubIds   = [...new Set(allContractsToProcess.map(i => i.contract.team_id).filter(Boolean))];

    const [allPlayers, allClubs] = await Promise.all([
      playerIds.length > 0 ? base44.asServiceRole.entities.Player.filter({}) : Promise.resolve([]),
      clubIds.length > 0   ? base44.asServiceRole.entities.Club.filter({})   : Promise.resolve([]),
    ]);

    const playerMap = {};
    for (const p of allPlayers) playerMap[p.id] = p;
    const clubMap = {};
    for (const c of allClubs) clubMap[c.id] = c;

    // Notifications removed — no-op
    async function sendBoth() {}

    // Process completed
    await Promise.all(toComplete.map(async ({ contract, meta, gamesPlayed }) => {
      const player = playerMap[contract.user_id];
      const club   = clubMap[contract.team_id];
      await Promise.all([
        base44.asServiceRole.entities.PlayerContract.update(contract.id, { status: "completed" }),
        base44.asServiceRole.entities.PlayerContractHistory.create({
          contract_id: contract.id,
          action_type: "completed",
          action_note: `Contract completed: ${gamesPlayed}/${meta.max_games} games played.`,
        }),
        sendBoth(
          player?.email,
          club?.owner_email,
          `✅ Contract completed — ${player?.gamertag || "Player"}`,
          `${player?.gamertag || "A player"}'s ${meta.label} contract with ${club?.name || "the club"} has been completed (${gamesPlayed} games played).`,
          player ? `/players/${player.id}` : `/clubs/${contract.team_id}`
        ),
      ]);
    }));

    // Process expired
    await Promise.all(toExpire.map(async ({ contract, meta, gamesPlayed }) => {
      const player = playerMap[contract.user_id];
      const club   = clubMap[contract.team_id];
      await Promise.all([
        base44.asServiceRole.entities.PlayerContract.update(contract.id, { status: "expired" }),
        base44.asServiceRole.entities.PlayerContractHistory.create({
          contract_id: contract.id,
          action_type: "expired",
          action_note: `Contract expired: end date ${contract.end_date} reached.`,
        }),
        sendBoth(
          player?.email,
          club?.owner_email,
          `⏰ Contract expired — ${player?.gamertag || "Player"}`,
          `${player?.gamertag || "A player"}'s ${meta.label} contract with ${club?.name || "the club"} has expired.`,
          player ? `/players/${player.id}` : `/clubs/${contract.team_id}`
        ),
      ]);
    }));

    // Send warnings
    await Promise.all(toWarn.map(async ({ contract, meta, gamesLeft, daysLeft }) => {
      const player = playerMap[contract.user_id];
      const club   = clubMap[contract.team_id];
      const parts = [];
      if (gamesLeft <= 10) parts.push(`${gamesLeft} game${gamesLeft !== 1 ? "s" : ""} left`);
      if (daysLeft !== null && daysLeft <= 7) parts.push(`${daysLeft} day${daysLeft !== 1 ? "s" : ""} left`);
      await sendBoth(
        player?.email,
        club?.owner_email,
        `⚠️ Contract expiring soon — ${player?.gamertag || "Player"}`,
        `${player?.gamertag || "A player"}'s ${meta.label} contract is almost over: ${parts.join(" · ")}.`,
        player ? `/players/${player.id}` : `/clubs/${contract.team_id}`
      );
    }));

    return Response.json({
      checked: activeContracts.length,
      completed: toComplete.length,
      expired: toExpire.length,
      warned: toWarn.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});