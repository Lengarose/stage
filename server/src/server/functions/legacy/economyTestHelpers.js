const { v4: uuidv4 } = require('uuid');

function economyTestEmail(prefix, id) {
  const safePrefix = String(prefix || 'club').replace(/[^a-z0-9_-]/gi, '').toLowerCase() || 'club';
  return `__test__${safePrefix}_${String(id).slice(0, 8)}@stage.test`;
}

async function createTemporaryClubPresident({ EXECUTESQL, addCleanup, clubId, emailPrefix }) {
  const presidentUserId = uuidv4();
  const presidentEmail = economyTestEmail(emailPrefix, clubId);

  await EXECUTESQL(
    `INSERT INTO users
      (id, email, role_id, owner_id, access_mode, created_date, updated_date)
     VALUES (?, ?, 1, NULL, 'standard', NOW(), NOW())`,
    [presidentUserId, presidentEmail]
  );

  if (addCleanup) {
    addCleanup(() => EXECUTESQL('DELETE FROM users WHERE id = ?', [presidentUserId]));
  }

  return { presidentUserId, presidentEmail };
}

async function linkTemporaryClubPresident({ EXECUTESQL, presidentUserId, clubId }) {
  await EXECUTESQL(
    'UPDATE users SET owner_id = ?, updated_date = NOW() WHERE id = ?',
    [clubId, presidentUserId]
  );
}

module.exports = {
  createTemporaryClubPresident,
  linkTemporaryClubPresident,
};
