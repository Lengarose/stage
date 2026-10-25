'use strict';
const parse=value=>{try{return typeof value==='string'?JSON.parse(value):value||{};}catch{return {};}};
const formatNames={knockout:'Knockout',group_stage:'Group Stage',groups_knockout:'Group Stage',swiss_ucl:'UCL/Swiss',swiss:'UCL/Swiss',league:'League',league_36_8md:'UCL/Swiss',double_elimination:'Double Elimination'};
function snapshot(proof,role,rankingEligible) {
  const {scope,winner,item}=proof,root=scope.root;
  const completed=root.completed_at||root.sporting_completed_at||null;
  const year=root.edition_year||root.year||(completed&&!Number.isNaN(new Date(completed).getTime())?new Date(completed).getUTCFullYear():null);
  const edition=proof.source_type==='tournament'?(year?String(year):'Edition unavailable'):(root.season_label||(root.season_number?`Season ${root.season_number}`:'Season unavailable'));
  const name=root.name||root.competition_name||'Competition name unavailable';
  const registered=parse(root[root.participant_type==='player'?'registered_players':'registered_club_ids']||root.registered_clubs||[]);
  const ids=(Array.isArray(registered)&&registered.length?registered:scope.participants.map(p=>p.id)).filter(Boolean).map(String);
  const runner=scope.participants.find(p=>String(p.id)===String(proof.runner_up));
  return {version:1,display_name:`${name} Trophy — ${edition}`,competition_name:name,edition_label:edition,edition_year:year,winning_id:winner,winning_name:scope.participants.find(p=>String(p.id)===winner)?.name||scope.participants.find(p=>String(p.id)===winner)?.gamertag||root.winner_club_name||root.winner_player_name||'Winner name unavailable',runner_up_id:proof.runner_up||null,runner_up_name:runner?.name||runner?.gamertag||null,format:formatNames[root.type||root.format]||root.type||root.format||'Format unavailable',participant_type:root.participant_type||'club',participant_count:new Set(ids).size,completed_at:completed,archive_path:proof.source_type==='tournament'?`/tournaments/${proof.source_id}`:root.slug?`/${proof.source_type==='regional_league'?'leagues':'competitions'}/${root.slug}`:null,image_url:item?.image_url||null,design_name:item?.name||null,award_role:role,ranking_eligible:!!rankingEligible};
}
function durable(award) {
  const data=parse(award.metadata_json);
  const recipient=data.award_role==='associated_player'?award.winning_club_id:award.owner_id;
  return data.version===1&&String(data.winning_id)===String(recipient)&&award.status==='earned';
}
function titleSummary(awards) {
  const all=new Set(),official=new Set();
  for(const award of awards)if(durable(award)) {
    const data=parse(award.metadata_json),key=[award.source_type,award.source_id,award.edition_id,data.award_role].join(':');
    all.add(key);if(data.ranking_eligible&&data.award_role!=='associated_player')official.add(key);
  }
  return {all_time:all.size,official_ranking:official.size};
}
module.exports={parse,snapshot,durable,titleSummary,formatNames};
