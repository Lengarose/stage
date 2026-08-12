const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { EXECUTESQL } = require('../db/database');
const Player = require('../models/playerModel');
const { ensureUploadsDir } = require('../../constants/paths');
const { get } = require('../../constants/env');
const {
  ok,
  fail,
  mapPlayer,
  resolveCallerContext,
  buildMePayload,
} = require('./helpers');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: ensureUploadsDir(),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.jpg';
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function loadUserProfile(userId) {
  const ctxUser = { id: userId };
  const ctx = await resolveCallerContext(ctxUser);
  if (!ctx) return null;
  if (ctx.player) {
    return {
      ...mapPlayer(ctx.player),
      id: ctx.user.id,
      email: ctx.user.email,
      team_id: ctx.player.club_id || ctx.club?.id || null,
      stats: {},
    };
  }
  const me = await buildMePayload(ctx.user.id);
  return me;
}

router.get('/me', async (req, res) => {
  try {
    const profile = await loadUserProfile(req.user.id);
    if (!profile) return fail(res, 401, 'User not found');
    return ok(res, profile);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.put('/me', upload.single('avatar'), async (req, res) => {
  try {
    const ctx = await resolveCallerContext(req.user);
    if (!ctx) return fail(res, 401, 'User not found');

    const body = { ...(req.body || {}) };
    if (req.file) {
      const SERVER_URL = get('SERVER_URL') || 'http://localhost:8080';
      body.avatar_url = `${SERVER_URL}/uploads/${req.file.filename}`;
    }

    const gamerTag = body.gamer_tag || body.gamertag;
    const position = body.position;
    const platform = body.platform;
    const bio = body.bio;
    const signinPreference = body.signin_preference;

    if (signinPreference) {
      // Stored client-side in the mobile app; acknowledged for API compatibility.
    }

    let player = ctx.player;
    if (!player) {
      const playerId = uuidv4();
      await EXECUTESQL(
        `INSERT INTO players (id, user_id, email, gamertag, position, platform, bio, avatar_url, created_date, updated_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          playerId,
          ctx.user.id,
          ctx.user.email,
          gamerTag || ctx.user.email.split('@')[0],
          position || null,
          platform || null,
          bio || null,
          body.avatar_url || null,
        ]
      );
      await EXECUTESQL('UPDATE users SET player_id = ?, updated_date = NOW() WHERE id = ?', [playerId, ctx.user.id]);
      player = (await new Player().selectOne(playerId))[0];
    } else {
      const next = {
        ...player,
        gamertag: gamerTag != null ? gamerTag : player.gamertag,
        position: position != null ? position : player.position,
        platform: platform != null ? platform : player.platform,
        bio: bio != null ? bio : player.bio,
        avatar_url: body.avatar_url != null ? body.avatar_url : player.avatar_url,
      };
      // Allow partial profile fields from mobile forms
      if (body.country != null) next.country = body.country;
      if (body.country_code != null) next.country_code = body.country_code;
      const model = new Player(next);
      await model.update(player.id);
      player = (await new Player().selectOne(player.id))[0];
    }

    const profile = {
      ...mapPlayer(player),
      id: ctx.user.id,
      email: ctx.user.email,
      signin_preference: signinPreference || null,
    };
    return ok(res, profile);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // Accept user id or player id
    let players = await EXECUTESQL(
      `SELECT * FROM players WHERE id = ? OR user_id = ? LIMIT 1`,
      [id, id]
    );
    if (!players.length) {
      const users = await EXECUTESQL('SELECT id, email FROM users WHERE id = ? LIMIT 1', [id]);
      if (!users.length) return fail(res, 404, 'Not found');
      const me = await buildMePayload(users[0].id);
      return ok(res, { ...me, stats: {} });
    }
    return ok(res, { ...mapPlayer(players[0]), stats: {} });
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.get('/:id/availability', async (req, res) => {
  try {
    const rows = await EXECUTESQL(
      `SELECT * FROM club_fixture_availability
       WHERE player_id = ? OR player_id IN (SELECT id FROM players WHERE user_id = ?)
       ORDER BY updated_date DESC
       LIMIT 100`,
      [req.params.id, req.params.id]
    ).catch(() => []);
    const slots = (rows || []).map((r) => ({
      id: r.id,
      fixture_id: r.fixture_id,
      status: r.status,
      club_id: r.club_id,
    }));
    return ok(res, slots);
  } catch (err) {
    return fail(res, 500, err.message);
  }
});

router.put('/:id/availability', async (req, res) => {
  // Mobile sends arbitrary weekly slots; Stage stores fixture-scoped availability.
  // Acknowledge and echo so the UI can keep local state.
  return ok(res, req.body?.slots || []);
});

module.exports = router;
