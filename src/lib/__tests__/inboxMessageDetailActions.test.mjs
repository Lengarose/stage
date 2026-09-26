import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const srcRoot = path.resolve(import.meta.dirname, "../..");

test("InboxMessageDetail sends every actionable type through respondInboxMessage", async () => {
  const source = await readFile(path.join(srcRoot, "components/inbox/InboxMessageDetail.jsx"), "utf8");
  assert.match(source, /respondInboxMessage/);
  assert.doesNotMatch(
    source,
    /message_type === "match_invite"\) \{\s*await stageClient.functions.invoke\("respondInboxMessage"/
  );
  assert.doesNotMatch(
    source,
    /InboxMessage\.update\(message\.id,\s*\{\s*status:\s*action/
  );
});

test("Inbox schedule proposals only show response buttons for open pending proposals", async () => {
  const source = await readFile(path.join(srcRoot, "components/inbox/InboxScheduleProposal.jsx"), "utf8");

  assert.match(source, /const canRespond = isActionableProposal/);
  assert.match(source, /safeMessage\.action_type === "schedule_accept_propose"/);
  assert.match(source, /safeMessage\.status === "pending"/);
  assert.match(source, /!fixtureConfirmed/);
  assert.match(source, /&& hasOpenProposal/);
  assert.match(source, /canRespond \? \(/);
});

test("Inbox polling keeps the selected message in sync", async () => {
  const source = await readFile(path.join(srcRoot, "pages/Inbox.jsx"), "utf8");

  assert.match(source, /const nextMessages = latest\.filter\(hasInboxContent\)/);
  assert.match(source, /setSelected\(prev => \{/);
  assert.match(source, /return nextMessages\.find\(m => m\.id === prev\.id\) \|\| prev/);
});
