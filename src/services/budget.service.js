import { supabase } from '../lib/supabase'

export async function getBudgets(userId) {
  const now = new Date()
  const { data, error } = await supabase
    .from('budgets')
    .select('*')
    .eq('user_id', userId)
    .eq('month', now.getMonth() + 1)
    .eq('year', now.getFullYear())
    .order('category')
  if (error) throw error
  return data
}

// Upsert budget for category in current month — resets alert flags on amount change
export async function setBudget(userId, category, amount) {
  const now = new Date()
  const { data, error } = await supabase
    .from('budgets')
    .upsert(
      {
        user_id: userId,
        category,
        amount,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        alert_75: false,
        alert_90: false,
        alert_100: false,
      },
      { onConflict: 'user_id,category,month,year' },
    )
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteBudget(id) {
  const { error } = await supabase.from('budgets').delete().eq('id', id)
  if (error) throw error
}

export async function getAlertHistory(userId, limit = 30) {
  const { data, error } = await supabase
    .from('alert_history')
    .select('*')
    .eq('user_id', userId)
    .order('sent_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function markAlertRead(id) {
  const { error } = await supabase
    .from('alert_history')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// Called after every expense transaction — invokes the Edge Function
export async function checkBudgetAlerts(userId, category, type) {
  try {
    const { data, error } = await supabase.functions.invoke('check-budget-alerts', {
      body: { user_id: userId, category, type },
    })
    if (error) console.error('[BudgetAlert] Edge Function error:', error)
    else console.debug('[BudgetAlert] result:', data)
  } catch (err) {
    console.error('[BudgetAlert] invoke failed:', err)
  }
}

// Get spending totals for the current month per category (for progress bars)
export async function getMonthlySpendByCategory(userId) {
  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEnd   = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('transactions')
    .select('category, amount')
    .eq('user_id', userId)
    .eq('type', 'expense')
    .gte('date', monthStart)
    .lt('date', monthEnd)

  if (error) throw error

  return (data ?? []).reduce((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + Number(t.amount)
    return acc
  }, {})
}
