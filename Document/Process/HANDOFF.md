# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-12 (42차 — T7e.8 인프라 박제: 마이그 0012 적용 ✅ + `scripts/screen_shortlist_tier0.py` 작성 ✅ + admin-shortlist transformer 새 컬럼 read ✅ · Tier 0 실 시드는 venv+pykrx+DART 키 사용자 측 세팅 후 수동 실행)

**목적**: 새 세션에서 사용자가 “`Document/Process/HANDOFF.md` 보고 이어서 진행”이라고 하면, 이 파일만으로 남은 일을 바로 판단·착수하게 한다.
**운영 원칙**: 미래 지향. 완료 이력 상세는 `Document/Build/Slices/S7-RealData.md`, `Document/Build/ProgressDashboard.md`, `Document/Process/CodebaseStatus.md`, git diff/log에 위임한다.

---

## 0. 세션 시작 루틴

```bash
git status --short --branch
cd tudal
npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

- 사용자에게 별도 지시가 없으면 **§2.A T7e.8 Tier 0 Python 실 시드**(사용자 측 venv+pykrx+DART 키 세팅 후 수동 실행)를 안내하거나 후속 **§2.B T7e.7 RLS 수동 QA**를 제안한다.
- Supabase MCP가 필요하면 세션 초반 OAuth 재인증이 필요할 수 있다: `mcp__supabase__authenticate` → 브라우저 Authorize.
- 42차에 마이그 0012(name/sector ALTER TABLE) 적용 + `scripts/screen_shortlist_tier0.py`(Tier 0 인디케이터 자동 스크리닝) + `admin-shortlist.ts` transformer 새 컬럼 read 박제. 2 commit으로 분리(`50a96b2 feat(T7e.8): migration 0012` · 후속 `feat(T7e.8): scripts + transformer wiring`).

---

## 1. 현재 상태 요약

| 영역 | 현재 상태 |
|---|---|
| Mock Skeleton | ✅ S0~S6 · Must 19/19 mock 동작 |
| DQ-7 Admin Credential | 🟢 ~97% · Smoke #4/#5 + Session 4 QA 잔여 · Smoke #3(Binance)은 S8까지 유예 |
| S7e Supabase 실 I/O | 🟢 **7/8 완료** — T7e.1~T7e.6 ✅ + T7e.8 인프라 ✅(마이그 0012 + Python 스크립트), Tier 0 실 시드 venv 대기 + T7e.7 RLS QA 잔여 |
| 실데이터 Must | 0/19 · DB 통로 + name/sector 컬럼 + Tier 0 시드 스크립트 박제 완료, **실 30종목 시드 사용자 venv 후 1+/19** |
| 실 AI 호출 | 0 · Anthropic key 전까지 Tier 0만 가능 |
| 자동매매/S9 | S8 미착수 · 운용 검증 0일 |
| Production | Vercel `https://tudal-tawny.vercel.app` · 25 routes |
| Supabase | project `rbrpcynhphrpljbjirfo` · 0002~0010 + **0012(name/sector) 적용** · 0011 슬롯은 BL-KRIT-8 S8 자동매매 보존 · 다음 마이그 번호는 기본 **0013** |
| 검증 기준 | 최근 fresh gate: build 25 routes · lint 0 · test:ci **384 pass / 49 files** · `tsc --noEmit` 0 |
| Git | HEAD = 42차 두번째 commit (예정) · origin/main ahead 19 (예상) · 작업트리 clean(`docs/superpowers/plans/`는 의도적 미추적) |

### T7e.6까지의 필수 계약

