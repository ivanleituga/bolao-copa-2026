-- ============================================================
-- BOLÃO COPA 2026 - Migration 004: RPC pra editar mata-mata
-- ============================================================
-- Cria função que atualiza os times de um match de mata-mata e
-- limpa os palpites existentes atomicamente.
--
-- Casos de uso:
-- 1. Definir times pela primeira vez (match tem home_team_id/away_team_id NULL)
-- 2. Corrigir os times definidos (ex: admin errou no dropdown)
--
-- Em ambos os casos, palpites existentes daquele match são DELETADOS
-- (porque palpite pra jogo com times errados não faz sentido manter).
--
-- Usa SECURITY DEFINER pra poder deletar palpites de outros usuários
-- (a RLS normal de predictions só permite DELETE do próprio palpite).
-- Protegido por check de is_admin do chamador.
-- ============================================================

CREATE OR REPLACE FUNCTION update_knockout_match(
  p_match_id BIGINT,
  p_home_team_id BIGINT,
  p_away_team_id BIGINT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_match_status TEXT;
  v_kickoff TIMESTAMPTZ;
  v_deleted_count INT;
BEGIN
  -- 1. Checa que o chamador é admin
  SELECT is_admin INTO v_is_admin
  FROM profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Apenas administradores podem editar confrontos de mata-mata'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Valida que os times são diferentes
  IF p_home_team_id = p_away_team_id THEN
    RAISE EXCEPTION 'Times de casa e visitante devem ser diferentes';
  END IF;

  -- 3. Pega status e kickoff do match (e trava a linha pra evitar corrida)
  SELECT status, kickoff_time INTO v_match_status, v_kickoff
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match não encontrado: %', p_match_id;
  END IF;

  -- 4. Valida que jogo ainda é editável (não começou nem foi finalizado)
  IF v_match_status != 'scheduled' THEN
    RAISE EXCEPTION 'Jogo não está mais agendado (status atual: %)', v_match_status;
  END IF;

  IF v_kickoff <= NOW() THEN
    RAISE EXCEPTION 'Jogo já começou — não é possível editar o confronto';
  END IF;

  -- 5. Deleta palpites existentes daquele match (se houver)
  DELETE FROM predictions WHERE match_id = p_match_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- 6. Atualiza os times
  UPDATE matches
  SET home_team_id = p_home_team_id,
      away_team_id = p_away_team_id
  WHERE id = p_match_id;

  -- 7. Retorna info pro frontend
  RETURN json_build_object(
    'match_id', p_match_id,
    'home_team_id', p_home_team_id,
    'away_team_id', p_away_team_id,
    'deleted_predictions', v_deleted_count
  );
END;
$$;

-- Permite que usuários autenticados chamem a função
-- (a função em si checa se é admin via profiles.is_admin)
GRANT EXECUTE ON FUNCTION update_knockout_match(BIGINT, BIGINT, BIGINT) TO authenticated;

-- ============================================================
-- Uso no frontend:
--
-- const { data, error } = await supabase.rpc('update_knockout_match', {
--   p_match_id: 42,
--   p_home_team_id: 10,
--   p_away_team_id: 20,
-- })
--
-- data = { match_id: 42, home_team_id: 10, away_team_id: 20, deleted_predictions: 3 }
-- ============================================================