import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Check highest threshold first so only one alert fires per transaction
const THRESHOLDS = [100, 90, 75] as const

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (n >= 1_000) return `${Math.round(n / 1_000)}rb`
  return String(Math.round(n))
}

function daysLeft(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const { user_id, category, type } = await req.json()

    if (type !== 'expense') {
      return json({ checked: false, reason: 'not_expense' })
    }

    const now = new Date()
    const month = now.getMonth() + 1
    const year  = now.getFullYear()

    const { data: budget } = await supabase
      .from('budgets')
      .select('*')
      .eq('user_id', user_id)
      .eq('category', category)
      .eq('month', month)
      .eq('year', year)
      .single()

    if (!budget) return json({ checked: false, reason: 'no_budget' })

    // Sum all expense transactions for this category this month
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd   = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const { data: rows } = await supabase
      .from('transactions')
      .select('amount')
      .eq('user_id', user_id)
      .eq('category', category)
      .eq('type', 'expense')
      .gte('date', monthStart)
      .lt('date', monthEnd)

    const totalSpent = (rows ?? []).reduce((s, t) => s + Number(t.amount), 0)
    const budgetAmt  = Number(budget.amount)
    const pct        = (totalSpent / budgetAmt) * 100

    const alertsSent: number[] = []

    for (const threshold of THRESHOLDS) {
      if (pct < threshold) continue
      if (budget[`alert_${threshold}`]) continue // already sent this month

      const catLabel  = category.charAt(0).toUpperCase() + category.slice(1)
      const remaining = Math.max(budgetAmt - totalSpent, 0)
      let emoji: string, title: string, body: string

      if (threshold === 100) {
        const over = totalSpent - budgetAmt
        emoji = '❌'
        title = `Budget ${catLabel} terlampaui!`
        body  = `Rp ${fmt(totalSpent)} terpakai — melebihi Rp ${fmt(over)} dari limit. Hati-hati!`
      } else if (threshold === 90) {
        emoji = '🔴'
        title = `Budget ${catLabel} hampir penuh! (${Math.round(pct)}%)`
        body  = `Sisa Rp ${fmt(remaining)}. Kurangi pengeluaran sekarang!`
      } else {
        emoji = '🟡'
        title = `Budget ${catLabel} ${Math.round(pct)}% terpakai`
        body  = `Sisa Rp ${fmt(remaining)} — ${daysLeft()} hari tersisa bulan ini.`
      }

      await supabase
        .from('budgets')
        .update({ [`alert_${threshold}`]: true })
        .eq('id', budget.id)

      await supabase.from('alert_history').insert({
        user_id,
        budget_id: budget.id,
        threshold,
        spent_amount:  totalSpent,
        budget_amount: budgetAmt,
        category,
        message: `${emoji} ${title}`,
      })

      // Broadcast via Supabase Realtime HTTP API (required for server-side sends)
      await fetch(`${Deno.env.get('SUPABASE_URL')}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''}`,
        },
        body: JSON.stringify({
          messages: [{
            topic:   `realtime:budget-alerts:${user_id}`,
            event:   'alert',
            payload: { threshold, category, emoji, title, body, spent: totalSpent, budget: budgetAmt, pct: Math.round(pct) },
          }],
        }),
      })

      alertsSent.push(threshold)
      break // one alert per transaction
    }

    return json({ checked: true, pct: Math.round(pct), totalSpent, budgetAmt, alertsSent })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
