-- rollback for 0024_report_critic_findings
-- SoT: docs/superpowers/plans/2026-05-24-pr3c-orchestration-sector-reference.md (v6)

drop function if exists public.insert_critic_findings_run(uuid, jsonb, text);
drop table if exists public.report_critic_findings;
