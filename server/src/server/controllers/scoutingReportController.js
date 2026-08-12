const express = require('express');
const router = express.Router();
const ScoutingReport = require('../models/scoutingReportModel');
const { EXECUTESQL } = require('../db/database');
const { writeClubAudit } = require('../services/clubOperationsService');

/**
 * Club scouting — members flag players worth signing, with video evidence.
 *
 * Access rule for every route here: the caller must currently be a playing member
 * of a club, and they only ever touch THAT club's reports. The club is resolved
 * from the caller's own player row and is never read from the request body or
 * query string, so a client cannot file into, or read from, a club it does not
 * belong to. Admins are not given a bypass: scouting is club-private by design,
 * and no admin screen reads it.
 */

const VALID_VOTES = new Set(['for', 'against']);

// Player ids are uuids we generate, but the players endpoint lets a caller supply
// its own id, so treat one as untrusted before it reaches a JSON path expression.
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

async function getUser(req) {
  const rows = await EXECUTESQL(
    'SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1',
    [req.user?.id]
  );
  return rows[0] || null;
}

/**
 * The player row for this user that is actually attached to a club.
 * Returns null for free agents — they have no scouting rights.
 */
async function resolveScout(user) {
  if (!user) return null;
  const rows = await EXECUTESQL(
    `SELECT id, club_id
       FROM players
      WHERE (user_id = ? OR LOWER(TRIM(email)) = LOWER(TRIM(?)))
        AND club_id IS NOT NULL
      ORDER BY user_id = ? DESC, updated_date DESC
      LIMIT 1`,
    [user.id, user.email || '', user.id]
  );
  const scout = rows[0];
  return scout?.club_id ? scout : null;
}

/** Resolves the caller to a club-attached player, or writes the refusal itself. */
async function requireScout(req, res) {
  const user = await getUser(req);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return null;
  }
  const scout = await resolveScout(user);
  if (!scout) {
    res.status(403).json({ error: 'Join a club to use scouting' });
    return null;
  }
  return { user, scout };
}

/** True when this user is the president/owner of that club. */
async function isClubPresident(clubId, userId) {
  const rows = await EXECUTESQL(
    'SELECT id FROM clubs WHERE id = ? AND (president_user_id = ? OR user_id = ?) LIMIT 1',
    [clubId, userId, userId]
  ).catch(() => []);
  return rows.length > 0;
}

/**
 * Loads a report and refuses it unless it belongs to the caller's club.
 * Writes the 404/403 itself and returns null, so callers stay a single happy path.
 */
async function loadOwnClubReport(reportId, context, res) {
  const rows = await new ScoutingReport().selectOne(reportId);
  if (!rows.length) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  const report = rows[0];
  if (report.club_id !== context.scout.club_id) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return report;
}

