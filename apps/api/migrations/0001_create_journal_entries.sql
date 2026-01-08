CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  entry_text TEXT NOT NULL,
  emotions_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  analysis_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS journal_entries_created_at_idx
  ON journal_entries (created_at DESC, id DESC);
