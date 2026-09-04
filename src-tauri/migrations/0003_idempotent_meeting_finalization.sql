ALTER TABLE time_entries ADD COLUMN meeting_session_id INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_meeting_session_id
ON time_entries (meeting_session_id)
WHERE meeting_session_id IS NOT NULL;
