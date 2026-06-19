import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/AuthContext'
import { signOut } from '../../services/auth.service'

const navItems = [
  { to: '/dashboard',    icon: '🏠', label: 'Dashboard' },
  { to: '/transactions', icon: '💳', label: 'Transaksi' },
  { to: '/analytics',   icon: '📊', label: 'Analisis' },
  { to: '/ai-chat',     icon: '🤖', label: 'AI Chat' },
  { to: '/profile',     icon: '👤', label: 'Profil' },
]

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  function handleNavClick() {
    if (onClose) onClose()
  }

  return (
    <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-inner">
          <div className="sidebar-logo">💰</div>
          <div>
            <div className="sidebar-name">FinHelper</div>
            <div className="sidebar-tagline">AI Finance</div>
          </div>
        </div>
        <button className="sidebar-close-btn" onClick={onClose} aria-label="Tutup menu">✕</button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section-label">Menu</div>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={handleNavClick}
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{name}</div>
            <div className="sidebar-user-email">{user?.email}</div>
          </div>
        </div>
        <button className="sidebar-item" onClick={handleLogout}>
          <span className="sidebar-item-icon">🚪</span>
          Logout
        </button>
      </div>
    </aside>
  )
}
