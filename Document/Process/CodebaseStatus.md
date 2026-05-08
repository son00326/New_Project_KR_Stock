# CodebaseStatus.md — 현재 구현 스냅샷

> **용도**: 이 문서는 **"지금 코드에 무엇이 있는가"**의 스냅샷이다. 덮어쓰기 중심 — 과거 상태는 git log에 있고 여기는 **현재**만 유지한다.
>
> **HANDOFF.md와의 구분**:
> - `HANDOFF.md` = 미래 지향 ("다음 세션에 무엇을 할지")
> - `CodebaseStatus.md` = 현재 지향 ("지금 무엇이 있는가", 라우트·파일·연결 상태)
>
> **갱신 트리거**: 슬라이스 클로즈 완료 시, 또는 라우트/실데이터 연결/환경변수 등 구조적 변화 시 즉시 갱신.

---

## 최근 갱신

**2026-05-08** (40차): **T7e.6 access-logs/performance/decision-tree Supabase 전환 ✅ + 신규 마이그 0건 + 단일 SoT 박제**.
- **신규 모듈**: `tudal/src/lib/data/admin-access-logs.ts` — `getRecentAdminAccessLogs(limit)` boundary stub `[]` 반환 (실 access_log source는 T7e 범위 밖). BL-20 7일 단일 어드민 자동 바이패스는 stub이 false 분기를 자연 산출하므로 영구 비활성. 실 source 정의 시 함수 본문만 SELECT로 교체.
- **신규 모듈**: `tudal/src/lib/data/admin-performance.ts` — `PortfolioSnapshotDbRow` 타입 + `transformPortfolioSnapshotRow` snake→camel + `getPerformanceSummary(month)` (snapshot SELECT + `src/lib/performance/sharpe`/`mdd`/`cap-months` 순수 로직 호출 → 5 KPI) + `getMonthlyPerformance(monthRange)` (월별 집계) + `getBucketPerformance(month)` (버킷별 집계) + `getCounterfactual()` returns `null` (D11/S9 deferred — AI 비중 시계열 저장 정책 박제 후 산출 가능).
- **신규 모듈**: `tudal/src/lib/data/admin-decision-tree.ts` — `getDecisionTreeSnapshot()` (`portfolio_snapshot` SELECT → `groupByMonth` → `src/lib/performance/judge`의 `judgeDecisionTree` 순수 로직 호출 → 게이지 3종 + ○/△/✕ 배지).
- **단일 SoT 박제**: performance + decision-tree는 `portfolio_snapshot`(0005, 이미 적용) 단일 테이블 + `src/lib/performance/*` 순수 로직으로 산출. 별도 테이블 신설 0건. **신규 마이그 0건** (0011 슬롯은 BL-KRIT-8 S8 자동매매 E13~E17 보존).
- **page/action 갱신**:
  - `tudal/src/app/(admin)/admin/track-record/page.tsx` — Supabase 전환 (5 카드 · 월별 테이블 · 버킷별 · Counterfactual). counterfactual은 null이므로 "운용 데이터 누적 후 산출" UI 대기 카드로 표시.
  - `tudal/src/app/(admin)/admin/decision-tree/page.tsx` — Supabase 전환 (게이지 3종 · ○/△/✕ 배지 · Recharts Client island).
  - `tudal/src/app/(admin)/admin/portfolio/page.tsx`+`actions.ts` — access-logs를 boundary stub로 전환 (auto-relief 분기는 [] 입력으로 자연스럽게 false).
- **삭제**: `tudal/src/lib/data/mock-admin-access-logs.ts` (39 lines) · `tudal/src/lib/data/mock-admin-performance.ts` (171 lines) · `tudal/src/lib/data/mock-admin-decision-tree.ts` (29 lines). `mock-admin-consistency.test.ts`에서 관련 assertion 1개 제거.
- **신규/보강 테스트**: `__tests__/admin-access-logs.test.ts` 2개 (boundary stub + portfolio integration) + `__tests__/admin-performance.test.ts` 15개 (transformer 7 + getPerformanceSummary/Monthly/Bucket/Counterfactual 8) + `__tests__/admin-decision-tree.test.ts` 2개 (snapshot from portfolio_snapshot rows).
- **검증 게이트 회귀**: `build` exit 0 (25 routes 동일) · `lint` 0 errors · `test:ci` exit 0 (**49 files / 381 tests pass**; 이전 46/362 +3/+19, consistency 1 제거 반영) · `npx tsc --noEmit` exit 0.
- **부분 마이그레이션 boundary 종료점**: T7e.6으로 admin 잔존 mock 3종 정리. `mock-admin-{report,committee,approvals,snapshots,shortlist}` 등은 consistency 테스트 fixture로 보존(코드 경로에서는 사용 안 함). 다음 boundary는 T7e.7 RLS QA + T7e.8 Tier 0 seed.

**2026-05-08** (39차): **T7e.5 regen_counter Supabase 전환 ✅ + race-safe CAS + 신규 마이그 0건**.
- **신규 모듈**: `tudal/src/lib/data/admin-regen-counters.ts` — `RegenCounterDbRow` 타입 + `transformRegenCounterRow(row)` snake→camel + `computeNextMonthResetAt(month)` 순수 helper(다음 달 1일 00:00 KST ISO) + `getRegenCounter(ticker, month)` `maybeSingle` SELECT(없으면 null) + `incrementManualRegenCount(ticker, month)` 4단계 CAS(idempotent INSERT 23505 무시 → SELECT 현재 값 → cap 도달 시 즉시 `cap_exhausted` → `UPDATE WHERE id AND manual_count = current_value` 비교-스왑, RETURNING 비면 `regen_counter write conflict` throw).
- **race 보호 결정**: 마이그 0005에 이미 적용된 UNIQUE(ticker,month) + CHECK(manual_count ≤ 2) + Postgres 행 잠금 위에서 4단계 CAS로 충분. 신규 마이그/RPC 0건. **0011 슬롯은 BL-KRIT-8(S8 자동매매 E13~E17) 보존**. DB CHECK가 마지막 안전망.
- **page/action 갱신**:
  - `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/page.tsx` — `findRegenCounter(MOCK_ADMIN_REGEN_COUNTERS, ...)` → `await getRegenCounter(...)`. row 부재 시 counter=null → remaining=2 / allowed=true (기존 순수 helper 그대로).
  - `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/actions.ts` — `MOCK_ADMIN_REGEN_COUNTERS` import + `real_persistence_not_configured` 분기 제거. `incrementManualRegenCount` 호출 + `{ ok: true } / { ok: false, reason: "cap_exhausted" }` 응답 분기. throw 메시지를 `regen_counter_lookup_failed`/`regen_counter_write_failed`/`regen_counter_write_conflict` 3종으로 분류.
  - `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/regenerate-panel.tsx` — `formatErrorMessage()` 헬퍼 도입. `manual_cap_exhausted`/`cost_hardcap_40man`/`report_not_found`/`report_lookup_failed`/`regen_counter_lookup_failed`/`regen_counter_write_failed`/`regen_counter_write_conflict`/`auth_unavailable` 8종 한국어 운영자 메시지 일원화.
