const express = require('express');
const router  = express.Router();
const Club    = require('../models/clubModel');
const President = require('../models/presidentModel');
const ClubStaffRole = require('../models/clubStaffRoleModel');
const ClubFixtureLineup = require('../models/clubFixtureLineupModel');
const { EXECUTESQL } = require('../db/database');
const { broadcastClub, broadcastClubDeleted } = require('../utils/socketBroadcast');
const {
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  requireClubPermission,
  writeClubAudit,
} = require('../services/clubOperationsService');
const { upsertActiveMembership } = require('../services/clubMembershipService');
const { extractPresidentProfileFromClubBody } = require('./presidentController');
const { v4: uuidv4 } = require('uuid');

const CLUB_PROFILE_UPDATE_FIELDS = [
  'name',
  'tag',
  'platform',
  'region',
  'country_code',
  'logo_url',
  'logo_position',
  'logo_zoom',
  'description',
  'banner_url',
  'banner_position',
  'banner_zoom',
];

const PROFILE_UPDATE_FIELDS = new Set(CLUB_PROFILE_UPDATE_FIELDS);

const CLUB_MODEL_UPDATE_FIELDS = new Set([
  'user_id',
  'president_user_id',
  'president_id',
  'owner_email',
  'name',
  'tag',
  'platform',
  'region',
  'country_code',
  'logo_url',
  'logo_position',
  'logo_zoom',
  'description',
  'wins',
  'losses',
  'draws',
  'goals_scored',
  'goals_conceded',
  'rating',
  'peak_rating',
  'matches_ranked',
  'is_provisional',
  'credits',
  'stc',
  'wage_budget_stc',
  'transfer_budget_stc',
  'stadium_level',
  'stadium_capacity',
  'tier',
  'form',
  'win_streak',
  'loss_streak',
  'status',
  'formation',
  'lineup',
  'trophies',
  'banner_url',
  'banner_position',
  'banner_zoom',
]);

const FORMATION_UPDATE_FIELDS = new Set(['formation', 'lineup']);
const PROTECTED_IDENTITY_FIELDS = new Set(['id', 'user_id', 'president_user_id', 'president_id', 'owner_email']);

function hasClubPermission(access, permission) {
  return Boolean(access?.admin || access?.permissions?.includes(permission));
}

function hasLegacyCaptainProfileAccess(access) {
  return Boolean(access?.roles?.some((role) => ['captain', 'vice_captain', 'vice-captain'].includes(role)));
}

