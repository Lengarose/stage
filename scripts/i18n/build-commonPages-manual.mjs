#!/usr/bin/env node
/** Builds scripts/i18n/commonPages-manual.json from commonPages-manual-source.mjs,
 * verifying every EN key has both nl and de translations. */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { nl, de } from './commonPages-manual-source.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packsDir = join(__dirname, '..', '..', 'src/translations/packs');
const en = JSON.parse(readFileSync(join(packsDir, 'en.commonPages.json'), 'utf8'));

const enKeys = Object.keys(en);
const missingNl = enKeys.filter((k) => !(k in nl));
const missingDe = enKeys.filter((k) => !(k in de));
const extraNl = Object.keys(nl).filter((k) => !(k in en));
const extraDe = Object.keys(de).filter((k) => !(k in en));

console.log(`EN keys: ${enKeys.length}`);
console.log(`NL keys: ${Object.keys(nl).length} (missing: ${missingNl.length}, extra: ${extraNl.length})`);
console.log(`DE keys: ${Object.keys(de).length} (missing: ${missingDe.length}, extra: ${extraDe.length})`);

if (missingNl.length) console.log('Missing in NL:', missingNl);
if (missingDe.length) console.log('Missing in DE:', missingDe);
if (extraNl.length) console.log('Extra in NL (not in EN):', extraNl);
if (extraDe.length) console.log('Extra in DE (not in EN):', extraDe);

// Placeholder parity check
function placeholders(s) {
  return (String(s).match(/\{[^}]+\}/g) || []).slice().sort();
}
const placeholderIssues = [];
for (const k of enKeys) {
  if (!(k in nl) || !(k in de)) continue;
  const enPh = placeholders(en[k]);
  const nlPh = placeholders(nl[k]);
  const dePh = placeholders(de[k]);
  if (JSON.stringify(enPh) !== JSON.stringify(nlPh)) {
    placeholderIssues.push({ key: k, lang: 'nl', en: en[k], val: nl[k], enPh, gotPh: nlPh });
  }
  if (JSON.stringify(enPh) !== JSON.stringify(dePh)) {
    placeholderIssues.push({ key: k, lang: 'de', en: en[k], val: de[k], enPh, gotPh: dePh });
  }
}
if (placeholderIssues.length) {
  console.log(`\nPlaceholder mismatches: ${placeholderIssues.length}`);
  for (const issue of placeholderIssues) {
    console.log(`  [${issue.lang}] ${issue.key}: EN="${issue.en}" (${JSON.stringify(issue.enPh)}) -> ${issue.lang.toUpperCase()}="${issue.val}" (${JSON.stringify(issue.gotPh)})`);
  }
} else {
  console.log('\nPlaceholder parity: OK');
}

if (missingNl.length === 0 && missingDe.length === 0) {
  // Build output in EN key order for consistency.
  const nlOrdered = {};
  const deOrdered = {};
  for (const k of enKeys) {
    nlOrdered[k] = nl[k];
    deOrdered[k] = de[k];
  }
  const out = { nl: nlOrdered, de: deOrdered };
  const outPath = join(__dirname, 'commonPages-manual.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nWrote ${outPath}`);
  console.log(`Final nl keys: ${Object.keys(nlOrdered).length}, de keys: ${Object.keys(deOrdered).length}`);
} else {
  console.log('\nNOT writing output file — fix missing keys first.');
  process.exitCode = 1;
}