- `portfolio_approval` 테이블명은 마이그 0004 기준 **단수**를 사용한다.
- `/admin/portfolio`는 approval SELECT/Reject/dispute/resolve 실 I/O 진입 가능.
- Accept는 아직 운영 가능이 아니라 **fail-closed**: 실 entry price source 전까지 `entry_price_unavailable`으로 E4 INSERT 전 중단한다.
- production DB에 synthetic/fake price를 절대 저장하지 않는다.
- Reject 2회 UX 응답은 `reanalysisCount=2`, DB 저장은 CHECK(≤1)에 맞춰 1 clamp. 3회 Reject는 `reanalysis_limit_reached`.
- 신규 오류 코드 3종은 한국어 UI 배너로 매핑됨: `entry_price_unavailable`, `approval_write_failed`, `reanalysis_limit_reached`.
- E4+E5 트랜잭션 RPC화는 실 entry price wiring 시점의 후속 과제다.
- `regen_counter` race 보호는 **마이그 0005의 UNIQUE(ticker,month) + CHECK(manual_count ≤ 2) + Postgres 행 잠금** 위에서 4단계 CAS(idempotent INSERT 23505 무시 → SELECT → cap 즉시 종료 → `UPDATE WHERE manual_count = current_value`)로 처리한다. 신규 마이그/RPC를 추가하지 않는다.
- 신규 에러 코드 3종은 한국어 UI 배너로 매핑됨: `regen_counter_lookup_failed`, `regen_counter_write_failed`, `regen_counter_write_conflict`.
- M9 manual cap은 `MANUAL_REGEN_CAP=2` 순수 로직 + DB CHECK가 함께 박제한다. 클라이언트는 데이터 레이어 응답(`{ ok, manualCount, reason? }`)으로만 분기한다.
- 월 40만원 hardcap 검사는 **여전히 `MOCK_ADMIN_COST_LOG` 합계** 기반이다. cost_log 실 INSERT/SELECT는 S7a/T7a 범위.
- access-logs source는 T7e 범위 밖이며, `getRecentAdminAccessLogs()`가 `[]` 반환하는 boundary stub이다. BL-20 7일 단일 어드민 자동 바이패스는 실 source 정의 전까지 영구 비활성.
- `/admin/track-record`의 Counterfactual은 `portfolio_snapshot`으로 산출 불가하므로 `null` + UI '운용 데이터 누적 후 산출' 대기. AI 비중 시계열 저장 정책은 D11/S9 이후.
- performance + decision-tree는 `portfolio_snapshot`(0005) 단일 SoT에서 `src/lib/performance/*` (sharpe/mdd/judge/cap-months) 순수 로직으로 산출. 별도 테이블 없음.

---

## 2. 다음 작업

### A. 다음 1순위 — T7e.8 Tier 0 실 시드 (사용자 측 venv 실행)

**42차 상태**: 인프라 박제 완료 — 실 시드 1회 실행만 남음.
- ✅ 마이그 0012 `short_list_30_name_sector` production 적용(`20260512000451`).
- ✅ `scripts/screen_shortlist_tier0.py` 작성 — argparse + lazy import + 5-Signal × 시간대별 가중치 + idempotent UPSERT + delta_status hold/new.
- ✅ `src/lib/data/admin-shortlist.ts` SELECT/transformer가 새 `name`/`sector` 컬럼을 우선 read (tickerMeta fallback 유지).
- ⏸ 실 30종목 시드 = 사용자 측 venv + pykrx + (optional) DART 키 + service_role 환경변수 세팅 후 수동 실행.

**사용자 측 1회 실행 절차**:
```bash
cd /Users/yong/New_Project_KR_Stock
python3 -m venv scripts/.venv
source scripts/.venv/bin/activate
pip install pykrx supabase requests

# 환경변수 (.env 또는 export)
export SUPABASE_URL="https://rbrpcynhphrpljbjirfo.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="…"
export DART_API_KEY="…"    # (optional) 없으면 Signal 4·5 = 0 + 경고

# 1) dry-run (Supabase write 없음, CSV + stdout 미리보기)
mkdir -p scripts/out
python3 scripts/screen_shortlist_tier0.py \
  --month 2026-05-01 \
  --dry-run \
  --csv-backup scripts/out/short_list_30_2026-05_dryrun.csv

# 2) CSV inspect → bucket 분포·종목명 정합성 확인 후 본 적용
python3 scripts/screen_shortlist_tier0.py \
  --month 2026-05-01 \
  --apply \
  --csv-backup scripts/out/short_list_30_2026-05.csv
```

**전제**:
- 로컬 Python venv (Homebrew Python 3.14 PEP 668 제약 → `python3 -m venv scripts/.venv`)
- Supabase service_role 키 (anon 키로는 RLS에 막힘 — admin allow policy도 service_role 우회 필요)
- DART OpenAPI key (재무 데이터). 없으면 Signal 4·5 = 0으로 평탄해져 장기 bucket이 거의 동점이 됨. 단·중기 bucket은 정상 작동.
- `admin_emails` 3 row 확인 (32차 INSERT 완료)
- 마이그 0012 production 적용 (42차 ✅)

**실 시드 후 검증**:
- `mcp__supabase__execute_sql`로 `select bucket, count(*) from short_list_30 where month='2026-05-01' group by bucket;` → short/mid/long 각 10 row 확인.
- `npm run dev` → `/admin` 홈에서 진짜 종목명·섹터 노출 확인 (D19 운용 검증 핵심).
- delta_status는 첫 회는 모두 `new` (전월 row 없음). 둘째 달부터 hold/new 분포 형성.

**스코프 제외 (T7e.8 follow-up)**:
- `removed` delta 처리 — `rank int NOT NULL` 제약 + sentinel 정책 미정.
- 자동 cron 등록 — 월 1회 수동 실행 가정.
- 14섹터 KRX 산업분류 매핑 — 현재는 "코스피"/"코스닥" 시장 fallback.

### B. 후속 — T7e.7 RLS 브라우저 수동 QA

