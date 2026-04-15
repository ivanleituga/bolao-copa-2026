import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function Medal({ position }) {
  if (position === 1) return <span className="text-lg">🥇</span>
  if (position === 2) return <span className="text-lg">🥈</span>
  if (position === 3) return <span className="text-lg">🥉</span>
  return (
    <span className="text-gray-500 text-sm font-mono w-6 text-center">
      {position}
    </span>
  )
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

      // A view já vem ordenada, mas garantimos aqui também
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
        {/* Cabeçalho */}
        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 px-4 py-3 border-b border-gray-700/50">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold w-8 text-center">
            #
          </span>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
            Participante
          </span>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold text-center w-16">
            Pts
          </span>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold text-center w-16 hidden sm:block">
            Cravadas
          </span>
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold text-center w-16 hidden sm:block">
            Acertos
          </span>
        </div>

        {/* Linhas do ranking */}
        {ranking.map((player, idx) => {
          const position = idx + 1
          const isMe = player.profile_id === userId

          return (
            <div
              key={player.profile_id}
              className={`grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 px-4 py-3.5
                items-center border-b border-gray-800/60 last:border-0 transition-colors
                ${isMe ? 'bg-green-900/20 border-l-2 border-l-green-500' : ''}
                ${position <= 3 ? 'bg-gray-800/40' : ''}`}
            >
              {/* Posição */}
              <div className="w-8 flex justify-center">
                <Medal position={position} />
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
              <div className="w-16 text-center hidden sm:block">
                <span className="text-sm text-yellow-400 font-mono">
                  {player.cravadas}
                </span>
              </div>

              {/* Acertos */}
              <div className="w-16 text-center hidden sm:block">
                <span className="text-sm text-gray-400 font-mono">
                  {player.total_acertos}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Legenda */}
      <div className="mt-3 flex gap-4 justify-center text-[10px] text-gray-600 uppercase tracking-wider">
        <span>Pts = Pontos totais</span>
        <span className="hidden sm:inline">Cravadas = Placares exatos</span>
        <span className="hidden sm:inline">Acertos = Palpites com pontos</span>
      </div>
    </div>
  )
}