# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-13 (48차 — **§7 P3.2 + P3.4 완료 ✅** · 마이그 0016 `accept_shortlist_with_snapshots` RPC 파일 박제(apply 보류) + acceptShortList orphan-safety RPC 일원화 + G-cron-auth 12 + G-wrapper-error 8 + G-FE-map 9 + RPC 4 = **+34 tests / 429→463 / 50 files** · cmux pair-debate omxy 3 rounds 모두 CONVERGED · **다음 1순위 = S7a Anthropic wrapper (B-6 AI 키 발급 트리거)** 또는 **§7 P3.1 (D20 컴포넌트, S7a 시드 후) + P3.3 (error taxonomy 옵션 A/B 사용자 결정 필요)**)

**목적**: 새 세션에서 사용자가 “`Document/Process/HANDOFF.md` 보고 이어서 진행”이라고 하면, 이 파일만으로 남은 일을 바로 판단·착수하게 한다.
**운영 원칙**: 미래 지향. 완료 이력 상세는 `Document/Build/Slices/S7-RealData.md`, `Document/Build/ProgressDashboard.md`, `Document/Process/CodebaseStatus.md`, git diff/log에 위임한다.

---

## 0. 세션 시작 루틴

```bash
git status --short --branch
cd tudal
npm run build && npm run lint && npm run test:ci && npx tsc --noEmit
```

- 사용자 별도 지시가 없으면 **§2.A S7a Anthropic wrapper**부터 진입한다. **선행 = B-6 AI 키 발급 (Vercel env `ANTHROPIC_API_KEY`).** 미발급이면 §7 잔여 P3 항목으로 우회.
  - **§7 P0·P1 = 46차 완료 ✅** (commit `9661037` P0 / `4c6eea7` P1). P0.2 HIBP 토글만 사용자 dashboard 작업 잔여.
  - **§7 P2.2~P2.4 = 47차 완료 ✅** (cmux pair-debate omxy 4 rounds CONVERGED · 7 파일 / +46/-24 / md+주석 only).
  - 남은 §7 작업 = P3 (T7a.11 D20 컴포넌트 + accept_shortlist RPC + wrapper error taxonomy + 신규 테스트, 1~2주 분량).
  - P4 mock 정리는 자연 진행 (S7b/S7c/S7d/T7a 후속).
  - **선행 확인**: Vercel env `ANTHROPIC_API_KEY` 존재 여부 → `vercel env ls`. 없으면 사용자가 `console.anthropic.com`에서 발급 → `vercel env add ANTHROPIC_API_KEY` 후 진입.
  - S7a가 D11 가상 포트 운용 검증의 핵심 가치 (30개 카드에 페르소나 평가 + 합의 배지 + Section 8 위원 전원 표 표시). T7e.7 RLS QA는 후속이며 보안 검증 성격이라 운용 시작 전에만 마무리하면 된다.
- **§2.B T7e.7 RLS 브라우저 수동 QA**는 S7a 진행 중 병행 또는 D11 운용 검증 직전에 마무리. 1시간 안짝 수동 작업이라 막판 일정에 영향 없음.
- T7e.8 (DART Signal 4·5 production 적용)은 45차에 완료됨 — `short_list_30` 30 rows가 실 standalone/quality 기반 점수로 production 박제. §2.C "완료" 섹션은 참조용.
- D20 (Section 8 위원 전원 표) 박제 완료 — Tier 1·2 구현이 §2.A S7a의 핵심 산출물. SoT: `ServicePlan-Admin §3.7 R3.7-6/7/8` + `§6 D20` + `ReportFramework §8 Step 2 v2.3`.
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
| 검증 기준 | 최근 fresh gate (48차 종료): build 25 routes · lint 0 · test:ci **463 pass / 50 files** (+34 vs 429) · `tsc --noEmit` 0 |
| Git | 46차 commits `9661037` + `4c6eea7` origin/main 동기 ✅. **47차 `03d9bc7` + 48차 신규 commit = push 대기** (사용자 명시 트리거 필요). 마이그 apply order: 0010 → 0012~0014 → 0015a 적용됨 → **0016 apply 대기** (DB user-triggered) → 0011 슬롯은 S8 reserve. |

### T7e.6까지의 필수 계약 (요약)

