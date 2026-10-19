CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS match_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  finished_at INTEGER NOT NULL,
  players TEXT NOT NULL -- JSON: [{userId?, name, ai?, score}]
);
CREATE INDEX IF NOT EXISTS idx_match_finished ON match_results(finished_at);
