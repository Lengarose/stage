#!/usr/bin/env node
'use strict';

/**
 * Local Game Day result-negotiation smoke test.
 * Requires the backend on :8080 and MySQL stage_league.
 *
 *   node server/scripts/gameday-result-smoke.js
 */

const { execFileSync } = require('child_process');
const { randomUUID } = require('crypto');

const BASE = process.env.STAGE_API || 'http://127.0.0.1:8080';
const MYSQL = process.env.MYSQL_BIN || '/opt/homebrew/opt/mysql/bin/mysql';
const MYSQL_ARGS = ['-h', '127.0.0.1', '-P', '3306', '-u', 'root', '--protocol=TCP', 'stage_league', '-N', '-e'];

const failures = [];

function mysql(sql) {
  return execFileSync(MYSQL, [...MYSQL_ARGS, sql], { encoding: 'utf8' }).trim();
}

async function req(method, path, { token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: res.status, json, text };
}

function log(title, value) {
  const rendered = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  console.log(`\n--- ${title} ---`);
  console.log(rendered);
}

function assert(label, ok, detail) {
  if (ok) {
    console.log(`PASS  ${label}`);
    return;
  }
  console.log(`FAIL  ${label}${detail ? ` :: ${detail}` : ''}`);
  failures.push({ label, detail });
}

function matchSnapshot(matchId) {
  const row = mysql(
    `SELECT status, result_state, result_submit_side, home_score, away_score, stats_processed
     FROM matches WHERE id = '${matchId}'`
  );
  const [status, result_state, result_submit_side, home_score, away_score, stats_processed] = row.split('\t');
  const statsCount = mysql(`SELECT COUNT(*) FROM match_player_stats WHERE match_id = '${matchId}'`);
  const snapshot = {
    status,
    result_state,
    result_submit_side,
    home_score: Number(home_score),
    away_score: Number(away_score),
    stats_processed: Number(stats_processed),
    match_player_stats: Number(statsCount),
  };
  console.log(`matches.status=${snapshot.status}`);
  console.log(`matches.result_state=${snapshot.result_state}`);
  console.log(`matches.result_submit_side=${snapshot.result_submit_side}`);
  console.log(`score=${snapshot.home_score}-${snapshot.away_score}`);
  console.log(`matches.stats_processed=${snapshot.stats_processed}`);
  console.log(`match_player_stats.count=${snapshot.match_player_stats}`);
  return snapshot;
}

function clubStandings(clubId, label) {
  const row = mysql(
    `SELECT name, wins, draws, losses, goals_scored, goals_conceded FROM clubs WHERE id = '${clubId}'`
  );
  const [name, wins, draws, losses, gf, ga] = row.split('\t');
  const snap = {
    name,
    wins: Number(wins),
    draws: Number(draws),
    losses: Number(losses),
    goals_scored: Number(gf),
    goals_conceded: Number(ga),
  };
  console.log(`standings ${label} ${name}: W${snap.wins} D${snap.draws} L${snap.losses} GF${snap.goals_scored} GA${snap.goals_conceded}`);
  return snap;
}

async function kickoff(token, matchId) {
  return req('POST', '/api/stage/functions/matchKickoff', {
    token,
    body: { action: 'kickoff', match_id: matchId },
  });
}

async function submitResult(token, matchId, payload) {
  return req('POST', '/api/stage/functions/matchKickoff', {
    token,
    body: { action: 'submit_result', match_id: matchId, ...payload },
  });
}

async function confirmResult(token, matchId, payload = {}) {
  return req('POST', '/api/stage/functions/matchKickoff', {
    token,
    body: { action: 'confirm_result', match_id: matchId, ...payload },
  });
}

async function proposeCorrection(token, matchId, payload) {
  return req('POST', '/api/stage/functions/matchKickoff', {
    token,
    body: { action: 'propose_correction', match_id: matchId, ...payload },
  });
}

async function acceptCorrection(token, matchId) {
  return req('POST', '/api/stage/functions/matchKickoff', {
    token,
    body: { action: 'accept_correction', match_id: matchId },
  });
}

async function settleDeadlines(token, matchId) {
  return req('POST', '/api/stage/functions/matchKickoff', {
    token,
    body: { action: 'settle_deadlines', match_id: matchId },
  });
}

async function registerAccount(tag) {
  const email = `smoke-${tag}-${Date.now()}@stage.local`;
  const password = 'smokepass1';
  const res = await req('POST', '/api/stage/auth/register', {
    body: { email, password },
  });
  log(`register ${tag}`, { status: res.status, json: res.json });
  if (res.status !== 201 && res.status !== 200) {
    throw new Error(`register ${tag} failed: ${res.status} ${res.text}`);
  }
  return {
    email,
    password,
    token: res.json.accessToken,
    userId: res.json.userId,
  };
}

