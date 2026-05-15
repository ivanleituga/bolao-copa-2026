-- ============================================================
-- BOLÃO COPA 2026 - Migration 014: Privacidade do admin no SELECT
-- ============================================================
-- Decisão de produto: o admin não deve ver palpites alheios através
-- da interface do app antes do palpite ser "tornado público" (kickoff
-- do jogo ou definição de resposta correta).
--
-- Embora o admin tenha acesso técnico ao banco (via Supabase Studio
-- ou SQL Editor), a interface não deve colocá-lo numa posição de
-- "informação privilegiada visível na cara". Pra um bolão com
-- dinheiro envolvido, isso é importante pra integridade percebida.
--
-- Esta migration:
--   1. Remove o bypass admin de SELECT em `predictions`
--   2. Remove o bypass admin de SELECT em `special_predictions`
--   3. Cria RPC `match_predictions_counts` pra Admin contar palpites
--      por match sem violar a privacidade (retorna só count, não os
--      palpites em si)
--
-- IMPORTANTE: policies de INSERT/UPDATE/DELETE não são tocadas.
-- O admin continua administrando o banco via RPCs (process_match_result,
-- reset_match_result, update_knockout_match) e via Studio com
-- service_role.
--
-- Pra ver respostas individuais antes do prazo (debug/auditoria),
-- usar receitas SQL em supabase/scripts/.
-- ============================================================

-- ============================================================
-- PARTE 1: Predictions — remove bypass admin
-- ============================================================
-- Antes (migration 006): SELECT permitido se próprio OR jogo iniciado/finalizado OR admin
-- Depois: SELECT permitido se próprio OR jogo iniciado/finalizado

DROP POLICY IF EXISTS "Palpites visíveis após início ou finalização ou pra dono/admin"
  ON predictions;

CREATE POLICY "Palpites visíveis após início ou finalização ou pra dono"
  ON predictions FOR SELECT
  TO authenticated
  USING (
    -- 1. Próprio palpite
    (SELECT auth.uid()) = user_id

    -- 2. Jogo já começou OU foi finalizado: palpite vira público
    OR EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = predictions.match_id
        AND (
          matches.kickoff_time <= NOW()
          OR matches.status = 'finished'
        )
    )
  );


-- ============================================================
-- PARTE 2: Special predictions — remove bypass admin
-- ============================================================
-- Antes (migration 011): SELECT permitido se próprio OR deadline/correct_answer OR admin
-- Depois: SELECT permitido se próprio OR deadline/correct_answer

DROP POLICY IF EXISTS "Palpites especiais visíveis após deadline, correct_answer, ou pra dono/admin"
  ON special_predictions;

CREATE POLICY "Palpites especiais visíveis após deadline, correct_answer, ou pra dono"
  ON special_predictions FOR SELECT
  TO authenticated
  USING (
    -- 1. Próprio palpite
    (SELECT auth.uid()) = user_id

    -- 2. Deadline passou OU resposta correta definida
    OR EXISTS (
      SELECT 1 FROM special_questions
      WHERE special_questions.id = special_predictions.question_id
        AND (
          special_questions.deadline <= NOW()
          OR special_questions.correct_answer IS NOT NULL
        )
    )
  );


-- ============================================================
-- PARTE 3: RPC pra Admin contar palpites por match
-- ============================================================
-- Justificativa: o Admin precisa saber quantos palpites cada jogo
-- de mata-mata tem antes de alterar o confronto (pra avisar o admin
-- "vai deletar X palpites"). Sem o bypass admin do SELECT, a query
-- `select('match_id') from predictions` retorna 0 pra jogos não
-- iniciados.
--
-- Solução: RPC `match_predictions_counts` que só admin pode chamar.
-- Retorna agregado (match_id, count) sem expor os palpites em si.
-- Privacidade preservada — só conta, não lista.

CREATE OR REPLACE FUNCTION match_predictions_counts()
RETURNS TABLE(match_id BIGINT, predictions_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
  caller_is_admin BOOLEAN;
BEGIN
  caller_id := auth.uid();

  -- Só admin pode contar. auth.uid() NULL = SQL Editor/service_role,
  -- também liberado (igual padrão das outras funções do projeto).
  IF caller_id IS NOT NULL THEN
    SELECT is_admin INTO caller_is_admin
    FROM profiles
    WHERE id = caller_id;

    IF caller_is_admin IS NOT TRUE THEN
      RAISE EXCEPTION 'Apenas administradores podem chamar esta função'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN QUERY
    SELECT p.match_id, COUNT(*)::BIGINT
    FROM predictions p
    GROUP BY p.match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION match_predictions_counts() TO authenticated;


-- ============================================================
-- Verificação:
--
-- 1. Confirma policies atualizadas:
--      SELECT polname FROM pg_policy
--      WHERE polrelid IN ('predictions'::regclass, 'special_predictions'::regclass);
--    Esperado: as novas policies (sem "admin" no nome), sem as antigas.
--
-- 2. Como admin (Ivan), antes do deadline e sem correct_answer:
--      SELECT * FROM special_predictions WHERE user_id != auth.uid();
--    Esperado: 0 linhas (não vê mais palpites alheios pela API).
--
-- 3. Mesma consulta no SQL Editor (sem ROLE):
--    Retorna tudo normalmente — service_role ignora RLS.
--
-- 4. match_predictions_counts:
--      SELECT * FROM match_predictions_counts() ORDER BY predictions_count DESC LIMIT 10;
--    Esperado: lista de matches com mais palpites.
-- ============================================================