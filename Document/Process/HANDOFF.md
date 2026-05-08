# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-09 (36차 — **자율 트랙 §A 진입: T7e.1 마이그 0010 검증 + T7e.2 shortlist Supabase 전환 ✅** · S7e 2/8 sub-task · BL-KRIT-7 해소 · 35차 D19 박제 누적)

**목적**: 다음 세션이 이 파일 하나만 보고 즉시 이어갈 수 있게 하는 단일 진입점.
**원칙**: 미래 지향. 완료된 의사결정은 `git log` + 슬라이스 파일에 위임. 여기엔 "다음에 할 일"만.

> ⚡ 진입: §1 → §2 → 막히면 §4. 그 외 컨텍스트는 §6 문서 가이드.

---

## §1 현재 상태 (36차 / 2026-05-09)

- **Mock Skeleton**: ✅ S0~S6 · 19/19 Must
- **DQ-7 Session 3**: 🟢 **~97%** · 잔여 = **Smoke #4·#5만** (33차 #1·#2·#6 ✅) · **Smoke #3 (Binance) ⏸ S8까지 유예 (D19, 35차)**
- **AI 강화 (D19, 35차 박제)**: Short List 30 = "숫자(인디케이터) + AI(Core 11) 병렬 + 합의 에이전트" + Reflection. **AI 키 미발급 fallback** = Tier 0 단독으로 진짜 코스피·코스닥 30종목 + 실 가격·재무·뉴스. AI 키 발급 시 Tier 1 (Core 11) + Tier 2 (Sector 14) plug-in. 어드민 카드 = 🔢 숫자 점수 + 🤖 AI 점수 + 합의 배지 4종(🟢/🔵/🟣/⚪) + AI 코멘트 1~2줄 + 클릭→풀 리포트. 상세 SoT: `ServicePlan-Admin.md §1A.5 D19` + `Service/Report/ReportFramework.md §8`.
- **S7e 자율 트랙 (36차 진입)**: 🟢 **2/8 완료**.
  - **T7e.1 ✅** — 마이그 0010 `alert_event_rls_hardening` 적용 검증 (`mcp__supabase__list_migrations` 20260505134639). E6 alert_event 신설 + AlertType CHECK 12종 + `mark_alert_read`/`record_alert_exit_decision`/`raise_portfolio_dispute`/`resolve_portfolio_dispute` 4 RPC + RLS select-all/insert-own/update-own. **BL-KRIT-7 ✅ 해소**.
  - **T7e.2 ✅** — `src/lib/data/admin-shortlist.ts` 신규(transformer+delta+month/tickerMeta+Supabase error throw) + 5 page-level importer 갱신(admin·settings·portfolio + portfolio actions sync helpers를 `ShortListItem[]` param 받게 리팩터). `/report/[ticker]`는 T7e.3 boundary 위해 mock pair 유지. reportLinksEnabled prop 경계 + `/portfolio` 빈 placeholder + Accept/Reject T7e.3·4 전까지 disabled + createdAt 기반 generated_at(synthetic 폐기). Vitest 8 신규.
  - **T7e.3~8 잔여** — `mock-admin-reports/committee*` (T7e.3) → approvals/snapshots (T7e.4) → regen-counters (T7e.5) → access-logs/performance/decision-tree (T7e.6) → RLS QA (T7e.7) → Tier 0 인디케이터 seed B-1 Python 스크립트 (T7e.8).
  - **T7e.2 의사결정 박제 (S7-RealData.md 의사결정 로그 SoT)**: (1) shortlist만 real, reports/committee는 T7e.3까지 mock pair 유지(boundary). (2) Supabase error throw, Server Actions에서 try/catch → `shortlist_lookup_failed`. (3) 게이트 generated_at = 실 createdAt(같은 월 batch INSERT 동일 가정). (4) Tier 0 인프라 = B-1 로컬 Python idempotent 스크립트(pykrx). (5) name/sector 갭은 T7e.8 prep 단계에서 3옵션 중 결정(컬럼 추가/JOIN 테이블/정적 lookup).
