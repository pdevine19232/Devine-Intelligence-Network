import { useNavigate } from 'react-router-dom'

export default function AdminPanel({ session }) {
  const navigate = useNavigate()

  return (
    <div style={s.container}>
      <div style={s.topbar}>
        <div>
          <div style={s.eyebrow}>System</div>
          <div style={s.title}>Admin Panel</div>
        </div>
        <button style={s.backBtn} onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
      </div>

      <div style={s.sectionLabel}>Configuration</div>

      <div style={s.grid}>
        <div style={s.card}>
          <div style={s.cardNum}>01</div>
          <div style={s.cardTitle}>Agent Configuration</div>
          <div style={s.cardDesc}>
            Edit agent system prompts, adjust behaviour, and
            configure data sources without touching code.
          </div>
          <div style={s.comingSoon}>Available Week 4</div>
        </div>
        <div style={s.card}>
          <div style={s.cardNum}>02</div>
          <div style={s.cardTitle}>User Management</div>
          <div style={s.cardDesc}>
            Invite colleagues via email, assign roles,
            and revoke access instantly.
          </div>
          <div style={s.comingSoon}>Available Week 4</div>
        </div>
        <div style={s.card}>
          <div style={s.cardNum}>03</div>
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
  container: {
    minHeight: '100vh',
    backgroundColor: '#faf9f6',
    color: '#1a1a18',
    padding: '32px',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid #e8e4dc',
  },
  eyebrow: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '9px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#c8c4bc',
    marginBottom: '6px',
  },
  title: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#1a1a18',
    letterSpacing: '-0.02em',
  },
  backBtn: {
    background: 'transparent',
    border: '1px solid #e8e4dc',
    color: '#8a8880',
    padding: '9px 18px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: '0.02em',
  },
  sectionLabel: {
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#c8c4bc',
    marginBottom: '14px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
  },
  card: {
    background: '#fff',
    padding: '24px',
    border: '1px solid #e8e4dc',
  },
  cardNum: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '9px',
    color: '#c8c4bc',
    letterSpacing: '0.1em',
    marginBottom: '12px',
  },
  cardTitle: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a1a18',
    marginBottom: '10px',
    letterSpacing: '-0.01em',
  },
  cardDesc: {
    fontSize: '12px',
    color: '#8a8880',
    lineHeight: '1.7',
    marginBottom: '16px',
  },
  comingSoon: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '10px',
    color: '#c8a96e',
    letterSpacing: '0.08em',
  },
}