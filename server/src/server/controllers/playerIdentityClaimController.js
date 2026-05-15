const express = require('express');
const router = express.Router();
const PlayerIdentityClaim = require('../models/playerIdentityClaimModel');
const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_STATUSES = new Set(['pending', 'approved', 'rejected', 'cancelled']);

async function getCurrentUser(req) {
  const rows = await EXECUTESQL('SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1', [req.user?.id]);
  return rows[0] || null;
}

function isAdmin(user) {
  return Number(user?.role_id) === 0;
}

async function writeAudit({ admin, action, entityId, entityName, oldValue, newValue, reason }) {
  await EXECUTESQL(
    `INSERT INTO admin_audit_log
       (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name,
        old_value, new_value, reason, created_date)
     VALUES (?, ?, ?, ?, 'player_identity_claim', ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(),
      admin?.id || null,
      admin?.email || null,
      action,
      entityId,
      entityName || null,
      oldValue == null ? null : JSON.stringify(oldValue),
      newValue == null ? null : JSON.stringify(newValue),
      reason || null,
    ]
  ).catch((err) => console.error('[audit] player_identity_claim:', err.message));
}

async function notifyAdminsOfClaim(claim) {
  const admins = await EXECUTESQL('SELECT email FROM users WHERE role_id = 0 AND email IS NOT NULL', [])
    .catch(() => []);
  for (const admin of admins) {
    await EXECUTESQL(
      `INSERT INTO notifications
         (id, recipient_email, type, title, body, link, created_date)
       VALUES (?, ?, 'identity_claim', ?, ?, '/admin/identity-claims', NOW())`,
      [
        uuidv4(),
        admin.email,
        'New identity claim',
        `${claim.gamertag || claim.email || 'A player'} submitted a ${claim.platform} identity claim.`,
      ]
    ).catch((err) => console.error('[identity-claim-notification]', err.message));
  }
}

function sanitizeBody(body = {}) {
  return {
    platform: String(body.platform || '').trim(),
    platform_handle: String(body.platform_handle || '').trim(),
    ea_id: body.ea_id ? String(body.ea_id).trim() : null,
    discord_handle: body.discord_handle ? String(body.discord_handle).trim() : null,
    proof_url: body.proof_url ? String(body.proof_url).trim() : null,
    notes: body.notes ? String(body.notes).trim() : null,
  };
}

async function playerBelongsToUser(playerId, user) {
  const rows = await EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [playerId]);
  const player = rows[0];
  if (!player) return { ok: false, status: 404, error: 'Player not found' };
  if (!isAdmin(user) && player.user_id !== user.id && String(player.email).toLowerCase() !== String(user.email).toLowerCase()) {
    return { ok: false, status: 403, error: 'You can only claim your own player identity' };
  }
  return { ok: true, player };
}

// GET /
router.get('/', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });

    const { player_id, user_id, status, page } = req.query;
    const model = new PlayerIdentityClaim();
    let result;

    if (player_id) {
      const ownership = await playerBelongsToUser(String(player_id), user);
      if (!ownership.ok) return res.status(ownership.status).json({ error: ownership.error });
      result = await model.selectByPlayer(String(player_id));
    } else if (user_id) {
      if (!isAdmin(user) && String(user_id) !== user.id) return res.status(403).json({ error: 'Forbidden' });
      result = await model.selectByUser(String(user_id));
    } else if (status) {
      if (!isAdmin(user)) return res.status(403).json({ error: 'Admin access required' });
      result = await model.selectByStatus(String(status));
    } else if (isAdmin(user)) {
      result = await model.selectAll(Number(page) || 1);
    } else {
      result = await model.selectByUser(user.id);
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const rows = await new PlayerIdentityClaim().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const claim = rows[0];
    if (!isAdmin(user) && claim.user_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
    res.json(claim);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const playerId = req.body?.player_id || req.user?.player_id;
    if (!playerId) return res.status(400).json({ error: 'player_id required' });

    const ownership = await playerBelongsToUser(String(playerId), user);
    if (!ownership.ok) return res.status(ownership.status).json({ error: ownership.error });
    const player = ownership.player;
    if (Number(player.is_verified) === 1) return res.status(409).json({ error: 'Player is already verified' });

    const payload = sanitizeBody(req.body);
    if (!payload.platform || !payload.platform_handle) {
      return res.status(400).json({ error: 'platform and platform_handle are required' });
    }

    const pending = await EXECUTESQL(
      "SELECT id FROM player_identity_claims WHERE player_id = ? AND status = 'pending' LIMIT 1",
      [player.id]
    );
    if (pending.length) return res.status(409).json({ error: 'You already have a pending identity claim' });

    const claim = new PlayerIdentityClaim({
      ...payload,
      player_id: player.id,
      user_id: player.user_id || user.id,
      email: player.email || user.email,
      gamertag: player.gamertag,
      status: 'pending',
    });
    await claim.create();
    const created = await claim.selectOne(claim.id);
    await notifyAdminsOfClaim(created[0]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id — admins approve/reject; owners may cancel pending claims.
router.patch('/:id', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const rows = await new PlayerIdentityClaim().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const existing = rows[0];
    const nextStatus = req.body?.status || existing.status;
    if (!ALLOWED_STATUSES.has(nextStatus)) return res.status(400).json({ error: 'Invalid status' });

    if (!isAdmin(user)) {
      if (existing.user_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
      if (existing.status !== 'pending' || nextStatus !== 'cancelled') {
        return res.status(403).json({ error: 'Only admins can review identity claims' });
      }
    }

    const patch = sanitizeBody({ ...existing, ...req.body });
    const claim = new PlayerIdentityClaim({
      ...existing,
      ...patch,
      status: nextStatus,
      review_notes: req.body?.review_notes ?? existing.review_notes,
      rejection_reason: req.body?.rejection_reason ?? existing.rejection_reason,
      reviewed_by: isAdmin(user) && nextStatus !== 'pending' ? user.id : existing.reviewed_by,
      reviewed_by_email: isAdmin(user) && nextStatus !== 'pending' ? user.email : existing.reviewed_by_email,
      reviewed_at: isAdmin(user) && nextStatus !== 'pending' ? new Date().toISOString() : existing.reviewed_at,
    });
    await claim.update(existing.id);

    if (isAdmin(user) && nextStatus === 'approved') {
      await EXECUTESQL(
        `UPDATE players
         SET is_verified = 1,
             verified_platform = ?,
             verified_platform_handle = ?,
             identity_verified_at = NOW(),
             updated_date = NOW()
         WHERE id = ?`,
        [claim.platform, claim.platform_handle, claim.player_id]
      );
      await writeAudit({
        admin: user,
        action: 'approve_player_identity_claim',
        entityId: claim.player_id,
        entityName: claim.gamertag,
        oldValue: { is_verified: false, claim: existing },
        newValue: { is_verified: true, claim: { ...existing, status: 'approved' } },
        reason: claim.review_notes || 'Identity claim approved',
      });
    } else if (isAdmin(user) && nextStatus === 'rejected') {
      await writeAudit({
        admin: user,
        action: 'reject_player_identity_claim',
        entityId: claim.player_id,
        entityName: claim.gamertag,
        oldValue: existing,
        newValue: { ...existing, status: 'rejected' },
        reason: claim.rejection_reason || claim.review_notes || 'Identity claim rejected',
      });
    }

    const updated = await claim.selectOne(existing.id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'User not found' });
    const rows = await new PlayerIdentityClaim().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const claim = rows[0];
    if (!isAdmin(user) && claim.user_id !== user.id) return res.status(403).json({ error: 'Forbidden' });
    if (!isAdmin(user) && claim.status !== 'pending' && claim.status !== 'cancelled') {
      return res.status(403).json({ error: 'Reviewed claims cannot be deleted' });
    }
    await new PlayerIdentityClaim().delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
