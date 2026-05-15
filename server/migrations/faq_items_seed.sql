-- Optional manual seed for faq_items (also runs automatically on server boot when table is empty).
INSERT INTO faq_items (id, question, answer, sort_order, is_active) VALUES
('faq-seed-join-stage', 'How do I join STAGE?', 'Create your account, complete your player profile, and either create a club or join an existing one. From there you can register for leagues and competitions.', 1, 1),
('faq-seed-game', 'What game does STAGE support?', 'STAGE is built around EA FC (formerly FIFA). We support all major platforms including PlayStation and Xbox.', 2, 1),
('faq-seed-leagues', 'How do leagues and competitions work?', 'Leagues are seasonal competitions where clubs compete over multiple rounds. Competitions include knockout-style cups. Results are tracked and standings update in real time.', 3, 1),
('faq-seed-stc', 'What are STC points?', 'STC (STAGE Coins) are the platform currency. Earn them through match rewards, seasonal prizes, and achievements. Use them in the Lifestyle store or on premium features.', 4, 1),
('faq-seed-free', 'Is STAGE free to use?', 'Yes — STAGE is free to join. Some premium features and store items require STC, which can be earned through gameplay.', 5, 1)
ON DUPLICATE KEY UPDATE
  question = VALUES(question),
  answer = VALUES(answer),
  sort_order = VALUES(sort_order),
  is_active = VALUES(is_active);
