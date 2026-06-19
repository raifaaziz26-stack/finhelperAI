import { useState, useRef, useEffect } from 'react'
import Layout from '../components/common/Layout'
import { useAuth } from '../store/AuthContext'

const SUGGESTIONS = [
  'Bagaimana cara menghemat pengeluaran bulanan?',
  'Berapa % penghasilan yang ideal untuk ditabung?',
  'Strategi investasi terbaik untuk pemula?',
  'Cara membuat anggaran yang efektif?',
]

const INITIAL = {
  id: 1, role: 'ai',
  text: 'Halo! Saya FinHelper AI, asisten keuangan pribadi Anda. 💰\n\nSaya bisa membantu Anda dengan:\n• Saran pengelolaan keuangan\n• Strategi menabung & investasi\n• Analisis kebiasaan belanja\n• Perencanaan budget bulanan\n\nAda yang ingin Anda tanyakan?',
  time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
}

export default function AIChatPage() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([INITIAL])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  const name = user?.user_metadata?.full_name || 'User'
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text) {
    if (!text.trim() || loading) return
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', text, time }])
    setInput('')
    setLoading(true)

    // Placeholder — integrate dengan Supabase Edge Function atau OpenAI API di sini
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'ai', time,
        text: 'Terima kasih atas pertanyaan Anda! 🤖\n\nFitur AI sedang dalam pengembangan dan akan segera hadir dengan kemampuan analisis keuangan yang lebih cerdas berdasarkan data transaksi Anda.\n\nUntuk sementara, Anda bisa mulai dengan mencatat transaksi harian di menu Transaksi untuk mendapatkan analisis di halaman Analisis.',
      }])
      setLoading(false)
    }, 1200)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">FinHelper GPT 🤖</h1>
        <p className="page-subtitle">Tanyakan apa saja tentang keuangan Anda</p>
      </div>

      <div className="card chat-layout">
        <div className="chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`chat-bubble ${msg.role === 'user' ? 'user' : 'ai'}`}>
              <div className={`chat-avatar-wrap ${msg.role === 'ai' ? 'chat-avatar-ai' : 'chat-avatar-user'}`}>
                {msg.role === 'ai' ? '🤖' : initials}
              </div>
              <div>
                <div className="chat-msg" style={{ whiteSpace: 'pre-line' }}>{msg.text}</div>
                <div className="chat-time">{msg.time}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="chat-bubble ai">
              <div className="chat-avatar-wrap chat-avatar-ai">🤖</div>
              <div className="card" style={{ padding: '10px 16px', border: '1px solid #E5E7EB' }}>
                <div className="chat-typing">
                  <div className="chat-dot" />
                  <div className="chat-dot" />
                  <div className="chat-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div>
          {messages.length === 1 && (
            <div className="chat-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} className="chat-suggestion-btn" onClick={() => sendMessage(s)}>{s}</button>
              ))}
            </div>
          )}
          <div className="chat-input-row">
            <textarea ref={textareaRef} className="chat-textarea"
              placeholder="Tanya apa pun tentang keuangan Anda... (Enter untuk kirim)"
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown} rows={1} />
            <button className="btn btn-primary"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}>
              ➤
            </button>
          </div>
        </div>
      </div>
    </Layout>
  )
}
