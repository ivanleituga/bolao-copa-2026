import { useState } from 'react'

/**
 * Bloco colapsável que mostra "X/Y participaram" + botão pra
 * expandir a lista de quem ainda NÃO participou.
 *
 * Props:
 *   - total: número total de participantes (ex: 35)
 *   - missing: array de objetos { id, display_name }
 *   - label: substantivo singular ("palpitou", "respondeu")
 *     Plural é montado automaticamente ("palpitaram", "responderam").
 *   - defaultOpen: opcional, força default expandido
 *
 * Comportamento:
 *   - Default colapsado
 *   - Click no header expande/colapsa
 *   - Mostra contador sempre visível: "X/Y já palpitaram"
 *   - Quando expandido, mostra chips com nomes dos faltantes
 *   - Se ninguém falta, mostra mensagem positiva ao invés do botão
 */
export default function MissingParticipantsBlock({
  total,
  missing,
  label = 'palpitou',
  defaultOpen = false,
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  const missingCount = missing.length
  const participatedCount = total - missingCount
  const labelPlural = label.endsWith('u')
    ? label.slice(0, -1) + 'ram'  // palpitou → palpitaram, respondeu → responderam
    : label + 'ram'

  // Todo mundo participou: mensagem positiva, sem botão de expandir
  if (missingCount === 0 && total > 0) {
    return (
      <div className="px-3 py-2.5 rounded-lg border border-green-500/20 bg-green-500/5">
        <div className="flex items-center gap-2">
          <span className="text-green-400 text-sm">✓</span>
          <span className="text-xs text-green-300 font-medium">
            Todos os {total} {labelPlural}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-700/40 bg-gray-800/40 overflow-hidden">
      {/* Header clicável */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full px-3 py-2.5 flex items-center justify-between
          hover:bg-gray-700/30 transition-colors"
      >
        <div className="flex items-center gap-2 text-left">
          <span className="text-xs text-gray-300 font-medium">
            <span className="font-bold text-white tabular-nums">{participatedCount}</span>
            <span className="font-bold text-white tabular-nums">/{total}</span>
            <span className="ml-1.5">já {labelPlural}</span>
          </span>
          {missingCount > 0 && (
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">
              · {missingCount} {missingCount === 1 ? 'falta' : 'faltam'}
            </span>
          )}
        </div>
        {missingCount > 0 && (
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Lista de faltantes (expandida) */}
      {isOpen && missingCount > 0 && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-700/30">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1.5">
            Ainda não {labelPlural}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((u) => (
              <span
                key={u.id}
                className="text-xs px-2 py-1 rounded bg-gray-900/60 border border-gray-700/40 text-gray-400"
              >
                {u.display_name?.split('@')[0]}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}