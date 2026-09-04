CREATE TABLE IF NOT EXISTS meeting_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id TEXT NOT NULL,
    application_name TEXT NOT NULL,
    source TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    duration_seconds INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (end_time IS NULL OR duration_seconds IS NOT NULL),
    CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_meeting
ON meeting_sessions ((1)) WHERE end_time IS NULL;

CREATE TRIGGER IF NOT EXISTS prevent_meeting_during_manual_timer
BEFORE INSERT ON meeting_sessions
WHEN NEW.end_time IS NULL AND EXISTS (SELECT 1 FROM time_entries WHERE end_time IS NULL)
BEGIN
    SELECT RAISE(ABORT, 'A manual timer is already running');
END;

CREATE TRIGGER IF NOT EXISTS prevent_manual_timer_during_meeting
BEFORE INSERT ON time_entries
WHEN NEW.end_time IS NULL AND EXISTS (SELECT 1 FROM meeting_sessions WHERE end_time IS NULL)
BEGIN
    SELECT RAISE(ABORT, 'A meeting is already being tracked');
END;
