import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'

export default function Company({ session }) {
  const { ticker } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const [data, setData] = useState(null)
  const [history, setHistory] = useState([])
  const [indexHistory, setIndexHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [period, setPeriod] = useState('1y')
  const [chartMode, setChartMode] = useState('price')
  const [showIndex, setShowIndex] = useState(false)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const chartParams = useRef({})
  const API = process.env.REACT_APP_API_URL

  const getToken = async () => {
    const { data: { session: cs } } = await supabase.auth.getSession()
    return cs?.access_token
  }

  const fetchCompanyDetail = async () => {
    const token = await getToken()
    const res = await fetch(`${API}/coverage/company/${ticker}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    return await res.json()
  }

  const fetchHistory = async (p, start, end) => {
    const token = await getToken()
    let url = `${API}/coverage/history/${ticker}?period=${p}`
    if (start && end) url += `&start=${start}&end=${end}`
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
    return await res.json()
  }

  const fetchIndexHistory = async (indexTicker, p, start, end) => {
    const token = await getToken()
    let url = `${API}/coverage/history/${indexTicker}?period=${p}`
    if (start && end) url += `&start=${start}&end=${end}`
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } })
    return await res.json()
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      try {
        const detailData = await fetchCompanyDetail()
        setData(detailData)
        const histData = await fetchHistory('1y')
        setHistory(histData.history || [])
        if (detailData.sector_data?.index_ticker) {
          const idxData = await fetchIndexHistory(detailData.sector_data.index_ticker, '1y')
          setIndexHistory(idxData.history || [])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [ticker])

  useEffect(() => {
    if (!data) return
    const reloadChart = async () => {
      setChartLoading(true)
      try {
        const histData = await fetchHistory(period)
        setHistory(histData.history || [])
        if (data.sector_data?.index_ticker) {
          const idxData = await fetchIndexHistory(data.sector_data.index_ticker, period)
          setIndexHistory(idxData.history || [])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setChartLoading(false)
      }
    }
    reloadChart()
  }, [period])

  useEffect(() => {
    if (history.length > 0) drawChart()
  }, [history, indexHistory, chartMode, showIndex])

  const applyCustomRange = async () => {
    if (!customStart || !customEnd || !data) return
    setChartLoading(true)
    try {
      const histData = await fetchHistory(period, customStart, customEnd)
      setHistory(histData.history || [])
      if (data.sector_data?.index_ticker) {
        const idxData = await fetchIndexHistory(data.sector_data.index_ticker, period, customStart, customEnd)
        setIndexHistory(idxData.history || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setChartLoading(false)
    }
  }

  const formatLabel = (val, mode) => {
    if (mode === 'indexed') return (val >= 0 ? '+' : '') + Math.round(val) + '%'
    if (val >= 1000) return '$' + (val / 1000).toFixed(1) + 'k'
    return '$' + val.toFixed(2)
  }

  const drawChart = (hoverX) => {
    const canvas = canvasRef.current
    if (!canvas || history.length === 0) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const PAD = { top: 28, right: 80, bottom: 48, left: 76 }
    const chartW = W - PAD.left - PAD.right
    const chartH = H - PAD.top - PAD.bottom

    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    const basePrice = history[0]?.close || 1
    const baseIndex = indexHistory[0]?.close || 1

    const mainData = history.map((d, i) => ({
      x: i / Math.max(history.length - 1, 1),
      y: chartMode === 'indexed' ? ((d.close / basePrice) - 1) * 100 : d.close,
      raw: d.close,
      date: d.date
    }))

    let indexData = []
    if (showIndex && indexHistory.length > 0) {
      indexData = indexHistory.map((d, i) => ({
        x: i / Math.max(indexHistory.length - 1, 1),
        y: chartMode === 'indexed'
          ? ((d.close / baseIndex) - 1) * 100
          : basePrice * (d.close / baseIndex),
        raw: d.close,
        date: d.date
      }))
    }

    const allY = [...mainData.map(d => d.y), ...(showIndex ? indexData.map(d => d.y) : [])]
    const rawMin = Math.min(...allY)
    const rawMax = Math.max(...allY)
    const padY = (rawMax - rawMin) * 0.1 || 1
    const yMin = rawMin - padY
    const yMax = rawMax + padY
    const yRange = yMax - yMin

    const toX = (x) => PAD.left + x * chartW
    const toY = (y) => PAD.top + chartH - ((y - yMin) / yRange) * chartH

    chartParams.current = { PAD, chartW, chartH, yMin, yMax, yRange, toX, toY, mainData, indexData, W, H }

    // Grid lines + Y axis labels
    ctx.strokeStyle = '#f0ede6'
    ctx.lineWidth = 1
    const gridCount = 5
    for (let i = 0; i <= gridCount; i++) {
      const cy = PAD.top + (chartH / gridCount) * i
      ctx.beginPath()
      ctx.moveTo(PAD.left, cy)
      ctx.lineTo(PAD.left + chartW, cy)
      ctx.stroke()
      const val = yMax - (yRange / gridCount) * i
      ctx.fillStyle = '#c8c4bc'
      ctx.font = '10px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(formatLabel(val, chartMode), PAD.left - 6, cy + 4)
    }

    // Start value label on Y axis (bold, dark)
    const startVal = mainData[0]?.y
    if (startVal !== undefined) {
      ctx.fillStyle = '#1a1a18'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(
        chartMode === 'indexed' ? '0%' : formatLabel(mainData[0].raw, 'price'),
        PAD.left - 6, toY(startVal) + 4
      )
    }

    // Main line fill
    ctx.fillStyle = 'rgba(26,26,24,0.04)'
    ctx.beginPath()
    mainData.forEach((d, i) => {
      i === 0 ? ctx.moveTo(toX(d.x), toY(d.y)) : ctx.lineTo(toX(d.x), toY(d.y))
    })
    ctx.lineTo(toX(1), toY(yMin))
    ctx.lineTo(toX(0), toY(yMin))
    ctx.closePath()
    ctx.fill()

    // Main line
    ctx.strokeStyle = '#1a1a18'
    ctx.lineWidth = 2
    ctx.beginPath()
    mainData.forEach((d, i) => {
      i === 0 ? ctx.moveTo(toX(d.x), toY(d.y)) : ctx.lineTo(toX(d.x), toY(d.y))
    })
    ctx.stroke()

    // End label for main line
    const me = mainData[mainData.length - 1]
    ctx.fillStyle = '#1a1a18'
    ctx.font = 'bold 10px monospace'
    ctx.textAlign = 'left'
    ctx.fillText(
      chartMode === 'indexed'
        ? (me.y >= 0 ? '+' : '') + Math.round(me.y) + '%'
        : formatLabel(me.raw, 'price'),
      toX(me.x) + 6, toY(me.y) + 4
    )

    // Index line
    if (showIndex && indexData.length > 0) {
      ctx.strokeStyle = '#c8a96e'
      ctx.lineWidth = 1.5
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      indexData.forEach((d, i) => {
        i === 0 ? ctx.moveTo(toX(d.x), toY(d.y)) : ctx.lineTo(toX(d.x), toY(d.y))
      })
      ctx.stroke()
      ctx.setLineDash([])

      const ie = indexData[indexData.length - 1]
      ctx.fillStyle = '#c8a96e'
      ctx.font = 'bold 10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(
        chartMode === 'indexed'
          ? (ie.y >= 0 ? '+' : '') + Math.round(ie.y) + '%'
          : formatLabel(ie.y, 'price'),
        toX(ie.x) + 6, toY(ie.y) + 14
      )
    }

    // X axis date labels
    const numLabels = Math.min(10, history.length)
    const step = Math.floor((history.length - 1) / (numLabels - 1)) || 1
    ctx.fillStyle = '#c8c4bc'
    ctx.font = '9px monospace'
    ctx.textAlign = 'center'
    for (let i = 0; i < history.length; i += step) {
      const d = history[i]
      const cx = toX(i / Math.max(history.length - 1, 1))
      const date = new Date(d.date)
      const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }).replace(' ', '-')
      ctx.fillText(label, cx, H - 12)
    }

    // Legend
    if (showIndex && data?.sector_data) {
      const lx = PAD.left + 10
      const ly = PAD.top + 14
      ctx.fillStyle = '#1a1a18'
      ctx.fillRect(lx, ly - 1, 16, 2)
      ctx.font = '10px monospace'
      ctx.textAlign = 'left'
      ctx.fillText(ticker, lx + 20, ly + 3)
      ctx.strokeStyle = '#c8a96e'
      ctx.setLineDash([5, 4])
      ctx.beginPath()
      ctx.moveTo(lx + 70, ly)
      ctx.lineTo(lx + 86, ly)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#c8a96e'
      ctx.fillText(data.sector_data.index_ticker, lx + 90, ly + 3)
    }

    // Hover crosshair
    if (hoverX !== undefined) {
      const { PAD: P, chartW: CW, chartH: CH } = chartParams.current
      if (hoverX >= P.left && hoverX <= P.left + CW) {
        const ratio = (hoverX - P.left) / CW
        const idx = Math.round(ratio * (mainData.length - 1))
        const clampedIdx = Math.max(0, Math.min(mainData.length - 1, idx))
        const point = mainData[clampedIdx]

        // Vertical line
        ctx.strokeStyle = 'rgba(26,26,24,0.15)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(toX(point.x), P.top)
        ctx.lineTo(toX(point.x), P.top + CH)
        ctx.stroke()
        ctx.setLineDash([])

        // Dot on main line
        ctx.fillStyle = '#1a1a18'
        ctx.beginPath()
        ctx.arc(toX(point.x), toY(point.y), 4, 0, Math.PI * 2)
        ctx.fill()

        // Index dot
        let idxPoint = null
        if (showIndex && indexData.length > 0) {
          const idxIdx = Math.max(0, Math.min(indexData.length - 1, clampedIdx))
          idxPoint = indexData[idxIdx]
          ctx.fillStyle = '#c8a96e'
          ctx.beginPath()
          ctx.arc(toX(idxPoint.x), toY(idxPoint.y), 4, 0, Math.PI * 2)
          ctx.fill()
        }

        // Callout box
        const mainValLabel = chartMode === 'indexed'
          ? (point.y >= 0 ? '+' : '') + point.y.toFixed(2) + '%'
          : '$' + point.raw.toFixed(2)
        const dateLabel = new Date(point.date).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        })
        const idxValLabel = idxPoint
          ? (chartMode === 'indexed'
            ? (idxPoint.y >= 0 ? '+' : '') + idxPoint.y.toFixed(2) + '%'
            : '$' + idxPoint.y.toFixed(2))
          : null

        const line1 = dateLabel
        const line2 = ticker + '   ' + mainValLabel
        const line3 = idxValLabel ? (data?.sector_data?.index_ticker || 'Index') + '   ' + idxValLabel : null
        const lines = line3 ? [line1, line2, line3] : [line1, line2]

        ctx.font = '11px monospace'
        const maxW = Math.max(...lines.map(l => ctx.measureText(l).width))
        const boxW = maxW + 24
        const boxH = lines.length * 18 + 14
        let boxX = toX(point.x) + 12
        if (boxX + boxW > W - 10) boxX = toX(point.x) - boxW - 12
        const boxY = P.top + 8

        ctx.fillStyle = '#1a1a18'
        ctx.fillRect(boxX, boxY, boxW, boxH)

        lines.forEach((line, i) => {
          if (i === 0) ctx.fillStyle = '#8a8880'
          else if (i === 1) ctx.fillStyle = '#ffffff'
          else ctx.fillStyle = '#c8a96e'
          ctx.textAlign = 'left'
          ctx.fillText(line, boxX + 12, boxY + 16 + i * 18)
        })
      }
    }
  }

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas || history.length === 0) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const mouseX = (e.clientX - rect.left) * scaleX
    drawChart(mouseX)
  }, [history, indexHistory, chartMode, showIndex, data])

  const handleMouseLeave = useCallback(() => {
    drawChart()
  }, [history, indexHistory, chartMode, showIndex, data])

  const formatDate = (ts) => {
    if (!ts) return ''
    return new Date(ts * 1000).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div style={st.container}>
        <div style={st.loading}>Loading {ticker}...</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div style={st.container}>
        <div style={st.loading}>Company not found.</div>
      </div>
    )
  }

  const { detail, news, db_company, sector_data, formatted_metrics } = data
  const changePositive = detail?.change_pct >= 0

  return (
    <div style={st.container}>

      <div style={st.topbar}>
        <div style={st.topbarLeft}>
          <button style={st.backBtn} onClick={() => navigate('/coverage')}>
            ← Coverage Universe
          </button>
          <div style={st.breadcrumb}>{db_company?.sector}</div>
        </div>
      </div>

      <div style={st.content}>

        <div style={st.companyHeader}>
          <div style={st.companyHeaderLeft}>
            <div style={st.tickerBadge}>{ticker}</div>
            <div>
              <div style={st.companyName}>{detail?.name || db_company?.name}</div>
              <div style={st.companyMeta}>{detail?.exchange} · {detail?.industry}</div>
            </div>
          </div>
          <div style={st.priceBlock}>
            <div style={st.price}>{detail?.price ? '$' + detail.price : '—'}</div>
            <div style={{
              ...st.change,
              color: changePositive ? '#2a7a4a' : '#c0341a',
              background: changePositive ? 'rgba(42,122,74,0.06)' : 'rgba(192,52,26,0.06)',
            }}>
              {detail?.change_pct != null
                ? (changePositive ? '+' : '') + detail.change_pct.toFixed(2) + '%'
                : '—'}
            </div>
          </div>
        </div>

        {db_company?.description && (
          <div style={st.description}>{db_company.description}</div>
        )}

        {formatted_metrics && Object.keys(formatted_metrics).length > 0 && (
          <div>
            <div style={st.sectionLabel}>Key Metrics</div>
            <div style={st.metricsGrid}>
              {Object.entries(formatted_metrics).map(([label, value]) => (
                <div key={label} style={st.metricCard}>
                  <div style={st.metricLabel}>{label}</div>
                  <div style={st.metricValue}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={st.chartSection}>
          <div style={st.chartControls}>
            <div style={st.periodBtns}>
              {['ytd', '1y', '3y', '5y', '10y'].map(p => (
                <button
                  key={p}
                  style={{
                    ...st.periodBtn,
                    background: period === p && !showCustom ? '#1a1a18' : 'transparent',
                    color: period === p && !showCustom ? '#fff' : '#8a8880',
                    borderColor: period === p && !showCustom ? '#1a1a18' : '#e8e4dc',
                  }}
                  onClick={() => { setShowCustom(false); setPeriod(p) }}
                >
                  {p.toUpperCase()}
                </button>
              ))}
              <button
                style={{
                  ...st.periodBtn,
                  background: showCustom ? '#1a1a18' : 'transparent',
                  color: showCustom ? '#fff' : '#8a8880',
                  borderColor: showCustom ? '#1a1a18' : '#e8e4dc',
                }}
                onClick={() => setShowCustom(!showCustom)}
              >
                Custom
              </button>
            </div>
            <div style={st.chartToggles}>
              <button
                style={{
                  ...st.toggleBtn,
                  background: chartMode === 'price' ? '#1a1a18' : 'transparent',
                  color: chartMode === 'price' ? '#fff' : '#8a8880',
                  borderColor: chartMode === 'price' ? '#1a1a18' : '#e8e4dc',
                }}
                onClick={() => setChartMode('price')}
              >
                Price
              </button>
              <button
                style={{
                  ...st.toggleBtn,
                  background: chartMode === 'indexed' ? '#1a1a18' : 'transparent',
                  color: chartMode === 'indexed' ? '#fff' : '#8a8880',
                  borderColor: chartMode === 'indexed' ? '#1a1a18' : '#e8e4dc',
                }}
                onClick={() => setChartMode('indexed')}
              >
                Performance
              </button>
              {sector_data && (
                <button
                  style={{
                    ...st.toggleBtn,
                    background: showIndex ? '#c8a96e' : 'transparent',
                    color: showIndex ? '#1a1a18' : '#8a8880',
                    borderColor: showIndex ? '#c8a96e' : '#e8e4dc',
                  }}
                  onClick={() => setShowIndex(!showIndex)}
                >
                  vs {sector_data.index_ticker}
                </button>
              )}
            </div>
          </div>

          {showCustom && (
            <div style={st.customRange}>
              <input
                style={st.dateInput}
                type="date"
                value={customStart}
                onChange={e => setCustomStart(e.target.value)}
              />
              <span style={st.dateSep}>to</span>
              <input
                style={st.dateInput}
                type="date"
                value={customEnd}
                onChange={e => setCustomEnd(e.target.value)}
              />
              <button style={st.applyBtn} onClick={applyCustomRange}>Apply</button>
            </div>
          )}

          {chartLoading && (
            <div style={st.chartLoadingBar}>Updating chart...</div>
          )}

          <div style={{ position: 'relative' }}>
            <canvas
              ref={canvasRef}
              width={900}
              height={320}
              style={st.canvas}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />
          </div>
        </div>

        {news && news.length > 0 && (
          <div>
            <div style={st.sectionLabel}>Recent News</div>
            <div style={st.newsList}>
              {news.map((item, i) => (
                <div key={i} style={st.newsItem}>
                  <a href={item.link} target="_blank" rel="noopener noreferrer" style={st.newsLink}>
                    <div style={st.newsTitle}>{item.title}</div>
                  </a>
                  <div style={st.newsMeta}>{item.publisher} · {formatDate(item.published)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

const st = {
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
    padding: '16px 32px',
    borderBottom: '1px solid #e8e4dc',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  backBtn: {
    background: 'transparent',
    border: '1px solid #e8e4dc',
    color: '#8a8880',
    padding: '7px 14px',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  breadcrumb: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '9px',
    color: '#c8c4bc',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  content: {
    padding: '28px 32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
    maxWidth: '1100px',
  },
  companyHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  companyHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  tickerBadge: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '13px',
    fontWeight: '500',
    color: '#1a1a18',
    background: '#f0ede6',
    padding: '6px 12px',
    letterSpacing: '0.08em',
    flexShrink: 0,
  },
  companyName: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#1a1a18',
    letterSpacing: '-0.02em',
    marginBottom: '3px',
  },
  companyMeta: {
    fontSize: '12px',
    color: '#8a8880',
  },
  priceBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  price: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '26px',
    fontWeight: '500',
    color: '#1a1a18',
  },
  change: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '13px',
    padding: '4px 10px',
    fontWeight: '500',
  },
  description: {
    fontSize: '13px',
    color: '#4a4840',
    lineHeight: '1.8',
    padding: '16px 20px',
    background: '#fff',
    border: '1px solid #e8e4dc',
    borderLeft: '2px solid #c8a96e',
  },
  sectionLabel: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '9px',
    fontWeight: '600',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    color: '#c8c4bc',
    marginBottom: '12px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '8px',
  },
  metricCard: {
    background: '#fff',
    border: '1px solid #e8e4dc',
    padding: '12px 16px',
  },
  metricLabel: {
    fontSize: '10px',
    color: '#8a8880',
    marginBottom: '4px',
    letterSpacing: '0.04em',
  },
  metricValue: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '15px',
    fontWeight: '500',
    color: '#1a1a18',
  },
  chartSection: {
    background: '#fff',
    border: '1px solid #e8e4dc',
    padding: '20px',
  },
  chartControls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  periodBtns: {
    display: 'flex',
    gap: '4px',
  },
  periodBtn: {
    padding: '5px 10px',
    fontSize: '11px',
    fontWeight: '500',
    border: '1px solid',
    cursor: 'pointer',
    fontFamily: "'DM Mono', monospace",
    letterSpacing: '0.05em',
  },
  chartToggles: {
    display: 'flex',
    gap: '4px',
  },
  toggleBtn: {
    padding: '5px 10px',
    fontSize: '11px',
    fontWeight: '500',
    border: '1px solid',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: '0.02em',
  },
  customRange: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    padding: '10px 0',
    borderTop: '1px solid #f0ede6',
  },
  dateInput: {
    padding: '6px 10px',
    border: '1px solid #e8e4dc',
    fontSize: '12px',
    color: '#1a1a18',
    background: '#faf9f6',
    fontFamily: "'DM Sans', Arial, sans-serif",
    outline: 'none',
  },
  dateSep: {
    fontSize: '11px',
    color: '#8a8880',
  },
  applyBtn: {
    background: '#1a1a18',
    color: '#faf9f6',
    border: 'none',
    padding: '6px 14px',
    fontSize: '11px',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  chartLoadingBar: {
    fontSize: '11px',
    color: '#8a8880',
    padding: '6px 0',
    fontFamily: "'DM Mono', monospace",
    letterSpacing: '0.06em',
  },
  canvas: {
    width: '100%',
    height: 'auto',
    display: 'block',
    cursor: 'crosshair',
  },
  newsList: {
    display: 'flex',
    flexDirection: 'column',
  },
  newsItem: {
    padding: '14px 0',
    borderBottom: '1px solid #f0ede6',
  },
  newsLink: {
    textDecoration: 'none',
  },
  newsTitle: {
    fontSize: '13px',
    color: '#1a1a18',
    lineHeight: '1.5',
    marginBottom: '4px',
    fontWeight: '500',
  },
  newsMeta: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '10px',
    color: '#c8c4bc',
    letterSpacing: '0.06em',
  },
}