- `portfolio_approval` 단수 (0004) · Accept는 `entry_price_unavailable` fail-closed (실 가격 source 전까지) · production에 fake price 금지 · Reject 3회 = `reanalysis_limit_reached`.
- `regen_counter` race 보호 = **0005 UNIQUE+CHECK + 4단계 CAS** (신규 마이그/RPC 없음).
- 월 40만원 hardcap = `MOCK_ADMIN_COST_LOG` 합계 (cost_log 실 I/O는 S7a/T7a).
- `getRecentAdminAccessLogs() = []` boundary stub (BL-20 7일 자동 바이패스 영구 비활성, 실 source 정의 전까지).
- Counterfactual은 `portfolio_snapshot`으로 산출 불가 → `null` + UI 대기. AI 비중 시계열은 D11/S9 이후.
- performance + decision-tree = `portfolio_snapshot`(0005) 단일 SoT + `src/lib/performance/*` 순수 로직.
- 상세 계약·에러 코드 = `S7-RealData.md` 의사결정 로그.

---

## 2. 다음 작업

### A. 1순위 — S7a Anthropic wrapper + Tier 1·2 plug-in

**목표**: AI 키 발급 후, Tier 0 단독 가동 중인 `short_list_30`에 **Tier 1 Core 11 페르소나 평가** + **Tier 2 Sector Board 활성화** + **합의 배지 4종** + **Section 8 위원 전원 표**를 plug-in한다. 이것이 D11 가상 포트 운용 검증의 핵심 가치이며, SoT는 D19 + D20 박제다.

**진입 조건 (선행 사용자 액션)**:
- AI 키 발급 (사용자 액션 큐 B-6): `console.anthropic.com` → API key 생성 → `vercel env add ANTHROPIC_API_KEY` (Preview + Production 양쪽). 발급 미확인 시 진입 차단.
- `vercel env ls`로 env 등록 확인 → 재배포(`vercel deploy --prod`) → `process.env.ANTHROPIC_API_KEY` 서버 사이드 접근 검증.

**박제된 SoT (직접 읽고 따라가는 순서)**:
1. `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D19` — Tier 0/1/2 + 합의 배지 4종 + Reflection 구조 본문.
2. `Document/Service/Planning/ServicePlan-Admin.md §3.7 R3.7-6/7/8` + `§6 D20` — Section 8 정적 표 4종 박제 (Sector 14명 전원 + **Core 11 전원** + 쟁점별 인용 3~5건 + 최종 합의 패널 with Co-Chair 만장일치 여부).
3. `Document/Service/Report/ReportFramework.md §8 Step 0~4 (v2.3)` — writer 에이전트의 작성 가이드 (Step 0=30 선정 합의 / Step 1=리서치 / Step 2=Section 0~8 작성 / Step 3=critic 검증 / Step 4=수정).
4. `Document/Outputs/Report-Alteogen_196170_v3-Readable.md §Section 8 Part A/B/C` — Section 8 reference 양식 (Sector 10명 한 줄 의견 표 + Core Committee 쟁점 토론 + Co-Chair 최종 판정).

**예상 신규 모듈/마이그**:
- `src/lib/ai/anthropic-client.ts` — Anthropic wrapper + `cost_log` 실 INSERT (M17 hardcap 가드 활성화).
- `src/lib/screening/persona-eval.ts` — Tier 1 Core 11 페르소나 평가 (시간대별 가중치: 단=Druckenmiller·Minervini↑ / 중=Lynch↑ / 장=Buffett·Munger·Fisher↑).
- `src/lib/screening/sector-board.ts` — Tier 2 Sector Board 14×10 → 30종목 해당 섹터 14명만 활성화 (비용 통제).
- `src/lib/screening/consensus.ts` — 합의 배지 4종 산출 (🟢 강한 합의 / 🔵 숫자 우세 / 🟣 AI 우세 / ⚪ AI 분석 대기).
- 마이그 **0015 이후** — `short_list_30`에 `ai_score`·`ai_comment`·`consensus_badge` 3컬럼 추가 (잠정 — 진입 시점 재확정).
- `stock_reports` + `committee_votes` 실 INSERT (writer 산출물 적재 — Section 0~8 jsonb + 위원 11+14 row).

**D11 가상 포트 운용 검증 (S7a 후 게이트)**:
- 어드민 3인이 며칠~1주 사용하며 30 카드 정확성 + 합의 배지 의미 + Section 8 위원 표 가독성 검증.
- 운용 데이터 누적 후 Counterfactual·Reflection 자가학습 박스 활성화.

**완료 시 다음 1순위**: §2.D 후속 시퀀스 — S7b (뉴스 + 모닝 브리핑) → 운용 검증 → S7c → S7d → S8.

---