- **삭제**: `tudal/src/lib/data/mock-admin-regen-counters.ts` (본 변경으로 모든 importer 제거됨 → 고아).
- **신규/보강 테스트**: `__tests__/admin-regen-counters.test.ts` 13개 (transformer 1 + computeNextMonthResetAt 3 + getRegenCounter 3 + incrementManualRegenCount 6). `regenerate/__tests__/actions.test.ts` 8→12개(+4: success/cap_exhausted/lookup_failed/write_failed/write_conflict; production-like real_persistence_not_configured 케이스 제거).
- **검증 게이트 회귀**: `build` exit 0 (25 routes 동일) · `lint` 0 errors · `test:ci` exit 0 (**46 files / 362 tests pass**; 이전 45/345 +1/+17) · `npx tsc --noEmit` exit 0.
- **MOCK_ADMIN_COST_LOG 의도적 잔존**: 월 40만원 hardcap의 `isHardcapBlocked(MOCK_ADMIN_COST_LOG, month)` 분기는 그대로. cost_log 실 INSERT/SELECT는 S7a/T7a(Anthropic wrapper + cost_log 적재) 범위. HANDOFF §2.A 명시 가드라인 준수.
- **부분 마이그레이션 boundary 정리**: regen_counter 통로 추가로 `/admin/report/[ticker]/regenerate`도 실 I/O 진입. 시드 부재 상태에서는 카운터=null → 첫 클릭이 INSERT manual_count=1로 들어가는 모양 (T7e.3에서 이미 `reportExistsForMonth` 실 SELECT를 가드해 시드 없으면 그 전에 `report_not_found`로 차단). 다음 boundary는 T7e.6(access/performance/decision-tree).

**2026-05-08** (38차): **T7e.4 approvals/snapshots Supabase 전환 ✅ + `/admin/portfolio` fail-closed boundary 해제**.
- **신규 모듈**: `tudal/src/lib/data/admin-approvals.ts` — `PortfolioApprovalDbRow` transformer + `getApprovalsByMonth(month)` + `getApprovalById(id)` + `createPortfolioApproval(input)` INSERT + `raisePortfolioDispute`/`resolvePortfolioDispute` RPC wrapper. 실제 테이블명은 마이그 0004 기준 단수 `portfolio_approval`.
- **신규 모듈**: `tudal/src/lib/data/admin-snapshots.ts` — `PortfolioSnapshotDbRow` transformer + `insertPortfolioSnapshots(rows)` bulk INSERT. snapshot id는 DB `gen_random_uuid()`에 맡기므로 insert payload에는 id를 싣지 않는다.
- **page/action 갱신**:
  - `tudal/src/app/(admin)/admin/portfolio/page.tsx` — `MOCK_ADMIN_APPROVALS` → `getApprovalsByMonth(month)` Supabase SELECT. `actionsEnabled={false}`와 T7e.4 disabled message 제거 → fail-closed UI boundary 해제.
  - `tudal/src/app/(admin)/admin/portfolio/actions.ts` — Reject는 `createPortfolioApproval`로 실 INSERT. Accept는 fake entryPrice를 금지하며, 실 가격 소스가 없으면 `entry_price_unavailable`로 E4 INSERT 전 중단한다. 실 가격 wiring 후 Day 0 `portfolio_snapshot` rows를 `insertPortfolioSnapshots`로 호출하는 통로는 준비됨. E4 partial UNIQUE race(23505)는 accept 경로에서만 `already_finalized`로 매핑. `raiseDispute`/`resolveDispute`는 일반 UPDATE 대신 0010 security-definer RPC wrapper 사용.
  - `tudal/src/app/(admin)/admin/portfolio/portfolio-panel.tsx` — `entry_price_unavailable`/`approval_write_failed`/`reanalysis_limit_reached`를 한국어 운영자 메시지로 표시.
- **DB 제약 반영**: Reject 2회 UX 응답은 기존대로 `reanalysisCount=2` + `portfolioHoldWarning=true`를 반환하지만, DB `portfolio_approval.reanalysis_count`는 0004 CHECK(≤1)에 맞춰 1로 clamp한다.
- **신규/보강 테스트**: `__tests__/admin-approvals.test.ts` 4개 + `__tests__/admin-snapshots.test.ts` 2개 + `portfolio/__tests__/actions.test.ts` 보강 + `portfolio/__tests__/portfolio-panel.test.ts` 2개. targeted 4 files **23 pass**.
- **검증 게이트 회귀**: `build` exit 0 (25 routes) · `lint` 0 errors · `test:ci` exit 0 (**45 files / 345 tests pass**; 이전 42/333 +3/+12) · `npx tsc --noEmit` exit 0.
- **부분 마이그레이션 boundary 정리**: `/admin/portfolio`는 shortlist seed가 있으면 Reject/dispute/resolve 실 I/O 진입 가능. Accept 버튼은 노출되지만 실 가격 소스 전까지 한국어 메시지와 함께 fail-closed한다. 시드 부재 상태는 기존 빈 UI 유지. 다음 boundary는 T7e.5(regen_counter)와 T7e.6(access/performance/decision-tree).

**2026-05-08** (37차): **T7e.3 reports/committee Supabase 전환 ✅ + boundary 2번째 해제**.
- **신규 모듈**: `tudal/src/lib/data/admin-reports.ts` — `Section0~8`+`Appendix` canonical jsonb shape 타입 + `transformStockReportRow` + `getReportByTicker(ticker, {month?})` Supabase SELECT (is_latest=true) + `reportExistsForMonth(ticker, month)` 존재 검사 + `deriveBucketNeighbors(ticker, items)` 순수 함수(removed 제외 + 같은 bucket 내 rank 정렬). Supabase error는 throw.
- **신규 모듈**: `tudal/src/lib/data/admin-committee.ts` — `transformCommitteeVoteRow` (sector null → undefined, argument_excerpt null → "") + `getVotesByReportId(reportId)` SELECT + `aggregateVotes(votes)` 이관(mock-admin-committee.ts에서 분리).
- **page-level 갱신**:
  - `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` — Supabase 전환. `getActiveShortList()`로 active month 확정 → `getReportByTicker(ticker, { month })` 조회 + `MOCK_ADMIN_SHORTLIST.find` → `shortlist.find` + `getBucketNeighbors` mock → `deriveBucketNeighbors` 실 데이터 파생. recordReportView/viewer 계열은 T7e.6 스코프로 mock 유지.
  - `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/actions.ts` — `MOCK_ADMIN_REPORTS.some` → `await reportExistsForMonth(...)` (try/catch → 신규 에러 코드 `report_lookup_failed`).
  - `tudal/src/app/(admin)/admin/page.tsx` — `reportLinksEnabled={false}` 2곳 제거 (DeltaBanner + BucketSection) → 카드 클릭 활성(Delta REMOVED는 리포트 대기 유지).
  - `tudal/src/app/(admin)/admin/portfolio/page.tsx` — `reportLinksEnabled={false}` 1곳 제거 + actionsDisabledMessage T7e.4만 남기게 단축.
