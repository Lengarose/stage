const { withTransaction } = require('../db/database');

/** @param {(string|null|undefined)[]} list */
function uniqEmails(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    if (!raw || typeof raw !== 'string') continue;
    const t = raw.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

/** @param {string[]} emails */
function lowerParams(emails) {
  return emails.map((x) => String(x).trim().toLowerCase());
}

/** UUID-ish ids without folding case */
function uniqIds(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    if (!raw || typeof raw !== 'string') continue;
    const t = raw.trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function sqlInPlaceholders(n) {
  return `(${Array.from({ length: n }, () => '?').join(',')})`;
}

/**
 * Collect every login / profile / claim address tied to this account (before mutations).
 * @param {(sql: string, vals?: unknown[]) => Promise<unknown[]>} exec
 * @param {string} userId
 */
async function gatherEmailsForUser(exec, userId) {
  const rows = await exec(
    `SELECT DISTINCT TRIM(v.x) AS x FROM (
       SELECT u.email AS x FROM users u WHERE u.id = ?
       UNION ALL SELECT p.email FROM players p WHERE p.user_id = ?
       UNION ALL SELECT p.email FROM players p INNER JOIN users u ON u.player_id = p.id AND u.id = ?
       UNION ALL SELECT pic.email FROM player_identity_claims pic WHERE pic.user_id = ?
     ) v WHERE TRIM(COALESCE(v.x, '')) <> ''`,
    [userId, userId, userId, userId]
  );
  return uniqEmails(rows.map((r) => /** @type {{ x: string }} */ (r).x));
}

/**
 * Rows tied to `users.id` (FK + loose refs). Identity claims are removed in purgeEmailFingerprints.
 * @param {(sql: string, vals?: unknown[]) => Promise<unknown[]>} exec
 * @param {string} userId
 */
async function clearAuxiliaryUserReferences(exec, userId) {
  const stmts = [
    ['DELETE FROM player_contracts WHERE user_id = ?', [userId]],
    ['UPDATE recruitment_posts SET author_user_id = NULL WHERE author_user_id = ?', [userId]],
    ['UPDATE recruitment_interests SET sender_user_id = NULL WHERE sender_user_id = ?', [userId]],
    ['UPDATE recruitment_interests SET recipient_user_id = NULL WHERE recipient_user_id = ?', [userId]],
    ['UPDATE club_applicants SET user_id = NULL WHERE user_id = ?', [userId]],
    ['UPDATE club_staff_roles SET user_id = NULL WHERE user_id = ?', [userId]],
    ['UPDATE club_staff_roles SET assigned_by_user_id = NULL WHERE assigned_by_user_id = ?', [userId]],
    ['UPDATE club_fixture_availability SET user_id = NULL WHERE user_id = ?', [userId]],
    ['UPDATE club_fixture_lineups SET created_by_user_id = NULL WHERE created_by_user_id = ?', [userId]],
    ['UPDATE club_operation_audit_logs SET actor_user_id = NULL WHERE actor_user_id = ?', [userId]],
    ['UPDATE admin_audit_log SET admin_user_id = NULL WHERE admin_user_id = ?', [userId]],
    ['UPDATE fixture_admin_actions SET performed_by = NULL WHERE performed_by = ?', [userId]],
  ];
  for (const [sql, params] of stmts) {
    await exec(sql, params);
  }
}

/**
 * Deletes or nulls every column that mirrors `users.email` (case-insensitive).
 * @param {(sql: string, vals?: unknown[]) => Promise<unknown[]>} exec
 * @param {string} userId
 * @param {string[]} emailsRaw
 */
async function purgeEmailFingerprints(exec, userId, emailsRaw) {
  const emails = uniqEmails(emailsRaw);
  const lower = lowerParams(emails);
  const IN_EMAIL = lower.length ? `(${lower.map(() => '?').join(',')})` : null;

  await exec(
    `DELETE FROM player_identity_claims WHERE user_id = ?${
      lower.length ? ` OR LOWER(TRIM(email)) IN ${IN_EMAIL}` : ''
    }`,
    lower.length ? [userId, ...lower] : [userId]
  );

  if (!lower.length) return;

  const dups = (n) => Array.from({ length: n }, () => [...lower]).flat();

  const delPrefix = [
    'DELETE FROM auth_tokens WHERE LOWER(TRIM(email)) IN ',
    'DELETE FROM notifications WHERE LOWER(TRIM(recipient_email)) IN ',
    'DELETE FROM follows WHERE LOWER(TRIM(follower_email)) IN ',
    'DELETE FROM chat_messages WHERE LOWER(TRIM(sender_email)) IN ',
    'DELETE FROM join_requests WHERE LOWER(TRIM(player_email)) IN ',
    'DELETE FROM comments WHERE LOWER(TRIM(author_email)) IN ',
    'DELETE FROM posts WHERE LOWER(TRIM(author_email)) IN ',
    'DELETE FROM match_player_stats WHERE LOWER(TRIM(player_email)) IN ',
    'DELETE FROM player_stc_transactions WHERE LOWER(TRIM(player_email)) IN ',
    'DELETE FROM stc_transactions WHERE LOWER(TRIM(player_email)) IN ',
    'DELETE FROM user_purchases WHERE LOWER(TRIM(buyer_email)) IN ',
  ];
  for (const prefix of delPrefix) {
    await exec(prefix + IN_EMAIL, lower);
  }

  await exec(
    `DELETE FROM inbox_messages WHERE LOWER(TRIM(recipient_email)) IN ${IN_EMAIL}`
      + ` OR LOWER(TRIM(IFNULL(sender_email, ''))) IN ${IN_EMAIL}`,
    dups(2)
  );
  await exec(
    `DELETE FROM direct_messages WHERE LOWER(TRIM(sender_email)) IN ${IN_EMAIL}`
      + ` OR LOWER(TRIM(recipient_email)) IN ${IN_EMAIL}`,
    dups(2)
  );

  await exec(
    `DELETE FROM predictions WHERE LOWER(TRIM(predictor_email)) IN ${IN_EMAIL}`
      + ` OR LOWER(TRIM(IFNULL(predicted_scorer_email, ''))) IN ${IN_EMAIL}`
      + ` OR LOWER(TRIM(IFNULL(predicted_assist_email, ''))) IN ${IN_EMAIL}`
      + ` OR LOWER(TRIM(IFNULL(predicted_motm_email, ''))) IN ${IN_EMAIL}`,
    dups(4)
  );

  await exec(`UPDATE matches SET home_player_email = NULL WHERE LOWER(TRIM(IFNULL(home_player_email, ''))) IN ${IN_EMAIL}`, lower);
  await exec(`UPDATE matches SET away_player_email = NULL WHERE LOWER(TRIM(IFNULL(away_player_email, ''))) IN ${IN_EMAIL}`, lower);

  await exec(`UPDATE live_match_events SET scorer_email = NULL WHERE LOWER(TRIM(IFNULL(scorer_email, ''))) IN ${IN_EMAIL}`, lower);
  await exec(`UPDATE live_match_events SET assist_email = NULL WHERE LOWER(TRIM(IFNULL(assist_email, ''))) IN ${IN_EMAIL}`, lower);

  await exec(`UPDATE lifestyle_purchases SET player_email = NULL WHERE LOWER(TRIM(IFNULL(player_email, ''))) IN ${IN_EMAIL}`, lower);
  await exec(`UPDATE objective_progress SET player_email = NULL WHERE LOWER(TRIM(IFNULL(player_email, ''))) IN ${IN_EMAIL}`, lower);
  await exec(`UPDATE player_achievements SET player_email = NULL WHERE LOWER(TRIM(IFNULL(player_email, ''))) IN ${IN_EMAIL}`, lower);
  await exec(`UPDATE sbc_submissions SET player_email = NULL WHERE LOWER(TRIM(IFNULL(player_email, ''))) IN ${IN_EMAIL}`, lower);
  await exec(`UPDATE shirt_sales SET buyer_email = NULL WHERE LOWER(TRIM(IFNULL(buyer_email, ''))) IN ${IN_EMAIL}`, lower);

  await exec(`UPDATE tournaments SET organizer_email = NULL WHERE LOWER(TRIM(IFNULL(organizer_email, ''))) IN ${IN_EMAIL}`, lower);
  await exec(`UPDATE tournaments SET creator_email = NULL WHERE LOWER(TRIM(IFNULL(creator_email, ''))) IN ${IN_EMAIL}`, lower);
  await exec(`UPDATE regional_leagues SET organizer_email = NULL WHERE LOWER(TRIM(IFNULL(organizer_email, ''))) IN ${IN_EMAIL}`, lower);

  await exec(`DELETE FROM season_registrations WHERE LOWER(TRIM(IFNULL(owner_email, ''))) IN ${IN_EMAIL}`, lower);

  await exec(`UPDATE admin_audit_log SET admin_email = NULL WHERE LOWER(TRIM(IFNULL(admin_email, ''))) IN ${IN_EMAIL}`, lower);
  await exec(`UPDATE club_operation_audit_logs SET actor_email = NULL WHERE LOWER(TRIM(IFNULL(actor_email, ''))) IN ${IN_EMAIL}`, lower);

  await exec(`UPDATE player_contracts SET offered_by = NULL WHERE LOWER(TRIM(IFNULL(offered_by, ''))) IN ${IN_EMAIL}`, lower);
  await exec(`UPDATE player_contracts SET last_negotiated_by = NULL WHERE LOWER(TRIM(IFNULL(last_negotiated_by, ''))) IN ${IN_EMAIL}`, lower);
}

/**
 * Hard-delete hygiene: clear rows pointing at player UUIDs (`users.player_id`,
 * `players.user_id`, legacy `alsoDeletePlayerId`) before `DELETE FROM players`.
 */
async function purgeReferencesForPlayerIds(exec, playerIdsRaw) {
  const ids = uniqIds(playerIdsRaw);
  if (!ids.length) return;
  const IN_IDS = sqlInPlaceholders(ids.length);
  const p = [...ids];

  await exec(`DELETE FROM join_requests WHERE player_id IN ${IN_IDS}`, p);
  await exec(`DELETE FROM lifestyle_purchases WHERE player_id IN ${IN_IDS}`, p);
  await exec(`DELETE FROM player_stc_transactions WHERE player_id IN ${IN_IDS}`, p);
  await exec(`DELETE FROM objective_progress WHERE player_id IN ${IN_IDS}`, p);
  await exec(`DELETE FROM player_achievements WHERE player_id IN ${IN_IDS}`, p);
  await exec(`DELETE FROM sbc_submissions WHERE player_id IN ${IN_IDS}`, p);
  await exec(`DELETE FROM chemistry_links WHERE player_a_id IN ${IN_IDS} OR player_b_id IN ${IN_IDS}`, [...p, ...p]);
  await exec(`DELETE FROM club_staff_roles WHERE player_id IN ${IN_IDS}`, p);
  await exec(`DELETE FROM club_fixture_availability WHERE player_id IN ${IN_IDS}`, p);
  await exec(`DELETE FROM match_player_stats WHERE player_id IN ${IN_IDS}`, p);

  await exec(`DELETE FROM trophy_placements WHERE owner_id IN ${IN_IDS} AND LOWER(IFNULL(owner_type, '')) = 'player'`, p);

  await exec(`UPDATE follows SET follower_player_id = NULL WHERE follower_player_id IN ${IN_IDS}`, p);
  await exec(`UPDATE recruitment_posts SET author_player_id = NULL WHERE author_player_id IN ${IN_IDS}`, p);
  await exec(`UPDATE recruitment_interests SET sender_player_id = NULL WHERE sender_player_id IN ${IN_IDS}`, p);
  await exec(`UPDATE recruitment_interests SET recipient_player_id = NULL WHERE recipient_player_id IN ${IN_IDS}`, p);
  await exec(`UPDATE club_applicants SET player_id = NULL WHERE player_id IN ${IN_IDS}`, p);
  await exec(`UPDATE club_fixture_lineups SET captain_player_id = NULL WHERE captain_player_id IN ${IN_IDS}`, p);

  await exec(`UPDATE matches SET home_player_id = NULL WHERE home_player_id IN ${IN_IDS}`, p);
  await exec(`UPDATE matches SET away_player_id = NULL WHERE away_player_id IN ${IN_IDS}`, p);
  await exec(`UPDATE matches SET winner_player_id = NULL WHERE winner_player_id IN ${IN_IDS}`, p);
  await exec(`UPDATE matches SET loser_player_id = NULL WHERE loser_player_id IN ${IN_IDS}`, p);
  await exec(`UPDATE matches SET wager_home_player_id = NULL WHERE wager_home_player_id IN ${IN_IDS}`, p);
  await exec(`UPDATE matches SET wager_away_player_id = NULL WHERE wager_away_player_id IN ${IN_IDS}`, p);

  await exec(`UPDATE live_matches SET home_player_id = NULL WHERE home_player_id IN ${IN_IDS}`, p);
  await exec(`UPDATE live_matches SET away_player_id = NULL WHERE away_player_id IN ${IN_IDS}`, p);

  await exec(`DELETE FROM shirt_sales WHERE player_id IN ${IN_IDS}`, p);
  await exec(`UPDATE stc_transactions SET player_id = NULL WHERE player_id IN ${IN_IDS}`, p);
}

/**
 * Hard-delete hygiene: clear rows pointing at club UUIDs (`users.owner_id`, `clubs.user_id`)
 * before owned clubs are deleted.
 */
async function purgeReferencesForClubIds(exec, clubIdsRaw) {
  const ids = uniqIds(clubIdsRaw);
  if (!ids.length) return;
  const IN_IDS = sqlInPlaceholders(ids.length);
  const p = [...ids];

  await exec(`DELETE FROM club_staff_roles WHERE club_id IN ${IN_IDS}`, p);
  await exec(`DELETE FROM club_applicants WHERE club_id IN ${IN_IDS}`, p);
  await exec(`DELETE FROM club_fixture_availability WHERE club_id IN ${IN_IDS}`, p);
  await exec(`DELETE FROM club_fixture_lineups WHERE club_id IN ${IN_IDS}`, p);
  await exec(`DELETE FROM dressing_rooms WHERE club_id IN ${IN_IDS}`, p);

  await exec(`DELETE FROM trophy_placements WHERE owner_id IN ${IN_IDS} AND LOWER(IFNULL(owner_type, '')) = 'club'`, p);

  await exec(`UPDATE posts SET club_id = NULL, club_name = NULL WHERE club_id IN ${IN_IDS}`, p);
  await exec(`UPDATE recruitment_posts SET author_club_id = NULL WHERE author_club_id IN ${IN_IDS}`, p);
  await exec(`UPDATE recruitment_interests SET sender_club_id = NULL WHERE sender_club_id IN ${IN_IDS}`, p);
  await exec(`UPDATE recruitment_interests SET recipient_club_id = NULL WHERE recipient_club_id IN ${IN_IDS}`, p);
  await exec(`UPDATE shirt_sales SET club_id = NULL WHERE club_id IN ${IN_IDS}`, p);
  await exec(`UPDATE press_conferences SET club_id = NULL WHERE club_id IN ${IN_IDS}`, p);

  await exec(`UPDATE live_matches SET home_club_id = NULL WHERE home_club_id IN ${IN_IDS}`, p);
  await exec(`UPDATE live_matches SET away_club_id = NULL WHERE away_club_id IN ${IN_IDS}`, p);

  await exec(`UPDATE matches SET home_club_id = NULL WHERE home_club_id IN ${IN_IDS}`, p);
  await exec(`UPDATE matches SET away_club_id = NULL WHERE away_club_id IN ${IN_IDS}`, p);
  await exec(`UPDATE matches SET winner_club_id = NULL WHERE winner_club_id IN ${IN_IDS}`, p);
  await exec(`UPDATE matches SET loser_club_id = NULL WHERE loser_club_id IN ${IN_IDS}`, p);

  await exec(`UPDATE stc_transactions SET club_id = NULL WHERE club_id IN ${IN_IDS}`, p);

  await exec(`DELETE FROM season_registrations WHERE club_id IN ${IN_IDS}`, p);
}

/** Satisfy NOT NULL UNIQUE players.email after unlink / retention policies. */
async function anonymizeLinkedProfiles(exec, userId, emailsRaw) {
  const emails = uniqEmails(emailsRaw);
  const lower = lowerParams(emails);
  const IN_EMAIL = lower.length ? `(${lower.map(() => '?').join(',')})` : null;

  await exec(
    `UPDATE players SET email = CONCAT('deleted-', id, '@stage.invalid'), home_player_email = NULL
     WHERE user_id = ?${lower.length ? ` OR LOWER(TRIM(email)) IN ${IN_EMAIL}` : ''}`,
    lower.length ? [userId, ...lower] : [userId]
  );

  await exec(
    `UPDATE clubs SET owner_email = CONCAT('deleted-owner-', id, '@stage.invalid') WHERE user_id = ?`,
    [userId]
  );
}

async function revokeSessions(exec, email) {
  if (email) await exec('DELETE FROM auth_tokens WHERE email = ?', [email]);
}

async function unlinkUsersOwnPointers(exec, userId) {
  await exec('UPDATE users SET player_id = NULL, owner_id = NULL WHERE id = ?', [userId]);
  await exec('UPDATE players SET user_id = NULL WHERE user_id = ?', [userId]);
  await exec('UPDATE clubs SET user_id = NULL WHERE user_id = ?', [userId]);
}

/**
 * @param {string} userId
 * @param {'soft'|'hard'} mode
 *   soft — remove login row only; player/club rows stay (user_id nulled by FK + unlink).
 *   hard — delete clubs linked via clubs.user_id and all players linked via players.user_id (Settings danger zone).
 * @param {{ alsoDeletePlayerId?: string }} [extra] — ensure this player row is removed (e.g. legacy link via users.player_id only).
 */
async function deleteUserAccount(userId, mode = 'soft', extra = {}) {
  const alsoDeletePlayerId = extra.alsoDeletePlayerId || null;
  return withTransaction(async (exec) => {
    const rows = await exec('SELECT id, email, player_id, owner_id FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!rows.length) throw new Error('User not found');

    const primaryEmail = rows[0].email;
    const gathered = await gatherEmailsForUser(exec, userId);
    const emails = uniqEmails([primaryEmail, ...gathered]);

    const linkedPlayers = await exec('SELECT id FROM players WHERE user_id = ?', [userId]);
    const linkedClubRows = await exec('SELECT id FROM clubs WHERE user_id = ?', [userId]);
    const playerIdsForHard = uniqIds([
      ...(alsoDeletePlayerId ? [alsoDeletePlayerId] : []),
      ...(rows[0].player_id ? [rows[0].player_id] : []),
      ...linkedPlayers.map((r) => /** @type {{ id: string }} */ (r).id),
    ]);
    const clubIdsForHard = uniqIds([
      ...(rows[0].owner_id ? [rows[0].owner_id] : []),
      ...linkedClubRows.map((r) => /** @type {{ id: string }} */ (r).id),
    ]);

    await purgeEmailFingerprints(exec, userId, emails);
    await clearAuxiliaryUserReferences(exec, userId);
    await anonymizeLinkedProfiles(exec, userId, emails);

    if (mode === 'hard') {
      await purgeReferencesForPlayerIds(exec, playerIdsForHard);
      await purgeReferencesForClubIds(exec, clubIdsForHard);

      const ownedClubs = await exec('SELECT id FROM clubs WHERE user_id = ?', [userId]);
      for (const row of ownedClubs) {
        await exec('UPDATE players SET club_id = NULL WHERE club_id = ?', [row.id]);
        await exec('DELETE FROM clubs WHERE id = ?', [row.id]);
      }
      await exec('DELETE FROM players WHERE user_id = ?', [userId]);
      if (alsoDeletePlayerId) {
        await exec('DELETE FROM players WHERE id = ?', [alsoDeletePlayerId]);
      }
    }

    await revokeSessions(exec, primaryEmail);
    await unlinkUsersOwnPointers(exec, userId);
    await exec('DELETE FROM users WHERE id = ?', [userId]);
  });
}

module.exports = {
  clearAuxiliaryUserReferences,
  deleteUserAccount,
};
