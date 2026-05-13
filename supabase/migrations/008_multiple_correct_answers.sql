-- ============================================================
-- BOLÃO COPA 2026 - Migration 008: Múltiplas respostas corretas
-- ============================================================
-- Antes: a view `ranking` comparava `sp.answer = sq.correct_answer`
-- Isso impedia configurar mais de uma resposta correta.
--
-- Caso real: artilheiro empatado em gols na Copa. Em 2022 tivemos
-- Messi e Mbappé empatados na artilharia (não foi o caso final mas
-- chegou perto). Seja qual for, o admin precisa marcar todos como
-- corretos pra dar 50pts pra cada palpite que acertou um deles.
--
-- Depois: `correct_answer` continua sendo TEXT (zero mudança de
-- schema), mas pode armazenar nomes separados por vírgula:
--   correct_answer = "Mbappé,Haaland"
--
-- A comparação na view vira:
--   answer = ANY(string_to_array(correct_answer, ','))
-- com normalização (LOWER + TRIM em ambos os lados).
--
-- Compatível retroativamente: se correct_answer for um único nome
-- "Mbappé", o array fica ['Mbappé'] e o comportamento é igual ao de
-- antes.
-- ============================================================

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
    COUNT(CASE WHEN pr.points > 0 AND pr.points != 2 * get_round_multiplier(m.round) THEN 1 END) AS acertos,
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
    -- Normaliza ambos os lados e checa se a resposta do palpite
    -- está em qualquer item da lista separada por vírgulas
    AND LOWER(TRIM(sp.answer)) = ANY(
      SELECT LOWER(TRIM(elem))
      FROM unnest(string_to_array(sq.correct_answer, ',')) AS elem
    )
  GROUP BY sp.user_id
) special_pts ON special_pts.user_id = p.id
ORDER BY total_points DESC, cravadas DESC, total_acertos DESC;

-- ============================================================
-- Notas:
--
-- 1. Schema NÃO muda. `correct_answer` continua TEXT. Single ou
--    multi simplesmente é convenção de uso ("Mbappé" vs "Mbappé,Haaland").
--
-- 2. Pra "campeão" (single), o admin sempre vai gravar 1 nome só.
--    O array vira ['Brasil'] e a comparação acerta normalmente.
--
-- 3. Pra "artilheiro" (potencialmente multi), admin pode gravar
--    "Mbappé,Haaland". Quem palpitou Mbappé OU Haaland ganha 50pts.
--
-- 4. Trim é feito por elemento — espaços extras do tipo
--    "Mbappé, Haaland" são tolerados.
-- ============================================================