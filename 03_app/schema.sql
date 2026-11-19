-- Run with: npm run db:local   (or npm run db:remote for the online database)

-- One row per uploaded photo search
CREATE TABLE IF NOT EXISTS searches (
  id              TEXT PRIMARY KEY,          -- random id (crypto.randomUUID), also the R2 file name
  created_at      TEXT NOT NULL,             -- ISO date and time, UTC
  image_key       TEXT NOT NULL,             -- where the uploaded image is stored in R2
  file_name       TEXT,
  material_guess  TEXT NOT NULL,             -- the top material
  confidence      REAL NOT NULL,             -- its share of the 5 nearest photos
  materials_json  TEXT NOT NULL,             -- the ranked materials (up to 3) as JSON
  unusual_score   REAL NOT NULL,
  is_unusual      INTEGER NOT NULL,          -- 1 = does not look like a building material
  result_json     TEXT NOT NULL              -- the full model answer (swatches, photos), to show it again
);
CREATE INDEX IF NOT EXISTS idx_searches_created_at ON searches (created_at);

-- Mood boards and what is saved on them
CREATE TABLE IF NOT EXISTS boards (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS board_items (
  board_id   TEXT NOT NULL REFERENCES boards(id),
  source     TEXT NOT NULL,                  -- photo | swatch | upload
  item_id    TEXT NOT NULL,                  -- gallery id, swatch id or search id
  material   TEXT,
  thumb_url  TEXT NOT NULL,
  label      TEXT,
  added_at   TEXT NOT NULL,
  PRIMARY KEY (board_id, source, item_id)
);

-- Activity log for the admin dashboard: one row per login, page view or action.
-- No IP addresses: only the name typed at login, a per-login id, and Cloudflare's country/city.
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           TEXT NOT NULL,                -- ISO date and time, UTC
  user_name    TEXT NOT NULL,                -- the name typed at login
  session_id   TEXT,                         -- one id per login (tells two devices of one person apart)
  type         TEXT NOT NULL,                -- login | login_failed | logout | view:<page> | upload | similar | save | ...
  path         TEXT NOT NULL,
  detail_json  TEXT,                         -- what was uploaded, saved, ... as JSON
  status       INTEGER,                      -- HTTP status of the answer
  country      TEXT,
  city         TEXT,
  device       TEXT                          -- e.g. "Mac · Chrome"
);
CREATE INDEX IF NOT EXISTS idx_events_ts ON events (ts);
CREATE INDEX IF NOT EXISTS idx_events_user ON events (user_name, ts);
