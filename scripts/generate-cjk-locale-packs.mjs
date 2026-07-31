#!/usr/bin/env node
/**
 * Generate zh / ja / ko translation packs from EN source files.
 * Preserves {placeholders} and brand tokens (STAGE, STC, Discord, etc.).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKS_DIR = path.join(__dirname, '../src/translations/packs');

const SECTIONS = [
  'commonPages',
  'matchFlow',
  'competitionFlow',
  'tournamentDetail',
  'settingsPage',
];

const LANGS = {
  zh: 'zh-CN',
  ja: 'ja',
  ko: 'ko',
};

const BRAND_TERMS = [
  'STAGE Plus',
  'STAGE',
  'STC',
  'Discord',
  'Twitch',
  'Kick',
  'EA FC',
  'OVR',
  'EA ID',
  'Ultimate Team',
  'Pro Clubs',
  'Pro Club',
  'FUT',
  'MOTM',
  'UCL',
  'Supreme League',
  'Elite League',
  'Match Day',
  'Game Day',
  'Live Matches',
  'Inbox',
  'Follow Back',
  'LIVE DARK',
  'LIVE WHITE',
  'DELETE',
  'FAQ',
  'TBD',
  'vs',
  'PTS',
  'MoM',
  'GP',
  'CS',
  'PSN',
  'Xbox',
  'Nintendo Switch',
];

const PLACEHOLDER_RE = /\{[^}]+\}/g;

function protectTokens(text) {
  const tokens = [];
  let protectedText = text;

  for (const brand of BRAND_TERMS) {
    const re = new RegExp(brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    protectedText = protectedText.replace(re, (m) => {
      const id = `__TOK${tokens.length}__`;
      tokens.push({ id, value: m });
      return id;
    });
  }

  protectedText = protectedText.replace(PLACEHOLDER_RE, (m) => {
    const id = `__PH${tokens.length}__`;
    tokens.push({ id, value: m });
    return id;
  });

  return { protectedText, tokens };
}

function restoreTokens(text, tokens) {
  let out = text;
  for (const { id, value } of tokens) {
    out = out.split(id).join(value);
  }
  return out;
}

async function translateText(text, targetLang, retries = 3) {
  if (!text || !text.trim()) return text;

  const { protectedText, tokens } = protectTokens(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(protectedText)}`;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const translated = data[0].map((part) => part[0]).join('');
      return restoreTokens(translated, tokens);
    } catch (err) {
      if (attempt === retries - 1) throw err;
      await sleep(500 * (attempt + 1));
    }
  }
  return text;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function translateBatch(entries, targetLang, batchSize = 8) {
  const result = {};
  const keys = Object.keys(entries);
  for (let i = 0; i < keys.length; i += batchSize) {
    const slice = keys.slice(i, i + batchSize);
    await Promise.all(
      slice.map(async (key) => {
        result[key] = await translateText(entries[key], targetLang);
      }),
    );
    process.stdout.write(`\r  ${Math.min(i + batchSize, keys.length)}/${keys.length}`);
    await sleep(120);
  }
  process.stdout.write('\n');
  return result;
}

/** Manual overrides for natural UI tone + brand preservation */
const OVERRIDES = {
  zh: {
    commonPages: {
      searchTitle: '搜索',
      searchSubtitle: '查找球员和俱乐部',
      searchPlaceholder: '搜索球员或俱乐部…',
      searchCta: '搜索',
      eafcTab: 'EA FC',
      ovr: 'OVR',
      followBackTitle: 'Follow Back',
      submitting: '提交中…',
      walletTitle: 'STC 钱包',
      feedTitle: '动态',
      homeGameDay: 'Game Day',
      homeNavGameDay: 'Game Day',
      homeNavGameDayDesc: '安排并参与比赛',
      homeStageSystem: 'STAGE 系统',
      discJoinDiscord: '加入 Discord',
      discServerName: 'Stage League Discord',
      storeStageCredits: 'STAGE 积分',
      storeViewPlus: '查看 STAGE Plus',
      storePlusHeadline: 'STAGE Plus 解锁完整竞技循环',
      landHeroStage: 'STAGE',
      otWelcomeTitle: '欢迎来到 STAGE',
      otStcLabel: 'STC',
      otCreditsLabel: '积分',
      comWelcome: '欢迎来到 STAGE，{name}！你想创建自己的俱乐部还是加入现有俱乐部？',
      comStagePlusTitle: '使用 STAGE Plus 深入竞技',
      pcmPlusAvailable: 'STAGE Plus 可用',
      profWelcome: '欢迎来到 STAGE！',
      teStageSystem: 'STAGE 系统',
      walStageCoin: 'Stage Coin',
      wagTitle: 'STC 赌注',
      prdTitle: '赛前新闻发布会',
      twprChampionConference: '冠军新闻发布会',
      dashboardMemberSince: '加入 STAGE',
      dashboardStageForm: 'STAGE 战绩',
      dashboardStageFormEmpty: '暂无已完成的 STAGE 比赛。',
      ppExternalStats: 'EA FC 与 Ultimate Team',
      eafcTitle: 'EA FC 俱乐部查询',
      homeFooterRankings: 'Rankings',
    },
    matchFlow: {
      gameDayTitle: 'Game Day',
      inboxTitle: 'Inbox',
      stageSystem: 'STAGE 系统',
      tbd: 'TBD',
      versus: 'vs',
      live: 'Live',
      chat: '聊天',
      stats: '统计',
    },
    competitionFlow: {
      stageChallenger: 'STAGE Challenger',
      supremeLeague: 'Supreme League',
      byStage: 'By STAGE',
      stagePlusRequired: '需要 STAGE Plus',
      live: 'Live',
      points: 'PTS',
    },
    tournamentDetail: {
      tabBracket: '对阵图 / 比赛',
      tabStats: '统计',
      tbd: 'TBD',
      utPhoto: 'Ultimate Team 照片',
      proClubPhoto: 'Pro Club 照片',
      uclControls: 'UCL 控制',
    },
    settingsPage: {
      stgThemeLiveDark: 'LIVE DARK',
      stgThemeLiveWhite: 'LIVE WHITE',
      stgTypeToConfirm: '输入 DELETE 以确认：',
      stgTypeDelete: '输入 DELETE',
    },
  },
  ja: {
    commonPages: {
      searchTitle: '検索',
      searchSubtitle: '選手とクラブを探す',
      searchPlaceholder: '選手またはクラブを検索…',
      searchCta: '検索',
      eafcTab: 'EA FC',
      ovr: 'OVR',
      followBackTitle: 'Follow Back',
      submitting: '送信中…',
      walletTitle: 'STCウォレット',
      feedTitle: 'フィード',
      homeGameDay: 'Game Day',
      homeNavGameDay: 'Game Day',
      homeNavGameDayDesc: '試合の予定とプレイ',
      homeStageSystem: 'STAGEシステム',
      discJoinDiscord: 'Discordに参加',
      discServerName: 'Stage League Discord',
      storeStageCredits: 'STAGEクレジット',
      storeViewPlus: 'STAGE Plusを見る',
      storePlusHeadline: 'STAGE Plusでフル競技ループを解放',
      landHeroStage: 'STAGE',
      otWelcomeTitle: 'STAGEへようこそ',
      otStcLabel: 'STC',
      comWelcome: 'STAGEへようこそ、{name}！自分のクラブを作りますか、それとも既存のクラブに参加しますか？',
      comStagePlusTitle: 'STAGE Plusでより深く競技',
      pcmPlusAvailable: 'STAGE Plusが利用可能',
      profWelcome: 'STAGEへようこそ！',
      walStageCoin: 'Stage Coin',
      wagTitle: 'STC賭け',
      prdTitle: '試合前記者会見',
      twprChampionConference: '優勝記者会見',
      dashboardMemberSince: 'STAGE在籍',
      dashboardStageForm: 'STAGE結果',
      dashboardStageFormEmpty: '完了したSTAGE試合はまだありません。',
      ppExternalStats: 'EA FC & Ultimate Team',
      eafcTitle: 'EA FCクラブ検索',
    },
    matchFlow: {
      gameDayTitle: 'Game Day',
      inboxTitle: 'Inbox',
      stageSystem: 'STAGEシステム',
      tbd: 'TBD',
      versus: 'vs',
      live: 'Live',
      chat: 'チャット',
      stats: '統計',
    },
    competitionFlow: {
      stageChallenger: 'STAGE Challenger',
      supremeLeague: 'Supreme League',
      byStage: 'By STAGE',
      stagePlusRequired: 'STAGE Plusが必要',
      live: 'Live',
      points: 'PTS',
    },
    tournamentDetail: {
      tabStats: '統計',
      tbd: 'TBD',
      utPhoto: 'Ultimate Team写真',
      proClubPhoto: 'Pro Club写真',
      uclControls: 'UCLコントロール',
    },
    settingsPage: {
      stgThemeLiveDark: 'LIVE DARK',
      stgThemeLiveWhite: 'LIVE WHITE',
      stgTypeToConfirm: '確認のため DELETE と入力：',
      stgTypeDelete: 'DELETE と入力',
    },
  },
  ko: {
    commonPages: {
      searchTitle: '검색',
      searchSubtitle: '선수와 클럽 찾기',
      searchPlaceholder: '선수 또는 클럽 검색…',
      searchCta: '검색',
      eafcTab: 'EA FC',
      ovr: 'OVR',
      followBackTitle: 'Follow Back',
      submitting: '제출 중…',
      walletTitle: 'STC 지갑',
      feedTitle: '피드',
      homeGameDay: 'Game Day',
      homeNavGameDay: 'Game Day',
      homeNavGameDayDesc: '경기 일정 및 플레이',
      homeStageSystem: 'STAGE 시스템',
      discJoinDiscord: 'Discord 참여',
      discServerName: 'Stage League Discord',
      storeStageCredits: 'STAGE 크레딧',
      storeViewPlus: 'STAGE Plus 보기',
      storePlusHeadline: 'STAGE Plus로 전체 경쟁 루프 잠금 해제',
      landHeroStage: 'STAGE',
      otWelcomeTitle: 'STAGE에 오신 것을 환영합니다',
      otStcLabel: 'STC',
      comWelcome: 'STAGE에 오신 것을 환영합니다, {name}! 자신의 클럽을 만들거나 기존 클럽에 가입하시겠습니까?',
      comStagePlusTitle: 'STAGE Plus로 더 깊이 경쟁',
      pcmPlusAvailable: 'STAGE Plus 이용 가능',
      profWelcome: 'STAGE에 오신 것을 환영합니다!',
      walStageCoin: 'Stage Coin',
      wagTitle: 'STC 베팅',
      prdTitle: '경기 전 기자회견',
      twprChampionConference: '우승 기자회견',
      dashboardMemberSince: 'STAGE 가입',
      dashboardStageForm: 'STAGE 결과',
      dashboardStageFormEmpty: '완료된 STAGE 경기가 아직 없습니다.',
      ppExternalStats: 'EA FC & Ultimate Team',
      eafcTitle: 'EA FC 클럽 조회',
    },
    matchFlow: {
      gameDayTitle: 'Game Day',
      inboxTitle: 'Inbox',
      stageSystem: 'STAGE 시스템',
      tbd: 'TBD',
      versus: 'vs',
      live: 'Live',
      chat: '채팅',
      stats: '통계',
    },
    competitionFlow: {
      stageChallenger: 'STAGE Challenger',
      supremeLeague: 'Supreme League',
      byStage: 'By STAGE',
      stagePlusRequired: 'STAGE Plus 필요',
      live: 'Live',
      points: 'PTS',
    },
    tournamentDetail: {
      tabStats: '통계',
      tbd: 'TBD',
      utPhoto: 'Ultimate Team 사진',
      proClubPhoto: 'Pro Club 사진',
      uclControls: 'UCL 컨트롤',
    },
    settingsPage: {
      stgThemeLiveDark: 'LIVE DARK',
      stgThemeLiveWhite: 'LIVE WHITE',
      stgTypeToConfirm: '확인하려면 DELETE를 입력하세요:',
      stgTypeDelete: 'DELETE 입력',
    },
  },
};

