-- ============================================================
-- BOLÃO COPA 2026 - Migration 012: Baseline do elevador
-- ============================================================
-- Cria uma tabela simples para guardar a referência atual do
-- "elevador" do ranking.
--
-- Ideia:
--   ranking atual - baseline ativo = variação exibida na UI
--
-- Exemplos:
--   baseline_position = 10, posição atual = 7  → subiu 3
--   baseline_position = 4,  posição atual = 9  → caiu 5
--   baseline_position = 2,  posição atual = 2  → ficou igual
--
-- A tabela NÃO é histórico completo. É só a referência atual.
--
-- Quando quiser redefinir a referência do elevador, execute:
--
--   SELECT refresh_ranking_elevator_baseline();
--
-- Casos de uso:
--   - início oficial do bolão, depois de zerar os testes;
--   - início de um novo dia de jogos, se quiser comparar por dia;
--   - qualquer momento em que o admin quiser "zerar" o elevador.
--
-- Importante:
--   Se o baseline estiver todo zerado, o frontend mostra ■ 0
--   para todos, evitando flutuação artificial no início.
-- ============================================================

CREATE TABLE IF NOT EXISTS ranking_elevator_baseline (
  profile_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  baseline_position INTEGER NOT NULL,
  baseline_total_points INTEGER NOT NULL DEFAULT 0,
  baseline_cravadas INTEGER NOT NULL DEFAULT 0,
  baseline_total_acertos INTEGER NOT NULL DEFAULT 0,
  baseline_special_points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE ranking_elevator_baseline ENABLE ROW LEVEL SECURITY;

-- A tabela só contém posição/pontos públicos de ranking.
-- Pode ser lida por qualquer usuário autenticado.
DROP POLICY IF EXISTS "Baseline do elevador visível para logados"
  ON ranking_elevator_baseline;

CREATE POLICY "Baseline do elevador visível para logados"
  ON ranking_elevator_baseline FOR SELECT
  TO authenticated
  USING (true);

-- Não criamos policies de INSERT/UPDATE/DELETE.
-- Usuários autenticados não devem alterar essa tabela diretamente.
-- A atualização deve ser feita pela função abaixo.

-- ============================================================
-- Função: refresh_ranking_elevator_baseline()
-- ============================================================
-- Recria o baseline inteiro a partir da view ranking atual.
--
-- Segurança:
--   - Se chamada por usuário autenticado, exige profiles.is_admin = true.
--   - Se chamada pelo SQL Editor/service role, auth.uid() tende a ser NULL
--     e a execução é permitida para facilitar manutenção.
--
-- Retorno:
--   JSON com quantidade de linhas recriadas.
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
        ORDER BY r.total_points DESC, r.cravadas DESC, r.total_acertos DESC
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
-- Como usar:
--
-- 1. Após rodar esta migration:
--
--      SELECT refresh_ranking_elevator_baseline();
--
-- 2. Antes de começar oficialmente o bolão:
--    - zere os dados de teste como você já planejou;
--    - confira que ranking está zerado;
--    - rode:
--
--      SELECT refresh_ranking_elevator_baseline();
--
--    Resultado esperado na UI:
--      todos aparecem com ■ 0.
--
-- 3. Se quiser comparar por dia:
--    rode a função no começo do dia de jogos, antes dos resultados.
--
-- 4. Verificar baseline:
--
--      SELECT * FROM ranking_elevator_baseline
--      ORDER BY baseline_position;
-- ============================================================