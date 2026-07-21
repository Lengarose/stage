const express = require('express');
const router = express.Router();
const { EXECUTESQL } = require('../db/database');

async function requireAdmin(req) {
  const userId = req.user?.id;
  if (!userId) {
    const err = new Error('Not authenticated');
    err.status = 401;
    throw err;
  }
  const rows = await EXECUTESQL(
    'SELECT id, email, role_id FROM users WHERE id = ? LIMIT 1',
    [userId]
  );
  const user = rows[0];
  if (!user || ![0, 2].includes(Number(user.role_id))) {
    const err = new Error('Admin only');
    err.status = 403;
    throw err;
  }
  return user;
}

function clampDays(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 30;
  return Math.min(90, Math.max(7, Math.floor(n)));
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fillDailySeries(rows, days) {
  const map = new Map(
    (rows || []).map((row) => [String(row.day).slice(0, 10), Number(row.count) || 0])
  );
  const out = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ day: key, count: map.get(key) || 0 });
  }
  return out;
}

function mergeDailySeries(seriesList) {
  if (!seriesList.length || !seriesList[0]?.data?.length) return [];
  const days = seriesList[0].data.map((row) => row.day);
  return days.map((day, idx) => {
    const point = { day };
    for (const series of seriesList) {
      point[series.key] = series.data[idx]?.count || 0;
    }
    return point;
  });
}

function tournamentHealth(tournament, matchStats) {
  const status = String(tournament.status || '').toLowerCase();
  const maxTeams = Math.max(1, Number(tournament.max_teams) || 8);
  const registeredClubs = parseJsonArray(tournament.registered_clubs).length;
  const registeredPlayers = parseJsonArray(tournament.registered_players).length;
  const registered = tournament.participant_type === 'player' ? registeredPlayers : registeredClubs;
  const fillPct = Math.round((registered / maxTeams) * 100);

  const totalMatches = Number(matchStats.total_matches) || 0;
  const completedMatches = Number(matchStats.completed_matches) || 0;
  const disputedMatches = Number(matchStats.disputed_matches) || 0;
  const pendingMatches = Number(matchStats.pending_matches) || 0;
  const lastMatchAt = matchStats.last_match_at || null;

  const issues = [];
  let health = 'healthy';

  if (['cancelled', 'archived'].includes(status)) {
    health = 'cancelled';
  } else if (status === 'completed') {
    health = 'completed';
  } else {
    const createdMs = new Date(tournament.created_date).getTime();
    const ageDays = Number.isFinite(createdMs)
      ? Math.floor((Date.now() - createdMs) / (24 * 60 * 60 * 1000))
      : 0;

    if (status === 'registration') {
      if (ageDays >= 14 && fillPct < 50) {
        health = 'at_risk';
        issues.push('Inscriptions faibles depuis plus de 14 jours');
      }
      if (registered === 0 && ageDays >= 7) {
        health = 'at_risk';
        issues.push('Aucun participant inscrit');
      }
    }

    if (status === 'in_progress') {
      if (totalMatches === 0) {
        health = 'stalled';
        issues.push('Tournoi live sans match généré');
      } else if (completedMatches === 0 && ageDays >= 3) {
        health = 'stalled';
        issues.push('Aucun match terminé');
      } else if (lastMatchAt) {
        const lastMs = new Date(lastMatchAt).getTime();
        const idleDays = Number.isFinite(lastMs)
          ? Math.floor((Date.now() - lastMs) / (24 * 60 * 60 * 1000))
          : 0;
        if (idleDays >= 7 && completedMatches < totalMatches) {
          health = 'at_risk';
          issues.push(`Aucune activité match depuis ${idleDays} jours`);
        }
      }
    }

    if (disputedMatches > 0) {
      health = health === 'healthy' ? 'at_risk' : health;
      issues.push(`${disputedMatches} match(s) en litige`);
    }
  }

  const currentRound = Number(tournament.current_round) || 0;
  const totalRounds = Number(tournament.total_rounds) || 0;
  const progressPct = totalRounds > 0
    ? Math.min(100, Math.round((currentRound / totalRounds) * 100))
    : (totalMatches > 0 ? Math.round((completedMatches / totalMatches) * 100) : 0);

  return {
    health,
    issues,
    registered,
    max_teams: maxTeams,
    fill_pct: fillPct,
    match_stats: {
      total: totalMatches,
      completed: completedMatches,
      pending: pendingMatches,
      disputed: disputedMatches,
      last_match_at: lastMatchAt,
    },
    progress_pct: progressPct,
  };
}

async function loadOverview() {
  const [[users], [players], [clubs], [tournaments], [matches], [activeUsers]] = await Promise.all([
    EXECUTESQL('SELECT COUNT(*) AS count FROM users'),
    EXECUTESQL('SELECT COUNT(*) AS count FROM players'),
    EXECUTESQL('SELECT COUNT(*) AS count FROM clubs'),
    EXECUTESQL("SELECT COUNT(*) AS count FROM tournaments WHERE status NOT IN ('cancelled','archived')"),
    EXECUTESQL("SELECT COUNT(*) AS count FROM matches WHERE status IN ('completed','forfeit','confirmed')"),
    EXECUTESQL(
      `SELECT COUNT(DISTINCT user_id) AS count FROM (
         SELECT user_id FROM players WHERE user_id IS NOT NULL AND updated_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         UNION
         SELECT user_id FROM clubs WHERE user_id IS NOT NULL AND updated_date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       ) active_users`
    ).catch(() => [{ count: 0 }]),
  ]);

  const statusRows = await EXECUTESQL(
    `SELECT status, COUNT(*) AS count
     FROM tournaments
     WHERE status NOT IN ('cancelled','archived')
     GROUP BY status`
  ).catch(() => []);

  return {
    totals: {
      users: Number(users?.count) || 0,
      players: Number(players?.count) || 0,
      clubs: Number(clubs?.count) || 0,
      tournaments: Number(tournaments?.count) || 0,
      completed_matches: Number(matches?.count) || 0,
      active_users_30d: Number(activeUsers?.count) || 0,
    },
    tournament_status_counts: statusRows.map((row) => ({
      status: row.status,
      count: Number(row.count) || 0,
    })),
  };
}

