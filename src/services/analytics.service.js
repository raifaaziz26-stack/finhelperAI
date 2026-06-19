import { supabase } from '../lib/supabase'
import { getCategoryById } from '../constants/categories'

export async function getMonthlyData(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, date')
    .eq('user_id', userId)
    .order('date', { ascending: true })
  if (error) throw error

  const monthly = {}
  data.forEach(t => {
    const key = t.date.slice(0, 7)
    if (!monthly[key]) monthly[key] = { month: key, income: 0, expense: 0 }
    if (t.type === 'income') monthly[key].income += Number(t.amount)
    else monthly[key].expense += Number(t.amount)
  })

  return Object.values(monthly).slice(-6).map(m => ({
    ...m,
    label: new Date(m.month + '-01').toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
  }))
}

export async function getExpenseBreakdown(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('amount, category, description')
    .eq('user_id', userId)
    .eq('type', 'expense')
  if (error) throw error

  const grouped = {}
  data.forEach(t => {
    const cat = getCategoryById(t.category, 'expense')
    const key = cat.label
    grouped[key] = (grouped[key] || 0) + Number(t.amount)
  })

  return Object.entries(grouped)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7)
}

export async function getBalanceTrend(userId) {
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount, date')
    .eq('user_id', userId)
    .order('date', { ascending: true })
  if (error) throw error

  let running = 0
  const daily = {}
  data.forEach(t => {
    running += t.type === 'income' ? Number(t.amount) : -Number(t.amount)
    daily[t.date] = running
  })

  return Object.entries(daily).map(([date, saldo]) => ({
    date: new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
    saldo,
  }))
}
