-- ============================================================
-- BOLÃO COPA 2026 - Migration 005: RLS de SELECT endurecida
-- ============================================================
-- Antes desta migration, qualquer usuário logado podia ver os palpites
-- de qualquer outro a qualquer hora — o que permitiria "espiar e copiar"
-- antes do jogo começar.
--
-- Depois desta migration, um palpite alheio só é visível APÓS o jogo
-- ter começado (kickoff_time <= NOW()). Próprios palpites e operações
-- do admin não são afetados.
--
-- Isso é fundamental antes da Fase 4 social ("ver palpites de um jogo")
-- — sem isso, qualquer cliente poderia listar todos os palpites a
-- qualquer hora.
-- ============================================================

-- A regra completa de SELECT:
--   - É o próprio palpite (user_id = auth.uid())                — OK
--   - OU o jogo já começou (kickoff_time <= NOW())              — OK
--   - OU o usuário é admin                                       — OK
--   - Caso contrário, a linha não existe pra esse usuário        — bloqueio
DROP POLICY IF EXISTS "Palpites visíveis para todos logados" ON predictions;

CREATE POLICY "Palpites visíveis após início do jogo ou pra dono/admin"
  ON predictions FOR SELECT
  TO authenticated
  USING (
    -- 1. Próprio palpite: dono sempre vê o que palpitou
    (SELECT auth.uid()) = user_id

    -- 2. Jogo já começou: aí palpite vira público
    OR EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = predictions.match_id
        AND matches.kickoff_time <= NOW()
    )

    -- 3. Admin vê tudo (necessário pra Admin.jsx contar palpites
    --    por match antes de alterar confronto de mata-mata)
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.is_admin = TRUE
    )
  );

-- ============================================================
-- Notas importantes:
--
-- 1. A view `ranking` continua funcionando porque foi criada sem
--    `security_invoker = true`. Ela roda com privilégios do owner
--    (postgres) e ignora a RLS — comportamento padrão do Postgres
--    pra views.
--
-- 2. Performance: o JOIN com `matches` e `profiles` é barato porque
--    já existe índice em predictions(match_id) e profiles tem PK.
--
-- 3. Esta migration só altera SELECT. As policies de INSERT, UPDATE
--    e DELETE continuam exatamente como estão (já protegem contra
--    palpitar em jogo iniciado, jogo finalizado, ou em jogos com
--    placeholders).
-- ============================================================