begin;

drop function if exists public.upsert_prism_snapshot(
  text, text, text, text, text, text, jsonb, text, text, text, jsonb
);
drop table if exists public.prism_benchmark_meta;
drop table if exists public.prism_snapshot;

commit;
