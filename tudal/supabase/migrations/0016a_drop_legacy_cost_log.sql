-- 0016a_drop_legacy_cost_log.sql
-- Legacy cost_log (created 0005 stub + extended 0008 hardening — OpenAI-style
-- tokens_prompt/tokens_completion) is superseded by 0017 S7a Anthropic-specific redesign
-- (input_tokens / cache_creation_input_tokens / cache_read_input_tokens / output_tokens
-- / prompt_cache_enabled / called_by). Schemas are incompatible — must drop before 0017.
--
-- Safety guard: refuse to drop if any rows exist on this environment.
-- DROP TABLE CASCADE handles legacy table-owned indexes (cost_log_month_idx,
-- cost_log_ts_idx, cost_log_month_purpose_idx, cost_log_persona_month_idx) and the RLS
-- policy "cost_log admin all".

do $$
declare
  existing_rows bigint;
begin
  if to_regclass('public.cost_log') is not null then
    execute 'select count(*) from public.cost_log' into existing_rows;
    if existing_rows > 0 then
      raise exception 'Refusing to drop legacy public.cost_log: % rows exist', existing_rows;
    end if;
  end if;
end $$;

drop table if exists public.cost_log cascade;
