-- Migration 0002: QR Code Batch Management & Enhanced Uniqueness
-- Adds support for batch generation and prevents code reuse

-- 1. Create QR Batches Table
CREATE TABLE IF NOT EXISTS qr_batches (
  id TEXT PRIMARY KEY,
  batch_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo',
  prefix TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 2. Add batch_id to qr_codes
ALTER TABLE qr_codes ADD COLUMN batch_id TEXT REFERENCES qr_batches(id) ON DELETE SET NULL;

-- 3. Ensure code uniqueness with NOT NULL constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_qr_codes_code_unique ON qr_codes(code) WHERE code IS NOT NULL;

-- 4. Add metadata tracking for batch operations
ALTER TABLE qr_codes ADD COLUMN generation_type TEXT DEFAULT 'individual'; -- 'individual' | 'batch'
ALTER TABLE qr_codes ADD COLUMN batch_sequence_number INTEGER; -- Position in batch (001, 002, etc)

-- 5. Create QR Code Archive Table (for deleted codes tracking)
CREATE TABLE IF NOT EXISTS qr_codes_archive (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  customer_id TEXT,
  title TEXT,
  destination_url TEXT NOT NULL,
  status TEXT NOT NULL,
  scan_count INTEGER DEFAULT 0,
  last_scanned_at TEXT,
  created_at TEXT NOT NULL,
  archived_at TEXT NOT NULL,
  archived_by TEXT,
  archived_reason TEXT
);

-- 6. Index for archive searches
CREATE INDEX IF NOT EXISTS idx_qr_archive_code ON qr_codes_archive(code);
CREATE INDEX IF NOT EXISTS idx_qr_archive_archived_at ON qr_codes_archive(archived_at);

-- 7. Add index for batch lookups
CREATE INDEX IF NOT EXISTS idx_qr_codes_batch_id ON qr_codes(batch_id);
CREATE INDEX IF NOT EXISTS idx_qr_batches_created_at ON qr_batches(created_at);

-- 8. Update schema to track all codes ever generated (for duplicate prevention)
CREATE TABLE IF NOT EXISTS qr_codes_all_time (
  code TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  is_active BOOLEAN DEFAULT 1
);

-- 9. Create composite index for batch operations
CREATE INDEX IF NOT EXISTS idx_qr_codes_batch_status ON qr_codes(batch_id, status);
