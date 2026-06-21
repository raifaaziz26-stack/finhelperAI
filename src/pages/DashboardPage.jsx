import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useAuth } from '../store/AuthContext'
import { getSummary, getTransactions } from '../services/transactions.service'
import { getExpenseBreakdown } from '../services/analytics.service'
import { formatCurrency, formatDate } from '../utils/formatCurrency'
import { getCategoryById } from '../constants/categories'

const PIE_COLORS = ['#F87171','#60A5FA','#A78BFA','#FB923C','#34D399','#F472B6','#FBBF24','#9CA3AF']

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'10px 14px', fontSize:12 }}>
      <p style={{ fontWeight:600 }}>{payload[0].name}</p>
      <p style={{ color:payload[0].payload.fill }}>{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0 })
  const [transactions, setTransactions] = useState([])
  const [breakdown, setBreakdown] = useState([])
  const [loading, setLoading] = useState(true)

  const name = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const firstName = name.split(' ')[0]

  useEffect(() => {
    async function load() {
      try {
        const [s, t, b] = await Promise.all([
          getSummary(user.id),
          getTransactions(user.id),
          getExpenseBreakdown(user.id),
        ])
        setSummary(s)
        setTransactions(t.slice(0, 7))
        setBreakdown(b)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const stats = [
    { label: 'Pendapatan Bulan Ini', amount: summary.income, icon: '💰', bg: '#ECFDF5', color: '#10B981', sub: 'Total pemasukan' },
    { label: 'Total Pengeluaran', amount: summary.expense, icon: '💸', bg: '#FEF2F2', color: '#EF4444', sub: 'Total pengeluaran' },
    { label: 'Sisa Saldo', amount: summary.balance, icon: '🏦', bg: '#EFF6FF', color: '#2563EB', sub: 'Saldo tersisa' },
  ]

  return (
    <>
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Hi, {firstName}! 👋</h1>
          <p className="page-subtitle">Berikut ringkasan keuangan Anda hari ini</p>
        </div>
        <div className="flex gap-2">
          <Link to="/transactions" className="btn btn-primary">+ Catat Transaksi</Link>
          <Link to="/ai-chat" className="btn btn-secondary">🤖 Tanya AI</Link>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon-wrap" style={{ background: s.bg }}>
              {s.icon}
            </div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-amount" style={{ color: s.color }}>
              {loading ? '—' : formatCurrency(s.amount)}
            </div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts + Transactions */}
      <div className="dashboard-main-grid">
        {/* Pie Chart */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Pengeluaran per Kategori</h3>
          </div>
          {loading ? (
            <div className="empty-state"><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : breakdown.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-state-icon">📊</div>
              <p className="text-muted text-sm">Belum ada pengeluaran</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={breakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    dataKey="value" nameKey="name" paddingAngle={3}>
                    {breakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {breakdown.map((d, i) => (
                  <div key={d.name} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span style={{ fontSize: 12, color: '#374151' }}>{d.name}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Recent Transactions */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Transaksi Terbaru</h3>
            <Link to="/transactions" className="btn btn-secondary btn-sm">Lihat Semua</Link>
          </div>

          {loading ? (
            <p className="text-muted text-sm">Memuat data...</p>
          ) : transactions.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 0' }}>
              <div className="empty-state-icon">💳</div>
              <p className="empty-state-title">Belum ada transaksi</p>
              <Link to="/transactions" className="btn btn-primary btn-sm">Catat sekarang</Link>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Deskripsi</th>
                    <th className="table-hide-mobile">Kategori</th>
                    <th>Tanggal</th>
                    <th style={{ textAlign: 'right' }}>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(t => {
                    const cat = getCategoryById(t.category, t.type)
                    return (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 500 }}>{t.description || '-'}</td>
                        <td className="table-hide-mobile">
                          <span className="cat-chip" style={{ background: cat.bg, color: cat.color }}>
                            {cat.icon} {cat.label}
                          </span>
                        </td>
                        <td className="text-muted">{formatDate(t.date)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`amount-${t.type}`}>
                            {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
