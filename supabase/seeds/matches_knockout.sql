-- ============================================================
-- BOLÃO COPA 2026 - Seed: Jogos de Mata-Mata (com placeholders)
-- ============================================================
-- 31 jogos: 16 avos (16) + oitavas (8) + quartas (4) + semi (2) + 3º lugar (1) + final (1)
--
-- Todos criados com home_team_id = NULL e away_team_id = NULL.
-- Os placeholders textuais indicam QUE TIME virá pra cada slot,
-- seguindo o regulamento oficial da FIFA (Artigos 12.6-12.11).
--
-- Convenções de placeholder:
--   "1A", "2B" — 1º/2º colocado do grupo A, B, etc.
--   "3ABCDF"  — melhor terceiro entre os grupos A, B, C, D ou F
--   "W73"     — vencedor do match 73 (16 avos)
--   "SF1"     — vencedor da semifinal 1; "LSF1" = perdedor da semi 1
--
-- Horários: UTC-3 (Brasília), conforme tabela oficial da FIFA
-- Estádios: formato "Nome, Cidade" pra consistência com fase de grupos.
--   Usamos a cidade mais reconhecível na mídia brasileira
--   (ex: "Dallas" em vez de "Arlington", "Boston" em vez de "Foxborough").
-- ============================================================

-- Limpeza (idempotência — se re-executar)
DELETE FROM matches WHERE round != 'group';

-- ============================================================
-- 16 AVOS DE FINAL (round_of_32) - 28/06 a 03/07
-- ============================================================

INSERT INTO matches (round, home_team_id, away_team_id, home_placeholder, away_placeholder, kickoff_time, venue, status) VALUES
-- M73
('round_of_32', NULL, NULL, '2A',   '2B',     '2026-06-28 16:00:00-03', 'SoFi Stadium, Los Angeles',            'scheduled'),
-- M76
('round_of_32', NULL, NULL, '1C',   '2F',     '2026-06-29 14:00:00-03', 'NRG Stadium, Houston',                 'scheduled'),
-- M74
('round_of_32', NULL, NULL, '1E',   '3ABCDF', '2026-06-29 17:30:00-03', 'Gillette Stadium, Boston',             'scheduled'),
-- M75
('round_of_32', NULL, NULL, '1F',   '2C',     '2026-06-29 22:00:00-03', 'Estadio BBVA, Monterrey',              'scheduled'),
-- M78
('round_of_32', NULL, NULL, '2E',   '2I',     '2026-06-30 14:00:00-03', 'AT&T Stadium, Dallas',                 'scheduled'),
-- M77
('round_of_32', NULL, NULL, '1I',   '3CDFGH', '2026-06-30 18:00:00-03', 'MetLife Stadium, Nova York',           'scheduled'),
-- M79
('round_of_32', NULL, NULL, '1A',   '3CEFHI', '2026-06-30 22:00:00-03', 'Estadio Azteca, Cidade do México',     'scheduled'),
-- M80
('round_of_32', NULL, NULL, '1L',   '3EHIJK', '2026-07-01 13:00:00-03', 'Mercedes-Benz Stadium, Atlanta',       'scheduled'),
-- M82
('round_of_32', NULL, NULL, '1G',   '3AEHIJ', '2026-07-01 17:00:00-03', 'Lumen Field, Seattle',                 'scheduled'),
-- M81
('round_of_32', NULL, NULL, '1D',   '3BEFIJ', '2026-07-01 21:00:00-03', 'Levi''s Stadium, São Francisco',       'scheduled'),
-- M84
('round_of_32', NULL, NULL, '1H',   '2J',     '2026-07-02 16:00:00-03', 'SoFi Stadium, Los Angeles',            'scheduled'),
-- M83
('round_of_32', NULL, NULL, '2K',   '2L',     '2026-07-02 20:00:00-03', 'BMO Field, Toronto',                   'scheduled'),
-- M85
('round_of_32', NULL, NULL, '1B',   '3EFGIJ', '2026-07-03 00:00:00-03', 'BC Place, Vancouver',                  'scheduled'),
-- M88
('round_of_32', NULL, NULL, '2D',   '2G',     '2026-07-03 15:00:00-03', 'AT&T Stadium, Dallas',                 'scheduled'),
-- M86
('round_of_32', NULL, NULL, '1J',   '2H',     '2026-07-03 19:00:00-03', 'Hard Rock Stadium, Miami',             'scheduled'),
-- M87
('round_of_32', NULL, NULL, '1K',   '3DEIJL', '2026-07-03 22:30:00-03', 'Arrowhead Stadium, Kansas City',       'scheduled');

-- ============================================================
-- OITAVAS DE FINAL (round_of_16) - 04/07 a 07/07
-- ============================================================

