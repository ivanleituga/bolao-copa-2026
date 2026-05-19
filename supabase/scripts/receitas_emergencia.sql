-- ============================================================
-- BOLÃO COPA 2026 - Receitas SQL pro admin
-- ============================================================
-- Biblioteca de queries operacionais pra rodar no SQL Editor
-- do Supabase durante a Copa. Cada receita está numerada e tem:
--   - Quando usar
--   - SQL pronto (com placeholders :variavel)
--   - Avisos de risco quando aplicável
--
-- Convenção: parâmetros marcados como :variavel — substituir antes
-- de rodar. Exemplo: :match_id vira 42.
--
-- IMPORTANTE: o SQL Editor do Supabase roda com service_role e
-- ignora RLS. Toda receita aqui assume isso. NÃO rode essas queries
-- via API/frontend.
-- ============================================================


-- ============================================================
-- 🔧 OPERACIONAIS DO DIA A DIA
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 01. CANCELAR RESULTADO DE JOGO
-- ────────────────────────────────────────────────────────────
-- Quando usar: você processou resultado errado e precisa voltar
-- o jogo pra "aguardando".
-- Efeito: zera placar, status volta pra 'scheduled', pontos dos
-- palpites desse jogo viram NULL.
-- Alternativa: usar o botão "Excluir resultado" na aba Admin.
-- ────────────────────────────────────────────────────────────

-- Substitui :match_id pelo ID do jogo
SELECT reset_match_result(:match_id);

-- Ou direto sem RPC (caso a RPC dê problema):
-- UPDATE matches
-- SET home_score = NULL, away_score = NULL, status = 'scheduled'
-- WHERE id = :match_id;
-- UPDATE predictions SET points = NULL WHERE match_id = :match_id;


-- ────────────────────────────────────────────────────────────
-- 02. MUDAR HORÁRIO DE UM JOGO
-- ────────────────────────────────────────────────────────────
-- Quando usar: FIFA adiou um jogo, mudou o horário, etc.
-- AVISO: se palpites já estão fechados (jogo deveria começar em
-- minutos), mudar o horário REABRE pra palpite. Use só pra jogos
-- que ainda têm tempo de margem.
-- ────────────────────────────────────────────────────────────

-- Formato do horário: ISO com timezone do Brasil (BRT = -03:00)
-- Exemplo: '2026-06-15 16:30:00-03'
UPDATE matches
SET kickoff_time = :novo_horario  -- ex: '2026-06-15 16:30:00-03'
WHERE id = :match_id;


-- ────────────────────────────────────────────────────────────
-- 03. MUDAR ESTÁDIO DE UM JOGO
-- ────────────────────────────────────────────────────────────
-- Quando usar: troca de venue (não muda nada funcional, só display)
-- ────────────────────────────────────────────────────────────

UPDATE matches
SET venue = :novo_venue  -- ex: 'MetLife Stadium, Nova York'
WHERE id = :match_id;


-- ────────────────────────────────────────────────────────────
-- 04. LISTAR USUÁRIOS QUE NÃO PALPITARAM EM UM JOGO
-- ────────────────────────────────────────────────────────────
-- Quando usar: jogo X começa em 1h, quem ainda não palpitou?
-- Útil pra mandar lembrete no grupo.
-- ────────────────────────────────────────────────────────────

SELECT p.display_name, p.email
FROM profiles p
WHERE p.id NOT IN (
  SELECT user_id FROM predictions WHERE match_id = :match_id
)
ORDER BY p.display_name;


-- ────────────────────────────────────────────────────────────
-- 05. LISTAR JOGOS COM PLACEHOLDER PERTO DE VENCER
-- ────────────────────────────────────────────────────────────
-- Quando usar: quero ver quais mata-matas precisam ser definidos
-- nas próximas X horas. Filtro padrão: próximas 24h.
-- ────────────────────────────────────────────────────────────

SELECT
  m.id,
  m.round,
  m.home_placeholder || ' × ' || m.away_placeholder AS confronto,
  m.kickoff_time AT TIME ZONE 'America/Sao_Paulo' AS kickoff_brt,
  AGE(m.kickoff_time, NOW()) AS tempo_restante
