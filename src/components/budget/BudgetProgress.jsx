import { formatCurrency } from '../../utils/formatCurrency'

function level(pct) {
  if (pct >= 100) return { color: '#EF4444', bg: '#FEF2F2', bar: '#EF4444', label: 'Terlampaui', emoji: '❌' }
  if (pct >= 90)  return { color: '#F97316', bg: '#FFF7ED', bar: '#F97316', label: 'Hampir Penuh', emoji: '🔴' }
  if (pct >= 75)  return { color: '#EAB308', bg: '#FEFCE8', bar: '#EAB308', label: 'Hati-hati', emoji: '🟡' }
  return                 { color: '#10B981', bg: '#ECFDF5', bar: '#10B981', label: 'Aman', emoji: '✅' }
}

export default function BudgetProgress({ budget, spent, onEdit, onDelete }) {
  const pct       = budget.amount > 0 ? (spent / budget.amount) * 100 : 0
  const lv        = level(pct)
  const remaining = Math.max(budget.amount - spent, 0)
  const barWidth  = Math.min(pct, 100)

  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <div className="budget-card-top">
        <div style={{ fontWeight: 600, fontSize: 14, minWidth: 0 }}>
          {budget.category.charAt(0).toUpperCase() + budget.category.slice(1)}
        </div>
        <div className="budget-card-controls">
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px',
            borderRadius: 20, background: lv.bg, color: lv.color, whiteSpace: 'nowrap',
          }}>
            {lv.emoji} {lv.label}
          </span>
          {onEdit   && <button className="btn btn-secondary btn-sm" onClick={() => onEdit(budget)}>Edit</button>}
          {onDelete && <button className="btn btn-danger btn-sm"    onClick={() => onDelete(budget.id)}>×</button>}
        </div>
      </div>

      <div style={{ height: 8, borderRadius: 4, background: '#F3F4F6', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${barWidth}%`,
          background: lv.bar,
          transition: 'width 0.4s ease',
        }} />
      </div>

      <div className="budget-card-amounts">
        <span>{formatCurrency(spent)} terpakai</span>
        <span style={{ fontWeight: 600, color: lv.color }}>
          {Math.round(pct)}% · sisa {formatCurrency(remaining)}
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
        Limit: {formatCurrency(budget.amount)}
      </div>
    </div>
  )
}
