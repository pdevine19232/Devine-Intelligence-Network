/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function Chat({ session }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('execution')
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [memories, setMemories] = useState([])
  const [memoriesLoading, setMemoriesLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const getToken = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    return currentSession?.access_token
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const userMessage = { role: 'user', content: input }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${process.env.REACT_APP_API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ messages: newMessages, mode })
      })
      const data = await res.json()
      setMessages([...newMessages, { role: 'assistant', content: data.response }])
    } catch (err) {
      console.error('Chat error:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchMemories = async () => {
    setMemoriesLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${process.env.REACT_APP_API_URL}/memories`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      setMemories(data.memories || [])
    } catch (err) {
      console.error('Memory fetch error:', err)
    } finally {
      setMemoriesLoading(false)
    }
  }

  const deleteMemory = async (id) => {
    try {
      const token = await getToken()
      await fetch(`${process.env.REACT_APP_API_URL}/memories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      setMemories(memories.filter(m => m.id !== id))
    } catch (err) {
      console.error('Memory delete error:', err)
    }
  }

  const openMemory = () => {
    setMemoryOpen(true)
    fetchMemories()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const switchMode = (newMode) => { setMode(newMode); setMessages([]) }

  const modeConfig = {
    execution: {
      label: 'Execution',
      description: 'Fast and direct. Ask it to do things.',
      placeholder: 'Draft an email, answer a question, run a calculation...',
      accent: '#1a1a18',
      lightAccent: '#f0ede6',
    },
    problem_solving: {
      label: 'Problem Solving',
      description: 'Expansive and Socratic. Think through complex problems.',
      placeholder: 'Describe a problem or idea you want to think through...',
      accent: '#1a4060',
      lightAccent: '#e8f0f8',
    }
  }

  const current = modeConfig[mode]

  const categoryConfig = {
    goal: { label: 'Goals', color: '#2d6a4f', bg: '#d8f3dc' },
    project: { label: 'Projects', color: '#1a4060', bg: '#dbeafe' },
    preference: { label: 'Preferences', color: '#6b4c11', bg: '#fef3c7' },
    decision: { label: 'Decisions', color: '#5b2333', bg: '#fde8ec' },
    fact: { label: 'Context', color: '#4a4840', bg: '#f0ede6' },
  }

  const groupedMemories = memories.reduce((acc, m) => {
    const cat = m.category || 'fact'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(m)
    return acc
  }, {})

  return (
    <div style={{ ...s.container, position: 'relative' }}>

      {/* ── HEADER ── */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div>
            <div style={s.headerTitle}>Strategos</div>
            <div style={s.headerSub}>Devine Intelligence Network</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Memory Button */}
          <button style={s.memoryBtn} onClick={openMemory}>
            <span style={{ marginRight: '5px' }}>◈</span> Memory
            {memories.length > 0 && (
              <span style={s.memoryCount}>{memories.length}</span>
            )}
          </button>
          {/* Mode Toggle */}
          <div style={s.modeToggle}>
            <button
              style={{
                ...s.modeBtn,
                background: mode === 'execution' ? current.accent : 'transparent',
                color: mode === 'execution' ? '#fff' : '#8a8880',
                borderColor: mode === 'execution' ? current.accent : '#e8e4dc',
              }}
              onClick={() => switchMode('execution')}
            >Execution</button>
            <button
              style={{
                ...s.modeBtn,
                background: mode === 'problem_solving' ? '#1a4060' : 'transparent',
                color: mode === 'problem_solving' ? '#fff' : '#8a8880',
                borderColor: mode === 'problem_solving' ? '#1a4060' : '#e8e4dc',
              }}
              onClick={() => switchMode('problem_solving')}
            >Problem Solving</button>
          </div>
        </div>
      </div>

      {/* ── MODE BAR ── */}
      <div style={{ ...s.modeBar, background: current.lightAccent, borderBottomColor: '#e8e4dc' }}>
        <div style={{ ...s.modeDot, background: current.accent }} />
        <span style={{ ...s.modeBarText, color: current.accent }}>{current.label} Mode</span>
        <span style={s.modeBarDesc}>{current.description}</span>
        {messages.length > 0 && (
          <button style={s.clearBtn} onClick={() => setMessages([])}>Clear conversation</button>
        )}
      </div>

      {/* ── MESSAGES ── */}
      <div style={s.messages}>
        {messages.length === 0 && (
          <div style={s.empty}>
            <div style={s.emptyTitle}>
              {mode === 'execution' ? 'What do you need done?' : 'What problem are we solving?'}
            </div>
            <div style={s.emptySub}>
              {mode === 'execution'
                ? 'Draft communications, answer questions, run through deal mechanics, summarize documents.'
                : 'Describe a problem, a half-formed idea, or something you want to think through differently.'}
            </div>
            <div style={s.suggestions}>
              {(mode === 'execution' ? [
                'Draft a follow-up email to a client after a pitch',
                'What EV/EBITDA multiples are typical for SaaS M&A?',
                'Summarize the key risks in a leveraged buyout',
                'Walk me through a DCF from first principles',
              ] : [
                'I want to build something but not sure where to start',
                'My workflow for document review feels inefficient',
                'How should I think about building my career at this stage?',
                'I have an idea for this platform I want to pressure-test',
              ]).map((s_item, i) => (
                <button key={i} style={s.suggestionBtn} onClick={() => setInput(s_item)}>
                  {s_item}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ ...s.messageRow, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'assistant' && <div style={s.agentLabel}>Strategos</div>}
            <div style={{
              ...s.bubble,
              ...(msg.role === 'user' ? s.userBubble : s.assistantBubble),
              ...(msg.role === 'assistant' && mode === 'problem_solving' ? s.psBubble : {})
            }}>{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ ...s.messageRow, justifyContent: 'flex-start' }}>
            <div style={s.agentLabel}>Strategos</div>
            <div style={{ ...s.bubble, ...s.assistantBubble }}>
              <div style={s.typingDots}>
                <span style={{ ...s.dot_anim, animationDelay: '0ms' }} />
                <span style={{ ...s.dot_anim, animationDelay: '150ms' }} />
                <span style={{ ...s.dot_anim, animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── INPUT ── */}
      <div style={s.inputArea}>
        <textarea
          style={s.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={current.placeholder}
          rows={2}
          disabled={loading}
        />
        <button
          style={{ ...s.sendBtn, background: current.accent, opacity: loading ? 0.4 : 1 }}
          onClick={sendMessage}
          disabled={loading}
        >↑</button>
      </div>

      {/* ── MEMORY PANEL ── */}
      {memoryOpen && (
        <>
          {/* Backdrop */}
          <div
            style={s.backdrop}
            onClick={() => setMemoryOpen(false)}
          />
          {/* Panel */}
          <div style={s.memoryPanel}>
            <div style={s.memoryHeader}>
              <div>
                <div style={s.memoryTitle}>Memory</div>
                <div style={s.memorySub}>What Strategos knows about you</div>
              </div>
              <button style={s.closeBtn} onClick={() => setMemoryOpen(false)}>✕</button>
            </div>

            <div style={s.memoryBody}>
              {memoriesLoading ? (
                <div style={s.memoryEmpty}>Loading memories...</div>
              ) : memories.length === 0 ? (
                <div style={s.memoryEmpty}>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>◈</div>
                  <div>No memories yet.</div>
                  <div style={{ fontSize: '11px', marginTop: '4px', color: '#aaa89f' }}>
                    Strategos will remember things as you chat.
                  </div>
                </div>
              ) : (
                Object.entries(categoryConfig).map(([cat, config]) => {
                  const items = groupedMemories[cat]
                  if (!items || items.length === 0) return null
                  return (
                    <div key={cat} style={s.memoryGroup}>
                      <div style={s.memoryGroupLabel}>
                        <span style={{
                          ...s.categoryBadge,
                          color: config.color,
                          background: config.bg,
                        }}>{config.label}</span>
                      </div>
                      {items.map(memory => (
                        <div key={memory.id} style={s.memoryItem}>
                          <div style={s.memoryContent}>{memory.content}</div>
                          <button
                            style={s.deleteBtn}
                            onClick={() => deleteMemory(memory.id)}
                            title="Delete memory"
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
            </div>

            {memories.length > 0 && (
              <div style={s.memoryFooter}>
                <button
                  style={s.clearAllBtn}
                  onClick={async () => {
                    if (window.confirm('Clear all memories? This cannot be undone.')) {
                      for (const m of memories) await deleteMemory(m.id)
                    }
                  }}
                >
                  Clear all memories
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const s = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#faf9f6',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  header: {
    padding: '18px 28px',
    borderBottom: '1px solid #e8e4dc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    background: '#fff',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  headerTitle: { fontSize: '15px', fontWeight: '600', color: '#1a1a18', letterSpacing: '-0.01em' },
  headerSub: { fontSize: '11px', color: '#aaa89f', marginTop: '1px', letterSpacing: '0.02em' },
  memoryBtn: {
    display: 'flex',
    alignItems: 'center',
    padding: '7px 12px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#4a4840',
    background: '#f0ede6',
    border: '1px solid #e8e4dc',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: '0.01em',
  },
  memoryCount: {
    marginLeft: '6px',
    background: '#1a1a18',
    color: '#fff',
    fontSize: '10px',
    padding: '1px 5px',
    borderRadius: '10px',
  },
  modeToggle: { display: 'flex', gap: '6px' },
  modeBtn: {
    padding: '7px 14px',
    fontSize: '12px',
    fontWeight: '500',
    border: '1px solid',
    cursor: 'pointer',
    fontFamily: "'DM Sans', Arial, sans-serif",
    letterSpacing: '0.01em',
    transition: 'all 0.15s',
  },
  modeBar: {
    padding: '8px 28px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid',
    flexShrink: 0,
  },
  modeDot: { width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0 },
  modeBarText: { fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' },
  modeBarDesc: { fontSize: '11px', color: '#8a8880', flex: 1 },
  clearBtn: {
    fontSize: '11px', color: '#aaa89f', background: 'none', border: 'none',
    cursor: 'pointer', fontFamily: "'DM Sans', Arial, sans-serif", textDecoration: 'underline',
  },
  messages: {
    flex: 1, overflowY: 'auto', padding: '32px 28px',
    display: 'flex', flexDirection: 'column', gap: '16px',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', height: '100%', textAlign: 'center',
    gap: '12px', maxWidth: '520px', margin: '0 auto',
  },
  emptyTitle: { fontSize: '20px', fontWeight: '600', color: '#1a1a18', letterSpacing: '-0.02em' },
  emptySub: { fontSize: '13px', color: '#8a8880', lineHeight: '1.7' },
  suggestions: { display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', marginTop: '8px' },
  suggestionBtn: {
    padding: '10px 16px', background: '#fff', border: '1px solid #e8e4dc',
    fontSize: '12px', color: '#4a4840', cursor: 'pointer', textAlign: 'left',
    fontFamily: "'DM Sans', Arial, sans-serif", lineHeight: '1.4',
  },
  messageRow: { display: 'flex', alignItems: 'flex-end', gap: '8px' },
  agentLabel: {
    fontSize: '9px', fontWeight: '600', letterSpacing: '0.12em',
    color: '#c8c4bc', flexShrink: 0, paddingBottom: '4px',
    fontFamily: "'DM Mono', monospace",
  },
  bubble: { maxWidth: '68%', padding: '12px 16px', fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap' },
  userBubble: { background: '#1a1a18', color: '#faf9f6', borderRadius: '2px 2px 0 2px' },
  assistantBubble: { background: '#fff', color: '#1a1a18', border: '1px solid #e8e4dc', borderRadius: '2px 2px 2px 0' },
  psBubble: { background: '#f0f4f8', borderColor: '#d0dce8' },
  typingDots: { display: 'flex', gap: '4px', alignItems: 'center', padding: '2px 0' },
  dot_anim: {
    width: '5px', height: '5px', borderRadius: '50%', background: '#c8c4bc',
    display: 'inline-block', animation: 'bounce 1.2s infinite ease-in-out',
  },
  inputArea: {
    padding: '16px 28px', borderTop: '1px solid #e8e4dc',
    display: 'flex', gap: '10px', alignItems: 'flex-end', flexShrink: 0, background: '#fff',
  },
  input: {
    flex: 1, background: '#faf9f6', border: '1px solid #e8e4dc',
    padding: '12px 16px', color: '#1a1a18', fontSize: '14px', resize: 'none',
    fontFamily: "'DM Sans', Arial, sans-serif", outline: 'none', lineHeight: '1.5',
  },
  sendBtn: {
    width: '42px', height: '42px', border: 'none', color: '#fff', fontSize: '18px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, fontFamily: "'DM Sans', Arial, sans-serif",
  },
  // Memory panel styles
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.2)', zIndex: 40,
  },
  memoryPanel: {
    position: 'fixed', top: 0, right: 0, bottom: 0, width: '360px',
    background: '#fff', borderLeft: '1px solid #e8e4dc',
    display: 'flex', flexDirection: 'column', zIndex: 50,
    boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
  },
  memoryHeader: {
    padding: '20px 24px', borderBottom: '1px solid #e8e4dc',
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    flexShrink: 0,
  },
  memoryTitle: { fontSize: '14px', fontWeight: '600', color: '#1a1a18' },
  memorySub: { fontSize: '11px', color: '#aaa89f', marginTop: '2px' },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '14px', color: '#8a8880', padding: '0',
    fontFamily: "'DM Sans', Arial, sans-serif",
  },
  memoryBody: { flex: 1, overflowY: 'auto', padding: '20px 24px' },
  memoryEmpty: {
    textAlign: 'center', color: '#8a8880', fontSize: '13px',
    padding: '40px 0',
  },
  memoryGroup: { marginBottom: '24px' },
  memoryGroupLabel: { marginBottom: '8px' },
  categoryBadge: {
    fontSize: '10px', fontWeight: '600', letterSpacing: '0.08em',
    textTransform: 'uppercase', padding: '3px 8px', borderRadius: '3px',
  },
  memoryItem: {
    display: 'flex', alignItems: 'flex-start', gap: '8px',
    padding: '10px 12px', background: '#faf9f6', border: '1px solid #e8e4dc',
    marginBottom: '6px',
  },
  memoryContent: { flex: 1, fontSize: '12px', color: '#4a4840', lineHeight: '1.6' },
  deleteBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: '#c8c4bc', fontSize: '11px', padding: '0', flexShrink: 0,
    fontFamily: "'DM Sans', Arial, sans-serif',",
    transition: 'color 0.1s',
  },
  memoryFooter: {
    padding: '16px 24px', borderTop: '1px solid #e8e4dc', flexShrink: 0,
  },
  clearAllBtn: {
    width: '100%', padding: '9px', background: 'none',
    border: '1px solid #e8e4dc', fontSize: '12px', color: '#8a8880',
    cursor: 'pointer', fontFamily: "'DM Sans', Arial, sans-serif",
  },
}