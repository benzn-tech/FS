-- Migration 009 rollback: Remove device routing enhancements

ALTER TABLE sessions
  DROP COLUMN IF EXISTS realptt_account,
  DROP COLUMN IF EXISTS realptt_user_name;

ALTER TABLE project_devices
  DROP COLUMN IF EXISTS user_id;
