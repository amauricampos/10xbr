-- Rebuild around two independent tracks: U.S. businesses and candidates with a
-- Brazilian business. Earlier case data was test data only and is dropped.

DROP TABLE IF EXISTS checks;
DROP TABLE IF EXISTS documents;
DROP TABLE IF EXISTS signatures;
DROP TABLE IF EXISTS cases;
DELETE FROM blobs;

CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('us', 'br')),
  company_name TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  stage INTEGER NOT NULL DEFAULT 1,
  -- active: the owner is filling it in. review: waiting for the team.
  -- stopped: a gate failed. approved: in the catalog. declined: closed by the team.
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'review', 'stopped', 'approved', 'declined')),
  s1_answers TEXT,
  s1_result TEXT,
  s2_answers TEXT,
  s2_result TEXT,
  s4_answers TEXT,
  folder_url TEXT,
  ai_review TEXT,
  ai_review_status TEXT NOT NULL DEFAULT 'none' CHECK (ai_review_status IN ('none', 'running', 'done', 'failed')),
  team_note TEXT,
  history TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX cases_user ON cases(user_id);
CREATE INDEX cases_kind ON cases(kind, updated_at);

CREATE TABLE signatures (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK (kind IN ('nda')),
  version TEXT NOT NULL,
  lang TEXT NOT NULL,
  text_sha256 TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  signed_at INTEGER NOT NULL,
  UNIQUE (case_id, kind)
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  ai_status TEXT NOT NULL DEFAULT 'pending' CHECK (ai_status IN ('pending', 'running', 'done', 'failed', 'skipped')),
  ai_result TEXT,
  review TEXT NOT NULL DEFAULT 'received' CHECK (review IN ('received', 'accepted', 'rejected')),
  review_note TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX documents_case ON documents(case_id);
