# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-12 (45차 — T7e.8 follow-up **production 적용 ✅** + D20 Section 8 위원 전원 표 박제 ✅ · 다음 1순위 = §2.A T7e.7 RLS 수동 QA → 후속 §2.B S7a Anthropic wrapper)

**목적**: 새 세션에서 사용자가 “`Document/Process/HANDOFF.md` 보고 이어서 진행”이라고 하면, 이 파일만으로 남은 일을 바로 판단·착수하게 한다.
**운영 원칙**: 미래 지향. 완료 이력 상세는 `Document/Build/Slices/S7-RealData.md`, `Document/Build/ProgressDashboard.md`, `Document/Process/CodebaseStatus.md`, git diff/log에 위임한다.

---

## 0. 세션 시작 루틴

```bash
git status --short --branch
cd tudal
npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

- 사용자 별도 지시가 없으면 **§2.A T7e.7 RLS 브라우저 수동 QA**로 진입. T7e.7 PASS 후 **§2.B S7a Anthropic wrapper**로 진입한다.
- T7e.8 (DART Signal 4·5 production 적용)은 45차에 완료됨 — `short_list_30` 30 rows가 실 standalone/quality 기반 점수로 production 박제. §2.C "완료" 섹션은 참조용.
- D20 (Section 8 위원 전원 표) 박제 완료 — Tier 1·2 구현은 S7a에서 진행. SoT: `ServicePlan-Admin §3.7 R3.7-6/7/8` + `§6 D20` + `ReportFramework §8 Step 2 v2.3`.
- Supabase MCP가 필요하면 세션 초반 OAuth 재인증이 필요할 수 있다: `mcp__supabase__authenticate` → 브라우저 Authorize.

---

## 1. 현재 상태 요약

| 영역 | 현재 상태 |
|---|---|
| Mock Skeleton | ✅ S0~S6 · Must 19/19 mock 동작 |
| DQ-7 Admin Credential | 🟢 ~97% · Smoke #4/#5 + Session 4 QA 잔여 · Smoke #3(Binance)은 S8까지 유예 |
| S7e Supabase 실 I/O | 🟢 **7/8 완료** · T7e.1~T7e.6 ✅ + T7e.8 DART Signal 4·5 production apply ✅ · T7e.7 RLS QA 잔여 |
| 실데이터 Must | **1+/19** · `short_list_30` 2026-05-01 production 30 rows (DART 실 standalone/quality 기반 Signal 4·5 반영) |
| 실 AI 호출 | 0 · Anthropic key 전까지 Tier 0만 가능 |
| 자동매매/S9 | S8 미착수 · 운용 검증 0일 |
| Production | Vercel `https://tudal-tawny.vercel.app` · 25 routes |
| Supabase | project `rbrpcynhphrpljbjirfo` · 0002~0010 + 0012(name/sector) + **0013/0014(DART cache)** 적용 · 0011 슬롯은 BL-KRIT-8 S8 자동매매 보존 |
| 검증 기준 | 최근 fresh gate: build 25 routes · lint 0 · test:ci **384 pass / 49 files** · `tsc --noEmit` 0 |
| Git | 45차 박제 완료: `72019fa docs(T7e.8): record DART production apply` + `dd05ca1 docs(D20): Section 8 위원 전원 표 박제` · 작업트리 정리는 최신 `git status` 확인 · push 대기 |

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

### A. 1순위 — T7e.7 RLS 브라우저 수동 QA

**목표**: T7e.6까지 boundary stub/실 I/O 통로가 9종 open 됐고 T7e.8 production 시드까지 끝났으므로, 마지막 sub-task인 RLS 정책을 브라우저에서 수동 QA한다.

**전제 (모두 확보됨)**:
- `short_list_30` 2026-05-01 30 rows production 박제 (DART 실 standalone/quality 기반 Signal 4·5 반영).
- `admin_emails` 3 row 박제 (kevin / son00326 / shjang1001 — 32차 INSERT).
- 0013/0014 마이그 적용 완료 (`dart_corp_codes` + `dart_financial_cache` RLS 박제).
- `stock_reports`/`committee_votes`는 시드 없음 — 리포트 상세는 `notFound()` 일관 동작 가정.

