-- ============================================================
-- BOLÃO COPA 2026 - Migration 016: Ordenação determinística
--                   do baseline do elevador
-- ============================================================
-- BUG (detectado 12/06/2026, manhã seguinte aos 2 primeiros jogos):
--
--   O elevador (▲▼) mostrava movimento "fantasma" entre jogadores
--   EMPATADOS nos três critérios (pontos, cravadas, acertos), mesmo
--   sem nenhum resultado novo processado desde a foto das 05:00.
--   Ex.: Mateus ▲1 / Parente ▼1 (ambos 20/0/2), JP Rache ▲2 /
--   Pedro Milani ▼2 (ambos 9/0/1), ▼8 dentro do blocão de 11 pts.
--
-- CAUSA RAIZ:
--
--   A função refresh_ranking_elevator_baseline numerava posições com
--   ROW_NUMBER() ordenando por apenas 3 chaves:
--
--     ORDER BY total_points DESC, cravadas DESC, total_acertos DESC
--
--   Entre linhas empatadas nas 3 chaves, o Postgres NÃO garante ordem
--   nenhuma — o ROW_NUMBER distribui posições na ordem arbitrária em
--   que as linhas saem do plano de execução (pode variar a cada
--   execução). Já o frontend (Standings.jsx) ordena com uma 4ª chave
--   (nome, localeCompare pt-BR). Resultado: a posição gravada no
--   baseline diverge da posição exibida, e a subtração
--   (baseline - atual) inventa setas dentro dos grupos de empate.
--
-- CORREÇÃO:
--
--   Tornar a ordenação do baseline 100% determinística e IDÊNTICA à
--   do frontend, acrescentando duas chaves de desempate:
--
--     4ª) display_name COLLATE "pt-BR-x-icu"  (alfabético pt-BR,
--         espelha o localeCompare do Standings.jsx)
--     5ª) profile_id                          (âncora final imutável)
--
--   O Standings.jsx recebe a mesma âncora final (profile_id) no sort,
--   na mesma alteração. Os dois lados passam a concordar sempre.
--
-- PRÉ-REQUISITO (já verificado neste banco em 12/06/2026):
--
--   SELECT collname FROM pg_collation WHERE collname = 'pt-BR-x-icu';
--   -- deve retornar 1 linha. (Padrão no Postgres do Supabase.)
--
-- O QUE ESTA MIGRATION NÃO MUDA:
--
--   - Nenhum ponto, palpite ou posição real: o bug era só de exibição.
--   - O restante do corpo da função (checagem de admin, DELETE,
--     INSERT, retorno JSON) é idêntico ao da migration 012.
--   - O agendamento do pg_cron (migration 013) permanece o mesmo.
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_ranking_elevator_baseline()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
  caller_is_admin BOOLEAN;
  inserted_count INTEGER;
BEGIN
  caller_id := auth.uid();

  -- Se houver usuário autenticado, precisa ser admin.
  -- Se auth.uid() for NULL, assumimos contexto administrativo direto
  -- como SQL Editor/service role.
  IF caller_id IS NOT NULL THEN
    SELECT is_admin INTO caller_is_admin
    FROM profiles
    WHERE id = caller_id;

    IF caller_is_admin IS NOT TRUE THEN
      RAISE EXCEPTION 'Apenas administradores podem atualizar o baseline do elevador'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM ranking_elevator_baseline;

  WITH ranked AS (
    SELECT
      r.profile_id,
      ROW_NUMBER() OVER (
        -- Ordenação 100% determinística e idêntica à do frontend
        -- (Standings.jsx): empates desempatam por nome (collation pt-BR)
        -- e, em último caso, por profile_id. Sem isso a ordem entre
        -- empatados é arbitrária e o elevador mostra movimento fantasma.
        ORDER BY r.total_points DESC,
                 r.cravadas DESC,
                 r.total_acertos DESC,
                 r.display_name COLLATE "pt-BR-x-icu" ASC,
                 r.profile_id ASC
      )::INTEGER AS baseline_position,
      COALESCE(r.total_points, 0)::INTEGER AS baseline_total_points,
      COALESCE(r.cravadas, 0)::INTEGER AS baseline_cravadas,
      COALESCE(r.total_acertos, 0)::INTEGER AS baseline_total_acertos,
      COALESCE(r.special_points, 0)::INTEGER AS baseline_special_points
    FROM ranking r
  )
  INSERT INTO ranking_elevator_baseline (
    profile_id,
    baseline_position,
    baseline_total_points,
    baseline_cravadas,
    baseline_total_acertos,
    baseline_special_points,
    updated_at
  )
  SELECT
    profile_id,
    baseline_position,
    baseline_total_points,
    baseline_cravadas,
    baseline_total_acertos,
    baseline_special_points,
    NOW()
  FROM ranked;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  RETURN json_build_object(
    'ok', true,
    'inserted_count', inserted_count,
    'updated_at', NOW()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION refresh_ranking_elevator_baseline() TO authenticated;

-- ============================================================
-- Como aplicar (ordem importa):
--
-- 1. Rodar esta migration no SQL Editor (substitui a função).
--
-- 2. Re-tirar a foto imediatamente, já com a ordenação correta:
--
--      SELECT refresh_ranking_elevator_baseline();
--      -- esperado: { ok: true, inserted_count: 35, ... }
--
-- 3. Deploy do Standings.jsx atualizado (âncora profile_id no sort).
--
-- 4. TESTE DE ACEITAÇÃO: recarregar a aba Ranking.
--    Esperado: TODOS os 35 participantes com ■ 0 (nenhum resultado
--    foi processado desde a foto do passo 2). Se aparecer qualquer
--    seta, a correção não pegou.
--
-- 5. A partir do próximo jogo processado, as setas voltam mostrando
--    movimento REAL (e o cron das 05:00 segue funcionando igual).
--
-- ============================================================
-- Verificação extra (opcional): baseline na MESMA ordem da tela.
--
--   SELECT b.baseline_position, p.display_name,
--          b.baseline_total_points  AS pts,
--          b.baseline_cravadas      AS cravadas,
--          b.baseline_total_acertos AS acertos
--   FROM ranking_elevator_baseline b
--   JOIN profiles p ON p.id = b.profile_id
--   ORDER BY b.baseline_position;
--
--   Os grupos de empate devem aparecer em ordem alfabética (a mesma
--   ordem exibida no Ranking do app).
-- ============================================================