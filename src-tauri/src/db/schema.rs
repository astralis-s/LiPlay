// Single migration string for v0. As we evolve, switch to sqlx::migrate!() with files.
pub const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS tracks (
    id           TEXT PRIMARY KEY,
    file_name    TEXT NOT NULL,           -- relative to Media/
    title        TEXT NOT NULL,
    artist       TEXT NOT NULL DEFAULT '',
    album        TEXT NOT NULL DEFAULT '',
    duration_ms  INTEGER NOT NULL DEFAULT 0,
    cover_path   TEXT,                    -- relative to Covers/, nullable
    sha256       TEXT NOT NULL,
    play_count   INTEGER NOT NULL DEFAULT 0,
    added_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
CREATE INDEX IF NOT EXISTS idx_tracks_album  ON tracks(album);

CREATE TABLE IF NOT EXISTS plays (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    track_id  TEXT NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
    played_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_plays_played_at ON plays(played_at);
CREATE INDEX IF NOT EXISTS idx_plays_track     ON plays(track_id);

CREATE TABLE IF NOT EXISTS playlists (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    cover_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    track_id    TEXT NOT NULL REFERENCES tracks(id)    ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS lyrics (
    track_id   TEXT PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
    synced     INTEGER NOT NULL DEFAULT 0, -- 0 = plain, 1 = LRC timed
    body       TEXT NOT NULL,
    source     TEXT NOT NULL DEFAULT 'lrclib',
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"#;

/// Additive migrations applied after the CREATE TABLE bootstrap. Each is
/// run once per process start; SQLite errors (e.g. "duplicate column") are
/// silently ignored, so it's safe to add new ALTERs at the bottom and
/// they'll only take effect on databases that don't already have them.
pub const POST_CREATE_ALTERS: &[&str] = &[
    "ALTER TABLE playlists ADD COLUMN cover_path TEXT",
];
