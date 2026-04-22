-- ============================================================
-- BOLÃO COPA 2026 - Migration 003: Estrutura pra Mata-Mata
-- ============================================================
-- Rodar no SQL Editor do Supabase após 002_scoring.sql
--
-- O que esta migration faz:
-- 1. Remove a constraint NOT NULL de home_team_id e away_team_id,
--    permitindo que jogos de mata-mata existam no banco antes dos
--    times serem definidos.
-- 2. Adiciona home_placeholder e away_placeholder (texto livre tipo
--    "1A", "2B", "3ABCDF", "W73", "SF1") pra exibir quando os times
--    reais ainda não estão definidos.
-- 3. Ajusta a RLS de predictions pra NUNCA permitir palpite em jogo
--    com time ainda em aberto (home_team_id ou away_team_id nulos).
-- ============================================================

-- 1. Permite team_ids nulos (necessário pra jogos de mata-mata sem times definidos)
ALTER TABLE matches ALTER COLUMN home_team_id DROP NOT NULL;
ALTER TABLE matches ALTER COLUMN away_team_id DROP NOT NULL;

-- 2. Adiciona colunas de placeholder textual
ALTER TABLE matches ADD COLUMN IF NOT EXISTS home_placeholder TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS away_placeholder TEXT;

-- 3. Ajusta as policies de predictions pra exigir que os times estejam definidos
--    (dropa e recria porque Postgres não tem ALTER POLICY direto)

-- INSERT
DROP POLICY IF EXISTS "Usuário cria palpite antes do deadline" ON predictions;
CREATE POLICY "Usuário cria palpite antes do deadline"
  ON predictions FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_id
      AND matches.kickoff_time > NOW() + INTERVAL '5 minutes'
      AND matches.status = 'scheduled'
      AND matches.home_team_id IS NOT NULL
      AND matches.away_team_id IS NOT NULL
    )
  );

-- UPDATE
DROP POLICY IF EXISTS "Usuário edita palpite antes do deadline" ON predictions;
CREATE POLICY "Usuário edita palpite antes do deadline"
  ON predictions FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_id
      AND matches.kickoff_time > NOW() + INTERVAL '5 minutes'
      AND matches.status = 'scheduled'
      AND matches.home_team_id IS NOT NULL
      AND matches.away_team_id IS NOT NULL
    )
  );

-- DELETE (mantém igual, mas adiciona a mesma trava por consistência)
DROP POLICY IF EXISTS "Usuário deleta próprio palpite" ON predictions;
CREATE POLICY "Usuário deleta próprio palpite"
  ON predictions FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_id
      AND matches.kickoff_time > NOW() + INTERVAL '5 minutes'
      AND matches.status = 'scheduled'
      AND matches.home_team_id IS NOT NULL
      AND matches.away_team_id IS NOT NULL
    )
  );

-- ============================================================
-- Próximo passo: rodar matches_knockout.sql pra criar os 31
-- matches de mata-mata com placeholders.
-- ============================================================