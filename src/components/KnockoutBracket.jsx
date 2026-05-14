import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { TeamFlag } from './TeamFlag'

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const KNOCKOUT_ROUNDS = ['round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final']

const ROUND_LABELS = {
  round_of_32: '16 avos',
  round_of_16: 'Oitavas',
  quarter: 'Quartas',
  semi: 'Semifinal',
  third_place: '3º lugar',
  final: 'Final',
}

/* ═══════════════════════════════════════════════════
   Bracket structure — chaveamento oficial FIFA 2026

   Os 16avos são identificados por placeholder (2A, 1E, etc).
   Pra alinhar visualmente no tree, organizamos eles pela ordem
   em que afunilam pras Quartas/Semis.

   Metade A (esquerda) afunila pra Semi 1 (M101 = W97 × W98)
     QF1 (M97 = W89×W90) ← M89 (W74×W77) + M90 (W73×W75)
     QF2 (M98 = W93×W94) ← M93 (W83×W84) + M94 (W81×W82)

   Metade B (direita) afunila pra Semi 2 (M102 = W99 × W100)
     QF3 (M99 = W91×W92) ← M91 (W76×W78) + M92 (W79×W80)
     QF4 (M100 = W95×W96) ← M95 (W86×W88) + M96 (W85×W87)
   ═══════════════════════════════════════════════════ */

const BRACKET_STRUCTURE = {
  left: {
    round_of_32: ['M74', 'M77', 'M73', 'M75', 'M83', 'M84', 'M81', 'M82'],
    round_of_16: ['M89', 'M90', 'M93', 'M94'],
    quarter: ['M97', 'M98'],
    semi: ['M101'],
  },
  right: {
    round_of_32: ['M76', 'M78', 'M79', 'M80', 'M86', 'M88', 'M85', 'M87'],
    round_of_16: ['M91', 'M92', 'M95', 'M96'],
    quarter: ['M99', 'M100'],
    semi: ['M102'],
  },
}

const PLACEHOLDER_TO_MATCH_NUMBER = {
  '2A×2B': 'M73',
  '1E×3ABCDF': 'M74',
  '1F×2C': 'M75',
  '1C×2F': 'M76',
  '1I×3CDFGH': 'M77',
  '2E×2I': 'M78',
  '1A×3CEFHI': 'M79',
  '1L×3EHIJK': 'M80',
  '1D×3BEFIJ': 'M81',
  '1G×3AEHIJ': 'M82',
  '2K×2L': 'M83',
  '1H×2J': 'M84',
  '1B×3EFGIJ': 'M85',
  '1J×2H': 'M86',
  '1K×3DEIJL': 'M87',
  '2D×2G': 'M88',
}

function getMatchNumber(match) {
  if (match.round === 'round_of_32') {
    const key = `${match.home_placeholder}×${match.away_placeholder}`
    return PLACEHOLDER_TO_MATCH_NUMBER[key]
  }
  if (match.round === 'round_of_16') {
    const key = `${match.home_placeholder}×${match.away_placeholder}`
    const lookup = {
      'W74×W77': 'M89',
      'W73×W75': 'M90',
      'W76×W78': 'M91',
      'W79×W80': 'M92',
      'W83×W84': 'M93',
      'W81×W82': 'M94',
      'W86×W88': 'M95',
      'W85×W87': 'M96',
    }
    return lookup[key]
  }
  if (match.round === 'quarter') {
    const key = `${match.home_placeholder}×${match.away_placeholder}`
    const lookup = {
      'W89×W90': 'M97',
      'W93×W94': 'M98',
      'W91×W92': 'M99',
      'W95×W96': 'M100',
    }
    return lookup[key]
  }
  if (match.round === 'semi') {
    const key = `${match.home_placeholder}×${match.away_placeholder}`
    if (key === 'W97×W98') return 'M101'
    if (key === 'W99×W100') return 'M102'
  }
  if (match.round === 'third_place') return 'M103'
  if (match.round === 'final') return 'M104'
  return null
}

function formatDate(iso) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} • ${DIAS[d.getDay()]} • ${hh}:${min}`
}

function formatDateCompact(iso) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} • ${hh}:${min}`
}

/* ═══════════════════════════════════════════════════
   TeamLine + KnockoutCard
   ═══════════════════════════════════════════════════ */

