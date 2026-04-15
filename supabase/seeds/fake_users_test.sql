-- ============================================================
-- BOLÃO COPA 2026 - Seed: 34 Usuários Fake para Teste
-- ============================================================
-- Cria 34 usuários com palpites aleatórios nos jogos finalizados.
-- Emails: fake01@bolao.test ... fake34@bolao.test
-- Senha: bolao2026 (não importa, ninguém vai logar)
--
-- Para APAGAR tudo depois:
--   DELETE FROM auth.users WHERE email LIKE '%@bolao.test';
--   (CASCADE apaga profiles e predictions automaticamente)
-- ============================================================

DO $$
DECLARE
  nomes TEXT[] := ARRAY[
    'André Silva', 'Bruno Costa', 'Carlos Eduardo', 'Daniel Rocha',
    'Eduardo Lima', 'Felipe Souza', 'Gabriel Santos', 'Henrique Melo',
    'Igor Ferreira', 'João Pedro', 'Kaique Ribeiro', 'Leonardo Alves',
    'Matheus Duarte', 'Nicolas Araújo', 'Otávio Pinto', 'Pedro Henrique',
    'Rafael Moreira', 'Samuel Teixeira', 'Thiago Nunes', 'Vinícius Dias',
    'Ana Clara', 'Beatriz Monteiro', 'Camila Ramos', 'Daniela Freitas',
    'Eduarda Vieira', 'Fernanda Lopes', 'Gabriela Martins', 'Helena Cardoso',
    'Isabela Cruz', 'Juliana Pereira', 'Larissa Gomes', 'Mariana Fonseca',
    'Natália Barbosa', 'Paula Mendes'
  ];
  v_user_id UUID;
  v_match RECORD;
  v_home INTEGER;
  v_away INTEGER;
  v_multiplier INTEGER;
BEGIN
  FOR i IN 1..34 LOOP
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
      'fake' || LPAD(i::text, 2, '0') || '@bolao.test',
      crypt('bolao2026', gen_salt('bf')),
      NOW(),
      jsonb_build_object('display_name', nomes[i]),
      NOW(), NOW(),
      '', '', '', ''
    );
    -- O trigger on_auth_user_created cria o profile automaticamente

    -- Insere palpites aleatórios para cada jogo finalizado
    FOR v_match IN
      SELECT id, round, home_score, away_score
      FROM matches
      WHERE status = 'finished'
        AND home_score IS NOT NULL
    LOOP
      -- Gera placares aleatórios (0 a 4 gols, com peso maior pra placares baixos)
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

  RAISE NOTICE '34 usuários fake criados com palpites aleatórios!';
END;
$$;

-- Verificação rápida:
-- SELECT count(*) FROM profiles;                        -- Esperado: 35 (1 real + 34 fake)
-- SELECT count(*) FROM predictions;                     -- Esperado: seus palpites + 34×6 = +204
-- SELECT * FROM ranking LIMIT 10;                       -- Top 10 do ranking
-- SELECT email FROM auth.users WHERE email LIKE '%@bolao.test' LIMIT 5;  -- Confirma padrão


-- PARA DELETÁ-LOS:

DELETE FROM auth.users WHERE email LIKE '%@bolao.test';