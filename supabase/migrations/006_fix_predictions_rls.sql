-- ============================================================
-- BOLÃO COPA 2026 - Migration 006: Fix RLS de SELECT em predictions
-- ============================================================
-- Bug encontrado na 005: a cláusula "kickoff_time <= NOW()" só libera
-- palpites de jogos que JÁ COMEÇARAM no relógio do banco. Mas o admin
-- pode marcar um jogo como 'finished' antes do kickoff (durante testes,
-- ou em casos reais de WO/cancelamento). Nesse caso, palpites do jogo
-- finalizado deveriam ser públicos, mas estavam invisíveis pra todos
-- (exceto o dono do palpite).
--
-- Correção: adicionar "status = 'finished'" como caso de visibilidade.
-- Lógica completa fica:
--
--   SELECT permitido SE:
--     - É próprio palpite                              — sempre OK
--     - OU jogo já começou (kickoff_time <= NOW())     — palpites públicos durante o jogo
--     - OU jogo está finalizado (status = 'finished')  — palpites públicos após resultado
--     - OU é admin                                      — bypass
-- ============================================================

DROP POLICY IF EXISTS "Palpites visíveis após início do jogo ou pra dono/admin"
  ON predictions;

CREATE POLICY "Palpites visíveis após início ou finalização ou pra dono/admin"
  ON predictions FOR SELECT
  TO authenticated
  USING (
    -- 1. Próprio palpite: dono sempre vê o que palpitou
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

    -- 3. Admin vê tudo
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = TRUE
    )
  );

-- ============================================================
-- Como verificar:
--
-- 1) SET LOCAL ROLE authenticated;
--    SET LOCAL "request.jwt.claims" TO '{"sub":"UUID-USUARIO-COMUM","role":"authenticated"}';
--    SELECT count(*) FROM predictions WHERE match_id = ID-JOGO-FINALIZADO;
--    RESET ROLE;
--
--    Esperado: o usuário comum vê todos os palpites desse jogo
--    (não só o dele), porque o jogo está finalizado.
--
-- 2) SET LOCAL ROLE authenticated;
--    SET LOCAL "request.jwt.claims" TO '{"sub":"UUID-USUARIO-COMUM","role":"authenticated"}';
--    SELECT count(*) FROM predictions WHERE match_id = ID-JOGO-FUTURO-NAO-INICIADO;
--    RESET ROLE;
--
--    Esperado: o usuário comum vê SÓ o palpite dele (se palpitou).
-- ============================================================