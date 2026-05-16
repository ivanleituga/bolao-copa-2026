// ============================================================
// Bolão Copa 2026 - Helpers de mata-mata
// ============================================================
// Funções compartilhadas entre KnockoutBracket (visualização) e
// AdminKnockoutCard (edição). Centraliza a lógica de identificação
// de partida pelo placeholder (M73, M89, etc).
//
// O número da partida é o oficial FIFA (73-104 pra mata-mata).
// Identificação é feita pelo par de placeholders (home × away)
// — ex: "1E×3ABCDF" = M74 = jogo entre 1º colocado do grupo E e
// melhor 3º entre A/B/C/D/F.
// ============================================================

/**
 * Mapa placeholder → número da partida (sem prefixo "M").
 * Cobre 16 avos, oitavas, quartas e semis. Para third_place
 * e final, o número é derivado do round (ver getKnockoutMatchNumber).
 */
const PLACEHOLDER_TO_NUMBER = {
  // round_of_32 (M73-M88)
  '2A×2B': '73',
  '1E×3ABCDF': '74',
  '1F×2C': '75',
  '1C×2F': '76',
  '1I×3CDFGH': '77',
  '2E×2I': '78',
  '1A×3CEFHI': '79',
  '1L×3EHIJK': '80',
  '1D×3BEFIJ': '81',
  '1G×3AEHIJ': '82',
  '2K×2L': '83',
  '1H×2J': '84',
  '1B×3EFGIJ': '85',
  '1J×2H': '86',
  '1K×3DEIJL': '87',
  '2D×2G': '88',

  // round_of_16 (M89-M96)
  'W74×W77': '89',
  'W73×W75': '90',
  'W76×W78': '91',
  'W79×W80': '92',
  'W83×W84': '93',
  'W81×W82': '94',
  'W86×W88': '95',
  'W85×W87': '96',

  // quarter (M97-M100)
  'W89×W90': '97',
  'W93×W94': '98',
  'W91×W92': '99',
  'W95×W96': '100',

  // semi (M101-M102)
  'W97×W98': '101',
  'W99×W100': '102',
}

/**
 * Retorna o número oficial FIFA da partida de mata-mata (string sem prefixo "M").
 *
 * Para 16 avos, oitavas, quartas e semis: identifica pelo par de
 * placeholders do confronto.
 *
 * Para third_place e final: usa o `round` diretamente (são únicos no
 * torneio, não precisam de lookup por placeholder).
 *
 * Retorna null se o match não for de mata-mata ou se os placeholders
 * não baterem com nenhum confronto conhecido.
 *
 * Exemplo: match com placeholders "1E" e "3ABCDF" → "74"
 *          match com round = "final" → "104"
 *          match com round = "group" → null
 *
 * @param {Object} match - match com `round`, `home_placeholder`, `away_placeholder`
 * @returns {string | null} número da partida (sem prefixo "M") ou null
 */
export function getKnockoutMatchNumber(match) {
  if (!match) return null

  if (match.round === 'third_place') return '103'
  if (match.round === 'final') return '104'

  const key = `${match.home_placeholder}×${match.away_placeholder}`
  return PLACEHOLDER_TO_NUMBER[key] ?? null
}

/**
 * Variante que retorna com prefixo "M" (M74, M89, etc).
 * Útil quando o número é usado como key/lookup interno do bracket.
 */
export function getKnockoutMatchKey(match) {
  const num = getKnockoutMatchNumber(match)
  return num ? `M${num}` : null
}