const express = require('express');
const router = express.Router();
const President = require('../models/presidentModel');
const { EXECUTESQL } = require('../db/database');
const { transferPresidentToClub } = require('../services/presidentTransferService');
const { listHistoryForPresident, openTenure } = require('../services/presidentClubHistoryService');
const { assertPersistableMediaFields } = require('../lib/mediaUrls');

const PROFILE_FIELDS = [
  'display_name',
  'role_title',
  'avatar_url',
  'avatar_position',
  'avatar_zoom',
  'banner_url',
  'banner_position',
  'banner_zoom',
  'bio',
  'success_level',
  'country_code',
  'quote',
  'management_style',
  'started_at',
  'social_links',
  'status',
];

const PROTECTED_FIELDS = new Set(['id', 'user_id']);

const LEGACY_CLUB_FIELD_MAP = {
  president_name: 'display_name',
  president_role_title: 'role_title',
  president_avatar_url: 'avatar_url',
  president_avatar_position: 'avatar_position',
  president_avatar_zoom: 'avatar_zoom',
  president_banner_url: 'banner_url',
  president_banner_position: 'banner_position',
  president_banner_zoom: 'banner_zoom',
  president_bio: 'bio',
  president_success_level: 'success_level',
  president_country_code: 'country_code',
  president_quote: 'quote',
  president_management_style: 'management_style',
  president_started_at: 'started_at',
  president_social_links: 'social_links',
};

/**
 * Pull president profile fields from a club-create body.
 * Accepts nested `president: { ... }` (canonical) and/or legacy flat `president_*` keys.
 * Mutates `body` to strip legacy flat keys so Club never persists profile fields.
 */
function extractPresidentProfileFromClubBody(body = {}) {
  const nested = body.president && typeof body.president === 'object' ? { ...body.president } : {};
  const profile = { ...nested };

  for (const [legacyKey, modernKey] of Object.entries(LEGACY_CLUB_FIELD_MAP)) {
    if (body[legacyKey] !== undefined && profile[modernKey] === undefined) {
      profile[modernKey] = body[legacyKey];
    }
    delete body[legacyKey];
  }
  delete body.president;

  return profile;
}

function isAdmin(user) {
  return Boolean(
    user?.role === 'admin'
    || user?.is_admin
    || Number(user?.role_id) === 0
    || Number(user?.role_id) === 2
  );
}

async function assertCanMutatePresident(req, existing) {
  if (isAdmin(req.user)) return;
  if (String(existing.user_id || '') === String(req.user?.id || '')) return;
  const err = new Error('Forbidden');
  err.status = 403;
  throw err;
}

// GET /
router.get('/', async (req, res) => {
  try {
    const { id, user_id, club_id, email, page } = req.query;
    const president = new President();
    let result;
    if (id) result = await president.selectOne(String(id));
    else if (user_id) result = await president.selectByUserId(user_id);
    else if (club_id) result = await president.selectByClub(club_id);
    else if (email) result = await president.selectByEmail(email);
    else {
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 25, 500));
      result = await president.selectAll(Number(page) || 1, limit);
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id/history — club tenure timeline for the president profile
router.get('/:id/history', async (req, res) => {
  try {
    const existing = await new President().selectOne(req.params.id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const history = await listHistoryForPresident(req.params.id, {
      limit: Number(req.query.limit) || 50,
    });
    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const president = new President();
    const result = await president.selectOne(req.params.id);
    if (!result.length) return res.status(404).json({ error: 'Not found' });
    res.json(result[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /
router.post('/', async (req, res) => {
  try {
    const body = { ...req.body };
    body.user_id = body.user_id || req.user?.id || null;
    if (!body.user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    if (!isAdmin(req.user) && String(body.user_id) !== String(req.user?.id || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!body.email && req.user?.email) body.email = req.user.email;

    const existing = await EXECUTESQL(
      'SELECT id FROM presidents WHERE user_id = ? LIMIT 1',
      [body.user_id]
    );
    if (existing.length) {
      return res.status(409).json({ error: 'A president profile already exists for this user' });
    }

    const president = new President(body);
    await president.create();
    if (president.club_id) {
      await EXECUTESQL(
        'UPDATE clubs SET president_id = ?, president_user_id = COALESCE(president_user_id, ?) WHERE id = ?',
        [president.id, president.user_id, president.club_id]
      ).catch(() => {});
      await openTenure({
        presidentId: president.id,
        clubId: president.club_id,
        reason: 'President created',
      }).catch((err) => console.error('[president_club_history] create:', err.message));
    }
    const created = await president.selectOne(president.id);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /:id/transfer — admin-only club reassignment (or detach with club_id: null)
router.post('/:id/transfer', async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const clubId = Object.prototype.hasOwnProperty.call(req.body || {}, 'club_id')
      ? req.body.club_id
      : undefined;
    if (clubId === undefined) {
      return res.status(400).json({ error: 'club_id is required (use null to detach)' });
    }

    const result = await transferPresidentToClub({
      presidentId: req.params.id,
      clubId,
      actor: req.user,
      reason: req.body?.reason || null,
    });

    const refreshed = await new President().selectOne(req.params.id);
    res.json({
      president: refreshed[0] || result.president,
      from_club_id: result.fromClubId,
      to_club_id: clubId || null,
      displaced_president_id: result.displacedPresident?.id || null,
      noop: Boolean(result.noop),
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /:id — profile fields only. Club changes go through POST /:id/transfer.
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existingRows = await new President().selectOne(id);
    if (!existingRows.length) return res.status(404).json({ error: 'Not found' });
    const existing = existingRows[0];
    await assertCanMutatePresident(req, existing);

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'club_id') && !isAdmin(req.user)) {
      return res.status(400).json({
        error: 'Use POST /presidents/:id/transfer to change club assignment',
      });
    }

    const safeBody = {};
    for (const [field, value] of Object.entries(req.body || {})) {
      if (PROTECTED_FIELDS.has(field)) continue;
      if (field === 'club_id') continue; // transfer endpoint only
      if (!PROFILE_FIELDS.includes(field) && field !== 'email') continue;
      safeBody[field] = value;
    }
    assertPersistableMediaFields(safeBody, ['avatar_url', 'banner_url']);

    const merged = { ...existing, ...safeBody };
    const president = new President(merged);
    await president.update(id);

    const updated = await president.selectOne(id);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { id } = req.params;
    const existing = await new President().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (existing[0].club_id) {
      await EXECUTESQL(
        'UPDATE clubs SET president_id = NULL WHERE id = ? AND president_id = ?',
        [existing[0].club_id, id]
      ).catch(() => {});
    }
    await new President().delete(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.extractPresidentProfileFromClubBody = extractPresidentProfileFromClubBody;
module.exports.LEGACY_CLUB_FIELD_MAP = LEGACY_CLUB_FIELD_MAP;
