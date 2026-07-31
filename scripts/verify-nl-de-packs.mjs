#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packsDir = join(__dirname, '..', 'src/translations/packs');

const SECTIONS = ['commonPages', 'matchFlow', 'competitionFlow', 'tournamentDetail', 'settingsPage'];
const LANGS = ['nl', 'de'];

/** Brand tokens allowed to match EN */
const BRAND_PATTERN = /^(STAGE|STC|Discord|Twitch|Kick|Google|Outlook|EA FC|OVR|FAQ|LIVE|TBD|vs|Feed|Inbox|Chat|Stats|Bio|MOTM|GP|CS|MoM|UCL|SL|PTS|Div|WR|MD|GD|DB|J|Pts|Global|International|Achievement|Follow Back|Match Day|Game Day|LIVE DARK|LIVE WHITE|DELETE|Pro Club|Ultimate Team|FUT|Rivals|Champions|Squad Battles|By STAGE|Supreme League|STAGE Plus|STAGE Challenger|Stage Coin|Stage League|EA Pro Clubs|EA ID|PSN|Xbox|Nintendo Switch|Bracket|Swiss UCL|Double Elim\.|Double Elimination|Look & Feel|Look & feel)$/i;

function isBrandOrAllowedSame(enVal, langVal) {
  if (enVal === langVal) return true;
  if (BRAND_PATTERN.test(langVal?.trim?.() ?? langVal)) return true;
  // Placeholder-only strings
  if (/^\{[^}]+\}$/.test(enVal) && enVal === langVal) return true;
  // Short acronyms / stats labels
  if (/^[A-Z0-9\/\s·|&:+\-%✓⭐🏆🔒⛔⚠️👥⚽🎯📋]+$/u.test(enVal) && enVal === langVal) return true;
  return false;
}

const results = [];

for (const section of SECTIONS) {
  const en = JSON.parse(readFileSync(join(packsDir, `en.${section}.json`), 'utf8'));
  const enKeys = Object.keys(en);

  for (const lang of LANGS) {
    const path = join(packsDir, `${lang}.${section}.json`);
    let pack;
    try {
      pack = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      console.error(`MISSING: ${path}`);
      process.exitCode = 1;
      continue;
    }
    const langKeys = Object.keys(pack);
    const missing = enKeys.filter((k) => !(k in pack));
    const extra = langKeys.filter((k) => !(k in en));
    const sameAsEn = enKeys.filter((k) => pack[k] === en[k] && !isBrandOrAllowedSame(en[k], pack[k]));
    const sameAsEnAll = enKeys.filter((k) => pack[k] === en[k]);
    const translated = enKeys.length - sameAsEnAll.length;
    const pct = ((translated / enKeys.length) * 100).toFixed(1);
    const samePct = ((sameAsEnAll.length / enKeys.length) * 100).toFixed(1);

    results.push({ lang, section, total: enKeys.length, translated, sameAsEn: sameAsEnAll.length, samePct, missing: missing.length, extra: extra.length, untranslatedSame: sameAsEn.length });

    if (missing.length) {
      console.error(`[${lang}.${section}] MISSING ${missing.length} keys:`, missing.slice(0, 5));
      process.exitCode = 1;
    }
    if (extra.length) {
      console.warn(`[${lang}.${section}] EXTRA ${extra.length} keys`);
    }
    if (sameAsEnAll.length / enKeys.length >= 0.08) {
      console.warn(`[${lang}.${section}] same-as-EN ${samePct}% (target <8%) — ${sameAsEn.length} non-brand leftovers`);
      if (sameAsEn.length > 0 && sameAsEn.length <= 20) {
        console.warn('  samples:', sameAsEn.slice(0, 10).map((k) => `${k}=${en[k]}`));
      }
      process.exitCode = 1;
    }
  }
}

console.log('\n=== Coverage Report ===');
console.log('lang\tsection\ttotal\ttranslated\tsame-as-en\tcoverage%\tsame%');
for (const r of results) {
  const cov = ((r.translated / r.total) * 100).toFixed(1);
  console.log(`${r.lang}\t${r.section}\t${r.total}\t${r.translated}\t${r.sameAsEn}\t${cov}%\t${r.samePct}%`);
}
