/**
 * Minimal SMTP client (implicit TLS, e.g. Gandi mail.gandi.net:465).
 *
 * Written against Node's built-in `tls` module so it adds ZERO new npm
 * dependencies — important because the Gandi host deploys via FTP and does not
 * run `npm install`. Supports AUTH LOGIN and a single HTML+text email.
 *
 * Config (env — secrets in env.local.js):
 *   SMTP_HOST   default 'mail.gandi.net'
 *   SMTP_PORT   default 465 (implicit TLS)
 *   SMTP_USER   full mailbox address, e.g. noreply@stageleagues.com
 *   SMTP_PASS   mailbox password
 *   MAIL_FROM   default `STAGE League <${SMTP_USER}>`
 *
 * If SMTP_USER/SMTP_PASS are absent, sendMail() becomes a logged no-op so the
 * app runs fine without email configured.
 */
const tls = require('tls');

function isConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function smtpConfig() {
  const user = process.env.SMTP_USER || '';
  return {
    host: process.env.SMTP_HOST || 'mail.gandi.net',
    port: Number(process.env.SMTP_PORT || 465),
    user,
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || (user ? `STAGE League <${user}>` : ''),
  };
}

// Encode a header value that may contain non-ASCII using RFC 2047 (UTF-8/Base64).
function encodeHeader(value) {
  const str = String(value || '');
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(str)) return str;
  return `=?UTF-8?B?${Buffer.from(str, 'utf8').toString('base64')}?=`;
}

// Run a sequential SMTP conversation over an already-connected socket.
function converse(socket, steps) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    let idx = 0;
    let settled = false;

    const done = (err) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners('data');
      if (err) reject(err); else resolve();
    };

    const sendNext = () => {
      if (idx >= steps.length) return done();
      const step = steps[idx];
      if (step.cmd != null) socket.write(step.cmd + '\r\n');
    };

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      // A complete SMTP reply ends with "NNN <text>\r\n" (space, not dash, after code).
      const lines = buffer.split('\r\n').filter(Boolean);
      const last = lines[lines.length - 1] || '';
      if (!/^\d{3} /.test(last)) return; // multiline reply still in progress
      const code = Number(last.slice(0, 3));
      const step = steps[idx];
      buffer = '';
      if (step && Array.isArray(step.expect) && !step.expect.includes(code)) {
        return done(new Error(`SMTP step ${idx} (${step.name || step.cmd}) expected ${step.expect}, got ${last}`));
      }
      idx += 1;
      sendNext();
    });

    socket.on('error', done);
    // Kick off: the server speaks first (220 greeting) which advances step 0.
    if (steps[0] && steps[0].cmd == null) {
      // step 0 is the greeting-wait; nothing to send, the data handler advances.
    } else {
      sendNext();
    }
  });
}

/**
 * Send one email. Resolves { sent:true } on success, { sent:false, reason }
 * when SMTP is not configured. Rejects on a real SMTP/transport failure.
 */
async function sendMail({ to, subject, html, text, from }) {
  if (!isConfigured()) {
    console.warn('[mailer] SMTP not configured — skipping email to', to);
    return { sent: false, reason: 'not_configured' };
  }
  const cfg = smtpConfig();
  const recipient = String(to || '').trim();
  if (!recipient) return { sent: false, reason: 'no_recipient' };
  // Some records hold a gamertag where an email is expected. Without this check
  // the bare name reaches the SMTP server, which rejects it at RCPT with
  // "need fully-qualified address" — a round trip and a scary log line for
  // something we can see is not an address.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    return { sent: false, reason: 'invalid_recipient' };
  }
  // Never send to the OAuth placeholder addresses we mint for provider accounts
  // that don't expose a real email.
  if (recipient.endsWith('@stage.local')) return { sent: false, reason: 'placeholder_recipient' };

  const fromHeader = from || cfg.from;
  const bodyText = text || (html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '');
  const boundary = `=_stage_${Date.now().toString(36)}`;
  const message = [
    `From: ${fromHeader}`,
    `To: ${recipient}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(bodyText, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html || `<p>${bodyText}</p>`, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n'),
    `--${boundary}--`,
    '',
  ].join('\r\n');

  // Dot-stuffing: any line starting with '.' must be escaped as '..'.
  const dataPayload = message.replace(/\r\n\./g, '\r\n..');

  const envelopeFrom = (fromHeader.match(/<([^>]+)>/) || [null, cfg.user])[1];

  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host }, () => {
      converse(socket, [
        { cmd: null, expect: [220], name: 'greeting' },
        { cmd: `EHLO ${cfg.host}`, expect: [250], name: 'ehlo' },
        { cmd: 'AUTH LOGIN', expect: [334], name: 'auth' },
        { cmd: Buffer.from(cfg.user, 'utf8').toString('base64'), expect: [334], name: 'user' },
        { cmd: Buffer.from(cfg.pass, 'utf8').toString('base64'), expect: [235], name: 'pass' },
        { cmd: `MAIL FROM:<${envelopeFrom}>`, expect: [250], name: 'mailfrom' },
        { cmd: `RCPT TO:<${recipient}>`, expect: [250, 251], name: 'rcpt' },
        { cmd: 'DATA', expect: [354], name: 'data' },
        { cmd: `${dataPayload}\r\n.`, expect: [250], name: 'body' },
        { cmd: 'QUIT', expect: [221], name: 'quit' },
      ])
        .then(() => { try { socket.end(); } catch { /* ignore */ } resolve({ sent: true }); })
        .catch((err) => { try { socket.destroy(); } catch { /* ignore */ } reject(err); });
    });
    socket.setTimeout(20000, () => { socket.destroy(); reject(new Error('SMTP timeout')); });
    socket.on('error', reject);
  });
}

/**
 * Fire-and-forget wrapper: never throws into the caller's request path, logs on
 * failure. Use this from controllers so a mail hiccup can't break the API call.
 */
function sendMailSafe(opts) {
  Promise.resolve()
    .then(() => sendMail(opts))
    .then((r) => { if (r && r.sent === false && r.reason !== 'not_configured') console.warn('[mailer] not sent:', r.reason, '→', opts.to); })
    .catch((err) => console.error('[mailer] send failed →', opts.to, err.message));
}

module.exports = { sendMail, sendMailSafe, isConfigured, encodeHeader };
