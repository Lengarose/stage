const express = require('express');
const { EXECUTESQL } = require('../db/database');
const { CompetitionScopeModel } = require('../models/competitionScopeModel');
const prizes = require('../services/competitionPrizeService');
const router = express.Router();
const model = new CompetitionScopeModel();
const categories = {
  participants: ['goals','conceded','fewest_conceded'],
  players: ['goals','assists','rating','awards','appearances'],
  goalkeepers: ['clean_sheets','conceded_per_match','rating'],
};
const pick = (row, keys) => Object.fromEntries(keys.filter(k => row[k] !== undefined).map(k => [k,row[k]]));
const matchFields = ['id','fixture_id','match_id','source_fixture_type','source_fixture_id','type','round','leg','group_number','home_club_id','away_club_id','home_club_name','away_club_name','home_score','away_score','status','result_state','stats_processed','scheduling_status','scheduled_date','confirmed_date','home_proposed_date','away_proposed_date','home_penalties','away_penalties','decided_on_penalties','penalty_winner_side','winner_club_id','video_url','stream_url'];
const wrap = fn => async (req,res) => { try { await fn(req,res); } catch(e) { res.status(e.status || 500).json({ error:e.message }); } };
router.get('/:kind/:id/statistics', wrap(async (req,res) => {
  const scope = await model.selectOne(req.params.kind,req.params.id);
  const stats = await model.statistics(scope);
  const { group, category } = req.query;
  if (group || category) {
    if (!categories[group]?.includes(category)) return res.status(400).json({error:'Invalid statistics category'});
    const offset = Number(req.query.offset || 0), limit = Number(req.query.limit || 50);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({error:'Invalid pagination'});
    const rows = stats[group][category];
    return res.json({rows:rows.slice(offset,offset+limit),total:rows.length,offset,limit,categories,completeness:stats.completeness});
  }
  res.json({...stats,categories});
}));
router.get('/:kind/:id', wrap(async (req,res) => {
  const scope = await model.selectOne(req.params.kind,req.params.id);
  if (req.query.review === 'standings') {
    if (!['regional_league','competition_season'].includes(req.params.kind)) return res.status(400).json({error:'Unsupported standings edition'});
    const report = require('../lib/standingIntegrity').reviewStandings(scope);
    return res.json(pick(report,['competition_id','edition_id','missing','duplicates','invalid','mismatches','conflicts','repairable','requires_review','expected']));
  }
  const ids = scope.participants.map(p => p.id);
  const clubs = ids.length ? await EXECUTESQL(`SELECT id,president_user_id,user_id,owner_email FROM clubs WHERE id IN (${ids.map(() => '?').join(',')})`,ids) : [];
  const [user] = await EXECUTESQL('SELECT id,email FROM users WHERE id=?',[req.user.id]);
  const allowed = clubs.filter(c => c.president_user_id === user?.id || c.user_id === user?.id || (user?.email && String(c.owner_email || '').toLowerCase() === user.email.toLowerCase())).map(c=>c.id);
  res.json({ root:pick(scope.root,['id','name','type','format','league_only','status','season_number','competition_id']),edition_id:scope.edition_id,participants:scope.participants.map(p=>pick(p,['id','name','gamertag','logo_url','avatar_url'])),matches:scope.matches.map(m=>({...pick(m,matchFields),can_schedule:allowed.includes(m.home_club_id)})),standings:scope.standings.map(s=>pick(s,['id','club_id','club_name','club_logo_url','club_tag','played','won','drawn','lost','wins','draws','losses','points','goals_for','goals_against','goal_difference','final_position','position','is_excluded','form','season_number','league_id','season_id','region','platform'])) });
}));
router.post('/:kind/:id/reconcile', wrap(async (req,res) => {
  const [admin] = await EXECUTESQL('SELECT id,email,role_id FROM users WHERE id=?',[req.user.id]);
  if (!admin || ![0,2].includes(Number(admin.role_id))) return res.status(403).json({error:'Admin access required'});
  const apply = req.body?.apply === true;
  if (apply && !String(req.body.reason || '').trim()) return res.status(400).json({error:'A reason is required to apply reconciliation'});
  if(req.body.action==='adopt_reward_configuration')return res.json(await prizes.adoptConfiguration(req.params.kind,req.params.id,{apply,admin,reason:req.body.reason,version:req.body.version}));
  if(req.body.action==='archive')return res.json(await prizes.archive(req.params.kind,req.params.id,{admin,reason:req.body.reason}));
  if(req.body.action==='capture_rewards') {
    if(!['regional_league','competition_season'].includes(req.params.kind))return res.status(400).json({error:'Unsupported reward capture source'});
    const captured=await prizes.capture(req.params.kind,req.params.id,{admin,reason:req.body.reason});
    if(!captured.config)return res.status(409).json({error:'Review and save the reward configuration before starting this edition'});
    return res.json({configuration:captured.config,state:'captured'});
  }
  if (req.body?.action === 'standings') return res.json(await require('../services/standingIntegrityService').reconcileStandings(req.params.kind, req.params.id, { apply, admin, reason: req.body.reason }));
  if (req.body?.action === 'progression') {
    if (!['regional_league','competition_season'].includes(req.params.kind)) return res.status(400).json({error:'Use tournament progression reconciliation for tournament draws'});
    const scope = await model.selectOne(req.params.kind,req.params.id);
    const phases = ['league','playoff_round','knockout_r16','knockout_qf','knockout_sf','knockout_final'];
    const phase = [...phases].reverse().find(p=>scope.matches.some(m=>m.type === p));
    const fixture = {league_id:req.params.kind === 'regional_league' ? req.params.id : null,season_id:req.params.kind === 'competition_season' ? req.params.id : null,phase};
    return res.json(await require('../services/competitionEngineService').advanceLeagueEdition(req.params.kind,fixture,{dryRun:!apply,admin:apply ? admin : null,reason:req.body.reason}));
  }
  res.json(await prizes.review(req.params.kind,req.params.id,{apply,admin:apply ? admin : null,reason:req.body?.reason}));
}));
module.exports = router;
