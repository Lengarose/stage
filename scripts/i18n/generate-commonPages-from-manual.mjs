#!/usr/bin/env node
/** Writes nl/de commonPages packs from commonPages-manual.json (all EN keys required). */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packsDir = join(__dirname, '..', '..', 'src/translations/packs');
const en = JSON.parse(readFileSync(join(packsDir, 'en.commonPages.json'), 'utf8'));
const manual = JSON.parse(readFileSync(join(__dirname, 'commonPages-manual.json'), 'utf8'));

const nl = {};
const de = {};
for (const key of Object.keys(en)) {
  if (!manual.nl[key] || !manual.de[key]) {
    throw new Error(`Missing manual translation for key: ${key}`);
  }
  nl[key] = manual.nl[key];
  de[key] = manual.de[key];
}

writeFileSync(join(packsDir, 'nl.commonPages.json'), JSON.stringify(nl, null, 2) + '\n');
writeFileSync(join(packsDir, 'de.commonPages.json'), JSON.stringify(de, null, 2) + '\n');
console.log(`Wrote nl.commonPages.json and de.commonPages.json (${Object.keys(en).length} keys each)`);
