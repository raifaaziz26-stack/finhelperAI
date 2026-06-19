import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { signIn } from '../services/auth.service'
import { useAuth } from '../store/AuthContext'

export default function LoginPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(form.email, form.password)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">💰</div>
          <span className="auth-logo-name">FinHelper AI</span>
        </div>
        <h1 className="auth-title">Selamat Datang!</h1>
        <p className="auth-subtitle">Masuk untuk melanjutkan ke dashboard keuanganmu</p>

        {error && <div className="alert alert-error">⚠ {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="form-input"
              placeholder="nama@email.com" value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" className="form-input"
              placeholder="Minimal 6 karakter" value={form.password} onChange={handleChange} required />
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Memproses...' : 'Masuk →'}
          </button>
        </form>

        <div className="auth-link">
          Belum punya akun? <Link to="/register">Daftar gratis sekarang</Link>
        </div>
      </div>
    </div>
  )
}
