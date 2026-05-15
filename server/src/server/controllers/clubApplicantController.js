const express = require('express');
const router = express.Router();
const ClubApplicant = require('../models/clubApplicantModel');
const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const {
  getUser,
  isAdmin,
  getClubAccess,
  requireClubPermission,
  writeClubAudit,
  notifyEmail,
  getCurrentTransferWindow,
} = require('../services/clubOperationsService');

const STATUSES = new Set(['new', 'reviewed', 'invited', 'trial_offered', 'trial_active', 'contract_offered', 'accepted', 'declined', 'withdrawn']);
const SOURCE_TYPES = new Set(['join_request', 'recruitment_interest', 'trial_request', 'manual']);

function handleError(res, err) {
  res.status(err.status || 500).json({ error: err.message });
}

async function syncLegacyApplicants(clubId) {
  if (!clubId) return;
  const joinRows = await EXECUTESQL(
    `SELECT jr.*, p.user_id, p.position, p.platform
     FROM join_requests jr
     LEFT JOIN players p ON p.id = jr.player_id
     WHERE jr.club_id = ? AND jr.status = 'pending'`,
    [clubId]
  ).catch(() => []);
  for (const row of joinRows) {
    await EXECUTESQL(
      `INSERT IGNORE INTO club_applicants
        (id, club_id, player_id, user_id, source_type, source_id, status, preferred_position, platform, message, created_date, updated_date)
       VALUES (?, ?, ?, ?, 'join_request', ?, 'new', ?, ?, ?, COALESCE(?, NOW()), NOW())`,
      [uuidv4(), row.club_id, row.player_id, row.user_id || null, row.id, row.position || null, row.platform || null, row.message || null, row.created_date || null]
    ).catch(() => {});
  }

  const interestRows = await EXECUTESQL(
    `SELECT ri.*, p.user_id, p.position, p.platform
     FROM recruitment_interests ri
     LEFT JOIN players p ON p.id = ri.sender_player_id
     WHERE ri.recipient_club_id = ? AND ri.status = 'pending'`,
    [clubId]
  ).catch(() => []);
  for (const row of interestRows) {
    await EXECUTESQL(
      `INSERT IGNORE INTO club_applicants
        (id, club_id, player_id, user_id, source_type, source_id, status, preferred_position, platform, message, created_date, updated_date)
       VALUES (?, ?, ?, ?, 'recruitment_interest', ?, 'new', ?, ?, ?, COALESCE(?, NOW()), NOW())`,
      [uuidv4(), row.recipient_club_id, row.sender_player_id || null, row.user_id || row.sender_user_id || null, row.id, row.position || null, row.platform || null, row.message || null, row.created_date || null]
    ).catch(() => {});
  }

  const trialRows = await EXECUTESQL(
    `SELECT im.*
     FROM inbox_messages im
     WHERE im.message_type = 'trial_request'
       AND (im.related_entity_id = ? OR JSON_EXTRACT(im.metadata, '$.club_id') = ?)`,
    [clubId, clubId]
  ).catch(() => []);
  for (const row of trialRows) {
    let meta = {};
    try { meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {}); } catch { meta = {}; }
    await EXECUTESQL(
      `INSERT IGNORE INTO club_applicants
        (id, club_id, player_id, user_id, source_type, source_id, status, preferred_position, platform, message, created_date, updated_date)
       VALUES (?, ?, ?, ?, 'trial_request', ?, 'new', ?, ?, ?, COALESCE(?, NOW()), NOW())`,
      [
        uuidv4(), clubId, meta.player_id || null, null, row.id,
        meta.player_position || null, meta.player_console || null,
        row.body || meta.trial_note || null, row.created_date || null,
      ]
    ).catch(() => {});
  }
}

async function loadApplicant(id) {
  const rows = await new ClubApplicant().selectOne(id);
  return rows[0] || null;
}