FROM matches m
WHERE m.round != 'group'
  AND m.home_team_id IS NULL
  AND m.kickoff_time > NOW()
  AND m.kickoff_time < NOW() + INTERVAL '24 hours'
ORDER BY m.kickoff_time;


-- ────────────────────────────────────────────────────────────
-- 06. VER PALPITES ESPECIAIS (CAMPEÃO/ARTILHEIRO)
-- ────────────────────────────────────────────────────────────
-- Quando usar: quer ver quem palpitou o quê nas perguntas especiais
-- antes do prazo ou antes de definir resposta correta.
-- (O admin não vê isso na UI — privacidade.)
-- ────────────────────────────────────────────────────────────

-- Tabela "wide": cada usuário em uma linha com seus 2 palpites
SELECT
  p.display_name AS palpiteiro,
  campeao.answer AS campeao_palpitado,
  artilheiro.answer AS artilheiro_palpitado
FROM profiles p
LEFT JOIN special_predictions campeao
  ON campeao.user_id = p.id
  AND campeao.question_id = (SELECT id FROM special_questions WHERE answer_type = 'team' LIMIT 1)
LEFT JOIN special_predictions artilheiro
  ON artilheiro.user_id = p.id
  AND artilheiro.question_id = (SELECT id FROM special_questions WHERE answer_type = 'player' LIMIT 1)
ORDER BY p.display_name;


-- ────────────────────────────────────────────────────────────
-- 07. CONTAGEM DE RESPOSTAS NAS PERGUNTAS ESPECIAIS
-- ────────────────────────────────────────────────────────────
-- Quando usar: quer ver "qual time é favorito do grupo pra campeão"
-- ────────────────────────────────────────────────────────────

-- Campeão
SELECT answer AS campeao, COUNT(*) AS quantidade
FROM special_predictions
WHERE question_id = (SELECT id FROM special_questions WHERE answer_type = 'team' LIMIT 1)
GROUP BY answer
ORDER BY quantidade DESC;

-- Artilheiro
SELECT answer AS artilheiro, COUNT(*) AS quantidade
FROM special_predictions
WHERE question_id = (SELECT id FROM special_questions WHERE answer_type = 'player' LIMIT 1)
GROUP BY answer
ORDER BY quantidade DESC;


-- ────────────────────────────────────────────────────────────
-- 08. ALTERAR DEADLINE DE PERGUNTA ESPECIAL
-- ────────────────────────────────────────────────────────────
-- Quando usar: quer estender ou reduzir o prazo das respostas.
-- AVISO: o deadline original deveria ser ANTES do primeiro jogo
-- da Copa pra fazer sentido.
-- ────────────────────────────────────────────────────────────

UPDATE special_questions
SET deadline = :novo_deadline  -- ex: '2026-06-11 12:00:00-03'
WHERE id = :question_id;


-- ============================================================
-- 👥 ADMINISTRAÇÃO DE USUÁRIOS
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 09. PROMOVER USUÁRIO A ADMIN
-- ────────────────────────────────────────────────────────────
-- Quando usar: quer adicionar outro admin do bolão.
-- AVISO: admin tem poder destrutivo. Use com critério.
-- O trigger prevent_self_admin_escalation impede o usuário de
-- se auto-promover — só admin pode promover outro.
-- ────────────────────────────────────────────────────────────

-- Por email:
UPDATE profiles
SET is_admin = TRUE
WHERE email = :email;

-- Ou pelo display_name (cuidado com homônimos):
-- UPDATE profiles SET is_admin = TRUE WHERE display_name = 'Fulano de Tal';

-- Confere que funcionou:
SELECT display_name, email, is_admin FROM profiles WHERE is_admin = TRUE;


-- ────────────────────────────────────────────────────────────
-- 10. DESPROMOVER ADMIN
-- ────────────────────────────────────────────────────────────
-- Quando usar: precisa tirar privilégio de admin de alguém.
-- AVISO: não pode despromover a si próprio se for o único admin.
-- ────────────────────────────────────────────────────────────

UPDATE profiles
SET is_admin = FALSE
WHERE email = :email;


