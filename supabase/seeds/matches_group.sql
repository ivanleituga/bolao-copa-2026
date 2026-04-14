-- ============================================================
-- Copa do Mundo 2026 - Seed: Jogos da Fase de Grupos
-- 72 jogos (12 grupos × 6 jogos cada)
-- Horários em fuso de Brasília (UTC-3)
-- Fonte: ESPN Brasil + FIFA.com
-- ============================================================
-- ATENÇÃO: A tabela matches já existe (criada em 001_schema.sql).
-- Este script usa subquery (SELECT id FROM teams WHERE code = 'XXX')
-- para referenciar os IDs das seleções.
-- ============================================================

-- Limpar jogos anteriores (caso re-execute)
DELETE FROM matches WHERE round = 'group';

-- ============================================================
-- 1ª RODADA (11/06 a 17/06)
-- ============================================================

-- GRUPO A
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('A', 'group', (SELECT id FROM teams WHERE code = 'MEX'), (SELECT id FROM teams WHERE code = 'RSA'), '2026-06-11 16:00:00-03', 'Estádio Azteca, Cidade do México'),
('A', 'group', (SELECT id FROM teams WHERE code = 'KOR'), (SELECT id FROM teams WHERE code = 'CZE'), '2026-06-11 23:00:00-03', 'Estádio Akron, Guadalajara');

-- GRUPO B
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('B', 'group', (SELECT id FROM teams WHERE code = 'CAN'), (SELECT id FROM teams WHERE code = 'BIH'), '2026-06-12 16:00:00-03', 'BMO Field, Toronto'),
('B', 'group', (SELECT id FROM teams WHERE code = 'QAT'), (SELECT id FROM teams WHERE code = 'SUI'), '2026-06-13 16:00:00-03', 'Levi''s Stadium, San Francisco');

-- GRUPO D (antes do C por ordem cronológica)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('D', 'group', (SELECT id FROM teams WHERE code = 'USA'), (SELECT id FROM teams WHERE code = 'PAR'), '2026-06-12 22:00:00-03', 'SoFi Stadium, Los Angeles');

-- GRUPO D (madrugada 13/06)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('D', 'group', (SELECT id FROM teams WHERE code = 'AUS'), (SELECT id FROM teams WHERE code = 'TUR'), '2026-06-13 01:00:00-03', 'BC Place, Vancouver');

-- GRUPO C
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('C', 'group', (SELECT id FROM teams WHERE code = 'BRA'), (SELECT id FROM teams WHERE code = 'MAR'), '2026-06-13 19:00:00-03', 'MetLife Stadium, Nova York'),
('C', 'group', (SELECT id FROM teams WHERE code = 'HAI'), (SELECT id FROM teams WHERE code = 'SCO'), '2026-06-13 22:00:00-03', 'Gillette Stadium, Boston');

-- GRUPO E
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('E', 'group', (SELECT id FROM teams WHERE code = 'GER'), (SELECT id FROM teams WHERE code = 'CUW'), '2026-06-14 14:00:00-03', 'NRG Stadium, Houston'),
('E', 'group', (SELECT id FROM teams WHERE code = 'CIV'), (SELECT id FROM teams WHERE code = 'ECU'), '2026-06-14 20:00:00-03', 'Lincoln Financial Field, Filadélfia');

-- GRUPO F
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('F', 'group', (SELECT id FROM teams WHERE code = 'NED'), (SELECT id FROM teams WHERE code = 'JPN'), '2026-06-14 17:00:00-03', 'AT&T Stadium, Dallas'),
('F', 'group', (SELECT id FROM teams WHERE code = 'SWE'), (SELECT id FROM teams WHERE code = 'TUN'), '2026-06-14 23:00:00-03', 'Estadio BBVA, Monterrey');

-- GRUPO H (antes do G por ordem cronológica do dia 15)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('H', 'group', (SELECT id FROM teams WHERE code = 'ESP'), (SELECT id FROM teams WHERE code = 'CPV'), '2026-06-15 13:00:00-03', 'Mercedes-Benz Stadium, Atlanta');

-- GRUPO G
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('G', 'group', (SELECT id FROM teams WHERE code = 'BEL'), (SELECT id FROM teams WHERE code = 'EGY'), '2026-06-15 16:00:00-03', 'Lumen Field, Seattle');

-- GRUPO H
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('H', 'group', (SELECT id FROM teams WHERE code = 'KSA'), (SELECT id FROM teams WHERE code = 'URU'), '2026-06-15 19:00:00-03', 'Hard Rock Stadium, Miami');

-- GRUPO G
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('G', 'group', (SELECT id FROM teams WHERE code = 'IRN'), (SELECT id FROM teams WHERE code = 'NZL'), '2026-06-15 22:00:00-03', 'SoFi Stadium, Los Angeles');

