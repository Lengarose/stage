'use strict';
const DAY = 86400000;
const decode = row => ({ ...JSON.parse(row.data_json || '{}'), id: row.id });
function playingState(player, contracts, agreements, now = new Date()) {
  const at = now.getTime();
  const documents = agreements.filter(a => a.player_id === player.id && a.kind === 'player');
  const mirrors = new Set(documents.map(a => a.player_contract_id).filter(Boolean));
  const records = [...documents, ...contracts.filter(c => c.user_id === player.id && c.contract_type !== 'ownership' && !mirrors.has(c.id)).map(c => ({ ...c, club_id:c.team_id, ends_at:c.end_date, player_contract_id:c.id }))];
  const future = records.filter(a => ['scheduled','pending_window'].includes(a.status) && Date.parse(a.ends_at) > at);
  const active = records.filter(a => a.status === 'active' && (!a.ends_at || Date.parse(a.ends_at) > at));
  const current = active.length === 1 ? active[0] : null;
  const remaining = current ? Date.parse(current.ends_at) - at : NaN;
  return { records, active, future, current, expiring:active.length === 1 && !future.length && remaining > 0 && remaining <= 14 * DAY, days_left:Math.ceil(remaining / DAY) };
}
async function load(query, playerId = null) {
  const contracts = await query("SELECT * FROM player_contracts WHERE status IN ('active','pending_window')" + (playerId ? ' AND user_id=?' : ''), playerId ? [playerId] : []);
  const rows = await query("SELECT * FROM league_entities WHERE entity_type='club_agreement' AND status IN ('active','scheduled')" + (playerId ? " AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.player_id'))=?" : ''), playerId ? [playerId] : []);
  return { contracts, agreements:rows.map(decode) };
}
async function read(query, now = new Date()) {
  const players = await query('SELECT * FROM players');
  const clubs = await query('SELECT id,name FROM clubs');
  const clubNames = new Map(clubs.map(c => [c.id,c.name]));
  const {contracts,agreements} = await load(query);
  const free_agents=[],expiring_players=[];
  for (const player of players) {
    const state = playingState(player,contracts,agreements,now);
    if (!state.active.length && !state.future.length && !clubNames.has(player.club_id)) free_agents.push(player);
    else if (state.expiring && clubNames.has(state.current.club_id) && (!player.club_id || player.club_id === state.current.club_id)) expiring_players.push({player,contract:{...state.current,team_id:state.current.club_id,user_id:player.id,end_date:state.current.ends_at,current_club_name:clubNames.get(state.current.club_id)},days_left:state.days_left});
  }
  expiring_players.sort((a,b)=>Date.parse(a.contract.end_date)-Date.parse(b.contract.end_date));
  return {free_agents,expiring_players};
}
async function signingContext(player, targetClubId, query, now = new Date(), excludingAgreementId = null) {
  const {contracts,agreements} = await load(query,player.id);
  const state = playingState(player,contracts,agreements.filter(a=>a.id!==excludingAgreementId),now);
  const future = state.future.filter(a=>a.id!==excludingAgreementId);
  const reject = message => { throw Object.assign(new Error(message),{status:409}); };
  if (future.length) reject('This player already has an accepted future agreement.');
  if (state.active.length) {
    if (!state.expiring || state.current.club_id === targetClubId) reject('A future signing is available only in the final 14 days of the current player agreement.');
    return {not_before:state.current.ends_at,source_club_id:state.current.club_id,source_contract_id:state.current.player_contract_id};
  }
  if (player.club_id && player.club_id !== targetClubId) reject('The current club membership must be released before an immediate signing.');
  return {not_before:null};
}
module.exports={read,load,playingState,signingContext};
