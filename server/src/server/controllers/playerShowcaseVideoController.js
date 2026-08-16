const express = require('express');
const router = express.Router();
const PlayerShowcaseVideo = require('../models/playerShowcaseVideoModel');
const { EXECUTESQL } = require('../db/database');
const { get } = require('../../constants/env');
const { createNotificationIfEnabled } = require('../services/messageDeliveryService');
const {
  MAX_SHOWCASE_VIDEO_SECONDS,
  showcaseDurationError,
} = require('../services/showcaseVideoLimits');

/**
 * A player's showcase clips.
 *
 * Reading is open to any signed-in account: the showcase exists to be found by
 * scouts, so hiding it would defeat its purpose. Writing is restricted to the
 * player who owns the profile (or an admin) — the whole point of this feature is
 * that the footage is published by the player, not pasted in by whoever is
 * looking at them.
 */

function isAdmin(user) {
  return Number(user?.role_id) === 0;
}

function cleanTitle(value) {
  return String(value || '').trim();
}

function cleanDuration(value) {
  if (value === undefined || value === null || value === '') return null;
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 0) return null;
  return Math.round(duration * 100) / 100;
}

function isTruthyFlag(value) {
  return value === true || value === 1 || value === '1';
}

function isUploadedAssetUrl(url) {
  if (url.startsWith('/uploads/') || url.startsWith('uploads/')) return true;
  try {
    const parsed = new URL(url);
    const serverUrl = get('SERVER_URL') || 'http://localhost:8080';
    const allowedOrigin = new URL(serverUrl).origin;
    return parsed.origin === allowedOrigin && parsed.pathname.startsWith('/uploads/');
  } catch {
    return false;
  }
}

async function getUser(req) {
  const rows = await EXECUTESQL(
    'SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1',
    [req.user?.id]
  );
  return rows[0] || null;
}

/** Every player row this account owns — an account can have more than one. */
async function ownPlayerIds(user) {
  if (!user) return [];
  // The email fallback is only sound when we actually have an email: matching on
  // '' would hand an account every player row that happens to have a blank email.
  const email = String(user.email || '').trim();
  const rows = email
    ? await EXECUTESQL(
      `SELECT id FROM players
        WHERE user_id = ? OR LOWER(TRIM(email)) = LOWER(TRIM(?))`,
      [user.id, email]
    ).catch(() => [])
    : await EXECUTESQL('SELECT id FROM players WHERE user_id = ?', [user.id]).catch(() => []);
  return rows.map((r) => String(r.id));
}

async function requireOwnership(req, res, playerId) {
  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return null;
  }
  if (isAdmin(user)) return user;
  const owned = await ownPlayerIds(user);
  if (!owned.includes(String(playerId))) {
    res.status(403).json({ error: 'You can only manage your own showcase' });
    return null;
  }
  return user;
}

