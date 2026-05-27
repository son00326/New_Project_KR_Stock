-- 0025 rollback — admin-only UPSERT RPC drop.
drop function if exists public.upsert_report_sections_0_7_admin(
  text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
);
