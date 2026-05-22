-- migration: 0020_short_list_30_screening_metadata
-- purpose: PR1 — short_list_30에 Tier 1 screening 출처 메타데이터 컬럼 추가.
--          assigned_by (primary|backfill nullable) + prompt_version_id + personas_version_id.
-- bucket(text 'short'|'mid'|'long') 컬럼 = assigned_timeframe 의미 그대로 재사용
-- (별도 컬럼 추가 X — 49차 lesson 박제, schema redundancy 회피).
-- 기존 row는 nullable로 유지 (Tier 0-only fallback 시드 보존).
-- ref: docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md §1.1 / PR1 plan §Task1

alter table public.short_list_30
  add column if not exists assigned_by text
    check (assigned_by in ('primary', 'backfill')),
  add column if not exists prompt_version_id text,
  add column if not exists personas_version_id text;

comment on column public.short_list_30.assigned_by is
  'PR1: Tier 1 selection mode. primary = primary_timeframe argmax 선발, backfill = 부족 timeframe 보충. NULL = Tier 0-only fallback.';
comment on column public.short_list_30.prompt_version_id is
  'PR1: render-user-prompt.ts 버전 식별자. 재현성 audit용.';
comment on column public.short_list_30.personas_version_id is
  'PR1: CORE_11_PERSONAS 버전 식별자. 재현성 audit용.';
