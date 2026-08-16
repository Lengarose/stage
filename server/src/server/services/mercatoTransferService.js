const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');

const STATUSES = [
  'rumour',
  'reported',
  'negotiation',
  'agreement_close',
  'agreement',
  'medical',
  'signed',
  'official',
  'failed',
];

const STATUS_LABELS = {
  rumour: 'RUMOUR',
  reported: 'REPORTED',
  negotiation: 'IN NEGOTIATION',
  agreement_close: 'CLOSE TO AGREEMENT',
  agreement: 'AGREEMENT REACHED',
  medical: 'MEDICAL',
  signed: 'SIGNED',
  official: 'OFFICIAL',
  failed: 'DEAL OFF',
};

const DEAL_TYPES = [
  'permanent',
  'loan',
  'loan_option',
  'loan_obligation',
  'free',
  'swap',
  'extension',
  'termination',
  'released',
  'loan_return',
  'academy',
  'coaching_change',
];

const DEAL_TYPE_LABELS = {
  permanent: 'Permanent Transfer',
  loan: 'Loan',
  loan_option: 'Loan with Option to Buy',
  loan_obligation: 'Loan with Obligation to Buy',
  free: 'Free Transfer',
  swap: 'Player Swap',
  extension: 'Contract Extension',
  termination: 'Contract Termination',
  released: 'Released Player',
  loan_return: 'Return from Loan',
  academy: 'Academy Promotion',
  coaching_change: 'Coaching Change',
};

const WINDOW_KINDS = ['summer', 'winter', 'custom'];

const FILTER_STATUS_GROUPS = {
  official: ['official', 'signed'],
  rumours: ['rumour', 'reported'],
  negotiations: ['negotiation', 'agreement_close', 'agreement', 'medical'],
  completed: ['official', 'signed'],
  failed: ['failed'],
};

const LOAN_DEAL_TYPES = ['loan', 'loan_option', 'loan_obligation', 'loan_return'];
const OPEN_STATUSES = STATUSES.filter((status) => !['official', 'signed', 'failed'].includes(status));

const ACTION_STATUS = {
  offer: 'negotiation',
  renewal_offer: 'negotiation',
  counter: 'negotiation',
  mark_pending_window: 'agreement',
  accept: 'official',
  reject: 'failed',
  cancel_offer: 'failed',
  terminate: 'official',
  expire: 'failed',
};

const ACTION_DEAL_TYPE = {
  renewal_offer: 'extension',
  terminate: 'termination',
};

const RELIABILITY = ['high', 'medium', 'low'];

function text(value) {
  return String(value || '').trim();
}

