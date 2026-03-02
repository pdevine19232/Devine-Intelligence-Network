/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

const NAICS_OPTIONS = [
  { value: '', label: 'All Sectors' },
  { value: '332', label: 'Fabricated Metal Products' },
  { value: '333', label: 'Industrial Machinery' },
  { value: '334', label: 'Computer & Electronics' },
  { value: '336', label: 'Transportation Equipment' },
  { value: '484', label: 'Trucking & Logistics' },
  { value: '541330', label: 'Engineering Services' },
  { value: '493', label: 'Warehousing & Storage' },
]

const SET_ASIDE_OPTIONS = [
  { value: '', label: 'All Set-Asides' },
  { value: 'SBA', label: 'Small Business' },
  { value: '8A', label: '8(a) Program' },
  { value: 'HZC', label: 'HUBZone' },
  { value: 'SDVOSBC', label: 'Service-Disabled Veteran' },
  { value: 'WOSB', label: 'Women-Owned Small Business' },
]

const scoreColor = (score) => {
  if (score >= 80) return { color: '#2d6a4f', bg: '#d8f3dc' }
  if (score >= 65) return { color: '#1a4060', bg: '#dbeafe' }
  if (score >= 50) return { color: '#6b4c11', bg: '#fef3c7' }
  return { color: '#8a8880', bg: '#f0ede6' }
}

const daysLeftColor = (days) => {
  if (days === null || days === undefined) return '#8a8880'
  if (days <= 7) return '#c0392b'
  if (days <= 14) return '#e67e22'
  return '#2d6a4f'
}

