-- ============================================================
-- BOLÃO COPA 2026 - Reset pré-Copa
-- ============================================================
-- Roda este script no SQL Editor do Supabase ANTES do dia 11/06/2026
-- (sugestão: alguns dias antes pra dar tempo de revalidar tudo).
--
-- O que este script faz:
--   1. Apaga todos os palpites em jogos (predictions)
--   2. Apaga todos os palpites especiais (special_predictions)
--   3. Reseta placares e status de jogos finalizados
--   4. Limpa correct_answer das perguntas especiais
--   5. Reseta confrontos de mata-mata (volta pros placeholders)
--   6. Trunca a tabela do elevador de ranking
--
-- O que este script PRESERVA:
--   - Os 35 usuários reais (auth.users + profiles)
--   - As 48 seleções (teams)
--   - Os 104 jogos com seus horários e estádios
--   - As 2 perguntas especiais (campeão / artilheiro)
--
-- IMPORTANTE: este script é DESTRUTIVO. Faça um backup do banco
-- antes de rodar caso queira preservar dados de teste pra análise.
-- No Supabase: Database → Backups → Create backup.
--
-- Recomendação: rodar tudo numa transação. Se algo der errado no meio,
-- nada é commitado. Para isso, basta selecionar todo o BEGIN/COMMIT
-- abaixo no SQL Editor.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. PREDICTIONS - palpites em jogos
-- ============================================================
-- TRUNCATE é mais rápido que DELETE pra tabela inteira
TRUNCATE TABLE predictions;


-- ============================================================
-- 2. SPECIAL_PREDICTIONS - palpites de campeão/artilheiro
-- ============================================================
TRUNCATE TABLE special_predictions;


-- ============================================================
-- 3. MATCHES - resetar placares e status
-- ============================================================
-- Volta todos os jogos pro estado "scheduled" sem placar.
-- Como não restringimos por round, isso cobre fase de grupos E
-- mata-matas que foram testados.
UPDATE matches
SET home_score = NULL,
    away_score = NULL,
    status = 'scheduled';


-- ============================================================
-- 4. SPECIAL_QUESTIONS - zerar correct_answer
-- ============================================================
-- Se você definiu "campeão = Alemanha" durante os testes, limpa.
UPDATE special_questions
SET correct_answer = NULL;


-- ============================================================
-- 5. MATCHES - resetar times do mata-mata
-- ============================================================
-- Volta confrontos de mata-mata pros placeholders (W74, 1A, etc).
-- A fase de grupos NÃO é tocada — os 72 jogos têm times fixos.
UPDATE matches
SET home_team_id = NULL,
    away_team_id = NULL
WHERE round != 'group';


-- ============================================================
-- 6. RANKING_ELEVATOR_BASELINE - limpa snapshots antigos
-- ============================================================
-- A tabela tem snapshots de ranking pra mostrar variação diária.
-- Sem isso, no dia 1 da Copa o elevador mostraria variação
-- baseada nos dados de teste até o pg_cron rodar (05:00 BRT).
TRUNCATE TABLE ranking_elevator_baseline;


-- ============================================================
-- VERIFICAÇÃO - confere se tudo zerou
-- ============================================================
-- Roda esta query depois do COMMIT pra validar.
-- Esperado: 0 predictions, 0 special_predictions, 0 jogos finalizados,
-- 0 correct_answers definidas, 32 jogos sem times (todos do mata-mata).

-- Descomenta as linhas abaixo pra rodar a verificação ANTES de commitar:
--
-- SELECT 'predictions' AS tabela, COUNT(*) AS rows FROM predictions
-- UNION ALL SELECT 'special_predictions', COUNT(*) FROM special_predictions
-- UNION ALL SELECT 'jogos finalizados', COUNT(*) FROM matches WHERE status = 'finished'
-- UNION ALL SELECT 'jogos com placar', COUNT(*) FROM matches WHERE home_score IS NOT NULL
-- UNION ALL SELECT 'correct_answer definida', COUNT(*) FROM special_questions WHERE correct_answer IS NOT NULL
-- UNION ALL SELECT 'mata-mata sem times', COUNT(*) FROM matches WHERE round != 'group' AND home_team_id IS NULL
-- UNION ALL SELECT 'elevador baseline', COUNT(*) FROM ranking_elevator_baseline;


COMMIT;
-- Se algo der errado e você quiser desfazer ANTES do COMMIT acima,
-- troca o COMMIT por ROLLBACK e tudo volta ao estado anterior.


-- ============================================================
-- Após o reset, próximos passos:
-- ============================================================
-- 1. Verifica que os 35 usuários reais continuam ativos
--    (SELECT id, email FROM auth.users ORDER BY created_at;)
-- 2. Confirma com o grupo que o bolão está zerado
-- 3. Define os deadlines das perguntas especiais
--    (o deadline da pergunta DEVE ser antes do primeiro jogo)
-- 4. Avisa o grupo que pode palpitar
-- 5. No dia da Copa, processa resultados via Admin.jsx normalmente
-- ============================================================