-- GRUPO I
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('I', 'group', (SELECT id FROM teams WHERE code = 'FRA'), (SELECT id FROM teams WHERE code = 'SEN'), '2026-06-16 16:00:00-03', 'MetLife Stadium, Nova York'),
('I', 'group', (SELECT id FROM teams WHERE code = 'IRQ'), (SELECT id FROM teams WHERE code = 'NOR'), '2026-06-16 19:00:00-03', 'Gillette Stadium, Boston');

-- GRUPO J
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('J', 'group', (SELECT id FROM teams WHERE code = 'ARG'), (SELECT id FROM teams WHERE code = 'ALG'), '2026-06-16 22:00:00-03', 'Arrowhead Stadium, Kansas City');

INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('J', 'group', (SELECT id FROM teams WHERE code = 'AUT'), (SELECT id FROM teams WHERE code = 'JOR'), '2026-06-17 01:00:00-03', 'Levi''s Stadium, San Francisco');

-- GRUPO K
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('K', 'group', (SELECT id FROM teams WHERE code = 'POR'), (SELECT id FROM teams WHERE code = 'COD'), '2026-06-17 14:00:00-03', 'NRG Stadium, Houston');

-- GRUPO L
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('L', 'group', (SELECT id FROM teams WHERE code = 'ENG'), (SELECT id FROM teams WHERE code = 'CRO'), '2026-06-17 17:00:00-03', 'AT&T Stadium, Dallas'),
('L', 'group', (SELECT id FROM teams WHERE code = 'GHA'), (SELECT id FROM teams WHERE code = 'PAN'), '2026-06-17 20:00:00-03', 'BMO Field, Toronto');

-- GRUPO K
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('K', 'group', (SELECT id FROM teams WHERE code = 'UZB'), (SELECT id FROM teams WHERE code = 'COL'), '2026-06-17 23:00:00-03', 'Estádio Azteca, Cidade do México');

-- ============================================================
-- 2ª RODADA (18/06 a 23/06)
-- ============================================================

-- GRUPO A
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('A', 'group', (SELECT id FROM teams WHERE code = 'CZE'), (SELECT id FROM teams WHERE code = 'RSA'), '2026-06-18 13:00:00-03', 'Mercedes-Benz Stadium, Atlanta'),
('A', 'group', (SELECT id FROM teams WHERE code = 'MEX'), (SELECT id FROM teams WHERE code = 'KOR'), '2026-06-18 22:00:00-03', 'Estádio Akron, Guadalajara');

-- GRUPO B
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('B', 'group', (SELECT id FROM teams WHERE code = 'SUI'), (SELECT id FROM teams WHERE code = 'BIH'), '2026-06-18 16:00:00-03', 'SoFi Stadium, Los Angeles'),
('B', 'group', (SELECT id FROM teams WHERE code = 'CAN'), (SELECT id FROM teams WHERE code = 'QAT'), '2026-06-18 19:00:00-03', 'BC Place, Vancouver');

-- GRUPO D (madrugada 19/06)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('D', 'group', (SELECT id FROM teams WHERE code = 'TUR'), (SELECT id FROM teams WHERE code = 'PAR'), '2026-06-19 01:00:00-03', 'Levi''s Stadium, San Francisco');

-- GRUPO D
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('D', 'group', (SELECT id FROM teams WHERE code = 'USA'), (SELECT id FROM teams WHERE code = 'AUS'), '2026-06-19 16:00:00-03', 'Lumen Field, Seattle');

-- GRUPO C
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('C', 'group', (SELECT id FROM teams WHERE code = 'SCO'), (SELECT id FROM teams WHERE code = 'MAR'), '2026-06-19 19:00:00-03', 'Gillette Stadium, Boston'),
('C', 'group', (SELECT id FROM teams WHERE code = 'BRA'), (SELECT id FROM teams WHERE code = 'HAI'), '2026-06-19 22:00:00-03', 'Lincoln Financial Field, Filadélfia');

-- GRUPO F
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('F', 'group', (SELECT id FROM teams WHERE code = 'NED'), (SELECT id FROM teams WHERE code = 'SWE'), '2026-06-20 14:00:00-03', 'NRG Stadium, Houston');

-- GRUPO E
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('E', 'group', (SELECT id FROM teams WHERE code = 'GER'), (SELECT id FROM teams WHERE code = 'CIV'), '2026-06-20 17:00:00-03', 'BMO Field, Toronto'),
('E', 'group', (SELECT id FROM teams WHERE code = 'ECU'), (SELECT id FROM teams WHERE code = 'CUW'), '2026-06-20 21:00:00-03', 'Arrowhead Stadium, Kansas City');

-- GRUPO F (madrugada 21/06)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('F', 'group', (SELECT id FROM teams WHERE code = 'TUN'), (SELECT id FROM teams WHERE code = 'JPN'), '2026-06-21 01:00:00-03', 'Estadio BBVA, Monterrey');

