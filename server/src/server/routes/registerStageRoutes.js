function registerStageRoutes(app, { verifyToken }) {
  // Auth and public routes are mounted here so server.js stays focused on boot.
  app.use('/api/stage/auth', require('../controllers/authController'));
  app.use('/api/stage/auth', require('../controllers/oauthController'));
  app.use('/api/stage/public', require('../controllers/publicTournamentController'));

  app.use('/api/stage/upload', verifyToken, require('../controllers/uploadController'));
  app.use('/api/stage/functions', verifyToken, require('../controllers/functionsController'));

  app.use('/api/stage/players', verifyToken, require('../controllers/playerController'));
  app.use('/api/stage/player-careers', verifyToken, require('../controllers/playerCareerController'));
  app.use('/api/stage/presidents', verifyToken, require('../controllers/presidentController'));
  app.use('/api/stage/clubs', verifyToken, require('../controllers/clubController'));
  app.use('/api/stage/matches', verifyToken, require('../controllers/matchController'));
  app.use('/api/stage/tournaments', verifyToken, require('../controllers/tournamentController'));
  app.use('/api/stage/competition-engine', verifyToken, require('../controllers/competitionEngineController'));

  const { makeRouter: makeCompetitionEngineEntityRouter } = require('../controllers/competitionEngineEntityController');
  app.use('/api/stage/competition-instances', verifyToken, makeCompetitionEngineEntityRouter({
    table: 'competition_instances',
    columns: ['product_type', 'legacy_source_type', 'legacy_source_id', 'name', 'slug', 'region', 'platform', 'status', 'starts_at', 'ends_at', 'created_by_user_id', 'created_date', 'updated_date'],
  }));
  app.use('/api/stage/competition-participants', verifyToken, makeCompetitionEngineEntityRouter({
    table: 'competition_participants',
    columns: ['competition_instance_id', 'participant_type', 'club_id', 'player_id', 'user_id', 'status', 'seed', 'registered_at', 'approved_at', 'created_date', 'updated_date'],
    onCreate: (row) => require('../services/notify-participant').participantAssigned(row),
    onDelete: (row) => require('../services/notify-participant').participantUnassigned(row),
  }));
  app.use('/api/stage/competition-schedule-proposals', verifyToken, makeCompetitionEngineEntityRouter({
    table: 'competition_schedule_proposals',
    columns: ['fixture_id', 'proposer_participant_id', 'recipient_participant_id', 'proposed_at', 'proposed_for', 'status', 'message_id', 'notification_id', 'idempotency_key', 'created_date'],
  }));
  app.use('/api/stage/competition-result-submissions', verifyToken, makeCompetitionEngineEntityRouter({
    table: 'competition_result_submissions',
    columns: ['fixture_id', 'match_id', 'side', 'submitted_by_user_id', 'score_home', 'score_away', 'payload_json', 'proof_url', 'idempotency_key', 'created_date'],
    jsonColumns: ['payload_json'],
  }));
  app.use('/api/stage/competition-phase-states', verifyToken, makeCompetitionEngineEntityRouter({
    table: 'competition_phase_states',
    columns: ['competition_instance_id', 'format', 'phase', 'round', 'status', 'ready_to_advance', 'generated_at', 'generated_by_user_id', 'idempotency_key', 'created_date', 'updated_date'],
  }));
  app.use('/api/stage/competition-payouts', verifyToken, makeCompetitionEngineEntityRouter({
    table: 'competition_payouts',
    columns: ['competition_instance_id', 'fixture_id', 'match_id', 'recipient_type', 'club_id', 'player_id', 'amount_stc', 'category', 'status', 'idempotency_key', 'ledger_transaction_id', 'created_date', 'updated_date'],
  }));

  app.use('/api/stage/international-tournaments', verifyToken, require('../controllers/internationalTournamentController'));
  app.use('/api/stage/posts', verifyToken, require('../controllers/postController'));
  app.use('/api/stage/comments', verifyToken, require('../controllers/commentController'));
  app.use('/api/stage/match-player-stats', verifyToken, require('../controllers/matchPlayerStatController'));
  app.use('/api/stage/notifications', verifyToken, require('../controllers/notificationController'));
  app.use('/api/stage/player-contracts', verifyToken, require('../controllers/playerContractController'));
  app.use('/api/stage/inbox-messages', verifyToken, require('../controllers/inboxMessageController'));
  app.use('/api/stage/predictions', verifyToken, require('../controllers/predictionController'));
  app.use('/api/stage/press-conferences', verifyToken, require('../controllers/pressConferenceController'));
  app.use('/api/stage/press-questions', verifyToken, require('../controllers/pressQuestionController'));
  app.use('/api/stage/press-articles', verifyToken, require('../controllers/pressArticleController'));
  app.use('/api/stage/direct-messages', verifyToken, require('../controllers/directMessageController'));
  app.use('/api/stage/stc-transactions', verifyToken, require('../controllers/stcTransactionController'));
  app.use('/api/stage/shirt-sales', verifyToken, require('../controllers/shirtSaleController'));
  app.use('/api/stage/dressing-rooms', verifyToken, require('../controllers/dressingRoomController'));
  app.use('/api/stage/join-requests', verifyToken, require('../controllers/joinRequestController'));
  app.use('/api/stage/lifestyle-items', verifyToken, require('../controllers/lifestyleItemController'));
  app.use('/api/stage/lifestyle-purchases', verifyToken, require('../controllers/lifestylePurchaseController'));
  app.use('/api/stage/user-purchases', verifyToken, require('../controllers/userPurchaseController'));
  app.use('/api/stage/trophy-items', verifyToken, require('../controllers/trophyItemController'));
  app.use('/api/stage/trophy-placements', verifyToken, require('../controllers/trophyPlacementController'));
  app.use('/api/stage/chat-messages', verifyToken, require('../controllers/chatMessageController'));
  app.use('/api/stage/chat-reads', verifyToken, require('../controllers/chatReadController'));
  app.use('/api/stage/news-items', verifyToken, require('../controllers/newsItemController'));
  app.use('/api/stage/live-matches', verifyToken, require('../controllers/liveMatchController'));
  app.use('/api/stage/landing-page-contents', verifyToken, require('../controllers/landingPageContentController'));
  app.use('/api/stage/home-page-contents', verifyToken, require('../controllers/homePageContentController'));
  app.use('/api/stage/faq-items', verifyToken, require('../controllers/faqItemController'));
  app.use('/api/stage/landing-configs', verifyToken, require('../controllers/landingConfigController'));
  app.use('/api/stage/store-configs', verifyToken, require('../controllers/storeConfigController'));
  app.use('/api/stage/transfer-windows', verifyToken, require('../controllers/transferWindowController'));
  app.use('/api/stage/fixture-admin-actions', verifyToken, require('../controllers/fixtureAdminActionController'));
  app.use('/api/stage/reward-configs', verifyToken, require('../controllers/rewardConfigController'));
  app.use('/api/stage/club-achievements', verifyToken, require('../controllers/clubAchievementController'));
  app.use('/api/stage/player-achievements', verifyToken, require('../controllers/playerAchievementController'));
  app.use('/api/stage/player-stc-transactions', verifyToken, require('../controllers/playerStcTransactionController'));
  app.use('/api/stage/player-identity-claims', verifyToken, require('../controllers/playerIdentityClaimController'));
  app.use('/api/stage/player-showcase-videos', verifyToken, require('../controllers/playerShowcaseVideoController'));
  app.use('/api/stage/scouting-reports', verifyToken, require('../controllers/scoutingReportController'));
  app.use('/api/stage/rankings', verifyToken, require('../controllers/rankingController'));
  app.use('/api/stage/admin-analytics', verifyToken, require('../controllers/adminAnalyticsController'));
  app.use('/api/stage/match-archive', verifyToken, require('../controllers/matchArchiveController'));
  app.use('/api/stage/club-applicants', verifyToken, require('../controllers/clubApplicantController'));
  app.use('/api/stage/club-memberships', verifyToken, require('../controllers/clubMembershipController'));
  app.use('/api/stage/club-staff-roles', verifyToken, require('../controllers/clubStaffRoleController'));
  app.use('/api/stage/club-fixture-availability', verifyToken, require('../controllers/clubFixtureAvailabilityController'));
  app.use('/api/stage/club-fixture-availabilities', verifyToken, require('../controllers/clubFixtureAvailabilityController'));
  app.use('/api/stage/club-fixture-lineups', verifyToken, require('../controllers/clubFixtureLineupController'));
  app.use('/api/stage/club-operation-audit-logs', verifyToken, require('../controllers/clubOperationAuditLogController'));

  app.use('/api/stage/objective-definitions', verifyToken, require('../controllers/objectiveDefinitionController'));
  app.use('/api/stage/objective-progresses', verifyToken, require('../controllers/objectiveProgressController'));
  app.use('/api/stage/archetypes', verifyToken, require('../controllers/archetypeController'));
  app.use('/api/stage/chemistry-links', verifyToken, require('../controllers/chemistryLinkController'));
  app.use('/api/stage/sbcs', verifyToken, require('../controllers/sbcController'));
  app.use('/api/stage/sbc-submissions', verifyToken, require('../controllers/sbcSubmissionController'));
  app.use('/api/stage/fut-matches', verifyToken, require('../controllers/futMatchController'));
  app.use('/api/stage/rating-histories', verifyToken, require('../controllers/ratingHistoryController'));
  app.use('/api/stage/live-match-events', verifyToken, require('../controllers/liveMatchEventController'));
  app.use('/api/stage/challenges', verifyToken, require('../controllers/challengeController'));

  const { makeRouter: makeLeagueRouter } = require('../controllers/leagueEntityController');
  app.use('/api/stage/competitions', verifyToken, makeLeagueRouter('competition'));
  app.use('/api/stage/competition-seasons', verifyToken, makeLeagueRouter('competition_season'));
  app.use('/api/stage/competition-fixtures', verifyToken, makeLeagueRouter('competition_fixture'));
  app.use('/api/stage/competition-standings', verifyToken, makeLeagueRouter('competition_standing'));
  app.use('/api/stage/regional-leagues', verifyToken, makeLeagueRouter('regional_league'));
  app.use('/api/stage/regional-league-fixtures', verifyToken, makeLeagueRouter('regional_league_fixture'));
  app.use('/api/stage/regional-league-standings', verifyToken, makeLeagueRouter('regional_league_standing'));
  app.use('/api/stage/qualification-entries', verifyToken, makeLeagueRouter('qualification_entry'));
  app.use('/api/stage/ranking-configs', verifyToken, makeLeagueRouter('ranking_config'));
  app.use('/api/stage/season-registrations', verifyToken, makeLeagueRouter('season_registration'));
}

module.exports = { registerStageRoutes };
