import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/* ═══════════════════════════════════════════════════
   Configuração visual de cada zona
   ═══════════════════════════════════════════════════ */

const TIER_CONFIG = {
  // Pódio — tratamento premium com gradientes
  gold: {
    cardBg: 'bg-gradient-to-r from-yellow-500/[0.12] via-yellow-500/[0.06] to-transparent',
    barFrom: '#fbbf24',
    barTo: '#f59e0b',
    glow: 'shadow-[0_0_24px_-4px_rgba(234,179,8,0.35)]',
    posColor: 'text-yellow-300',
    ptsColor: 'text-yellow-300',
    ringColor: 'ring-yellow-500/30',
    tag: 'CAMPEÃO',
    tagBg: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  },
  silver: {
    cardBg: 'bg-gradient-to-r from-slate-300/[0.22] via-slate-300/[0.10] to-transparent',
    barFrom: '#f1f5f9',
    barTo: '#94a3b8',
    glow: 'shadow-[0_0_26px_-4px_rgba(203,213,225,0.45)]',
    posColor: 'text-slate-100',
    ptsColor: 'text-slate-50',
    ringColor: 'ring-slate-300/50',
    tag: 'VICE',
    tagBg: 'bg-slate-300/20 text-slate-100 border-slate-300/45',
  },
  bronze: {
    cardBg: 'bg-gradient-to-r from-amber-700/[0.12] via-amber-700/[0.05] to-transparent',
    barFrom: '#d97706',
    barTo: '#b45309',
    glow: 'shadow-[0_0_18px_-6px_rgba(180,83,9,0.30)]',
    posColor: 'text-amber-500',
    ptsColor: 'text-amber-400',
    ringColor: 'ring-amber-700/25',
    tag: '3º LUGAR',
    tagBg: 'bg-amber-700/15 text-amber-400 border-amber-700/30',
  },
  // Zona Libertadores (4-8)
  reward: {
    cardBg: 'bg-gradient-to-r from-blue-500/[0.08] to-transparent',
    barFrom: '#3b82f6',
    barTo: '#1d4ed8',
    glow: '',
    posColor: 'text-blue-400',
    ptsColor: 'text-white',
    ringColor: '',
    tag: 'LIBERTADORES',
    tagBg: 'bg-blue-500/10 text-blue-400 border-blue-500/25',
  },
  // Zona neutra (meio da tabela)
  neutral: {
    cardBg: '',
    barFrom: '#374151',
    barTo: '#1f2937',
    glow: '',
    posColor: 'text-gray-500',
    ptsColor: 'text-white',
    ringColor: '',
    tag: null,
    tagBg: '',
  },
  // Zona de rebaixamento (n-3 até n-1)
  loss: {
    cardBg: 'bg-gradient-to-r from-red-500/[0.07] to-transparent',
    barFrom: '#ef4444',
    barTo: '#b91c1c',
    glow: '',
    posColor: 'text-red-400/90',
    ptsColor: 'text-white',
    ringColor: '',
    tag: 'REBAIXAMENTO',
    tagBg: 'bg-red-500/10 text-red-400 border-red-500/25',
  },
  // Último colocado — ENEM 2027 (anti-pódio: tratamento premium reverso)
  bottom: {
    cardBg: 'bg-gradient-to-r from-red-700/[0.30] via-red-700/[0.15] to-red-900/[0.05]',
    barFrom: '#7f1d1d',
    barTo: '#000000',
    glow: 'shadow-[0_0_28px_-3px_rgba(220,38,38,0.55)]',
    posColor: 'text-red-300',
    ptsColor: 'text-red-200',
    ringColor: 'ring-red-600/50',
    tag: 'ENEM 2027',
    tagBg: 'bg-red-700/30 text-red-100 border-red-500/60',
  },
}

function getTier(position, total) {
  if (position === 1) return 'gold'
  if (position === 2) return 'silver'
  if (position === 3) return 'bronze'
  if (position >= 4 && position <= 8) return 'reward'
  if (position === total) return 'bottom'
  if (position >= total - 3) return 'loss'
  return 'neutral'
}

/* ═══════════════════════════════════════════════════
   Stat chip — pílula visual
   Background mais sólido (gray-900/60) pra contrastar com gradientes do card
   ═══════════════════════════════════════════════════ */