router.get('/', async (req, res) => {
  try {
    // `player_ids=a,b,c` fetches several showcases in one call. The scouting board
    // shows a card per report and each needs its target's clips; without this it
    // would fire one request per row.
    const many = String(req.query?.player_ids || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (many.length) {
      const rows = await PlayerShowcaseVideo.selectByPlayers(many.slice(0, 200));
      return res.json(rows);
    }
    const playerId = req.query?.player_id;
    if (!playerId) return res.status(400).json({ error: 'player_id or player_ids is required' });
    const rows = await new PlayerShowcaseVideo().selectByPlayer(playerId);
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/scouting', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user?.email) return res.status(403).json({ error: 'Forbidden' });
    const filter = ['recent', 'trending'].includes(String(req.query?.filter || ''))
      ? String(req.query.filter)
      : 'recent';
    const rows = await PlayerShowcaseVideo.selectScoutingVideos({
      filter,
      position: req.query?.position || '',
      country: req.query?.country || '',
      currentUserEmail: user.email,
    });
    return res.json((Array.isArray(rows) ? rows : []).map((row) => ({
      ...row,
      media_url: row.media_url || row.url,
      likes_count: Number(row.likes_count || 0),
      comments_count: Number(row.comments_count || 0),
      liked_by_me: isTruthyFlag(row.liked_by_me),
    })));
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * The position a player wants to be scouted for.
 *
 * It lives on the players row, but it is set here rather than through the generic
 * player update so it inherits this file's ownership check — the showcase is the
 * player's own, and nobody else gets to relabel what they play.
 */
router.post('/position', async (req, res) => {
  try {
    const playerId = req.body?.player_id;
    if (!playerId) return res.status(400).json({ error: 'player_id is required' });

    const user = await requireOwnership(req, res, playerId);
    if (!user) return undefined;

    const position = String(req.body?.showcase_position || '').trim() || null;
    await EXECUTESQL(
      'UPDATE players SET showcase_position = ?, updated_date = NOW() WHERE id = ?',
      [position, playerId]
    );
    return res.json({ success: true, player_id: playerId, showcase_position: position });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/like', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user?.email) return res.status(403).json({ error: 'Forbidden' });

    const rows = await new PlayerShowcaseVideo().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const existing = rows[0];

    const result = await PlayerShowcaseVideo.toggleScoutingLike(existing.id, user.email);
    const video = {
      ...(result.video || existing),
      media_url: (result.video || existing).media_url || (result.video || existing).url,
      liked_by_me: isTruthyFlag(result.video?.liked_by_me),
      likes_count: Number((result.video || existing).likes_count || 0),
      comments_count: Number((result.video || existing).comments_count || 0),
    };

    const actorEmail = String(user.email || '').toLowerCase();
    const ownerEmail = String(existing.owner_email || '').toLowerCase();
    if (result.liked && ownerEmail && ownerEmail !== actorEmail) {
      await createNotificationIfEnabled({
        recipientEmail: existing.owner_email,
        type: 'showcase_like',
        title: 'New like on your showcase video',
        body: `${user.email} liked "${existing.title || 'your showcase video'}".`,
        link: `/scouting?video=${existing.id}`,
        relatedId: existing.id,
        idempotencyKey: `showcase-like:${existing.id}:${actorEmail}`,
      });
    }

    return res.json(video);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id/comments', async (req, res) => {
  try {
    const rows = await new PlayerShowcaseVideo().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const comments = await PlayerShowcaseVideo.selectScoutingComments(req.params.id);
    return res.json(Array.isArray(comments) ? comments : []);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/comments', async (req, res) => {
  try {
    const user = await getUser(req);
    if (!user?.email) return res.status(403).json({ error: 'Forbidden' });

    const content = String(req.body?.content || '').trim();
    if (!content) return res.status(400).json({ error: 'Comment content is required' });
    if (content.length > 1000) return res.status(400).json({ error: 'Comment must be 1000 characters or less' });

    const rows = await new PlayerShowcaseVideo().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const video = rows[0];

    const playerRows = await EXECUTESQL(
      'SELECT id, gamertag, avatar_url FROM players WHERE LOWER(email)=LOWER(?) LIMIT 1',
      [user.email]
    );
    const player = playerRows[0] || {};
    const comment = await PlayerShowcaseVideo.createScoutingComment({
      video_id: video.id,
      content,
      author_email: user.email,
      author_player_id: player.id || null,
      author_name: player.gamertag || user.email,
      author_avatar_url: player.avatar_url || '',
    });

    const actorEmail = String(user.email || '').toLowerCase();
    const ownerEmail = String(video.owner_email || '').toLowerCase();
    if (ownerEmail && ownerEmail !== actorEmail) {
      await createNotificationIfEnabled({
        recipientEmail: video.owner_email,
        type: 'showcase_comment',
        title: 'New comment on your showcase video',
        body: `${comment.author_name} commented on "${video.title || 'your showcase video'}".`,
        link: `/scouting?video=${video.id}&comment=${comment.id}`,
        relatedId: comment.id,
      });
    }

    return res.status(201).json(comment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const rows = await new PlayerShowcaseVideo().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const record = rows[0];
    const user = await getUser(req).catch(() => null);
    let likedByMe = false;
    if (user?.email) {
      const likedRows = await EXECUTESQL(
        'SELECT 1 FROM player_showcase_video_likes WHERE video_id = ? AND LOWER(user_email) = LOWER(?) LIMIT 1',
        [record.id, user.email]
      ).catch(() => []);
      likedByMe = likedRows.length > 0;
    }
    return res.json({
      ...record,
      media_url: record.media_url || record.url,
      likes_count: Number(record.likes_count || 0),
      comments_count: Number(record.comments_count || 0),
      liked_by_me: likedByMe,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const playerId = body.player_id;
    if (!playerId) return res.status(400).json({ error: 'player_id is required' });

    const user = await requireOwnership(req, res, playerId);
    if (!user) return undefined;

    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!url) return res.status(400).json({ error: 'An uploaded video URL is required' });
    if (!isUploadedAssetUrl(url)) {
      return res.status(400).json({ error: 'Showcase videos must be uploaded from your device' });
    }

    const title = cleanTitle(body.title);
    if (!title) return res.status(400).json({ error: 'A video title is required' });
    if (title.length > 120) return res.status(400).json({ error: 'Video title must be 120 characters or less' });

    const duration = cleanDuration(body.duration_seconds);
    if (duration !== null && duration > MAX_SHOWCASE_VIDEO_SECONDS) {
      return res.status(400).json({ error: showcaseDurationError() });
    }

    // The server assigns the id; letting a client pick one is surface we don't need.
    const model = new PlayerShowcaseVideo({
      ...body,
      id: undefined,
      url,
      title,
      duration_seconds: duration,
    });
    await model.create();
    const created = await model.selectOne(model.id);
    return res.status(201).json(created[0] || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const rows = await new PlayerShowcaseVideo().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const existing = rows[0];

    const user = await requireOwnership(req, res, existing.player_id);
    if (!user) return undefined;

    const body = req.body || {};
    const url = body.url !== undefined
      ? String(body.url || '').trim()
      : existing.url;
    if (!url) return res.status(400).json({ error: 'An uploaded video URL is required' });
    if (body.url !== undefined && !isUploadedAssetUrl(url)) {
      return res.status(400).json({ error: 'Showcase videos must be uploaded from your device' });
    }

    const title = body.title !== undefined ? cleanTitle(body.title) : existing.title;
    if (body.title !== undefined) {
      if (!title) return res.status(400).json({ error: 'A video title is required' });
      if (title.length > 120) return res.status(400).json({ error: 'Video title must be 120 characters or less' });
    }

    const duration = body.duration_seconds !== undefined
      ? cleanDuration(body.duration_seconds)
      : existing.duration_seconds;
    if (duration !== null && duration !== undefined && Number(duration) > MAX_SHOWCASE_VIDEO_SECONDS) {
      return res.status(400).json({ error: showcaseDurationError() });
    }

    const model = new PlayerShowcaseVideo({
      ...existing,
      url,
      title,
      description: body.description !== undefined ? body.description : existing.description,
      duration_seconds: duration,
      sort_order: body.sort_order !== undefined ? body.sort_order : existing.sort_order,
      // Ignore any player_id in the body: ownership is fixed at publication.
      player_id: existing.player_id,
    });
    await model.update(req.params.id);
    const updated = await model.selectOne(req.params.id);
    return res.json(updated[0] || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const rows = await new PlayerShowcaseVideo().selectOne(req.params.id);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });

    const user = await requireOwnership(req, res, rows[0].player_id);
    if (!user) return undefined;

    await new PlayerShowcaseVideo().delete(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
