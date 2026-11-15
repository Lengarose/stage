'use strict';
const { EXECUTESQL } = require('../db/database');
const { isConfirmedResult } = require('../lib/tournamentStatistics');
const gostAccess=require('../lib/gostAccessPolicy.json');
const { normalizeMatchForApi, resolveTimeZone } = require('../utils/datetime');
const parse = (v, fallback = {}) => { try { return typeof v === 'string' ? JSON.parse(v) : v || fallback; } catch { return fallback; } };
const yes = v => v === true || v === 1 || v === '1';
const safeLink = v => typeof v === 'string' && /^\/(?!\/)[^\\\r\n]*$/.test(v) ? v : '';
const stamp = v => new Date(v || 0).getTime() || 0;
const marks = ids => ids.map(()=>'?').join(',');
const suppressed = new Set(['achievement','ranking','motm','lifestyle','market','stadium','shirts','tickets','transfers']);
function presentArticle(row) {
  const editorial = parse(row.editorial);
  const kind = editorial.kind || (row.category && row.category!=='general'?row.category:row.type) || 'announcement';
  // Historic contract copy can contain private pay/negotiation details. Only
  // explicitly curated signings or the public agreement projection below appear.
  if ((!editorial.curated && !['app_update','announcement','trophy','tournament','competitions','league'].includes(kind)) || suppressed.has(kind) || (['contract','contracts'].includes(kind) && !editorial.curated)) return null;
  return { id:row.id,type:row.type,category:row.category,title:row.title,body:row.body || '',kind,section:editorial.section || (['app_update','announcement','maintenance'].includes(kind)?'updates':'competitions'),image_url:row.image_url || '',image_position:editorial.image_position || '50% 50%',image_zoom:editorial.image_zoom || 100,published_at:row.published_at,featured:yes(row.is_featured),placement:editorial.placement || 'standard',club_id:row.club_id,player_id:row.player_id,tournament_id:row.tournament_id,link:safeLink(row.link) || (row.tournament_id?`/tournaments/${encodeURIComponent(row.tournament_id)}`:row.club_id?`/clubs/${encodeURIComponent(row.club_id)}`:row.player_id?`/players/${encodeURIComponent(row.player_id)}`:''),action_label:editorial.action_label || 'Explore story',related_links:[] };
}
function competitionLink(row, type, definitions = []) {
  if (type === 'regional_cup_edition') return `/regional-cups?edition=${encodeURIComponent(row.id)}`;
  if (type === 'regional_league') return `/leagues/${encodeURIComponent(row.stable_slug || row.slug || row.id)}?season=${encodeURIComponent(row.id)}`;
  const parent = definitions.find(r=>r.id === row.competition_id);
  return parent?.slug ? `/competitions/${encodeURIComponent(parent.slug)}?season=${encodeURIComponent(row.id)}` : '/competitions';
}
async function feed(auth, options = {}, q = EXECUTESQL) {
  const [user] = await q('SELECT id,email,role_id,timezone FROM users WHERE id=?',[auth?.id]);
  if (!user) throw Object.assign(Error('Sign in to read STAGE Times.'),{status:401});
  const players = await q("SELECT id,club_id FROM players WHERE (user_id=? OR email=?) AND email NOT LIKE '%@stage-test.local' AND COALESCE(bio,'') NOT LIKE '%[STAGE TEST PACK]%'",[user.id,user.email]);
  const playerIds = players.map(p=>p.id);
  const clubs = await q(`SELECT c.id FROM clubs c WHERE (c.president_user_id=? OR c.user_id=? OR c.owner_email=? OR c.id IN (SELECT club_id FROM players WHERE user_id=? OR email=?) OR c.id IN (SELECT club_id FROM club_memberships WHERE user_id=? AND status='active')) AND COALESCE(c.tier,'')<>'TEST' AND COALESCE(c.description,'') NOT LIKE '%[STAGE TEST PACK]%' AND c.owner_email NOT LIKE '%@stage-test.local'`,[user.id,user.id,user.email,user.id,user.email,user.id]);
  const clubIds = clubs.map(c=>c.id);
  const ids = [...clubIds,...playerIds];
  const clubJson = JSON.stringify(clubIds),playerJson = JSON.stringify(playerIds);
  const personal = `(n.club_id IN (${marks(clubIds) || 'NULL'}) OR n.player_id IN (${marks(playerIds) || 'NULL'}) OR JSON_OVERLAPS(COALESCE(n.visible_to_club_ids,JSON_ARRAY()),CAST(? AS JSON)) OR JSON_OVERLAPS(COALESCE(n.visible_to_player_ids,JSON_ARRAY()),CAST(? AS JSON)) OR n.tournament_id IN (SELECT t.id FROM tournaments t WHERE JSON_OVERLAPS(COALESCE(t.registered_clubs,JSON_ARRAY()),CAST(? AS JSON)) OR JSON_OVERLAPS(COALESCE(t.registered_players,JSON_ARRAY()),CAST(? AS JSON))))`;
  const personalArgs=[...clubIds,...playerIds,clubJson,playerJson,clubJson,playerJson];
  const records = await q(`SELECT n.*,${personal} AS personal FROM news_items n WHERE COALESCE(n.publication_status,'published')='published' AND n.published_at<=NOW() AND (n.expires_at IS NULL OR n.expires_at>NOW()) AND (${personal} OR (JSON_LENGTH(COALESCE(n.visible_to_club_ids,JSON_ARRAY()))=0 AND JSON_LENGTH(COALESCE(n.visible_to_player_ids,JSON_ARRAY()))=0 AND (n.type IN ('app_update','announcement') OR JSON_EXTRACT(n.editorial,'$.curated')=true))) AND ((JSON_LENGTH(COALESCE(n.visible_to_club_ids,JSON_ARRAY()))=0 AND JSON_LENGTH(COALESCE(n.visible_to_player_ids,JSON_ARRAY()))=0) OR JSON_OVERLAPS(COALESCE(n.visible_to_club_ids,JSON_ARRAY()),CAST(? AS JSON)) OR JSON_OVERLAPS(COALESCE(n.visible_to_player_ids,JSON_ARRAY()),CAST(? AS JSON))) AND NOT EXISTS(SELECT 1 FROM clubs c WHERE c.id=n.club_id AND (c.tier='TEST' OR c.description LIKE '%[STAGE TEST PACK]%' OR c.owner_email LIKE '%@stage-test.local')) AND NOT EXISTS(SELECT 1 FROM players p WHERE p.id=n.player_id AND (p.bio LIKE '%[STAGE TEST PACK]%' OR p.email LIKE '%@stage-test.local'))`,[...personalArgs,...personalArgs,clubJson,playerJson]);
  const stories=records.map(row=>{const s=presentArticle(row);return s?{...s,personal:yes(row.personal)}:null;}).filter(Boolean);
  // A curated public match preview uses exactly the same real participant art;
  // its destination is The Stands, never another participant's private GameDay.
  for (const record of records) {
    const mid=parse(record.editorial).match_id;
    const story=stories.find(s=>s.id===record.id);
    if(!mid||!story)continue;
    const [m]=await q("SELECT m.*,hc.logo_url AS home_avatar,ac.logo_url AS away_avatar,hp.avatar_url AS home_player_avatar,ap.avatar_url AS away_player_avatar FROM matches m LEFT JOIN clubs hc ON hc.id=m.home_club_id LEFT JOIN clubs ac ON ac.id=m.away_club_id LEFT JOIN players hp ON hp.id=m.home_player_id LEFT JOIN players ap ON ap.id=m.away_player_id WHERE m.id=? AND m.status NOT IN ('cancelled','canceled','deleted','voided','reset','superseded') AND COALESCE(hc.tier,'')<>'TEST' AND COALESCE(ac.tier,'')<>'TEST' AND COALESCE(hp.email,'') NOT LIKE '%@stage-test.local' AND COALESCE(ap.email,'') NOT LIKE '%@stage-test.local' AND COALESCE(hc.owner_email,'') NOT LIKE '%@stage-test.local' AND COALESCE(ac.owner_email,'') NOT LIKE '%@stage-test.local'",[mid]);
    if(!m){stories.splice(stories.indexOf(story),1);continue;}
    story.match={homeAvatarUrl:m.home_avatar||m.home_player_avatar,awayAvatarUrl:m.away_avatar||m.away_player_avatar};
    story.link=`/the-stands?match=${encodeURIComponent(mid)}`;story.action_label='Open Match Centre';
  }
  // Read the real scheduled Matches used by GameDay, including official fixture
  // projections; never create a parallel schedule or publish pending scores.
  if (ids.length) {
    const matches=await q(`SELECT m.*,t.name AS tournament_name,hc.logo_url AS home_club_avatar,ac.logo_url AS away_club_avatar,hp.avatar_url AS home_player_avatar,ap.avatar_url AS away_player_avatar FROM matches m LEFT JOIN tournaments t ON t.id=m.tournament_id LEFT JOIN clubs hc ON hc.id=m.home_club_id LEFT JOIN clubs ac ON ac.id=m.away_club_id LEFT JOIN players hp ON hp.id=m.home_player_id LEFT JOIN players ap ON ap.id=m.away_player_id WHERE (m.home_club_id IN (${marks(clubIds)||'NULL'}) OR m.away_club_id IN (${marks(clubIds)||'NULL'}) OR m.home_player_id IN (${marks(playerIds)||'NULL'}) OR m.away_player_id IN (${marks(playerIds)||'NULL'})) AND m.status IN ('scheduled','confirmed','in_progress','completed','forfeit') AND COALESCE(hc.tier,'')<>'TEST' AND COALESCE(ac.tier,'')<>'TEST' AND COALESCE(hp.email,'') NOT LIKE '%@stage-test.local' AND COALESCE(ap.email,'') NOT LIKE '%@stage-test.local' AND COALESCE(hc.owner_email,'') NOT LIKE '%@stage-test.local' AND COALESCE(ac.owner_email,'') NOT LIKE '%@stage-test.local'`,[...clubIds,...clubIds,...playerIds,...playerIds]);
    for (const raw of matches) {
      const m=normalizeMatchForApi(raw),confirmed=isConfirmedResult(m);
      if (!confirmed && (['completed','forfeit'].includes(m.status) || !m.scheduled_date || stamp(m.scheduled_date)<Date.now()-86400000 || stamp(m.scheduled_date)>Date.now()+14*86400000)) continue;
      const when=m.scheduled_date?new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZone:resolveTimeZone(user.timezone)}).format(new Date(m.scheduled_date)):'';
      const home=m.home_club_name||m.home_player_name||'Home',away=m.away_club_name||m.away_player_name||'Away';
      stories.push({id:`match:${m.id}`,title:confirmed?`${home} ${m.home_score}–${m.away_score} ${away}`:`${home} vs ${away}`,body:confirmed?'The result is confirmed. Open the match for the final score and recorded performance.':`Your next match is on the calendar. Kickoff: ${when} (${resolveTimeZone(user.timezone)}). Open GameDay to prepare your squad and review match details.`,kind:confirmed?'result':'match_preview',section:'competitions',club_id:clubIds.includes(m.home_club_id)?m.home_club_id:clubIds.includes(m.away_club_id)?m.away_club_id:null,personal:true,published_at:confirmed?(m.confirmed_date||m.scheduled_date):m.created_date,link:`/game-day?match=${encodeURIComponent(m.id)}`,action_label:'Open GameDay',source_edition_id:parse(m.competition_context)?.edition_id||parse(m.competition_context)?.season_id||m.competition_context,match:{homeAvatarUrl:m.home_club_avatar||m.home_player_avatar,awayAvatarUrl:m.away_club_avatar||m.away_player_avatar},related_links:[{label:'Watch in The Stands',link:`/the-stands?match=${encodeURIComponent(m.id)}`},...(m.tournament_id?[{label:m.tournament_name||'Tournament',link:`/tournaments/${encodeURIComponent(m.tournament_id)}`}]:[])]});
    }
  }
  // Live edition state, not speculative qualification. Season IDs remain in URLs.
  const entities=await q("SELECT id,entity_type,data_json,updated_date FROM league_entities WHERE entity_type IN ('regional_league','regional_cup_edition','competition_season','competition','club_agreement') AND (entity_type='competition' OR JSON_OVERLAPS(COALESCE(JSON_EXTRACT(data_json,'$.registered_club_ids'),JSON_EXTRACT(data_json,'$.participant_ids'),JSON_EXTRACT(data_json,'$.club_ids'),JSON_ARRAY()),CAST(? AS JSON)) OR club_id IN ("+(marks(clubIds)||'NULL')+'))',[clubJson,...clubIds]);
  const definitions=entities.filter(e=>e.entity_type==='competition').map(e=>({...parse(e.data_json),id:e.id}));
  for(const e of entities){
    const r={...parse(e.data_json),id:e.id};
    if(r.edition_invalidated || ['draft','cancelled','canceled','deleted','retired'].includes(r.status))continue;
    if(e.entity_type==='competition' || (e.entity_type==='competition_season'&&!gostAccess.qualifications_open))continue;
    if(e.entity_type==='club_agreement'){
      if(r.kind!=='player' || !['active','expired','terminated'].includes(r.status) || r.purpose==='renewal')continue;
      const [p]=await q("SELECT gamertag,bio,email FROM players WHERE id=?",[r.player_id]);
      const [c]=await q("SELECT name,tier,description,owner_email FROM clubs WHERE id=?",[r.club_id]);
      if(!p||!c||c.tier==='TEST'||`${p.bio} ${c.description}`.includes('[STAGE TEST PACK]')||`${p.email} ${c.owner_email}`.includes('@stage-test.local'))continue;
      stories.push({id:`signing:${e.id}`,title:`${p.gamertag} signed for ${c.name}`,body:`${c.name} welcomed ${p.gamertag} to the squad. Explore their player and club profiles. Contract terms remain private.`,kind:'signing',section:'club',personal:true,published_at:r.accepted_at||r.starts_at,link:`/players/${encodeURIComponent(r.player_id)}`,action_label:'Player profile',related_links:[{label:c.name,link:`/clubs/${encodeURIComponent(r.club_id)}`}]});
    }else{
      const link=competitionLink(r,e.entity_type,definitions);
      stories.push({id:`edition:${e.id}`,title:r.winner_club_name?`${r.winner_club_name} wins ${r.name||r.league_name||'the season'}`:`${r.name||r.league_name||'Your competition'} · ${String(r.status||'season update').replaceAll('_',' ')}`,body:`Follow the actual season, fixtures, standings and rewards.${r.season_number?` Season ${r.season_number}.`:''}`,kind:e.entity_type==='regional_cup_edition'?'regional_cup':e.entity_type==='competition_season'?'gost':'regional_league',section:'competitions',personal:true,published_at:e.updated_date,link,action_label:'Explore competition',related_links:[]});
    }
  }
  for(const story of stories){
    if(story.source_edition_id){const edition=entities.find(e=>e.id===story.source_edition_id);if(edition){const r={...parse(edition.data_json),id:edition.id};story.related_links.push({label:r.name||r.league_name||'Competition edition',link:competitionLink(r,edition.entity_type,definitions)});}}
  }
  // All source projections and audience decisions happen before pagination.
  const section=options.section||'for-you',search=String(options.q||'').trim().toLowerCase().slice(0,100);
  const filtered=stories.filter(s=>!search||`${s.title} ${s.body}`.toLowerCase().includes(search)).filter(s=>section==='club'?s.personal&&(s.section==='club'||s.club_id):section==='updates'?s.section==='updates':section==='community'?s.section==='community':section==='competitions'?s.section==='competitions':true);
  filtered.sort((a,b)=>Number(b.placement==='lead')-Number(a.placement==='lead')||Number(b.featured)-Number(a.featured)||Number(b.personal)-Number(a.personal)||stamp(b.published_at)-stamp(a.published_at)||a.id.localeCompare(b.id));
  const unique=[...new Map(filtered.map(s=>[s.id,s])).values()].filter(s=>!options.article||s.id===options.article);
  const offset=Math.min(100000,Math.max(0,Math.floor(Number(options.offset)||0))),limit=Math.min(30,Math.max(1,Math.floor(Number(options.limit)||12)));
  return {stories:unique.slice(offset,offset+limit),total:unique.length,has_more:offset+limit<unique.length,has_club:clubIds.length>0};
}
module.exports={feed,presentArticle,competitionLink,safeLink};
