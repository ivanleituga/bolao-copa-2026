import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getFlagUrl } from '../lib/flags'
import { getRoundLabel } from '../lib/scoring'

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function formatMatchDate(iso) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} • ${DIAS[d.getDay()]} • ${hh}:${min}`
}

function TeamFlag({ code, size = 24 }) {
  const url = getFlagUrl(code, 80)
  if (!url) {
    return (
      <span
        className="inline-block rounded bg-gray-600"
        style={{ width: size, height: size * 0.67 }}
      />
    )
  }
  return (
    <img
      src={url}
      alt={code}
      className="inline-block rounded-sm object-cover"
      style={{ width: size, height: size * 0.67 }}
      loading="lazy"
    />
  )
}

/* ═══════════════════════════════════════════════════
   AdminMatchCard — card de um jogo com input de resultado
   ═══════════════════════════════════════════════════ */

function AdminMatchCard({ match, onResult }) {
  const [home, setHome] = useState(match.home_score ?? '')
  const [away, setAway] = useState(match.away_score ?? '')
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isFinished = match.status === 'finished'
  const hasInput = home !== '' && away !== '' && !isNaN(parseInt(home)) && !isNaN(parseInt(away))

  const handleSubmit = () => {
    if (!hasInput) return
    setConfirming(true)
    setError(null)
  }

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)

    const h = parseInt(home)
    const a = parseInt(away)

    const { error: rpcError } = await supabase.rpc('process_match_result', {
      p_match_id: match.id,
      p_home_score: h,
      p_away_score: a,
    })

    if (rpcError) {
      console.error('Erro ao processar resultado:', rpcError)
      setError('Erro ao salvar resultado')
      setSaving(false)
      setConfirming(false)
      return
    }

    setSaving(false)
    setConfirming(false)
    onResult(match.id, h, a)
  }

  const handleCancel = () => {
    setConfirming(false)
    setError(null)
  }

  const inputClasses = `w-12 h-12 text-center bg-gray-700/80 text-white font-bold text-xl rounded-lg
    border border-gray-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 focus:outline-none
    transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
    [&::-webkit-inner-spin-button]:appearance-none`

  return (
    <div className={`bg-gray-800/80 rounded-xl border overflow-hidden
      ${isFinished ? 'border-gray-700/30' : 'border-gray-700/40'}`}>

      {/* Header do card */}
      <div className="px-4 py-2.5 border-b border-gray-700/30 flex items-center justify-between">
        <div className="text-xs text-gray-400">
          <span className="font-medium">{formatMatchDate(match.kickoff_time)}</span>
          <span className="text-gray-600 mx-1.5">·</span>
          <span>{getRoundLabel(match.round)}</span>
          {match.group_letter && (
            <span className="text-gray-600"> · Grupo {match.group_letter}</span>
          )}
        </div>
        {isFinished && (
          <span className="text-[10px] uppercase tracking-wider text-green-500 font-semibold">
            Finalizado
          </span>
        )}
      </div>

      {/* Corpo */}
      <div className="px-4 py-4">
        {/* Estádio */}
        {match.venue && (
          <p className="text-center text-gray-500 text-[10px] uppercase tracking-wider mb-3 truncate">
            {match.venue}
          </p>
        )}

        {/* Times + Placar */}
        <div className="flex items-center justify-center gap-3">
          {/* Casa */}
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <span className="text-white text-sm font-medium truncate text-right">
              {match.home_team.name}
            </span>
            <TeamFlag code={match.home_team.code} size={26} />
          </div>

          {/* Input de placar */}
          <div className="flex items-center gap-2 px-2">
            <input
              type="number"
              min="0"
              max="99"
              value={home}
              onChange={(e) => setHome(e.target.value)}
              className={inputClasses}
              placeholder="-"
            />
            <span className="text-gray-500 text-lg font-bold">×</span>
            <input
              type="number"
              min="0"
              max="99"
              value={away}
              onChange={(e) => setAway(e.target.value)}
              className={inputClasses}
              placeholder="-"
            />
          </div>

          {/* Visitante */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TeamFlag code={match.away_team.code} size={26} />
            <span className="text-white text-sm font-medium truncate">
              {match.away_team.name}
            </span>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <p className="text-red-400 text-xs text-center mt-3">{error}</p>
        )}

        {/* Botões */}
        <div className="mt-4">
          {!confirming ? (
            <button
              onClick={handleSubmit}
              disabled={!hasInput}
              className="w-full py-2.5 text-sm font-semibold rounded-lg transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed
                bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {isFinished ? 'Corrigir resultado' : 'Registrar resultado'}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-center text-yellow-400 text-xs font-medium">
                Confirma {match.home_team.name} {parseInt(home)} × {parseInt(away)} {match.away_team.name}?
              </p>
              <p className="text-center text-gray-500 text-[10px]">
                Isso recalcula os pontos de todos os participantes.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors
                    bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors
                    bg-green-600 hover:bg-green-700 text-white
                    disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Admin — página principal
   ═══════════════════════════════════════════════════ */

export default function Admin() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(
          `*,
          home_team:teams!home_team_id(id, name, code),
          away_team:teams!away_team_id(id, name, code)`
        )
        .order('kickoff_time')

      if (error) {
        console.error('Erro ao buscar jogos:', error)
        setLoading(false)
        return
      }

      setMatches(data || [])
      setLoading(false)
    }

    fetchMatches()
  }, [])

  const handleResult = (matchId, homeScore, awayScore) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? { ...m, home_score: homeScore, away_score: awayScore, status: 'finished' }
          : m
      )
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Carregando jogos...</p>
        </div>
      </div>
    )
  }

  const pending = matches.filter((m) => m.status !== 'finished')
  const finished = matches.filter((m) => m.status === 'finished')
  const displayMatches = filter === 'pending' ? pending : finished

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-px flex-1 bg-gray-700/50" />
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Painel do Admin
        </h2>
        <div className="h-px flex-1 bg-gray-700/50" />
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
            ${filter === 'pending'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
        >
          Aguardando resultado
          <span className="ml-1.5 text-xs opacity-70">({pending.length})</span>
        </button>
        <button
          onClick={() => setFilter('finished')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
            ${filter === 'finished'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
        >
          Finalizados
          <span className="ml-1.5 text-xs opacity-70">({finished.length})</span>
        </button>
      </div>

      {/* Lista de jogos */}
      {displayMatches.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-gray-500 text-sm">
            {filter === 'pending'
              ? 'Todos os jogos já foram finalizados.'
              : 'Nenhum jogo finalizado ainda.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {displayMatches.map((match) => (
            <AdminMatchCard
              key={match.id}
              match={match}
              onResult={handleResult}
            />
          ))}
        </div>
      )}
    </div>
  )
}