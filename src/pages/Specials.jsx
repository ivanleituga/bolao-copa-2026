import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PLAYERS } from '../lib/players'
import { TeamFlag } from '../components/TeamFlag'

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

function normalizeAnswer(value) {
  return String(value || '').trim()
}

function formatDeadline(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} às ${hh}:${min}`
}

function getQuestionIcon(question) {
  if (question.answer_type === 'player') return '⚽'
  if (question.answer_type === 'team') return '🏆'
  return '★'
}

function getQuestionSubtitle(question) {
  if (question.answer_type === 'player') return 'Artilheiro'
  if (question.answer_type === 'team') return 'Campeão'
  return 'Especial'
}

function isQuestionPublic(question, now) {
  if (!question) return false
  if (question.correct_answer != null) return true
  if (!question.deadline) return false
  return new Date(question.deadline).getTime() <= now
}

function getAnswerMeta(answer, question, teams) {
  if (question.answer_type === 'team') {
    const team = teams.find((t) => t.name === answer)
    return {
      label: answer,
      flagCode: team?.code ?? null,
      kind: 'team',
    }
  }

  if (question.answer_type === 'player') {
    const player = PLAYERS.find((p) => p.name === answer)
    return {
      label: answer,
      flagCode: player?.country ?? null,
      kind: 'player',
    }
  }

  return {
    label: answer,
    flagCode: null,
    kind: 'text',
  }
}

function buildGroups(question, predictions, profilesById, teams) {
  const groupsByAnswer = {}

  predictions
    .filter((p) => p.question_id === question.id)
    .forEach((prediction) => {
      const answer = normalizeAnswer(prediction.answer)
      if (!answer) return

      if (!groupsByAnswer[answer]) {
        groupsByAnswer[answer] = {
          answer,
          ...getAnswerMeta(answer, question, teams),
          voters: [],
        }
      }

      groupsByAnswer[answer].voters.push({
        userId: prediction.user_id,
        displayName: profilesById[prediction.user_id] || '',
        updatedAt: prediction.updated_at,
      })
    })

  return Object.values(groupsByAnswer)
    .map((group) => ({
      ...group,
      count: group.voters.length,
      voters: group.voters.sort((a, b) =>
        (a.displayName || '').localeCompare(b.displayName || '', 'pt-BR', {
          sensitivity: 'base',
        })
      ),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.answer.localeCompare(b.answer, 'pt-BR', { sensitivity: 'base' })
    })
}

/* ═══════════════════════════════════════════════════
   AnswerIdentity
   ═══════════════════════════════════════════════════ */

function AnswerIdentity({ group, size = 'md' }) {
  const flagSize = size === 'lg' ? 24 : 20
  const textSize = size === 'lg' ? 'text-base' : 'text-sm'

  return (
    <div className="flex items-center gap-2 min-w-0">
      {group.flagCode ? (
        <TeamFlag code={group.flagCode} size={flagSize} />
      ) : (
        <div
          className="rounded-full bg-gray-700/70 border border-gray-600/60 flex-shrink-0"
          style={{ width: flagSize, height: flagSize }}
        />
      )}
      <span className={`${textSize} font-bold text-white truncate`}>
        {group.label}
      </span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   SpecialVotersModal
   ═══════════════════════════════════════════════════ */

function SpecialVotersModal({ selection, currentUserId, onClose }) {
  const { question, group } = selection

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] flex flex-col
          bg-gray-900 border border-gray-700/50 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-4 border-b border-gray-700/50 bg-gray-800/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  {getQuestionSubtitle(question)}
                </p>
                <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded
                  bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 leading-tight">
                  {question.points_value} pts
                </span>
              </div>
              <h3 className="text-white text-sm font-semibold leading-snug">
                {question.question_text}
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

          <div className="mt-4 flex items-center justify-between gap-3">
            <AnswerIdentity group={group} size="lg" />
            <div className="flex-shrink-0 text-right">
              <div className="text-2xl font-black text-green-400 tabular-nums leading-none">
                {group.count}
              </div>
              <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">
                votos
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-1.5">
            {group.voters.map((voter, idx) => {
              const isMe = voter.userId === currentUserId
              return (
                <div
                  key={voter.userId}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg
                    ${isMe ? 'bg-green-500/10 ring-1 ring-green-500/35' : 'bg-gray-800/60'}`}
                >
                  <div className="w-6 text-center text-xs font-black text-gray-500 tabular-nums">
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isMe ? 'text-green-300' : 'text-white'}`}>
                      {voter.displayName?.split('@')[0] || 'Usuário'}
                    </p>
                  </div>

                  {isMe && (
                    <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded
                      bg-green-500/15 text-green-300 border border-green-500/30 leading-tight">
                      Você
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   AnswerRow
   ═══════════════════════════════════════════════════ */

function AnswerRow({ group, total, isCorrect, onClick }) {
  const pct = total > 0 ? Math.round((group.count / total) * 100) : 0

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-lg border transition-colors overflow-hidden
        ${isCorrect
          ? 'bg-green-500/10 border-green-500/35 hover:bg-green-500/15'
          : 'bg-gray-900/60 border-gray-700/45 hover:bg-gray-700/35'
        }`}
    >
      <div className="relative">
        <div
          className={`absolute inset-y-0 left-0 ${isCorrect ? 'bg-green-500/10' : 'bg-green-500/5'}`}
          style={{ width: `${pct}%` }}
        />

        <div className="relative flex items-center gap-3 px-3 py-3">
          <div className="flex-1 min-w-0">
            <AnswerIdentity group={group} />
            {isCorrect && (
              <span className="mt-1 inline-flex text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded
                bg-green-500/15 text-green-300 border border-green-500/30 leading-tight">
                Resposta correta
              </span>
            )}
          </div>

          <div className="flex-shrink-0 text-right">
            <div className="text-lg font-black text-white tabular-nums leading-none">
              {group.count}
            </div>
            <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">
              {pct}%
            </div>
          </div>
        </div>
      </div>
    </button>
  )
}

