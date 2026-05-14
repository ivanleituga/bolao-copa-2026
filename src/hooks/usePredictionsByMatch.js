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
 * IMPLEMENTAÇÃO: faz queries em paralelo (predictions + profiles +
 * match_participation via RPC) e mescla no JS. NÃO usa JOIN aninhado
 * do PostgREST porque a FK predictions.user_id → auth.users(id),
 * não → profiles(id). O PostgREST não consegue inferir essa relação.
 *
 * IMPORTANTE: a RLS de predictions só retorna palpites visíveis ao
 * caller (próprio + jogos iniciados/finalizados + admin vê tudo).
 * Pra jogo não iniciado, a tabela direta retorna só o próprio palpite,
 * o que inflaria o `missing` artificialmente. Pra evitar isso, usamos
 * a RPC `match_participation(match_id)` que retorna user_ids de quem
 * palpitou sem revelar placares — funciona em qualquer estado do jogo.
 *
 * Retorno:
 *   - predictions: array de palpites visíveis (só após início do jogo)
 *   - allUsers: array de todos os usuários do bolão
 *   - missing: array de quem NÃO palpitou (sempre correto, via RPC)
 *   - loading, error
 */
export function usePredictionsByMatch(matchId) {
  const [predictions, setPredictions] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [participatedIds, setParticipatedIds] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (matchId == null) return

    let cancelled = false

    const fetchAll = async () => {
      setLoading(true)
      setError(null)

      // 3 queries em paralelo:
      //   - palpites do jogo (filtrado pela RLS — pode vir parcial)
      //   - todos os perfis (pra montar a lista completa)
      //   - RPC de participação (lista completa de quem palpitou,
      //     mesmo quando RLS oculta os palpites)
      const predsPromise = supabase
        .from('predictions')
        .select('user_id, home_score, away_score, points')
        .eq('match_id', matchId)

      const usersPromise = supabase
        .from('profiles')
        .select('id, display_name')
        .order('display_name')

      const participationPromise = supabase
        .rpc('match_participation', { p_match_id: matchId })

      const [predsRes, usersRes, partRes] = await Promise.all([
        predsPromise,
        usersPromise,
        participationPromise,
      ])

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
      if (partRes.error) {
        console.error('Erro ao buscar participação:', partRes.error)
        // Não fatal: continuamos com base só nas predictions visíveis
      }

      const profileById = {}
      ;(usersRes.data || []).forEach((p) => {
        profileById[p.id] = p.display_name
      })

      const enriched = (predsRes.data || []).map((p) => ({
        user_id: p.user_id,
        home_score: p.home_score,
        away_score: p.away_score,
        points: p.points,
        display_name: profileById[p.user_id] || '',
      }))

      // Set de user_ids que palpitaram (via RPC, sempre correto)
      const ids = new Set((partRes.data || []).map((row) => row.user_id))

      setPredictions(enriched)
      setAllUsers(usersRes.data || [])
      setParticipatedIds(ids)
      setLoading(false)
    }

    fetchAll()
    return () => { cancelled = true }
  }, [matchId])

  // missing usa o set vindo da RPC, não a lista filtrada de predictions
  const missing = allUsers.filter((u) => !participatedIds.has(u.id))
  // contagem total real de participação (não depende da RLS)
  const participatedCount = participatedIds.size

  return { predictions, allUsers, missing, participatedCount, loading, error }
}