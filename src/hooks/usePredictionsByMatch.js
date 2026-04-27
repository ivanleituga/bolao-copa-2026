import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Busca palpites de um match específico + todos os usuários do bolão.
 * Usado no MatchPredictionsModal pra mostrar palpites de todos + quem
 * ainda não palpitou.
 *
 * Carrega só quando matchId estiver definido (lazy — só dispara quando
 * o modal abre). Se matchId for null, fica em estado "ocioso" sem fetch.
 *
 * IMPLEMENTAÇÃO: faz 2 queries em paralelo (predictions + profiles) e
 * mescla os display_names no JS. NÃO usa JOIN aninhado do PostgREST
 * porque a FK predictions.user_id → auth.users(id), não → profiles(id).
 * O PostgREST não consegue inferir essa relação automaticamente.
 *
 * Retorno:
 *   - predictions: array de { user_id, home_score, away_score, points,
 *                  display_name }
 *   - allUsers: array de { id, display_name } (todos os usuários do bolão)
 *   - missing: array de { id, display_name } — quem NÃO palpitou
 *   - loading, error
 *
 * IMPORTANTE: a RLS de predictions só retorna o que o usuário pode ver:
 * - Próprios palpites (sempre)
 * - Palpites alheios apenas se o jogo já começou OU foi finalizado
 * - Tudo, se for admin
 *
 * Pra jogo não iniciado, esse hook vai retornar só o palpite do próprio
 * usuário (se ele palpitou). O modal interpreta isso como "ainda não há
 * palpites públicos pra mostrar".
 */
export function usePredictionsByMatch(matchId) {
  const [predictions, setPredictions] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (matchId == null) return

    let cancelled = false

    const fetchAll = async () => {
      setLoading(true)
      setError(null)

      // Busca palpites desse match (sem JOIN aninhado — só os campos da tabela)
      const predsPromise = supabase
        .from('predictions')
        .select('user_id, home_score, away_score, points')
        .eq('match_id', matchId)

      // Busca todos os perfis (id + display_name)
      const usersPromise = supabase
        .from('profiles')
        .select('id, display_name')
        .order('display_name')

      const [predsRes, usersRes] = await Promise.all([predsPromise, usersPromise])

      if (cancelled) return

      if (predsRes.error) {
        console.error('Erro ao buscar palpites:', predsRes.error)
        setError(predsRes.error)
        setLoading(false)
        return
      }
      if (usersRes.error) {
        console.error('Erro ao buscar usuários:', usersRes.error)
        setError(usersRes.error)
        setLoading(false)
        return
      }

      // Indexa profiles por id pra fazer lookup rápido (O(1) por palpite)
      const profileById = {}
      ;(usersRes.data || []).forEach((p) => {
        profileById[p.id] = p.display_name
      })

      // Merge: enriquece cada palpite com o display_name do dono
      const enriched = (predsRes.data || []).map((p) => ({
        user_id: p.user_id,
        home_score: p.home_score,
        away_score: p.away_score,
        points: p.points,
        display_name: profileById[p.user_id] || '',
      }))

      setPredictions(enriched)
      setAllUsers(usersRes.data || [])
      setLoading(false)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [matchId])

  // Calcula quem não palpitou
  const predictedUserIds = new Set(predictions.map((p) => p.user_id))
  const missing = allUsers.filter((u) => !predictedUserIds.has(u.id))

  return { predictions, allUsers, missing, loading, error }
}