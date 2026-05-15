-- ============================================================
-- BOLÃO COPA 2026 - Migration 013: Refresh automático do elevador
-- ============================================================
-- A migration 012 criou a infra do elevador (tabela
-- ranking_elevator_baseline + função refresh_ranking_elevator_baseline)
-- mas deixou o refresh manual. Isso significa que sem rodar um SELECT
-- diariamente, a comparação fica congelada num passado arbitrário.
--
-- Esta migration automatiza isso via pg_cron, agendando refresh diário
-- às 05:00 horário de Brasília. Resultado: a UI sempre mostra
-- "variação desde o ranking de ontem cedo" sem nenhuma intervenção
-- manual.
--
-- Por que 05:00 e não 00:00?
--   A Copa 2026 é nos EUA. Vai ter jogos que começam até 22h-01h
--   no horário do Brasil. Se o cron rodasse à meia-noite, jogos que
--   terminam às 03h da manhã seriam processados pelo admin e não
--   apareceriam corretamente no elevador do dia seguinte.
--   05:00 BRT cobre todos os jogos da véspera, mesmo os mais tarde,
--   garantindo que a foto do baseline pegue todos os resultados.
--
-- A função refresh_ranking_elevator_baseline() continua existindo e
-- pode ser chamada manualmente quando quiser (ex: zerar antes da Copa
-- após truncar predictions).
-- ============================================================

-- ============================================================
-- PARTE 1: Habilitar a extensão pg_cron
-- ============================================================
-- pg_cron é o agendador padrão do Postgres. No Supabase a extensão
-- vem disponível mas precisa ser explicitamente habilitada por
-- database. É idempotente — rodar de novo é seguro.
--
-- O Supabase recomenda criar no schema "extensions" pra não poluir
-- o "public", mas precisa permitir uso pelo role normal.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ============================================================
-- PARTE 2: Agendar o cron job
-- ============================================================
-- Cron diário rodando às 05:00 no horário de Brasília.
-- pg_cron roda em UTC por padrão, então:
--   05:00 Brasília (UTC-3) = 08:00 UTC
--
-- Sintaxe cron: minuto hora dia mes diasem
--   '0 8 * * *' = minuto 0, hora 8, todo dia, todo mês, todo dia-da-semana
--
-- O nome do job é único — se já existir, dropa e recria. Idempotente.

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  -- Remove job antigo se existir (caso essa migration rode de novo)
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'refresh_elevator_baseline_daily';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  -- Agenda o novo job
  PERFORM cron.schedule(
    'refresh_elevator_baseline_daily',          -- nome do job
    '0 8 * * *',                                -- 05:00 Brasília = 08:00 UTC
    $cron$SELECT refresh_ranking_elevator_baseline();$cron$
  );
END $$;

-- ============================================================
-- Verificação:
--
-- 1. Confirma que o job está agendado:
--      SELECT jobname, schedule, command, active
--      FROM cron.job
--      WHERE jobname = 'refresh_elevator_baseline_daily';
--    Esperado: 1 linha, schedule = '0 8 * * *', active = true
--
-- 2. Histórico de execuções (depois que rodar pela primeira vez):
--      SELECT * FROM cron.job_run_details
--      WHERE jobid = (
--        SELECT jobid FROM cron.job WHERE jobname = 'refresh_elevator_baseline_daily'
--      )
--      ORDER BY start_time DESC
--      LIMIT 10;
--
-- 3. Pra testar manualmente AGORA (simula o cron rodando):
--      SELECT refresh_ranking_elevator_baseline();
--    Vai retornar { ok: true, inserted_count: N, updated_at: <agora> }
--
-- 4. Pra remover o agendamento (caso queira voltar pro modo manual):
--      SELECT cron.unschedule('refresh_elevator_baseline_daily');
--
-- ============================================================
-- Como testar o elevador hoje, sem esperar virar o dia:
--
-- 1. Hoje cedo: rodar SELECT refresh_ranking_elevator_baseline()
--    (vai capturar o ranking atual como baseline)
--
-- 2. Finalizar um jogo qualquer no Admin (vai mover gente no ranking)
--
-- 3. Recarregar a aba Ranking
--    - Quem subiu/desceu por causa do jogo mostra ▲X ou ▼X
--    - Quem ficou igual mostra ■ 0
--
-- 4. Pra "zerar" e testar de novo:
--    SELECT refresh_ranking_elevator_baseline()
--    Recarregar Ranking — agora todos mostram ■ 0 de novo
-- ============================================================