-- GRUPO H
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('H', 'group', (SELECT id FROM teams WHERE code = 'ESP'), (SELECT id FROM teams WHERE code = 'KSA'), '2026-06-21 13:00:00-03', 'Mercedes-Benz Stadium, Atlanta');

-- GRUPO G
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('G', 'group', (SELECT id FROM teams WHERE code = 'BEL'), (SELECT id FROM teams WHERE code = 'IRN'), '2026-06-21 16:00:00-03', 'SoFi Stadium, Los Angeles');

-- GRUPO H
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('H', 'group', (SELECT id FROM teams WHERE code = 'URU'), (SELECT id FROM teams WHERE code = 'CPV'), '2026-06-21 19:00:00-03', 'Hard Rock Stadium, Miami');

-- GRUPO G
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('G', 'group', (SELECT id FROM teams WHERE code = 'NZL'), (SELECT id FROM teams WHERE code = 'EGY'), '2026-06-21 22:00:00-03', 'BC Place, Vancouver');

-- GRUPO J
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('J', 'group', (SELECT id FROM teams WHERE code = 'ARG'), (SELECT id FROM teams WHERE code = 'AUT'), '2026-06-22 14:00:00-03', 'AT&T Stadium, Dallas');

-- GRUPO I
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('I', 'group', (SELECT id FROM teams WHERE code = 'FRA'), (SELECT id FROM teams WHERE code = 'IRQ'), '2026-06-22 18:00:00-03', 'Lincoln Financial Field, Filadélfia'),
('I', 'group', (SELECT id FROM teams WHERE code = 'NOR'), (SELECT id FROM teams WHERE code = 'SEN'), '2026-06-22 21:00:00-03', 'MetLife Stadium, Nova York');

-- GRUPO J (meia-noite 23/06)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('J', 'group', (SELECT id FROM teams WHERE code = 'JOR'), (SELECT id FROM teams WHERE code = 'ALG'), '2026-06-23 00:00:00-03', 'Levi''s Stadium, San Francisco');

-- GRUPO K
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('K', 'group', (SELECT id FROM teams WHERE code = 'POR'), (SELECT id FROM teams WHERE code = 'UZB'), '2026-06-23 14:00:00-03', 'NRG Stadium, Houston');

-- GRUPO L
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('L', 'group', (SELECT id FROM teams WHERE code = 'ENG'), (SELECT id FROM teams WHERE code = 'GHA'), '2026-06-23 17:00:00-03', 'Gillette Stadium, Boston'),
('L', 'group', (SELECT id FROM teams WHERE code = 'PAN'), (SELECT id FROM teams WHERE code = 'CRO'), '2026-06-23 20:00:00-03', 'BMO Field, Toronto');

-- GRUPO K
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('K', 'group', (SELECT id FROM teams WHERE code = 'COL'), (SELECT id FROM teams WHERE code = 'COD'), '2026-06-23 23:00:00-03', 'Estádio Akron, Guadalajara');

-- ============================================================
-- 3ª RODADA (24/06 a 27/06) - Jogos simultâneos por grupo
-- ============================================================

-- GRUPO B (simultâneos 16h)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('B', 'group', (SELECT id FROM teams WHERE code = 'SUI'), (SELECT id FROM teams WHERE code = 'CAN'), '2026-06-24 16:00:00-03', 'BC Place, Vancouver'),
('B', 'group', (SELECT id FROM teams WHERE code = 'BIH'), (SELECT id FROM teams WHERE code = 'QAT'), '2026-06-24 16:00:00-03', 'Lumen Field, Seattle');

-- GRUPO C (simultâneos 19h)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('C', 'group', (SELECT id FROM teams WHERE code = 'SCO'), (SELECT id FROM teams WHERE code = 'BRA'), '2026-06-24 19:00:00-03', 'Hard Rock Stadium, Miami'),
('C', 'group', (SELECT id FROM teams WHERE code = 'MAR'), (SELECT id FROM teams WHERE code = 'HAI'), '2026-06-24 19:00:00-03', 'Mercedes-Benz Stadium, Atlanta');

-- GRUPO A (simultâneos 22h)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('A', 'group', (SELECT id FROM teams WHERE code = 'CZE'), (SELECT id FROM teams WHERE code = 'MEX'), '2026-06-24 22:00:00-03', 'Estádio Azteca, Cidade do México'),
('A', 'group', (SELECT id FROM teams WHERE code = 'RSA'), (SELECT id FROM teams WHERE code = 'KOR'), '2026-06-24 22:00:00-03', 'Estadio BBVA, Monterrey');

