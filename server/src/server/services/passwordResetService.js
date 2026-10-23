const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const TOKEN_BYTES = 32;
const TOKEN_TTL_HOURS = 1;
const MIN_PASSWORD_LENGTH = 8;

function hashToken(raw) {
  return crypto.createHash('sha256').update(String(raw || '')).digest('hex');
}

function createRawToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

function isMailableEmail(email) {
  const value = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  if (value.endsWith('@stage.local')) return false;
  return true;
}

async function findUserByIdentifier(exec, identifier) {
  const loginIdentifier = String(identifier || '').trim();
  if (!loginIdentifier) return null;
  const rows = await exec(
    `SELECT u.id, u.email FROM users u
     LEFT JOIN players p ON p.user_id = u.id OR LOWER(TRIM(p.email)) = LOWER(TRIM(u.email))
     LEFT JOIN clubs c ON c.president_user_id = u.id OR c.user_id = u.id OR LOWER(TRIM(c.owner_email)) = LOWER(TRIM(u.email))
     WHERE LOWER(u.email) = LOWER(?)
        OR LOWER(p.gamertag) = LOWER(?)
        OR LOWER(c.name) = LOWER(?)
     LIMIT 1`,
    [loginIdentifier, loginIdentifier, loginIdentifier],
  );
  return rows[0] || null;
}

async function requestPasswordReset({ identifier, exec, notify, frontendUrl } = {}) {
  const user = await findUserByIdentifier(exec, identifier);
  if (!user || !isMailableEmail(user.email)) return { ok: true };

  await exec(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
    [user.id],
  );

  const raw = createRawToken();
  await exec(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_date)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ${TOKEN_TTL_HOURS} HOUR), NOW())`,
    [uuidv4(), user.id, hashToken(raw)],
  );

  const base = String(frontendUrl || 'https://stageleagues.com').replace(/\/$/, '');
  const url = `${base}/reset-password?token=${encodeURIComponent(raw)}`;
  if (typeof notify === 'function') notify({ to: user.email, url });
  return { ok: true };
}

async function isResetTokenValid({ token, exec } = {}) {
  const raw = String(token || '').trim();
  if (!raw) return false;
  const rows = await exec(
    `SELECT id FROM password_reset_tokens
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [hashToken(raw)],
  );
  return Boolean(rows?.length);
}

async function resetPasswordWithToken({ token, password, exec } = {}) {
  const raw = String(token || '').trim();
  const pwd = String(password || '');
  if (!raw) return { ok: false, status: 400, error: 'invalid_token' };
  if (pwd.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, status: 400, error: 'password_too_short' };
  }

  const rows = await exec(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
     LIMIT 1`,
    [hashToken(raw)],
  );
  if (!rows.length) return { ok: false, status: 400, error: 'invalid_token' };

  const hash = await bcrypt.hash(pwd, 10);
  await exec(
    'UPDATE users SET password_hash = ?, updated_date = NOW() WHERE id = ?',
    [hash, rows[0].user_id],
  );
  await exec(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL',
    [rows[0].user_id],
  );
  const users = await exec('SELECT email FROM users WHERE id = ? LIMIT 1', [rows[0].user_id]);
  if (users[0]?.email) {
    await exec('DELETE FROM auth_tokens WHERE email = ?', [users[0].email]);
  }
  return { ok: true };
}

module.exports = {
  MIN_PASSWORD_LENGTH,
  hashToken,
  createRawToken,
  isMailableEmail,
  findUserByIdentifier,
  requestPasswordReset,
  isResetTokenValid,
  resetPasswordWithToken,
};
