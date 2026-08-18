import assert from "node:assert/strict";
import test from "node:test";
import { isDeviceLocalUri, isPersistableMediaUrl } from "../mediaUrls.js";

test("web media URLs reject local device paths and keep hosted images", () => {
  assert.equal(isDeviceLocalUri("file:///tmp/a.jpg"), true);
  assert.equal(isPersistableMediaUrl("https://stageleagues.com/uploads/a.jpg"), true);
  assert.equal(isPersistableMediaUrl("https://lh3.googleusercontent.com/a/oauth"), true);
  assert.equal(isPersistableMediaUrl("file:///tmp/a.jpg"), false);
  assert.equal(isPersistableMediaUrl("/uploads/a.jpg"), true);
});
