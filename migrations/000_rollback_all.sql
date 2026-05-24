-- Rollback: drop all FieldSightAI tables in reverse dependency order.
-- WARNING: This is destructive — all data will be lost.

DROP TABLE IF EXISTS site_content CASCADE;
DROP TABLE IF EXISTS export_log CASCADE;
DROP TABLE IF EXISTS transcript_segments CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organisations CASCADE;

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