**수동 QA 항목 (5종)**:
1. **비-어드민 redirect** — `admin_emails`에 없는 이메일 계정 → `/admin/*` 접근 → 미들웨어 redirect 확인.
2. **Cross-admin RLS 거부** — 어드민 A 계정 → 어드민 B의 `regen_counter` / `portfolio_approval` / `brokerage_connection` 행을 직접 SQL/UPDATE 시도 → RLS 거부.
3. **Cron 가드** — `/api/cron/{monthly-batch,morning-briefing,news-sweep,silent-health}` → `Authorization: Bearer ${CRON_SECRET}` 없으면 403, 있으면 200.
4. **Security-definer RPC 가드** — `mark_alert_read` · `raise_portfolio_dispute` · `resolve_portfolio_dispute` · `record_alert_exit_decision` → 함수 본문 `is_admin()` 가드 동작 (anon 호출은 즉시 거부).
5. **신규 DART 테이블 RLS** — `dart_corp_codes` / `dart_financial_cache` 두 테이블도 anon SELECT 거부 + admin SELECT 통과 확인.

**기록**: QA 결과 (PASS / FAIL + 재현 단계)는 `Document/Build/Slices/S7-RealData.md`에 박제. FAIL 발견 시 **0015 이후 마이그 슬롯**으로 패치 (0011은 BL-KRIT-8 S8 자동매매 보존 · 0012~0014 사용 중).

**완료 시 다음 1순위**: §2.B S7a Anthropic wrapper (AI 키 발급되어 있으면 즉시, 아니면 사용자 액션 큐 B-6 대기).

---

### B. 후속 1순위 — S7a Anthropic wrapper + Tier 1·2 plug-in

**목표**: AI 키(B-6) 발급 후, Tier 0 단독 가동 중인 `short_list_30`에 Tier 1 Core 11 페르소나 평가 + Tier 2 Sector Board 활성화 + 합의 배지 + Section 8 위원 전원 표를 plug-in한다. SoT는 D19 + D20 박제.

**진입 조건**:
- AI 키 발급 (사용자 액션 큐 B-6: `console.anthropic.com` → Vercel env `ANTHROPIC_API_KEY`).
- T7e.7 RLS QA PASS (§2.A 완료).

**박제된 SoT**:
- `ServicePlan-Admin.md §1A.5 D19` — Tier 0/1/2 + 합의 배지 4종 + Reflection 구조.
- `ServicePlan-Admin.md §3.7 R3.7-6/7/8` + `§6 D20` — Section 8 정적 표 4종 (Sector 14명 전원 + **Core 11 전원** + 쟁점 인용 3~5 + 최종 합의 패널).
- `ReportFramework.md §8 Step 0~4 (v2.3)` — writer 에이전트 작성 가이드.
- `Document/Outputs/Report-Alteogen_196170_v3-Readable.md §Section 8 Part A/B/C` — Section 8 reference 양식.

**예상 신규 모듈/마이그**:
- `src/lib/ai/anthropic-client.ts` (wrapper + cost_log INSERT)
- `src/lib/screening/persona-eval.ts` (Tier 1 Core 11)
- `src/lib/screening/sector-board.ts` (Tier 2 Sector 14)
- `src/lib/screening/consensus.ts` (합의 배지 4종)
- 마이그 **0015 이후** — `short_list_30`에 `ai_score`·`ai_comment`·`consensus_badge` 3컬럼 추가 (잠정, 진입 시점 재확정).
- `stock_reports` + `committee_votes` 실 INSERT (writer 산출물 적재).

**완료 시 다음 1순위**: §2.C S7b 뉴스 + 모닝 브리핑 실 연결.

---

### C. T7e.8 follow-up (DART Signal 4·5 production 적용) — 완료 참조용

