'use strict';
const { EXECUTESQL } = require('../db/database');
const { v5: uuid } = require('uuid');
const { parse } = require('../lib/standsPolicy');
const recordId = (kind, key) => uuid(`stands:${kind}:${key}`, uuid.URL);
class StandsModel {
  async selectOne(kind,key,q=EXECUTESQL) { const [r] = await q('SELECT * FROM league_entities WHERE id=? AND entity_type=?',[recordId(kind,key),`stands_${kind}`]); return r ? parse(r.data_json) : null; }
  async selectAll(kind,q=EXECUTESQL) { return (await q('SELECT * FROM league_entities WHERE entity_type=? ORDER BY created_date DESC',[`stands_${kind}`])).map(r => parse(r.data_json)); }
  async create(kind,key,value,q=EXECUTESQL) { const id=recordId(kind,key); await q('INSERT INTO league_entities (id,entity_type,season_id,status,data_json) VALUES (?,?,?,?,?) ON DUPLICATE KEY UPDATE data_json=VALUES(data_json),status=VALUES(status),updated_date=NOW()',[id,`stands_${kind}`,value.match_id || null,value.status || 'active',JSON.stringify(value)]); return value; }
  async update(kind,key,value,q=EXECUTESQL) { return this.create(kind,key,value,q); }
  async delete(kind,key,q=EXECUTESQL) { return q('DELETE FROM league_entities WHERE id=? AND entity_type=?',[recordId(kind,key),`stands_${kind}`]); }
  async match(id,q=EXECUTESQL,lock=false) { const [m]=await q('SELECT * FROM matches WHERE id=?'+(lock?' FOR UPDATE':''),[id]); return m; }
  async directory({q:search='',view='all',competition='',limit=24,offset=0}={},query=EXECUTESQL) {
    const filter=["m.status NOT IN ('cancelled','canceled','reset','deleted','voided','superseded','abandoned')"],values=[];
    if(search){filter.push('(COALESCE(NULLIF(m.home_club_name,\'\'),m.home_player_name,\'\') LIKE ? OR COALESCE(NULLIF(m.away_club_name,\'\'),m.away_player_name,\'\') LIKE ? OR t.name LIKE ?)');values.push(...Array(3).fill(`%${search.slice(0,100)}%`));}
    if(competition){const at=competition.indexOf(':'),kind=competition.slice(0,at),key=competition.slice(at+1);if(kind==='tournament'){filter.push('m.tournament_id=?');values.push(key);}else{filter.push("m.source_fixture_type=? AND (m.competition_context=? OR JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(m.competition_context),m.competition_context,'{}'),'$.edition_id'))=? OR JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(m.competition_context),m.competition_context,'{}'),'$.season_id'))=? OR JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(m.competition_context),m.competition_context,'{}'),'$.competition_season_id'))=? OR JSON_UNQUOTE(JSON_EXTRACT(IF(JSON_VALID(m.competition_context),m.competition_context,'{}'),'$.league_id'))=?)");values.push(kind,key,key,key,key,key);}}
    if(view==='live')filter.push("m.status='in_progress'");
    if(view==='upcoming')filter.push("m.status IN ('scheduled','confirmed','unscheduled')");
    if(view==='featured')filter.push("(m.type IN ('final','semi_final','ucl_sf','playoff','ucl_playoff') OR EXISTS(SELECT 1 FROM league_entities f WHERE f.entity_type='stands_feature' AND f.season_id=m.id AND f.status='active'))");
    const rows=await query(`SELECT m.*,t.name AS tournament_name, hc.logo_url AS home_club_avatar,ac.logo_url AS away_club_avatar,hp.avatar_url AS home_player_avatar,ap.avatar_url AS away_player_avatar FROM matches m LEFT JOIN tournaments t ON t.id=m.tournament_id LEFT JOIN clubs hc ON hc.id=m.home_club_id LEFT JOIN clubs ac ON ac.id=m.away_club_id LEFT JOIN players hp ON hp.id=m.home_player_id LEFT JOIN players ap ON ap.id=m.away_player_id WHERE ${filter.join(' AND ')} ORDER BY (m.status='in_progress') DESC, COALESCE(m.confirmed_date,m.scheduled_date,m.created_date) ${view==='upcoming'?'ASC':'DESC'},m.id LIMIT ? OFFSET ?`,[...values,Math.min(50,Math.max(1,Number(limit)||24)),Math.max(0,Number(offset)||0)]);
    return rows;
  }
}
module.exports = { StandsModel, recordId };