async function tryCreateClub(account, name) {
  const res = await req('POST', '/api/stage/clubs', {
    token: account.token,
    body: { name, platform: 'ps5', region: 'EU' },
  });
  log(`POST /clubs ${name}`, { status: res.status, json: res.json });
  return res;
}

async function tryCreatePlayer(account, clubId, gamertag) {
  const res = await req('POST', '/api/stage/players', {
    token: account.token,
    body: {
      user_id: account.userId,
      email: account.email,
      gamertag,
      position: 'ST',
      club_id: clubId,
    },
  });
  log(`POST /players ${gamertag}`, { status: res.status, json: res.json });
  return res;
}

async function tryCreateMatch(home, away, homeClub, awayClub, homePlayer, awayPlayer) {
  const res = await req('POST', '/api/stage/matches', {
    token: home.token,
    body: {
      home_club_id: homeClub.id,
      away_club_id: awayClub.id,
      home_club_name: homeClub.name,
      away_club_name: awayClub.name,
      home_owner_email: home.email,
      away_owner_email: away.email,
      home_player_id: homePlayer.id,
      away_player_id: awayPlayer.id,
      home_player_name: homePlayer.gamertag,
      away_player_name: awayPlayer.gamertag,
      home_player_email: home.email,
      away_player_email: away.email,
      status: 'scheduled',
      mode: 'club',
      type: 'league',
      stats_processed: 0,
      scheduled_date: new Date().toISOString(),
    },
  });
  log('POST /matches', { status: res.status, json: res.json });
  return res;
}

function sqlInsertClub(account, name) {
  const id = randomUUID();
  mysql(
    `INSERT INTO clubs (id, user_id, president_user_id, owner_email, name, platform, region, status)
     VALUES ('${id}', '${account.userId}', '${account.userId}', '${account.email}', '${name}', 'ps5', 'EU', 'active')`
  );
  mysql(`UPDATE users SET owner_id = '${id}' WHERE id = '${account.userId}'`);
  return { id, name };
}

function sqlInsertPlayer(account, clubId, gamertag) {
  const id = randomUUID();
  mysql(
    `INSERT INTO players (id, user_id, email, gamertag, position, club_id, role)
     VALUES ('${id}', '${account.userId}', '${account.email}', '${gamertag}', 'ST', '${clubId}', 'member')`
  );
  mysql(`UPDATE users SET player_id = '${id}' WHERE id = '${account.userId}'`);
  return { id, gamertag };
}

function sqlInsertMatch(home, away, homeClub, awayClub, homePlayer, awayPlayer) {
  const id = randomUUID();
  mysql(
    `INSERT INTO matches (
       id, home_club_id, away_club_id, home_club_name, away_club_name,
       home_owner_email, away_owner_email,
       home_player_id, away_player_id, home_player_name, away_player_name,
       home_player_email, away_player_email,
       status, mode, type, stats_processed, scheduled_date
     ) VALUES (
       '${id}', '${homeClub.id}', '${awayClub.id}', '${homeClub.name}', '${awayClub.name}',
       '${home.email}', '${away.email}',
       '${homePlayer.id}', '${awayPlayer.id}', '${homePlayer.gamertag}', '${awayPlayer.gamertag}',
       '${home.email}', '${away.email}',
       'scheduled', 'club', 'league', 0, NOW()
     )`
  );
  return { id };
}

function homeStats(homeClub, homePlayer) {
  return [{
    player_id: homePlayer.id,
    club_id: homeClub.id,
    player_email: homePlayer.email || '',
    player_gamertag: homePlayer.gamertag,
    goals: 2,
    assists: 1,
    rating: 8.0,
  }];
}

function awayStats(awayClub, awayPlayer) {
  return [{
    player_id: awayPlayer.id,
    club_id: awayClub.id,
    player_email: awayPlayer.email || '',
    player_gamertag: awayPlayer.gamertag,
    goals: 1,
    assists: 0,
    rating: 7.0,
  }];
}

