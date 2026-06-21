-- Add import-tracking columns to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS original_data JSONB;

-- Log each import session
CREATE TABLE IF NOT EXISTS import_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bank TEXT NOT NULL,
  file_name TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_history_all" ON import_history FOR ALL USING (auth.uid() = user_id);
