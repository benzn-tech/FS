-- Mark READY sessions with duration < 30s as SKIPPED.
-- These slipped through because Transcribe omits audio_durations metadata
-- for very short files, causing the SKIPPED check to not fire.
UPDATE sessions
   SET status = 'SKIPPED', updated_at = NOW()
 WHERE status = 'READY'
   AND duration_secs IS NOT NULL
   AND duration_secs < 30;
