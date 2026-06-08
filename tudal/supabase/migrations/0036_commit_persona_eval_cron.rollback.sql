-- 0036 rollback — commit_persona_eval_cron 제거.
-- 원 admin RPC(commit_persona_eval/commit_badge_only, 0017)는 무변경이라 영향 없음.
-- DORMANT 함수이므로 drop은 안전(PR5B_SECTION8_ENABLED flag-off면 caller 0).
drop function if exists public.commit_persona_eval_cron(text, text, jsonb, jsonb, text, uuid);
drop function if exists public.reset_section8_eligible_jobs(text);