### B. 후속 — T7e.7 RLS 브라우저 수동 QA (보안 검증, 1시간 안짝)

**목표**: T7e.6까지 boundary stub/실 I/O 통로가 9종 open 됐고 T7e.8 production 시드까지 끝났으므로, 마지막 sub-task인 RLS 정책을 브라우저에서 수동 QA한다. **보안 검증 성격이라 시급도 낮으나, D11 가상 포트 운용 검증 시작 전에는 반드시 마무리**.

**실행 시점**: S7a 진행 중 병행 (S7a 코드 작성 대기 사이) 또는 S7a 완료 후 D11 운용 검증 직전.

**전제 (모두 확보됨)**:
- `short_list_30` 2026-05-01 30 rows production 박제 (DART 실 standalone/quality 기반 Signal 4·5 반영).
- `admin_emails` 3 row 박제 (kevin / son00326 / shjang1001 — 32차 INSERT).
- 0013/0014 마이그 적용 완료 (`dart_corp_codes` + `dart_financial_cache` RLS 박제).
- `stock_reports`/`committee_votes`는 S7a 이후 시드 — RLS QA 시점에는 빈 상태 또는 S7a 산출물 일부 존재.

**수동 QA 항목 (5종)**:
1. **비-어드민 redirect** — `admin_emails`에 없는 이메일 계정 → `/admin/*` 접근 → 미들웨어 redirect 확인.
2. **Cross-admin RLS 거부** — 어드민 A 계정 → 어드민 B의 `regen_counter` / `portfolio_approval` / `brokerage_connection` 행을 직접 SQL/UPDATE 시도 → RLS 거부.
3. **Cron 가드** — `/api/cron/{monthly-batch,morning-briefing,news-sweep,silent-health}` → `Authorization: Bearer ${CRON_SECRET}` 없으면 401, 있으면 200.
4. **Security-definer RPC 가드** — `mark_alert_read` · `raise_portfolio_dispute` · `resolve_portfolio_dispute` · `record_alert_exit_decision` → 함수 본문 `is_admin()` 가드 동작 (anon 호출은 즉시 거부).
5. **신규 DART 테이블 RLS** — `dart_corp_codes` / `dart_financial_cache` 두 테이블도 anon SELECT 거부 + admin SELECT 통과 확인.

**기록**: QA 결과 (PASS / FAIL + 재현 단계)는 `Document/Build/Slices/S7-RealData.md`에 박제. FAIL 발견 시 **0015 이후 마이그 슬롯**으로 패치 (0011은 BL-KRIT-8 S8 자동매매 보존 · 0012~0014 사용 중).

---

### C. T7e.8 (DART Signal 4·5) — 45차 production 완료 ✅

`short_list_30` 2026-05-01 30 rows production 박제. 상세 = `S7-RealData.md` + `CodebaseStatus.md` + `docs/superpowers/specs|plans/2026-05-12-tier0-dart-signals-*.md`.

---

### D. 후속 슬라이스 시퀀스 (S7a · T7e.7 후)