INSERT INTO matches (round, home_team_id, away_team_id, home_placeholder, away_placeholder, kickoff_time, venue, status) VALUES
-- M90: W73 × W75
('round_of_16', NULL, NULL, 'W73', 'W75',  '2026-07-04 14:00:00-03', 'NRG Stadium, Houston',                 'scheduled'),
-- M89: W74 × W77
('round_of_16', NULL, NULL, 'W74', 'W77',  '2026-07-04 18:00:00-03', 'Lincoln Financial Field, Filadélfia',  'scheduled'),
-- M91: W76 × W78
('round_of_16', NULL, NULL, 'W76', 'W78',  '2026-07-05 17:00:00-03', 'MetLife Stadium, Nova York',           'scheduled'),
-- M92: W79 × W80
('round_of_16', NULL, NULL, 'W79', 'W80',  '2026-07-05 21:00:00-03', 'Estadio Azteca, Cidade do México',     'scheduled'),
-- M93: W83 × W84
('round_of_16', NULL, NULL, 'W83', 'W84',  '2026-07-06 16:00:00-03', 'AT&T Stadium, Dallas',                 'scheduled'),
-- M94: W81 × W82
('round_of_16', NULL, NULL, 'W81', 'W82',  '2026-07-06 21:00:00-03', 'Lumen Field, Seattle',                 'scheduled'),
-- M95: W86 × W88
('round_of_16', NULL, NULL, 'W86', 'W88',  '2026-07-07 13:00:00-03', 'Mercedes-Benz Stadium, Atlanta',       'scheduled'),
-- M96: W85 × W87
('round_of_16', NULL, NULL, 'W85', 'W87',  '2026-07-07 17:00:00-03', 'BC Place, Vancouver',                  'scheduled');

-- ============================================================
-- QUARTAS DE FINAL (quarter) - 09/07 a 11/07
-- ============================================================

INSERT INTO matches (round, home_team_id, away_team_id, home_placeholder, away_placeholder, kickoff_time, venue, status) VALUES
-- M97: W89 × W90
('quarter', NULL, NULL, 'W89', 'W90',  '2026-07-09 17:00:00-03', 'Gillette Stadium, Boston',             'scheduled'),
-- M98: W93 × W94
('quarter', NULL, NULL, 'W93', 'W94',  '2026-07-10 16:00:00-03', 'SoFi Stadium, Los Angeles',            'scheduled'),
-- M99: W91 × W92
('quarter', NULL, NULL, 'W91', 'W92',  '2026-07-11 18:00:00-03', 'Hard Rock Stadium, Miami',             'scheduled'),
-- M100: W95 × W96
('quarter', NULL, NULL, 'W95', 'W96',  '2026-07-11 22:00:00-03', 'Arrowhead Stadium, Kansas City',       'scheduled');

-- ============================================================
-- SEMIFINAIS (semi) - 14/07 e 15/07
-- ============================================================

INSERT INTO matches (round, home_team_id, away_team_id, home_placeholder, away_placeholder, kickoff_time, venue, status) VALUES
-- M101 (SF1): W97 × W98
('semi', NULL, NULL, 'W97',  'W98',  '2026-07-14 16:00:00-03', 'AT&T Stadium, Dallas',                 'scheduled'),
-- M102 (SF2): W99 × W100
('semi', NULL, NULL, 'W99',  'W100', '2026-07-15 16:00:00-03', 'Mercedes-Benz Stadium, Atlanta',       'scheduled');

-- ============================================================
-- DISPUTA DE 3º LUGAR (third_place) - 18/07
-- ============================================================

INSERT INTO matches (round, home_team_id, away_team_id, home_placeholder, away_placeholder, kickoff_time, venue, status) VALUES
-- M103: Perdedor SF1 × Perdedor SF2
('third_place', NULL, NULL, 'LSF1', 'LSF2', '2026-07-18 18:00:00-03', 'Hard Rock Stadium, Miami',       'scheduled');

-- ============================================================
-- FINAL - 19/07
-- ============================================================

INSERT INTO matches (round, home_team_id, away_team_id, home_placeholder, away_placeholder, kickoff_time, venue, status) VALUES
-- M104: Vencedor SF1 × Vencedor SF2
('final', NULL, NULL, 'W101', 'W102', '2026-07-19 16:00:00-03', 'MetLife Stadium, Nova York',         'scheduled');

-- ============================================================
-- Verificação
-- ============================================================
-- Total esperado: 31 matches de mata-mata
-- SELECT count(*) FROM matches WHERE round != 'group';
--
-- Por fase:
-- SELECT round, count(*) FROM matches WHERE round != 'group'
-- GROUP BY round ORDER BY round;
--
-- Esperado:
--   round_of_32: 16
--   round_of_16: 8
--   quarter:     4
--   semi:        2
--   third_place: 1
--   final:       1