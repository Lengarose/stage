#!/usr/bin/env node
/**
 * Generate locale packs from EN keys + FR meaning source.
 * Preserves {placeholders} and brand tokens.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = path.join(__dirname, '../src/translations/packs');

const BRAND_TOKENS = [
  'STAGE Plus', 'STAGE Challenger', 'STAGE System', 'STAGE', 'STC',
  'Discord', 'Twitch', 'Kick', 'EA FC', 'OVR', 'Match Day', 'Game Day',
  'Inbox', 'UCL', 'Ultimate Team', 'Pro Club', 'Pro Clubs', 'Elite League',
  'Supreme League', 'Follow Back', 'Lifestyle', 'Recruitment', 'Community',
  'Arrange Game', 'Live Matches', 'LIVE DARK', 'LIVE WHITE', 'FAQ', 'SSS',
  'DELETE', 'TBD', 'PTS', 'MD', 'GD', 'Div', 'Google', 'Outlook', 'Microsoft',
  'gamertag', 'Gamertag', 'Stats', 'Chat', 'Live', 'Feed', 'Wallet', 'Store',
  'Avatar', 'Ranked', 'Knockout', 'Swiss',
];

const PLACEHOLDER_RE = /\{[a-zA-Z0-9_]+\}/g;

function protectString(text) {
  let protected_ = text;
  const map = new Map();
  let idx = 0;
  for (const brand of [...BRAND_TOKENS].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    protected_ = protected_.replace(re, (m) => {
      const token = `⟦B${idx++}⟧`;
      map.set(token, m);
      return token;
    });
  }
  protected_ = protected_.replace(PLACEHOLDER_RE, (m) => {
    const token = `⟦P${idx++}⟧`;
    map.set(token, m);
    return token;
  });
  return { text: protected_, map };
}

function restoreString(text, map) {
  let out = text;
  for (const [token, original] of map) out = out.split(token).join(original);
  return out;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateText(text, sourceLang, targetLang, retries = 4) {
  if (!text?.trim()) return text;
  const { text: protectedText, map } = protectString(text);
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', sourceLang);
  url.searchParams.set('tl', targetLang);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', protectedText);

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const translated = data[0].map((part) => part[0]).join('');
      return restoreString(translated, map);
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await sleep(800 * (attempt + 1));
    }
  }
  return text;
}

async function translateEntries(sourceEntries, sourceLang, targetLang, label) {
  const keys = Object.keys(sourceEntries);
  const results = {};
  const concurrency = 4;
  const delayMs = 100;
  for (let i = 0; i < keys.length; i += concurrency) {
    const chunk = keys.slice(i, i + concurrency);
    await Promise.all(chunk.map(async (key) => {
      results[key] = await translateText(sourceEntries[key], sourceLang, targetLang);
    }));
    if (i + concurrency < keys.length) await sleep(delayMs);
    if (i % 100 === 0 || i + concurrency >= keys.length) {
      process.stdout.write(`  ${label}: ${Math.min(i + concurrency, keys.length)}/${keys.length}\r`);
    }
  }
  process.stdout.write(`  ${label}: ${keys.length}/${keys.length}\n`);
  return results;
}

function sortKeys(obj) {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}

function writePack(lang, section, data) {
  const file = path.join(PACKS_DIR, `${lang}.${section}.json`);
  fs.writeFileSync(file, JSON.stringify(sortKeys(data), null, 2) + '\n');
}

function sameAsEn(en, translated) {
  const keys = Object.keys(en);
  let same = 0;
  for (const k of keys) if (translated[k] === en[k]) same++;
  return { total: keys.length, same, pct: ((same / keys.length) * 100).toFixed(1) };
}

async function generateSection(lang, section, useFr = true) {
  const enPath = path.join(PACKS_DIR, `en.${section}.json`);
  const frPath = path.join(PACKS_DIR, `fr.${section}.json`);
  const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  const fr = useFr && fs.existsSync(frPath)
    ? JSON.parse(fs.readFileSync(frPath, 'utf8'))
    : en;

  const sourceEntries = {};
  for (const k of Object.keys(en)) {
    sourceEntries[k] = fr[k] ?? en[k];
  }

  console.log(`\n${lang}.${section}: translating ${Object.keys(sourceEntries).length} keys (fr→${lang})`);
  const translated = await translateEntries(sourceEntries, 'fr', lang, `${lang}.${section}`);
  writePack(lang, section, translated);
  const cov = sameAsEn(en, translated);
  console.log(`  sameAsEn: ${cov.same}/${cov.total} (${cov.pct}%)`);
  return cov;
}

async function main() {
  const tasks = [];

  // Priority: commonPages for ko, pl, tr, ar
  for (const lang of ['ko', 'pl', 'tr', 'ar']) {
    tasks.push({ lang, section: 'commonPages' });
  }
  // Secondary: ja/zh/ko flow packs if missing
  for (const lang of ['ja', 'zh', 'ko']) {
    for (const section of ['matchFlow', 'competitionFlow', 'tournamentDetail']) {
      const out = path.join(PACKS_DIR, `${lang}.${section}.json`);
      if (!fs.existsSync(out)) tasks.push({ lang, section });
    }
  }

  const report = [];
  for (const { lang, section } of tasks) {
    const cov = await generateSection(lang, section);
    report.push({ file: `${lang}.${section}.json`, ...cov });
  }

  console.log('\n=== sameAsEn summary ===');
  for (const r of report) {
    console.log(`${r.file}: ${r.same}/${r.total} (${r.pct}%)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
