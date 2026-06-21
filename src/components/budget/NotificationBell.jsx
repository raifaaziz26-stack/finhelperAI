import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../common/Toast'
import { useBudgetAlerts } from '../../hooks/useBudgetAlerts'
import { getAlertHistory, markAlertRead } from '../../services/budget.service'
import { formatCurrency } from '../../utils/formatCurrency'

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 1)  return 'Baru saja'
  if (min < 60) return `${min}m lalu`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}j lalu`
  return `${Math.floor(hrs / 24)}h lalu`
}

function thresholdColor(threshold) {
  if (threshold >= 100) return '#EF4444'
  if (threshold >= 90)  return '#F97316'
  return '#EAB308'
}

export default function NotificationBell({ userId }) {
  const { showToast }  = useToast()
  const [alerts, setAlerts] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef(null)

  // Load history from DB on mount
  useEffect(() => {
    if (!userId) return
    getAlertHistory(userId, 25).then(setAlerts).catch(() => {})
  }, [userId])

  // Close when clicking outside the panel
  useEffect(() => {
    function onClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Real-time: new alert arrives from Edge Function
  const handleAlert = useCallback((payload) => {
    showToast(`${payload.emoji} ${payload.title}`, 'info')
    setAlerts(prev => [{
      id:            `live-${Date.now()}`,
      message:       `${payload.emoji} ${payload.title}`,
      category:      payload.category,
      threshold:     payload.threshold,
      spent_amount:  payload.spent,
      budget_amount: payload.budget,
      sent_at:       new Date().toISOString(),
      read_at:       null,
    }, ...prev])
  }, [showToast])

  useBudgetAlerts(userId, handleAlert)

  const unread = alerts.filter(a => !a.read_at).length

  async function handleMarkRead(id) {
    if (!String(id).startsWith('live-')) {
      await markAlertRead(id).catch(() => {})
    }
    setAlerts(prev => prev.map(a =>
      a.id === id ? { ...a, read_at: new Date().toISOString() } : a
    ))
  }

  async function markAllRead() {
    const ids = alerts.filter(a => !a.read_at && !String(a.id).startsWith('live-')).map(a => a.id)
    await Promise.all(ids.map(id => markAlertRead(id).catch(() => {})))
    const now = new Date().toISOString()
    setAlerts(prev => prev.map(a => ({ ...a, read_at: a.read_at ?? now })))
  }

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label="Notifikasi"
        style={{
          position: 'relative',
          background: isOpen ? '#F3F4F6' : 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px 8px',
          borderRadius: 8,
          fontSize: 18,
          lineHeight: 1,
          transition: 'background 0.15s',
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute',
            top: 2, right: 2,
            background: '#EF4444',
            color: '#fff',
            borderRadius: '50%',
            fontSize: 9,
            fontWeight: 700,
            minWidth: 15,
            height: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="notif-panel">
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #F3F4F6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <span style={{ fontWeight: 700, fontSize: 13 }}>
              🔔 Notifikasi Budget
              {unread > 0 && (
                <span style={{
                  marginLeft: 6,
                  background: '#EF4444', color: '#fff',
                  borderRadius: 10, fontSize: 10,
                  padding: '1px 6px', fontWeight: 700,
                }}>
                  {unread} baru
                </span>
              )}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  fontSize: 11, color: '#6B7280',
                  background: 'none', border: 'none',
                  cursor: 'pointer', textDecoration: 'underline',
                }}
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          {/* Alert list */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {alerts.length === 0 ? (
              <div style={{
                padding: '36px 16px',
                textAlign: 'center',
                color: '#9CA3AF',
                fontSize: 13,
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔕</div>
                Belum ada notifikasi budget.
                <br />
                <span style={{ fontSize: 11 }}>
                  Atur budget di halaman Budget terlebih dahulu.
                </span>
              </div>
            ) : (
              alerts.map(a => {
                const isRead = !!a.read_at
                const color  = thresholdColor(a.threshold)
                return (
                  <div
                    key={a.id}
                    onClick={() => !isRead && handleMarkRead(a.id)}
                    style={{
                      padding: '10px 14px 10px 12px',
                      borderBottom: '1px solid #F9FAFB',
                      background: isRead ? '#FAFAFA' : '#FFFBF0',
                      cursor: isRead ? 'default' : 'pointer',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Unread dot */}
                    <div style={{
                      width: 7, height: 7,
                      borderRadius: '50%',
                      background: isRead ? 'transparent' : color,
                      flexShrink: 0,
                      marginTop: 5,
                    }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 12,
                        fontWeight: isRead ? 400 : 600,
                        color: isRead ? '#6B7280' : '#111827',
                        lineHeight: 1.4,
                      }}>
                        {a.message}
                      </div>
                      {a.spent_amount != null && (
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                          {formatCurrency(a.spent_amount)} / {formatCurrency(a.budget_amount)}
                        </div>
                      )}
                      <div style={{ fontSize: 10, color: '#C4C4C4', marginTop: 3 }}>
                        {relativeTime(a.sent_at)}
                        {!isRead && (
                          <span style={{ color: color, fontWeight: 600, marginLeft: 6 }}>
                            • Klik untuk tandai dibaca
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid #F3F4F6',
            textAlign: 'center',
            flexShrink: 0,
          }}>
            <Link
              to="/budget"
              onClick={() => setIsOpen(false)}
              style={{ fontSize: 12, color: '#6366F1', fontWeight: 600, textDecoration: 'none' }}
            >
              Kelola budget & riwayat alert →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