```
§2.A S7a (Anthropic wrapper + Tier 1·2 + 합의 배지 + Section 8 위원 전원 표 plug-in)
   └ S7a 진행 중 병행: §2.B T7e.7 RLS QA (1시간 안짝 수동)
  ↓
S7b (뉴스 + 모닝 브리핑 실 연결, Naver·Resend)
  ↓
★ D11 AI 가상 포트 1차 가동 (KIS 0개 · 어드민 3인 며칠~1주 운용 검증)
  · 진짜 30 종목 + 🔢🤖 이중 점수 + 합의 배지 4종 + AI 코멘트 + Section 8 위원 전원 표 검증
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
| **B-6 ⭐최우선** | **Anthropic API Key** | `console.anthropic.com` 발급 → Vercel env `ANTHROPIC_API_KEY` (Preview + Production) + `vercel deploy --prod` 재배포 | **§2.A S7a 진입 트리거** — 발급 전 S7a 시작 불가 (Tier 1·2 + 합의 배지 + Section 8 위원 전원 표 plug-in 차단) |
| **B-2A** | **HIBP leaked-password protection 토글** (46차 P0.2) | Supabase dashboard `rbrpcynhphrpljbjirfo` → Authentication → Policies → "Leaked password protection" 토글 ON | advisor `auth_leaked_password_protection` WARN 1건 잔존 — 보안 베이스라인 |
| B-7 | Resend 도메인 인증 | Resend domain + env | S7b briefing |
| B-8 | Naver key rotate/env | 31차 노출 키 rotate 후 Vercel env | S7b news |
| B-9 | Telegram bot | token + admin 3명 chat_id | S7c alerts |
| B-10 | KIS 본인 1개 | 한투 OpenAPI key/account | S7c WS read-only |
| B-11 | Binance key | S8 진입 시 발급 | S8 + Smoke #3 |
| B-12 | 보안 rotate | Supabase anon/service_role/DB password/PAT, 노출 KIS/Naver secret rotate | S7a 전 권장 |
| B-13 | Vercel CLI update | v53 최신화 | 향후 deploy 권장 |
| B-14 | Magic Link 디버깅 | 시크릿 창/Email Template/PKCE callback 확인 | S9 전 권장 |
| ~~B-15~~ | ~~Git push to origin~~ | **46차 P0 commit `9661037` + P1 commit `4c6eea7` push 완료. origin/main 동기 ✅** | 해소 |
| **B-16** | **47/48차 commit origin push + 마이그 0016 apply** | 47차 `03d9bc7` SoT cleanup + 48차 신규 commit 2건 `git push origin main` + Supabase 0016 마이그 apply (`mcp__supabase__apply_migration` 또는 dashboard) | acceptShortList RPC 운용 활성화 (orphan G-1 차단 production 반영) |

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
| **§2.A S7a Tier 0/1/2 + 합의 배지 + Reflection 본문** | `Document/Service/Planning/ServicePlan-Admin.md §1A.5 D19` |
| **§2.A S7a Section 8 위원 전원 표 박제 (D20, 45차)** | `Document/Service/Planning/ServicePlan-Admin.md §3.7 R3.7-6/7/8` + `§6 D20` |
| **§2.A S7a Section 8 writer 작성 가이드 (D20, v2.3)** | `Document/Service/Report/ReportFramework.md §8 Step 2` |
| **§2.A S7a Section 8 reference 양식** | `Document/Outputs/Report-Alteogen_196170_v3-Readable.md §Section 8 Part A/B/C` |
| **§2.A S7a 외 리포트 프레임 (Section 0~7 + Appendix · Core 11 + Sector 14×10 페르소나)** | `Document/Service/Report/ReportFramework.md` 전체 |
| **§2.B T7e.7 RLS QA 결과 기록 위치** | `Document/Build/Slices/S7-RealData.md` |
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

- **48차 §7 P3.2 + P3.4 완료 (2026-05-13)**:
  - **scope**: §7 P3 우회 작업 2건 (P3.4 신규 테스트 3종 + P3.2 마이그 0016 RPC). P3.1(D20 컴포넌트)는 S7a 시드 후로 유예, P3.3(error taxonomy 옵션 A/B)은 사용자 결정 필요로 유예.
  - **방식**: cmux pair-debate omxy 3 rounds **모두 CONVERGED** (Round 1 scope 제안 → Round 2 omxy 정정 8건 (D 마이그 5건 + 3 추가: auth 순서·jsonb_typeof array guard·orphan 미호출 assertion) 채택 → Round 3 실행 결과 보고 + omxy 4 권고(test count 463 명시·isUniqueViolation 잔존 명시·SoT 범위·apply order) 채택).
  - **P3.4-A G-cron-auth (+12 tests)**: 4 cron route(monthly-batch/morning-briefing/news-sweep/silent-health) 각각 `describe("authorization (G-cron-auth)")` 추가 — 헤더 없음/wrong secret/wrong scheme(Basic) 3 × 4 = 12 it. 4 route 모두 동일 `isAuthorized()` 패턴(`Bearer ${CRON_SECRET}` 비교) 검증.
  - **P3.4-B G-wrapper-error (+8 tests)**: admin-shortlist(1 — getActiveShortList throw `/short_list_30/`) / admin-approvals(3 — getApprovalsByMonth throw + createPortfolioApproval 23505 raw passthrough + raisePortfolioDispute P0001 raw passthrough) / admin-snapshots(2 — empty noop + insertPortfolioSnapshots 23505 raw passthrough) / admin-reports(1 — getReportByTicker throw `/stock_reports/`) / admin-committee(2 — happy path + getVotesByReportId throw `/committee_votes/`, Supabase mock 신규 setup). 모두 characterization tests — P3.3 taxonomy 결정 전까지 raw passthrough/wrap 패턴 그대로 박제.
  - **P3.4-C G-FE-map (+9 tests)**: format-error 5 specific Korean(cost_hardcap_40man/already_finalized/real_persistence_not_configured/regen_counter_write_conflict/reanalysis_limit_reached) + 2 accept_gate_blocked edge(empty suffix/no colon) + 2 dev-only console.warn(development+window warns / production silent).
  - **P3.2 마이그 0016 + actions.ts 통합 (+4 RPC tests)**: `0016_accept_shortlist_rpc.sql` + rollback 신규 — `accept_shortlist_with_snapshots(p_month text, p_shortlist_generated_at timestamptz, p_snapshots jsonb) returns jsonb` SECURITY DEFINER + `set search_path = public, pg_temp`. 함수 본문 = plpgsql 단일 txn(auto-rollback on exception). **auth 순서 omxy 정정**: auth.uid() null → `auth_unavailable` raise → `is_admin()` 가드 → `admin_required` raise. `jsonb_typeof = 'array'` guard. portfolio_approval INSERT (is_final=true) + portfolio_snapshot bulk INSERT (`jsonb_array_elements`). EXCEPTION unique_violation → `GET STACKED DIAGNOSTICS constraint_name` 분기 (`portfolio_approval_final_month_uniq` → `already_finalized` return / 기타 → re-raise). `revoke from public` + `grant to authenticated`. `admin-approvals.ts`에 `acceptShortlistRpc()` wrapper 신규(snake-case payload 변환 + payload shape 가드). `actions.ts:267-302` acceptShortList → RPC 단일 호출(createPortfolioApproval+insertPortfolioSnapshots 직접 호출 제거 — orphan G-1 차단). `isUniqueViolation` catch 잔존: RPC가 snapshot-side(portfolio_snapshot_date_*_uniq) 등 비-approval unique를 re-raise하면 defensive 매핑. admin-approvals.test.ts에 RPC 단위 테스트 4종(happy/already_finalized/raw error re-throw/unexpected payload guard).
  - **검증 게이트**: build 25 routes / lint 0 / **test:ci 50 files 463 pass** (+34 vs 429) / `tsc --noEmit` clean. regression 0.
  - **omxy R2 정정 8건 모두 반영**: (1) p_admin_id 제거 → auth.uid() 내부 (2) `set search_path = public, pg_temp` (3) plpgsql 단일 txn(begin/end 함수 본문, DDL txn control 아님) (4) `get stacked diagnostics constraint_name` 분기 (5) is_admin() 본문 가드 (6) auth_unavailable을 admin_required보다 먼저 검사 (7) `jsonb_typeof array` guard (8) orphan 검증 — createPortfolioApproval/insertPortfolioSnapshots 미호출 assertion.
  - **마이그 0016 apply 상태**: **파일 박제 완료, DB apply 보류** (사용자 명시 트리거 대기). Apply order: 0010 → 0012~0014 → 0015a → **0016**. 0011은 S8 자동매매 reserve. 적용 명령 = `mcp__supabase__apply_migration` with project_id=`rbrpcynhphrpljbjirfo`.
  - **Git**: 본 commit + 47차 stale commit `03d9bc7` 모두 origin push 대기 (omxy R1·R3 권고 채택 — push는 사용자 명시 행위).
  - **다음 1순위**: S7a Anthropic wrapper (B-6 AI 키 발급 트리거) 또는 §7 P3.1(D20 컴포넌트, S7a 시드 후) + P3.3(error taxonomy 옵션 A/B 사용자 결정 필요).

- **47차 §7 P2.2~P2.4 SoT cleanup (2026-05-13)**:
  - **scope**: 46차 후속 SoT cleanup 3건. AI 키 B-6 미발급 우회 작업. 코드 변경 최소 (md + 주석 + .env.example 템플릿).
  - **방식**: cmux pair-debate omxy 4 rounds **모두 CONVERGED** (Round 1 scope 제안 → Round 2 omxy Beauvoir explore agent 검증으로 .env.example 기존 키 3개 발견 + record-view 경로 정정 + publishable key 의도 확인 → Round 3 build/grep 6종 증거 발송 → Round 4 omxy Curie explore agent 권고로 CodebaseStatus 체크리스트 14 항목 정정 추가).
  - **P2.2**: `HANDOFF.md:105` cron 가드 "403" → "401" (cron route 4종 모두 `status: 401` 반환 grep 검증). `tudal/src/app/api/cron/news-sweep/route.ts:13` 주석 "Vercel Cron 15분 주기" → "Vercel Cron daily 00:00 UTC (vercel.json `0 0 * * *`)".
  - **P2.3**: `tudal/.env.example` 신규 `[S7e T7e.8]` 섹션 — `DART_API_KEY` + `KRX_ID` + `KRX_PW` 3 키 + owning slice 주석. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`는 의도적 주석 잔존 (코드 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 단독 사용 — `src/lib/supabase/{middleware,server,client}.ts` 3 파일 grep 검증).
  - **P2.4**: (a) `CLAUDE.md:78` DQ7-Credentials 행 "**다음 세션 진입점**" 제거 + "1순위는 `HANDOFF.md §2` 참조" 가이드. (b) `CodebaseStatus.md` 현재 기준 헤더 3곳(line 215/329/332) → `2026-05-13 / S7e T7e.8 / 50 files / 429 tests`. (c) Curie 권고 — `:368` 마이그 라인 `0001~0008 → 0001~0010 + 0012~0015a` + `:372` "실데이터 전환 (S7, 미착수)" → "(S7, 진행 중 — S7e T7e.8 + 46차 P0·P1 완료)" 체크리스트 14 항목 갱신 + `:387` "운용 검증 (미착수)" → "(진행 중)" Vercel/origin push 체크. 세션 로그(line 36/48/61/73/79/160/291)는 history 보존. (d) `record-view.ts:18` TODO 주석 "S2 Supabase 연결 시" → "T2.4 후속 — S7e 이후 별도 slice". (e) `FixPlan-46.md §P2.4` 자기 경로 정정 (omxy Round 1 발견: `tudal/src/lib/report/record-view.ts` 존재하지 않음 → `tudal/src/app/(admin)/admin/report/[ticker]/record-view.ts`).
  - **검증 게이트**: build 25 routes / lint 0 (Round 3 기준) / test:ci **50 files / 429 tests pass** / `tsc --noEmit` clean (Round 4 추가는 CodebaseStatus.md md only).
  - **grep 증거 6종**: 모두 0건 (T7e.6 헤더 / HANDOFF 403 / news-sweep 15분 / S2 Supabase / DQ7 진입점 / record-view stale).
  - **omxy 권고 반영**: (1) PUBLISHABLE_KEY 의도적 잔존을 commit message에 명시. (2) Curie 1순위 권고 = "CodebaseStatus 체크리스트 자체 최소 정정" 채택 (legacy 진행표 경고 추가 대안 거부).
  - **변경 summary**: 7 파일, +46/-24. CLAUDE.md(1)/HANDOFF.md(1, 본 commit 포함하여 추가 갱신)/FixPlan-46.md(1)/CodebaseStatus.md(2 라운드)/`.env.example`(1)/`news-sweep/route.ts`(1)/`record-view.ts`(1).
  - **Git**: 47차 단일 commit (P2.2+P2.3+P2.4 묶음) — message에 grep 증거 + PUBLISHABLE 의도 + cmux 4 rounds 박제.
  - **다음 1순위**: §7 P3 (T7a.11 D20 Section 8 표 컴포넌트 + accept_shortlist RPC 마이그 0016 + wrapper error taxonomy 정규화 + 신규 cron-auth/wrapper-error/FE-map 테스트, 1~2주 분량) 또는 **S7a Anthropic wrapper (B-6 AI 키 발급 후)**.

