import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Busca o histórico visível de palpites de um usuário:
 * 1. Palpites em jogos — só os que fazem sentido socialmente:
 *    jogo iniciado (kickoff_time <= now) OU finalizado (status = finished)
 * 2. Palpites especiais — sempre que a RLS retornar
 *
 * IMPORTANTE: a RLS de predictions já filtra pra usuários comuns (só
 * veem o que tem direito). Mas pro admin, a RLS libera tudo via cláusula
 * 3. Aqui aplicamos um filtro client-side adicional pra que mesmo o
 * admin não veja palpites de jogos futuros nesse modal específico — o
 * "perfil social" exibe só o que faria sentido qualquer pessoa ver.
 *
 * Carrega só quando userId estiver definido (lazy — modal aberto).
 *
 * Retorno:
 *   - matchPredictions: array de palpites em jogos visíveis
 *     (ordenado por kickoff_time decrescente)
 *   - specialPredictions: array combinando perguntas + respostas
 *   - profile: { id, display_name } do usuário consultado
 *   - loading, error
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

      // Busca dados completos dos matches pra enriquecer os palpites
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

      // FILTRO CLIENT-SIDE: descarta palpites de jogos que ainda não foram
      // iniciados nem finalizados. Isso protege contra:
      // 1. Admin abrir o perfil e ver palpites alheios de jogos futuros
      //    (a RLS libera pro admin, mas socialmente faz mais sentido bloquear)
      // 2. Próprio usuário ver palpites futuros no perfil (não tem uso real,
      //    e fica visualmente poluído)
      const nowMs = Date.now()
      const enriched = (matchPredsRes.data || [])
        .map((pred) => {
          const m = matchById[pred.match_id]
          if (!m) return null

          // Filtro: o jogo precisa ter começado ou estar finalizado
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

      // Combina especiais com perguntas
      const questionById = {}
      ;(specialQsRes.data || []).forEach((q) => { questionById[q.id] = q })

      const enrichedSpecials = (specialPredsRes.data || [])
        .map((sp) => {
          const q = questionById[sp.question_id]
          if (!q) return null
          const isCorrect = q.correct_answer
            ? sp.answer.toLowerCase().trim() === q.correct_answer.toLowerCase().trim()
            : null
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