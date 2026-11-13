'use strict';
const crypto = require('node:crypto');
const { isConfirmedResult } = require('./tournamentStatistics');
const { matchWindows } = require('./officialMatchWindows');
const parse = (v, fallback = {}) => { try { return typeof v === 'string' ? JSON.parse(v) : v || fallback; } catch { return fallback; } };
const closed = new Set(['cancelled','canceled','voided','superseded','deleted','reset','abandoned']);
const knockout = m => Number(m.allow_penalties) === 1 || /final|knockout|playoff|round_of|ucl_r16|ucl_qf|ucl_sf/.test(m.type || '');
function kickoff(m) { try { return matchWindows(m).kickoff_at; } catch { return null; } }
function competition(m) { const ctx = parse(m.competition_context, null); const edition = ctx && typeof ctx === 'object' ? ctx.edition_id || ctx.season_id || ctx.competition_season_id || ctx.league_id : m.competition_context; return m.tournament_id ? `tournament:${m.tournament_id}` : edition ? `${m.source_fixture_type || 'official'}:${edition}` : null; }
function lockState(m, cutoff, started, now = Date.now()) { const at = kickoff(m); const deadline = Math.min(at ? Date.parse(at) : Infinity, cutoff?.closes_at ? Date.parse(cutoff.closes_at) : Infinity); return { closes_at: Number.isFinite(deadline) ? new Date(deadline).toISOString() : null, locked: Boolean(started || !at || !['scheduled','confirmed'].includes(m.status) || now >= deadline) }; }
function score(value) { if (!Number.isInteger(value) || value < 0 || value > 99) throw Object.assign(Error('Enter a whole-number score between 0 and 99.'), { status: 422 }); return value; }
function fingerprint(m) { return crypto.createHash('sha256').update(JSON.stringify([m.id,m.status,m.result_state,m.home_score,m.away_score,m.winner_club_id,m.winner_player_id,m.decided_on_penalties])).digest('hex'); }
function outcome(m, prediction, regulation) {
  if (closed.has(String(m.status).toLowerCase()) || m.status === 'forfeit' || String(m.result_state).toLowerCase() === 'voided') return { status: 'excluded', exact: null };
  if (!isConfirmedResult(m)) return { status: 'pending', exact: null };
  let home = m.home_score, away = m.away_score;
  if (knockout(m)) { if (!regulation || regulation.result_fingerprint !== fingerprint(m)) return { status: 'awaiting_normal_time_score', exact: null }; home = regulation.home_score; away = regulation.away_score; }
  if (!Number.isInteger(Number(home)) || !Number.isInteger(Number(away)) || home == null || away == null) return { status: 'pending', exact: null };
  return { status: 'settled', exact: Number(home) === prediction.home_score && Number(away) === prediction.away_score, home_score: Number(home), away_score: Number(away) };
}
function leaderboard(rows, minimum = 5) {
  const users = new Map();
  for (const row of rows) { if (row.outcome.status !== 'settled') continue; const item = users.get(row.user_id) || { user_id: row.user_id, name: row.name, predictions: 0, exact: 0 }; item.predictions++; if (row.outcome.exact) item.exact++; users.set(row.user_id,item); }
  const sorted = [...users.values()].sort((a,b) => b.exact * a.predictions - a.exact * b.predictions || b.exact - a.exact || a.name.localeCompare(b.name));
  let position = 0, previous = null;
  return sorted.map(row => { const eligible = row.predictions >= minimum; if (eligible && (!previous || row.exact * previous.predictions !== previous.exact * row.predictions || row.exact !== previous.exact)) position++; const result = { ...row, accuracy: Math.round(row.exact / row.predictions * 1000) / 10, rank: eligible ? position : null }; if (eligible) previous = row; return result; }).sort((a,b) => Number(a.rank == null) - Number(b.rank == null) || (a.rank || 0) - (b.rank || 0));
}
module.exports = { parse, closed, knockout, kickoff, competition, lockState, score, fingerprint, outcome, leaderboard };
