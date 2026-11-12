'use strict';

const {
  EXECUTESQL,
  withTransaction
} = require('../db/database');
const {
  ClubBoardModel,
  stableId
} = require('../models/clubBoardModel');
const agreements = require('./clubAgreementService');
const {
  WEEK_MS,
  VERSION,
  managementOffer
} = require('../lib/clubBoardPolicy');
const reviewService = require('./clubBoardReviewService');
const parse = r => JSON.parse(r.data_json || '{}');
async function flushNotices(club, q, model) {
  for (const notice of (await model.selectAll('club_board_notice', club.id, q)).filter(n => n.status === 'pending')) {
    const player = await model.player(notice.recipient_player_id, q);
    if (!player?.email) continue;
    const id = stableId(['board_inbox', notice.id, player.id]);
    await q("INSERT INTO inbox_messages (id,recipient_email,sender_email,sender_gamertag,sender_club_name,subject,body,message_type,action_type,related_entity_id,related_entity_type,idempotency_key,is_system) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1) ON DUPLICATE KEY UPDATE id=id", [id, player.email, 'system@stage.com', 'Club Board', club.name, notice.subject, notice.body, 'general', 'none', notice.related_id || notice.id, 'club_board_notice', `board_notice:${notice.id}:${player.id}`]);
    await q("INSERT INTO notifications (id,recipient_email,type,title,body,link,related_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id", [stableId(['board_notification', id]), player.email, 'club_update', notice.subject, 'A new Club Board message is available.', '/inbox', notice.id, `board_notice:${notice.id}:${player.id}`]);
    await model.update('club_board_notice', {
      ...notice,
      status: 'sent'
    }, q);
  }
}
async function tickClub(clubId, now = new Date()) {
  return withTransaction(async q => {
    const model = new ClubBoardModel();
    await model.lock(clubId, q);
    const club = await model.club(clubId, q);
    if (!club) return;
    const records = await model.selectAll('club_agreement', clubId, q);
    for (const a of records.filter(a => a.status === 'scheduled' && Date.parse(a.starts_at) <= now.getTime())) {
      a.status = 'active';
      if (a.player_contract_id) {
        const player=await model.player(a.player_id,q);
        if(player.club_id&&player.club_id!==club.id){a.status='activation_review';await model.update('club_agreement',a,q);continue;}
        await q("UPDATE players SET club_id=?,status='active' WHERE id=?",[club.id,player.id]);
        await require('./clubMembershipService').upsertActiveMembership({clubId:club.id,playerId:player.id,userId:player.user_id,source:'agreement_renewal',query:q});
        await q("UPDATE player_contracts SET status='active' WHERE id=?", [a.player_contract_id]);
        await require('./contractRulesService').closeAcceptedContractConflicts({
          acceptedContract: {
            id: a.player_contract_id,
            user_id: a.player_id,
            team_id: club.id,
            contract_type: a.squad_role
          },
          query: q
        });
      }
      await model.update('club_agreement', a, q);
    }
    // Settle saved arrears before calculating new periods. The period receipt is
    // locked by the club mutex; a failed payment never advances its paid state.
    for (const debt of (await model.selectAll('club_payroll', clubId, q)).filter(r => r.status === 'arrears')) {
      const player = await model.player(debt.player_id, q);
      if (!player) continue;
      const payment = await agreements.pay(club, player, debt.amount_stc, debt.id, 'salary', q);
      if (payment.status === 'paid') await model.update('club_payroll', {
        ...debt,
        ...payment
      }, q);
    }
    for (const a of records.filter(a => ['active', 'expired'].includes(a.status))) {
      const player = await model.player(a.player_id, q);
      if (!player) continue;
      if(a.kind==='player'&&a.status==='active'&&a.player_contract_id){
        const [mirror]=await q('SELECT status,updated_date FROM player_contracts WHERE id=? FOR UPDATE',[a.player_contract_id]);
        if(mirror&&['terminated','completed','cancelled'].includes(mirror.status)){
          a.original_ends_at=a.ends_at;a.ends_at=new Date(Math.min(now.getTime(),Date.parse(a.ends_at))).toISOString();
          await agreements.accrue(a,club,player,q,now);a.status='terminated';await model.update('club_agreement',a,q);await agreements.detachPlayingMembership(club.id,player.id,q);continue;
        }
      }
      await agreements.accrue(a, club, player, q, now);
      if (a.status === 'expired' && a.player_contract_id) {await q("UPDATE player_contracts SET status='expired',updated_date=NOW() WHERE id=? AND compensation_policy_version=?", [a.player_contract_id, VERSION]);await agreements.detachPlayingMembership(club.id,a.player_id,q);}
    }
    const management = records.filter(a => a.kind === 'management' && a.status !== 'scheduled').sort((a, b) => b.accepted_at.localeCompare(a.accepted_at))[0];
    if (management) {
      const player = await model.player(management.player_id, q);
      if (player) {
        const assessment = await reviewService.reconcile(club, player, records, q, now, model);
        for (const milestone of ['midterm', 'renewal']) {
          const due = milestone === 'midterm' ? Date.parse(management.starts_at) + 6 * WEEK_MS : Date.parse(management.ends_at) - WEEK_MS;
          if (now.getTime() < due) continue;
          const id = stableId(['board_review', management.id, management.payroll_generation, milestone]);
          const previousReview=await model.selectOne('club_board_review',id,q);
          if(previousReview&&milestone!=='renewal')continue;
          if(!previousReview){
          const report = {
            id,
            club_id: club.id,
            agreement_id: management.id,
            policy_version: VERSION,
            status: 'recorded',
            milestone,
            reviewed_at: now.toISOString(),
            ...assessment
          };
          await model.create('club_board_review', report, q);
          await model.create('club_board_notice', {
            id: stableId(['review_notice', id]),
            club_id: club.id,
            recipient_player_id: player.id,
            status: 'pending',
            subject: milestone === 'midterm' ? 'Your mid-term management report' : 'Your management contract review',
            body: `Dear ${player.gamertag || 'Manager'},\n\n${milestone === 'midterm' ? 'We have reviewed progress at the midpoint of your management agreement.' : 'Your management agreement is approaching or has reached its expiry.'}\n\n${assessment.evidence.length ? 'Your official competition progress is available in Club Office. Unfinished seasons are progress evidence, not final results.' : 'There is no assessable official competition outcome for this period. We have applied no penalty for non-participation.'}\n\nYour assessment is ${assessment.grade}. Tournament results do not affect this salary review. Any new salary requires your acceptance and remains subject to club affordability.\n\nThe Club Board`,
            related_id: id
          }, q);
          }
          if (milestone === 'renewal') {
            const proposals = await model.selectAll('club_contract_proposal', club.id, q);
            const existingProposal=proposals.find(p=>p.id===stableId(['management_renewal',id]));
            if(existingProposal&& (existingProposal.status!=='pending'||existingProposal.review_grade===assessment.grade))continue;
            const offer = managementOffer({
              current: management.weekly_salary_stc,
              grade: assessment.grade,
              wageBudget: club.wage_budget_stc
            });
            const finance = await agreements.finance(club, q, {
              excluding: management.id,proposalId:existingProposal?.id
            });
            const weekly = Math.max(0, Math.min(offer.opening_weekly_salary_stc, finance.remaining_weekly_stc));
            if (weekly === 0) continue; // The review explains constraints; no unfunded promise.
            const p = {
              id: stableId(['management_renewal', id]),
              policy_version: VERSION,
              club_id: club.id,
              player_id: player.id,
              recipient_user_id: player.user_id,
              kind: 'management',
              origin: 'board',
              purpose: 'renewal',
              status: 'pending',
              version: 1,
              agreement_id: management.id,
              previous_weekly_salary_stc: management.weekly_salary_stc,
              weekly_salary_stc: weekly,
              signing_bonus_stc: 0,
              duration_type: 'fixed_12_weeks',
              not_before: management.ends_at,
              created_at: now.toISOString(),
              history: [],
              review_id: id,review_grade:assessment.grade,
              explanation: weekly < management.weekly_salary_stc ? 'The club’s financial capacity limits this future offer. Existing accepted pay remains unchanged.' : `Our combined official review is ${assessment.grade}. We propose these future terms; this is not an automatic raise.`
            };
            if(existingProposal){p.version=existingProposal.version+1;p.history=[...(existingProposal.history||[]),{version:existingProposal.version,action:'confirmed_outcome_review',previous_weekly_salary_stc:existingProposal.weekly_salary_stc,at:now.toISOString()}];await model.update('club_contract_proposal',p,q);}else await model.create('club_contract_proposal', p, q);
            await agreements.notify(p, player, club, q);
          }
        }
      }
    }
    await flushNotices(club, q, model);
    return {
      club_id: clubId,
      agreements: records.length
    };
  });
}
async function tick() {
  const clubs = await EXECUTESQL("SELECT DISTINCT club_id FROM league_entities WHERE entity_type='club_agreement' AND club_id IS NOT NULL");
  const errors = [];
  for (const c of clubs) try {
    await tickClub(c.club_id);
  } catch (e) {
    errors.push({
      club_id: c.club_id,
      message: e.message
    });
  }
  const matches = await EXECUTESQL("SELECT DISTINCT m.id FROM matches m JOIN league_entities s ON s.entity_type='official_match_selection' AND JSON_UNQUOTE(JSON_EXTRACT(s.data_json,'$.match_id'))=m.id WHERE JSON_UNQUOTE(JSON_EXTRACT(s.data_json,'$.card_xp_policy_version'))='stage_card_v1' UNION SELECT DISTINCT JSON_UNQUOTE(JSON_EXTRACT(data_json,'$.match_id')) AS id FROM league_entities WHERE entity_type='card_xp_award' AND status='earned'");
  for (const m of matches) try {
    await require('./cardProgressionService').reconcile(m.id);
  } catch (e) {
    errors.push({
      match_id: m.id,
      message: e.message
    });
  }
  const congratulations = await EXECUTESQL("SELECT a.* FROM trophy_awards a WHERE a.status='earned' AND JSON_UNQUOTE(JSON_EXTRACT(a.metadata_json,'$.congratulations_policy_version'))='trophy_congratulations_v1' AND NOT EXISTS (SELECT 1 FROM league_entities d WHERE d.entity_type='trophy_congratulations_delivery' AND JSON_UNQUOTE(JSON_EXTRACT(d.data_json,'$.award_id'))=a.id) ORDER BY a.created_date,a.id LIMIT 100");
  for (const award of congratulations) try {
    await withTransaction(q => require('./trophyCongratulationsService').deliver(award, q));
  } catch (e) {
    errors.push({
      award_id: award.id,
      message: e.message
    });
  }
  try {
    await withTransaction(q => require('./boardTournamentNotices').reconcile(q));
  } catch (e) {
    errors.push({
      tournament_notices: e.message
    });
  }
  return {
    errors
  };
}
function start() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const r = await tick();
      for (const e of r.errors) console.error('[club board recovery]', e);
    } catch (e) {
      console.error('[club board recovery]', e.message);
    } finally {
      running = false;
    }
  }, 60000);
  timer.unref();
  return timer;
}
module.exports = {
  tick,
  tickClub,
  start,
  flushNotices
};
