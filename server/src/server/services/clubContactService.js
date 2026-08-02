const { EXECUTESQL } = require('../db/database');

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return null;
  if (email.endsWith('@stage.invalid')) return null;
  return email;
}

function pickReachableEmail(...candidates) {
  for (const candidate of candidates) {
    const email = normalizeEmail(candidate);
    if (email) return email;
  }
  return null;
}

async function fetchClubWithPresidentContact({ clubId, query = EXECUTESQL, forUpdate = false } = {}) {
  if (!clubId) return null;
  const rows = await query(
    `SELECT c.*,
            president_user.email AS president_user_email,
            owner_user.email AS owner_user_email
       FROM clubs c
       LEFT JOIN users president_user ON president_user.id = c.president_user_id
       LEFT JOIN users owner_user ON owner_user.id = c.user_id
      WHERE c.id = ?
      LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [clubId]
  );
  return rows[0] || null;
}

async function resolveClubPresidentContact({ clubId, club = null, query = EXECUTESQL, forUpdate = false } = {}) {
  const resolvedClub = club || await fetchClubWithPresidentContact({ clubId, query, forUpdate });
  if (!resolvedClub) return { email: null, club: null };

  const email = pickReachableEmail(
    resolvedClub.president_user_email,
    resolvedClub.president_email,
    resolvedClub.owner_user_email,
    resolvedClub.owner_email
  );

  return { email, club: resolvedClub };
}

module.exports = {
  normalizeEmail,
  pickReachableEmail,
  resolveClubPresidentContact,
};
