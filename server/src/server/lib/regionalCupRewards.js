'use strict';
const {cents}=require('./competitionPrizes');
const VERSION='regional_cup_rewards_v1';
function configuration(edition) {
  return {model:VERSION,version:VERSION,funding:'system',budget:'10000000.00',entry_fee:'0.00',
    source_type:'regional_cup',source_id:edition.permanent_cup_id,edition_id:edition.id,
    roster:edition.participant_ids.slice().sort(),trophy_item_id:edition.trophy_snapshot?.id || null,
    trophy_snapshot:edition.trophy_snapshot || null,
    rows:[{component_key:'winner_bonus',position:1,stc_amount:'7000000.00'},{component_key:'runner_up_bonus',position:2,stc_amount:'3000000.00'}]};
}
function validate(config,edition) {
  const expected=configuration(edition);
  if(!config || config.model!==VERSION || config.version!==VERSION || config.funding!=='system' || config.entry_fee!=='0.00'
    || config.source_type!=='regional_cup' || config.source_id!==edition.permanent_cup_id || config.edition_id!==edition.id
    || JSON.stringify(config.roster)!==JSON.stringify(expected.roster)
    || JSON.stringify(config.rows)!==JSON.stringify(expected.rows) || cents(config.budget)!==cents(expected.budget)
    || !config.trophy_item_id || config.trophy_item_id!==edition.trophy_snapshot?.id
    || JSON.stringify(config.trophy_snapshot)!==JSON.stringify(edition.trophy_snapshot))throw Object.assign(Error('Captured Cup rewards or trophy require authorised review'),{status:409});
  return config;
}
module.exports={VERSION,configuration,validate};
