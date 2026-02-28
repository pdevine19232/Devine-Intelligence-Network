import { supabase } from '../supabaseClient'

export default function AdminPanel({ session }) {
  return (
    <div style={s.container}>
      <div style={s.header}>
        <h1 style={s.title}>Admin Panel</h1>
        <button style={s.backBtn}
          onClick={() => window.location.href='/dashboard'}>
          ← Back to Dashboard
        </button>
      </div>
      <div style={s.grid}>
        <div style={s.card}>
          <div style={s.cardIcon}>⚙️</div>
          <div style={s.cardTitle}>Agent Configuration</div>
          <div style={s.cardDesc}>
            Edit agent system prompts, adjust behaviour, and 
            configure data sources without touching code.
          </div>
          <div style={s.comingSoon}>Available Week 4</div>
        </div>
        <div style={s.card}>
          <div style={s.cardIcon}>👥</div>
          <div style={s.cardTitle}>User Management</div>
          <div style={s.cardDesc}>
            Invite colleagues via email, assign roles, 
            and revoke access instantly.
          </div>
          <div style={s.comingSoon}>Available Week 4</div>
        </div>
        <div style={s.card}>
          <div style={s.cardIcon}>📋</div>
          <div style={s.cardTitle}>Activity Logs</div>
          <div style={s.cardDesc}>
            See who is using the platform, which agents 
            are being called, and when.
          </div>
          <div style={s.comingSoon}>Available Week 4</div>
        </div>
      </div>
    </div>
  )
}

const s = {
  container: { minHeight: '100vh', backgroundColor: '#0f0f1a',
    color: '#ffffff', padding: '40px', fontFamily: 'Arial' },
  header: { display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '36px' },
  title: { fontSize: '22px', fontWeight: '700' },
  backBtn: { background: 'transparent',
    border: '1px solid #2a2a4a', color: '#8888aa',
    padding: '9px 18px', borderRadius: '8px',
    cursor: 'pointer', fontSize: '13px' },
  grid: { display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '16px' },
  card: { background: '#1a1a2e', padding: '28px',
    borderRadius: '12px', border: '1px solid #1e1e3a' },
  cardIcon: { fontSize: '28px', marginBottom: '14px' },
  cardTitle: { fontSize: '15px', fontWeight: '700',
    marginBottom: '10px' },
  cardDesc: { fontSize: '13px', color: '#8888aa',
    lineHeight: '1.6', marginBottom: '16px' },
  comingSoon: { fontSize: '11px', color: '#4f46e5',
    fontWeight: '600' },
}