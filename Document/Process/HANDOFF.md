# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-12 (43차 — T7e.8 base seed 완료 + DART Signal 4·5 follow-up **spec(head `54148af`, base `76789dc`) + plan(head `8ddcaf6`, base `18aca60`) 박제 완료, 구현 대기** · 다음 1순위 = §2.A 두 가지 실행 방식 중 선택)

**목적**: 새 세션에서 사용자가 “`Document/Process/HANDOFF.md` 보고 이어서 진행”이라고 하면, 이 파일만으로 남은 일을 바로 판단·착수하게 한다.
**운영 원칙**: 미래 지향. 완료 이력 상세는 `Document/Build/Slices/S7-RealData.md`, `Document/Build/ProgressDashboard.md`, git diff/log에 위임한다.

---

## 0. 세션 시작 루틴

```bash
git status --short --branch
cd tudal
npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

- 사용자 별도 지시가 없으면 **§2.A T7e.8 follow-up DART Signal 4·5 구현**으로 진입한다. 두 가지 실행 방식 중 사용자가 선택 (subagent-driven 권장).
- Supabase MCP가 필요하면 세션 초반 OAuth 재인증이 필요할 수 있다: `mcp__supabase__authenticate` → 브라우저 Authorize.

---

## 1. 현재 상태 요약

| 영역 | 현재 상태 |
|---|---|
| Mock Skeleton | ✅ S0~S6 · Must 19/19 mock 동작 |
| DQ-7 Admin Credential | 🟢 ~97% · Smoke #4/#5 + Session 4 QA 잔여 · Smoke #3(Binance)은 S8까지 유예 |
| S7e Supabase 실 I/O | 🟢 **7/8 완료** · T7e.1~T7e.6 ✅ + T7e.8 base seed ✅ · T7e.7 RLS QA 잔여 + T7e.8 follow-up(DART Signal 4·5) 구현 대기 |
| 실데이터 Must | **1+/19** · `short_list_30` 2026-05-01 production 30 rows (Tier 0 v1, Signal 4·5=0 평탄화 상태) |
| 실 AI 호출 | 0 · Anthropic key 전까지 Tier 0만 가능 |
| 자동매매/S9 | S8 미착수 · 운용 검증 0일 |
| Production | Vercel `https://tudal-tawny.vercel.app` · 25 routes |
| Supabase | project `rbrpcynhphrpljbjirfo` · 0002~0010 + 0012(name/sector) 적용 · **0013/0014는 §2.A 구현 시 동시 적용 예정** · 0011 슬롯은 BL-KRIT-8 S8 자동매매 보존 |
| 검증 기준 | 최근 fresh gate: build 25 routes · lint 0 · test:ci **384 pass / 49 files** · `tsc --noEmit` 0 |
| Git | 43차 spec/plan commit 2건 박제 (`76789dc` spec + `18aca60` plan) · 작업트리에 pre-session WIP 일부 잔존 |

### T7e.6까지의 필수 계약 (현재 적용 중)

