-- Admin panel: team roles, deactivation, team invites, and clearing a lead
-- whose L-1 screen failed so it can continue.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
UPDATE users SET is_admin = 1 WHERE role = 'staff';

ALTER TABLE leads ADD COLUMN cleared_at INTEGER;
ALTER TABLE leads ADD COLUMN cleared_by TEXT;
ALTER TABLE leads ADD COLUMN cleared_note TEXT;

CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);
