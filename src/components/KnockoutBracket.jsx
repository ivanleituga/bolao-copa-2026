import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { TeamFlag } from './TeamFlag'
import { formatCountdown, countdownColor, formatSavedTime } from '../lib/timeformat'
import MatchPredictionsModal from './MatchPredictionsModal'

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

/**
 * Altura fixa dos cards no desktop.
 *
 * O bracket usa uma grade de 8 linhas verticais idênticas. Cada match
 * dos 16 avos ocupa 1 linha, oitavas ocupam 2, quartas 4, semis 8.
 * Como todas as linhas têm a mesma altura, o alinhamento entre cards
 * é perfeito independente do conteúdo (placeholder vs com bandeira,
 * com input ou sem, etc).
 *
 * 110px cabe: data (1 linha) + 2 linhas de time + status (1 linha)
 * com padding p-2 e fonte text-[11px]. Conteúdo curto fica
 * centralizado vertical via flex justify-between.
 */
const DESKTOP_CARD_HEIGHT = 110

/** Sanitiza o input de placar: aceita só os dígitos iniciais, máximo 2. */
function sanitizeScore(value) {
  if (!value) return ''
  const match = String(value).match(/^\d+/)
  return match ? match[0].slice(0, 2) : ''
}

/* ═══════════════════════════════════════════════════
   Bracket structure — chaveamento oficial FIFA 2026
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

/**
 * Placements verticais nas 8 linhas da grade.
 * Cada fase ocupa diferentes spans pra criar visual de árvore.
 *   - 16 avos: 8 cards, span 1 cada (linhas 1-8)
 *   - Oitavas: 4 cards, span 2 cada (centralizados em pares)
 *   - Quartas: 2 cards, span 4 cada (centralizados em quadras)
 *   - Semi: 1 card, span 8 (centralizado em toda a coluna)
 */
