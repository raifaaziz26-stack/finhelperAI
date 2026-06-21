import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Mount inside a stable parent (e.g. NotificationBell) to receive real-time budget alerts.
// onAlert receives: { threshold, category, emoji, title, body, spent, budget, pct }
export function useBudgetAlerts(userId, onAlert) {
  // Keep a ref so the Realtime callback always sees the latest onAlert
  // without re-subscribing on every render
  const onAlertRef = useRef(onAlert)
  useEffect(() => { onAlertRef.current = onAlert })

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`budget-alerts:${userId}`)
      .on('broadcast', { event: 'alert' }, ({ payload }) => {
        onAlertRef.current(payload)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])
}
