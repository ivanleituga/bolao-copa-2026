-- ============================================================
-- BOLÃO COPA 2026 - Setup consolidado
-- ============================================================
-- Este arquivo recria o banco do zero com o estado final após
-- todas as 15 migrations aplicadas. Use para:
--   - Recriar o ambiente em outro projeto Supabase
--   - Validar o estado esperado durante manutenção
--   - Documentar a estrutura completa do banco
--
-- Não substitui as migrations individuais — elas ficam pra
-- histórico. Este arquivo é o "snapshot final" consolidado.
--
-- Ordem importa: tabelas antes de policies/funções/triggers,
-- view ranking antes da função refresh_ranking_elevator_baseline,
-- pg_cron por último.
--
-- Idempotente: usa IF NOT EXISTS / CREATE OR REPLACE / DROP IF
-- EXISTS antes de criar policies. Pode ser rodado várias vezes
-- sem quebrar.
--
-- O QUE ESTE SETUP NÃO FAZ:
--   - Não popula teams (rode supabase/seeds/teams.sql depois)
--   - Não popula matches (rode matches_group.sql + matches_knockout.sql)
--   - Não cria special_questions (insira manualmente — depende
--     da deadline que você quiser usar)
--   - Não cria usuários (admin cria manualmente pela UI ou Auth)
-- ============================================================


-- ============================================================
-- 1. EXTENSÕES
-- ============================================================
-- pg_cron é o agendador padrão do Postgres. Necessário pro refresh
-- automático do elevador de ranking. Recomendação Supabase: criar
-- no schema "extensions" pra não poluir o "public".

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;


-- ============================================================
-- 2. TABELA: profiles
-- ============================================================
-- Dados extras dos usuários (auth.users já existe via Supabase Auth).
-- O trigger handle_new_user (criado mais abaixo) popula esta tabela
-- automaticamente após criação no auth.users.

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  email TEXT,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- SELECT — todos os logados veem nomes (necessário pro ranking)
DROP POLICY IF EXISTS "Perfis visíveis para usuários logados" ON profiles;
CREATE POLICY "Perfis visíveis para usuários logados"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- UPDATE — usuário pode editar próprio perfil
-- IMPORTANTE: o trigger prevent_self_admin_escalation_trigger
-- (criado abaixo) bloqueia alteração de is_admin por não-admins,
-- mesmo essa policy permitindo UPDATE em geral.
DROP POLICY IF EXISTS "Usuário edita próprio perfil" ON profiles;
CREATE POLICY "Usuário edita próprio perfil"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);


-- ============================================================
-- 3. TABELA: teams
-- ============================================================

CREATE TABLE IF NOT EXISTS teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code CHAR(3) NOT NULL UNIQUE,
  group_letter CHAR(1) NOT NULL,
  flag_emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Seleções visíveis para todos logados" ON teams;
CREATE POLICY "Seleções visíveis para todos logados"
  ON teams FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin gerencia seleções" ON teams;
CREATE POLICY "Admin gerencia seleções"
  ON teams FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE)
  );


-- ============================================================
-- 4. TABELA: matches
-- ============================================================
-- home_team_id e away_team_id são nullable porque jogos de mata-mata
-- existem antes dos times serem definidos (placeholder textual).

CREATE TABLE IF NOT EXISTS matches (
  id SERIAL PRIMARY KEY,
  home_team_id INTEGER REFERENCES teams(id),
  away_team_id INTEGER REFERENCES teams(id),
  group_letter CHAR(1),
  round TEXT NOT NULL DEFAULT 'group',
  kickoff_time TIMESTAMPTZ NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  status TEXT NOT NULL DEFAULT 'scheduled',
  venue TEXT,
  home_placeholder TEXT,
  away_placeholder TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT different_teams CHECK (
    home_team_id IS NULL
    OR away_team_id IS NULL
    OR home_team_id != away_team_id
  )
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Jogos visíveis para todos logados" ON matches;
CREATE POLICY "Jogos visíveis para todos logados"
  ON matches FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin gerencia jogos" ON matches;
CREATE POLICY "Admin gerencia jogos"
  ON matches FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE)
  );


