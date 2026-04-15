-- ============================================================
-- BOLÃO COPA 2026 - Migration 002: Sistema de Pontuação
-- ============================================================
-- Rodar no SQL Editor do Supabase após 001_schema.sql
--
-- Pontuação base (antes do multiplicador):
--   Placar exato:              15 pts
--   Vitória + saldo de gols:   12 pts
--   Vitória + gols de um time:  9 pts
--   Apenas vencedor:            6 pts
--   Empate não exato:           7 pts
--   Palpite estimulado:         2 pts
--   Errou:                      0 pts
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
    WHEN 'third_place' THEN 5
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

  -- 1. Placar exato → 15 pts
  IF pred_home = actual_home AND pred_away = actual_away THEN
    RETURN 15;
  END IF;

  -- 2. Apostou em empate
  IF pred_result = 'draw' THEN
    IF actual_result = 'draw' THEN
      RETURN 7;    -- Empate não exato
    ELSE
      RETURN 2;    -- Palpite estimulado
    END IF;
  END IF;

  -- 3. Apostou em vencedor
  IF pred_result = actual_result THEN
    -- Saldo de gols correto → 12
    IF (actual_home - actual_away) = (pred_home - pred_away) THEN
      RETURN 12;
    END IF;

    -- Gols do vencedor ou do perdedor corretos → 9
    IF pred_home = actual_home OR pred_away = actual_away THEN
      RETURN 9;
    END IF;

    -- Apenas vencedor → 6
    RETURN 6;
  END IF;

  -- 4. Errou tudo
  RETURN 0;
END;
$$;

-- 4. Função que o admin chama ao inserir resultado de um jogo
--    Verifica se o chamador é admin antes de executar
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
  v_is_admin BOOLEAN;
BEGIN
  -- Verifica se o chamador é admin
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar resultados';
  END IF;

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

-- 5. Função que o admin chama para reverter um resultado
--    Volta o jogo para "scheduled" e zera os pontos dos palpites
CREATE OR REPLACE FUNCTION reset_match_result(p_match_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem reverter resultados';
  END IF;

  UPDATE matches
  SET home_score = NULL,
      away_score = NULL,
      status = 'scheduled'
  WHERE id = p_match_id;

  UPDATE predictions
  SET points = NULL
  WHERE match_id = p_match_id;
END;
$$;

-- 6. View útil: ranking geral dos participantes
CREATE OR REPLACE VIEW ranking AS
SELECT
  p.id AS profile_id,
  p.display_name,
  COALESCE(SUM(pr.points), 0) AS total_points,
  COUNT(CASE WHEN pr.points > 0 THEN 1 END) AS total_acertos,
  COUNT(CASE WHEN pr.points = (
    15 * get_round_multiplier(m.round)
  ) THEN 1 END) AS cravadas,
  COUNT(pr.id) AS total_palpites
FROM profiles p
LEFT JOIN predictions pr ON pr.user_id = p.id
LEFT JOIN matches m ON m.id = pr.match_id AND m.status = 'finished'
GROUP BY p.id, p.display_name
ORDER BY total_points DESC, cravadas DESC, total_acertos DESC;

-- ============================================================
-- Uso pelo admin (via tela de admin ou SQL Editor):
--
--   SELECT process_match_result(1, 3, 1);
--   -- Jogo id=1 terminou 3x1, todos os palpites são recalculados
--
-- Consultar ranking:
--   SELECT * FROM ranking;
--
-- Verificação da pontuação:
--   SELECT calc_prediction_points(2, 1, 2, 1);  -- 15 (exato)
--   SELECT calc_prediction_points(3, 2, 2, 1);  -- 12 (saldo)
--   SELECT calc_prediction_points(2, 0, 2, 1);  -- 9  (gols vencedor)
--   SELECT calc_prediction_points(3, 1, 2, 1);  -- 9  (gols perdedor)
--   SELECT calc_prediction_points(3, 0, 2, 1);  -- 6  (só vencedor)
--   SELECT calc_prediction_points(1, 1, 2, 1);  -- 2  (estimulado)
--   SELECT calc_prediction_points(0, 0, 1, 1);  -- 7  (empate não exato)
--   SELECT calc_prediction_points(0, 1, 2, 1);  -- 0  (errou)
-- ============================================================