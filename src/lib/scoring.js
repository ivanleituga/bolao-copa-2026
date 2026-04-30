// ============================================================
// Bolão Copa 2026 - Helpers de exibição de pontuação
// ============================================================
// A lógica de cálculo fica no banco (função calc_prediction_points).
// Este arquivo só formata a exibição no frontend.
//
// Pontuação base (antes do multiplicador):
//   15 = Cravou
//   11 = V + Diferença de gols
//    9 = V + Gols de um time (ou empate não-exato com gols, ver abaixo)
//    7 = Apenas o vencedor OU empate não-exato
//    2 = Palpite estimulado
//    0 = Errou
//
// Nota: 7 e 9 podem aparecer em contextos diferentes (vencedor vs empate),
// por isso o getPointsLabel recebe os placares pra desambiguar.
// ============================================================

/**
 * Descrição legível do tipo de acerto.
 * Precisa dos placares pra diferenciar casos com mesma pontuação
 * (ex: empate não-exato = 7 vs apenas vencedor = 7).
 * Isso NÃO é cálculo de pontos — é só categorização pra exibição.
 */
export function getPointsLabel(points, multiplier = 1, predHome, predAway) {
  const base = multiplier > 0 ? points / multiplier : points
  const predDraw = predHome === predAway

  if (base === 15) return 'Cravou'
  if (base === 11) return 'V + Diferença de gols'
  if (base === 9) return 'V + Gols de um time'
  if (base === 7) return predDraw ? 'Apenas o empate' : 'Apenas o vencedor'
  if (base === 2) return 'Palpite estimulado'
  if (base === 0) return 'Errou'
  return ''
}

/**
 * Cor CSS baseada na faixa de pontuação.
 * Cravada (15) é destaque verde. Acertos parciais (7-11) azul.
 * Estimulado (2) cinza. Errou (0) vermelho.
 */
export function getPointsColor(points, multiplier = 1) {
  const base = multiplier > 0 ? points / multiplier : points

  if (base === 15) return 'text-green-400'
  if (base >= 7) return 'text-blue-400'
  if (base === 2) return 'text-gray-400'
  return 'text-red-400'
}

/**
 * Multiplicadores por fase (espelho do banco, pra exibir na UI)
 */
export const MULTIPLIERS = {
  group: 1,
  round_of_32: 2,
  round_of_16: 3,
  quarter: 4,
  semi: 5,
  third_place: 5,
  final: 6,
}

export function getRoundLabel(round) {
  const labels = {
    group: 'Grupos',
    round_of_32: '16 avos',
    round_of_16: 'Oitavas',
    quarter: 'Quartas',
    semi: 'Semifinal',
    third_place: '3º lugar',
    final: 'Final',
  }
  return labels[round] ?? round
}