const express = require('express');
const router  = express.Router();
const Player  = require('../models/playerModel');
const { EXECUTESQL } = require('../db/database');
const { broadcastPlayer, broadcastPlayerDeleted } = require('../utils/socketBroadcast');
const { assertPersistableMediaFields } = require('../lib/mediaUrls');

let secondaryPositionColumnReady = null;

/**
 * Fields this endpoint must never take from the request unless the caller is an
 * admin.
 *
 * Two groups, both of which decide something the client does not get to decide:
 * the wallet and subscription (what a paying account is owed — these are set by
 * the Stripe fulfilment path and the credit service, never by an edit form), and
 * the identity links (which account owns this player).
 *
 * They are stripped rather than rejected on purpose: several legitimate flows —
 * the dressing room, game day, club role management — PATCH a player wholesale
 * and would otherwise start failing on fields they never meant to change.
 */
const ADMIN_ONLY_PLAYER_FIELDS = [
  'credits',
  'stc',
  'subscription',
  'subscription_expires_at',
  'subscription_billing',
  'stripe_subscription_id',
  'stripe_customer_id',
  'subscription_cancel_at_period_end',
  'is_verified',
  'user_id',
  'email',
];

// Career/ranking totals are written by match completion on the server.
// A client PATCH of these fields would bypass the result-trust engine.
const CAREER_STAT_FIELDS = [
  'goals',
  'assists',
  'goals_player',
  'matches_played',
  'matches_played_club',
  'wins_count',
  'wins_club',
  'losses_count',
  'losses_club',
  'draws_count',
  'draws_club',
  'clean_sheets',
  'man_of_the_match',
  'avg_match_rating',
  'overall_rating',
  'ranking_points',
  'ranking_matches',
  'global_rank',
  'regional_rank',
  'country_rank',
  'position_rank',
];

// Club officers may patch these on a teammate (ClubDetail, DressingRoom).
const CLUB_MANAGEMENT_FIELDS = new Set([
  'club_roles',
  'role',
  'dressing_room_seat',
  'is_ready',
]);

const CAREER_TILE_KEYS = new Set(['upcoming', 'club', 'player', 'transfers']);
const GAME_DAY_TILE_KEYS = new Set([
  'match_screens',
  'match_details',
  'dressing_room',
  'home',
  'tournaments',
  'profile',
  'apps',
  'inbox',
  'competitions',
  'transfers',
  'find_players',
  'find_clubs',
]);
const TILE_KEY_ALIASES = {
  gost: 'competitions',
  transfer_hub: 'transfers',
  findplayers: 'find_players',
  find_player: 'find_players',
  findclubs: 'find_clubs',
  find_club: 'find_clubs',
  matchscreens: 'match_screens',
  matchdetails: 'match_details',
  dressingroom: 'dressing_room',
};

function isAdmin(user) {
  return [0, 2].includes(Number(user?.role_id));
}

function hasStagePlus(subscription) {
  return ['stage_plus', 'plus', 'pro', 'elite'].includes(String(subscription || '').toLowerCase());
}

async function getUser(req) {
  const rows = await EXECUTESQL(
    'SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1',
    [req.user?.id]
  ).catch(() => []);
  return rows[0] || null;
}

function stripAdminOnlyFields(body) {
  const safe = { ...body };
  for (const field of ADMIN_ONLY_PLAYER_FIELDS) delete safe[field];
  return safe;
}

function stripCareerStatFields(body) {
  const safe = { ...body };
  for (const field of CAREER_STAT_FIELDS) delete safe[field];
  return safe;
}

function pickClubManagementFields(body) {
  const picked = {};
  for (const key of Object.keys(body || {})) {
    if (CLUB_MANAGEMENT_FIELDS.has(key)) picked[key] = body[key];
  }
  return picked;
}

function ownsPlayerRecord(existing, req) {
  return String(existing?.user_id || '') === String(req.user?.id || '')
    || (
      String(existing?.email || '').toLowerCase()
      === String(req.user?.email || '').toLowerCase()
      && Boolean(req.user?.email)
    );
}

