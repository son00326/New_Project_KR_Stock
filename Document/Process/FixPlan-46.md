# FixPlan-46 — 2026-05-13 QA 65건 상세 plan

> **위치 관계**: `Document/Process/HANDOFF.md §7` (entry point map) → 본 파일 (상세 plan + 핵심/고위험 task의 cmux template + DoD). 다음 세션이 HANDOFF만 보고 진입할 때 막히면 본 문서 해당 P 섹션 펼쳐서 참조.

**작성 근거**: 46차 cmux pair-debate v1 (omxy + Claude) 7단계 audit — Phase 0 baseline → 1 doc integrity → 2 DB/RLS invariants → 3 backend lib/data wrappers → 4 frontend (admin)/* → 5 API/cron/infra → 6 tests/coverage. 모든 phase = read-only audit. DRIFT 18 / GAP 17 / INTENT 22 / VERIFY 8.

**사용자 결정 4건 박제** (이 문서 전체에 적용):
1. D20 차수 = **45차로 통일** (HANDOFF/Dashboard/S7-RealData 기준, ServicePlan-Admin/ReportFramework "44차" → 45차로 갱신)
2. monthly-batch cron schedule = **UTC 00:05 (KST 09:05) 유지** (운영 전환 시 재검토)
3. T7e.7 RLS QA = **수동 1회 유지** (의미: "DB 권한이 실제 운영에서 막히는지 브라우저로 확인하는 절차"; 자동화는 P3 backlog)
4. 46차 작업 scope = **plan only + HANDOFF/FixPlan 박제** (코드 변경 0건)

**환경 확인** (각 P0~P3 진입 시 수행):
```bash
cd /Users/yong/New_Project_KR_Stock
git status --short
cd tudal && npm run build && npm run lint && npm run test:ci
```
실측 기준선: HEAD 변경 없으면 build 25 routes · lint 0 · test:ci 384/49.

---

## P0 — 운영 안전 (DB·dashboard, 30~60분) — **✅ 46차 commit `9661037` (P0.1 + P0.3) · ⏳ P0.2 사용자 HIBP 작업 잔여 (B-2A)**

### P0.1 — Supabase SECURITY DEFINER PUBLIC REVOKE + authenticated re-grant (마이그 0015a) — **✅ 완료 (commit `9661037`, omxy Round 2 CONVERGED + Round 4 hotfix push)**

**문제 (DRIFT D-7)**: Supabase advisor security lint WARN 10건 (5함수 × 2role anon/authenticated). 5개 SECURITY DEFINER 함수가 anon + authenticated 두 role에 EXECUTE 허용.

**위험 검증 완료 (46차 grep)**:
- `tudal/src/lib/data/admin-approvals.ts:143` = `client.rpc("raise_portfolio_dispute", ...)` — **admin authenticated RPC 활성**
- `tudal/src/lib/data/admin-approvals.ts:156` = `client.rpc("resolve_portfolio_dispute", ...)` — **admin authenticated RPC 활성**

**PostgreSQL 권한 모델 주의 (omxy 정정 46차)**:
- Postgres 함수 EXECUTE 기본권한은 **PUBLIC**에 부여됨 (CREATE FUNCTION 기본 동작)
- 따라서 `REVOKE ... FROM anon` 단독으로는 anon이 PUBLIC 경유로 계속 호출 가능
- **올바른 패턴**: `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT EXECUTE ... TO authenticated` (admin RPC 활성 함수)

**진입 시 재확인 (다음 세션 첫 액션 — 순서대로)**:

1. advisor 재확인:
```
mcp__supabase__get_advisors(type="security")
```

2. **현재 ACL 확인 SQL** (PUBLIC grant 존재 여부 + 각 role의 EXECUTE 권한):
```sql
select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args, p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_admin','mark_alert_read','raise_portfolio_dispute',
                    'record_alert_exit_decision','resolve_portfolio_dispute');
```
proacl이 NULL이면 default PUBLIC EXECUTE. 명시 ACL 있으면 그대로 read.

3. 활성 호출 추가 grep (Phase 2 검토용):
```bash
grep -rn 'rpc("mark_alert_read"\|rpc("record_alert_exit_decision"\|rpc("is_admin"' tudal/src
```

**SECURITY DEFINER 정정 (omxy 46차 3차 라운드)**:
- SECURITY DEFINER = "**함수 본문 실행 시 owner 권한**", caller의 EXECUTE 권한 체크는 **우회하지 않음**
- 따라서 `is_admin()`은 RLS 정책 전반에서 caller(authenticated/anon)가 호출 → caller에 EXECUTE 권한 없으면 RLS-protected SELECT가 `permission denied for function is_admin`으로 깨짐
- **is_admin()도 authenticated에 GRANT 필요** (anon GRANT 안 함 = anon RPC 차단 + RLS 통과만 보장)

**Phase 1 — PUBLIC REVOKE + authenticated re-grant**:
```sql
-- 0015a_definer_execute_lockdown.sql
-- D-7 fix Phase 1: PUBLIC EXECUTE 회수 후 admin authenticated에 필요한 함수만 명시 grant.
-- 내부 admin 가드(P0001 raise)는 그대로 유지.

-- 1) 5 함수 모두 PUBLIC EXECUTE 회수 (anon + default 경유 차단)
revoke execute on function public.is_admin() from public;
revoke execute on function public.mark_alert_read(uuid) from public;
revoke execute on function public.raise_portfolio_dispute(uuid, text) from public;
revoke execute on function public.record_alert_exit_decision(uuid, text, text) from public;
revoke execute on function public.resolve_portfolio_dispute(uuid) from public;

-- 2) authenticated re-grant: RLS 정책에서 호출되는 is_admin() + admin 활성 RPC
grant execute on function public.is_admin() to authenticated;
grant execute on function public.raise_portfolio_dispute(uuid, text) to authenticated;
grant execute on function public.resolve_portfolio_dispute(uuid) to authenticated;

-- 3) mark_alert_read, record_alert_exit_decision = grep 결과로 결정
-- 활성이면 추가:
-- grant execute on function public.mark_alert_read(uuid) to authenticated;
-- grant execute on function public.record_alert_exit_decision(uuid, text, text) to authenticated;
```
+ `0015a_definer_execute_lockdown.rollback.sql` (PUBLIC re-grant + authenticated revoke).

**Phase 2 검토 항목**:
- mark_alert_read, record_alert_exit_decision = grep 결과로 grant 결정
- proacl SELECT로 적용 후 ACL baseline 확인

**DoD** (omxy 46차 Round 2 정정 후 최종):
- ✅ 적용 후 `mcp__supabase__get_advisors(security)` 재확인 → **anon-facing WARN 5건 해소** (`anon_security_definer_function_executable`)
- ✅ **authenticated WARN 3건 의도 잔존** — `is_admin` + `raise_portfolio_dispute` + `resolve_portfolio_dispute` (RLS 본문 호출 + admin RPC 활성). 미사용 2종(`mark_alert_read` + `record_alert_exit_decision`)은 **omxy Round 2 정정으로 authenticated도 회수** (least privilege; 활성화 시점 re-grant 마이그).
- ✅ /admin 로그인 + RLS-protected SELECT + dispute/resolve 기능 정상 회귀
- ✅ build/lint/test:ci 회귀 없음 (384→429/50 — P1.1 +40 tests 별도)
- ✅ proacl 결과를 commit message에 박제 (회귀 시 비교 baseline)
- ✅ **실 결과 (46차 적용 후)**: advisor anon WARN 0건 + authenticated WARN **3건** + HIBP 1건(P0.2). proacl AFTER: is_admin/raise/resolve = `auth=X, svc=X`; mark_alert_read/record_alert_exit_decision = `svc=X`만.

**cmux prompt template (다음 세션 그대로 발송)**:
```
ROUND - §7 P0.1 시작
사용자 §7 P0.1 진입. FixPlan-46.md §P0.1 참조.

선행 3단계:
1. mcp__supabase__get_advisors(security) → 5 함수 list/count 재확인
2. mcp__supabase__execute_sql로 pg_proc.proacl SELECT (FixPlan-46.md §P0.1 SQL) → 현재 ACL 보고
3. grep -rn 'rpc("mark_alert_read"|rpc("record_alert_exit_decision"|rpc("is_admin"' tudal/src

그 후 0015a_definer_execute_lockdown.sql 검토 (PUBLIC revoke + authenticated 2~4개 명시 grant).
주의: REVOKE FROM anon 단독은 PostgreSQL 기본 PUBLIC EXECUTE 때문에 작동 안 함.

DoD: anon-facing WARN 5건 해소 + authenticated WARN 5건 의도 잔존 + admin 기능 회귀 없음 + proacl baseline 박제.
리포트 후 SIGNAL: CONTINUE.
```

---

### P0.2 — HaveIBeenPwned leaked-password protection 활성화 — **⏳ 사용자 dashboard 작업 대기 (B-2A 큐)**

**문제**: Supabase advisor `auth_leaked_password_protection` WARN. HaveIBeenPwned.org 체크 비활성.

**수정 (코드 변경 없음)**: Supabase dashboard → Authentication → Policies → "Leaked password protection" 토글 ON.

**사용자 작업**: Claude/omxy는 dashboard 접근 불가 → 사용자가 직접 토글. HANDOFF §3 B-12 보안 rotate와 함께 처리 권장.

**DoD**: `mcp__supabase__get_advisors(security)` 재확인 → `auth_leaked_password_protection` 사라짐.

---

### P0.3 — 0009 rollback production-destructive SOP 박제 — **✅ 완료 (commit `9661037`, `DQ7-Credentials.md §6.10`)**

**문제**: `tudal/supabase/migrations/0009_dq7_credentials.rollback.sql`이 `truncate table public.brokerage_connection` + `drop table public.exchange_connection`. production에 brokerage_connection 1 row 존재 → rollback 시 운영 키 destruction. 파일에 "복구 불가능" 주석 있으나 운영 SOP 명시 필요.

**수정**: `Document/Build/Slices/DQ7-Credentials.md`에 신규 "운영 SOP" 섹션 — "0009 rollback은 production에 절대 실행 금지. 적용 전 brokerage_connection 행 0건 확인 + 사용자 명시적 승인 필수."

**cmux prompt template**:
```
ROUND - §7 P0.3 시작
DQ7-Credentials.md "운영 SOP" 신규 § 추가 — 0009 rollback production 금지.
draft: "0009 rollback은 production에 절대 실행 금지. truncate brokerage_connection + drop exchange_connection 수행되므로 적용 전 brokerage_connection 행 0건 확인 + 사용자 명시적 승인 필수. dev/staging에서만 사용."
검토 후 합의.
```

**DoD**: DQ7-Credentials.md commit + grep으로 SOP 텍스트 확인.

---

## P1 — 사용자 영향 (코드 변경, 3~4시간) — **✅ 완료 (commits `9661037` P1.2 + `4c6eea7` P1.1·P1.3·P1.4, omxy Round 6 CONVERGED)**

### P1.1 — 한국어 매핑 누락 (D-13) — **✅ 완료 (commit `4c6eea7`, Option B 채택, omxy Round 6 CONVERGED)**

**문제**: 5 패널에서 사용자가 영문 에러 코드 직접 노출.

**위치 (file:line)**:
- `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/regenerate-panel.tsx:35` default `오류: ${code}` — 미매핑: `invalid_input`/`invalid_month`/`ticker_required`/`invalid_ticker`
- `tudal/src/app/(admin)/admin/portfolio/portfolio-panel.tsx` — 4 매핑만, 추가 미매핑: `auth_unavailable`/`shortlist_lookup_failed`/`approval_lookup_failed`/`accept_gate_blocked:*`/`invalid_*`/`approval_not_found`/`already_disputed`
- `tudal/src/app/(admin)/admin/alerts/[id]/exit-decision-form.tsx` — 미매핑: `invalid_input`/`invalid_memo`/`auth_unavailable`/`real_persistence_not_configured`/`invalid_decision`
- `tudal/src/app/(admin)/admin/settings/settings-form.tsx` — 미매핑: `invalid_*`/`auth_unavailable`/`real_persistence_not_configured`
- `tudal/src/app/(admin)/admin/settings/{brokerage,binance}/form.tsx` + `delete-button.tsx` — credential 에러 res.error 원문 표시 (Invalid id format, pending-s8, raw DB message)

**수정 옵션 (cmux 합의)**:
- (A) 각 패널 formatErrorMessage 개별 확장 — 빠르고 작은 diff
- (B) `src/lib/admin/format-error.ts` 공통 헬퍼 추출 + 5 패널 import — 정규화·테스트 용이

**추천**: (B). 이유: D-8 wrapper error taxonomy 정규화(P3.3)와 자연 통합 + P3.4 formatErrorMessage 단위 테스트 추가 용이.

**cmux prompt template**:
```
ROUND - §7 P1.1 시작
한국어 매핑 누락 5 패널 처리. FixPlan-46.md §P1.1 참조.
옵션 (A) 개별 확장 vs (B) src/lib/admin/format-error.ts 공통 헬퍼 — 추천 (B).
(B) 합의 시 다음 step: 신규 헬퍼 구현 + 5 패널 import 변경 + 단위 테스트 추가.
검토 후 합의.
```

**DoD**: 5 패널에서 미매핑 코드 영문 노출 grep 0건 + build/lint/test:ci 회귀 없음.

---

### P1.2 — Settings 문구 ↔ 실제 정렬 (D-14) — **✅ 완료 (commit `9661037`)**

**문제**: `tudal/src/app/(admin)/admin/settings/page.tsx`에 "admin_settings·ticker_alert_pref UPSERT는 T7e.5에서 전환" 표기 vs 실제 `settings/actions.ts`는 mock fixture only + `real_persistence_not_configured` 반환. T7e.5는 regen-counter였고 settings persistence는 S7b/S7c 후속이라 문구가 stale.

**수정**: page.tsx에서 "T7e.5" → "S7b/S7c 후속에서 전환"으로 변경. owning slice 명확화.

**DoD**: page.tsx commit + S7b/S7c slice file에도 settings persistence task 박제 확인.

---

### P1.3 — (admin) loading.tsx / error.tsx / not-found.tsx (G-2-FE) — **✅ 완료 (commit `4c6eea7`)**

**문제**: `tudal/src/app/(admin)/` 라우트에 boundary 컴포넌트 0건. Supabase wrapper throw 시 Next.js 기본 error boundary로 빠짐 → 한국어 UX 미달.

**수정** (3 신규 파일):
- `tudal/src/app/(admin)/loading.tsx` — 한국어 "관리자 페이지 불러오는 중..." 스켈레톤
- `tudal/src/app/(admin)/error.tsx` — `'use client'` + reset 핸들러 + 한국어 "오류가 발생했습니다. 다시 시도해주세요" + 로그
- `tudal/src/app/(admin)/not-found.tsx` — 한국어 "페이지를 찾을 수 없습니다"

**DoD**: 3 파일 생성 + dev 서버에서 /admin/{nonexistent} → not-found 확인 + 의도적 throw 테스트로 error boundary 동작 확인.

---

### P1.4 — Boundary props 잔여 cleanup (D-12) — **✅ 완료 (commit `4c6eea7`, grep 0건 확인)**

**문제**: T7e.3~6에서 reportLinksEnabled/actionsEnabled/actionsDisabledMessage boundary가 기능적으로 해제되었으나 type/분기 잔여:
- `reportLinksEnabled`: DeltaBanner/BucketSection/ShortlistRow에 prop 정의는 남아있고 false 전달 없음. 기본값 true.
- `actionsEnabled`: PortfolioPanel에 정의, `/admin/portfolio/page.tsx`가 항상 true 전달.
- `actionsDisabledMessage`: 정의/렌더 분기만 있고 전달 없음.

**수정**: 사용처 없는 prop은 제거. 사용처가 있으나 항상 true/empty면 prop 자체 제거 + 분기 단순화.

**DoD**: 위 3 prop grep 0건 + 컴포넌트 simplify 후 build/lint/test:ci 회귀 없음.

---

## P2 — SoT cleanup (문서, 1.5~2시간)

### P2.1 — CLAUDE.md / HANDOFF / Dashboard / CodebaseStatus 카운트·차수 정렬 (D-1~D-6)

**문제 묶음**:
- CLAUDE.md:23 "test:ci 362/46 → 381/49" stale (실측 384/49)
- CLAUDE.md "Data layer" §(~166) admin-*.ts wrapper 6개 열거 — 실제 9개 (access-logs/performance/decision-tree 누락)
- CLAUDE.md "Supabase migrations" §(~172) "10개 적용" stale — 실제 17 파일 / 12 적용 (0002~0010 + 0012~0014, 0001 sketch 미적용, 0011 S8 reserve)
- CodebaseStatus.md:35 + :317-320 "49 files / 381 tests pass" stale
- CodebaseStatus.md:203 "S7e T7e.6 완료 기준" stale — 실제 T7e.8 완료
- CodebaseStatus.md:245-258 마이그 테이블 0001~0010만, 0012/0013/0014 행 결손
- ProgressDashboard.md:7 "S7e ~50%" vs :8 "S7e 7/8" 내부 충돌
- ServicePlan-Admin.md:394/658/663/686 + ReportFramework.md:695/797 "44차" → **45차로 통일** (사용자 결정)

**수정 액션**: 위 8 위치에서 카운트·차수를 실측과 일치 갱신. CLAUDE.md "프로젝트 재정의" § 마지막에 41~45차 chronological bullet (4건 추가). CodebaseStatus 마이그 테이블에 0012/0013/0014 행 추가.

**DoD**: grep으로 "381/49", "T7e.6 완료 기준", "S7e ~50%", "44차"가 위 SoT 파일에서 0건. CLAUDE.md 41~45차 bullets 존재.

**cmux prompt template**:
```
ROUND - §7 P2.1 시작
8 SoT 파일 카운트·차수 정렬 (FixPlan-46.md §P2.1 참조).
일괄 grep + replace 작업이라 omxy 합의 후 batch 수행.
검토 후 합의 → 실행 → 변경 diff 확인.
```

---

### P2.2 — HANDOFF "403"→"401" + news-sweep 주석 (D-15/D-16) — **✅ 완료 (47차 cmux omxy 4 rounds CONVERGED)**

**수정 실행**:
- ✅ HANDOFF.md:105 (RLS QA 표) "없으면 403, 있으면 200" → "없으면 401, 있으면 200" (cron route 4종 모두 `status: 401` 반환 grep 검증)
- ✅ `tudal/src/app/api/cron/news-sweep/route.ts:13` 주석 "Vercel Cron 15분 주기." → "Vercel Cron daily 00:00 UTC (vercel.json schedule `0 0 * * *`)."

**DoD 달성**: build 25 routes / lint 0 / test:ci 50 files 429 tests / tsc clean.

---

### P2.3 — .env.local ↔ .env.example 동기화 (D-18) — **✅ 완료 (47차 cmux omxy 4 rounds CONVERGED)**

**omxy Round 2 정정 (Beauvoir explore agent)**: `.env.example`에 이미 존재하는 키 = `API_CRED_MASTER_KEY:89` + `CRON_SECRET:80` + `ADMIN_REP_EMAIL:93`. 실 누락 = **DART_API_KEY / KRX_ID / KRX_PW 3 키만**.

**수정 실행**:
- ✅ `tudal/.env.example` 신규 `[S7e T7e.8 — 2026-05-12]` 섹션 (line 95~103) — `DART_API_KEY` + `KRX_ID` + `KRX_PW` 3 키 + owning slice 주석 (DART OpenAPI 마이그 0013/0014 / KRX login `data.krx.co.kr` pykrx universe fetch).
- ✅ `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`는 **의도적 주석 잔존** (line 18) — 코드 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 단독 사용 (`src/lib/supabase/{middleware,server,client}.ts` 3 파일 grep 검증). onboarding 가이드 명확성 우선.

**DoD 달성**: `.env.example` 키 = `.env.local` 키 union (publishable 의도적 차이만 잔존) + onboarding 가독성 검증.

---

### P2.4 — CLAUDE.md "DQ7 다음 세션 진입점" stale 제거 + CodebaseStatus 하단 갱신 (G-2/G-3) — **✅ 완료 (47차 cmux omxy 4 rounds CONVERGED, Curie explore agent 권고 추가 반영)**

**수정 실행**:
- ✅ CLAUDE.md:78 (보조 문서 표 DQ7-Credentials 행) "**다음 세션 진입점**" 제거 + "Smoke #4/#5 + Session 4 QA 잔여" 정확화 + "1순위는 `HANDOFF.md §2` 참조" 가이드 추가
- ✅ CodebaseStatus.md 현재 기준 헤더 3곳 정정:
  - line 215: `2026-05-08 · S7e T7e.6 완료 기준` → `2026-05-13 · S7e T7e.8 완료 / 45차 · 46차 P0·P1 + 마이그 0012~0014 적용`
  - line 329: `(S7e T7e.6 완료 후, 2026-05-08)` → `(46차 P0·P1 완료 후, 2026-05-13)`
  - line 332: `49 files / 381 tests pass` → `50 files / 429 tests pass`
- ✅ **Curie 권고 추가** — CodebaseStatus.md 체크리스트 정정 (Round 4):
  - line 368 마이그 라인: `0001~0008 + 0009 파일 생성` → `0001~0010 + 0012~0015a 적용` (production)
  - line 372 헤더 + 13 체크 항목: `(S7, 미착수)` → `(S7, 진행 중 — S7e T7e.8 + 46차 P0·P1 완료, S7a 진입 대기)` · Naver/0009/0010 ✅ 표기 · Supabase 실 I/O 🟢 · B-6/B-7/B-9/B-10 사용자 액션 큐 참조
  - line 387 운용 검증: `(미착수)` → `(진행 중)` + Vercel/origin push ✅ + D11 AI 가상 포트 운용 검증 항목 신규
- ✅ 세션 로그 (line 36/48/61/73/79/160/291) T7e.6 참조는 **history 보존** (omxy 지적 — 역사 왜곡 회피)
- ✅ `tudal/src/app/(admin)/admin/report/[ticker]/record-view.ts:18` 주석 "S2 Supabase 연결 시" → "T2.4 후속 — S7e 이후 별도 slice. 본 record-view는 mock 관측 only 의도" 명확화
- ✅ 본 FixPlan-46.md §P2.4 자기 경로 정정 (omxy Round 1 발견: `tudal/src/lib/report/record-view.ts` 존재하지 않음 → `tudal/src/app/(admin)/admin/report/[ticker]/record-view.ts`)

**DoD 달성**: 위 SoT 파일들 변경 후 build / lint / test:ci / tsc 4 게이트 통과. grep 증거 6종 모두 0건 확인.

---

## P3 — 신규 작업 (마이그·기능·테스트, 1~2주, 다음 1+ 세션)

### P3.1 — T7a.11 D20 Section 8 위원 전원 표 컴포넌트 (G-D20)

**문제**: D20 4종 정적 표 (Sector 14 / Core 11 / 쟁점 / 최종 합의 패널) 미구현. `tudal/src/app/(admin)/admin/report/[ticker]/page.tsx` Section8View가 keyQuotes loop + MiniBar + VoteList <details>만 렌더. T7a.11 박제만 됨, 코드 0건.

**SoT**: `ServicePlan-Admin.md §3.7 R3.7-6/7/8` + `§6 D20` + `ReportFramework §8 Step 2 v2.3` + `Document/Outputs/Report-Alteogen_196170_v3-Readable.md §Section 8 Part A/B/C` reference.

**예상 산출물**:
- `tudal/src/components/admin/report/section-8-committee-tables.tsx` 신규 (4 테이블 + 1 합의 패널)
- `tudal/src/lib/data/admin-reports.ts` ReportSection8 type 확장 (final panel: sectorAggCounts, coreReVoteAggCounts, coChairUnanimous, formalVerdict, rationale)
- `admin-committee.ts` getVotesByReportId가 Sector 14 + Core 11 row JOIN 보장
- 마이그 0017 또는 0018 (committee_votes vote/argument column 정합성 — 박제 시점 결정)

**연결**: D20 contract는 S7a (Anthropic wrapper)가 writer로 산출하므로 S7a 진입 전 또는 진행 중 병행 가능. S7-RealData.md:109 T7a.11 line 활성화.

---

### P3.2 — accept_shortlist_with_snapshots RPC (G-1, 마이그 0016) — **✅ 완료 (48차 commit, omxy 3 rounds CONVERGED, apply 보류)**

**문제**: `acceptShortList()`가 `createPortfolioApproval()` 성공 후 `insertPortfolioSnapshots()` 실패 시 orphan approval 가능 (Phase 2 G-1 박제). 현재 entry_price_unavailable fail-closed가 pre-approval에서 막지만, 실 가격 wire 후 race 잔존.

**수정 완료**:
- `tudal/supabase/migrations/0016_accept_shortlist_rpc.sql` + rollback 신규
- signature: `accept_shortlist_with_snapshots(p_month text, p_shortlist_generated_at timestamptz, p_snapshots jsonb) returns jsonb` (p_admin_id 인자 제거 — omxy 정정, 내부 `v_admin := auth.uid()`로 spoof 차단)
- `security definer` + `set search_path = public, pg_temp` (omxy 권고: pg_temp 추가)
- plpgsql 단일 txn (DDL begin/commit 아님 — omxy 정정)
- **auth 순서 omxy R2 정정**: `auth.uid()` null → `auth_unavailable` raise → `public.is_admin()` 가드 → `admin_required` raise (미인증을 admin_required로 뭉개지 않음)
- `jsonb_typeof(p_snapshots) = 'array'` guard → `invalid_snapshots` raise (omxy R2)
- portfolio_approval INSERT (is_final=true) RETURNING id + portfolio_snapshot bulk INSERT (`jsonb_array_elements` + coalesce defaults)
- EXCEPTION unique_violation → `get stacked diagnostics constraint_name` 분기 (`portfolio_approval_final_month_uniq` → jsonb error 'already_finalized' return / 기타(snapshot side 등) → `raise;` re-raise)
- `revoke execute from public` + `grant execute to authenticated` (0015a 패턴)

**관련 코드 수정 완료**:
- `tudal/src/lib/data/admin-approvals.ts`에 `acceptShortlistRpc()` wrapper 신규 (snake-case payload 변환 + payload shape 가드 — unexpected payload 시 throw)
- `tudal/src/app/(admin)/admin/portfolio/actions.ts:267-302` acceptShortList → `acceptShortlistRpc({month, shortlistGeneratedAt, snapshots})` 단일 호출. `createPortfolioApproval`+`insertPortfolioSnapshots` 직접 호출 제거. `isUniqueViolation` catch 잔존 — RPC가 snapshot-side unique 등 비-approval 23505를 re-raise할 경우 defensive 매핑.

**테스트 추가 (+4)**: admin-approvals.test.ts `describe("acceptShortlistRpc")` 4 it (happy + already_finalized + raw error re-throw + unexpected payload guard).

**Apply 상태**: **production apply 완료 ✅** (사용자 트리거 직후). 적용 직후 **anon revoke 누락 발견** → follow-up 마이그 `revoke from anon` apply + 0016 SoT 파일에도 라인 추가하여 self-consistent. **근본 원인**: Supabase가 신규 `public.*` 함수에 anon/authenticated/service_role default grant를 자동 부여 (0015a 마이그 적용 후 추가된 신규 함수는 anon X 자동 회복). **최종 ACL**: `{postgres=X, authenticated=X, service_role=X}` (anon 제거). **advisor**: anon WARN **0건 유지** · authenticated WARN **3→4** (accept_shortlist_with_snapshots intended). Apply order: 0010 → 0012~0014 → 0015a → **0016 ✅**. 0011은 S8 자동매매 reserve.

**DoD 달성**: build 25 routes · lint 0 · test:ci 463/50 (+34 vs 429) · tsc clean.

---

### P3.3 — Wrapper error taxonomy 정규화 + invariant 주석 비대칭 (D-8/D-9/D-10/V-4)

**문제**:
- 9 wrapper 일부 wrapped Error (`X query failed: ...`), 일부 raw passthrough (admin-approvals:132/148/160, admin-snapshots:80)
- DB invariant 주석 비대칭: regen-counters 강 / approvals 중(partial UNIQUE month 누락) / snapshots 약(partial UNIQUE date,ticker 없음) / performance 강

**옵션 (사용자 결정 필요)**:
- (A) wrappers raw passthrough + action-layer 매핑 일원화 (변경량 최소, P1.1 i18n과 자연 통합)
- (B) wrappers throw typed/domain errors (정규화 강함, 변경량 큼)

**추천**: (A) + 모든 wrapper 헤더 주석에 의존 invariant 명시 일관화.

---

### P3.4 — 신규 테스트 (G-cron-auth-test, G-wrapper-error-path, G-FE-error-map-test) — **✅ 완료 (48차 commit, +29 tests)**

**추가 실행**:
- **G-cron-auth (+12)**: 4 cron route 각각 `describe("authorization (G-cron-auth)")` — no header / wrong secret `Bearer wrong-secret` / wrong scheme `Basic cron-secret` 3 × 4 = 12 it. 모두 401 + `body.error === "unauthorized"` 검증.
- **G-wrapper-error (+8)**: characterization tests (P3.3 결정 전까지 raw passthrough/wrap 패턴 그대로 박제, omxy R2 권고)
  - admin-shortlist: getActiveShortList throw `/short_list_30/` (Supabase mock 신규 setup)
  - admin-approvals: getApprovalsByMonth throw + createPortfolioApproval 23505 raw passthrough(`toMatchObject({code: "23505"})`) + raisePortfolioDispute P0001 raw passthrough
  - admin-snapshots: empty array noop(supabase 미호출) + insertPortfolioSnapshots 23505 raw passthrough
  - admin-reports: getReportByTicker throw `/stock_reports/`
  - admin-committee: happy path + getVotesByReportId throw `/committee_votes/` (Supabase mock 신규 setup)
- **G-FE-map (+9)**: 5 specific high-importance Korean(cost_hardcap_40man/already_finalized/real_persistence_not_configured/regen_counter_write_conflict/reanalysis_limit_reached) + 2 accept_gate_blocked edge(empty suffix → prefix handler hit / no colon → fallback) + 2 dev-only console.warn(development+window warns / production silent).

**총 +29 P3.4 + P3.2 +4 = +34 (429→463). 실측 463 — omxy R3 권고 채택, 추정 472~477 대신 실측 명시.**

**DoD 달성**: test:ci 50 files / 463 pass (+34) · 신규 0 regression.

---

## P4 — Mock 정리 backlog (S7b/S7c/S7d/T7a 자연 진행)

25 mock import의 owning slice 표 — 후속 slice 진행 시 mock 제거 trigger:

| Mock surface | owning slice |
|---|---|
| silent-health + mock-admin-pipeline-health/alerts | S7d |
| morning-briefing, news-sweep, mock-admin-news/briefings | S7b |
| /admin briefing/intraday | S7b/S7c |
| /admin/settings/cost | T7a/S7a |
| /admin/settings/health pipeline-health | S7d |
| /admin/alerts/* alerts/news/exit decision | S7b/S7c |
| /admin/report committee-personas | T7a.11 (P3.1) |
| /admin/report/.../regenerate cost-log | T7a/S7a (39차 의도) |
| /admin/portfolio + /admin/report report_view_log | T2.4 → S7e 이후 (record-view.ts 주석 stale은 P2.4) |

---

## G-cron-mock backlog (별도, S7b/S7d 진행 시 처리)

4 cron route 모두 mock JSON response only — 실 DB INSERT 없음:
- `monthly-batch`: production-like에서 smokeOnly: true, durableWrites false
- `morning-briefing`: briefing_log/alert_event INSERT TODO
- `news-sweep`: live Naver fetch 가능하나 news_event/alert_event INSERT 없음
- `silent-health`: heartbeat_log/alert_event payload 생성만, INSERT 없음

Idempotency도 durable write 미구현이라 DB-level dedupe 적용 지점 없음.

owning slice: S7b (briefing/news) + S7d (health) + 일부 S7c (intraday alerts).

---

## 운영 메모

- **D-7 재확인 필수**: 다음 세션 첫 액션은 `mcp__supabase__get_advisors(security)` 호출로 함수 list 재확인. 5개 외 변동 가능.
- **VERIFY 사용자 결정 박제됨** (이 문서 상단 4건).
- **자동화 P3 backlog** (T7e.7 RLS 자동 테스트): D11 운용 검증 안정화 후 결정.
- **omxy 컨텍스트 관리**: 각 task 진입 시 omxy 컨텍스트 30% 이하면 `/compact` 요청.
- **Vercel prod env sync 검증** (V-prod-env): production env 실 동기화는 Claude/omxy MCP에서 확정 불가 — 사용자가 `vercel env ls`로 직접 확인. 후보 키: `ANTHROPIC_API_KEY`/`RESEND_API_KEY`/`TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_IDS`/`NEXT_PUBLIC_SITE_URL`/`DART_API_KEY`/`KRX_ID`/`KRX_PW`.
- **G-middleware-cron** (low priority): `tudal/middleware.ts` matcher가 `/api/cron`도 통과 — 기능 문제 아니나 불필요한 Supabase auth call. P4 backlog.

---

## 변경 이력

- **2026-05-13 (46차 audit 박제)**: 초안 작성 + omxy 3차 라운드 정정 반영. P0.1 = PUBLIC REVOKE + authenticated re-grant (`is_admin` + admin 활성 RPC). DoD = anon-facing WARN 5건 해소 + authenticated WARN 의도 잔존 + RLS-protected SELECT 정상. omxy CONVERGED (a)~(f) + PostgreSQL ACL 정확 모델.
- **2026-05-13 (46차 실행 + P2.1 정정)**: P0/P1 실행 완료 박제. omxy Round 2 CONVERGED 정정 — 미사용 2종(`mark_alert_read`/`record_alert_exit_decision`) authenticated도 회수 → DoD "authenticated WARN 5건 의도 잔존" → **"3건 의도 잔존"으로 정정**. Production hotfix push로 ahead 39 + 46차 P0/P1 batch 모두 origin/main 동기 ✅. 다음 세션 P2.2~P2.4 + P3 + S7a(B-6 트리거)로 진행.
- **2026-05-13 (47차 P2.2~P2.4 실행)**: SoT cleanup 3건 완료. **cmux pair-debate omxy 4 rounds 모두 CONVERGED**. R1 scope 제안 → R2 Beauvoir explore agent 검증으로 (1) `.env.example` 기존 키 3개(API_CRED_MASTER_KEY/CRON_SECRET/ADMIN_REP_EMAIL) 발견 → 실 누락 3개만(DART/KRX) 추가 (2) record-view 경로 정정 (`tudal/src/lib/report/...` → `tudal/src/app/(admin)/admin/report/[ticker]/record-view.ts`) (3) PUBLISHABLE_KEY 의도적 잔존 확인. R3 build/grep 6종 증거. R4 Curie explore agent 권고로 CodebaseStatus.md 체크리스트 14 항목 정정(`(미착수)` → `(진행 중)` + 0009/0010 ✅ + Supabase 실 I/O 🟢 + Vercel/origin push ✅). 7 파일 +46/-24. 검증 게이트 25 routes / 0 / 50 files 429 tests / tsc clean. 다음 세션 P3 + S7a(B-6 트리거)로 진행.
- **2026-05-13 (48차 P3.2 + P3.4 실행)**: §7 P3 우회 작업 2건 완료. **cmux pair-debate omxy 3 rounds 모두 CONVERGED**. R1 scope 제안(P3.1·P3.3 유예) → R2 omxy 정정 8건 채택 (D 마이그 5건: p_admin_id 제거·auth.uid()·search_path pg_temp·plpgsql 단일 txn·constraint_name 분기 / 추가 3건: auth_unavailable 우선 검사·jsonb_typeof array guard·orphan 미호출 assertion) → R3 실행 결과 보고 + omxy 4 권고(test count 463 실측 명시·isUniqueViolation 잔존 명시·SoT 범위 좁힘·apply order note). 산출: 마이그 0016 `accept_shortlist_with_snapshots` 파일 + rollback + `acceptShortlistRpc` wrapper + actions.ts 일원화 + 33 신규 tests. 검증 게이트 25 routes / 0 / 50 files **463 tests** (+34) / tsc clean. **마이그 0016 apply 보류** (B-16 큐, 사용자 트리거 대기). 다음 세션 = S7a (B-6 AI 키 트리거) 또는 P3.1(D20, S7a 시드 후) + P3.3(error taxonomy 사용자 결정).