function TeamLine({ team, placeholder, score, isWinner, compact = false }) {
  const flagSize = compact ? 16 : 18
  const textSize = compact ? 'text-xs' : 'text-[13px]'

  return (
    <div className={`flex items-center gap-1.5 py-0.5 ${
      isWinner ? 'opacity-100' : score != null ? 'opacity-60' : 'opacity-100'
    }`}>
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

function KnockoutCard({ match, compact = false }) {
  if (!match) {
    return (
      <div className="bg-gray-800/40 rounded-lg border border-gray-700/20 p-2 opacity-40">
        <div className="text-[9px] text-gray-600 italic text-center">—</div>
      </div>
    )
  }

  const isFinished = match.status === 'finished' && match.home_score != null
  const homeWon = isFinished && match.home_score > match.away_score
  const awayWon = isFinished && match.away_score > match.home_score
  const padding = compact ? 'p-2' : 'p-2.5'

  return (
    <div className={`bg-gray-800/80 rounded-lg border border-gray-700/40 ${padding}`}>
      <div className={`text-[9px] text-gray-500 uppercase tracking-wider font-bold mb-1.5 truncate ${compact ? '' : 'text-center'}`}>
        {compact ? formatDateCompact(match.kickoff_time) : formatDate(match.kickoff_time)}
      </div>
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
   BracketColumn — uma coluna do tree
   ═══════════════════════════════════════════════════ */

function BracketColumn({ label, matches, matchByNumber }) {
  return (
    <div className="flex flex-col min-w-0">
      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-2">
        {label}
      </h4>
      <div className="flex-1 flex flex-col justify-around gap-1.5">
        {matches.map((matchNum, idx) => (
          <KnockoutCard
            key={matchNum || idx}
            match={matchNum ? matchByNumber[matchNum] : null}
            compact
          />
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   CenterFinalColumn — coluna central com Final + 3º lugar
   Ocupa o lugar de uma coluna intermediária entre as duas Semis
   ═══════════════════════════════════════════════════ */

function CenterFinalColumn({ matchByNumber }) {
  const final = matchByNumber['M104']
  const thirdPlace = matchByNumber['M103']

  return (
    <div className="flex flex-col min-w-0">
      {/* Header invisível pra alinhar verticalmente com as outras colunas */}
      <h4 className="text-[10px] font-bold text-transparent uppercase tracking-widest text-center mb-2 select-none">
        .
      </h4>
      {/* Empilha Final centralizada verticalmente + 3º lugar logo abaixo */}
      <div className="flex-1 flex flex-col justify-center gap-3">
        <div>
          <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest text-center mb-1.5">
            🏆 Final
          </p>
          <KnockoutCard match={final} compact />
        </div>
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-1.5">
            3º lugar
          </p>
          <KnockoutCard match={thirdPlace} compact />
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   DesktopBracket — layout tree clássico
   Esquerda → Final central → Direita
   ═══════════════════════════════════════════════════ */

function DesktopBracket({ matchByNumber }) {
  return (
    <div className="hidden md:block">
      <div className="grid gap-2 items-stretch"
           style={{
             // 9 colunas: 4 da esquerda + 1 central (Final/3º) + 4 da direita
             gridTemplateColumns: '1fr 0.9fr 0.8fr 0.9fr 1.05fr 0.9fr 0.8fr 0.9fr 1fr',
           }}
      >
        {/* === METADE A (ESQUERDA) === */}
        <BracketColumn
          label="16 avos"
          matches={BRACKET_STRUCTURE.left.round_of_32}
          matchByNumber={matchByNumber}
        />
        <BracketColumn
          label="Oitavas"
          matches={BRACKET_STRUCTURE.left.round_of_16}
          matchByNumber={matchByNumber}
        />
        <BracketColumn
          label="Quartas"
          matches={BRACKET_STRUCTURE.left.quarter}
          matchByNumber={matchByNumber}
        />
        <BracketColumn
          label="Semi"
          matches={BRACKET_STRUCTURE.left.semi}
          matchByNumber={matchByNumber}
        />

        {/* === COLUNA CENTRAL: FINAL + 3º LUGAR === */}
        <CenterFinalColumn matchByNumber={matchByNumber} />

        {/* === METADE B (DIREITA) === */}
        <BracketColumn
          label="Semi"
          matches={BRACKET_STRUCTURE.right.semi}
          matchByNumber={matchByNumber}
        />
        <BracketColumn
          label="Quartas"
          matches={BRACKET_STRUCTURE.right.quarter}
          matchByNumber={matchByNumber}
        />
        <BracketColumn
          label="Oitavas"
          matches={BRACKET_STRUCTURE.right.round_of_16}
          matchByNumber={matchByNumber}
        />
        <BracketColumn
          label="16 avos"
          matches={BRACKET_STRUCTURE.right.round_of_32}
          matchByNumber={matchByNumber}
        />
      </div>
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
          <span className="text-xs text-gray-500">({matches.length})</span>
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

  const matchByNumber = {}
  matches.forEach((m) => {
    const num = getMatchNumber(m)
    if (num) matchByNumber[num] = m
  })

  const matchesByRound = {}
  matches.forEach((m) => {
    if (!matchesByRound[m.round]) matchesByRound[m.round] = []
    matchesByRound[m.round].push(m)
  })

  return (
    <div>
      <DesktopBracket matchByNumber={matchByNumber} />
      <MobileBracket matchesByRound={matchesByRound} />
    </div>
  )
}