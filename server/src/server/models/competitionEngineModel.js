const { EXECUTESQL } = require('../db/database');

class CompetitionEngineModel {
  upsertInstance(row) {
    return EXECUTESQL(
      `INSERT INTO competition_instances
       (id, product_type, legacy_source_type, legacy_source_id, name, slug, region, platform, status, starts_at, ends_at, created_by_user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         name=VALUES(name),
         slug=VALUES(slug),
         region=VALUES(region),
         platform=VALUES(platform),
         status=VALUES(status),
         starts_at=VALUES(starts_at),
         ends_at=VALUES(ends_at),
         updated_date=CURRENT_TIMESTAMP`,
      [
        row.id,
        row.product_type,
        row.legacy_source_type,
        row.legacy_source_id,
        row.name,
        row.slug || null,
        row.region || null,
        row.platform || null,
        row.status || 'draft',
        row.starts_at || null,
        row.ends_at || null,
        row.created_by_user_id || null,
      ],
    );
  }

  selectInstance(id) {
    return EXECUTESQL('SELECT * FROM competition_instances WHERE id = ?', [id]);
  }

  selectInstanceBySource(productType, legacySourceType, legacySourceId) {
    return EXECUTESQL(
      'SELECT * FROM competition_instances WHERE product_type = ? AND legacy_source_type = ? AND legacy_source_id = ? LIMIT 1',
      [productType, legacySourceType, legacySourceId],
    );
  }

  listInstances(filters = {}) {
    const where = [];
    const values = [];
    for (const [column, value] of Object.entries(filters)) {
      if (value === undefined || value === null || value === '') continue;
      where.push(`${column} = ?`);
      values.push(value);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return EXECUTESQL(`SELECT * FROM competition_instances ${clause} ORDER BY created_date DESC LIMIT 100`, values);
  }

  upsertParticipant(row) {
    return EXECUTESQL(
      `INSERT INTO competition_participants
       (id, competition_instance_id, participant_type, club_id, player_id, user_id, status, seed, registered_at, approved_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         user_id=VALUES(user_id),
         status=VALUES(status),
         seed=VALUES(seed),
         approved_at=VALUES(approved_at),
         updated_date=CURRENT_TIMESTAMP`,
      [
        row.id,
        row.competition_instance_id,
        row.participant_type,
        row.club_id || null,
        row.player_id || null,
        row.user_id || null,
        row.status || 'pending',
        row.seed ?? null,
        row.registered_at || null,
        row.approved_at || null,
      ],
    );
  }

  listParticipants(instanceId) {
    return EXECUTESQL(
      'SELECT * FROM competition_participants WHERE competition_instance_id = ? ORDER BY seed IS NULL, seed, created_date',
      [instanceId],
    );
  }

  upsertFixture(row) {
    return EXECUTESQL(
      `INSERT INTO competition_fixtures
       (id, competition_instance_id, legacy_fixture_type, legacy_fixture_id, match_id, participant_type,
        format, phase, round, matchday, group_number, tie_id, leg, bracket_side,
        home_participant_id, away_participant_id,
        home_club_id, home_club_name, home_owner_email, away_club_id, away_club_name, away_owner_email,
        player_home_id, player_home_gamertag, player_home_email, player_away_id, player_away_gamertag, player_away_email,
        status, scheduling_status, window_start, window_end, scheduled_at, confirmed_at,
        home_score, away_score, winner_participant_id, stats_processed, idempotency_key)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
        match_id=VALUES(match_id),
        status=VALUES(status),
        scheduling_status=VALUES(scheduling_status),
        scheduled_at=VALUES(scheduled_at),
        confirmed_at=VALUES(confirmed_at),
        home_score=VALUES(home_score),
        away_score=VALUES(away_score),
        winner_participant_id=VALUES(winner_participant_id),
        stats_processed=VALUES(stats_processed),
        updated_date=CURRENT_TIMESTAMP`,
      [
        row.id,
        row.competition_instance_id,
        row.legacy_fixture_type || null,
        row.legacy_fixture_id || null,
        row.match_id || null,
        row.participant_type,
        row.format || null,
        row.phase || null,
        row.round ?? null,
        row.matchday ?? null,
        row.group_number ?? null,
        row.tie_id || null,
        row.leg ?? null,
        row.bracket_side || null,
        row.home_participant_id || null,
        row.away_participant_id || null,
        row.home_club_id || null,
        row.home_club_name || null,
        row.home_owner_email || null,
        row.away_club_id || null,
        row.away_club_name || null,
        row.away_owner_email || null,
        row.player_home_id || null,
        row.player_home_gamertag || null,
        row.player_home_email || null,
        row.player_away_id || null,
        row.player_away_gamertag || null,
        row.player_away_email || null,
        row.status || 'unscheduled',
        row.scheduling_status || 'open',
        row.window_start || null,
        row.window_end || null,
        row.scheduled_at || null,
        row.confirmed_at || null,
        row.home_score ?? null,
        row.away_score ?? null,
        row.winner_participant_id || null,
        row.stats_processed ? 1 : 0,
        row.idempotency_key || null,
      ],
    );
  }

  selectFixture(id) {
    return EXECUTESQL('SELECT * FROM competition_fixtures WHERE id = ?', [id]);
  }

  selectFixtureByMatch(matchId) {
    return EXECUTESQL('SELECT * FROM competition_fixtures WHERE match_id = ? LIMIT 1', [matchId]);
  }

  listFixtures(instanceId, filters = {}) {
    const where = ['competition_instance_id = ?'];
    const values = [instanceId];
    for (const key of ['status', 'phase', 'round', 'participant_type']) {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        where.push(`${key} = ?`);
        values.push(filters[key]);
      }
    }
    return EXECUTESQL(
      `SELECT * FROM competition_fixtures WHERE ${where.join(' AND ')} ORDER BY scheduled_at IS NULL, scheduled_at, round, matchday, created_date`,
      values,
    );
  }

  insertResultSubmission(row) {
    return EXECUTESQL(
      `INSERT INTO competition_result_submissions
       (id, fixture_id, match_id, side, submitted_by_user_id, score_home, score_away, payload_json, proof_url, idempotency_key)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         submitted_by_user_id=VALUES(submitted_by_user_id),
         score_home=VALUES(score_home),
         score_away=VALUES(score_away),
         payload_json=VALUES(payload_json),
         proof_url=VALUES(proof_url)`,
      [
        row.id,
        row.fixture_id,
        row.match_id || null,
        row.side,
        row.submitted_by_user_id || null,
        row.score_home,
        row.score_away,
        row.payload_json ? JSON.stringify(row.payload_json) : null,
        row.proof_url || null,
        row.idempotency_key || null,
      ],
    );
  }

  listResultSubmissionsByMatch(matchId) {
    return EXECUTESQL('SELECT * FROM competition_result_submissions WHERE match_id = ? ORDER BY created_date', [matchId]);
  }
}

module.exports = CompetitionEngineModel;