async function callerSharesClub(req, existing) {
  const clubId = String(existing?.club_id || '');
  if (!clubId) return false;
  const rows = await EXECUTESQL(
    `SELECT id FROM players
      WHERE club_id = ?
        AND (user_id = ? OR LOWER(email) = LOWER(?))
      LIMIT 1`,
    [clubId, req.user?.id || '', req.user?.email || '']
  ).catch(() => []);
  return Boolean(rows.length);
}

function normalizePlayerPayload(body = {}) {
  const payload = { ...body };
  if ('secondary_position' in payload) {
    payload.secondary_position =
      payload.secondary_position && payload.secondary_position !== 'none'
        ? payload.secondary_position
        : null;
    if (payload.secondary_position && payload.secondary_position === payload.position) {
      payload.secondary_position = null;
    }
  }
  return payload;
}

function normalizeCardBackgroundUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  const isImagePath = (pathname) => /\.(jpe?g|png|webp|gif)$/i.test(String(pathname || '').split('?')[0]);
  if ((value.startsWith('/uploads/') || value.startsWith('uploads/')) && isImagePath(value)) return value;
  try {
    const parsed = new URL(value);
    return parsed.pathname.startsWith('/uploads/') && isImagePath(parsed.pathname) ? value : '';
  } catch {
    return '';
  }
}

function normalizeCardBackgroundPosition(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/);
  if (!match) return '50% 50%';
  const x = Math.max(0, Math.min(100, Number(match[1])));
  const y = Math.max(0, Math.min(100, Number(match[2])));
  return `${Math.round(x)}% ${Math.round(y)}%`;
}

function normalizeCardBackgroundZoom(value) {
  const zoom = Number(value);
  if (!Number.isFinite(zoom)) return 120;
  return Math.max(100, Math.min(260, Math.round(zoom)));
}

