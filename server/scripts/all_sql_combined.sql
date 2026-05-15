-- Master SQL script
-- Runs all SQL files in this project from one entry point.
-- Usage:
--   mysql -u <user> -p <db_name> < server/all_sql_combined.sql
--
-- Note: `SOURCE` paths are relative to this file location (`server/`).

-- 1) Base schema
SOURCE schema.sql;

-- 2) Core identity + auth migrations
SOURCE user_identity_migration.sql;
SOURCE oauth_migration.sql;

-- 3) Entity/table expansion migrations
SOURCE player_club_tournament_migration.sql;
SOURCE new_tables_migration.sql;
SOURCE remaining_models_migration.sql;
SOURCE match_lifestyle_news_migration.sql;
SOURCE stage_entity_changes_20260505.sql;
SOURCE banner_migration.sql;
SOURCE landing_page_content_migration.sql;
SOURCE migrations/2026-05-07_add_match_name_columns.sql;

-- 4) Seed/data inserts
SOURCE insert.sql;

