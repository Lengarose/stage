const { EXECUTESQL } = require('../db/database');
const {snapshot}=require('../lib/trophyHistory');

async function loadTrophyContext({query,trophyItemId,tournament={}}) {
  const kind=tournament._source_type||'tournament',id=tournament._source_id||tournament.id;
  const service=require('./trophyEntitlementService');
  let proof;
  if(trophyItemId) proof=await service.verifiedDesign(kind,id,trophyItemId,query);
  else {
    const {scope,winner}=await service.outcome(kind,id,query);
    proof={scope,winner,item:null,source_type:kind,source_id:id,edition_id:scope.edition_id};
  }
  let rankingEligible=kind!=='tournament'||(!proof.scope.root.creator_id&&!proof.scope.root.creator_gamertag);
  if(kind==='tournament'&&!rankingEligible) {
    const root=proof.scope.root;
    const admins=await query('SELECT id FROM users WHERE role_id IN (0,2) AND email IN (?,?)',[root.creator_email||'',root.organizer_email||'']);
    rankingEligible=admins.length>0;
  }
  return {proof,trophyItemId:proof.item?.id||null,rankingEligible};
}

async function awardPlacement({query,ownerId,ownerType,context}) {
  if(!ownerId||!context)return {awarded:false,reason:'missing_owner'};
  const proof=context.proof,clubWin=proof.scope.root.participant_type!=='player';
  const role=ownerType==='club'?'club_champion':clubWin?'associated_player':'player_champion';
  const id=await new (require('../models/trophyAwardModel'))().create({
    owner_id:ownerId,owner_type:ownerType,trophy_item_id:context.trophyItemId,
    source_type:proof.source_type,source_id:proof.source_id,edition_id:proof.edition_id,
    winning_club_id:clubWin?proof.winner:null,award_role:role,
    metadata_json:{...snapshot(proof,role,context.rankingEligible),...(role==='club_champion'?{honoured_player_ids:context.playerIds||[],associated_history_unavailable:!!context.historicalBackfill}: {})}
  },query);
  return {awarded:true,award_id:id};
}

async function selectActiveClubPlayerIds({ query, clubId }) {
  if (!clubId) return [];
  const rows = await query(
    `SELECT DISTINCT p.id
       FROM players p
       LEFT JOIN club_memberships cm
         ON cm.player_id = p.id
        AND cm.club_id = ?
        AND cm.status = 'active'
       LEFT JOIN player_contracts pc
         ON pc.user_id = p.id
        AND pc.team_id = ?
        AND pc.status = 'active'
        AND COALESCE(pc.contract_type, '') <> 'ownership'
      WHERE p.club_id = ?
         OR cm.id IS NOT NULL
         OR pc.id IS NOT NULL`,
    [clubId, clubId, clubId]
  );
  return [...new Set(rows.map(row => row.id).filter(Boolean).map(String))];
}

async function awardClubTrophyToClubAndPlayers({
  clubId,
  trophyItemId,
  tournamentId,
  tournament = {},
  query = EXECUTESQL,
}) {
  const resolvedTrophyItemId = trophyItemId || tournament.trophy_item_id;
  const context = await loadTrophyContext({ query, trophyItemId: resolvedTrophyItemId, tournament:{...tournament,id:tournament.id||tournamentId} });
  if (!context || !clubId) return { awarded: false, reason: 'missing_trophy_or_winner' };
  if(context.proof.scope.root.participant_type==='player'||String(clubId)!==context.proof.winner)throw Object.assign(new Error('Only the authoritative winning club earns this trophy'),{status:409});
  const previous=await new (require('../models/trophyAwardModel'))().selectAll({owner_id:clubId,owner_type:'club',source_type:context.proof.source_type,source_id:context.proof.source_id,edition_id:context.proof.edition_id},query);
  if(previous.some(a=>a.status==='revoked'&&(a.award_key||String(a.revoked_reason||'').startsWith('[history-reset]'))))return {awarded:false,reason:'revoked_history'};
  const historic=previous.find(a=>require('../lib/trophyHistory').durable(a));
  context.historicalBackfill=!!tournament._historical_backfill&&!historic;
  context.playerIds=historic?require('../lib/trophyHistory').parse(historic.metadata_json).honoured_player_ids||[]:context.historicalBackfill?(await new (require('../models/trophyAwardModel'))().selectAll({owner_type:'player',source_type:context.proof.source_type,source_id:context.proof.source_id,edition_id:context.proof.edition_id,status:'earned'},query)).filter(a=>a.winning_club_id===clubId).map(a=>a.owner_id):await selectActiveClubPlayerIds({query,clubId});

  const club = await awardPlacement({
    query,
    ownerId: clubId,
    ownerType: 'club',
    context,
    tournamentId: tournamentId || tournament.id,
  });
  const playerIds = context.playerIds;
  const players = [];
  for (const playerId of playerIds) {
    players.push(await awardPlacement({
      query,
      ownerId: playerId,
      ownerType: 'player',
      context,
      tournamentId: tournamentId || tournament.id,
    }));
  }

  await require('./competitionHistoryResetService').refreshCaches(query,clubId);
  return {
    awarded: Boolean(club.awarded || players.some(result => result.awarded)),
    club,
    players,
    player_count: playerIds.length,
  };
}

async function awardPlayerOnlyTrophy({
  playerId,
  trophyItemId,
  tournamentId,
  tournament = {},
  query = EXECUTESQL,
}) {
  const resolvedTrophyItemId = trophyItemId || tournament.trophy_item_id;
  const context = await loadTrophyContext({ query, trophyItemId: resolvedTrophyItemId, tournament:{...tournament,id:tournament.id||tournamentId} });
  if (!context || !playerId) return { awarded: false, reason: 'missing_trophy_or_winner' };
  if(context.proof.scope.root.participant_type!=='player'||String(playerId)!==context.proof.winner)throw Object.assign(new Error('Only the authoritative winning player earns this trophy'),{status:409});
  return awardPlacement({
    query,
    ownerId: playerId,
    ownerType: 'player',
    context,
    tournamentId: tournamentId || tournament.id,
  });
}

module.exports = {
  awardClubTrophyToClubAndPlayers,
  awardPlayerOnlyTrophy,
  selectActiveClubPlayerIds,
};
