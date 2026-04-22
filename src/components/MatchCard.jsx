import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getPointsLabel, getPointsColor, MULTIPLIERS } from '../lib/scoring'
import { TeamFlag } from './TeamFlag'

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

/** Formata o timestamp de quando o palpite foi salvo. Ex: "10/06 • 14:35" */
function formatSavedTime(iso) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} • ${hh}:${min}`
}

/**
 * Sanitiza o input de placar: aceita só os dígitos iniciais, máximo 2.
 */
function sanitizeScore(value) {
  if (!value) return ''
  const match = String(value).match(/^\d+/)
  return match ? match[0].slice(0, 2) : ''
}

/* ═══════════════════════════════════════════════════
   MatchCard — card de um jogo com input de palpite
   ═══════════════════════════════════════════════════ */

export default function MatchCard({ match, prediction, now, userId, onSaved }) {
  const [home, setHome] = useState(
    prediction?.home_score != null ? String(prediction.home_score) : ''
  )
  const [away, setAway] = useState(
    prediction?.away_score != null ? String(prediction.away_score) : ''
  )
  const [saveStatus, setSaveStatus] = useState(null)

  // Ref pra sempre ter a versão mais recente de onSaved sem precisar
  // incluí-la nas deps do useEffect (evita re-runs desnecessários do debounce)
  const onSavedRef = useRef(onSaved)
  useEffect(() => { onSavedRef.current = onSaved })

  const deadline = new Date(match.kickoff_time).getTime() - 5 * 60 * 1000
  const remaining = deadline - now
  const isOpen = remaining > 0 && match.status !== 'finished'
  const isFinished = match.status === 'finished' && match.home_score != null

  // Estado derivado: os inputs atuais batem com o palpite salvo?
  const h = parseInt(home)
  const a = parseInt(away)
  const hasValidInputs = !isNaN(h) && !isNaN(a)
  const matchesPrediction = hasValidInputs && prediction
    && prediction.home_score === h && prediction.away_score === a

  // Auto-save com debounce de 800ms após a última alteração dos inputs
  useEffect(() => {
    if (!isOpen) return
    if (!hasValidInputs) return
    if (matchesPrediction) return

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
        console.error('Erro ao salvar palpite:', error)
        if (error.code === '42501' || error.message?.includes('row-level security')) {
          setSaveStatus('blocked')
        } else {
          setSaveStatus('error')
        }
        setTimeout(() => setSaveStatus(null), 4000)
      } else {
        setSaveStatus(null)
        onSavedRef.current(match.id, h, a)
      }
    }, 800)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away, isOpen, matchesPrediction, userId, match.id])

  // Borda verde persistente quando o valor nos inputs bate com o palpite salvo
  const inputBorder = matchesPrediction ? 'border-green-500/60' : 'border-gray-600'

  const inputClasses = `w-9 h-9 text-center bg-gray-700/80 text-white font-bold text-base rounded-lg
    border ${inputBorder} focus:border-green-500 focus:ring-1 focus:ring-green-500/30 focus:outline-none
    disabled:opacity-30 disabled:cursor-not-allowed transition-colors`

  return (
    <div className="flex-1 flex flex-col justify-center py-3.5 space-y-2 border-b border-gray-700/30 last:border-0">
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
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={home}
              onChange={(e) => setHome(sanitizeScore(e.target.value))}
              disabled={!isOpen}
              className={inputClasses}
            />
            <span className="text-gray-500 text-sm font-bold">×</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={2}
              value={away}
              onChange={(e) => setAway(sanitizeScore(e.target.value))}
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
        {/* Jogo finalizado: mostra resultado e pontos */}
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

        {/* Jogo aberto */}
        {!isFinished && isOpen && (
          <>
            {saveStatus === 'saving' && (
              <span className="text-yellow-400">Salvando...</span>
            )}
            {saveStatus === 'blocked' && (
              <span className="text-red-400">🔒 Palpite bloqueado — partida já iniciada</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-400">Erro ao salvar</span>
            )}
            {!saveStatus && (
              <>
                {matchesPrediction && prediction.updated_at ? (
                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                    <span className="text-gray-400">
                      <span className="text-green-400">✓</span> Palpite salvo {formatSavedTime(prediction.updated_at)}
                    </span>
                    <span className="text-gray-600">·</span>
                    <span className={countdownColor(remaining)}>
                      ⏱ {formatCountdown(remaining)}
                    </span>
                  </div>
                ) : (
                  <span className={countdownColor(remaining)}>
                    ⏱ {formatCountdown(remaining)}
                  </span>
                )}
              </>
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