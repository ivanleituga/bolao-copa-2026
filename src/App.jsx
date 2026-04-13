import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Groups from './pages/Groups'

function Layout({ user, profile, children }) {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700/50 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚽</span>
            <h1 className="text-base font-bold text-white tracking-tight">
              Bolão Copa 2026
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
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-red-400 transition-colors 
                        bg-gray-700/50 px-2.5 py-1.5 rounded-lg"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo */}
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
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent 
                       rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <Login onLogin={() => {}} />
  }

  return (
    <Layout user={session.user} profile={profile}>
      <Groups />
    </Layout>
  )
}