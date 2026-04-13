-- =============================================
-- BOLÃO COPA 2026 - Seed: 48 Seleções (CORRIGIDO)
-- =============================================
-- Fonte: FIFA / Yahoo Sports (abril 2026)
-- Todos os 48 times confirmados após playoffs de março 2026
-- Códigos FIFA oficiais (3 letras)
-- Bandeiras de Escócia e Inglaterra removidas (emoji não suportado universalmente)
-- No frontend usaremos imagens de bandeira via CDN (ex: flagcdn.com) pelo código do time

INSERT INTO teams (name, code, group_letter, flag_emoji) VALUES
-- GRUPO A
('México',                'MEX', 'A', '🇲🇽'),
('África do Sul',         'RSA', 'A', '🇿🇦'),
('Coreia do Sul',         'KOR', 'A', '🇰🇷'),
('Tchéquia',              'CZE', 'A', '🇨🇿'),

-- GRUPO B
('Canadá',                'CAN', 'B', '🇨🇦'),
('Bósnia e Herzegovina',  'BIH', 'B', '🇧🇦'),
('Catar',                 'QAT', 'B', '🇶🇦'),
('Suíça',                 'SUI', 'B', '🇨🇭'),

-- GRUPO C
('Brasil',                'BRA', 'C', '🇧🇷'),
('Marrocos',              'MAR', 'C', '🇲🇦'),
('Haiti',                 'HAI', 'C', '🇭🇹'),
('Escócia',               'SCO', 'C', NULL),

-- GRUPO D
('Estados Unidos',        'USA', 'D', '🇺🇸'),
('Paraguai',              'PAR', 'D', '🇵🇾'),
('Austrália',             'AUS', 'D', '🇦🇺'),
('Turquia',               'TUR', 'D', '🇹🇷'),

-- GRUPO E
('Alemanha',              'GER', 'E', '🇩🇪'),
('Curaçao',               'CUW', 'E', '🇨🇼'),
('Costa do Marfim',       'CIV', 'E', '🇨🇮'),
('Equador',               'ECU', 'E', '🇪🇨'),

-- GRUPO F
('Holanda',               'NED', 'F', '🇳🇱'),
('Japão',                 'JPN', 'F', '🇯🇵'),
('Suécia',                'SWE', 'F', '🇸🇪'),
('Tunísia',               'TUN', 'F', '🇹🇳'),

-- GRUPO G
('Bélgica',               'BEL', 'G', '🇧🇪'),
('Egito',                 'EGY', 'G', '🇪🇬'),
('Irã',                   'IRN', 'G', '🇮🇷'),
('Nova Zelândia',         'NZL', 'G', '🇳🇿'),

-- GRUPO H
('Espanha',               'ESP', 'H', '🇪🇸'),
('Cabo Verde',            'CPV', 'H', '🇨🇻'),
('Arábia Saudita',        'KSA', 'H', '🇸🇦'),
('Uruguai',               'URU', 'H', '🇺🇾'),

-- GRUPO I
('França',                'FRA', 'I', '🇫🇷'),
('Senegal',               'SEN', 'I', '🇸🇳'),
('Iraque',                'IRQ', 'I', '🇮🇶'),
('Noruega',               'NOR', 'I', '🇳🇴'),

-- GRUPO J
('Argentina',             'ARG', 'J', '🇦🇷'),
('Argélia',               'ALG', 'J', '🇩🇿'),
('Áustria',               'AUT', 'J', '🇦🇹'),
('Jordânia',              'JOR', 'J', '🇯🇴'),

-- GRUPO K
('Portugal',              'POR', 'K', '🇵🇹'),
('RD Congo',              'COD', 'K', '🇨🇩'),
('Uzbequistão',           'UZB', 'K', '🇺🇿'),
('Colômbia',              'COL', 'K', '🇨🇴'),

-- GRUPO L
('Inglaterra',            'ENG', 'L', NULL),
('Croácia',               'CRO', 'L', '🇭🇷'),
('Gana',                  'GHA', 'L', '🇬🇭'),
('Panamá',                'PAN', 'L', '🇵🇦');