// GET / — the caller's own club's reports. `club_id` in the query is ignored on
// purpose; scoping comes from membership so it cannot be widened by the client.
router.get('/', async (req, res) => {
  try {
    const context = await requireScout(req, res);
    if (!context) return undefined;
    const rows = await new ScoutingReport().selectByClub(context.scout.club_id, req.query || {});
    return res.json(rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const context = await requireScout(req, res);
    if (!context) return undefined;
    const report = await loadOwnClubReport(req.params.id, context, res);
    if (!report) return undefined;
    return res.json(report);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const context = await requireScout(req, res);
    if (!context) return undefined;

    const body = req.body || {};
    const targetPlayerId = body.target_player_id;
    if (!targetPlayerId) return res.status(400).json({ error: 'target_player_id is required' });

    const targetRows = await EXECUTESQL(
      'SELECT id, club_id FROM players WHERE id = ? LIMIT 1',
      [targetPlayerId]
    );
    if (!targetRows.length) return res.status(404).json({ error: 'Target player not found' });
    // A target already signed elsewhere is deliberately allowed: eligibility is a
    // question for the offer (see the president decision flow), not for scouting.

    // Footage belongs to the player, who publishes it on their own showcase — a
    // scout reports on what they saw there, they don't supply it. So a player with
    // an empty showcase can't be scouted: the club would have nothing to watch,
    // nothing to vote on, and no basis for the president to decide.
    const showcaseRows = await EXECUTESQL(
      'SELECT COUNT(*) AS n FROM player_showcase_videos WHERE player_id = ?',
      [targetPlayerId]
    ).catch(() => [{ n: 0 }]);
    if (Number(showcaseRows[0]?.n || 0) === 0) {
      return res.status(409).json({
        error: 'This player has no showcase video yet. They need to publish one on their profile before a club can scout them.',
      });
    }

    const model = new ScoutingReport({
      club_id: context.scout.club_id,
      scouted_by_player_id: context.scout.id,
      scouted_by_user_id: context.user.id,
      target_player_id: targetPlayerId,
      // Never taken from the request: see above.
      video_links: [],
      notes: body.notes || null,
      status: 'open',
    });
    await model.create();
    const created = await model.selectOne(model.id);
    return res.status(201).json(created[0] || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const context = await requireScout(req, res);
    if (!context) return undefined;

    const existing = await loadOwnClubReport(req.params.id, context, res);
    if (!existing) return undefined;

    const body = req.body || {};
    // Where a report sits in its lifecycle is a state machine owned by the
    // dedicated endpoints below (open-vote, close-vote, archive, mark-offered),
    // each with its own permission rule. Letting a plain field edit move it would
    // route around every one of those rules at once.
    if (body.status !== undefined) {
      return res.status(400).json({ error: 'Status is changed through the vote and decision endpoints, not by editing the report' });
    }
    // Only the scout's own words are editable. Footage is the player's, and any
    // video_links still on old rows stay exactly as they were.
    const model = new ScoutingReport({
      ...existing,
      notes: body.notes !== undefined ? body.notes : existing.notes,
    });
    await model.update(req.params.id);
    const updated = await model.selectOne(req.params.id);
    return res.json(updated[0] || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Open or close the squad vote on a report. President only — this is a privileged
 * transition, which is why it lives on its own endpoint instead of being a field
 * anyone could PATCH.
 *
 * Closing keeps the tally: the president still wants to see what the squad said
 * after the vote ends.
 */
function voteStateRoute(path, nextStatus, allowedFrom) {
  router.post(path, async (req, res) => {
    try {
      const context = await requireScout(req, res);
      if (!context) return undefined;

      const report = await loadOwnClubReport(req.params.id, context, res);
      if (!report) return undefined;

      if (!(await isClubPresident(report.club_id, context.user.id))) {
        return res.status(403).json({ error: 'Only the club president can open or close a vote' });
      }
      if (report.status !== allowedFrom) {
        return res.status(409).json({ error: `Cannot move this report from '${report.status}' to '${nextStatus}'` });
      }

      await EXECUTESQL(
        "UPDATE scouting_reports SET status = ?, updated_date = NOW() WHERE id = ? AND status = ?",
        [nextStatus, req.params.id, allowedFrom]
      );

      const updated = await new ScoutingReport().selectOne(req.params.id);
      return res.json(updated[0] || null);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
  });
}

voteStateRoute('/:id/open-vote', 'voting', 'open');
voteStateRoute('/:id/close-vote', 'open', 'voting');

/**
 * Cast or change a vote on a report whose vote the president has opened.
 *
 * The tally is advisory: nothing anywhere reads it to permit or forbid an action.
 * It exists so the president can see what the squad thinks before deciding, and
 * a squad voting "against" does not stop them signing the player.
 */
router.post('/:id/vote', async (req, res) => {
  try {
    const context = await requireScout(req, res);
    if (!context) return undefined;

    const report = await loadOwnClubReport(req.params.id, context, res);
    if (!report) return undefined;

    const vote = String(req.body?.vote || '');
    if (!VALID_VOTES.has(vote)) {
      return res.status(400).json({ error: "vote must be 'for' or 'against'" });
    }
    if (report.status !== 'voting') {
      return res.status(409).json({ error: 'Voting is not open on this report' });
    }
    if (!SAFE_ID.test(String(context.scout.id))) {
      // A player id with a quote in it would corrupt the JSON path below.
      return res.status(400).json({ error: 'Unsupported player id' });
    }

    // JSON_SET on the stored object rather than read-modify-write in JS: two
    // members voting at the same moment would otherwise race, and the slower
    // write would silently drop the faster one's vote. Keying by player id also
    // makes "one vote per member" a property of the data, not a check we could
    // forget — voting again simply replaces the previous value.
    //
    // `AND status = 'voting'` re-checks at write time what we read a moment ago:
    // without it, a vote sent just as the president closes the vote would still
    // land.
    const result = await EXECUTESQL(
      `UPDATE scouting_reports
          SET votes = JSON_SET(COALESCE(votes, JSON_OBJECT()), ?, ?),
              updated_date = NOW()
        WHERE id = ? AND status = 'voting'`,
      [`$."${context.scout.id}"`, vote, req.params.id]
    );
    if (Number(result?.affectedRows || 0) === 0) {
      return res.status(409).json({ error: 'Voting is not open on this report' });
    }

    const updated = await new ScoutingReport().selectOne(req.params.id);
    return res.json(updated[0] || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * A report can be decided while it sits open, and equally while a vote is running:
 * the squad's opinion informs the president, it never holds them up. What cannot
 * be decided again is a report that has already been decided.
 */
const DECIDABLE_FROM = ['open', 'voting'];

/** Loads a report and refuses anyone who isn't the president of its club. */
async function loadReportForDecision(req, res) {
  const context = await requireScout(req, res);
  if (!context) return null;
  const report = await loadOwnClubReport(req.params.id, context, res);
  if (!report) return null;
  if (!(await isClubPresident(report.club_id, context.user.id))) {
    res.status(403).json({ error: 'Only the club president can decide on a scouting report' });
    return null;
  }
  if (!DECIDABLE_FROM.includes(report.status)) {
    res.status(409).json({ error: `This report has already been decided (${report.status})` });
    return null;
  }
  return { context, report };
}

/**
 * Writes a decision, re-checking at write time that nobody decided first — two
 * presidents, or two tabs, must not both get to set the outcome.
 */
async function applyDecision({ req, res, context, report, nextStatus, action, extraSet = '', extraParams = [], newValue }) {
  const result = await EXECUTESQL(
    `UPDATE scouting_reports
        SET status = ?${extraSet}, updated_date = NOW()
      WHERE id = ? AND status IN (?, ?)`,
    [nextStatus, ...extraParams, req.params.id, ...DECIDABLE_FROM]
  );
  if (Number(result?.affectedRows || 0) === 0) {
    return res.status(409).json({ error: 'This report has already been decided' });
  }
  await writeClubAudit({
    clubId: report.club_id,
    user: context.user,
    action,
    entityType: 'scouting_report',
    entityId: report.id,
    oldValue: { status: report.status },
    newValue,
    reason: req.body?.reason || null,
  });
  const updated = await new ScoutingReport().selectOne(req.params.id);
  return res.json(updated[0] || null);
}

/**
 * Record that this report led to a contract offer.
 *
 * The offer itself is NOT created here. It is raised through the ordinary
 * contract flow, which already enforces the transfer window, wage budget and
 * existing-contract rules — reproducing any of that here would mean two sets of
 * rules that could drift apart. This endpoint only records the link, after
 * checking that the contract really is this club's offer to this report's player.
 * Without that check a president could pin any contract id they liked to a report.
 */
router.post('/:id/mark-offered', async (req, res) => {
  try {
    const loaded = await loadReportForDecision(req, res);
    if (!loaded) return undefined;
    const { context, report } = loaded;

    const contractId = String(req.body?.contract_id || '');
    if (!contractId) return res.status(400).json({ error: 'contract_id is required' });

    const contractRows = await EXECUTESQL(
      'SELECT id, team_id, user_id FROM player_contracts WHERE id = ? LIMIT 1',
      [contractId]
    );
    const contract = contractRows[0];
    if (!contract) return res.status(404).json({ error: 'Contract not found' });
    if (String(contract.team_id) !== String(report.club_id)) {
      return res.status(400).json({ error: 'That contract does not belong to this club' });
    }
    if (String(contract.user_id) !== String(report.target_player_id)) {
      return res.status(400).json({ error: 'That contract is not for the scouted player' });
    }

    return await applyDecision({
      req, res, context, report,
      nextStatus: 'offered',
      action: 'scouting_report_offered',
      extraSet: ', offered_contract_id = ?',
      extraParams: [contractId],
      newValue: { status: 'offered', offered_contract_id: contractId },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

/** Shelve a report the club has decided not to act on. President's call. */
router.post('/:id/archive', async (req, res) => {
  try {
    const loaded = await loadReportForDecision(req, res);
    if (!loaded) return undefined;
    const { context, report } = loaded;

    return await applyDecision({
      req, res, context, report,
      nextStatus: 'archived',
      action: 'scouting_report_archived',
      newValue: { status: 'archived' },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// A scout can withdraw their own report — the way you take back a mistake.
// Moderating *other* members' reports is a president power, and belongs with the
// rest of the president decision flow, not here.
router.delete('/:id', async (req, res) => {
  try {
    const context = await requireScout(req, res);
    if (!context) return undefined;

    const existing = await loadOwnClubReport(req.params.id, context, res);
    if (!existing) return undefined;
    if (existing.scouted_by_player_id !== context.scout.id) {
      return res.status(403).json({ error: 'You can only remove your own scouting reports' });
    }

    await new ScoutingReport().delete(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