- **46차 P0·P1 실행 + production hotfix push + SoT cleanup (2026-05-13)**:
  - **scope**: 46차 QA audit(9f6bc7e)의 §7 P0·P1 항목을 omxy cmux pair-debate 합의로 실 코드/마이그/문서에 반영. 도중 사용자가 production에서 `real_persistence_not_configured` 에러 보고 → root cause = origin/main이 T7e.4 이전 stale (ahead 39 commits) → 46차 P0 batch 동시 push로 해소.
  - **P0.1 (commit `9661037`)**: Supabase 마이그 0015a (`definer_execute_lockdown`) 작성 + apply. **omxy Round 2 CONVERGED** — 5 SECURITY DEFINER 함수에서 PUBLIC + anon EXECUTE 회수 + 활성/RLS 필수 함수만 authenticated 유지 (is_admin / raise_portfolio_dispute / resolve_portfolio_dispute). **least-privilege 강화**: 미사용 2종(mark_alert_read + record_alert_exit_decision)은 authenticated도 회수. advisor anon WARN **5→0** / authenticated WARN **5→3**.
  - **P0.3 (commit `9661037`)**: `DQ7-Credentials.md §6.10` 운영 SOP 신설 — 0009 rollback production 금지 + 3 조건 동시 체크리스트(brokerage_connection 0건 + exchange_connection 0건 + 사용자 명시 승인).
  - **P0.2**: HIBP 토글은 사용자 dashboard 작업이라 **B-2A 큐로 분리**.
  - **Production hotfix (Round 4 CONVERGED + push)**: ahead 39 commits + 46차 P0 batch → `git push origin main` → Vercel auto-deploy → `real_persistence_not_configured` 에러 해소.
  - **P1.1 (commit `4c6eea7`)**: `src/lib/admin/format-error.ts` 헬퍼 신설 + `__tests__/format-error.test.ts`(+40 tests). 5 client panel(portfolio/regenerate/exit-decision/settings/credential forms) ad-hoc switch 제거 + import 일원화. credentials lib raw DB passthrough → 한국어 generic wrap + dev-only console.error. **omxy Round 6 CONVERGED** — accept_gate_blocked:* prefix handler + Korean passthrough + process.env.NODE_ENV 가드 + inventory snapshot 검증.
  - **P1.2 (commit `9661037`)**: settings/page.tsx "T7e.5에서 전환" → "S7b/S7c 후속에서 전환".
  - **P1.3 (commit `4c6eea7`)**: `(admin)/loading.tsx` + `error.tsx` + `not-found.tsx` 한국어 boundary 3 신규.
  - **P1.4 (commit `4c6eea7`)**: reportLinksEnabled / reportLinkEnabled / actionsEnabled / actionsDisabledMessage 4 prop + 분기 단순화 + canLinkDeltaReport 단일 인자화. delta-banner test 4→3 케이스.
  - **P2.1 (본 commit)**: HANDOFF + FixPlan-46 + ProgressDashboard + CodebaseStatus + CLAUDE.md SoT 정합성 + ServicePlan-Admin·ReportFramework "44차→45차" 일괄 정정.
  - **검증 게이트 (HEAD)**: build 25 routes / lint 0 / **test:ci 429 pass / 50 files** (+45 vs 384/49 baseline) / `tsc --noEmit` clean.
  - **omxy cmux 합의 7 rounds**: R1·R2 P0.1 마이그 → R3·R4 hotfix push → R5·R6 P1.1 헬퍼 → R7 P2.1 SoT scope. 모두 CONVERGED.
  - **Git**: 46차 commits = `9661037` (P0+P1.2) + `4c6eea7` (P1.1+P1.3+P1.4) + 본 commit (P2.1). origin/main 동기 ✅.

