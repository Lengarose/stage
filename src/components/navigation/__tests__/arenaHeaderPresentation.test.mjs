import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const layout = await readFile(new URL("../../Layout.jsx", import.meta.url), "utf8");
const css = await readFile(new URL("../arenaNavigation.css", import.meta.url), "utf8");

test("desktop arena navigation uses Anton for triggers and portalled menu labels", () => {
  assert.match(css, /\.stage-arena-tab\s*>\s*span\s*\{[^}]*font-family:\s*['\"]Anton['\"],\s*Impact,\s*sans-serif/s);
  assert.match(css, /\.stage-arena-menu\s+\[role=['\"]menuitem['\"]\][\s\S]*?font-family:\s*['\"]Anton['\"],\s*Impact,\s*sans-serif/s);
});

test("open transfer window renders a semantic angular status ticket without changing the status guard", () => {
  assert.match(layout, /transferWindowIndicator\s*\?/);
  assert.match(layout, /stage-arena-transfer-status/);
  assert.match(layout, /stage-arena-transfer-dot/);
  assert.match(layout, /stage-arena-transfer-label/);
  assert.match(layout, /stage-arena-transfer-open/);
  assert.match(css, /\.stage-arena-transfer-status\s*\{[^}]*white-space:\s*nowrap[^}]*clip-path:\s*polygon/s);
  assert.match(css, /#22c55e/i);
  assert.match(css, /#14b8a6/i);
});

test("transfer ticket supports the light header and reduced motion", () => {
  assert.match(css, /\.stage-arena-header-light\s+\.stage-arena-transfer-status/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.stage-arena-transfer-dot[\s\S]*?animation:\s*none/s);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.stage-arena-transfer-status::after[\s\S]*?animation:\s*none/s);
});
