import { useEffect, useState } from 'react'
import Layout from '../components/common/Layout'
import { useAuth } from '../store/AuthContext'
import { useToast } from '../components/common/Toast'
import { getTransactions, addTransaction, deleteTransaction } from '../services/transactions.service'
import { formatCurrency, formatDate } from '../utils/formatCurrency'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getCategoryById } from '../constants/categories'

const defaultForm = {
  type: 'expense',
  amount: '',
  category: 'food',
  description: '',
  date: new Date().toISOString().split('T')[0],
}

export default function TransactionsPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(defaultForm)
  const [submitting, setSubmitting] = useState(false)

  const categories = form.type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  async function load() {
    setLoading(true)
    try {
      setTransactions(await getTransactions(user.id))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [user])

  function handleChange(e) {
    const { name, value } = e.target
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'type' ? { category: value === 'expense' ? 'food' : 'salary' } : {}),
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await addTransaction({
        user_id: user.id,
        type: form.type,
        amount: parseFloat(form.amount),
        category: form.category,
        description: form.description,
        date: form.date,
      })
      setShowModal(false)
      setForm(defaultForm)
      showToast('Transaksi berhasil disimpan!')
      load()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Hapus transaksi ini?')) return
    await deleteTransaction(id)
    showToast('Transaksi dihapus.', 'info')
    load()
  }

  const filtered = filter === 'all' ? transactions : transactions.filter(t => t.type === filter)
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0)

  return (
    <Layout>
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Transaksi</h1>
          <p className="page-subtitle">Kelola semua pemasukan dan pengeluaran Anda</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Catat Transaksi</button>
      </div>

      {/* Summary row */}
      <div className="flex gap-3 mb-5 tx-summary-row">
        <div className="card flex-1" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>TOTAL PEMASUKAN</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#10B981' }}>{formatCurrency(totalIncome)}</div>
        </div>
        <div className="card flex-1" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>TOTAL PENGELUARAN</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#EF4444' }}>{formatCurrency(totalExpense)}</div>
        </div>
        <div className="card flex-1" style={{ padding: '14px 18px' }}>
          <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 4 }}>SALDO</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#2563EB' }}>{formatCurrency(totalIncome - totalExpense)}</div>
        </div>
      </div>

      <div className="card">
        <div className="filters-row">
          {[
            { val: 'all', label: 'Semua' },
            { val: 'income', label: '📈 Pemasukan' },
            { val: 'expense', label: '📉 Pengeluaran' },
          ].map(f => (
            <button key={f.val}
              className={`btn btn-sm ${filter === f.val ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f.val)}>
              {f.label}
            </button>
          ))}
          <span className="filter-count">{filtered.length} transaksi</span>
        </div>

        {loading ? (
          <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💳</div>
            <p className="empty-state-title">Belum ada transaksi</p>
            <p className="empty-state-desc">Mulai catat pengeluaran atau pemasukan Anda</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Catat Sekarang</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Deskripsi</th>
                  <th className="table-hide-mobile">Kategori</th>
                  <th className="table-hide-mobile">Tipe</th>
                  <th>Tanggal</th>
                  <th style={{ textAlign: 'right' }}>Jumlah</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const cat = getCategoryById(t.category, t.type)
                  return (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 500 }}>{t.description || '-'}</td>
                      <td className="table-hide-mobile">
                        <span className="cat-chip" style={{ background: cat.bg, color: cat.color }}>
                          {cat.icon} {cat.label}
                        </span>
                      </td>
                      <td className="table-hide-mobile">
                        <span className={`badge badge-${t.type}`}>
                          {t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}
                        </span>
                      </td>
                      <td className="text-muted">{formatDate(t.date)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span className={`amount-${t.type}`}>
                          {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>Hapus</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Catat Transaksi</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Type toggle */}
              <div className="form-group">
                <label className="form-label">Tipe</label>
                <div className="flex gap-2">
                  {['expense', 'income'].map(t => (
                    <button key={t} type="button"
                      className={`btn flex-1 ${form.type === t
                        ? t === 'income' ? 'btn-green' : 'btn-danger'
                        : 'btn-secondary'}`}
                      onClick={() => setForm(p => ({ ...p, type: t, category: t === 'expense' ? 'food' : 'salary' }))}>
                      {t === 'income' ? '📈 Pemasukan' : '📉 Pengeluaran'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount */}
              <div className="form-group">
                <label className="form-label">Jumlah *</label>
                <div className="input-group">
                  <span className="input-prefix">Rp</span>
                  <input name="amount" type="number" className="form-input input-with-prefix"
                    placeholder="0" value={form.amount} onChange={handleChange} min="1" required />
                </div>
              </div>

              {/* Category */}
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <div className="category-grid">
                  {categories.map(cat => (
                    <button key={cat.id} type="button"
                      className={`category-btn${form.category === cat.id ? ' selected' : ''}`}
                      onClick={() => setForm(p => ({ ...p, category: cat.id }))}>
                      <span className="category-btn-icon">{cat.icon}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Catatan <span style={{ fontWeight: 400, textTransform: 'none' }}>(opsional)</span></label>
                <input name="description" type="text" className="form-input"
                  placeholder="e.g., Beli kopi di Starbucks" value={form.description} onChange={handleChange}
                  maxLength={200} />
              </div>

              {/* Date */}
              <div className="form-group">
                <label className="form-label">Tanggal *</label>
                <input name="date" type="date" className="form-input"
                  value={form.date} onChange={handleChange} required />
              </div>

              <div className="flex gap-3 justify-end">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