-- GRUPO E (simultâneos 17h)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('E', 'group', (SELECT id FROM teams WHERE code = 'ECU'), (SELECT id FROM teams WHERE code = 'GER'), '2026-06-25 17:00:00-03', 'MetLife Stadium, Nova York'),
('E', 'group', (SELECT id FROM teams WHERE code = 'CUW'), (SELECT id FROM teams WHERE code = 'CIV'), '2026-06-25 17:00:00-03', 'Lincoln Financial Field, Filadélfia');

-- GRUPO F (simultâneos 20h)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('F', 'group', (SELECT id FROM teams WHERE code = 'TUN'), (SELECT id FROM teams WHERE code = 'NED'), '2026-06-25 20:00:00-03', 'Arrowhead Stadium, Kansas City'),
('F', 'group', (SELECT id FROM teams WHERE code = 'JPN'), (SELECT id FROM teams WHERE code = 'SWE'), '2026-06-25 20:00:00-03', 'AT&T Stadium, Dallas');

-- GRUPO D (simultâneos 23h)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('D', 'group', (SELECT id FROM teams WHERE code = 'TUR'), (SELECT id FROM teams WHERE code = 'USA'), '2026-06-25 23:00:00-03', 'SoFi Stadium, Los Angeles'),
('D', 'group', (SELECT id FROM teams WHERE code = 'PAR'), (SELECT id FROM teams WHERE code = 'AUS'), '2026-06-25 23:00:00-03', 'Levi''s Stadium, San Francisco');

-- GRUPO I (simultâneos 16h)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('I', 'group', (SELECT id FROM teams WHERE code = 'NOR'), (SELECT id FROM teams WHERE code = 'FRA'), '2026-06-26 16:00:00-03', 'Gillette Stadium, Boston'),
('I', 'group', (SELECT id FROM teams WHERE code = 'SEN'), (SELECT id FROM teams WHERE code = 'IRQ'), '2026-06-26 16:00:00-03', 'BMO Field, Toronto');

-- GRUPO H (simultâneos 21h)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('H', 'group', (SELECT id FROM teams WHERE code = 'URU'), (SELECT id FROM teams WHERE code = 'ESP'), '2026-06-26 21:00:00-03', 'Estádio Akron, Guadalajara'),
('H', 'group', (SELECT id FROM teams WHERE code = 'CPV'), (SELECT id FROM teams WHERE code = 'KSA'), '2026-06-26 21:00:00-03', 'NRG Stadium, Houston');

-- GRUPO G (simultâneos 00h do dia 27)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('G', 'group', (SELECT id FROM teams WHERE code = 'EGY'), (SELECT id FROM teams WHERE code = 'IRN'), '2026-06-27 00:00:00-03', 'Lumen Field, Seattle'),
('G', 'group', (SELECT id FROM teams WHERE code = 'NZL'), (SELECT id FROM teams WHERE code = 'BEL'), '2026-06-27 00:00:00-03', 'BC Place, Vancouver');

-- GRUPO L (simultâneos 18h)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('L', 'group', (SELECT id FROM teams WHERE code = 'PAN'), (SELECT id FROM teams WHERE code = 'ENG'), '2026-06-27 18:00:00-03', 'MetLife Stadium, Nova York'),
('L', 'group', (SELECT id FROM teams WHERE code = 'CRO'), (SELECT id FROM teams WHERE code = 'GHA'), '2026-06-27 18:00:00-03', 'Lincoln Financial Field, Filadélfia');

-- GRUPO K (simultâneos 20h30)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('K', 'group', (SELECT id FROM teams WHERE code = 'COL'), (SELECT id FROM teams WHERE code = 'POR'), '2026-06-27 20:30:00-03', 'Hard Rock Stadium, Miami'),
('K', 'group', (SELECT id FROM teams WHERE code = 'COD'), (SELECT id FROM teams WHERE code = 'UZB'), '2026-06-27 20:30:00-03', 'Mercedes-Benz Stadium, Atlanta');

-- GRUPO J (simultâneos 23h)
INSERT INTO matches (group_letter, round, home_team_id, away_team_id, kickoff_time, venue) VALUES
('J', 'group', (SELECT id FROM teams WHERE code = 'JOR'), (SELECT id FROM teams WHERE code = 'ARG'), '2026-06-27 23:00:00-03', 'AT&T Stadium, Dallas'),
('J', 'group', (SELECT id FROM teams WHERE code = 'ALG'), (SELECT id FROM teams WHERE code = 'AUT'), '2026-06-27 23:00:00-03', 'Arrowhead Stadium, Kansas City');

-- ============================================================
-- Verificação
-- ============================================================
-- SELECT count(*) FROM matches WHERE round = 'group';
-- Esperado: 72
--
-- Jogos por grupo (deve dar 6 cada):
-- SELECT group_letter, count(*) FROM matches WHERE round = 'group'
-- GROUP BY group_letter ORDER BY group_letter;