function StatChip({ icon, value, label, activeColor }) {
  const hasValue = value !== 0 && value !== '0' && value !== '+0'
  // Cor do conteúdo: ativa quando há valor, cinza-médio quando vazio (gray-500 em vez de gray-600)
  const contentColor = hasValue ? activeColor : 'text-gray-500'

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-900/60 border border-gray-700/50">
      <span className={`text-[10px] leading-none ${contentColor}`}>{icon}</span>
      <span className={`text-xs font-bold tabular-nums leading-none ${contentColor}`}>
        {value}
      </span>
      <span className="text-[9px] leading-none text-gray-400 uppercase tracking-wider">
        {label}
      </span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   PlayerCard — card individual do participante
   ═══════════════════════════════════════════════════ */

function PlayerCard({ player, position, isMe, total }) {
  const tierKey = getTier(position, total)
  const tier = TIER_CONFIG[tierKey]
  const isPodium = position <= 3
  const isLast = position === total

  const cardPadding = isPodium || isLast ? 'p-5' : 'p-4'
  const positionSize = isPodium || isLast ? 'text-3xl' : 'text-xl'
  const ptsSize = isPodium || isLast ? 'text-5xl' : 'text-3xl'
  const nameSize = isPodium || isLast ? 'text-lg' : 'text-base'

  const cravadas = player.cravadas ?? 0
  const acertos = player.total_acertos ?? 0
  const specials = player.special_points ?? 0

  return (
    <div className="relative">
      {/* Glow externo do card "você" */}
      {isMe && (
        <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-green-500/40 via-emerald-500/20 to-green-500/40 blur-[2px] opacity-70" />
      )}

      <div
        className={`relative overflow-hidden rounded-xl
          bg-gray-800/80
          ${tier.cardBg}
          ${tier.glow}
          ${isMe ? 'ring-2 ring-green-500/60' : tier.ringColor ? `ring-1 ${tier.ringColor}` : ''}
          transition-all duration-200
          hover:bg-gray-800
          ${cardPadding}
        `}
      >
        {/* Barra de energia lateral */}
        <div
          className="absolute top-0 left-0 bottom-0 w-1.5"
          style={{
            background: `linear-gradient(to bottom, ${tier.barFrom}, ${tier.barTo})`,
          }}
        />

        {/* Conteúdo */}
        <div className="relative pl-4 flex items-center gap-4">
          {/* Posição */}
          <div className="flex-shrink-0 w-10 flex items-center justify-center">
            <span
              className={`font-black tabular-nums leading-none ${tier.posColor} ${positionSize}`}
            >
              {position}
            </span>
          </div>

          {/* Bloco central: nome + chips */}
          <div className="flex-1 min-w-0 flex flex-col gap-2.5">
            {/* Linha 1: nome + tags
                items-center + leading-tight em todos: alinhamento perfeito
                gap-3: respiro entre nome e tags */}
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`truncate font-bold leading-tight min-w-0
                  ${nameSize}
                  ${isMe ? 'text-green-300' : 'text-white'}`}
              >
                {player.display_name?.split('@')[0]}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isMe && (
                  <span className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded
                    bg-green-500/15 text-green-300 border border-green-500/30 leading-tight whitespace-nowrap">
                    Você
                  </span>
                )}
                {tier.tag && (
                  <span
                    className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border leading-tight whitespace-nowrap
                      ${tier.tagBg}`}
                  >
                    {tier.tag}
                  </span>
                )}
              </div>
            </div>

            {/* Linha 2: chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatChip
                icon="◎"
                value={cravadas}
                label="cravadas"
                activeColor="text-yellow-400"
              />
              <StatChip
                icon="✓"
                value={acertos}
                label="acertos"
                activeColor="text-blue-300"
              />
              <StatChip
                icon="★"
                value={specials > 0 ? `+${specials}` : specials}
                label="especiais"
                activeColor="text-emerald-400"
              />
            </div>
          </div>

          {/* Pontos */}
          <div className="flex-shrink-0 text-right">
            <div
              className={`font-black tabular-nums leading-none ${ptsSize} ${tier.ptsColor}`}
            >
              {player.total_points}
            </div>
            <div className="text-[9px] text-gray-500 uppercase tracking-widest mt-1 font-bold">
              pts
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   Standings — componente principal
   ═══════════════════════════════════════════════════ */

export default function Standings({ userId }) {
  const [ranking, setRanking] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRanking = async () => {
      const { data, error } = await supabase.from('ranking').select('*')

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

      <div className="space-y-2.5">
        {ranking.map((player, idx) => {
          const position = idx + 1
          const isMe = player.profile_id === userId
          return (
            <PlayerCard
              key={player.profile_id}
              player={player}
              position={position}
              isMe={isMe}
              total={total}
            />
          )
        })}
      </div>

      {/* Legenda */}
      <div className="mt-6 pt-4 border-t border-gray-800/60">
        <p className="text-center text-[10px] text-gray-600 uppercase tracking-widest mb-2 font-bold">
          Zonas de premiação
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center text-[10px] uppercase tracking-wider">
          <LegendItem barColor="#fbbf24" label="Campeão" />
          <LegendItem barColor="#94a3b8" label="Vice" />
          <LegendItem barColor="#b45309" label="3º" />
          <LegendItem barColor="#3b82f6" label="Libertadores (4-8)" />
          <LegendItem barColor="#ef4444" label="Rebaixamento" />
          <LegendItem barColor="#000000" label="ENEM 2027" />
        </div>
      </div>
    </div>
  )
}

function LegendItem({ barColor, label }) {
  return (
    <div className="flex items-center gap-1.5 text-gray-500">
      <div
        className="w-1 h-3 rounded-full"
        style={{ backgroundColor: barColor }}
      />
      <span>{label}</span>
    </div>
  )
}