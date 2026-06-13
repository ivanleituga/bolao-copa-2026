-- ============================================================
-- BOLÃO COPA 2026 - Migration 017: Cron do elevador 05:00 → 12:00 BRT
-- ============================================================
-- MOTIVAÇÃO:
--
--   Com o snapshot às 05:00, o panorama do dia anterior (setas ▲▼)
--   evaporava enquanto todo mundo dormia — quem acordava às 08:00 já
--   encontrava tudo ■ 0. Movendo pro meio-dia:
--
--   1. A manhã inteira vira a "vitrine" do dia anterior: os
--      participantes acordam e veem quem subiu/desceu com os jogos
--      de ontem (inclusive os de madrugada).
--
--   2. O admin ganha a manhã de folga pra processar jogos que
--      terminam ~03:00 ANTES da foto — o desenho antigo assumia
--      processamento antes das 05:00, o que era frágil.
--
--   3. Meio-dia é a "zona morta" do calendário da Copa no Brasil:
--      o jogo mais cedo de todo o torneio é 13:00 BRT (e só termina
--      ~14:50). É impossível um resultado novo entrar antes das
--      12:00 pertencendo ao "dia novo".
--
--   A semântica do elevador passa a ser: "movimento desde o meio-dia"
--   (na prática, o acumulado dos jogos do dia corrente).
--
-- COMPORTAMENTO NA APLICAÇÃO (aplicada na manhã de 12/06/2026):
--
--   pg_cron dispara na PRÓXIMA ocorrência do horário. Aplicando antes
--   das 12:00, a primeira execução é HOJE às 12:00 BRT — que será
--   inócua (re-fotografa um ranking idêntico ao baseline vigente,
--   todos seguem ■ 0). Os jogos de hoje movem as setas contra esse
--   baseline, e o primeiro reset "de verdade" é amanhã às 12:00.
--
-- O QUE MUDA / NÃO MUDA:
--
--   - Muda APENAS o agendamento (08:00 UTC → 15:00 UTC).
--   - A função refresh_ranking_elevator_baseline (migration 016,
--     ordenação determinística) NÃO é tocada.
--   - O job mantém o mesmo nome — o bloco abaixo desagenda o antigo
--     e recria, idempotente (mesmo padrão da migration 013).
-- ============================================================

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  -- Remove o job atual se existir (idempotência)
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'refresh_elevator_baseline_daily';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  -- Agenda no novo horário
  PERFORM cron.schedule(
    'refresh_elevator_baseline_daily',          -- nome do job (inalterado)
    '0 15 * * *',                               -- 12:00 Brasília (UTC-3) = 15:00 UTC
    $cron$SELECT refresh_ranking_elevator_baseline();$cron$
  );
END $$;

-- ============================================================
-- Verificação:
--
-- 1. Confirma o novo agendamento:
--      SELECT jobname, schedule, command, active
--      FROM cron.job
--      WHERE jobname = 'refresh_elevator_baseline_daily';
--    Esperado: 1 linha, schedule = '0 15 * * *', active = true
--
-- 2. Após as 12:00 BRT de hoje, confirma que rodou:
--      SELECT start_time, status
--      FROM cron.job_run_details
--      WHERE jobid = (
--        SELECT jobid FROM cron.job
--        WHERE jobname = 'refresh_elevator_baseline_daily'
--      )
--      ORDER BY start_time DESC
--      LIMIT 5;
--    Esperado: execução ~15:00 UTC com status 'succeeded'.
--    (E no app: todos seguem ■ 0, já que nada foi processado
--    entre a foto da manhã e o meio-dia.)
--
-- 3. Pra reverter ao horário antigo, se um dia quiser:
--    mesmo bloco DO com '0 8 * * *'.
-- ============================================================