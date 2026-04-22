// ============================================================
// Helpers de formatação de tempo — usados pelo MatchCard e pelo
// SpecialPredictions. São funções puras que recebem timestamps
// (em ms ou ISO string) e retornam strings pra exibir.
// ============================================================

/**
 * Formata o tempo restante até um deadline.
 * - Mais de 1 dia: "3d 2h"
 * - Mais de 1 hora: "2h 15min"
 * - Mais de 10 min: "25min"
 * - Menos de 10 min: "5min 30s" (mostra segundos pra dar sensação de urgência)
 * - Deadline passado: null
 */
export function formatCountdown(ms) {
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

/**
 * Cor CSS do countdown baseada em urgência:
 * - Últimos 10 min: vermelho
 * - Última hora: amarelo
 * - Mais distante: cinza
 */
export function countdownColor(ms) {
  if (ms <= 600000) return 'text-red-400'
  if (ms <= 3600000) return 'text-yellow-400'
  return 'text-gray-400'
}

/**
 * Formata o timestamp de quando um palpite foi salvo. Ex: "10/06 • 14:35"
 */
export function formatSavedTime(iso) {
  const d = new Date(iso)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm} • ${hh}:${min}`
}