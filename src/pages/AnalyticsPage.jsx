import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts'
import { useAuth } from '../store/AuthContext'
import { getMonthlyData, getExpenseBreakdown, getBalanceTrend } from '../services/analytics.service'
import { formatCurrency } from '../utils/formatCurrency'

const PIE_COLORS = ['#F87171','#60A5FA','#A78BFA','#FB923C','#34D399','#F472B6','#FBBF24','#9CA3AF']

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:8, padding:'10px 14px', fontSize:12, boxShadow:'0 4px 6px rgba(0,0,0,0.08)' }}>
      {label && <p style={{ fontWeight:600, marginBottom:4, color:'#374151' }}>{label}</p>}
      {payload.map(p => (
        <p key={p.name} style={{ color:p.color || p.fill || '#2563EB' }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [monthly, setMonthly] = useState([])
  const [breakdown, setBreakdown] = useState([])
  const [trend, setTrend] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [m, b, t] = await Promise.all([
          getMonthlyData(user.id),
          getExpenseBreakdown(user.id),
          getBalanceTrend(user.id),
        ])
        setMonthly(m)
        setBreakdown(b)
        setTrend(t)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  const totalExpense = breakdown.reduce((s, d) => s + d.value, 0)

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  if (monthly.length === 0) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">Analisis Pengeluaran</h1>
        </div>
        <div className="card empty-state">
          <div className="empty-state-icon">📊</div>
          <p className="empty-state-title">Belum ada data transaksi</p>
          <p className="empty-state-desc">Tambahkan transaksi untuk melihat analisis keuangan Anda</p>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">Analisis Pengeluaran</h1>
        <p className="page-subtitle">Visualisasi pola keuangan Anda</p>
      </div>

      {/* Bar chart — full width */}
      <div className="card mb-5">
        <h3 style={{ fontSize:15, fontWeight:700, marginBottom:20 }}>Pemasukan vs Pengeluaran (6 Bulan)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthly} barCategoryGap="35%">
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="label" tick={{ fontSize:12, fill:'#6B7280', fontFamily:'Poppins' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize:11, fill:'#6B7280', fontFamily:'Poppins' }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : `${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="income" name="Pemasukan" fill="#10B981" radius={[6,6,0,0]} />
            <Bar dataKey="expense" name="Pengeluaran" fill="#EF4444" radius={[6,6,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="analytics-grid">
        {/* Donut breakdown */}
        <div className="card">
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Breakdown Pengeluaran</h3>
          {breakdown.length === 0 ? (
            <p className="text-muted text-sm">Belum ada pengeluaran tercatat.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={breakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={75}
                    dataKey="value" nameKey="name" paddingAngle={3}>
                    {breakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
                {breakdown.map((d, i) => (
                  <div key={d.name} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div style={{ width:10, height:10, borderRadius:'50%', background:PIE_COLORS[i % PIE_COLORS.length], flexShrink:0 }} />
                      <span style={{ fontSize:13 }}>{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize:13, fontWeight:600 }}>{formatCurrency(d.value)}</span>
                      <span className="text-sm text-muted">
                        {totalExpense > 0 ? `${((d.value/totalExpense)*100).toFixed(0)}%` : '0%'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Line — balance trend */}
        <div className="card">
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Tren Saldo</h3>
          {trend.length < 2 ? (
            <p className="text-muted text-sm">Butuh minimal 2 transaksi untuk melihat tren.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="date" tick={{ fontSize:11, fill:'#6B7280', fontFamily:'Poppins' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize:11, fill:'#6B7280', fontFamily:'Poppins' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}jt` : `${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="saldo" name="Saldo" stroke="#2563EB" strokeWidth={2.5} dot={false} activeDot={{ r:5, fill:'#2563EB' }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  )
}
