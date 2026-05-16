import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getRoundLabel } from '../lib/scoring'
import { PLAYERS } from '../lib/players'
import { TeamFlag } from '../components/TeamFlag'
import AdminKnockoutCard from '../components/AdminKnockoutCard'
import MissingParticipantsBlock from '../components/MissingParticipantsBlock'

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const KNOCKOUT_ROUND_ORDER = ['round_of_32', 'round_of_16', 'quarter', 'semi', 'third_place', 'final']

function formatMatchDate(iso) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} • ${DIAS[d.getDay()]} • ${hh}:${min}`
}

function groupByRound(matches) {
  const groups = {}
  matches.forEach((m) => {
    if (!groups[m.round]) groups[m.round] = []
    groups[m.round].push(m)
  })
  return KNOCKOUT_ROUND_ORDER
    .filter((r) => groups[r])
    .map((r) => ({ round: r, matches: groups[r] }))
}

/* ═══════════════════════════════════════════════════
   AdminMatchCard — card de um jogo com input de resultado
   ═══════════════════════════════════════════════════ */

function AdminMatchCard({ match, onResult, onReset }) {
  const [home, setHome] = useState(match.home_score ?? '')
  const [away, setAway] = useState(match.away_score ?? '')
  const [confirming, setConfirming] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isFinished = match.status === 'finished'
  const hasInput = home !== '' && away !== '' && !isNaN(parseInt(home)) && !isNaN(parseInt(away))

  const handleSubmit = () => {
    if (!hasInput) return
    setConfirming(true)
    setError(null)
  }

  const handleConfirm = async () => {
    setSaving(true)
    setError(null)

    const h = parseInt(home)
    const a = parseInt(away)

    const { error: rpcError } = await supabase.rpc('process_match_result', {
      p_match_id: match.id,
      p_home_score: h,
      p_away_score: a,
    })

    if (rpcError) {
      console.error('Erro ao processar resultado:', rpcError)
      setError('Erro ao salvar resultado')
      setSaving(false)
      setConfirming(false)
      return
    }

    setSaving(false)
    setConfirming(false)
    onResult(match.id, h, a)
  }

  const handleCancel = () => {
    setConfirming(false)
    setConfirmingReset(false)
    setError(null)
  }

  const handleReset = async () => {
    setSaving(true)
    setError(null)

    const { error: rpcError } = await supabase.rpc('reset_match_result', {
      p_match_id: match.id,
    })

    if (rpcError) {
      console.error('Erro ao reverter resultado:', rpcError)
      setError('Erro ao reverter resultado')
      setSaving(false)
      setConfirmingReset(false)
      return
    }

    setSaving(false)
    setConfirmingReset(false)
    onReset(match.id)
  }

  const inputClasses = `w-12 h-12 text-center bg-gray-700/80 text-white font-bold text-xl rounded-lg
    border border-gray-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 focus:outline-none
    transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none
    [&::-webkit-inner-spin-button]:appearance-none`

  return (
    <div className={`bg-gray-800/80 rounded-xl border overflow-hidden
      ${isFinished ? 'border-gray-700/30' : 'border-gray-700/40'}`}>

      <div className="px-4 py-2.5 border-b border-gray-700/30 flex items-center justify-between">
        <div className="text-xs text-gray-400">
          <span className="font-medium">{formatMatchDate(match.kickoff_time)}</span>
          <span className="text-gray-600 mx-1.5">·</span>
          <span>{getRoundLabel(match.round)}</span>
          {match.group_letter && (
            <span className="text-gray-600"> · Grupo {match.group_letter}</span>
          )}
        </div>
        {isFinished && (
          <span className="text-[10px] uppercase tracking-wider text-green-500 font-semibold">
            Finalizado
          </span>
        )}
      </div>

      <div className="px-4 py-4">
        {match.venue && (
          <p className="text-center text-gray-500 text-[10px] uppercase tracking-wider mb-3 truncate">
            {match.venue}
          </p>
        )}

        <div className="flex items-center justify-center gap-3">
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <span className="text-white text-sm font-medium truncate text-right">
              {match.home_team.name}
            </span>
            <TeamFlag code={match.home_team.code} size={26} />
          </div>

          <div className="flex items-center gap-2 px-2">
            <input
              type="number"
              inputMode="numeric"
              enterKeyHint="done"
              min="0"
              max="99"
              value={home}
              onChange={(e) => setHome(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
              className={inputClasses}
              placeholder="-"
            />
            <span className="text-gray-500 text-lg font-bold">×</span>
            <input
              type="number"
              inputMode="numeric"
              enterKeyHint="done"
              min="0"
              max="99"
              value={away}
              onChange={(e) => setAway(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
              className={inputClasses}
              placeholder="-"
            />
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TeamFlag code={match.away_team.code} size={26} />
            <span className="text-white text-sm font-medium truncate">
              {match.away_team.name}
            </span>
          </div>
        </div>

        <div className="mt-4">
          {error && (
            <p className="text-center text-red-400 text-xs mb-2">{error}</p>
          )}

          {!confirming && !confirmingReset && !isFinished && (
            <button
              onClick={handleSubmit}
              disabled={!hasInput}
              className="w-full py-2.5 text-sm font-semibold rounded-lg transition-colors
                bg-yellow-600 hover:bg-yellow-700 text-white
                disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Registrar resultado
            </button>
          )}

          {!confirming && !confirmingReset && isFinished && (
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!hasInput}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors
                  bg-gray-700 hover:bg-gray-600 text-gray-200
                  disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Corrigir
              </button>
              <button
                onClick={() => setConfirmingReset(true)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors
                  bg-transparent hover:bg-red-500/10 text-red-400/70 hover:text-red-400
                  border border-red-500/20 hover:border-red-500/40"
              >
                Excluir resultado
              </button>
            </div>
          )}

          {confirming && (
            <div className="space-y-2">
              <p className="text-center text-yellow-400 text-xs font-medium">
                Confirmar: {match.home_team.name} {home} × {away} {match.away_team.name}?
              </p>
              <p className="text-center text-gray-500 text-[10px]">
                {isFinished
                  ? 'A correção vai recalcular os pontos automaticamente.'
                  : 'Os pontos dos palpiteiros serão calculados automaticamente.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors
                    bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors
                    bg-green-600 hover:bg-green-700 text-white
                    disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}

          {confirmingReset && (
            <div className="space-y-2">
              <p className="text-center text-red-400 text-xs font-medium">
                Excluir resultado de {match.home_team.name} × {match.away_team.name}?
              </p>
              <p className="text-center text-gray-500 text-[10px]">
                O jogo volta pra "aguardando" e os pontos são zerados.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors
                    bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleReset}
                  disabled={saving}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors
                    bg-red-600 hover:bg-red-700 text-white
                    disabled:opacity-50"
                >
                  {saving ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   SpecialQuestionAdmin — gerenciamento das perguntas especiais

   Princípio de privacidade: o admin não vê respostas individuais
   dos participantes através da interface. A interface mostra apenas:
     - Botão pra definir/limpar a resposta correta
     - Contagem de participação (X/Y responderam) + lista de faltantes

   Pra ver respostas individuais antes do prazo (debug/auditoria), 
   usar SQL Editor com receitas em supabase/scripts/.
   ═══════════════════════════════════════════════════ */

function SpecialQuestionAdmin({ question, teams, allUsers, onUpdate }) {
  const isMulti = question.answer_type === 'player'

  const parseInitial = (val) => {
    if (!val) return isMulti ? [] : ''
    if (isMulti) {
      return val.split(',').map((s) => s.trim()).filter(Boolean)
    }
    return val
  }

  const [correctAnswer, setCorrectAnswer] = useState(parseInitial(question.correct_answer))
  const [pendingPick, setPendingPick] = useState('')
  const [savingCorrect, setSavingCorrect] = useState(false)

  // Participação via RPC (sempre acessível, sem violar RLS)
  const [participatedIds, setParticipatedIds] = useState(new Set())
  const [participationLoaded, setParticipationLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchParticipation = async () => {
      const { data, error } = await supabase
        .rpc('special_question_participation', { p_question_id: question.id })
      if (cancelled) return
      if (!error && data) {
        setParticipatedIds(new Set(data.map((row) => row.user_id)))
      }
      setParticipationLoaded(true)
    }
    fetchParticipation()
    return () => { cancelled = true }
  }, [question.id, question.correct_answer])

  const handleAddPick = () => {
    if (!pendingPick) return
    if (correctAnswer.includes(pendingPick)) {
      setPendingPick('')
      return
    }
    setCorrectAnswer([...correctAnswer, pendingPick])
    setPendingPick('')
  }

  const handleRemove = (name) => {
    setCorrectAnswer(correctAnswer.filter((n) => n !== name))
  }

  const handleSaveCorrectAnswer = async () => {
    let toSave
    if (isMulti) {
      if (correctAnswer.length === 0) return
      toSave = correctAnswer.join(',')
    } else {
      if (!correctAnswer.trim()) return
      toSave = correctAnswer.trim()
    }

    setSavingCorrect(true)

    const { error } = await supabase
      .from('special_questions')
      .update({ correct_answer: toSave })
      .eq('id', question.id)

    setSavingCorrect(false)
    if (error) {
      console.error('Erro ao salvar resposta correta:', error)
    } else {
      onUpdate()
    }
  }

  const handleClearCorrectAnswer = async () => {
    setSavingCorrect(true)

    const { error } = await supabase
      .from('special_questions')
      .update({ correct_answer: null })
      .eq('id', question.id)

    setSavingCorrect(false)
    if (!error) {
      setCorrectAnswer(isMulti ? [] : '')
      setPendingPick('')
      onUpdate()
    }
  }

  const missing = (allUsers || []).filter((u) => !participatedIds.has(u.id))

  const canSave = isMulti ? correctAnswer.length > 0 : correctAnswer.trim().length > 0

  return (
    <div className="bg-gray-800/80 rounded-xl border border-gray-700/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700/40 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">
          {question.question_text}
        </h4>
        <span className="text-yellow-400 text-xs font-bold">
          {question.points_value} pts
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Resposta correta */}
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold block mb-1.5">
            {isMulti ? 'Respostas corretas' : 'Resposta correta'}
          </label>

          {/* MODO TEAM: dropdown único — [select | Salvar | Limpar] */}
          {!isMulti && (
            <div className="flex gap-2">
              <select
                value={correctAnswer}
                onChange={(e) => { setCorrectAnswer(e.target.value) }}
                className="flex-1 min-w-0 px-3 py-2 bg-gray-700/80 text-white text-sm rounded-lg
                  border border-gray-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30
                  focus:outline-none appearance-none"
              >
                <option value="">Selecione a seleção campeã...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
              <button
                onClick={handleSaveCorrectAnswer}
                disabled={savingCorrect || !canSave}
                className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
                  bg-yellow-600 hover:bg-yellow-700 text-white
                  disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {savingCorrect ? '...' : 'Salvar'}
              </button>
              {question.correct_answer && (
                <button
                  onClick={handleClearCorrectAnswer}
                  disabled={savingCorrect}
                  className="px-3 py-2 text-sm rounded-lg transition-colors
                    bg-transparent hover:bg-red-500/10 text-red-400/70 hover:text-red-400
                    border border-red-500/20 hover:border-red-500/40"
                >
                  Limpar
                </button>
              )}
            </div>
          )}

          {/* MODO PLAYER: multi-select numa linha — [select | +Adicionar | Salvar | Limpar] */}
          {isMulti && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={pendingPick}
                  onChange={(e) => { setPendingPick(e.target.value) }}
                  className="flex-1 min-w-0 px-3 py-2 bg-gray-700/80 text-white text-sm rounded-lg
                    border border-gray-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30
                    focus:outline-none appearance-none"
                >
                  <option value="">Selecione um artilheiro...</option>
                  {PLAYERS
                    .filter((p) => !correctAnswer.includes(p.name))
                    .map((p) => (
                      <option key={p.name} value={p.name}>{p.name}</option>
                    ))
                  }
                </select>
                <button
                  onClick={handleAddPick}
                  disabled={!pendingPick}
                  className="px-3 py-2 text-sm font-medium rounded-lg transition-colors
                    bg-gray-700 hover:bg-gray-600 text-gray-200
                    disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  + Adicionar
                </button>
                <button
                  onClick={handleSaveCorrectAnswer}
                  disabled={savingCorrect || !canSave}
                  className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
                    bg-yellow-600 hover:bg-yellow-700 text-white
                    disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {savingCorrect ? '...' : 'Salvar'}
                </button>
                {question.correct_answer && (
                  <button
                    onClick={handleClearCorrectAnswer}
                    disabled={savingCorrect}
                    className="px-3 py-2 text-sm rounded-lg transition-colors
                      bg-transparent hover:bg-red-500/10 text-red-400/70 hover:text-red-400
                      border border-red-500/20 hover:border-red-500/40"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Chips dos selecionados (linha de baixo) */}
              {correctAnswer.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {correctAnswer.map((name) => (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md
                        bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 text-xs font-medium"
                    >
                      {name}
                      <button
                        onClick={() => handleRemove(name)}
                        className="text-yellow-400/70 hover:text-yellow-300 leading-none"
                        aria-label={`Remover ${name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {question.correct_answer && (
            <p className="text-green-400 text-xs mt-1.5">
              ✓ {isMulti && question.correct_answer.includes(',')
                ? `Definidas: ${question.correct_answer}`
                : `Definida: ${question.correct_answer}`}
            </p>
          )}
        </div>

        {/* Participação dos usuários */}
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider font-semibold block mb-1.5">
            Participação
          </label>

          {!participationLoaded ? (
            <p className="text-gray-500 text-xs italic">Carregando participação...</p>
          ) : (
            <MissingParticipantsBlock
              total={(allUsers || []).length}
              missing={missing}
              label="respondeu"
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Admin — página principal
   ═══════════════════════════════════════════════════ */

export default function Admin() {
  const [matches, setMatches] = useState([])
  const [teams, setTeams] = useState([])
  const [specialQuestions, setSpecialQuestions] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [now, setNow] = useState(() => Date.now())

  // Mapa { match_id → quantidade de palpites }. Só usado na aba
  // "Definir mata-mata" pra avisar admin antes de alterar um confronto
  // que já tem palpites. Vem da RPC match_predictions_counts que
  // respeita privacidade (retorna só counts, não palpites).
  const [predictionsCount, setPredictionsCount] = useState({})

  // Busca perguntas especiais + profiles. NÃO busca special_predictions
  // (privacidade — admin segue mesmas regras que usuário comum na UI).
  const fetchSpecial = async () => {
    const [questionsRes, profilesRes] = await Promise.all([
      supabase.from('special_questions').select('*').order('id'),
      supabase.from('profiles').select('id, display_name').order('display_name'),
    ])

    setSpecialQuestions(questionsRes.data || [])
    setAllUsers(profilesRes.data || [])
  }

  // Conta palpites por match via RPC (só admin pode chamar; retorna
  // agregado sem expor palpites).
  const fetchPredictionsCount = async () => {
    const { data, error } = await supabase.rpc('match_predictions_counts')

    if (error) {
      console.error('Erro ao contar palpites:', error)
      return
    }

    const counts = {}
    ;(data || []).forEach((row) => {
      counts[row.match_id] = row.predictions_count
    })
    setPredictionsCount(counts)
  }

  useEffect(() => {
    const fetchAll = async () => {
      const [matchesRes, teamsRes] = await Promise.all([
        supabase
          .from('matches')
          .select(
            `*,
            home_team:teams!home_team_id(id, name, code),
            away_team:teams!away_team_id(id, name, code)`
          )
          .order('kickoff_time'),
        supabase.from('teams').select('id, name, code').order('name'),
      ])

      if (matchesRes.error) {
        console.error('Erro ao buscar jogos:', matchesRes.error)
      } else {
        setMatches(matchesRes.data || [])
      }

      setTeams(teamsRes.data || [])

      await fetchSpecial()
      await fetchPredictionsCount()
      setLoading(false)
    }

    fetchAll()
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => clearInterval(id)
  }, [])

  const handleResult = (matchId, homeScore, awayScore) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? { ...m, home_score: homeScore, away_score: awayScore, status: 'finished' }
          : m
      )
    )
  }

  const handleReset = (matchId) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? { ...m, home_score: null, away_score: null, status: 'scheduled' }
          : m
      )
    )
  }

  const handleKnockoutSave = (matchId, homeId, awayId, deletedCount) => {
    const home = teams.find((t) => t.id === homeId)
    const away = teams.find((t) => t.id === awayId)
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? {
              ...m,
              home_team_id: homeId,
              away_team_id: awayId,
              home_team: home ? { id: home.id, name: home.name, code: home.code } : null,
              away_team: away ? { id: away.id, name: away.name, code: away.code } : null,
            }
          : m
      )
    )
    if (deletedCount > 0) {
      setPredictionsCount((prev) => ({ ...prev, [matchId]: 0 }))
    }
  }

  const handleKnockoutReset = (matchId) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? {
              ...m,
              home_team_id: null,
              away_team_id: null,
              home_team: null,
              away_team: null,
            }
          : m
      )
    )

    setPredictionsCount((prev) => ({ ...prev, [matchId]: 0 }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Carregando jogos...</p>
        </div>
      </div>
    )
  }

  const pending = matches.filter(
    (m) => m.status !== 'finished' && m.home_team != null && m.away_team != null
  )
  const finished = matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time))

  const editableKnockout = matches.filter(
    (m) =>
      m.round !== 'group' &&
      m.status === 'scheduled' &&
      new Date(m.kickoff_time).getTime() > now
  )

  const displayMatches =
    filter === 'pending' ? pending :
    filter === 'finished' ? finished :
    []

  const groupedKnockout = groupByRound(editableKnockout)

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-px flex-1 bg-gray-700/50" />
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Painel do Admin
        </h2>
        <div className="h-px flex-1 bg-gray-700/50" />
      </div>

      {/* Perguntas Especiais */}
      {specialQuestions.length > 0 && (
        <>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">🏆</span>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Perguntas Especiais
            </h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 mb-6">
            {specialQuestions.map((q) => (
              <SpecialQuestionAdmin
                key={q.id}
                question={q}
                teams={teams}
                allUsers={allUsers}
                onUpdate={fetchSpecial}
              />
            ))}
          </div>
        </>
      )}

      {/* Jogos */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">⚽</span>
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Jogos
        </h3>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setFilter('pending')}
          className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-colors
            ${filter === 'pending'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
        >
          Aguardando resultado
          <span className="ml-1.5 text-xs opacity-70">({pending.length})</span>
        </button>
        <button
          onClick={() => setFilter('finished')}
          className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-colors
            ${filter === 'finished'
              ? 'bg-green-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
        >
          Finalizados
          <span className="ml-1.5 text-xs opacity-70">({finished.length})</span>
        </button>
        <button
          onClick={() => setFilter('knockout')}
          className={`whitespace-nowrap px-4 py-2 text-sm font-medium rounded-lg transition-colors
            ${filter === 'knockout'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
        >
          Definir mata-mata
          <span className="ml-1.5 text-xs opacity-70">({editableKnockout.length})</span>
        </button>
      </div>

      {filter === 'knockout' ? (
        editableKnockout.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-gray-500 text-sm text-center">
              Nenhum confronto de mata-mata pendente de definição ou edição.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedKnockout.map((group) => (
              <div key={group.round}>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                  {getRoundLabel(group.round)}
                  <span className="ml-1.5 text-gray-600">({group.matches.length})</span>
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.matches.map((m) => (
                    <AdminKnockoutCard
                      key={m.id}
                      match={m}
                      teams={teams}
                      now={now}
                      predictionsCount={predictionsCount[m.id] ?? 0}
                      onSave={handleKnockoutSave}
                      onReset={handleKnockoutReset}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        displayMatches.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-gray-500 text-sm">
              {filter === 'pending'
                ? 'Todos os jogos já foram finalizados.'
                : 'Nenhum jogo finalizado ainda.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {displayMatches.map((match) => (
              <AdminMatchCard
                key={match.id}
                match={match}
                onResult={handleResult}
                onReset={handleReset}
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}