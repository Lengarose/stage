import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createInboxEventId } from "../inboxEventId.js";

const srcRoot = path.resolve(import.meta.dirname, "../..");

const invokeCalls = [];

function resetInboxMocks() {
  invokeCalls.length = 0;
}

const stageClientMock = {
  entities: {
    Player: {
      filter: async () => [
        { email: "away.manager@example.com", club_roles: ["manager"] },
      ],
    },
    RegionalLeagueFixture: {
      update: async () => ({}),
    },
    CompetitionFixture: {
      update: async () => ({}),
    },
    InboxMessage: {
      filter: async () => [],
      update: async () => ({}),
    },
    Match: {
      get: async () => null,
      filter: async () => [],
      create: async () => ({ id: "match-1", status: "scheduled" }),
    },
    Notification: {
      create: async () => ({}),
    },
  },
  functions: {
    invoke: async (name, payload) => {
      invokeCalls.push({ name, payload });
      if (name === "createMatchFromLeagueFixture") {
        return { match: { id: "match-1", status: "scheduled" } };
      }
      return { ok: true };
    },
  },
};

globalThis.__stageClientMock = stageClientMock;

const STAGE_CLIENT_MOCK_URL = "data:text/javascript," + encodeURIComponent(
  "export const stageClient = globalThis.__stageClientMock;\n"
);

function resolveSrcAlias(relativeFromSrc) {
  const base = path.join(srcRoot, relativeFromSrc);
  if (existsSync(base)) return base;
  for (const ext of [".js", ".jsx", ".mjs"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  return `${base}.js`;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/api/stageClient") {
      return { url: STAGE_CLIENT_MOCK_URL, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      return { url: pathToFileURL(resolveSrcAlias(specifier.slice(2))).href, shortCircuit: true };
    }
    if (specifier.startsWith(".") && context.parentURL) {
      const resolved = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
      if (!existsSync(resolved)) {
        for (const ext of [".js", ".jsx", ".mjs"]) {
          if (existsSync(resolved + ext)) {
            return { url: pathToFileURL(resolved + ext).href, shortCircuit: true };
          }
        }
      }
    }
    return nextResolve(specifier, context);
  },
});

const ACTIONABLE_MESSAGE_SOURCES = [
  "lib/contractOfferDelivery.js",
  "components/schedule/ArrangeGameDialog.jsx",
  "lib/scheduleEngine.js",
  "components/inbox/InboxTrialRequest.jsx",
];

