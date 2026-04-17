import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Medal({ position, total }) {
  if (position === 1) return <span className="text-lg">🥇</span>
  if (position === 2) return <span className="text-lg">🥈</span>
  if (position === 3) return <span className="text-lg">🥉</span>
  if (position === total) return <span className="text-lg">🤡</span>
  return (
    <span className="text-gray-500 text-sm font-mono w-6 text-center">
      {position}
    </span>
  )
}

function getTierStyle(position, total) {
  // Pódio
  if (position === 1) return { bg: 'bg-yellow-500/20', border: 'border-l-yellow-400', style: {} }
  if (position === 2) return { bg: 'bg-gray-300/15', border: 'border-l-gray-300', style: {} }
  if (position === 3) return { bg: 'bg-amber-600/15', border: 'border-l-amber-600', style: {} }

  // Zona de "classificação" (4º ao 8º)
  if (position >= 4 && position <= 8) return { bg: 'bg-blue-500/8', border: 'border-l-blue-500/70', style: {} }

  // Zona de rebaixamento — último colocado com barra preta via inline style
  if (position === total) return { bg: 'bg-red-500/25', border: '', style: { borderLeftWidth: '3px', borderLeftColor: '#000' } }
  if (position >= total - 3) return { bg: 'bg-red-500/6', border: 'border-l-red-500/50', style: {} }

  // Meio da tabela
  return { bg: '', border: 'border-l-transparent', style: {} }
}

export default function Standings({ userId }) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRanking = async () => {
      const { data, error } = await supabase
        .from('ranking')
        .select('*')

      if (error) {
        console.error('Erro ao buscar ranking:', error)
        setLoading(false)
        return
      }

      const sorted = (data || []).sort((a, b) => {
        if (b.total_points !== a.total_points) return b.total_points - a.total_points
        if (b.cravadas !== a.cravadas) return b.cravadas - a.cravadas
        return b.total_acertos - a.total_acertos
      })

      setRanking(sorted)
      setLoading(false)
    }

    fetchRanking()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Carregando classificação...</p>
        </div>
      </div>
    )
  }

  if (ranking.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-500 text-sm">Nenhum resultado disponível ainda.</p>
      </div>
    )
  }

  const total = ranking.length

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-px flex-1 bg-gray-700/50" />
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Classificação Geral
        </h2>
        <div className="h-px flex-1 bg-gray-700/50" />
      </div>

      <div className="bg-gray-800/80 rounded-xl border border-gray-700/40 overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <div style={{ minWidth: 520 }}>
            {/* Cabeçalho */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 px-4 py-3 border-b border-gray-700/50">
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold w-8 text-center">
                #
              </span>
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                Participante
              </span>
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold text-center w-16">
                Pts
              </span>
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold text-center w-16">
                Cravadas
              </span>
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold text-center w-16">
                Acertos
              </span>
              <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold text-center w-16">
                Especiais
              </span>
            </div>

            {/* Linhas do ranking */}
            {ranking.map((player, idx) => {
              const position = idx + 1
              const isMe = player.profile_id === userId
              const tier = getTierStyle(position, total)

              return (
                <div
                  key={player.profile_id}
                  className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-x-4 px-4 py-3.5
                    items-center border-b border-gray-800/60 last:border-0
                    border-l-2 ${tier.border} ${tier.bg}`}
                  style={tier.style}
                >
                  {/* Posição */}
                  <div className="w-8 flex justify-center">
                    <Medal position={position} total={total} />
                  </div>

                  {/* Nome */}
                  <div className="min-w-0">
                    <span className={`text-base font-medium truncate block
                      ${isMe ? 'text-green-400' : 'text-white'}`}>
                      {player.display_name?.split('@')[0]}
                    </span>
                    {isMe && (
                      <span className="text-[10px] text-green-500/70 uppercase tracking-wider">
                        Você
                      </span>
                    )}
                  </div>

                  {/* Pontos */}
                  <div className="w-16 text-center">
                    <span className={`text-lg font-bold
                      ${position === 1 ? 'text-yellow-400' : 'text-white'}`}>
                      {player.total_points}
                    </span>
                  </div>

                  {/* Cravadas */}
                  <div className="w-16 text-center">
                    <span className="text-sm text-yellow-400 font-mono">
                      {player.cravadas}
                    </span>
                  </div>

                  {/* Acertos */}
                  <div className="w-16 text-center">
                    <span className="text-sm text-gray-400 font-mono">
                      {player.total_acertos}
                    </span>
                  </div>

                  {/* Especiais */}
                  <div className="w-16 text-center">
                    <span className={`text-sm font-mono ${
                      player.special_points > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      +{player.special_points ?? 0}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 justify-center text-[10px] text-gray-600 uppercase tracking-wider">
        <span>Pts = Pontos totais</span>
        <span>Cravadas = Placares exatos</span>
        <span>Acertos = Palpites com pontos</span>
        <span>Especiais = Campeão + Artilheiro</span>
      </div>
    </div>
  )
}