function money(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function jsonValue(value, fallback = null) {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function statusLabel(status) {
  return STATUS_LABELS[status] || String(status || '').toUpperCase();
}

function dealTypeLabel(dealType) {
  return DEAL_TYPE_LABELS[dealType] || 'Permanent Transfer';
}

function inferWindowKind(windowRow, date = new Date()) {
  const label = text(windowRow?.label || windowRow?.window_kind).toLowerCase();
  if (label.includes('winter')) return 'winter';
  if (label.includes('summer')) return 'summer';
  if (WINDOW_KINDS.includes(label)) return label;
  const month = date.getUTCMonth();
  if (month === 0 || month === 1) return 'winter';
  if (month >= 5 && month <= 8) return 'summer';
  return 'custom';
}

function deadlineDayState(windowRow, now = Date.now()) {
  if (!windowRow?.end_date) return { active: false, remaining_ms: 0, ends_at: null };
  const end = new Date(windowRow.end_date);
  if (Number.isNaN(end.getTime())) return { active: false, remaining_ms: 0, ends_at: null };
  if (end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0) {
    end.setUTCHours(23, 59, 59, 999);
  }
  const remaining = end.getTime() - now;
  return {
    active: remaining > 0 && remaining <= 24 * 60 * 60 * 1000,
    remaining_ms: Math.max(0, remaining),
    ends_at: end.toISOString(),
  };
}

function inferDealType(contract = {}, { action, fromClubId } = {}) {
  if (ACTION_DEAL_TYPE[action]) return ACTION_DEAL_TYPE[action];
  const type = text(contract.contract_type).toLowerCase();
  if (type === 'trial') return 'loan';
  if (type.includes('loan')) return 'loan';
  const fee = money(contract.transfer_fee_stc);
  if (!fromClubId && fee <= 0) return 'free';
  if (fromClubId && fee <= 0) return 'free';
  return 'permanent';
}

function headlineForTransfer(row, status = row?.status) {
  const player = row.player_name || 'A player';
  const fromClub = row.from_club_name || 'Free agency';
  const toClub = row.to_club_name || 'a club';
  switch (status) {
    case 'rumour':
      return `${toClub} interested in ${player}`;
    case 'reported':
      return `${player} linked with ${toClub}`;
    case 'negotiation':
      return `Negotiations continue for ${player}`;
    case 'agreement_close':
      return `${player} close to joining ${toClub}`;
    case 'agreement':
      return `${toClub} and ${fromClub} reach agreement for ${player}`;
    case 'medical':
      return `${player} arrives for medical tests`;
    case 'signed':
      return `${player} signs for ${toClub}`;
    case 'official':
      if (row.deal_type === 'extension') return `${player} extends at ${toClub}`;
      if (row.deal_type === 'termination' || row.deal_type === 'released') return `${toClub} release ${player}`;
      if (row.deal_type === 'coaching_change') return `${player} appointed at ${toClub}`;
      if (row.deal_type === 'free') return `${player} joins ${toClub} on a free transfer`;
      return `${player} completes move to ${toClub}`;
    case 'failed':
      return `Deal off: ${player} to ${toClub}`;
    default:
      return `${player}: ${fromClub} → ${toClub}`;
  }
}

function bodyForTransfer(row, status = row?.status) {
  const fee = money(row.transfer_fee);
  const feeLine = fee ? ` Transfer fee: ${fee.toLocaleString()} ${row.currency || 'STC'}.` : '';
  return `${headlineForTransfer(row, status)}.${feeLine}`;
}

function matchesMercatoFilter(row, filterId = 'all') {
  if (!filterId || filterId === 'all') return true;
  if (FILTER_STATUS_GROUPS[filterId]) return FILTER_STATUS_GROUPS[filterId].includes(row.status);
  if (filterId === 'loans') return LOAN_DEAL_TYPES.includes(row.deal_type);
  if (filterId === 'free_agents') return row.deal_type === 'free' || !row.from_club_id;
  if (filterId === 'contract_extensions') return row.deal_type === 'extension';
  return row.status === filterId || row.deal_type === filterId;
}

function presentTransfer(row = {}) {
  const addOns = jsonValue(row.add_ons, null);
  const bonuses = jsonValue(row.bonuses, null);
  return {
    ...row,
    add_ons: addOns,
    bonuses,
    status_label: statusLabel(row.status),
    deal_type_label: dealTypeLabel(row.deal_type),
    headline: row.headline || headlineForTransfer(row),
    transfer_fee: money(row.transfer_fee),
    add_ons_amount: money(row.add_ons_amount),
    loan_fee: money(row.loan_fee),
    option_to_buy: money(row.option_to_buy),
    weekly_salary_stc: money(row.weekly_salary_stc),
    sell_on_clause: Number(row.sell_on_clause || 0),
    release_clause: money(row.release_clause),
    currency: row.currency || 'STC',
  };
}

function clubBalance(transfers = [], clubId) {
  const id = String(clubId || '');
  const completed = transfers.filter((row) => ['official', 'signed'].includes(row.status));
  const inbound = completed.filter((row) => String(row.to_club_id || '') === id);
  const outbound = completed.filter((row) => String(row.from_club_id || '') === id);
  const spent = inbound.reduce((sum, row) => sum + money(row.transfer_fee), 0);
  const received = outbound.reduce((sum, row) => sum + money(row.transfer_fee), 0);
  return {
    transfers_in: inbound,
    transfers_out: outbound,
    players_in: inbound.length,
    players_out: outbound.length,
    spent,
    received,
    balance: received - spent,
    currency: 'STC',
  };
}

function rankingTables(transfers = []) {
  const completed = transfers.filter((row) => ['official', 'signed'].includes(row.status));
  const mostExpensive = [...completed]
    .sort((a, b) => money(b.transfer_fee) - money(a.transfer_fee))
    .slice(0, 10);
  const spend = new Map();
  const sales = new Map();
  for (const row of completed) {
    if (row.to_club_id) {
      const current = spend.get(row.to_club_id) || { club_id: row.to_club_id, club_name: row.to_club_name, club_logo_url: row.to_club_logo_url, total: 0 };
      current.total += money(row.transfer_fee);
      spend.set(row.to_club_id, current);
    }
    if (row.from_club_id) {
      const current = sales.get(row.from_club_id) || { club_id: row.from_club_id, club_name: row.from_club_name, club_logo_url: row.from_club_logo_url, total: 0 };
      current.total += money(row.transfer_fee);
      sales.set(row.from_club_id, current);
    }
  }
  const byTotal = (map) => [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  return {
    most_expensive: mostExpensive,
    clubs_spending: byTotal(spend),
    clubs_sales: byTotal(sales),
  };
}

function topTransferBuckets(transfers = []) {
  const completed = transfers.filter((row) => ['official', 'signed'].includes(row.status));
  const byFee = [...completed].sort((a, b) => money(b.transfer_fee) - money(a.transfer_fee));
  const latest = [...transfers].sort((a, b) => new Date(b.last_updated_at || 0) - new Date(a.last_updated_at || 0));
  const viewed = [...transfers].sort((a, b) => Number(b.view_count || 0) - Number(a.view_count || 0));
  return {
    biggest: byFee.slice(0, 8),
    most_expensive: byFee.slice(0, 8),
    latest: latest.slice(0, 8),
    most_viewed: viewed.slice(0, 8),
    trending: latest.filter((row) => OPEN_STATUSES.includes(row.status)).slice(0, 8),
    biggest_free: completed.filter((row) => row.deal_type === 'free').slice(0, 8),
    biggest_loans: completed.filter((row) => LOAN_DEAL_TYPES.includes(row.deal_type)).slice(0, 8),
  };
}

function newsTagsForAction(action, dealType) {
  if (action === 'offer' || action === 'renewal_offer' || action === 'terminate') return ['club_news'];
  if (action === 'accept') return ['player_news'];
  if (dealType === 'coaching_change') return ['club_news'];
  return ['daily_news'];
}

async function loadClubsById(ids = []) {
  const unique = [...new Set(ids.map(String).filter(Boolean))];
  if (!unique.length) return {};
  const rows = await EXECUTESQL(
    `SELECT id, name, logo_url, country_code FROM clubs WHERE id IN (${unique.map(() => '?').join(',')})`,
    unique,
  ).catch(() => []);
  return Object.fromEntries(rows.map((row) => [String(row.id), row]));
}

async function loadPlayer(playerId) {
  if (!playerId) return null;
  const rows = await EXECUTESQL(
    `SELECT id, gamertag, avatar_url, country, country_code, position, club_id, overall_rating
       FROM players WHERE id = ? LIMIT 1`,
    [playerId],
  ).catch(() => []);
  return rows[0] || null;
}

async function currentWindow() {
  const rows = await EXECUTESQL(
    "SELECT * FROM transfer_windows WHERE status = 'open' ORDER BY created_date DESC LIMIT 1",
  ).catch(() => []);
  return rows[0] || null;
}

async function findExistingTransfer({ id, contractId, playerId, toClubId }) {
  if (id) {
    const rows = await EXECUTESQL('SELECT * FROM mercato_transfers WHERE id = ? LIMIT 1', [id]).catch(() => []);
    if (rows[0]) return rows[0];
  }
  if (contractId) {
    const rows = await EXECUTESQL('SELECT * FROM mercato_transfers WHERE contract_id = ? LIMIT 1', [contractId]).catch(() => []);
    if (rows[0]) return rows[0];
  }
  if (playerId && toClubId) {
    const rows = await EXECUTESQL(
      `SELECT * FROM mercato_transfers
        WHERE player_id = ? AND to_club_id = ? AND status IN (${OPEN_STATUSES.map(() => '?').join(',')})
        ORDER BY last_updated_at DESC LIMIT 1`,
      [playerId, toClubId, ...OPEN_STATUSES],
    ).catch(() => []);
    if (rows[0]) return rows[0];
  }
  return null;
}

async function appendEvent(transferId, { status, title, body, sourceName = null }) {
  await EXECUTESQL(
    `INSERT INTO mercato_transfer_events
      (id, transfer_id, status, title, body, source_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW())`,
    [uuidv4(), transferId, status, title, body, sourceName],
  ).catch((err) => console.error('[mercato] event', err.message));
}

async function publishLinkedNews(row, { tags, title, body }) {
  const { publishNewsItem } = require('./newsFeedService');
  await publishNewsItem({
    title: title || row.headline,
    body: body || row.body,
    type: 'transfer',
    category: tags?.[0] || 'daily_news',
    tags,
    club_id: row.to_club_id,
    club_name: row.to_club_name,
    club_logo_url: row.to_club_logo_url,
    player_id: row.player_id,
    player_name: row.player_name,
    player_avatar_url: row.player_avatar_url,
    transfer_id: row.id,
    transfer_fee_stc: money(row.transfer_fee),
    link: `/news?section=mercato&transfer=${row.id}`,
  });
}

async function upsertTransfer(input = {}, { publishNews = false, eventTitle, eventBody } = {}) {
  const player = input.player_id ? await loadPlayer(input.player_id) : null;
  const clubs = await loadClubsById([input.from_club_id, input.to_club_id]);
  const fromClub = clubs[String(input.from_club_id || '')] || null;
  const toClub = clubs[String(input.to_club_id || '')] || null;
  const windowRow = input.window_id ? { id: input.window_id, label: input.window_kind } : await currentWindow();
  const existing = await findExistingTransfer({
    id: input.id,
    contractId: input.contract_id,
    playerId: input.player_id,
    toClubId: input.to_club_id,
  });
  const status = STATUSES.includes(input.status) ? input.status : (existing?.status || 'rumour');
  const dealType = DEAL_TYPES.includes(input.deal_type) ? input.deal_type : (existing?.deal_type || 'permanent');
  const nowRow = {
    subject_type: input.subject_type || existing?.subject_type || 'player',
    player_id: input.player_id || existing?.player_id || null,
    player_name: input.player_name || existing?.player_name || player?.gamertag || null,
    player_avatar_url: input.player_avatar_url || existing?.player_avatar_url || player?.avatar_url || null,
    player_position: input.player_position || existing?.player_position || player?.position || null,
    player_nationality: input.player_nationality || existing?.player_nationality || player?.country || player?.country_code || null,
    player_value_stc: money(input.player_value_stc ?? existing?.player_value_stc ?? player?.overall_rating),
    from_club_id: existing?.from_club_id || input.from_club_id || null,
    from_club_name: existing?.from_club_name || input.from_club_name || fromClub?.name || null,
    from_club_logo_url: existing?.from_club_logo_url || input.from_club_logo_url || fromClub?.logo_url || null,
    to_club_id: input.to_club_id || existing?.to_club_id || null,
    to_club_name: input.to_club_name || existing?.to_club_name || toClub?.name || null,
    to_club_logo_url: input.to_club_logo_url || existing?.to_club_logo_url || toClub?.logo_url || null,
    competition_id: input.competition_id || existing?.competition_id || null,
    country_code: input.country_code || existing?.country_code || toClub?.country_code || fromClub?.country_code || player?.country_code || null,
    window_id: input.window_id || existing?.window_id || windowRow?.id || null,
    window_kind: input.window_kind || existing?.window_kind || inferWindowKind(windowRow),
    deal_type: dealType,
    status,
    transfer_fee: money(input.transfer_fee ?? existing?.transfer_fee),
    currency: input.currency || existing?.currency || 'STC',
    add_ons_amount: money(input.add_ons_amount ?? existing?.add_ons_amount),
    sell_on_clause: Number(input.sell_on_clause ?? existing?.sell_on_clause ?? 0),
    release_clause: money(input.release_clause ?? existing?.release_clause),
    loan_fee: money(input.loan_fee ?? existing?.loan_fee),
    option_to_buy: money(input.option_to_buy ?? existing?.option_to_buy),
    obligation_to_buy: input.obligation_to_buy ? 1 : Number(existing?.obligation_to_buy || 0),
    contract_years: Number(input.contract_years ?? existing?.contract_years ?? 0),
    contract_start: input.contract_start || existing?.contract_start || null,
    contract_end: input.contract_end || existing?.contract_end || null,
    contract_option: input.contract_option || existing?.contract_option || null,
    weekly_salary_stc: money(input.weekly_salary_stc ?? existing?.weekly_salary_stc),
    salary_is_estimate: input.salary_is_estimate ? 1 : Number(existing?.salary_is_estimate || 0),
    fee_is_estimate: input.fee_is_estimate ? 1 : Number(existing?.fee_is_estimate || 0),
    source_name: input.source_name || existing?.source_name || null,
    source_url: input.source_url || existing?.source_url || null,
    journalist_id: input.journalist_id || existing?.journalist_id || null,
    journalist_name: input.journalist_name || existing?.journalist_name || null,
    reliability: RELIABILITY.includes(input.reliability) ? input.reliability : (existing?.reliability || 'medium'),
    verification_status: input.verification_status || existing?.verification_status || (status === 'rumour' ? 'unconfirmed' : 'confirmed'),
    contract_id: input.contract_id || existing?.contract_id || null,
    staff_role_id: input.staff_role_id || existing?.staff_role_id || null,
    transfer_date: input.transfer_date || existing?.transfer_date || (['official', 'signed'].includes(status) ? new Date() : null),
    add_ons: input.add_ons != null ? JSON.stringify(input.add_ons) : existing?.add_ons || null,
    bonuses: input.bonuses != null ? JSON.stringify(input.bonuses) : existing?.bonuses || null,
  };
  nowRow.headline = input.headline || headlineForTransfer(nowRow, status);
  nowRow.body = input.body || bodyForTransfer(nowRow, status);

  if (existing) {
    await EXECUTESQL(
      `UPDATE mercato_transfers SET
         subject_type=?, player_id=?, player_name=?, player_avatar_url=?, player_position=?, player_nationality=?, player_value_stc=?,
         from_club_id=?, from_club_name=?, from_club_logo_url=?, to_club_id=?, to_club_name=?, to_club_logo_url=?,
         competition_id=?, country_code=?, window_id=?, window_kind=?, deal_type=?, status=?,
         transfer_fee=?, currency=?, add_ons_amount=?, sell_on_clause=?, release_clause=?, loan_fee=?, option_to_buy=?, obligation_to_buy=?,
         contract_years=?, contract_start=?, contract_end=?, contract_option=?, weekly_salary_stc=?, salary_is_estimate=?, fee_is_estimate=?,
         source_name=?, source_url=?, journalist_id=?, journalist_name=?, reliability=?, verification_status=?,
         contract_id=?, staff_role_id=?, transfer_date=?, add_ons=?, bonuses=?, headline=?, body=?, last_updated_at=NOW()
       WHERE id=?`,
      [
        nowRow.subject_type, nowRow.player_id, nowRow.player_name, nowRow.player_avatar_url, nowRow.player_position, nowRow.player_nationality, nowRow.player_value_stc,
        nowRow.from_club_id, nowRow.from_club_name, nowRow.from_club_logo_url, nowRow.to_club_id, nowRow.to_club_name, nowRow.to_club_logo_url,
        nowRow.competition_id, nowRow.country_code, nowRow.window_id, nowRow.window_kind, nowRow.deal_type, nowRow.status,
        nowRow.transfer_fee, nowRow.currency, nowRow.add_ons_amount, nowRow.sell_on_clause, nowRow.release_clause, nowRow.loan_fee, nowRow.option_to_buy, nowRow.obligation_to_buy,
        nowRow.contract_years, nowRow.contract_start, nowRow.contract_end, nowRow.contract_option, nowRow.weekly_salary_stc, nowRow.salary_is_estimate, nowRow.fee_is_estimate,
        nowRow.source_name, nowRow.source_url, nowRow.journalist_id, nowRow.journalist_name, nowRow.reliability, nowRow.verification_status,
        nowRow.contract_id, nowRow.staff_role_id, nowRow.transfer_date, nowRow.add_ons, nowRow.bonuses, nowRow.headline, nowRow.body,
        existing.id,
      ],
    );
    if (existing.status !== status) {
      await appendEvent(existing.id, {
        status,
        title: eventTitle || statusLabel(status),
        body: eventBody || nowRow.body,
        sourceName: nowRow.source_name,
      });
    }
    const updated = presentTransfer({ ...existing, ...nowRow, id: existing.id });
    if (publishNews && existing.status !== status) {
      await publishLinkedNews(updated, { tags: newsTagsForAction(input.action, dealType) }).catch(() => {});
    }
    return updated;
  }

  const id = uuidv4();
  await EXECUTESQL(
    `INSERT INTO mercato_transfers (
       id, subject_type, player_id, player_name, player_avatar_url, player_position, player_nationality, player_value_stc,
       from_club_id, from_club_name, from_club_logo_url, to_club_id, to_club_name, to_club_logo_url,
       competition_id, country_code, window_id, window_kind, deal_type, status,
       transfer_fee, currency, add_ons_amount, sell_on_clause, release_clause, loan_fee, option_to_buy, obligation_to_buy,
       contract_years, contract_start, contract_end, contract_option, weekly_salary_stc, salary_is_estimate, fee_is_estimate,
       source_name, source_url, journalist_id, journalist_name, reliability, verification_status,
       contract_id, staff_role_id, transfer_date, add_ons, bonuses, headline, body, view_count, published_at, last_updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,NOW(),NOW())`,
    [
      id, nowRow.subject_type, nowRow.player_id, nowRow.player_name, nowRow.player_avatar_url, nowRow.player_position, nowRow.player_nationality, nowRow.player_value_stc,
      nowRow.from_club_id, nowRow.from_club_name, nowRow.from_club_logo_url, nowRow.to_club_id, nowRow.to_club_name, nowRow.to_club_logo_url,
      nowRow.competition_id, nowRow.country_code, nowRow.window_id, nowRow.window_kind, nowRow.deal_type, nowRow.status,
      nowRow.transfer_fee, nowRow.currency, nowRow.add_ons_amount, nowRow.sell_on_clause, nowRow.release_clause, nowRow.loan_fee, nowRow.option_to_buy, nowRow.obligation_to_buy,
      nowRow.contract_years, nowRow.contract_start, nowRow.contract_end, nowRow.contract_option, nowRow.weekly_salary_stc, nowRow.salary_is_estimate, nowRow.fee_is_estimate,
      nowRow.source_name, nowRow.source_url, nowRow.journalist_id, nowRow.journalist_name, nowRow.reliability, nowRow.verification_status,
      nowRow.contract_id, nowRow.staff_role_id, nowRow.transfer_date, nowRow.add_ons, nowRow.bonuses, nowRow.headline, nowRow.body,
    ],
  );
  await appendEvent(id, {
    status,
    title: eventTitle || statusLabel(status),
    body: eventBody || nowRow.body,
    sourceName: nowRow.source_name,
  });
  const created = presentTransfer({ ...nowRow, id });
  if (publishNews) {
    await publishLinkedNews(created, { tags: newsTagsForAction(input.action, dealType) }).catch(() => {});
  }
  return created;
}

async function recordContractMercatoEvent(contractId, action, extras = {}) {
  if (!contractId) return null;
  try {
    const rows = await EXECUTESQL(
      `SELECT pc.*, p.gamertag, p.avatar_url, p.position, p.country_code, p.club_id AS player_club_id,
              p.overall_rating, dest.name AS to_club_name, dest.logo_url AS to_club_logo_url, dest.country_code AS to_country_code
         FROM player_contracts pc
         LEFT JOIN players p ON p.id = pc.user_id
         LEFT JOIN clubs dest ON dest.id = pc.team_id
        WHERE pc.id = ? LIMIT 1`,
      [contractId],
    );
    const contract = rows[0];
    if (!contract) return null;
    const fromClubId = extras.from_club_id || (String(contract.player_club_id || '') !== String(contract.team_id || '') ? contract.player_club_id : null);
    const years = contract.max_days ? Math.max(1, Math.round(Number(contract.max_days) / 365)) : 0;
    return upsertTransfer({
      action,
      contract_id: contractId,
      player_id: contract.user_id,
      player_name: contract.gamertag,
      player_avatar_url: contract.avatar_url,
      player_position: contract.position,
      player_nationality: contract.country_code,
      player_value_stc: contract.overall_rating,
      from_club_id: fromClubId,
      to_club_id: contract.team_id,
      to_club_name: contract.to_club_name,
      to_club_logo_url: contract.to_club_logo_url,
      country_code: contract.to_country_code || contract.country_code,
      deal_type: inferDealType(contract, { action, fromClubId }),
      status: ACTION_STATUS[action] || 'negotiation',
      transfer_fee: contract.transfer_fee_stc,
      weekly_salary_stc: contract.weekly_salary_stc,
      contract_years: years,
      contract_start: contract.start_date,
      contract_end: contract.end_date,
      source_name: 'STAGE Contracts',
      reliability: 'high',
      verification_status: action === 'accept' || action === 'terminate' ? 'official' : 'confirmed',
    });
  } catch (err) {
    console.error('[mercato] contract sync', err.message);
    return null;
  }
}

async function recordStaffMercatoEvent(roleRow, playerRow, clubRow) {
  if (!roleRow?.id) return null;
  try {
    return upsertTransfer({
      staff_role_id: roleRow.id,
      subject_type: 'staff',
      player_id: roleRow.player_id,
      player_name: playerRow?.gamertag,
      player_avatar_url: playerRow?.avatar_url,
      player_position: roleRow.role,
      to_club_id: roleRow.club_id,
      to_club_name: clubRow?.name,
      to_club_logo_url: clubRow?.logo_url,
      deal_type: 'coaching_change',
      status: 'official',
      source_name: 'STAGE Club Office',
      reliability: 'high',
      verification_status: 'official',
      headline: `${playerRow?.gamertag || 'A staff member'} appointed ${String(roleRow.role || 'staff').replace(/_/g, ' ')} at ${clubRow?.name || 'a club'}`,
    }, { publishNews: false });
  } catch (err) {
    console.error('[mercato] staff sync', err.message);
    return null;
  }
}

function applyListFilters(rows, query = {}) {
  return rows.filter((row) => {
    if (!matchesMercatoFilter(row, query.filter)) return false;
    if (query.status && row.status !== query.status) return false;
    if (query.deal_type && row.deal_type !== query.deal_type) return false;
    if (query.country && text(row.country_code).toLowerCase() !== text(query.country).toLowerCase()) return false;
    if (query.club_id && String(row.from_club_id) !== String(query.club_id) && String(row.to_club_id) !== String(query.club_id)) return false;
    if (query.player_id && String(row.player_id) !== String(query.player_id)) return false;
    if (query.position && text(row.player_position).toLowerCase() !== text(query.position).toLowerCase()) return false;
    if (query.nationality && text(row.player_nationality).toLowerCase() !== text(query.nationality).toLowerCase()) return false;
    if (query.window_kind && row.window_kind !== query.window_kind) return false;
    if (query.competition_id && String(row.competition_id) !== String(query.competition_id)) return false;
    if (query.q) {
      const hay = `${row.player_name || ''} ${row.from_club_name || ''} ${row.to_club_name || ''} ${row.headline || ''}`.toLowerCase();
      if (!hay.includes(String(query.q).toLowerCase())) return false;
    }
    const minFee = Number(query.min_fee);
    const maxFee = Number(query.max_fee);
    if (Number.isFinite(minFee) && minFee > 0 && money(row.transfer_fee) < minFee) return false;
    if (Number.isFinite(maxFee) && maxFee > 0 && money(row.transfer_fee) > maxFee) return false;
    if (query.from) {
      const stamp = new Date(row.last_updated_at || row.published_at || 0).getTime();
      if (stamp < new Date(query.from).getTime()) return false;
    }
    if (query.to) {
      const stamp = new Date(row.last_updated_at || row.published_at || 0).getTime();
      if (stamp > new Date(query.to).getTime()) return false;
    }
    return true;
  });
}

async function listTransfers(query = {}) {
  const limit = Math.min(Number(query.limit) || 80, 200);
  const rows = await EXECUTESQL(
    `SELECT * FROM mercato_transfers ORDER BY last_updated_at DESC LIMIT 400`,
  ).catch(() => []);
  return applyListFilters(rows.map(presentTransfer), query).slice(0, limit);
}

async function getTransfer(id, { bumpViews = false } = {}) {
  const rows = await EXECUTESQL('SELECT * FROM mercato_transfers WHERE id = ? LIMIT 1', [id]).catch(() => []);
  if (!rows[0]) return null;
  if (bumpViews) {
    await EXECUTESQL('UPDATE mercato_transfers SET view_count = view_count + 1 WHERE id = ?', [id]).catch(() => {});
  }
  const events = await EXECUTESQL(
    'SELECT * FROM mercato_transfer_events WHERE transfer_id = ? ORDER BY created_at ASC',
    [id],
  ).catch(() => []);
  return { ...presentTransfer(rows[0]), events };
}

async function clubSummary(clubId) {
  const rows = await EXECUTESQL(
    `SELECT * FROM mercato_transfers
      WHERE to_club_id = ? OR from_club_id = ?
      ORDER BY last_updated_at DESC`,
    [clubId, clubId],
  ).catch(() => []);
  return clubBalance(rows.map(presentTransfer), clubId);
}

async function playerHistory(playerId) {
  const rows = await EXECUTESQL(
    `SELECT * FROM mercato_transfers
      WHERE player_id = ?
      ORDER BY COALESCE(transfer_date, published_at) DESC, last_updated_at DESC`,
    [playerId],
  ).catch(() => []);
  return rows.map(presentTransfer);
}

async function mercatoDesk(query = {}) {
  const [transfers, windowRow] = await Promise.all([listTransfers({ ...query, limit: 200 }), currentWindow()]);
  return {
    window: windowRow,
    window_kind: inferWindowKind(windowRow),
    deadline: deadlineDayState(windowRow),
    feed: transfers,
    top: topTransferBuckets(transfers),
    rankings: rankingTables(transfers),
  };
}

module.exports = {
  ACTION_STATUS,
  DEAL_TYPES,
  DEAL_TYPE_LABELS,
  FILTER_STATUS_GROUPS,
  STATUSES,
  STATUS_LABELS,
  WINDOW_KINDS,
  applyListFilters,
  bodyForTransfer,
  clubBalance,
  clubSummary,
  deadlineDayState,
  dealTypeLabel,
  getTransfer,
  headlineForTransfer,
  inferDealType,
  inferWindowKind,
  listTransfers,
  matchesMercatoFilter,
  mercatoDesk,
  newsTagsForAction,
  playerHistory,
  presentTransfer,
  rankingTables,
  recordContractMercatoEvent,
  recordStaffMercatoEvent,
  statusLabel,
  topTransferBuckets,
  upsertTransfer,
};
