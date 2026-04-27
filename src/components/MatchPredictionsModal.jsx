import { useEffect } from 'react'
import { usePredictionsByMatch } from '../hooks/usePredictionsByMatch'
import { TeamFlag } from './TeamFlag'
import { getPointsColor, MULTIPLIERS } from '../lib/scoring'

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

/* ═══════════════════════════════════════════════════
   PredictionRow — uma linha na lista de palpites
   ═══════════════════════════════════════════════════ */

function PredictionRow({ prediction, isFinished, multiplier, isMe }) {
  const isCravada = isFinished && prediction.points === 15 * multiplier

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg
        ${isCravada ? 'bg-green-500/10 border border-green-500/30' : 'bg-gray-800/50'}
        ${isMe ? 'ring-1 ring-green-500/40' : ''}`}
    >
      {/* Nome */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className={`text-sm font-medium truncate
            ${isMe ? 'text-green-300' : 'text-white'}`}
        >
          {prediction.display_name?.split('@')[0]}
        </span>
        {isMe && (
          <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded
            bg-green-500/15 text-green-300 border border-green-500/30 leading-tight">
            Você
          </span>
        )}
        {isCravada && (
          <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded
            bg-green-500/20 text-green-300 border border-green-500/40 leading-tight">
            Cravou
          </span>
        )}
      </div>

      {/* Palpite */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-1 bg-gray-700/50 rounded">
        <span className="text-white font-bold tabular-nums text-base w-4 text-center">
          {prediction.home_score}
        </span>
        <span className="text-gray-500 text-xs">×</span>
        <span className="text-white font-bold tabular-nums text-base w-4 text-center">
          {prediction.away_score}
        </span>
      </div>

      {/* Pontos (só pra finalizado) */}
      {isFinished && (
        <div className="flex-shrink-0 w-12 text-right">
          <span className={`text-sm font-bold tabular-nums ${getPointsColor(prediction.points, multiplier)}`}>
            +{prediction.points ?? 0}
          </span>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   MatchPredictionsModal — overlay com palpites de todos
   ═══════════════════════════════════════════════════ */

export default function MatchPredictionsModal({ match, currentUserId, now, onClose }) {
  // Hook: passa null pra não fazer fetch antes de ter match
  const { predictions, missing, loading } = usePredictionsByMatch(match?.id ?? null)

  // Estado do jogo:
  //   - placeholder: jogo de mata-mata sem times definidos (não deveria abrir, mas defendemos)
  //   - notStarted: kickoff > now
  //   - inProgress: kickoff <= now mas status != finished
  //   - finished: status === 'finished'
  const isPlaceholder = !match?.home_team || !match?.away_team
  const kickoffMs = match ? new Date(match.kickoff_time).getTime() : 0
  const isFinished = match?.status === 'finished' && match?.home_score != null
  const isInProgress = !isFinished && kickoffMs <= now
  const isNotStarted = !isFinished && !isInProgress

  // Multiplicador da fase pra calcular cor dos pontos
  const multiplier = MULTIPLIERS[match?.round] ?? 1

  // Ordenação:
  //   - Finalizado: pontos desc, depois alfabética como tiebreak
  //   - Em andamento: alfabética
  const sortedPredictions = [...predictions].sort((a, b) => {
    if (isFinished) {
      const ptsDiff = (b.points ?? 0) - (a.points ?? 0)
      if (ptsDiff !== 0) return ptsDiff
    }
    return (a.display_name || '').localeCompare(b.display_name || '')
  })

  // Fecha modal com Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    // Trava scroll do body enquanto modal aberto
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  if (!match) return null

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
        {/* Header com times */}
        <div className="px-4 py-4 border-b border-gray-700/50 bg-gray-800/50">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              {formatDate(match.kickoff_time)}
            </p>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none w-7 h-7 flex items-center justify-center"
              aria-label="Fechar"
            >
              ×
            </button>
          </div>

          {!isPlaceholder ? (
            <div className="flex items-center justify-center gap-3">
              {/* Casa */}
              <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                <span className="text-white text-sm font-bold truncate text-right">
                  {match.home_team?.name}
                </span>
                <TeamFlag code={match.home_team?.code} size={26} />
              </div>

              {/* Placar ou X */}
              <div className="flex-shrink-0 px-3 py-1 bg-gray-700/40 rounded-lg">
                {isFinished ? (
                  <div className="flex items-center gap-2">
                    <span className="text-white font-black text-2xl tabular-nums w-6 text-center">
                      {match.home_score}
                    </span>
                    <span className="text-gray-500 text-xs">×</span>
                    <span className="text-white font-black text-2xl tabular-nums w-6 text-center">
                      {match.away_score}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-500 text-xl px-3">×</span>
                )}
              </div>

              {/* Visitante */}
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <TeamFlag code={match.away_team?.code} size={26} />
                <span className="text-white text-sm font-bold truncate">
                  {match.away_team?.name}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-400 text-sm italic">
                {match.home_placeholder} × {match.away_placeholder}
              </p>
            </div>
          )}

          {/* Status pill */}
          <div className="mt-3 flex justify-center">
            {isFinished && (
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded
                bg-green-500/15 text-green-400 border border-green-500/30">
                Encerrado
              </span>
            )}
            {isInProgress && (
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded
                bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
                Em andamento
              </span>
            )}
            {isNotStarted && !isPlaceholder && (
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded
                bg-gray-700/50 text-gray-400 border border-gray-600/40">
                Aguardando início
              </span>
            )}
          </div>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Caso 1: placeholder — não há o que mostrar */}
          {isPlaceholder && (
            <div className="py-8 text-center">
              <p className="text-gray-400 text-sm">
                Os times deste confronto ainda não foram definidos.
              </p>
            </div>
          )}

          {/* Caso 2: jogo não iniciado — palpites alheios bloqueados pela RLS */}
          {!isPlaceholder && isNotStarted && (
            <div className="py-8 text-center">
              <div className="text-3xl mb-2">⏱</div>
              <p className="text-gray-300 text-sm font-medium mb-1">
                Os palpites ficam visíveis quando o jogo começar.
              </p>
              <p className="text-gray-500 text-xs">
                Volte aqui no horário pra ver o que o pessoal arriscou.
              </p>
            </div>
          )}

          {/* Caso 3 e 4: jogo iniciado ou finalizado */}
          {!isPlaceholder && (isInProgress || isFinished) && (
            <>
              {loading ? (
                <div className="py-8 text-center">
                  <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-gray-500 text-xs">Carregando palpites...</p>
                </div>
              ) : (
                <>
                  {/* Lista de palpites */}
                  {sortedPredictions.length > 0 && (
                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                          {isFinished ? 'Palpites por pontos' : 'Palpites'}
                        </h3>
                        <span className="text-[10px] text-gray-500">
                          {sortedPredictions.length} {sortedPredictions.length === 1 ? 'palpite' : 'palpites'}
                        </span>
                      </div>
                      {sortedPredictions.map((p) => (
                        <PredictionRow
                          key={p.user_id}
                          prediction={p}
                          isFinished={isFinished}
                          multiplier={multiplier}
                          isMe={p.user_id === currentUserId}
                        />
                      ))}
                    </div>
                  )}

                  {/* Sem palpites */}
                  {sortedPredictions.length === 0 && (
                    <div className="py-6 text-center mb-4">
                      <p className="text-gray-500 text-sm italic">
                        Ninguém palpitou neste jogo.
                      </p>
                    </div>
                  )}

                  {/* Quem não palpitou */}
                  {missing.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 px-1">
                        Não palpitaram ({missing.length})
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {missing.map((u) => (
                          <span
                            key={u.id}
                            className="text-xs px-2 py-1 rounded bg-gray-800/60 border border-gray-700/40 text-gray-500"
                          >
                            {u.display_name?.split('@')[0]}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}