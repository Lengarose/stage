/**
 * High-level email notifications for STAGE League.
 *
 * Each helper builds a branded HTML email and hands it to the mailer's
 * fire-and-forget sender, so callers never block or throw on a mail failure.
 * All helpers are safe no-ops when SMTP is not configured.
 */
const { sendMailSafe, isConfigured } = require('./mailer');

const BRAND = 'STAGE League';
const SITE_URL = process.env.FRONTEND_URL || 'https://stageleagues.com';

// Shared HTML shell so every email looks consistent.
function layout(title, bodyHtml, cta) {
  const button = cta
    ? `<tr><td style="padding:8px 0 4px"><a href="${cta.url}" style="display:inline-block;background:#00E5BD;color:#04121a;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px;font-size:14px">${cta.label}</a></td></tr>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#0a0f1e;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0f1e;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#111a2e;border:1px solid #1e2a45;border-radius:16px;overflow:hidden">
        <tr><td style="padding:22px 28px;border-bottom:1px solid #1e2a45">
          <span style="color:#00E5BD;font-weight:800;letter-spacing:2px;font-size:16px">${BRAND.toUpperCase()}</span>
        </td></tr>
        <tr><td style="padding:26px 28px;color:#e6edf6">
          <h1 style="margin:0 0 12px;font-size:20px;color:#ffffff">${title}</h1>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;line-height:1.6;color:#c7d2e0">
            ${bodyHtml}
            ${button}
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #1e2a45;color:#5b6b85;font-size:11px">
          You are receiving this because you have a ${BRAND} account. · <a href="${SITE_URL}" style="color:#5b6b85">${SITE_URL.replace(/^https?:\/\//, '')}</a>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

function row(text) { return `<tr><td style="padding:4px 0">${text}</td></tr>`; }

// ── Individual notifications ────────────────────────────────────────────────

function notifyLogin({ to, name, when = new Date(), ip, userAgent } = {}) {
  if (!to) return;
  const time = new Date(when).toUTCString();
  const html = layout(
    'New sign-in to your account',
    row(`Hi ${name || 'there'},`) +
    row(`We noticed a sign-in to your ${BRAND} account.`) +
    row(`<strong>Time:</strong> ${time}`) +
    (ip ? row(`<strong>IP:</strong> ${ip}`) : '') +
    (userAgent ? row(`<strong>Device:</strong> ${String(userAgent).slice(0, 120)}`) : '') +
    row(`If this was you, no action is needed. If not, please change your password.`),
    { label: 'Open STAGE', url: SITE_URL },
  );
  sendMailSafe({ to, subject: `New sign-in to ${BRAND}`, html });
}

function notifyAnnouncement({ to, name, title, message, url } = {}) {
  if (!to) return;
  const html = layout(
    title || `There's a new ${BRAND} update`,
    row(`Hi ${name || 'there'},`) +
    row(message || 'A new update has just been released.') ,
    { label: 'See what\'s new', url: url || SITE_URL },
  );
  sendMailSafe({ to, subject: title || `New ${BRAND} update`, html });
}

function notifyMatchDay({ to, name, opponent, competition, kickoff, url } = {}) {
  if (!to) return;
  const when = kickoff ? new Date(kickoff).toUTCString() : 'today';
  const html = layout(
    'It\'s match day! ⚽',
    row(`Hi ${name || 'there'},`) +
    row(`You have a match coming up${opponent ? ` against <strong>${opponent}</strong>` : ''}${competition ? ` in <strong>${competition}</strong>` : ''}.`) +
    row(`<strong>Kick-off:</strong> ${when}`) +
    row('Good luck!'),
    { label: 'Go to Match Day', url: url || `${SITE_URL}/game-day` },
  );
  sendMailSafe({ to, subject: `Match day${opponent ? ` vs ${opponent}` : ''} — ${BRAND}`, html });
}

function notifyTournamentAssigned({ to, name, tournament, url } = {}) {
  if (!to) return;
  const comp = tournament || 'a competition';
  const html = layout(
    'You\'ve been added to a competition 🏆',
    row(`Hi ${name || 'there'},`) +
    row(`You have been assigned to <strong>${comp}</strong>.`) +
    row('Check your fixtures and get ready to compete.'),
    { label: 'View competition', url: url || `${SITE_URL}/competitions` },
  );
  sendMailSafe({ to, subject: `Added to ${comp} — ${BRAND}`, html });
}

