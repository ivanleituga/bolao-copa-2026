-- ============================================================
-- BOLÃO COPA 2026 - Migration 002: Sistema de Pontuação
-- ============================================================
-- Rodar no SQL Editor do Supabase após 001_schema.sql
-- ============================================================

-- 1. Adiciona coluna de pontos na tabela predictions
ALTER TABLE predictions ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT NULL;

-- 2. Função que retorna o multiplicador da fase
CREATE OR REPLACE FUNCTION get_round_multiplier(match_round TEXT)
RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN CASE match_round
    WHEN 'group'       THEN 1
    WHEN 'round_of_32' THEN 2
    WHEN 'round_of_16' THEN 3
    WHEN 'quarter'     THEN 4
    WHEN 'semi'        THEN 5
    WHEN 'third_place' THEN 6
    WHEN 'final'       THEN 6
    ELSE 1
  END;
END;
$$;

-- 3. Função que calcula os pontos de um palpite individual
CREATE OR REPLACE FUNCTION calc_prediction_points(
  pred_home INTEGER,
  pred_away INTEGER,
  actual_home INTEGER,
  actual_away INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  actual_result TEXT;
  pred_result TEXT;
  actual_diff INTEGER;
  pred_diff INTEGER;
BEGIN
  -- Determina resultado real
  IF actual_home > actual_away THEN actual_result := 'home';
  ELSIF actual_away > actual_home THEN actual_result := 'away';
  ELSE actual_result := 'draw';
  END IF;

  -- Determina resultado palpitado
  IF pred_home > pred_away THEN pred_result := 'home';
  ELSIF pred_away > pred_home THEN pred_result := 'away';
  ELSE pred_result := 'draw';
  END IF;

  -- 1. Placar exato → 10 pts
  IF pred_home = actual_home AND pred_away = actual_away THEN
    RETURN 10;
  END IF;

  -- 2. Apostou em empate
  IF pred_result = 'draw' THEN
    IF actual_result = 'draw' THEN
      RETURN 6;   -- Empate não exato
    ELSE
      RETURN 1;   -- Palpite estimulado
    END IF;
  END IF;

  -- 3. Apostou em vencedor
  IF pred_result = actual_result THEN
    actual_diff := actual_home - actual_away;
    pred_diff := pred_home - pred_away;

    -- Saldo de gols correto → 7
    IF actual_diff = pred_diff THEN
      RETURN 7;
    END IF;

    -- Gols do vencedor ou do perdedor corretos → 6
    IF pred_home = actual_home OR pred_away = actual_away THEN
      RETURN 6;
    END IF;

    -- Apenas vencedor → 5
    RETURN 5;
  END IF;

  -- 4. Errou tudo
  RETURN 0;
END;
$$;

-- 4. Função que o admin chama ao inserir resultado de um jogo
--    Atualiza o match e recalcula pontos de todos os palpites
CREATE OR REPLACE FUNCTION process_match_result(
  p_match_id INTEGER,
  p_home_score INTEGER,
  p_away_score INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_round TEXT;
  v_multiplier INTEGER;
BEGIN
  -- Atualiza o placar e status do jogo
  UPDATE matches
  SET home_score = p_home_score,
      away_score = p_away_score,
      status = 'finished'
  WHERE id = p_match_id;

  -- Busca a fase do jogo
  SELECT round INTO v_round FROM matches WHERE id = p_match_id;
  v_multiplier := get_round_multiplier(v_round);

  -- Recalcula pontos de todos os palpites desse jogo
  UPDATE predictions
  SET points = calc_prediction_points(home_score, away_score, p_home_score, p_away_score) * v_multiplier
  WHERE match_id = p_match_id;
END;
$$;

-- 5. View útil: ranking geral dos participantes
CREATE OR REPLACE VIEW ranking AS
SELECT
  p.id AS profile_id,
  p.display_name,
  COALESCE(SUM(pr.points), 0) AS total_points,
  COUNT(CASE WHEN pr.points > 0 THEN 1 END) AS total_acertos,
  COUNT(CASE WHEN pr.points = (
    10 * get_round_multiplier(m.round)
  ) THEN 1 END) AS cravadas,
  COUNT(pr.id) AS total_palpites
FROM profiles p
LEFT JOIN predictions pr ON pr.user_id = p.id
LEFT JOIN matches m ON m.id = pr.match_id AND m.status = 'finished'
GROUP BY p.id, p.display_name
ORDER BY total_points DESC, cravadas DESC, total_acertos DESC;

-- ============================================================
-- Uso pelo admin (via SQL Editor ou via app):
--
--   SELECT process_match_result(1, 3, 1);
--   -- Jogo id=1 terminou 3x1, todos os palpites são recalculados
--
-- Consultar ranking:
--   SELECT * FROM ranking;
-- ============================================================