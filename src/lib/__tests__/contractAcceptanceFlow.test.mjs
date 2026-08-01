import assert from "node:assert/strict";
import test from "node:test";

import { getContractAcceptanceFlow } from "../contractAcceptanceFlow.js";

test("free agents activate accepted contracts immediately when the transfer window is closed", () => {
  const flow = getContractAcceptanceFlow({
    contract: { team_id: "club-zaire" },
    player: { id: "player-cp", club_id: null },
    windowOpen: false,
  });

  assert.equal(flow.action, "accept");
  assert.equal(flow.queuedForTransferWindow, false);
  assert.equal(flow.isClubTransfer, false);
});

test("players moving from another club queue while the transfer window is closed", () => {
  const flow = getContractAcceptanceFlow({
    contract: { team_id: "club-zaire" },
    player: { id: "player-cp", club_id: "club-current" },
    windowOpen: false,
  });

  assert.equal(flow.action, "mark_pending_window");
  assert.equal(flow.queuedForTransferWindow, true);
  assert.equal(flow.isClubTransfer, true);
});

test("renewals activate immediately even when the transfer window is closed", () => {
  const flow = getContractAcceptanceFlow({
    contract: { team_id: "club-zaire" },
    player: { id: "player-cp", club_id: "club-zaire" },
    windowOpen: false,
  });

  assert.equal(flow.action, "accept");
  assert.equal(flow.queuedForTransferWindow, false);
  assert.equal(flow.isRenewal, true);
});

test("club transfers activate immediately when the transfer window is open", () => {
  const flow = getContractAcceptanceFlow({
    contract: { team_id: "club-zaire" },
    player: { id: "player-cp", club_id: "club-current" },
    windowOpen: true,
  });

  assert.equal(flow.action, "accept");
  assert.equal(flow.queuedForTransferWindow, false);
  assert.equal(flow.isClubTransfer, true);
});

test("club transfers wait for the transfer window check before accepting", () => {
  const flow = getContractAcceptanceFlow({
    contract: { team_id: "club-zaire" },
    player: { id: "player-cp", club_id: "club-current" },
    windowOpen: null,
  });

  assert.equal(flow.waitingForWindowCheck, true);
  assert.equal(flow.action, null);
});