function notifyTournamentUnassigned({ to, name, tournament, url } = {}) {
  if (!to) return;
  const comp = tournament || 'a competition';
  const html = layout(
    'You\'ve been removed from a competition',
    row(`Hi ${name || 'there'},`) +
    row(`You are no longer assigned to <strong>${comp}</strong>.`) +
    row('If you think this is a mistake, contact an admin.'),
    { label: 'Browse competitions', url: url || `${SITE_URL}/competitions` },
  );
  sendMailSafe({ to, subject: `Removed from ${comp} — ${BRAND}`, html });
}

// Sent to each player when a match is finalised.
function notifyMatchResultPlayer({ to, name, isWinner, isDraw, yourScore, oppScore, opponent, points, competition, url } = {}) {
  if (!to) return;
  const outcome = isDraw ? 'Draw' : (isWinner ? 'Victory 🎉' : 'Defeat');
  const html = layout(
    `Match result: ${outcome}`,
    row(`Hi ${name || 'there'},`) +
    row(`Your match${opponent ? ` against <strong>${opponent}</strong>` : ''}${competition ? ` in <strong>${competition}</strong>` : ''} is over.`) +
    row(`<strong>Final score:</strong> ${yourScore ?? '-'} – ${oppScore ?? '-'}`) +
    (points != null ? row(`<strong>Points earned:</strong> ${points}`) : ''),
    { label: 'View standings', url: url || `${SITE_URL}/rankings` },
  );
  sendMailSafe({ to, subject: `Match result: ${outcome} — ${BRAND}`, html });
}

// Sent to admin(s) announcing the result of a completed match, as a table.
function notifyMatchResultAdmin({
  to, competition, home, away, homeScore, awayScore, winner, isDraw, url,
} = {}) {
  if (!to) return;
  const th = 'style="text-align:left;padding:8px 10px;border-bottom:1px solid #26314e;color:#8aa0bd;font-size:12px;text-transform:uppercase;letter-spacing:.5px"';
  const td = 'style="padding:8px 10px;border-bottom:1px solid #1b2640;color:#e6edf6;font-size:14px"';
  const homeWin = !isDraw && winner && winner === home;
  const awayWin = !isDraw && winner && winner === away;
  const tag = (win) => win ? ' <span style="color:#00E5BD;font-weight:700">▲ Winner</span>' : '';
  const table = `<tr><td style="padding:6px 0 2px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #26314e;border-radius:10px;overflow:hidden;background:#0d1526">
      <tr><td ${th}>Team</td><td ${th}>Score</td><td ${th}>Result</td></tr>
      <tr><td ${td}>${home || 'Home'}${tag(homeWin)}</td><td ${td}><strong>${homeScore ?? '-'}</strong></td><td ${td}>${isDraw ? 'Draw' : (homeWin ? 'Win' : 'Loss')}</td></tr>
      <tr><td ${td}>${away || 'Away'}${tag(awayWin)}</td><td ${td}><strong>${awayScore ?? '-'}</strong></td><td ${td}>${isDraw ? 'Draw' : (awayWin ? 'Win' : 'Loss')}</td></tr>
    </table></td></tr>`;
  const html = layout(
    'Match completed',
    row(`A match has just been finalised${competition ? ` in <strong>${competition}</strong>` : ''}.`) +
    table +
    row(`<strong>Outcome:</strong> ${isDraw ? 'Draw' : `${winner || 'N/A'} won`}`),
    { label: 'Open admin', url: url || `${SITE_URL}/admin` },
  );
  const subj = isDraw
    ? `Match completed — Draw ${homeScore ?? ''}–${awayScore ?? ''}`
    : `Match completed — winner: ${winner || 'N/A'}`;
  sendMailSafe({ to, subject: subj, html });
}

module.exports = {
  isConfigured,
  notifyLogin,
  notifyAnnouncement,
  notifyMatchDay,
  notifyTournamentAssigned,
  notifyTournamentUnassigned,
  notifyMatchResultPlayer,
  notifyMatchResultAdmin,
};