- **45차 T7e.8 production 적용 + D20 Section 8 위원 전원 표 박제 (2026-05-12)**:
  - **T7e.8 production**: Supabase 0013(`dart_corp_codes`) + 0014(`dart_financial_cache`) 마이그 적용 → `seed_dart_corp_codes.py` apply (2,766 rows · KOSPI 838/KOSDAQ 1,818/KONEX 110) → full dry-run preview (Universe 2,345 · DART cache 10,154 rows · CFS ok 94% · CFS→OFS fallback 1,728 · standalone Q 환산 384) → 사용자 승인 후 `--apply` 완료. `short_list_30` 30 rows UPSERT — short=모멘텀 10 · mid=실적 모멘텀 8 + 모멘텀 2 · long=퀄리티 10. dry-run preview↔DB 일치, exit 0, client refresh 7회 정상, RemoteProtocolError 0건.
  - **Root cause 수정 3건**: (1) `seed_dart_corp_codes.py` docstring grep이 `KRX_ID`/`KRX_PW` 누락 → fail-fast 추가. (2) `from scripts.dart_signals` import가 직접 실행 시 `ModuleNotFoundError` → try/except fallback. (3) postgrest HTTP/2 stream limit (last_stream_id:19999) → 300 ticker마다 Supabase client 재생성.
  - **D20 박제**: 사용자 요구 반영 — Section 8에 ① Sector 14명 전원 표 ② **Core 11 전원 표(신규)** ③ 쟁점별 인용 3~5건 ④ 최종 합의 패널(Co-Chair 만장일치 여부) 정적 4종. Reference: `Document/Outputs/Report-Alteogen_196170_v3-Readable.md` §Section 8 Part A/B/C. 인터랙티브 페르소나 탐색은 Should S2 유지.
  - **편집 영역**: `ServicePlan-Admin.md §3.7 R3.7-6/7/8` + `§6 D20` + M3 AC/DoD · `ReportFramework.md §8 Step 2` + 변경 이력 v2.3.
  - **검증 게이트**: build 25 routes / lint 0 / test:ci 384 pass / 49 files / `tsc --noEmit` clean / Python unittest 27 pass.
  - **Git**: `72019fa docs(T7e.8): record DART production apply` + `dd05ca1 docs(D20): Section 8 위원 전원 표 박제 — Sector 14 + Core 11 한 줄 의견`.

