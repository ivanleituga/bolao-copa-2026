import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getFlagUrl } from '../lib/flags'

function TeamFlag({ code, size = 22 }) {
  const url = getFlagUrl(code, 80)
  if (!url) return <span className="inline-block rounded bg-gray-600" style={{ width: size, height: size * 0.67 }} />
  return (
    <img src={url} alt={code} className="inline-block rounded-sm object-cover"
      style={{ width: size, height: size * 0.67 }} loading="lazy" />
  )
}

function StatsTable({ teams }) {
  const statCols = ['P', 'J', 'V', 'E', 'D', 'GP', 'GC', 'SG']

  return (
    <div className="overflow-x-auto pr-3">
      <table className="w-full text-sm" style={{ minWidth: 380 }}>
        <thead>
          <tr className="border-b border-gray-700/50">
            <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium py-2 pl-3 w-6">#</th>
            <th className="text-left text-[11px] text-gray-500 uppercase tracking-wider font-medium py-2">Seleção</th>
            {statCols.map((col) => (
              <th key={col} className="text-center text-[11px] text-gray-500 uppercase tracking-wider font-medium py-2"
                style={{ width: 36 }}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {teams.map((team, idx) => (
            <tr key={team.id}
              className={`border-b border-gray-800/60 last:border-0
                         ${idx < 2 ? 'border-l-2 border-l-green-500/70' : 'border-l-2 border-l-transparent'}`}>
              <td className="py-2.5 pl-3 text-gray-500 text-xs text-center">{idx + 1}</td>
              <td className="py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <TeamFlag code={team.code} size={20} />
                  <span className="text-white text-sm font-medium truncate">{team.name}</span>
                </div>
              </td>
              {statCols.map((col, i) => (
                <td key={col} className={`py-2.5 text-center font-mono text-sm
                  ${i === 0 ? 'text-white font-semibold' : 'text-gray-400'}`}
                  style={{ width: 36 }}>0</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RoundTabs() {
  const [activeRound, setActiveRound] = useState(1)

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-gray-700/50">
        {[1, 2, 3].map((round) => (
          <button key={round} onClick={() => setActiveRound(round)}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider text-center transition-colors
                       ${activeRound === round
                         ? 'text-green-400 border-b-2 border-green-400'
                         : 'text-gray-500 hover:text-gray-300'}`}>
            {round}ª Rodada
          </button>
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center py-8">
        <p className="text-gray-600 text-xs uppercase tracking-wider">Jogos em breve</p>
      </div>
    </div>
  )
}

function GroupCard({ letter, teams }) {
  const [open, setOpen] = useState(true)

  return (
    <div className="bg-gray-800/80 rounded-xl overflow-hidden border border-gray-700/40">
      <button onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-700/30 transition-colors">
        <div className="flex items-center gap-2.5">
          <span className="bg-green-600 text-white text-xs font-bold w-7 h-7 rounded-lg 
                          flex items-center justify-center">{letter}</span>
          <span className="text-base font-semibold text-white tracking-wide">GRUPO {letter}</span>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="bg-gray-900/60 rounded-lg overflow-hidden lg:flex-1">
              <StatsTable teams={teams} />
            </div>
            <div className="bg-gray-900/60 rounded-lg overflow-hidden lg:w-96 min-h-[160px]">
              <RoundTabs />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Groups() {
  const [groups, setGroups] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTeams = async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('group_letter')
        .order('name')

      if (error) {
        console.error('Erro ao buscar seleções:', error)
        return
      }

      const grouped = {}
      data.forEach((team) => {
        if (!grouped[team.group_letter]) {
          grouped[team.group_letter] = []
        }
        grouped[team.group_letter].push(team)
      })

      setGroups(grouped)
      setLoading(false)
    }

    fetchTeams()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Carregando grupos...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="h-px flex-1 bg-gray-700/50" />
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Fase de Grupos</h2>
        <div className="h-px flex-1 bg-gray-700/50" />
      </div>

      <div className="space-y-3">
        {Object.entries(groups).map(([letter, teams]) => (
          <GroupCard key={letter} letter={letter} teams={teams} />
        ))}
      </div>
    </div>
  )
}