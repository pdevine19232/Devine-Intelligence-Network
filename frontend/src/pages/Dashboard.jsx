import { supabase } from '../supabaseClient'

export default function Dashboard({ session, isAdmin }) {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div style={s.container}>
      <div style={s.sidebar}>
        <div style={s.logo}>
          <span style={s.logoIcon}>⚡</span>
          <span style={s.logoText}>Devine Intelligence Network</span>
        </div>
        <nav>
          <p style={s.navItem}>🏠  Dashboard</p>
          <p style={s.navItem}>💬  Chat</p>
          <p style={s.navItem}>📰  Daily Briefing</p>
          <p style={s.navItem}>📄  Documents</p>
          {isAdmin && <>
            <div style={s.navDivider} />
            <p style={{...s.navItem, ...s.navAdmin}}
               onClick={() => window.location.href='/admin'}>
              ⚙️  Admin Panel
            </p>
            <p style={{...s.navItem, ...s.navAdmin}}>
              👥  Users
            </p>
          </>}
        </nav>
        <div style={s.userChip}>
          <div style={s.avatar}>
            {session.user.email[0].toUpperCase()}
          </div>
          <div style={s.userInfo}>
            <div style={s.userName}>{session.user.email}</div>
            <div style={s.userRole}>
              {isAdmin ? 'ADMINISTRATOR' : 'USER'}
            </div>
          </div>
          <button style={s.logoutBtn} onClick={handleLogout}
            title="Sign out">↪</button>
        </div>
      </div>

      <div style={s.main}>
        <div style={s.topbar}>
          <h1 style={s.pageTitle}>Dashboard</h1>
          <div style={s.statusPill}>
            <div style={s.dot} />
            System Online
          </div>
        </div>

        <div style={s.content}>
          <div style={s.banner}>
            <div style={s.bannerLeft}>
              <span style={{fontSize:'24px'}}>📬</span>
              <div>
                <div style={s.bannerTitle}>
                  Morning Briefing Ready
                </div>
                <div style={s.bannerSub}>
                  Delivered today at 06:30 EST · 
                  Powered by Daily Briefer Agent
                </div>
              </div>
            </div>
            <button style={s.bannerBtn}>View Briefing →</button>
          </div>

          <div style={s.sectionLabel}>YOUR AGENTS</div>
          <div style={s.grid}>
            <div style={s.card}>
              <div style={s.cardTop}>
                <span style={s.cardIcon}>🤖</span>
                <span style={{...s.badge, ...s.badgeGreen}}>
                  ● READY
                </span>
              </div>
              <div style={s.cardTitle}>Chief of Staff</div>
              <div style={s.cardDesc}>
                Your central AI coordinator. Ask it anything and 
                it routes to the right specialist agent.
              </div>
              <div style={s.cardMeta}>Coming Week 2</div>
            </div>

            <div style={s.card}>
              <div style={s.cardTop}>
                <span style={s.cardIcon}>📰</span>
                <span style={{...s.badge, ...s.badgeAmber}}>
                  ◷ SCHEDULED
                </span>
              </div>
              <div style={s.cardTitle}>Daily Briefer</div>
              <div style={s.cardDesc}>
                Morning intelligence email at 6:30am covering 
                markets, news, and your deal pipeline.
              </div>
              <div style={s.cardMeta}>Coming Week 3</div>
            </div>

            <div style={s.card}>
              <div style={s.cardTop}>
                <span style={s.cardIcon}>📄</span>
                <span style={{...s.badge, ...s.badgeGray}}>
                  PLANNED
                </span>
              </div>
              <div style={s.cardTitle}>Document Analyst</div>
              <div style={s.cardDesc}>
                Reads CIMs, teasers and financial statements. 
                Flags key metrics and anomalies.
              </div>
              <div style={s.cardMeta}>Coming Week 5+</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  container: { display: 'flex', minHeight: '100vh',
    backgroundColor: '#0f0f1a', color: '#ffffff',
    fontFamily: 'Arial' },
  sidebar: { width: '240px', backgroundColor: '#1a1a2e',
    padding: '24px 16px', display: 'flex', flexDirection: 'column',
    borderRight: '1px solid #1e1e3a', flexShrink: 0 },
  logo: { display: 'flex', alignItems: 'center', gap: '10px',
    marginBottom: '32px', paddingBottom: '20px',
    borderBottom: '1px solid #1e1e3a' },
  logoIcon: { width: '28px', height: '28px', background: '#4f46e5',
    borderRadius: '8px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '14px' },
  logoText: { fontSize: '15px', fontWeight: '700', color: '#ffffff' },
  navItem: { color: '#8888aa', padding: '9px 10px', borderRadius: '8px',
    cursor: 'pointer', marginBottom: '2px', fontSize: '13px' },
  navAdmin: { color: '#818cf8' },
  navDivider: { height: '1px', background: '#1e1e3a',
    margin: '12px 0' },
  userChip: { marginTop: 'auto', display: 'flex', alignItems: 'center',
    gap: '10px', padding: '12px 8px',
    borderTop: '1px solid #1e1e3a', paddingTop: '16px' },
  avatar: { width: '28px', height: '28px', background: '#4f46e5',
    borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '12px', fontWeight: '700',
    flexShrink: 0 },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: '11px', color: '#ffffff',
    whiteSpace: 'nowrap', overflow: 'hidden',
    textOverflow: 'ellipsis' },
  userRole: { fontSize: '9px', color: '#818cf8',
    letterSpacing: '0.1em', marginTop: '2px' },
  logoutBtn: { background: 'transparent', border: 'none',
    color: '#8888aa', cursor: 'pointer', fontSize: '16px',
    flexShrink: 0 },
  main: { flex: 1, display: 'flex', flexDirection: 'column',
    overflow: 'hidden' },
  topbar: { height: '56px', borderBottom: '1px solid #1e1e3a',
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', padding: '0 28px',
    flexShrink: 0 },
  pageTitle: { fontSize: '16px', fontWeight: '700',
    color: '#ffffff' },
  statusPill: { display: 'flex', alignItems: 'center', gap: '7px',
    background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
    padding: '5px 12px', borderRadius: '20px', fontSize: '12px',
    color: '#22c55e' },
  dot: { width: '6px', height: '6px', background: '#22c55e',
    borderRadius: '50%' },
  content: { flex: 1, overflowY: 'auto', padding: '28px' },
  banner: { background: 'linear-gradient(135deg,rgba(79,70,229,0.15),rgba(79,70,229,0.05))',
    border: '1px solid rgba(79,70,229,0.25)', borderRadius: '12px',
    padding: '18px 22px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: '28px' },
  bannerLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  bannerTitle: { fontSize: '14px', fontWeight: '700',
    marginBottom: '3px' },
  bannerSub: { fontSize: '12px', color: '#8888aa' },
  bannerBtn: { background: '#4f46e5', color: '#fff', border: 'none',
    padding: '9px 18px', borderRadius: '8px', fontSize: '12px',
    fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' },
  sectionLabel: { fontSize: '10px', color: '#3a3a6a',
    letterSpacing: '0.2em', marginBottom: '14px' },
  grid: { display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '16px' },
  card: { background: '#1a1a2e', padding: '22px',
    borderRadius: '12px', border: '1px solid #1e1e3a' },
  cardTop: { display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: '14px' },
  cardIcon: { fontSize: '22px' },
  badge: { fontSize: '10px', padding: '3px 9px',
    borderRadius: '20px', fontWeight: '600' },
  badgeGreen: { background: 'rgba(34,197,94,0.1)',
    color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' },
  badgeAmber: { background: 'rgba(245,158,11,0.1)',
    color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' },
  badgeGray: { background: '#1e1e3a', color: '#6666aa',
    border: '1px solid #2a2a4a' },
  cardTitle: { fontSize: '14px', fontWeight: '700',
    marginBottom: '8px' },
  cardDesc: { fontSize: '12px', color: '#8888aa',
    lineHeight: '1.6', marginBottom: '14px' },
  cardMeta: { fontSize: '11px', color: '#3a3a6a' },
}