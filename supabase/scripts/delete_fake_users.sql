-- ============================================================
-- BOLÃO COPA 2026 - Deletar usuários fake do teste visual
-- ============================================================
-- Apaga APENAS os 26 fakes criados pelo insert_fake_users_visual_test.sql.
-- Identifica eles pelo padrão @fake.bolao no email.
--
-- Por causa do ON DELETE CASCADE no schema:
--   auth.users deletado → profiles deletado → predictions deletado
-- automaticamente.
-- ============================================================

-- Confere antes de deletar (recomendado):
SELECT count(*) AS total_fakes
FROM auth.users
WHERE email LIKE '%@fake.bolao';

-- Se o número parecer correto (26), delete:
DELETE FROM auth.users WHERE email LIKE '%@fake.bolao';

-- Verificação pós-delete:
-- SELECT count(*) FROM profiles;        -- Deve ter caído em 26
-- SELECT count(*) FROM auth.users WHERE email LIKE '%@fake.bolao';  -- Esperado: 0