**목표**: T7e.8 시드 완료 후 kevin / son00326 / shjang1001 3개 어드민 계정으로 `/admin` 라우트별 RLS 통과·거부 동작을 브라우저에서 수동 QA한다. 결과는 `Document/Build/Slices/S7-RealData.md` 의사결정 로그/이슈에 박제한다.

**전제**:
- T7e.8 시드 완료 (`short_list_30`/`stock_reports`/`committee_votes` 채워짐). 시드 부재 상태에서는 빈 UI/notFound 일관 동작이라 RLS 분기 의미 없음.
- `admin_emails`에 3 row가 박혀 있어야 한다 (32차 INSERT 완료).

**수동 QA 항목 (예시)**:
- 비-어드민 이메일 계정 → `/admin/*` 접근 → 미들웨어 redirect 확인
- 어드민 A 계정 → 어드민 B의 `regen_counter`/`portfolio_approval`/`brokerage_connection` 행을 직접 SQL/UPDATE 시도 → RLS 거부
- `/api/cron/*` → `Authorization: Bearer ${CRON_SECRET}` 없으면 403, 있으면 200
- security-definer RPC (`mark_alert_read`, `raise_portfolio_dispute`, `resolve_portfolio_dispute` 등) → 함수 본문 `is_admin()` 가드 동작 확인 (anon 호출은 즉시 거부)

**기록**
- QA 결과 (PASS / FAIL + 재현 단계)는 `Document/Build/Slices/S7-RealData.md`에 기록.
- FAIL 발견 시 0011 슬롯은 BL-KRIT-8, 0012는 T7e.8 name/sector 점유이므로 **0013 이후**로 패치한다.

---

## 3. 사용자 액션 대기 큐

| 우선 | 작업 | 필요한 사용자 액션 | 블록하는 범위 |
|---|---|---|---|
| B-1 | 친구 2명 임시 비번 설정 | 32차 admin API 패턴 재사용 | DQ-7 Smoke #4 |
| B-2 | 친구 KIS row 슬롯 정리 | son00326 슬롯의 친구 키를 shjang1001 슬롯으로 이전 후 son00326 row 삭제 | Smoke #4 데이터 의미 정합성 |
| B-3 | Smoke #4 RLS 격리 | kevin 계정으로 brokerage row 0건 확인 | DQ-7 Session 3 close |
| B-4 | Smoke #5 대표 가드 | 친구 계정에서 Binance mainnet 라디오 403 확인 | DQ-7 Session 3 close |
| B-5 | DQ-7 Session 4 QA | T18 manual QA 30항 + T19 security probes + review/security-review | DQ-7 최종 close |
| B-6 | Anthropic API Key | Vercel env `ANTHROPIC_API_KEY` | S7a Tier 1/2 AI |
| B-7 | Resend 도메인 인증 | Resend domain + env | S7b briefing |
| B-8 | Naver key rotate/env | 31차 노출 키 rotate 후 Vercel env | S7b news |
| B-9 | Telegram bot | token + admin 3명 chat_id | S7c alerts |
| B-10 | KIS 본인 1개 | 한투 OpenAPI key/account | S7c WS read-only |
| B-11 | Binance key | S8 진입 시 발급 | S8 + Smoke #3 |
| B-12 | 보안 rotate | Supabase anon/service_role/DB password/PAT, 노출 KIS/Naver secret rotate | S7a 전 권장 |
| B-13 | Vercel CLI update | v53 최신화 | 향후 deploy 권장 |
| B-14 | Magic Link 디버깅 | 시크릿 창/Email Template/PKCE callback 확인 | S9 전 권장 |
| B-15 | Git push/commit | 32~36차 ahead 5 + 37~40차 변경 commit/push | 협업 안정화 |

---

## 4. 안전 규칙

- 이 제품은 내부 어드민 투자 운영 도구다. Public signup/member/pricing/subscription 트랙은 Deferred-D가 재개되기 전까지 만들지 않는다.
- mock-first 상태다. S7 태스크 범위 밖에서 mock import를 real API로 몰래 바꾸지 않는다.
- `/admin` 접근은 Supabase session refresh + `ADMIN_EMAILS` allowlist + RLS 3중 방어를 유지한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 client-exposed 코드에 절대 넣지 않는다.
- credential plaintext/MEK/ciphertext를 UI나 로그에 노출하지 않는다. credential secret은 `src/lib/crypto/aes.ts`로 서버 측 암호화한다.
- KIS/Binance credential은 per-admin DB record다. 글로벌 `KIS_*`/`BINANCE_*` env로 되돌리지 않는다.
- UI 문구는 한국어 우선. 새 server action error code는 raw code로 노출하지 말고 한국어 매핑을 추가한다.
- Next.js 16 routing/middleware/server action 관련 변경 전에는 `tudal/node_modules/next/dist/docs/` 또는 공식 문서를 확인한다.

