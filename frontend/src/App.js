import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AdminPanel from './pages/AdminPanel'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    )
    return () => subscription.unsubscribe()
  }, [])

  const isAdmin = session?.user?.user_metadata?.role === 'admin'

  if (loading) return <div style={{
    minHeight: '100vh', background: '#0f0f1a',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: '#fff',
    fontFamily: 'Arial'
  }}>Loading...</div>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"
          element={!session ? <Login /> : <Navigate to="/dashboard" />}
        />
        <Route path="/dashboard"
          element={session
            ? <Dashboard session={session} isAdmin={isAdmin} />
            : <Navigate to="/login" />}
        />
        <Route path="/admin"
          element={session && isAdmin
            ? <AdminPanel session={session} />
            : <Navigate to="/dashboard" />}
        />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App