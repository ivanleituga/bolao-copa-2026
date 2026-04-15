import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Groups from './pages/Groups'
import Standings from './pages/Standings'

const tabs = [
  { id: 'groups', label: 'Tabela e Palpites' },
  { id: 'standings', label: 'Classificação' },
  { id: 'rules', label: 'Regulamento' },
]

function Placeholder({ title }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <p className="text-gray-500 text-lg mb-1">🚧</p>
        <p className="text-gray-400 text-sm font-medium">{title}</p>
        <p className="text-gray-600 text-xs mt-1">Em construção</p>
      </div>
    </div>
  )
}

function Layout({ user, profile, children }) {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚽</span>
            <h1 className="text-base font-bold text-white tracking-tight">
              Bolão "Os Gôsa" - Copa 2026
            </h1>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <p className="text-xs text-white font-medium leading-tight">
                {profile?.display_name?.split('@')[0] || user.email?.split('@')[0]}
              </p>
              {profile?.is_admin && (
                <span className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wider">
                  Admin
                </span>
              )}
            </div>
            <button onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors 
                        bg-gray-700/50 px-2.5 py-1.5 rounded-lg">
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-4">
        {children}
      </main>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('groups')

  useEffect(() => {
    const fetchProfile = async (userId) => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      setProfile(data)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session) {
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <Login onLogin={() => {}} />
  }

  return (
    <Layout user={session.user} profile={profile}>
      {/* Tabs de navegação */}
      <div className="flex border-b border-gray-700/50 mb-4">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 text-sm font-semibold text-center transition-colors
                       ${activeTab === tab.id
                         ? 'text-green-400 border-b-2 border-green-400'
                         : 'text-gray-500 hover:text-gray-300'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Conteúdo da aba ativa */}
      {activeTab === 'groups' && <Groups userId={session.user.id} />}
      {activeTab === 'standings' && <Standings userId={session.user.id} />}
      {activeTab === 'rules' && <Placeholder title="Regulamento do Bolão" />}
    </Layout>
  )
}