/* ═══════════════════════════════════════════════════
   SpecialQuestionCard
   ═══════════════════════════════════════════════════ */

function SpecialQuestionCard({ question, groups, total, now, onSelectGroup }) {
  const isPublic = isQuestionPublic(question, now)

  return (
    <div className="bg-gray-800/80 rounded-xl overflow-hidden border border-gray-700/40">
      <div className="px-4 py-3 border-b border-gray-700/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm">{getQuestionIcon(question)}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                {getQuestionSubtitle(question)}
              </p>
              <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded
                bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 leading-tight">
                {question.points_value} pts
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white truncate">
              {question.question_text}
            </h3>
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="text-xl font-black text-green-400 tabular-nums leading-none">
            {isPublic ? total : '—'}
          </div>
          <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold mt-1">
            votos
          </div>
        </div>
      </div>

      <div className="p-3">
        {!isPublic ? (
          <div className="py-8 text-center">
            <div className="text-2xl mb-2">🔒</div>
            <p className="text-gray-400 text-sm font-medium">
              Palpites ainda ocultos
            </p>
            <p className="text-gray-600 text-xs mt-1">
              Serão liberados após {formatDeadline(question.deadline)}
            </p>
          </div>
        ) : total === 0 ? (
          <div className="py-8 text-center">
            <div className="text-2xl mb-2">—</div>
            <p className="text-gray-500 text-sm">
              Nenhum palpite registrado.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <AnswerRow
                key={group.answer}
                group={group}
                total={total}
                isCorrect={question.correct_answer != null && group.answer === question.correct_answer}
                onClick={() => onSelectGroup(question, group)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Specials — página principal
   ═══════════════════════════════════════════════════ */

export default function Specials({ userId }) {
  const [questions, setQuestions] = useState([])
  const [predictions, setPredictions] = useState([])
  const [profiles, setProfiles] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      setError(null)

      const [questionsRes, predictionsRes, profilesRes, teamsRes] = await Promise.all([
        supabase.from('special_questions').select('*').order('id'),
        supabase.from('special_predictions').select('question_id, user_id, answer, updated_at'),
        supabase.from('profiles').select('id, display_name').order('display_name'),
        supabase.from('teams').select('id, name, code').order('name'),
      ])

      if (questionsRes.error) {
        console.error('Erro ao buscar perguntas especiais:', questionsRes.error)
        setError(questionsRes.error)
        setLoading(false)
        return
      }

      if (predictionsRes.error) {
        console.error('Erro ao buscar palpites especiais:', predictionsRes.error)
        setError(predictionsRes.error)
        setLoading(false)
        return
      }

      if (profilesRes.error) {
        console.error('Erro ao buscar usuários:', profilesRes.error)
        setError(profilesRes.error)
        setLoading(false)
        return
      }

      if (teamsRes.error) {
        console.error('Erro ao buscar seleções:', teamsRes.error)
        setError(teamsRes.error)
        setLoading(false)
        return
      }

      setQuestions(questionsRes.data || [])
      setPredictions(predictionsRes.data || [])
      setProfiles(profilesRes.data || [])
      setTeams(teamsRes.data || [])
      setLoading(false)
    }

    fetchAll()
  }, [])

  const profilesById = useMemo(() => {
    const map = {}
    profiles.forEach((profile) => {
      map[profile.id] = profile.display_name
    })
    return map
  }, [profiles])

  const questionResults = useMemo(() => (
    questions.map((question) => {
      const groups = buildGroups(question, predictions, profilesById, teams)
      const total = groups.reduce((sum, group) => sum + group.count, 0)

      return {
        question,
        groups,
        total,
      }
    })
  ), [questions, predictions, profilesById, teams])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Carregando especiais...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="text-2xl mb-2">⚠️</div>
          <p className="text-red-400 text-sm font-medium">
            Não foi possível carregar os especiais.
          </p>
          <p className="text-gray-600 text-xs mt-1">
            Tente atualizar a página.
          </p>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-500 text-sm">Nenhum palpite especial cadastrado.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-px flex-1 bg-gray-700/50" />
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Especiais
        </h2>
        <div className="h-px flex-1 bg-gray-700/50" />
      </div>

      <div className="mb-4 bg-gray-800/50 border border-gray-700/40 rounded-xl px-4 py-3">
        <p className="text-gray-400 text-xs leading-relaxed text-center">
          Veja os palpites especiais agrupados por resposta. Toque em uma seleção ou jogador para ver quem escolheu. Disponível após o deadline.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {questionResults.map(({ question, groups, total }) => (
          <SpecialQuestionCard
            key={question.id}
            question={question}
            groups={groups}
            total={total}
            now={now}
            onSelectGroup={(q, group) => setSelected({ question: q, group })}
          />
        ))}
      </div>

      {selected && (
        <SpecialVotersModal
          selection={selected}
          currentUserId={userId}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}