- **신규/보강 테스트**: `__tests__/admin-reports.test.ts` (10개: transformer 3 + getReportByTicker month filter 1 + deriveBucketNeighbors 6) · `__tests__/admin-committee.test.ts` (6개: transformer 4 + aggregate 2). regenerate `__tests__/actions.test.ts`는 `vi.mock("@/lib/data/admin-reports", () => ({ reportExistsForMonth: ... }))` 추가 + `report_lookup_failed` 신규 케이스 1. `components/admin/shortlist/__tests__/delta-banner.test.ts` 2개로 REMOVED delta 링크 차단 회귀 보강.
- **mock 보존**: `mock-admin-report.ts`·`mock-admin-committee.ts` 파일은 그대로 (consistency 테스트 유지). 향후 일괄 정리 예정.
- **검증 게이트 회귀**: `build` exit 0 (25 routes — 동일) · `lint` 0 errors · `test:ci` exit 0 (**42 files / 333 tests pass**; 이전 39/314 +3/+19) · `npx tsc --noEmit` exit 0.
- **부분 마이그레이션 boundary 정리**: shortlist→reports/committee 2번째 해제로 `/admin/report/[ticker]` 클릭 활성. 단, Delta REMOVED 행은 report-backed 대상이 아니므로 계속 `리포트 대기`로 유지. 시드 부재 상태에서는 `/admin` 빈 UI · `/report` 도달 불가 일관 동작. 다음 boundary는 T7e.4(approvals/snapshots) — 현재는 `/portfolio` Accept/Reject만 disabled 유지.

**2026-05-08** (36차): **자율 트랙 §A 진입 — T7e.1 마이그 0010 검증 + T7e.2 shortlist Supabase 전환 ✅**.
- **신규 모듈**: `tudal/src/lib/data/admin-shortlist.ts` (118 lines) — `getActiveShortList({month?, tickerMeta?})` Supabase SELECT + `getShortListDelta()` aggregate + 순수 helper `transformShortListRow(row, meta?)` + `aggregateShortListDelta(items)`. Supabase error는 throw (silent swallow 폐기). 갭: short_list_30 스키마에 name/sector 컬럼 없음 → fallback (name=ticker · sector="미분류") 또는 외부 lookup. T7e.8 prep에서 3옵션(컬럼 추가/JOIN 테이블/정적 lookup) 결정.
- **신규 테스트**: `tudal/src/lib/data/__tests__/admin-shortlist.test.ts` — Vitest 8개 (transformer 6 + aggregate 2). null 처리·string·numeric 모두 커버.
- **page-level importer 5건 갱신** (mock-admin-shortlist → admin-shortlist):
  - `tudal/src/app/(admin)/admin/page.tsx` — `getActiveShortList()` (latest)
  - `tudal/src/app/(admin)/admin/settings/page.tsx` — `getActiveShortList()` (latest)
  - `tudal/src/app/(admin)/admin/portfolio/page.tsx` — `getActiveShortList()` (latest, month=monthShortlist[0]?.month, 빈 placeholder 분기, createdAt 기반 generated_at)
  - `tudal/src/app/(admin)/admin/portfolio/actions.ts` — sync helper 5종을 `ShortListItem[]` param 받게 리팩터, acceptShortList/rejectShortList 본문 try/catch 진입로 박제, generated_at = createdAt 기반
  - `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` — **mock pair 유지** (T7e.3 boundary, real shortlist + mock report 혼합 시 404 위험 회피)
- **Boundary props (사용자 추가)**: `tudal/src/components/admin/shortlist/{shortlist-row,delta-banner,bucket-section}.tsx`에 `reportLinksEnabled` prop 추가. `/admin`+`/portfolio`에서 `reportLinksEnabled={false}` 전달 → T7e.3 전까지 리포트 클릭 자체 차단. `/portfolio`는 Accept/Reject도 T7e.3·4 전까지 disabled.
- **mock 보존 (T7e.3 스코프)**: `mock-admin-shortlist.ts` 자체는 그대로 유지 (mock-admin-committee/report가 import 중). T7e.3 완료 시 일괄 삭제 예정.
- **Supabase 마이그**: 0010 `alert_event_rls_hardening` 적용 확인 (version 20260505134639) — BL-KRIT-7 ✅ 해소.
- **검증 게이트 회귀**: `build` exit 0 (25 routes, +1 from 24 — 동일 라우트 셋, 카운트만 정정) · `lint` 0 errors · `test:ci` exit 0 (39 files / 314 tests pass; 이전 38/306 +1/+8). 추가로 `npx tsc --noEmit --pretty false` exit 0.
- **Tier 0 데이터 수집 인프라 결정 (B-1)**: pykrx Python 의존성 → Vercel(Node) Edge Function 배제. 로컬 Python 스크립트(scripts/, idempotent upsert · dry-run · CSV 백업 · month 인자 · env 기반 Supabase 접속) 채택. T7e.8에서 구현. 자동화는 S7/S8 안정화 후 GitHub Actions로 승격.
- **세션 외 git status**: 32~33차 잔여(M 12 파일 — alerts/regenerate/cron/credentials/mock-admin-*) + 35차 박제 문서 8건은 본 세션에서 미터치. 커밋 단위 분리는 사용자 결정.
- **Test 파일 보강**: `portfolio/__tests__/actions.test.ts`에 `vi.mock("@/lib/data/admin-shortlist")` 추가 — month 인자에 매칭되는 mock 행만 반환해 기존 5개 시나리오(invalid_input·24h hold·shortlist_month_not_found·viewers_insufficient·auth_unavailable·real_persistence_not_configured) 그대로 유지.

