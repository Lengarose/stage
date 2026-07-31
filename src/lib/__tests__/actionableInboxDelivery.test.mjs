import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const srcRoot = path.resolve(import.meta.dirname, "../..");

const ACTIONABLE_MESSAGE_SOURCES = [
  "lib/contractOfferDelivery.js",
  "components/schedule/ArrangeGameDialog.jsx",
  "lib/scheduleEngine.js",
  "pages/ClubDetail.jsx",
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
