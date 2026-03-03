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
              <div style={s.navItem} onClick={() => navigate('/agents')}>Agent Hub</div>
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
            <span style={s.statusText}>Agent System Online</span>
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

            <div style={s.agentCard}>
              <div style={s.agentCardTop}>
                <div style={s.agentNum}>07</div>
                <div style={{...s.agentStatus, ...s.statusReady}}>Active</div>
              </div>
              <div style={s.agentName}>Agent Hub</div>
              <div style={s.agentDesc}>
                Dispatch autonomous Builder, Breaker, and Teacher agents to improve this platform overnight. Review and approve changes before they go live.
              </div>
              {isAdmin && (
                <button style={s.agentBtn} onClick={() => navigate('/agents')}>
                  Open Agent Hub
                </button>
              )}
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}

const s = {
  container: {
    minHeight: '100vh',
    background: '#0f0f1a',
    display: 'flex',
    fontFamily: 'Arial, sans-serif',
    color: '#fff',
  },
  sidebar: {
    width: '280px',
    background: '#1a1a2e',
    borderRight: '1px solid #2a2a4e',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 0',
    overflowY: 'auto',
  },
  logoArea: {
    padding: '0 24px',
    marginBottom: '32px',
    borderBottom: '1px solid #2a2a4e',
    paddingBottom: '24px',
  },
  wordmark: {
    fontSize: '14px',
    fontWeight: 'bold',
    lineHeight: '1.4',
    marginBottom: '8px',
    letterSpacing: '0.5px',
  },
  submark: {
    fontSize: '11px',
    color: '#888',
    letterSpacing: '1px',
    textTransform: 'uppercase',
  },
  nav: {
    flex: 1,
    paddingBottom: '24px',
  },
  navGroup: {
    marginBottom: '28px',
  },
  navGroupLabel: {
    fontSize: '11px',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    padding: '0 24px',
    marginBottom: '12px',
    fontWeight: 'bold',
  },
  navItem: {
    padding: '10px 24px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#aaa',
    transition: 'all 0.2s',
    borderLeft: '3px solid transparent',
    userSelect: 'none',
  },
  navItemActive: {
    color: '#fff',
    background: '#252540',
    borderLeftColor: '#4a9eff',
  },
  userArea: {
    padding: '24px',
    borderTop: '1px solid #2a2a4e',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  userAvatar: {
    width: '40px',
    height: '40px',
    background: '#4a9eff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '16px',
    flexShrink: 0,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: '13px',
    fontWeight: '500',
    marginBottom: '2px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  userRole: {
    fontSize: '11px',
    color: '#888',
  },
  logoutBtn: {
    background: 'transparent',
    border: 'none',
    color: '#4a9eff',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px 8px',
    transition: 'color 0.2s',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: '#0f0f1a',
  },
  topbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 32px',
    borderBottom: '1px solid #2a2a4e',
    background: '#1a1a2e',
  },
  topbarDate: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '4px',
    letterSpacing: '0.5px',
  },
  pageTitle: {
    fontSize: '28px',
    fontWeight: 'bold',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    background: '#4ade80',
    borderRadius: '50%',
    animation: 'pulse 2s infinite',
  },
  statusText: {
    fontSize: '13px',
    color: '#aaa',
  },
  content: {
    flex: 1,
    padding: '32px',
    overflowY: 'auto',
  },
  briefingBanner: {
    background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
    borderRadius: '8px',
    padding: '24px',
    marginBottom: '32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '24px',
  },
  briefingLeft: {
    display: 'flex',
    gap: '16px',
    alignItems: 'flex-start',
    flex: 1,
  },
  briefingAccent: {
    width: '4px',
    height: '64px',
    background: '#4a9eff',
    borderRadius: '2px',
    flexShrink: 0,
  },
  briefingTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '4px',
  },
  briefingSub: {
    fontSize: '12px',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  briefingButtons: {
    display: 'flex',
    gap: '12px',
  },
  briefingBtn: {
    background: '#fff',
    color: '#1e3c72',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  sendBriefBtn: {
    background: 'transparent',
    color: '#fff',
    border: '1px solid #fff',
    padding: '8px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.2s',
  },
  sectionLabel: {
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontWeight: 'bold',
    marginBottom: '16px',
  },
  agentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '24px',
  },
  agentCard: {
    background: '#1a1a2e',
    border: '1px solid #2a2a4e',
    borderRadius: '8px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    transition: 'all 0.3s',
  },
  agentCardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  agentNum: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#4a9eff',
  },
  agentStatus: {
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  statusReady: {
    background: 'rgba(74, 222, 128, 0.15)',
    color: '#4ade80',
  },
  statusScheduled: {
    background: 'rgba(247, 144, 9, 0.15)',
    color: '#f7900a',
  },
  statusPlanned: {
    background: 'rgba(168, 85, 247, 0.15)',
    color: '#d8b4fe',
  },
  agentName: {
    fontSize: '16px',
    fontWeight: 'bold',
  },
  agentDesc: {
    fontSize: '13px',
    color: '#aaa',
    lineHeight: '1.5',
    flex: 1,
  },
  agentMeta: {
    fontSize: '12px',
    color: '#666',
    fontStyle: 'italic',
  },
  agentBtn: {
    background: '#4a9eff',
    color: '#fff',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.2s',
    alignSelf: 'flex-start',
  },
}