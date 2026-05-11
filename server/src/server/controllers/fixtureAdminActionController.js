/**
 * Fixture admin actions — REST + action endpoints.
 *
 * GET    /                  list audit entries (filter: fixture_id, fixture_type, action_type, performed_by, limit)
 * GET    /:id               one audit entry
 * POST   /force-schedule    admin-only: force-schedule a fixture + audit
 * POST   /declare-forfeit   admin-only: declare a forfeit + audit
 * POST   /flag-review       admin-only: flag a fixture for review + audit
 * DELETE /:id               admin-only: remove an audit entry
 *
 * Business logic (fixture update + audit insert) lives server-side so admin
 * interventions are authenticated, atomic, and always logged.
 */
const express = require('express');
const router = express.Router();
const { EXECUTESQL } = require('../db/database');
const FixtureAdminAction = require('../models/fixtureAdminActionModel');

// ── helpers ──────────────────────────────────────────────────────────────────

const FIXTURE_TABLES = {
  competition:     'competition_fixtures',
  regional_league: 'regional_league_fixtures',
};

function toMysqlDateTime(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function getUserContext(req) {
  const userId = req.user?.id;
  if (!userId) return null;
  const rows = await EXECUTESQL(
    'SELECT id, role_id, email FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  if (!rows.length) return null;
  const u = rows[0];
  return {
    userId:   u.id,
    roleId:   Number(u.role_id ?? 1),
    fullName: u.email || null,
  };
}

function isAdmin(ctx) {
  return ctx && (ctx.roleId === 0 || ctx.roleId === 2);
}

async function getFixture(fixtureType, fixtureId) {
  const table = FIXTURE_TABLES[fixtureType];
  if (!table) throw new Error(`Unknown fixture_type: ${fixtureType}`);
  const rows = await EXECUTESQL(`SELECT * FROM ${table} WHERE id = ? LIMIT 1`, [fixtureId]);
  return rows[0] || null;
}

function appendAdminNote(existing, addition) {
  return [existing, addition].filter(Boolean).join('\n');
}

function formatHumanDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

async function writeAudit({ fixture, fixture_type, action_type, ctx, payload, admin_note }) {
  const action = new FixtureAdminAction({
    fixture_id:        fixture?.id || payload?.fixture_id,
    fixture_type,
    action_type,
    performed_by:      ctx?.userId || null,
    performed_by_name: ctx?.fullName || null,
    home_club_id:      fixture?.home_club_id || null,
    away_club_id:      fixture?.away_club_id || null,
    payload,
    admin_note:        admin_note || null,
  });
  const id = await action.create();
  return FixtureAdminAction.selectOne(id);
}

// ── REST: list / one / delete ────────────────────────────────────────────────

router.get('/', async (req, res) => {
  try {
    const rows = await FixtureAdminAction.selectAll(req.query);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await FixtureAdminAction.selectOne(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const ctx = await getUserContext(req);
    if (!isAdmin(ctx)) return res.status(403).json({ error: 'Forbidden' });
    const existing = await FixtureAdminAction.selectOne(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    await FixtureAdminAction.delete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST actions ─────────────────────────────────────────────────────────────

router.post('/force-schedule', async (req, res) => {
  try {
    const ctx = await getUserContext(req);
    if (!isAdmin(ctx)) return res.status(403).json({ error: 'Forbidden' });

    const { fixture_id, fixture_type, date, admin_note } = req.body || {};
    if (!fixture_id || !fixture_type || !date) {
      return res.status(400).json({ error: 'fixture_id, fixture_type, and date are required' });
    }
    const table = FIXTURE_TABLES[fixture_type];
    if (!table) return res.status(400).json({ error: `Unknown fixture_type: ${fixture_type}` });

    const fixture = await getFixture(fixture_type, fixture_id);
    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });

    const mysqlDate = toMysqlDateTime(date);
    if (!mysqlDate) return res.status(400).json({ error: 'Invalid date' });

    const humanDate = formatHumanDate(date);
    const noteLine = `Admin force-scheduled: ${humanDate}${admin_note ? ' — ' + admin_note : ''}`;
    const newAdminNotes = appendAdminNote(fixture.admin_notes, noteLine);

    // competition_fixtures has scheduled_date, regional_league_fixtures does not.
    if (fixture_type === 'competition') {
      await EXECUTESQL(
        `UPDATE ${table} SET scheduling_status = 'confirmed', confirmed_date = ?, scheduled_date = ?,
           status = 'scheduled', admin_notes = ? WHERE id = ?`,
        [mysqlDate, mysqlDate, newAdminNotes, fixture_id]
      );
    } else {
      await EXECUTESQL(
        `UPDATE ${table} SET scheduling_status = 'confirmed', confirmed_date = ?,
           status = 'scheduled', admin_notes = ? WHERE id = ?`,
        [mysqlDate, newAdminNotes, fixture_id]
      );
    }

    const audit = await writeAudit({
      fixture,
      fixture_type,
      action_type: 'force_schedule',
      ctx,
      payload: { date: mysqlDate, original_status: fixture.status, original_scheduling_status: fixture.scheduling_status },
      admin_note: noteLine,
    });

    const updated = await getFixture(fixture_type, fixture_id);
    res.json({ success: true, fixture: updated, audit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/declare-forfeit', async (req, res) => {
  try {
    const ctx = await getUserContext(req);
    if (!isAdmin(ctx)) return res.status(403).json({ error: 'Forbidden' });

    const { fixture_id, fixture_type, forfeiting_club_id, admin_note } = req.body || {};
    if (!fixture_id || !fixture_type || !forfeiting_club_id) {
      return res.status(400).json({ error: 'fixture_id, fixture_type, and forfeiting_club_id are required' });
    }
    const table = FIXTURE_TABLES[fixture_type];
    if (!table) return res.status(400).json({ error: `Unknown fixture_type: ${fixture_type}` });

    const fixture = await getFixture(fixture_type, fixture_id);
    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });

    const isHomeForfeit = forfeiting_club_id === fixture.home_club_id;
    const winnerId   = isHomeForfeit ? fixture.away_club_id   : fixture.home_club_id;
    const winnerName = isHomeForfeit ? fixture.away_club_name : fixture.home_club_name;
    const forfeitingName = isHomeForfeit ? fixture.home_club_name : fixture.away_club_name;

    const noteLine = `Forfeit declared: ${forfeitingName} forfeited.${admin_note ? ' ' + admin_note : ''}`;
    const newAdminNotes = appendAdminNote(fixture.admin_notes, noteLine);

    await EXECUTESQL(
      `UPDATE ${table} SET scheduling_status = 'confirmed', status = 'forfeit',
         winner_club_id = ?, winner_club_name = ?, admin_notes = ? WHERE id = ?`,
      [winnerId, winnerName, newAdminNotes, fixture_id]
    );

    const audit = await writeAudit({
      fixture,
      fixture_type,
      action_type: 'declare_forfeit',
      ctx,
      payload: {
        forfeiting_club_id, forfeiting_club_name: forfeitingName,
        winner_club_id: winnerId, winner_club_name: winnerName,
      },
      admin_note: noteLine,
    });

    const updated = await getFixture(fixture_type, fixture_id);
    res.json({ success: true, fixture: updated, audit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/flag-review', async (req, res) => {
  try {
    const ctx = await getUserContext(req);
    if (!isAdmin(ctx)) return res.status(403).json({ error: 'Forbidden' });

    const { fixture_id, fixture_type, admin_note } = req.body || {};
    if (!fixture_id || !fixture_type) {
      return res.status(400).json({ error: 'fixture_id and fixture_type are required' });
    }
    const table = FIXTURE_TABLES[fixture_type];
    if (!table) return res.status(400).json({ error: `Unknown fixture_type: ${fixture_type}` });

    const fixture = await getFixture(fixture_type, fixture_id);
    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });

    await EXECUTESQL(
      `UPDATE ${table} SET scheduling_status = 'admin_review' WHERE id = ?`,
      [fixture_id]
    );

    const audit = await writeAudit({
      fixture,
      fixture_type,
      action_type: 'flag_review',
      ctx,
      payload: { previous_scheduling_status: fixture.scheduling_status },
      admin_note: admin_note || null,
    });

    const updated = await getFixture(fixture_type, fixture_id);
    res.json({ success: true, fixture: updated, audit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
