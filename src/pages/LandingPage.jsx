import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'

const features = [
  { icon: '📊', title: 'Smart Tracking',      desc: 'Lacak pengeluaran otomatis dengan kategorisasi cerdas' },
  { icon: '🤖', title: 'AI Budget Planning',  desc: 'Rekomendasi budget personal dari AI berdasarkan kebiasaanmu' },
  { icon: '🔔', title: 'Real-time Alerts',    desc: 'Notifikasi cerdas saat mendekati batas budget' },
  { icon: '💬', title: 'FinHelper GPT',       desc: 'Chatbot AI siap menjawab semua pertanyaan keuanganmu' },
  { icon: '🎯', title: 'Savings Goals',       desc: 'Tetapkan & capai target tabungan dengan rencana terstruktur' },
  { icon: '📈', title: 'Financial Reports',   desc: 'Laporan lengkap dengan visualisasi grafik interaktif' },
  { icon: '🆓', title: '100% Gratis',         desc: 'Semua fitur premium tersedia tanpa biaya apapun' },
  { icon: '🚫', title: 'Tanpa Iklan',         desc: 'Pengalaman bersih, fokus, tanpa gangguan iklan' },
]

const testimonials = [
  { name: 'Aldi R.', role: 'Mahasiswa UI', avatar: 'AR', color: '#2563EB', quote: '"FinHelper bantu aku atur uang kos dengan lebih bijak. Sekarang bisa nabung tiap bulan!"' },
  { name: 'Sari W.', role: 'Fresh Graduate', avatar: 'SW', color: '#10B981', quote: '"AI-nya keren! Bisa kasih saran budget yang beneran sesuai kondisi keuangan aku."' },
  { name: 'Budi S.', role: 'Mahasiswa ITB', avatar: 'BS', color: '#F59E0B', quote: '"Dashboard-nya simpel dan jelas. Langsung tau pengeluaran hari ini berapa."' },
]

export default function LandingPage() {
  const { user } = useAuth()
  if (user) return <Navigate to="/dashboard" replace />

  return (
    <div className="landing-page">
      {/* Navbar */}
      <nav className="landing-nav">
        <div className="landing-logo">
          <div className="landing-logo-icon">💰</div>
          <span className="landing-logo-text">FinHelper AI</span>
        </div>
        <div className="landing-nav-actions">
          <Link to="/login" className="btn btn-secondary btn-sm">Masuk</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Mulai Gratis</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg,#EFF6FF 0%,#fff 60%,#ECFDF5 100%)', padding: '0 80px' }}>
        <div className="hero">
          {/* Left */}
          <div>
            <div className="hero-badge">✨ AI-Powered Finance</div>
            <h1>Atur Keuangan<br /><span>Dengan Cerdas</span></h1>
            <p className="hero-desc">
              AI-powered budget planning untuk mahasiswa & fresh grad Indonesia. Lacak pengeluaran, rencanakan tabungan, dan dapatkan saran keuangan personal.
            </p>
            <div className="hero-actions">
              <Link to="/register" className="btn btn-primary btn-lg">Mulai Gratis</Link>
              <Link to="/login" className="btn btn-secondary btn-lg">Sudah punya akun</Link>
            </div>
          </div>

          {/* Right — mockup */}
          <div className="hero-visual">
            <div style={{ position: 'relative' }}>
              {/* float badges */}
              <div className="hero-float hero-float-1">📈 +Rp 500rb bulan ini</div>
              <div className="hero-float hero-float-2">🎯 Goal 82% tercapai</div>

              <div className="hero-mockup">
                <div className="hero-mockup-header">
                  <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>💰 FinHelper AI</span>
                  <span style={{ fontSize: 11, color: '#10B981', fontWeight: 600 }}>● Live</span>
                </div>
                <div className="hero-mockup-amount">Rp 4.200.000</div>
                <div className="hero-mockup-sub">Total Saldo · Juni 2025</div>
                <div className="hero-mockup-row">
                  <div className="hero-mockup-stat">
                    <div className="hero-mockup-stat-label">Pemasukan</div>
                    <div className="hero-mockup-stat-val" style={{ color: '#10B981' }}>Rp 2.5jt</div>
                  </div>
                  <div className="hero-mockup-stat">
                    <div className="hero-mockup-stat-label">Pengeluaran</div>
                    <div className="hero-mockup-stat-val" style={{ color: '#EF4444' }}>Rp 1.8jt</div>
                  </div>
                  <div className="hero-mockup-stat">
                    <div className="hero-mockup-stat-label">Tabungan</div>
                    <div className="hero-mockup-stat-val" style={{ color: '#2563EB' }}>Rp 700k</div>
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>Pengeluaran Terbaru</div>
                <div className="hero-mockup-items">
                  {[
                    { icon: '🍜', label: 'Makanan', amount: '-Rp 35k', color: '#FEF2F2', ic: '#F87171' },
                    { icon: '🚗', label: 'Transport', amount: '-Rp 25k', color: '#EFF6FF', ic: '#60A5FA' },
                    { icon: '🎮', label: 'Hiburan', amount: '-Rp 50k', color: '#F5F3FF', ic: '#A78BFA' },
                  ].map(item => (
                    <div key={item.label} className="hero-mockup-item">
                      <div className="hero-mockup-item-left">
                        <div className="hero-mockup-item-icon" style={{ background: item.color }}>{item.icon}</div>
                        {item.label}
                      </div>
                      <div className="hero-mockup-item-amount" style={{ color: '#EF4444' }}>{item.amount}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <div className="features-header">
          <h2>Mengapa Pilih FinHelper?</h2>
          <p>Fitur lengkap untuk membantu kamu mengelola keuangan pribadi dengan lebih cerdas</p>
        </div>
        <div className="features-grid">
          {features.map(f => (
            <div key={f.title} className="feature-card">
              <div className="feature-card-icon">{f.icon}</div>
              <div className="feature-card-title">{f.title}</div>
              <p className="feature-card-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <div className="testimonials-header">
          <h2>Dipercaya Ribuan Pengguna</h2>
          <p>Apa kata mereka tentang FinHelper AI</p>
        </div>
        <div className="testimonials-grid">
          {testimonials.map(t => (
            <div key={t.name} className="testimonial-card">
              <div className="testimonial-stars">★★★★★</div>
              <p className="testimonial-quote">{t.quote}</p>
              <div className="testimonial-user">
                <div className="testimonial-avatar" style={{ background: t.color }}>{t.avatar}</div>
                <div>
                  <div className="testimonial-name">{t.name}</div>
                  <div className="testimonial-role">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="landing-cta">
        <h2>Siap Mengatur Keuanganmu?</h2>
        <p>Bergabung gratis sekarang dan mulai perjalanan finansial yang lebih baik</p>
        <Link to="/register" className="btn btn-lg" style={{ background: '#fff', color: '#2563EB', fontWeight: 700 }}>
          Mulai Gratis Sekarang →
        </Link>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-brand">
          <span>💰</span> FinHelper AI
        </div>
        <div className="landing-footer-copy">© 2025 FinHelper AI. Made with ❤️ for Indonesian students.</div>
      </footer>
    </div>
  )
}
