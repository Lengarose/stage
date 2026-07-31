#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS = path.join(__dirname, '../src/translations/packs');

const SECTIONS = ['commonPages', 'matchFlow', 'competitionFlow', 'tournamentDetail', 'settingsPage'];
const LANGS = ['es', 'pt', 'it'];

const BRAND_OK = new Set([
  'STAGE', 'STC', 'Discord', 'Twitch', 'Kick', 'Google', 'Outlook', 'EA FC', 'OVR', 'FAQ',
  'Feed', 'Inbox', 'Follow Back', 'Gamertag', 'Bio', 'Global', 'DELETE', 'Community',
  'Lifestyle', 'Operations', 'Match Day', 'Game Day', 'Pro Club', 'Ultimate Team',
  'Press Room', 'Live', 'Chat', 'Stats', 'Avatar', 'By STAGE', 'LIVE DARK', 'LIVE WHITE',
  'Cross-Platform', 'Swiss UCL', 'PvP', 'MOTM', 'TBD', 'vs', 'UCL', 'SL', 'News',
  'Rivals', 'Champions', 'Playoffs', 'Bracket', 'Starter', 'Premium', 'N/A',
]);

function isBrandOrShortIdentical(enVal, locVal) {
  if (enVal === locVal) {
    if (BRAND_OK.has(enVal)) return true;
    if (/^(EA FC|OVR|FAQ|Feed|Bio|Global|Stats|Chat|Logo|Banner|Avatar|Post|Posts|Live|vs|TBD|DELETE)$/i.test(enVal)) return true;
    if (/^(Div \{division\}|\{wins\}[WVL] \{losses\}[LD]|W\{wins\} D\{draws\} L\{losses\})$/i.test(enVal)) return true;
    if (enVal.includes('STAGE') || enVal.includes('STC') || enVal.includes('Discord')) return true;
    if (enVal.length <= 3) return true;
    return false;
  }
  return true; // not identical
}

const report = [];

for (const section of SECTIONS) {
  const en = JSON.parse(fs.readFileSync(path.join(PACKS, `en.${section}.json`), 'utf8'));
  const enKeys = Object.keys(en);
  console.log(`\n=== ${section} (${enKeys.length} keys) ===`);
  for (const lang of LANGS) {
    const loc = JSON.parse(fs.readFileSync(path.join(PACKS, `${lang}.${section}.json`), 'utf8'));
    const locKeys = Object.keys(loc);
    const missing = enKeys.filter((k) => !(k in loc));
    const extra = locKeys.filter((k) => !(k in en));
    const identical = enKeys.filter((k) => loc[k] === en[k]);
    const suspicious = identical.filter((k) => !isBrandOrShortIdentical(en[k], loc[k]));
    const coverage = ((enKeys.length - identical.length) / enKeys.length * 100).toFixed(1);
    console.log(`  ${lang}: coverage=${coverage}% keys=${locKeys.length} missing=${missing.length} identical=${identical.length} suspicious=${suspicious.length}`);
    if (missing.length) console.log('    MISSING:', missing.slice(0, 5).join(', '));
    if (suspicious.length && suspicious.length <= 15) console.log('    SUSPICIOUS EN leftovers:', suspicious.join(', '));
    report.push({ section, lang, coverage: parseFloat(coverage), missing: missing.length, identical: identical.length, suspicious: suspicious.length });
  }
}

console.log('\n=== SUMMARY ===');
for (const lang of LANGS) {
  const rows = report.filter((r) => r.lang === lang);
  const avg = (rows.reduce((s, r) => s + r.coverage, 0) / rows.length).toFixed(1);
  const totalIdentical = rows.reduce((s, r) => s + r.identical, 0);
  const totalKeys = rows.reduce((s, r) => s + (r.coverage > 0 ? Math.round(r.identical / (1 - r.coverage / 100) * r.coverage / 100) : 0), 0);
  console.log(`${lang}: avg coverage ${avg}% across sections, total identical=${totalIdentical}, total suspicious EN=${rows.reduce((s,r)=>s+r.suspicious,0)}`);
}
