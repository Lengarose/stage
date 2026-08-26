/**
 * Minimal IMAP client (implicit TLS, e.g. Gandi mail.gandi.net:993).
 *
 * Uses Node's built-in `tls` module — zero npm dependencies, same constraint
 * as mailer.js on the Gandi FTP deploy path.
 */
const tls = require('tls');

function isConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function imapConfig() {
  const user = process.env.SMTP_USER || '';
  return {
    host: process.env.IMAP_HOST || process.env.SMTP_HOST || 'mail.gandi.net',
    port: Number(process.env.IMAP_PORT || 993),
    user,
    pass: process.env.SMTP_PASS || '',
  };
}

function quote(value) {
  const str = String(value || '');
  if (/^[^\x00-\x7F]*$/.test(str)) return `{${Buffer.byteLength(str, 'utf8')}}\r\n${str}`;
  return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function decodeWords(value) {
  const str = String(value || '').trim();
  if (!str) return '';
  return str.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_m, _charset, enc, data) => {
    try {
      if (enc.toUpperCase() === 'B') return Buffer.from(data, 'base64').toString('utf8');
      return Buffer.from(
        data.replace(/_/g, ' ').replace(/=([0-9A-F]{2})/gi, (_x, hex) => String.fromCharCode(parseInt(hex, 16))),
        'binary',
      ).toString('utf8');
    } catch {
      return data;
    }
  });
}

function parseAddressList(raw) {
  const text = decodeWords(String(raw || '').trim());
  if (!text) return [];
  const matches = [...text.matchAll(/<?([^<>\s,]+@[^<>\s,]+)>?/g)];
  return matches.map((m) => m[1].trim()).filter(Boolean);
}

function parseEnvelopeAddress(addr) {
  if (!addr) return { email: '', name: '' };
  if (typeof addr === 'string') {
    const email = (addr.match(/<?([^<>\s]+@[^<>\s]+)>?/) || [null, addr])[1] || addr;
    return { email: email.trim(), name: '' };
  }
  if (Array.isArray(addr)) {
    const name = decodeWords([addr[0], addr[1]].filter(Boolean).join(' ').trim());
    const mailbox = String(addr[2] || '').trim();
    const host = String(addr[3] || '').trim();
    const email = mailbox && host ? `${mailbox}@${host}` : mailbox;
    return { email, name };
  }
  return { email: '', name: '' };
}

