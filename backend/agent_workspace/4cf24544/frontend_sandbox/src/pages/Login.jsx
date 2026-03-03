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
        <div style={s.cardHeader}>
          <div style={s.eyebrow}>Secure Access</div>
          <div style={s.title}>Devine Intelligence Network</div>
          <div style={s.subtitle}>Sign in to access your agents</div>
        </div>
        <form onSubmit={handleLogin}>
          <div style={s.group}>
            <label style={s.label}>Email</label>
            <input
              style={s.input}
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@yourfirm.com"
              required
            />
          </div>
          <div style={s.group}>
            <label style={s.label}>Password</label>
            <input
              style={s.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <div style={s.error}>{error}</div>}
          <button style={s.button} type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <div style={s.footer}>
          Access is restricted to authorized personnel only.
        </div>
      </div>
    </div>
  )
}

const s = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#faf9f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  card: {
    backgroundColor: '#fff',
    border: '1px solid #e8e4dc',
    padding: '48px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 4px 40px rgba(0,0,0,0.06)',
  },
  cardHeader: {
    marginBottom: '32px',
  },
  eyebrow: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '9px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#c8c4bc',
    marginBottom: '10px',
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a18',
    letterSpacing: '-0.01em',
    lineHeight: '1.2',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#8a8880',
    lineHeight: '1.5',
  },
  group: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#8a8880',
    marginBottom: '8px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    backgroundColor: '#faf9f6',
    border: '1px solid #e8e4dc',
    color: '#1a1a18',
    fontSize: '14px',
    boxSizing: 'border-box',
    fontFamily: "'DM Sans', Arial, sans-serif",
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '13px',
    backgroundColor: '#1a1a18',
    color: '#faf9f6',
    border: 'none',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: '8px',
    fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: '0.04em',
  },
  error: {
    fontSize: '12px',
    color: '#c0341a',
    marginBottom: '16px',
    padding: '10px 14px',
    background: 'rgba(192,52,26,0.06)',
    border: '1px solid rgba(192,52,26,0.15)',
  },
  footer: {
    marginTop: '24px',
    fontSize: '11px',
    color: '#c8c4bc',
    textAlign: 'center',
    lineHeight: '1.6',
  },
}