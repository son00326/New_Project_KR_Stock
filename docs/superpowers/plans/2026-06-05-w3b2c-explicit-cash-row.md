# W3b-2c — 명시 cash row (Option B) · plan v1 (Claude 1차 draft)

> 프로세스: §2.0a (Claude 1차 → omxy 검토(R33) → Claude/omxy fix → Claude verify). money-path 최고위험.
> 선행: W3b-2a(proposal 영속 #91)·W3b-2b(Accept proposal weights, MERGED)·W3b-3(UI #101 등). main `b43b685`(+docs `bd2f1a8`).
> 사용자 선택(이 세션): "W3b-2c 빌드 우선(키-free)". 실 app round-trip(PostgREST)+브라우저 = Docker 미가용 → USER/Docker 시점. 마이그/인덱스 smoke = **로컬 실 PG(Docker-free)** 로 실검증.

---

## 0. 설계 리서치 + ground-truth 검증 결론 (3-dim Workflow + Claude 직접 검증)

3-dim 설계 리서치(`wr3966q8o`)가 차원 간 **모순**을 냈고(dim1=`ticker='CASH'` sentinel "consumer 무손상" vs dim2=`ticker=NULL+is_cash=true` 분할), money-path라 Claude가 **실제 consumer 필터를 직접 확인**해 판정:

| consumer | 파일:line | 필터 | Option A(`ticker='CASH'`) | Option B(`ticker=NULL,is_cash=true`) |
|---|---|---|---|---|
| getPerformanceSummary/Monthly | admin-performance.ts:124-125 | `ticker IS NULL AND is_cash=false` | 제외(ticker≠null) | **제외(is_cash=true)** |
| getBucketPerformance | admin-performance.ts:142 | `ticker IS NOT NULL`(is_cash 필터 **없음**) | **유입**(ticker='CASH'가 종목으로) → bucket-lookup이 우연히 막을 뿐 fragile | **제외(ticker=null)** |
| getDecisionTreeSnapshot | admin-decision-tree.ts:48-49 | `ticker IS NULL AND is_cash=false` | 제외 | **제외(is_cash=true)** |
| buildIncumbentThesisContexts | admin-shortlist-incumbents.ts | per-ticker(ticker not null) | 유입 가능 | 제외 |

→ **결론: Option B 채택.** `fetchTickerRows`가 `is_cash` 필터가 없어 `ticker='CASH'`(Option A)는 per-ticker consumer로 새어든다(dim1 "무손상" 주장 **반증됨**). Option B(`ticker=NULL + is_cash=true`)는 기존 두 필터(`is_cash=false`로 aggregate / `ticker IS NOT NULL`로 per-ticker)에 **양쪽 자동 제외 → consumer 코드 0 변경**.

**status lifecycle = 드롭(빌드 안 함).** 근거:
- portfolio_approval(`approval_type='accept'|'reject'`) + accept_shortlist_with_snapshots RPC(0016)가 **이미 accept/reject lifecycle SoT**.
- proposal.status 추가 = 2nd SoT → 동기화 부담. 리서치가 HIGH 위험 4종 제시(double-write 원자성, propose/accept race, orphan pending, rolling-deploy NULL). 0016 money-path RPC를 건드려야 원자성 확보 가능.
- **consumer 수요 0**(proposal.status 읽는 UI/로직 없음). 필요 시 portfolio_approval JOIN(month)으로 파생 가능.
- CLAUDE.md §2(simplicity, no-speculative) + money-path 보수성 → 드롭이 정답.

---

## 1. Scope (이것만)

**W3b-2c = 명시 cash row 1건.** proposal 경로 Accept 시 snapshot에 현금 비중을 명시 행으로 박제(가독성·감사성). cash-implicit는 이미 W3b-2b consumer audit GREEN이라 **정확성 수정 아닌 가독성 refinement** — Option B라 위험 LOW.

| # | 변경 | 파일 | 성격 |
|---|---|---|---|
| C1 | `buildSnapshotRowsFromProposal`에 `cashWeight` 인자 + cashWeight>0이면 cash 행(`ticker:null, isCash:true, weight:cashWeight`) push. aggregate 행(weight=1) 불변 | `src/lib/portfolio/proposal-snapshots.ts` | pure, money-path |
| C2 | `buildInitialSnapshots`에서 `cashWeight: input.proposal.cashWeight` 전달 | `src/app/(admin)/admin/portfolio/actions.ts:239` | wiring(flag-gated `if(input.proposal)`) |
| C3 | 마이그 0035 + rollback — portfolio_snapshot의 `ticker IS NULL` unique index를 is_cash=false(aggregate)/is_cash=true(cash) **2개로 분할** | `supabase/migrations/0035_*.{sql,rollback.sql}` | 스키마(additive·behavior-preserving) |
| C4 | 테스트 — cash emission + consumer 회귀(cash fixture 행 추가해도 결과 불변) | `__tests__/proposal-snapshots.test.ts`, `admin-performance.test.ts`, `admin-decision-tree.test.ts` | TDD |

**범위 밖**: status lifecycle(드롭), backfill(historical 행은 cash-implicit 유지, non-blocking), UI weight% 표시 변경(별도), 외부 알림, AI 호출.

---

## 2. 마이그 0035 설계 (additive·behavior-preserving)

기존(0005:41-43):
```sql
create unique index portfolio_snapshot_date_portfolio_uniq
  on public.portfolio_snapshot (date) where ticker is null;
```
→ ticker=NULL 행을 날짜당 1개로 제한 = aggregate+cash 공존 차단(충돌).

0035:
```sql
begin;
-- 기존 (date) where ticker is null 인덱스를 is_cash 분기 2개로 분할.
drop index if exists public.portfolio_snapshot_date_portfolio_uniq;
-- ① aggregate(ticker NULL, is_cash=false): 날짜당 1개 (기존 데이터·코드와 동일 제약).
create unique index if not exists portfolio_snapshot_date_agg_uniq
  on public.portfolio_snapshot (date) where ticker is null and is_cash is false;
-- ② cash(ticker NULL, is_cash=true): 날짜당 1개 (신규 허용).
create unique index if not exists portfolio_snapshot_date_cash_uniq
  on public.portfolio_snapshot (date) where ticker is null and is_cash is true;
commit;
```
- **behavior-preserving**: 기존 ticker=NULL 행은 전부 is_cash=false → ①이 동일하게 1/date 강제. 기존 코드는 cash 행을 emit 안 함(emission은 §C2 flag-gated) → ②는 dormant.
- RLS 무변경(0035는 index-only) → grant/policy 수정 불필요.
- rollback: ①② drop → 원래 `(date) where ticker is null` 1개 재생성.

**롤백 SQL**:
```sql
begin;
drop index if exists public.portfolio_snapshot_date_agg_uniq;
drop index if exists public.portfolio_snapshot_date_cash_uniq;
create unique index if not exists portfolio_snapshot_date_portfolio_uniq
  on public.portfolio_snapshot (date) where ticker is null;
commit;
```
⚠️ rollback은 cash 행이 이미 존재하면(같은 date에 agg+cash 2행) `(date) where ticker is null` 재생성이 **unique violation** → rollback 전 cash 행 제거 판단은 USER(주석 명시).

---

## 3. 코드 (C1/C2)

**C1** `buildSnapshotRowsFromProposal`:
```ts
export function buildSnapshotRowsFromProposal(input: {
  positions: PortfolioProposal["positions"];
  cashWeight: number;            // 신규
  priceMap: Map<string, number>;
  month: string;
  acceptDate: string;
}): NewPortfolioSnapshot[] {
  // ... per-position 루프 동일 ...
  // aggregate 행(weight=1) 동일 ...
  // 신규: cashWeight>0이면 명시 cash 행(W3b-2c). consumer는 is_cash=true/ticker-null로 제외(코드 무변경).
  if (input.cashWeight > 0) {
    snapshots.push({
      date: input.acceptDate, month: input.month, ticker: null,
      entryPrice: 0, currentPrice: 0, weight: input.cashWeight, isCash: true,
      dailyReturn: 0, totalReturn: 0, kospiReturn: 0, alpha: 0, sharpe: 0,
    });
  }
  return snapshots;
}
```
- cashWeight=0 → cash 행 생략(weight=0 noise 방지). weight CHECK(0..1) — cashWeight∈[0,0.3] OK.

**C2** `buildInitialSnapshots`(actions.ts:239):
```ts
const snapshots = buildSnapshotRowsFromProposal({
  positions: input.proposal.positions,
  cashWeight: input.proposal.cashWeight,   // 신규
  priceMap, month, acceptDate,
});
```

---

## 4. 검증 (실사용 기준 — Docker 가용분 전부 실 DB)

1. **Vitest mock(순수)**:
   - proposal-snapshots: cashWeight>0 → cash 행(ticker=null,is_cash=true,weight=cashWeight) 1개 + aggregate(weight=1) 유지 + per-ticker(is_cash=false). cashWeight=0 → cash 행 없음. weight 합 검증(per-ticker sum + cashWeight + aggregate=별개).
   - consumer 회귀: admin-performance.test / admin-decision-tree.test fixture에 cash 행(ticker=null,is_cash=true) 추가 → getPerformanceSummary/Monthly/Bucket/DecisionTree 결과 **불변**(제외 확인).
2. **실 PG 마이그 smoke(Docker-free, 로컬 PostgreSQL 16 실행 중)**:
   - `createdb w3b2c_smoke` → portfolio_snapshot 테이블(0005 §1 DDL) + old index 부트스트랩 → 0035 apply.
   - INSERT: agg(null,false) OK / cash(null,true) OK(공존) / dup agg → violation / dup cash → violation / per-ticker(005930,false) OK.
   - 0035.rollback apply → `(date) where ticker is null` 복원, 2nd null 행 → violation(원복 확인).
   - `dropdb w3b2c_smoke`.
   - = money-path 스키마 위험(인덱스 충돌)을 **실 DB로 실증**.
3. **게이트**: `npm run build` + `lint` + `test:ci`(회귀 0) + `tsc`.
4. **USER/Docker 대기(자율 불가, blocker 보고)**: PostgREST app round-trip(실 Supabase 클라이언트 Accept→snapshot 조회) + 브라우저 track-record 페이지 cash 행 표시. + 0035 production apply(USER).

---

## 5. omxy 검토 위임 (R33, catch-only — money-path Complex)

Context packet 9필드 + 특히 omxy에 **blind 2차 배선 감사**(money-path 합의 필수) 요청:
- Option B 선택 타당성(fetchTickerRows is_cash 필터 부재 재확인) · 0035 behavior-preserving 증명 검토 · status 드롭 타당성 · cashWeight=0 생략 결정 · cash 행 weight CHECK/consumer 회귀 hole · rollback unique violation 경고 충분성 · emission flag-gating(`if(input.proposal)`) 실제 확인.

## 6. 머지/문서
- 브랜치 `feat/w3b2c-explicit-cash-row`. TDD 커밋. omxy CONVERGED + 3게이트 GREEN → rebase FF merge + delete-branch. 배선감사 fix 별도 커밋. docs-sync(HANDOFF/ProgressDashboard/S7-RealData/CLAUDE.md 빌드순서) main-direct.
- USER 게이트(잔여): 0035 production apply + (실검증) Docker/실env.