-- ────────────────────────────────────────────────────────────
-- 11. RENOMEAR DISPLAY_NAME DE USUÁRIO
-- ────────────────────────────────────────────────────────────
-- Quando usar: usuário pediu pra mudar como aparece no ranking.
-- ────────────────────────────────────────────────────────────

UPDATE profiles
SET display_name = :novo_nome
WHERE email = :email;


-- ────────────────────────────────────────────────────────────
-- 12. APAGAR PALPITES DE UM USUÁRIO ESPECÍFICO
-- ────────────────────────────────────────────────────────────
-- Quando usar: usuário pediu "apaga meus palpites, vou refazer".
-- Casos raros — usuários geralmente editam os próprios palpites
-- pela interface.
-- ────────────────────────────────────────────────────────────

-- Confere antes:
SELECT match_id, home_score, away_score, points
FROM predictions
WHERE user_id = (SELECT id FROM profiles WHERE email = :email);

-- Apaga:
DELETE FROM predictions
WHERE user_id = (SELECT id FROM profiles WHERE email = :email);


-- ────────────────────────────────────────────────────────────
-- 13. RESETAR SENHA DE UM USUÁRIO
-- ────────────────────────────────────────────────────────────
-- Quando usar: usuário esqueceu a senha.
-- O Supabase tem fluxo nativo de reset por email, mas como
-- estamos usando emails fake (@bolao.com), o email não chega.
-- A receita abaixo seta uma senha temporária direto.
--
-- AVISO: roda pelo Supabase Dashboard, não pelo SQL Editor.
-- O SQL Editor não consegue mexer em auth.users com senha hash.
-- ────────────────────────────────────────────────────────────

-- No Supabase Dashboard: Authentication → Users → encontra o usuário
-- → clica nos "..." → "Send password recovery" (não funciona com
-- email fake) OU "Reset password" (define senha manualmente).

-- Como alternativa via SQL (avançado, requer extensão pgcrypto):
-- UPDATE auth.users
-- SET encrypted_password = crypt('nova_senha_temporaria', gen_salt('bf'))
-- WHERE email = :email;


-- ============================================================
-- 🔍 AUDITORIA E DEBUG
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 14. HISTÓRICO DE PALPITES DE UM USUÁRIO
-- ────────────────────────────────────────────────────────────
-- Quando usar: usuário reclamou "perdi 5 pts, mas devia ter
-- ganhado 11". Quer ver tudo que ele palpitou e quanto ganhou.
-- ────────────────────────────────────────────────────────────

SELECT
  m.kickoff_time AT TIME ZONE 'America/Sao_Paulo' AS jogo_em,
  m.round,
  ht.name AS casa,
  at.name AS fora,
  pr.home_score AS palpite_casa,
  pr.away_score AS palpite_fora,
  m.home_score AS real_casa,
  m.away_score AS real_fora,
  pr.points AS pontos,
  pr.updated_at AT TIME ZONE 'America/Sao_Paulo' AS palpitou_em
FROM predictions pr
JOIN matches m ON m.id = pr.match_id
LEFT JOIN teams ht ON ht.id = m.home_team_id
LEFT JOIN teams at ON at.id = m.away_team_id
WHERE pr.user_id = (SELECT id FROM profiles WHERE email = :email)
ORDER BY m.kickoff_time;


-- ────────────────────────────────────────────────────────────
-- 15. RECALCULAR PONTOS MANUALMENTE PARA UM JOGO
-- ────────────────────────────────────────────────────────────
-- Quando usar: desconfia que os pontos de um jogo estão errados.
-- Reaplica a função `calc_prediction_points` em todos os palpites.
-- ────────────────────────────────────────────────────────────

-- Confere antes (mostra cálculo proposto sem aplicar):
SELECT
  p.display_name AS palpiteiro,
  pr.home_score AS palp_casa,
  pr.away_score AS palp_fora,
  m.home_score AS real_casa,
  m.away_score AS real_fora,
  pr.points AS pontos_atuais,
  calc_prediction_points(pr.home_score, pr.away_score, m.home_score, m.away_score)
    * get_round_multiplier(m.round) AS pontos_recalculados
FROM predictions pr
JOIN matches m ON m.id = pr.match_id
JOIN profiles p ON p.id = pr.user_id
WHERE m.id = :match_id
ORDER BY p.display_name;

