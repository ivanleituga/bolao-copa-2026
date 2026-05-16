import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { calculateStandings } from '../lib/standings'
import { useMatchesAndPredictions } from '../hooks/useMatchesAndPredictions'
import MatchCard from '../components/MatchCard'
import { TeamFlag } from '../components/TeamFlag'
import SpecialPredictions from '../components/SpecialPredictions'
import KnockoutBracket from '../components/KnockoutBracket'


/* ═══════════════════════════════════════════════════
   Helpers específicos da tela de grupos
   ═══════════════════════════════════════════════════ */

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

/** Formata saldo de gols com sinal: +3, -2, 0 */
function formatGoalDiff(sg) {
  if (sg > 0) return `+${sg}`
  return String(sg)
}

/* ═══════════════════════════════════════════════════
   StatsTable
   ═══════════════════════════════════════════════════ */

function StatsTable({ standings }) {
  const statCols = ['P', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG']

  const gridStyle = {
    gridTemplateColumns: '32px minmax(120px, 1fr) repeat(8, 40px)',
    minWidth: 472,
  }

  return (
    <div className="flex-1 flex flex-col overflow-x-auto py-2">
      {/* Header */}
      <div
        className="grid items-center border-b border-gray-700/50 py-3 px-3"
        style={gridStyle}
      >
        <span className="col-span-2 text-left text-xs text-gray-400 uppercase tracking-wider font-semibold">
          Classificação
        </span>
        {statCols.map((col) => (
          <span
            key={col}
            className="text-center text-xs text-gray-400 uppercase tracking-wider font-semibold"
          >
            {col}
          </span>
        ))}
      </div>

      {/* Linhas */}
      {standings.map((row, idx) => {
        const values = [
          row.points,
          row.played,
          row.won,
          row.drawn,
          row.lost,
          row.goalsFor,
          row.goalsAgainst,
          formatGoalDiff(row.goalDiff),
        ]

        return (
          <div
            key={row.team.id}
            className={`grid items-center flex-1 py-3 px-3
              border-b border-gray-800/60 last:border-0
              border-l-2 ${idx < 2 ? 'border-l-green-500/70' : 'border-l-transparent'}`}
            style={gridStyle}
          >
            <span className="text-gray-400 text-sm text-center">{idx + 1}</span>
            <div className="flex items-center gap-2.5 min-w-0">
              <TeamFlag code={row.team.code} size={26} />
              <span className="text-white text-base font-medium truncate">
                {row.team.name}
              </span>
            </div>
            {values.map((val, i) => (
              <span
                key={i}
                className={`text-center font-mono text-base ${
                  i === 0 ? 'text-white font-bold' : 'text-gray-400'
                }`}
              >
                {val}
              </span>
            ))}
          </div>
        )
      })}
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

      <div className="flex-1 px-3 flex flex-col">
        {roundMatches.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
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

  const standings = calculateStandings(teams, matches)

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
            <div className="bg-gray-900/60 rounded-lg overflow-hidden lg:flex-1 flex flex-col">
              <StatsTable standings={standings} />
            </div>

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
   Groups — componente principal
   ═══════════════════════════════════════════════════ */

export default function Groups({ userId }) {
  const [teams, setTeams] = useState({})
  const [teamsLoading, setTeamsLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  const { matches, predictions, loading, handlePredictionSaved } =
    useMatchesAndPredictions(userId, ['group'])

  // Relógio global — atualiza a cada segundo
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Busca teams uma vez e agrupa por letra do grupo
  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('group_letter')
        .order('name')

      if (error) {
        console.error('Erro ao buscar seleções:', error)
        setTeamsLoading(false)
        return
      }

      const grouped = {}
      data.forEach((t) => {
        if (!grouped[t.group_letter]) grouped[t.group_letter] = []
        grouped[t.group_letter].push(t)
      })
      setTeams(grouped)
      setTeamsLoading(false)
    }

    fetchTeams()
  }, [])

  if (loading || teamsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Carregando grupos...</p>
        </div>
      </div>
    )
  }

  // Atribui roundNumber e agrupa por letra
  assignRoundNumbers(matches)
  const matchesByGroup = {}
  matches.forEach((m) => {
    if (!matchesByGroup[m.group_letter]) matchesByGroup[m.group_letter] = []
    matchesByGroup[m.group_letter].push(m)
  })

  const groupLetters = Object.keys(teams).sort()

  return (
    <div>
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
            matches={matchesByGroup[letter] || []}
            predictions={predictions}
            now={now}
            userId={userId}
            onSaved={handlePredictionSaved}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 mt-8 mb-4">
        <div className="h-px flex-1 bg-gray-700/50" />
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Mata-Mata
        </h2>
        <div className="h-px flex-1 bg-gray-700/50" />
      </div>
      <KnockoutBracket userId={userId} now={now} />
    </div>
  )
}