function assertClubPatchAllowed(access, fields) {
  if (access?.admin) return;
  const restricted = fields.filter((field) => (
    !PROFILE_UPDATE_FIELDS.has(field) && !FORMATION_UPDATE_FIELDS.has(field)
  ));
  if (restricted.length) {
    const err = new Error(`Forbidden club update fields: ${restricted.join(', ')}`);
    err.status = 403;
    throw err;
  }
  const needsProfile = fields.some((field) => PROFILE_UPDATE_FIELDS.has(field));
  const onlyLegacyClubProfile = fields.every((field) => CLUB_PROFILE_UPDATE_FIELDS.includes(field));
  if (needsProfile && !hasClubPermission(access, 'edit_club_profile') && !(onlyLegacyClubProfile && hasLegacyCaptainProfileAccess(access))) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  const needsFormation = fields.some((field) => FORMATION_UPDATE_FIELDS.has(field));
  if (needsFormation && !hasClubPermission(access, 'manage_formation') && !hasClubPermission(access, 'manage_lineup')) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

async function resolveClubUserId(req, body = {}) {
  const candidate = req.user?.id || body.user_id || null;
  if (!candidate) return null;
  const rows = await EXECUTESQL('SELECT id FROM users WHERE id = ? LIMIT 1', [candidate]);
  if (!rows.length) {
    const err = new Error('Your session user no longer exists. Please log out and sign in again.');
    err.status = 400;
    throw err;
  }
  return candidate;
}

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
    const presidentProfile = extractPresidentProfileFromClubBody(body);
    body.user_id = await resolveClubUserId(req, body);
    body.president_user_id = body.president_user_id || body.user_id || req.user?.id || null;
    if (!body.owner_email && req.user?.email) body.owner_email = req.user.email;
    if (body.stc               == null) body.stc                = 30_000_000;
    if (body.transfer_budget_stc == null) body.transfer_budget_stc = 5_000_000;
    if (body.wage_budget_stc     == null) body.wage_budget_stc     = 1_500_000;

    // Ensure a President entity exists for the club president.
    // Accepts nested `president` (current) or legacy flat president_* keys.
    let presidentId = body.president_id || null;
    if (!presidentId && body.president_user_id) {
      const existingPresident = await EXECUTESQL(
        'SELECT id FROM presidents WHERE user_id = ? LIMIT 1',
        [body.president_user_id]
      ).catch(() => []);
      if (existingPresident[0]?.id) {
        presidentId = existingPresident[0].id;
        // Refresh profile fields captured during onboarding onto the existing entity.
        const hasProfile = Object.values(presidentProfile).some((value) => value != null && value !== '');
        if (hasProfile) {
          await EXECUTESQL(
            `UPDATE presidents SET
              email = COALESCE(?, email),
              display_name = COALESCE(?, display_name),
              role_title = COALESCE(?, role_title),
              avatar_url = COALESCE(?, avatar_url),
              avatar_position = COALESCE(?, avatar_position),
              avatar_zoom = COALESCE(?, avatar_zoom),
              banner_url = COALESCE(?, banner_url),
              banner_position = COALESCE(?, banner_position),
              banner_zoom = COALESCE(?, banner_zoom),
              bio = COALESCE(?, bio),
              success_level = COALESCE(?, success_level),
              country_code = COALESCE(?, country_code),
              quote = COALESCE(?, quote),
              management_style = COALESCE(?, management_style),
              started_at = COALESCE(?, started_at),
              social_links = COALESCE(?, social_links)
             WHERE id = ?`,
            [
              body.owner_email || req.user?.email || null,
              presidentProfile.display_name || null,
              presidentProfile.role_title || null,
              presidentProfile.avatar_url || null,
              presidentProfile.avatar_position || null,
              presidentProfile.avatar_zoom ?? null,
              presidentProfile.banner_url || null,
              presidentProfile.banner_position || null,
              presidentProfile.banner_zoom ?? null,
              presidentProfile.bio || null,
              presidentProfile.success_level || null,
              presidentProfile.country_code || null,
              presidentProfile.quote || null,
              presidentProfile.management_style || null,
              presidentProfile.started_at || null,
              presidentProfile.social_links
                ? (typeof presidentProfile.social_links === 'string'
                  ? presidentProfile.social_links
                  : JSON.stringify(presidentProfile.social_links))
                : null,
              presidentId,
            ]
          ).catch(() => {});
        }
      } else {
        const president = new President({
          user_id: body.president_user_id,
          email: body.owner_email || req.user?.email || null,
          display_name: presidentProfile.display_name || null,
          role_title: presidentProfile.role_title || null,
          avatar_url: presidentProfile.avatar_url || null,
          avatar_position: presidentProfile.avatar_position || '50% 50%',
          avatar_zoom: presidentProfile.avatar_zoom ?? 150,
          banner_url: presidentProfile.banner_url || null,
          banner_position: presidentProfile.banner_position || null,
          banner_zoom: presidentProfile.banner_zoom ?? null,
          bio: presidentProfile.bio || null,
          success_level: presidentProfile.success_level || null,
          country_code: presidentProfile.country_code || null,
          quote: presidentProfile.quote || null,
          management_style: presidentProfile.management_style || null,
          started_at: presidentProfile.started_at || null,
          social_links: presidentProfile.social_links || null,
          status: 'active',
        });
        await president.create();
        presidentId = president.id;
      }
    }
    body.president_id = presidentId || null;

    const club = new Club(body);
    await club.create();
    const created = await club.selectOne(club.id);
    const record  = created[0];
    if (record?.president_id) {
      await EXECUTESQL(
        'UPDATE presidents SET club_id = ? WHERE id = ?',
        [record.id, record.president_id]
      ).catch(() => {});
      const { openTenure } = require('../services/presidentClubHistoryService');
      await openTenure({
        presidentId: record.president_id,
        clubId: record.id,
        clubName: record.name || null,
        reason: 'Club created',
      }).catch((err) => console.error('[president_club_history] club create:', err.message));
    }
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
         SET club_id = ?, club_roles = ?, role = 'president', status = 'active'
         WHERE id = ?`,
        [record.id, JSON.stringify(['president']), creator.id]
      ).catch(() => {});
      await upsertActiveMembership({
        clubId: record.id,
        playerId: creator.id,
        userId: creator.user_id || record?.user_id || null,
        primaryRole: 'president',
        source: 'club_creation',
      });
      const existingOwnerContract = await EXECUTESQL(
        "SELECT id FROM player_contracts WHERE team_id = ? AND user_id = ? AND contract_type = 'ownership' AND status IN ('pending','pending_window','negotiating','active') LIMIT 1",
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
    broadcastClub(record);
    res.status(201).json({ ...record, owner_contract_id: ownerContractId });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { access } = await requireClubPermission(req, id, null);
    const existing = await new Club().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const safeBody = {};
    for (const [field, value] of Object.entries(req.body || {})) {
      if (PROTECTED_IDENTITY_FIELDS.has(field)) continue;
      if (!CLUB_MODEL_UPDATE_FIELDS.has(field)) continue;
      safeBody[field] = value;
    }
    const submittedFields = Object.keys(safeBody);
    assertClubPatchAllowed(access, submittedFields);
    if (safeBody.name) {
      const existingByName = await EXECUTESQL(
        'SELECT id FROM clubs WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1',
        [safeBody.name, id]
      );
      if (existingByName.length) {
        return res.status(409).json({ error: 'A club with this name already exists' });
      }
    }
    const merged = { ...existing[0], ...safeBody };
    merged.president_user_id = merged.president_user_id || merged.user_id || null;
    if (merged.user_id) {
      const rows = await EXECUTESQL('SELECT id FROM users WHERE id = ? LIMIT 1', [merged.user_id]);
      if (!rows.length) {
        return res.status(400).json({ error: 'Invalid user_id: user does not exist' });
      }
    }
    const club = new Club(merged);
    await club.update(id);
    const updated = await club.selectOne(id);
    const record  = updated[0];
    if (record?.user_id) {
      await EXECUTESQL(
        'UPDATE users SET owner_id = COALESCE(owner_id, ?), role_id = 1, updated_date = NOW() WHERE id = ?',
        [record.id, record.user_id]
      );
    }
    broadcastClub(record);
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { access } = await requireClubPermission(req, id, 'manage_staff');
    if (!access?.admin) return res.status(403).json({ error: 'Forbidden' });
    const existing = await new Club().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Club().delete(id);
    broadcastClubDeleted(id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
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
    // Operations staff roles live in club_staff_roles. Squad cards currently
    // read players.role/club_roles, so role display must be synced or merged.
    const model = new ClubStaffRole({
      club_id: id,
      player_id: playerId,
      user_id: players[0].user_id || null,
      role,
      permissions,
      assigned_by_user_id: user.id,
    });
    await model.create();
    await upsertActiveMembership({
      clubId: id,
      playerId,
      userId: players[0].user_id || null,
      primaryRole: role,
      source: 'staff_assignment',
    });
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
    await upsertActiveMembership({
      clubId: id,
      playerId,
      primaryRole: 'member',
      source: 'staff_removed',
    });
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