- `portfolio_approval` 테이블명은 마이그 0004 기준 **단수**를 사용한다.
- `/admin/portfolio`는 approval SELECT/Reject/dispute/resolve 실 I/O 진입 가능.
- Accept는 아직 운영 가능이 아니라 **fail-closed**: 실 entry price source 전까지 `entry_price_unavailable`으로 E4 INSERT 전 중단한다.
- production DB에 synthetic/fake price를 절대 저장하지 않는다.
- Reject 2회 UX 응답은 `reanalysisCount=2`, DB 저장은 CHECK(≤1)에 맞춰 1 clamp. 3회 Reject는 `reanalysis_limit_reached`.
- 신규 오류 코드 매핑: `entry_price_unavailable`, `approval_write_failed`, `reanalysis_limit_reached`, `regen_counter_lookup_failed`, `regen_counter_write_failed`, `regen_counter_write_conflict`, `report_lookup_failed`.
- `regen_counter` race 보호는 **마이그 0005의 UNIQUE + CHECK + Postgres 행 잠금** 위에서 4단계 CAS로 처리. 신규 마이그/RPC 추가하지 않는다.
- M9 manual cap은 `MANUAL_REGEN_CAP=2` 순수 로직 + DB CHECK가 함께 박제한다.
- 월 40만원 hardcap 검사는 여전히 `MOCK_ADMIN_COST_LOG` 합계 기반. cost_log 실 I/O는 S7a/T7a 범위.
- access-logs source는 T7e 범위 밖이며, `getRecentAdminAccessLogs()`가 `[]` 반환하는 boundary stub이다. BL-20 7일 단일 어드민 자동 바이패스는 실 source 정의 전까지 영구 비활성.
- `/admin/track-record`의 Counterfactual은 `portfolio_snapshot`으로 산출 불가하므로 `null` + UI '운용 데이터 누적 후 산출' 대기. AI 비중 시계열 저장 정책은 D11/S9 이후.
- performance + decision-tree는 `portfolio_snapshot`(0005) 단일 SoT에서 `src/lib/performance/*` 순수 로직으로 산출. 별도 테이블 없음.

---

## 2. 다음 작업

### A. 1순위 — T7e.8 follow-up · DART Signal 4·5 실 구현 (spec + plan 박제 완료)

**목표**: 현재 `short_list_30` long bucket이 composite 55.4~55.9에 몰려 있는 평탄화(Signal 4·5 = 0) 문제를 해소. DART OpenAPI로 실 재무 데이터를 받아 Signal 4 (실적 모멘텀 YoY) + Signal 5 (재무 퀄리티 5지표)를 산출하고 2026-05 시드를 재적용한다.

**박제된 SoT**:
- **Spec head**: `docs/superpowers/specs/2026-05-12-tier0-dart-signals-design.md` — base `76789dc` (D1~D13 + 보강 8건) + amend `54148af` (D14 target_quarter 공시마감 기반 / D15 not_yet_disclosed TTL / D16 account alias). 총 **16개 결정**.
- **Plan head**: `docs/superpowers/plans/2026-05-12-tier0-dart-signals.md` — base `18aca60` (8 Phase × 16 Task) + amend `8ddcaf6` (Blocker 6 + Major 3 fix: target_quarter Q4 + fallback chain + TTL refresh + StockSignal/ShortListRow 정정 + row_to_csv_dict 분리 + universe-limit 100 smoke + 7필드/17 columns 정정 + DART_ACCOUNT_ALIASES + probe ticker 교체 + apply log commit 제거). 총 **~40 Python unittest** 박제.

**전제 (이미 갖춰진 것)**:
- `tudal/.env.local`에 5개 env 박제됨: `NEXT_PUBLIC_SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` · `KRX_ID` · `KRX_PW` · `DART_API_KEY`.
- `scripts/.venv` Python 3.14 venv + `pykrx 1.2.8` + `supabase 2.30` + `requests 2.34` 설치 완료.
- DART API key probe 통과 (삼성전자 2024 연결재무제표 정상 fetch 검증).
- 마이그 0012까지 production 적용. base seed `short_list_30` 2026-05-01 row 30 박제.

**실행 방식 — 사용자가 선택 (둘 중 하나)**:

#### 옵션 1. Subagent-Driven (권장)

- 호출 스킬: `superpowers:subagent-driven-development`
- 동작: plan의 각 Task마다 **fresh subagent**를 dispatch. Task 사이마다 사용자가 결과를 리뷰 후 다음 Task 승인.
- 장점: 본 세션 컨텍스트 절약, Task별 격리, 빠른 iteration, fail 시 단일 Task만 재시도.
- 적합: 16 Task 전체를 자동 실행하면서 사용자가 중간 결과만 검수하고 싶을 때.
- 예상 시간: Task 단위 2~10분 × 16 = 1~3시간 (DART 호출 ~20분 포함). Phase G dry-run/apply는 사용자 승인 게이트 있음.

