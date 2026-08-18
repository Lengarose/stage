const { pool } = require('../db/database');
const { upsertActiveMembership } = require('./clubMembershipService');
const { v4: uuidv4 } = require('uuid');

const STARTER_CLUB = Object.freeze({
  stc: 2500000,
  wage_budget_stc: 250000,
  transfer_budget_stc: 1000000,
  stadium_level: 0,
  stadium_capacity: 5000,
  rating: 1500,
  peak_rating: 1500,
  matches_ranked: 0,
  is_provisional: 1,
  credits: 0,
  tier: 'Silver',
  win_streak: 0,
  loss_streak: 0,
  status: 'active',
});

const FOUNDER_PLAYER_CONTRACT_TYPE = 'founder_player';
const FOUNDER_PRESIDENT_CONTRACT_TYPE = 'ownership';
const LEGACY_FOUNDER_CONTRACT_TYPE = 'founder';
const FOUNDER_CONTRACT_DAYS = 3650;
const FOUNDER_TARGET_TYPES = new Set(['min', 'exact', 'range']);
const FOUNDER_PLAYER_WEEKLY_SALARY_MIN = 0;
const FOUNDER_PLAYER_WEEKLY_SALARY_MAX = STARTER_CLUB.wage_budget_stc;

function sanitizeFounderPlayerTerms(terms = {}) {
  const weekly = Math.max(0, Number(terms.weekly_salary_stc) || 0);
  const hasWageInput = terms.weekly_salary_stc != null && String(terms.weekly_salary_stc) !== '';
  if (hasWageInput && (weekly < FOUNDER_PLAYER_WEEKLY_SALARY_MIN || weekly > FOUNDER_PLAYER_WEEKLY_SALARY_MAX)) {
    throw httpError(
      `A starting club has only ${FOUNDER_PLAYER_WEEKLY_SALARY_MAX.toLocaleString()} STC wage budget per week. A higher Founder Player wage is not possible yet.`,
      400,
      'founder_wage_range'
    );
  }
  const bonus = Math.max(0, Number(terms.signing_bonus_stc) || 0);
  const rawTargets = Array.isArray(terms.performance_targets) ? terms.performance_targets : [];
  const targets = rawTargets
    .filter((row) => row && typeof row === 'object' && row.stat)
    .map((row) => ({
      stat: String(row.stat),
      type: FOUNDER_TARGET_TYPES.has(row.type) ? row.type : 'min',
      value: Number(row.value) || 0,
      value_max: Number(row.value_max) || 0,
    }));
  return {
    weekly_salary_stc: weekly,
    signing_bonus_stc: bonus,
    performance_targets: targets,
  };
}

function serializeFounderPerformanceTargets(terms, kind, founderKey) {
  if (Array.isArray(terms?.performance_targets) && terms.performance_targets.length) {
    return JSON.stringify(terms.performance_targets);
  }
  return JSON.stringify({ source: 'founder_onboarding', founder_contract_kind: kind, idempotency_key: founderKey });
}

