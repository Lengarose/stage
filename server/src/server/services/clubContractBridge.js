'use strict';

const {
  EXECUTESQL
} = require('../db/database');
const service = require('./clubAgreementService');
async function offer(body, actor) {
  const proposal = await service.offer({
    ...body,
    club_id: body.team_id,
    player_id: body.target_player_id || body.user_id,
    squad_role: body.contract_type || 'squad'
  }, actor);
  return {
    success: true,
    data: {
      proposal,
      proposal_id: proposal.id,
      contract_id: proposal.id,
      contract: {
        ...proposal,
        user_id: proposal.player_id,
        team_id: proposal.club_id,
        contract_type: proposal.squad_role || 'squad'
      },
      status: proposal.status
    }
  };
}
async function handle(body) {
  const actor = {
    id: body._auth_user_id
  };
  if (body.action === 'offer') return offer(body, actor);
  if (!body.contract_id) return null;
  const [stored] = await EXECUTESQL("SELECT * FROM league_entities WHERE entity_type='club_contract_proposal' AND id=?", [body.contract_id]);
  if (stored) {
    const map = {
      accept: 'accept',
      reject: 'decline',
      counter: 'counter',
      cancel_offer: 'withdraw'
    };
    if (!map[body.action]) throw Object.assign(new Error('Use the current Board proposal response action'), {
      status: 409
    });
    const p = await service.respond(body.contract_id, {
      ...body,
      action: map[body.action]
    }, actor);
    return {
      success: true,
      data: {
        proposal: p,
        contract_id: p.id,
        status: p.status
      }
    };
  }
  const [contract] = await EXECUTESQL('SELECT * FROM player_contracts WHERE id=? LIMIT 1', [body.contract_id]);
  if (body.action === 'renewal_offer' && contract) return offer({
    ...body,
    team_id: contract.team_id,
    target_player_id: contract.user_id,
    contract_type: ['founder', 'founder_player'].includes(contract.contract_type) ? 'squad' : contract.contract_type,
    purpose: 'renewal'
  }, actor);
  if(contract?.compensation_policy_version&&body.action==='terminate') {
    const [row]=await EXECUTESQL("SELECT id FROM league_entities WHERE entity_type='club_agreement' AND JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.player_contract_id'))=? AND status='active'",[contract.id]);
    if(!row)throw Object.assign(new Error('Active paid agreement not found'),{status:409});
    return {success:true,data:await service.terminate(row.id,actor)};
  }
  if (contract?.compensation_policy_version) throw Object.assign(new Error('Use the current agreement proposal; paid terms cannot be mutated directly'), {
    status: 409
  });
  if (body.action === 'counter' && contract?.status === 'active') {
    return offer({
      ...body,
      team_id: contract.team_id,
      target_player_id: contract.user_id,
      contract_type: ['founder', 'founder_player'].includes(contract.contract_type) ? 'squad' : contract.contract_type,
      purpose: 'amendment'
    }, actor);
  }
  return null;
}
module.exports = {
  handle,
  offer
};