-- Pra forçar recálculo, mais simples: cancela e processa de novo:
-- SELECT reset_match_result(:match_id);
-- SELECT process_match_result(:match_id, :home_score, :away_score);


-- ────────────────────────────────────────────────────────────
-- 16. SNAPSHOT DO RANKING ATUAL
-- ────────────────────────────────────────────────────────────
-- Quando usar: quer guardar uma "foto" do ranking num momento
-- (ex: antes de processar uma rodada importante).
-- Exporta como CSV no SQL Editor.
-- ────────────────────────────────────────────────────────────

SELECT
  ROW_NUMBER() OVER (ORDER BY total_pontos DESC, cravadas DESC, acertos DESC) AS posicao,
  display_name,
  total_pontos,
  cravadas,
  acertos
FROM ranking
ORDER BY posicao;


-- ────────────────────────────────────────────────────────────
-- 17. FORÇAR REFRESH DO ELEVADOR DE RANKING
-- ────────────────────────────────────────────────────────────
-- Quando usar: o elevador (▲▼) está mostrando variação errada
-- ou desatualizada. O pg_cron faz isso automaticamente às 05:00
-- BRT, mas você pode forçar antes.
-- ────────────────────────────────────────────────────────────

SELECT refresh_ranking_elevator_baseline();


-- ────────────────────────────────────────────────────────────
-- 18. CONTAGEM DE PALPITES POR JOGO
-- ────────────────────────────────────────────────────────────
-- Quando usar: quer ver quantos palpitaram em cada jogo.
-- Útil pra ver engajamento por jogo.
-- ────────────────────────────────────────────────────────────

SELECT
  m.id,
  m.round,
  COALESCE(ht.name, m.home_placeholder) || ' × ' ||
    COALESCE(at.name, m.away_placeholder) AS jogo,
  COUNT(pr.id) AS qtd_palpites,
  m.kickoff_time AT TIME ZONE 'America/Sao_Paulo' AS kickoff_brt
FROM matches m
LEFT JOIN predictions pr ON pr.match_id = m.id
LEFT JOIN teams ht ON ht.id = m.home_team_id
LEFT JOIN teams at ON at.id = m.away_team_id
GROUP BY m.id, ht.name, at.name
ORDER BY m.kickoff_time;


-- ────────────────────────────────────────────────────────────
-- 19. DIAGNÓSTICO GERAL DO BOLÃO
-- ────────────────────────────────────────────────────────────
-- Quando usar: quer ver "status geral" do bolão em uma query.
-- ────────────────────────────────────────────────────────────

SELECT
  (SELECT COUNT(*) FROM profiles) AS usuarios,
  (SELECT COUNT(*) FROM profiles WHERE is_admin) AS admins,
  (SELECT COUNT(*) FROM matches) AS total_jogos,
  (SELECT COUNT(*) FROM matches WHERE status = 'finished') AS jogos_finalizados,
  (SELECT COUNT(*) FROM matches WHERE round != 'group' AND home_team_id IS NULL) AS mata_mata_sem_definir,
  (SELECT COUNT(*) FROM predictions) AS total_palpites,
  (SELECT COUNT(*) FROM predictions WHERE points IS NOT NULL) AS palpites_pontuados,
  (SELECT COUNT(*) FROM special_predictions) AS palpites_especiais,
  (SELECT COUNT(*) FROM special_questions WHERE correct_answer IS NOT NULL) AS especiais_definidas;


-- ============================================================
-- Dicas finais
-- ============================================================
--
-- 1. Sempre use BEGIN/COMMIT pra alterações em massa. Se algo der
--    errado no meio, use ROLLBACK e nada é commitado.
--
-- 2. Antes de DELETE/UPDATE em massa, roda primeiro um SELECT com
--    o mesmo WHERE pra confirmar quantas linhas serão afetadas.
--
-- 3. Pra mudanças de schema (ADD COLUMN, etc), crie uma migration
--    nova em supabase/migrations/ em vez de rodar SQL avulso.
--    Mantém histórico.
--
-- 4. Pra debug profundo, ative o log de queries no Supabase
--    Dashboard → Database → Logs. Vê o SQL exato sendo executado.
-- ============================================================