import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import UserPredictionsModal from '../components/UserPredictionsModal'

/* ═══════════════════════════════════════════════════
   Configuração visual de cada zona
   ═══════════════════════════════════════════════════ */

const TIER_CONFIG = {
  gold: {
    cardBg: 'bg-gradient-to-r from-yellow-500/[0.12] via-yellow-500/[0.06] to-transparent',
    barFrom: '#fbbf24',
    barTo: '#f59e0b',
    glow: 'shadow-[0_0_24px_-4px_rgba(234,179,8,0.35)]',
    posColor: 'text-yellow-300',
    ptsColor: 'text-yellow-300',
    ringColor: 'ring-yellow-500/30',
    tag: 'LÍDER',
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
  bottom: {
    cardBg: 'bg-gradient-to-r from-red-700/[0.30] via-red-700/[0.15] to-red-900/[0.05]',
    barFrom: '#7f1d1d',
    barTo: '#000000',
    glow: 'shadow-[0_0_28px_-3px_rgba(220,38,38,0.55)]',
    posColor: 'text-red-300',
    ptsColor: 'text-red-200',
    ringColor: 'ring-red-600/50',
    tag: 'LANTERNA',
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
   Stat chip
   ═══════════════════════════════════════════════════ */

function StatChip({ icon, value, label, activeColor }) {
  const hasValue = value !== 0 && value !== '0' && value !== '+0'
  const contentColor = hasValue ? activeColor : 'text-gray-500'

  return (
    <div className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2 py-1 rounded-md
      bg-gray-900/60 border border-gray-700/50 whitespace-nowrap">
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
   Elevador
   ═══════════════════════════════════════════════════ */

function MovementBadge({ movement }) {
  if (movement > 0) {
    return (
      <span
        className="mt-1 inline-flex items-center justify-center gap-0.5
          text-[10px] font-black tabular-nums leading-none text-green-400"
        title={`Subiu ${movement} posição${movement === 1 ? '' : 'ões'}`}
      >
        <span>▲</span>
        <span>{movement}</span>
      </span>
    )
  }

  if (movement < 0) {
    const abs = Math.abs(movement)
    return (
      <span
        className="mt-1 inline-flex items-center justify-center gap-0.5
          text-[10px] font-black tabular-nums leading-none text-red-400"
        title={`Caiu ${abs} posição${abs === 1 ? '' : 'ões'}`}
      >
        <span>▼</span>
        <span>{abs}</span>
      </span>
    )
  }

  return (
    <span
      className="mt-1 inline-flex items-center justify-center gap-0.5
        text-[10px] font-black tabular-nums leading-none text-gray-500"
      title="Sem variação"
    >
      <span>■</span>
      <span>0</span>
    </span>
  )
}

/* ═══════════════════════════════════════════════════
   Subcomponentes compartilhados pra evitar duplicação
   ═══════════════════════════════════════════════════ */

function NameAndTags({ player, isMe, tier, nameSize }) {
  return (
    <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
      <span
        className={`truncate font-bold leading-tight min-w-0
          ${nameSize}
          ${isMe ? 'text-green-300' : 'text-white'}`}
      >
        {player.display_name?.split('@')[0]}
      </span>

      <div className="flex items-center gap-1.5 md:gap-2 flex-wrap md:flex-nowrap">
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
  )
}

function ChipsRow({ cravadas, acertos, specials }) {
  return (
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
  )
}

function PositionNumber({ position, tier, positionSize, movement }) {
  return (
    <div className="flex-shrink-0 w-8 md:w-10 flex flex-col items-center justify-center">
      <span
        className={`font-black tabular-nums leading-none ${tier.posColor} ${positionSize}`}
      >
        {position}
      </span>
      <MovementBadge movement={movement} />
    </div>
  )
}

function PointsBlock({ points, tier, ptsSize, marginTop }) {
  return (
    <div className="flex-shrink-0 text-right">
      <div
        className={`font-black tabular-nums leading-none ${ptsSize} ${tier.ptsColor}`}
      >
        {points}
      </div>
      <div className={`text-[9px] text-gray-500 uppercase tracking-widest ${marginTop} font-bold`}>
        pts
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════
   PlayerCard — layout adaptativo claramente separado

   Mobile (<md): bloco com 2 linhas
     Linha 1: posição + nome+tags + PTS
     Linha 2: chips full width

   Desktop (≥md): bloco com 3 colunas horizontais
     Coluna 1: posição
     Coluna 2: nome+tags (cima) + chips (baixo)
     Coluna 3: PTS
   ═══════════════════════════════════════════════════ */

function PlayerCard({ player, position, isMe, total, onClick }) {
  const tierKey = getTier(position, total)
  const tier = TIER_CONFIG[tierKey]
  const isPodium = position <= 3
  const isLast = position === total
  const isEmphasized = isPodium || isLast

  const cardPadding = isEmphasized ? 'p-4 md:p-5' : 'p-3 md:p-4'
  const positionSize = isEmphasized ? 'text-2xl md:text-3xl' : 'text-xl'
  const ptsSize = isEmphasized ? 'text-4xl md:text-5xl' : 'text-2xl md:text-3xl'
  const nameSize = isEmphasized ? 'text-base md:text-lg' : 'text-sm md:text-base'

  const cravadas = player.cravadas ?? 0
  const acertos = player.total_acertos ?? 0
  const specials = player.special_points ?? 0
  const movement = player.elevator_movement ?? 0

  return (
    <div className="relative">
      {isMe && (
        <div className="absolute -inset-px rounded-xl bg-gradient-to-r from-green-500/40 via-emerald-500/20 to-green-500/40 blur-[2px] opacity-70" />
      )}

      <div
        onClick={onClick}
        className={`relative overflow-hidden rounded-xl
          bg-gray-800/80
          ${tier.cardBg}
          ${tier.glow}
          ${isMe ? 'ring-2 ring-green-500/60' : tier.ringColor ? `ring-1 ${tier.ringColor}` : ''}
          transition-all duration-200
          cursor-pointer hover:bg-gray-700/40
          ${cardPadding}
        `}
      >
        {/* Barra lateral */}
        <div
          className="absolute top-0 left-0 bottom-0 w-1.5"
          style={{
            background: `linear-gradient(to bottom, ${tier.barFrom}, ${tier.barTo})`,
          }}
        />

        <div className="relative pl-4">

          {/* ═══ LAYOUT MOBILE (só renderiza em <md) ═══ */}
          <div className="md:hidden flex flex-col gap-2.5">
            {/* Linha 1: posição + nome+tags + PTS */}
            <div className="flex items-center gap-3">
              <PositionNumber
                position={position}
                tier={tier}
                positionSize={positionSize}
                movement={movement}
              />
              <NameAndTags player={player} isMe={isMe} tier={tier} nameSize={nameSize} />
              <PointsBlock points={player.total_points} tier={tier} ptsSize={ptsSize} marginTop="mt-0.5" />
            </div>
            {/* Linha 2: chips */}
            <ChipsRow cravadas={cravadas} acertos={acertos} specials={specials} />
          </div>

          {/* ═══ LAYOUT DESKTOP (só renderiza em ≥md) ═══ */}
          <div className="hidden md:flex md:items-center md:gap-4">
            <PositionNumber
              position={position}
              tier={tier}
              positionSize={positionSize}
              movement={movement}
            />
            <div className="flex-1 min-w-0 flex flex-col gap-2.5">
              <NameAndTags player={player} isMe={isMe} tier={tier} nameSize={nameSize} />
              <ChipsRow cravadas={cravadas} acertos={acertos} specials={specials} />
            </div>
            <PointsBlock points={player.total_points} tier={tier} ptsSize={ptsSize} marginTop="mt-1" />
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
  const [allTeams, setAllTeams] = useState([])
  const [specialDeadline, setSpecialDeadline] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedUserId, setSelectedUserId] = useState(null)

  useEffect(() => {
    const fetchAll = async () => {
      const [rankingRes, baselineRes, teamsRes, questionsRes] = await Promise.all([
        supabase.from('ranking').select('*'),
        supabase.from('ranking_elevator_baseline').select('*'),
        supabase.from('teams').select('id, name, code'),
        supabase.from('special_questions').select('deadline'),
      ])

      if (rankingRes.error) {
        console.error('Erro ao buscar ranking:', rankingRes.error)
        setLoading(false)
        return
      }

      if (baselineRes.error) {
        console.error('Erro ao buscar baseline do elevador:', baselineRes.error)
      }

      const baselineRows = baselineRes.data || []
      const baselineByProfile = {}
      baselineRows.forEach((row) => {
        baselineByProfile[row.profile_id] = row
      })

      // Mostra movimentação apenas quando AMBOS os lados têm pontos:
      // - baseline com pontos (ranking de referência válido)
      // - ranking atual com pontos (alguém já marcou algo)
      // Se qualquer um dos dois está zerado, UI mostra ■ 0 pra todos.
      // Isso cobre: pré-Copa (ambos zerados), e o momento em que você
      // limpa predictions pra começar a Copa oficial (baseline ainda tem
      // pontos dos testes, mas ranking atual zerou).
      const baselineHasPoints = baselineRows.some((row) =>
        (row.baseline_total_points ?? 0) > 0 ||
        (row.baseline_cravadas ?? 0) > 0 ||
        (row.baseline_total_acertos ?? 0) > 0 ||
        (row.baseline_special_points ?? 0) > 0
      )
      const currentRankingHasPoints = (rankingRes.data || []).some((row) =>
        (row.total_points ?? 0) > 0 ||
        (row.cravadas ?? 0) > 0 ||
        (row.total_acertos ?? 0) > 0 ||
        (row.special_points ?? 0) > 0
      )
      const baselineIsMeaningful = baselineHasPoints && currentRankingHasPoints

      const sorted = (rankingRes.data || []).sort((a, b) => {
        if (b.total_points !== a.total_points) return b.total_points - a.total_points
        if (b.cravadas !== a.cravadas) return b.cravadas - a.cravadas
        if (b.total_acertos !== a.total_acertos) return b.total_acertos - a.total_acertos
        return (a.display_name || '').localeCompare(b.display_name || '', 'pt-BR', {
          sensitivity: 'base',
        })
      })

      const withElevator = sorted.map((player, idx) => {
        const currentPosition = idx + 1
        const baseline = baselineByProfile[player.profile_id]

        const movement =
          baselineIsMeaningful && baseline
            ? baseline.baseline_position - currentPosition
            : 0

        return {
          ...player,
          elevator_movement: movement,
        }
      })

      setRanking(withElevator)
      setAllTeams(teamsRes.data || [])

      const deadlines = (questionsRes.data || [])
        .map((q) => q.deadline)
        .filter(Boolean)
      if (deadlines.length > 0) {
        const minDeadline = deadlines.reduce((min, d) =>
          new Date(d) < new Date(min) ? d : min
        )
        setSpecialDeadline(minDeadline)
      }

      setLoading(false)
    }

    fetchAll()
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
              onClick={() => setSelectedUserId(player.profile_id)}
            />
          )
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-800/60">
        <p className="text-center text-[10px] text-gray-600 uppercase tracking-widest mb-2 font-bold">
          Zonas do ranking
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5 justify-center text-[10px] uppercase tracking-wider">
          <LegendItem barColor="#fbbf24" label="Líder" />
          <LegendItem barColor="#94a3b8" label="Vice" />
          <LegendItem barColor="#b45309" label="3º" />
          <LegendItem barColor="#3b82f6" label="Libertadores (4-8)" />
          <LegendItem barColor="#ef4444" label="Rebaixamento" />
          <LegendItem barColor="#000000" label="Lanterna" />
        </div>
      </div>

      {selectedUserId && (
        <UserPredictionsModal
          userId={selectedUserId}
          currentUserId={userId}
          allTeams={allTeams}
          specialDeadline={specialDeadline}
          onClose={() => setSelectedUserId(null)}
        />
      )}
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