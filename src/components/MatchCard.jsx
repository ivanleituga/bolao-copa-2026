import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getPointsLabel, getPointsColor, MULTIPLIERS } from '../lib/scoring'
import { formatCountdown, countdownColor, formatSavedTime } from '../lib/timeformat'
import { TeamFlag } from './TeamFlag'
import MatchPredictionsModal from './MatchPredictionsModal'

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

/**
 * Sanitiza o input de placar: aceita só os dígitos iniciais, máximo 2.
 */
function sanitizeScore(value) {
  if (!value) return ''
  const match = String(value).match(/^\d+/)
  return match ? match[0].slice(0, 2) : ''
}

/* ═══════════════════════════════════════════════════
   TeamSide — renderiza um lado do confronto (casa ou visitante).
   ═══════════════════════════════════════════════════ */

function TeamSide({ team, placeholder, align }) {
  const flagEl = team ? (
    <TeamFlag code={team.code} size={22} />
  ) : (
    <div
      style={{ width: 22, height: 15 }}
      className="rounded-sm border border-dashed border-gray-600 bg-gray-800/40 flex-shrink-0"
    />
  )

  const label = team ? team.name : placeholder
  const labelColor = team ? 'text-white' : 'text-gray-500 italic'

  if (align === 'right') {
    return (
      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
        <span className={`${labelColor} text-[13px] font-medium truncate text-right`}>
          {label}
        </span>
        {flagEl}
      </div>
    )
  }
  return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      {flagEl}
      <span className={`${labelColor} text-[13px] font-medium truncate`}>
        {label}
      </span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   MatchCard — card de um jogo com input de palpite.
   Clicar no card abre um modal com os palpites de todos os usuários.
   Cliques nos inputs de placar NÃO disparam o modal (stopPropagation).
   ═══════════════════════════════════════════════════ */

export default function MatchCard({ match, prediction, now, userId, onSaved }) {
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

  // ── Proteção contra escrita-fantasma por estado obsoleto ──
  // hasPendingUserEditRef: só é true quando ESTE componente recebeu uma
  //   digitação do usuário ainda não persistida. O auto-save só grava se
  //   ela for true — assim, quando o polling rebaixa um `prediction` novo
  //   por baixo (re-fetch após admin finalizar jogo) e o input fica
  //   divergente SEM o usuário ter tocado, o save não dispara.
  // editVersionRef: incrementa a cada digitação. Um save captura a versão
  //   no início; ao voltar do await, só aplica efeitos colaterais se a
  //   versão ainda for a atual — um save antigo não pode limpar a flag,
  //   apagar status nem chamar onSaved por cima de uma edição mais nova.
  const hasPendingUserEditRef = useRef(false)
  const editVersionRef = useRef(0)

  // Espelham o valor ATUAL do input. Um save que perdeu a corrida precisa
  // comparar "o que acabei de gravar" com "o que o usuário tem agora" pra
  // decidir se dispara correção — e dentro do closure do save os valores
  // home/away são os do momento em que ele nasceu, não os atuais.
  const homeRef = useRef(home)
  const awayRef = useRef(away)
  useEffect(() => { homeRef.current = home; awayRef.current = away })

  // Detecta placeholder: pelo menos um dos times ainda não foi definido
  const hasHomeTeam = match.home_team != null
  const hasAwayTeam = match.away_team != null
  const isPlaceholderMatch = !hasHomeTeam || !hasAwayTeam

  const deadline = new Date(match.kickoff_time).getTime() - 5 * 60 * 1000
  const remaining = deadline - now
  const isOpen = remaining > 0 && match.status !== 'finished' && !isPlaceholderMatch
  const isFinished = match.status === 'finished' && match.home_score != null

  const h = parseInt(home)
  const a = parseInt(away)
  const hasValidInputs = !isNaN(h) && !isNaN(a)
  const matchesPrediction = hasValidInputs && prediction
    && prediction.home_score === h && prediction.away_score === a

  // Valores do banco normalizados pra string (pra comparar com o input,
  // que é string). Usados pelo efeito de re-sincronização abaixo.
  const predictionHome = prediction?.home_score != null ? String(prediction.home_score) : ''
  const predictionAway = prediction?.away_score != null ? String(prediction.away_score) : ''

  // Handlers de digitação: marcam que há edição pendente do usuário e
  // incrementam a versão da edição, ANTES de atualizar o input.
  const handleHomeChange = (value) => {
    hasPendingUserEditRef.current = true
    editVersionRef.current += 1
    homeRef.current = value
    setHome(value)
  }
  const handleAwayChange = (value) => {
    hasPendingUserEditRef.current = true
    editVersionRef.current += 1
    awayRef.current = value
    setAway(value)
  }

  // Re-sincroniza o input com o banco quando o `prediction` muda por fora
  // (ex.: polling rebaixou valor novo) E não há edição pendente do usuário.
  // É isto que faz uma aba obsoleta parar de exibir o placar velho — em vez
  // de regravá-lo. Se o usuário está editando, não toca no que ele digitou.
  useEffect(() => {
    if (hasPendingUserEditRef.current) return
    homeRef.current = predictionHome
    awayRef.current = predictionAway
    setHome((current) => (current === predictionHome ? current : predictionHome))
    setAway((current) => (current === predictionAway ? current : predictionAway))
  }, [predictionHome, predictionAway])

  // Quando o input volta a bater com o banco (inclusive no caso "editou e
  // desfez pro valor original"), não há mais divergência local real, então
  // limpa a flag — senão ela ficaria presa em true e uma mudança futura do
  // banco seria tratada como edição pendente.
  useEffect(() => {
    if (matchesPrediction) {
      hasPendingUserEditRef.current = false
      setSaveStatus(null)
    }
  }, [matchesPrediction])

  // Auto-save com debounce de 800ms
  useEffect(() => {
    if (!isOpen) return
    if (!hasValidInputs) return
    if (matchesPrediction) return
    if (!hasPendingUserEditRef.current) return

    const timer = setTimeout(async () => {
      const saveVersion = editVersionRef.current
      const savedHome = h
      const savedAway = a
      setSaveStatus('saving')

      const { error } = await supabase.from('predictions').upsert(
        {
          user_id: userId,
          match_id: match.id,
          home_score: savedHome,
          away_score: savedAway,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,match_id' }
      )

      if (error) {
        console.error('Erro ao salvar palpite:', error)
        // Erro: o banco NÃO mudou. Só mostramos o erro se este ainda é o
        // save vigente; se já há edição/save mais novo, ele cuida do status
        // (limpamos pra não exibir erro de um save obsoleto).
        if (editVersionRef.current === saveVersion) {
          if (error.code === '42501' || error.message?.includes('row-level security')) {
            setSaveStatus('blocked')
          } else {
            setSaveStatus('error')
          }
          setTimeout(() => {
            if (editVersionRef.current === saveVersion) {
              setSaveStatus(null)
            }
          }, 4000)
        } else {
          setSaveStatus(null)
        }
        return
      }

      // SUCESSO: o banco agora contém (savedHome, savedAway) — tenha este
      // save perdido a corrida na UI ou não, o upsert já gravou. Refletimos
      // isso na prop (onSaved) pra que `prediction` == banco. Em seguida, se
      // o input atual divergir do que foi gravado (ex.: o usuário desfez ou
      // alterou durante o voo), RE-ARMAMOS a edição: o efeito de auto-save
      // dispara um save corretivo com o valor atual. Sem isto, um upsert
      // antigo deixaria o banco num valor que o usuário já abandonou — a
      // própria classe de bug que estamos corrigindo.
      onSavedRef.current(match.id, savedHome, savedAway)

      const curH = parseInt(homeRef.current)
      const curA = parseInt(awayRef.current)
      const currentInputIsValid = !isNaN(curH) && !isNaN(curA)
      const divergesFromInput = curH !== savedHome || curA !== savedAway

      if (divergesFromInput) {
        hasPendingUserEditRef.current = true
        // Se o input atual está incompleto/inválido (ex.: usuário apagou um
        // campo durante o voo), o save corretivo não roda até ele preencher.
        // Não deixamos o "Salvando..." preso nesse meio-tempo.
        if (!currentInputIsValid) {
          setSaveStatus(null)
        }
        // Se válido: mantém 'Salvando...'; o save corretivo assume e limpa.
      } else {
        hasPendingUserEditRef.current = false
        setSaveStatus(null)
      }
    }, 800)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, away, isOpen, matchesPrediction, userId, match.id])

  const inputBorder = matchesPrediction ? 'border-green-500/60' : 'border-gray-600'

  const inputClasses = `w-9 h-9 text-center bg-gray-700/80 text-white font-bold text-base rounded-lg
    border ${inputBorder} focus:border-green-500 focus:ring-1 focus:ring-green-500/30 focus:outline-none
    disabled:opacity-30 disabled:cursor-not-allowed transition-colors`

  // Card é clicável quando NÃO é placeholder
  const isClickable = !isPlaceholderMatch
  const cardCursor = isClickable ? 'cursor-pointer' : ''
  const cardHover = isClickable ? 'hover:bg-gray-700/10 transition-colors' : ''

  const handleCardClick = () => {
    if (!isClickable) return
    setModalOpen(true)
  }

  // Impede que clique/foco/keydown no input dispare o handleCardClick do card pai.
  // Importante: tem que ser onMouseDown / onTouchStart também porque o
  // onClick do card pode disparar antes do onClick do input em alguns
  // navegadores mobile.
  const stop = (e) => e.stopPropagation()

  // Pressionar Enter no input remove o foco (fecha teclado no mobile).
  // O atributo enterKeyHint="done" já faz o teclado mostrar "Concluído"
  // em vez de "Próximo", mas Enter ainda dispararia submit em forms.
  // Como não estamos em form, o blur explícito garante consistência.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
  }

  return (
    <>
      <div
        onClick={handleCardClick}
        className={`flex-1 flex flex-col justify-center py-3.5 space-y-2 border-b border-gray-700/30 last:border-0 -mx-3 px-3
          ${cardCursor} ${cardHover}`}
      >
        {/* Estádio + Data */}
        <div className="text-center space-y-0.5">
          {match.venue && (
            <p className="text-gray-300 text-[10px] uppercase tracking-wider leading-tight truncate px-2">
              {match.venue}
            </p>
          )}
          <p className="text-gray-400 text-xs font-medium">
            {formatMatchDate(match.kickoff_time)}
          </p>
        </div>

        {/* Seleções + Placar/Palpite */}
        <div className="flex items-center justify-center gap-2">
          {/* Casa */}
          <TeamSide
            team={match.home_team}
            placeholder={match.home_placeholder}
            align="right"
          />

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
                enterKeyHint="done"
                maxLength={2}
                value={home}
                onChange={(e) => handleHomeChange(sanitizeScore(e.target.value))}
                onClick={stop}
                onFocus={stop}
                onMouseDown={stop}
                onTouchStart={stop}
                onKeyDown={handleKeyDown}
                disabled={!isOpen}
                className={inputClasses}
              />
              <span className="text-gray-500 text-sm font-bold">×</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                enterKeyHint="done"
                maxLength={2}
                value={away}
                onChange={(e) => handleAwayChange(sanitizeScore(e.target.value))}
                onClick={stop}
                onFocus={stop}
                onMouseDown={stop}
                onTouchStart={stop}
                onKeyDown={handleKeyDown}
                disabled={!isOpen}
                className={inputClasses}
              />
            </div>
          )}

          {/* Visitante */}
          <TeamSide
            team={match.away_team}
            placeholder={match.away_placeholder}
            align="left"
          />
        </div>

        {/* Linha de status */}
        <div className="text-center text-[11px] min-h-[16px]">
          {/* Placeholder: aguardando definição do confronto */}
          {isPlaceholderMatch && (
            <span className="text-gray-500 italic">
              ⏳ Aguardando definição do confronto
            </span>
          )}

          {/* Jogo finalizado: mostra resultado e pontos */}
          {!isPlaceholderMatch && isFinished && prediction && (
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
          {!isPlaceholderMatch && isFinished && !prediction && (
            <span className="text-gray-600 italic">Sem palpite</span>
          )}

          {/* Jogo aberto */}
          {!isPlaceholderMatch && !isFinished && isOpen && (
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

          {/* Jogo encerrado (deadline passou mas não foi finalizado ainda) */}
          {!isPlaceholderMatch && !isFinished && !isOpen && (
            <span className="text-gray-500">🔒 Encerrado</span>
          )}
        </div>
      </div>

      {/* Modal de palpites */}
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