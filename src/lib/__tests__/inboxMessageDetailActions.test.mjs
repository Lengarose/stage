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
