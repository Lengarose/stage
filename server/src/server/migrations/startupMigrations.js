// ── Startup migrations ────────────────────────────────────────────────────────
const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

async function runStartupMigrations() {
  const addCol = async (table, column, definition) => {
    try {
      const rows = await EXECUTESQL(
        'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1',
        [table, column]
      );
      if (!rows.length) {
        await EXECUTESQL(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        console.log(`[migration] Added ${table}.${column}`);
      }
    } catch (err) {
      console.error(`[migration] Failed to add ${table}.${column}:`, err.message);
    }
  };

  const dropCol = async (table, column) => {
    try {
      const rows = await EXECUTESQL(
        'SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1',
        [table, column]
      );
      if (rows.length) {
        await EXECUTESQL(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
        console.log(`[migration] Dropped ${table}.${column}`);
      }
    } catch (err) {
      console.error(`[migration] Failed to drop ${table}.${column}:`, err.message);
    }
  };

  const addIndex = async (table, indexName, definition) => {
    try {
      const rows = await EXECUTESQL(
        'SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1',
        [table, indexName]
      );
      if (!rows.length) {
        await EXECUTESQL(`CREATE INDEX \`${indexName}\` ON \`${table}\` ${definition}`);
        console.log(`[migration] Added index ${table}.${indexName}`);
      }
    } catch (err) {
      console.error(`[migration] Failed to add index ${table}.${indexName}:`, err.message);
    }
  };

  await addCol('notifications', 'related_id', 'VARCHAR(36) NULL');
  await addCol('notifications', 'idempotency_key', 'VARCHAR(190) NULL');
  await addCol('inbox_messages', 'sender_gamertag', 'VARCHAR(100) NULL');
  await addCol('inbox_messages', 'sender_avatar_url', 'TEXT NULL');
  await addCol('inbox_messages', 'sender_club_name', 'VARCHAR(150) NULL');
  await addCol('inbox_messages', 'action_type', 'VARCHAR(100) NULL');
  await addCol('inbox_messages', 'is_system', 'TINYINT(1) NULL DEFAULT 0');
  await addCol('inbox_messages', 'metadata', 'JSON NULL');
  await addCol('inbox_messages', 'idempotency_key', 'VARCHAR(190) NULL');
  await addCol('inbox_messages', 'updated_date', 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await EXECUTESQL(`
    UPDATE inbox_messages
    SET status = 'accepted',
        is_read = 1,
        updated_date = NOW()
    WHERE message_type = 'match_invite'
      AND related_entity_type = 'match'
      AND related_entity_id IS NOT NULL
      AND (status IS NULL OR status IN ('pending', 'unread'))
      AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.created_match_id')) = related_entity_id
      AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.reschedule_request')), 'false') NOT IN ('true', '1')
  `).catch(err => console.error('[migration] match_invite_status_backfill:', err.message));
  await addIndex('notifications', 'idx_notifications_type_related', '(type, related_id)');
  await addIndex('notifications', 'idx_notifications_idempotency', '(idempotency_key)');
  await addIndex('inbox_messages', 'idx_inbox_type_related', '(message_type, related_entity_id)');
  await addIndex('inbox_messages', 'idx_inbox_idempotency', '(idempotency_key)');
  await addCol('posts', 'media_position', 'VARCHAR(50) NULL');
  await addCol('posts', 'media_zoom', 'INT NULL DEFAULT 100');
  await addCol('posts', 'media_aspect', "VARCHAR(30) NULL DEFAULT 'square'");

  await addCol('posts', 'tournament_id', 'VARCHAR(36) NULL');
  await addCol('posts', 'tags', 'JSON NULL');
  await addCol('comments', 'author_name', 'VARCHAR(100) NULL');
  await addCol('comments', 'author_avatar', 'TEXT NULL');
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS post_likes (
    id           VARCHAR(36)  PRIMARY KEY,
    post_id      VARCHAR(36)  NOT NULL,
    user_email   VARCHAR(255) NOT NULL,
    created_date DATETIME     DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_post_likes_post_user (post_id, user_email),
    INDEX idx_post_likes_post (post_id)
  )`).catch((err) => console.error('[migration] post_likes:', err.message));
  await EXECUTESQL(`
    INSERT IGNORE INTO post_likes (id, post_id, user_email)
    SELECT UUID(), p.id, mention.email
    FROM posts p
    JOIN JSON_TABLE(COALESCE(p.likes, JSON_ARRAY()), '$[*]' COLUMNS (email VARCHAR(255) PATH '$')) mention
  `).catch((err) => console.error('[migration] post_likes backfill:', err.message));

  await addCol('players', 'stc', 'DECIMAL(12,2) DEFAULT 0');
  await EXECUTESQL("ALTER TABLE players ALTER COLUMN subscription SET DEFAULT 'free'")
    .catch((err) => console.error('[migration] players.subscription default:', err.message));
  await addCol('players', 'subscription_expires_at', 'DATETIME NULL');
  await addCol('players', 'subscription_billing', 'VARCHAR(20) NULL');
  await addCol('players', 'stripe_subscription_id', 'VARCHAR(255) NULL');
  await addCol('players', 'stripe_customer_id', 'VARCHAR(255) NULL');
  await addCol('players', 'subscription_cancel_at_period_end', 'TINYINT(1) NOT NULL DEFAULT 0');
  await addCol('players', 'role', 'VARCHAR(50) NULL');
  await addCol('players', 'secondary_position', 'VARCHAR(50) NULL');
  await addCol('players', 'is_verified', 'TINYINT(1) DEFAULT 0');
  await addCol('players', 'verified_platform', 'VARCHAR(50) NULL');
  await addCol('players', 'verified_platform_handle', 'VARCHAR(150) NULL');
  await addCol('players', 'identity_verified_at', 'DATETIME NULL');
  await addCol('players', 'eafc_club_id', 'VARCHAR(36) NULL');
  await addCol('players', 'eafc_club_name', 'VARCHAR(255) NULL');
  await addCol('players', 'home_player_email', 'VARCHAR(255) NULL');
  await addCol('players', 'stream_url', 'TEXT NULL');
  await addCol('players', 'oauth_provider', 'VARCHAR(50) NULL');
  await addCol('players', 'oauth_id', 'VARCHAR(255) NULL');
  // Legacy DBs sometimes marked club_id NOT NULL; kicks / account deletion must clear it.
  await EXECUTESQL(
    'ALTER TABLE players MODIFY COLUMN club_id VARCHAR(36) NULL'
  ).catch((err) => console.error('[migration] players.club_id nullable:', err.message));
  await addCol('users', 'access_mode', "VARCHAR(32) NULL DEFAULT 'standard'");
  await addCol('users', 'limited_tournament_id', 'VARCHAR(36) NULL');
  await addCol('users', 'limited_mode_expires_at', 'DATETIME NULL');
  await addCol('users', 'role', "VARCHAR(50) NULL DEFAULT 'user'");
  // Tournament credits are user-scoped (one pot for player + club tournaments).
  await addCol('users', 'credits', 'INT NULL DEFAULT 0');
  await addCol('users', 'credits_refreshed_at', 'DATETIME NULL');
  await addCol('users', 'timezone', "VARCHAR(80) NULL DEFAULT 'Europe/Brussels'");
  // One-time backfill: seed user credits from the higher of linked player/club wallets.
  await EXECUTESQL(`
    UPDATE users u
    SET credits = GREATEST(
      COALESCE(u.credits, 0),
      COALESCE((
        SELECT MAX(p.credits) FROM players p
        WHERE p.user_id = u.id OR LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))
      ), 0),
      COALESCE((
        SELECT MAX(c.credits) FROM clubs c
        WHERE c.president_user_id = u.id OR c.user_id = u.id
           OR LOWER(TRIM(c.owner_email)) = LOWER(TRIM(u.email))
      ), 0)
    )
    WHERE COALESCE(u.credits, 0) = 0
  `).catch((err) => console.error('[migration] users.credits backfill:', err.message));
  await addCol('clubs', 'president_user_id', 'VARCHAR(36) NULL');
  await addIndex('clubs', 'idx_clubs_president_user', '(president_user_id)');
  await addCol('clubs', 'president_id', 'VARCHAR(36) NULL');
  await addIndex('clubs', 'idx_clubs_president_id', '(president_id)');
  await addCol('clubs', 'president_player_id', 'VARCHAR(36) NULL');
  await addIndex('clubs', 'idx_clubs_president_player', '(president_player_id)');
  await EXECUTESQL(`
    UPDATE clubs c
    JOIN presidents pr ON pr.id = c.president_id
    JOIN players p ON p.user_id = pr.user_id
    SET c.president_player_id = p.id,
        c.updated_date = NOW()
    WHERE c.president_player_id IS NULL
      AND pr.user_id IS NOT NULL
  `).catch(err => console.error('[migration] clubs.president_player_id backfill:', err.message));
    await addCol('clubs', 'transfer_locked_stc', 'DECIMAL(12,2) DEFAULT 0');
    await addCol('clubs', 'finance_warning', 'VARCHAR(100) NULL');
    await addCol('stc_transactions', 'related_entity_type', 'VARCHAR(100) NULL');
    await addCol('stc_transactions', 'related_entity_id', 'VARCHAR(36) NULL');
  await EXECUTESQL('ALTER TABLE clubs ALTER COLUMN stc SET DEFAULT 2500000')
    .catch((err) => console.error('[migration] clubs.stc default:', err.message));
  await EXECUTESQL('ALTER TABLE clubs ALTER COLUMN wage_budget_stc SET DEFAULT 250000')
    .catch((err) => console.error('[migration] clubs.wage_budget_stc default:', err.message));
  await EXECUTESQL('ALTER TABLE clubs ALTER COLUMN transfer_budget_stc SET DEFAULT 1000000')
    .catch((err) => console.error('[migration] clubs.transfer_budget_stc default:', err.message));
  await EXECUTESQL('ALTER TABLE clubs ALTER COLUMN stadium_level SET DEFAULT 0')
    .catch((err) => console.error('[migration] clubs.stadium_level default:', err.message));
  await EXECUTESQL('ALTER TABLE clubs ALTER COLUMN stadium_capacity SET DEFAULT 5000')
    .catch((err) => console.error('[migration] clubs.stadium_capacity default:', err.message));

  // Presidents are a first-class entity (like players). Legacy club-embedded
  // president_* profile columns are backfilled then dropped below.
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS presidents (
    id                  VARCHAR(36)  PRIMARY KEY,
    user_id             VARCHAR(36)  NOT NULL,
    club_id             VARCHAR(36),
    email               VARCHAR(255),
    display_name        VARCHAR(150),
    role_title          VARCHAR(100),
    avatar_url          TEXT,
    avatar_position     VARCHAR(50)  DEFAULT '50% 50%',
    avatar_zoom         INT          DEFAULT 150,
    banner_url          VARCHAR(500),
    banner_position     VARCHAR(50),
    banner_zoom         INT,
    bio                 TEXT,
    success_level       VARCHAR(50),
    country_code        VARCHAR(10),
    quote               VARCHAR(255),
    management_style    VARCHAR(100),
    started_at          DATETIME,
    social_links        JSON,
    status              VARCHAR(50)  DEFAULT 'active',
    created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_presidents_user (user_id),
    INDEX idx_presidents_club (club_id),
    INDEX idx_presidents_email (email)
  )`).catch(err => console.error('[migration] presidents:', err.message));
  await addCol('presidents', 'avatar_position', "VARCHAR(50) NULL DEFAULT '50% 50%'");
  await addCol('presidents', 'avatar_zoom', 'INT NULL DEFAULT 150');

  const legacyPresidentProfileCols = await EXECUTESQL(
    `SELECT COLUMN_NAME FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'clubs'
       AND column_name = 'president_name'
     LIMIT 1`
  ).catch(() => []);

  if (legacyPresidentProfileCols.length) {
    try {
      const clubsNeedingPresident = await EXECUTESQL(`
        SELECT c.id, c.president_user_id, c.owner_email, c.president_id,
               c.president_name, c.president_role_title, c.president_avatar_url,
               c.president_banner_url, c.president_banner_position, c.president_banner_zoom,
               c.president_bio, c.president_success_level, c.president_country_code,
               c.president_quote, c.president_management_style, c.president_started_at,
               c.president_social_links
        FROM clubs c
        WHERE c.president_user_id IS NOT NULL
          AND c.president_user_id <> ''
      `);
      for (const club of clubsNeedingPresident) {
        const existing = await EXECUTESQL(
          'SELECT id, club_id FROM presidents WHERE user_id = ? LIMIT 1',
          [club.president_user_id]
        );
        let presidentId = existing[0]?.id || null;
        if (!presidentId) {
          presidentId = uuidv4();
          const socialLinks = club.president_social_links == null
            ? null
            : (typeof club.president_social_links === 'string'
              ? club.president_social_links
              : JSON.stringify(club.president_social_links));
          await EXECUTESQL(
            `INSERT INTO presidents (
              id, user_id, club_id, email, display_name, role_title,
              avatar_url, banner_url, banner_position, banner_zoom, bio,
              success_level, country_code, quote, management_style, started_at,
              social_links, status
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'active')`,
            [
              presidentId,
              club.president_user_id,
              club.id,
              club.owner_email || null,
              club.president_name || null,
              club.president_role_title || null,
              club.president_avatar_url || null,
              club.president_banner_url || null,
              club.president_banner_position || null,
              club.president_banner_zoom ?? null,
              club.president_bio || null,
              club.president_success_level || null,
              club.president_country_code || null,
              club.president_quote || null,
              club.president_management_style || null,
              club.president_started_at || null,
              socialLinks,
            ]
          );
        } else if (!existing[0].club_id) {
          await EXECUTESQL('UPDATE presidents SET club_id = ? WHERE id = ?', [club.id, presidentId]);
        }
        if (!club.president_id || club.president_id !== presidentId) {
          await EXECUTESQL('UPDATE clubs SET president_id = ? WHERE id = ?', [presidentId, club.id]);
        }
      }
      console.log(`[migration] Backfilled ${clubsNeedingPresident.length} club president profile(s) into presidents`);
    } catch (err) {
      console.error('[migration] presidents backfill from clubs:', err.message);
    }

    const legacyClubPresidentFields = [
      'president_name',
      'president_role_title',
      'president_avatar_url',
      'president_banner_url',
      'president_banner_position',
      'president_banner_zoom',
      'president_bio',
      'president_success_level',
      'president_country_code',
      'president_quote',
      'president_management_style',
      'president_started_at',
      'president_social_links',
    ];
    for (const column of legacyClubPresidentFields) {
      await dropCol('clubs', column);
    }
  }

  // Universal ensure: every club with a president_user_id gets a presidents row
  // even when legacy club.president_* columns were never present.
  try {
    const clubsMissingPresidentLink = await EXECUTESQL(`
      SELECT c.id, c.president_user_id, c.owner_email, c.president_id
      FROM clubs c
      WHERE c.president_user_id IS NOT NULL
        AND c.president_user_id <> ''
        AND (
          c.president_id IS NULL
          OR c.president_id = ''
          OR NOT EXISTS (SELECT 1 FROM presidents p WHERE p.id = c.president_id)
        )
    `);
    for (const club of clubsMissingPresidentLink) {
      const existing = await EXECUTESQL(
        'SELECT id, club_id FROM presidents WHERE user_id = ? LIMIT 1',
        [club.president_user_id]
      );
      let presidentId = existing[0]?.id || null;
      if (!presidentId) {
        presidentId = uuidv4();
        await EXECUTESQL(
          `INSERT INTO presidents (
            id, user_id, club_id, email, role_title, status, avatar_position, avatar_zoom
          ) VALUES (?, ?, ?, ?, 'President', 'active', '50% 50%', 150)`,
          [presidentId, club.president_user_id, club.id, club.owner_email || null]
        );
      } else if (!existing[0].club_id) {
        await EXECUTESQL('UPDATE presidents SET club_id = ? WHERE id = ?', [club.id, presidentId]);
      }
      await EXECUTESQL('UPDATE clubs SET president_id = ? WHERE id = ?', [presidentId, club.id]);
    }
    if (clubsMissingPresidentLink.length) {
      console.log(`[migration] Ensured presidents row for ${clubsMissingPresidentLink.length} club(s)`);
    }
  } catch (err) {
    console.error('[migration] presidents ensure-for-all-clubs:', err.message);
  }

  // Keep presidents.club_id aligned with clubs.president_id.
  await EXECUTESQL(`
    UPDATE presidents p
    JOIN clubs c ON c.president_id = p.id
    SET p.club_id = c.id
    WHERE p.club_id IS NULL OR p.club_id <> c.id
  `).catch(err => console.error('[migration] presidents.club_id sync:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS president_club_history (
    id                  VARCHAR(36)  PRIMARY KEY,
    president_id        VARCHAR(36)  NOT NULL,
    club_id             VARCHAR(36)  NOT NULL,
    club_name           VARCHAR(150),
    started_at          DATETIME     NOT NULL,
    ended_at            DATETIME     NULL,
    reason              VARCHAR(255) NULL,
    created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pch_president (president_id),
    INDEX idx_pch_club (club_id),
    INDEX idx_pch_open (president_id, ended_at)
  )`).catch(err => console.error('[migration] president_club_history:', err.message));

  // Seed open tenure rows for presidents currently linked to a club.
  try {
    const { v4: uuidv4 } = require('uuid');
    const current = await EXECUTESQL(`
      SELECT p.id AS president_id, p.club_id, c.name AS club_name,
             COALESCE(p.started_at, p.created_date, NOW()) AS started_at
      FROM presidents p
      JOIN clubs c ON c.id = p.club_id
      WHERE p.club_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM president_club_history h
          WHERE h.president_id = p.id AND h.ended_at IS NULL
        )
    `).catch(() => []);
    for (const row of current) {
      await EXECUTESQL(
        `INSERT INTO president_club_history
           (id, president_id, club_id, club_name, started_at, ended_at, reason, created_date)
         VALUES (?, ?, ?, ?, ?, NULL, 'backfill', NOW())`,
        [uuidv4(), row.president_id, row.club_id, row.club_name || null, row.started_at]
      ).catch(() => {});
    }
    if (current.length) {
      console.log(`[migration] Seeded ${current.length} open president_club_history tenure(s)`);
    }
  } catch (err) {
    console.error('[migration] president_club_history backfill:', err.message);
  }

  await addCol('player_contracts', 'offered_by_user_id', 'VARCHAR(36) NULL');
  await addCol('player_contracts', 'offered_by_club_id', 'VARCHAR(36) NULL');
  await addCol('player_contracts', 'offered_by_president_id', 'VARCHAR(36) NULL');
  await addIndex('player_contracts', 'idx_contracts_offered_by_user', '(offered_by_user_id)');
  await addIndex('player_contracts', 'idx_contracts_offered_by_club', '(offered_by_club_id)');
  await addIndex('player_contracts', 'idx_contracts_offered_by_president', '(offered_by_president_id)');

  // Backfill contract actor president ids from the offering club.
  await EXECUTESQL(`
    UPDATE player_contracts pc
    JOIN clubs c ON c.id = pc.offered_by_club_id OR c.id = pc.team_id
    SET pc.offered_by_president_id = c.president_id
    WHERE pc.offered_by_president_id IS NULL
      AND c.president_id IS NOT NULL
  `).catch(err => console.error('[migration] contracts offered_by_president_id backfill:', err.message));

  await addCol('tournaments', 'winner_player_id', 'VARCHAR(36) NULL');
  await addCol('tournaments', 'winner_player_name', 'VARCHAR(150) NULL');
  // Read by the club ranking query; its absence broke ranking calculation outright.
  await addCol('tournaments', 'runner_up_club_id', 'VARCHAR(36) NULL');
  // Lets the match archive show that a score was corrected by an admin; the
  // before/after and the reason live in admin_audit_log.
  await addCol('matches', 'score_corrected_at', 'DATETIME NULL');
  await addCol('matches', 'score_corrected_by', 'VARCHAR(36) NULL');
  await addCol('tournaments', 'registration_proofs', 'JSON NULL');

  await addCol('matches', 'home_club_id', 'VARCHAR(36) NULL');
  await addCol('matches', 'away_club_id', 'VARCHAR(36) NULL');
  await addCol('matches', 'home_player_id', 'VARCHAR(36) NULL');
  await addCol('matches', 'away_player_id', 'VARCHAR(36) NULL');
  await addCol('matches', 'home_club_name', 'VARCHAR(150) NULL');
  await addCol('matches', 'away_club_name', 'VARCHAR(150) NULL');
  await addCol('matches', 'home_player_name', 'VARCHAR(150) NULL');
  await addCol('matches', 'away_player_name', 'VARCHAR(150) NULL');
  await addCol('matches', 'home_player_email', 'VARCHAR(255) NULL');
  await addCol('matches', 'away_player_email', 'VARCHAR(255) NULL');
  await addCol('matches', 'home_owner_email', 'VARCHAR(255) NULL');
  await addCol('matches', 'away_owner_email', 'VARCHAR(255) NULL');
  await EXECUTESQL('CREATE INDEX idx_matches_home_owner_email ON matches(home_owner_email)')
    .catch((err) => console.error('[migration] idx_matches_home_owner_email:', err.message));
  await EXECUTESQL('CREATE INDEX idx_matches_away_owner_email ON matches(away_owner_email)')
    .catch((err) => console.error('[migration] idx_matches_away_owner_email:', err.message));

  // Match result submission fields
  await addCol('matches', 'home_goal_events', 'TEXT NULL');
  await addCol('matches', 'away_goal_events', 'TEXT NULL');
  await addCol('matches', 'result_home_submitted', 'TINYINT(1) DEFAULT 0');
  await addCol('matches', 'result_away_submitted', 'TINYINT(1) DEFAULT 0');
  await addCol('matches', 'home_submission', 'TEXT NULL');
  await addCol('matches', 'away_submission', 'TEXT NULL');
  await addCol('matches', 'stats_processed', 'TINYINT(1) DEFAULT 0');
  await addCol('matches', 'competition_context', 'VARCHAR(255) NULL');

  // Submitted-score reconciliation (used when home and away submit separately
  // and need to agree before the match is finalised).
  await addCol('matches', 'home_submitted_score',  'VARCHAR(20) NULL');
  await addCol('matches', 'away_submitted_score',  'VARCHAR(20) NULL');
  await addCol('matches', 'first_submission_at',   'DATETIME NULL');
  await addCol('matches', 'first_submitter_club_id', 'VARCHAR(36) NULL');

  // Winner / loser denormalisation — populated when the match finishes so
  // standings / rankings can read without an extra join.
  await addCol('matches', 'winner_club_id',     'VARCHAR(36) NULL');
  await addCol('matches', 'winner_club_name',   'VARCHAR(150) NULL');
  await addCol('matches', 'winner_player_id',   'VARCHAR(36) NULL');
  await addCol('matches', 'winner_player_name', 'VARCHAR(150) NULL');
  await addCol('matches', 'loser_club_id',      'VARCHAR(36) NULL');
  await addCol('matches', 'loser_club_name',    'VARCHAR(150) NULL');
  await addCol('matches', 'loser_player_id',    'VARCHAR(36) NULL');
  await addCol('matches', 'loser_player_name',  'VARCHAR(150) NULL');

  // Tournament bracket bookkeeping
  await addCol('matches', 'group_number', 'INT NULL');
  await addCol('matches', 'bracket_side', 'VARCHAR(20) NULL');

  // Media / proof / streaming
  await addCol('matches', 'video_url',         'TEXT NULL');
  await addCol('matches', 'proof_url',         'TEXT NULL');
  await addCol('matches', 'home_stream_url',   'TEXT NULL');
  await addCol('matches', 'away_stream_url',   'TEXT NULL');

  // Forfeit workflow
  await addCol('matches', 'forfeit_claimed_by', 'VARCHAR(255) NULL');
  await addCol('matches', 'forfeit_proof_url',  'TEXT NULL');
  await addCol('matches', 'forfeit_status',     'VARCHAR(50) NULL');

  // Admin / note fields
  await addCol('matches', 'admin_notes', 'TEXT NULL');
  await addCol('matches', 'notes',       'TEXT NULL');

  // Wager identity (which players staked each side, separate from the
  // match itself which can be club-level).
  await addCol('matches', 'wager_home_player_id', 'VARCHAR(36) NULL');
  await addCol('matches', 'wager_away_player_id', 'VARCHAR(36) NULL');

  // Where this match came from (league fixture, knockout tie, friendly, …)
  await addCol('matches', 'source_fixture_id',   'VARCHAR(36) NULL');
  await addCol('matches', 'source_fixture_type', 'VARCHAR(50) NULL');
  await addCol('matches', 'cancel_status', 'VARCHAR(30) NULL');
  await addCol('matches', 'cancel_requested_by', 'VARCHAR(255) NULL');

  // match_player_stats — add player_id and gamertag (schema v2)
  await addCol('match_player_stats', 'player_id', 'VARCHAR(36) NULL');
  await addCol('match_player_stats', 'player_gamertag', 'VARCHAR(255) NULL');
  await addCol('match_player_stats', 'position', 'VARCHAR(50) NULL');
  await addCol('match_player_stats', 'clean_sheet', 'TINYINT(1) DEFAULT 0');
  await addCol('match_player_stats', 'is_motm', 'TINYINT(1) DEFAULT 0');

  // Official STAGE rankings — rebuilt from competition/tournament fixtures only.
  await addCol('clubs', 'logo_zoom', 'INT NULL');
  await addCol('clubs', 'country_rank', 'INT NULL');
  await addCol('players', 'ranking_points', 'INT DEFAULT 0');
  await addCol('players', 'global_rank', 'INT NULL');
  await addCol('players', 'regional_rank', 'INT NULL');
  await addCol('players', 'country_rank', 'INT NULL');
  await addCol('players', 'position_rank', 'INT NULL');
  await addCol('players', 'ranking_matches', 'INT DEFAULT 0');
  await addCol('players', 'ranking_wins', 'INT DEFAULT 0');
  await addCol('players', 'ranking_draws', 'INT DEFAULT 0');
  await addCol('players', 'ranking_losses', 'INT DEFAULT 0');
  await addCol('players', 'ranking_win_rate', 'DECIMAL(5,2) DEFAULT 0');
  await addCol('players', 'ranking_goals', 'INT DEFAULT 0');
  await addCol('players', 'ranking_assists', 'INT DEFAULT 0');
  await addCol('players', 'ranking_clean_sheets', 'INT DEFAULT 0');
  await addCol('players', 'ranking_motm', 'INT DEFAULT 0');
  await addCol('players', 'ranking_avg_rating', 'DECIMAL(4,2) DEFAULT 0');
  await addCol('players', 'ranking_competition_wins', 'INT DEFAULT 0');
  await addCol('players', 'ranking_finishes_score', 'INT DEFAULT 0');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS international_tournaments (
    id                  VARCHAR(36) PRIMARY KEY,
    name                VARCHAR(200) NOT NULL,
    tournament_type     VARCHAR(50)  NOT NULL,
    region              VARCHAR(100) NULL,
    status              VARCHAR(40)  NOT NULL DEFAULT 'draft',
    voting_opens_at     DATETIME     NULL,
    voting_closes_at    DATETIME     NULL,
    squad_locks_at      DATETIME     NULL,
    starts_at           DATETIME     NULL,
    max_squad_size      INT          NOT NULL DEFAULT 26,
    max_teams           INT          NOT NULL DEFAULT 32,
    matchday_squad_size INT          NOT NULL DEFAULT 18,
    starters_size       INT          NOT NULL DEFAULT 11,
    bench_size          INT          NOT NULL DEFAULT 7,
    eligible_countries  JSON         NULL,
    created_by_user_id  VARCHAR(36)  NULL,
    created_by_email    VARCHAR(255) NULL,
    created_date        DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date        DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_it_status (status),
    INDEX idx_it_type_region (tournament_type, region),
    INDEX idx_it_dates (voting_opens_at, voting_closes_at, starts_at)
  )`).catch(err => console.error('[migration] international_tournaments:', err.message));
  await addCol('international_tournaments', 'max_teams', 'INT NOT NULL DEFAULT 32');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS national_team_elections (
    id                          VARCHAR(36) PRIMARY KEY,
    international_tournament_id VARCHAR(36) NOT NULL,
    country_code                VARCHAR(10) NOT NULL,
    country_name                VARCHAR(100) NULL,
    status                      VARCHAR(40) NOT NULL DEFAULT 'draft',
    voting_opens_at             DATETIME NULL,
    voting_closes_at            DATETIME NULL,
    winner_player_id            VARCHAR(36) NULL,
    winner_owner_user_id        VARCHAR(36) NULL,
    winner_owner_club_id        VARCHAR(36) NULL,
    winner_vote_count           INT DEFAULT 0,
    created_date                DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date                DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_nte_tournament_country (international_tournament_id, country_code),
    INDEX idx_nte_tournament (international_tournament_id),
    INDEX idx_nte_country_status (country_code, status)
  )`).catch(err => console.error('[migration] national_team_elections:', err.message));
  await addCol('national_team_elections', 'winner_owner_user_id', 'VARCHAR(36) NULL');
  await addCol('national_team_elections', 'winner_owner_club_id', 'VARCHAR(36) NULL');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS national_team_votes (
    id                  VARCHAR(36) PRIMARY KEY,
    election_id          VARCHAR(36) NOT NULL,
    tournament_id        VARCHAR(36) NOT NULL,
    country_code         VARCHAR(10) NOT NULL,
    voter_player_id      VARCHAR(36) NOT NULL,
    candidate_player_id  VARCHAR(36) NOT NULL,
    voter_owner_club_id  VARCHAR(36) NULL,
    candidate_owner_club_id VARCHAR(36) NULL,
    candidate_owner_user_id VARCHAR(36) NULL,
    created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_ntv_election_voter (election_id, voter_player_id),
    INDEX idx_ntv_election_candidate (election_id, candidate_player_id),
    INDEX idx_ntv_tournament_country (tournament_id, country_code)
  )`).catch(err => console.error('[migration] national_team_votes:', err.message));
  await addCol('national_team_votes', 'voter_owner_club_id', 'VARCHAR(36) NULL');
  await addCol('national_team_votes', 'candidate_owner_club_id', 'VARCHAR(36) NULL');
  await addCol('national_team_votes', 'candidate_owner_user_id', 'VARCHAR(36) NULL');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS national_team_representatives (
    id                  VARCHAR(36) PRIMARY KEY,
    tournament_id        VARCHAR(36) NOT NULL,
    election_id          VARCHAR(36) NOT NULL,
    country_code         VARCHAR(10) NOT NULL,
    player_id            VARCHAR(36) NOT NULL,
    owner_user_id         VARCHAR(36) NULL,
    owner_club_id         VARCHAR(36) NULL,
    vote_count           INT DEFAULT 0,
    status               VARCHAR(40) DEFAULT 'active',
    created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_ntr_tournament_country (tournament_id, country_code),
    INDEX idx_ntr_player (player_id),
    INDEX idx_ntr_election (election_id)
  )`).catch(err => console.error('[migration] national_team_representatives:', err.message));
  await addCol('national_team_representatives', 'owner_user_id', 'VARCHAR(36) NULL');
  await addCol('national_team_representatives', 'owner_club_id', 'VARCHAR(36) NULL');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS national_team_squads (
    id                     VARCHAR(36) PRIMARY KEY,
    tournament_id           VARCHAR(36) NOT NULL,
    country_code            VARCHAR(10) NOT NULL,
    representative_id       VARCHAR(36) NULL,
    status                  VARCHAR(40) DEFAULT 'draft',
    locked_at               DATETIME NULL,
    submitted_by_player_id  VARCHAR(36) NULL,
    submitted_by_owner_user_id VARCHAR(36) NULL,
    created_date            DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_nts_tournament_country (tournament_id, country_code),
    INDEX idx_nts_rep (representative_id),
    INDEX idx_nts_status (status)
  )`).catch(err => console.error('[migration] national_team_squads:', err.message));
  await addCol('national_team_squads', 'submitted_by_owner_user_id', 'VARCHAR(36) NULL');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS national_team_squad_players (
    id                  VARCHAR(36) PRIMARY KEY,
    squad_id             VARCHAR(36) NOT NULL,
    tournament_id        VARCHAR(36) NOT NULL,
    country_code         VARCHAR(10) NOT NULL,
    player_id            VARCHAR(36) NOT NULL,
    position             VARCHAR(50) NULL,
    overall_rating       DECIMAL(4,1) DEFAULT 0,
    created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_ntsp_squad_player (squad_id, player_id),
    INDEX idx_ntsp_tournament_country (tournament_id, country_code),
    INDEX idx_ntsp_player (player_id)
  )`).catch(err => console.error('[migration] national_team_squad_players:', err.message));

  // Player wallet transaction table
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS player_stc_transactions (
    id            VARCHAR(36)    PRIMARY KEY,
    player_id     VARCHAR(36)    NOT NULL,
    player_email  VARCHAR(255),
    amount        DECIMAL(12,2)  NOT NULL,
    balance_after DECIMAL(12,2),
    type          VARCHAR(20),
    category      VARCHAR(100),
    source        VARCHAR(255),
    description   TEXT,
    reference_id  VARCHAR(36),
    created_date  DATETIME       DEFAULT CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] player_stc_transactions:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS player_fut_matches (
    id             VARCHAR(36)  PRIMARY KEY,
    player_id      VARCHAR(36)  NOT NULL,
    player_email   VARCHAR(255) NULL,
    played_at      DATETIME     NOT NULL,
    result         VARCHAR(10)  NOT NULL,
    goals_for      INT          DEFAULT 0,
    goals_against  INT          DEFAULT 0,
    mode           VARCHAR(50)  DEFAULT 'rivals',
    opponent_note  VARCHAR(255) NULL,
    notes          TEXT         NULL,
    proof_url      TEXT         NULL,
    created_date   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_fut_match_player (player_id),
    INDEX idx_fut_match_played (played_at)
  )`).catch(err => console.error('[migration] player_fut_matches:', err.message));

  // Player identity claiming / verification workflow.
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS player_identity_claims (
    id                    VARCHAR(36)  PRIMARY KEY,
    player_id             VARCHAR(36)  NOT NULL,
    user_id               VARCHAR(36)  NULL,
    email                 VARCHAR(255) NULL,
    gamertag              VARCHAR(150) NULL,
    platform              VARCHAR(50)  NOT NULL,
    platform_handle       VARCHAR(150) NOT NULL,
    ea_id                 VARCHAR(150) NULL,
    discord_handle        VARCHAR(150) NULL,
    proof_url             TEXT         NULL,
    notes                 TEXT         NULL,
    status                VARCHAR(30)  NOT NULL DEFAULT 'pending',
    review_notes          TEXT         NULL,
    rejection_reason      TEXT         NULL,
    reviewed_by           VARCHAR(36)  NULL,
    reviewed_by_email     VARCHAR(255) NULL,
    reviewed_at           DATETIME     NULL,
    created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_pic_player  (player_id),
    INDEX idx_pic_user    (user_id),
    INDEX idx_pic_status  (status),
    INDEX idx_pic_created (created_date)
  )`).catch(err => console.error('[migration] player_identity_claims:', err.message));

  // FROZEN. Replaced by club scouting (scouting_reports). Nothing writes these two
  // tables now; they exist so historical rows stay readable. Kept in sync with
  // schema.sql per AGENTS.md §6 rather than quietly diverging.
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS recruitment_posts (
    id                  VARCHAR(36) PRIMARY KEY,
    author_user_id      VARCHAR(36) NULL,
    author_player_id    VARCHAR(36) NULL,
    author_club_id      VARCHAR(36) NULL,
    post_type           VARCHAR(30) NOT NULL,
    title               VARCHAR(255) NOT NULL,
    body                TEXT NULL,
    positions_needed    JSON NULL,
    preferred_positions JSON NULL,
    platform            VARCHAR(50) NULL,
    region              VARCHAR(100) NULL,
    availability_text   VARCHAR(255) NULL,
    discord_handle      VARCHAR(150) NULL,
    mic_required        TINYINT(1) DEFAULT 0,
    verified_only       TINYINT(1) DEFAULT 0,
    status              VARCHAR(30) DEFAULT 'open',
    expires_at          DATETIME NULL,
    created_date        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rp_type_status (post_type, status),
    INDEX idx_rp_player (author_player_id),
    INDEX idx_rp_club (author_club_id),
    INDEX idx_rp_platform_region (platform, region),
    INDEX idx_rp_created (created_date)
  )`).catch(err => console.error('[migration] recruitment_posts:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS recruitment_interests (
    id                   VARCHAR(36) PRIMARY KEY,
    recruitment_post_id  VARCHAR(36) NOT NULL,
    sender_user_id       VARCHAR(36) NULL,
    sender_player_id     VARCHAR(36) NULL,
    sender_club_id       VARCHAR(36) NULL,
    recipient_user_id    VARCHAR(36) NULL,
    recipient_player_id  VARCHAR(36) NULL,
    recipient_club_id    VARCHAR(36) NULL,
    message              TEXT NULL,
    status               VARCHAR(30) DEFAULT 'pending',
    created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ri_post (recruitment_post_id),
    INDEX idx_ri_sender_user (sender_user_id),
    INDEX idx_ri_recipient_user (recipient_user_id),
    INDEX idx_ri_status (status)
  )`).catch(err => console.error('[migration] recruitment_interests:', err.message));

  // A player's own showcase clips. Owned by the player; scouts only read them.
  // Keep in sync with schema.sql.
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS player_showcase_videos (
    id           VARCHAR(36) PRIMARY KEY,
    player_id    VARCHAR(36) NOT NULL,
    url          TEXT NOT NULL,
    title        VARCHAR(120) NULL,
    description  VARCHAR(500) NULL,
    duration_seconds DECIMAL(5,2) NULL,
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    sort_order   INT DEFAULT 0,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_psv_player (player_id, sort_order),
    INDEX idx_psv_created (created_date)
  )`).catch(err => console.error('[migration] player_showcase_videos:', err.message));
  await addCol('player_showcase_videos', 'title', 'VARCHAR(120) NULL');
  await addCol('player_showcase_videos', 'description', 'VARCHAR(500) NULL');
  await addCol('player_showcase_videos', 'duration_seconds', 'DECIMAL(5,2) NULL');
  await addCol('player_showcase_videos', 'likes_count', 'INT DEFAULT 0');
  await addCol('player_showcase_videos', 'comments_count', 'INT DEFAULT 0');
  await addCol('player_showcase_videos', 'sort_order', 'INT DEFAULT 0');
  await addCol('player_showcase_videos', 'created_date', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
  await addCol('player_showcase_videos', 'updated_date', 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await addIndex('player_showcase_videos', 'idx_psv_player', '(player_id, sort_order)');
  await addIndex('player_showcase_videos', 'idx_psv_created', '(created_date)');
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS player_showcase_video_likes (
    id         VARCHAR(36) PRIMARY KEY,
    video_id   VARCHAR(36) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_psv_likes_video_user (video_id, user_email),
    INDEX idx_psv_likes_video (video_id)
  )`).catch(err => console.error('[migration] player_showcase_video_likes:', err.message));
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS player_showcase_video_comments (
    id                VARCHAR(36) PRIMARY KEY,
    video_id          VARCHAR(36) NOT NULL,
    author_email      VARCHAR(255) NOT NULL,
    author_player_id  VARCHAR(36) NULL,
    author_name       VARCHAR(150) NULL,
    author_avatar_url TEXT NULL,
    content           TEXT NOT NULL,
    created_date      DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_psv_comments_video (video_id)
  )`).catch(err => console.error('[migration] player_showcase_video_comments:', err.message));
  // The position a player wants to be scouted for, which may differ from the one
  // they currently play at their club.
  await addCol('players', 'showcase_position', 'VARCHAR(40) NULL');

  // Club-private scouting pipeline. Only members of `club_id` may read/write its
  // reports; `target_player_id` may be any player, contract eligibility is checked
  // later at offer time. Keep in sync with schema.sql.
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS scouting_reports (
    id                   VARCHAR(36) PRIMARY KEY,
    club_id              VARCHAR(36) NOT NULL,
    scouted_by_player_id VARCHAR(36) NULL,
    scouted_by_user_id   VARCHAR(36) NULL,
    target_player_id     VARCHAR(36) NOT NULL,
    video_links          JSON NULL,
    notes                TEXT NULL,
    status               VARCHAR(30) DEFAULT 'open',
    votes                JSON NULL,
    offered_contract_id  VARCHAR(36) NULL,
    created_date         DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date         DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sr_club_status (club_id, status),
    INDEX idx_sr_target (target_player_id),
    INDEX idx_sr_scout (scouted_by_player_id)
  )`).catch(err => console.error('[migration] scouting_reports:', err.message));
  // For databases that already created scouting_reports before these existed.
  await addCol('scouting_reports', 'votes', 'JSON NULL');
  await addCol('scouting_reports', 'offered_contract_id', 'VARCHAR(36) NULL');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS club_applicants (
    id                 VARCHAR(36) PRIMARY KEY,
    club_id            VARCHAR(36) NOT NULL,
    player_id          VARCHAR(36) NULL,
    user_id            VARCHAR(36) NULL,
    source_type        VARCHAR(40) DEFAULT 'manual',
    source_id          VARCHAR(36) NULL,
    status             VARCHAR(40) DEFAULT 'new',
    preferred_position VARCHAR(40) NULL,
    platform           VARCHAR(50) NULL,
    message            TEXT NULL,
    notes              TEXT NULL,
    created_date       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_ca_source (source_type, source_id),
    INDEX idx_ca_club_status (club_id, status),
    INDEX idx_ca_player (player_id)
  )`).catch(err => console.error('[migration] club_applicants:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS club_memberships (
    id            VARCHAR(36) PRIMARY KEY,
    club_id       VARCHAR(36) NOT NULL,
    player_id     VARCHAR(36) NOT NULL,
    user_id       VARCHAR(36) NULL,
    status        VARCHAR(30) DEFAULT 'active',
    primary_role  VARCHAR(40) DEFAULT 'member',
    source        VARCHAR(40) DEFAULT 'manual',
    created_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_cm_player_club (club_id, player_id),
    INDEX idx_cm_club_status (club_id, status),
    INDEX idx_cm_player_status (player_id, status),
    INDEX idx_cm_user_status (user_id, status)
  )`).catch(err => console.error('[migration] club_memberships:', err.message));

  await EXECUTESQL('ALTER TABLE club_memberships DROP INDEX uq_cm_active_player_club')
    .catch(() => {});
  await EXECUTESQL('CREATE INDEX idx_cm_player_club ON club_memberships (club_id, player_id)')
    .catch(() => {});

  await EXECUTESQL(`
    INSERT IGNORE INTO club_memberships
      (id, club_id, player_id, user_id, status, primary_role, source, created_date, updated_date)
    SELECT UUID(), p.club_id, p.id, p.user_id, 'active',
           COALESCE(NULLIF(p.role, ''), 'member'),
           'legacy_player_club_id',
           COALESCE(p.created_date, NOW()),
           NOW()
      FROM players p
     WHERE p.club_id IS NOT NULL AND p.club_id <> ''
       AND NOT EXISTS (
         SELECT 1
           FROM club_memberships cm
          WHERE cm.club_id = p.club_id
            AND cm.player_id = p.id
            AND cm.status = 'active'
       )
  `).catch(err => console.error('[migration] club_memberships players backfill:', err.message));

  await EXECUTESQL(`
    INSERT IGNORE INTO club_memberships
      (id, club_id, player_id, user_id, status, primary_role, source, created_date, updated_date)
    SELECT UUID(), c.id, p.id, u.id, 'active',
           'president',
           'legacy_owner_link',
           NOW(),
           NOW()
      FROM users u
      JOIN clubs c
        ON c.id = u.owner_id
        OR c.user_id = u.id
        OR LOWER(TRIM(c.owner_email)) = LOWER(TRIM(u.email))
      JOIN players p
        ON p.id = u.player_id
        OR p.user_id = u.id
        OR LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))
     WHERE c.id IS NOT NULL AND p.id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
           FROM club_memberships cm
          WHERE cm.club_id = c.id
            AND cm.player_id = p.id
            AND cm.status = 'active'
       )
  `).catch(err => console.error('[migration] club_memberships owners backfill:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS club_staff_roles (
    id                  VARCHAR(36) PRIMARY KEY,
    club_id             VARCHAR(36) NOT NULL,
    player_id           VARCHAR(36) NOT NULL,
    user_id             VARCHAR(36) NULL,
    role                VARCHAR(40) NOT NULL,
    permissions         JSON NULL,
    assigned_by_user_id VARCHAR(36) NULL,
    created_date        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_csr_role (club_id, player_id, role),
    INDEX idx_csr_club (club_id),
    INDEX idx_csr_player (player_id)
  )`).catch(err => console.error('[migration] club_staff_roles:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS club_fixture_availability (
    id           VARCHAR(36) PRIMARY KEY,
    club_id      VARCHAR(36) NOT NULL,
    fixture_id   VARCHAR(36) NOT NULL,
    fixture_type VARCHAR(50) NULL,
    player_id    VARCHAR(36) NOT NULL,
    user_id      VARCHAR(36) NULL,
    status       VARCHAR(30) DEFAULT 'no_response',
    note         TEXT NULL,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cfa_player_fixture (club_id, fixture_id, player_id),
    INDEX idx_cfa_fixture (club_id, fixture_id),
    INDEX idx_cfa_player (player_id)
  )`).catch(err => console.error('[migration] club_fixture_availability:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS club_fixture_lineups (
    id                 VARCHAR(36) PRIMARY KEY,
    club_id            VARCHAR(36) NOT NULL,
    fixture_id         VARCHAR(36) NOT NULL,
    fixture_type       VARCHAR(50) NULL,
    formation          VARCHAR(50) NULL,
    starting_players   JSON NULL,
    bench_players      JSON NULL,
    captain_player_id  VARCHAR(36) NULL,
    notes              TEXT NULL,
    status             VARCHAR(30) DEFAULT 'draft',
    created_by_user_id VARCHAR(36) NULL,
    created_date       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_cfl_fixture (club_id, fixture_id),
    INDEX idx_cfl_fixture (club_id, fixture_id)
  )`).catch(err => console.error('[migration] club_fixture_lineups:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS club_operation_audit_logs (
    id            VARCHAR(36) PRIMARY KEY,
    club_id       VARCHAR(36) NOT NULL,
    actor_user_id VARCHAR(36) NULL,
    actor_email   VARCHAR(255) NULL,
    action        VARCHAR(100) NOT NULL,
    entity_type   VARCHAR(100) NULL,
    entity_id     VARCHAR(36) NULL,
    old_value     JSON NULL,
    new_value     JSON NULL,
    reason        TEXT NULL,
    created_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_coal_club_created (club_id, created_date)
  )`).catch(err => console.error('[migration] club_operation_audit_logs:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS transfer_windows (
    id VARCHAR(36) PRIMARY KEY,
    label VARCHAR(255) NULL,
    status VARCHAR(50) DEFAULT 'closed',
    start_date DATETIME NULL,
    end_date DATETIME NULL,
    notes TEXT NULL,
    transfers_executed INT DEFAULT 0,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] transfer_windows:', err.message));
  await addCol('transfer_windows', 'updated_date', 'DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  // chat_reads — per-user last-read marker per chat channel.
  // channel_id is a string so it supports both raw match UUIDs and
  // namespaced channels like `club:<uuid>` (used by ClubDetail club chat).
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS chat_reads (
    id            VARCHAR(36)  PRIMARY KEY,
    user_email    VARCHAR(255) NOT NULL,
    channel_id    VARCHAR(64)  NOT NULL,
    last_read_at  DATETIME     NOT NULL,
    created_date  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_chat_reads_user_channel (user_email, channel_id),
    INDEX idx_chat_reads_user (user_email)
  )`).catch(err => console.error('[migration] chat_reads:', err.message));

  // processed_stripe_sessions — idempotency guard so a Stripe payment is
  // fulfilled exactly once whether the webhook or the client-return path
  // reports it first. UNIQUE(session_id, kind) is the whole point.
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS processed_stripe_sessions (
    session_id    VARCHAR(255) NOT NULL,
    kind          VARCHAR(32)  NOT NULL,
    processed_at  DATETIME     NOT NULL,
    PRIMARY KEY (session_id, kind)
  )`).catch(err => console.error('[migration] processed_stripe_sessions:', err.message));

  // Widen chat_messages.match_id so namespaced channels (e.g. `club:<uuid>`)
  // fit without silent truncation. Idempotent: MODIFY is a no-op if already wide.
  await EXECUTESQL(`ALTER TABLE chat_messages MODIFY COLUMN match_id VARCHAR(64) NOT NULL`)
    .catch(err => console.error('[migration] chat_messages.match_id widen:', err.message));
  await EXECUTESQL(`CREATE INDEX idx_chat_messages_match_created ON chat_messages (match_id, created_date)`)
    .catch(() => { /* index may already exist */ });

  await EXECUTESQL(`
    UPDATE clubs c
    JOIN users u ON LOWER(TRIM(u.email)) = LOWER(TRIM(c.owner_email))
    SET c.user_id = COALESCE(c.user_id, u.id),
        c.president_user_id = COALESCE(c.president_user_id, c.user_id, u.id),
        u.owner_id = c.id,
        u.role_id = 1,
        c.updated_date = NOW(),
        u.updated_date = NOW()
    WHERE c.owner_email IS NOT NULL
      AND c.owner_email <> ''
  `).catch(err => console.error('[migration] club_owner_user_link:', err.message));

  await EXECUTESQL(`
    UPDATE clubs c
    JOIN users u ON u.owner_id = c.id
    SET c.president_user_id = COALESCE(c.president_user_id, c.user_id, u.id),
        c.user_id = COALESCE(c.user_id, u.id),
        c.updated_date = NOW()
    WHERE c.president_user_id IS NULL
  `).catch(err => console.error('[migration] club_president_user_link:', err.message));

  await EXECUTESQL(`
    UPDATE clubs
    SET president_user_id = user_id,
        updated_date = NOW()
    WHERE president_user_id IS NULL
      AND user_id IS NOT NULL
  `).catch(err => console.error('[migration] club_president_user_id_from_user:', err.message));

  await EXECUTESQL(`
    INSERT IGNORE INTO users (id, email, password_hash, role_id, role, owner_id, created_date, updated_date)
    SELECT UUID(),
           COALESCE(NULLIF(TRIM(c.owner_email), ''), CONCAT('club-', c.id, '@stage.local')),
           NULL,
           1,
           'user',
           c.id,
           NOW(),
           NOW()
    FROM clubs c
    LEFT JOIN users u
      ON LOWER(TRIM(u.email)) = LOWER(TRIM(COALESCE(NULLIF(c.owner_email, ''), CONCAT('club-', c.id, '@stage.local'))))
    WHERE c.president_user_id IS NULL
      AND c.user_id IS NULL
      AND u.id IS NULL
  `).catch(err => console.error('[migration] club_president_placeholder_users:', err.message));

  await EXECUTESQL(`
    UPDATE clubs c
    JOIN users u
      ON LOWER(TRIM(u.email)) = LOWER(TRIM(COALESCE(NULLIF(c.owner_email, ''), CONCAT('club-', c.id, '@stage.local'))))
    SET c.user_id = COALESCE(c.user_id, u.id),
        c.president_user_id = COALESCE(c.president_user_id, u.id),
        u.owner_id = COALESCE(u.owner_id, c.id),
        c.owner_email = COALESCE(NULLIF(TRIM(c.owner_email), ''), u.email),
        c.updated_date = NOW(),
        u.updated_date = NOW()
    WHERE c.president_user_id IS NULL
  `).catch(err => console.error('[migration] club_president_placeholder_link:', err.message));

  const clubPresidentOrphans = await EXECUTESQL(
    'SELECT id, name FROM clubs WHERE president_user_id IS NULL LIMIT 10'
  ).catch(err => {
    console.error('[migration] club_president_orphans:', err.message);
    return [{ id: 'lookup_failed', name: err.message }];
  });
  if (clubPresidentOrphans.length) {
    throw new Error(`clubs.president_user_id migration left ${clubPresidentOrphans.length} orphan club(s)`);
  }

  await EXECUTESQL('ALTER TABLE clubs MODIFY COLUMN president_user_id VARCHAR(36) NOT NULL')
    .catch(err => console.error('[migration] clubs.president_user_id not null:', err.message));

  await EXECUTESQL(`
    UPDATE players p
    JOIN clubs c ON p.club_id = c.id
    JOIN presidents pr ON pr.id = c.president_id AND pr.user_id = c.president_user_id
    SET p.club_id = NULL,
        p.role = CASE WHEN p.role IN ('president', 'owner') THEN 'member' ELSE p.role END,
        p.club_roles = JSON_ARRAY('free_agent'),
        p.status = 'free_agent',
        p.updated_date = NOW()
    WHERE (p.user_id = c.president_user_id OR LOWER(TRIM(p.email)) = LOWER(TRIM(c.owner_email)))
      AND (
        p.role IN ('president', 'owner')
        OR JSON_CONTAINS(p.club_roles, JSON_QUOTE('president'))
        OR EXISTS (
          SELECT 1 FROM player_contracts pc
          WHERE pc.team_id = c.id
            AND pc.user_id = p.id
            AND pc.contract_type = 'ownership'
            AND pc.status IN ('pending','pending_window','negotiating','active')
        )
      )
      AND NOT EXISTS (
        SELECT 1 FROM player_contracts pc2
        WHERE pc2.team_id = c.id
          AND pc2.user_id = p.id
          AND pc2.contract_type <> 'ownership'
          AND pc2.status = 'active'
      )
  `).catch(err => console.error('[migration] separate_player_president_identity:', err.message));

  // MySQL refuses a subquery on the very table being updated (error 1093), which
  // is why the "does this player also have a real squad contract" check is a
  // derived table joined once rather than a NOT EXISTS. It is also cheaper: the
  // squad set is computed a single time instead of per candidate row.
  await EXECUTESQL(`
    UPDATE player_contracts pc
    JOIN players p ON p.id = pc.user_id
    JOIN clubs c ON c.id = pc.team_id
    JOIN presidents pr ON pr.id = c.president_id AND pr.user_id = c.president_user_id
    LEFT JOIN (
      SELECT DISTINCT team_id, user_id
        FROM player_contracts
       WHERE contract_type <> 'ownership'
         AND status = 'active'
    ) squad ON squad.team_id = c.id AND squad.user_id = p.id
    SET pc.status = 'cancelled',
        pc.updated_date = NOW()
    WHERE pc.contract_type = 'ownership'
      AND pc.status IN ('pending','pending_window','negotiating','active')
      AND (p.user_id = c.president_user_id OR LOWER(TRIM(p.email)) = LOWER(TRIM(c.owner_email)))
      AND squad.user_id IS NULL
  `).catch(err => console.error('[migration] cancel_player_ownership_contracts:', err.message));

  await EXECUTESQL(`
    UPDATE player_contracts pc
    JOIN players p ON p.id = pc.user_id
    SET pc.status = 'active',
        pc.start_date = COALESCE(pc.start_date, CURDATE()),
        pc.end_date = COALESCE(
          pc.end_date,
          DATE_ADD(CURDATE(), INTERVAL IF(IFNULL(pc.max_days, 0) > 0, pc.max_days, 180) DAY)
        ),
        pc.updated_date = NOW()
    WHERE pc.status = 'pending_window'
      AND (
        p.club_id IS NULL
        OR p.club_id = ''
        OR p.club_id = pc.team_id
      )
  `).catch(err => console.error('[migration] pending_window_free_agent_activation:', err.message));

  await EXECUTESQL(`
    UPDATE players p
    JOIN player_contracts pc ON pc.user_id = p.id
    JOIN clubs c ON c.id = pc.team_id
    SET p.club_id = c.id,
        p.role = CASE
          WHEN IFNULL(pc.captaincy_offered, 0) = 1 THEN 'captain'
          WHEN p.role IS NULL OR p.role = '' OR p.role = 'free_agent' THEN 'member'
          ELSE p.role
        END,
        p.club_roles = CASE
          WHEN IFNULL(pc.captaincy_offered, 0) = 1 THEN JSON_ARRAY('captain')
          WHEN p.club_roles IS NULL THEN JSON_ARRAY('member')
          ELSE p.club_roles
        END,
        p.status = 'active',
        p.updated_date = NOW()
    WHERE pc.status = 'active'
      AND IFNULL(pc.contract_type, '') <> 'ownership'
      AND (
        p.club_id IS NULL
        OR p.club_id = ''
        OR p.club_id <> c.id
        OR p.status = 'free_agent'
      )
  `).catch(err => console.error('[migration] active_contract_player_link:', err.message));

  await EXECUTESQL(`
    INSERT IGNORE INTO club_memberships
      (id, club_id, player_id, user_id, status, primary_role, source, created_date, updated_date)
    SELECT UUID(), pc.team_id, p.id, p.user_id, 'active',
           CASE
             WHEN IFNULL(pc.captaincy_offered, 0) = 1 THEN 'captain'
             ELSE COALESCE(NULLIF(p.role, ''), 'member')
           END,
           'active_contract_membership_backfill',
           COALESCE(pc.start_date, pc.created_date, NOW()),
           NOW()
      FROM player_contracts pc
      JOIN players p ON p.id = pc.user_id
     WHERE pc.status = 'active'
       AND IFNULL(pc.contract_type, '') <> 'ownership'
       AND NOT EXISTS (
         SELECT 1
           FROM club_memberships cm
          WHERE cm.club_id = pc.team_id
            AND cm.player_id = p.id
            AND cm.status = 'active'
       )
  `).catch(err => console.error('[migration] active_contract_membership_backfill:', err.message));

  await EXECUTESQL(`
    UPDATE players p
    JOIN player_contracts pc ON pc.user_id = p.id AND pc.team_id = p.club_id
    LEFT JOIN player_contracts active_pc
      ON active_pc.user_id = p.id
     AND active_pc.team_id = p.club_id
     AND active_pc.status = 'active'
    LEFT JOIN club_staff_roles csr
      ON csr.player_id = p.id
     AND csr.club_id = p.club_id
    SET p.club_id = NULL,
        p.role = 'member',
        p.club_roles = JSON_ARRAY('member'),
        p.status = 'free_agent',
        p.updated_date = NOW()
    WHERE pc.status IN ('pending', 'pending_window', 'negotiating')
      AND IFNULL(pc.contract_type, '') <> 'ownership'
      AND active_pc.id IS NULL
      AND csr.id IS NULL
  `).catch(err => console.error('[migration] pending_contract_membership_cleanup:', err.message));

  await EXECUTESQL(`
    UPDATE players p
    LEFT JOIN clubs c ON c.id = p.club_id
    LEFT JOIN player_contracts owner_pc
      ON owner_pc.user_id = p.id
     AND owner_pc.team_id = p.club_id
     AND owner_pc.contract_type = 'ownership'
     AND owner_pc.status = 'active'
    LEFT JOIN club_staff_roles president_role
      ON president_role.player_id = p.id
     AND president_role.club_id = p.club_id
     AND president_role.role = 'president'
    SET p.role = 'member',
        p.club_roles = JSON_ARRAY('member'),
        p.updated_date = NOW()
    WHERE (p.role = 'president' OR JSON_CONTAINS(p.club_roles, JSON_QUOTE('president')))
      AND (
        c.id IS NULL
        OR (
          NOT (LOWER(TRIM(IFNULL(p.email, ''))) = LOWER(TRIM(IFNULL(c.owner_email, '')))
               OR (p.user_id IS NOT NULL AND p.user_id = c.user_id))
          AND owner_pc.id IS NULL
          AND president_role.id IS NULL
        )
      )
  `).catch(err => console.error('[migration] invalid_president_role_cleanup:', err.message));

  await EXECUTESQL(`
    UPDATE player_contracts pc
    JOIN clubs c ON c.id = pc.team_id
    LEFT JOIN players p ON p.id = pc.user_id
       SET pc.status = 'cancelled',
           pc.start_date = NULL,
           pc.end_date = NULL
     WHERE pc.status IN ('pending', 'pending_window', 'negotiating')
       AND LOWER(TRIM(c.name)) IN ('fc longue vie', 'longue vie fc')
       AND (
         LOWER(TRIM(IFNULL(p.gamertag, ''))) = 'callmewes'
         OR LOWER(TRIM(IFNULL(p.email, ''))) LIKE '%callmewes%'
         OR p.id IS NULL
       )
  `).catch(err => console.error('[migration] cancel_callmewes_pending_offer:', err.message));

  await EXECUTESQL(`
    UPDATE inbox_messages im
    JOIN player_contracts pc ON pc.id = im.related_entity_id
    JOIN clubs c ON c.id = pc.team_id
       SET im.status = 'cancelled',
           im.is_read = 1
     WHERE im.message_type = 'contract_offer'
       AND pc.status = 'cancelled'
       AND LOWER(TRIM(c.name)) IN ('fc longue vie', 'longue vie fc')
  `).catch(err => console.error('[migration] cancel_callmewes_pending_inbox:', err.message));

  await EXECUTESQL(`
    UPDATE notifications n
    JOIN player_contracts pc ON pc.id = n.related_id
    JOIN clubs c ON c.id = pc.team_id
       SET n.\`read\` = 1
     WHERE n.type = 'contract_offer'
       AND pc.status = 'cancelled'
       AND LOWER(TRIM(c.name)) IN ('fc longue vie', 'longue vie fc')
  `).catch(err => console.error('[migration] cancel_callmewes_pending_notification:', err.message));

  await EXECUTESQL(`
    UPDATE inbox_messages im
    JOIN player_contracts pc ON pc.id = im.related_entity_id
    JOIN players p ON p.id = pc.user_id
    LEFT JOIN users u ON u.id = p.user_id OR u.player_id = p.id
       SET im.recipient_email = LOWER(TRIM(COALESCE(NULLIF(p.email, ''), NULLIF(u.email, '')))),
           im.status = 'pending',
           im.is_read = 0,
           im.idempotency_key = COALESCE(
             im.idempotency_key,
             CONCAT('contract_offer:player_contract:', pc.id, ':', LOWER(TRIM(COALESCE(NULLIF(p.email, ''), NULLIF(u.email, '')))))
           )
     WHERE im.message_type = 'contract_offer'
       AND pc.status IN ('pending', 'pending_window', 'negotiating')
       AND COALESCE(NULLIF(p.email, ''), NULLIF(u.email, '')) IS NOT NULL
       AND (
         LOWER(TRIM(IFNULL(im.recipient_email, ''))) <> LOWER(TRIM(COALESCE(NULLIF(p.email, ''), NULLIF(u.email, ''))))
         OR im.idempotency_key IS NULL
       )
  `).catch(err => console.error('[migration] repair_contract_inbox_recipient:', err.message));

  await EXECUTESQL(`
    UPDATE notifications n
    JOIN player_contracts pc ON pc.id = n.related_id
    JOIN players p ON p.id = pc.user_id
    LEFT JOIN users u ON u.id = p.user_id OR u.player_id = p.id
    JOIN inbox_messages im ON im.related_entity_id = pc.id AND im.message_type = 'contract_offer'
       SET n.recipient_email = LOWER(TRIM(COALESCE(NULLIF(p.email, ''), NULLIF(u.email, '')))),
           n.\`read\` = 0,
           n.related_id = im.id,
           n.link = CONCAT('/inbox?id=', im.id),
           n.idempotency_key = COALESCE(
             n.idempotency_key,
             CONCAT('notification:contract_offer:player_contract:', pc.id, ':', LOWER(TRIM(COALESCE(NULLIF(p.email, ''), NULLIF(u.email, '')))))
           )
     WHERE n.type = 'contract_offer'
       AND pc.status IN ('pending', 'pending_window', 'negotiating')
       AND COALESCE(NULLIF(p.email, ''), NULLIF(u.email, '')) IS NOT NULL
       AND (
         LOWER(TRIM(IFNULL(n.recipient_email, ''))) <> LOWER(TRIM(COALESCE(NULLIF(p.email, ''), NULLIF(u.email, ''))))
         OR n.related_id <> im.id
         OR n.link <> CONCAT('/inbox?id=', im.id)
         OR n.idempotency_key IS NULL
       )
  `).catch(err => console.error('[migration] repair_contract_notification_recipient:', err.message));

  await EXECUTESQL(`
    INSERT INTO inbox_messages
      (id, recipient_email, sender_email, sender_gamertag, sender_avatar_url, sender_club_name,
       subject, body, message_type, action_type, status, is_read, is_system, metadata,
       related_entity_id, related_entity_type, idempotency_key, created_date)
    SELECT UUID(),
           LOWER(TRIM(COALESCE(p.email, u.email))),
           COALESCE(c.owner_email, 'system@stage.com'),
           COALESCE(c.name, 'Club Management'),
           COALESCE(c.logo_url, ''),
           COALESCE(c.name, ''),
           CONCAT('Contract Offer from ', COALESCE(c.name, 'Club')),
           CONCAT(
             COALESCE(c.name, 'A club'), ' has sent you a ', REPLACE(COALESCE(pc.contract_type, 'squad'), '_', ' '), ' contract offer.\\n\\n',
             'Duration: ', COALESCE(pc.max_games, 0), ' games / ', COALESCE(pc.max_days, 0), ' days\\n',
             'Weekly Salary: ', COALESCE(pc.weekly_salary_stc, 0), ' STC / week\\n',
             'Signing Bonus: ', COALESCE(pc.signing_bonus_stc, 0), ' STC\\n\\n',
             'Please respond using the buttons below. You can accept the offer, send a counter-offer, or decline it.'
           ),
           'contract_offer',
           'contract_negotiation',
           'pending',
           0,
           0,
           JSON_OBJECT('contract_id', pc.id, 'club_id', pc.team_id, 'club_name', c.name, 'contract_type', pc.contract_type),
           pc.id,
           'player_contract',
           CONCAT('contract_offer:player_contract:', pc.id, ':', LOWER(TRIM(COALESCE(p.email, u.email)))),
           NOW()
      FROM player_contracts pc
      JOIN players p ON p.id = pc.user_id
      LEFT JOIN users u ON u.player_id = p.id OR u.id = p.user_id
      LEFT JOIN clubs c ON c.id = pc.team_id
     WHERE pc.status IN ('pending', 'pending_window', 'negotiating')
       AND COALESCE(p.email, u.email) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM inbox_messages im
          WHERE im.related_entity_id = pc.id
            AND im.message_type = 'contract_offer'
       )
  `).catch(err => console.error('[migration] missing_contract_inbox_delivery:', err.message));

  await EXECUTESQL(`
    UPDATE notifications n
    JOIN player_contracts pc ON pc.id = n.related_id
    JOIN players p ON p.id = pc.user_id
    LEFT JOIN users u ON u.id = p.user_id OR u.player_id = p.id
    JOIN inbox_messages im ON im.related_entity_id = pc.id AND im.message_type = 'contract_offer'
       SET n.recipient_email = LOWER(TRIM(COALESCE(NULLIF(p.email, ''), NULLIF(u.email, '')))),
           n.\`read\` = 0,
           n.related_id = im.id,
           n.link = CONCAT('/inbox?id=', im.id),
           n.idempotency_key = COALESCE(
             n.idempotency_key,
             CONCAT('notification:contract_offer:player_contract:', pc.id, ':', LOWER(TRIM(COALESCE(NULLIF(p.email, ''), NULLIF(u.email, '')))))
           )
     WHERE n.type = 'contract_offer'
       AND pc.status IN ('pending', 'pending_window', 'negotiating')
       AND COALESCE(NULLIF(p.email, ''), NULLIF(u.email, '')) IS NOT NULL
  `).catch(err => console.error('[migration] repair_contract_notification_inbox_link:', err.message));

  await EXECUTESQL(`
    INSERT INTO notifications
      (id, recipient_email, type, title, body, \`read\`, link, related_id, idempotency_key, created_date)
    SELECT UUID(),
           LOWER(TRIM(COALESCE(p.email, u.email))),
           'contract_offer',
           CONCAT('Contract Offer from ', COALESCE(c.name, 'Club')),
           CONCAT(COALESCE(c.name, 'A club'), ' has sent you a ', COALESCE(pc.contract_type, 'squad'), ' contract offer.'),
           0,
           CONCAT('/inbox?id=', im.id),
           im.id,
           CONCAT('notification:contract_offer:player_contract:', pc.id, ':', LOWER(TRIM(COALESCE(p.email, u.email)))),
           NOW()
      FROM player_contracts pc
      JOIN players p ON p.id = pc.user_id
      LEFT JOIN users u ON u.player_id = p.id OR u.id = p.user_id
      LEFT JOIN clubs c ON c.id = pc.team_id
      JOIN inbox_messages im ON im.related_entity_id = pc.id AND im.message_type = 'contract_offer'
     WHERE pc.status IN ('pending', 'pending_window', 'negotiating')
       AND COALESCE(p.email, u.email) IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM notifications n
          WHERE n.type = 'contract_offer'
            AND (n.related_id = im.id OR n.related_id = pc.id)
       )
  `).catch(err => console.error('[migration] missing_contract_notification_delivery:', err.message));

  // Salary tracking on contracts
  await addCol('player_contracts', 'last_salary_paid_at', 'DATETIME NULL');

  // Lifestyle items expanded schema (v2)
  await addCol('lifestyle_items', 'category',                    "VARCHAR(50) DEFAULT 'fashion'");
  await addCol('lifestyle_items', 'subcategory',                 'VARCHAR(100)');
  await addCol('lifestyle_items', 'description',                 'TEXT');
  await addCol('lifestyle_items', 'image_url',                   'VARCHAR(500)');
  await addCol('lifestyle_items', 'tier',                        "VARCHAR(50) DEFAULT 'standard'");
  await addCol('lifestyle_items', 'price_stc',                   'BIGINT DEFAULT 0');
  await addCol('lifestyle_items', 'rent_price_stc',              'BIGINT DEFAULT 0');
  await addCol('lifestyle_items', 'rent_duration_days',          'INT DEFAULT 30');
  await addCol('lifestyle_items', 'invest_price_stc',            'BIGINT DEFAULT 0');
  await addCol('lifestyle_items', 'invest_return_rate',          'DECIMAL(5,2) DEFAULT 0');
  await addCol('lifestyle_items', 'invest_duration_days',        'INT DEFAULT 30');
  await addCol('lifestyle_items', 'passive_income_stc',          'BIGINT DEFAULT 0');
  await addCol('lifestyle_items', 'passive_income_interval_days','INT DEFAULT 7');
  await addCol('lifestyle_items', 'weekly_maintenance_stc',      'BIGINT DEFAULT 0');
  await addCol('lifestyle_items', 'max_upgrade_level',           'INT DEFAULT 0');
  await addCol('lifestyle_items', 'upgrade_base_cost_stc',       'BIGINT DEFAULT 0');
  await addCol('lifestyle_items', 'can_buy',                     'TINYINT(1) DEFAULT 1');
  await addCol('lifestyle_items', 'can_rent',                    'TINYINT(1) DEFAULT 0');
  await addCol('lifestyle_items', 'can_invest',                  'TINYINT(1) DEFAULT 0');
  await addCol('lifestyle_items', 'can_sell',                    'TINYINT(1) DEFAULT 1');
  await addCol('lifestyle_items', 'sell_value_percent',          'INT DEFAULT 60');
  await addCol('lifestyle_items', 'allows_multiple',             'TINYINT(1) DEFAULT 1');
  await addCol('lifestyle_items', 'emoji',                       "VARCHAR(10) DEFAULT ''");
  await addCol('lifestyle_items', 'available_cities',            'JSON NULL');

  // Club finance: enrich stc_transactions
  await addCol('stc_transactions', 'category',      'VARCHAR(100)');
  await addCol('stc_transactions', 'balance_after',  'DECIMAL(12,2)');
  // Legacy schema had NOT NULL; player-only rows omit club_id; account purge nulls or removes club refs.
  await EXECUTESQL(
    'ALTER TABLE stc_transactions MODIFY COLUMN club_id VARCHAR(36) NULL'
  ).catch((err) => console.error('[migration] stc_transactions.club_id nullable:', err.message));

  // Player market value system (v1)
  await addCol('players', 'market_value_stc',  'BIGINT DEFAULT 250000');
  await addCol('players', 'matches_played',    'INT DEFAULT 0');
  await addCol('players', 'avg_match_rating',  'DECIMAL(4,2) DEFAULT 0');
  await addCol('players', 'wins_count',        'INT DEFAULT 0');
  await addCol('players', 'man_of_the_match',  'INT DEFAULT 0');
  await addCol('players', 'clean_sheets',      'INT DEFAULT 0');
  await addCol('players', 'form_last10',       'TEXT NULL');
  await addCol('players', 'value_updated_at',  'DATETIME NULL');

  // Market value config table
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS market_value_config (
    id            VARCHAR(36)  PRIMARY KEY,
    name          VARCHAR(100) DEFAULT 'default',
    weights       JSON,
    is_active     TINYINT(1)   DEFAULT 1,
    created_date  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] market_value_config:', err.message));

  // Seed default config if none exists
  const cfgCount = await EXECUTESQL('SELECT COUNT(*) as n FROM market_value_config', []).catch(() => [{ n: 1 }]);
  if (Number(cfgCount[0]?.n || 0) === 0) {
    const { v4: _uuid } = require('uuid');
    const defaultWeights = {
      base_per_match: 60000,
      max_base: 8000000,
      goal_rate_bonus: 2000000,
      assist_rate_bonus: 1000000,
      clean_sheet_rate_bonus: 2500000,
      motm_bonus: 300000,
      consistency_boost: 0.15,
      form_boost: 0.20,
      form_penalty: 0.12,
      win_rate_boost: 0.10,
      ovr_weight: 0.08,
      spike_cap_up: 0.50,
      spike_cap_down: 0.35,
    };
    await EXECUTESQL(
      "INSERT INTO market_value_config (id, name, weights, is_active) VALUES (?, 'default', ?, 1)",
      [_uuid(), JSON.stringify(defaultWeights)]
    ).catch(() => {});
  }

  // Shirt sales system (v2) — aggregated per-player-per-match records
  await addCol('shirt_sales', 'match_id', 'VARCHAR(36) NULL');
  await addCol('shirt_sales', 'quantity', 'INT DEFAULT 1');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS shirt_sales_config (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) DEFAULT 'default',
    weights       JSON,
    is_active     TINYINT(1) DEFAULT 1,
    created_date  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] shirt_sales_config:', err.message));

  const shirtCfgCount = await EXECUTESQL('SELECT COUNT(*) as n FROM shirt_sales_config', []).catch(() => [{ n: 1 }]);
  if (Number(shirtCfgCount[0]?.n || 0) === 0) {
    await EXECUTESQL(
      "INSERT INTO shirt_sales_config (name, weights, is_active) VALUES ('default', ?, 1)",
      [JSON.stringify({
        base_per_mv_1m: 0.5, goal_demand: 4, assist_demand: 2,
        rating_demand_per_point: 1.5, motm_demand: 6, clean_sheet_demand: 2,
        form_influence: 0.12, contract_boost: 0.10, max_per_match: 12,
        price_base: 3000, price_per_ovr_above_70: 800,
        price_per_goal: 300, price_per_assist: 200, price_per_rating_point: 1500,
      })]
    ).catch(() => {});
  }

  // Stadium economy — match-level ticket data + stadium name on clubs
  await addCol('clubs',   'stadium_name',           'VARCHAR(150) NULL');
  await addCol('matches', 'home_ticket_revenue',     'DECIMAL(12,2) DEFAULT 0');
  await addCol('matches', 'home_ticket_attendance',  'INT DEFAULT 0');
  await addCol('matches', 'home_ticket_capacity',    'INT DEFAULT 0');
  await addCol('matches', 'home_ticket_price',       'DECIMAL(8,2) DEFAULT 0');
  await addCol('matches', 'home_ticket_pct',         'TINYINT DEFAULT 0');

  // Stadium config table — admin-configurable tier values
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS stadium_config (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    level            INT NOT NULL UNIQUE,
    name             VARCHAR(100),
    capacity         INT DEFAULT 5000,
    ticket_price_stc DECIMAL(8,2) DEFAULT 15,
    upgrade_cost_stc BIGINT DEFAULT 0,
    max_wage_budget_stc DECIMAL(12,2) DEFAULT 250000,
    max_transfer_budget_stc DECIMAL(12,2) DEFAULT 1000000,
    monthly_maintenance_stc DECIMAL(12,2) DEFAULT 50000,
    description      TEXT,
    updated_date     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] stadium_config:', err.message));
  await addCol('stadium_config', 'max_wage_budget_stc', 'DECIMAL(12,2) DEFAULT 250000');
  await addCol('stadium_config', 'max_transfer_budget_stc', 'DECIMAL(12,2) DEFAULT 1000000');
  await addCol('stadium_config', 'monthly_maintenance_stc', 'DECIMAL(12,2) DEFAULT 50000');

  const stadiumCfgCount = await EXECUTESQL('SELECT COUNT(*) as n FROM stadium_config', []).catch(() => [{ n: 1 }]);
  if (Number(stadiumCfgCount[0]?.n || 0) === 0) {
    const defaults = [
      [0, 'Local Ground',  5000,  15,  0,         250000,  1000000,  50000,   'A humble but passionate home ground. Every great club starts somewhere.'],
      [1, 'Pro Stadium',   20000, 50,  50000000,  800000,  5000000,  200000,  'Professional-grade facilities. The home ground for serious clubs.'],
      [2, 'Elite Ground',  45000, 130, 120000000, 1800000, 12000000, 600000,  'State-of-the-art stadium. Champions League ready.'],
      [3, 'Iconic Arena',  80000, 180, 250000000, 4000000, 30000000, 1500000, 'A legendary venue. The world\'s eyes are on you.'],
    ];
    for (const [level, name, capacity, price, cost, maxWage, maxTransfer, maintenance, desc] of defaults) {
      await EXECUTESQL(
        `INSERT IGNORE INTO stadium_config
         (level, name, capacity, ticket_price_stc, upgrade_cost_stc, max_wage_budget_stc, max_transfer_budget_stc, monthly_maintenance_stc, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [level, name, capacity, price, cost, maxWage, maxTransfer, maintenance, desc]
      ).catch(() => {});
    }
  }
  await EXECUTESQL(`
    UPDATE stadium_config
    SET
      max_wage_budget_stc = CASE level
        WHEN 0 THEN 250000 WHEN 1 THEN 800000 WHEN 2 THEN 1800000 WHEN 3 THEN 4000000
        ELSE max_wage_budget_stc
      END,
      max_transfer_budget_stc = CASE level
        WHEN 0 THEN 1000000 WHEN 1 THEN 5000000 WHEN 2 THEN 12000000 WHEN 3 THEN 30000000
        ELSE max_transfer_budget_stc
      END,
      monthly_maintenance_stc = CASE level
        WHEN 0 THEN 50000 WHEN 1 THEN 200000 WHEN 2 THEN 600000 WHEN 3 THEN 1500000
        ELSE monthly_maintenance_stc
      END,
      capacity = CASE level
        WHEN 0 THEN 5000 WHEN 1 THEN 20000 WHEN 2 THEN 45000 WHEN 3 THEN 80000
        ELSE capacity
      END
    WHERE level IN (0,1,2,3)
  `).catch(err => console.error('[migration] stadium finance defaults:', err.message));

  // Competition & league entity store (single flexible table for all league/comp entities)
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS league_entities (
    id               VARCHAR(36)  NOT NULL PRIMARY KEY,
    entity_type      VARCHAR(50)  NOT NULL,
    data_json        MEDIUMTEXT,
    status           VARCHAR(50)  DEFAULT NULL,
    scheduling_status VARCHAR(50) DEFAULT NULL,
    slug             VARCHAR(100) DEFAULT NULL,
    league_id        VARCHAR(36)  DEFAULT NULL,
    season_id        VARCHAR(36)  DEFAULT NULL,
    competition_id   VARCHAR(36)  DEFAULT NULL,
    club_id          VARCHAR(36)  DEFAULT NULL,
    is_active        TINYINT(1)   DEFAULT NULL,
    tier             INT          DEFAULT NULL,
    division         INT          DEFAULT NULL,
    region           VARCHAR(100) DEFAULT NULL,
    platform         VARCHAR(50)  DEFAULT NULL,
    season_number    INT          DEFAULT NULL,
    created_date     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_le_type        (entity_type),
    INDEX idx_le_type_status (entity_type, status),
    INDEX idx_le_slug        (entity_type, slug),
    INDEX idx_le_league      (entity_type, league_id),
    INDEX idx_le_season      (entity_type, season_id),
    INDEX idx_le_comp        (entity_type, competition_id)
  )`).catch(() => {});

  // Admin audit log
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS admin_audit_log (
    id          VARCHAR(36) PRIMARY KEY,
    admin_user_id VARCHAR(36),
    admin_email VARCHAR(255),
    action      VARCHAR(100),
    entity_type VARCHAR(50),
    entity_id   VARCHAR(36),
    entity_name VARCHAR(255),
    old_value   TEXT,
    new_value   TEXT,
    reason      TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_aal_entity  (entity_type, entity_id),
    INDEX idx_aal_admin   (admin_user_id),
    INDEX idx_aal_created (created_date)
  )`).catch(() => {});

  // Pre-login landing page config table
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS landing_config (
    id               VARCHAR(36)  NOT NULL PRIMARY KEY,
    hero_title       VARCHAR(255) NULL,
    hero_description TEXT         NULL,
    hero_image_url   VARCHAR(500) NULL,
    hero_image_position VARCHAR(50) NULL,
    hero_image_zoom  INT          NULL,
    stats_json       TEXT         NULL,
    section1_tag     VARCHAR(100) NULL,
    section1_title   VARCHAR(255) NULL,
    section1_text    TEXT         NULL,
    section1_image_url VARCHAR(500) NULL,
    section1_image_position VARCHAR(50) NULL,
    section1_image_zoom INT          NULL,
    section2_tag     VARCHAR(100) NULL,
    section2_title   VARCHAR(255) NULL,
    section2_text    TEXT         NULL,
    section2_image_url VARCHAR(500) NULL,
    section2_image_position VARCHAR(50) NULL,
    section2_image_zoom INT          NULL,
    section3_tag     VARCHAR(100) NULL,
    section3_title   VARCHAR(255) NULL,
    section3_text    TEXT         NULL,
    section3_image_url VARCHAR(500) NULL,
    section3_image_position VARCHAR(50) NULL,
    section3_image_zoom INT          NULL,
    footer_tagline   VARCHAR(255) NULL,
    created_date     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date     DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] landing_config:', err.message));

  // Landing page content — extra fields for dynamic sections
  await addCol('landing_page_contents', 'stats_json',   'TEXT NULL');
  await addCol('landing_page_contents', 'section1_tag', 'VARCHAR(100) NULL');
  await addCol('landing_page_contents', 'section2_tag', 'VARCHAR(100) NULL');
  await addCol('landing_page_contents', 'section3_tag', 'VARCHAR(100) NULL');

  // Home page content — post-login home page editor (HomePageEditor.jsx)
  // Kept separate from landing_page_contents so the two pages can be edited independently.
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS home_page_contents (
    id                 VARCHAR(64)  PRIMARY KEY,
    hero_title         VARCHAR(255) NULL,
    hero_subtitle      VARCHAR(255) NULL,
    hero_description   TEXT         NULL,
    hero_image_url     VARCHAR(500) NULL,
    hero_image_position VARCHAR(50) NULL,
    hero_image_zoom    INT          NULL,
    hero_cta_1_label   VARCHAR(255) NULL,
    hero_cta_1_url     VARCHAR(500) NULL,
    hero_cta_2_label   VARCHAR(255) NULL,
    hero_cta_2_url     VARCHAR(500) NULL,
    hero_cta_3_label   VARCHAR(255) NULL,
    hero_cta_3_url     VARCHAR(500) NULL,
    section1_title     VARCHAR(255) NULL,
    section1_text      TEXT         NULL,
    section1_image_url VARCHAR(500) NULL,
    section1_image_position VARCHAR(50) NULL,
    section1_image_zoom INT          NULL,
    section2_title     VARCHAR(255) NULL,
    section2_text      TEXT         NULL,
    section2_image_url VARCHAR(500) NULL,
    section2_image_position VARCHAR(50) NULL,
    section2_image_zoom INT          NULL,
    section3_title     VARCHAR(255) NULL,
    section3_text      TEXT         NULL,
    section3_image_url VARCHAR(500) NULL,
    section3_image_position VARCHAR(50) NULL,
    section3_image_zoom INT          NULL,
    faq_items          LONGTEXT     NULL,
    contact_email      VARCHAR(255) NULL,
    footer_tagline     TEXT         NULL,
    created_date       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] home_page_contents:', err.message));
  await addCol('home_page_contents', 'hero_image_position', 'VARCHAR(50) NULL');
  await addCol('home_page_contents', 'hero_image_zoom', 'INT NULL');
  await addCol('home_page_contents', 'section1_image_position', 'VARCHAR(50) NULL');
  await addCol('home_page_contents', 'section1_image_zoom', 'INT NULL');
  await addCol('home_page_contents', 'section2_image_position', 'VARCHAR(50) NULL');
  await addCol('home_page_contents', 'section2_image_zoom', 'INT NULL');
  await addCol('home_page_contents', 'section3_image_position', 'VARCHAR(50) NULL');
  await addCol('home_page_contents', 'section3_image_zoom', 'INT NULL');

  await addCol('landing_config', 'hero_image_position', 'VARCHAR(50) NULL');
  await addCol('landing_config', 'hero_image_zoom', 'INT NULL');
  await addCol('landing_config', 'section1_image_position', 'VARCHAR(50) NULL');
  await addCol('landing_config', 'section1_image_zoom', 'INT NULL');
  await addCol('landing_config', 'section2_image_position', 'VARCHAR(50) NULL');
  await addCol('landing_config', 'section2_image_zoom', 'INT NULL');
  await addCol('landing_config', 'section3_image_position', 'VARCHAR(50) NULL');
  await addCol('landing_config', 'section3_image_zoom', 'INT NULL');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS faq_items (
    id           VARCHAR(36)  NOT NULL PRIMARY KEY,
    question     VARCHAR(500) NOT NULL,
    answer       TEXT         NOT NULL,
    sort_order   INT          NOT NULL DEFAULT 0,
    is_active    TINYINT(1)   NOT NULL DEFAULT 1,
    created_date DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_faq_sort (sort_order),
    INDEX idx_faq_active (is_active)
  )`).catch(err => console.error('[migration] faq_items:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS store_configs (
    id                         VARCHAR(36)   NOT NULL PRIMARY KEY,
    name                       VARCHAR(100)  NULL,
    stage_plus_monthly_price   DECIMAL(10,2) NOT NULL DEFAULT 4.99,
    stage_plus_yearly_price    DECIMAL(10,2) NOT NULL DEFAULT 49.99,
    monthly_credits            INT           NOT NULL DEFAULT 150,
    starter_credits            INT           NOT NULL DEFAULT 50,
    tournament_entry_credits   INT           NOT NULL DEFAULT 50,
    community_tournament_limit INT           NOT NULL DEFAULT 0,
    headline                   VARCHAR(255)  NULL,
    description                TEXT          NULL,
    badge_image_url            VARCHAR(500)  NULL,
    perks                      JSON          NULL,
    is_active                  TINYINT(1)    NOT NULL DEFAULT 1,
    created_date               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_store_configs_active (is_active)
  )`).catch(err => console.error('[migration] store_configs:', err.message));
  await addCol('store_configs', 'badge_image_url', 'VARCHAR(500) NULL');
  await EXECUTESQL("UPDATE store_configs SET badge_image_url = '/uploads/stage-plus-badge.png' WHERE badge_image_url IS NULL OR badge_image_url = ''")
    .catch(err => console.error('[migration] store_configs badge_image_url:', err.message));
  await EXECUTESQL(
    `UPDATE store_configs
        SET stage_plus_monthly_price = 4.99,
            stage_plus_yearly_price = 49.99,
            monthly_credits = 150,
            starter_credits = 50,
            tournament_entry_credits = 50,
            community_tournament_limit = 0,
            headline = 'One membership for serious competitors',
            description = 'STAGE Plus unlocks official competitions, community tournament creation, full rankings, full stats, and a monthly credit refresh.',
            perks = JSON_ARRAY(
              '150 credits refreshed every month',
              'Enter official STAGE competitions and regional leagues',
              'Create community tournaments',
              'Ranked player and club tournament access',
              'Full rankings and position rankings',
              'Full player and club stats',
              'Advanced recruitment and search filters'
            )
      WHERE id = 'store-stage-plus-default'
         OR is_active = 1`
  ).catch(err => console.error('[migration] store_configs stage_plus_policy:', err.message));

  const storeConfigCount = await EXECUTESQL('SELECT COUNT(*) AS n FROM store_configs', []).catch(() => [{ n: 1 }]);
  if (Number(storeConfigCount[0]?.n || 0) === 0) {
    await EXECUTESQL(
      `INSERT INTO store_configs
         (id, name, stage_plus_monthly_price, stage_plus_yearly_price, monthly_credits,
          starter_credits, tournament_entry_credits, community_tournament_limit, headline,
          description, badge_image_url, perks, is_active, created_date, updated_date)
       VALUES
         ('store-stage-plus-default', 'STAGE Plus', 4.99, 49.99, 150, 50, 50, 0,
          'One membership for serious competitors',
          'STAGE Plus unlocks official competitions, community tournament creation, full rankings, full stats, and a monthly credit refresh.',
          '/uploads/stage-plus-badge.png',
          JSON_ARRAY('150 credits refreshed every month','Enter official STAGE competitions and regional leagues','Create community tournaments','Ranked player and club tournament access','Full rankings and position rankings','Full player and club stats','Advanced recruitment and search filters'),
          1, NOW(), NOW())`,
      []
    ).catch(err => console.error('[migration] store_configs seed:', err.message));
  }

  const faqCount = await EXECUTESQL('SELECT COUNT(*) AS n FROM faq_items', []).catch(() => [{ n: 1 }]);
  if (Number(faqCount[0]?.n) === 0) {
    const seed = [
      {
        id: 'faq-seed-join-stage',
        question: 'How do I join STAGE?',
        answer: 'Create your account, complete your player profile, and either create a club or join an existing one. From there you can register for leagues and competitions.',
        sort_order: 1,
      },
      {
        id: 'faq-seed-game',
        question: 'What game does STAGE support?',
        answer: 'STAGE is built around EA FC (formerly FIFA). We support all major platforms including PlayStation and Xbox.',
        sort_order: 2,
      },
      {
        id: 'faq-seed-leagues',
        question: 'How do leagues and competitions work?',
        answer: 'Leagues are seasonal competitions where clubs compete over multiple rounds. Competitions include knockout-style cups. Results are tracked and standings update in real time.',
        sort_order: 3,
      },
      {
        id: 'faq-seed-stc',
        question: 'What are STC points?',
        answer: 'STC (STAGE Coins) are the platform currency. Earn them through match rewards, seasonal prizes, and achievements. Use them in the Lifestyle store or on premium features.',
        sort_order: 4,
      },
      {
        id: 'faq-seed-free',
        question: 'Is STAGE free to use?',
        answer: 'Yes — STAGE is free to join. Some premium features and store items require STC, which can be earned through gameplay.',
        sort_order: 5,
      },
    ];
    for (const row of seed) {
      await EXECUTESQL(
        `INSERT INTO faq_items (id, question, answer, sort_order, is_active)
         VALUES (?,?,?,?,1)`,
        [row.id, row.question, row.answer, row.sort_order]
      ).catch(err => console.error('[migration] faq_items seed:', err.message));
    }
    console.log('[migration] faq_items: seeded default FAQ');
  }

  // Fixture admin actions — audit log for admin interventions on expired
  // fixtures (force schedule, forfeit declaration, flag for review). Each row
  // captures who did what, when, and on which fixture, with a JSON payload of
  // the action-specific parameters. See fixtureAdminActionController.js.
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS fixture_admin_actions (
    id                 VARCHAR(36)   NOT NULL PRIMARY KEY,
    fixture_id         VARCHAR(36)   NOT NULL,
    fixture_type       VARCHAR(30)   NOT NULL,
    action_type        VARCHAR(30)   NOT NULL,
    performed_by       VARCHAR(36)   NULL,
    performed_by_name  VARCHAR(150)  NULL,
    home_club_id       VARCHAR(36)   NULL,
    away_club_id       VARCHAR(36)   NULL,
    payload            LONGTEXT      NULL,
    admin_note         TEXT          NULL,
    created_date       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_fixture (fixture_id),
    INDEX idx_action (action_type),
    INDEX idx_performed_by (performed_by),
    INDEX idx_created (created_date)
  )`).catch(err => console.error('[migration] fixture_admin_actions:', err.message));

  // Trophy items table
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS trophy_items (
    id               VARCHAR(36)   NOT NULL PRIMARY KEY,
    name             VARCHAR(255)  NOT NULL,
    description      TEXT          NULL,
    image_url        TEXT          NULL,
    competition_name VARCHAR(255)  NULL,
    tournament_id    VARCHAR(36)   NULL,
    tournament_type  VARCHAR(100)  NULL,
    is_official      TINYINT(1)    DEFAULT 0,
    admin_only       TINYINT(1)    DEFAULT 0,
    rarity           VARCHAR(50)   DEFAULT 'common',
    sort_order       INT           DEFAULT 0,
    price            DECIMAL(12,2) DEFAULT 0,
    created_date     DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_date     DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`).catch(err => console.error('[migration] trophy_items:', err.message));
  // addCol guards for tables that existed before this migration was updated
  await addCol('trophy_items', 'description',      'TEXT NULL');
  await addCol('trophy_items', 'image_url',         'VARCHAR(500) NULL');
  await addCol('trophy_items', 'competition_name',  'VARCHAR(255) NULL');
  await addCol('trophy_items', 'tournament_id',     'VARCHAR(36) NULL');
  await addCol('trophy_items', 'tournament_type',   'VARCHAR(100) NULL');
  await addCol('trophy_items', 'is_official',       'TINYINT(1) DEFAULT 0');
  await addCol('trophy_items', 'admin_only',        'TINYINT(1) DEFAULT 0');
  await addCol('trophy_items', 'rarity',            "VARCHAR(50) DEFAULT 'common'");
  await addCol('trophy_items', 'sort_order',        'INT DEFAULT 0');
  await addCol('trophy_items', 'price',             'DECIMAL(12,2) DEFAULT 0');
  await addCol('trophy_items', 'created_date',      'DATETIME NULL DEFAULT CURRENT_TIMESTAMP');
  await addCol('trophy_items', 'updated_date',      'DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await addCol('trophy_items', 'linked_source_type', "VARCHAR(50) NULL");
  await addCol('trophy_items', 'linked_source_id',   "VARCHAR(36) NULL");
  await addCol('trophy_items', 'linked_source_name', "VARCHAR(255) NULL");
  // Legacy installs used VARCHAR(500) for image URLs; long CDN/signed URLs caused PATCH 500s.
  await EXECUTESQL(
    'ALTER TABLE trophy_items MODIFY COLUMN image_url TEXT NULL'
  ).catch((err) => console.error('[migration] trophy_items.image_url→TEXT:', err.message));

  // Trophy placements table
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS trophy_placements (
    id             VARCHAR(36)  NOT NULL PRIMARY KEY,
    owner_id       VARCHAR(36)  NULL,
    owner_type     VARCHAR(50)  NULL,
    trophy_item_id VARCHAR(36)  NULL,
    position       INT          DEFAULT 0,
    created_date   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tp_owner (owner_id, owner_type),
    INDEX idx_tp_item  (trophy_item_id)
  )`).catch(err => console.error('[migration] trophy_placements:', err.message));
  // Databases created from the original schema.sql predate these two columns, and
  // CREATE TABLE IF NOT EXISTS above is a no-op there — so queries ordering by
  // created_date failed on exactly those installs.
  await addCol('trophy_placements', 'created_date', 'DATETIME NULL DEFAULT CURRENT_TIMESTAMP');
  await addCol('trophy_placements', 'updated_date', 'DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
  await addCol('trophy_placements', 'trophy_image_url', 'TEXT NULL');
  await addCol('trophy_placements', 'trophy_name', 'VARCHAR(255) NULL');
  await addCol('trophy_placements', 'x_percent', 'DECIMAL(6,2) NULL DEFAULT 50');
  await addCol('trophy_placements', 'y_percent', 'DECIMAL(6,2) NULL DEFAULT 50');
  await addCol('trophy_placements', 'scale', 'DECIMAL(5,3) NULL DEFAULT 1');
  await addCol('trophy_placements', 'won_tournament_ids', 'JSON NULL');
  await addCol('trophy_placements', 'win_count', 'INT NULL DEFAULT 1');

  // Lifestyle purchases expanded schema (v2)
  await addCol('lifestyle_purchases', 'purchase_type',           "VARCHAR(20) DEFAULT 'buy'");
  await addCol('lifestyle_purchases', 'price_paid_stc',          'BIGINT DEFAULT 0');
  await addCol('lifestyle_purchases', 'rent_end_date',           'DATETIME NULL');
  await addCol('lifestyle_purchases', 'invest_end_date',         'DATETIME NULL');
  await addCol('lifestyle_purchases', 'invest_return_amount',    'BIGINT DEFAULT 0');
  await addCol('lifestyle_purchases', 'status',                  "VARCHAR(20) DEFAULT 'active'");
  await addCol('lifestyle_purchases', 'player_email',            'VARCHAR(255) NULL');
  await addCol('lifestyle_purchases', 'player_gamertag',         'VARCHAR(100) NULL');
  await addCol('lifestyle_purchases', 'item_name',               'VARCHAR(255) NULL');
  await addCol('lifestyle_purchases', 'item_category',           'VARCHAR(50) NULL');
  await addCol('lifestyle_purchases', 'item_subcategory',        'VARCHAR(100) NULL');
  await addCol('lifestyle_purchases', 'item_emoji',              'VARCHAR(10) NULL');
  await addCol('lifestyle_purchases', 'monthly_rent_stc',        'BIGINT DEFAULT 0');
  await addCol('lifestyle_purchases', 'location_city',           'VARCHAR(120) NULL');
  await addCol('lifestyle_purchases', 'location_country',        'VARCHAR(120) NULL');
  await addCol('lifestyle_purchases', 'location_emoji',          'VARCHAR(10) NULL');
  await addCol('lifestyle_purchases', 'custom_name',             'VARCHAR(255) NULL');
  await addCol('lifestyle_purchases', 'weekly_maintenance_stc',  'BIGINT DEFAULT 0');
  await addCol('lifestyle_purchases', 'last_rent_paid_at',       'DATETIME NULL');
  await addCol('lifestyle_purchases', 'last_passive_collected_at','DATETIME NULL');
  await addCol('lifestyle_purchases', 'last_maintenance_paid_at','DATETIME NULL');
  await addCol('lifestyle_purchases', 'is_defaulted',            'TINYINT(1) DEFAULT 0');
  await addCol('lifestyle_purchases', 'upgrade_slots',           'JSON NULL');
  await addCol('lifestyle_purchases', 'current_value_stc',       'BIGINT DEFAULT 0');
  await addCol('lifestyle_purchases', 'upgrade_level',           'INT DEFAULT 0');
  await addCol('lifestyle_purchases', 'last_passive_collected',  'DATETIME NULL');
  await addCol('lifestyle_purchases', 'base_upgrade_cost_stc',   'BIGINT DEFAULT 0');

  // news_items — feed rows (contracts, transfers, etc.); older DBs only had title/body/link.
  await addCol('news_items', 'type', "VARCHAR(30) NULL DEFAULT 'announcement'");
  await addCol('news_items', 'category', "VARCHAR(30) NULL DEFAULT 'general'");
  await addCol('news_items', 'image_url', 'TEXT NULL');
  await addCol('news_items', 'club_id', 'VARCHAR(36) NULL');
  await addCol('news_items', 'club_name', 'VARCHAR(100) NULL');
  await addCol('news_items', 'club_logo_url', 'TEXT NULL');
  await addCol('news_items', 'player_id', 'VARCHAR(36) NULL');
  await addCol('news_items', 'player_name', 'VARCHAR(100) NULL');
  await addCol('news_items', 'player_avatar_url', 'TEXT NULL');
  await addCol('news_items', 'tournament_id', 'VARCHAR(36) NULL');
  await addCol('news_items', 'tournament_name', 'VARCHAR(255) NULL');
  await addCol('news_items', 'is_featured', 'TINYINT(1) NULL DEFAULT 0');
  await addCol('news_items', 'is_global', 'TINYINT(1) NULL DEFAULT 0');
  await addCol('news_items', 'transfer_fee_stc', 'BIGINT NULL DEFAULT 0');
  await addCol('news_items', 'tags', 'JSON NULL');
  await addCol('news_items', 'visible_to_club_ids', 'JSON NULL');
  await addCol('news_items', 'visible_to_player_ids', 'JSON NULL');

  // ───────────────────────────────────────────────────────────────────────────
  //  EAFC-inspired modules: Daily/Weekly Objectives, Archetypes, Chemistry, SBC
  // ───────────────────────────────────────────────────────────────────────────

  // 1) Daily / Weekly Objectives — catalogue + per-player progress
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS objective_definitions (
    id            VARCHAR(36)  NOT NULL PRIMARY KEY,
    scope         VARCHAR(20)  NOT NULL DEFAULT 'daily',
    code          VARCHAR(100) NULL,
    title         VARCHAR(255) NOT NULL,
    description   TEXT         NULL,
    metric        VARCHAR(50)  NOT NULL,
    target_value  INT          NOT NULL DEFAULT 1,
    reward_stc    DECIMAL(12,2) DEFAULT 0,
    reward_xp     INT          DEFAULT 0,
    active_from   DATETIME     NULL,
    active_until  DATETIME     NULL,
    is_active     TINYINT(1)   DEFAULT 1,
    created_date  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_obj_scope_active (scope, is_active),
    INDEX idx_obj_metric (metric),
    INDEX idx_obj_code (code)
  )`).catch(err => console.error('[migration] objective_definitions:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS objective_progress (
    id            VARCHAR(36)  NOT NULL PRIMARY KEY,
    player_id     VARCHAR(36)  NOT NULL,
    player_email  VARCHAR(255) NULL,
    objective_id  VARCHAR(36)  NOT NULL,
    scope         VARCHAR(20)  NULL,
    current_value INT          DEFAULT 0,
    target_value  INT          NULL,
    completed_at  DATETIME     NULL,
    claimed_at    DATETIME     NULL,
    created_date  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_op_player_obj (player_id, objective_id),
    INDEX idx_op_player (player_id),
    INDEX idx_op_objective (objective_id),
    INDEX idx_op_unclaimed (player_id, completed_at, claimed_at)
  )`).catch(err => console.error('[migration] objective_progress:', err.message));

  // 2) Archetypes — catalogue + players.archetype column + sacrificed_at (used by SBC)
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS archetypes (
    id                    VARCHAR(36)  NOT NULL PRIMARY KEY,
    code                  VARCHAR(64)  NOT NULL UNIQUE,
    name                  VARCHAR(100) NOT NULL,
    position              VARCHAR(20)  NULL,
    description           TEXT         NULL,
    base_modifiers        JSON         NULL,
    signature_playstyles  JSON         NULL,
    icon_inspiration      VARCHAR(100) NULL,
    sort_order            INT          DEFAULT 0,
    is_active             TINYINT(1)   DEFAULT 1,
    created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_arch_position (position),
    INDEX idx_arch_active (is_active)
  )`).catch(err => console.error('[migration] archetypes:', err.message));

  await addCol('players', 'archetype', 'VARCHAR(64) NULL');
  await addCol('players', 'sacrificed_at', 'DATETIME NULL');

  // Seed default archetypes (only if empty) — 13 archetypes inspired by EAFC 26 Clubs Pro
  const archCount = await EXECUTESQL('SELECT COUNT(*) AS n FROM archetypes', []).catch(() => [{ n: 1 }]);
  if (Number(archCount[0]?.n || 0) === 0) {
    const { v4: _uuid } = require('uuid');
    const SEED = [
      ['poacher',       'Poacher',              'ST',  'Inzaghi',     'Penalty-box predator, lives off through-balls.',
        { shooting: 1.08, positioning: 1.10, pace: 1.04 }, ['Finesse Shot', 'Power Header']],
      ['target_man',    'Target Man',           'ST',  'Crouch',      'Aerial pivot who holds up play for runners.',
        { physical: 1.10, heading: 1.12, shooting: 1.05 }, ['Aerial Threat', 'Press Proven']],
      ['false_nine',    'False Nine',           'ST',  'Messi',       'Drops deep to dribble and create.',
        { dribbling: 1.08, passing: 1.07, agility: 1.05 }, ['Trickster', 'Incisive Pass']],
      ['speedster',     'Speedster',            'LW',  'Mbappé',      'Pure pace and direct running.',
        { pace: 1.12, dribbling: 1.05, shooting: 1.03 }, ['Quickstep', 'Rapid']],
      ['wing_wizard',   'Wing Wizard',          'RW',  'Ronaldinho',  'Trickster wide forward with flair.',
        { dribbling: 1.10, flair: 1.10, shooting: 1.04 }, ['Flair', 'Trivela', 'Trickster']],
      ['playmaker',     'Playmaker',            'CAM', 'Iniesta',     'Vision-led tempo controller.',
        { passing: 1.10, vision: 1.10, dribbling: 1.05 }, ['Incisive Pass', 'Tiki Taka']],
      ['box_to_box',    'Box-to-Box',           'CM',  'Vieira',      'Engine that covers both boxes.',
        { physical: 1.07, passing: 1.05, stamina: 1.10 }, ['Press Proven', 'Long Ball Pass']],
      ['deep_lying',    'Deep-Lying Playmaker', 'CDM', 'Pirlo',       'Deep conductor, long-range distribution.',
        { passing: 1.10, vision: 1.10, defending: 1.03 }, ['Long Ball Pass', 'Pinged Pass']],
      ['anchor',        'Anchor',               'CDM', 'Makelele',    'Defensive shield in front of the back four.',
        { defending: 1.10, physical: 1.08, interceptions: 1.10 }, ['Intercept', 'Block', 'Bruiser']],
      ['ball_player_cb','Ball-Playing CB',      'CB',  'Beckenbauer', 'CB comfortable bringing it out.',
        { defending: 1.05, passing: 1.08, composure: 1.10 }, ['Long Ball Pass', 'Anticipate']],
      ['stopper',       'Stopper',              'CB',  'Maldini',     'Old-school defender, wins his duels.',
        { defending: 1.12, heading: 1.10, physical: 1.06 }, ['Aerial Threat', 'Slide Tackle', 'Bruiser']],
      ['attacking_fb',  'Attacking Full-Back',  'LB',  'Cafu',        'Modern overlapping full-back.',
        { pace: 1.08, dribbling: 1.05, crossing: 1.08 }, ['Whipped Pass', 'Quickstep']],
      ['shot_stopper',  'Shot Stopper',         'GK',  'Buffon',      'Pure goalkeeping reflexes.',
        { reflexes: 1.12, diving: 1.08, handling: 1.05 }, ['Acrobatic', 'Far Throw']],
    ];
    let order = 0;
    for (const [code, name, position, icon, description, mods, playstyles] of SEED) {
      await EXECUTESQL(
        `INSERT IGNORE INTO archetypes
           (id, code, name, position, description, base_modifiers, signature_playstyles, icon_inspiration, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [_uuid(), code, name, position, description, JSON.stringify(mods), JSON.stringify(playstyles), icon, order++]
      ).catch(() => {});
    }
  }

  // 3) Chemistry links — pairwise relationships
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS chemistry_links (
    id            VARCHAR(36)  NOT NULL PRIMARY KEY,
    player_a_id   VARCHAR(36)  NOT NULL,
    player_b_id   VARCHAR(36)  NOT NULL,
    link_type     VARCHAR(30)  NOT NULL,
    bonus_factor  DECIMAL(4,3) DEFAULT 1.000,
    source        VARCHAR(100) NULL,
    description   VARCHAR(255) NULL,
    is_active     TINYINT(1)   DEFAULT 1,
    created_date  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_chem_pair_type (player_a_id, player_b_id, link_type),
    INDEX idx_chem_player_a (player_a_id),
    INDEX idx_chem_player_b (player_b_id),
    INDEX idx_chem_type (link_type)
  )`).catch(err => console.error('[migration] chemistry_links:', err.message));

  // 4) Squad Building Challenges + submissions
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS sbcs (
    id              VARCHAR(36)  NOT NULL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    description     TEXT         NULL,
    category        VARCHAR(50)  DEFAULT 'general',
    requirements    JSON         NULL,
    reward          JSON         NULL,
    image_url       VARCHAR(500) NULL,
    max_completions INT          NULL,
    expires_at      DATETIME     NULL,
    is_active       TINYINT(1)   DEFAULT 1,
    created_date    DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sbc_active (is_active, expires_at),
    INDEX idx_sbc_category (category)
  )`).catch(err => console.error('[migration] sbcs:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS sbc_submissions (
    id                    VARCHAR(36)  NOT NULL PRIMARY KEY,
    sbc_id                VARCHAR(36)  NOT NULL,
    player_id             VARCHAR(36)  NOT NULL,
    player_email          VARCHAR(255) NULL,
    player_gamertag       VARCHAR(150) NULL,
    club_id               VARCHAR(36)  NULL,
    sacrificed_player_ids JSON         NULL,
    reward_payload        JSON         NULL,
    stc_credited          DECIMAL(12,2) DEFAULT 0,
    status                VARCHAR(20)  DEFAULT 'pending',
    failure_reason        TEXT         NULL,
    submitted_at          DATETIME     NULL,
    completed_at          DATETIME     NULL,
    created_date          DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_date          DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_sbcsub_sbc (sbc_id),
    INDEX idx_sbcsub_player (player_id),
    INDEX idx_sbcsub_status (status, created_date)
  )`).catch(err => console.error('[migration] sbc_submissions:', err.message));

  // ── competition engine tables ──
  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS competition_instances (
    id                  VARCHAR(36) PRIMARY KEY,
    product_type        VARCHAR(50) NOT NULL,
    legacy_source_type  VARCHAR(50) NOT NULL,
    legacy_source_id    VARCHAR(36) NOT NULL,
    name                VARCHAR(150) NOT NULL,
    slug                VARCHAR(180),
    region              VARCHAR(80),
    platform            VARCHAR(50),
    status              VARCHAR(50) DEFAULT 'draft',
    starts_at           DATETIME,
    ends_at             DATETIME,
    created_by_user_id  VARCHAR(36),
    created_date        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_comp_instances_source (product_type, legacy_source_type, legacy_source_id),
    INDEX idx_comp_instances_status (product_type, status, starts_at),
    INDEX idx_comp_instances_region (region, platform, status)
  )`).catch((err) => console.error('[migration] competition_instances:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS competition_participants (
    id                       VARCHAR(36) PRIMARY KEY,
    competition_instance_id  VARCHAR(36) NOT NULL,
    participant_type         VARCHAR(20) NOT NULL,
    club_id                  VARCHAR(36),
    player_id                VARCHAR(36),
    user_id                  VARCHAR(36),
    status                   VARCHAR(50) DEFAULT 'pending',
    seed                     INT,
    registered_at            DATETIME,
    approved_at              DATETIME,
    created_date             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_comp_participant_club (competition_instance_id, participant_type, club_id),
    UNIQUE KEY uq_comp_participant_player (competition_instance_id, participant_type, player_id),
    INDEX idx_comp_participants_club (club_id, status),
    INDEX idx_comp_participants_player (player_id, status),
    INDEX idx_comp_participants_instance (competition_instance_id, status, seed)
  )`).catch((err) => console.error('[migration] competition_participants:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS competition_fixtures (
    id                       VARCHAR(36) PRIMARY KEY,
    competition_instance_id  VARCHAR(36) NOT NULL,
    legacy_fixture_type      VARCHAR(50),
    legacy_fixture_id        VARCHAR(36),
    match_id                 VARCHAR(36),
    participant_type         VARCHAR(20) NOT NULL,
    format                   VARCHAR(50),
    phase                    VARCHAR(50),
    round                    INT,
    matchday                 INT,
    group_number             INT,
    tie_id                   VARCHAR(36),
    leg                      INT,
    bracket_side             VARCHAR(20),
    home_participant_id      VARCHAR(36),
    away_participant_id      VARCHAR(36),
    home_club_id             VARCHAR(36),
    home_club_name           VARCHAR(150),
    home_owner_email         VARCHAR(255),
    away_club_id             VARCHAR(36),
    away_club_name           VARCHAR(150),
    away_owner_email         VARCHAR(255),
    player_home_id           VARCHAR(36),
    player_home_gamertag     VARCHAR(150),
    player_home_email        VARCHAR(255),
    player_away_id           VARCHAR(36),
    player_away_gamertag     VARCHAR(150),
    player_away_email        VARCHAR(255),
    status                   VARCHAR(50) DEFAULT 'unscheduled',
    scheduling_status        VARCHAR(50) DEFAULT 'open',
    window_start             DATETIME,
    window_end               DATETIME,
    scheduled_at             DATETIME,
    confirmed_at             DATETIME,
    home_score               INT,
    away_score               INT,
    winner_participant_id    VARCHAR(36),
    stats_processed          TINYINT(1) DEFAULT 0,
    idempotency_key          VARCHAR(190),
    created_date             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_comp_fixture_legacy (legacy_fixture_type, legacy_fixture_id),
    UNIQUE KEY uq_comp_fixture_match (match_id),
    UNIQUE KEY uq_comp_fixture_idempotency (idempotency_key),
    INDEX idx_comp_fixtures_schedule (competition_instance_id, status, scheduled_at),
    INDEX idx_comp_fixtures_round (competition_instance_id, phase, round, group_number),
    INDEX idx_comp_fixtures_home (home_participant_id, status),
    INDEX idx_comp_fixtures_away (away_participant_id, status),
    INDEX idx_comp_fixtures_window (scheduling_status, window_end)
  )`).catch((err) => console.error('[migration] competition_fixtures:', err.message));
  await addCol('competition_fixtures', 'home_owner_email', 'VARCHAR(255) NULL');
  await addCol('competition_fixtures', 'away_owner_email', 'VARCHAR(255) NULL');
  await addCol('competition_fixtures', 'player_home_id', 'VARCHAR(36) NULL');
  await addCol('competition_fixtures', 'player_home_gamertag', 'VARCHAR(150) NULL');
  await addCol('competition_fixtures', 'player_home_email', 'VARCHAR(255) NULL');
  await addCol('competition_fixtures', 'player_away_id', 'VARCHAR(36) NULL');
  await addCol('competition_fixtures', 'player_away_gamertag', 'VARCHAR(150) NULL');
  await addCol('competition_fixtures', 'player_away_email', 'VARCHAR(255) NULL');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS competition_schedule_proposals (
    id                         VARCHAR(36) PRIMARY KEY,
    fixture_id                 VARCHAR(36) NOT NULL,
    proposer_participant_id    VARCHAR(36),
    recipient_participant_id   VARCHAR(36),
    proposed_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
    proposed_for               DATETIME NOT NULL,
    status                     VARCHAR(50) DEFAULT 'pending',
    message_id                 VARCHAR(36),
    notification_id            VARCHAR(36),
    idempotency_key            VARCHAR(190),
    created_date               DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_comp_schedule_idempotency (idempotency_key),
    INDEX idx_comp_schedule_fixture (fixture_id, status, created_date),
    INDEX idx_comp_schedule_recipient (recipient_participant_id, status)
  )`).catch((err) => console.error('[migration] competition_schedule_proposals:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS competition_result_submissions (
    id                    VARCHAR(36) PRIMARY KEY,
    fixture_id            VARCHAR(36) NOT NULL,
    match_id              VARCHAR(36),
    side                  VARCHAR(10) NOT NULL,
    submitted_by_user_id  VARCHAR(36),
    score_home            INT NOT NULL,
    score_away            INT NOT NULL,
    payload_json          JSON,
    proof_url             VARCHAR(500),
    idempotency_key       VARCHAR(190),
    created_date          DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_comp_result_match_side (match_id, side),
    UNIQUE KEY uq_comp_result_fixture_side (fixture_id, side),
    UNIQUE KEY uq_comp_result_idempotency (idempotency_key),
    INDEX idx_comp_result_fixture (fixture_id, created_date)
  )`).catch((err) => console.error('[migration] competition_result_submissions:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS competition_standings (
    competition_instance_id  VARCHAR(36) NOT NULL,
    participant_id           VARCHAR(36) NOT NULL,
    played                   INT DEFAULT 0,
    wins                     INT DEFAULT 0,
    draws                    INT DEFAULT 0,
    losses                   INT DEFAULT 0,
    goals_for                INT DEFAULT 0,
    goals_against            INT DEFAULT 0,
    goal_difference          INT DEFAULT 0,
    points                   INT DEFAULT 0,
    \`rank\`                   INT,
    final_position           INT,
    is_promoted              TINYINT(1) DEFAULT 0,
    is_relegated             TINYINT(1) DEFAULT 0,
    is_eliminated            TINYINT(1) DEFAULT 0,
    updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (competition_instance_id, participant_id),
    INDEX idx_comp_standings_rank (competition_instance_id, \`rank\`),
    INDEX idx_comp_standings_participant (participant_id)
  )`).catch((err) => console.error('[migration] competition_standings:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS competition_phase_states (
    id                       VARCHAR(36) PRIMARY KEY,
    competition_instance_id  VARCHAR(36) NOT NULL,
    format                   VARCHAR(50),
    phase                    VARCHAR(50) NOT NULL,
    round                    INT DEFAULT 1,
    status                   VARCHAR(50) DEFAULT 'pending',
    ready_to_advance         TINYINT(1) DEFAULT 0,
    generated_at             DATETIME,
    generated_by_user_id     VARCHAR(36),
    idempotency_key          VARCHAR(190),
    created_date             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_comp_phase_round (competition_instance_id, phase, round),
    UNIQUE KEY uq_comp_phase_idempotency (idempotency_key),
    INDEX idx_comp_phase_status (competition_instance_id, status)
  )`).catch((err) => console.error('[migration] competition_phase_states:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS competition_payouts (
    id                       VARCHAR(36) PRIMARY KEY,
    competition_instance_id  VARCHAR(36) NOT NULL,
    fixture_id               VARCHAR(36),
    match_id                 VARCHAR(36),
    recipient_type           VARCHAR(20) NOT NULL,
    club_id                  VARCHAR(36),
    player_id                VARCHAR(36),
    amount_stc               DECIMAL(12,2) DEFAULT 0,
    category                 VARCHAR(80),
    status                   VARCHAR(50) DEFAULT 'pending',
    idempotency_key          VARCHAR(190),
    ledger_transaction_id    VARCHAR(36),
    created_date             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_comp_payout_idempotency (idempotency_key),
    INDEX idx_comp_payout_instance (competition_instance_id, status),
    INDEX idx_comp_payout_club (club_id, created_date),
    INDEX idx_comp_payout_player (player_id, created_date)
  )`).catch((err) => console.error('[migration] competition_payouts:', err.message));

  await EXECUTESQL(`
    INSERT INTO player_contracts (
      id, team_id, user_id, contract_type, status, offered_by, offered_by_user_id,
      offered_by_club_id, max_games, max_days, weekly_salary_stc, signing_bonus_stc,
      transfer_fee_stc, offer_note, captaincy_offered, negotiation_round,
      start_date, end_date, performance_targets, created_date, updated_date
    )
    SELECT
      UUID(),
      founder.team_id,
      founder.user_id,
      'ownership',
      'active',
      COALESCE(c.owner_email, 'Founder'),
      COALESCE(c.president_user_id, c.user_id),
      founder.team_id,
      0,
      3650,
      0,
      0,
      0,
      CONCAT(
        'Founder president contract: ',
        COALESCE(c.president_user_id, c.user_id, 'user'),
        ':',
        founder.user_id,
        ':',
        LOWER(TRIM(IFNULL(c.name, '')))
      ),
      0,
      0,
      COALESCE(founder.start_date, CURDATE()),
      NULL,
      JSON_OBJECT('source', 'founder_onboarding', 'founder_contract_kind', 'president', 'backfill', TRUE),
      NOW(),
      NOW()
    FROM (
      SELECT pc.team_id, pc.user_id, MIN(pc.start_date) AS start_date
        FROM player_contracts pc
       WHERE pc.contract_type IN ('founder', 'founder_player')
         AND pc.status IN ('active', 'pending', 'pending_window', 'negotiating')
       GROUP BY pc.team_id, pc.user_id
    ) founder
    JOIN clubs c ON c.id = founder.team_id
    LEFT JOIN player_contracts ownership
      ON ownership.team_id = founder.team_id
     AND ownership.user_id = founder.user_id
     AND ownership.contract_type = 'ownership'
     AND ownership.status IN ('active', 'pending', 'pending_window', 'negotiating')
    WHERE ownership.id IS NULL
      AND (
        c.president_player_id IS NULL
        OR c.president_player_id = founder.user_id
      )
  `).catch((err) => console.error('[migration] backfill_founder_president_contracts:', err.message));

  await addCol('transfer_windows', 'window_kind', "VARCHAR(20) NULL DEFAULT 'custom'");
  await addCol('transfer_windows', 'country_code', 'VARCHAR(8) NULL');
  await addCol('transfer_windows', 'competition_id', 'VARCHAR(36) NULL');
  await addCol('news_items', 'transfer_id', 'VARCHAR(36) NULL');

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS mercato_transfers (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    subject_type VARCHAR(20) NOT NULL DEFAULT 'player',
    player_id VARCHAR(36) NULL,
    player_name VARCHAR(120) NULL,
    player_avatar_url TEXT NULL,
    player_position VARCHAR(20) NULL,
    player_nationality VARCHAR(80) NULL,
    player_value_stc BIGINT NULL DEFAULT 0,
    from_club_id VARCHAR(36) NULL,
    from_club_name VARCHAR(120) NULL,
    from_club_logo_url TEXT NULL,
    to_club_id VARCHAR(36) NULL,
    to_club_name VARCHAR(120) NULL,
    to_club_logo_url TEXT NULL,
    competition_id VARCHAR(36) NULL,
    country_code VARCHAR(8) NULL,
    window_id VARCHAR(36) NULL,
    window_kind VARCHAR(20) NULL DEFAULT 'custom',
    deal_type VARCHAR(40) NOT NULL DEFAULT 'permanent',
    status VARCHAR(30) NOT NULL DEFAULT 'rumour',
    transfer_fee BIGINT NULL DEFAULT 0,
    currency VARCHAR(8) NULL DEFAULT 'STC',
    add_ons_amount BIGINT NULL DEFAULT 0,
    sell_on_clause DECIMAL(6,2) NULL DEFAULT 0,
    release_clause BIGINT NULL DEFAULT 0,
    loan_fee BIGINT NULL DEFAULT 0,
    option_to_buy BIGINT NULL DEFAULT 0,
    obligation_to_buy TINYINT(1) NULL DEFAULT 0,
    contract_years INT NULL DEFAULT 0,
    contract_start DATE NULL,
    contract_end DATE NULL,
    contract_option VARCHAR(120) NULL,
    weekly_salary_stc BIGINT NULL DEFAULT 0,
    salary_is_estimate TINYINT(1) NULL DEFAULT 0,
    fee_is_estimate TINYINT(1) NULL DEFAULT 0,
    source_name VARCHAR(160) NULL,
    source_url TEXT NULL,
    journalist_id VARCHAR(36) NULL,
    journalist_name VARCHAR(120) NULL,
    reliability VARCHAR(16) NULL DEFAULT 'medium',
    verification_status VARCHAR(20) NULL DEFAULT 'unconfirmed',
    contract_id VARCHAR(36) NULL,
    staff_role_id VARCHAR(36) NULL,
    transfer_date DATETIME NULL,
    add_ons JSON NULL,
    bonuses JSON NULL,
    headline VARCHAR(255) NULL,
    body TEXT NULL,
    view_count INT NULL DEFAULT 0,
    published_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    last_updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_mercato_contract (contract_id),
    INDEX idx_mercato_player (player_id),
    INDEX idx_mercato_from (from_club_id),
    INDEX idx_mercato_to (to_club_id),
    INDEX idx_mercato_status (status, last_updated_at),
    INDEX idx_mercato_deal (deal_type),
    INDEX idx_mercato_country (country_code),
    INDEX idx_mercato_window (window_kind, window_id)
  )`).catch((err) => console.error('[migration] mercato_transfers:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS mercato_transfer_events (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    transfer_id VARCHAR(36) NOT NULL,
    status VARCHAR(30) NOT NULL,
    title VARCHAR(255) NULL,
    body TEXT NULL,
    source_name VARCHAR(160) NULL,
    created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mercato_events_transfer (transfer_id, created_at)
  )`).catch((err) => console.error('[migration] mercato_transfer_events:', err.message));

  await EXECUTESQL(`CREATE TABLE IF NOT EXISTS player_loans (
    id                       VARCHAR(36) PRIMARY KEY,
    player_id                VARCHAR(36) NOT NULL,
    contract_id              VARCHAR(36) NOT NULL,
    parent_club_id           VARCHAR(36) NOT NULL,
    loan_club_id             VARCHAR(36) NOT NULL,
    start_date               DATE NULL,
    end_date                 DATE NULL,
    loan_fee_stc             BIGINT DEFAULT 0,
    parent_wage_percentage   INT NOT NULL,
    loan_wage_percentage     INT NOT NULL,
    status                   VARCHAR(30) NOT NULL DEFAULT 'PROPOSED',
    proposed_by_club_id      VARCHAR(36) NULL,
    parent_accepted_at       DATETIME NULL,
    loan_club_accepted_at    DATETIME NULL,
    player_accepted_at       DATETIME NULL,
    activated_at             DATETIME NULL,
    completed_at             DATETIME NULL,
    recall_allowed           TINYINT(1) NOT NULL DEFAULT 1,
    recall_after_date        DATE NULL,
    early_end_proposed_by_club_id VARCHAR(36) NULL,
    early_end_proposed_at    DATETIME NULL,
    purchase_type            VARCHAR(20) NOT NULL DEFAULT 'NONE',
    purchase_option_stc      BIGINT DEFAULT 0,
    purchase_option_deadline DATE NULL,
    purchase_offer_status    VARCHAR(20) NULL,
    purchase_salary_stc      BIGINT NULL,
    purchase_contract_days   INT NULL,
    purchase_exercised_at    DATETIME NULL,
    purchase_player_accepted_at DATETIME NULL,
    purchased_at             DATETIME NULL,
    purchase_contract_id     VARCHAR(36) NULL,
    created_date             DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_date             DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ploans_player_status (player_id, status),
    INDEX idx_ploans_parent (parent_club_id),
    INDEX idx_ploans_loan_club (loan_club_id),
    INDEX idx_ploans_contract (contract_id)
  )`).catch((err) => console.error('[migration] player_loans:', err.message));

  await addCol('player_loans', 'recall_allowed', 'TINYINT(1) NOT NULL DEFAULT 1');
  await addCol('player_loans', 'recall_after_date', 'DATE NULL');
  await addCol('player_loans', 'early_end_proposed_by_club_id', 'VARCHAR(36) NULL');
  await addCol('player_loans', 'early_end_proposed_at', 'DATETIME NULL');
  await addCol('player_loans', 'purchase_type', "VARCHAR(20) NOT NULL DEFAULT 'NONE'");
  await addCol('player_loans', 'purchase_option_stc', 'BIGINT DEFAULT 0');
  await addCol('player_loans', 'purchase_option_deadline', 'DATE NULL');
  await addCol('player_loans', 'purchase_offer_status', 'VARCHAR(20) NULL');
  await addCol('player_loans', 'purchase_salary_stc', 'BIGINT NULL');
  await addCol('player_loans', 'purchase_contract_days', 'INT NULL');
  await addCol('player_loans', 'purchase_exercised_at', 'DATETIME NULL');
  await addCol('player_loans', 'purchase_player_accepted_at', 'DATETIME NULL');
  await addCol('player_loans', 'purchased_at', 'DATETIME NULL');
  await addCol('player_loans', 'purchase_contract_id', 'VARCHAR(36) NULL');
}

module.exports = { runStartupMigrations };
