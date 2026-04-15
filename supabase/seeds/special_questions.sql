-- ============================================================
-- BOLÃO COPA 2026 - Seed: Perguntas Especiais
-- ============================================================
-- Deadline = 5 minutos antes do primeiro jogo (MEX x RSA)
-- Primeiro jogo: 11/06/2026 às 16:00 (Brasília)
-- ============================================================

DELETE FROM special_predictions;
DELETE FROM special_questions;

INSERT INTO special_questions (question_text, answer_type, deadline, correct_answer, points_value) VALUES
('Quem será o campeão?', 'team', '2026-06-11 15:55:00-03', NULL, 50),
('Quem será o artilheiro?', 'player', '2026-06-11 15:55:00-03', NULL, 50);