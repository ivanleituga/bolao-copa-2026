import { getFlagUrl } from '../lib/flags'

/**
 * Componente reutilizável de bandeira de seleção.
 *
 * Recebe o código FIFA (3 letras, ex: BRA, ARG) e renderiza a bandeira
 * via CDN flagcdn.com. Se o código não mapeia pra nenhuma bandeira
 * conhecida (ver src/lib/flags.js), renderiza um retângulo cinza como
 * fallback — mantém o layout estável mesmo em caso de código inválido.
 *
 * Props:
 *   code — string (FIFA code, ex: "BRA")
 *   size — altura em px (default: 22). Largura é calculada como 1.5× altura.
 */
export function TeamFlag({ code, size = 22 }) {
  const url = getFlagUrl(code, 80)
  if (!url) {
    return (
      <span
        className="inline-block rounded bg-gray-600"
        style={{ width: size, height: size * 0.67 }}
      />
    )
  }
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