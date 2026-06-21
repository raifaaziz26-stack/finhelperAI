import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Subscribes to new rows in alert_history for this user via Postgres Changes.
// onAlert receives: { threshold, category, emoji, title, body, spent, budget, pct }
export function useBudgetAlerts(userId, onAlert) {
  const onAlertRef = useRef(onAlert)
  useEffect(() => { onAlertRef.current = onAlert })

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`alert-history-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alert_history',
          filter: `user_id=eq.${userId}`,
        },
        ({ new: row }) => {
          const emoji = row.threshold >= 100 ? '❌' : row.threshold >= 90 ? '🔴' : '🟡'
          onAlertRef.current({
            threshold: row.threshold,
            category:  row.category,
            emoji,
            title:     row.message,
            body:      row.message,
            spent:     Number(row.spent_amount),
            budget:    Number(row.budget_amount),
            pct:       Math.round((Number(row.spent_amount) / Number(row.budget_amount)) * 100),
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])
}