- **Vercel Production**: https://tudal-tawny.vercel.app · `dpl_3FfP5ZU9uz7MqKYc4DD6MfomRJTY` (재배포 X — 본 세션은 코드 변경만)
- **Supabase**: `rbrpcynhphrpljbjirfo` (son00326 Org · Seoul · Free) · 0002~0010 9건 적용 (변동 없음)
- **로그인 우회 (중요)**: ⚠ Magic Link UI 작동 X (Gmail prefetch 추정). 임시 = **이메일+비밀번호** 사용. son00326@gmail.com / `Test1234!`. 친구 2명(shjang1001·kevinoh816)은 **비번 미설정** — Smoke #4 전 32차 admin API 패턴 재사용해 임시 비번 설정 필요.
- **brokerage_connection 1행** (33차 Smoke #2 잔여물): admin_id=son00326 · `64601905-01` · mockMode=true · 실 데이터 의미상 친구 장세현 실전투자 키. **Smoke #4 진입 전 친구 슬롯으로 재등록 필요**.
- **검증 게이트**: build **25 routes** · lint 0 · test:ci **314 pass / 39 files** · `npx tsc --noEmit` exit 0 (이전 24/306/38 → +1 route count 정정/+8 tests/+1 file)
- **실데이터**: 0/19 Must (shortlist SELECT 통로 열림, DB 미적재 → T7e.8 seed 후 1+/19) · 실 AI 호출 0 · 자동매매 미착수 · 운용 0일
- **마이그 번호**: 0002~0010 적용 · 다음 추가 = **0011** (S8 자동매매, BL-KRIT-8) · T7e.8 prep 시점에 name/sector 컬럼 추가 결정되면 0011→0012로 밀거나 분기
- **Git**: HEAD `9c8d3fb` · origin/main ahead 2+ (32차 docs + 34차 v3 + 35차 v3.1 + **36차 T7e.1·2 코드+docs 미커밋**)

---

## §2 다음 작업

> **36차 (T7e.1·2 ✅ 후) 진입 가이드**: 35차 D19 박제 + 자율 트랙 §A의 Step 1 일부(T7e.1·T7e.2) 완료. 다음 = **T7e.3 (mock-admin-reports/committee* → Supabase)** 또는 **T7e.8 B-1 Python 스크립트** 중 하나로 진입. 사용자 액션 의존 작업(§B 큐)은 변동 없음.

### A. 즉시 진입 — 자율 트랙 (Claude 단독 진행 가능, 사용자 액션 무관)

> DQ-7 Session 3 잔여(Smoke #4·#5) + Session 4 + AI 키 발급은 모두 §B 큐로 분리. **자율 트랙은 슬라이스 모델상 DQ-7 ~97%로 두고 S7 진입** — 인프라 미완료 잔여(Smoke 2종)는 사용자 가용 시점 처리.

```
(0) git status --short --branch
(1) Supabase MCP 세션 시작 시 OAuth 재인증 가능:
    mcp__supabase__authenticate → 사용자 브라우저 Authorize
```

**Step 1 — S7e Supabase 실 I/O 전환** (1~2 세션, AI 키 불필요) — **부분 완료 (36차)**
- [x] **T7e.1 ✅ (36차)** — 마이그 0010 `alert_event_rls_hardening` 적용 검증. BL-KRIT-7 해소.
- [x] **T7e.2 ✅ (36차)** — `mock-admin-shortlist.ts` → `src/lib/data/admin-shortlist.ts` (Supabase SELECT). 5 page-level importer 갱신. reportLinksEnabled boundary + `/portfolio` 빈 placeholder + createdAt 기반 generated_at. mock-mock importers (committee/report)는 T7e.3 스코프로 보존.
- [ ] **T7e.3 (다음 1순위)** `mock-admin-reports.ts`·`mock-admin-committee*.ts` → Supabase SELECT. boundary 해소: `/admin/report/[ticker]/page.tsx` mock pair revert를 real로 전환 + ShortlistRow/DeltaBanner/BucketSection의 `reportLinksEnabled={false}`를 `true`로 복구. T7e.2와 동일 패턴(transformer 순수 함수 + Supabase async wrapper + vi.mock test override).
- [ ] T7e.4 `mock-admin-approvals.ts`·`mock-admin-snapshots.ts` → 실 I/O + E4 UNIQUE race 실 검증. `/portfolio` Accept/Reject disabled 해제.
- [ ] T7e.5 `mock-admin-regen-counters.ts` → 실 INSERT/UPDATE + M9 cap 가드 실 동작
- [ ] T7e.6 `mock-admin-access-logs.ts`·`mock-admin-performance.ts`·`mock-admin-decision-tree.ts` → 실 SELECT
- [ ] T7e.7 RLS 정책 브라우저 수동 QA (멤버 권한 403)
- 상세: `Slices/S7-RealData.md` Phase S7e

**Step 2 — T7e.8 Tier 0 인디케이터 스크리닝** ★ **사용자 핵심 목표 검증 단계** (1 세션, AI 키 불필요) — **B-1 인프라 결정 박제 (36차)**
- B-1 = 로컬 Python idempotent 스크립트 (사용자 결정, S7-RealData 의사결정 로그 36차 (4)). pykrx 의존성으로 Vercel/Edge 배제.
- 산출 위치: `scripts/screen_shortlist_tier0.py` (신규 — 미생성).
- 요구사항: idempotent upsert · dry-run 플래그 · CSV 백업 · month 인자 · env 기반 Supabase 접속 (service_role 또는 PAT) · pykrx → 5-Signal Composite × 시간대별 가중치 → 단/중/장 50씩 = 150 → top 10/10/10 = 30 INSERT.
- 진행 시점: T7e.3 완료 후 또는 병행. **사용자가 로컬에서 `python scripts/screen_shortlist_tier0.py --month 2026-05-01 --dry-run` 형태로 실행 → 검토 → `--apply`** 워크플로우.
- name/sector 컬럼 결정 (3옵션): **이 단계에서 사용자 결정 필요**.
  - (a) ALTER TABLE short_list_30으로 컬럼 추가 (마이그 0011 충돌 시 0012로 밀기)
  - (b) 별도 `tickers_meta` 테이블 + JOIN
  - (c) 정적 TS lookup 파일 + Python 스크립트가 함께 갱신
- 출력: 단/중/장 각 10 = **진짜 코스피·코스닥 30종목** + 🔢 점수(0~100) → `short_list_30` INSERT.
- AI 키 미발급 상태이므로 🤖는 ⚪ "AI 분석 대기" placeholder, 합의 배지 ⚪.

**Step 3 — `/admin` 홈 검증** (Claude 자체 검수 + 사용자 검수)
- T7e.8 seed 후: 화면에 진짜 30종목 + 실 가격(KRX)·실 재무(DART)·실 뉴스(Naver) + 🔢 점수 + ⚪ placeholder가 표시되는지.
- Claude는 빌드+런타임 + 스크린샷 또는 SQL 결과로 자체 검수, 사용자에게 화면 검수 요청.

**Step 4 (선택) — S7b 뉴스+브리핑 일부** (Naver 키는 `.env.local`에 있음)
- M12 뉴스 분류기는 AI 키 필요 → ⏸ §B 큐
- M11 모닝 브리핑은 AI 키 필요 + Resend 도메인 인증 → ⏸ §B 큐
- 따라서 S7b는 §B 큐 통과 후 진입

### B. 사용자 액션 대기 큐 (가용 시점에 처리)

> 아래는 사용자 직접 행동이 필요한 작업들. 자율 트랙(§A)이 진행되는 동안 사용자가 임의 시점에 1건씩 처리하면 된다. 처리 순서는 자유.

| # | 작업 | 사용자 액션 | 영향·의존 |
|---|---|---|---|
| **B-1** | 친구 2명 임시 비번 설정 | 32차 admin API 패턴 재사용 → shjang1001·kevinoh816에 `Test1234!` 설정 | Smoke #4 RLS 격리 검증 진입 가능 |
| **B-2** | son00326 슬롯 KIS 키 재등록 | son00326 슬롯의 친구 장세현 키(`64601905-01`)를 shjang1001 슬롯으로 옮기고 son00326 슬롯 row 삭제 (Supabase SQL 또는 admin UI) | Smoke #4 데이터 의미상 정합성 |
| **B-3** | Smoke #4 (RLS 격리) | 케빈(kevinoh816) 계정 로그인 → `/admin/settings/brokerage` → KIS row 0건 확인 | DQ-7 Session 3 종결 조건 |
| **B-4** | Smoke #5 (대표 가드) | 친구 계정 → `/admin/settings/binance` mainnet 라디오 → 403 응답 확인. Binance 키 미입력 상태에서도 라우트 거부 검증 가능 | DQ-7 Session 3 종결 조건 |
| **B-5** | DQ-7 Session 4 QA·Close | T18 Manual QA 30항 · T19 Security probes 4항 · `/review` + `/security-review` + `superpowers:verification-before-completion` · T20 문서 갱신 | DQ-7 슬라이스 ✅ 종결 |
| **B-6** | Anthropic API Key 발급 | console.anthropic.com → API key 발급 + Vercel env `ANTHROPIC_API_KEY` 투입 | S7a Tier 1·2 plug-in (T7a.1~10) → 합의 배지 4종 + AI 코멘트 + 풀 리포트 |
| **B-7** | Resend 도메인 인증 | Resend 콘솔 도메인 검증 + `RESEND_API_KEY` Vercel env | M11 브리핑 발송 → S7b 진입 |
| **B-8** | Naver Vercel env + rotate | 31차 노출 키를 Naver Developers 콘솔에서 rotate + Vercel env 투입 | M12 Vercel 실행 → S7b |
| **B-9** | Telegram Bot 발급 | BotFather → token + 어드민 3명 chat_id 수집 + Vercel env | M13·M15 → S7c |
| **B-10** | KIS API 본인 1개 발급 | 한투 OpenAPI 콘솔 신청 → APP_KEY/SECRET + 본인 계좌번호 | S7c WS read-only |
| **B-11** | Smoke #3 (Binance) | Binance 키 발급 후 진행 | **S8까지 유예 (D19)** — Binance 발급은 S8 진입 시점 |
| **B-12** | 보안 rotate 큐 | 32차 노출 4종(Supabase anon/service_role/DB password/PAT) + 33차 친구 KIS APP_SECRET + 31차 Naver | S7a 진입 전 권장 |
| **B-13** | Vercel CLI 52 → 53 | `npm i -g vercel@latest` 또는 `pnpm add -g vercel@latest` | 향후 deploy 시 v53 권장 |
| **B-14** | Magic Link 근본 디버깅 | 시크릿 창 테스트 → Email Template 점검 → `/auth/callback` PKCE flow | S9 운용 진입 전 권장 |
| **B-15** | son00326 본인 KIS 발급 상태 확인 | 한투 OpenAPI 본인 계정 발급 여부 사용자 확인 | S7c 본인 1개 가능 여부 |
| **B-16** | Git push | HEAD `9c8d3fb` → 32차 docs + 34차 v3 + 35차 v3.1 push | 사용자 권한 |

### C. 시퀀스 v3.1 다이어그램 (SoT: `ProgressDashboard.md §2`)

```
[자율] S7e (Supabase 실 I/O)                              ← AI 키 불필요
       ├ T7e.1 마이그 0010 검증 ✅ (36차) ← BL-KRIT-7 해소
       ├ T7e.2 shortlist Supabase SELECT ✅ (36차)
       │   (5 importer 스왑 + reportLinksEnabled boundary + createdAt gate
       │    + Supabase error throw + Vitest 8 신규)
       ├ T7e.3 reports/committee Supabase SELECT  ← 다음 1순위
       ├ T7e.4 approvals/snapshots 실 I/O + race 검증
       ├ T7e.5 regen-counters 실 INSERT/UPDATE
       ├ T7e.6 access-logs/performance/decision-tree
       ├ T7e.7 RLS 브라우저 수동 QA
       └ T7e.8 Tier 0 인디케이터 (B-1 Python 스크립트)
           ★ 사용자 핵심 목표 — 진짜 코스피·코스닥 30종목 + 실 가격·재무·뉴스
            │
            │ (큐 §B 처리 진행 중)
            ▼
[B-3·B-4] DQ-7 Smoke #4·#5 → [B-5] Session 4 QA·Close
            │
[B-6] AI 키 발급 → S7a Tier 1·2 plug-in (T7a.1~10)
            │
[B-7·B-8·B-9] Resend·Naver·Telegram → S7b 뉴스+브리핑
            │
            ▼
★ D11 AI 가상 포트 1차 가동 (어드민 3인 운용 며칠~1주)
            │
[B-10] KIS 본인 1개 → S7c → S7d
            │
[B-11] Binance 발급 → S8 자동매매 + Smoke #3
            │
            ▼
S9 운용 검증
```

**박제 후속 작업** (35차 일괄 동기화 완료 ✅):
- [x] `Document/Service/Planning/ServicePlan-Admin.md` §1A.5 D19 + Status v1.5 + §3.1 R3.1-6 + §2 카드 컬럼 + §8 Revision v1.5
- [x] `Document/Service/Report/ReportFramework.md` §8 Step 0 + Step 4 후속 + §10 v2.2
- [x] `Document/Build/Slices/S7-RealData.md` T7e.8 + T7a.7~10 + 게이트 체크리스트 강화 + 변경 이력 35차
- [x] `Document/Build/Slices/DQ7-Credentials.md` status + Smoke #3 ⏸ + 변경 이력 32·33·35차
- [x] `Document/Build/ProgressDashboard.md` v3.1 + DQ-7 잔여 정정 + BL-KRIT-9 표기 + 35차 이력
- [x] `CLAUDE.md` 상단 D19 라인 + 시퀀스 v3.1
- [x] `HANDOFF.md` (이 문서) §1·§2·§4·§7 + **§2 자율/큐 분리 (35차 후속)**

**박제 후속 작업** (36차 T7e.1·2 완료 일괄 동기화 ✅):
- [x] `Document/Build/Slices/S7-RealData.md` header status ⚪→🟢 + T7e.1·2 [x] + 의사결정 로그 5건 + 변경 이력 36차
- [x] `Document/Build/ProgressDashboard.md` Last updated 36차 + S7 status 🟢 + 슬라이스 표 갱신 + BL-KRIT-7 ✅ + 변경 이력 36차
- [x] `Document/Process/CodebaseStatus.md` 최근 갱신 36차 entry (신규 모듈/테스트/importer/boundary props/검증 게이트/B-1 결정)
- [x] `Document/Process/HANDOFF.md` (이 문서) §1·§2·§4·§7
- [x] `CLAUDE.md` 상단 진행 순서 v3.1 박스에 T7e.1·2 ✅ 표시
- [x] auto-memory `MEMORY.md` 신규 메모: T7e.2 부분 마이그레이션 boundary 패턴 (vi.mock + helpers items param + Supabase throw + reportLinksEnabled prop boundary + createdAt 기반 gate) — T7e.3~6에 재사용

---

## §3 미해결 결정 (DQ)

### DQ-8 ⏸ 멤버 페이지 Research (Deferred-D 블로커)
어드민 내부 도구 완성 전까지 자동 유예. 재개 트리거 = Deferred-D 멤버 트랙 킥오프.

그 외 DQ-1~7·9~11 모두 해소 — 상세는 `git log` 또는 `Slices/DQ7-Credentials.md` 참조.

---

## §4 미해결 블로커 (BL-KRIT)

| ID | 항목 | 영향 | 해소 | 진입 시점 |
|---|---|---|---|---|
| BL-KRIT-1 | Anthropic API Key | M17·M11·M12·M19 + **Tier 1·2 (D19)** | `.env.local` `ANTHROPIC_API_KEY` + Vercel env | **비블로커화 (D19, 35차)** — Tier 0 단독으로 30종목 산출 가능. AI 키 발급 시 Tier 1·2 plug-in (S7a) |
| BL-KRIT-3 잔여 | Naver Vercel env | M12 Vercel 실행 | Vercel env 투입 (콘솔 rotate 권장) | S7b 직전 |
| BL-KRIT-4 | Resend 도메인 인증 | M11 브리핑 발송 | 도메인 인증 + `RESEND_API_KEY` | S7b 직전 |
| BL-KRIT-5 | Telegram Bot | M13·M15 | BotFather + token | S7c 직전 |
| ~~BL-KRIT-7~~ | ~~alert_event CHECK 확장~~ | ✅ **해소 (36차)** — 마이그 0010 `alert_event_rls_hardening` 적용 검증 (`mcp__supabase__list_migrations` version 20260505134639). E6 alert_event + AlertType CHECK 12종 + 4 RPC + RLS 분리. | ~~S7e 킥오프~~ |
| BL-KRIT-2 | KIS OpenAPI 신청 | S7c WS · S8 자동매매 | 본인 1개 = S7c 충분 / 3인 자동매매 = S8 | S7c·S8 시점 |
| BL-KRIT-8 | S8 신규 엔티티 마이그 | 자동매매 전체 | 마이그 **0011** (E13~E17) | S8 스캐폴드 시 |
| **BL-KRIT-9** | 바이낸스 API Key + IP/KYC | S8 코인 자동매매 + DQ-7 Smoke #3 | Binance 콘솔 발급 + Vercel env | **S8 진입 시점** — D19 (35차)로 DQ-7 Smoke #3 분리·유예 |

**보안 잔여 (rotate 큐)**:
- 32차 채팅 노출 4종: Supabase anon JWT · service_role · DB password · PAT (Dashboard → Settings → API/Database; PAT는 https://supabase.com/dashboard/account/tokens) · ~/.claude.json `Authorization: Bearer ...` 동시 교체. **S7a 진입 전 권장**.
- 33차 채팅 노출 1종: 친구 장세현 KIS APP_SECRET 180자 (한투 OpenAPI 콘솔에서 reissue 권장 + DB 재저장). **Smoke #4 친구 슬롯 재등록 시 동시 처리 권장**.
- 31차 채팅 노출 2종: Naver Client ID + Secret (Vercel env 투입 전 Naver Developers 콘솔 reissue 권장). **S7b 진입 전**.

**환경 잔여**:
- Vercel CLI **52.2.0 → 53.2.0** 업그레이드 권장 (`npm i -g vercel@latest` 또는 `pnpm add -g vercel@latest`). 사용자 수행. 30차에 v52로 deploy 완료된 상태이지만 향후 Smoke·deploy에 v53 권장.
- Supabase MCP는 매 세션 시작 시 OAuth 재인증 필요할 수 있음 — `mcp__supabase__authenticate` → 사용자 브라우저 Authorize.
- Magic Link UI **근본 디버깅 미해소**: 32차 시점 token 즉시 invalidate 현상 (Gmail prefetch 추정). 비밀번호 우회 사용 중. **S9 운용 진입 전 별도 디버깅 필요** (시크릿 창 테스트 → Email Template 점검 → `/auth/callback` PKCE flow 확인 순).

**운영 잔여**:
- son00326 **본인 KIS 발급 상태 미확인**: 33차에 박제된 키는 친구 장세현(shjang1001) 명의. son00326 본인 KIS 발급 여부 사용자 확인 필요. S7c WS read-only 1개 = 본인 1개로 충분 가정인데, 본인 미발급이면 S7c 진입 시 친구 키 임시 차용 결정 필요.
- 친구 2명(shjang1001·kevinoh816) **임시 비밀번호 미설정**: Smoke #4 RLS 격리 검증 진입 전 32차 admin API 패턴 재사용해 `Test1234!` 같은 임시 비번 설정 필요. 사용자 주도.
- son00326 슬롯에 박제된 친구 KIS 키(`64601905-01`) → **친구 shjang1001 슬롯으로 재등록** 후 son00326 슬롯 row 삭제. Smoke #4 진입 전 정리.
- **Git push**: HEAD `9c8d3fb` · origin/main ahead **2+** (32차 docs 미푸시) → 34차 v3 동기화 commit 추가 시 사용자 권한으로 push 필요.

---

## §5 자율 진행 가능 (AUTO — Claude 단독)

다음 세션이 §2·§4에 막혔을 때 대기 대신 처리.

- **AUTO-1**: ProgressDashboard·CLAUDE.md·S8 슬라이스에 §2.C 새 시퀀스 v3 반영
- **AUTO-2**: `CodebaseStatus.md` 체크리스트 섹션 갱신 (실데이터 0/19 등)
- **AUTO-3**: `tudal/.env.local` `ANTHROPIC_API_KEY` placeholder만 박혀 있는지 확인 (실 키는 사용자 제공)

---

## §6 문서 가이드

| 용도 | 문서 |
|---|---|
| 전체 슬라이스 상태판 | `Document/Build/ProgressDashboard.md` |
| **현재 슬라이스 (DQ-7)** | **`Document/Build/Slices/DQ7-Credentials.md`** |
| 다음 슬라이스 (S7 실데이터) | `Document/Build/Slices/S7-RealData.md` |
| 이후 슬라이스 (S8 자동매매) | `Document/Build/Slices/S8-AutoTrading.md` |
| 개발 방법론 | `Document/Process/ExecutionPlaybook.md` |
| 어드민 기획 SoT | `Document/Service/Planning/ServicePlan-Admin.md` |
| 사업 SoT | `Document/Business/BusinessPlan.md` |
| 코드 스냅샷 | `Document/Process/CodebaseStatus.md` |

---

## §7 최근 세션

- **2026-05-09 (36차)** **자율 트랙 §A 진입 — T7e.1 마이그 0010 검증 + T7e.2 shortlist Supabase 전환 ✅ + 부분 마이그레이션 boundary 박제 + REQUEST CHANGES 응대 + APPROVE 회복**. 35차 D19 박제 직후. (a) **T7e.1**: `mcp__supabase__list_migrations`로 0010 `alert_event_rls_hardening` 적용 확인 (20260505134639). E6 alert_event + AlertType CHECK 12종 + 4 RPC. **BL-KRIT-7 ✅ 해소**. (b) **T7e.2**: `src/lib/data/admin-shortlist.ts` 신규 (transformer + delta + month/tickerMeta 옵션 + Supabase error throw) + 5 page-level importer (admin·settings·portfolio + portfolio actions sync helpers를 `ShortListItem[]` param 받게 리팩터). `/report/[ticker]`는 mock pair 유지(T7e.3 boundary). reportLinksEnabled prop 경계(ShortlistRow/DeltaBanner/BucketSection)·`/portfolio` 빈 placeholder + Accept/Reject T7e.3·4 전까지 disabled + createdAt 기반 generated_at(synthetic 폐기). Vitest 8 신규. (c) **REQUEST CHANGES → APPROVE**: 사용자 검수에서 6건 지적(scope 불명확/silent error swallow/CURRENT_MONTH 고정/synthetic gate timestamp/real shortlist+mock report 404 위험/name·sector 갭) 모두 처리 후 재검증 → APPROVE. 사용자 추가 보강(reportLinksEnabled 확산 + `/portfolio` placeholder + Accept disabled + rejectShortList createdAt). (d) **검증**: build 25 routes · lint 0 · test:ci **314 pass / 39 files** · `npx tsc --noEmit` exit 0. (e) **B-1 결정**: T7e.8 Tier 0 = 로컬 Python idempotent 스크립트(scripts/, dry-run·CSV 백업·month 인자·env 기반). (f) **편집 6문서**: `S7-RealData.md`(header/status/T7e.1·2 [x]/의사결정 5건/변경 이력) · `ProgressDashboard.md`(Last updated/슬라이스 표/BL-KRIT-7/변경 이력) · `CodebaseStatus.md`(36차 최상단 entry) · `HANDOFF.md`(이 문서) · `CLAUDE.md`(소폭) · auto-memory `MEMORY.md`(부분 마이그레이션 boundary 패턴 신규 메모). **다음 세션 1순위**: T7e.3 (reports/committee Supabase) 또는 T7e.8 B-1 Python 스크립트 작성.
- **2026-05-08 (35차)** **D19 박제 — JooPick AI 강화 (Tier 0/1/2 + 합의 배지 + Reflection) + 시퀀스 v3.1 + Smoke #3 ⏸ 유예**. 사용자 핵심 목표 = "단/중/장 각 10개씩 30종목이 진짜로 admin 화면에 들어오는지 검증". 외부 레퍼런스 [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) Analyst Team(Fundamentals/Sentiment/News/Technical) + Bull/Bear debate + Risk·Portfolio Manager + `trading_memory.md` 패턴 차용. JooPick 박제(Core 11 + Sector 14×10 = 151 페르소나, 쟁점별 찬반 대결, ReportFramework v2.0) 보존. **결정 5개**: (1) Tier 0 인디케이터 자동 스크리닝 (pykrx·KRX·DART, AI 키 불필요, 단/중/장 50씩 = 150). (2) Tier 1 Core 11 페르소나 평가 (시간대별 가중치 — 단기 Druckenmiller·Minervini↑, 중기 Lynch↑, 장기 Buffett·Munger·Fisher↑). (3) Tier 2 Sector Board 활성화 = 30종목 해당 섹터 14명만 (140명 X, 비용 통제). (4) 합의 배지 4종 (🟢 강한 합의 / 🔵 숫자 우세 / 🟣 AI 우세 / ⚪ AI 분석 대기) + 어드민 카드 = 🔢🤖 이중 점수 + AI 코멘트 1~2줄 + 클릭→풀 리포트. (5) Reflection — 매월 말 실현 수익률 → 다음달 prompt 주입 (`reflection_log` 신규 엔티티 후보). **AI 키 미발급 fallback** = Tier 0 단독으로 진짜 코스피·코스닥 30종목 + 실 가격·재무·뉴스 가동 가능. **Binance ⏸ S8까지 유예**. **편집 8문서**: ServicePlan-Admin §1A.5 D19 + Status v1.5 + §3.1 R3.1-6 + §2 카드 컬럼 + §8 Revision v1.5 / Service/Report/ReportFramework.md §8 Step 0 + Step 4 후속 + §10 v2.2 / Build/Slices/S7-RealData.md T7e.8 + T7a.7~10 + 게이트 체크리스트 강화 / Build/Slices/DQ7-Credentials.md status + Smoke #3 ⏸ + 변경 이력 32·33·35차 / Build/ProgressDashboard.md v3.1 + BL-KRIT-9 / CLAUDE.md 상단 D19 + 시퀀스 v3.1 / HANDOFF.md (이 문서) §1·§2·§4·§7. **코드 변경 0건** (docs only).
- **2026-05-08 (34차)** HANDOFF 슬림화 (458→157줄) + 시퀀스 v3 박제 + **5문서 v3 동기화 일괄 완료**. **S8 자동매매를 S7 series 다음으로 분리** 결정 (사용자 5/8 판단: KIS는 자동매매 전용이고 일간 데이터·AI 가상 포트는 KIS 무관 → son00326·Kevin KIS 발급 지연을 비블로커화). 동기화 완료: (1) ProgressDashboard §2 v3 다이어그램 + 32/33/34차 이력 · (2) S8-AutoTrading 선행 조건·Phase 헤더·status·의사결정 로그·변경 이력 · (3) ServicePlan-Admin §1A.5 D18 + D14·D15 요약 표 + Status v1.4 + §8 Revision History v1.4 · (4) CLAUDE.md 상단 시퀀스+보조 문서 표+Auto-recognition hints · (5) S7-RealData D11 가상 포트 게이트 + DoD stale "S8 스캐폴드 병행 시작" → "S8 단독 진입" 정정. HANDOFF §4에 추가 미해결 항목 박제 (보안 4종 + 33차 KIS APP_SECRET + 31차 Naver 키, Vercel CLI 52→53 업그레이드, Magic Link 근본 디버깅, son00326 본인 KIS 발급 상태 미확인, 친구 비번 미설정, son00326 슬롯 친구 키 재등록 정리, Git push). 코드 변경 0건. **회귀 3-gate green**: build 24 routes · lint 0 · test:ci **306 pass / 38 files**.
- **2026-05-08 (33차)** DQ-7 Smoke #2 PASS — KIS 키 AES-256-GCM 검증. `64601905-01`(친구 장세현 실전투자 키, son00326 슬롯에 임시 박제) ciphertext bytea 평문 노출 0. row id `f35566e9-…`. **데이터 의미상 불일치는 Smoke #4 진입 전 친구 슬롯 재등록으로 정리.** Magic Link UI 32차 시점 작동 X 잔존.
- **2026-05-05 (32차)** Supabase 계정 마이그 (Kevin → son00326 `rbrpcynhphrpljbjirfo`) · 0002~0010 9건 적용 · admin_emails 3 + kr_business_days 2557 · auth.users 3명 · Vercel env 8 교체 · Production 재배포. Smoke #1·#6 PASS. son00326 비번 `Test1234!` 임시 설정.
- **2026-04-30 (31차)** Naver Client ID/Secret `.env.local` 투입 (BL-KRIT-3 부분 해소).
- **2026-04-22 (30차)** DQ-7 Session 3 Vercel 첫 배포 도달. MEK · CRON_SECRET · ADMIN_REP_EMAIL · T14 rotate 스크립트 · vercel.json news-sweep daily 강등.
- **2026-04-22 (25~29차)** DQ-7 brainstorming + spec + Session 1 (Backend·DB) + Session 2 (Frontend) + 문서 정합 cleanup + Step 2 로드맵 v2.
- **2026-04-21 (24차)** 어드민 프레임 재정의 (D16) · Stage 어휘 폐기 · S8 통합 · DQ-5 해소.
- **2026-04-20 (23차)** S6 Mock 완료 → Mock Skeleton 19/19 종점. "MVP 완료" 어휘 정정.
- **이전 (15~22차)** S0 Foundation → S5b Mock 누적. 상세는 `git log --oneline`.

---
