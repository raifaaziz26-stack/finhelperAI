import { useState, useEffect } from 'react'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../components/common/Toast'
import { getProfile, updateProfile } from '../services/auth.service'

export default function ProfilePage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [form, setForm] = useState({ full_name: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProfile(user.id)
      .then(p => setForm({ full_name: p.full_name || '' }))
      .catch(() => setForm({ full_name: user?.user_metadata?.full_name || '' }))
      .finally(() => setLoading(false))
  }, [user])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await updateProfile(user.id, { full_name: form.full_name })
      showToast('Profil berhasil diperbarui!')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const name = form.full_name || user?.email?.split('@')[0] || 'User'
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Profil Saya</h1>
        <p className="page-subtitle">Kelola informasi akun Anda</p>
      </div>

      <div style={{ maxWidth: 520 }}>
        {/* Profile card */}
        <div className="card mb-4">
          <div className="flex items-center gap-4" style={{ marginBottom: 24 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg,#2563EB,#7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 24, fontWeight: 700, flexShrink: 0,
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{name}</div>
              <div className="text-muted text-sm">{user?.email}</div>
              <div style={{ marginTop: 6 }}>
                <span className="badge badge-income">✓ Terverifikasi</span>
              </div>
            </div>
          </div>

          <hr className="divider" />

          <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="full_name">Nama Lengkap</label>
              <input id="full_name" type="text" className="form-input"
                value={form.full_name}
                onChange={e => setForm({ full_name: e.target.value })}
                placeholder="Nama lengkap Anda" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" value={user?.email} disabled
                style={{ background: '#F9FAFB', cursor: 'not-allowed', color: '#6B7280' }} />
              <p className="form-hint">Email tidak dapat diubah</p>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn btn-primary" disabled={saving || loading}>
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>

        {/* Account info */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Informasi Akun</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'User ID', val: user?.id?.slice(0, 8) + '...' },
              { label: 'Bergabung', val: user?.created_at ? new Date(user.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-' },
              { label: 'Status', val: '✓ Aktif' },
            ].map(item => (
              <div key={item.label} className="flex justify-between" style={{ fontSize: 13 }}>
                <span className="text-muted">{item.label}</span>
                <span style={{ fontWeight: 500 }}>{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
