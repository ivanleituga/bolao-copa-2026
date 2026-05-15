import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Verifica se o palpite acerta uma das respostas corretas.
 * correct_answer pode ser:
 *   - null: ainda não definido → retorna null (aguardando)
 *   - "Mbappé": resposta única → true se palpite === "Mbappé"
 *   - "Mbappé,Haaland": múltiplas → true se palpite está em qualquer
 * Normalização: case-insensitive, trim em ambos os lados, trim de
 * cada elemento da lista (tolera "Mbappé, Haaland" com espaço extra).
 */
function checkSpecialCorrect(answer, correctAnswer) {
  if (correctAnswer == null) return null
  const userAnswer = answer.toLowerCase().trim()
  const correctList = correctAnswer.split(',').map((s) => s.toLowerCase().trim())
  return correctList.includes(userAnswer)
}

/**
 * Busca o histórico de palpites visíveis de um usuário pra exibir
 * no UserPredictionsModal (clique num card de outro participante).
 *
 * O que vem do banco é controlado pela RLS:
 * - Palpites em jogos: visíveis se kickoff <= NOW() OU status = finished
 *   OU é o próprio usuário. Caso contrário, a RLS oculta.
 * - Palpites especiais: visíveis se deadline <= NOW() OU correct_answer
 *   IS NOT NULL OU é o próprio usuário. Caso contrário, a RLS oculta.
 *
 * Admin segue as MESMAS regras que usuários comuns na interface
 * (bypass admin foi removido na migration 014). Pra debug/auditoria
 * via SQL Editor, ver receitas em supabase/scripts/.
 *
 * Filtro client-side adicional: como a RLS de predictions usa
 * kickoff_time, o palpite de um jogo iniciado vem. Mas pra esse
 * modal específico, filtramos pra mostrar apenas jogos já iniciados
 * OU finalizados (mesma lógica da RLS, redundância defensiva).
 */
export function useUserPredictions(userId) {
  const [matchPredictions, setMatchPredictions] = useState([])
  const [specialPredictions, setSpecialPredictions] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (userId == null) return

    let cancelled = false

    const fetchAll = async () => {
      setLoading(true)
      setError(null)

      const profilePromise = supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', userId)
        .maybeSingle()

      const matchPredsPromise = supabase
        .from('predictions')
        .select('match_id, home_score, away_score, points')
        .eq('user_id', userId)

      const specialPredsPromise = supabase
        .from('special_predictions')
        .select('question_id, answer, updated_at')
        .eq('user_id', userId)

      const specialQuestionsPromise = supabase
        .from('special_questions')
        .select('id, question_text, answer_type, correct_answer, points_value, deadline')
        .order('id')

      const [profileRes, matchPredsRes, specialPredsRes, specialQsRes] =
        await Promise.all([
          profilePromise,
          matchPredsPromise,
          specialPredsPromise,
          specialQuestionsPromise,
        ])

      if (cancelled) return

      const errors = [profileRes.error, matchPredsRes.error, specialPredsRes.error, specialQsRes.error]
        .filter(Boolean)
      if (errors.length > 0) {
        console.error('Erro ao buscar dados do usuário:', errors)
        setError(errors[0])
        setLoading(false)
        return
      }

      setProfile(profileRes.data)

      const matchIds = (matchPredsRes.data || []).map((p) => p.match_id)
      let matchesData = []
      if (matchIds.length > 0) {
        const { data: matches } = await supabase
          .from('matches')
          .select(`id, kickoff_time, status, home_score, away_score, round, venue,
                   home_team:teams!home_team_id(id, name, code),
                   away_team:teams!away_team_id(id, name, code)`)
          .in('id', matchIds)

        if (cancelled) return
        matchesData = matches || []
      }

      const matchById = {}
      matchesData.forEach((m) => { matchById[m.id] = m })

      const nowMs = Date.now()
      const enriched = (matchPredsRes.data || [])
        .map((pred) => {
          const m = matchById[pred.match_id]
          if (!m) return null

          const kickoffMs = new Date(m.kickoff_time).getTime()
          const isStarted = kickoffMs <= nowMs
          const isFinished = m.status === 'finished'
          if (!isStarted && !isFinished) return null

          return {
            home_score_pred: pred.home_score,
            away_score_pred: pred.away_score,
            points: pred.points,
            match_id: m.id,
            kickoff_time: m.kickoff_time,
            status: m.status,
            round: m.round,
            venue: m.venue,
            home_score_real: m.home_score,
            away_score_real: m.away_score,
            home_team: m.home_team,
            away_team: m.away_team,
          }
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time))

      setMatchPredictions(enriched)

      const questionById = {}
      ;(specialQsRes.data || []).forEach((q) => { questionById[q.id] = q })

      const enrichedSpecials = (specialPredsRes.data || [])
        .map((sp) => {
          const q = questionById[sp.question_id]
          if (!q) return null
          const isCorrect = checkSpecialCorrect(sp.answer, q.correct_answer)
          return {
            question_id: q.id,
            question_text: q.question_text,
            answer_type: q.answer_type,
            answer: sp.answer,
            correct_answer: q.correct_answer,
            isCorrect,
            points: isCorrect ? q.points_value : (isCorrect === false ? 0 : null),
            points_value: q.points_value,
          }
        })
        .filter(Boolean)
        .sort((a, b) => a.question_id - b.question_id)

      setSpecialPredictions(enrichedSpecials)
      setLoading(false)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [userId])

  return { matchPredictions, specialPredictions, profile, loading, error }
}