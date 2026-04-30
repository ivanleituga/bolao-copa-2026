import { useEffect, useState } from 'react'
import { useUserPredictions } from '../hooks/useUserPredictions'
import { TeamFlag } from './TeamFlag'
import { PLAYERS } from '../lib/players'
import { MULTIPLIERS, getRoundLabel } from '../lib/scoring'
import { formatCountdown, countdownColor } from '../lib/timeformat'

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function formatDate(iso) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} • ${DIAS[d.getDay()]} • ${hh}:${min}`
}

function formatDeadline(iso) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} às ${hh}:${min}`
}

/**
 * Parse correct_answer pra lista limpa.
 * "Mbappé,Haaland" → ["Mbappé", "Haaland"]
 * "Mbappé" → ["Mbappé"]
 * null → []
 */
function parseCorrectAnswers(correctAnswer) {
  if (!correctAnswer) return []
  return correctAnswer.split(',').map((s) => s.trim()).filter(Boolean)
}

/* ═══════════════════════════════════════════════════
   MatchPredictionRow
   ═══════════════════════════════════════════════════ */

function MatchPredictionRow({ item }) {
  const isFinished = item.status === 'finished' && item.home_score_real != null
  const multiplier = MULTIPLIERS[item.round] ?? 1
  const isCravada = isFinished && item.points === 15 * multiplier

  return (
    <div
      className={`px-3 py-2.5 rounded-lg border
        ${isCravada
          ? 'bg-green-500/10 border-green-500/30'
          : 'bg-gray-800/50 border-gray-700/30'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
          {formatDate(item.kickoff_time)}
          <span className="text-gray-600 mx-1">·</span>
          {getRoundLabel(item.round)}
        </span>
        {isCravada && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded
            bg-green-500/20 text-green-300 border border-green-500/40 leading-tight">
            Cravou
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
          <span className="text-white text-sm font-medium truncate text-right">
            {item.home_team?.name}
          </span>
          <TeamFlag code={item.home_team?.code} size={20} />
        </div>

        <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-0.5 bg-gray-700/50 rounded">
          <span className="text-white font-bold tabular-nums text-sm w-3 text-center">
            {item.home_score_pred}
          </span>
          <span className="text-gray-500 text-[10px]">×</span>
          <span className="text-white font-bold tabular-nums text-sm w-3 text-center">
            {item.away_score_pred}
          </span>
        </div>

        <div className="flex-1 flex items-center gap-1.5 min-w-0">
          <TeamFlag code={item.away_team?.code} size={20} />
          <span className="text-white text-sm font-medium truncate">
            {item.away_team?.name}
          </span>
        </div>
      </div>

      {isFinished && (
        <div className="mt-1.5 text-center">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider">
            Placar final:{' '}
          </span>
          <span className="text-[11px] text-gray-300 font-bold tabular-nums">
            {item.home_score_real} × {item.away_score_real}
          </span>
          <span className="text-gray-600 mx-2">·</span>
          <span className="text-[11px] text-gray-300 font-bold tabular-nums">
            +{item.points ?? 0}
          </span>
          <span className="text-[9px] text-gray-500 uppercase tracking-wider ml-1">
            pts
          </span>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   SpecialPredictionRow
   ═══════════════════════════════════════════════════ */

function SpecialPredictionRow({ item, allTeams }) {
  const isTeam = item.answer_type === 'team'
  const isPlayer = item.answer_type === 'player'

  const team = isTeam ? allTeams.find((t) => t.name === item.answer) : null
  const player = isPlayer ? PLAYERS.find((p) => p.name === item.answer) : null

  let statusColor = 'text-gray-400'
  let statusLabel = 'Aguardando resultado'
  let statusBg = 'bg-gray-800/50 border-gray-700/30'

  if (item.isCorrect === true) {
    statusColor = 'text-green-300'
    statusLabel = `Acertou — +${item.points} pts`
    statusBg = 'bg-green-500/10 border-green-500/30'
  } else if (item.isCorrect === false) {
    statusColor = 'text-red-400/80'
    // Plural se mais de uma resposta correta
    const corrects = parseCorrectAnswers(item.correct_answer)
    if (corrects.length > 1) {
      statusLabel = `Errou — respostas corretas: ${corrects.join(', ')}`
    } else {
      statusLabel = `Errou — resposta correta: ${corrects[0] ?? ''}`
    }
    statusBg = 'bg-gray-800/50 border-gray-700/30'
  }

  return (
    <div className={`px-3 py-2.5 rounded-lg border ${statusBg}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-300 font-semibold">
          {item.question_text}
        </span>
        <span className="text-[10px] text-yellow-400/80 font-bold">
          {item.points_value} pts
        </span>
      </div>

      <div className="flex items-center gap-2 mb-1.5">
        {team && <TeamFlag code={team.code} size={20} />}
        {player && <TeamFlag code={player.country} size={20} />}
        <span className="text-white text-sm font-bold">{item.answer}</span>
      </div>

      <div className={`text-[11px] ${statusColor}`}>
        {statusLabel}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   UserPredictionsModal
   ═══════════════════════════════════════════════════ */

export default function UserPredictionsModal({ userId, currentUserId, allTeams, specialDeadline, onClose }) {
  const { matchPredictions, specialPredictions, profile, loading } =
    useUserPredictions(userId)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  if (!userId) return null

  const isViewingSelf = userId === currentUserId
  const deadlineMs = specialDeadline ? new Date(specialDeadline).getTime() : 0
  const deadlinePassed = deadlineMs > 0 && deadlineMs <= now
  const showSpecialsAsLocked = !isViewingSelf && !deadlinePassed && specialDeadline
  const remainingToDeadline = deadlineMs - now

  const totalPoints = matchPredictions.reduce((s, p) => s + (p.points ?? 0), 0)
    + (deadlinePassed || isViewingSelf
      ? specialPredictions.reduce((s, p) => s + (p.points ?? 0), 0)
      : 0)
  const cravadas = matchPredictions.filter((p) => {
    const mult = MULTIPLIERS[p.round] ?? 1
    return p.status === 'finished' && p.points === 15 * mult
  }).length
  const acertosVisiveis = matchPredictions.filter((p) => p.status === 'finished' && (p.points ?? 0) > 0).length

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] flex flex-col
          bg-gray-900 border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-4 border-b border-gray-700/50 bg-gray-800/50">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">
                Histórico de palpites
              </p>
              <h3 className="text-xl font-bold text-white truncate">
                {profile?.display_name?.split('@')[0] || '—'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none w-7 h-7 flex items-center justify-center"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>

          {!loading && (
            <div className="flex items-center gap-3 text-xs">
              <div>
                <span className="text-gray-500 uppercase tracking-wider text-[10px]">Pontos </span>
                <span className="text-white font-bold tabular-nums">{totalPoints}</span>
              </div>
              <span className="text-gray-700">·</span>
              <div>
                <span className="text-gray-500 uppercase tracking-wider text-[10px]">Cravadas </span>
                <span className="text-yellow-400 font-bold tabular-nums">{cravadas}</span>
              </div>
              <span className="text-gray-700">·</span>
              <div>
                <span className="text-gray-500 uppercase tracking-wider text-[10px]">Acertos </span>
                <span className="text-blue-300 font-bold tabular-nums">{acertosVisiveis}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && (
            <div className="py-8 text-center">
              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-gray-500 text-xs">Carregando palpites...</p>
            </div>
          )}

          {!loading && (
            <>
              <div>
                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
                  Palpites especiais
                </h4>

                {showSpecialsAsLocked ? (
                  <div className="px-3 py-4 rounded-lg border border-gray-700/30 bg-gray-800/40 text-center">
                    <div className="text-2xl mb-1.5">🔒</div>
                    <p className="text-gray-300 text-xs font-medium mb-1">
                      Os palpites especiais ficam visíveis em {formatDeadline(specialDeadline)}.
                    </p>
                    {remainingToDeadline > 0 && (
                      <p className={`text-[11px] mt-1.5 ${countdownColor(remainingToDeadline)}`}>
                        ⏱ {formatCountdown(remainingToDeadline)}
                      </p>
                    )}
                  </div>
                ) : specialPredictions.length > 0 ? (
                  <div className="space-y-1.5">
                    {specialPredictions.map((sp) => (
                      <SpecialPredictionRow
                        key={sp.question_id}
                        item={sp}
                        allTeams={allTeams}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-xs italic px-1">
                    Nenhum palpite especial registrado.
                  </p>
                )}
              </div>

              {matchPredictions.length > 0 ? (
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">
                    Palpites em jogos
                    <span className="text-gray-600 ml-1.5">
                      ({matchPredictions.length})
                    </span>
                  </h4>
                  <div className="space-y-1.5">
                    {matchPredictions.map((mp) => (
                      <MatchPredictionRow key={mp.match_id} item={mp} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-gray-500 text-sm italic">
                    Nenhum palpite em jogos visível ainda.
                  </p>
                  <p className="text-gray-600 text-xs mt-1">
                    Palpites de jogos aparecem após o início.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}