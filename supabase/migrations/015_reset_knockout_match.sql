-- ============================================================
-- BOLÃO COPA 2026 - Migration 015: RPC pra resetar mata-mata
-- ============================================================
-- Cria função `reset_knockout_match` que faz o oposto do
-- `update_knockout_match`: zera os times de um confronto de mata-mata
-- (volta pros placeholders) e remove palpites existentes.
--
-- Casos de uso:
--   - Admin definiu times errados e quer recomeçar do zero
--   - Mudança de planos antes do início do jogo
--
-- Regras (idênticas ao update_knockout_match pra consistência):
--   1. Apenas admins podem chamar
--   2. Jogo precisa estar com status = 'scheduled'
--   3. Jogo ainda não pode ter começado (v_kickoff > NOW())
--
-- Não usa intervalo de 5 minutos — mesma trava de "v_kickoff <= NOW()"
-- que a update_knockout_match usa. Se um dia quiser mudar pra dar
-- margem, deve mudar nas duas RPCs juntas.
--
-- Usa SECURITY DEFINER pra poder deletar palpites de outros usuários
-- (a RLS normal de predictions só permite DELETE do próprio palpite).
-- ============================================================

CREATE OR REPLACE FUNCTION reset_knockout_match(
  p_match_id BIGINT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_match_status TEXT;
  v_kickoff TIMESTAMPTZ;
  v_round TEXT;
  v_deleted_count INT;
BEGIN
  -- 1. Checa que o chamador é admin
  SELECT is_admin INTO v_is_admin
  FROM profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Apenas administradores podem resetar confrontos de mata-mata'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Pega status, kickoff e round do match (e trava a linha pra evitar corrida)
  SELECT status, kickoff_time, round INTO v_match_status, v_kickoff, v_round
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match não encontrado: %', p_match_id;
  END IF;

  -- 3. Valida que é jogo de mata-mata (whitelist explícita — falha alto
  --    se um round desconhecido aparecer no futuro)
  IF v_round NOT IN ('round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final') THEN
    RAISE EXCEPTION 'Apenas jogos de mata-mata podem ser resetados (round atual: %)', v_round;
  END IF;

  -- 4. Valida que jogo ainda é editável (não começou nem foi finalizado)
  IF v_match_status != 'scheduled' THEN
    RAISE EXCEPTION 'Jogo não está mais agendado (status atual: %)', v_match_status;
  END IF;

  IF v_kickoff <= NOW() THEN
    RAISE EXCEPTION 'Jogo já começou — não é possível resetar o confronto';
  END IF;

  -- 5. Deleta palpites existentes daquele match (se houver)
  DELETE FROM predictions WHERE match_id = p_match_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- 6. Zera os times (volta pros placeholders) E zera placares por defesa.
  --    A validação de status='scheduled' já implica placar NULL em condições
  --    normais, mas limpar explicitamente protege contra estados estranhos
  --    deixados por testes manuais via SQL Editor ou bugs futuros.
  UPDATE matches
  SET home_team_id = NULL,
      away_team_id = NULL,
      home_score = NULL,
      away_score = NULL
  WHERE id = p_match_id;

  -- 7. Retorna info pro frontend
  RETURN json_build_object(
    'match_id', p_match_id,
    'home_team_id', NULL,
    'away_team_id', NULL,
    'deleted_predictions', v_deleted_count
  );
END;
$$;

-- Permite que usuários autenticados chamem a função
-- (a função em si checa se é admin via profiles.is_admin)
GRANT EXECUTE ON FUNCTION reset_knockout_match(BIGINT) TO authenticated;

-- ============================================================
-- Uso no frontend:
--
-- const { data, error } = await supabase.rpc('reset_knockout_match', {
--   p_match_id: 42,
-- })
--
-- data = { match_id: 42, home_team_id: null, away_team_id: null, deleted_predictions: 3 }
-- ============================================================