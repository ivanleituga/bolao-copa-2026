-- ============================================================
-- BOLÃO COPA 2026 - Migration 007: RLS endurecida em special_predictions
-- ============================================================
-- Antes: qualquer usuário logado via SELECT em special_predictions com
-- USING (true) — ou seja, podia ver "campeão / artilheiro" alheio antes
-- do deadline. Permite "espiar e copiar" antes da Copa começar.
--
-- Depois: SELECT permitido SE
--   - É o próprio palpite (user_id = auth.uid())              — sempre OK
--   - OU o deadline da pergunta passou (deadline <= NOW())     — público após deadline
--   - OU é admin                                                — bypass
--
-- Mesmo padrão da policy de SELECT em predictions (migrations 005/006).
-- ============================================================

DROP POLICY IF EXISTS "Palpites especiais visíveis para todos logados"
  ON special_predictions;

CREATE POLICY "Palpites especiais visíveis após deadline ou pra dono/admin"
  ON special_predictions FOR SELECT
  TO authenticated
  USING (
    -- 1. Próprio palpite: dono sempre vê o que palpitou
    (SELECT auth.uid()) = user_id

    -- 2. Deadline da pergunta passou: palpite vira público
    OR EXISTS (
      SELECT 1 FROM special_questions
      WHERE special_questions.id = special_predictions.question_id
        AND special_questions.deadline <= NOW()
    )

    -- 3. Admin vê tudo (necessário pro Admin.jsx mostrar respostas
    --    agrupadas no painel de gerenciamento de perguntas especiais)
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = TRUE
    )
  );

-- ============================================================
-- Notas:
--
-- 1. A view `ranking` continua funcionando porque ela soma
--    special_points via JOIN com special_predictions, e roda como
--    owner (sem aplicar RLS).
--
-- 2. O componente SpecialPredictions.jsx (na aba Palpites) sempre
--    filtra por .eq('user_id', userId), então só puxa os do próprio.
--    Cláusula 1 cobre, sem mudanças necessárias.
--
-- 3. O Admin.jsx puxa todos os special_predictions sem filtro.
--    Cláusula 3 (admin) cobre.
-- ============================================================