-- ============================================================
-- 5. TABELA: predictions
-- ============================================================
-- Palpites em jogos. Coluna `points` é populada pelo
-- process_match_result quando o admin processa resultado.

CREATE TABLE IF NOT EXISTS predictions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL CHECK (home_score >= 0),
  away_score INTEGER NOT NULL CHECK (away_score >= 0),
  points INTEGER DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_match UNIQUE (user_id, match_id)
);

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- SELECT — versão final pós-migration 014 (sem admin bypass).
-- Usuário vê: próprio palpite OU palpite de jogo iniciado/finalizado.
DROP POLICY IF EXISTS "Palpites visíveis para todos logados" ON predictions;
DROP POLICY IF EXISTS "Palpites visíveis após início do jogo ou pra dono/admin" ON predictions;
DROP POLICY IF EXISTS "Palpites visíveis após início ou finalização ou pra dono/admin" ON predictions;
DROP POLICY IF EXISTS "Palpites visíveis após início ou finalização ou pra dono" ON predictions;
CREATE POLICY "Palpites visíveis após início ou finalização ou pra dono"
  ON predictions FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = predictions.match_id
        AND (
          matches.kickoff_time <= NOW()
          OR matches.status = 'finished'
        )
    )
  );

-- INSERT — antes do deadline, com times definidos
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

-- UPDATE — mesmas regras de INSERT
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

-- DELETE — mesmas regras
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
-- 6. TABELA: special_questions
-- ============================================================

CREATE TABLE IF NOT EXISTS special_questions (
  id SERIAL PRIMARY KEY,
  question_text TEXT NOT NULL,
  answer_type TEXT NOT NULL DEFAULT 'text',
  deadline TIMESTAMPTZ NOT NULL,
  correct_answer TEXT,
  points_value INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE special_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Perguntas visíveis para todos logados" ON special_questions;
CREATE POLICY "Perguntas visíveis para todos logados"
  ON special_questions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admin gerencia perguntas" ON special_questions;
CREATE POLICY "Admin gerencia perguntas"
  ON special_questions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE)
  );


-- ============================================================
-- 7. TABELA: special_predictions
-- ============================================================

CREATE TABLE IF NOT EXISTS special_predictions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES special_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_question UNIQUE (user_id, question_id)
);

ALTER TABLE special_predictions ENABLE ROW LEVEL SECURITY;

-- SELECT — versão final pós-migrations 007/010/011/014:
-- Próprio palpite OU (deadline passou OU correct_answer definida).
-- Sem admin bypass (decisão de privacidade da 014).
DROP POLICY IF EXISTS "Respostas visíveis para todos logados" ON special_predictions;
DROP POLICY IF EXISTS "Palpites especiais visíveis para todos logados" ON special_predictions;
DROP POLICY IF EXISTS "Palpites especiais visíveis após deadline ou pra dono/admin" ON special_predictions;
DROP POLICY IF EXISTS "Palpites especiais visíveis após deadline, correct_answer, ou pra dono/admin" ON special_predictions;
DROP POLICY IF EXISTS "Palpites especiais visíveis após deadline, correct_answer, ou pra dono" ON special_predictions;
CREATE POLICY "Palpites especiais visíveis após deadline, correct_answer, ou pra dono"
  ON special_predictions FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR EXISTS (
      SELECT 1 FROM special_questions
      WHERE special_questions.id = special_predictions.question_id
        AND (
          special_questions.deadline <= NOW()
          OR special_questions.correct_answer IS NOT NULL
        )
    )
  );

DROP POLICY IF EXISTS "Usuário responde antes do deadline" ON special_predictions;
CREATE POLICY "Usuário responde antes do deadline"
  ON special_predictions FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM special_questions
      WHERE special_questions.id = question_id
        AND special_questions.deadline > NOW()
    )
  );