function applyOverrides(lang, section, translated, en) {
  const overrides = OVERRIDES[lang]?.[section] || {};
  const out = { ...translated };
  for (const [key, value] of Object.entries(overrides)) {
    if (key in en) out[key] = value;
  }
  return out;
}

function coverageReport(lang, section, en, translated) {
  const keys = Object.keys(en);
  const sameAsEn = keys.filter((k) => translated[k] === en[k]);
  return {
    lang,
    section,
    total: keys.length,
    sameAsEn: sameAsEn.length,
    pct: ((sameAsEn.length / keys.length) * 100).toFixed(1),
    missing: keys.filter((k) => !(k in translated)),
  };
}

async function main() {
  const reports = [];

  for (const section of SECTIONS) {
    const enPath = path.join(PACKS_DIR, `en.${section}.json`);
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));

    for (const [lang, googleLang] of Object.entries(LANGS)) {
      const outPath = path.join(PACKS_DIR, `${lang}.${section}.json`);
      console.log(`Translating ${lang}.${section} (${Object.keys(en).length} keys)...`);

      let translated = await translateBatch(en, googleLang);
      translated = applyOverrides(lang, section, translated, en);

      // Ensure every EN key exists
      for (const key of Object.keys(en)) {
        if (!(key in translated) || translated[key] == null) {
          translated[key] = en[key];
        }
      }

      fs.writeFileSync(outPath, JSON.stringify(translated, null, 2) + '\n', 'utf8');
      reports.push(coverageReport(lang, section, en, translated));
    }
  }

  console.log('\n=== Coverage Report (same-as-en %) ===');
  for (const lang of Object.keys(LANGS)) {
    console.log(`\n${lang.toUpperCase()}:`);
    const langReports = reports.filter((r) => r.lang === lang);
    let totalSame = 0;
    let totalKeys = 0;
    for (const r of langReports) {
      console.log(`  ${r.section}: ${r.sameAsEn}/${r.total} same-as-en (${r.pct}%)`);
      totalSame += r.sameAsEn;
      totalKeys += r.total;
    }
    console.log(`  TOTAL: ${totalSame}/${totalKeys} (${((totalSame / totalKeys) * 100).toFixed(1)}%)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
