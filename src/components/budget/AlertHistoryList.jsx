import { formatCurrency } from '../../utils/formatCurrency'

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  if (min < 60)    return `${min}m lalu`
  const hrs = Math.floor(min / 60)
  if (hrs < 24)    return `${hrs}j lalu`
  return `${Math.floor(hrs / 24)}h lalu`
}

export default function AlertHistoryList({ alerts, onMarkRead }) {
  if (!alerts.length) {
    return (
      <div className="empty-state" style={{ padding: '24px 0' }}>
        <div className="empty-state-icon">🔔</div>
        <p className="empty-state-title">Belum ada alert</p>
        <p className="empty-state-desc">Alert muncul saat mendekati atau melampaui batas budget</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {alerts.map(a => {
        const isRead  = !!a.read_at
        const pct     = Math.round((a.spent_amount / a.budget_amount) * 100)
        const color   = a.threshold >= 100 ? '#EF4444' : a.threshold >= 90 ? '#F97316' : '#EAB308'

        return (
          <div key={a.id} style={{
            padding: '12px 16px',
            borderRadius: 8,
            border: `1px solid ${isRead ? '#E5E7EB' : color}30`,
            background: isRead ? '#F9FAFB' : '#FFF',
            opacity: isRead ? 0.7 : 1,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: isRead ? '#6B7280' : '#111827' }}>
                  {a.message}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                  {formatCurrency(a.spent_amount)} / {formatCurrency(a.budget_amount)}
                  {' '}
                  <span style={{ fontWeight: 700, color }}>({pct}%)</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>{relativeTime(a.sent_at)}</span>
                {!isRead && onMarkRead && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 10, padding: '1px 6px' }}
                    onClick={() => onMarkRead(a.id)}
                  >
                    Tandai dibaca
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
