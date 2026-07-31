#!/usr/bin/env node
/** Generate ko.commonPages.json only — fast batch translation */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS = path.join(__dirname, '../src/translations/packs');

const BRANDS = ['STAGE Plus','STAGE','STC','Discord','Twitch','Kick','EA FC','OVR','EA ID','Ultimate Team','Pro Clubs','Pro Club','FUT','MOTM','UCL','Supreme League','Elite League','Match Day','Game Day','Live Matches','Inbox','Follow Back','LIVE DARK','LIVE WHITE','DELETE','FAQ','TBD','vs','PTS','MoM','GP','CS','PSN','Xbox','Nintendo Switch'];
const PH = /\{[^}]+\}/g;

function protect(text) {
  const tokens = [];
  let s = text;
  for (const b of BRANDS) {
    const re = new RegExp(b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    s = s.replace(re, (m) => { const id = `__T${tokens.length}__`; tokens.push({ id, value: m }); return id; });
  }
  s = s.replace(PH, (m) => { const id = `__P${tokens.length}__`; tokens.push({ id, value: m }); return id; });
  return { s, tokens };
}
function restore(text, tokens) {
  let o = text;
  for (const { id, value } of tokens) o = o.split(id).join(value);
  return o;
}
async function tr(text) {
  if (!text?.trim()) return text;
  const { s, tokens } = protect(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=${encodeURIComponent(s)}`;
  const res = await fetch(url);
  const data = await res.json();
  return restore(data[0].map((p) => p[0]).join(''), tokens);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const OVERRIDES = {
  searchTitle: '검색', searchSubtitle: '선수와 클럽 찾기', searchPlaceholder: '선수 또는 클럽 검색…', searchCta: '검색',
  eafcTab: 'EA FC', ovr: 'OVR', followBackTitle: 'Follow Back', submitting: '제출 중…',
  walletTitle: 'STC 지갑', feedTitle: '피드', homeGameDay: 'Game Day', homeNavGameDay: 'Game Day',
  homeStageSystem: 'STAGE 시스템', discJoinDiscord: 'Discord 참여', discServerName: 'Stage League Discord',
  storeStageCredits: 'STAGE 크레딧', storeViewPlus: 'STAGE Plus 보기', storePlusHeadline: 'STAGE Plus로 전체 경쟁 루프 잠금 해제',
  landHeroStage: 'STAGE', otWelcomeTitle: 'STAGE에 오신 것을 환영합니다', otStcLabel: 'STC',
  comWelcome: 'STAGE에 오신 것을 환영합니다, {name}! 자신의 클럽을 만들거나 기존 클럽에 가입하시겠습니까?',
  comStagePlusTitle: 'STAGE Plus로 더 깊이 경쟁', pcmPlusAvailable: 'STAGE Plus 이용 가능',
  profWelcome: 'STAGE에 오신 것을 환영합니다!', walStageCoin: 'Stage Coin', wagTitle: 'STC 베팅',
  dashboardMemberSince: 'STAGE 가입', dashboardStageForm: 'STAGE 결과',
  ppExternalStats: 'EA FC & Ultimate Team', eafcTitle: 'EA FC 클럽 조회',
};

async function main() {
  const en = JSON.parse(fs.readFileSync(path.join(PACKS, 'en.commonPages.json'), 'utf8'));
  const keys = Object.keys(en);
  const out = {};
  const BATCH = 20;
  for (let i = 0; i < keys.length; i += BATCH) {
    const slice = keys.slice(i, i + BATCH);
    await Promise.all(slice.map(async (k) => { out[k] = OVERRIDES[k] ?? await tr(en[k]); }));
    process.stdout.write(`\r${Math.min(i + BATCH, keys.length)}/${keys.length}`);
    await sleep(80);
  }
  process.stdout.write('\n');
  fs.writeFileSync(path.join(PACKS, 'ko.commonPages.json'), JSON.stringify(out, null, 2) + '\n');
  const same = keys.filter((k) => out[k] === en[k]).length;
  console.log(`ko.commonPages: ${keys.length} keys, ${same} same-as-en (${(same/keys.length*100).toFixed(1)}%)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