export default function Contracts({ session }) {
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [filters, setFilters] = useState({
    naics: '',
    set_aside: '',
    keyword: '',
    days_back: 30,
  })
  const [draftLoading, setDraftLoading] = useState(false)
  const [draft, setDraft] = useState(null)

  const getToken = async () => {
    const { data: { session: s } } = await supabase.auth.getSession()
    return s?.access_token
  }

  const fetchContracts = async () => {
    setLoading(true)
    setError(null)
    setSelected(null)
    setDraft(null)
    try {
      const token = await getToken()
      const params = new URLSearchParams()
      if (filters.naics) params.append('naics', filters.naics)
      if (filters.set_aside) params.append('set_aside', filters.set_aside)
      if (filters.keyword) params.append('keyword', filters.keyword)
      params.append('days_back', filters.days_back)

      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/contracts?${params}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      const data = await res.json()
      if (data.opportunities) {
        setOpportunities(data.opportunities)
      } else {
        setError('Failed to load opportunities')
      }
    } catch (err) {
      setError('Connection error')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchContracts() }, [])

  const generateDraft = async (opp) => {
    setDraftLoading(true)
    setDraft(null)
    try {
      const token = await getToken()
      const prompt = `Generate a capability statement and capability brief for this government contract opportunity:

Title: ${opp.title}
Agency: ${opp.agency}
NAICS: ${opp.naics}
Set-Aside: ${opp.set_aside || 'None'}
Type: ${opp.type}
Deadline: ${opp.deadline}

Write:
1. A one-paragraph capability statement (3-4 sentences) showing why a small, agile supply chain and logistics company would be a strong fit
2. Three key differentiators to highlight
3. A suggested subject line for the initial email to the contracting officer

Keep it sharp, confident, and specific to this opportunity.`

      const res = await fetch(`${process.env.REACT_APP_API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          mode: 'execution'
        })
      })
      const data = await res.json()
      setDraft(data.response)
    } catch (err) {
      console.error(err)
    } finally {
      setDraftLoading(false)
    }
  }

  return (
    <div style={s.container}>
      {/* HEADER */}
      <div style={s.header}>
        <div>
          <div style={s.headerTitle}>Contract Intelligence</div>
          <div style={s.headerSub}>Live opportunities from SAM.gov — scored and ranked for you</div>
        </div>
        <button style={s.refreshBtn} onClick={fetchContracts} disabled={loading}>
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>

      {/* FILTERS */}
      <div style={s.filterBar}>
        <input
          style={s.filterInput}
          placeholder="Search by keyword..."
          value={filters.keyword}
          onChange={e => setFilters({ ...filters, keyword: e.target.value })}
          onKeyDown={e => e.key === 'Enter' && fetchContracts()}
        />
        <select
          style={s.filterSelect}
          value={filters.naics}
          onChange={e => setFilters({ ...filters, naics: e.target.value })}
        >
          {NAICS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          style={s.filterSelect}
          value={filters.set_aside}
          onChange={e => setFilters({ ...filters, set_aside: e.target.value })}
        >
          {SET_ASIDE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          style={s.filterSelect}
          value={filters.days_back}
          onChange={e => setFilters({ ...filters, days_back: e.target.value })}
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={60}>Last 60 days</option>
        </select>
        <button style={s.searchBtn} onClick={fetchContracts} disabled={loading}>
          Search
        </button>
      </div>

      <div style={s.body}>
        {/* OPPORTUNITY LIST */}
        <div style={s.list}>
          {loading && (
            <div style={s.stateMsg}>Fetching live opportunities from SAM.gov...</div>
          )}
          {error && (
            <div style={{ ...s.stateMsg, color: '#c0392b' }}>{error}</div>
          )}
          {!loading && !error && opportunities.length === 0 && (
            <div style={s.stateMsg}>No opportunities found. Try adjusting filters.</div>
          )}
          {!loading && opportunities.map(opp => {
            const sc = scoreColor(opp.score)
            const isSelected = selected?.id === opp.id
            return (
              <div
                key={opp.id}
                style={{
                  ...s.card,
                  borderColor: isSelected ? '#1a1a18' : '#e8e4dc',
                  background: isSelected ? '#faf9f6' : '#fff',
                }}
                onClick={() => { setSelected(opp); setDraft(null) }}
              >
                <div style={s.cardTop}>
                  <div style={s.cardTitle}>{opp.title}</div>
                  <div style={{
                    ...s.scoreBadge,
                    color: sc.color,
                    background: sc.bg,
                  }}>{opp.score}</div>
                </div>
                <div style={s.cardMeta}>
                  <span style={s.metaItem}>{opp.agency}</span>
                  {opp.naics && <span style={s.metaItem}>NAICS {opp.naics}</span>}
                  {opp.set_aside && <span style={{ ...s.metaItem, color: '#2d6a4f' }}>{opp.set_aside}</span>}
                </div>
                <div style={s.cardBottom}>
                  <span style={s.metaItem}>{opp.type}</span>
                  {opp.days_left !== null && opp.days_left !== undefined && (
                    <span style={{ ...s.daysLeft, color: daysLeftColor(opp.days_left) }}>
                      {opp.days_left > 0 ? `${opp.days_left}d left` : 'Expired'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* DETAIL PANEL */}
        <div style={s.detail}>
          {!selected ? (
            <div style={s.detailEmpty}>
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>◈</div>
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#1a1a18' }}>Select an opportunity</div>
              <div style={{ fontSize: '12px', color: '#8a8880', marginTop: '6px' }}>
                Click any contract to see details and generate a capability statement
              </div>
            </div>
          ) : (
            <div style={s.detailContent}>
              <div style={s.detailScoreRow}>
                <div style={{
                  ...s.detailScore,
                  color: scoreColor(selected.score).color,
                  background: scoreColor(selected.score).bg,
                }}>
                  Score: {selected.score}/100
                </div>
                <a
                  href={selected.sam_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.samLink}
                >
                  View on SAM.gov ↗
                </a>
              </div>

              <div style={s.detailTitle}>{selected.title}</div>

              {selected.score_reasons.length > 0 && (
                <div style={s.reasonsBox}>
                  {selected.score_reasons.map((r, i) => (
                    <div key={i} style={s.reason}>✓ {r}</div>
                  ))}
                </div>
              )}

              <div style={s.detailGrid}>
                {[
                  ['Agency', selected.agency],
                  ['Office', selected.office || selected.sub_agency],
                  ['Solicitation #', selected.solicitation_number],
                  ['NAICS Code', selected.naics],
                  ['Set-Aside', selected.set_aside || 'None'],
                  ['Type', selected.type],
                  ['Posted', selected.posted_date],
                  ['Deadline', selected.deadline || 'Not specified'],
                  ['Contact', selected.contact_name || '—'],
                  ['Contact Email', selected.contact_email || '—'],
                ].map(([label, value]) => value ? (
                  <div key={label} style={s.detailRow}>
                    <div style={s.detailLabel}>{label}</div>
                    <div style={s.detailValue}>{value}</div>
                  </div>
                ) : null)}
              </div>

              <button
                style={s.draftBtn}
                onClick={() => generateDraft(selected)}
                disabled={draftLoading}
              >
                {draftLoading ? 'Generating...' : '✦ Generate Capability Statement'}
              </button>

              {draft && (
                <div style={s.draftBox}>
                  <div style={s.draftLabel}>CAPABILITY STATEMENT DRAFT</div>
                  <div style={s.draftContent}>{draft}</div>
                  <button
                    style={s.copyBtn}
                    onClick={() => navigator.clipboard.writeText(draft)}
                  >
                    Copy to clipboard
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const s = {
  container: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    backgroundColor: '#faf9f6', fontFamily: "'DM Sans', Arial, sans-serif", overflow: 'hidden',
  },
  header: {
    padding: '18px 28px', borderBottom: '1px solid #e8e4dc',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#fff', flexShrink: 0,
  },
  headerTitle: { fontSize: '15px', fontWeight: '600', color: '#1a1a18', letterSpacing: '-0.01em' },
  headerSub: { fontSize: '11px', color: '#aaa89f', marginTop: '2px' },
  refreshBtn: {
    padding: '7px 14px', fontSize: '12px', fontWeight: '500',
    background: '#1a1a18', color: '#fff', border: 'none', cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  filterBar: {
    padding: '12px 28px', borderBottom: '1px solid #e8e4dc',
    display: 'flex', gap: '8px', alignItems: 'center',
    background: '#fff', flexShrink: 0, flexWrap: 'wrap',
  },
  filterInput: {
    flex: 2, minWidth: '160px', padding: '7px 12px', fontSize: '12px',
    border: '1px solid #e8e4dc', background: '#faf9f6', color: '#1a1a18',
    fontFamily: "'DM Sans', Arial, sans-serif", outline: 'none',
  },
  filterSelect: {
    flex: 1, minWidth: '140px', padding: '7px 10px', fontSize: '12px',
    border: '1px solid #e8e4dc', background: '#faf9f6', color: '#1a1a18',
    fontFamily: "'DM Sans', Arial, sans-serif", outline: 'none', cursor: 'pointer',
  },
  searchBtn: {
    padding: '7px 18px', fontSize: '12px', fontWeight: '500',
    background: '#1a1a18', color: '#fff', border: 'none', cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  list: { width: '380px', overflowY: 'auto', borderRight: '1px solid #e8e4dc', flexShrink: 0 },
  stateMsg: { padding: '40px 24px', textAlign: 'center', fontSize: '13px', color: '#8a8880' },
  card: {
    padding: '16px 20px', borderBottom: '1px solid #e8e4dc',
    cursor: 'pointer', border: '1px solid', transition: 'all 0.1s', marginBottom: '-1px',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' },
  cardTitle: { fontSize: '13px', fontWeight: '500', color: '#1a1a18', lineHeight: '1.4', flex: 1 },
  scoreBadge: { fontSize: '12px', fontWeight: '700', padding: '2px 8px', borderRadius: '3px', flexShrink: 0 },
  cardMeta: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' },
  cardBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  metaItem: { fontSize: '11px', color: '#8a8880' },
  daysLeft: { fontSize: '11px', fontWeight: '600' },
  detail: { flex: 1, overflowY: 'auto', background: '#faf9f6' },
  detailEmpty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', color: '#8a8880', textAlign: 'center',
  },
  detailContent: { padding: '28px 32px' },
  detailScoreRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  detailScore: { fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '3px' },
  samLink: { fontSize: '12px', color: '#1a4060', textDecoration: 'none' },
  detailTitle: { fontSize: '18px', fontWeight: '600', color: '#1a1a18', lineHeight: '1.4', marginBottom: '16px' },
  reasonsBox: { background: '#f0f7f0', border: '1px solid #b7ddb8', padding: '12px 16px', marginBottom: '20px' },
  reason: { fontSize: '12px', color: '#2d6a4f', marginBottom: '4px', lineHeight: '1.5' },
  detailGrid: { marginBottom: '24px' },
  detailRow: { display: 'flex', gap: '16px', padding: '8px 0', borderBottom: '1px solid #e8e4dc' },
  detailLabel: { fontSize: '11px', color: '#8a8880', width: '120px', flexShrink: 0, paddingTop: '1px' },
  detailValue: { fontSize: '12px', color: '#1a1a18', flex: 1, lineHeight: '1.5' },
  draftBtn: {
    width: '100%', padding: '12px', background: '#1a1a18', color: '#fff',
    border: 'none', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif", marginBottom: '16px',
  },
  draftBox: { background: '#fff', border: '1px solid #e8e4dc', padding: '20px' },
  draftLabel: { fontSize: '9px', fontWeight: '600', letterSpacing: '0.1em', color: '#aaa89f', marginBottom: '12px' },
  draftContent: { fontSize: '13px', color: '#1a1a18', lineHeight: '1.8', whiteSpace: 'pre-wrap', marginBottom: '16px' },
  copyBtn: {
    padding: '7px 14px', fontSize: '11px', background: '#faf9f6',
    border: '1px solid #e8e4dc', color: '#4a4840', cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
}
