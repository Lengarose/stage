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
            owner_user.email AS owner_user_email,
            COALESCE(pr_direct.id, pr_user.id) AS resolved_president_id,
            COALESCE(pr_direct.display_name, pr_user.display_name) AS president_display_name,
            COALESCE(pr_direct.email, pr_user.email) AS president_profile_email
       FROM clubs c
       LEFT JOIN users president_user ON president_user.id = c.president_user_id
       LEFT JOIN users owner_user ON owner_user.id = c.user_id
       LEFT JOIN presidents pr_direct ON pr_direct.id = c.president_id
       LEFT JOIN presidents pr_user ON pr_user.user_id = c.president_user_id
      WHERE c.id = ?
      LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [clubId]
  );
  return rows[0] || null;
}

async function resolveClubPresidentContact({ clubId, club = null, query = EXECUTESQL, forUpdate = false } = {}) {
  const resolvedClub = club || await fetchClubWithPresidentContact({ clubId, query, forUpdate });
  if (!resolvedClub) return { email: null, club: null, presidentId: null };

  const email = pickReachableEmail(
    resolvedClub.president_user_email,
    resolvedClub.president_profile_email,
    resolvedClub.president_email,
    resolvedClub.owner_user_email,
    resolvedClub.owner_email
  );

  return {
    email,
    club: resolvedClub,
    presidentId: resolvedClub.resolved_president_id || resolvedClub.president_id || null,
    presidentDisplayName: resolvedClub.president_display_name || null,
  };
}

module.exports = {
  normalizeEmail,
  pickReachableEmail,
  resolveClubPresidentContact,
};
