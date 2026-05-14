-- ============================================================
-- BOLÃO COPA 2026 - Migration 010: Correções de RLS críticas
-- ============================================================
-- Duas falhas detectadas após auditoria:
--
-- FALHA 1: A migration 007 tentou dropar uma policy com nome errado.
--   - O nome real no 001_schema.sql é "Respostas visíveis para todos logados"
--   - A 007 tentou dropar "Palpites especiais visíveis para todos logados"
--   - DROP POLICY IF EXISTS apenas ignora silenciosamente quando o nome
--     não bate. Resultado: a policy permissiva ORIGINAL continuou ativa
--     no banco junto com a nova restritiva.
--   - Como RLS combina policies por OR (qualquer permitir libera),
--     a 007 não está protegendo nada — o SELECT permissivo ainda libera tudo.
--
-- FALHA 2: A policy "Usuário edita próprio perfil" no 001_schema.sql
--   não restringe quais colunas o usuário pode editar. Como is_admin
--   está em profiles, qualquer usuário pode rodar:
--     UPDATE profiles SET is_admin = TRUE WHERE id = auth.uid()
--   e virar admin do bolão. Isso destrói o sistema todo.
--
-- Correções:
--   1. Dropa explicitamente o nome correto da policy antiga em
--      special_predictions, garantindo que só a restritiva fica ativa.
--   2. Adiciona trigger BEFORE UPDATE em profiles que IMPEDE
--      qualquer tentativa de não-admin alterar is_admin, com erro
--      explícito (RAISE EXCEPTION). Mantém edição normal de
--      display_name, email, etc. Admin segue podendo alterar.
-- ============================================================

-- ============================================================
-- PARTE 1: Remove policy permissiva original em special_predictions
-- ============================================================

DROP POLICY IF EXISTS "Respostas visíveis para todos logados"
  ON special_predictions;

-- A policy restritiva criada pela 007 ("Palpites especiais visíveis após
-- deadline ou pra dono/admin") já está no banco e continua valendo.
-- Não precisa recriar.

-- ============================================================
-- PARTE 2: Trigger pra impedir escalação de privilégio
-- ============================================================
-- O trigger roda BEFORE UPDATE em profiles. Se um usuário não-admin
-- tentar alterar is_admin, o trigger ABORTA o UPDATE com erro explícito.
-- Outras colunas continuam editáveis.
--
-- Detalhes da implementação:
--
-- 1. SET search_path = public: padrão de segurança usado em todas as
--    funções SECURITY DEFINER deste projeto (handle_new_user no 001,
--    update_knockout_match no 004). Sem isso, alguém com privilégio
--    de criar objetos em outros schemas poderia atacar via path
--    hijacking.
--
-- 2. Trata auth.uid() NULL como contexto administrativo: quando admin
--    roda UPDATE no SQL Editor (ou via service_role), auth.uid() é
--    NULL. O trigger libera nesse caso, permitindo manutenção manual
--    sem ficar travado.
--
-- 3. RAISE EXCEPTION em vez de reversão silenciosa: dá erro claro
--    quando alguém tenta escalar. Se o frontend tentar (por bug ou
--    má fé), recebe erro explícito em vez de "salvou" mentiroso.
--
-- 4. Por que trigger e não RLS? RLS opera no nível de linha. Pra
--    restringir colunas específicas, trigger é o padrão Postgres.

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
  -- Se is_admin não mudou, libera normalmente
  IF OLD.is_admin IS NOT DISTINCT FROM NEW.is_admin THEN
    RETURN NEW;
  END IF;

  caller_id := auth.uid();

  -- Se não há auth.uid(), é contexto administrativo direto
  -- (SQL Editor/service_role). Permite — admin precisa poder
  -- promover/rebaixar manualmente.
  IF caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT is_admin INTO caller_is_admin
  FROM profiles
  WHERE id = caller_id;

  -- Não-admin tentando mudar is_admin: bloqueia com erro explícito
  IF caller_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Usuário não pode alterar is_admin'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_admin_escalation_trigger ON profiles;

CREATE TRIGGER prevent_self_admin_escalation_trigger
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_self_admin_escalation();

-- ============================================================
-- Como testar:
--
-- FALHA 1 — verificar que policy antiga foi mesmo apagada:
--   SELECT polname FROM pg_policy
--   WHERE polrelid = 'special_predictions'::regclass;
--   -- Esperado: só a policy "Palpites especiais visíveis após
--   --           deadline ou pra dono/admin". A "Respostas visíveis
--   --           para todos logados" NÃO deve aparecer.
--
-- FALHA 2 — testar bloqueio do is_admin:
--   SET LOCAL ROLE authenticated;
--   SET LOCAL "request.jwt.claims" TO '{"sub":"UUID-USUARIO-COMUM","role":"authenticated"}';
--   UPDATE profiles SET is_admin = TRUE WHERE id = (SELECT auth.uid());
--   -- Esperado: ERRO "Usuário não pode alterar is_admin" (código 42501)
--   RESET ROLE;
--
-- FALHA 2 (admin no SQL Editor) — deve continuar funcionando:
--   UPDATE profiles SET is_admin = TRUE WHERE display_name = 'Algum Nome';
--   -- Esperado: sucesso. auth.uid() é NULL no SQL Editor, libera passagem.
-- ============================================================