---

## 5. 문서 SoT

| 필요 정보 | 문서 |
|---|---|
| S7e 상세 태스크/의사결정 | `Document/Build/Slices/S7-RealData.md` |
| 전체 진행률/변경 이력 | `Document/Build/ProgressDashboard.md` |
| 코드 스냅샷/잔존 mock 목록 | `Document/Process/CodebaseStatus.md` |
| DQ-7 credential 잔여 | `Document/Build/Slices/DQ7-Credentials.md` |
| 어드민 기획/AI 강화 D19 | `Document/Service/Planning/ServicePlan-Admin.md` |
| 리포트/AI 평가 프레임 | `Document/Service/Report/ReportFramework.md` |
| S8 자동매매 | `Document/Build/Slices/S8-AutoTrading.md` |
| 실행 규칙 | `Document/Process/ExecutionPlaybook.md` |

---

## 6. 최근 완료 요약

- **42차 T7e.8 인프라**: 마이그 0012 적용(`20260512000451 short_list_30_name_sector`) + `scripts/screen_shortlist_tier0.py` 작성(5-Signal Composite × 시간대별 가중치 short=0.4/0.3/0.2/0.05/0.05 → mid=0.2/0.15/0.15/0.3/0.2 → long=0.1/0.05/0.05/0.2/0.6, z-score → 0~100 normalize, 단/중/장 후보 50→top 10×3=30, idempotent UPSERT on_conflict=`month,ticker`, bucket 우선순위 정렬 long→short, 전월 비교로 delta_status hold/new) + `admin-shortlist.ts` transformer가 `row.name?.trim() || meta?.name || row.ticker` 3단 precedence로 새 컬럼 우선 read. 신규 Vitest 2 (DB 컬럼 우선 + 빈 문자열 fallback). 검증: build 25 routes · lint 0 · test:ci **384/49** (이전 381/49 +3). 분리 2 commit: `50a96b2 feat(T7e.8): migration 0012 short_list_30 name/sector columns` + 후속 `feat(T7e.8): scripts/screen_shortlist_tier0.py + transformer wiring`. **실 30종목 시드는 사용자 측 venv+pykrx+DART 키 세팅 후 수동 1회 실행 대기**.
- **41차 박제 사전**: T7e.5(39차) + T7e.6 follow-up(40차) 미커밋 변경을 `6dd7f01 feat(T7e.5)` · `83ee4e7 fix(T7e.6)` 2개 commit으로 분리 박제. 41차 자체는 문서 박제 only.
- **40차 T7e.6**: access-logs/performance/decision-tree Supabase 전환. 3개 mock 파일 삭제 + 3개 신규 data layer (`admin-access-logs.ts` boundary stub, `admin-performance.ts` summary/monthly/bucket/counterfactual, `admin-decision-tree.ts` snapshot). pinned decisions: access-logs `[]` + BL-20 영구 비활성, counterfactual `null` + D11/S9 deferred. 신규 마이그 0건 (단일 SoT = `portfolio_snapshot` + `src/lib/performance/*` 순수 로직). `/admin/track-record`·`/admin/decision-tree`·`/admin/portfolio` 페이지+actions 갱신. test:ci 381/49 (+19/+3, consistency assertion 1개 제거 반영). 4-gate 모두 clean.
- **39차 T7e.5**: `regen_counter` Supabase 실 I/O. `src/lib/data/admin-regen-counters.ts` 신규(transformer + computeNextMonthResetAt + getRegenCounter SELECT + incrementManualRegenCount 4단계 CAS). 신규 마이그/RPC 0건 — 마이그 0005의 UNIQUE/CHECK + Postgres 행 잠금이 race를 차단. `regenerate/page.tsx`+`actions.ts`+`regenerate-panel.tsx` 갱신 + `mock-admin-regen-counters.ts` 삭제 + `formatErrorMessage()` 한국어 8종. test:ci 362/46 (+17/+1).
- **38차 후속 fix**: `portfolio-panel.tsx` 신규 에러 코드 3종 한국어 매핑 추가, `resolveRealEntryPrice()` TODO 마커 추가, test:ci 345/45.
- **38차 T7e.4**: approvals/snapshots data layer 신설, portfolio approvals 실 SELECT/INSERT/RPC, Accept fake price 금지 + fail-closed, Reject 3회 차단.
- **37차 T7e.3**: reports/committee data layer 신설, report page 실 SELECT, regenerate report 존재 검사 실 SELECT.
- **36차 T7e.1~2**: 0010 적용 검증, shortlist data layer 신설, page-level importer 전환.

상세 완료 이력은 이 파일에 더 늘리지 말고 `ProgressDashboard.md` 변경 이력 또는 git history를 사용한다.
