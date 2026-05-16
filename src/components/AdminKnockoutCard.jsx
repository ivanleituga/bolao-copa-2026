import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { getRoundLabel } from '../lib/scoring'
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

/* ═══════════════════════════════════════════════════
   AdminKnockoutCard — define/edita/reseta os times de um match
   de mata-mata.

   Ações disponíveis:
   - "Salvar confronto" — placeholders → times definidos
   - "Atualizar confronto" — times definidos, sem palpites ainda → trocar
   - "Alterar confronto" — times definidos, COM palpites → trocar (com confirmação)
   - "Resetar pra placeholders" — times definidos → volta pros placeholders
       (com confirmação se houver palpites). Botão separado, layout discreto.
   ═══════════════════════════════════════════════════ */

export default function AdminKnockoutCard({ match, teams, now, predictionsCount, onSave, onReset }) {
  const [homeId, setHomeId] = useState(match.home_team_id ?? '')
  const [awayId, setAwayId] = useState(match.away_team_id ?? '')
  const [confirming, setConfirming] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Admin só pode editar se jogo ainda não começou
  const canEdit =
    match.status === 'scheduled' &&
    new Date(match.kickoff_time).getTime() > now

  const hasExistingTeams = match.home_team_id != null && match.away_team_id != null
  const count = predictionsCount ?? 0

  const hasChanged =
    String(homeId) !== String(match.home_team_id ?? '') ||
    String(awayId) !== String(match.away_team_id ?? '')
  const bothFilled = homeId !== '' && awayId !== ''
  const differentTeams = homeId !== awayId
  const canSave = canEdit && bothFilled && differentTeams && hasChanged

  // Decide se a alteração precisa passar pela tela de confirmação
  const needsConfirmation = hasExistingTeams && count > 0

  const handleSubmit = () => {
    if (!canSave) return
    setError(null)
    if (needsConfirmation) {
      setConfirming(true)
    } else {
      doSave()
    }
  }

  const doSave = async () => {
    setSaving(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('update_knockout_match', {
      p_match_id: match.id,
      p_home_team_id: parseInt(homeId),
      p_away_team_id: parseInt(awayId),
    })

    if (rpcError) {
      console.error('Erro ao salvar confronto:', rpcError)
      setError(rpcError.message || 'Erro ao salvar')
      setSaving(false)
      setConfirming(false)
      return
    }

    const deletedCount = data?.deleted_predictions ?? 0

    setSaving(false)
    setConfirming(false)

    if (deletedCount > 0) {
      setSuccessMsg(`${deletedCount} palpite${deletedCount > 1 ? 's' : ''} deletado${deletedCount > 1 ? 's' : ''} — avise no grupo!`)
      setTimeout(() => setSuccessMsg(null), 10000)
    }

    onSave(match.id, parseInt(homeId), parseInt(awayId), deletedCount)
  }

  const handleResetClick = () => {
    setError(null)
    setConfirmingReset(true)
  }

  const doReset = async () => {
    setSaving(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('reset_knockout_match', {
      p_match_id: match.id,
    })

    if (rpcError) {
      console.error('Erro ao resetar confronto:', rpcError)
      setError(rpcError.message || 'Erro ao resetar')
      setSaving(false)
      setConfirmingReset(false)
      return
    }

    const deletedCount = data?.deleted_predictions ?? 0

    setSaving(false)
    setConfirmingReset(false)

    // Limpa selects locais pra voltar ao estado de placeholder
    setHomeId('')
    setAwayId('')

    if (deletedCount > 0) {
      setSuccessMsg(`Confronto resetado — ${deletedCount} palpite${deletedCount > 1 ? 's' : ''} deletado${deletedCount > 1 ? 's' : ''}. Avise no grupo!`)
      setTimeout(() => setSuccessMsg(null), 10000)
    } else {
      setSuccessMsg('Confronto resetado pra placeholders.')
      setTimeout(() => setSuccessMsg(null), 6000)
    }

    if (onReset) {
      onReset(match.id, deletedCount)
    }
  }

  const handleCancel = () => {
    setConfirming(false)
    setConfirmingReset(false)
    setError(null)
  }

  // Times selecionados (pra mostrar bandeira ao lado do select)
  const selectedHome = teams.find((t) => t.id === parseInt(homeId))
  const selectedAway = teams.find((t) => t.id === parseInt(awayId))

  const selectClasses = `flex-1 min-w-0 py-2 px-3 bg-gray-700/80 text-white text-sm rounded-lg
    border border-gray-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/30 focus:outline-none
    disabled:opacity-50 disabled:cursor-not-allowed transition-colors appearance-none`

  // Label do botão principal muda conforme estado
  let primaryButtonLabel = 'Salvar confronto'
  if (hasExistingTeams) {
    primaryButtonLabel = count > 0 ? 'Alterar confronto' : 'Atualizar confronto'
  }

  // Estado: alguma confirmação aberta? Esconde os dropdowns nesse caso.
  const isConfirming = confirming || confirmingReset

  return (
    <div className="bg-gray-800/80 rounded-xl border border-gray-700/40 overflow-hidden">
      {/* Header: data + round */}
      <div className="px-4 py-2.5 border-b border-gray-700/30 text-xs text-gray-400">
        <span className="font-medium">{formatMatchDate(match.kickoff_time)}</span>
        <span className="text-gray-600 mx-1.5">·</span>
        <span>{getRoundLabel(match.round)}</span>
      </div>

      {/* Corpo */}
      <div className="p-4 space-y-3">
        {/* Estádio */}
        {match.venue && (
          <p className="text-center text-gray-500 text-[10px] uppercase tracking-wider truncate">
            {match.venue}
          </p>
        )}

        {/* Confronto "oficial" (placeholder × placeholder) */}
        <div className="flex items-center justify-center gap-2 text-xs">
          <span className="text-gray-500 italic font-medium">
            {match.home_placeholder}
          </span>
          <span className="text-gray-600">×</span>
          <span className="text-gray-500 italic font-medium">
            {match.away_placeholder}
          </span>
        </div>

        {/* Indicador de palpites existentes */}
        {hasExistingTeams && count > 0 && (
          <p className="text-center text-[11px] text-yellow-400/80">
            ⚠ {count} usuário{count > 1 ? 's' : ''} já palpit{count > 1 ? 'aram' : 'ou'}
          </p>
        )}

        {/* Dropdowns (escondidos durante qualquer confirmação) */}
        {!isConfirming && (
          <div className="space-y-2">
            {/* Casa */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 w-10 shrink-0">Casa</span>
              <div className="w-[20px] h-[14px] shrink-0 flex items-center">
                {selectedHome && <TeamFlag code={selectedHome.code} size={20} />}
              </div>
              <select
                value={homeId}
                onChange={(e) => setHomeId(e.target.value)}
                disabled={!canEdit || saving}
                className={selectClasses}
              >
                <option value="">Selecione...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Fora */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-500 w-10 shrink-0">Fora</span>
              <div className="w-[20px] h-[14px] shrink-0 flex items-center">
                {selectedAway && <TeamFlag code={selectedAway.code} size={20} />}
              </div>
              <select
                value={awayId}
                onChange={(e) => setAwayId(e.target.value)}
                disabled={!canEdit || saving}
                className={selectClasses}
              >
                <option value="">Selecione...</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Área de feedback + ação */}
        <div className="pt-1 space-y-2">
          {/* Sucesso persistente */}
          {successMsg && (
            <p className="text-center text-xs text-green-400">
              ✓ {successMsg}
            </p>
          )}

          {/* Confirmação de ALTERAÇÃO destrutiva */}
          {confirming && (
            <div className="space-y-2">
              <p className="text-center text-yellow-400 text-xs font-medium">
                ⚠ {count} palpite{count > 1 ? 's' : ''} {count > 1 ? 'serão deletados' : 'será deletado'}
              </p>
              <p className="text-center text-gray-500 text-[10px]">
                Alterar os times deste jogo remove os palpites existentes. Você precisará avisar os usuários no grupo.
              </p>
              {error && (
                <p className="text-center text-red-400 text-xs">{error}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg transition-colors
                    bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={doSave}
                  disabled={saving}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg transition-colors
                    bg-red-600 hover:bg-red-700 text-white
                    disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Confirmar alteração'}
                </button>
              </div>
            </div>
          )}

          {/* Confirmação de RESET */}
          {confirmingReset && (
            <div className="space-y-2">
              <p className="text-center text-red-400 text-xs font-medium">
                Resetar este confronto pra placeholders?
              </p>
              <p className="text-center text-gray-500 text-[10px]">
                Os times definidos serão removidos e o confronto voltará pros placeholders ({match.home_placeholder} × {match.away_placeholder}).
                {count > 0 && (
                  <> {count} palpite{count > 1 ? 's' : ''} {count > 1 ? 'serão deletados' : 'será deletado'}. Avise no grupo.</>
                )}
              </p>
              {error && (
                <p className="text-center text-red-400 text-xs">{error}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg transition-colors
                    bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  Cancelar
                </button>
                <button
                  onClick={doReset}
                  disabled={saving}
                  className="flex-1 py-2 text-xs font-semibold rounded-lg transition-colors
                    bg-red-600 hover:bg-red-700 text-white
                    disabled:opacity-50"
                >
                  {saving ? 'Resetando...' : 'Confirmar reset'}
                </button>
              </div>
            </div>
          )}

                 {/* Botões normais (quando não está confirmando nada) */}
          {!isConfirming && (
            <div className="flex items-center justify-between gap-2 min-h-[32px]">
              <div className="text-[11px] flex-1 min-w-0">
                {error && <span className="text-red-400">{error}</span>}
                {!error && bothFilled && !differentTeams && (
                  <span className="text-red-400">⚠ Times devem ser diferentes</span>
                )}
                {!error && !canEdit && (
                  <span className="text-gray-500 italic">🔒 Jogo já começou</span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleSubmit}
                  disabled={!canSave || saving}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0
                    ${canSave && !saving
                      ? (needsConfirmation
                          ? 'bg-red-600 text-white hover:bg-red-500'
                          : 'bg-yellow-600 text-white hover:bg-yellow-500')
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                >
                  {saving ? 'Salvando...' : primaryButtonLabel}
                </button>

                {hasExistingTeams && canEdit && (
                  <button
                    onClick={handleResetClick}
                    disabled={saving}
                    title="Resetar confronto para os placeholders originais"
                    className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0
                      bg-red-500/10 hover:bg-red-500/20
                      text-red-300 hover:text-red-200
                      border border-red-500/30 hover:border-red-400/50
                      disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Resetar
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}