#### 옵션 2. Inline Execution

- 호출 스킬: `superpowers:executing-plans`
- 동작: 본 세션 안에서 task를 batch로 진행. Phase 단위 checkpoint마다 사용자 리뷰 가능.
- 장점: 즉각 사용자 개입 가능, 한 흐름으로 이어지는 디버깅에 유리.
- 단점: 세션 컨텍스트 길어짐.
- 적합: 사용자가 매 단계 직접 보면서 진행하고 싶을 때.

**시작 명령 예시** (다음 세션에서):
> "HANDOFF.md §2.A 옵션 1로 진행" 또는 "HANDOFF.md §2.A 옵션 2로 진행"

**완료 후 산출**:
- 신규 마이그 0013 `dart_corp_codes` + 0014 `dart_financial_cache` production 적용.
- 신규 모듈 `scripts/dart_signals.py` + 1회 시드 `scripts/seed_dart_corp_codes.py`.
- `scripts/screen_shortlist_tier0.py` Signal 4·5 hook 위임 + quality 5-metric universe-wide z-score composite.
- 2026-05-01 시드 재적용 — long bucket composite spread > 0.5 (현재 0.16에서 크게 확장).
- Python unittest ~33 추가.

**완료 시 다음 1순위**: §2.B T7e.7 RLS 수동 QA.

---

### B. 후속 — T7e.7 RLS 브라우저 수동 QA

**목표**: T7e.8 follow-up 완료 후 (또는 §2.A 옵션 1·2 진행 중 병행도 가능) kevin / son00326 / shjang1001 3개 어드민 계정으로 `/admin` 라우트별 RLS 통과·거부 동작을 브라우저에서 수동 QA한다.

**전제**:
- T7e.8 base `short_list_30` 시드 완료 (현재 상태).
- `stock_reports`/`committee_votes`는 아직 후속 seed 대상이라 리포트 상세는 boundary/empty 동작 감안.
- `admin_emails`에 3 row 박제됨 (32차 INSERT 완료).

**수동 QA 항목**:
- 비-어드민 이메일 계정 → `/admin/*` 접근 → 미들웨어 redirect 확인.
- 어드민 A 계정 → 어드민 B의 `regen_counter`/`portfolio_approval`/`brokerage_connection` 행을 직접 SQL/UPDATE 시도 → RLS 거부.
- `/api/cron/*` → `Authorization: Bearer ${CRON_SECRET}` 없으면 403, 있으면 200.
- security-definer RPC (`mark_alert_read`, `raise_portfolio_dispute`, `resolve_portfolio_dispute` 등) → 함수 본문 `is_admin()` 가드 동작 확인 (anon 호출은 즉시 거부).
- §2.A 완료 후라면 `dart_corp_codes` / `dart_financial_cache` 두 테이블도 anon SELECT 거부 + admin SELECT 통과 확인.

**기록**: QA 결과(PASS / FAIL + 재현 단계)는 `Document/Build/Slices/S7-RealData.md`에 박제. FAIL 발견 시 0011/0012/0013/0014 슬롯은 사용 중이므로 **0015 이후**로 패치.

---

## 3. 사용자 액션 대기 큐

