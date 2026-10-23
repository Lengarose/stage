const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const {
  hashToken,
  isMailableEmail,
  requestPasswordReset,
  isResetTokenValid,
  resetPasswordWithToken,
} = require('../passwordResetService');

function fakeExec(handlers) {
  return async (sql, params = []) => {
    const fn = handlers.find((h) => h.match.test(sql));
    if (!fn) throw new Error(`Unexpected SQL: ${sql}`);
    return fn.run(sql, params);
  };
}

test('placeholder and invalid emails are not mailed', () => {
  assert.equal(isMailableEmail('player@stage.local'), false);
  assert.equal(isMailableEmail('not-an-email'), false);
  assert.equal(isMailableEmail('user@stageleagues.com'), true);
});

test('unknown identifier does not insert a token or send mail', async () => {
  const sent = [];
  const exec = fakeExec([
    { match: /SELECT u\.id, u\.email/, run: async () => [] },
  ]);
  const result = await requestPasswordReset({
    identifier: 'nobody@example.test',
    exec,
    notify: (payload) => sent.push(payload),
    frontendUrl: 'https://stageleagues.com',
  });
  assert.equal(result.ok, true);
  assert.equal(sent.length, 0);
});

test('known user gets a hashed token and a STAGE reset link', async () => {
  const sent = [];
  const inserts = [];
  const exec = fakeExec([
    { match: /SELECT u\.id, u\.email/, run: async () => [{ id: 'u1', email: 'player@example.test' }] },
    { match: /UPDATE password_reset_tokens SET used_at/, run: async () => [] },
    {
      match: /INSERT INTO password_reset_tokens/,
      run: async (_sql, params) => {
        inserts.push(params);
        return [];
      },
    },
  ]);
  await requestPasswordReset({
    identifier: 'MyGamertag',
    exec,
    notify: (payload) => sent.push(payload),
    frontendUrl: 'https://stageleagues.com',
  });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, 'player@example.test');
  assert.match(sent[0].url, /^https:\/\/stageleagues\.com\/reset-password\?token=[a-f0-9]+$/);
  const raw = new URL(sent[0].url).searchParams.get('token');
  assert.equal(inserts[0][2], hashToken(raw));
  assert.notEqual(inserts[0][2], raw);
});

test('Google-style account without password can still receive a reset mail', async () => {
  const sent = [];
  const exec = fakeExec([
    { match: /SELECT u\.id, u\.email/, run: async () => [{ id: 'google-user', email: 'gmail.user@gmail.com' }] },
    { match: /UPDATE password_reset_tokens SET used_at/, run: async () => [] },
    { match: /INSERT INTO password_reset_tokens/, run: async () => [] },
  ]);
  await requestPasswordReset({
    identifier: 'gmail.user@gmail.com',
    exec,
    notify: (payload) => sent.push(payload),
    frontendUrl: 'https://stageleagues.com',
  });
  assert.equal(sent[0].to, 'gmail.user@gmail.com');
});

test('reset rejects short passwords and spent tokens, then stores a bcrypt hash', async () => {
  const short = await resetPasswordWithToken({ token: 'abc', password: '123', exec: async () => [] });
  assert.equal(short.error, 'password_too_short');

  const missing = await resetPasswordWithToken({
    token: 'deadbeef',
    password: 'new-password-9',
    exec: fakeExec([{ match: /SELECT id, user_id FROM password_reset_tokens/, run: async () => [] }]),
  });
  assert.equal(missing.error, 'invalid_token');

  const updates = [];
  const ok = await resetPasswordWithToken({
    token: 'a'.repeat(64),
    password: 'new-password-9',
    exec: fakeExec([
      { match: /SELECT id, user_id FROM password_reset_tokens/, run: async () => [{ id: 't1', user_id: 'u1' }] },
      {
        match: /UPDATE users SET password_hash/,
        run: async (_sql, params) => {
          updates.push(params);
          return [];
        },
      },
      { match: /UPDATE password_reset_tokens SET used_at/, run: async () => [] },
      { match: /SELECT email FROM users/, run: async () => [{ email: 'player@example.test' }] },
      { match: /DELETE FROM auth_tokens/, run: async () => [] },
    ]),
  });
  assert.equal(ok.ok, true);
  assert.equal(await bcrypt.compare('new-password-9', updates[0][0]), true);
});

test('token validity follows unused and unexpired rows', async () => {
  const valid = await isResetTokenValid({
    token: 'abc',
    exec: fakeExec([{ match: /SELECT id FROM password_reset_tokens/, run: async () => [{ id: 't1' }] }]),
  });
  const invalid = await isResetTokenValid({
    token: 'abc',
    exec: fakeExec([{ match: /SELECT id FROM password_reset_tokens/, run: async () => [] }]),
  });
  assert.equal(valid, true);
  assert.equal(invalid, false);
});