async function main() {
  console.log(`API ${BASE}`);
  const health = await req('GET', '/health');
  log('health', { status: health.status, json: health.json });
  assert('backend health', health.status === 200 && health.json?.ok === true, health.text);

  const home = await registerAccount('home');
  const away = await registerAccount('away');

  const clubHomeApi = await tryCreateClub(home, `Smoke Home ${Date.now()}`);
  const clubAwayApi = await tryCreateClub(away, `Smoke Away ${Date.now()}`);

  let homeClub;
  let awayClub;
  if (clubHomeApi.status >= 200 && clubHomeApi.status < 300 && clubHomeApi.json?.id) {
    homeClub = clubHomeApi.json;
  } else {
    console.log('FINDING: POST /clubs failed for home — seeding club via SQL (not a silent schema fix).');
    homeClub = sqlInsertClub(home, `Smoke Home ${Date.now()}`);
  }
  if (clubAwayApi.status >= 200 && clubAwayApi.status < 300 && clubAwayApi.json?.id) {
    awayClub = clubAwayApi.json;
  } else {
    console.log('FINDING: POST /clubs failed for away — seeding club via SQL (not a silent schema fix).');
    awayClub = sqlInsertClub(away, `Smoke Away ${Date.now()}`);
  }

  const playerHomeApi = await tryCreatePlayer(home, homeClub.id, `SmokeHome${Date.now()}`);
  const playerAwayApi = await tryCreatePlayer(away, awayClub.id, `SmokeAway${Date.now()}`);

  let homePlayer;
  let awayPlayer;
  if (playerHomeApi.status >= 200 && playerHomeApi.status < 300 && playerHomeApi.json?.id) {
    homePlayer = { ...playerHomeApi.json, email: home.email };
  } else {
    console.log('FINDING: POST /players failed for home — seeding player via SQL.');
    homePlayer = { ...sqlInsertPlayer(home, homeClub.id, `SmokeHome${Date.now()}`), email: home.email };
  }
  if (playerAwayApi.status >= 200 && playerAwayApi.status < 300 && playerAwayApi.json?.id) {
    awayPlayer = { ...playerAwayApi.json, email: away.email };
  } else {
    console.log('FINDING: POST /players failed for away — seeding player via SQL.');
    awayPlayer = { ...sqlInsertPlayer(away, awayClub.id, `SmokeAway${Date.now()}`), email: away.email };
  }

  async function newMatch(label) {
    const api = await tryCreateMatch(home, away, homeClub, awayClub, homePlayer, awayPlayer);
    if (api.status >= 200 && api.status < 300 && api.json?.id) return api.json;
    console.log(`FINDING: POST /matches failed for ${label} — seeding match via SQL.`);
    return sqlInsertMatch(home, away, homeClub, awayClub, homePlayer, awayPlayer);
  }

  // ── Scenario A ──────────────────────────────────────────────
  console.log('\n========== SCENARIO A: home submits → away confirms ==========');
  const matchA = await newMatch('A');
  const koA = await kickoff(home.token, matchA.id);
  log('A kickoff', { status: koA.status, json: koA.json });
  assert('A kickoff 2xx', koA.status >= 200 && koA.status < 300, koA.text);

  const subA = await submitResult(home.token, matchA.id, {
    home_score: 4,
    away_score: 2,
    proof_url: '/uploads/smoke-a.png',
    player_stats: homeStats(homeClub, homePlayer),
    participating_player_ids: [homePlayer.id],
  });
  log('A home submit_result 4-2', { status: subA.status, json: subA.json });
  assert('A submit waiting confirmation', subA.status >= 200 && subA.status < 300, subA.text);

  const confA = await confirmResult(away.token, matchA.id, {
    player_stats: awayStats(awayClub, awayPlayer),
    participating_player_ids: [awayPlayer.id],
  });
  log('A away confirm_result', { status: confA.status, json: confA.json });
  assert('A confirm 2xx', confA.status >= 200 && confA.status < 300, confA.text);

  console.log('\n[A] after first confirm:');
  const snapA1 = matchSnapshot(matchA.id);
  const homeStandingA = clubStandings(homeClub.id, 'home');
  const awayStandingA = clubStandings(awayClub.id, 'away');
  assert('A status completed', snapA1.status === 'completed', snapA1.status);
  assert('A result_state CONFIRMED', snapA1.result_state === 'CONFIRMED', snapA1.result_state);
  assert('A score 4-2', snapA1.home_score === 4 && snapA1.away_score === 2, `${snapA1.home_score}-${snapA1.away_score}`);
  assert('A stats_processed=1', snapA1.stats_processed === 1, String(snapA1.stats_processed));
  assert('A match_player_stats >= 1', snapA1.match_player_stats >= 1, String(snapA1.match_player_stats));
  assert('A home standings win', homeStandingA.wins >= 1, JSON.stringify(homeStandingA));
  assert('A away standings loss', awayStandingA.losses >= 1, JSON.stringify(awayStandingA));

  const confA2 = await confirmResult(away.token, matchA.id, {
    player_stats: awayStats(awayClub, awayPlayer),
    participating_player_ids: [awayPlayer.id],
  });
  log('A confirm_result TWICE', { status: confA2.status, json: confA2.json });
  console.log('\n[A] after second confirm:');
  const snapA2 = matchSnapshot(matchA.id);
  clubStandings(homeClub.id, 'home');
  clubStandings(awayClub.id, 'away');
  assert(
    'A second confirm does not double stats',
    snapA2.match_player_stats === snapA1.match_player_stats,
    `first=${snapA1.match_player_stats} second=${snapA2.match_player_stats}`
  );
  assert('A stats_processed still 1', snapA2.stats_processed === 1, String(snapA2.stats_processed));
  assert(
    'A second confirm skipped or rejected',
    (confA2.status >= 200 && confA2.status < 300 && confA2.json?.data?.skipped === true)
      || confA2.status === 409
      || (confA2.status >= 200 && confA2.status < 300 && snapA2.match_player_stats === snapA1.match_player_stats),
    `status=${confA2.status} body=${JSON.stringify(confA2.json)}`
  );

  // ── Scenario C ──────────────────────────────────────────────
  console.log('\n========== SCENARIO C: 4-2 submit → away 4-3 → home accepts ==========');
  const matchC = await newMatch('C');
  const koC = await kickoff(home.token, matchC.id);
  log('C kickoff', { status: koC.status, json: koC.json });
  assert('C kickoff 2xx', koC.status >= 200 && koC.status < 300, koC.text);

  const subC = await submitResult(home.token, matchC.id, {
    home_score: 4,
    away_score: 2,
    proof_url: '/uploads/smoke-c.png',
    player_stats: homeStats(homeClub, homePlayer),
    participating_player_ids: [homePlayer.id],
  });
  log('C home submit_result 4-2', { status: subC.status, json: subC.json });
  assert('C submit 2xx', subC.status >= 200 && subC.status < 300, subC.text);

  const corrC = await proposeCorrection(away.token, matchC.id, {
    home_score: 4,
    away_score: 3,
    player_stats: awayStats(awayClub, awayPlayer),
    participating_player_ids: [awayPlayer.id],
  });
  log('C away propose_correction 4-3', { status: corrC.status, json: corrC.json });
  assert('C correction 2xx', corrC.status >= 200 && corrC.status < 300, corrC.text);
  assert(
    'C result_state AWAITING_HOME_REVIEW',
    corrC.json?.data?.result_state === 'AWAITING_HOME_REVIEW',
    JSON.stringify(corrC.json)
  );

  const accC = await acceptCorrection(home.token, matchC.id);
  log('C home accept_correction', { status: accC.status, json: accC.json });
  assert('C accept 2xx', accC.status >= 200 && accC.status < 300, accC.text);

  console.log('\n[C] after accept:');
  const snapC = matchSnapshot(matchC.id);
  clubStandings(homeClub.id, 'home');
  clubStandings(awayClub.id, 'away');
  assert('C status completed', snapC.status === 'completed', snapC.status);
  assert('C result_state CONFIRMED', snapC.result_state === 'CONFIRMED', snapC.result_state);
  assert('C official score 4-3', snapC.home_score === 4 && snapC.away_score === 3, `${snapC.home_score}-${snapC.away_score}`);
  assert('C stats_processed=1', snapC.stats_processed === 1, String(snapC.stats_processed));

  // ── Scenario F ──────────────────────────────────────────────
  console.log('\n========== SCENARIO F: home never submits, settle_deadlines ==========');
  const matchF = await newMatch('F');
  const koF = await kickoff(home.token, matchF.id);
  log('F kickoff', { status: koF.status, json: koF.json });
  assert('F kickoff 2xx', koF.status >= 200 && koF.status < 300, koF.text);

  console.log('\n[F] before deadline:');
  const snapF0 = matchSnapshot(matchF.id);
  assert('F submit side home before settle', snapF0.result_submit_side === 'home' || snapF0.result_submit_side === '', snapF0.result_submit_side);

  mysql(`UPDATE matches SET result_due_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE id = '${matchF.id}'`);
  console.log('SET result_due_at = NOW() - 1 hour');

  const settleF = await settleDeadlines(home.token, matchF.id);
  log('F settle_deadlines', { status: settleF.status, json: settleF.json });
  assert('F settle 2xx', settleF.status >= 200 && settleF.status < 300, settleF.text);

  console.log('\n[F] after settle:');
  const snapF1 = matchSnapshot(matchF.id);
  assert('F result_submit_side away', snapF1.result_submit_side === 'away', snapF1.result_submit_side);
  assert('F still not completed', snapF1.status !== 'completed', snapF1.status);

  console.log('\n========== SUMMARY ==========');
  if (!failures.length) {
    console.log('ALL ASSERTIONS PASSED');
    return;
  }
  console.log(`${failures.length} assertion(s) failed:`);
  for (const f of failures) {
    console.log(` - ${f.label}${f.detail ? ` :: ${f.detail}` : ''}`);
  }
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('SMOKE SCRIPT CRASHED');
  console.error(err);
  process.exit(1);
});