DROP POLICY IF EXISTS "Usuário edita resposta antes do deadline" ON special_predictions;
CREATE POLICY "Usuário edita resposta antes do deadline"
  ON special_predictions FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM special_questions
      WHERE special_questions.id = question_id
        AND special_questions.deadline > NOW()
    )
  );


-- ============================================================
-- 8. TABELA: ranking_elevator_baseline
-- ============================================================
-- Snapshot diário do ranking pra mostrar variação ▲▼ na UI.
-- Repopulada via pg_cron diariamente (refresh_ranking_elevator_baseline).

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

DROP POLICY IF EXISTS "Baseline do elevador visível para logados" ON ranking_elevator_baseline;
CREATE POLICY "Baseline do elevador visível para logados"
  ON ranking_elevator_baseline FOR SELECT
  TO authenticated
  USING (true);

-- Sem policies de INSERT/UPDATE/DELETE: só a função
-- refresh_ranking_elevator_baseline (SECURITY DEFINER) mexe nessa tabela.


-- ============================================================
-- 9. ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_predictions_match_id ON predictions(match_id);
CREATE INDEX IF NOT EXISTS idx_special_predictions_user_id ON special_predictions(user_id);


-- ============================================================
-- 10. FUNÇÕES
-- ============================================================


-- ----------------------------------------
-- 10.1 handle_new_user
-- ----------------------------------------
-- Cria profile automaticamente quando usuário é criado em auth.users.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$;


-- ----------------------------------------
-- 10.2 prevent_self_admin_escalation
-- ----------------------------------------
-- Bloqueia tentativas de não-admin alterar is_admin via UPDATE direto.
-- A policy de UPDATE em profiles libera "edita próprio perfil", mas o
-- trigger captura mudanças em is_admin e exige privilégio admin.

CREATE OR REPLACE FUNCTION prevent_self_admin_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id UUID;
  caller_is_admin BOOLEAN;
BEGIN
  -- Se is_admin não mudou, libera (só está editando outras colunas)
  IF OLD.is_admin IS NOT DISTINCT FROM NEW.is_admin THEN
    RETURN NEW;
  END IF;

  caller_id := auth.uid();

  -- Contexto administrativo direto (SQL Editor / service_role): libera
  IF caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT is_admin INTO caller_is_admin
  FROM profiles
  WHERE id = caller_id;

  IF caller_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Usuário não pode alterar is_admin'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;


-- ----------------------------------------
-- 10.3 get_round_multiplier
-- ----------------------------------------
-- Multiplicador por fase aplicado sobre a pontuação base.

CREATE OR REPLACE FUNCTION get_round_multiplier(match_round TEXT)
RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  RETURN CASE match_round
    WHEN 'group'       THEN 1
    WHEN 'round_of_32' THEN 2
    WHEN 'round_of_16' THEN 3
    WHEN 'quarter'     THEN 4
    WHEN 'semi'        THEN 5
    WHEN 'third_place' THEN 5
    WHEN 'final'       THEN 6
    ELSE 1
  END;
END;
$$;


-- ----------------------------------------
-- 10.4 calc_prediction_points (VERSÃO FINAL — pós migration 009)
-- ----------------------------------------
-- Pontuação base:
--   Placar exato:              15 pts
--   Vitória + saldo de gols:   11 pts
--   Vitória + gols de um time:  9 pts
--   Apenas vencedor:            7 pts
--   Empate não exato:           7 pts
--   Palpite estimulado:         2 pts
--   Errou:                      0 pts

