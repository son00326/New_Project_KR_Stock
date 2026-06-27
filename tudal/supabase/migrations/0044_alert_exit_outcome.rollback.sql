-- rollback: 0044_alert_exit_outcome
drop function if exists public.record_alert_exit_outcome(uuid, numeric, timestamptz);
