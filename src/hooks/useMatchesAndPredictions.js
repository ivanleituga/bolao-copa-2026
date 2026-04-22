import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook que gerencia matches e predictions do usuário.
 *
 * Encapsula:
 *   - Fetch inicial de matches (com join de home_team e away_team) e predictions
 *   - Polling a cada 30s pra detectar mudanças de status (admin finalizou jogo)
 *   - Callback handlePredictionSaved pra atualizar state local quando
 *     o MatchCard salva um palpite
 *
 * Parâmetros:
 *   userId — ID do usuário autenticado
 *   rounds — array de rounds a buscar. Default: ['group'].
 *            Ex: ['group'], ['round_of_32'], ['round_of_32', 'round_of_16', ...]
 *
 * Retorna:
 *   matches  — array de matches (ordenados por kickoff_time)
 *   predictions — objeto indexado por match_id
 *   loading  — true durante o fetch inicial
 *   handlePredictionSaved — callback pro MatchCard chamar após salvar
 *   refetch — função pra forçar refetch (útil quando admin atualiza algo)
 */
export function useMatchesAndPredictions(userId, rounds = ['group']) {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)

  // Serialização das rounds pra usar como dependência do useEffect
  // (arrays são comparados por referência; string é estável)
  const roundsKey = rounds.join(',')

  const fetchAll = async () => {
    // 1. Matches (com join das seleções)
    const { data: matchesData, error: matchesErr } = await supabase
      .from('matches')
      .select(
        `*,
        home_team:teams!home_team_id(id, name, code),
        away_team:teams!away_team_id(id, name, code)`
      )
      .in('round', rounds)
      .order('kickoff_time')

    if (matchesErr) {
      console.error('Erro ao buscar jogos:', matchesErr)
      setLoading(false)
      return
    }

    setMatches(matchesData || [])

    // 2. Predictions do usuário (só pras matches que vieram)
    if (matchesData && matchesData.length > 0) {
      const matchIds = matchesData.map((m) => m.id)
      const { data: predsData, error: predsErr } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userId)
        .in('match_id', matchIds)

      if (predsErr) {
        console.error('Erro ao buscar palpites:', predsErr)
      }

      const predsMap = {}
      if (predsData) {
        predsData.forEach((p) => { predsMap[p.match_id] = p })
      }
      setPredictions(predsMap)
    }

    setLoading(false)
  }

  // Fetch inicial
  useEffect(() => {
    fetchAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, roundsKey])

  // Polling a cada 30s pra detectar mudanças de status (admin finalizou jogo)
  // Também refaz predictions pra pegar pontos recalculados
  useEffect(() => {
    const refreshStatuses = async () => {
      const { data } = await supabase
        .from('matches')
        .select('id, status, home_score, away_score')
        .in('round', rounds)

      if (!data) return

      const statusMap = {}
      data.forEach((m) => { statusMap[m.id] = m })

      setMatches((prev) =>
        prev.map((m) => {
          const fresh = statusMap[m.id]
          if (fresh && (fresh.status !== m.status || fresh.home_score !== m.home_score)) {
            return { ...m, status: fresh.status, home_score: fresh.home_score, away_score: fresh.away_score }
          }
          return m
        })
      )

      // Refetch predictions pra pegar pontos atualizados
      const { data: predsData } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userId)

      if (predsData) {
        const predsMap = {}
        predsData.forEach((p) => { predsMap[p.match_id] = p })
        setPredictions(predsMap)
      }
    }

    const interval = setInterval(refreshStatuses, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, roundsKey])

  // Callback pro MatchCard chamar quando salvar um palpite
  const handlePredictionSaved = (matchId, homeScore, awayScore) => {
    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        match_id: matchId,
        user_id: userId,
        home_score: homeScore,
        away_score: awayScore,
        updated_at: new Date().toISOString(),
      },
    }))
  }

  return {
    matches,
    predictions,
    loading,
    handlePredictionSaved,
    refetch: fetchAll,
  }
}