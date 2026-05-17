const { EXECUTESQL, withTransaction } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

async function insertAdminAudit(exec, audit) {
  if (!audit) return;
  await exec(
    `INSERT INTO admin_audit_log
     (id, admin_user_id, admin_email, action, entity_type, entity_id, old_value, new_value, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      audit.admin?.id || null,
      audit.admin?.email || null,
      audit.action,
      audit.entityType,
      audit.entityId,
      audit.oldValue == null ? null : JSON.stringify(audit.oldValue),
      audit.newValue == null ? null : JSON.stringify(audit.newValue),
      audit.reason || null,
    ]
  );
}

function toPositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

class InternationalTournamentModel {
  listTournaments(limit = 100) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);
    return EXECUTESQL(
      'SELECT * FROM international_tournaments ORDER BY created_date DESC LIMIT ?',
      [safeLimit]
    );
  }

  selectAll(page = 1) {
    const pageSize = 25;
    const offset = (Math.max(Number(page) || 1, 1) - 1) * pageSize;
    return EXECUTESQL(
      'SELECT * FROM international_tournaments ORDER BY created_date DESC LIMIT ? OFFSET ?',
      [pageSize, offset]
    );
  }

  getTournament(id) {
    return EXECUTESQL('SELECT * FROM international_tournaments WHERE id = ? LIMIT 1', [id]);
  }

  selectOne(id) {
    return this.getTournament(id);
  }

  async createTournament(body, user, audit = null) {
    const id = body.id || uuidv4();
    await withTransaction(async (exec) => {
      await exec(
        `INSERT INTO international_tournaments
         (id, name, tournament_type, region, status, voting_opens_at, voting_closes_at,
          squad_locks_at, starts_at, max_squad_size, matchday_squad_size, starters_size, bench_size,
          eligible_countries, created_by_user_id, created_by_email)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          body.name,
          body.tournament_type,
          body.region || null,
          body.status || 'draft',
          body.voting_opens_at || null,
          body.voting_closes_at || null,
          body.squad_locks_at || null,
          body.starts_at || null,
          toPositiveInt(body.max_squad_size, 26),
          toPositiveInt(body.matchday_squad_size, 18),
          toPositiveInt(body.starters_size, 11),
          toPositiveInt(body.bench_size, 7),
          body.eligible_countries ? JSON.stringify(body.eligible_countries) : null,
          user?.id || null,
          user?.email || null,
        ]
      );
      await insertAdminAudit(exec, audit && {
        ...audit,
        entityId: audit.entityId || id,
        newValue: audit.newValue || { ...body, id },
      });
    });
    return this.getTournament(id);
  }

  create(body, user) {
    return this.createTournament(body, user);
  }

  update(id, body) {
    return EXECUTESQL(
      `UPDATE international_tournaments
       SET name = ?, tournament_type = ?, region = ?, status = ?,
           voting_opens_at = ?, voting_closes_at = ?, squad_locks_at = ?, starts_at = ?,
           max_squad_size = ?, matchday_squad_size = ?, starters_size = ?, bench_size = ?,
           eligible_countries = ?, updated_date = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        body.name,
        body.tournament_type,
        body.region || null,
        body.status || 'draft',
        body.voting_opens_at || null,
        body.voting_closes_at || null,
        body.squad_locks_at || null,
        body.starts_at || null,
        toPositiveInt(body.max_squad_size, 26),
        toPositiveInt(body.matchday_squad_size, 18),
        toPositiveInt(body.starters_size, 11),
        toPositiveInt(body.bench_size, 7),
        body.eligible_countries ? JSON.stringify(body.eligible_countries) : null,
        id,
      ]
    );
  }

  delete(id) {
    return EXECUTESQL('DELETE FROM international_tournaments WHERE id = ?', [id]);
  }

  listElections(tournamentId) {
    return EXECUTESQL(
      `SELECT e.*,
              p.gamertag AS winner_gamertag,
              p.overall_rating AS winner_overall_rating
       FROM national_team_elections e
       LEFT JOIN players p ON p.id = e.winner_player_id
       WHERE e.international_tournament_id = ?
       ORDER BY e.country_name ASC, e.country_code ASC`,
      [tournamentId]
    );
  }

  getElection(id) {
    return EXECUTESQL('SELECT * FROM national_team_elections WHERE id = ? LIMIT 1', [id]);
  }

  getPlayer(id) {
    return EXECUTESQL('SELECT * FROM players WHERE id = ? LIMIT 1', [id]);
  }

  getPlayerForUser(user) {
    return EXECUTESQL(
      'SELECT * FROM players WHERE user_id = ? OR LOWER(email) = LOWER(?) LIMIT 1',
      [user?.id || '', user?.email || '']
    );
  }

  listCountriesFromPlayers(minPlayers = 1) {
    const safeMinPlayers = Math.max(Number(minPlayers) || 1, 1);
    return EXECUTESQL(
      `SELECT UPPER(country_code) AS country_code,
              MAX(country) AS country_name,
              COUNT(*) AS player_count
       FROM players
       WHERE country_code IS NOT NULL AND country_code <> ''
       GROUP BY UPPER(country_code)
       HAVING COUNT(*) >= ?
       ORDER BY country_name ASC, country_code ASC`,
      [safeMinPlayers]
    );
  }

  async openVoting(tournament, countries, audit = null) {
    await withTransaction(async (exec) => {
      await exec(
        'UPDATE international_tournaments SET status = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ?',
        ['voting_open', tournament.id]
      );
      for (const country of countries) {
        await exec(
          `INSERT INTO national_team_elections
           (id, international_tournament_id, country_code, country_name, status, voting_opens_at, voting_closes_at)
           VALUES (?, ?, ?, ?, 'voting_open', ?, ?)
           ON DUPLICATE KEY UPDATE
             country_name = VALUES(country_name),
             status = 'voting_open',
             voting_opens_at = VALUES(voting_opens_at),
             voting_closes_at = VALUES(voting_closes_at)`,
          [
            uuidv4(),
            tournament.id,
            country.country_code,
            country.country_name || country.country_code,
            tournament.voting_opens_at,
            tournament.voting_closes_at,
          ]
        );
      }
      await insertAdminAudit(exec, audit);
    });
    return this.listElections(tournament.id);
  }

  findVote(electionId, voterPlayerId) {
    return EXECUTESQL(
      'SELECT * FROM national_team_votes WHERE election_id = ? AND voter_player_id = ? LIMIT 1',
      [electionId, voterPlayerId]
    );
  }

  async createVote({ election, voter, candidate }) {
    const id = uuidv4();
    await EXECUTESQL(
      `INSERT INTO national_team_votes
       (id, election_id, tournament_id, country_code, voter_player_id, candidate_player_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        election.id,
        election.international_tournament_id,
        election.country_code,
        voter.id,
        candidate.id,
      ]
    );
    return EXECUTESQL('SELECT * FROM national_team_votes WHERE id = ? LIMIT 1', [id]);
  }

  voteTotals(electionId) {
    return EXECUTESQL(
      `SELECT v.candidate_player_id AS player_id,
              COUNT(*) AS vote_count,
              p.gamertag,
              p.overall_rating
       FROM national_team_votes v
       JOIN players p ON p.id = v.candidate_player_id
       WHERE v.election_id = ?
       GROUP BY v.candidate_player_id, p.gamertag, p.overall_rating`,
      [electionId]
    );
  }

  async closeElection(election, winner) {
    await withTransaction(async (exec) => {
      await exec(
        `UPDATE national_team_elections
         SET status = 'closed', winner_player_id = ?, winner_vote_count = ?, updated_date = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [winner?.player_id || null, winner?.vote_count || 0, election.id]
      );
      if (winner?.player_id) {
        await exec(
          `INSERT INTO national_team_representatives
           (id, tournament_id, election_id, country_code, player_id, vote_count, status)
           VALUES (?, ?, ?, ?, ?, ?, 'active')
           ON DUPLICATE KEY UPDATE
             election_id = VALUES(election_id),
             player_id = VALUES(player_id),
             vote_count = VALUES(vote_count),
             status = 'active'`,
          [uuidv4(), election.international_tournament_id, election.id, election.country_code, winner.player_id, winner.vote_count || 0]
        );
      }
    });
  }

  async closeElections(tournamentId, elections, winnerByElectionId, audit = null) {
    await withTransaction(async (exec) => {
      for (const election of elections) {
        const winner = winnerByElectionId.get(election.id);
        await exec(
          `UPDATE national_team_elections
           SET status = 'closed', winner_player_id = ?, winner_vote_count = ?, updated_date = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [winner?.player_id || null, winner?.vote_count || 0, election.id]
        );
        if (winner?.player_id) {
          await exec(
            `INSERT INTO national_team_representatives
             (id, tournament_id, election_id, country_code, player_id, vote_count, status)
             VALUES (?, ?, ?, ?, ?, ?, 'active')
             ON DUPLICATE KEY UPDATE
               election_id = VALUES(election_id),
               player_id = VALUES(player_id),
               vote_count = VALUES(vote_count),
               status = 'active'`,
            [uuidv4(), election.international_tournament_id, election.id, election.country_code, winner.player_id, winner.vote_count || 0]
          );
        }
      }
      await exec(
        'UPDATE international_tournaments SET status = ?, updated_date = CURRENT_TIMESTAMP WHERE id = ?',
        ['squad_selection', tournamentId]
      );
      await insertAdminAudit(exec, audit);
    });
  }


  listEligiblePlayers(_tournamentId, countryCode) {
    return EXECUTESQL(
      `SELECT p.id, p.gamertag, p.email, p.position, p.secondary_position, p.platform,
              p.country, UPPER(p.country_code) AS country_code, p.club_id,
              p.overall_rating, p.avg_match_rating, p.matches_played, p.goals, p.assists,
              c.name AS club_name, c.tag AS club_tag
       FROM players p
       LEFT JOIN clubs c ON c.id = p.club_id
       WHERE UPPER(p.country_code) = UPPER(?)
       ORDER BY p.overall_rating DESC, p.gamertag ASC`,
      [countryCode]
    );
  }

  getRepresentative(tournamentId, countryCode, playerId) {
    return EXECUTESQL(
      `SELECT * FROM national_team_representatives
       WHERE tournament_id = ? AND UPPER(country_code) = UPPER(?) AND player_id = ? AND status = 'active'
       LIMIT 1`,
      [tournamentId, countryCode, playerId]
    );
  }

  getSquad(tournamentId, countryCode) {
    return EXECUTESQL(
      'SELECT * FROM national_team_squads WHERE tournament_id = ? AND UPPER(country_code) = UPPER(?) LIMIT 1',
      [tournamentId, countryCode]
    );
  }

  listSquadPlayers(squadId) {
    return EXECUTESQL(
      `SELECT sp.*, p.gamertag, p.email, p.secondary_position, p.platform, c.name AS club_name
       FROM national_team_squad_players sp
       JOIN players p ON p.id = sp.player_id
       LEFT JOIN clubs c ON c.id = p.club_id
       WHERE sp.squad_id = ?
       ORDER BY sp.overall_rating DESC, p.gamertag ASC`,
      [squadId]
    );
  }

  async saveSquad({ tournamentId, countryCode, representativeId, submitterPlayerId, players }) {
    let squadId;
    await withTransaction(async (exec) => {
      const existing = await exec(
        'SELECT * FROM national_team_squads WHERE tournament_id = ? AND UPPER(country_code) = UPPER(?) LIMIT 1 FOR UPDATE',
        [tournamentId, countryCode]
      );
      squadId = existing[0]?.id || uuidv4();
      if (existing[0]?.status === 'locked') {
        const error = new Error('Squad is locked');
        error.status = 409;
        throw error;
      }
      await exec(
        `INSERT INTO national_team_squads
         (id, tournament_id, country_code, representative_id, status, submitted_by_player_id)
         VALUES (?, ?, ?, ?, 'draft', ?)
         ON DUPLICATE KEY UPDATE
           representative_id = VALUES(representative_id),
           submitted_by_player_id = VALUES(submitted_by_player_id),
           updated_date = CURRENT_TIMESTAMP`,
        [squadId, tournamentId, countryCode, representativeId, submitterPlayerId]
      );
      await exec('DELETE FROM national_team_squad_players WHERE squad_id = ?', [squadId]);
      for (const player of players) {
        await exec(
          `INSERT INTO national_team_squad_players
           (id, squad_id, tournament_id, country_code, player_id, position, overall_rating)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [uuidv4(), squadId, tournamentId, countryCode, player.id, player.position || null, player.overall_rating || 0]
        );
      }
    });
    return this.getSquad(tournamentId, countryCode);
  }

  lockSquad(squadId, audit = null) {
    return withTransaction(async (exec) => {
      await exec(
        "UPDATE national_team_squads SET status = 'locked', locked_at = CURRENT_TIMESTAMP WHERE id = ?",
        [squadId]
      );
      await insertAdminAudit(exec, audit);
    });
  }
}

module.exports = InternationalTournamentModel;
