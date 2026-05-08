# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-08 (38차 후속 — HANDOFF 슬림화 · T7e.4 fix 반영)

**목적**: 새 세션에서 사용자가 “`Document/Process/HANDOFF.md` 보고 이어서 진행”이라고 하면, 이 파일만으로 남은 일을 바로 판단·착수하게 한다.
**운영 원칙**: 미래 지향. 완료 이력 상세는 `Document/Build/Slices/S7-RealData.md`, `Document/Build/ProgressDashboard.md`, `Document/Process/CodebaseStatus.md`, git diff/log에 위임한다.

---

## 0. 세션 시작 루틴

```bash
git status --short --branch
cd tudal
npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

- 사용자에게 별도 지시가 없으면 **§2.A T7e.5**를 먼저 제안/진행한다.
- Supabase MCP가 필요하면 세션 초반 OAuth 재인증이 필요할 수 있다: `mcp__supabase__authenticate` → 브라우저 Authorize.
- 현재 작업트리에는 **37차 T7e.3 + 38차 T7e.4 + 후속 fix** 미커밋 변경이 섞여 있다. 사용자 변경을 되돌리지 말고, 커밋 전 diff를 반드시 분리 검토한다.

---

## 1. 현재 상태 요약

| 영역 | 현재 상태 |
|---|---|
| Mock Skeleton | ✅ S0~S6 · Must 19/19 mock 동작 |
| DQ-7 Admin Credential | 🟢 ~97% · Smoke #4/#5 + Session 4 QA 잔여 · Smoke #3(Binance)은 S8까지 유예 |
| S7e Supabase 실 I/O | 🟢 **4/8 완료** — T7e.1~T7e.4 ✅, T7e.5~8 잔여 |
| 실데이터 Must | 0/19 · shortlist/reports/committee/approval SELECT·INSERT 통로는 열렸지만 DB seed 전 |
| 실 AI 호출 | 0 · Anthropic key 전까지 Tier 0만 가능 |
| 자동매매/S9 | S8 미착수 · 운용 검증 0일 |
| Production | Vercel `https://tudal-tawny.vercel.app` · 25 routes |
| Supabase | project `rbrpcynhphrpljbjirfo` · 0002~0010 적용 · 다음 마이그 번호는 기본 **0011** |
| 검증 기준 | 최근 fresh gate: build 25 routes · lint 0 · test:ci **345 pass / 45 files** · `tsc --noEmit` 0 |
| Git | HEAD `1dd7843` · origin/main ahead 5 + 37/38차 변경 미커밋 |

### T7e.4까지의 필수 계약

- `portfolio_approval` 테이블명은 마이그 0004 기준 **단수**를 사용한다.
- `/admin/portfolio`는 approval SELECT/Reject/dispute/resolve 실 I/O 진입 가능.
- Accept는 아직 운영 가능이 아니라 **fail-closed**: 실 entry price source 전까지 `entry_price_unavailable`으로 E4 INSERT 전 중단한다.
- production DB에 synthetic/fake price를 절대 저장하지 않는다.
- Reject 2회 UX 응답은 `reanalysisCount=2`, DB 저장은 CHECK(≤1)에 맞춰 1 clamp. 3회 Reject는 `reanalysis_limit_reached`.
- 신규 오류 코드 3종은 한국어 UI 배너로 매핑됨: `entry_price_unavailable`, `approval_write_failed`, `reanalysis_limit_reached`.
- E4+E5 트랜잭션 RPC화는 실 entry price wiring 시점의 후속 과제다.

---

## 2. 다음 작업

### A. 다음 1순위 — T7e.5 `regen_counter` 실 I/O + M9 cap

**목표**: `mock-admin-regen-counters.ts` 의존을 제거하고, `/admin/report/[ticker]/regenerate`의 수동 재생성 카운터를 Supabase `regen_counter` SELECT/INSERT/UPDATE로 전환한다.

