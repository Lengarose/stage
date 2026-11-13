'use strict';

const crypto = require('crypto');
const {
  EXECUTESQL,
  withTransaction
} = require('../db/database');
const {
  ClubBoardModel,
  stableId
} = require('../models/clubBoardModel');
const policy = require('../lib/clubBoardPolicy');
const {
  fail,
  money,
  WEEK_MS,
  VERSION
} = policy;
const parse = v => typeof v === 'string' ? JSON.parse(v) : v;
function createService({
  model = new ClubBoardModel(),
  query = EXECUTESQL,
  transaction = withTransaction,
  clock = () => new Date()
} = {}) {
  async function user(actor, q) {
    const [u] = await q('SELECT id,email,role_id FROM users WHERE id=? LIMIT 1', [actor?.id]);
    if (!u) fail('Sign in to manage an agreement', 401);
    return u;
  }
  function manager(club, u) {
    return club && (club.president_user_id === u.id || club.user_id === u.id || club.owner_email && String(club.owner_email).toLowerCase() === String(u.email).toLowerCase());
  }
  async function assertAccess(clubId, actor, q, permission = 'offer_contracts') {
    const u = await user(actor, q),
      club = await model.club(clubId, q);
    if (!club) fail('Club not found', 404);
    const mine = manager(club, u);
    if (!mine) {
      const access=await require('./clubOperationsService').getClubAccess(u,clubId);
      if(!access.permissions.includes(permission))fail('Club permission required',403);
    }
    return {
      u,
      club,
      manager: mine
    };
  }
  async function xp(playerId, q) {
    return (await require('./cardProgressionService').read(playerId, q)).total_xp;
  }
  async function finance(club, q, {
    excluding = null,
    proposalId = null
  } = {}) {
    const legacy = await q("SELECT id,user_id,weekly_salary_stc,signing_bonus_stc,transfer_fee_stc,status FROM player_contracts WHERE team_id=? AND status IN ('active','pending','pending_window','negotiating') AND contract_type<>'ownership' FOR UPDATE", [club.id]);
    const agreements = await model.selectAll('club_agreement', club.id, q),
      proposals = await model.selectAll('club_contract_proposal', club.id, q);
    const governed = new Set(agreements.filter(a => a.kind === 'player').map(a => a.player_contract_id).filter(Boolean));
    let committed = legacy.filter(r => !governed.has(r.id) && r.id !== excluding).reduce((n, r) => n + Number(r.weekly_salary_stc || 0), 0);
    committed += [...new Map(agreements.filter(a => a.id !== excluding && ['active', 'scheduled'].includes(a.status) && Date.parse(a.ends_at) > clock().getTime()).map(a => [`${a.player_id}:${a.kind}`, Math.max(...agreements.filter(b => b.player_id === a.player_id && b.kind === a.kind && b.id !== excluding && ['active', 'scheduled'].includes(b.status) && Date.parse(b.ends_at) > clock().getTime()).map(b => b.weekly_salary_stc))])).values()].reduce((n, value) => n + value, 0);
    // An amendment reserves only the increase over its existing agreement;
    // multiple pending proposals for the same scope cannot be created.
    for (const p of proposals.filter(p => p.status === 'pending' && p.id !== proposalId)) {
      const previous = agreements.find(a => a.id === p.agreement_id && a.status === 'active' && a.id !== excluding) || legacy.find(a => a.id === p.source_player_contract_id && a.id !== excluding);
      committed += Math.max(0, p.weekly_salary_stc - (previous?.weekly_salary_stc || 0));
    }
    const reservedBonus = proposals.filter(p => p.status === 'pending' && p.id !== proposalId).reduce((n, p) => n + Number(p.signing_bonus_stc || 0) + Number(p.transfer_fee_stc || 0), 0);
    return {
      wage_budget_stc: Number(club.wage_budget_stc || 0),
      committed_weekly_stc: committed,
      remaining_weekly_stc: Number(club.wage_budget_stc || 0) - committed,
      balance_stc: Number(club.stc || 0),
      reserved_signing_costs_stc: reservedBonus,
      transfer_budget_stc: Number(club.transfer_budget_stc || 0),
      pending_transfer_fees_stc: proposals.filter(p => p.status === 'pending' && p.id !== proposalId).reduce((n, p) => n + Number(p.transfer_fee_stc || 0), 0),
      agreements,
      proposals
    };
  }
  function affordable(report, weekly, bonus = 0, transfer = 0) {
    if (transfer + report.pending_transfer_fees_stc > report.transfer_budget_stc) fail('This offer exceeds the remaining transfer budget', 422);
    if (weekly > report.remaining_weekly_stc) fail('This offer exceeds the club’s remaining weekly wage budget', 422);
    if (bonus + transfer + report.reserved_signing_costs_stc > report.balance_stc) fail('The club cannot afford these signing costs', 422);
  }
  async function duration(input, kind, clubId, q, start = clock()) {
    if (kind === 'management') return {
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 12 * WEEK_MS).toISOString(),
      duration_type: 'fixed_12_weeks'
    };
    const type = input.duration_type;
    if (type === 'trial') return {
      starts_at: start.toISOString(),
      ends_at: new Date(start.getTime() + 14 * 86400000).toISOString(),
      duration_type: type
    };
    if (type === 'fixed_12_weeks') {
      const calendars = await q("SELECT * FROM league_entities WHERE entity_type='regional_calendar' AND status='published' FOR UPDATE");
      for (const row of calendars) {
        const calendar = parse(row.data_json),
          ids = calendar.edition_ids || [];
        const begins = Date.parse(`${calendar.start_monday}T00:00:00Z`);
        if (!ids.length || begins + 12 * WEEK_MS <= start.getTime()) continue;
        const editions = await q(`SELECT * FROM league_entities WHERE entity_type='regional_league' AND id IN (${ids.map(() => '?').join(',')}) FOR UPDATE`, ids);
        if (editions.some(r => parse(parse(r.data_json).registered_club_ids || '[]').includes(clubId))) fail('Choose the published season end for a participating club');
      }
      return {
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + 12 * WEEK_MS).toISOString(),
        duration_type: type
      };
    }
    if (!['current_season', 'next_season'].includes(type)) fail('Choose a published season end, a 12-week non-season agreement or Trial');
    const [row] = await q("SELECT * FROM league_entities WHERE entity_type='regional_calendar' AND status='published' AND id=? FOR UPDATE", [input.calendar_id]);
    if (!row) fail('Choose an actual published season calendar');
    const calendar = parse(row.data_json),
      ids = calendar.edition_ids || [];
    const sources = await q("SELECT * FROM league_entities WHERE entity_type='regional_league' AND id IN (" + (ids.length ? ids.map(() => '?').join(',') : 'NULL') + ") FOR UPDATE", ids);
    if (!sources.some(r => parse(parse(r.data_json).registered_club_ids || '[]').includes(clubId))) fail('The club is not confirmed in this published season');
    const begins = Date.parse(`${calendar.start_monday}T00:00:00Z`),
      end = begins + 12 * WEEK_MS;
    if (!Number.isFinite(end) || end <= start.getTime()) fail('The selected published season has ended');
    if (type === 'next_season' && begins <= start.getTime()) fail('Choose a future published season');
    if (type === 'current_season' && begins > start.getTime()) fail('This season has not started; choose next season');
    return {
      starts_at: start.toISOString(),
      ends_at: new Date(end).toISOString(),
      duration_type: type,
      calendar_id: row.id
    };
  }
  async function notify(proposal, player, club, q) {
    const clubTurn = proposal.origin === 'club' && proposal.last_proposed_by === 'player';
    const recipient = clubTurn ? (await q('SELECT email FROM users WHERE id=? LIMIT 1', [club.president_user_id || club.user_id]))[0]?.email || club.owner_email : player.email || (await q('SELECT email FROM users WHERE id=? LIMIT 1', [player.user_id]))[0]?.email;
    if (!recipient) fail('The recipient needs a linked Inbox account');
    const id = stableId(['board_notice', proposal.id, proposal.version, recipient]);
    const body = `Dear ${clubTurn ? 'Manager' : player.gamertag || 'Manager'},\n\n${clubTurn ? 'The player' : proposal.origin === 'board' ? 'The Club Board' : 'Your club'} would like you to review a ${proposal.kind === 'management' ? 'management' : 'player'} agreement with ${club.name}.\n\nThe proposed weekly salary is ${proposal.weekly_salary_stc.toLocaleString()} STC. The signing bonus is ${proposal.signing_bonus_stc.toLocaleString()} STC. Payments are weekly and begin only after accepted service has accrued.\n\n${proposal.explanation}\n\nPlease review the proposed terms to accept, decline or negotiate. Your existing accepted agreement remains unchanged while this proposal is pending.\n\n${proposal.origin === 'board' ? 'The Club Board' : `${club.name} Management`}`;
    await q(`INSERT INTO inbox_messages (id,recipient_email,sender_email,sender_gamertag,sender_club_name,subject,body,message_type,action_type,related_entity_id,related_entity_type,metadata,idempotency_key,is_read,status,is_system) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0,'pending',1) ON DUPLICATE KEY UPDATE id=id`, [id, recipient, 'system@stage.com', proposal.origin === 'board' ? 'Club Board' : club.name, club.name, `${proposal.kind === 'management' ? 'Management' : 'Player'} contract proposal — ${club.name}`, body, 'contract_offer', 'contract_offer', proposal.id, 'club_contract_proposal', JSON.stringify({
      proposal_id: proposal.id,
      proposal_version: proposal.version,
      club_id: club.id,
      contract_kind: proposal.kind,
      link: '/inbox'
    }), `board:${proposal.id}:${proposal.version}:${recipient}`]);
    await q("INSERT INTO notifications (id,recipient_email,type,title,body,link,related_id,idempotency_key) VALUES (?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE id=id", [stableId(['notice', id]), recipient, 'contract_offer', 'Club contract proposal', proposal.explanation, '/inbox', proposal.id, `board:${proposal.id}:${proposal.version}:${recipient}`]);
  }
  async function initial(club, player, actor, q = query, {managementOnly=false}={}) {
    await model.lock(club.id, q);
    const reports = await finance(club, q),
      created = [];
    for (const kind of managementOnly?['management']:['management', 'player']) {
      if (reports.proposals.some(p => p.kind === kind && p.player_id === player.id) || reports.agreements.some(a => a.kind === kind && a.player_id === player.id)) continue;
      const id = stableId(['initial_board_offer', club.id, kind, player.id]);
      const salary = kind === 'management' ? policy.managementOffer({
        wageBudget: club.wage_budget_stc
      }).opening_weekly_salary_stc : policy.salaryBand(await xp(player.id, q)).min;
      const p = {
        id,
        policy_version: VERSION,
        club_id: club.id,
        player_id: player.id,
        recipient_user_id: player.user_id || actor.id,
        kind,
        origin: 'board',
        purpose: 'signing',
        status: 'pending',
        version: 1,
        weekly_salary_stc: salary,
        signing_bonus_stc: 0,
        squad_role: kind === 'player' ? 'squad' : null,
        duration_type: 'fixed_12_weeks',
        created_at: clock().toISOString(),
        explanation: 'We are establishing the club. Competitive objectives will follow confirmed official competition entry.',
        history: []
      };
      const available = await finance(club, q);
      affordable(available, salary);
      await model.create('club_contract_proposal', p, q);
      await notify(p, player, club, q);
      await model.audit(actor, 'board_initial_offer', club.id, null, p, 'Initial Club Board proposal', q);
      created.push(p);
    }
    return created;
  }
  async function prepare(clubId,actor) {return transaction(async q=>{
    const {club,u,manager:isManager}=await assertAccess(clubId,actor,q);
    if(!isManager)fail('Only the club Manager may prepare personal Board offers',403);
    const [player]=await q('SELECT * FROM players WHERE id=? OR user_id=? ORDER BY id=? DESC LIMIT 1 FOR UPDATE',[club.president_player_id||'',club.president_user_id||club.user_id,club.president_player_id||'']);
    if(!player?.user_id)fail('The club Manager needs a linked player account',409);
    return {club_id:club.id,offers:await initial(club,player,u,q,{managementOnly:true}),historical_player_terms_preserved:true};
  });}
  async function detachPlayingMembership(clubId,playerId,q) {
    const [active]=await q("SELECT id FROM player_contracts WHERE team_id=? AND user_id=? AND status='active' AND contract_type<>'ownership' LIMIT 1 FOR UPDATE",[clubId,playerId]);
    if(active)return;
    await q("UPDATE players SET club_id=NULL,status='free_agent',updated_date=NOW() WHERE id=? AND club_id=?",[playerId,clubId]);
    await q("UPDATE club_memberships SET status='inactive',updated_date=NOW() WHERE club_id=? AND player_id=? AND status='active'",[clubId,playerId]);
  }
  async function terminate(id,actor) {return transaction(async q=>{
    const [seed]=await q("SELECT club_id FROM league_entities WHERE entity_type='club_agreement' AND id=?",[id]);if(!seed)fail('Agreement not found',404);
    await model.lock(seed.club_id,q);const a=await model.selectOne('club_agreement',id,q),u=await user(actor,q);
    if(a.kind!=='player')fail('Management expiry is separate from ownership. No dismissal action is enabled',409);
    const player=await model.player(a.player_id,q),club=await model.club(a.club_id,q);
    if(player.user_id!==u.id)await assertAccess(a.club_id,actor,q);
    if(a.status==='terminated')return {already_applied:true,agreement_id:a.id};
    if(a.status!=='active')fail('Only an active player agreement can be terminated',409);
    const before=structuredClone(a);a.original_ends_at=a.ends_at;a.ends_at=clock().toISOString();await accrue(a,club,player,q,clock());a.status='terminated';
    await model.update('club_agreement',a,q);await q("UPDATE player_contracts SET status='terminated',updated_date=NOW() WHERE id=?",[a.player_contract_id]);
    await detachPlayingMembership(club.id,player.id,q);await model.audit(u,'player_agreement_terminated',club.id,before,a,'Player agreement ended; ownership unchanged',q);
    return {agreement_id:a.id,status:a.status,ownership_preserved:true};
  });}
  async function contractOptions(clubId,playerId,actor) {return transaction(async q=>{
    const {club}=await assertAccess(clubId,actor,q);
    const player=await model.player(playerId,q);if(!player)fail('Player not found',404);
    const card=await require('./cardProgressionService').read(player.id,q),band=policy.salaryBand(card.total_xp),options=[];
    const calendars=await q("SELECT * FROM league_entities WHERE entity_type='regional_calendar' AND status='published' ORDER BY id");
    for(const row of calendars){const c=parse(row.data_json),type=Date.parse(`${c.start_monday}T00:00:00Z`)>clock().getTime()?'next_season':'current_season';try{const d=await duration({duration_type:type,calendar_id:row.id},'player',clubId,q);options.push({...d,label:`${type==='next_season'?'Next':'Current'} published season — ends ${d.ends_at.slice(0,10)}`});}catch(e){if(e.status!==422)throw e;}}
    if(!options.length)options.push({duration_type:'fixed_12_weeks',label:'12 weeks — no applicable published season'});
    const report=await finance(club,q),current=report.agreements.find(a=>a.kind==='player'&&a.player_id===player.id&&a.status==='active');
    return {player_id:player.id,card,band,durations:options,trial_days:14,management_limit_stc:policy.managementOffer({wageBudget:club.wage_budget_stc}).management_ceiling_stc,remaining_weekly_stc:report.remaining_weekly_stc+Number(current?.weekly_salary_stc||0),cash_stc:report.balance_stc};
  });}
  async function dashboard(clubId, actor) {
    return transaction(async q => {
      const {
        club
      } = await assertAccess(clubId, actor, q, 'view_finances');
      const report = await finance(club, q);
      const objectives = await model.selectAll('club_board_objective', clubId, q),
        reviews = await model.selectAll('club_board_review', clubId, q);
      return {
        club_id: clubId,
        policy_version: VERSION,
        finance: report,
        objectives,
        reviews,
        payroll: await model.selectAll('club_payroll',clubId,q),
        management_limit_stc: policy.managementOffer({
          wageBudget: club.wage_budget_stc
        }).management_ceiling_stc
      };
    });
  }
  async function offer(body, actor) {
    return transaction(async q => {
      const {
        u,
        club
      } = await assertAccess(body.club_id || body.team_id, actor, q);
      await model.lock(club.id, q);
      const player = await model.player(body.player_id || body.target_player_id || body.user_id, q);
      if (!player?.user_id) fail('Choose a player with a linked account');
      const own = manager(club,{id:player.user_id,email:player.email}) || player.id === club.president_player_id || player.user_id === club.president_user_id || player.user_id === club.user_id;
      const kind = body.kind || 'player';
      if (kind !== 'player') fail('Management offers are created by the Club Board', 403);
      const report = await finance(club, q),
        purpose = body.purpose || 'signing';
      const existing = report.proposals.find(p => p.kind === 'player' && p.player_id === player.id && p.status === 'pending');
      if (existing) return {
        ...existing,
        already_applied: true
      };
      const current = report.agreements.find(a => a.kind === 'player' && a.player_id === player.id && a.status === 'active');
      const [legacy] = await q("SELECT * FROM player_contracts WHERE team_id=? AND user_id=? AND contract_type<>'ownership' AND status='active' ORDER BY id LIMIT 1 FOR UPDATE", [club.id, player.id]);
      if (purpose === 'signing' && (current || legacy)) fail('This player already has an active agreement; propose an amendment or renewal');
      if (purpose !== 'signing' && !current && !legacy) fail('An amendment or renewal requires an existing agreement');
      if(purpose==='signing'||purpose==='renewal')await require('./contractRulesService').assertCanCreateContractOffer({playerId:player.id,teamId:club.id,contractType:body.squad_role||body.contract_type||'squad',allowedActiveContractId:current?.player_contract_id||legacy?.id||null,query:q});
      const terms = policy.playerTerms({
        squad_role: body.squad_role || body.contract_type || 'squad',
        weekly_salary_stc: body.weekly_salary_stc,
        signing_bonus_stc: body.signing_bonus_stc || 0
      }, await xp(player.id, q), purpose);
      const notBefore = purpose === 'renewal' ? current?.ends_at || legacy?.end_date : null;
      const starts = new Date(Math.max(clock().getTime(), notBefore ? Date.parse(notBefore) : 0));
      const dates = await duration({
        ...body,
        duration_type: terms.squad_role === 'trial' ? 'trial' : body.duration_type
      }, 'player', club.id, q, starts);
      const f = await finance(club, q, {
        excluding: current?.id || legacy?.id
      });
      affordable(f, terms.weekly_salary_stc, terms.signing_bonus_stc, money(body.transfer_fee_stc || 0));
      const id = crypto.randomUUID(),
        p = {
          id,
          policy_version: VERSION,
          club_id: club.id,
          player_id: player.id,
          recipient_user_id: player.user_id,
          kind: 'player',
          origin: own ? 'board' : 'club',
          purpose,
          status: 'pending',
          version: 1,
          ...terms,
          ...dates,
          duration_type: dates.duration_type,
          calendar_id: dates.calendar_id || null,
          agreement_id: current?.id || null,
          source_player_contract_id: legacy?.id || null,
          not_before: notBefore,
          previous_weekly_salary_stc: current?.weekly_salary_stc ?? Number(legacy?.weekly_salary_stc || 0),
          transfer_fee_stc: purpose === 'signing' ? money(body.transfer_fee_stc || 0) : 0,
          performance_targets: Array.isArray(body.performance_targets) ? body.performance_targets : parse(legacy?.performance_targets || '[]'),
          captaincy_offered: Number(body.captaincy_offered || 0) === 1,
          history: [],
          explanation: own ? 'The Board has validated these proposed player terms against the same salary limits as every other player.' : 'Please review the club’s player agreement proposal.',
          created_at: clock().toISOString()
        };
      await model.create('club_contract_proposal', p, q);
      await notify(p, player, club, q);
      await model.audit(u, 'player_agreement_proposed', club.id, null, p, 'Player contract proposal', q);
      return p;
    });
  }
  async function proposal(id, actor) {
    return transaction(async q => {
      const p = await model.selectOne('club_contract_proposal', id, q);
      if (!p) fail('Proposal not found', 404);
      const u = await user(actor, q);
      if (p.recipient_user_id !== u.id) await assertAccess(p.club_id, actor, q);
      return {
        ...p,
        supported_actions: p.status === 'pending' ? p.recipient_user_id === u.id ? p.origin === 'club' && p.last_proposed_by === 'player' ? ['decline', 'counter'] : ['accept', 'decline', 'counter'] : p.origin === 'board' ? [] : p.last_proposed_by === 'player' ? ['accept', 'counter', 'withdraw'] : ['counter', 'withdraw'] : []
      };
    });
  }
  async function pay(club, player, amount, reference, category, q) {
    if (amount === 0) return {
      status: 'not_due'
    };
    if (Number(club.stc) < amount) return {
      status: 'arrears',
      amount_stc: amount
    };
    const debit = crypto.randomUUID(),
      credit = crypto.randomUUID();
    await q('UPDATE clubs SET stc=stc-?,updated_date=NOW() WHERE id=?', [amount, club.id]);
    await q('UPDATE players SET stc=stc+?,updated_date=NOW() WHERE id=?', [amount, player.id]);
    await q('INSERT INTO stc_transactions (id,club_id,amount,balance_after,type,category,description,reference_id,related_entity_type,related_entity_id) VALUES (?,?,?,?,?,?,?,?,?,?)', [debit, club.id, -amount, Number(club.stc) - amount, 'expense', category, `${category} — Club Board agreement`, reference, 'club_agreement', reference]);
    await q('INSERT INTO player_stc_transactions (id,player_id,player_email,amount,balance_after,type,category,source,description,reference_id) VALUES (?,?,?,?,?,?,?,?,?,?)', [credit, player.id, player.email, amount, Number(player.stc || 0) + amount, 'income', category, club.name, `${category} — ${club.name}`, reference]);
    club.stc = Number(club.stc) - amount;
    player.stc = Number(player.stc || 0) + amount;
    return {
      status: 'paid',
      amount_stc: amount,
      club_transaction_id: debit,
      player_transaction_id: credit
    };
  }
  async function respond(id, body, actor) {
    return transaction(async q => {
      const u = await user(actor, q),
        [seed] = await q("SELECT club_id FROM league_entities WHERE entity_type='club_contract_proposal' AND id=?", [id]);
      if (!seed) fail('Proposal not found', 404);
      await model.lock(seed.club_id, q);
      const p = await model.selectOne('club_contract_proposal', id, q),
        club = await model.club(p.club_id, q),
        player = await model.player(p.player_id, q);
      const recipient = p.recipient_user_id === u.id;
      if (!recipient) {
        if (p.origin === 'board') fail('Only the recipient may respond to a Board offer', 403);
        await assertAccess(club.id, actor, q);
      }
      const requestId = String(body.request_id || '');
      if (!requestId) fail('A request ID is required', 400);
      if (p.last_request_id === requestId && p.last_actor_id === u.id) return {
        ...p,
        already_applied: true
      };
      if (p.status !== 'pending') fail('This proposal is no longer pending', 409);
      if (Number(body.expected_version) !== p.version) fail('Proposal changed; review its latest terms', 409);
      const before = structuredClone(p);
      if (body.action === 'decline' || body.action === 'withdraw') {
        if (body.action === 'decline' && !recipient || body.action === 'withdraw' && (recipient || p.origin === 'board')) fail('This response is not permitted', 403);
        p.status = body.action === 'decline' ? 'declined' : 'withdrawn';
      } else if (body.action === 'counter') {
        const weekly = money(body.weekly_salary_stc, 'Weekly salary'),
          bonus = money(body.signing_bonus_stc ?? p.signing_bonus_stc, 'Signing bonus');
        if (p.kind === 'management') {
          const offer = policy.managementOffer({
            current: p.previous_weekly_salary_stc || 0,
            wageBudget: club.wage_budget_stc
          });
          if (bonus !== 0) fail('Management proposals have no signing bonus');
          if (p.purpose === 'renewal' && weekly !== p.weekly_salary_stc || weekly > offer.maximum_weekly_salary_stc || offer.minimum_weekly_salary_stc != null && weekly < offer.minimum_weekly_salary_stc) {
            p.explanation = p.purpose === 'renewal' ? 'The Board retains its published renewal offer. A different renewal negotiation range has not been approved.' : `The Board cannot accept ${weekly.toLocaleString()} STC. The permitted maximum is ${offer.maximum_weekly_salary_stc.toLocaleString()} STC per week. Our current proposal remains available.`;
          } else {
            const report = await finance(club, q, {
              excluding: p.agreement_id || p.source_player_contract_id,
              proposalId: p.id
            });
            affordable(report, weekly);
            p.weekly_salary_stc = weekly;
            p.explanation = 'The Board accepts these proposed financial terms. Review and accept the revised agreement to activate them.';
          }
        } else {
          const terms = policy.playerTerms({
            ...p,
            weekly_salary_stc: weekly,
            signing_bonus_stc: bonus
          }, await xp(player.id, q), p.purpose);
          const report = await finance(club, q, {
            excluding: p.agreement_id || p.source_player_contract_id,
            proposalId: p.id
          });
          affordable(report, weekly, terms.signing_bonus_stc, p.transfer_fee_stc || 0);
          Object.assign(p, terms);
          p.last_proposed_by = recipient ? 'player' : 'club';
          p.explanation = p.origin === 'board' ? 'The Board accepts these proposed player terms. Please review and accept to activate.' : 'A revised player offer is ready for the other party to review.';
        }
        p.history.push({
          version: p.version,
          actor_id: u.id,
          action: 'counter',
          requested_weekly_salary_stc: weekly,
          requested_bonus_stc: bonus,
          previous_weekly_salary_stc: before.weekly_salary_stc,
          at: clock().toISOString()
        });
      } else if (body.action === 'accept') {
        if (!recipient && p.last_proposed_by !== 'player') fail('Only the player may accept the club’s offer', 403);
        if (recipient && p.origin !== 'board' && p.last_proposed_by === 'player') fail('Your counter-offer awaits the club’s response', 409);
        if (!player || player.user_id !== p.recipient_user_id) fail('The recipient’s linked player identity changed', 409);
        if (p.kind === 'player') policy.playerTerms(p, await xp(player.id, q), p.purpose);
        if (p.kind === 'management' && p.weekly_salary_stc > policy.managementOffer({
          wageBudget: club.wage_budget_stc
        }).management_ceiling_stc) fail('Management salary exceeds the current Board ceiling');
        const report = await finance(club, q, {
          excluding: p.agreement_id || p.source_player_contract_id,
          proposalId: p.id
        });
        affordable(report, p.weekly_salary_stc, p.signing_bonus_stc, p.transfer_fee_stc || 0);
        const effective = new Date(Math.max(clock().getTime(), p.not_before ? Date.parse(p.not_before) : 0));
        const dates = await duration(p, p.kind, club.id, q, effective);
        const agreementId = p.purpose === 'renewal' ? stableId(['club_agreement', p.id]) : p.agreement_id || stableId(['club_agreement', p.id]);
        const previous = await model.selectOne('club_agreement', agreementId, q);
        if (previous) await accrue(previous, club, player, q, clock());
        const a = {
          ...p,
          ...dates,
          id: agreementId,
          proposal_id: p.id,
          status: effective.getTime() > clock().getTime() ? 'scheduled' : 'active',
          accepted_at: clock().toISOString(),
          payroll_through: dates.starts_at,
          payroll_generation: p.id
        };
        if (p.kind === 'player') {
          await require('./officialPlayerTransferService').assertMove({
            player,
            targetClubId: club.id,
            referenceId: p.id,
            actorId: u.id
          }, q);
          // Reuse an existing same-club founder document as the player-side mirror,
          // preserving ownership. Never overwrite accepted terms while proposing.
          const [legacy] = await q("SELECT * FROM player_contracts WHERE team_id=? AND user_id=? AND contract_type<>'ownership' AND status='active' ORDER BY id LIMIT 1 FOR UPDATE", [club.id, player.id]);
          const preserveLegacy=legacy&&!legacy.compensation_policy_version&&(Number(legacy.weekly_salary_stc)>0||Number(legacy.signing_bonus_stc)>0);
        const contractId = p.purpose === 'renewal'||preserveLegacy ? crypto.randomUUID() : previous?.player_contract_id || legacy?.id || crypto.randomUUID();
          a.player_contract_id = contractId;
          if (p.purpose !== 'renewal' && !preserveLegacy && (legacy || previous?.player_contract_id)) await q("UPDATE player_contracts SET status='active',weekly_salary_stc=?,signing_bonus_stc=?,contract_type=?,compensation_policy_version='club_board_v1',max_games=NULL,max_days=NULL,start_date=?,end_date=?,updated_date=NOW() WHERE id=?", [a.weekly_salary_stc, a.signing_bonus_stc, a.squad_role, a.starts_at.slice(0, 10), a.ends_at.slice(0, 10), contractId]);else await q("INSERT INTO player_contracts (id,team_id,user_id,contract_type,status,weekly_salary_stc,signing_bonus_stc,start_date,end_date,max_games,max_days,compensation_policy_version) VALUES (?,?,?,?,?,?,?,?,?,NULL,NULL,'club_board_v1')", [contractId, club.id, player.id, a.squad_role, a.status === 'scheduled' ? 'pending_window' : 'active', a.weekly_salary_stc, a.signing_bonus_stc, a.starts_at.slice(0, 10), a.ends_at.slice(0, 10)]);
          await q('UPDATE player_contracts SET performance_targets=?,captaincy_offered=? WHERE id=?', [JSON.stringify(a.performance_targets || []), a.captaincy_offered ? 1 : 0, contractId]);
          if (a.status !== 'scheduled') await require('./contractRulesService').closeAcceptedContractConflicts({
            acceptedContract: {
              id: contractId,
              user_id: player.id,
              team_id: club.id,
              contract_type: a.squad_role
            },
            query: q
          });
          await q("UPDATE players SET club_id=?,status='active',updated_date=NOW() WHERE id=?", [club.id, player.id]);
          await require('./clubMembershipService').upsertActiveMembership({
            clubId: club.id,
            playerId: player.id,
            userId: player.user_id,
            primaryRole: player.user_id === club.president_user_id || player.id === club.president_player_id ? 'president' : 'member',
            source: 'contract_acceptance',
            query: q
          });
        }
        if (p.transfer_fee_stc) {
          // Transfer payments retain the existing sender-side spending semantics.
          if (Number(club.stc) < p.transfer_fee_stc + p.signing_bonus_stc) fail('Club cash changed; review signing costs');
          await q('UPDATE clubs SET stc=stc-? WHERE id=?', [p.transfer_fee_stc, club.id]);
          await q('INSERT INTO stc_transactions (id,club_id,amount,balance_after,type,category,description,reference_id) VALUES (?,?,?,?,?,?,?,?)', [crypto.randomUUID(), club.id, -p.transfer_fee_stc, Number(club.stc) - p.transfer_fee_stc, 'expense', 'transfer_spending', 'Player transfer fee', p.id]);
          club.stc = Number(club.stc) - p.transfer_fee_stc;
        }
        a.bonus_payment = await pay(club, player, p.signing_bonus_stc, p.id, 'signing_bonus', q);
        if (a.bonus_payment.status === 'arrears') fail('Signing bonus could not be funded; agreement was not activated', 409);
        await model.save('club_agreement', a, q);
        p.status = 'accepted';
        p.accepted_agreement_id = a.id;
      } else fail('Choose accept, decline, counter or withdraw', 400);
      p.version++;
      p.last_request_id = requestId;
      p.last_actor_id = u.id;
      p.updated_at = clock().toISOString();
      await model.update('club_contract_proposal', p, q);
      await model.audit(u, `agreement_${body.action}`, club.id, before, p, 'Contract proposal response', q);
      await q("UPDATE inbox_messages SET status=?,is_read=1 WHERE related_entity_id=? AND related_entity_type='club_contract_proposal'", [p.status === 'pending' ? 'superseded' : p.status, id]);
      if (p.status === 'pending') await notify(p, player, club, q);
      return p;
    });
  }
  async function accrue(a, club, player, q, now = clock()) {
    const start = Date.parse(a.payroll_through || a.starts_at),
      end = Math.min(now.getTime(), Date.parse(a.ends_at));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    const periods = [];
    let cursor = start;
    while (cursor + WEEK_MS <= end) {
      periods.push({
        from: cursor,
        to: cursor + WEEK_MS
      });
      cursor += WEEK_MS;
    }
    if (end === Date.parse(a.ends_at) && cursor < end) periods.push({
      from: cursor,
      to: end
    });
    const receipts = [];
    for (const period of periods) {
      const id = stableId(['weekly_payroll', a.id, a.payroll_generation, period.from, period.to]);
      const old = await model.selectOne('club_payroll', id, q);
      if (old?.status === 'paid') continue;
      const amount = Math.round(a.weekly_salary_stc * (period.to - period.from) / WEEK_MS * 100) / 100;
      const payment = await pay(club, player, amount, id, 'salary', q);
      await model.save('club_payroll', {
        id,
        club_id: club.id,
        player_id: player.id,
        agreement_id: a.id,
        status: payment.status,
        amount_stc: amount,
        from: new Date(period.from).toISOString(),
        through: new Date(period.to).toISOString(),
        ...payment
      }, q);
      receipts.push(payment);
      if (payment.status === 'arrears') break;
      a.payroll_through = new Date(period.to).toISOString();
    }
    if (now.getTime() >= Date.parse(a.ends_at)) a.status = 'expired';
    await model.update('club_agreement', a, q);
    return receipts;
  }
  return {
    prepare,
    terminate,
    detachPlayingMembership,
    contractOptions,
    dashboard,
    proposal,
    respond,
    offer,
    initial,
    finance,
    accrue,
    assertAccess,
    duration,
    notify,
    manager,
    pay
  };
}
module.exports = {
  createService,
  ...createService()
};
