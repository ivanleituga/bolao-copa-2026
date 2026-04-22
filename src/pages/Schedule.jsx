import { useState, useEffect } from 'react'
import { useMatchesAndPredictions } from '../hooks/useMatchesAndPredictions'
import MatchCard from '../components/MatchCard'
import SpecialPredictions from '../components/SpecialPredictions'

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

const DIAS_LONG = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

/** Formata a data pra cabeçalho do dia. Ex: "Quinta, 11/06" */
function formatDayHeader(iso) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${DIAS_LONG[d.getDay()]}, ${dd}/${mm}`
}

/** Gera uma chave de dia (YYYY-MM-DD no timezone local) pra agrupar matches */
function dayKey(iso) {
  const d = new Date(iso)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/** Agrupa um array de matches por dia, preservando a ordem do array original */
function groupByDay(matches) {
  const groups = []
  let currentKey = null
  let currentGroup = null

  matches.forEach((m) => {
    const key = dayKey(m.kickoff_time)
    if (key !== currentKey) {
      currentKey = key
      currentGroup = { key, date: m.kickoff_time, matches: [] }
      groups.push(currentGroup)
    }
    currentGroup.matches.push(m)
  })

  return groups
}

/* ═══════════════════════════════════════════════════
   DayGroup — cabeçalho do dia + lista de jogos
   ═══════════════════════════════════════════════════ */

function DayGroup({ group, predictions, now, userId, onSaved }) {
  return (
    <div>
      {/* Cabeçalho do dia — sticky pra grudar no topo durante scroll */}
      <div className="sticky top-[52px] z-10 bg-gray-900/95 backdrop-blur-sm py-2 px-1 mb-1">
        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-gray-700/50" />
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
            {formatDayHeader(group.date)}
          </h3>
          <div className="h-px flex-1 bg-gray-700/50" />
        </div>
      </div>

      {/* Lista de jogos do dia */}
      <div className="bg-gray-800/80 rounded-xl border border-gray-700/40 overflow-hidden px-3">
        {group.matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            prediction={predictions[match.id] || null}
            now={now}
            userId={userId}
            onSaved={onSaved}
          />
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Schedule — componente principal
   ═══════════════════════════════════════════════════ */

export default function Schedule({ userId }) {
  const [now, setNow] = useState(() => Date.now())
  const [filter, setFilter] = useState('upcoming')

  // Busca todas as fases — já preparado pra mata-mata
  // Hoje só existem jogos de 'group' no banco; os demais entram quando a Fase 3 for feita
  const { matches, predictions, loading, handlePredictionSaved } =
    useMatchesAndPredictions(userId, [
      'group',
      'round_of_32',
      'round_of_16',
      'quarter',
      'semi',
      'third_place',
      'final',
    ])

  // Relógio global — atualiza a cada segundo pra countdown
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Carregando jogos...</p>
        </div>
      </div>
    )
  }

  // Separa upcoming e finished
  const upcoming = matches
    .filter((m) => m.status !== 'finished')
    .sort((a, b) => new Date(a.kickoff_time) - new Date(b.kickoff_time))

  const finished = matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time))

  const displayMatches = filter === 'upcoming' ? upcoming : finished
  const groups = groupByDay(displayMatches)

  return (
    <div>
      <SpecialPredictions userId={userId} now={now} />

      <div className="flex items-center gap-2 mb-4">
        <div className="h-px flex-1 bg-gray-700/50" />
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Palpites
        </h2>
        <div className="h-px flex-1 bg-gray-700/50" />
      </div>

      {/* Tabs internas: Próximos / Encerrados */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('upcoming')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
            ${filter === 'upcoming'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
        >
          Próximos
          <span className="ml-1.5 text-xs opacity-70">({upcoming.length})</span>
        </button>
        <button
          onClick={() => setFilter('finished')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors
            ${filter === 'finished'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
        >
          Encerrados
          <span className="ml-1.5 text-xs opacity-70">({finished.length})</span>
        </button>
      </div>

      {/* Lista de jogos agrupados por dia */}
      {groups.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-gray-500 text-sm">
            {filter === 'upcoming'
              ? 'Todos os jogos já foram encerrados.'
              : 'Nenhum jogo encerrado ainda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <DayGroup
              key={group.key}
              group={group}
              predictions={predictions}
              now={now}
              userId={userId}
              onSaved={handlePredictionSaved}
            />
          ))}
        </div>
      )}
    </div>
  )
}