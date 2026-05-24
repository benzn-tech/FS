-- Rollback 003: Drop sessions table and its trigger/function
DROP TRIGGER IF EXISTS sessions_updated_at ON sessions;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
