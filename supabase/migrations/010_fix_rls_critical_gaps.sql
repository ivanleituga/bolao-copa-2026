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
--   2. Adiciona trigger BEFORE UPDATE em profiles que bloqueia
--      qualquer tentativa de não-admin alterar is_admin. Mantém edição
--      normal de display_name, email, etc. Admin segue podendo alterar
--      (via SQL Editor com bypass, ou via outra policy futura).
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
-- tentar alterar is_admin, o trigger reverte essa coluna pro valor
-- antigo (silenciosamente — não quebra a transação). Outras colunas
-- continuam editáveis.
--
-- Por que trigger e não RLS? RLS opera no nível de linha, não de
-- coluna. Pra restringir colunas específicas, trigger é o caminho
-- padrão no Postgres. Alternativa seria revogar UPDATE coluna por
-- coluna via GRANT, mas é mais frágil.

CREATE OR REPLACE FUNCTION prevent_self_admin_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_is_admin BOOLEAN;
BEGIN
  -- Se is_admin não mudou, libera o update sem checar nada
  IF OLD.is_admin IS NOT DISTINCT FROM NEW.is_admin THEN
    RETURN NEW;
  END IF;

  -- Verifica se quem está fazendo o UPDATE é admin
  SELECT is_admin INTO caller_is_admin
    FROM profiles
    WHERE id = (SELECT auth.uid());

  -- Não-admin tentando mudar is_admin: reverte silenciosamente
  IF caller_is_admin IS NOT TRUE THEN
    NEW.is_admin := OLD.is_admin;
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
--   -- Não dá erro, mas:
--   SELECT is_admin FROM profiles WHERE id = (SELECT auth.uid());
--   -- Esperado: continua FALSE. O trigger reverteu silenciosamente.
--   RESET ROLE;
-- ============================================================