function parseCareerTileBackgrounds(value) {
  if (!value) return {};
  if (typeof value === 'object') return value && !Array.isArray(value) ? value : {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseGameDayTileBackgrounds(value) {
  if (!value) return {};
  if (typeof value === 'object') return value && !Array.isArray(value) ? value : {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeTileKey(raw) {
  const key = String(raw || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return TILE_KEY_ALIASES[key] || key;
}

/** Clients send tile_key, tileKey, or title_key — React Native PATCH bodies are not always parsed. */
function readTileKey(req) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const nested = body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {};
  const query = req.query && typeof req.query === 'object' ? req.query : {};
  const params = req.params && typeof req.params === 'object' ? req.params : {};
  const headers = req.headers && typeof req.headers === 'object' ? req.headers : {};
  return normalizeTileKey(
    params.tileKey
    || params.tile_key
    || params.title_key
    || params.titleKey
    || body.tile_key
    || body.tileKey
    || body.title_key
    || body.titleKey
    || nested.tile_key
    || nested.tileKey
    || nested.title_key
    || nested.titleKey
    || query.tile_key
    || query.tileKey
    || query.title_key
    || query.titleKey
    || headers['x-tile-key']
    || headers['x-title-key']
    || '',
  );
}

async function ensureSecondaryPositionColumn() {
  if (!secondaryPositionColumnReady) {
    secondaryPositionColumnReady = (async () => {
      const rows = await EXECUTESQL(
        'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1',
        ['players', 'secondary_position']
      );
      if (!rows.length) {
        await EXECUTESQL('ALTER TABLE players ADD COLUMN secondary_position VARCHAR(50) NULL');
      }
    })().catch((err) => {
      secondaryPositionColumnReady = null;
      throw err;
    });
  }
  return secondaryPositionColumnReady;
}

// GET /
router.get('/', async (req, res) => {
  try {
    await ensureSecondaryPositionColumn();
    const { id, email, user_id, club_id, gamertag, search, page, limit, offset } = req.query;
    const player = new Player();
    let result;
    if (id) result = await player.selectOne(String(id));
    else if (email) result = await player.selectByEmail(email);
    else if (user_id) result = await player.selectByUserId(user_id);
    else if (club_id) result = await player.selectByClub(club_id);
    else if (gamertag) {
      result = await EXECUTESQL(
        'SELECT * FROM players WHERE LOWER(gamertag) = LOWER(?) LIMIT 50',
        [String(gamertag)]
      );
    } else if (search) {
      result = await player.searchByGamertag(search, Number(limit) || 50, Number(offset) || 0);
    } else {
      result = await player.selectAll({
        page: Number(page) || 1,
        limit: Number(limit) || 25,
        offset: offset !== undefined ? Number(offset) : undefined,
      });
    }
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// GET /:id
router.get('/:id', async (req, res) => {
  try {
    await ensureSecondaryPositionColumn();
    const player = new Player();
    const result = await player.selectOne(req.params.id);
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
    await ensureSecondaryPositionColumn();
    const body = normalizePlayerPayload(req.body);
    assertPersistableMediaFields(body, ['avatar_url', 'banner_url']);
    const { gamertag } = body || {};
    if (gamertag) {
      const existingByGamertag = await EXECUTESQL(
        'SELECT id FROM players WHERE LOWER(gamertag) = LOWER(?) LIMIT 1',
        [gamertag]
      );
      if (existingByGamertag.length) {
        return res.status(409).json({ error: 'A player with this gamertag already exists' });
      }
    }

    const player = new Player(body);
    await player.create();
    const created = await player.selectOne(player.id);
    const record  = created[0];
    if (record?.user_id) {
      await EXECUTESQL(
        'UPDATE users SET player_id = ?, role_id = 1, updated_date = NOW() WHERE id = ?',
        [record.id, record.user_id]
      );
    }

    // ── Wallet initialization: always grant 50,000 STC on first creation ──
    const INITIAL_STC = 50_000;
    try {
      await EXECUTESQL(
        'UPDATE players SET stc = ?, updated_date = NOW() WHERE id = ? AND stc < ?',
        [INITIAL_STC, record.id, INITIAL_STC]
      );
      const existingWelcome = await EXECUTESQL(
        "SELECT id FROM player_stc_transactions WHERE player_id = ? AND category = 'initial_grant' LIMIT 1",
        [record.id]
      );
      if (!existingWelcome.length) {
        await EXECUTESQL(
          `INSERT INTO player_stc_transactions
             (id, player_id, player_email, amount, balance_after, type, category, source, description, created_date)
           VALUES (?, ?, ?, ?, ?, 'income', 'initial_grant', 'STAGE',
                   'Welcome to STAGE — 50,000 STC starting balance', NOW())`,
          [uuidv4(), record.id, record.email || null, INITIAL_STC, INITIAL_STC]
        );
      }
      record.stc = INITIAL_STC;
    } catch (walletErr) {
      console.error('[wallet-init] failed for player', record.id, walletErr.message);
    }

    broadcastPlayer(record);
    res.status(201).json(record);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /:id
router.patch('/:id', async (req, res) => {
  try {
    await ensureSecondaryPositionColumn();
    const { id } = req.params;
    const caller = await getUser(req);
    const existing = await new Player().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    const current = existing[0];
    const admin = isAdmin(caller);
    let body;
    if (admin) {
      body = normalizePlayerPayload(req.body);
    } else {
      const stripped = stripCareerStatFields(stripAdminOnlyFields(req.body || {}));
      if (ownsPlayerRecord(current, req)) {
        body = normalizePlayerPayload(stripped);
      } else if (await callerSharesClub(req, current)) {
        body = normalizePlayerPayload(pickClubManagementFields(stripped));
      } else {
        return res.status(403).json({ error: 'You can only edit your own player' });
      }
    }
    assertPersistableMediaFields(body, ['avatar_url', 'banner_url']);
    if (body?.gamertag) {
      const existingByGamertag = await EXECUTESQL(
        'SELECT id FROM players WHERE LOWER(gamertag) = LOWER(?) AND id <> ? LIMIT 1',
        [body.gamertag, id]
      );
      if (existingByGamertag.length) {
        return res.status(409).json({ error: 'A player with this gamertag already exists' });
      }
    }
    const player = new Player({ ...existing[0], ...body });
    await player.update(id);
    const updated = await player.selectOne(id);
    const record  = updated[0];
    if (record?.user_id) {
      await EXECUTESQL(
        'UPDATE users SET player_id = COALESCE(player_id, ?), role_id = 1, updated_date = NOW() WHERE id = ?',
        [record.id, record.user_id]
      );
    }
    broadcastPlayer(record);
    res.json(record);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /:id/card-background
router.patch('/:id/card-background', async (req, res) => {
  try {
    await ensureSecondaryPositionColumn();
    const { id } = req.params;
    const existing = (await new Player().selectOne(id))[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const ownsPlayer = String(existing.user_id || '') === String(req.user?.id || '')
      || String(existing.email || '').toLowerCase() === String(req.user?.email || '').toLowerCase();
    if (!ownsPlayer) {
      return res.status(403).json({ error: 'You can only change your own player card background' });
    }
    if (!hasStagePlus(existing.subscription)) {
      return res.status(403).json({ error: 'STAGE Plus is required to customize player card backgrounds' });
    }

    const type = String(req.body?.type || 'default').toLowerCase();
    let backgroundId = null;
    let backgroundUrl = null;
    let backgroundPosition = '50% 50%';
    let backgroundZoom = 120;
    if (type === 'default') {
      // Reset to the standard card.
    } else if (type === 'official') {
      backgroundId = String(req.body?.background_id || '').trim();
      if (!backgroundId) return res.status(400).json({ error: 'background_id is required' });
      const preset = (await EXECUTESQL(
        'SELECT id, image_url FROM player_card_backgrounds WHERE id = ? AND is_active = 1 LIMIT 1',
        [backgroundId],
      ))[0];
      if (!preset) return res.status(404).json({ error: 'Background not found' });
      backgroundUrl = preset.image_url;
    } else if (type === 'custom') {
      backgroundUrl = normalizeCardBackgroundUrl(req.body?.image_url);
      if (!backgroundUrl) return res.status(400).json({ error: 'A valid uploaded image URL is required' });
      backgroundPosition = normalizeCardBackgroundPosition(req.body?.position);
      backgroundZoom = normalizeCardBackgroundZoom(req.body?.zoom);
    } else {
      return res.status(400).json({ error: 'Invalid background type' });
    }

    await EXECUTESQL(
      `UPDATE players
       SET player_card_background_type = ?,
           player_card_background_id = ?,
           player_card_background_url = ?,
           player_card_background_position = ?,
           player_card_background_zoom = ?,
           updated_date = NOW()
       WHERE id = ?`,
      [type, backgroundId, backgroundUrl, backgroundPosition, backgroundZoom, id],
    );
    const updated = (await new Player().selectOne(id))[0];
    broadcastPlayer(updated);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/career-tile-background — STAGE Plus career tile personalization.
router.patch('/:id/career-tile-background', async (req, res) => {
  try {
    await ensureSecondaryPositionColumn();
    const { id } = req.params;
    const existing = (await new Player().selectOne(id))[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const ownsPlayer = String(existing.user_id || '') === String(req.user?.id || '')
      || String(existing.email || '').toLowerCase() === String(req.user?.email || '').toLowerCase();
    if (!ownsPlayer && !isAdmin(req.user)) {
      return res.status(403).json({ error: 'You can only change your own career tile backgrounds' });
    }
    if (!isAdmin(req.user) && !hasStagePlus(existing.subscription)) {
      return res.status(403).json({ error: 'STAGE Plus is required to customize career tile backgrounds' });
    }

    const tileKey = readTileKey(req);
    if (!CAREER_TILE_KEYS.has(tileKey)) {
      return res.status(400).json({ error: 'Valid tile_key is required' });
    }

    const type = String(req.body?.type || 'default').toLowerCase();
    let backgroundId = null;
    let backgroundUrl = null;
    let backgroundPosition = '50% 50%';
    let backgroundZoom = 120;
    if (type === 'default') {
      // Reset to standard career tile style.
    } else if (type === 'official') {
      backgroundId = String(req.body?.background_id || '').trim();
      if (!backgroundId) return res.status(400).json({ error: 'background_id is required' });
      const preset = (await EXECUTESQL(
        'SELECT id, image_url FROM player_card_backgrounds WHERE id = ? AND is_active = 1 LIMIT 1',
        [backgroundId],
      ))[0];
      if (!preset) return res.status(404).json({ error: 'Background not found' });
      backgroundUrl = preset.image_url;
    } else if (type === 'custom') {
      backgroundUrl = normalizeCardBackgroundUrl(req.body?.image_url);
      if (!backgroundUrl) return res.status(400).json({ error: 'A valid uploaded image URL is required' });
      backgroundPosition = normalizeCardBackgroundPosition(req.body?.position);
      backgroundZoom = normalizeCardBackgroundZoom(req.body?.zoom);
      assertPersistableMediaFields({ career_tile_background_url: backgroundUrl }, ['career_tile_background_url']);
    } else {
      return res.status(400).json({ error: 'Invalid background type' });
    }

    const backgrounds = parseCareerTileBackgrounds(existing.career_tile_backgrounds);
    if (type === 'default') {
      delete backgrounds[tileKey];
    } else {
      backgrounds[tileKey] = {
        type,
        background_id: backgroundId,
        url: backgroundUrl,
        position: backgroundPosition,
        zoom: backgroundZoom,
      };
    }

    await EXECUTESQL(
      `UPDATE players
       SET career_tile_backgrounds = ?,
           updated_date = NOW()
       WHERE id = ?`,
      [JSON.stringify(backgrounds), id],
    );
    const updated = (await new Player().selectOne(id))[0];
    broadcastPlayer(updated);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /:id/game-day-tile-background — STAGE Plus Game Day tile personalization.
router.patch('/:id/game-day-tile-background', async (req, res) => {
  try {
    await ensureSecondaryPositionColumn();
    const { id } = req.params;
    const existing = (await new Player().selectOne(id))[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const ownsPlayer = String(existing.user_id || '') === String(req.user?.id || '')
      || String(existing.email || '').toLowerCase() === String(req.user?.email || '').toLowerCase();
    if (!ownsPlayer && !isAdmin(req.user)) {
      return res.status(403).json({ error: 'You can only change your own Game Day tile backgrounds' });
    }
    if (!isAdmin(req.user) && !hasStagePlus(existing.subscription)) {
      return res.status(403).json({ error: 'STAGE Plus is required to customize Game Day tile backgrounds' });
    }

    const tileKey = readTileKey(req);
    if (!GAME_DAY_TILE_KEYS.has(tileKey)) {
      return res.status(400).json({ error: 'Valid tile_key is required' });
    }

    const type = String(req.body?.type || 'default').toLowerCase();
    let backgroundId = null;
    let backgroundUrl = null;
    let backgroundPosition = '50% 50%';
    let backgroundZoom = 120;
    if (type === 'default') {
      // Reset to standard Game Day tile style.
    } else if (type === 'official') {
      backgroundId = String(req.body?.background_id || '').trim();
      if (!backgroundId) return res.status(400).json({ error: 'background_id is required' });
      const preset = (await EXECUTESQL(
        'SELECT id, image_url FROM player_card_backgrounds WHERE id = ? AND is_active = 1 LIMIT 1',
        [backgroundId],
      ))[0];
      if (!preset) return res.status(404).json({ error: 'Background not found' });
      backgroundUrl = preset.image_url;
    } else if (type === 'custom') {
      backgroundUrl = normalizeCardBackgroundUrl(req.body?.image_url);
      if (!backgroundUrl) return res.status(400).json({ error: 'A valid uploaded image URL is required' });
      backgroundPosition = normalizeCardBackgroundPosition(req.body?.position);
      backgroundZoom = normalizeCardBackgroundZoom(req.body?.zoom);
      assertPersistableMediaFields({ game_day_tile_background_url: backgroundUrl }, ['game_day_tile_background_url']);
    } else {
      return res.status(400).json({ error: 'Invalid background type' });
    }

    const backgrounds = parseGameDayTileBackgrounds(existing.game_day_tile_backgrounds);
    if (type === 'default') {
      delete backgrounds[tileKey];
    } else {
      backgrounds[tileKey] = {
        type,
        background_id: backgroundId,
        url: backgroundUrl,
        position: backgroundPosition,
        zoom: backgroundZoom,
      };
    }

    await EXECUTESQL(
      `UPDATE players
       SET game_day_tile_backgrounds = ?,
           updated_date = NOW()
       WHERE id = ?`,
      [JSON.stringify(backgrounds), id],
    );
    const updated = (await new Player().selectOne(id))[0];
    broadcastPlayer(updated);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await new Player().selectOne(id);
    if (!existing.length) return res.status(404).json({ error: 'Not found' });
    await new Player().delete(id);
    broadcastPlayerDeleted(id, existing[0]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
