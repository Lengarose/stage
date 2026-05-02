/**
 * contractActions — unified backend for all contract lifecycle operations.
 *
 * Actions:
 *   offer      — club sends a contract offer to a player (creates InboxMessage + Notification)
 *   accept     — player accepts their pending contract (via inbox or contracts tab)
 *   reject     — player rejects their pending contract
 *   negotiate  — either side sends a counter-offer (creates InboxMessage on the other side)
 *   terminate  — club terminates an active contract
 *   renew      — club offers a renewal contract
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CONTRACT_META = {
  trial:     { label: "Trial",            max_games: 5,   max_days: 14  },
  academy:   { label: "Academy",          max_games: 20,  max_days: 30  },
  squad:     { label: "Squad Player",     max_games: 100, max_days: 90  },
  important: { label: "Important Player", max_games: 250, max_days: 120 },
  star:      { label: "Star Player",      max_games: 400, max_days: 180 },
  ownership: { label: "Club Ownership",   max_games: 999, max_days: 3650 },
};

/** Checks if the acting user is club president/captain/owner or admin */
async function isClubManagement(base44, user, teamId) {
  if (user.role === "admin") return { allowed: true, actor: null, club: null };
  const [playerArr, clubArr] = await Promise.all([
    base44.entities.Player.filter({ email: user.email }),
    base44.asServiceRole.entities.Club.filter({ id: teamId }),
  ]);
  const actor = playerArr[0] || null;
  const club = clubArr[0] || null;
  const isOwner = club?.owner_email === user.email;
  const isManagement = actor && actor.club_id === teamId && (
    actor.club_roles?.includes("president") ||
    actor.club_roles?.includes("captain") ||
    actor.club_roles?.includes("vice-captain") ||
    actor.role === "captain"
  );
  return { allowed: isOwner || isManagement, actor, club };
}

/** Sends a bell notification (never throws) */
async function notify(base44, recipientEmail, type, title, body, link) {
  if (!recipientEmail) return;
  await base44.asServiceRole.entities.Notification.create({
    recipient_email: recipientEmail, type, title, body, link, read: false,
  });
}

/** Sends an InboxMessage for contract offers/negotiations */
async function sendContractInbox(base44, {
  recipientEmail, senderGamertag, senderAvatarUrl, senderClubName,
  subject, body, contractId, round
}) {
  if (!recipientEmail) return;
  await base44.asServiceRole.entities.InboxMessage.create({
    recipient_email: recipientEmail,
    sender_gamertag: senderGamertag || "Club",
    sender_avatar_url: senderAvatarUrl || null,
    sender_club_name: senderClubName || null,
    is_system: false,
    subject,
    body,
    message_type: "contract_offer",
    action_type: "contract_negotiation",
    status: "pending",
    is_read: false,
    related_entity_id: contractId,
    related_entity_type: "contract",
    metadata: { contract_id: contractId, negotiation_round: round || 0 },
  });
}

/** Adds a history entry */
async function addHistory(base44, contractId, actionType, actionBy, note) {
  await base44.asServiceRole.entities.PlayerContractHistory.create({
    contract_id: contractId, action_type: actionType, action_by: actionBy || null, action_note: note,
  });
}

/** Creates a news item — never throws */
async function createNews(base44, { type, category, title, body, club_id, club_name, club_logo_url, player_id, player_name, player_avatar_url, is_featured, is_global, link, tags, visible_to_club_ids, visible_to_player_ids, transfer_fee_stc }) {
  try {
    await base44.asServiceRole.entities.NewsItem.create({
      type: type || "announcement",
      category: category || "general",
      title,
      body: body || "",
      club_id: club_id || null,
      club_name: club_name || null,
      club_logo_url: club_logo_url || null,
      player_id: player_id || null,
      player_name: player_name || null,
      player_avatar_url: player_avatar_url || null,
      is_featured: is_featured || false,
      is_global: is_global || false,
      published_at: new Date().toISOString(),
      link: link || null,
      tags: tags || [],
      visible_to_club_ids: visible_to_club_ids || [],
      visible_to_player_ids: visible_to_player_ids || [],
      transfer_fee_stc: transfer_fee_stc || 0,
    });
  } catch (e) {
    console.error("createNews failed:", e.message);
  }
}

