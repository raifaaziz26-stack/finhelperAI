-- Unique constraint needed for upsert in setBudget
ALTER TABLE budgets
  ADD CONSTRAINT budgets_user_category_month_year_key
  UNIQUE (user_id, category, month, year);

-- Alert tracking flags on budgets (reset when budget amount changes)
ALTER TABLE budgets
  ADD COLUMN IF NOT EXISTS alert_75  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_90  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS alert_100 BOOLEAN NOT NULL DEFAULT false;

-- Audit trail of every alert sent
CREATE TABLE IF NOT EXISTS alert_history (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  budget_id     UUID        REFERENCES budgets(id) ON DELETE SET NULL,
  threshold     INTEGER     NOT NULL,
  spent_amount  DECIMAL(15,2) NOT NULL,
  budget_amount DECIMAL(15,2) NOT NULL,
  category      TEXT        NOT NULL,
  message       TEXT        NOT NULL,
  sent_at       TIMESTAMPTZ DEFAULT NOW(),
  read_at       TIMESTAMPTZ
);

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alert_history_own" ON alert_history FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_alert_history_user ON alert_history (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_lookup    ON budgets        (user_id, category, month, year);
