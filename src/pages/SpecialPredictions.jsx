import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getFlagUrl } from '../lib/flags'

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

function formatCountdown(ms) {
  if (ms <= 0) return null
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}min`
  return `${m}min`
}

function TeamFlag({ code, size = 20 }) {
  const url = getFlagUrl(code, 80)
  if (!url) return null
  return (
    <img
      src={url}
      alt={code}
      className="inline-block rounded-sm object-cover"
      style={{ width: size, height: size * 0.67 }}
      loading="lazy"
    />
  )
}

/* ═══════════════════════════════════════════════════
   QuestionCard — card individual pra cada pergunta
   ═══════════════════════════════════════════════════ */

function QuestionCard({ question, prediction, teams, now, userId, onSaved }) {
  const [answer, setAnswer] = useState(prediction?.answer ?? '')
  const [saveStatus, setSaveStatus] = useState(null)

  const remaining = new Date(question.deadline).getTime() - now
  const isOpen = remaining > 0
  const isTeam = question.answer_type === 'team'

  const handleSave = async (value) => {
    const val = value ?? answer
    if (!val || !val.trim()) return
    if (!isOpen) return
    if (prediction && prediction.answer === val) return

    setSaveStatus('saving')

    const { error } = await supabase.from('special_predictions').upsert(
      {
        user_id: userId,
        question_id: question.id,
        answer: val.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,question_id' }
    )

    if (error) {
      console.error('Erro ao salvar resposta:', error)
      setSaveStatus('error')
    } else {
      setSaveStatus('saved')
      onSaved(question.id, val.trim())
    }

    setTimeout(() => setSaveStatus(null), 2500)
  }

  const handleTeamChange = (e) => {
    const val = e.target.value
    setAnswer(val)
    if (val) handleSave(val)
  }

  // Encontra o time selecionado pra mostrar a bandeira
  const selectedTeam = isTeam ? teams.find((t) => t.name === answer) : null

  return (
    <div className="bg-gray-900/60 rounded-lg p-4">
      {/* Pergunta */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-white text-sm font-semibold">
          {question.question_text}
        </h4>
        <span className="text-yellow-400 text-xs font-bold">
          {question.points_value} pts
        </span>
      </div>

      {/* Input */}
      {isTeam ? (
        <div className="relative">
          {selectedTeam && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <TeamFlag code={selectedTeam.code} size={20} />
            </div>
          )}
          <select
            value={answer}
            onChange={handleTeamChange}
            disabled={!isOpen}
            className={`w-full py-2.5 bg-gray-700/80 text-white text-sm rounded-lg
              border border-gray-600 focus:border-green-500 focus:ring-1 focus:ring-green-500/30 focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors appearance-none
              ${selectedTeam ? 'pl-10 pr-4' : 'px-4'}`}
          >
            <option value="">Selecione uma seleção...</option>
            {teams.map((t) => (
              <option key={t.id} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onBlur={() => handleSave()}
          disabled={!isOpen}
          placeholder="Nome do jogador..."
          className="w-full px-4 py-2.5 bg-gray-700/80 text-white text-sm rounded-lg
            border border-gray-600 focus:border-green-500 focus:ring-1 focus:ring-green-500/30 focus:outline-none
            disabled:opacity-50 disabled:cursor-not-allowed transition-colors
            placeholder-gray-500"
        />
      )}

      {/* Status */}
      <div className="mt-2 text-[11px] min-h-[16px]">
        {isOpen && (
          <>
            {saveStatus === 'saving' && (
              <span className="text-yellow-400">Salvando...</span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-green-400">✓ Salvo</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-400">Erro ao salvar</span>
            )}
            {!saveStatus && remaining > 0 && (
              <span className={remaining <= 3600000 ? 'text-yellow-400' : 'text-gray-500'}>
                ⏱ {formatCountdown(remaining)} para responder
              </span>
            )}
          </>
        )}
        {!isOpen && answer && (
          <span className="text-gray-400">
            🔒 Sua resposta: <span className="text-white font-medium">{answer}</span>
          </span>
        )}
        {!isOpen && !answer && (
          <span className="text-gray-600 italic">Sem resposta</span>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   SpecialPredictions — componente principal
   ═══════════════════════════════════════════════════ */

export default function SpecialPredictions({ userId, now }) {
  const [questions, setQuestions] = useState([])
  const [predictions, setPredictions] = useState({})
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      const [questionsRes, predsRes, teamsRes] = await Promise.all([
        supabase.from('special_questions').select('*').order('id'),
        supabase.from('special_predictions').select('*').eq('user_id', userId),
        supabase.from('teams').select('id, name, code').order('name'),
      ])

      if (questionsRes.error) {
        console.error('Erro ao buscar perguntas:', questionsRes.error)
        setLoading(false)
        return
      }

      setQuestions(questionsRes.data || [])
      setTeams(teamsRes.data || [])

      const predsMap = {}
      if (predsRes.data) {
        predsRes.data.forEach((p) => {
          predsMap[p.question_id] = p
        })
      }
      setPredictions(predsMap)
      setLoading(false)
    }

    fetchAll()
  }, [userId])

  const handleSaved = (questionId, answer) => {
    setPredictions((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        question_id: questionId,
        user_id: userId,
        answer,
      },
    }))
  }

  if (loading || questions.length === 0) return null

  return (
    <div className="mb-6">
      <div className="bg-gray-800/80 rounded-xl overflow-hidden border border-gray-700/40">
        <div className="px-4 py-3 border-b border-gray-700/40 flex items-center gap-2">
          <span className="text-sm">🏆</span>
          <h3 className="text-sm font-semibold text-white uppercase tracking-wide">
            Palpites Especiais
          </h3>
        </div>
        <div className="p-3 grid gap-3 sm:grid-cols-2">
          {questions.map((q) => (
            <QuestionCard
              key={q.id}
              question={q}
              prediction={predictions[q.id] || null}
              teams={teams}
              now={now}
              userId={userId}
              onSaved={handleSaved}
            />
          ))}
        </div>
      </div>
    </div>
  )
}