function httpError(message, status = 400, code = null) {
  const err = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

function normalizeName(value) {
  return String(value || '').trim();
}

function normalizeTag(value) {
  return String(value || '').trim().toUpperCase();
}

function makeFounderKey({ userId, playerId, clubName, idempotencyKey }) {
  const raw = idempotencyKey || `${userId}:${playerId}:${normalizeName(clubName).toLowerCase()}`;
  return String(raw).trim().slice(0, 180);
}

function makeFounderOfferNote(founderKey) {
  return `Founder contract: ${founderKey}`;
}

function makeFounderPlayerOfferNote(founderKey) {
  return `Founder player contract: ${founderKey}`;
}

function makeFounderPresidentOfferNote(founderKey) {
  return `Founder president contract: ${founderKey}`;
}

function toRows(result) {
  return Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
}

async function withConnectionTransaction(dbPool, callback) {
  const conn = await dbPool.promise().getConnection();
  try {
    await conn.beginTransaction();
    const query = async (sql, params = []) => {
      const result = await conn.query(sql, params);
      return toRows(result);
    };
    const output = await callback(query);
    await conn.commit();
    return output;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function findExistingFounderClub(query, { userId, playerId, clubName }) {
  const rows = await query(
    `SELECT * FROM clubs
      WHERE president_player_id = ?
        AND (user_id = ? OR president_user_id = ?)
        AND LOWER(name) = LOWER(?)
      LIMIT 1
      FOR UPDATE`,
    [playerId, userId, userId, clubName]
  );
  return rows[0] || null;
}

async function createFounderClub(query, { user, playerId, club }) {
  const name = normalizeName(club?.name);
  const tag = normalizeTag(club?.tag);
  if (!name || !tag) throw httpError('Club name and tag are required', 400, 'club_required');

  const conflicts = await query(
    'SELECT id FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1 FOR UPDATE',
    [name]
  );
  if (conflicts.length) throw httpError('A club with this name already exists', 409, 'club_name_taken');

  const clubId = club?.id || uuidv4();
  await query(
    `INSERT INTO clubs (
      id, user_id, president_user_id, president_player_id, owner_email,
      name, tag, platform, region, country_code, logo_url, logo_position, logo_zoom, description,
      wins, losses, draws, goals_scored, goals_conceded,
      rating, peak_rating, matches_ranked, is_provisional, credits,
      stc, wage_budget_stc, transfer_budget_stc, stadium_level, stadium_capacity,
      tier, win_streak, loss_streak, status, trophies, created_date, updated_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      clubId,
      user.id,
      user.id,
      playerId,
      club?.owner_email || user.email,
      name,
      tag,
      club?.platform || null,
      club?.region || null,
      club?.country_code || null,
      club?.logo_url || null,
      club?.logo_position || null,
      club?.logo_zoom ?? null,
      club?.description || '',
      Number(club?.rating ?? STARTER_CLUB.rating),
      Number(club?.peak_rating ?? STARTER_CLUB.peak_rating),
      Number(club?.matches_ranked ?? STARTER_CLUB.matches_ranked),
      Number(club?.is_provisional ?? STARTER_CLUB.is_provisional),
      Number(club?.credits ?? STARTER_CLUB.credits),
      Number(club?.stc ?? STARTER_CLUB.stc),
      Number(club?.wage_budget_stc ?? STARTER_CLUB.wage_budget_stc),
      Number(club?.transfer_budget_stc ?? STARTER_CLUB.transfer_budget_stc),
      Number(club?.stadium_level ?? STARTER_CLUB.stadium_level),
      Number(club?.stadium_capacity ?? STARTER_CLUB.stadium_capacity),
      club?.tier || STARTER_CLUB.tier,
      Number(club?.win_streak ?? STARTER_CLUB.win_streak),
      Number(club?.loss_streak ?? STARTER_CLUB.loss_streak),
      club?.status || STARTER_CLUB.status,
      club?.trophies == null
        ? JSON.stringify([])
        : (typeof club.trophies === 'string' ? club.trophies : JSON.stringify(club.trophies)),
    ]
  );

  const balance = Number(club?.stc ?? STARTER_CLUB.stc);
  await query(
    `INSERT INTO stc_transactions
      (id, club_id, amount, balance_after, type, category, description,
       related_entity_type, related_entity_id, reference_id, created_date)
     VALUES (?, ?, ?, ?, 'income', 'starting_balance', ?,
      'club', ?, ?, NOW())`,
    [uuidv4(), clubId, balance, balance, 'Starting club finance grant', clubId, clubId]
  );

  return { id: clubId };
}

async function ensureFounderContract(query, {
  clubId,
  playerId,
  user,
  founderKey,
  contractType,
  kind,
  offerNote,
  compatibleTypes = [contractType],
  compatibleOfferNotes = [offerNote],
  terms = {},
}) {
  const contractTypes = [...new Set(compatibleTypes.filter(Boolean))];
  const existing = await query(
    `SELECT *, user_id AS target_player_id
       FROM player_contracts
      WHERE team_id = ?
        AND user_id = ?
        AND contract_type IN (${contractTypes.map(() => '?').join(',')})
        AND status IN ('active', 'pending', 'pending_window', 'negotiating')
      ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_date DESC
      LIMIT 1
      FOR UPDATE`,
    [clubId, playerId, ...contractTypes]
  );
  if (existing[0]) {
    const safeTerms = sanitizeFounderPlayerTerms(terms);
    const shouldUpdateTerms = kind === 'player' && (
      safeTerms.weekly_salary_stc > 0
      || safeTerms.signing_bonus_stc > 0
      || safeTerms.performance_targets.length > 0
    );
    if (existing[0].status !== 'active') {
      await query(
        "UPDATE player_contracts SET status = 'active', start_date = COALESCE(start_date, ?), end_date = COALESCE(end_date, ?), updated_date = NOW() WHERE id = ?",
        [new Date().toISOString().slice(0, 10), null, existing[0].id]
      );
    }
    if (shouldUpdateTerms) {
      await query(
        `UPDATE player_contracts
            SET weekly_salary_stc = ?,
                signing_bonus_stc = ?,
                performance_targets = ?,
                updated_date = NOW()
          WHERE id = ?`,
        [
          safeTerms.weekly_salary_stc,
          safeTerms.signing_bonus_stc,
          serializeFounderPerformanceTargets(safeTerms, kind, founderKey),
          existing[0].id,
        ]
      );
    }
    const rows = await query('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1', [existing[0].id]);
    return rows[0] || { ...existing[0], status: 'active' };
  }

  const id = terms.id || uuidv4();
  const safeTerms = sanitizeFounderPlayerTerms(terms);
  await query(
    `INSERT INTO player_contracts (
      id, team_id, user_id, contract_type, status, offered_by, offered_by_user_id,
      offered_by_club_id, max_games, max_days, weekly_salary_stc, signing_bonus_stc,
      transfer_fee_stc, offer_note, captaincy_offered, negotiation_round,
      start_date, end_date, performance_targets, created_date, updated_date
    ) VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      clubId,
      playerId,
      contractType,
      user.email || 'Founder',
      user.id,
      clubId,
      Number(terms.max_games ?? 0),
      Number(terms.max_days ?? FOUNDER_CONTRACT_DAYS),
      Number(safeTerms.weekly_salary_stc),
      Number(safeTerms.signing_bonus_stc),
      Number(terms.transfer_fee_stc ?? 0),
      offerNote,
      new Date().toISOString().slice(0, 10),
      null,
      serializeFounderPerformanceTargets(safeTerms, kind, founderKey),
    ]
  );

  const rows = await query('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1', [id]);
  return rows[0] || { id, team_id: clubId, user_id: playerId, target_player_id: playerId, contract_type: contractType, status: 'active', offer_note: offerNote };
}

async function createFounderContractLifecycle(input, options = {}) {
  const dbPool = options.pool || pool;
  const user = input?.user || {};
  const playerId = input?.playerId || input?.player_id || input?.club?.president_player_id || null;
  const clubName = normalizeName(input?.club?.name);
  if (!user.id) throw httpError('Authentication required', 401, 'auth_required');
  if (!playerId) throw httpError('player_id is required', 400, 'player_required');
  if (!clubName) throw httpError('club.name is required', 400, 'club_required');

  return withConnectionTransaction(dbPool, async (query) => {
    const players = await query(
      'SELECT id, user_id, email, club_id, role, club_roles FROM players WHERE id = ? LIMIT 1 FOR UPDATE',
      [playerId]
    );
    const player = players[0];
    if (!player) throw httpError('Player not found', 404, 'player_not_found');
    const sameUser = player.user_id && String(player.user_id) === String(user.id);
    const sameEmail = player.email && user.email && String(player.email).trim().toLowerCase() === String(user.email).trim().toLowerCase();
    if (!sameUser && !sameEmail) {
      throw httpError('Player must belong to the authenticated user', 403, 'player_forbidden');
    }

    const founderKey = makeFounderKey({
      userId: user.id,
      playerId,
      clubName,
      idempotencyKey: input?.idempotencyKey || input?.idempotency_key,
    });
    const existingClub = await findExistingFounderClub(query, {
      userId: user.id,
      playerId,
      clubName,
    });
    const clubShell = existingClub || await createFounderClub(query, {
      user,
      playerId,
      club: input.club,
    });
    const clubId = clubShell.id;

    const playerContract = await ensureFounderContract(query, {
      clubId,
      playerId,
      user,
      founderKey,
      contractType: FOUNDER_PLAYER_CONTRACT_TYPE,
      kind: 'player',
      offerNote: makeFounderPlayerOfferNote(founderKey),
      compatibleTypes: [FOUNDER_PLAYER_CONTRACT_TYPE, LEGACY_FOUNDER_CONTRACT_TYPE],
      compatibleOfferNotes: [makeFounderPlayerOfferNote(founderKey), makeFounderOfferNote(founderKey)],
      terms: input?.playerContract || input?.contract || {},
    });
    const presidentContract = await ensureFounderContract(query, {
      clubId,
      playerId,
      user,
      founderKey,
      contractType: FOUNDER_PRESIDENT_CONTRACT_TYPE,
      kind: 'president',
      offerNote: makeFounderPresidentOfferNote(founderKey),
      compatibleTypes: [FOUNDER_PRESIDENT_CONTRACT_TYPE],
      compatibleOfferNotes: [makeFounderPresidentOfferNote(founderKey)],
      terms: input?.presidentContract || {},
    });

    await query(
      'UPDATE clubs SET president_player_id = ?, president_user_id = ?, user_id = COALESCE(user_id, ?), owner_email = COALESCE(owner_email, ?), updated_date = NOW() WHERE id = ?',
      [playerId, user.id, user.id, user.email || null, clubId]
    );
    await query(
      "UPDATE users SET owner_id = ?, role_id = 1, updated_date = NOW() WHERE id = ?",
      [clubId, user.id]
    );
    await query(
      "UPDATE players SET club_id = ?, club_roles = ?, role = ?, status = 'active', updated_date = NOW() WHERE id = ?",
      [clubId, JSON.stringify(['president', 'member']), 'president', playerId]
    );

    const membershipId = await upsertActiveMembership({
      clubId,
      playerId,
      userId: player.user_id || user.id,
      primaryRole: 'president',
      source: 'founder_contract',
      query,
    });

    const [clubRows, playerRows, playerContractRows, presidentContractRows, membershipRows] = await Promise.all([
      query('SELECT * FROM clubs WHERE id = ? LIMIT 1', [clubId]),
      query('SELECT id, user_id, email, club_id, role, club_roles FROM players WHERE id = ? LIMIT 1', [playerId]),
      query('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1', [playerContract.id]),
      query('SELECT *, user_id AS target_player_id FROM player_contracts WHERE id = ? LIMIT 1', [presidentContract.id]),
      query('SELECT * FROM club_memberships WHERE id = ? LIMIT 1', [membershipId]),
    ]);
    const finalPlayerContract = playerContractRows[0] || playerContract;
    const finalPresidentContract = presidentContractRows[0] || presidentContract;

    return {
      club: clubRows[0] || { ...clubShell, president_player_id: playerId },
      player: playerRows[0] || { ...player, club_id: clubId, role: 'president', status: 'active' },
      contract: finalPlayerContract,
      playerContract: finalPlayerContract,
      presidentContract: finalPresidentContract,
      contracts: [finalPlayerContract, finalPresidentContract],
      membership: membershipRows[0] || {
        id: membershipId,
        club_id: clubId,
        player_id: playerId,
        user_id: player.user_id || user.id,
        status: 'active',
        primary_role: 'president',
        source: 'founder_contract',
      },
    };
  });
}

module.exports = {
  createFounderContractLifecycle,
  makeFounderKey,
};