const DESKTOP_PLACEMENTS = {
  round_of_32: [
    { rowStart: 1, rowSpan: 1 },
    { rowStart: 2, rowSpan: 1 },
    { rowStart: 3, rowSpan: 1 },
    { rowStart: 4, rowSpan: 1 },
    { rowStart: 5, rowSpan: 1 },
    { rowStart: 6, rowSpan: 1 },
    { rowStart: 7, rowSpan: 1 },
    { rowStart: 8, rowSpan: 1 },
  ],
  round_of_16: [
    { rowStart: 1, rowSpan: 2 },
    { rowStart: 3, rowSpan: 2 },
    { rowStart: 5, rowSpan: 2 },
    { rowStart: 7, rowSpan: 2 },
  ],
  quarter: [
    { rowStart: 1, rowSpan: 4 },
    { rowStart: 5, rowSpan: 4 },
  ],
  semi: [
    { rowStart: 1, rowSpan: 8 },
  ],
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
   TeamRow
   ═══════════════════════════════════════════════════ */

function TeamRow({
  team,
  placeholder,
  finalScore,
  isWinner,
  compact,
  predictionValue,
  onPredictionChange,
  inputDisabled,
  inputBorder,
  stop,
  onKeyDown,
}) {
  const flagSize = compact ? 15 : 18
  const textSize = compact ? 'text-[11px]' : 'text-[13px]'
  const inputSize = compact ? 'w-7 h-6 text-sm' : 'w-9 h-8 text-base'

  const showFinalScore = finalScore != null
  const showInput = !showFinalScore && onPredictionChange != null

  return (
    <div className={`flex items-center gap-1.5 py-0.5 ${
      isWinner ? 'opacity-100' : finalScore != null ? 'opacity-60' : 'opacity-100'
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

      {showFinalScore && (
        <span className={`${textSize} text-white font-bold tabular-nums w-4 text-right`}>
          {finalScore}
        </span>
      )}

      {showInput && (
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="done"
          maxLength={2}
          value={predictionValue}
          onChange={(e) => onPredictionChange(sanitizeScore(e.target.value))}
          onClick={stop}
          onFocus={stop}
          onMouseDown={stop}
          onTouchStart={stop}
          onKeyDown={onKeyDown}
          disabled={inputDisabled}
          className={`${inputSize} text-center bg-gray-700/80 text-white font-bold rounded-md
            border ${inputBorder} focus:border-green-500 focus:ring-1 focus:ring-green-500/30 focus:outline-none
            disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0`}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   KnockoutCard
   ═══════════════════════════════════════════════════ */

function KnockoutCard({ match, prediction, now, userId, onSaved, compact = false }) {
  const [home, setHome] = useState(
    prediction?.home_score != null ? String(prediction.home_score) : ''
  )
  const [away, setAway] = useState(
    prediction?.away_score != null ? String(prediction.away_score) : ''
  )
  const [saveStatus, setSaveStatus] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const onSavedRef = useRef(onSaved)
  useEffect(() => { onSavedRef.current = onSaved })

  const hasMatch = match != null
  const hasHomeTeam = match?.home_team != null
  const hasAwayTeam = match?.away_team != null
  const isPlaceholderMatch = !hasHomeTeam || !hasAwayTeam

  const deadline = hasMatch ? new Date(match.kickoff_time).getTime() - 5 * 60 * 1000 : 0
  const remaining = deadline - now
  const isFinished = hasMatch && match.status === 'finished' && match.home_score != null
  const isOpen = hasMatch && remaining > 0 && match.status !== 'finished' && !isPlaceholderMatch

  const homeWon = isFinished && match.home_score > match.away_score
  const awayWon = isFinished && match.away_score > match.home_score

  const h = parseInt(home)
  const a = parseInt(away)
  const hasValidInputs = !isNaN(h) && !isNaN(a)
  const matchesPrediction = hasValidInputs && prediction
    && prediction.home_score === h && prediction.away_score === a

  useEffect(() => {
    if (!hasMatch) return
    if (!isOpen) return
    if (!hasValidInputs) return
    if (matchesPrediction) return
    if (!userId) return

    const timer = setTimeout(async () => {
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
        console.error('Erro ao salvar palpite mata-mata:', error)
        if (error.code === '42501' || error.message?.includes('row-level security')) {
          setSaveStatus('blocked')
        } else {
          setSaveStatus('error')
        }
        setTimeout(() => setSaveStatus(null), 4000)
      } else {
        setSaveStatus(null)
        if (onSavedRef.current) {
          onSavedRef.current(match.id, h, a)
        }
      }
    }, 800)

    return () => clearTimeout(timer)
  }, [home, away, h, a, hasMatch, isOpen, hasValidInputs, matchesPrediction, userId, match?.id])

  // Altura fixa no desktop pra alinhamento perfeito. No mobile, altura
  // natural baseada no conteúdo (cards são empilhados no accordion).
  const compactHeight = compact ? `h-[${DESKTOP_CARD_HEIGHT}px]` : ''
  const padding = compact ? 'p-2' : 'p-2.5'

  if (!hasMatch) {
    return (
      <div
        className={`bg-gray-800/40 rounded-lg border border-gray-700/20 ${padding} ${compactHeight} opacity-40 flex items-center justify-center`}
      >
        <div className="text-[9px] text-gray-600 italic text-center">—</div>
      </div>
    )
  }

  const inputBorder = matchesPrediction ? 'border-green-500/60' : 'border-gray-600'

  const isClickable = !isPlaceholderMatch
  const cardCursor = isClickable ? 'cursor-pointer' : ''
  const cardHover = isClickable ? 'hover:bg-gray-700/40' : ''

  const handleCardClick = () => {
    if (!isClickable) return
    setModalOpen(true)
  }

  const stop = (e) => e.stopPropagation()
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  const showInputs = isOpen && !isPlaceholderMatch && !isFinished

  const cardBorder = matchesPrediction
    ? 'border-green-500/50 shadow-[0_0_0_1px_rgba(34,197,94,0.15)]'
    : 'border-gray-700/40'

  return (
    <>
      <div
        onClick={handleCardClick}
        className={`bg-gray-800/80 rounded-lg border ${cardBorder} ${padding} ${compactHeight}
          ${cardCursor} ${cardHover} transition-colors flex flex-col justify-between overflow-hidden`}
      >
        <div>
          <div className={`text-[9px] text-gray-500 uppercase tracking-wider font-bold mb-1 truncate ${compact ? '' : 'text-center'}`}>
            {compact ? formatDateCompact(match.kickoff_time) : formatDate(match.kickoff_time)}
          </div>

          <div className="space-y-0.5">
            <TeamRow
              team={match.home_team}
              placeholder={match.home_placeholder}
              finalScore={isFinished ? match.home_score : null}
              isWinner={homeWon}
              compact={compact}
              predictionValue={showInputs ? home : null}
              onPredictionChange={showInputs ? setHome : null}
              inputDisabled={!isOpen}
              inputBorder={inputBorder}
              stop={stop}
              onKeyDown={handleKeyDown}
            />
            <TeamRow
              team={match.away_team}
              placeholder={match.away_placeholder}
              finalScore={isFinished ? match.away_score : null}
              isWinner={awayWon}
              compact={compact}
              predictionValue={showInputs ? away : null}
              onPredictionChange={showInputs ? setAway : null}
              inputDisabled={!isOpen}
              inputBorder={inputBorder}
              stop={stop}
              onKeyDown={handleKeyDown}
            />
          </div>
        </div>

        <div className="text-center text-[10px] min-h-[14px] leading-none flex items-center justify-center">
          {isPlaceholderMatch ? (
            <span className="invisible">.</span>
          ) : isOpen ? (
            <>
              {saveStatus === 'saving' && (
                <span className="text-yellow-400">Salvando...</span>
              )}
              {saveStatus === 'blocked' && (
                <span className="text-red-400">🔒 Bloqueado</span>
              )}
              {saveStatus === 'error' && (
                <span className="text-red-400">Erro ao salvar</span>
              )}
              {!saveStatus && (
                <>
                  {matchesPrediction && prediction.updated_at ? (
                    compact ? (
                      <span className="text-green-400">✓ Palpitado</span>
                    ) : (
                      <span className="text-gray-400 inline-block max-w-full">
                        <span className="text-green-400">✓</span> Salvo {formatSavedTime(prediction.updated_at)}
                        <span className="text-gray-600 mx-1">·</span>
                        <span className={countdownColor(remaining)}>
                          ⏱ {formatCountdown(remaining)}
                        </span>
                      </span>
                    )
                  ) : (
                    <span className={countdownColor(remaining)}>
                      ⏱ {formatCountdown(remaining)}
                    </span>
                  )}
                </>
              )}
            </>
          ) : !isFinished ? (
            <span className="text-gray-500">🔒 Encerrado</span>
          ) : (
            <span className="invisible">.</span>
          )}
        </div>
      </div>

      {modalOpen && (
        <MatchPredictionsModal
          match={match}
          currentUserId={userId}
          now={now}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════
   Desktop bracket — grid de slots fixos (8 linhas iguais)

   Insight do Codex: cada coluna tem uma grade de 8 linhas de altura
   idêntica (DESKTOP_CARD_HEIGHT). Cada match ocupa o número de
   linhas correto pra criar visual de árvore:
     - 16 avos: 8 cards × span 1
     - Oitavas: 4 cards × span 2 (centralizados em pares)
     - Quartas: 2 cards × span 4
     - Semi: 1 card × span 8
   Como todas as linhas têm a mesma altura, o alinhamento entre
   colunas é perfeito independente do conteúdo do card.

   A coluna central (Final + 3º lugar) usa a mesma grade de 8 linhas,
   com Final em rows 4-5 (centralizada com os Semis que ocupam 1-8)
   e 3º lugar em rows 7-8.
   ═══════════════════════════════════════════════════ */

function DesktopColumn({ label, matchNumbers, placements, matchByNumber, predictions, now, userId, onSaved }) {
  return (
    <div className="flex flex-col min-w-0">
      <h4 className="h-5 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-2">
        {label}
      </h4>

      <div
        className="grid gap-y-2"
        style={{
          gridTemplateRows: `repeat(8, ${DESKTOP_CARD_HEIGHT}px)`,
        }}
      >
        {matchNumbers.map((matchNum, idx) => {
          const placement = placements[idx]
          const match = matchNum ? matchByNumber[matchNum] : null
          const prediction = match ? predictions[match.id] : null

          return (
            <div
              key={matchNum || idx}
              className="flex items-center min-w-0"
              style={{
                gridRow: `${placement.rowStart} / span ${placement.rowSpan}`,
              }}
            >
              <div className="w-full min-w-0">
                <KnockoutCard
                  match={match}
                  prediction={prediction}
                  now={now}
                  userId={userId}
                  onSaved={onSaved}
                  compact
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * CenterFinalColumn — coluna central com Final + 3º lugar.
 *
 * Usa a mesma grade de 8 linhas (DESKTOP_CARD_HEIGHT). Como os Semis
 * laterais ocupam toda a grade (rows 1-8, centralizados), a Final
 * precisa ficar nas rows 4-5 pra alinhar exatamente com o centro
 * dos Semis.
 *
 * O 3º lugar fica em rows 7-8 (logo abaixo da Final, com gap visual).
 */
function CenterFinalColumn({ matchByNumber, predictions, now, userId, onSaved }) {
  const final = matchByNumber['M104']
  const thirdPlace = matchByNumber['M103']

  // Mesma altura vertical das demais colunas:
  // 8 linhas de card + 7 gaps de 4px (gap-y-1)
  const bracketHeight = (DESKTOP_CARD_HEIGHT * 8) + (4 * 7)

  return (
    <div className="flex flex-col min-w-0">
      <h4 className="h-5 text-[10px] font-bold text-transparent uppercase tracking-widest text-center mb-2 select-none">
        .
      </h4>

      {/* Mantém a altura do grid lateral, mas volta ao comportamento visual original:
          Final + 3º lugar como um bloco centralizado verticalmente. */}
      <div
        className="flex flex-col justify-center gap-3"
        style={{ height: bracketHeight }}
      >
        <div>
          <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest text-center mb-1.5">
            🏆 Final
          </p>
          <KnockoutCard
            match={final}
            prediction={final ? predictions[final.id] : null}
            now={now}
            userId={userId}
            onSaved={onSaved}
            compact
          />
        </div>

        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center mb-1.5">
            3º lugar
          </p>
          <KnockoutCard
            match={thirdPlace}
            prediction={thirdPlace ? predictions[thirdPlace.id] : null}
            now={now}
            userId={userId}
            onSaved={onSaved}
            compact
          />
        </div>
      </div>
    </div>
  )
}

function DesktopBracket({ matchByNumber, predictions, now, userId, onSaved }) {
  const colProps = { matchByNumber, predictions, now, userId, onSaved }

  return (
    <div className="hidden md:block">
      <div
        className="grid gap-2 items-start"
        style={{
          // Frações ajustáveis — colunas externas levemente maiores
          // pra acomodar nomes longos de seleções (16 avos têm nome real).
          gridTemplateColumns: '1fr 0.95fr 0.85fr 0.9fr 1fr 0.9fr 0.85fr 0.95fr 1fr',
        }}
      >
        <DesktopColumn
          label="16 avos"
          matchNumbers={BRACKET_STRUCTURE.left.round_of_32}
          placements={DESKTOP_PLACEMENTS.round_of_32}
          {...colProps}
        />
        <DesktopColumn
          label="Oitavas"
          matchNumbers={BRACKET_STRUCTURE.left.round_of_16}
          placements={DESKTOP_PLACEMENTS.round_of_16}
          {...colProps}
        />
        <DesktopColumn
          label="Quartas"
          matchNumbers={BRACKET_STRUCTURE.left.quarter}
          placements={DESKTOP_PLACEMENTS.quarter}
          {...colProps}
        />
        <DesktopColumn
          label="Semi"
          matchNumbers={BRACKET_STRUCTURE.left.semi}
          placements={DESKTOP_PLACEMENTS.semi}
          {...colProps}
        />

        <CenterFinalColumn {...colProps} />

        <DesktopColumn
          label="Semi"
          matchNumbers={BRACKET_STRUCTURE.right.semi}
          placements={DESKTOP_PLACEMENTS.semi}
          {...colProps}
        />
        <DesktopColumn
          label="Quartas"
          matchNumbers={BRACKET_STRUCTURE.right.quarter}
          placements={DESKTOP_PLACEMENTS.quarter}
          {...colProps}
        />
        <DesktopColumn
          label="Oitavas"
          matchNumbers={BRACKET_STRUCTURE.right.round_of_16}
          placements={DESKTOP_PLACEMENTS.round_of_16}
          {...colProps}
        />
        <DesktopColumn
          label="16 avos"
          matchNumbers={BRACKET_STRUCTURE.right.round_of_32}
          placements={DESKTOP_PLACEMENTS.round_of_32}
          {...colProps}
        />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   MobileBracket — accordion por fase
   ═══════════════════════════════════════════════════ */

function MobileAccordion({ round, matches, isOpen, onToggle, predictions, now, userId, onSaved }) {
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
            <KnockoutCard
              key={m.id}
              match={m}
              prediction={predictions[m.id] || null}
              now={now}
              userId={userId}
              onSaved={onSaved}
              compact={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function MobileBracket({ matchesByRound, predictions, now, userId, onSaved }) {
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
            predictions={predictions}
            now={now}
            userId={userId}
            onSaved={onSaved}
          />
        )
      })}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   KnockoutBracket — componente principal
   ═══════════════════════════════════════════════════ */

export default function KnockoutBracket({ userId, now }) {
  const [matches, setMatches] = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading, setLoading] = useState(true)
  const [localNow, setLocalNow] = useState(() => Date.now())

  // Se o pai não passou `now`, mantemos um clock interno
  useEffect(() => {
    if (now != null) return
    const id = setInterval(() => setLocalNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [now])

  const effectiveNow = now ?? localNow

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)

      const matchesPromise = supabase
        .from('matches')
        .select(
          `*,
          home_team:teams!home_team_id(id, name, code),
          away_team:teams!away_team_id(id, name, code)`
        )
        .in('round', KNOCKOUT_ROUNDS)
        .order('kickoff_time')

      const predsPromise = userId
        ? supabase.from('predictions').select('*').eq('user_id', userId)
        : Promise.resolve({ data: [], error: null })

      const [matchesRes, predsRes] = await Promise.all([matchesPromise, predsPromise])

      if (matchesRes.error) {
        console.error('Erro ao buscar mata-mata:', matchesRes.error)
        setLoading(false)
        return
      }

      if (predsRes.error) {
        console.error('Erro ao buscar palpites do mata-mata:', predsRes.error)
      }

      setMatches(matchesRes.data || [])

      const predsMap = {}
      ;(predsRes.data || []).forEach((p) => { predsMap[p.match_id] = p })
      setPredictions(predsMap)

      setLoading(false)
    }

    fetchAll()
  }, [userId])

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
      <DesktopBracket
        matchByNumber={matchByNumber}
        predictions={predictions}
        now={effectiveNow}
        userId={userId}
        onSaved={handlePredictionSaved}
      />
      <MobileBracket
        matchesByRound={matchesByRound}
        predictions={predictions}
        now={effectiveNow}
        userId={userId}
        onSaved={handlePredictionSaved}
      />
    </div>
  )
}