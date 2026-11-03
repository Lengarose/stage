'use strict';
const {EXECUTESQL}=require('../db/database');
function createService({query=EXECUTESQL,prizes=require('./competitionPrizeService')}={}) {
  async function action(id,input,actor) {
    const [user]=actor?.id?await query('SELECT id,email,role_id FROM users WHERE id=?',[actor.id]):[];
    if(!user || user.role_id==null || ![0,2].includes(Number(user.role_id)))throw Object.assign(Error('Admin Cup rewards access required'),{status:403});
    if(!['review','adopt'].includes(input.action))throw Object.assign(Error('Choose review or adopt for Cup rewards'),{status:400});
    if(input.apply===true && !String(input.reason || '').trim())throw Object.assign(Error('Explain the reviewed Cup reward action'),{status:400});
    const options={apply:input.apply===true,admin:user,reason:input.reason || 'Read-only Cup reward review'};
    if(input.action==='adopt')return prizes.adoptConfiguration('regional_cup_edition',id,{...options,version:require('../lib/regionalCupRewards').VERSION});
    return prizes.review('regional_cup_edition',id,options);
  }
  return {action};
}
module.exports={createService,...createService()};
