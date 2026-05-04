import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TeamFlag } from './TeamFlag'

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Ordem oficial das fases mata-mata
const KNOCKOUT_ROUNDS = ['round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final']

const ROUND_LABELS = {
  round_of_32: '16 avos',
  round_of_16: 'Oitavas',
  quarter: 'Quartas',
  semi: 'Semifinal',
  third_place: '3º lugar',
  final: 'Final',
}

// Labels mais curtos pra economizar espaço em mobile/coluna
const ROUND_LABELS_SHORT = {
  round_of_32: '16 avos',
  round_of_16: 'Oitavas',
  quarter: 'Quartas',
  semi: 'Semis',
  third_place: '3º lugar',
  final: 'Final',
}

function formatDate(iso) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} • ${DIAS[d.getDay()]} • ${hh}:${min}`
}

/** Formato compacto pro card pequeno: 25/06 • 16:00 */
function formatDateCompact(iso) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} • ${hh}:${min}`
}

/* ═══════════════════════════════════════════════════
   TeamLine — uma linha de time dentro do card
   Mostra ou o time real (com bandeira) ou placeholder
   ═══════════════════════════════════════════════════ */

function TeamLine({ team, placeholder, score, isWinner, compact = false }) {
  const flagSize = compact ? 16 : 18
  const textSize = compact ? 'text-xs' : 'text-[13px]'

  return (
    <div className={`flex items-center gap-1.5 py-0.5 ${isWinner ? 'opacity-100' : score != null ? 'opacity-60' : 'opacity-100'}`}>
      {team ? (
        <>
          <TeamFlag code={team.code} size={flagSize} />
          <span className={`${textSize} text-white font-medium truncate flex-1 min-w-0`}>
            {team.name}
          </span>
        </>
      ) : (
        <>
          <div
            style={{ width: flagSize, height: Math.round(flagSize * 0.67) }}
            className="rounded-sm border border-dashed border-gray-600 bg-gray-800/40 flex-shrink-0"
          />
          <span className={`${textSize} text-gray-500 italic truncate flex-1 min-w-0`}>
            {placeholder || '—'}
          </span>
        </>
      )}
      {score != null && (
        <span className={`${textSize} text-white font-bold tabular-nums w-4 text-right`}>
          {score}
        </span>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   KnockoutCard — card individual de um confronto
   ═══════════════════════════════════════════════════ */

function KnockoutCard({ match, compact = false }) {
  const isFinished = match.status === 'finished' && match.home_score != null
  const homeWon = isFinished && match.home_score > match.away_score
  const awayWon = isFinished && match.away_score > match.home_score
  // Em caso de empate finalizado (mata-mata sem prorrogação implementada),
  // não destacamos vencedor — apenas mostramos o placar.

  const padding = compact ? 'p-2' : 'p-2.5'

  return (
    <div className={`bg-gray-800/80 rounded-lg border border-gray-700/40 ${padding}`}>
      {/* Data/hora */}
      <div className={`text-[9px] text-gray-500 uppercase tracking-wider font-bold mb-1.5 truncate ${compact ? '' : 'text-center'}`}>
        {compact ? formatDateCompact(match.kickoff_time) : formatDate(match.kickoff_time)}
      </div>

      {/* Linhas dos times */}
      <div className="space-y-0.5">
        <TeamLine
          team={match.home_team}
          placeholder={match.home_placeholder}
          score={isFinished ? match.home_score : null}
          isWinner={homeWon}
          compact={compact}
        />
        <TeamLine
          team={match.away_team}
          placeholder={match.away_placeholder}
          score={isFinished ? match.away_score : null}
          isWinner={awayWon}
          compact={compact}
        />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   DesktopBracket — 6 colunas lado a lado
   ═══════════════════════════════════════════════════ */

function DesktopBracket({ matchesByRound }) {
  return (
    <div className="hidden md:grid gap-3" style={{ gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
      {KNOCKOUT_ROUNDS.map((round) => {
        const matches = matchesByRound[round] || []
        return (
          <div key={round} className="flex flex-col gap-2">
            {/* Header da coluna */}
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-1">
              {ROUND_LABELS_SHORT[round]}
              <span className="text-gray-600 ml-1">({matches.length})</span>
            </h4>
            {/* Cards da fase */}
            <div className="flex flex-col gap-1.5">
              {matches.map((m) => (
                <KnockoutCard key={m.id} match={m} compact />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   MobileBracket — accordion por fase
   ═══════════════════════════════════════════════════ */

function MobileAccordion({ round, matches, isOpen, onToggle }) {
  return (
    <div className="bg-gray-800/40 rounded-lg border border-gray-700/40 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">
            {ROUND_LABELS[round]}
          </span>
          <span className="text-xs text-gray-500">
            ({matches.length})
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-2 pb-2 pt-1 space-y-1.5">
          {matches.map((m) => (
            <KnockoutCard key={m.id} match={m} compact={false} />
          ))}
        </div>
      )}
    </div>
  )
}

function MobileBracket({ matchesByRound }) {
  // Default: 16 avos aberto, resto colapsado
  const [openRounds, setOpenRounds] = useState({ round_of_32: true })

  const toggleRound = (round) => {
    setOpenRounds((prev) => ({ ...prev, [round]: !prev[round] }))
  }

  return (
    <div className="md:hidden space-y-2">
      {KNOCKOUT_ROUNDS.map((round) => {
        const matches = matchesByRound[round] || []
        if (matches.length === 0) return null
        return (
          <MobileAccordion
            key={round}
            round={round}
            matches={matches}
            isOpen={!!openRounds[round]}
            onToggle={() => toggleRound(round)}
          />
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   KnockoutBracket — componente principal
   ═══════════════════════════════════════════════════ */

export default function KnockoutBracket() {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(
          `*,
          home_team:teams!home_team_id(id, name, code),
          away_team:teams!away_team_id(id, name, code)`
        )
        .in('round', KNOCKOUT_ROUNDS)
        .order('kickoff_time')

      if (error) {
        console.error('Erro ao buscar mata-mata:', error)
        setLoading(false)
        return
      }

      setMatches(data || [])
      setLoading(false)
    }

    fetchMatches()
  }, [])

  if (loading) {
    return (
      <div className="py-6 text-center">
        <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-gray-500 text-xs">Carregando mata-mata...</p>
      </div>
    )
  }

  if (matches.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-gray-500 text-sm">Nenhum jogo de mata-mata cadastrado.</p>
      </div>
    )
  }

  // Agrupa matches por round
  const matchesByRound = {}
  matches.forEach((m) => {
    if (!matchesByRound[m.round]) matchesByRound[m.round] = []
    matchesByRound[m.round].push(m)
  })

  return (
    <div>
      <DesktopBracket matchesByRound={matchesByRound} />
      <MobileBracket matchesByRound={matchesByRound} />
    </div>
  )
}