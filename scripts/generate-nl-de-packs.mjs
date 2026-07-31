#!/usr/bin/env node
/**
 * Generates nl/de translation JSON packs from EN source + embedded translations.
 * Run: node scripts/generate-nl-de-packs.mjs
 * Verify: node scripts/verify-nl-de-packs.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { nlDePacks } from './i18n/nl-de-packs-data.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const packsDir = join(root, 'src/translations/packs');

const SECTIONS = [
  'matchFlow',
  'competitionFlow',
  'tournamentDetail',
  'settingsPage',
];

function loadEn(section) {
  const path = join(packsDir, `en.${section}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function buildPack(section, lang) {
  const en = loadEn(section);
  const overrides = nlDePacks[lang]?.[section] ?? {};
  const out = {};
  for (const key of Object.keys(en)) {
    if (overrides[key] !== undefined) {
      out[key] = overrides[key];
    } else {
      console.warn(`[${lang}.${section}] missing translation for key: ${key}`);
      out[key] = en[key];
    }
  }
  return out;
}

mkdirSync(packsDir, { recursive: true });

for (const lang of ['nl', 'de']) {
  for (const section of SECTIONS) {
    const pack = buildPack(section, lang);
    const outPath = join(packsDir, `${lang}.${section}.json`);
    writeFileSync(outPath, JSON.stringify(pack, null, 2) + '\n');
    console.log(`Wrote ${outPath} (${Object.keys(pack).length} keys)`);
  }
}

console.log('Done. Run: node scripts/i18n/generate-commonPages-from-manual.mjs && node scripts/verify-nl-de-packs.mjs');
