'use strict';
const { wallClockToOffsetIso, resolveTimeZone } = require('../utils/datetime');
const parse = value => { try { return typeof value === 'string' ? JSON.parse(value) : value || {}; } catch { return {}; } };
const unpack = row => ({ ...parse(row.data_json), ...Object.fromEntries(Object.entries(row).filter(([k,v]) => k !== 'data_json' && v != null)) });
const unique = values => [...new Set(values.filter(Boolean).map(String))];
const placeholders = values => values.map(() => '?').join(',');
const invalid = message => Object.assign(new Error(message), { status: 400 });
const hidden = row => ['cancelled','canceled','voided','deleted','preview','bye'].includes(String(row.status).toLowerCase()) || ['VOIDED','CANCELLED'].includes(row.result_state) || ['voided','cancelled'].includes(row.scheduling_status);
const completed = row => ['completed','played','forfeit'].includes(row.status) && (row.result_state === 'CONFIRMED' || Number(row.stats_processed) === 1 || Number(row.report_finalized) === 1);

function dateKey(value, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(new Date(value));
  const get = type => parts.find(p => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function validateCalendarQuery(query) {
  const { from, to, scope = 'general', tournament_id: tournamentId } = query;
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!valid(from) || !valid(to) || to <= from || (Date.parse(to)-Date.parse(from))/86400000 > 49) throw invalid('Use a valid calendar range of at most 49 days (exclusive end).');
  if (!['general','gost','regional','tournament','friendly'].includes(scope)) throw invalid('Invalid calendar scope.');
  if (tournamentId && !/^[a-zA-Z0-9-]{1,36}$/.test(tournamentId)) throw invalid('Invalid tournament identifier.');
  return { from, to, scope, tournamentId };
}
function categoryFor(row, source, engine = {}, parent = {}) {
  const slug = String(row.competition_slug || engine.competition_slug || parent.competition_slug || parent.slug || '').toLowerCase();
  if (source === 'competition_fixture' || engine.product_type === 'official_competition') return ['supreme','elite','challenger'].includes(slug) ? slug : 'gost';
  if (source === 'regional_league_fixture' || engine.product_type === 'regional_league') return 'regional';
  if ((row.tournament_id && row.tournament_id !== 'ranked') || engine.product_type === 'community_tournament') return 'tournament';
  if (row.type === 'friendly' || row.type === 'friendly_match') return 'friendly';
  return 'match'; // Ranked invitations are not silently relabelled as friendlies.
}

/** Linked match state takes precedence, even when it was moved outside this month or voided. */
function normalizeCalendarEvents({ matches = [], fixtures = [], engineFixtures = [], parents = [], identity, timezone, from, to, scope = 'general', tournamentId }) {
  const byMatch = new Map(matches.map(m => [String(m.id), m]));
  const byFixture = new Map(fixtures.map(f => [String(f.id), f]));
  const parentMap = new Map(parents.map(p => [String(p.id), p]));
  // Durable source links also collapse repeated canonical rows, never separate legs.
  const sourceKey = m => {
    if (!m.source_fixture_id) return null;
    const engine = m.source_fixture_type === 'competition_engine' && engineFixtures.find(e=>String(e.id)===String(m.source_fixture_id));
    const type=engine?.legacy_fixture_type || m.source_fixture_type || '';
    return `${String(type).replace(/^regional_league$/, 'regional_league_fixture').replace(/^competition$/, 'competition_fixture')}:${engine?.legacy_fixture_id || m.source_fixture_id}`;
  };
  const preferredIds = new Set([...engineFixtures.map(e=>e.match_id),...fixtures.map(f=>f.match_id)].filter(Boolean).map(String));
  const sourceMatches = new Map();
  for (const match of matches) {
    const key=sourceKey(match);
    if (!key) continue;
    const current=sourceMatches.get(key);
    if (!current || (preferredIds.has(String(match.id)) && !preferredIds.has(String(current.id))) || (preferredIds.has(String(match.id))===preferredIds.has(String(current.id)) && String(match.updated_date || '').localeCompare(String(current.updated_date || ''))>0)) sourceMatches.set(key,match);
  }
  const memberClubId = String(identity.memberClub?.id || identity.club?.id || '');
  const clubIds = unique([identity.memberClub?.id, identity.club?.id, identity.ownedClub?.id, identity.presidentClub?.id]);
  const relevant = row => [row.home_player_id,row.away_player_id].some(id => id && String(id) === String(identity.player?.id)) || [row.home_club_id,row.away_club_id].some(id => id && clubIds.includes(String(id)));
  const candidates = new Map();
  const add = (sourceRow, source, engine = {}) => {
    const legacy = byFixture.get(String(engine.legacy_fixture_id)) || sourceRow;
    const linked = byMatch.get(String(engine.match_id || legacy.match_id)) || (source === 'match' && byMatch.get(String(legacy.id))) || matches.find(m => m.source_fixture_id && [String(legacy.id),String(engine.id)].includes(String(m.source_fixture_id)));
    const match = linked && (sourceMatches.get(sourceKey(linked)) || linked);
    const row = match || legacy;
    const key = match ? `match:${match.id}` : `fixture:${source}:${legacy.id}`;
    const previous = candidates.get(key);
    // A linked legacy fixture is more descriptive than the standalone match.
    if (previous && source === 'match' && !engine.id) return;
    candidates.set(key, { row, legacy, source, engine });
  };
  matches.forEach(m => add(m, 'match'));
  fixtures.forEach(f => add(f, f.entity_type));
  engineFixtures.forEach(e => {
    const source = e.legacy_fixture_type === 'regional_league_fixture' ? 'regional_league_fixture' : e.legacy_fixture_type === 'competition_fixture' ? 'competition_fixture' : 'match';
    const legacy = byFixture.get(String(e.legacy_fixture_id)) || byMatch.get(String(e.match_id || (e.legacy_fixture_type === 'tournament_match' ? e.legacy_fixture_id : '')));
    // Backfilled engine confirmation may have been inferred from a date. Never use it to override a legacy handshake.
    if (legacy) add(legacy, source, e);
    else if (!e.legacy_fixture_id) add({ ...e, scheduled_date:e.scheduled_at, confirmed_date:e.confirmed_at, home_player_id:e.player_home_id, away_player_id:e.player_away_id, home_player_name:e.player_home_gamertag, away_player_name:e.player_away_gamertag }, source, e);
  });
  const events = [];
  for (const [id, { row, legacy, source, engine }] of candidates) {
    if (!relevant(row) || hidden(row) || hidden(legacy)) continue;
    const isClub = Boolean(row.home_club_id || row.away_club_id);
    if (!(isClub ? row.home_club_id && row.away_club_id : row.home_player_id && row.away_player_id)) continue;
    if (['home_proposed','away_proposed','rejected'].includes(row.scheduling_status) && !completed(row)) continue;
    const schedule = row.scheduling_status === 'confirmed' ? row : legacy.scheduling_status === 'confirmed' ? legacy : null;
    if (!schedule && !completed(row) && !row.accepted_invitation) continue;
    // Never fall back to created_date, window_start or a proposed time.
    const raw = schedule?.confirmed_date || schedule?.scheduled_date || row.confirmed_date || row.scheduled_date;
    if (!raw) continue;
    const startsAt = wallClockToOffsetIso(raw, row.timezone || legacy.timezone);
    if (!startsAt || Number.isNaN(Date.parse(startsAt))) continue;
    const day = dateKey(startsAt, timezone);
    if (day < from || day >= to) continue;
    const parent = parentMap.get(String(legacy.season_id || legacy.league_id || row.tournament_id || engine.legacy_source_id)) || {};
    if (hidden(parent) && !completed(row)) continue;
    const category = categoryFor({ ...legacy, ...row }, source, engine, { ...parentMap.get(String(parent.competition_id)), ...parent });
    if (tournamentId && String(row.tournament_id || engine.legacy_source_id) !== tournamentId) continue;
    if (scope === 'gost' && (!['supreme','elite','challenger','gost'].includes(category) || ![row.home_club_id,row.away_club_id].map(String).includes(memberClubId))) continue;
    if (scope === 'regional' && (category !== 'regional' || ![row.home_club_id,row.away_club_id].map(String).includes(memberClubId))) continue;
    if (scope === 'tournament' && category !== 'tournament') continue;
    if (scope === 'friendly' && category !== 'friendly') continue;
    const href = byMatch.has(String(row.id)) ? `/game-day?match=${encodeURIComponent(row.id)}` : category === 'regional' && parent.slug ? `/leagues/${encodeURIComponent(parent.slug)}` : ['supreme','elite','challenger'].includes(category) ? `/competitions/${category}` : category === 'tournament' && (row.tournament_id || engine.legacy_source_id) ? `/tournaments/${encodeURIComponent(row.tournament_id || engine.legacy_source_id)}` : null;
    events.push({ id, startsAt, day, category, competition:legacy.competition_name || legacy.league_name || engine.competition_name || parent.name || parent.competition_name || (category === 'match' ? 'Ranked match' : category === 'friendly' ? 'Friendly' : 'Tournament'), homeName:row.home_club_name || row.home_player_name || 'Unknown participant', awayName:row.away_club_name || row.away_player_name || 'Unknown participant', homeAvatarUrl:row.home_avatar_url, awayAvatarUrl:row.away_avatar_url, status:completed(row) ? 'completed' : row.status, score:completed(row) && row.home_score != null && row.away_score != null ? `${row.home_score} - ${row.away_score}` : null, round:legacy.round || row.round, stage:legacy.phase || engine.phase || row.type, matchday:legacy.matchday || engine.matchday, leg:legacy.leg || engine.leg, href });
  }
  return events.sort((a,b) => Date.parse(a.startsAt)-Date.parse(b.startsAt) || a.id.localeCompare(b.id));
}

function createCalendarService({ query, resolveIdentity }) {
  // Every candidate query is scoped in SQL and paginated; no global fixture scan in the client.
  const paged = async (sql, params) => {
    const result = [];
    for (let offset = 0; ; offset += 250) {
      const page = await query(`${sql} LIMIT ? OFFSET ?`, [...params,250,offset]);
      result.push(...page);
      if (page.length < 250) return result;
    }
  };
  return async (userId, input) => {
    const options = validateCalendarQuery(input);
    const identity = await resolveIdentity(userId);
    const [user] = await query('SELECT timezone FROM users WHERE id=? LIMIT 1',[userId]);
    const timezone = resolveTimeZone(user?.timezone);
    const clubs = unique([identity.memberClub?.id,identity.club?.id,identity.ownedClub?.id,identity.presidentClub?.id]);
    const player = identity.player?.id || null;
    const scope = (alias, homePlayer = 'home_player_id', awayPlayer = 'away_player_id') => ({ sql:`(${alias}.${homePlayer}=? OR ${alias}.${awayPlayer}=?${clubs.length ? ` OR ${alias}.home_club_id IN (${placeholders(clubs)}) OR ${alias}.away_club_id IN (${placeholders(clubs)})` : ''})`, values:[player,player,...clubs,...clubs] });
    const lower = new Date(Date.parse(options.from)-2*86400000).toISOString().slice(0,10);
    const upper = new Date(Date.parse(options.to)+2*86400000).toISOString().slice(0,10);
    const ms = scope('m'), es = scope('cf','player_home_id','player_away_id');
    const engineFixtures = await paged(`SELECT cf.*, ci.product_type, ci.slug AS competition_slug, ci.name AS competition_name, ci.legacy_source_id FROM competition_fixtures cf JOIN competition_instances ci ON ci.id=cf.competition_instance_id LEFT JOIN matches m ON m.id=cf.match_id WHERE ${es.sql} AND (COALESCE(m.confirmed_date,m.scheduled_date,cf.confirmed_at,cf.scheduled_at) >= ? AND COALESCE(m.confirmed_date,m.scheduled_date,cf.confirmed_at,cf.scheduled_at) < ?) ORDER BY cf.id`,[...es.values,lower,upper]);
    const linkedMatchIds = unique(engineFixtures.map(e=>e.match_id));
    let matches = await paged(`SELECT m.* FROM matches m WHERE ${ms.sql} AND ((COALESCE(m.confirmed_date,m.scheduled_date)>=? AND COALESCE(m.confirmed_date,m.scheduled_date)<?)${linkedMatchIds.length ? ` OR m.id IN (${placeholders(linkedMatchIds)})` : ''}) ORDER BY m.id`,[...ms.values,lower,upper,...linkedMatchIds]);
    const fixtureIds = unique([...engineFixtures.map(e=>e.legacy_fixture_id),...matches.map(m=>m.source_fixture_id)]);
    const jsonField = key => `JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(le.data_json),le.data_json,'{}'),'$.${key}'))`;
    const fixtureScope = clubs.length ? `(${jsonField('home_club_id')} IN (${placeholders(clubs)}) OR ${jsonField('away_club_id')} IN (${placeholders(clubs)}))` : '0=1';
    const kickoff = `COALESCE(NULLIF(${jsonField('confirmed_date')},'null'),NULLIF(${jsonField('scheduled_date')},'null'))`;
    const fixtures = (await paged(`SELECT le.* FROM league_entities le WHERE le.entity_type IN ('competition_fixture','regional_league_fixture') AND ${fixtureScope} AND ((${kickoff}>=? AND ${kickoff}<?)${fixtureIds.length ? ` OR le.id IN (${placeholders(fixtureIds)})` : ''}) ORDER BY le.id`,[...clubs,...clubs,lower,upper,...fixtureIds])).map(unpack);
    const extraMatchIds = unique(fixtures.map(f=>f.match_id));
    const sourceIds = unique([...fixtures.map(f=>f.id),...engineFixtures.map(f=>f.id)]);
    if (extraMatchIds.length || sourceIds.length) {
      const linked = await paged(`SELECT m.* FROM matches m WHERE ${ms.sql} AND (${[extraMatchIds.length && `m.id IN (${placeholders(extraMatchIds)})`,sourceIds.length && `m.source_fixture_id IN (${placeholders(sourceIds)})`].filter(Boolean).join(' OR ')}) ORDER BY m.id`,[...ms.values,...extraMatchIds,...sourceIds]);
      matches = [...new Map([...matches,...linked].map(m=>[m.id,m])).values()];
    }
    const ids = unique([...fixtures.flatMap(f=>[f.season_id,f.league_id,f.competition_id]),...engineFixtures.map(e=>e.legacy_source_id),...matches.map(m=>m.tournament_id).filter(id=>id!=='ranked')]);
    const parents = ids.length ? (await query(`SELECT * FROM league_entities WHERE id IN (${placeholders(ids)})`,ids)).map(unpack) : [];
    const competitionIds = unique(parents.map(p=>p.competition_id));
    if (competitionIds.length) parents.push(...(await query(`SELECT * FROM league_entities WHERE id IN (${placeholders(competitionIds)})`,competitionIds)).map(unpack));
    const tournamentIds = unique(matches.map(m=>m.tournament_id).filter(id=>id!=='ranked'));
    if (tournamentIds.length) parents.push(...await query(`SELECT id,name,status FROM tournaments WHERE id IN (${placeholders(tournamentIds)})`,tournamentIds));
    if (matches.length) {
      const accepted = await query(`SELECT related_entity_id FROM inbox_messages WHERE related_entity_type='match' AND status='accepted' AND action_type='accept_decline_date' AND related_entity_id IN (${placeholders(matches)})`,matches.map(m=>m.id));
      const acceptedIds = new Set(accepted.map(a=>a.related_entity_id));
      matches = matches.map(m=>({...m,accepted_invitation:acceptedIds.has(m.id)}));
    }
    if (matches.length || fixtures.length || engineFixtures.length) {
      const clubIds = unique([...matches,...fixtures,...engineFixtures].flatMap(m=>[m.home_club_id,m.away_club_id]));
      const playerIds = unique([...matches,...engineFixtures].flatMap(m=>[m.home_player_id,m.away_player_id,m.player_home_id,m.player_away_id]));
      const badges = clubIds.length ? await query(`SELECT id,name,logo_url FROM clubs WHERE id IN (${placeholders(clubIds)})`,clubIds) : [];
      const players = playerIds.length ? await query(`SELECT id,avatar_url,gamertag FROM players WHERE id IN (${placeholders(playerIds)})`,playerIds) : [];
      const avatars = new Map([...badges.map(c=>[c.id,c.logo_url]),...players.map(p=>[p.id,p.avatar_url])]);
      const names = new Map([...badges.map(c=>[c.id,c.name]),...players.map(p=>[p.id,p.gamertag])]);
      const enrich = m => ({...m,home_club_name:m.home_club_name || names.get(m.home_club_id),away_club_name:m.away_club_name || names.get(m.away_club_id),home_player_name:m.home_player_name || names.get(m.home_player_id),away_player_name:m.away_player_name || names.get(m.away_player_id),home_avatar_url:avatars.get(m.home_club_id || m.home_player_id),away_avatar_url:avatars.get(m.away_club_id || m.away_player_id)});
      matches = matches.map(enrich);
      fixtures.forEach(f=>Object.assign(f,enrich(f)));
      engineFixtures.forEach(f=>Object.assign(f,enrich(f)));
    }
    return { timezone, today:dateKey(new Date(),timezone), hasClub:Boolean(identity.memberClub || identity.club), identityKey:`${userId}:${player}:${clubs.join(',')}`, events:normalizeCalendarEvents({ matches,fixtures,engineFixtures,parents,identity,timezone,...options }) };
  };
}
module.exports = { createCalendarService, normalizeCalendarEvents, validateCalendarQuery, dateKey, categoryFor };
