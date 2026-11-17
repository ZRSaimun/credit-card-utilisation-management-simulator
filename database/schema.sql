-- Simulation-only persistence schema. No bank or payment data is stored.
CREATE TABLE IF NOT EXISTS scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  payload JSON NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scenario_id INTEGER NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  event_date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL,
  destination TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL CHECK(amount >= 0),
  balance_before DECIMAL(12,2) NOT NULL,
  balance_after DECIMAL(12,2) NOT NULL CHECK(balance_after >= 0),
  reason TEXT NOT NULL
);