test("actionable inbox flows use the central sendInboxMessage function", async () => {
  for (const relativePath of ACTIONABLE_MESSAGE_SOURCES) {
    const source = await readFile(path.join(srcRoot, relativePath), "utf8");

    assert.equal(
      source.includes("stageClient.entities.InboxMessage.create"),
      false,
      `${relativePath} must not create inbox rows directly`
    );
    assert.match(
      source,
      /stageClient\.functions\.invoke\(["']sendInboxMessage["']/,
      `${relativePath} should route actionable inbox delivery through sendInboxMessage`
    );
  }
});

test("contract offer actions persist the inbox message response status", async () => {
  const source = await readFile(path.join(srcRoot, "components/inbox/InboxContractOffer.jsx"), "utf8");

  assert.match(
    source,
    /stageClient\.entities\.InboxMessage\.update\(message\.id/,
    "InboxContractOffer should update the inbox message after accept/decline"
  );
});

const CLICK_EVENT_ID_SOURCES = [
  "components/schedule/ArrangeGameDialog.jsx",
  "lib/scheduleEngine.js",
  "pages/TournamentDetail.jsx",
];

test("actionable inbox sends pass event_id so each click is a new mail", async () => {
  for (const relativePath of CLICK_EVENT_ID_SOURCES) {
    const source = await readFile(path.join(srcRoot, relativePath), "utf8");
    assert.match(source, /createInboxEventId/, `${relativePath} must generate event_id`);
    assert.match(
      source,
      /event_id/,
      `${relativePath} must send event_id to sendInboxMessage`
    );
    assert.match(
      source,
      /const event_id = createInboxEventId\(\);\s*(?:return |await )?stageClient\.functions\.invoke\(["']sendInboxMessage["']/,
      `${relativePath} must create event_id immediately before sendInboxMessage`
    );
    assert.match(
      source,
      /invoke\(["']sendInboxMessage["'],\s*\{[\s\S]*?\bevent_id\b/,
      `${relativePath} must include event_id inside the sendInboxMessage payload`
    );
  }

  const contractSource = await readFile(path.join(srcRoot, "lib/contractOfferDelivery.js"), "utf8");
  assert.match(contractSource, /event_id:/, "contractOfferDelivery must send event_id");
  assert.match(contractSource, /contract:\$\{/, "contractOfferDelivery must use a contract-round event_id");
});

test("createInboxEventId returns a unique id per call", () => {
  const ids = Array.from({ length: 8 }, () => createInboxEventId());
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) {
    assert.equal(typeof id, "string");
    assert.ok(id.length > 0);
  }
});

function inboxEventIds() {
  return invokeCalls
    .filter((call) => call.name === "sendInboxMessage")
    .map((call) => call.payload.event_id);
}

function leagueFixture(overrides = {}) {
  return {
    id: "fx-1",
    home_club_id: "club-home",
    away_club_id: "club-away",
    home_club_name: "Home FC",
    away_club_name: "Away FC",
    league_name: "Test League",
    division: 1,
    matchday: 1,
    proposal_count: 0,
    window_end: "2026-09-20T00:00:00.000Z",
    home_proposed_date: "2026-09-15T18:00:00.000Z",
    scheduling_status: "home_proposed",
    ...overrides,
  };
}

test("scheduleEngine sends a distinct event_id on each sendInboxMessage invoke", async () => {
  const { proposeTime, acceptProposal, declineProposal } = await import("../scheduleEngine.js");
  const fixture = leagueFixture();
  const club = { id: "club-home", name: "Home FC", logo_url: "" };

  resetInboxMocks();
  await proposeTime({
    fixture,
    fixtureType: "regional_league",
    role: "home",
    proposedDate: "2026-09-15T18:00:00.000Z",
    myClub: club,
    myEmail: "home@example.com",
    myGamertag: "HomeCaptain",
  });
  await proposeTime({
    fixture,
    fixtureType: "regional_league",
    role: "home",
    proposedDate: "2026-09-16T18:00:00.000Z",
    myClub: club,
    myEmail: "home@example.com",
    myGamertag: "HomeCaptain",
  });
  const proposedIds = inboxEventIds();
  assert.equal(proposedIds.length, 2);
  assert.notEqual(proposedIds[0], proposedIds[1]);

  resetInboxMocks();
  await acceptProposal({
    fixture,
    fixtureType: "regional_league",
    role: "away",
    myClub: { id: "club-away", name: "Away FC" },
    myEmail: "away@example.com",
  });
  await acceptProposal({
    fixture,
    fixtureType: "regional_league",
    role: "away",
    myClub: { id: "club-away", name: "Away FC" },
    myEmail: "away@example.com",
  });
  const acceptedIds = inboxEventIds();
  assert.equal(acceptedIds.length, 2);
  assert.notEqual(acceptedIds[0], acceptedIds[1]);

  resetInboxMocks();
  await declineProposal({
    fixture,
    fixtureType: "regional_league",
    role: "away",
    myClub: { id: "club-away", name: "Away FC" },
    myEmail: "away@example.com",
  });
  await declineProposal({
    fixture,
    fixtureType: "regional_league",
    role: "away",
    myClub: { id: "club-away", name: "Away FC" },
    myEmail: "away@example.com",
  });
  const declinedIds = inboxEventIds();
  assert.equal(declinedIds.length, 2);
  assert.notEqual(declinedIds[0], declinedIds[1]);
});

test("ensureContractOfferInbox reuses contract:id:r0 for the same offer round", async () => {
  const { ensureContractOfferInbox } = await import("../contractOfferDelivery.js");
  resetInboxMocks();

  const offer = {
    contractId: "c-99",
    player: { id: "p1", email: "player@example.com" },
    club: { id: "club-1", name: "Test Club", logo_url: "", owner_email: "owner@example.com" },
    contractType: "player",
    maxGames: 10,
    maxDays: 30,
    weeklySalary: 100,
    signingBonus: 0,
  };

  await ensureContractOfferInbox(offer);
  await ensureContractOfferInbox(offer);

  const ids = inboxEventIds();
  assert.deepEqual(ids, ["player_contract:c-99", "player_contract:c-99"]);
});
