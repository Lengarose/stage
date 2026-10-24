'use strict';
const { EXECUTESQL } = require('../db/database');
const { CompetitionScopeModel } = require('../models/competitionScopeModel');
const { hasActivity } = require('../lib/tournamentProgression');
const order=['league','playoff_round','knockout_r16','knockout_qf','knockout_sf','knockout_final'];
async function assertFixtureCorrectionSafe(fixture,kind,patch,query=EXECUTESQL) {
  const changed=['home_score','away_score','status','result_state','winner_club_id','stats_processed','decided_on_penalties','penalty_winner_side'].some(k=>patch[k] !== undefined && String(patch[k]) !== String(fixture[k]));
  if (!changed || !['played','completed','forfeit'].includes(fixture.status)) return;
  const id=kind==='regional_league' ? fixture.league_id:fixture.season_id;
  if (!id) return;
  const scope=await new CompetitionScopeModel().selectOne(kind,id,query);
  const conflict=message=>{const e=new Error(message);e.status=409;throw e;};
  const paid=await query("SELECT id FROM competition_payouts WHERE source_type=? AND source_id=? AND edition_id=? AND status='paid' LIMIT 1",[kind,id,scope.edition_id]);
  if(paid.length || scope.root.status==='completed') conflict('Final placements or prizes are already established. Resolve financial and competition dependencies through authorised admin review before correcting this result.');
  const phase=fixture.phase || 'league';
  const later=scope.matches.filter(m=>order.indexOf(m.type)>order.indexOf(phase));
  if(later.some(hasActivity)) conflict('Downstream scheduling, reports or results exist. Admin review is required; the draw and historical activity were preserved.');
  if(later.length) conflict('An existing successor draw depends on this result. Reconcile its idle fixtures through admin review before applying the correction.');
}
async function assertMatchCorrectionSafe(match,patch,query=EXECUTESQL) {
  if (!match?.source_fixture_type || !['completed','forfeit'].includes(match.status)) return;
  const source=String(match.source_fixture_type);
  let fixtureId=match.source_fixture_id;
  if (source==='competition_engine') {
    const [mirror]=await query('SELECT legacy_fixture_id FROM competition_fixtures WHERE match_id=? LIMIT 1',[match.id]);
    fixtureId=mirror?.legacy_fixture_id;
  }
  if (!fixtureId || !['competition','regional_league','competition_engine','competition_fixture','regional_league_fixture'].includes(source)) return;
  const [row]=await query("SELECT * FROM league_entities WHERE id=? AND entity_type IN ('regional_league_fixture','competition_fixture')",[fixtureId]);
  if(!row) return;
  const fixture={...JSON.parse(row.data_json || '{}'),...Object.fromEntries(Object.entries(row).filter(([key,v])=>key!=='data_json' && v!=null))};
  await assertFixtureCorrectionSafe(fixture,row.entity_type==='regional_league_fixture' ? 'regional_league':'competition_season',patch,query);
}
module.exports={assertFixtureCorrectionSafe,assertMatchCorrectionSafe};
