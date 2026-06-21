import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { signUp, signInWithGoogle } from '../services/auth.service'
import { useAuth } from '../store/AuthContext'

export default function RegisterPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleGoogleLogin() {
    setError('')
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message)
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signUp(form.email, form.password, form.fullName)
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
        <h1 className="auth-title">Buat Akun Gratis</h1>
        <p className="auth-subtitle">Mulai kelola keuanganmu dengan lebih cerdas bersama AI</p>

        {error && <div className="alert alert-error">⚠ {error}</div>}

        <button
          type="button"
          className="btn btn-google btn-full btn-lg"
          onClick={handleGoogleLogin}
          disabled={googleLoading || loading}
        >
          <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
            <path d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.6 20-21 0-1.4-.1-2.7-.5-4z" fill="#FFC107"/>
            <path d="M6.3 14.7l7 5.1C15 16.1 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 16.3 3 9.7 7.9 6.3 14.7z" fill="#FF3D00"/>
            <path d="M24 45c5.8 0 10.7-1.9 14.7-5.2l-6.8-5.5C29.9 35.9 27.1 37 24 37c-5.9 0-10.7-3.9-11.8-9.1l-7 5.4C9.3 41 16.1 45 24 45z" fill="#4CAF50"/>
            <path d="M44.5 20H24v8.5h11.8c-.8 2.5-2.4 4.6-4.5 6l6.8 5.5C42 37.1 45 31.5 45 24c0-1.4-.1-2.7-.5-4z" fill="#1976D2"/>
          </svg>
          {googleLoading ? 'Mengarahkan...' : 'Daftar dengan Google'}
        </button>

        <div className="auth-divider"><span>atau daftar dengan email</span></div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="fullName">Nama Lengkap</label>
            <input id="fullName" name="fullName" type="text" className="form-input"
              placeholder="John Doe" value={form.fullName} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" className="form-input"
              placeholder="nama@email.com" value={form.email} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" className="form-input"
              placeholder="Minimal 6 karakter" value={form.password} onChange={handleChange}
              minLength={6} required />
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? 'Membuat akun...' : 'Buat Akun Gratis →'}
          </button>
        </form>

        <div className="auth-link">
          Sudah punya akun? <Link to="/login">Masuk di sini</Link>
        </div>
      </div>
    </div>
  )
}