**수정 후보 파일**
- 신규 예상: `tudal/src/lib/data/admin-regen-counters.ts`
- 수정: `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/page.tsx`
- 수정: `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/actions.ts`
- 테스트: `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/__tests__/actions.test.ts`
- 테스트 신규 예상: `tudal/src/lib/data/__tests__/admin-regen-counters.test.ts`

**현재 mock 잔존 위치**
- `regenerate/page.tsx`: `MOCK_ADMIN_REGEN_COUNTERS`로 현재 카운터 표시.
- `regenerate/actions.ts`: `MOCK_ADMIN_REGEN_COUNTERS` mutation + production-like 환경에서 `real_persistence_not_configured` 반환.
- `MOCK_ADMIN_COST_LOG` hardcap은 T7e.5에서 당장 real `cost_log` 전환 범위로 확장하지 말 것. `cost_log` 실 INSERT/SELECT는 S7a/T7a 범위.

**구현 기준**
- Server Component/Action은 `@/lib/supabase/server` 사용.
- Server Action 반환은 기존 패턴 유지: `{ success: true, data }` 또는 `{ success: false, error }`.
- M9 cap: manual ≤ 2, auto ≤ 1. 기존 `MANUAL_REGEN_CAP`/`AUTO_REGEN_CAP` 순수 로직 재사용.
- 존재 검사(`reportExistsForMonth`)는 T7e.3에서 이미 실 SELECT로 전환됨. 유지.
- Supabase error는 swallow하지 말고 명시 에러로 변환한다. 권장 코드: `regen_counter_lookup_failed`, `regen_counter_write_failed`.
- 동시 클릭 race를 고려해 UPDATE/UPSERT 결과가 cap을 넘지 않게 해야 한다. 단순 read→write가 위험하면 PL/pgSQL RPC를 검토한다.
- production-like 환경에서도 mock 성공을 보고하지 않아야 한다. T7e.5 완료 시 `real_persistence_not_configured` 분기는 제거되어야 한다.

**검증 명령**

```bash
cd tudal
npm run test:ci -- src/app/'(admin)'/admin/report/'[ticker]'/regenerate/__tests__/actions.test.ts src/lib/data/__tests__/admin-regen-counters.test.ts
npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

### B. 대안 작업 — T7e.8 Tier 0 Python seed

T7e.5 대신 사용자 핵심 목표(진짜 코스피·코스닥 30종목 표시)를 앞당기려면 T7e.8로 진입한다.

- 산출: `scripts/screen_shortlist_tier0.py`
- 실행 방식: 로컬 Python · idempotent upsert · `--dry-run`/`--apply` · CSV 백업 · `--month YYYY-MM-01` · env 기반 Supabase 접속.
- 입력/계산: pykrx/KRX/DART/Naver → 5-Signal Composite × 시간대별 가중치 → 단/중/장 후보 50씩 → 최종 10/10/10 = 30.
- AI key 전까지 UI는 🔢 숫자 점수 + ⚪ AI 분석 대기 placeholder.
- 시작 전 사용자 결정 필요: `short_list_30`의 name/sector 갭 처리 방식
  1. ALTER TABLE 컬럼 추가
  2. 별도 `tickers_meta` 테이블 + JOIN
  3. 정적 TS lookup + Python이 함께 갱신

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
| B-15 | Git push/commit | 32~36차 ahead 5 + 37/38차 변경 commit/push | 협업 안정화 |

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

- **38차 후속 fix**: `portfolio-panel.tsx` 신규 에러 코드 3종 한국어 매핑 추가, `resolveRealEntryPrice()` TODO 마커 추가, test:ci 345/45.
- **38차 T7e.4**: approvals/snapshots data layer 신설, portfolio approvals 실 SELECT/INSERT/RPC, Accept fake price 금지 + fail-closed, Reject 3회 차단.
- **37차 T7e.3**: reports/committee data layer 신설, report page 실 SELECT, regenerate report 존재 검사 실 SELECT.
- **36차 T7e.1~2**: 0010 적용 검증, shortlist data layer 신설, page-level importer 전환.

상세 완료 이력은 이 파일에 더 늘리지 말고 `ProgressDashboard.md` 변경 이력 또는 git history를 사용한다.