CREATE OR REPLACE FUNCTION calc_prediction_points(
  pred_home INTEGER,
  pred_away INTEGER,
  actual_home INTEGER,
  actual_away INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  actual_result TEXT;
  pred_result TEXT;
BEGIN
  IF actual_home > actual_away THEN actual_result := 'home';
  ELSIF actual_away > actual_home THEN actual_result := 'away';
  ELSE actual_result := 'draw';
  END IF;

  IF pred_home > pred_away THEN pred_result := 'home';
  ELSIF pred_away > pred_home THEN pred_result := 'away';
  ELSE pred_result := 'draw';
  END IF;

  -- Placar exato
  IF pred_home = actual_home AND pred_away = actual_away THEN
    RETURN 15;
  END IF;

  -- Apostou em empate
  IF pred_result = 'draw' THEN
    IF actual_result = 'draw' THEN
      RETURN 7;  -- Empate não exato
    ELSE
      RETURN 2;  -- Estimulado
    END IF;
  END IF;

  -- Apostou em vencedor e acertou o vencedor
  IF pred_result = actual_result THEN
    IF (actual_home - actual_away) = (pred_home - pred_away) THEN
      RETURN 11;  -- Saldo correto
    END IF;
    IF pred_home = actual_home OR pred_away = actual_away THEN
      RETURN 9;  -- Gols de um time correto
    END IF;
    RETURN 7;  -- Só vencedor
  END IF;

  RETURN 0;
END;
$$;


-- ----------------------------------------
-- 10.5 process_match_result
-- ----------------------------------------
-- Chamada pelo admin quando insere resultado. Atualiza match e
-- recalcula pontos de todos os palpites do jogo.

CREATE OR REPLACE FUNCTION process_match_result(
  p_match_id INTEGER,
  p_home_score INTEGER,
  p_away_score INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round TEXT;
  v_multiplier INTEGER;
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Apenas administradores podem registrar resultados'
      USING ERRCODE = '42501';
  END IF;

  UPDATE matches
  SET home_score = p_home_score,
      away_score = p_away_score,
      status = 'finished'
  WHERE id = p_match_id;

  SELECT round INTO v_round FROM matches WHERE id = p_match_id;
  v_multiplier := get_round_multiplier(v_round);

  UPDATE predictions
  SET points = calc_prediction_points(home_score, away_score, p_home_score, p_away_score) * v_multiplier
  WHERE match_id = p_match_id;
END;
$$;


-- ----------------------------------------
-- 10.6 reset_match_result
-- ----------------------------------------
-- Reverte resultado: volta o match pra 'scheduled' e zera pontos.

CREATE OR REPLACE FUNCTION reset_match_result(p_match_id INTEGER)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Apenas administradores podem reverter resultados'
      USING ERRCODE = '42501';
  END IF;

  UPDATE matches
  SET home_score = NULL,
      away_score = NULL,
      status = 'scheduled'
  WHERE id = p_match_id;

  UPDATE predictions
  SET points = NULL
  WHERE match_id = p_match_id;
END;
$$;


-- ----------------------------------------
-- 10.7 update_knockout_match
-- ----------------------------------------
-- Define/altera os times de um confronto de mata-mata.
-- Deleta palpites existentes (palpites em times errados não valem).

CREATE OR REPLACE FUNCTION update_knockout_match(
  p_match_id BIGINT,
  p_home_team_id BIGINT,
  p_away_team_id BIGINT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_match_status TEXT;
  v_kickoff TIMESTAMPTZ;
  v_deleted_count INT;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Apenas administradores podem editar confrontos de mata-mata'
      USING ERRCODE = '42501';
  END IF;

  IF p_home_team_id = p_away_team_id THEN
    RAISE EXCEPTION 'Times de casa e visitante devem ser diferentes';
  END IF;

  SELECT status, kickoff_time INTO v_match_status, v_kickoff
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match não encontrado: %', p_match_id;
  END IF;

  IF v_match_status != 'scheduled' THEN
    RAISE EXCEPTION 'Jogo não está mais agendado (status atual: %)', v_match_status;
  END IF;

  IF v_kickoff <= NOW() THEN
    RAISE EXCEPTION 'Jogo já começou — não é possível editar o confronto';
  END IF;

  DELETE FROM predictions WHERE match_id = p_match_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  UPDATE matches
  SET home_team_id = p_home_team_id,
      away_team_id = p_away_team_id
  WHERE id = p_match_id;

  RETURN json_build_object(
    'match_id', p_match_id,
    'home_team_id', p_home_team_id,
    'away_team_id', p_away_team_id,
    'deleted_predictions', v_deleted_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION update_knockout_match(BIGINT, BIGINT, BIGINT) TO authenticated;


-- ----------------------------------------
-- 10.8 reset_knockout_match
-- ----------------------------------------
-- Oposto do update_knockout_match: zera os times do confronto e
-- volta pros placeholders. Deleta palpites existentes.

CREATE OR REPLACE FUNCTION reset_knockout_match(
  p_match_id BIGINT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_match_status TEXT;
  v_kickoff TIMESTAMPTZ;
  v_round TEXT;
  v_deleted_count INT;
BEGIN
  SELECT is_admin INTO v_is_admin FROM profiles WHERE id = auth.uid();
  IF NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Apenas administradores podem resetar confrontos de mata-mata'
      USING ERRCODE = '42501';
  END IF;

  SELECT status, kickoff_time, round INTO v_match_status, v_kickoff, v_round
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match não encontrado: %', p_match_id;
  END IF;

  -- Whitelist explícita de rounds de mata-mata (falha alto se aparecer
  -- round desconhecido no futuro)
  IF v_round NOT IN ('round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final') THEN
    RAISE EXCEPTION 'Apenas jogos de mata-mata podem ser resetados (round atual: %)', v_round;
  END IF;

  IF v_match_status != 'scheduled' THEN
    RAISE EXCEPTION 'Jogo não está mais agendado (status atual: %)', v_match_status;
  END IF;

  IF v_kickoff <= NOW() THEN
    RAISE EXCEPTION 'Jogo já começou — não é possível resetar o confronto';
  END IF;

  DELETE FROM predictions WHERE match_id = p_match_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Zera times + placares por defesa (status='scheduled' já implica
  -- placar NULL em condições normais, mas limpa explicitamente).
  UPDATE matches
  SET home_team_id = NULL,
      away_team_id = NULL,
      home_score = NULL,
      away_score = NULL
  WHERE id = p_match_id;

  RETURN json_build_object(
    'match_id', p_match_id,
    'home_team_id', NULL,
    'away_team_id', NULL,
    'deleted_predictions', v_deleted_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reset_knockout_match(BIGINT) TO authenticated;


-- ----------------------------------------
-- 10.9 match_participation
-- ----------------------------------------
-- Retorna user_ids que palpitaram num jogo (sem revelar placares).
-- Usada pelo MatchPredictionsModal pra mostrar "X/Y palpitaram"
-- antes do jogo começar.

CREATE OR REPLACE FUNCTION match_participation(p_match_id BIGINT)
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
    SELECT p.user_id
    FROM predictions p
    WHERE p.match_id = p_match_id;
END;
$$;

GRANT EXECUTE ON FUNCTION match_participation(BIGINT) TO authenticated;


-- ----------------------------------------
-- 10.10 special_question_participation
-- ----------------------------------------
-- Análoga à match_participation, pra perguntas especiais.

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


-- ----------------------------------------
-- 10.11 match_predictions_counts
-- ----------------------------------------
-- Agregado (match_id, count) sem expor palpites. Usado pelo Admin pra
-- avisar "vai deletar X palpites" antes de alterar mata-mata.
-- Necessária após a remoção do admin bypass de SELECT em predictions
-- (migration 014).

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

  -- auth.uid() NULL = SQL Editor/service_role (libera)
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
-- 11. VIEW: ranking (VERSÃO FINAL — pós migration 008)
-- ============================================================
-- Ranking consolidado por usuário. Suporta múltiplas respostas
-- corretas em special_questions via string_to_array (ex: artilheiro
-- empatado em gols).
--
-- IMPORTANTE: a view roda como owner (postgres) por padrão, então
-- ignora RLS — necessário pra agregar palpites de todos os usuários
-- no ranking público.

CREATE OR REPLACE VIEW ranking AS
SELECT
  p.id AS profile_id,
  p.display_name,
  COALESCE(match_pts.pts, 0) + COALESCE(special_pts.pts, 0) AS total_points,
  COALESCE(match_pts.acertos, 0) AS total_acertos,
  COALESCE(match_pts.cravadas, 0) AS cravadas,
  COALESCE(match_pts.palpites, 0) AS total_palpites,
  COALESCE(special_pts.pts, 0) AS special_points
FROM profiles p
LEFT JOIN (
  SELECT
    pr.user_id,
    SUM(pr.points) AS pts,
    -- Acertos: pontos > 0 EXCETO palpites estimulados (2*multiplier).
    -- Estimulado pontua mas não é "acerto" pra fins de contagem.
    COUNT(CASE WHEN pr.points > 0 AND pr.points != 2 * get_round_multiplier(m.round) THEN 1 END) AS acertos,
    -- Cravadas: pontuação máxima da fase (15*multiplier)
    COUNT(CASE WHEN pr.points = 15 * get_round_multiplier(m.round) THEN 1 END) AS cravadas,
    COUNT(pr.id) AS palpites
  FROM predictions pr
  JOIN matches m ON m.id = pr.match_id AND m.status = 'finished'
  GROUP BY pr.user_id
) match_pts ON match_pts.user_id = p.id
LEFT JOIN (
  SELECT
    sp.user_id,
    SUM(sq.points_value) AS pts
  FROM special_predictions sp
  JOIN special_questions sq ON sq.id = sp.question_id
  WHERE sq.correct_answer IS NOT NULL
    -- Suporta múltiplas respostas: "Mbappé,Haaland" vira ['mbappé','haaland']
    -- após normalização (LOWER + TRIM em ambos os lados).
    AND LOWER(TRIM(sp.answer)) = ANY(
      SELECT LOWER(TRIM(elem))
      FROM unnest(string_to_array(sq.correct_answer, ',')) AS elem
    )
  GROUP BY sp.user_id
) special_pts ON special_pts.user_id = p.id
ORDER BY total_points DESC, cravadas DESC, total_acertos DESC;


-- ============================================================
-- 12. FUNÇÃO: refresh_ranking_elevator_baseline
-- ============================================================
-- Recria a tabela ranking_elevator_baseline com snapshot do ranking
-- atual. Chamada manualmente pelo admin ou automaticamente pelo
-- pg_cron diário (definido na seção 14).
--
-- DEPENDE da view ranking definida acima — precisa ser criada DEPOIS.

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
        -- (Corrigido na migration 016.)
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
-- 13. TRIGGERS
-- ============================================================


-- 13.1 on_auth_user_created — em auth.users (cria profile automaticamente)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- 13.2 prevent_self_admin_escalation_trigger — em profiles
DROP TRIGGER IF EXISTS prevent_self_admin_escalation_trigger ON profiles;
CREATE TRIGGER prevent_self_admin_escalation_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_admin_escalation();


-- ============================================================
-- 14. pg_cron — refresh diário do elevador
-- ============================================================
-- Roda às 12:00 BRT (15:00 UTC). O meio-dia é a "zona morta" do
-- calendário da Copa no Brasil: o jogo mais cedo é 13:00 BRT (termina
-- ~14:50), e os de madrugada acabam ~03:00. Assim, o panorama do dia
-- anterior fica visível a manhã inteira pros participantes, e o admin
-- tem a manhã de folga pra processar jogos de madrugada antes da foto.
-- (Era 05:00 BRT; alterado na migration 017.)
--
-- A função refresh_ranking_elevator_baseline precisa existir antes
-- (definida na seção 12).

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  -- Remove job antigo se existir (idempotência)
  SELECT jobid INTO v_job_id
  FROM cron.job
  WHERE jobname = 'refresh_elevator_baseline_daily';

  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'refresh_elevator_baseline_daily',
    '0 15 * * *',
    $cron$SELECT refresh_ranking_elevator_baseline();$cron$
  );
END $$;


-- ============================================================
-- VERIFICAÇÃO PÓS-SETUP
-- ============================================================
-- Após rodar o setup completo, valide com essas queries:
--
-- 1. Tabelas criadas (esperado: 7 tabelas no schema public)
--    SELECT tablename FROM pg_tables
--    WHERE schemaname = 'public'
--    ORDER BY tablename;
--    Esperado: matches, predictions, profiles, ranking_elevator_baseline,
--              special_predictions, special_questions, teams
--
-- 2. Funções criadas (esperado: 11 funções no schema public)
--    SELECT proname FROM pg_proc
--    WHERE pronamespace = 'public'::regnamespace
--    ORDER BY proname;
--    Esperado: calc_prediction_points, get_round_multiplier,
--              handle_new_user, match_participation, match_predictions_counts,
--              prevent_self_admin_escalation, process_match_result,
--              refresh_ranking_elevator_baseline, reset_knockout_match,
--              reset_match_result, special_question_participation,
--              update_knockout_match
--
-- 3. Triggers ativos (esperado: 2)
--    SELECT tgname, tgrelid::regclass FROM pg_trigger
--    WHERE NOT tgisinternal
--    ORDER BY tgname;
--    Esperado: on_auth_user_created (auth.users),
--              prevent_self_admin_escalation_trigger (profiles)
--
-- 4. View ranking existe
--    SELECT viewname FROM pg_views WHERE viewname = 'ranking';
--    Esperado: 1 linha
--
-- 5. Job pg_cron agendado
--    SELECT jobname, schedule, active
--    FROM cron.job
--    WHERE jobname = 'refresh_elevator_baseline_daily';
--    Esperado: schedule = '0 15 * * *', active = true
--
-- 6. Teste da função de pontuação:
--    SELECT calc_prediction_points(2, 1, 2, 1);  -- 15 (exato)
--    SELECT calc_prediction_points(3, 2, 2, 1);  -- 11 (saldo)
--    SELECT calc_prediction_points(2, 0, 2, 1);  -- 9  (gols vencedor)
--    SELECT calc_prediction_points(3, 0, 2, 1);  -- 7  (só vencedor)
--    SELECT calc_prediction_points(1, 1, 2, 1);  -- 2  (estimulado)
--    SELECT calc_prediction_points(0, 0, 1, 1);  -- 7  (empate não exato)
--    SELECT calc_prediction_points(0, 1, 2, 1);  -- 0  (errou)
--
-- ============================================================


-- ============================================================
-- PRÓXIMOS PASSOS APÓS O SETUP
-- ============================================================
-- 1. Rodar seeds:
--    - supabase/seeds/teams.sql (48 seleções)
--    - supabase/seeds/matches_group.sql (72 jogos de grupos)
--    - supabase/seeds/matches_knockout.sql (32 jogos de mata-mata)
--
-- 2. Criar perguntas especiais via INSERT manual:
--    INSERT INTO special_questions (question_text, answer_type, deadline, points_value)
--    VALUES
--      ('Quem será o campeão?',     'team',   '2026-06-11 12:00:00-03', 50),
--      ('Quem será o artilheiro?',  'player', '2026-06-11 12:00:00-03', 50);
--
-- 3. Criar o usuário admin no Supabase Auth e marcar:
--    UPDATE profiles SET is_admin = TRUE WHERE email = 'seu@email.com';
--
-- 4. Inicializar o baseline do elevador:
--    SELECT refresh_ranking_elevator_baseline();
-- ============================================================