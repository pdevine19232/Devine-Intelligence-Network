import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({
      email, password
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={s.container}>
      <div style={s.card}>
        <h1 style={s.title}>Devine Intelligence Network</h1>
        <p style={s.subtitle}>Sign in to access your agents</p>
        <form onSubmit={handleLogin}>
          <div style={s.group}>
            <label style={s.label}>Email</label>
            <input style={s.input} type="email" value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@yourfirm.com" required />
          </div>
          <div style={s.group}>
            <label style={s.label}>Password</label>
            <input style={s.input} type="password" value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required />
          </div>
          {error && <p style={s.error}>{error}</p>}
          <button style={s.button} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

const s = {
  container: { minHeight: '100vh', backgroundColor: '#0f0f1a',
    display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: '#1a1a2e', padding: '48px', borderRadius: '12px',
    width: '100%', maxWidth: '400px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)' },
  title: { color: '#ffffff', fontSize: '24px', fontWeight: '700',
    marginBottom: '8px', textAlign: 'center', fontFamily: 'Arial' },
  subtitle: { color: '#8888aa', fontSize: '14px', textAlign: 'center',
    marginBottom: '32px', fontFamily: 'Arial' },
  group: { marginBottom: '20px' },
  label: { display: 'block', color: '#aaaacc', fontSize: '13px',
    marginBottom: '6px', fontFamily: 'Arial' },
  input: { width: '100%', padding: '12px', backgroundColor: '#0f0f1a',
    border: '1px solid #2a2a4a', borderRadius: '8px', color: '#ffffff',
    fontSize: '14px', boxSizing: 'border-box', fontFamily: 'Arial' },
  button: { width: '100%', padding: '14px', backgroundColor: '#4f46e5',
    color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '15px',
    fontWeight: '600', cursor: 'pointer', marginTop: '8px',
    fontFamily: 'Arial' },
  error: { color: '#ff6b6b', fontSize: '13px', marginBottom: '12px',
    fontFamily: 'Arial' }
}