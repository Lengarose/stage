/**
 * transferWindowActions — admin-only backend for managing the transfer window
 * and executing pending transfers.
 *
 * Actions:
 *   get_current      — get current window state (any user)
 *   open_window      — admin: open a new transfer window (executes pending_window contracts)
 *   close_window     — admin: close the current window
 *   execute_pending  — admin: manually trigger execution of all pending_window contracts
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const CONTRACT_META = {
  trial:     { label: "Trial",            max_games: 5,   max_days: 14  },
  academy:   { label: "Academy",          max_games: 20,  max_days: 30  },
  squad:     { label: "Squad Player",     max_games: 100, max_days: 90  },
  important: { label: "Important Player", max_games: 250, max_days: 120 },
  star:      { label: "Star Player",      max_games: 400, max_days: 180 },
};

async function notify(base44, recipientEmail, type, title, body, link) {
  if (!recipientEmail) return;
  await base44.asServiceRole.entities.Notification.create({
    recipient_email: recipientEmail, type, title, body, link, read: false,
  });
}

/**
 * Execute a single pending_window contract — move player to new club.
 * Returns true if executed, false if skipped (conflict, etc.)
 */
async function executeContract(base44, contract, windowId) {
  // Only execute if player has not already accepted another contract in the meantime
  const allForPlayer = await base44.asServiceRole.entities.PlayerContract.filter({ user_id: contract.user_id });
  const alreadyActive = allForPlayer.find(c => c.id !== contract.id && c.status === "active");
  if (alreadyActive) {
    // Cancel this one — player already transferred elsewhere
    await base44.asServiceRole.entities.PlayerContract.update(contract.id, { status: "terminated" });
    return false;
  }

  const today = new Date().toISOString().split("T")[0];
  const endDate = new Date(Date.now() + contract.max_days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  await base44.asServiceRole.entities.PlayerContract.update(contract.id, {
    status: "active",
    start_date: today,
    end_date: endDate,
    transfer_window_id: windowId,
  });

  // Move player to new club
  const playerArr = await base44.asServiceRole.entities.Player.filter({ id: contract.user_id });
  const player = playerArr[0];
  if (player) {
    await base44.asServiceRole.entities.Player.update(player.id, {
      club_id: contract.team_id,
      role: "member",
      club_roles: ["member"],
      status: "active",
    });

    // Pay signing bonus in STC if applicable
    if (contract.signing_bonus_stc > 0) {
      await base44.asServiceRole.entities.Player.update(player.id, {
        stc: (player.stc || 0) + contract.signing_bonus_stc,
      });
      await base44.asServiceRole.entities.STCTransaction.create({
        player_id: player.id,
        player_email: player.email,
        club_id: contract.team_id,
        amount: contract.signing_bonus_stc,
        type: "signing_bonus",
        description: "Signing bonus on transfer",
        reference_id: contract.id,
      });
    }

    // Notify player
    const clubArr = await base44.asServiceRole.entities.Club.filter({ id: contract.team_id });
    const club = clubArr[0];
    await notify(base44, player.email, "contract_completed",
      "Transfer Completed! 🎉",
      `The transfer window is open. Your ${CONTRACT_META[contract.contract_type]?.label || ""} contract with ${club?.name || "your new club"} is now active.`,
      `/clubs/${contract.team_id}`
    );

    // Notify club owner
    if (club?.owner_email) {
      await notify(base44, club.owner_email, "contract_completed",
        `${player.gamertag} has joined!`,
        `The transfer window opened and ${player.gamertag} is now officially part of your squad.`,
        `/clubs/${contract.team_id}`
      );
    }
  }

  return true;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── GET CURRENT ─────────────────────────────────────────────────────────
    if (action === "get_current") {
      const windows = await base44.asServiceRole.entities.TransferWindow.list("-created_date", 1);
      const current = windows[0] || null;
      return Response.json({ success: true, window: current });
    }

    // Admin-only below
    if (user.role !== "admin") {
      return Response.json({ error: "Forbidden: admin only" }, { status: 403 });
    }

    // ── OPEN WINDOW ─────────────────────────────────────────────────────────
    if (action === "open_window") {
      const { label, start_date, end_date, notes } = body;

      // Close any currently open windows first
      const openWindows = await base44.asServiceRole.entities.TransferWindow.filter({ status: "open" });
      for (const w of openWindows) {
        await base44.asServiceRole.entities.TransferWindow.update(w.id, { status: "closed" });
      }

      // Create new open window
      const newWindow = await base44.asServiceRole.entities.TransferWindow.create({
        status: "open",
        label: label || `Transfer Window ${new Date().getFullYear()}`,
        start_date: start_date || new Date().toISOString(),
        end_date: end_date || null,
        notes: notes || "",
        transfers_executed: 0,
      });

      // Execute all pending_window contracts
      const pendingContracts = await base44.asServiceRole.entities.PlayerContract.filter({ status: "pending_window" });
      let executed = 0;
      for (const contract of pendingContracts) {
        const ok = await executeContract(base44, contract, newWindow.id);
        if (ok) executed++;
      }

      // Update count
      if (executed > 0) {
        await base44.asServiceRole.entities.TransferWindow.update(newWindow.id, { transfers_executed: executed });
      }

      return Response.json({ success: true, window: newWindow, transfers_executed: executed });
    }

    // ── CLOSE WINDOW ────────────────────────────────────────────────────────
    if (action === "close_window") {
      const { window_id } = body;
      const windowArr = await base44.asServiceRole.entities.TransferWindow.filter({ id: window_id });
      const win = windowArr[0];
      if (!win) return Response.json({ error: "Window not found" }, { status: 404 });

      await base44.asServiceRole.entities.TransferWindow.update(window_id, { status: "closed" });
      return Response.json({ success: true });
    }

    // ── EXECUTE PENDING ──────────────────────────────────────────────────────
    if (action === "execute_pending") {
      // Find current open window
      const openWindows = await base44.asServiceRole.entities.TransferWindow.filter({ status: "open" });
      const currentWindow = openWindows[0];
      if (!currentWindow) {
        return Response.json({ error: "No transfer window is currently open" }, { status: 400 });
      }

      const pendingContracts = await base44.asServiceRole.entities.PlayerContract.filter({ status: "pending_window" });
      let executed = 0;
      for (const contract of pendingContracts) {
        const ok = await executeContract(base44, contract, currentWindow.id);
        if (ok) executed++;
      }

      const newTotal = (currentWindow.transfers_executed || 0) + executed;
      await base44.asServiceRole.entities.TransferWindow.update(currentWindow.id, { transfers_executed: newTotal });

      return Response.json({ success: true, transfers_executed: executed });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});