// Tier label shorthand
const CONTRACT_TIER_RANK = { trial: 0, academy: 1, squad: 2, important: 3, star: 4 };
const HIGH_VALUE_TRANSFER_THRESHOLD = 500_000; // STC — deals above this are "major signings"

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action, contract_id, team_id, user_id, contract_type, offer_note,
            salary_per_game_stc, weekly_salary_stc, signing_bonus_stc, transfer_fee_stc,
            performance_targets, captaincy_offered } = body;

    // ── OFFER ────────────────────────────────────────────────────────────────
    if (action === "offer") {
      if (!team_id || !user_id || !contract_type) {
        return Response.json({ error: "Missing required fields: team_id, user_id, contract_type" }, { status: 400 });
      }
      const meta = CONTRACT_META[contract_type];
      if (!meta) return Response.json({ error: "Invalid contract_type" }, { status: 400 });

      const { allowed, actor, club } = await isClubManagement(base44, user, team_id);
      if (!allowed) return Response.json({ error: "Forbidden: only club management can offer contracts" }, { status: 403 });

      // Enforce unique active/pending constraint (allow max 2 for club owners: 1 ownership + 1 player)
      const existing = await base44.asServiceRole.entities.PlayerContract.filter({ team_id, user_id });
      const activeContracts = existing.filter(c => c.status === "active" || c.status === "pending" || c.status === "pending_window");
      
      // Check ownership contract limit: max 1 ownership per player
      if (contract_type === "ownership") {
        const existingOwnership = activeContracts.find(c => c.contract_type === "ownership");
        if (existingOwnership) {
          return Response.json({ error: "Player already has an active ownership contract with this club." }, { status: 409 });
        }
      }
      
      // Check player contract limit: max 1 active/pending player contract + 1 ownership for owners
      if (contract_type !== "ownership") {
        const existingPlayerContract = activeContracts.find(c => c.contract_type !== "ownership");
        if (existingPlayerContract) {
          return Response.json({ error: `Player already has a ${existingPlayerContract.status} player contract with this club.` }, { status: 409 });
        }
      }
      
      // Max 2 contracts total: 1 ownership (optional) + 1 player contract
      if (activeContracts.length >= 2) {
        return Response.json({ error: "Player has reached maximum contract limit (1 ownership + 1 player)." }, { status: 409 });
      }

      const targetArr = await base44.asServiceRole.entities.Player.filter({ id: user_id });
      const target = targetArr[0];
      if (!target) return Response.json({ error: "Player not found" }, { status: 404 });

      // ── WAGE BUDGET ENFORCEMENT ──────────────────────────────────────────
      if (weekly_salary_stc > 0 && club) {
        const wageBudget = club.wage_budget_stc || 0;
        if (wageBudget > 0) {
          const activeContracts = await base44.asServiceRole.entities.PlayerContract.filter({ team_id, status: "active" });
          const currentWageBill = activeContracts.reduce((sum, c) => sum + (c.weekly_salary_stc || 0), 0);
          const projectedWageBill = currentWageBill + weekly_salary_stc;
          if (projectedWageBill > wageBudget) {
            return Response.json({
              error: `Wage budget exceeded. Current bill: ${currentWageBill.toLocaleString()} STC/wk. Budget: ${wageBudget.toLocaleString()} STC/wk.`,
              wage_budget_exceeded: true,
              current_wage_bill: currentWageBill,
              wage_budget: wageBudget,
            }, { status: 400 });
          }
        }
      }

      const contract = await base44.asServiceRole.entities.PlayerContract.create({
        team_id, user_id,
        offered_by: actor?.id || "",
        contract_type,
        max_games: meta.max_games,
        max_days: meta.max_days,
        games_played: 0,
        status: "pending",
        offer_note: offer_note || "",
        salary_per_game_stc: salary_per_game_stc || 0,
        weekly_salary_stc: weekly_salary_stc || 0,
        signing_bonus_stc: signing_bonus_stc || 0,
        transfer_fee_stc: transfer_fee_stc || 0,
        performance_targets: performance_targets || [],
        captaincy_offered: captaincy_offered || false,
        negotiation_round: 0,
        last_negotiated_by: actor?.id || "",
      });

      await addHistory(base44, contract.id, "offered", actor?.id,
        `${meta.label} contract offered to ${target.gamertag}.`);

      // Build financial summary for inbox body
      const financialLines = [];
      if (weekly_salary_stc > 0) financialLines.push(`• Weekly Salary: ${weekly_salary_stc.toLocaleString()} STC`);
      if (signing_bonus_stc > 0) financialLines.push(`• Signing Bonus: ${signing_bonus_stc.toLocaleString()} STC`);
      if (transfer_fee_stc > 0) financialLines.push(`• Transfer Fee: ${transfer_fee_stc.toLocaleString()} STC`);
      if (captaincy_offered) financialLines.push(`• ⭐ Captaincy role offered`);
      if (performance_targets?.length > 0) financialLines.push(`• ${performance_targets.length} performance target(s) included`);

      const inboxBody = [
        `${club?.name || "A club"} is offering you a ${meta.label} contract.`,
        ``,
        `📋 Contract Details:`,
        `• Type: ${meta.label}`,
        `• Duration: up to ${meta.max_games} games or ${meta.max_days} days`,
        ...(financialLines.length > 0 ? [``, `💰 Financial Terms:`, ...financialLines] : []),
        ...(offer_note ? [``, `💬 Message from club:`, `"${offer_note}"`] : []),
        ``,
        `You can Accept, Decline, or send a Counter-Offer below.`,
      ].join("\n");

      // Send InboxMessage so player can act on it
      await sendContractInbox(base44, {
        recipientEmail: target.email,
        senderGamertag: actor?.gamertag || club?.name || "Club",
        senderAvatarUrl: actor?.avatar_url || null,
        senderClubName: club?.name || null,
        subject: `Contract Offer from ${club?.name || "a club"} — ${meta.label}`,
        body: inboxBody,
        contractId: contract.id,
        round: 0,
      });

      // Also send bell notification
      await notify(base44, target.email, "invite",
        `Contract offer from ${club?.name || "a club"}`,
        `${club?.name || "A club"} sent you a ${meta.label} contract offer. Open your Inbox to respond.`,
        `/inbox`
      );

      // ── NEWS: contract offer (initial offers only, not renegotiations) ──
      const tierRank = CONTRACT_TIER_RANK[contract_type] || 0;
      const totalValue = (weekly_salary_stc || 0) + (signing_bonus_stc || 0);
      if (tierRank >= 2 || totalValue >= HIGH_VALUE_TRANSFER_THRESHOLD) {
        await createNews(base44, {
          type: "contract",
          category: "contracts",
          title: `${club?.name || "A club"} submits offer to ${target.gamertag}`,
          body: `${club?.name || "A club"} has submitted a ${meta.label} contract offer to ${target.gamertag}.${totalValue >= HIGH_VALUE_TRANSFER_THRESHOLD ? ` The deal is reported to be worth ${totalValue.toLocaleString()} STC.` : ""}`,
          club_id: club?.id,
          club_name: club?.name,
          club_logo_url: club?.logo_url || null,
          player_id: target.id,
          player_name: target.gamertag,
          player_avatar_url: target.avatar_url || null,
          is_featured: tierRank >= 3,
          is_global: tierRank >= 4,
          link: `/clubs/${contract.team_id}`,
          tags: ["contract", "offer", meta.label.toLowerCase().replace(/ /g, "_")],
          visible_to_club_ids: [contract.team_id],
          visible_to_player_ids: [target.id],
        });
      }

      return Response.json({ success: true, contract });
    }

    // ── ACCEPT ───────────────────────────────────────────────────────────────
    if (action === "accept") {
      if (!contract_id) return Response.json({ error: "Missing contract_id" }, { status: 400 });

      const contractArr = await base44.asServiceRole.entities.PlayerContract.filter({ id: contract_id });
      const contract = contractArr[0];
      if (!contract) return Response.json({ error: "Contract not found" }, { status: 404 });
      if (!["pending", "negotiating"].includes(contract.status)) {
        return Response.json({ error: `Cannot accept a contract with status: ${contract.status}` }, { status: 400 });
      }

      const actingArr = await base44.entities.Player.filter({ email: user.email });
      const actor = actingArr[0];
      if (user.role !== "admin" && actor?.id !== contract.user_id) {
        return Response.json({ error: "Forbidden: only the player can accept their own contract" }, { status: 403 });
      }

      const openWindows = await base44.asServiceRole.entities.TransferWindow.filter({ status: "open" });
      const windowOpen = openWindows.length > 0;
      const clubArr = await base44.asServiceRole.entities.Club.filter({ id: contract.team_id });
      const club = clubArr[0];

      let updated;
      if (windowOpen) {
        const today = new Date().toISOString().split("T")[0];
        const endDate = new Date(Date.now() + contract.max_days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        updated = await base44.asServiceRole.entities.PlayerContract.update(contract_id, {
          status: "active", start_date: today, end_date: endDate,
          transfer_window_id: openWindows[0].id,
        });
        await base44.asServiceRole.entities.Player.update(contract.user_id, { club_id: contract.team_id, status: "active" });

        if (contract.signing_bonus_stc > 0) {
          const playerArr = await base44.asServiceRole.entities.Player.filter({ id: contract.user_id });
          const p = playerArr[0];
          if (p) {
            await base44.asServiceRole.entities.Player.update(p.id, { stc: (p.stc || 0) + contract.signing_bonus_stc });
            await base44.asServiceRole.entities.STCTransaction.create({
              player_id: p.id, player_email: p.email, club_id: contract.team_id,
              amount: contract.signing_bonus_stc, type: "signing_bonus",
              description: `Signing bonus from ${club?.name || "club"}`, reference_id: contract_id,
            });
            // Club expense (negative transaction)
            if (club) {
              await base44.asServiceRole.entities.STCTransaction.create({
                club_id: contract.team_id,
                amount: -contract.signing_bonus_stc, type: "signing_bonus",
                description: `Signing bonus paid to ${p.gamertag}`, reference_id: contract_id,
              });
              await base44.asServiceRole.entities.Club.update(contract.team_id, { stc: (club.stc || 0) - contract.signing_bonus_stc });
            }
          }
        }

        await addHistory(base44, contract_id, "accepted", actor?.id,
          `Contract accepted and activated immediately (transfer window open).`);

        // Notify club owner via InboxMessage
        if (club?.owner_email) {
          await base44.asServiceRole.entities.InboxMessage.create({
            recipient_email: club.owner_email,
            sender_gamertag: actor?.gamertag || "Player",
            sender_avatar_url: actor?.avatar_url || null,
            sender_club_name: null,
            is_system: true,
            subject: `✅ ${actor?.gamertag || "Player"} accepted your contract offer`,
            body: `${actor?.gamertag || "A player"} has accepted the ${CONTRACT_META[contract.contract_type]?.label || ""} contract and is now an active squad member.\n\nThey have been added to your club immediately (transfer window is open).`,
            message_type: "contract_offer",
            action_type: "none",
            status: "accepted",
            is_read: false,
            related_entity_id: contract.team_id,
            related_entity_type: "club",
            metadata: { contract_id },
          });
          await notify(base44, club.owner_email, "contract_accepted",
            `${actor?.gamertag || "Player"} accepted your contract offer`,
            `They are now active in your squad.`,
            `/clubs/${contract.team_id}`
          );
        }
      } else {
        updated = await base44.asServiceRole.entities.PlayerContract.update(contract_id, { status: "pending_window" });
        await addHistory(base44, contract_id, "accepted", actor?.id,
          `Contract accepted. Awaiting transfer window to execute.`);

        if (club?.owner_email) {
          await base44.asServiceRole.entities.InboxMessage.create({
            recipient_email: club.owner_email,
            sender_gamertag: actor?.gamertag || "Player",
            sender_avatar_url: actor?.avatar_url || null,
            is_system: true,
            subject: `✅ ${actor?.gamertag || "Player"} accepted — pending transfer window`,
            body: `${actor?.gamertag || "A player"} accepted your ${CONTRACT_META[contract.contract_type]?.label || ""} contract offer.\n\nThe transfer window is currently closed. They will be officially added to your squad when the next window opens.`,
            message_type: "contract_offer",
            action_type: "none",
            status: "accepted",
            is_read: false,
            related_entity_id: contract.team_id,
            related_entity_type: "club",
            metadata: { contract_id },
          });
          await notify(base44, club.owner_email, "contract_accepted",
            `${actor?.gamertag || "Player"} accepted (pending transfer window)`,
            `Transfer will execute when the next window opens.`,
            `/clubs/${contract.team_id}`
          );
        }
      }

      // ── NEWS: contract accepted / transfer completed ──
      const acceptedMeta = CONTRACT_META[contract.contract_type];
      const acceptTierRank = CONTRACT_TIER_RANK[contract.contract_type] || 0;
      const isMajorSigning = (contract.transfer_fee_stc || 0) >= HIGH_VALUE_TRANSFER_THRESHOLD || acceptTierRank >= 3;
      const isTransfer = (contract.transfer_fee_stc || 0) > 0;

      if (acceptTierRank >= 2 || isMajorSigning) {
        const newsTitle = isTransfer && isMajorSigning
          ? `${actor?.gamertag || "Player"} completes transfer to ${club?.name || "club"}`
          : isMajorSigning
          ? `${actor?.gamertag || "Player"} signs for ${club?.name || "club"}`
          : `${actor?.gamertag || "Player"} joins ${club?.name || "club"}`;
        const newsBody = [
          `${actor?.gamertag || "A player"} has signed a ${acceptedMeta?.label || ""} contract with ${club?.name || "the club"}.`,
          windowOpen ? "The deal has been officially confirmed." : "The transfer will be completed when the next window opens.",
          isTransfer ? `Transfer fee: ${(contract.transfer_fee_stc || 0).toLocaleString()} STC.` : "",
          (contract.signing_bonus_stc || 0) > 0 ? `Signing bonus: ${(contract.signing_bonus_stc || 0).toLocaleString()} STC.` : "",
        ].filter(Boolean).join(" ");

        await createNews(base44, {
          type: isTransfer ? "transfer" : "contract",
          category: isTransfer ? "transfers" : "contracts",
          title: newsTitle,
          body: newsBody,
          club_id: club?.id,
          club_name: club?.name,
          club_logo_url: club?.logo_url || null,
          player_id: actor?.id,
          player_name: actor?.gamertag,
          player_avatar_url: actor?.avatar_url || null,
          is_featured: isMajorSigning,
          is_global: isMajorSigning,
          link: `/clubs/${contract.team_id}`,
          tags: ["contract", isTransfer ? "transfer" : "signing", "confirmed"],
          visible_to_club_ids: [contract.team_id],
          visible_to_player_ids: [actor?.id].filter(Boolean),
          transfer_fee_stc: contract.transfer_fee_stc || 0,
        });
      }

      return Response.json({ success: true, contract: updated, window_open: windowOpen });
    }

    // ── REJECT ───────────────────────────────────────────────────────────────
    if (action === "reject") {
      if (!contract_id) return Response.json({ error: "Missing contract_id" }, { status: 400 });

      const contractArr = await base44.asServiceRole.entities.PlayerContract.filter({ id: contract_id });
      const contract = contractArr[0];
      if (!contract) return Response.json({ error: "Contract not found" }, { status: 404 });
      if (!["pending", "negotiating"].includes(contract.status)) {
        return Response.json({ error: `Cannot reject a contract with status: ${contract.status}` }, { status: 400 });
      }

      const actingArr = await base44.entities.Player.filter({ email: user.email });
      const actor = actingArr[0];
      if (user.role !== "admin" && actor?.id !== contract.user_id) {
        return Response.json({ error: "Forbidden: only the player can reject their own contract" }, { status: 403 });
      }

      await base44.asServiceRole.entities.PlayerContract.update(contract_id, { status: "rejected" });
      await addHistory(base44, contract_id, "rejected", actor?.id, "Contract offer rejected by player.");

      const clubArr = await base44.asServiceRole.entities.Club.filter({ id: contract.team_id });
      const club = clubArr[0];
      if (club?.owner_email) {
        await base44.asServiceRole.entities.InboxMessage.create({
          recipient_email: club.owner_email,
          sender_gamertag: actor?.gamertag || "Player",
          sender_avatar_url: actor?.avatar_url || null,
          is_system: true,
          subject: `❌ ${actor?.gamertag || "Player"} declined your contract offer`,
          body: `${actor?.gamertag || "A player"} declined the ${CONTRACT_META[contract.contract_type]?.label || ""} contract offer.\n\nYou can send a new offer with different terms from the Transfers page.`,
          message_type: "general",
          action_type: "none",
          status: "pending",
          is_read: false,
          related_entity_id: contract.team_id,
          related_entity_type: "club",
          metadata: { contract_id },
        });
        await notify(base44, club.owner_email, "contract_rejected",
          `${actor?.gamertag || "Player"} declined your offer`,
          `Your ${CONTRACT_META[contract.contract_type]?.label || ""} contract was declined.`,
          `/clubs/${contract.team_id}`
        );
      }

      // ── NEWS: rejection (only for high-profile deals) ──
      const rejectedMeta = CONTRACT_META[contract.contract_type];
      const rejectTierRank = CONTRACT_TIER_RANK[contract.contract_type] || 0;
      if (rejectTierRank >= 3) {
        await createNews(base44, {
          type: "contract",
          category: "contracts",
          title: `${actor?.gamertag || "Player"} rejects ${club?.name || "club"} offer`,
          body: `${actor?.gamertag || "A player"} has turned down a ${rejectedMeta?.label || ""} contract offer from ${club?.name || "the club"}.`,
          club_id: club?.id,
          club_name: club?.name,
          club_logo_url: club?.logo_url || null,
          player_id: actor?.id,
          player_name: actor?.gamertag,
          player_avatar_url: actor?.avatar_url || null,
          is_featured: false,
          is_global: false,
          link: `/clubs/${contract.team_id}`,
          tags: ["contract", "rejected"],
          visible_to_club_ids: [contract.team_id],
          visible_to_player_ids: [actor?.id].filter(Boolean),
        });
      }

      return Response.json({ success: true });
    }

    // ── NEGOTIATE ────────────────────────────────────────────────────────────
    if (action === "negotiate") {
      if (!contract_id) return Response.json({ error: "Missing contract_id" }, { status: 400 });

      const contractArr = await base44.asServiceRole.entities.PlayerContract.filter({ id: contract_id });
      const contract = contractArr[0];
      if (!contract) return Response.json({ error: "Contract not found" }, { status: 404 });
      if (!["pending", "negotiating"].includes(contract.status)) {
        return Response.json({ error: `Cannot negotiate a contract with status: ${contract.status}` }, { status: 400 });
      }

      const actingArr = await base44.entities.Player.filter({ email: user.email });
      const actor = actingArr[0];

      const isPlayer = actor?.id === contract.user_id;
      const { allowed: isClub, club } = await isClubManagement(base44, user, contract.team_id);
      if (!isPlayer && !isClub && user.role !== "admin") {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      const newRound = (contract.negotiation_round || 0) + 1;
      const updateData = {
        status: "negotiating",
        negotiation_round: newRound,
        last_negotiated_by: actor?.id || user.email,
        offer_note: offer_note !== undefined ? offer_note : contract.offer_note,
      };
      if (weekly_salary_stc !== undefined) updateData.weekly_salary_stc = weekly_salary_stc;
      if (salary_per_game_stc !== undefined) updateData.salary_per_game_stc = salary_per_game_stc;
      if (signing_bonus_stc !== undefined) updateData.signing_bonus_stc = signing_bonus_stc;
      if (transfer_fee_stc !== undefined) updateData.transfer_fee_stc = transfer_fee_stc;
      if (performance_targets !== undefined) updateData.performance_targets = performance_targets;
      if (captaincy_offered !== undefined) updateData.captaincy_offered = captaincy_offered;

      const updated = await base44.asServiceRole.entities.PlayerContract.update(contract_id, updateData);
      await addHistory(base44, contract_id, "negotiated", actor?.id,
        `Counter-offer round ${newRound}: ${offer_note || "Terms updated"}`);

      const meta = CONTRACT_META[contract.contract_type];

      // Build financial summary lines for the counter-offer inbox message
      const financialLines = [];
      if (updateData.weekly_salary_stc > 0) financialLines.push(`• Weekly Salary: ${updateData.weekly_salary_stc.toLocaleString()} STC`);
      if (updateData.signing_bonus_stc > 0) financialLines.push(`• Signing Bonus: ${updateData.signing_bonus_stc.toLocaleString()} STC`);
      if (updateData.transfer_fee_stc > 0) financialLines.push(`• Transfer Fee: ${updateData.transfer_fee_stc.toLocaleString()} STC`);

      if (isPlayer) {
        // Player → Club
        const clubArr = await base44.asServiceRole.entities.Club.filter({ id: contract.team_id });
        const clubData = clubArr[0];
        const inboxBody = [
          `${actor?.gamertag || "The player"} has sent a counter-offer on their ${meta?.label || ""} contract (Round ${newRound}).`,
          ...(financialLines.length > 0 ? [``, `💰 Proposed Terms:`, ...financialLines] : []),
          ...(offer_note ? [``, `💬 Player's message:`, `"${offer_note}"`] : []),
          ``,
          `Open the Contracts tab in your club to respond, or manage it from the Transfer Market.`,
        ].join("\n");

        if (clubData?.owner_email) {
          await sendContractInbox(base44, {
            recipientEmail: clubData.owner_email,
            senderGamertag: actor?.gamertag || "Player",
            senderAvatarUrl: actor?.avatar_url || null,
            senderClubName: null,
            subject: `Counter-offer from ${actor?.gamertag || "Player"} — Round ${newRound}`,
            body: inboxBody,
            contractId: contract_id,
            round: newRound,
          });
          await notify(base44, clubData.owner_email, "invite",
            `${actor?.gamertag || "Player"} sent a counter-offer`,
            `Round ${newRound} — check your Inbox to respond.`,
            `/inbox`
          );
        }
      } else {
        // Club → Player
        const targetArr = await base44.asServiceRole.entities.Player.filter({ id: contract.user_id });
        const target = targetArr[0];
        const clubArr = await base44.asServiceRole.entities.Club.filter({ id: contract.team_id });
        const clubData = clubArr[0];
        const inboxBody = [
          `${clubData?.name || "The club"} updated the contract terms (Round ${newRound}).`,
          ...(financialLines.length > 0 ? [``, `💰 New Terms Offered:`, ...financialLines] : []),
          ...(offer_note ? [``, `💬 Club's message:`, `"${offer_note}"`] : []),
          ``,
          `Open your Inbox to Accept, Decline, or send another Counter-Offer.`,
        ].join("\n");

        await sendContractInbox(base44, {
          recipientEmail: target?.email,
          senderGamertag: actor?.gamertag || clubData?.name || "Club",
          senderAvatarUrl: actor?.avatar_url || null,
          senderClubName: clubData?.name || null,
          subject: `Updated contract offer from ${clubData?.name || "the club"} — Round ${newRound}`,
          body: inboxBody,
          contractId: contract_id,
          round: newRound,
        });
        await notify(base44, target?.email, "invite",
          `New offer from ${clubData?.name || "the club"}`,
          `Round ${newRound} — check your Inbox to respond.`,
          `/inbox`
        );
      }

      return Response.json({ success: true, contract: updated });
    }

    // ── TERMINATE ────────────────────────────────────────────────────────────
    if (action === "terminate") {
      if (!contract_id) return Response.json({ error: "Missing contract_id" }, { status: 400 });

      const contractArr = await base44.asServiceRole.entities.PlayerContract.filter({ id: contract_id });
      const contract = contractArr[0];
      if (!contract) return Response.json({ error: "Contract not found" }, { status: 404 });
      if (contract.status !== "active") {
        return Response.json({ error: `Cannot terminate a contract with status: ${contract.status}` }, { status: 400 });
      }

      const { allowed, actor, club } = await isClubManagement(base44, user, contract.team_id);
      if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });

      await base44.asServiceRole.entities.PlayerContract.update(contract_id, { status: "terminated" });
      await addHistory(base44, contract_id, "terminated", actor?.id,
        `Contract terminated by ${actor?.gamertag || user.email}.`);

      const targetArr = await base44.asServiceRole.entities.Player.filter({ id: contract.user_id });
      const target = targetArr[0];
      await notify(base44, target?.email, "invite",
        "Contract terminated",
        `Your ${CONTRACT_META[contract.contract_type]?.label || ""} contract with ${club?.name || "the club"} has been terminated.`,
        `/players/${target?.id}`
      );

      return Response.json({ success: true });
    }

    // ── RENEW ────────────────────────────────────────────────────────────────
    if (action === "renew") {
      if (!contract_id || !contract_type) {
        return Response.json({ error: "Missing contract_id or contract_type" }, { status: 400 });
      }
      const meta = CONTRACT_META[contract_type];
      if (!meta) return Response.json({ error: "Invalid contract_type" }, { status: 400 });

      const contractArr = await base44.asServiceRole.entities.PlayerContract.filter({ id: contract_id });
      const oldContract = contractArr[0];
      if (!oldContract) return Response.json({ error: "Contract not found" }, { status: 404 });

      const renewableStatuses = ["active", "completed", "expired"];
      if (!renewableStatuses.includes(oldContract.status)) {
        return Response.json({ error: `Cannot renew a contract with status: ${oldContract.status}` }, { status: 400 });
      }

      const { allowed, actor, club } = await isClubManagement(base44, user, oldContract.team_id);
      if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });

      const existing = await base44.asServiceRole.entities.PlayerContract.filter({
        team_id: oldContract.team_id, user_id: oldContract.user_id,
      });
      const conflict = existing.find(c => c.id !== contract_id && (c.status === "active" || c.status === "pending"));
      if (conflict) {
        return Response.json({ error: "Player already has an active or pending contract." }, { status: 409 });
      }

      const targetArr = await base44.asServiceRole.entities.Player.filter({ id: oldContract.user_id });
      const target = targetArr[0];

      const newContract = await base44.asServiceRole.entities.PlayerContract.create({
        team_id: oldContract.team_id,
        user_id: oldContract.user_id,
        offered_by: actor?.id || "",
        contract_type,
        max_games: meta.max_games,
        max_days: meta.max_days,
        games_played: 0,
        status: "pending",
        offer_note: offer_note || "",
        weekly_salary_stc: weekly_salary_stc || 0,
        signing_bonus_stc: signing_bonus_stc || 0,
        performance_targets: performance_targets || [],
        negotiation_round: 0,
        last_negotiated_by: actor?.id || "",
      });

      await addHistory(base44, newContract.id, "offered", actor?.id,
        `Renewal: ${meta.label} contract offered to ${target?.gamertag || "player"}.`);
      await addHistory(base44, contract_id, "renewed", actor?.id,
        `Contract renewed with a new ${meta.label} contract.`);

      await sendContractInbox(base44, {
        recipientEmail: target?.email,
        senderGamertag: actor?.gamertag || club?.name || "Club",
        senderAvatarUrl: actor?.avatar_url || null,
        senderClubName: club?.name || null,
        subject: `Contract Renewal from ${club?.name || "your club"} — ${meta.label}`,
        body: `${club?.name || "Your club"} is offering a contract renewal.\n\n📋 Type: ${meta.label}\n• Duration: up to ${meta.max_games} games or ${meta.max_days} days${offer_note ? `\n\n💬 "${offer_note}"` : ""}\n\nOpen your Inbox to Accept, Decline, or Counter-Offer.`,
        contractId: newContract.id,
        round: 0,
      });

      await notify(base44, target?.email, "invite",
        `Contract renewal from ${club?.name || "your club"}`,
        `Open your Inbox to respond.`,
        `/inbox`
      );

      return Response.json({ success: true, contract: newContract });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});