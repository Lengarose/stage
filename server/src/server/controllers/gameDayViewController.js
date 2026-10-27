const express=require('express');
const {EXECUTESQL}=require('../db/database');
const {resolveUserIdentity}=require('../services/identityService');
const {identityClubs,matchAccess,select,presentMatch,previousMeetings,fail}=require('../services/gameDayViewService');
function createRouter({query=EXECUTESQL,resolveIdentity=resolveUserIdentity}={}) {
  const router=express.Router();
  const wrap=fn=>async(req,res)=>{try{if(!req.user?.id)throw fail('Authentication required.',401);await fn(req,res);}catch(e){res.status(e.status||500).json({error:e.message});}};
  router.get('/matches',wrap(async(req,res)=>{
    const identity=await resolveIdentity(req.user.id),clubs=identityClubs(identity),p=identity.player?.id||null;
    const limit=Number(req.query.limit||100),offset=Number(req.query.offset||0);
    if(!Number.isInteger(limit)||limit<1||limit>100||!Number.isInteger(offset)||offset<0)throw fail('Invalid pagination.',400);
    const where=`(m.home_player_id=? OR m.away_player_id=?${clubs.length?` OR m.home_club_id IN (${clubs.map(()=>'?')}) OR m.away_club_id IN (${clubs.map(()=>'?')})`:''})`;
    const rows=await query(`${select} WHERE ${where} ORDER BY m.scheduled_date DESC,m.id LIMIT ? OFFSET ?`,[p,p,...clubs,...clubs,limit,offset]);
    res.json(rows.map(presentMatch));
  }));
  router.get('/:id/history',wrap(async(req,res)=>{
    const {match,identity}=await matchAccess(req.user.id,req.params.id,query,resolveIdentity);
    if(!['all','same'].includes(req.query.scope||'all'))throw fail('Invalid history scope.',400);
    const limit=Number(req.query.limit||10),offset=Number(req.query.offset||0);
    if(!Number.isInteger(limit)||limit<1||limit>50||!Number.isInteger(offset)||offset<0)throw fail('Invalid pagination.',400);
    const kind=match.home_club_id?'club':'player',h=match[`home_${kind}_id`],a=match[`away_${kind}_id`];
    const [selected]=await query(`${select} WHERE m.id=?`,[match.id]);
    const rows=[];
    if(h&&a)for(let at=0;;at+=250) {
      const page=await query(`${select} WHERE ((m.home_${kind}_id=? AND m.away_${kind}_id=?) OR (m.home_${kind}_id=? AND m.away_${kind}_id=?)) AND m.status IN ('completed','forfeit') ORDER BY m.scheduled_date DESC,m.id LIMIT 250 OFFSET ?`,[h,a,a,h,at]);
      rows.push(...page);if(page.length<250)break;
    }
    // History follows the same participant visibility as the selected match, not a global archive endpoint.
    const view=require('../services/gameDayViewService');
    const result=previousMeetings(presentMatch(selected||match),rows.filter(r=>view.canReadMatch(r,identity)).map(r=>({...presentMatch(r),engine_fixture_id:r.engine_fixture_id})),req.query.scope==='same');
    res.json({...result,meetings:result.meetings.slice(offset,offset+limit),limit,offset});
  }));
  router.get('/:id/penalties',wrap(async(req,res)=>{
    const {match}=await matchAccess(req.user.id,req.params.id,query,resolveIdentity);
    const h=Number(req.query.home_score),a=Number(req.query.away_score);
    if(![h,a].every(n=>Number.isInteger(n)&&n>=0&&n<=99))throw fail('Valid home and away scores are required.',400);
    res.json(await require('../services/penaltyPolicyService').readPenaltyContext(match,h,a,query));
  }));
  return router;
}
module.exports=createRouter();module.exports.createRouter=createRouter;
