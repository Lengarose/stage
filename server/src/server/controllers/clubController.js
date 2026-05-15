const express = require('express');
const router  = express.Router();
const Club    = require('../models/clubModel');
const ClubStaffRole = require('../models/clubStaffRoleModel');
const ClubFixtureLineup = require('../models/clubFixtureLineupModel');
const { EXECUTESQL } = require('../db/database');
const { socketEmit } = require('../express/index');
const { SOCKET_CHANNELS, MAKE_SOCKET_CHANNEL } = require('../../constants/constants');
const {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  requireClubPermission,
  writeClubAudit,
} = require('../services/clubOperationsService');
const { v4: uuidv4 } = require('uuid');

// GET /
router.get('/', async (req, res) => {
  try {
    const { owner_email, user_id, page, id, name } = req.query;
    const club = new Club();
    let result;
    if (owner_email) result = await club.selectByOwner(owner_email);
    else if (user_id) result = await club.selectByUserId(user_id);
    else if (id) result = await club.selectOne(String(id));
    else if (name) {
      result = await EXECUTESQL(
        'SELECT * FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 50',
        [String(name)]
      );
    }
    else result = await club.selectAll(Number(page) || 1);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    const club   = new Club();
    const result = await club.selectOne(req.params.id);
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
    const { name } = req.body || {};
    if (name) {
      const existingByName = await EXECUTESQL(
        'SELECT id FROM clubs WHERE LOWER(name) = LOWER(?) LIMIT 1',
        [name]
      );
      if (existingByName.length) {
        return res.status(409).json({ error: 'A club with this name already exists' });
      }
    }

    const body = { ...req.body };
    if (body.stc               == null) body.stc                = 30_000_000;
    if (body.transfer_budget_stc == null) body.transfer_budget_stc = 5_000_000;
    if (body.wage_budget_stc     == null) body.wage_budget_stc     = 1_500_000;

    const club = new Club(body);
    await club.create();
    const created = await club.selectOne(club.id);
    const record  = created[0];
    let ownerContractId = null;
    if (record?.user_id) {
      await EXECUTESQL(
        'UPDATE users SET owner_id = ?, role_id = 1, updated_date = NOW() WHERE id = ?',
        [record.id, record.user_id]
      );
    }
    const creatorRows = await EXECUTESQL(
      `SELECT * FROM players
       WHERE id = ? OR user_id = ? OR LOWER(email)=LOWER(?)
       ORDER BY id = ? DESC
       LIMIT 1`,
      [body.creator_player_id || '', record?.user_id || req.user?.id || '', record?.owner_email || req.user?.email || '', body.creator_player_id || '']
    ).catch(() => []);
    const creator = creatorRows[0] || null;
    if (creator?.id) {
      await EXECUTESQL(
        `UPDATE players
         SET club_id = ?, club_roles = ?, role = 'owner', status = 'active'
         WHERE id = ?`,
        [record.id, JSON.stringify(['owner', 'president']), creator.id]
      ).catch(() => {});
      const existingOwnerContract = await EXECUTESQL(
        "SELECT id FROM player_contracts WHERE team_id = ? AND user_id = ? AND contract_type = 'ownership' AND status IN ('pending','pending_window','active') LIMIT 1",
        [record.id, creator.id]
      ).catch(() => []);
      if (existingOwnerContract[0]?.id) {
        ownerContractId = existingOwnerContract[0].id;
      } else {
        ownerContractId = uuidv4();
        await EXECUTESQL(
          `INSERT INTO player_contracts (
             id, team_id, user_id, contract_type, status, offered_by,
             max_games, max_days, weekly_salary_stc, signing_bonus_stc, transfer_fee_stc,
             offer_note, captaincy_offered, negotiation_round, created_date, updated_date
           ) VALUES (?, ?, ?, 'ownership', 'pending', ?, 999, 3650, 0, 0, 0, ?, 0, 0, NOW(), NOW())`,
          [
            ownerContractId,
            record.id,
            creator.id,
            record.owner_email || req.user?.email || 'Stage',
            `Ownership contract for ${record.name}`,
          ]
        ).catch(() => { ownerContractId = null; });
      }
    }
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.CLUB), record);
    res.status(201).json({ ...record, owner_contract_id: ownerContractId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new Club().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    if (req.body?.name) {
      const existingByName = await EXECUTESQL(
        'SELECT id FROM clubs WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1',
        [req.body.name, id]
      );
      if (existingByName.length) {
        return res.status(409).json({ error: 'A club with this name already exists' });
      }
    }
    const club = new Club({ ...existing[0], ...req.body });
    await club.update(id);
    const updated = await club.selectOne(id);
    const record  = updated[0];
    if (record?.user_id) {
      await EXECUTESQL(
        'UPDATE users SET owner_id = COALESCE(owner_id, ?), role_id = 1, updated_date = NOW() WHERE id = ?',
        [record.id, record.user_id]
      );
    }
    socketEmit(MAKE_SOCKET_CHANNEL(record.id, SOCKET_CHANNELS.CLUB), record);
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new Club().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Club().delete(id);
    socketEmit(MAKE_SOCKET_CHANNEL(id, SOCKET_CHANNELS.CLUB), { deleted: true, id });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// POST /:id/staff — assign a club operations role
router.post('/:id/staff', async (req, res) => {
  try {
    const { id } = req.params;
    const { user } = await requireClubPermission(req, id, 'manage_staff');
    const role = req.body?.role;
    if (!ROLE_PERMISSIONS[role]) return res.status(400).json({ error: 'Invalid role' });
    const playerId = req.body?.player_id;
    if (!playerId) return res.status(400).json({ error: 'player_id is required' });
    const players = await EXECUTESQL('SELECT id, user_id FROM players WHERE id = ? AND club_id = ? LIMIT 1', [playerId, id]);
    if (!players.length) return res.status(404).json({ error: 'Player is not in this club' });
    const permissions = (req.body?.permissions || ROLE_PERMISSIONS[role] || []).filter((p) => ALL_PERMISSIONS.includes(p));
    const model = new ClubStaffRole({
      club_id: id,
      player_id: playerId,
      user_id: players[0].user_id || null,
      role,
      permissions,
      assigned_by_user_id: user.id,
    });
    await model.create();
    const created = (await model.selectOne(model.id))[0];
    await writeClubAudit({ clubId: id, user, action: 'staff_role_changed', entityType: 'club_staff_role', entityId: model.id, newValue: created });
    res.status(201).json(created);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /:id/staff/:playerId/remove — remove staff roles for a player
router.post('/:id/staff/:playerId/remove', async (req, res) => {
  try {
    const { id, playerId } = req.params;
    const { user } = await requireClubPermission(req, id, 'manage_staff');
    const oldRows = await EXECUTESQL('SELECT * FROM club_staff_roles WHERE club_id = ? AND player_id = ?', [id, playerId]).catch(() => []);
    await EXECUTESQL('DELETE FROM club_staff_roles WHERE club_id = ? AND player_id = ?', [id, playerId]).catch(() => {});
    await writeClubAudit({ clubId: id, user, action: 'staff_role_changed', entityType: 'club_staff_role', entityId: playerId, oldValue: oldRows, reason: req.body?.reason });
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /:id/staff/:playerId/permissions — replace staff permissions for a player
router.post('/:id/staff/:playerId/permissions', async (req, res) => {
  try {
    const { id, playerId } = req.params;
    const { user } = await requireClubPermission(req, id, 'manage_staff');
    const permissions = (req.body?.permissions || []).filter((p) => ALL_PERMISSIONS.includes(p));
    const oldRows = await EXECUTESQL('SELECT * FROM club_staff_roles WHERE club_id = ? AND player_id = ?', [id, playerId]).catch(() => []);
    await EXECUTESQL(
      'UPDATE club_staff_roles SET permissions = ?, updated_date = NOW() WHERE club_id = ? AND player_id = ?',
      [JSON.stringify(permissions), id, playerId]
    ).catch(() => {});
    const newRows = await EXECUTESQL('SELECT * FROM club_staff_roles WHERE club_id = ? AND player_id = ?', [id, playerId]).catch(() => []);
    await writeClubAudit({ clubId: id, user, action: 'staff_permission_changed', entityType: 'club_staff_role', entityId: playerId, oldValue: oldRows, newValue: newRows });
    res.json({ success: true, permissions });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /:id/lineups/:fixtureId/publish — publish fixture lineup
router.post('/:id/lineups/:fixtureId/publish', async (req, res) => {
  try {
    const { id, fixtureId } = req.params;
    const { user } = await requireClubPermission(req, id, 'manage_lineup');
    const rows = await new ClubFixtureLineup().selectAll({ club_id: id, fixture_id: fixtureId, limit: 1 });
    if (!rows.length) return res.status(404).json({ error: 'Lineup not found' });
    const existing = rows[0];
    await new ClubFixtureLineup({ ...existing, status: 'published', created_by_user_id: existing.created_by_user_id || user.id }).update(existing.id);
    const updated = (await new ClubFixtureLineup().selectOne(existing.id))[0];
    await writeClubAudit({ clubId: id, user, action: 'lineup_published', entityType: 'club_fixture_lineup', entityId: existing.id, oldValue: existing, newValue: updated });
    res.json(updated);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
