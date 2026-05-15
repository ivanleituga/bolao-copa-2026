-- ============================================================
-- RECEITA: Ver palpites especiais (campeão / artilheiro)
-- ============================================================
-- Use no SQL Editor do Supabase quando quiser conferir as respostas
-- antes do deadline ou antes de definir correct_answer.
--
-- O bypass admin foi REMOVIDO da interface do app a partir da
-- migration de privacidade, então a UI não mostra mais.
-- Pra acessar, é por SQL mesmo — separa "ferramenta de manutenção"
-- de "ferramenta de produto".
-- ============================================================


-- ============================================================
-- Consulta 1: Tabela "wide" com nome do palpiteiro e ambas as respostas
-- Cada usuário em uma linha, com campeão e artilheiro lado a lado.
-- ============================================================

SELECT
  p.display_name AS palpiteiro,
  campeao.answer AS campeao_palpitado,
  artilheiro.answer AS artilheiro_palpitado
FROM profiles p
LEFT JOIN special_predictions campeao
  ON campeao.user_id = p.id
  AND campeao.question_id = (
    SELECT id FROM special_questions WHERE answer_type = 'team' LIMIT 1
  )
LEFT JOIN special_predictions artilheiro
  ON artilheiro.user_id = p.id
  AND artilheiro.question_id = (
    SELECT id FROM special_questions WHERE answer_type = 'player' LIMIT 1
  )
ORDER BY p.display_name;


-- ============================================================
-- Consulta 2: Contagem por resposta de campeão
-- Ranqueada — qual seleção é a favorita pra ser campeã
-- ============================================================

SELECT
  answer AS campeao,
  COUNT(*) AS quantidade
FROM special_predictions
WHERE question_id = (
  SELECT id FROM special_questions WHERE answer_type = 'team' LIMIT 1
)
GROUP BY answer
ORDER BY quantidade DESC;


-- ============================================================
-- Consulta 3: Contagem por resposta de artilheiro
-- ============================================================

SELECT
  answer AS artilheiro,
  COUNT(*) AS quantidade
FROM special_predictions
WHERE question_id = (
  SELECT id FROM special_questions WHERE answer_type = 'player' LIMIT 1
)
GROUP BY answer
ORDER BY quantidade DESC;


-- ============================================================
-- Consulta 4: Quem ainda não respondeu (qualquer das duas)
-- ============================================================

SELECT
  p.display_name AS faltante,
  CASE WHEN campeao.id IS NULL THEN '❌' ELSE '✓' END AS campeao,
  CASE WHEN artilheiro.id IS NULL THEN '❌' ELSE '✓' END AS artilheiro
FROM profiles p
LEFT JOIN special_predictions campeao
  ON campeao.user_id = p.id
  AND campeao.question_id = (
    SELECT id FROM special_questions WHERE answer_type = 'team' LIMIT 1
  )
LEFT JOIN special_predictions artilheiro
  ON artilheiro.user_id = p.id
  AND artilheiro.question_id = (
    SELECT id FROM special_questions WHERE answer_type = 'player' LIMIT 1
  )
WHERE campeao.id IS NULL OR artilheiro.id IS NULL
ORDER BY p.display_name;