-- ============================================================
-- BOLÃO COPA 2026 - Migration 009: Ajuste da pontuação base
-- ============================================================
-- Antes (002):
--   Placar exato:              15 pts
--   Vitória + saldo de gols:   12 pts
--   Vitória + gols de um time:  9 pts
--   Apenas vencedor:            6 pts
--   Empate não exato:           7 pts
--   Palpite estimulado:         2 pts
--
-- Depois:
--   Placar exato:              15 pts  (igual)
--   Vitória + saldo de gols:   11 pts  (era 12)
--   Vitória + gols de um time:  9 pts  (igual)
--   Apenas vencedor:            7 pts  (era 6)
--   Empate não exato:           7 pts  (igual)
--   Palpite estimulado:         2 pts  (igual)
--
-- Motivo: reduzir o "gradiente" entre acertos parciais. Com 12/9/6, a
-- diferença entre acerto medíocre (só vencedor) e acerto bom (vencedor +
-- diferença) é o dobro. Com 11/9/7 fica mais suave (1.57x), refletindo
-- melhor que parte dos acertos parciais é sorte. A cravada continua
-- destacada (15) e ganha gap maior pro próximo (4 em vez de 3).
--
-- IMPORTANTE: além de substituir a função, precisamos recalcular os
-- pontos dos palpites em jogos já finalizados, senão o ranking fica
-- inconsistente (alguns palpites teriam pontos calculados pela tabela
-- antiga, outros pela nova).
-- ============================================================

-- 1. Substitui a função com os novos valores
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

  -- 2. Apostou em empate (não exato — exato já caiu acima)
  IF pred_result = 'draw' THEN
    IF actual_result = 'draw' THEN
      RETURN 7;    -- Empate não exato
    ELSE
      RETURN 2;    -- Palpite estimulado
    END IF;
  END IF;

  -- 3. Apostou em vencedor e acertou o vencedor
  IF pred_result = actual_result THEN
    -- Saldo de gols correto → 11  (antes 12)
    IF (actual_home - actual_away) = (pred_home - pred_away) THEN
      RETURN 11;
    END IF;

    -- Gols do vencedor ou do perdedor corretos → 9
    IF pred_home = actual_home OR pred_away = actual_away THEN
      RETURN 9;
    END IF;

    -- Apenas vencedor → 7  (antes 6)
    RETURN 7;
  END IF;

  -- 4. Errou tudo
  RETURN 0;
END;
$$;

-- 2. Recalcula pontos de palpites em jogos já finalizados
-- Afeta apenas predictions associadas a matches com status='finished'.
-- Palpites em jogos não finalizados continuam NULL como antes.
UPDATE predictions p
SET points = calc_prediction_points(
  p.home_score,
  p.away_score,
  m.home_score,
  m.away_score
) * get_round_multiplier(m.round)
FROM matches m
WHERE p.match_id = m.id
  AND m.status = 'finished'
  AND m.home_score IS NOT NULL;

-- ============================================================
-- Verificação:
--
--   SELECT calc_prediction_points(2, 1, 2, 1);  -- 15 (exato)
--   SELECT calc_prediction_points(3, 2, 2, 1);  -- 11 (saldo, era 12)
--   SELECT calc_prediction_points(2, 0, 2, 1);  -- 9  (gols vencedor)
--   SELECT calc_prediction_points(3, 1, 2, 1);  -- 9  (gols perdedor)
--   SELECT calc_prediction_points(3, 0, 2, 1);  -- 7  (só vencedor, era 6)
--   SELECT calc_prediction_points(1, 1, 2, 1);  -- 2  (estimulado)
--   SELECT calc_prediction_points(0, 0, 1, 1);  -- 7  (empate não exato)
--   SELECT calc_prediction_points(0, 1, 2, 1);  -- 0  (errou)
--
-- Conferir ranking pós-recalculo:
--   SELECT * FROM ranking;
-- ============================================================