function parseRawMessage(raw) {
  const text = String(raw || '');
  const splitAt = text.search(/\r?\n\r?\n/);
  const headerBlock = splitAt >= 0 ? text.slice(0, splitAt) : text;
  const body = splitAt >= 0 ? text.slice(splitAt).replace(/^\r?\n\r?\n/, '') : '';

  const headers = {};
  for (const line of headerBlock.split(/\r?\n/)) {
    if (/^\s/.test(line) && headers._last) {
      headers[headers._last] = `${headers[headers._last]} ${line.trim()}`;
      continue;
    }
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    headers[key] = line.slice(idx + 1).trim();
    headers._last = key;
  }
  delete headers._last;

  const from = parseAddressList(headers.from || '')[0] || '';
  const to = parseAddressList(headers.to || '');
  const cc = parseAddressList(headers.cc || '');
  const subject = decodeWords(headers.subject || '(no subject)');
  const messageId = headers['message-id'] || null;
  const inReplyTo = headers['in-reply-to'] || null;
  const date = headers.date ? new Date(headers.date) : null;

  let bodyText = body;
  let bodyHtml = null;
  const contentType = String(headers['content-type'] || '').toLowerCase();
  if (contentType.includes('text/html')) {
    bodyHtml = body;
    bodyText = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  return {
    from_email: from,
    from_name: '',
    to_addresses: to,
    cc_addresses: cc,
    subject,
    body_text: bodyText.trim(),
    body_html: bodyHtml,
    external_message_id: messageId,
    in_reply_to: inReplyTo,
    received_at: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
  };
}

class ImapClient {
  constructor() {
    this.tag = 0;
    this.buffer = Buffer.alloc(0);
    this.pending = null;
    this.socket = null;
  }

  connect(cfg) {
    return new Promise((resolve, reject) => {
      const socket = tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host }, () => {
        this.socket = socket;
        this.pending = {
          tag: '__greeting__',
          lines: [],
          resolve: () => resolve(),
          reject,
          literal: null,
        };
      });
      socket.setTimeout(45000, () => {
        socket.destroy();
        reject(new Error('IMAP timeout'));
      });
      socket.on('error', reject);
      socket.on('data', (chunk) => this.onData(chunk));
      socket.on('close', () => {
        if (this.pending) {
          const err = new Error('IMAP connection closed');
          this.pending.reject(err);
          this.pending = null;
        }
      });
    });
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.drainBuffer();
  }

  drainBuffer() {
    while (this.pending) {
      const literal = this.pending.literal;
      if (literal != null) {
        if (this.buffer.length < literal.size) return;
        const content = this.buffer.slice(0, literal.size).toString('utf8');
        this.buffer = this.buffer.slice(literal.size);
        this.pending.literal = null;
        this.pending.lines.push(content);
        continue;
      }

      const newlineIdx = this.buffer.indexOf('\r\n');
      if (newlineIdx < 0) return;
      let line = this.buffer.slice(0, newlineIdx).toString('utf8');
      this.buffer = this.buffer.slice(newlineIdx + 2);

      const literalMatch = line.match(/\{(\d+)\}$/);
      if (literalMatch) {
        this.pending.literal = { size: Number(literalMatch[1]) };
        this.pending.lines.push(line);
        continue;
      }

      this.pending.lines.push(line);

      const tagged = line.match(/^A\d{4} (OK|NO|BAD)/i);
      if (tagged) {
        const done = this.pending;
        this.pending = null;
        if (tagged[1].toUpperCase() === 'OK') done.resolve(done.lines);
        else done.reject(new Error(line));
        continue;
      }

      if (/^\* OK/i.test(line) && this.pending?.tag === '__greeting__') {
        const done = this.pending;
        this.pending = null;
        done.resolve(done.lines);
      }
    }
  }

  exec(command) {
    if (!this.socket) return Promise.reject(new Error('IMAP not connected'));
    if (this.pending) return Promise.reject(new Error('IMAP command already in flight'));
    this.tag += 1;
    const tag = `A${String(this.tag).padStart(4, '0')}`;
    return new Promise((resolve, reject) => {
      this.pending = { tag, lines: [], resolve, reject, literal: null };
      this.socket.write(`${tag} ${command}\r\n`);
    });
  }

  async login(user, pass) {
    await this.exec(`LOGIN ${quote(user)} ${quote(pass)}`);
  }

  async select(mailbox) {
    await this.exec(`SELECT ${quote(mailbox)}`);
  }

  async uidSearch(criteria) {
    const lines = await this.exec(`UID SEARCH ${criteria}`);
    const searchLine = lines.find((line) => /^\* SEARCH/i.test(line));
    if (!searchLine) return [];
    return searchLine
      .replace(/^\* SEARCH/i, '')
      .trim()
      .split(/\s+/)
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
  }

  async uidFetch(uid) {
    const lines = await this.exec(`UID FETCH ${uid} (UID ENVELOPE BODY.PEEK[])`);
    const fetchIdx = lines.findIndex((line) => /^\* \d+ FETCH/i.test(line));
    if (fetchIdx < 0) return null;

    const fetchLine = lines[fetchIdx];
    const uidMatch = fetchLine.match(/UID (\d+)/i);
    const raw = lines.slice(fetchIdx + 1).find((line) => !/^\)/.test(line) && !/^A\d{4}/.test(line)) || '';
    const parsed = parseRawMessage(raw);

    const envelopeMatch = fetchLine.match(/ENVELOPE \(([\s\S]*?)\)\s+BODY\[/i);
    if (envelopeMatch) {
      try {
        const envText = envelopeMatch[1];
        const fromMatch = envText.match(/\(\("([^"]*)"\s+NIL\s+"([^"]*)"\s+"([^"]*)"\)\)/);
        if (fromMatch) {
          parsed.from_name = decodeWords(fromMatch[1] || '');
          parsed.from_email = `${fromMatch[2]}@${fromMatch[3]}`;
        }
        const subjectMatch = envText.match(/"((?:\\.|[^"\\])*)"/);
        if (subjectMatch) parsed.subject = decodeWords(subjectMatch[1].replace(/\\"/g, '"'));
      } catch {
        // envelope parse is best-effort
      }
    }

    return {
      external_uid: uidMatch ? Number(uidMatch[1]) : Number(uid),
      ...parsed,
    };
  }

  async logout() {
    try {
      if (this.socket) await this.exec('LOGOUT');
    } catch {
      // ignore logout errors
    }
    try { this.socket?.end(); } catch { /* ignore */ }
    this.socket = null;
  }
}

/**
 * Fetch new INBOX messages with UID greater than `sinceUid`.
 * Returns parsed message objects ready for DB insert.
 */
async function fetchInboxMessages({ sinceUid = 0, limit = 50 } = {}) {
  if (!isConfigured()) {
    return { messages: [], reason: 'not_configured' };
  }
  const cfg = imapConfig();
  const client = new ImapClient();
  await client.connect(cfg);
  try {
    await client.login(cfg.user, cfg.pass);
    await client.select('INBOX');
    const uids = await client.uidSearch(sinceUid > 0 ? `UID ${sinceUid + 1}:*` : 'ALL');
    const slice = uids.slice(-Math.max(1, Math.min(limit, 100)));
    const messages = [];
    for (const uid of slice) {
      try {
        const row = await client.uidFetch(uid);
        if (row) messages.push(row);
      } catch (err) {
        console.warn('[imap] fetch uid', uid, err.message);
      }
    }
    return { messages, mailbox: cfg.user };
  } finally {
    await client.logout();
  }
}

module.exports = {
  ImapClient,
  fetchInboxMessages,
  imapConfig,
  isConfigured,
  parseRawMessage,
  decodeWords,
};