T7e.8은 44~45차에 production까지 완료됐다. `short_list_30` 2026-05-01 30 rows가 DART 실 standalone/quality 기반 Signal 4·5로 UPSERT됐다 (short=모멘텀 10 · mid=실적 모멘텀 8 + 모멘텀 2 · long=퀄리티 10). 상세 결과·검증·박제된 의사결정은 다음 SoT를 참조:

- `Document/Build/Slices/S7-RealData.md` (T7e.8 + 의사결정 로그 + 변경 이력 45차)
- `Document/Process/CodebaseStatus.md` (45차 entry — DB·seed·signal wiring·산출물)
- `Document/Build/ProgressDashboard.md` (변경 이력 45차)
- `git log --oneline -- scripts/ tudal/supabase/migrations/0013* 0014*` (commit 단위)
- `docs/superpowers/specs/2026-05-12-tier0-dart-signals-design.md` + `docs/superpowers/plans/2026-05-12-tier0-dart-signals.md` (박제된 spec/plan)

---

### D. 후속 슬라이스 시퀀스 (S7a 후)

```
S7a (Anthropic wrapper + Tier 1·2 plug-in) → 진행 중일 때 D11 가상 포트 1차 가동 (KIS 0개)
  ↓
S7b (뉴스 + 모닝 브리핑 실 연결, Naver·Resend)
  ↓
운용 검증 며칠~1주 (어드민 3인)
  ↓
S7c (장중 + KIS WS read-only, 본인 1개 KIS 필요 — B-10)
  ↓
S7d (Silent Health 실 INSERT + override UI)
  ↓
S8 자동매매 (KIS 자동매매 권한 + Binance 키 — B-11, Smoke #3은 여기서 진행)
  ↓
S9 어드민 운용 검증 (4~8주, 모의·testnet 위주 → 실계좌·메인넷 점진)
```

상세 = `Document/Build/ProgressDashboard.md §2 v3.1` + `CLAUDE.md` 상단 시퀀스.

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
| B-15 | Git push to origin | ahead 30+ 커밋 push only (45차 박제 `72019fa`·`dd05ca1` 포함). pre-session WIP는 정리 완료 — 별도 commit 작업 불필요 | 협업 안정화 |

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

> **운영 순서**: 새 세션 진입자는 위에서 아래로 읽는다. (1) 본 HANDOFF.md → (2) 슬라이스 SoT(S7-RealData/DQ7) → (3) ProgressDashboard + CodebaseStatus → (4) 기획 SoT(ServicePlan-Admin/ReportFramework) → (5) 완료된 박제(T7e.8 spec/plan 등 참조용) → (6) 실행 규칙.