---

## 7. QA 65건 Fix Plan (46차 audit 박제)

다음 세션 진입 시 §7 P0부터 cmux 합의 → 수정 → 빌드 순으로 진행. **상세 plan + 핵심/고위험 task의 omxy cmux prompt template + DoD = `Document/Process/FixPlan-46.md`** (별도 문서). 본 §7는 entry map.

| P | 작업 묶음 | 상태 | 핵심 발견 |
|---|---|---|---|
| **P0** | 운영 안전 — Supabase advisor anon REVOKE (0015a) + HIBP dashboard + 0009 SOP | **✅ 완료** (P0.1 commit `9661037` apply + production · P0.3 §6.10 SOP · ⏳ P0.2 사용자 HIBP B-2A) | advisor anon WARN **5→0** · authenticated **5→3** (omxy least-privilege 강화 — mark_alert_read + record_alert_exit_decision authenticated도 회수 · 활성 시 re-grant) |
| **P1** | 사용자 영향 — 한국어 매핑 + settings 문구 + (admin) boundary + props cleanup | **✅ 완료** (commit `4c6eea7`) | D-13 format-error 헬퍼(+45 tests, 384→429) / D-14 / G-2-FE / D-12 |
| **P2** | SoT cleanup — 카운트·차수(44→45차) + cron 주석 + .env diff | **✅ 완료** (P2.1 46차 + **P2.2~P2.4 47차 cmux omxy 4 rounds**: 403→401, news-sweep daily 주석, .env.example DART/KRX 3 키 superset, CodebaseStatus 헤더+체크리스트 + record-view TODO + FixPlan-46 자기 경로 정정) | D-15·D-16 / D-18 / G-2·G-3 |
| **P3** | 신규 작업 — T7a.11 D20 Section 8 표 컴포넌트 + accept RPC 0016 + error taxonomy 정규화 + 신규 테스트 | 🟡 **P3.2 + P3.4 완료 (48차) ✅** (마이그 0016 파일 박제 · apply 보류 · +34 tests) · P3.1 D20 컴포넌트 = S7a 시드 후 · P3.3 error taxonomy = 사용자 결정 필요 | G-D20 / G-1 / D-8·D-9·D-10·V-4 / G-cron-auth·wrapper-error·FE-map tests |
| **P4** | Mock 정리 backlog (S7b/S7c/S7d/T7a 자연 진행) | 자연 | 25 mock import owning slice 표 — FixPlan-46.md §P4 |
| (별도) | cron durable write/idempotency backlog (S7b/S7d 진행 시 처리) | 자연 | 4 cron route mock JSON only |

