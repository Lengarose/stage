-- PREPARED ONLY. Not executed against production.
-- User-supplied targets are not live-verified. No UPDATE/DELETE/reset/payout here.
-- Unwanted Premier: 46dbb09f-8319-4607-ab97-ec941745bfd8
-- Unwanted NA: e582c55b-1e72-45f5-ab63-137c3420404a
-- Preserve Premier: c2d6e60f-89e0-4813-81a1-967551d8d69f
-- Preserve NA: e91c6c27-4fd2-45d9-b6ed-6a3591d7b210

SELECT id,entity_type,status,slug,permanent_league_id,season_number,reset_series,
       regional_edition_key,regional_league_key,data_json
FROM league_entities
WHERE id IN ('46dbb09f-8319-4607-ab97-ec941745bfd8',
             'e582c55b-1e72-45f5-ab63-137c3420404a',
             'c2d6e60f-89e0-4813-81a1-967551d8d69f',
             'e91c6c27-4fd2-45d9-b6ed-6a3591d7b210')
ORDER BY entity_type,id;

-- Flexible-store dependants include edition pointers, fixtures, standings,
-- registration/cycle/calendar snapshots, settlements and reward configurations.
SELECT id,entity_type,status,league_id,season_id,permanent_league_id,data_json
FROM league_entities
WHERE permanent_league_id IN ('46dbb09f-8319-4607-ab97-ec941745bfd8','e582c55b-1e72-45f5-ab63-137c3420404a','c2d6e60f-89e0-4813-81a1-967551d8d69f','e91c6c27-4fd2-45d9-b6ed-6a3591d7b210')
   OR league_id IN ('46dbb09f-8319-4607-ab97-ec941745bfd8','e582c55b-1e72-45f5-ab63-137c3420404a','c2d6e60f-89e0-4813-81a1-967551d8d69f','e91c6c27-4fd2-45d9-b6ed-6a3591d7b210')
   OR data_json LIKE '%46dbb09f-8319-4607-ab97-ec941745bfd8%'
   OR data_json LIKE '%e582c55b-1e72-45f5-ab63-137c3420404a%'
   OR data_json LIKE '%c2d6e60f-89e0-4813-81a1-967551d8d69f%'
   OR data_json LIKE '%e91c6c27-4fd2-45d9-b6ed-6a3591d7b210%'
ORDER BY entity_type,id;

SELECT m.* FROM matches m
LEFT JOIN league_entities f ON f.id=m.source_fixture_id
WHERE m.competition_context IN ('46dbb09f-8319-4607-ab97-ec941745bfd8','e582c55b-1e72-45f5-ab63-137c3420404a','c2d6e60f-89e0-4813-81a1-967551d8d69f','e91c6c27-4fd2-45d9-b6ed-6a3591d7b210')
   OR f.league_id IN ('46dbb09f-8319-4607-ab97-ec941745bfd8','e582c55b-1e72-45f5-ab63-137c3420404a','c2d6e60f-89e0-4813-81a1-967551d8d69f','e91c6c27-4fd2-45d9-b6ed-6a3591d7b210')
ORDER BY m.id;

SELECT * FROM competition_instances
WHERE legacy_source_id IN ('46dbb09f-8319-4607-ab97-ec941745bfd8','e582c55b-1e72-45f5-ab63-137c3420404a','c2d6e60f-89e0-4813-81a1-967551d8d69f','e91c6c27-4fd2-45d9-b6ed-6a3591d7b210')
ORDER BY id;

SELECT * FROM competition_payouts
WHERE source_id IN ('46dbb09f-8319-4607-ab97-ec941745bfd8','e582c55b-1e72-45f5-ab63-137c3420404a','c2d6e60f-89e0-4813-81a1-967551d8d69f','e91c6c27-4fd2-45d9-b6ed-6a3591d7b210')
   OR edition_id IN ('46dbb09f-8319-4607-ab97-ec941745bfd8','e582c55b-1e72-45f5-ab63-137c3420404a','c2d6e60f-89e0-4813-81a1-967551d8d69f','e91c6c27-4fd2-45d9-b6ed-6a3591d7b210')
ORDER BY id;

SELECT * FROM trophy_awards
WHERE source_id IN ('46dbb09f-8319-4607-ab97-ec941745bfd8','e582c55b-1e72-45f5-ab63-137c3420404a','c2d6e60f-89e0-4813-81a1-967551d8d69f','e91c6c27-4fd2-45d9-b6ed-6a3591d7b210')
   OR edition_id IN ('46dbb09f-8319-4607-ab97-ec941745bfd8','e582c55b-1e72-45f5-ab63-137c3420404a','c2d6e60f-89e0-4813-81a1-967551d8d69f','e91c6c27-4fd2-45d9-b6ed-6a3591d7b210')
ORDER BY id;

SELECT * FROM reward_configs
WHERE source_id IN ('46dbb09f-8319-4607-ab97-ec941745bfd8','e582c55b-1e72-45f5-ab63-137c3420404a','c2d6e60f-89e0-4813-81a1-967551d8d69f','e91c6c27-4fd2-45d9-b6ed-6a3591d7b210')
ORDER BY id;

-- Use the existing edition-review service to recursively inspect engine fixtures,
-- participants, match statistics, honours and ledger IDs returned by these rows.
-- This first-level inventory alone never authorizes deletion or consolidation.
