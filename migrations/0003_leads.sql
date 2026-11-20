-- Contact details captured right before the quick-check result is shown,
-- so the team can follow up with people who never create an account.
CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('us', 'br')),
  lang TEXT NOT NULL DEFAULT 'en',
  s1_answers TEXT NOT NULL,
  s1_rating TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (email, kind)
);
CREATE INDEX leads_updated ON leads (updated_at DESC);