async function loadUsageSeries(days) {
  const sinceSql = `DATE_SUB(CURDATE(), INTERVAL ${days - 1} DAY)`;

  const [users, players, clubs, tournaments, matches, contracts] = await Promise.all([
    EXECUTESQL(
      `SELECT DATE(created_date) AS day, COUNT(*) AS count
       FROM users WHERE created_date >= ${sinceSql}
       GROUP BY DATE(created_date) ORDER BY day`
    ).catch(() => []),
    EXECUTESQL(
      `SELECT DATE(created_date) AS day, COUNT(*) AS count
       FROM players WHERE created_date >= ${sinceSql}
       GROUP BY DATE(created_date) ORDER BY day`
    ).catch(() => []),
    EXECUTESQL(
      `SELECT DATE(created_date) AS day, COUNT(*) AS count
       FROM clubs WHERE created_date >= ${sinceSql}
       GROUP BY DATE(created_date) ORDER BY day`
    ).catch(() => []),
    EXECUTESQL(
      `SELECT DATE(created_date) AS day, COUNT(*) AS count
       FROM tournaments WHERE created_date >= ${sinceSql}
       GROUP BY DATE(created_date) ORDER BY day`
    ).catch(() => []),
    EXECUTESQL(
      `SELECT DATE(COALESCE(updated_date, created_date)) AS day, COUNT(*) AS count
       FROM matches
       WHERE status IN ('completed','forfeit','confirmed')
         AND COALESCE(updated_date, created_date) >= ${sinceSql}
       GROUP BY DATE(COALESCE(updated_date, created_date)) ORDER BY day`
    ).catch(() => []),
    EXECUTESQL(
      `SELECT DATE(created_date) AS day, COUNT(*) AS count
       FROM player_contracts WHERE created_date >= ${sinceSql}
       GROUP BY DATE(created_date) ORDER BY day`
    ).catch(() => []),
  ]);

  const userSeries = fillDailySeries(users, days);
  const playerSeries = fillDailySeries(players, days);
  const clubSeries = fillDailySeries(clubs, days);
  const tournamentSeries = fillDailySeries(tournaments, days);
  const matchSeries = fillDailySeries(matches, days);
  const contractSeries = fillDailySeries(contracts, days);

  const combined = mergeDailySeries([
    { key: 'users', data: userSeries },
    { key: 'players', data: playerSeries },
    { key: 'clubs', data: clubSeries },
    { key: 'tournaments', data: tournamentSeries },
    { key: 'matches', data: matchSeries },
    { key: 'contracts', data: contractSeries },
  ]);

  return {
    days,
    series: {
      users: userSeries,
      players: playerSeries,
      clubs: clubSeries,
      tournaments: tournamentSeries,
      matches: matchSeries,
      contracts: contractSeries,
      combined,
    },
  };
}

async function loadTournamentMonitor() {
  const tournaments = await EXECUTESQL(
    `SELECT id, name, status, type, participant_type, platform, region, max_teams,
            creator_email, creator_id, creator_gamertag, organizer_email,
            start_date, end_date, current_round, total_rounds,
            registered_clubs, registered_players, winner_club_name, winner_club_id,
            created_date, updated_date
     FROM tournaments
     WHERE status NOT IN ('archived')
     ORDER BY created_date DESC
     LIMIT 100`
  ).catch(() => []);

  if (!tournaments.length) return [];

  const ids = tournaments.map((t) => t.id);
  const placeholders = ids.map(() => '?').join(',');
  const matchRows = await EXECUTESQL(
    `SELECT tournament_id,
            COUNT(*) AS total_matches,
            SUM(CASE WHEN status IN ('completed','forfeit','confirmed') THEN 1 ELSE 0 END) AS completed_matches,
            SUM(CASE WHEN status IN ('disputed','admin_review','flagged') THEN 1 ELSE 0 END) AS disputed_matches,
            SUM(CASE WHEN status NOT IN ('completed','forfeit','confirmed','cancelled') THEN 1 ELSE 0 END) AS pending_matches,
            MAX(COALESCE(updated_date, created_date)) AS last_match_at
     FROM matches
     WHERE tournament_id IN (${placeholders})
     GROUP BY tournament_id`,
    ids
  ).catch(() => []);

  const matchMap = new Map(matchRows.map((row) => [row.tournament_id, row]));

  return tournaments.map((t) => ({
    ...t,
    ...tournamentHealth(t, matchMap.get(t.id) || {}),
  }));
}

router.get('/', async (req, res) => {
  try {
    await requireAdmin(req);
    const days = clampDays(req.query.days);

    const [overview, usage, tournaments] = await Promise.all([
      loadOverview(),
      loadUsageSeries(days),
      loadTournamentMonitor(),
    ]);

    res.json({
      generated_at: new Date().toISOString(),
      overview,
      usage,
      tournaments,
    });
  } catch (err) {
    console.error('[admin-analytics]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
