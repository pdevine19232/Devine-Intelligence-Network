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
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [analyzeError, setAnalyzeError] = useState(null)

  const getToken = async () => {
    const { data: { session: s } } = await supabase.auth.getSession()
    return s?.access_token
  }

  const fetchContracts = async () => {
    setLoading(true)
    setError(null)
    setSelected(null)
    setDraft(null)
    setAnalysis(null)
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

  const analyzeMargin = async (opp) => {
    setAnalyzeLoading(true)
    setAnalysis(null)
    setAnalyzeError(null)
    try {
      const token = await getToken()
      const prompt = `Analyze this government contract opportunity for margin and profitability:

Title: ${opp.title}
Agency: ${opp.agency}
NAICS: ${opp.naics}
Type: ${opp.type}
Contract Value: ${opp.contract_value || 'Not specified'}
Description: ${opp.description || 'Not provided'}
Solicitation Number: ${opp.solicitation_number}

Search for current supplier pricing for the specific products requested. Calculate the potential margin for a small business reseller. Give a clear BID or NO BID recommendation.`

      const res = await fetch(`${process.env.REACT_APP_API_URL}/contracts/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          mode: 'execution'
        })
      })
      const data = await res.json()
      if (data.analysis) {
        setAnalysis(data.analysis)
      } else {
        setAnalyzeError(data.detail || 'Analysis failed — check backend logs')
      }
    } catch (err) {
      console.error('Analyze error:', err)
      setAnalyzeError('Connection error — is the backend running?')
    } finally {
      setAnalyzeLoading(false)
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
                onClick={() => { setSelected(opp); setDraft(null); setAnalysis(null); setAnalyzeError(null) }}
              >
                <div style={s.cardTop}>
                  <div style={s.cardTitle}>{opp.title}</div>
                  <div style={{ ...s.scoreBadge, color: sc.color, background: sc.bg }}>
                    {opp.score}
                  </div>
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
                Click any contract to see details, analyze margin, and generate a capability statement
              </div>
            </div>
          ) : (
            <div style={s.detailContent}>

              {/* Score + SAM link */}
              <div style={s.detailScoreRow}>
                <div style={{
                  ...s.detailScore,
                  color: scoreColor(selected.score).color,
                  background: scoreColor(selected.score).bg,
                }}>
                  Score: {selected.score}/100
                </div>
                <a href={selected.sam_url} target="_blank" rel="noopener noreferrer" style={s.samLink}>
                  View on SAM.gov ↗
                </a>
              </div>

              {/* Title */}
              <div style={s.detailTitle}>{selected.title}</div>

              {/* Score reasons */}
              {selected.score_reasons.length > 0 && (
                <div style={s.reasonsBox}>
                  {selected.score_reasons.map((r, i) => (
                    <div key={i} style={s.reason}>✓ {r}</div>
                  ))}
                </div>
              )}

              {/* Contract value */}
              {selected.contract_value && (
                <div style={s.valueBox}>
                  <div style={s.valueLabel}>CONTRACT VALUE</div>
                  <div style={s.valueAmount}>{selected.contract_value}</div>
                  {selected.awardee && (
                    <div style={s.valueAwardee}>Awarded to: {selected.awardee}</div>
                  )}
                </div>
              )}

              {/* Details grid */}
              <div style={s.detailGrid}>
                {[
                  ['Agency', selected.agency],
                  ['Office', selected.office || selected.sub_agency],
                  ['Location', selected.location],
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

              {/* Description */}
              {selected.description && (
                <div style={s.descBox}>
                  <div style={s.descLabel}>DESCRIPTION</div>
                  <div style={s.descContent}>{selected.description}</div>
                </div>
              )}

              {/* Attachments */}
              {selected.attachments && selected.attachments.length > 0 && (
                <div style={s.attachBox}>
                  <div style={s.descLabel}>DOCUMENTS & ATTACHMENTS</div>
                  {selected.attachments.map((att, i) => (
                    <a key={i} href={att.url} target="_blank" rel="noopener noreferrer" style={s.attachLink}>
                      ↓ {att.name}
                    </a>
                  ))}
                </div>
              )}

              {/* MARGIN ANALYSIS BUTTON */}
              <button
                style={{
                  ...s.analyzeBtn,
                  background: analyzeLoading ? '#4a4840' : '#2d6a4f',
                }}
                onClick={() => analyzeMargin(selected)}
                disabled={analyzeLoading}
              >
                {analyzeLoading ? '◎ Searching supplier prices...' : '$ Analyze Margin & Suppliers'}
              </button>

              {/* ANALYSIS ERROR */}
              {analyzeError && (
                <div style={{ padding: '12px 16px', background: '#fff0f0', border: '1px solid #f5c6cb', color: '#c0392b', fontSize: '12px', marginBottom: '8px' }}>
                  {analyzeError}
                </div>
              )}

              {/* ANALYSIS RESULTS */}
              {analysis && (
                <div style={s.analysisBox}>

                  {/* Verdict banner */}
                  <div style={{
                    ...s.verdictBanner,
                    background: analysis.verdict === 'BID' ? '#2d6a4f' :
                                analysis.verdict === 'NO BID' ? '#c0392b' : '#8a6a00'
                  }}>
                    <div style={s.verdictLabel}>{analysis.verdict}</div>
                    <div style={s.verdictReason}>{analysis.verdict_reason}</div>
                  </div>

                  {/* Margin numbers */}
                  <div style={s.marginGrid}>
                    <div style={s.marginCell}>
                      <div style={s.marginCellLabel}>Unit Cost</div>
                      <div style={s.marginCellValue}>
                        {analysis.estimated_unit_cost ? `$${Number(analysis.estimated_unit_cost).toFixed(2)}` : '—'}
                      </div>
                    </div>
                    <div style={s.marginCell}>
                      <div style={s.marginCellLabel}>Bid Price</div>
                      <div style={s.marginCellValue}>
                        {analysis.recommended_bid_price ? `$${Number(analysis.recommended_bid_price).toFixed(2)}` : '—'}
                      </div>
                    </div>
                    <div style={s.marginCell}>
                      <div style={s.marginCellLabel}>Margin %</div>
                      <div style={{
                        ...s.marginCellValue,
                        color: analysis.estimated_margin_pct >= 20 ? '#2d6a4f' :
                               analysis.estimated_margin_pct >= 10 ? '#8a6a00' : '#c0392b'
                      }}>
                        {analysis.estimated_margin_pct ? `${Number(analysis.estimated_margin_pct).toFixed(1)}%` : '—'}
                      </div>
                    </div>
                    <div style={s.marginCell}>
                      <div style={s.marginCellLabel}>Total Margin</div>
                      <div style={{ ...s.marginCellValue, color: '#2d6a4f' }}>
                        {analysis.estimated_total_margin ? `$${Number(analysis.estimated_total_margin).toLocaleString()}` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Suppliers */}
                  {analysis.top_suppliers && analysis.top_suppliers.length > 0 && (
                    <div style={s.suppliersBox}>
                      <div style={s.analysisLabel}>TOP SUPPLIERS</div>
                      {analysis.top_suppliers.map((sup, i) => (
                        <div key={i} style={s.supplierRow}>
                          <div style={s.supplierName}>{sup.name}</div>
                          <div style={s.supplierPrice}>
                            {sup.price ? `$${Number(sup.price).toFixed(2)}/unit` : 'Check site'}
                          </div>
                          {sup.url && (
                            <a href={sup.url} target="_blank" rel="noopener noreferrer" style={s.supplierLink}>
                              View ↗
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Risks */}
                  {analysis.risks && analysis.risks.length > 0 && (
                    <div style={s.risksBox}>
                      <div style={s.analysisLabel}>RISKS</div>
                      {analysis.risks.map((r, i) => (
                        <div key={i} style={s.riskItem}>⚠ {r}</div>
                      ))}
                    </div>
                  )}

                  {/* Next steps */}
                  {analysis.next_steps && analysis.next_steps.length > 0 && (
                    <div style={s.nextStepsBox}>
                      <div style={s.analysisLabel}>NEXT STEPS</div>
                      {analysis.next_steps.map((step, i) => (
                        <div key={i} style={s.nextStepItem}>
                          <span style={s.stepNum}>{i + 1}</span> {step}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Capability statement button */}
              <button
                style={{ ...s.draftBtn, marginTop: '8px' }}
                onClick={() => generateDraft(selected)}
                disabled={draftLoading}
              >
                {draftLoading ? 'Generating...' : '✦ Generate Capability Statement'}
              </button>

              {draft && (
                <div style={s.draftBox}>
                  <div style={s.draftLabel}>CAPABILITY STATEMENT DRAFT</div>
                  <div style={s.draftContent}>{draft}</div>
                  <button style={s.copyBtn} onClick={() => navigator.clipboard.writeText(draft)}>
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
  valueBox: { background: '#1a1a18', padding: '16px 20px', marginBottom: '20px' },
  valueLabel: { fontSize: '9px', fontWeight: '600', letterSpacing: '0.1em', color: '#4a4840', marginBottom: '6px' },
  valueAmount: { fontSize: '28px', fontWeight: '700', color: '#c8a96e', letterSpacing: '-0.02em' },
  valueAwardee: { fontSize: '11px', color: '#8a8880', marginTop: '4px' },
  detailGrid: { marginBottom: '24px' },
  detailRow: { display: 'flex', gap: '16px', padding: '8px 0', borderBottom: '1px solid #e8e4dc' },
  detailLabel: { fontSize: '11px', color: '#8a8880', width: '120px', flexShrink: 0, paddingTop: '1px' },
  detailValue: { fontSize: '12px', color: '#1a1a18', flex: 1, lineHeight: '1.5' },
  descBox: { background: '#fff', border: '1px solid #e8e4dc', padding: '16px 20px', marginBottom: '16px' },
  descLabel: { fontSize: '9px', fontWeight: '600', letterSpacing: '0.1em', color: '#aaa89f', marginBottom: '10px' },
  descContent: {
    fontSize: '12px', color: '#4a4840', lineHeight: '1.8',
    whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto',
  },
  attachBox: { background: '#fff', border: '1px solid #e8e4dc', padding: '16px 20px', marginBottom: '16px' },
  attachLink: {
    display: 'block', fontSize: '12px', color: '#1a4060', textDecoration: 'none',
    padding: '4px 0', borderBottom: '1px solid #f0ede6', lineHeight: '1.8',
  },
  analyzeBtn: {
    width: '100%', padding: '12px', color: '#fff', border: 'none',
    fontSize: '13px', fontWeight: '500', cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif", marginBottom: '8px',
  },
  analysisBox: { border: '1px solid #e8e4dc', marginBottom: '16px', overflow: 'hidden' },
  verdictBanner: { padding: '14px 20px' },
  verdictLabel: { fontSize: '16px', fontWeight: '700', color: '#fff', letterSpacing: '0.05em' },
  verdictReason: { fontSize: '12px', color: 'rgba(255,255,255,0.8)', marginTop: '3px' },
  marginGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr',
    borderBottom: '1px solid #e8e4dc', background: '#fff',
  },
  marginCell: { padding: '14px 16px', borderRight: '1px solid #e8e4dc' },
  marginCellLabel: {
    fontSize: '9px', fontWeight: '600', letterSpacing: '0.08em',
    color: '#aaa89f', textTransform: 'uppercase', marginBottom: '4px',
  },
  marginCellValue: { fontSize: '18px', fontWeight: '700', color: '#1a1a18' },
  suppliersBox: { padding: '14px 20px', background: '#fff', borderBottom: '1px solid #e8e4dc' },
  analysisLabel: {
    fontSize: '9px', fontWeight: '600', letterSpacing: '0.1em',
    color: '#aaa89f', marginBottom: '8px', textTransform: 'uppercase',
  },
  supplierRow: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '6px 0', borderBottom: '1px solid #f0ede6',
  },
  supplierName: { fontSize: '12px', color: '#1a1a18', flex: 1 },
  supplierPrice: { fontSize: '12px', fontWeight: '600', color: '#2d6a4f' },
  supplierLink: { fontSize: '11px', color: '#1a4060', textDecoration: 'none' },
  risksBox: { padding: '14px 20px', background: '#fffbf5', borderBottom: '1px solid #e8e4dc' },
  riskItem: { fontSize: '12px', color: '#8a6a00', marginBottom: '4px', lineHeight: '1.5' },
  nextStepsBox: { padding: '14px 20px', background: '#fff' },
  nextStepItem: {
    display: 'flex', gap: '10px', fontSize: '12px', color: '#1a1a18',
    marginBottom: '6px', lineHeight: '1.5', alignItems: 'flex-start',
  },
  stepNum: {
    background: '#1a1a18', color: '#fff', fontSize: '10px', fontWeight: '700',
    width: '18px', height: '18px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, borderRadius: '2px',
  },
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