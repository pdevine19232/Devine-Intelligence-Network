import { supabase } from '../supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Dashboard({ session, isAdmin }) {
  const navigate = useNavigate()
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div style={s.container}>
      <div style={s.sidebar}>

        <div style={s.logoArea}>
          <div style={s.wordmark}>Devine Intelligence<br />Network</div>
          <div style={s.submark}>Private Platform</div>
        </div>

        <nav style={s.nav}>
          <div style={s.navGroup}>
            <div style={s.navGroupLabel}>Workspace</div>
            <div style={{...s.navItem, ...s.navItemActive}}>Dashboard</div>
            <div style={s.navItem} onClick={() => navigate('/chat')}>Strategos</div>
            <div style={s.navItem} onClick={() => navigate('/coverage')}>Coverage Universe</div>
            <div style={s.navItem} onClick={() => navigate('/contracts')}>Contracts</div>
            <div style={s.navItem}>Daily Briefing</div>
            <div style={s.navItem}>Documents</div>
          </div>
          {isAdmin && (
            <div style={s.navGroup}>
              <div style={s.navGroupLabel}>System</div>
              <div style={s.navItem} onClick={() => navigate('/admin')}>Admin</div>
              <div style={s.navItem}>Settings</div>
            </div>
          )}
        </nav>

        <div style={s.userArea}>
          <div style={s.userAvatar}>{session.user.email[0].toUpperCase()}</div>
          <div style={s.userInfo}>
            <div style={s.userName}>{session.user.email}</div>
            <div style={s.userRole}>{isAdmin ? 'Administrator' : 'User'}</div>
          </div>
          <button style={s.logoutBtn} onClick={handleLogout} title="Sign out">↪</button>
        </div>

      </div>

      <div style={s.main}>

        <div style={s.topbar}>
          <div>
            <div style={s.topbarDate}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div style={s.pageTitle}>Dashboard</div>
          </div>
          <div style={s.statusRow}>
            <div style={s.statusDot} />
            <span style={s.statusText}>All systems operational</span>
          </div>
        </div>

        <div style={s.content}>

          <div style={s.briefingBanner}>
            <div style={s.briefingLeft}>
              <div style={s.briefingAccent} />
              <div>
                <div style={s.briefingTitle}>Morning Intelligence — Ready</div>
                <div style={s.briefingSub}>Delivered 06:30 EST · Markets, M&A activity, macro headlines</div>
              </div>
            </div>
            <div style={s.briefingButtons}>
              <button style={s.briefingBtn}>View Briefing</button>
              {isAdmin && (
                <button
                  style={s.sendBriefBtn}
                  onClick={async () => {
                    const { data: { session: currentSession } } = await (await import('../supabaseClient')).supabase.auth.getSession()
                    const token = currentSession?.access_token
                    const res = await fetch(`${process.env.REACT_APP_API_URL}/send-brief`, {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` }
                    })
                    if (res.ok) alert('Brief sent successfully')
                    else alert('Error sending brief')
                  }}
                >
                  Send Now
                </button>
              )}
            </div>
          </div>

          <div style={s.sectionLabel}>Agents</div>

          <div style={s.agentGrid}>

            <div style={s.agentCard}>
              <div style={s.agentCardTop}>
                <div style={s.agentNum}>01</div>
                <div style={{...s.agentStatus, ...s.statusReady}}>Active</div>
              </div>
              <div style={s.agentName}>Strategos</div>
              <div style={s.agentDesc}>
                Your central AI strategist. Execution mode for fast answers and drafting. Problem Solving mode for innovative thinking and complex challenges.
              </div>
              <button style={s.agentBtn} onClick={() => navigate('/chat')}>
                Open Strategos
              </button>
            </div>

            <div style={s.agentCard}>
              <div style={s.agentCardTop}>
                <div style={s.agentNum}>02</div>
                <div style={{...s.agentStatus, ...s.statusScheduled}}>Scheduled</div>
              </div>
              <div style={s.agentName}>Daily Briefer</div>
              <div style={s.agentDesc}>
                Automated morning intelligence delivered at 06:30 each trading day. Markets, deal flow, and macro headlines.
              </div>
              <div style={s.agentMeta}>Coming Week 3</div>
            </div>
            
            <div style={s.agentCard}>
              <div style={s.agentCardTop}>
                <div style={s.agentNum}>05</div>
                <div style={{...s.agentStatus, ...s.statusReady}}>Active</div>
              </div>
              <div style={s.agentName}>Coverage Universe</div>
              <div style={s.agentDesc}>
                Live coverage of your tracked companies organized by sector. Price performance, key metrics, and recent news for each company.
              </div>
              <button style={s.agentBtn} onClick={() => navigate('/coverage')}>
                Open Coverage
              </button>
            </div>

            <div style={s.agentCard}>
              <div style={s.agentCardTop}>
                <div style={s.agentNum}>03</div>
                <div style={{...s.agentStatus, ...s.statusPlanned}}>Planned</div>
              </div>
              <div style={s.agentName}>Document Analyst</div>
              <div style={s.agentDesc}>
                Reads CIMs, teasers and financial statements. Flags key metrics, anomalies, and points of interest automatically.
              </div>
              <div style={s.agentMeta}>Coming Week 5</div>
            </div>

            <div style={s.agentCard}>
              <div style={s.agentCardTop}>
                <div style={s.agentNum}>04</div>
                <div style={{...s.agentStatus, ...s.statusPlanned}}>Planned</div>
              </div>
              <div style={s.agentName}>Memory Agent</div>
              <div style={s.agentDesc}>
                Persistent deal and client context across sessions. Strategos remembers everything without you repeating yourself.
              </div>
              <div style={s.agentMeta}>Coming Week 5</div>
            </div>


            <div style={s.agentCard}>
              <div style={s.agentCardTop}>
                <div style={s.agentNum}>06</div>
                <div style={{...s.agentStatus, ...s.statusReady}}>Active</div>
              </div>
              <div style={s.agentName}>Contract Intelligence</div>
              <div style={s.agentDesc}>
                Live federal contract opportunities from SAM.gov, scored and ranked for fit. Generate capability statements instantly.
              </div>
              <button style={s.agentBtn} onClick={() => navigate('/contracts')}>
                Open Contracts
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: '#faf9f6',
    fontFamily: "'DM Sans', Arial, sans-serif",
    color: '#1a1a18',
  },
  sidebar: {
    width: '240px',
    backgroundColor: '#fff',
    borderRight: '1px solid #e8e4dc',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  logoArea: {
    padding: '28px 24px 22px',
    borderBottom: '1px solid #e8e4dc',
  },
  wordmark: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a18',
    lineHeight: '1.3',
    letterSpacing: '-0.01em',
    marginBottom: '4px',
  },
  submark: {
    fontSize: '9px',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#c8c4bc',
  },
  nav: {
    flex: 1,
    padding: '20px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  navGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  navGroupLabel: {
    padding: '0 24px',
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#c8c4bc',
    marginBottom: '4px',
  },
  navItem: {
    padding: '8px 24px',
    fontSize: '13px',
    color: '#8a8880',
    cursor: 'pointer',
    fontWeight: '400',
  },
  navItemActive: {
    color: '#1a1a18',
    fontWeight: '500',
  },
  userArea: {
    padding: '16px 20px',
    borderTop: '1px solid #e8e4dc',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  userAvatar: {
    width: '28px',
    height: '28px',
    background: '#1a1a18',
    color: '#faf9f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '600',
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: '11px',
    color: '#1a1a18',
    fontWeight: '500',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: '9px',
    color: '#c8c4bc',
    letterSpacing: '0.08em',
    marginTop: '1px',
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: '#c8c4bc',
    cursor: 'pointer',
    fontSize: '15px',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: '#faf9f6',
  },
  topbar: {
    padding: '24px 32px 20px',
    borderBottom: '1px solid #e8e4dc',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    flexShrink: 0,
    background: '#fff',
  },
  topbarDate: {
    fontSize: '10px',
    letterSpacing: '0.1em',
    color: '#c8c4bc',
    textTransform: 'uppercase',
    marginBottom: '4px',
  },
  pageTitle: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#1a1a18',
    letterSpacing: '-0.02em',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  statusDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    background: '#2a7a4a',
  },
  statusText: {
    fontSize: '11px',
    color: '#8a8880',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '28px 32px',
  },
  briefingBanner: {
    background: '#1a1a18',
    padding: '16px 22px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '32px',
  },
  briefingLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  briefingAccent: {
    width: '2px',
    height: '32px',
    background: '#c8a96e',
    flexShrink: 0,
  },
  briefingTitle: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#faf9f6',
    marginBottom: '3px',
  },
  briefingSub: {
    fontSize: '11px',
    color: '#4a4840',
  },
  briefingBtn: {
    background: 'transparent',
    border: '1px solid #2e2d2a',
    color: '#8a8880',
    padding: '8px 16px',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: '0.04em',
  },
  sectionLabel: {
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#c8c4bc',
    marginBottom: '14px',
  },
  agentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '12px',
  },
  agentCard: {
    background: '#fff',
    border: '1px solid #e8e4dc',
    padding: '20px',
  },
  agentCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  agentNum: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '9px',
    color: '#c8c4bc',
    letterSpacing: '0.1em',
  },
  agentStatus: {
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '3px 8px',
    border: '1px solid',
  },
  statusReady: {
    color: '#2a7a4a',
    borderColor: '#2a7a4a',
    background: 'rgba(42,122,74,0.05)',
  },
  statusScheduled: {
    color: '#8a6a00',
    borderColor: '#8a6a00',
    background: 'rgba(138,106,0,0.05)',
  },
  statusPlanned: {
    color: '#c8c4bc',
    borderColor: '#e8e4dc',
    background: 'transparent',
  },
  agentName: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#1a1a18',
    marginBottom: '8px',
    letterSpacing: '-0.01em',
  },
  agentDesc: {
    fontSize: '12px',
    color: '#8a8880',
    lineHeight: '1.7',
    marginBottom: '16px',
  },
  agentBtn: {
    background: '#1a1a18',
    color: '#faf9f6',
    border: 'none',
    padding: '9px 16px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: '0.02em',
  },
  agentMeta: {
    fontSize: '11px',
    color: '#c8c4bc',
    letterSpacing: '0.04em',
  },
  briefingButtons: {
  display: 'flex',
  gap: '8px',
  alignItems: 'center',
  },
  sendBriefBtn: {
    background: '#c8a96e',
    border: 'none',
    color: '#1a1a18',
    padding: '8px 16px',
    fontSize: '11px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: '0.04em',
  },
}