async function updateApplicantStatus(req, res, status, actionName) {
  try {
    const existing = await loadApplicant(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { user } = await requireClubPermission(req, existing.club_id, status === 'withdrawn' ? null : 'review_applicants');
    if (status === 'withdrawn' && !isAdmin(user) && existing.user_id !== user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const model = new ClubApplicant({ ...existing, status, notes: req.body?.notes ?? existing.notes });
    await model.update(existing.id);
    const updated = await loadApplicant(existing.id);
    if (existing.source_type === 'join_request' && existing.source_id && status === 'declined') {
      await EXECUTESQL("UPDATE join_requests SET status = 'rejected' WHERE id = ?", [existing.source_id]).catch(() => {});
    }
    await writeClubAudit({
      clubId: existing.club_id,
      user,
      action: actionName,
      entityType: 'club_applicant',
      entityId: existing.id,
      oldValue: existing,
      newValue: updated,
      reason: req.body?.reason || req.body?.notes || null,
    });
    res.json(updated);
  } catch (err) {
    handleError(res, err);
  }
}

async function offerContract(req, res, isTrial) {
  try {
    const existing = await loadApplicant(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { user } = await requireClubPermission(req, existing.club_id, 'offer_contracts');
    if (!existing.player_id) return res.status(400).json({ error: 'Applicant is not linked to a player profile' });

    const currentWindow = await getCurrentTransferWindow();
    const contractId = uuidv4();
    const status = currentWindow ? 'pending' : 'pending_window';
    const contractType = isTrial ? 'trial' : (req.body?.contract_type || 'squad');
    await EXECUTESQL(
      `INSERT INTO player_contracts (
        id, team_id, user_id, contract_type, status, offered_by,
        max_games, max_days, weekly_salary_stc, signing_bonus_stc, transfer_fee_stc,
        offer_note, captaincy_offered, negotiation_round, performance_targets, created_date, updated_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, NOW(), NOW())`,
      [
        contractId,
        existing.club_id,
        existing.player_id,
        contractType,
        status,
        user.email,
        isTrial ? Number(req.body?.max_games || 5) : (req.body?.max_games || null),
        isTrial ? Number(req.body?.max_days || 14) : (req.body?.max_days || null),
        Number(req.body?.weekly_salary_stc || 0),
        Number(req.body?.signing_bonus_stc || 0),
        Number(req.body?.transfer_fee_stc || 0),
        req.body?.offer_note || (isTrial ? 'Trial offer from club operations' : ''),
        req.body?.captaincy_offered ? 1 : 0,
        req.body?.performance_targets ? JSON.stringify(req.body.performance_targets) : null,
      ]
    );

    const nextStatus = isTrial ? 'trial_offered' : 'contract_offered';
    await new ClubApplicant({ ...existing, status: nextStatus }).update(existing.id);
    if (existing.source_type === 'join_request' && existing.source_id) {
      await EXECUTESQL("UPDATE join_requests SET status = ? WHERE id = ?", [nextStatus, existing.source_id]).catch(() => {});
    }
    const updated = await loadApplicant(existing.id);
    await writeClubAudit({
      clubId: existing.club_id,
      user,
      action: isTrial ? 'trial_offered' : 'contract_offered',
      entityType: 'club_applicant',
      entityId: existing.id,
      oldValue: existing,
      newValue: { ...updated, contract_id: contractId },
      reason: req.body?.offer_note || null,
    });
    if (existing.player_email) {
      await notifyEmail(
        existing.player_email,
        isTrial ? 'Trial contract offered' : 'Contract offered',
        `You have a ${isTrial ? 'trial ' : ''}contract offer from ${existing.club_name || 'a club'}.`,
        '/inbox'
      );
    }
    res.json({ ...updated, contract_id: contractId, contract_status: status });
  } catch (err) {
    handleError(res, err);
  }
}

router.get('/', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const filters = { ...req.query };
    if (filters.club_id) {
      const access = await getClubAccess(user, filters.club_id);
      if (!isAdmin(user) && !access.permissions.includes('review_applicants')) {
        filters.user_id = user.id;
      } else {
        await syncLegacyApplicants(filters.club_id);
      }
    } else if (!isAdmin(user)) {
      filters.user_id = user.id;
    }
    res.json(await new ClubApplicant().selectAll(filters));
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const applicant = await loadApplicant(req.params.id);
    if (!applicant) return res.status(404).json({ error: 'Not found' });
    const access = await getClubAccess(user, applicant.club_id);
    if (!isAdmin(user) && applicant.user_id !== user.id && !access.permissions.includes('review_applicants')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(applicant);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/', async (req, res) => {
  try {
    const { user } = await requireClubPermission(req, req.body?.club_id, 'review_applicants');
    if (!SOURCE_TYPES.has(req.body?.source_type || 'manual')) return res.status(400).json({ error: 'Invalid source_type' });
    if (req.body?.status && !STATUSES.has(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
    const model = new ClubApplicant({ ...req.body, status: req.body?.status || 'new' });
    await model.create();
    const created = await loadApplicant(model.id);
    await writeClubAudit({ clubId: created.club_id, user, action: 'applicant_created', entityType: 'club_applicant', entityId: created.id, newValue: created });
    res.status(201).json(created);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const existing = await loadApplicant(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { user } = await requireClubPermission(req, existing.club_id, 'review_applicants');
    const body = { ...existing, ...req.body };
    if (!STATUSES.has(body.status)) return res.status(400).json({ error: 'Invalid status' });
    await new ClubApplicant(body).update(existing.id);
    const updated = await loadApplicant(existing.id);
    await writeClubAudit({ clubId: existing.club_id, user, action: 'applicant_updated', entityType: 'club_applicant', entityId: existing.id, oldValue: existing, newValue: updated });
    res.json(updated);
  } catch (err) {
    handleError(res, err);
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await loadApplicant(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const { user } = await requireClubPermission(req, existing.club_id, 'review_applicants');
    await new ClubApplicant().delete(existing.id);
    await writeClubAudit({ clubId: existing.club_id, user, action: 'applicant_deleted', entityType: 'club_applicant', entityId: existing.id, oldValue: existing });
    res.json({ success: true });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/:id/review', (req, res) => updateApplicantStatus(req, res, 'reviewed', 'applicant_reviewed'));
router.post('/:id/decline', (req, res) => updateApplicantStatus(req, res, 'declined', 'applicant_declined'));
router.post('/:id/withdraw', (req, res) => updateApplicantStatus(req, res, 'withdrawn', 'applicant_withdrawn'));
router.post('/:id/offer-trial', (req, res) => offerContract(req, res, true));
router.post('/:id/offer-contract', (req, res) => offerContract(req, res, false));

module.exports = router;
