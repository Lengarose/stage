import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { isPendingForfeit } from "../adminForfeitReview.js";

const root = resolve(import.meta.dirname, "../../..");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

test("match API supports forfeit_status filters used by the admin queue", () => {
  const source = read("server/src/server/controllers/matchController.js");

  assert.match(source, /forfeit_status,\s*\n\s*source_fixture_id/);
  assert.match(source, /tournament_id,\s*status,\s*mode,\s*round,\s*type,\s*\n\s*forfeit_status,\s*source_fixture_id/);
});

test("admin forfeit queue hides resolved or claimant-less rows defensively", () => {
  const pending = { forfeit_status: 'pending', forfeit_claimed_by: 'club', status: 'scheduled' };
  assert.equal(isPendingForfeit(pending), true);
  assert.equal(isPendingForfeit({ ...pending, forfeit_claimed_by: null }), false);
  for (const status of ['completed','confirmed','played','forfeit','cancelled','canceled','archived','reset']) assert.equal(isPendingForfeit({ ...pending, status }), false);
  assert.equal(isPendingForfeit({ ...pending, result_state: 'CONFIRMED' }), false);
});
