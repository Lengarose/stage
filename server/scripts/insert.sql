-- Pure INSERT script for Gandi MySQL (no LOAD DATA / local files)
USE stage_league;
SET NAMES utf8mb4;

-- ---------------------------------------------------------------------------
-- press_conferences (from PressQuestion_export (1).csv)
-- ---------------------------------------------------------------------------
START TRANSACTION;

INSERT INTO press_conferences
  (id, match_id, club_id, status, selected_question_ids, answers, created_date, updated_date)
VALUES
  ('69d51b15dfb7623bb60c9092', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c9092'), JSON_OBJECT('question','How do you handle pressure?','category','Mindset'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c9093', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c9093'), JSON_OBJECT('question','Any nerves before kickoff?','category','Mindset'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c9094', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c9094'), JSON_OBJECT('question','What''s your biggest challenge today?','category','Preparation'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c9095', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c9095'), JSON_OBJECT('question','What will decide the match?','category','Strategy'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c9096', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c9096'), JSON_OBJECT('question','Are you expecting extra time?','category','Expectations'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c9097', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c9097'), JSON_OBJECT('question','What''s your energy like today?','category','Mindset'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c9098', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c9098'), JSON_OBJECT('question','Any last words before kickoff?','category','Message'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c9099', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c9099'), JSON_OBJECT('question','What do you want to prove today?','category','Personal'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c909a', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c909a'), JSON_OBJECT('question','How important is teamwork today?','category','Team'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c909b', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c909b'), JSON_OBJECT('question','Are you confident in your tactics?','category','Strategy'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c909c', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c909c'), JSON_OBJECT('question','What do you expect from your teammates?','category','Team'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c909d', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c909d'), JSON_OBJECT('question','Are you aiming for a clean sheet?','category','Strategy'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c909e', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c909e'), JSON_OBJECT('question','What''s your biggest advantage?','category','Team'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c909f', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c909f'), JSON_OBJECT('question','What''s your mindset right now?','category','Mindset'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c90a0', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c90a0'), JSON_OBJECT('question','What kind of match do you want?','category','Strategy'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c90a1', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c90a1'), JSON_OBJECT('question','How will you start the game?','category','Strategy'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c90a2', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c90a2'), JSON_OBJECT('question','Any message to your fans?','category','Message'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c90a3', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c90a3'), JSON_OBJECT('question','What''s your biggest goal today?','category','Personal'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c90a4', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c90a4'), JSON_OBJECT('question','How do you rate your chances?','category','Confidence'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51b15dfb7623bb60c90a5', NULL, NULL, 'pending', JSON_ARRAY('69d51b15dfb7623bb60c90a5'), JSON_OBJECT('question','Final confidence level?','category','Confidence'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:56:21.297000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c5e', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c5e'), JSON_OBJECT('question','Are you underestimating the opponent?','category','Opponent'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c5f', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c5f'), JSON_OBJECT('question','What''s your prediction?','category','Expectations'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c60', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c60'), JSON_OBJECT('question','Who''s in form right now?','category','Team'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c61', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c61'), JSON_OBJECT('question','What''s the mood in the team?','category','Mindset'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c62', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c62'), JSON_OBJECT('question','Are you ready for pressure moments?','category','Mindset'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c63', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c63'), JSON_OBJECT('question','What''s your biggest motivation?','category','Personal'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c64', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c64'), JSON_OBJECT('question','What''s the plan if things go wrong?','category','Strategy'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c65', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c65'), JSON_OBJECT('question','Defense or attack more important today?','category','Strategy'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c66', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c66'), JSON_OBJECT('question','What makes your team special?','category','Team'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c67', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c67'), JSON_OBJECT('question','Any rivalry in this match?','category','Opponent'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c68', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c68'), JSON_OBJECT('question','Are you expecting surprises?','category','Expectations'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c69', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c69'), JSON_OBJECT('question','What''s your focus point?','category','Strategy'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.271000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c5b', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c5b'), JSON_OBJECT('question','What''s your biggest strength?','category','Team'), STR_TO_DATE('2026-04-07T14:53:18.270000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.270000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c5c', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c5c'), JSON_OBJECT('question','Any weaknesses today?','category','Mindset'), STR_TO_DATE('2026-04-07T14:53:18.270000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.270000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d51a5e6cf689e78f171c5d', NULL, NULL, 'pending', JSON_ARRAY('69d51a5e6cf689e78f171c5d'), JSON_OBJECT('question','How important is this match?','category','Stakes'), STR_TO_DATE('2026-04-07T14:53:18.270000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:53:18.270000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f8693956', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f8693956'), JSON_OBJECT('question','How are you feeling before the match?','category','Mindset'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f8693957', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f8693957'), JSON_OBJECT('question','What''s the team mindset today?','category','Mindset'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f8693958', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f8693958'), JSON_OBJECT('question','Are you confident about the result?','category','Confidence'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f8693959', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f8693959'), JSON_OBJECT('question','What''s the key to winning today?','category','Strategy'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f869395a', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f869395a'), JSON_OBJECT('question','Thoughts on your opponent?','category','Opponent'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f869395b', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f869395b'), JSON_OBJECT('question','Any pressure going into this game?','category','Mindset'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f869395c', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f869395c'), JSON_OBJECT('question','What''s your personal goal today?','category','Personal'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f869395d', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f869395d'), JSON_OBJECT('question','Is this a must-win game?','category','Stakes'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f869395e', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f869395e'), JSON_OBJECT('question','What do you expect from this match?','category','Expectations'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f869395f', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f869395f'), JSON_OBJECT('question','How prepared is the team?','category','Preparation'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f8693960', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f8693960'), JSON_OBJECT('question','Who will make the difference today?','category','Team'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f8693961', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f8693961'), JSON_OBJECT('question','Any message for your opponents?','category','Message'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f8693962', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f8693962'), JSON_OBJECT('question','What''s your strategy?','category','Strategy'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f8693963', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f8693963'), JSON_OBJECT('question','Are you expecting a high-scoring game?','category','Expectations'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f')),
  ('69d5193b9c8effe3f8693964', NULL, NULL, 'pending', JSON_ARRAY('69d5193b9c8effe3f8693964'), JSON_OBJECT('question','What would a win mean?','category','Stakes'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'), STR_TO_DATE('2026-04-07T14:48:27.418000','%Y-%m-%dT%H:%i:%s.%f'))
ON DUPLICATE KEY UPDATE
  status = VALUES(status),
  selected_question_ids = VALUES(selected_question_ids),
  answers = VALUES(answers),
  updated_date = VALUES(updated_date);

COMMIT;

-- ---------------------------------------------------------------------------
-- trophy_items (from TrophyItem_export.csv)
-- ---------------------------------------------------------------------------
START TRANSACTION;

INSERT INTO trophy_items (id, name, sort_order) VALUES
  ('69f8d86429f2e7862bac4301','STAGE Eerste Divisie',11),
  ('69f8b5bdd2ba532c4b70a383','STAGE Champions Cup',11),
  ('69f8b1955e2c2b7317e2677b','STAGE Champions Cup',10),
  ('69f8b11f56aff7b6fa2f38f4','STAGE Premier Division',9),
  ('69f8b09b1d2370d7daefe7b5','STAGE Elite League',9),
  ('69f8afadc55a564837649c92','STAGE Champions Cup',8),
  ('69f8af95fe957b5fa67600b4','STAGE Lega Uno',7),
  ('69f8af191a92371157e771c1','STAGE Liga De España',6),
  ('69f8ae17f748594a169f2380','STAGE Deutsche Liga',5),
  ('69f8ad66c0860ebacd8a04e7','STAGE Champions Cup',3),
  ('69f8acda349056f0bb40c13c','STAGE Belgian Pro League',2),
  ('69f8a8e833d29d2389156a2c','STAGE Supreme League',0)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sort_order = VALUES(sort_order);

COMMIT;

-- ---------------------------------------------------------------------------
-- lifestyle_items (from LifestyleItem_export.csv)
-- ---------------------------------------------------------------------------
START TRANSACTION;

INSERT INTO lifestyle_items (id, name, is_active, sort_order) VALUES
  ('69e7b797293931375902f8ab','Exclusive Drops',1,23),
  ('69e7b797293931375902f8ac','Pet Dog',1,30),
  ('69e7b797293931375902f8ad','Luxury Watch',1,31),
  ('69e7b797293931375902f8ae','Private Jet',1,32),
  ('69e7b797293931375902f8af','Yacht',1,33),
  ('69e7b797293931375902f8b0','Home Gym',1,40),
  ('69e7b797293931375902f8b1','Swimming Pool',1,41),
  ('69e7b797293931375902f8b2','Personal Coach',1,42),
  ('69e7b797293931375902f8b3','VIP Party',1,50),
  ('69e7b797293931375902f8b4','Award Show',1,51),
  ('69e7b797293931375902f8b5','Exclusive Experience',1,52),
  ('69e7b797293931375902f8b6','Youth Foundation Donation',1,60),
  ('69e7b797293931375902f8b7','Scholarship Fund',1,61),
  ('69e7b797293931375902f8b8','Community Centre',1,62),
  ('69e7b797293931375902f89e','Apartment',1,1),
  ('69e7b797293931375902f89f','City House',1,2),
  ('69e7b797293931375902f8a0','Airbnb Property',1,3),
  ('69e7b797293931375902f8a1','Penthouse',1,4),
  ('69e7b797293931375902f8a2','Luxury Villa',1,5),
  ('69e7b797293931375902f8a3','Hatchback',1,10),
  ('69e7b797293931375902f8a4','Luxury Bike',1,11),
  ('69e7b797293931375902f8a5','SUV',1,12),
  ('69e7b797293931375902f8a6','Sports Car',1,13),
  ('69e7b797293931375902f8a7','Supercar',1,14),
  ('69e7b797293931375902f8a8','Designer Outfit',1,20),
  ('69e7b797293931375902f8a9','Custom Boots',1,21),
  ('69e7b797293931375902f8aa','Luxury Brand Collection',1,22)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  is_active = VALUES(is_active),
  sort_order = VALUES(sort_order);

COMMIT;

