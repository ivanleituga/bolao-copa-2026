-- BOLÃO COPA 2026 - Migration 011: Privacidade de palpites + participação
-- ============================================================
-- Três mudanças coordenadas pra resolver a UX de "ver participação
-- sem ver conteúdo":
--
-- 1. RLS de special_predictions ganha mais uma cláusula:
--    libera leitura quando correct_answer da pergunta foi definida.
--    Motivo: ao definir resposta correta, faz sentido revelar palpites
--    (a resposta deixou de ser confidencial via ranking).
--
-- 2. Nova RPC `match_participation(match_id)` que retorna apenas os
--    user_ids que palpitaram num jogo específico, sem revelar placares.
--    Usada pelo MatchPredictionsModal pra mostrar "X/Y palpitaram"
--    antes do jogo começar, sem violar privacidade.
--
-- 3. Nova RPC `special_question_participation(question_id)` análoga,
--    pros palpites especiais. Usada no Admin pra mostrar quem ainda
--    não respondeu antes do prazo, sem revelar respostas.
--
-- Ambas as RPCs rodam com SECURITY DEFINER + SET search_path = public
-- (padrão do projeto). Retornam só identificadores, sem dados sensíveis.
-- ============================================================

-- ============================================================
-- PARTE 1: RLS de special_predictions com correct_answer
-- ============================================================

DROP POLICY IF EXISTS "Palpites especiais visíveis após deadline ou pra dono/admin"
  ON special_predictions;

CREATE POLICY "Palpites especiais visíveis após deadline, correct_answer, ou pra dono/admin"
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

    -- 3. Admin
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = TRUE
    )
  );

-- ============================================================
-- PARTE 2: RPC match_participation
-- ============================================================
-- Retorna user_ids que palpitaram num jogo específico, sem revelar
-- placar. Usada pra mostrar "X/Y palpitaram" antes do jogo começar.
--
-- SECURITY DEFINER porque precisa escapar da RLS de predictions
-- (que só revela palpite alheio depois do início do jogo).
-- Retorna apenas user_id — nenhum dado sensível vaza.

CREATE OR REPLACE FUNCTION match_participation(p_match_id BIGINT)
RETURNS TABLE(user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Qualquer usuário autenticado pode chamar.
  -- Apenas verifica que está logado (auth.uid() não-nulo).
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  RETURN QUERY
    SELECT p.user_id
    FROM predictions p
    WHERE p.match_id = p_match_id;
END;
$$;

-- Permite chamadas pela API
GRANT EXECUTE ON FUNCTION match_participation(BIGINT) TO authenticated;

-- ============================================================
-- PARTE 3: RPC special_question_participation
-- ============================================================
-- Análoga à de match, pra perguntas especiais. Retorna user_ids
-- que responderam, sem revelar resposta.

CREATE OR REPLACE FUNCTION special_question_participation(p_question_id BIGINT)
RETURNS TABLE(user_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  RETURN QUERY
    SELECT sp.user_id
    FROM special_predictions sp
    WHERE sp.question_id = p_question_id;
END;
$$;

GRANT EXECUTE ON FUNCTION special_question_participation(BIGINT) TO authenticated;

-- ============================================================
-- Verificação:
--
-- Teste 1 — Policy atualizada de special_predictions:
--   SELECT polname FROM pg_policy
--   WHERE polrelid = 'special_predictions'::regclass;
--   -- Deve listar a policy "...após deadline, correct_answer, ou..."
--
-- Teste 2 — match_participation:
--   SELECT * FROM match_participation(73);
--   -- Esperado: lista de user_ids que palpitaram no jogo 73
--
-- Teste 3 — special_question_participation:
--   SELECT * FROM special_question_participation(1);
--   -- Esperado: lista de user_ids que responderam à pergunta 1
--
-- Teste 4 — Como Bruno (não-admin), antes do deadline da pergunta 1,
-- sem correct_answer: ainda não consegue ver respostas alheias
--   SET LOCAL ROLE authenticated;
--   SET LOCAL "request.jwt.claims" TO '{"sub":"UUID_BRUNO","role":"authenticated"}';
--   SELECT answer FROM special_predictions WHERE question_id = 1 AND user_id != (SELECT auth.uid());
--   -- Esperado: 0 linhas (RLS bloqueando)
--   -- Mas a RPC ainda funciona:
--   SELECT * FROM special_question_participation(1);
--   -- Esperado: lista de user_ids (sem revelar respostas)
--   RESET ROLE;
-- ============================================================
