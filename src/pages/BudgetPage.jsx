import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../components/common/Toast'
import BudgetProgress from '../components/budget/BudgetProgress'
import AlertHistoryList from '../components/budget/AlertHistoryList'
import {
  getBudgets,
  setBudget,
  deleteBudget,
  getAlertHistory,
  markAlertRead,
  getMonthlySpendByCategory,
} from '../services/budget.service'
import { EXPENSE_CATEGORIES } from '../constants/categories'
import { formatCurrency } from '../utils/formatCurrency'

const TABS = [
  { id: 'budgets', label: '📊 Budget Bulan Ini' },
  { id: 'history', label: '🔔 Riwayat Alert' },
]

const now   = new Date()
const MONTH = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })

function BudgetForm({ initial, onSave, onCancel }) {
  const [category, setCategory] = useState(initial?.category ?? EXPENSE_CATEGORIES[0].id)
  const [amount, setAmount]     = useState(initial?.amount ? String(initial.amount) : '')
  const [saving, setSaving]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) return
    setSaving(true)
    await onSave(category, parseFloat(amount))
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Kategori</label>
        <select
          className="form-input"
          value={category}
          onChange={e => setCategory(e.target.value)}
          disabled={!!initial}
        >
          {EXPENSE_CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Limit Budget</label>
        <div className="input-group">
          <span className="input-prefix">Rp</span>
          <input
            type="number"
            className="form-input input-with-prefix"
            placeholder="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            min="1"
            required
          />
        </div>
        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
          Alert dikirim saat 75%, 90%, dan 100% terpakai.
        </div>
      </div>
      <div className="flex gap-3 justify-end">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Batal</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Menyimpan...' : 'Simpan'}
        </button>
      </div>
    </form>
  )
}

export default function BudgetPage() {
  const { user }       = useAuth()
  const { showToast }  = useToast()
  const [tab, setTab]  = useState('budgets')

  const [budgets, setBudgets]   = useState([])
  const [spends, setSpends]     = useState({})
  const [alerts, setAlerts]     = useState([])
  const [loading, setLoading]   = useState(true)

  const [showForm, setShowForm]   = useState(false)
  const [editTarget, setEditTarget] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [b, s, a] = await Promise.all([
        getBudgets(user.id),
        getMonthlySpendByCategory(user.id),
        getAlertHistory(user.id),
      ])
      setBudgets(b)
      setSpends(s)
      setAlerts(a)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [user.id])

  useEffect(() => { load() }, [load])

  async function handleSave(category, amount) {
    try {
      await setBudget(user.id, category, amount)
      showToast('Budget berhasil disimpan!')
      setShowForm(false)
      setEditTarget(null)
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleDelete(id) {
    if (!confirm('Hapus budget ini?')) return
    try {
      await deleteBudget(id)
      showToast('Budget dihapus.', 'info')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function handleMarkRead(id) {
    await markAlertRead(id)
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read_at: new Date().toISOString() } : a))
  }

  function handleEdit(budget) {
    setEditTarget(budget)
    setShowForm(true)
  }

  const unreadCount = alerts.filter(a => !a.read_at).length

  return (
    <>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Budget</h1>
          <p className="page-subtitle">Kelola batas pengeluaran — {MONTH}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditTarget(null); setShowForm(true) }}>
          + Tambah Budget
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'history' && unreadCount > 0 && (
              <span style={{
                marginLeft: 6, background: '#EF4444', color: '#fff',
                borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 700,
              }}>
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : tab === 'budgets' ? (
        budgets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💰</div>
            <p className="empty-state-title">Belum ada budget</p>
            <p className="empty-state-desc">Tambah budget per kategori untuk mendapat alert otomatis</p>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Tambah Budget</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {budgets.map(b => (
              <BudgetProgress
                key={b.id}
                budget={b}
                spent={spends[b.category] ?? 0}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}

            <div className="card" style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>
                💡 Alert otomatis dikirim di <strong>75%</strong>, <strong>90%</strong>, dan <strong>100%</strong> penggunaan.
                Budget direset tiap bulan. Edit budget akan mereset semua flag alert.
              </div>
            </div>
          </div>
        )
      ) : (
        <AlertHistoryList alerts={alerts} onMarkRead={handleMarkRead} />
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editTarget ? 'Edit Budget' : 'Tambah Budget Baru'}
              </h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <BudgetForm
              initial={editTarget}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditTarget(null) }}
            />
          </div>
        </div>
      )}
    </>
  )
}
