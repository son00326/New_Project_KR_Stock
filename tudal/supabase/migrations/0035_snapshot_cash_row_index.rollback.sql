-- 0035_snapshot_cash_row_index.rollback.sql — W3b-2c cash 행 인덱스 분할 롤백.
-- is_cash 분기 2개 인덱스를 제거하고 0005의 (date) where ticker is null 단일 인덱스를 복원한다.
-- ⚠️ 경고: 이미 cash 행(ticker=NULL, is_cash=true)이 존재하면 같은 date에 aggregate+cash 2행이 있으므로
--   `(date) where ticker is null` 재생성이 unique violation으로 실패한다.
--   rollback 전 cash 행(delete from portfolio_snapshot where ticker is null and is_cash is true) 제거
--   여부는 데이터 영향 판단이므로 USER 결정.

begin;

-- (R33 MED3) preflight fail-fast: cash 행이 이미 있으면 old index 재생성이 모호한 unique
--   violation으로 터지므로, 먼저 명시 메시지로 중단해 운영자가 원인(live cash row)을 즉시 알게 한다.
do $$
begin
  if exists (
    select 1 from public.portfolio_snapshot where ticker is null and is_cash is true
  ) then
    raise exception
      'rollback aborted: live cash rows exist (ticker IS NULL AND is_cash). '
      'Decide data action first (USER): delete/convert cash rows, then re-run rollback. '
      'One-way after live cash rows.';
  end if;
end $$;

drop index if exists public.portfolio_snapshot_date_agg_uniq;
drop index if exists public.portfolio_snapshot_date_cash_uniq;

create unique index if not exists portfolio_snapshot_date_portfolio_uniq
  on public.portfolio_snapshot (date)
  where ticker is null;

alter table public.portfolio_snapshot
  drop constraint if exists portfolio_snapshot_cash_ticker_null_chk;

commit;