**2026-05-05** (32차): **Supabase 계정 마이그(Kevin → son00326) + 0001~0010 적용(MCP) + Vercel env 갱신 + Production 재배포 + DQ-7 Session 3 자동 부분 해소**.
- **Supabase 신 프로젝트**: `rbrpcynhphrpljbjirfo` (son00326's Org · Free · Seoul region · Security 옵션 기본). 이전 `fpriyjykihxhhvqudvdb` 폐기.
- `tudal/.env.local` 4 키 교체 (gitignored): URL · ANON · PUBLISHABLE · SERVICE_ROLE 모두 새 JWT/sb_publishable/URL.
- 신규 파일 (커밋 대상): `tudal/supabase/config.toml` (Supabase CLI 로컬 stack 기본 설정, `supabase init` 산출) + `tudal/supabase/.gitignore` (`.branches`·`.temp`·`.env.local` 패턴).
- **Supabase CLI**: v2.98.1 설치 (`/usr/local/bin/supabase`, GitHub releases binary 직접 다운로드 — brew는 Xcode 26 요구로 fail). 향후 `supabase db push` 또는 MCP 양쪽으로 마이그 가능.
- **Supabase MCP 등록**: `~/.claude.json` user-scope · HTTP transport `https://mcp.supabase.com/mcp?project_ref=rbrpcynhphrpljbjirfo` · `Authorization: Bearer sbp_...` (PAT) · `✓ Connected`. PAT는 user-scope 저장이라 repo 미커밋. 향후 세션 자동 로드.
- **마이그레이션 9건 적용 (MCP `apply_migration`)**: 0001 sketch skip, 0002~0010 순차 success. 검증 결과 21 테이블 RLS enabled · 9 마이그레이션 (timestamp version) 등록 · `kr_business_days` 2557 row seed (2024~2030).
- **`admin_emails` 3 row INSERT**: shjang1001@gmail.com (메인) · kevinoh816@gmail.com (어드민 2) · son00326@gmail.com (대표).
- **3-게이트 회귀 검증 (신 환경)**: build **24 routes** · lint **0** · test:ci **306 pass / 38 files** (이전 248에서 +58, 회귀 0).
- **Vercel env 8 entries 새 키로 교체**: `vercel env rm` × 8 (1건 status error는 SERVICE_ROLE Development 부재 정상) → CLI add × 5 (Prod+Dev) + REST API `POST /v10/projects/:id/env?upsert=true` × 3 Preview (`created:3 failed:0`). 최종 — URL × 3 env · ANON × 3 env · SERVICE_ROLE × 2 env.
- **Production 재배포**: `vercel deploy --prod --yes` → https://tudal-tawny.vercel.app · `dpl_3FfP5ZU9uz7MqKYc4DD6MfomRJTY` · target=production READY · build 56s · 새 Supabase 환경 적용.
- **Supabase MCP `get_advisors security`**: 10 WARN — 모두 SECURITY DEFINER function (`is_admin`, `mark_alert_read`, `record_alert_exit_decision`, `raise_portfolio_dispute`, `resolve_portfolio_dispute`) anon/authenticated EXECUTE 노출. 함수 본문에 `is_admin()` 가드 박혀있어 비-어드민 호출 시 즉시 거부. 의도된 패턴, 수용.
- **사용자 잔여 = T16 1건만**: Supabase Dashboard → Auth → URL Configuration (Site URL `https://tudal-tawny.vercel.app` + Redirect URLs 4건). T17 Smoke Test는 T16 직후.
- **보안 주의**: 채팅 노출 시크릿 — anon JWT · service_role JWT · DB password · Supabase PAT(`sbp_...`). 작업 종료 후 rotate 권장 (특히 PAT는 son00326 계정 전체 접근 가능).
- **변경 외 코드**: `tudal/src/**` 코드 변경 없음 (env 변경만). 검증 게이트 회귀 0.

**2026-04-30** (31차): **A 문서 갱신 + Naver API 키 .env.local 투입 (BL-KRIT-3 부분 해소)**.
- `tudal/.env.local` 신규 2 키 (gitignored): `NAVER_CLIENT_ID` · `NAVER_CLIENT_SECRET` (line 27-28)
- 코드 변경 0건 (env 추가 외 전부 docs)
- 문서 정정: HANDOFF §1·§4 BL-KRIT-3·§6 외부 신청 표·§12 31차 + ProgressDashboard Last updated·§5 BL-KRIT-3·§7 + 본 문서
- **T5 stale 정정**: ProgressDashboard §5 BL-KRIT-7 "마이그레이션 0009" → **"0010"** (28차 재배정 후 미반영) + 본 문서 체크리스트 "[x] 마이그레이션 0010 파일 생성" → **[ ] 미생성**으로 정정 (잘못 체크된 stale)
- 검증 회귀 0 (env 변경만)
- **보안 주의**: 채팅 히스토리 노출 키 — Vercel env 투입 전 Naver Developers 콘솔에서 1회 rotate 권장 (DQ-5 Supabase anon 패턴)
- **사용자 다음 세션 잔여 불변**: T16 Supabase Redirect URL · 0009 마이그레이션 실 DB 적용 · T17 Cron dashboard + Smoke Test

**2026-04-22** (30차): **DQ-7 Session 3 부분 진행 — Vercel 첫 production 배포 도달**.
- 새 파일: `tudal/scripts/rotate-cred-mek.mjs` (271 lines · MEK 로테이션 도구 · `--old`/`--new`/`--dry-run` · `.env.local` 자동 로드 · service_role SELECT + memory verify + UPDATE · `.ts`→`.mjs` deviation 박제)
- `.env.local` 신규 3 키 (gitignored): `API_CRED_MASTER_KEY` · `CRON_SECRET` · `ADMIN_REP_EMAIL=son00326@gmail.com`
- `tudal/vercel.json` 변경: `news-sweep` `*/15 * * * *` → `0 0 * * *` (Vercel Hobby plan cron daily 제약 회피)
- `.gitignore` (root): `.vercel/` 추가 (보안 핫픽스 — repo root에 .vercel 생성됐는데 패턴 누락)
- `.vercel/` 위치: **repo root** (`/Users/yong/New_Project_KR_Stock/.vercel/`) — rootDirectory=`tudal` 설정 + cwd=tudal에서 deploy 시 `tudal/tudal` path 중첩 회피
- Vercel 인프라:
  - 프로젝트 `son326s-projects/tudal` (projectId `prj_CEev6UO5TehtgWQoPZ6ZRDDLBJF9`, teamId `team_1IMygRXejEWSsLNTJNJIwfeL`)
  - GitHub repo 연결 `son00326/New_Project_KR_Stock` · Production Branch=`main` (CLI/REST 변경 불가, dashboard만)
  - Framework=nextjs · rootDirectory=`tudal`
  - Env 18 entries (7 keys × 2~3 환경): CLI add 11 + REST API `POST /v10/projects/:id/env?upsert=true`로 Preview 7개 보정
  - 첫 production 배포: https://tudal-tawny.vercel.app · `dpl_397UrMfZET9XLbzxsEDShZmCPZQ4` · READY · target=production · 24 routes · build 48s · TypeScript 통과
- Vercel CLI: v41.3.0 → **v52.0.0** 업그레이드 (v41 OAuth flows 모두 deprecated 410)
- commits: `78dc54b` T14 + `4c6f0e2` cron fix · 30차 push 완료(`3c91194..78dc54b` + `78dc54b..4c6f0e2`)
- 검증: build 24 routes · lint 0 · test:ci 248/248 · Vercel build exit 0 · 회귀 0
- **사용자 다음 세션 잔여**: T16 Supabase Redirect URL · 0009 마이그레이션 실 DB 적용 · T17 Cron dashboard + Smoke Test §6.7

**2026-04-22** (28차): **문서 정합 cleanup** — DQ-7 Session 2 완료 후 전수 정독으로 스테일 포인터·구조 불일치 일괄 정리. Archive 이관: `AutoTrading.md`·`AutoTrading-AI구조설계.md` → `Document/Archive/` + ⚠️ 경고 prefix (D11 이전 자동매매 독립 트랙 가정 기반 · S8 AI 어댑터 drop-in 시 참조 보존). S8-AutoTrading.md T8.1 마이그 번호 **0010→0011** 정정(E12는 DQ-7 0009 선행). HANDOFF §1·§4·§11 · ProgressDashboard §1·§5 · CodebaseStatus(이 문서) · CLAUDE.md + ServicePlan.md v1.2→v1.3. 로드맵 순서 재조정은 Step 2로 유예. 코드 변경 0건 · build/lint/test:ci 회귀 0.

**2026-04-22** (27차): **DQ-7 Session 2 Frontend UI 완료** — `/ralph` 자율 루프 3 Wave. 라우트 22 → **24** (+`/admin/settings/brokerage`·`/admin/settings/binance`). 신규 7 파일 + 수정 1 · +881줄. architect(opus) APPROVED · ai-slop-cleaner CLEAN · 3-gate regression green · tests 248/248 (UI component 테스트 인프라 미도입으로 신규 테스트 0 · 회귀 0). commits: `04d1116` T11 secret-input → `289820e` T9+T10 brokerage·binance UI (executor sonnet × 2 병렬) → `240e7dc` T12 sidebar nav → `4140309` HANDOFF 갱신.

**2026-04-22** (26차): **DQ-7 Session 1 Backend·DB 완료** — Inline TDD (crypto 보안 크리티컬). 11 Task 순차.
- `src/lib/crypto/aes.ts` AES-256-GCM encrypt/decrypt + MEK lazy singleton (14 tests · IV uniqueness 100회 · tamper 4 · MEK config 3)
- `supabase/migrations/0009_dq7_credentials.sql` + rollback.sql — E9 재설계(ciphertext/iv/auth_tag 6 컬럼 + mock_mode) + E12 신설(동일 + testnet_mode) + RLS `*_admin_self` 2종. **실 DB 적용은 Session 3**
- `src/lib/credentials/{types,mask,validation,brokerage,exchange}.ts` 5 파일 · Server Actions(`upsert`·`delete`·`list`·`test` stub `pending-s8`) · ActionResult discriminated union · rep guard(ADMIN_REP_EMAIL) · 23505 매핑 · 43 tests
- Integration tests 20 cases (`vi.hoisted` Supabase mock)
- Cleanup: `types/admin.ts` BrokerageConnection·BrokerageScope 제거 · `mock-admin-brokerage.ts` 삭제
- `.env.example` `API_CRED_MASTER_KEY`·`ADMIN_REP_EMAIL` 신규 + KIS/Binance 블록 주석화
- 검증: build 22 routes · lint 0 · test:ci **248 pass** (190 + 58 신규)

**2026-04-22** (25차): **DQ-7 Admin Credential System 재설계 spec 작성 완료** — `Slices/DQ7-Credentials.md` 신규 (858 줄, Q1~Q5 확정). 바이낸스·KIS 키 per-admin UI + AES-256-GCM 암호화 + Vercel 첫 배포 · S7a 선행 · 4 세션 예상. **마이그레이션 번호 재배정**: 0009 = DQ-7 credential (선점) · 0010 = alert_event CHECK 확장 (BL-KRIT-7). 구현은 다음 세션. 코드 변경 없음(docs only).

**2026-04-20** (23차 후속 정정): **S6 ✅ Mock 완료 반영** — Mock Skeleton Stage 1 완성(S0~S6). Mock 동작 19/19 · 실데이터 0/19 · 실 AI 호출 0 · 운용 검증 0일. 진짜 MVP는 S7(실데이터 전환, 미착수) + 운용 검증 후.
- 마이그레이션 0008(cost_log 확장 ticker·persona_id·section + heartbeat_log + RLS 1종)
- src/lib/cost/{anthropic-pricing.ts·dry-run-estimate.ts·aggregate.ts} (BL-18 견적 박제 + M17 집계 + hardcap 가드)
- src/lib/health/heartbeat.ts (M19 분류·메시지·D10 catch-up·heartbeat_missing 페이로드)
- src/app/(admin)/admin/settings/cost/page.tsx — M17 대시보드 (35만 경보·40만 hardcap·Purpose 비중·Top 5·BL-18 시나리오 비교·시연 영역)
- src/app/api/cron/silent-health/route.ts — Vercel Cron 매일 24:00 KST 2채널 + D10 재시도
- regenerateReport에 isHardcapBlocked 가드 활성 (S4 stub → 실 활성화)
- vercel.json crons 4건으로 확장 (silent-health 추가, 0 15 * * *)
- src/app/(admin)/layout.tsx — Sidebar nav에 AI 비용·Health 항목 노출
- types/admin.ts 확장: AlertType +cost_warning·cost_hardcap·heartbeat_missing · CostLog·CostMonthlySummary·HeartbeatLog·임계치 상수 5종
- src/lib/data/{mock-admin-cost-log.ts·mock-admin-heartbeat.ts} 신설
- 검증: build 22 routes · lint 0 · test:ci 20 files 190 tests pass

**2026-04-19** (22차): S5b ✅ 완료 반영 — M13·M14·M15 3 Must 달성.

**2026-04-19** (21차): **S5a ✅ 완료 반영** — M10·M11·M12·M18 4 Must 달성.
- 마이그레이션 0006(pipeline_health · news_event · briefing_log · briefing_view_event + RLS 4종)
- src/lib/scheduler/monthly-batch.ts + __tests__ (재시도·실패 처리, 13 tests)
- src/lib/email/resend.ts + src/lib/briefing/compose.ts + __tests__ (브리핑 컴포저, 8 tests)
- src/lib/news/{naver-api.ts · scraper.ts · classifier.ts} + __tests__ (분류기, 12 tests)
- src/lib/health/pipeline-health.ts + __tests__ (5 파이프라인 집계, 8 tests)
- vercel.json (crons 3건: 월간 배치 · 모닝 브리핑 08:00 KST · 뉴스 sweep 15분 주기)
- src/app/api/cron/{monthly-batch, morning-briefing, news-sweep}/route.ts 3 cron 핸들러
- src/app/(admin)/admin/settings/health/page.tsx — 5 파이프라인 × 24h 성공률 + 95% Critical 배너 + 실패 tail 50건
- src/app/(admin)/admin/alerts/{page, [id]/page}.tsx — AlertEvent 이력 + Critical/Warning 뉴스 목록 + 상세
- src/components/admin/briefing/briefing-card.tsx — /admin 상단 브리핑 카드
- src/lib/data/ mock 2 신설(mock-admin-pipeline-health·mock-admin-news) + 2 확장(mock-admin-briefings 5일·mock-admin-alerts 6건)
- types/admin.ts 확장: AlertType에 news_warning·briefing_failed 추가 + PipelineHealth·PipelineHealthSummary·NewsEvent·임계치 상수 3종
- 검증: build 20 routes · lint 0 · test:ci 15 files 128 tests pass

**2026-04-19** (20차): S4 ✅ 완료 반영.
- src/lib/performance/ 6파일(sharpe·mdd·alpha·judge·cap-months·regen-cap) + __tests__ 6 파일 (53 tests 추가, 누적 87)
- /admin/track-record 실동작(5 카드 · 월별 테이블 · 버킷별 · Counterfactual)
- /admin/decision-tree 실동작(게이지 3종 · ○/△/✕ 배지 · Recharts Client island)
- /admin/report/[ticker]/regenerate 실동작(서브라우트 · cap 가드 · cost_log stub 훅)
- 마이그레이션 0005(E5 portfolio_snapshot · E8 regen_counter · cost_log stub + RLS)
- S3 hardening 병행: resolveAdminId · try/catch · dispute trim
- src/lib/data/ 3 mock fixture 신설/확장

**2026-04-17** (19차): S3 ✅ 완료 반영.
- src/lib/portfolio/ 6파일(순수 로직) + 5 __tests__(43 tests) 신설
- /admin/portfolio 실동작(page.tsx 전면 재작성 + portfolio-panel.tsx Client island + actions.ts 4 Server Actions)
- 마이그레이션 0004(E4 v1.3 · E11 kr_business_days · alert_event gating_auto_relief 타입)
- scripts/ 디렉토리 신설 (seed_kr_holidays.py)
- Vitest 4.1.4 셋업 (G-10=b)
- types/kr-business-days.ts 신설 + types/admin.ts v1.3

**2026-04-17** (18차): S2 ✅ 완료 (E2·E3·E10 + 4 mock + 10 섹션 accordion).
**2026-04-17** (16~17차): S1 ✅ 완료 (E1 + 33행 mock + Delta/크리시스 UI).
**2026-04-17** (15차): S0 Foundation 완료 (레거시 제거·Supabase 연결·17 라우트·9엔티티 RLS sketch·디자인 토큰).

---

## tudal/ 현재 상태 (2026-05-08 · S7e T7e.6 완료 기준 · **실데이터 I/O 통로 9종 open** (boundary stub 포함) · **Vercel production 배포 ✅ https://tudal-tawny.vercel.app**)

### 규모
- TypeScript 파일: `src/` 기준 **~160개+** (S7e에서 `admin-shortlist`·`admin-reports`·`admin-committee`·`admin-approvals`·`admin-snapshots`·`admin-regen-counters`·`admin-access-logs`·`admin-performance`·`admin-decision-tree` 9개 실 I/O wrapper와 테스트 추가; `mock-admin-{regen-counters,access-logs,performance,decision-tree}` 4개 삭제)
- 라우트: **25개**
  - **Main 6**: `/`, `/_not-found`, `/login`, `/signup`, `/macro`, `/stock/[ticker]`
  - **Auth 1**: `/auth/callback`
  - **Admin 14**: `/admin`, `/admin/portfolio`, `/admin/alerts`, `/admin/alerts/[id]`, `/admin/track-record`, `/admin/decision-tree`, `/admin/settings`, `/admin/settings/notifications`, `/admin/settings/health`, `/admin/settings/cost`, `/admin/settings/brokerage`, `/admin/settings/binance`, `/admin/report/[ticker]`, `/admin/report/[ticker]/regenerate`
  - **Cron 4** (Vercel Cron): `/api/cron/monthly-batch`, `/api/cron/morning-briefing`, `/api/cron/news-sweep`, `/api/cron/silent-health`

### 기술 스택
- Next.js 16.2.3 + React 19.2.4 + TypeScript strict + Tailwind v4
- UI: shadcn(base-nova) + Lucide + Recharts + Base UI(@base-ui/react) Dialog
- 라우팅: App Router, 라우트 그룹 `(auth)` pass-through / `(main)` Header+Footer / `(admin)` 자체 chrome(로고·사이드바·면책 Footer)
- 인증: Supabase SSR (`.env.local`), `/admin/*` ADMIN_EMAILS allowlist 가드 미들웨어
- **테스트: Vitest 4.1.4** (S3 G-10=b) — node 환경 · `src/**/__tests__/**/*.test.ts` · passWithNoTests · native tsconfigPaths
- 브랜딩: 주픽

### 레이아웃 구조
- `app/layout.tsx` = 최소 HTML + body (Header·Footer 제거됨, 17 라우트 대응)
- `app/(main)/layout.tsx` = Header + Footer (main 라우트용)
- `app/(auth)/layout.tsx` = pass-through
- `app/(admin)/layout.tsx` = 로고·사이드바(**10 nav** · DQ-7 S2에서 `증권사 키`·`거래소 키` +2 · S8에서 그룹 재편 예정)·면책 Footer

### 데이터 레이어 (mock + S7e Supabase real I/O hybrid)
- **실 Supabase I/O wrapper (S7e 진행 중)**:
  - `admin-shortlist.ts` → `short_list_30` active month SELECT + transformer/delta aggregate. DB 미적재 시 빈 목록.
  - `admin-reports.ts` → `stock_reports` active month report SELECT + existence check + bucket neighbor 파생.
  - `admin-committee.ts` → `committee_votes` report_id 기반 SELECT + vote aggregate.
  - `admin-approvals.ts` → `portfolio_approval` month/id SELECT + accept/reject INSERT + dispute/resolve RPC.
  - `admin-snapshots.ts` → `portfolio_snapshot` Day 0 bulk INSERT + transformer.
  - `admin-regen-counters.ts` → `regen_counter` SELECT + race-safe 4단계 CAS (39차).
  - `admin-access-logs.ts` → `getRecentAdminAccessLogs()` boundary stub `[]` (40차, BL-20 영구 비활성).
  - `admin-performance.ts` → `portfolio_snapshot` SELECT + `src/lib/performance/*` 순수 로직으로 summary/monthly/bucket 산출 (40차). counterfactual은 D11/S9 deferred → null.
  - `admin-decision-tree.ts` → `portfolio_snapshot` SELECT → `groupByMonth` → `judgeDecisionTree` (40차).
- **아직 mock 유지**: report_view_log(T7e.후속), briefing/news/alerts/health/cost 등 후속 S7 phase 대상. (access-logs는 40차 boundary stub로 닫힘, performance·decision-tree는 40차에 portfolio_snapshot SoT로 전환됨.)
- **Main mock** (6): `mock-stocks`·`mock-financials-extended`·`mock-quarterly`·`mock-ohlcv`·`mock-corporate`·`mock-macro`
- **Admin mock 보존**: `mock-admin-report.ts`·`mock-admin-committee.ts`는 consistency 테스트와 mock persona/view-log 의존 때문에 보존. `mock-admin-approvals.ts`·`mock-admin-snapshots.ts`도 consistency fixture로만 남고 `/portfolio` 실 경로에서는 사용하지 않는다.
- **실데이터 현황**: 실 I/O 통로는 shortlist/reports/committee_votes/portfolio_approval/portfolio_snapshot/regen_counter/access-logs(stub)/performance(snapshot SoT)/decision-tree(snapshot SoT) 9종 open. 하지만 `short_list_30`/`stock_reports`/`committee_votes`/`portfolio_snapshot` DB seed 전이라 Must 실데이터 카운트는 아직 0/19. T7e.8 seed 후 1+/19로 전환 예정.
- **Supabase**: 프로젝트 `rbrpcynhphrpljbjirfo` (son00326 Org · Seoul · Free). `.env.local`은 URL/anon/publishable/service_role/ADMIN_EMAILS 등 신 프로젝트 기준.
- **Auth users**: admin 3명 생성. Magic Link UI는 prefetch 의심 이슈로 비밀번호 우회 사용 중.

### 마이그레이션 (supabase/migrations/)
| 파일 | 내용 | 상태 |
|---|---|---|
| `0001_rls_sketch.sql` | 9엔티티 admin-only RLS 초안 + `is_admin()` 헬퍼 | **sketch 미실행** (0002+가 실 생성) |
| `0002_s1_shortlist30.sql` | admin_emails + `is_admin()` 실 생성 + E1 short_list_30 + RLS | 실 |
| `0003_s2_reports.sql` | E2 stock_reports + E3 committee_votes + E10 report_view_log + RLS + GIN 인덱스 | 실 |
| `0004_s3_approval.sql` (S3) | E4 portfolio_approval v1.3(dispute_reason/gating_auto_relief/reanalysis_count) + E11 kr_business_days(2024~2026 수기 seed) + alert_event check constraint 'gating_auto_relief' | 실 |
| `0005_s4_performance.sql` (S4) | E5 portfolio_snapshot (partial UNIQUE on ticker NULL/NOT NULL) + E8 regen_counter (UNIQUE ticker+month·auto≤1·manual≤2) + cost_log stub (R5 pre-wire) + RLS 3종 | 실 |
| `0006_s5a_automation.sql` (S5a) | pipeline_health (5 파이프라인 × 24h) + news_event (UNIQUE url) + briefing_log (UNIQUE date) + briefing_view_event (dedupe) + RLS 4종 | 실 |
| `0007_s5b_notifications.sql` (S5b) | admin_settings(intraday_mode) + ticker_alert_pref(UNIQUE admin+ticker) + intraday_anomaly_event(UNIQUE dedup_key) + RLS 3종 | 실 |
| `0008_s6_hardening.sql` (S6) | cost_log 확장(ticker·persona_id·section + 인덱스 2) + heartbeat_log(UNIQUE date) + RLS 1종 | 실 |
| `0009_dq7_credentials.sql` (DQ-7 S1) | E9 `brokerage_connection` 재설계(`api_key_ref` 폐기 · `ciphertext/iv/auth_tag` × 2 + `mock_mode`) + E12 `exchange_connection` 신설(동일 구조 + `testnet_mode`) + RLS `*_admin_self` 2종 · `0009_dq7_credentials.rollback.sql` 동반 | **실 적용 완료 (32차)** |
| `0010_alert_event_rls_hardening.sql` (S7e/DQ-7 후속) | E6 alert_event 신설/강화 + AlertType CHECK 12종 + 4 RPC(`mark_alert_read` 등) + RLS select-all/insert-own/update-own | **실 적용 확인 (36차, version 20260505134639)** |

### 타입 정의 (src/types/)
- `stock.ts`·`corporate.ts`·`macro.ts` (main)
- `admin.ts` **v1.3** (S3) — E1~E10 + DISPUTE_REASON_MIN_LENGTH=20 + AlertType 'gating_auto_relief'
- `kr-business-days.ts` (S3 신설) — E11 `KrBusinessDay`

### 순수 로직·도메인 레이어 (S3 신설)
`src/lib/portfolio/` (6 파일):
| 파일 | 책임 | 테스트 |
|---|---|---|
| `approval-logic.ts` | isAcceptAllowed · isUniqueViolation(pg 23505 가드) | 10 cases |
| `business-days.ts` | addBusinessDays · countBusinessDaysBetween (시간 보존) | 7 cases |
| `gating.ts` | computeAcceptGate(24h → D+4 영업일 → 2인 열람 · autoRelief skip) | 6 cases |
| `auto-relief.ts` | detectSingleAdminStreak (windowDays 커스텀) | 7 cases |
| `dispute.ts` | validateDisputeReason(trim ≥20) · canRaiseDispute · isDisputeHoldExpired · isAcceptBlockedByDispute | 13 cases |
| `calendar.ts` | MOCK_KR_BUSINESS_DAYS_2026 + loadKrBusinessDays stub(S5 Supabase SELECT 예정) | — |

### 라우트·Server Actions (S3 신설)
`src/app/(admin)/admin/portfolio/`:
- `page.tsx` — Server Component (Short List 30 필터 · Delta 집계 · D+5 위젯 · 게이팅 계산 · auto-relief 감지 · finalApproval 탐색)
- `portfolio-panel.tsx` — Client island (Base UI Dialog · useTransition · router.refresh · Accept/Reject/Dispute 3모달 · 실시간 20자 카운터 · 48h Hold 배너)
- `actions.ts` — 4 Server Actions real I/O hybrid (`acceptShortList`·`rejectShortList`·`raiseDispute`·`resolveDispute`). shortlist/report-view/access-log 게이트는 후속 T7e.6까지 일부 mock 참조. Reject/dispute/resolve는 Supabase 실 경로, Accept는 실 entryPrice source 전까지 fail-closed

### 컴포넌트 구조
`src/components/{stock,macro,layout,common,ui}`. `ui/` shadcn(base-nova, Lucide) + Base UI Dialog.

### 디자인 토큰 (S0 유지)
`src/app/globals.css` @theme inline + :root — shadcn base-nova neutral + 한국 증시 관례 `--market-up`(빨강) · `--market-down`(파랑) · `--market-neutral`(회색). radius 4단계 · Geist · chart-1~5.

### 문서 레이어 (AGENTS.md 계층)
- 8 AGENTS.md (deepinit S0 T0.8 · S3에서 vitest.config.ts·test:ci 반영): root · src · src/{app,components,lib,types} · src/lib/{data,supabase}

### scripts/ 디렉토리 (S3 신설)
- `scripts/seed_kr_holidays.py` — S5 M10 pykrx 월간 배치용 참조. Homebrew Python 3.14 PEP 668 → venv 필수. `python3 scripts/seed_kr_holidays.py --from YYYY-MM-DD --to YYYY-MM-DD` 로 SQL UPDATE 블록 stdout.

### DQ-7 Credential System 신설 (Session 1·2)
**Session 1 (Backend·DB)** — `src/lib/crypto/` + `src/lib/credentials/`:
- `src/lib/crypto/aes.ts` AES-256-GCM encrypt/decrypt + MEK lazy singleton (zero dependency · Node crypto stdlib만)
- `src/lib/credentials/types.ts` — `ActionResult<T>` discriminated union · Brokerage/Exchange Input·Display 인터페이스
- `src/lib/credentials/mask.ts` — `maskKey(prefix 2 + suffix 4)` · `maskAccount`
- `src/lib/credentials/validation.ts` — KIS APP_KEY(36) / APP_SECRET(180) / account_no / Binance API_KEY·SECRET(64) / label(1~40) + `CredentialFormatError`
- `src/lib/credentials/brokerage.ts` — KIS Server Actions (`upsertBrokerageCredential`·`deleteBrokerageCredential`·`listBrokerageCredentials`·`testBrokerageConnection` stub `pending-s8`) · rep guard(ADMIN_REP_EMAIL) · 23505 매핑
- `src/lib/credentials/exchange.ts` — Binance USDT-M 선물 평행 구조 (rep guard는 testnetMode=false 조건)

**Session 2 (Frontend UI)** — `src/components/admin/credentials/` + 2 settings 라우트:
- `src/components/admin/credentials/secret-input.tsx` — 공유 Client (Eye toggle · `autoComplete="new-password"` · maxLength counter · useRef unmount cleanup)
- `src/app/(admin)/admin/settings/brokerage/{page,form,delete-button}.tsx` — KIS UI (Server + Client + Base UI Dialog 2-step)
- `src/app/(admin)/admin/settings/binance/{page,form,delete-button}.tsx` — Binance USDT-M 선물 평행 UI
- `src/app/(admin)/layout.tsx` ADMIN_NAV +2 (`증권사 키`·`거래소 키` · Flat · S8 재편 예정)

**통합 테스트**: 20 cases (`vi.hoisted` Supabase mock). 누적 190 → **248 tests**.

**정리된 레거시**: `types/admin.ts`에서 `BrokerageConnection`·`BrokerageScope` 타입 제거 · `mock-admin-brokerage.ts` 삭제.

**환경변수 (`.env.example`)**: `API_CRED_MASTER_KEY`(32-byte hex MEK) · `ADMIN_REP_EMAIL`(실계좌/메인넷 저장 권한자) 신규 추가. `KIS_*`·`BINANCE_*` env 블록은 주석화(per-admin DB로 영구 이관).

### 레거시 제거 완료 (S0)
- ~~`app/(main)/pricing`~~ · ~~PLANS/PlanKey~~ · ~~SubscriptionTier/UserProfile/reportViewsRemaining~~ · ~~subscription-gate/report-limit-banner~~ · ~~/pricing 링크~~

### 검증 게이트 현재 상태 (S7e T7e.6 완료 후, 2026-05-08)
- `npm run build`: ✅ **25 routes** (Next.js 16 build 통과)
- `npm run lint`: ✅ 0 errors
- `npm run test:ci`: ✅ **49 files / 381 tests pass** (S7e T7e.6 기준; 이전 46/362 +3/+19, consistency 1 제거 반영)
- `npx tsc --noEmit`: ✅ exit 0
- `npm run dev`: ⚠️ macOS EMFILE 이슈 가능 — 필요 시 `ulimit -n 65535` 후 재시도

---

## 시스템·백테스트 현황

### 자동화 백테스트 v6.1 FINAL (2026-04-12 확정)
- 파일: `backtest/full_system_backtest_v6.py`
- 성과: CAGR 20.3% · Sharpe 0.99 · Calmar 0.78 · Max DD -25.8%
- 벤치마크: 삼성전자 B&H 위험조정 beat
- 구성: 3축 분화 + Early Warning + 부분 리밸런싱

---

## Must 19 진행 상황 (S6 Mock 완료 기준)
- **Mock 동작**: 19/19 (100% mock fixture)
- **실데이터 연결**: **0/19** — 전 Must가 mock 의존
- **실 AI 호출**: **0** — Anthropic wrapper 미구현
- **2채널 알림 실 발송**: **0** — Resend·Telegram 미연결
- **외부 API 실 연결**: **0** — KIS·Naver·DART·pykrx 미연결
- **실 운용 검증**: **0일**

**어드민 내부 도구 완성 기준** = Mock + 실데이터(S7) + 자동매매 프레임(S8, 주식 KIS + 바이낸스 선물) + 운용 검증(S9) **4조건 AND** → **미달성**. 진행 경로 = HANDOFF.md §6 로드맵.

> **2026-04-21 어휘 정리 (D16)**: 구 "MVP Stage 1 완료" 어휘는 대외 서비스 프레임에서 파생된 것이며 어드민 내부 도구 트랙에는 강제 게이트가 아님. 자세한 재정의는 CLAUDE.md 상단 "⭐ 프로젝트 재정의" 참조.

---

## 체크리스트 (변화 시 갱신)

### Mock Skeleton (완료) + DQ-7 구현 2/4
- [x] TypeScript 파일 수 증감 (S0: 70 → S6: ~145 → DQ-7 S2: ~152)
- [x] 라우트 추가 (S0 17 → S6 22 → DQ-7 S2 24)
- [x] Supabase `.env.local` 세팅 (S0 완료 · DQ-5 anon key 갱신 해소 2026-04-21)
- [x] 마이그레이션 0001~0008 적용 + **0009 파일 생성 (실 DB 적용 Session 3 예정)**
- [x] Vitest 테스트 인프라 (190 → **248 tests pass** · DQ-7 S1 +58)
- [x] 레거시 코드 제거 (S0 완료 + DQ-7 S1에서 `BrokerageConnection`·`mock-admin-brokerage` 추가 제거)

### 실데이터 전환 (S7, 미착수)
- [ ] **Anthropic API 키 확보** (BL-KRIT-1) — DQ-2/DQ-7 선결
- [ ] **KIS API 계정 발급** (BL-KRIT-2) — DQ-7 선결
- [🟡] **Naver News API 키** (BL-KRIT-3) — 2026-04-30 31차 `.env.local` 투입 (Vercel env + rotate는 S7b 직전)
- [ ] **Resend 계정 + 도메인 인증** (BL-KRIT-4) — DQ-7 선결
- [ ] **Telegram Bot** (BL-KRIT-5) — DQ-7 선결
- [x] **Supabase anon key 갱신** (BL-KRIT-6) — 2026-04-21 해소
- [ ] **마이그레이션 0010 파일 생성** alert_event CHECK 확장 (BL-KRIT-7, S7e 진입 전 선행 — 28차 재배정으로 0009→0010, 31차 stale 체크 정정)
- [ ] **마이그레이션 0009** DQ-7 credential (E9 확장 + E12 신설 + RLS, 파일 생성 완료 · 실 DB 적용 Session 3 예정)
- [ ] Supabase 실 SELECT/INSERT 전환 (S7e · 8 Must)
- [ ] Anthropic wrapper + cost_log 실 INSERT (S7a · M17·M2·M3·M6·M9·M10·M11·M12)
- [ ] 뉴스·브리핑 실 연결 (S7b · M10·M11·M12)
- [ ] 장중·Exit 실 연결 (S7c · M13·M15)
- [ ] Silent Health 실 INSERT + override UI (S7d · M18·M19)

### 운용 검증 (미착수)
- [ ] Vercel 프로젝트 생성 + 환경변수 세팅 (DQ-7 **Session 3 · 사용자 주도** · 최소 env 7개: Supabase 3 + ADMIN_EMAILS + ADMIN_REP_EMAIL + API_CRED_MASTER_KEY + CRON_SECRET)
- [ ] origin push (DQ-6 해소 2026-04-20 · 현재 DQ-7 S1·S2 + cleanup 등 여러 commits ahead, Session 3 직전 push 권장)
- [ ] Cron 4건 실 실행 검증
- [ ] 어드민 1개월+ 운용 검증

### 법무 (⏸ Deferred-D 멤버 오픈 시점까지 유예 · 2026-04-20)
- [⏸] Q16 법무 자문 — 어드민 3명 내부 운용만이므로 현 단계에서 불필요
- [⏸] Q17 이용약관·개인정보처리방침 — Footer 면책 문구 유지, 멤버 오픈 시 `/legal/*` 라우트 신설

### 유저
- [ ] 어드민 3명 allowlist 실 로그인 (Supabase anon 블로커)
- [ ] 멤버 초대 500cap (Deferred-D)
