-- Tambah kolom category ke tabel transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';
