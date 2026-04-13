-- =============================================
-- BOLÃO COPA 2026 - Schema + RLS Policies
-- =============================================
-- Rodar no SQL Editor do Supabase (tudo de uma vez)

-- =============================================
-- 1. TABELA: profiles (dados dos participantes)
-- =============================================
-- Não usamos "users" porque o Supabase já tem auth.users internamente.
-- Esta tabela guarda dados extras (nome de exibição, se é admin).
-- O id referencia o auth.users(id) do Supabase Auth.

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Qualquer usuário logado pode ver todos os perfis (pra exibir ranking, nomes, etc.)
CREATE POLICY "Perfis visíveis para usuários logados"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Cada usuário pode atualizar apenas seu próprio perfil
CREATE POLICY "Usuário edita próprio perfil"
  ON profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Inserção feita via trigger automático (ver abaixo)
-- Não precisa de policy de INSERT para usuários comuns

-- =============================================
-- 2. TABELA: teams (48 seleções)
-- =============================================

CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  code CHAR(3) NOT NULL UNIQUE,       -- ex: BRA, ARG, GER
  group_letter CHAR(1) NOT NULL,       -- ex: A, B, C...
  flag_emoji TEXT,                      -- ex: 🇧🇷 (opcional, pra UI)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Todos logados podem ver as seleções
CREATE POLICY "Seleções visíveis para todos logados"
  ON teams FOR SELECT
  TO authenticated
  USING (true);

-- Só admin pode inserir/atualizar seleções
CREATE POLICY "Admin gerencia seleções"
  ON teams FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE)
  );

-- =============================================
-- 3. TABELA: matches (jogos)
-- =============================================

CREATE TABLE matches (
  id SERIAL PRIMARY KEY,
  home_team_id INTEGER NOT NULL REFERENCES teams(id),
  away_team_id INTEGER NOT NULL REFERENCES teams(id),
  group_letter CHAR(1),                -- NULL se for mata-mata
  round TEXT NOT NULL DEFAULT 'group', -- group, round_of_32, round_of_16, quarter, semi, third_place, final
  kickoff_time TIMESTAMPTZ NOT NULL,
  home_score INTEGER,                  -- NULL até o jogo acabar
  away_score INTEGER,                  -- NULL até o jogo acabar
  status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, live, finished
  venue TEXT,                          -- estádio (opcional)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT different_teams CHECK (home_team_id != away_team_id)
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- Todos logados podem ver os jogos
CREATE POLICY "Jogos visíveis para todos logados"
  ON matches FOR SELECT
  TO authenticated
  USING (true);

-- Só admin pode criar/editar jogos (cadastrar resultados)
CREATE POLICY "Admin gerencia jogos"
  ON matches FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE)
  );

-- =============================================
-- 4. TABELA: predictions (palpites de jogo)
-- =============================================

CREATE TABLE predictions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  home_score INTEGER NOT NULL CHECK (home_score >= 0),
  away_score INTEGER NOT NULL CHECK (away_score >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Um palpite por usuário por jogo
  CONSTRAINT unique_user_match UNIQUE (user_id, match_id)
);

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;

-- Todos logados podem ver todos os palpites (pra ranking e comparação)
-- NOTA: Se quiser esconder palpites dos outros até o jogo começar, 
-- a gente ajusta essa policy depois
CREATE POLICY "Palpites visíveis para todos logados"
  ON predictions FOR SELECT
  TO authenticated
  USING (true);

-- Usuário só pode inserir palpite em seu nome E se faltar mais de 5 min pro jogo
CREATE POLICY "Usuário cria palpite antes do deadline"
  ON predictions FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = match_id 
      AND matches.kickoff_time > NOW() + INTERVAL '5 minutes'
    )
  );

-- Usuário só pode editar próprio palpite E se ainda estiver antes do deadline
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
    )
  );

-- Usuário pode deletar próprio palpite (caso queira limpar)
CREATE POLICY "Usuário deleta próprio palpite"
  ON predictions FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM matches 
      WHERE matches.id = match_id 
      AND matches.kickoff_time > NOW() + INTERVAL '5 minutes'
    )
  );

-- Índice para performance das queries de palpites
CREATE INDEX idx_predictions_user_id ON predictions(user_id);
CREATE INDEX idx_predictions_match_id ON predictions(match_id);

-- =============================================
-- 5. TABELA: special_questions (perguntas extras)
-- =============================================

CREATE TABLE special_questions (
  id SERIAL PRIMARY KEY,
  question_text TEXT NOT NULL,         -- "Quem será o campeão?"
  answer_type TEXT NOT NULL DEFAULT 'text', -- team, player, text
  deadline TIMESTAMPTZ NOT NULL,       -- até quando pode responder
  correct_answer TEXT,                 -- preenchido no fim do torneio
  points_value INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE special_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Perguntas visíveis para todos logados"
  ON special_questions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin gerencia perguntas"
  ON special_questions FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE)
  );

-- =============================================
-- 6. TABELA: special_predictions (respostas extras)
-- =============================================

CREATE TABLE special_predictions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES special_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_user_question UNIQUE (user_id, question_id)
);

ALTER TABLE special_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Respostas visíveis para todos logados"
  ON special_predictions FOR SELECT
  TO authenticated
  USING (true);

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

CREATE INDEX idx_special_predictions_user_id ON special_predictions(user_id);

-- =============================================
-- 7. TRIGGER: criar perfil automaticamente
-- =============================================
-- Quando você cadastra um user no Supabase Auth,
-- esse trigger cria o registro na tabela profiles automaticamente.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- FIM DO SCRIPT
-- =============================================
-- Próximos passos:
-- 1. Criar seu usuário admin no Supabase Auth
-- 2. Marcar is_admin = TRUE no seu perfil
-- 3. Popular a tabela teams com as 48 seleções
-- 4. Popular a tabela matches com os jogos da fase de grupos