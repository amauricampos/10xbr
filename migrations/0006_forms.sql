-- Questionnaires the team edits in the admin panel. Every save adds a row; the newest
-- row per key is the form in use, and a NULL body means "back to the shipped default".
CREATE TABLE forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  body TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);
CREATE INDEX forms_key ON forms (key, id DESC);

-- The scorecard a lead was shown, so it still reads the same after the questions change.
ALTER TABLE leads ADD COLUMN s1_result TEXT;
