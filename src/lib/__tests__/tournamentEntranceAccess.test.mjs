import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { shouldApplyTournamentEntranceAccess } from "../tournamentEntranceAccess.js";

const root = resolve(import.meta.dirname, "../../..");

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

test("tournament entrance links apply limited access to free player accounts", () => {
  assert.equal(shouldApplyTournamentEntranceAccess({ role_id: 1, subscription: "free" }), true);
  assert.equal(shouldApplyTournamentEntranceAccess({ role_id: 1, subscription: null }), true);
});

test("tournament entrance links do not downgrade admins or Stage Plus accounts", () => {
  assert.equal(shouldApplyTournamentEntranceAccess({ role_id: 0, subscription: "free" }), false);
  assert.equal(shouldApplyTournamentEntranceAccess({ role_id: 1, subscription: "stage_plus" }), false);
  assert.equal(shouldApplyTournamentEntranceAccess({ role: "admin", subscription: null }), false);
  assert.equal(shouldApplyTournamentEntranceAccess({
    role_id: 1,
    subscription: "stage_plus",
    subscription_expires_at: "2099-01-01T00:00:00.000Z",
  }), false);
});

test("tournament entrance links treat expired Stage Plus as free", () => {
  assert.equal(shouldApplyTournamentEntranceAccess({
    role_id: 1,
    subscription: "stage_plus",
    subscription_expires_at: "2020-01-01T00:00:00.000Z",
  }), true);
});

test("only test entrance links claim the tester grant", async () => {
  const { isTestEntranceLink, claimTournamentTestGrantIfNeeded } = await import("../tournamentEntranceAccess.js");
  assert.equal(isTestEntranceLink({ link_kind: "test" }), true);
  assert.equal(isTestEntranceLink({ link_kind: "standard" }), false);
  assert.equal(isTestEntranceLink({}), false);

  const calls = [];
  const client = { functions: { invoke: async (name, body) => { calls.push({ name, body }); return { data: { granted: true } }; } } };
  await claimTournamentTestGrantIfNeeded(client, { token: "abc", link: { link_kind: "standard" } });
  assert.equal(calls.length, 0);
  await claimTournamentTestGrantIfNeeded(client, { token: "abc", link: { link_kind: "test" } });
  assert.deepEqual(calls, [{ name: "claimTournamentTestGrant", body: { token: "abc" } }]);
});

test("entrance auth claims tester credits only through the dedicated grant function", () => {
  const card = read("src/pages/tournament-entrance/EntranceAuthCard.jsx");
  const app = read("src/App.jsx");
  assert.match(card, /finishTournamentEntranceSession/);
  assert.match(app, /finishTournamentEntranceSession/);
  assert.doesNotMatch(card, /navigate\("\/", \{ replace: true \}\)/);
  assert.doesNotMatch(card, /addUserCredits|starter_credits/);
});

test("test entrance login opens that tournament and keeps normal access", async () => {
  const { finishTournamentEntranceSession, readEntranceTournament, clearEntranceTournament } = await import("../tournamentEntranceAccess.js");
  const calls = [];
  const client = {
    functions: {
      invoke: async (name, body) => {
        calls.push({ name, body });
        return { data: { granted: true } };
      },
    },
  };
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };

  const path = await finishTournamentEntranceSession(client, {
    user: { id: "user-1", role_id: 1, subscription: "free", access_mode: "tournament_limited" },
    tournamentId: "tourney test/1",
    token: "test-token",
    link: { link_kind: "test" },
  });

  assert.equal(path, "/tournaments/tourney%20test%2F1");
  assert.equal(readEntranceTournament(), "tourney test/1");
  assert.deepEqual(calls.map((call) => call.name), [
    "clearTournamentLimitedAccess",
    "claimTournamentTestGrant",
  ]);
  clearEntranceTournament();
  delete globalThis.sessionStorage;
});

test("standard entrance login still scopes free accounts and opens the tournament", async () => {
  const { finishTournamentEntranceSession } = await import("../tournamentEntranceAccess.js");
  const calls = [];
  const client = {
    functions: {
      invoke: async (name, body) => {
        calls.push({ name, body });
        return { data: {} };
      },
    },
  };

  const path = await finishTournamentEntranceSession(client, {
    user: { id: "user-1", role_id: 1, subscription: "free" },
    tournamentId: "tournament-1",
    token: "standard-token",
    link: { link_kind: "standard" },
  });

  assert.equal(path, "/tournaments/tournament-1");
  assert.deepEqual(calls, [{
    name: "applyTournamentEntranceAccessMode",
    body: { tournament_id: "tournament-1" },
  }]);
});

test("tournament-limited users can open the existing Wallet page", () => {
  const guard = read("src/components/TournamentEntranceRouteGuard.jsx");
  const layout = read("src/components/Layout.jsx");

  assert.match(guard, /pathname === "\/wallet"/);
  assert.match(layout, /\{ path: "\/wallet",\s+icon: Zap,\s+label: t\("nav\.wallet"\) \}/);
});