**진입 첫 액션 (다음 세션)**:
```bash
cd /Users/yong/New_Project_KR_Stock
git status --short
cd tudal && npm run build && npm run lint && npm run test:ci   # 회귀 기준선 → 429/50
```
선행 분기:
1. **AI 키 발급 확인**: `vercel env ls | grep ANTHROPIC_API_KEY`. 있으면 §2.A S7a 진입. 없으면 사용자에게 B-6 발급 요청 → 그동안 P2.2~P2.4(잔여 SoT cleanup) + P3 항목으로 우회.
2. **HIBP 토글 확인**: `mcp__supabase__get_advisors(security)` → `auth_leaked_password_protection` 사라졌으면 P0.2 자동 close.

**사용자 결정 4건 박제** (46차):
- D20 차수 = **45차로 통일** ✅ (ServicePlan-Admin/ReportFramework 모두 P2.1에서 갱신 완료)
- monthly-batch cron = **UTC 00:05 (KST 09:05) 유지**
- T7e.7 RLS QA = **수동 1회 유지** (브라우저로 DB 권한 차단 확인 30분~1시간 · 자동화는 P3 backlog)
- 46차 작업 scope = **plan + 박제 + P0/P1 실행 완료** (cmux pair-debate 7 rounds — Round 2/4/6/7 CONVERGED)

**검증 게이트 (48차 종료 시점)**: build 25 routes · lint 0 · test:ci **463/50** (+34 vs 429) · `tsc --noEmit` clean. Production deploy = HEAD `4c6eea7` 동기 (47차 `03d9bc7` + 48차 신규 commit push 대기).
