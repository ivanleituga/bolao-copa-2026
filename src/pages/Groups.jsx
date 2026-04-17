import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getFlagUrl } from '../lib/flags'
import { getPointsLabel, getPointsColor, MULTIPLIERS } from '../lib/scoring'
import SpecialPredictions from './SpecialPredictions'

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

function formatCountdown(ms) {
  if (ms <= 0) return null
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}min`
  if (m >= 10) return `${m}min`
  return `${m}min ${s}s`
}

function countdownColor(ms) {
  if (ms <= 600000) return 'text-red-400'
  if (ms <= 3600000) return 'text-yellow-400'
  return 'text-gray-400'
}

/** Atribui número da rodada (1, 2 ou 3) dentro de cada grupo */
function assignRoundNumbers(matches) {
  const byGroup = {}
  matches.forEach((m) => {
    if (!byGroup[m.group_letter]) byGroup[m.group_letter] = []
    byGroup[m.group_letter].push(m)
  })

  Object.values(byGroup).forEach((groupMatches) => {
    groupMatches.sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time))
    groupMatches.forEach((m, i) => {
      m.roundNumber = Math.floor(i / 2) + 1
    })
  })

  return matches
}

/* ═══════════════════════════════════════════════════
   TeamFlag
   ═══════════════════════════════════════════════════ */

function TeamFlag({ code, size = 22 }) {
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
   StatsTable
   ═══════════════════════════════════════════════════ */

function StatsTable({ teams }) {
  const statCols = ['P', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG']

  return (
    <div className="overflow-x-auto flex-1 p-2 flex items-center">
      <table className="w-full" style={{ minWidth: 380 }}>
        <thead>
          <tr className="border-b border-gray-700/50">
            <th
              colSpan={2}
              className="text-left text-xs text-gray-400 uppercase tracking-wider font-semibold pt-5 pb-7 pl-3"
            >
              Classificação
            </th>
            {statCols.map((col) => (
              <th
                key={col}
                className="text-center text-xs text-gray-400 uppercase tracking-wider font-semibold pt-5 pb-7"
                style={{ width: 40 }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((team, idx) => (
            <tr
              key={team.id}
              className={`border-b border-gray-800/60 last:border-0
                ${idx < 2
                  ? 'border-l-2 border-l-green-500/70'
                  : 'border-l-2 border-l-transparent'
                }`}
            >
              <td className="py-5 pl-3 text-gray-400 text-sm text-center w-8">
                {idx + 1}
              </td>
              <td className="py-5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <TeamFlag code={team.code} size={26} />
                  <span className="text-white text-base font-medium truncate">
                    {team.name}
                  </span>
                </div>
              </td>
              {statCols.map((col, i) => (
                <td
                  key={col}
                  className={`py-5 text-center font-mono text-base
                    ${i === 0 ? 'text-white font-bold' : 'text-gray-400'}`}
                  style={{ width: 40 }}
                >
                  0
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   MatchCard — card individual de cada jogo + palpite
   ═══════════════════════════════════════════════════ */

function MatchCard({ match, prediction, now, userId, onSaved }) {
  const [home, setHome] = useState(prediction?.home_score ?? '')
  const [away, setAway] = useState(prediction?.away_score ?? '')
  const [saveStatus, setSaveStatus] = useState(null)

  const deadline = new Date(match.kickoff_time).getTime() - 5 * 60 * 1000
  const remaining = deadline - now
  const isOpen = remaining > 0 && match.status !== 'finished'
  const isFinished = match.status === 'finished' && match.home_score != null

  const handleSave = async () => {
    const h = parseInt(home)
    const a = parseInt(away)
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) return
    if (!isOpen) return
    if (prediction && prediction.home_score === h && prediction.away_score === a) return

    setSaveStatus('saving')

    const { error } = await supabase.from('predictions').upsert(
      {
        user_id: userId,
        match_id: match.id,
        home_score: h,
        away_score: a,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,match_id' }
    )

    if (error) {
      console.error('Erro ao salvar palpite:', error)
      // RLS bloqueia quando o jogo já foi finalizado ou o prazo passou
      if (error.code === '42501' || error.message?.includes('row-level security')) {
        setSaveStatus('blocked')
      } else {
        setSaveStatus('error')
      }
    } else {
      setSaveStatus('saved')
      onSaved(match.id, h, a)
    }

    setTimeout(() => setSaveStatus(null), 4000)
  }

  const inputClasses = `w-9 h-9 text-center bg-gray-700/80 text-white font-bold text-base rounded-lg
    border border-gray-600 focus:border-green-500 focus:ring-1 focus:ring-green-500/30 focus:outline-none
    disabled:opacity-30 disabled:cursor-not-allowed transition-colors
    [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
    [&::-webkit-inner-spin-button]:appearance-none`

  return (
    <div className="py-3.5 space-y-2 border-b border-gray-700/30 last:border-0">
      {/* Estádio + Data */}
      <div className="text-center space-y-0.5">
        <p className="text-gray-300 text-[10px] uppercase tracking-wider leading-tight truncate px-2">
          {match.venue}
        </p>
        <p className="text-gray-400 text-xs font-medium">
          {formatMatchDate(match.kickoff_time)}
        </p>
      </div>

      {/* Seleções + Placar/Palpite */}
      <div className="flex items-center justify-center gap-2">
        {/* Casa */}
        <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
          <span className="text-white text-[13px] font-medium truncate text-right">
            {match.home_team.name}
          </span>
          <TeamFlag code={match.home_team.code} size={22} />
        </div>

        {/* Área de placar */}
        {isFinished ? (
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-700/40 rounded-lg">
            <span className="text-white font-bold text-lg w-5 text-center">
              {match.home_score}
            </span>
            <span className="text-gray-500 text-xs">×</span>
            <span className="text-white font-bold text-lg w-5 text-center">
              {match.away_score}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-1">
            <input
              type="number"
              min="0"
              max="99"
              value={home}
              onChange={(e) => setHome(e.target.value)}
              onBlur={handleSave}
              disabled={!isOpen}
              className={inputClasses}
            />
            <span className="text-gray-500 text-sm font-bold">×</span>
            <input
              type="number"
              min="0"
              max="99"
              value={away}
              onChange={(e) => setAway(e.target.value)}
              onBlur={handleSave}
              disabled={!isOpen}
              className={inputClasses}
            />
          </div>
        )}

        {/* Visitante */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <TeamFlag code={match.away_team.code} size={22} />
          <span className="text-white text-[13px] font-medium truncate">
            {match.away_team.name}
          </span>
        </div>
      </div>

      {/* Linha de status */}
      <div className="text-center text-[11px] min-h-[16px]">
        {isFinished && prediction && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-gray-400">
              Seu palpite: {prediction.home_score} × {prediction.away_score}
            </span>
            {prediction.points != null && (
              <>
                <span className="text-gray-600">·</span>
                <span className={getPointsColor(prediction.points, MULTIPLIERS[match.round])}>
                  {getPointsLabel(prediction.points, MULTIPLIERS[match.round], prediction.home_score, prediction.away_score)}
                </span>
                <span className="text-gray-600">·</span>
                <span className={`font-bold ${getPointsColor(prediction.points, MULTIPLIERS[match.round])}`}>
                  +{prediction.points} pts
                </span>
              </>
            )}
          </div>
        )}
        {isFinished && !prediction && (
          <span className="text-gray-600 italic">Sem palpite</span>
        )}

        {!isFinished && isOpen && (
          <>
            {saveStatus === 'saving' && (
              <span className="text-yellow-400">Salvando...</span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-green-400">✓ Salvo</span>
            )}
            {saveStatus === 'blocked' && (
              <span className="text-red-400">🔒 Palpite bloqueado — partida já iniciada</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-400">Erro ao salvar</span>
            )}
            {!saveStatus && (
              <span className={countdownColor(remaining)}>
                ⏱ {formatCountdown(remaining)}
              </span>
            )}
          </>
        )}

        {!isFinished && !isOpen && (
          <span className="text-gray-500">🔒 Encerrado</span>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   RoundTabs — abas 1ª / 2ª / 3ª Rodada com jogos
   ═══════════════════════════════════════════════════ */

function RoundTabs({ matches, predictions, now, userId, onSaved }) {
  const [activeRound, setActiveRound] = useState(1)

  const roundMatches = matches.filter((m) => m.roundNumber === activeRound)

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-700/50">
        {[1, 2, 3].map((round) => (
            <button
              key={round}
              onClick={() => setActiveRound(round)}
              className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider
                text-center transition-colors relative
                ${
                  activeRound === round
                    ? 'text-green-400 border-b-2 border-green-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
            >
              {round}ª Rodada
            </button>
          ))}
      </div>

      {/* Jogos da rodada */}
      <div className="flex-1 px-3">
        {roundMatches.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-gray-600 text-xs uppercase tracking-wider">
              Sem jogos nesta rodada
            </p>
          </div>
        ) : (
          roundMatches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              prediction={predictions[match.id] || null}
              now={now}
              userId={userId}
              onSaved={onSaved}
            />
          ))
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   GroupCard — card de um grupo (tabela + rodadas)
   ═══════════════════════════════════════════════════ */

function GroupCard({ letter, teams, matches, predictions, now, userId, onSaved }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-gray-800/80 rounded-xl overflow-hidden border border-gray-700/40">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="bg-green-600 text-white text-xs font-bold w-7 h-7 rounded-lg flex items-center justify-center">
            {letter}
          </span>
          <span className="text-base font-semibold text-white tracking-wide">
            GRUPO {letter}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3">
          <div className="flex flex-col lg:flex-row lg:items-stretch gap-3">
            {/* Tabela de classificação */}
            <div className="bg-gray-900/60 rounded-lg overflow-hidden lg:flex-1 flex flex-col">
              <StatsTable teams={teams} />
            </div>

            {/* Rodadas com jogos e palpites */}
            <div className="bg-gray-900/60 rounded-lg overflow-hidden lg:w-[420px] min-h-[200px]">
              <RoundTabs
                matches={matches}
                predictions={predictions}
                now={now}
                userId={userId}
                onSaved={onSaved}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Groups — componente principal (data fetching)
   ═══════════════════════════════════════════════════ */

export default function Groups({ userId }) {
  const [teams, setTeams] = useState({})
  const [matches, setMatches] = useState({})
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  // Relógio global — atualiza a cada segundo
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Busca seleções, jogos e palpites do usuário
  useEffect(() => {
    const fetchAll = async () => {
      // 1. Seleções
      const { data: teamsData, error: teamsErr } = await supabase
        .from('teams')
        .select('*')
        .order('group_letter')
        .order('name')

      if (teamsErr) {
        console.error('Erro ao buscar seleções:', teamsErr)
        setLoading(false)
        return
      }

      // Agrupa seleções por letra do grupo
      const groupedTeams = {}
      teamsData.forEach((t) => {
        if (!groupedTeams[t.group_letter]) groupedTeams[t.group_letter] = []
        groupedTeams[t.group_letter].push(t)
      })
      setTeams(groupedTeams)

      // 2. Jogos da fase de grupos (com join das seleções)
      const { data: matchesData, error: matchesErr } = await supabase
        .from('matches')
        .select(
          `*,
          home_team:teams!home_team_id(id, name, code),
          away_team:teams!away_team_id(id, name, code)`
        )
        .eq('round', 'group')
        .order('kickoff_time')

      if (matchesErr) {
        console.error('Erro ao buscar jogos:', matchesErr)
        setLoading(false)
        return
      }

      // Atribui roundNumber (1, 2, 3) e agrupa por grupo
      assignRoundNumbers(matchesData)
      const groupedMatches = {}
      matchesData.forEach((m) => {
        if (!groupedMatches[m.group_letter]) groupedMatches[m.group_letter] = []
        groupedMatches[m.group_letter].push(m)
      })
      setMatches(groupedMatches)

      // 3. Palpites do usuário
      const { data: predsData, error: predsErr } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', userId)

      if (predsErr) {
        console.error('Erro ao buscar palpites:', predsErr)
      }

      // Indexa por match_id pra acesso rápido
      const predsMap = {}
      if (predsData) {
        predsData.forEach((p) => {
          predsMap[p.match_id] = p
        })
      }
      setPredictions(predsMap)

      setLoading(false)
    }

    fetchAll()
  }, [userId])

  // Refetch de status dos jogos a cada 30 segundos
  // Detecta quando o admin finaliza um jogo e atualiza a UI
  useEffect(() => {
    const refreshStatuses = async () => {
      const { data } = await supabase
        .from('matches')
        .select('id, status, home_score, away_score')
        .eq('round', 'group')

      if (!data) return

      const statusMap = {}
      data.forEach((m) => { statusMap[m.id] = m })

      setMatches((prev) => {
        const updated = { ...prev }
        Object.keys(updated).forEach((letter) => {
          updated[letter] = updated[letter].map((m) => {
            const fresh = statusMap[m.id]
            if (fresh && (fresh.status !== m.status || fresh.home_score !== m.home_score)) {
              return { ...m, status: fresh.status, home_score: fresh.home_score, away_score: fresh.away_score }
            }
            return m
          })
        })
        return updated
      })

      // Também atualiza os pontos dos palpites quando jogos são finalizados
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
  }, [userId])

  // Callback quando um palpite é salvo — atualiza o state local
  const handlePredictionSaved = (matchId, homeScore, awayScore) => {
    setPredictions((prev) => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        match_id: matchId,
        user_id: userId,
        home_score: homeScore,
        away_score: awayScore,
      },
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Carregando grupos...</p>
        </div>
      </div>
    )
  }

  const groupLetters = Object.keys(teams).sort()

  return (
    <div>
      {/* Palpites Especiais */}
      <SpecialPredictions userId={userId} now={now} />

      <div className="flex items-center gap-2 mb-4">
        <div className="h-px flex-1 bg-gray-700/50" />
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Fase de Grupos
        </h2>
        <div className="h-px flex-1 bg-gray-700/50" />
      </div>

      <div className="space-y-3">
        {groupLetters.map((letter) => (
          <GroupCard
            key={letter}
            letter={letter}
            teams={teams[letter] || []}
            matches={matches[letter] || []}
            predictions={predictions}
            now={now}
            userId={userId}
            onSaved={handlePredictionSaved}
          />
        ))}
      </div>
    </div>
  )
}