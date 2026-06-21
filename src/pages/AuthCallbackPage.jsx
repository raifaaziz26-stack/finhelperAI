import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    // Check if OAuth returned an error in the URL
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    const urlError = params.get('error_description') || hashParams.get('error_description')
    if (urlError) {
      setError(urlError)
      return
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        navigate('/dashboard', { replace: true })
      }
    })

    // getSession() triggers PKCE code exchange automatically
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) { setError(error.message); return }
      if (session) navigate('/dashboard', { replace: true })
    })

    // Fallback: if still stuck after 10 seconds, redirect to login
    const timeout = setTimeout(() => navigate('/login', { replace: true }), 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate])

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-logo">
          <div className="auth-logo-icon">💰</div>
          <span className="auth-logo-name">FinHelper AI</span>
        </div>
        {error ? (
          <>
            <p className="auth-subtitle" style={{ color: '#EF4444', marginBottom: 16 }}>
              Login gagal: {error}
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/login', { replace: true })}>
              Kembali ke Login
            </button>
          </>
        ) : (
          <>
            <p className="auth-subtitle">Memproses login Google...</p>
            <div className="spinner" style={{ margin: '16px auto' }} />
          </>
        )}
      </div>
    </div>
  )
}
