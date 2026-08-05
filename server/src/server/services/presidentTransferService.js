const { EXECUTESQL } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

function sameId(left, right) {
  return String(left || '') === String(right || '');
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function writeTransferAudit({
  actor,
  action,
  presidentId,
  presidentName,
  before,
  after,
  reason,
  query,
}) {
  await query(
    `INSERT INTO admin_audit_log
       (id, admin_user_id, admin_email, action, entity_type, entity_id, entity_name,
        old_value, new_value, reason, created_date)
     VALUES (?, ?, ?, ?, 'president', ?, ?, ?, ?, ?, NOW())`,
    [
      uuidv4(),
      actor?.id || null,
      actor?.email || null,
      action,
      presidentId,
      presidentName || null,
      before == null ? null : JSON.stringify(before),
      after == null ? null : JSON.stringify(after),
      reason || null,
    ]
  ).catch((err) => console.error('[audit] president_transfer:', err.message));
}

async function clearClubPresidentLink(clubId, presidentId, { query }) {
  if (!clubId || !presidentId) return;
  await query(
    'UPDATE clubs SET president_id = NULL, president_user_id = NULL WHERE id = ? AND president_id = ?',
    [clubId, presidentId]
  );
}

/**
 * Move a president to another club (or detach with clubId=null).
 * Updates both sides of the link and writes admin_audit_log.
 * If the target club already has a different president, that president is detached.
 */
async function transferPresidentToClub({
  presidentId,
  clubId = null,
  actor = null,
  reason = null,
  query = EXECUTESQL,
} = {}) {
  if (!presidentId) throw httpError(400, 'presidentId is required');

  const presidentRows = await query('SELECT * FROM presidents WHERE id = ? LIMIT 1', [presidentId]);
  const president = presidentRows[0];
  if (!president) throw httpError(404, 'President not found');

  const fromClubId = president.club_id || null;
  let toClub = null;
  let displacedPresident = null;

  if (clubId != null && clubId !== '') {
    const clubRows = await query('SELECT * FROM clubs WHERE id = ? LIMIT 1', [clubId]);
    toClub = clubRows[0] || null;
    if (!toClub) throw httpError(404, 'Club not found');
  } else {
    clubId = null;
  }

  if (sameId(fromClubId, clubId)) {
    return {
      president,
      fromClubId,
      toClub,
      displacedPresident: null,
      noop: true,
    };
  }

  const before = {
    club_id: fromClubId,
    target_club_id: clubId,
  };

  // Detach existing president on the destination club (if different).
  if (toClub?.president_id && !sameId(toClub.president_id, president.id)) {
    const displacedRows = await query('SELECT * FROM presidents WHERE id = ? LIMIT 1', [toClub.president_id]);
    displacedPresident = displacedRows[0] || null;
    if (displacedPresident) {
      await query('UPDATE presidents SET club_id = ? WHERE id = ?', [null, displacedPresident.id]);
      displacedPresident.club_id = null;
    }
    await clearClubPresidentLink(toClub.id, toClub.president_id, { query });
    toClub.president_id = null;
    toClub.president_user_id = null;
  }

  // Clear previous club link for this president.
  if (fromClubId) {
    await clearClubPresidentLink(fromClubId, president.id, { query });
  }

  // Point president at new club (or null).
  await query('UPDATE presidents SET club_id = ? WHERE id = ?', [clubId, president.id]);
  president.club_id = clubId;

  if (clubId) {
    await query(
      'UPDATE clubs SET president_id = ?, president_user_id = ? WHERE id = ?',
      [president.id, president.user_id || null, clubId]
    );
    if (toClub) {
      toClub.president_id = president.id;
      toClub.president_user_id = president.user_id || null;
    }
  }

  const after = {
    club_id: clubId,
    displaced_president_id: displacedPresident?.id || null,
  };
  const action = clubId ? 'president_transfer' : 'president_detach';
  await writeTransferAudit({
    actor,
    action,
    presidentId: president.id,
    presidentName: president.display_name || president.email || null,
    before,
    after,
    reason,
    query,
  });

  return {
    president,
    fromClubId,
    toClub,
    displacedPresident,
    noop: false,
  };
}

module.exports = {
  transferPresidentToClub,
};
