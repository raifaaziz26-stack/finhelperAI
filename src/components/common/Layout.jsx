import { useState } from 'react'
import Sidebar from './Sidebar'
import { useAuth } from '../../store/AuthContext'
import NotificationBell from '../budget/NotificationBell'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()

  return (
    <div className="app-layout">
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-wrapper">
        <div className="mobile-topbar">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Buka menu"
          >
            <span /><span /><span />
          </button>
          <div className="mobile-topbar-logo">💰 FinHelper AI</div>
          <NotificationBell userId={user?.id} />
        </div>

        <main className="main-content">{children}</main>
      </div>
    </div>
  )
}
