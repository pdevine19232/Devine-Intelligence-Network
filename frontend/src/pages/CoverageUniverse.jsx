/* eslint-disable react-hooks/exhaustive-deps */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function CoverageUniverse({ session, isAdmin }) {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState([])
  const [sectors, setSectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [addingTicker, setAddingTicker] = useState('')
  const [addingSector, setAddingSector] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [error, setError] = useState('')

  const API = process.env.REACT_APP_API_URL

  const getToken = async () => {
    const { data: { session: s } } = await supabase.auth.getSession()
    return s?.access_token
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API}/coverage/companies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setCompanies(data.companies || [])
      setSectors(data.sectors || [])
    } catch (e) {
      setError('Failed to load coverage universe')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleAdd = async () => {
    if (!addingTicker || !addingSector) return
    setAddLoading(true)
    setError('')
    try {
      const token = await getToken()
      const res = await fetch(`${API}/coverage/companies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ticker: addingTicker.toUpperCase(), sector: addingSector })
      })
      if (!res.ok) throw new Error('Failed to add company')
      setAddingTicker('')
      setAddingSector('')
      fetchData()
    } catch (e) {
      setError('Failed to add company. Check the ticker is valid.')
    } finally {
      setAddLoading(false)
    }
  }

  const handleDelete = async (ticker) => {
    if (!window.confirm(`Remove ${ticker} from coverage universe?`)) return
    try {
      const token = await getToken()
      await fetch(`${API}/coverage/companies/${ticker}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      fetchData()
    } catch (e) {
      setError('Failed to remove company')
    }
  }

  const groupedBySector = sectors.reduce((acc, sector) => {
    acc[sector.name] = {
      ...sector,
      companies: companies.filter(c => c.sector === sector.name)
    }
    return acc
  }, {})

  if (loading) return (
    <div style={s.container}>
      <div style={s.loading}>Loading coverage universe...</div>
    </div>
  )

  return (
    <div style={s.container}>

      <div style={s.topbar}>
        <div>
          <div style={s.eyebrow}>Devine Intelligence Network</div>
          <div style={s.pageTitle}>Coverage Universe</div>
        </div>
        <div style={s.topbarRight}>
          <button style={s.backBtn} onClick={() => navigate('/dashboard')}>
            ← Dashboard
          </button>
        </div>
      </div>

      {isAdmin && (
        <div style={s.addBar}>
          <div style={s.addBarLabel}>Add Company</div>
          <div style={s.addBarInputs}>
            <input
              style={s.addInput}
              placeholder="Ticker (e.g. AAPL)"
              value={addingTicker}
              onChange={e => setAddingTicker(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
            <select
              style={s.addSelect}
              value={addingSector}
              onChange={e => setAddingSector(e.target.value)}
            >
              <option value="">Select sector</option>
              {sectors.map(s_item => (
                <option key={s_item.name} value={s_item.name}>{s_item.name}</option>
              ))}
            </select>
            <button
              style={{ ...s.addBtn, opacity: addLoading ? 0.5 : 1 }}
              onClick={handleAdd}
              disabled={addLoading}
            >
              {addLoading ? 'Adding...' : 'Add'}
            </button>
          </div>
          {error && <div style={s.errorMsg}>{error}</div>}
        </div>
      )}

      <div style={s.content}>
        {Object.entries(groupedBySector).map(([sectorName, sectorData]) => (
          <div key={sectorName} style={s.sectorBlock}>

            <div style={s.sectorHeader}>
              <div style={s.sectorLeft}>
                <div style={s.sectorName}>{sectorName}</div>
                <div style={s.sectorIndex}>
                  Index: {sectorData.index_ticker} · {sectorData.index_name}
                </div>
              </div>
              <div style={s.sectorCount}>
                {sectorData.companies.length} companies
              </div>
            </div>

            <div style={s.companyGrid}>
              {sectorData.companies.length === 0 && (
                <div style={s.emptyState}>No companies in this sector yet.</div>
              )}
              {sectorData.companies.map(company => (
                <div
                  key={company.ticker}
                  style={s.companyCard}
                  onClick={() => navigate(`/coverage/${company.ticker}`)}
                >
                  <div style={s.cardTop}>
                    <div>
                      <div style={s.cardTicker}>{company.ticker}</div>
                      <div style={s.cardName}>{company.db_name || company.name}</div>
                    </div>
                    <div style={s.cardPriceBlock}>
                      <div style={s.cardPrice}>
                        {company.price ? `$${company.price}` : '—'}
                      </div>
                      <div style={{
                        ...s.cardChange,
                        color: company.change_pct >= 0 ? '#2a7a4a' : '#c0341a'
                      }}>
                        {company.change_pct != null
                          ? `${company.change_pct >= 0 ? '+' : ''}${company.change_pct.toFixed(2)}%`
                          : '—'}
                      </div>
                    </div>
                  </div>
                  <div style={s.cardDesc}>
                    {company.description
                      ? company.description.substring(0, 100) + '...'
                      : '—'}
                  </div>
                  <div style={s.cardFooter}>
                    <div style={s.cardViewBtn}>View →</div>
                    {isAdmin && (
                      <div
                        style={s.cardDeleteBtn}
                        onClick={e => { e.stopPropagation(); handleDelete(company.ticker) }}
                      >
                        Remove
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const s = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#faf9f6',
    fontFamily: "'DM Sans', Arial, sans-serif",
    color: '#1a1a18',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontSize: '13px',
    color: '#8a8880',
  },
  topbar: {
    padding: '24px 32px 20px',
    borderBottom: '1px solid #e8e4dc',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    background: '#fff',
  },
  eyebrow: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '9px',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#c8c4bc',
    marginBottom: '4px',
  },
  pageTitle: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#1a1a18',
    letterSpacing: '-0.02em',
  },
  topbarRight: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  backBtn: {
    background: 'transparent',
    border: '1px solid #e8e4dc',
    color: '#8a8880',
    padding: '8px 16px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  addBar: {
    padding: '16px 32px',
    borderBottom: '1px solid #e8e4dc',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  addBarLabel: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '9px',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    color: '#c8c4bc',
    flexShrink: 0,
  },
  addBarInputs: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flex: 1,
  },
  addInput: {
    padding: '8px 12px',
    border: '1px solid #e8e4dc',
    background: '#faf9f6',
    fontSize: '13px',
    color: '#1a1a18',
    fontFamily: "'DM Sans', Arial, sans-serif",
    width: '140px',
    outline: 'none',
  },
  addSelect: {
    padding: '8px 12px',
    border: '1px solid #e8e4dc',
    background: '#faf9f6',
    fontSize: '13px',
    color: '#1a1a18',
    fontFamily: "'DM Sans', Arial, sans-serif",
    outline: 'none',
    flex: 1,
    maxWidth: '320px',
  },
  addBtn: {
    background: '#1a1a18',
    color: '#faf9f6',
    border: 'none',
    padding: '8px 20px',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: '0.04em',
  },
  errorMsg: {
    fontSize: '12px',
    color: '#c0341a',
    width: '100%',
  },
  content: {
    padding: '28px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '36px',
  },
  sectorBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  sectorHeader: {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: '10px',
    borderBottom: '1px solid #e8e4dc',
  },
  sectorLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  sectorName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#1a1a18',
    letterSpacing: '-0.01em',
  },
  sectorIndex: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '9px',
    color: '#c8c4bc',
    letterSpacing: '0.08em',
  },
  sectorCount: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '9px',
    color: '#c8c4bc',
    letterSpacing: '0.08em',
  },
  companyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: '10px',
  },
  emptyState: {
    fontSize: '12px',
    color: '#c8c4bc',
    padding: '16px 0',
  },
  companyCard: {
    background: '#fff',
    border: '1px solid #e8e4dc',
    padding: '16px 18px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    transition: 'border-color 0.15s',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTicker: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '12px',
    fontWeight: '500',
    color: '#1a1a18',
    letterSpacing: '0.05em',
    marginBottom: '2px',
  },
  cardName: {
    fontSize: '12px',
    color: '#8a8880',
    lineHeight: '1.3',
    maxWidth: '160px',
  },
  cardPriceBlock: {
    textAlign: 'right',
    flexShrink: 0,
  },
  cardPrice: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '14px',
    fontWeight: '500',
    color: '#1a1a18',
    marginBottom: '2px',
  },
  cardChange: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '11px',
  },
  cardDesc: {
    fontSize: '11px',
    color: '#8a8880',
    lineHeight: '1.6',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '8px',
    borderTop: '1px solid #f0ede6',
    marginTop: 'auto',
  },
  cardViewBtn: {
    fontSize: '11px',
    color: '#1a1a18',
    fontWeight: '500',
    letterSpacing: '0.02em',
  },
  cardDeleteBtn: {
    fontSize: '10px',
    color: '#c8c4bc',
    cursor: 'pointer',
    letterSpacing: '0.04em',
  },
}