| 필요 정보 | 문서 |
|---|---|
| **§2.A T7e.7 RLS QA 결과 기록 위치** | `Document/Build/Slices/S7-RealData.md` |
| **§2.B S7a AI 키 후 Tier 1·2 박제** | `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D19` (Tier 0/1/2 + 합의 배지 + Reflection) |
| **§2.B S7a Section 8 위원 전원 표 박제 (D20, 45차)** | `Document/Service/Planning/ServicePlan-Admin.md §3.7 R3.7-6/7/8` + `§6 D20` |
| **§2.B S7a Section 8 writer 작성 가이드 (D20, v2.3)** | `Document/Service/Report/ReportFramework.md §8 Step 2` |
| **§2.B S7a Section 8 reference 양식** | `Document/Outputs/Report-Alteogen_196170_v3-Readable.md §Section 8 Part A/B/C` |
| **§2.B S7a 외 리포트 프레임 (Section 0~7 + Appendix · Core 11 + Sector 14×10 페르소나)** | `Document/Service/Report/ReportFramework.md` 전체 |
| S7e 상세 태스크/의사결정 | `Document/Build/Slices/S7-RealData.md` |
| 전체 진행률/변경 이력 | `Document/Build/ProgressDashboard.md` |
| 코드 스냅샷/실 I/O 통로 9종/잔존 mock 목록 | `Document/Process/CodebaseStatus.md` |
| DQ-7 credential 잔여 (Smoke #4·#5 + Session 4 QA · Smoke #3 ⏸ S8) | `Document/Build/Slices/DQ7-Credentials.md` |
| 어드민 서비스 기획 본체 (D16/D17/D18/D19/D20 포함) | `Document/Service/Planning/ServicePlan-Admin.md` |
| S8 자동매매 (S7d 후 단독 진입 · Strategy drop-in + AI 어댑터) | `Document/Build/Slices/S8-AutoTrading.md` |
| 슬라이스 기반 실행 규칙 (에이전트/스킬/하네스 매핑) | `Document/Process/ExecutionPlaybook.md` |
| T7e.8 spec (완료된 박제 · 참조용) | `docs/superpowers/specs/2026-05-12-tier0-dart-signals-design.md` (base `76789dc` + amend `54148af`) |
| T7e.8 plan (완료된 박제 · 참조용) | `docs/superpowers/plans/2026-05-12-tier0-dart-signals.md` (base `18aca60` + amend `8ddcaf6`) |

---

## 6. 완료 이력

상세 완료 이력은 **이 파일에 누적하지 않는다.** 다음 SoT를 사용한다:
- `Document/Build/ProgressDashboard.md` (슬라이스 상태판)
- `Document/Build/Slices/S7-RealData.md` (S7e 의사결정 로그)
- `git log --oneline` (commit 단위 변경 이력)

직전 한 항목만 빠른 컨텍스트용으로 유지:

- **45차 T7e.8 production 적용 + D20 Section 8 위원 전원 표 박제 (2026-05-12)**:
  - **T7e.8 production**: Supabase 0013(`dart_corp_codes`) + 0014(`dart_financial_cache`) 마이그 적용 → `seed_dart_corp_codes.py` apply (2,766 rows · KOSPI 838/KOSDAQ 1,818/KONEX 110) → full dry-run preview (Universe 2,345 · DART cache 10,154 rows · CFS ok 94% · CFS→OFS fallback 1,728 · standalone Q 환산 384) → 사용자 승인 후 `--apply` 완료. `short_list_30` 30 rows UPSERT — short=모멘텀 10 · mid=실적 모멘텀 8 + 모멘텀 2 · long=퀄리티 10. dry-run preview↔DB 일치, exit 0, client refresh 7회 정상, RemoteProtocolError 0건.
  - **Root cause 수정 3건**: (1) `seed_dart_corp_codes.py` docstring grep이 `KRX_ID`/`KRX_PW` 누락 → fail-fast 추가. (2) `from scripts.dart_signals` import가 직접 실행 시 `ModuleNotFoundError` → try/except fallback. (3) postgrest HTTP/2 stream limit (last_stream_id:19999) → 300 ticker마다 Supabase client 재생성.
  - **D20 박제**: 사용자 요구 반영 — Section 8에 ① Sector 14명 전원 표 ② **Core 11 전원 표(신규)** ③ 쟁점별 인용 3~5건 ④ 최종 합의 패널(Co-Chair 만장일치 여부) 정적 4종. Reference: `Document/Outputs/Report-Alteogen_196170_v3-Readable.md` §Section 8 Part A/B/C. 인터랙티브 페르소나 탐색은 Should S2 유지.
  - **편집 영역**: `ServicePlan-Admin.md §3.7 R3.7-6/7/8` + `§6 D20` + M3 AC/DoD · `ReportFramework.md §8 Step 2` + 변경 이력 v2.3.
  - **검증 게이트**: build 25 routes / lint 0 / test:ci 384 pass / 49 files / `tsc --noEmit` clean / Python unittest 27 pass.
  - **Git**: `72019fa docs(T7e.8): record DART production apply` + `dd05ca1 docs(D20): Section 8 위원 전원 표 박제 — Sector 14 + Core 11 한 줄 의견`.