| 우선 | 작업 | 필요한 사용자 액션 | 블록하는 범위 |
|---|---|---|---|
| B-1 | 친구 2명 임시 비번 설정 | 32차 admin API 패턴 재사용 | DQ-7 Smoke #4 |
| B-2 | 친구 KIS row 슬롯 정리 | son00326 슬롯의 친구 키를 shjang1001 슬롯으로 이전 후 son00326 row 삭제 | Smoke #4 데이터 의미 정합성 |
| B-3 | Smoke #4 RLS 격리 | kevin 계정으로 brokerage row 0건 확인 | DQ-7 Session 3 close |
| B-4 | Smoke #5 대표 가드 | 친구 계정에서 Binance mainnet 라디오 403 확인 | DQ-7 Session 3 close |
| B-5 | DQ-7 Session 4 QA | T18 manual QA 30항 + T19 security probes + review/security-review | DQ-7 최종 close |
| B-6 | Anthropic API Key | `console.anthropic.com` 발급 → Vercel env `ANTHROPIC_API_KEY` | S7a Tier 1/2 AI plug-in (Core 11 페르소나 + 합의 배지) |
| B-7 | Resend 도메인 인증 | Resend domain + env | S7b briefing |
| B-8 | Naver key rotate/env | 31차 노출 키 rotate 후 Vercel env | S7b news |
| B-9 | Telegram bot | token + admin 3명 chat_id | S7c alerts |
| B-10 | KIS 본인 1개 | 한투 OpenAPI key/account | S7c WS read-only |
| B-11 | Binance key | S8 진입 시 발급 | S8 + Smoke #3 |
| B-12 | 보안 rotate | Supabase anon/service_role/DB password/PAT, 노출 KIS/Naver secret rotate | S7a 전 권장 |
| B-13 | Vercel CLI update | v53 최신화 | 향후 deploy 권장 |
| B-14 | Magic Link 디버깅 | 시크릿 창/Email Template/PKCE callback 확인 | S9 전 권장 |
| B-15 | Git push/commit | ahead 21+ 커밋 push, pre-session WIP(`Document/*.md`·`scripts/screen_shortlist_tier0.py`·`scripts/test_screen_shortlist_tier0.py` ` M`)는 별도 commit 정리 필요 | 협업 안정화 |

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
- DART OpenAPI 호출은 일 20,000 한도. 첫 시드 ~12,000 호출 예상 (universe ~2,300 × 5). 캐싱(0014) 후 매월 시드는 cache hit 위주.

---

## 5. 문서 SoT

| 필요 정보 | 문서 |
|---|---|
| **§2.A T7e.8 follow-up 설계** | `docs/superpowers/specs/2026-05-12-tier0-dart-signals-design.md` (base `76789dc` + amend `54148af`) |
| **§2.A T7e.8 follow-up 실행 계획** | `docs/superpowers/plans/2026-05-12-tier0-dart-signals.md` (base `18aca60` + amend `8ddcaf6`) |
| S7e 상세 태스크/의사결정 | `Document/Build/Slices/S7-RealData.md` |
| 전체 진행률/변경 이력 | `Document/Build/ProgressDashboard.md` |
| 코드 스냅샷/잔존 mock 목록 | `Document/Process/CodebaseStatus.md` |
| DQ-7 credential 잔여 | `Document/Build/Slices/DQ7-Credentials.md` |
| 어드민 기획/AI 강화 D19 | `Document/Service/Planning/ServicePlan-Admin.md` |
| 리포트/AI 평가 프레임 | `Document/Service/Report/ReportFramework.md` |
| S8 자동매매 | `Document/Build/Slices/S8-AutoTrading.md` |
| 실행 규칙 | `Document/Process/ExecutionPlaybook.md` |

---

## 6. 완료 이력

상세 완료 이력은 **이 파일에 누적하지 않는다.** 다음 SoT를 사용한다:
- `Document/Build/ProgressDashboard.md` (슬라이스 상태판)
- `Document/Build/Slices/S7-RealData.md` (S7e 의사결정 로그)
- `git log --oneline` (commit 단위 변경 이력)

직전 한 항목만 빠른 컨텍스트용으로 유지:

- **43차 T7e.8 follow-up 박제**: DART Signal 4·5 spec(`76789dc` + amend `54148af`) + plan(`18aca60` + amend `8ddcaf6`) 박제. 사용자 보강 8건 + Blocker 6/Major 3 추가 fix 모두 반영. 구현 자체는 다음 세션에서 §2.A 옵션 선택으로 진행. base seed(2026-05-01 production 30 rows)는 이미 적용 완료 상태 (Tier 0 v1, Signal 4·5 평탄화).
