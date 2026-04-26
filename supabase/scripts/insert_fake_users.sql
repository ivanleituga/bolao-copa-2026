-- ============================================================
-- BOLÃO COPA 2026 - Inserir 26 usuários fake (TEMPORÁRIO)
-- ============================================================
-- Use APENAS pra testar a visualização da tabela com mais participantes.
-- Os fakes têm emails @fake.bolao pra serem facilmente identificáveis e deletáveis.
--
-- O que faz:
-- 1. Cria 26 usuários no auth.users (Supabase Auth)
-- 2. Trigger on_auth_user_created cria os profiles automaticamente
-- 3. Insere palpites aleatórios pra cada jogo finalizado
-- 4. Pontos são calculados via calc_prediction_points
--
-- Pra DELETAR depois, rodar: delete_fake_users_visual_test.sql
-- ============================================================

DO $$
DECLARE
  nomes TEXT[] := ARRAY[
    'André Silva', 'Bruno Costa', 'Carlos Eduardo', 'Daniel Rocha',
    'Eduardo Lima', 'Felipe Souza', 'Gabriel Santos', 'Henrique Melo',
    'Igor Ferreira', 'João Pedro', 'Kaique Ribeiro', 'Leonardo Alves',
    'Matheus Duarte', 'Ana Clara', 'Beatriz Monteiro', 'Camila Ramos',
    'Daniela Freitas', 'Eduarda Vieira', 'Fernanda Lopes', 'Gabriela Martins',
    'Helena Cardoso', 'Isabela Cruz', 'Juliana Pereira', 'Larissa Gomes',
    'Mariana Fonseca', 'Natália Barbosa'
  ];
  v_user_id UUID;
  v_match RECORD;
  v_home INTEGER;
  v_away INTEGER;
  v_multiplier INTEGER;
BEGIN
  FOR i IN 1..26 LOOP
    v_user_id := gen_random_uuid();

    -- Cria o usuário no auth do Supabase
    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'visualtest' || LPAD(i::text, 2, '0') || '@fake.bolao',
      crypt('teste2026', gen_salt('bf')),
      NOW(),
      jsonb_build_object('display_name', nomes[i]),
      NOW(), NOW(),
      '', '', '', ''
    );
    -- O trigger on_auth_user_created cria o profile automaticamente

    -- Insere palpites aleatórios para cada jogo já finalizado
    FOR v_match IN
      SELECT id, round, home_score, away_score
      FROM matches
      WHERE status = 'finished'
        AND home_score IS NOT NULL
    LOOP
      v_home := CASE
        WHEN random() < 0.35 THEN 0
        WHEN random() < 0.65 THEN 1
        WHEN random() < 0.85 THEN 2
        WHEN random() < 0.95 THEN 3
        ELSE 4
      END;
      v_away := CASE
        WHEN random() < 0.35 THEN 0
        WHEN random() < 0.65 THEN 1
        WHEN random() < 0.85 THEN 2
        WHEN random() < 0.95 THEN 3
        ELSE 4
      END;

      v_multiplier := get_round_multiplier(v_match.round);

      INSERT INTO predictions (user_id, match_id, home_score, away_score, points)
      VALUES (
        v_user_id,
        v_match.id,
        v_home,
        v_away,
        calc_prediction_points(v_home, v_away, v_match.home_score, v_match.away_score) * v_multiplier
      );
    END LOOP;
  END LOOP;

  RAISE NOTICE '26 usuários fake criados com palpites aleatórios.';
END;
$$;

-- ============================================================
-- Verificações:
-- ============================================================
-- Total de profiles agora:
--   SELECT count(*) FROM profiles;
--
-- Listar só os fakes desse teste visual:
--   SELECT email, raw_user_meta_data->>'display_name' AS nome
--   FROM auth.users WHERE email LIKE '%@fake.bolao'
--   ORDER BY email;
--
-- Ver o ranking completo:
--   SELECT * FROM ranking;
-- ============================================================