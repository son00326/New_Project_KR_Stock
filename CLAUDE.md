# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⭐ 프로젝트 재정의 (2026-04-21 D16 · 2026-05-08 D18 시퀀스 v3 · 2026-05-08 D19 AI 강화 v3.1)

**어드민 = 본인 + 친구 2명(총 3명)이 주식·코인 투자를 편하게 하기 위한 내부 도구**.

- 멤버(500cap 초대)·MVP Stage·Friends & Family Beta 같은 공개 서비스 프레임은 **별도 트랙 (Deferred-D)** 으로 분리되어 있으며, 현 개발 플랜과 관련 없음.
- "Must 19 / MVP Stage 1·2" 어휘는 어드민 트랙에서 **강제 게이트가 아님**. 내부 도구 완성도 관점으로만 해석.
- 자동매매는 **S8 단일 슬라이스**로 통합: 주식(KIS 모의→실계좌) + **코인(바이낸스 USDT-M 선물 테스트넷→메인넷)**. "Stage 1 매뉴얼 → Stage 2 API → Stage 3 AI 자율" 어휘는 폐기.
- 자동매매 의사결정 엔진은 **Strategy 파일 drop-in + AI 어댑터 embed** 이중 경로. AI agent·skill 본체는 어드민이 추후 drop-in.
- 리스크 가드레일 기본값 (S8에서 박제): 레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 ≤ 20회.
- 법무(Q16)·이용약관(Q17): Deferred-D 재개 전까지 불필요. Footer 면책으로 충분.
- **D18 (2026-05-08)**: KIS는 **자동매매 전용** (S7c WS read-only는 본인 1개 충분, 일간 데이터·AI 가상 포트는 KRX/pykrx/DART/네이버로 KIS 0개). son00326·Kevin KIS 발급 지연 = S7c까지 비블로커. S8 자동매매는 D11 AI 가상 포트 운용 검증 후로 분리.
- **D19 (2026-05-08, 35차)**: Short List 30 선정 = **"숫자(인디케이터) + AI(Core 11 페르소나) 병렬 + 합의 에이전트" + Reflection(자가학습)** 구조. **Tier 0** = 인디케이터 자동 스크리닝(코스피·코스닥 → 단/중/장 후보 50씩, AI 키 불필요). **Tier 1** = Core 11 평가 + 시간대별 페르소나 가중치(단/중/장 각 10). **Tier 2** = Sector Board 14×10에서 30종목 해당 섹터 14명만 활성화(비용 통제). **합의 배지 4종**(🟢 강한 합의/🔵 숫자 우세/🟣 AI 우세/⚪ AI 분석 대기). **AI 키 미발급 fallback** = Tier 0 단독으로 실 코스피·코스닥 30종목 + 실 가격·재무·뉴스. AI 키 발급 시 Tier 1·2 plug-in. **Reflection** = 매월 말 실현 수익률 → 다음달 prompt 주입 (TauricResearch/TradingAgents 차용). **Smoke #3 (Binance) ⏸ 유예** (S8까지). 상세 SoT: `ServicePlan-Admin.md §1A.5 D19` + `Service/Report/ReportFramework.md §8`.
- **36차 (2026-05-08)**: **자율 트랙 §A 진입 — T7e.1 마이그 0010 검증 + T7e.2 shortlist Supabase 전환 ✅** (S7e 2/8 sub-task). BL-KRIT-7 ✅ 해소 (마이그 0010 적용 검증). `src/lib/data/admin-shortlist.ts` 신규 + 5 importer 갱신 + reportLinksEnabled prop boundary + createdAt 기반 generated_at + Supabase error throw + Vitest 8 신규 (314/39). **부분 마이그레이션 boundary**: shortlist만 real, reports/committee는 T7e.3까지 mock pair (real shortlist + mock report 혼합 시 404 위험 회피). T7e.8 인프라 = B-1 로컬 Python idempotent 스크립트 (pykrx, scripts/, dry-run·CSV 백업·month 인자). 다음 1순위 = T7e.3 또는 B-1 Python 스크립트 작성.
- **37차 (2026-05-08)**: **T7e.3 reports/committee Supabase 전환 ✅ + boundary 2번째 해제** (S7e 3/8). `src/lib/data/admin-reports.ts` 신규 (Section0~8+Appendix canonical 타입 + transformer + `getReportByTicker`/`reportExistsForMonth` + `deriveBucketNeighbors` 순수 함수) + `src/lib/data/admin-committee.ts` 신규 (transformer + `getVotesByReportId` + `aggregateVotes` 이관). `/admin/report/[ticker]/page.tsx` Supabase 전환 (active shortlist month 기준 report 조회). `regenerate/actions.ts` `MOCK_ADMIN_REPORTS.some` → `reportExistsForMonth` (try/catch → 신규 에러 코드 `report_lookup_failed`). `reportLinksEnabled={false}` 3곳 제거 → 카드 클릭 활성(Delta REMOVED는 리포트 대기 유지). portfolio actionsDisabledMessage T7e.4만 남김. Vitest 19 신규/보강 (admin-reports 10 + admin-committee 6 + regenerate 1 + delta-banner 2 → 전체 333/42). 시드 부재 상태에서는 `/report`는 `notFound()` 일관 동작 (S7a/T7e.8 시드 후 데이터 채워짐). 다음 1순위 = T7e.4 (approvals/snapshots) 또는 T7e.8 B-1 Python 스크립트.
- **38차 (2026-05-08)**: **T7e.4 approvals/snapshots Supabase 전환 ✅ + `/admin/portfolio` fail-closed boundary 해제** (S7e 4/8). `src/lib/data/admin-approvals.ts` 신규 (`portfolio_approval` transformer + month/id SELECT + INSERT + dispute/resolve RPC wrapper) + `src/lib/data/admin-snapshots.ts` 신규 (`portfolio_snapshot` transformer + bulk INSERT). `/admin/portfolio/page.tsx` approvals SELECT 실 전환 + `actionsEnabled={false}` 제거. `actions.ts` Reject/dispute/resolve는 실 I/O, Accept는 fake entryPrice 저장 금지: 실 가격 소스가 없으면 `entry_price_unavailable`로 E4 INSERT 전 fail-closed. Reject 3회 차단(`reanalysis_limit_reached`) + reject write 23505는 accept-only `already_finalized`로 오분류하지 않음. `portfolio-panel.tsx`는 신규 에러 코드 3종을 한국어 운영자 메시지로 표시. 다음 1순위 = T7e.5 (regen-counters) 또는 T7e.8 B-1 Python.

**현 진행 순서 v3.1 (SoT: HANDOFF.md §2.C · ProgressDashboard.md §2)**:
```
Mock Skeleton ✅
  → DQ-7 Admin Credential (Smoke #4·#5 잔여 · Smoke #3 ⏸ S8까지 유예)
  → S7a (Anthropic wrapper) ── AI 키 발급 시 Tier 1·2 plug-in
  → S7e (Supabase 실 I/O 전면) + Tier 0 인디케이터 게이트 (AI 키 불필요)
       ├ T7e.1 마이그 0010 검증 ✅ (36차)
       ├ T7e.2 shortlist Supabase SELECT ✅ (36차)
       ├ T7e.3 reports/committee Supabase SELECT ✅ (37차)
       ├ T7e.4 approvals/snapshots 실 I/O + race ✅ (38차)
       ├ T7e.5 regen-counters  ← 다음 1순위
       ├ T7e.6 access-logs/performance/decision-tree
       ├ T7e.7 RLS 브라우저 수동 QA
       └ T7e.8 Tier 0 인디케이터 (B-1 로컬 Python 스크립트, scripts/)
  → S7b (뉴스+브리핑)
  → ★ D11 AI 가상 포트 1차 가동 (KIS 0개 · Tier 0 단독 가능 · Tier 1·2 키 있으면 plug-in)
    어드민 3인 운용 검증 며칠~1주 (실 종목 30개 + 합의 배지 + AI 코멘트 검증)
  → S7c (장중·KIS WS · 본인 1개) → S7d (Silent Health)
  → S8 자동매매 (분리 단독 진입 · Binance Smoke #3 여기서 진행) → S9 운용 검증
```

---

## 📚 Document System (AUTO-RECOGNIZE)

This repository uses a **문서 기반 플래닝 시스템**, organized into subfolders under **`Document/`**. Each document has a distinct purpose. At session start, Claude MUST recognize all documents and route updates to the correct one. **Never collapse them, never duplicate content across files, never write business decisions into HANDOFF.md or service progress into BusinessPlan.md.**

### 핵심 문서

| # | File | Purpose | Who writes | Update trigger |
|---|---|---|---|---|
| 1 | `Document/Business/BusinessPlan.md` | **사업 방향 (frozen-ish)**. Q1~Q11 확정본, 3-Layer 구조, 재무, 법, 핵심 의사결정 기록. 서비스 UX/UI·화면 구성은 여기 없음. | User + Claude(planner/analyst/critic) | 사업 피벗·재무·법적 구조 변경 시 |
| 2 | `Document/Service/Planning/ServicePlan.md` | **인덱스 + 공통 원칙**. 어드민/멤버 sub-doc 포인터, BusinessPlan 파생 제약, 공통 원칙(인증 분리·라우트 그룹·디자인 시스템·면책 Footer). **상세 기획 없음 — sub-doc 참조.** | Claude | 공통 원칙 변경 시 |
| 2a | `Document/Service/Planning/ServicePlan-Admin.md` | **어드민 메인 서비스 기획 본체**. 사용자·JTBD, 화면 IA·라우트, 기능 스펙, 데이터 모델, 제약. 어드민(3명 가정) 전용. **서비스 기획 편집 1순위.** | Claude(product-manager) + User | 어드민 서비스 기획 확정·변경 시 |
| 2b | `Document/Service/Planning/ServicePlan-Member.md` | **멤버 페이지 기획 본체**. 멤버(500cap 초대) 전용. Research 보강 블로커 있음 (경쟁사 리서치 선행 필요). | Claude(product-manager) + User | 멤버 서비스 기획 확정·변경 시 |
| 3 | `Document/Process/ExecutionPlaybook.md` | **슬라이스 기반 개발 방법론** (S0 Foundation → S6 Hardening). Lifecycle·에이전트·스킬 매핑·하네스 호출 시점·병렬 원칙. Waterfall(Phase/BuildPhase) 대체. | Claude(meta) | Lifecycle·에이전트·스킬 매핑 변경 시만 |
| 4 | `Document/Build/ProgressDashboard.md` | **전체 슬라이스 상태판**. 슬라이스별 status(⚪🟢✅⏸)·Must 19 진행률·Global Blocker. 주간 스냅샷 뷰. | Claude | 슬라이스 상태 변경·Must 진행률 갱신 시 |
| 5 | `Document/Build/Slices/S?-*.md` | **현재 슬라이스 상세** (일상 작업 파일). Tasks·DoD·의사결정 로그·완료 체크리스트. 슬라이스 내부 작업 1순위 편집 대상. | Claude + User | Task 진척·DoD 체크·의사결정 박제 시 |
| 6 | `Document/Process/HANDOFF.md` | **Session continuity + 다음 세션 포인터**. 🟢 현재 슬라이스 / 🔴 다음 행동 / 🟡 미결. 경량화 — 상세는 Slice 파일 참조. | Claude | 모든 세션 종료 시 필수 갱신 |

### 보조 문서

| File | Purpose |
|---|---|
| `Document/Process/CodebaseStatus.md` | **현재 지향** 스냅샷. 라우트·파일 수·mock vs 실데이터·환경변수. 구조 변화 시 덮어쓴다. |
| `Document/Service/Report/ReportFramework.md` | AI 투심위 보고서 프레임워크 SoT (Section 0~8 + Appendix, Core Committee, Sector Board). |
| ~~`Document/Service/Planning/AutoTrading.md`~~ | **2026-04-22 `Document/Archive/`로 이관** — D11 이전 자동매매 독립 트랙 가정 기반 리서치 원자료. |
| `Document/Build/SliceTemplate.md` | 신규 슬라이스 파일 생성 시 참조 템플릿. |
| **`Document/Build/Slices/DQ7-Credentials.md`** | **Admin Credential System 슬라이스** (2026-04-22 신설 · per-admin API 키 UI + AES-256-GCM 암호화 + Vercel 첫 배포 · S7a보다 선행 · Session 3 부분 진행 · T16/0009/T17 잔여). **다음 세션 진입점**. |
| `Document/Build/Slices/S7-RealData.md` | 실데이터 전환 슬라이스 (S7a Anthropic → S7e Supabase → S7b 뉴스/브리핑 → S7c 장중/Exit → S7d Silent Health). DQ-7 완료 후 진입. **D18 (2026-05-08)**: S7b 후 D11 AI 가상 포트 1차 가동 게이트 명시 (KIS 0개). |
| `Document/Build/Slices/S8-AutoTrading.md` | **자동매매 프레임 슬라이스** (주식 KIS + 바이낸스 선물, Strategy drop-in + AI 어댑터 embed, 2026-04-21 D16 승격). `/admin/settings/{brokerage,binance}` UI는 DQ-7에서 선행 이관. **D18 (2026-05-08)**: S7a·S7e 후 병행 → **S7d 후 단독 진입**으로 분리. |
| ~~`Document/Service/Planning/AutoTrading-AI구조설계.md`~~ | **2026-04-22 `Document/Archive/`로 이관** — AI 구조 초안(D11 이전) · S8 AI 어댑터 drop-in 시 참조 원자료. |
| `Document/Archive/` | 폐기된 방법론·리서치 원자료 보관: `Phase.md`·`BuildPhase.md` + **2026-04-22 추가** `AutoTrading.md`·`AutoTrading-AI구조설계.md` (D11 이전 자동매매 독립 트랙 가정 기반 · S8 AI 어댑터 drop-in 시 참조). 참조·편집 금지. |
| `Document/Process/Memo/*.md` | 세션별 메모·기준선 정리. 참조용. |

> **Folder convention**: `Document/Business/` (사업), `Document/Service/Planning/` (서비스 기획: ServicePlan 인덱스·Admin·Member), `Document/Service/Report/` (AI 리포트 방법론: `ReportFramework.md` SoT + 초안 `ReportFramework-v3-*` 및 `ReportFramework-BioSector` + `ReaderAnalogyCards-ConstructionToBio`), `Document/Service/Build/` (슬라이스 산출 스펙: FRD·Scenario·ScreenSpec — 필요 시 슬라이스 내부에서 생성), `Document/Build/` (슬라이스 실행: `ProgressDashboard.md` + `Slices/S?-*.md` + `SliceTemplate.md`), `Document/Process/` (방법론·세션·메모 — `ExecutionPlaybook.md`가 중심), `Document/Archive/` (폐기된 방법론·리서치 원자료: `Phase.md`·`BuildPhase.md` + `AutoTrading.md`·`AutoTrading-AI구조설계.md`(2026-04-22 이관, D11 이전 자동매매 독립 트랙 가정) — 참조 금지), `Document/Research/` (리서치 원자료), `Document/Outputs/` (생성 리포트·백테스트 산출물).

### Entry routine (매 세션 시작 시 자동 수행)

1. **Read in order**: `HANDOFF.md` → `Document/Build/ProgressDashboard.md` → **현재 슬라이스** `Document/Build/Slices/S?-*.md` → `ServicePlan-Admin.md` → `BusinessPlan.md` → `Document/Process/ExecutionPlaybook.md` → `CodebaseStatus.md`. (ServicePlan.md 인덱스·ServicePlan-Member는 해당 작업 맥락일 때만 추가.)
2. **Identify current slice**: `ProgressDashboard.md`에서 🟢 상태 슬라이스를 확인. 해당 `Slices/S?-*.md`의 Tasks 체크리스트에서 **다음 미완료 Task**를 1순위로 채택. 기획 보강 필요 시 `ServicePlan-Admin.md` 해당 섹션으로 우회.
3. **Lookup agent/skill**: `ExecutionPlaybook.md` §2 (단계별 매핑 표)와 §3 (하네스 호출 시점)에서 현재 Task 단계(킥오프/설계/구현/실데이터 연결/QA/클로즈)에 해당하는 Primary·Secondary·Skill을 확인. Playbook에 없는 예외 작업만 `~/.claude/skill-routing.md` + Skill Sources 표로 fallback.
4. **Announce**: "이번에 〈슬라이스 S? — Task명〉을 〈단계: 설계/구현/…〉로 〈에이전트/스킬〉을 사용해 진행합니다. Uncertainty: 〈낮/중/높〉"를 사용자에게 먼저 고지. "중간" 이상은 사용자 재확인을 요청.

### Update routing (무엇을 어디에 쓸 것인가)

| 변화 유형 | 기록 위치 |
|---|---|
| 사업 피벗, 재무 가정, 법적 원칙 변경 | `BusinessPlan.md` §"핵심 의사결정 기록" |
| 어드민 서비스 기획 확정 (IA / 기능 / 데이터 / UX) | `ServicePlan-Admin.md` 해당 섹션 |
| 멤버 서비스 기획 확정 (IA / 기능 / 데이터 / UX) | `ServicePlan-Member.md` 해당 섹션 |
| 어드민·멤버 공통 원칙 변경 (인증 분리, 디자인 시스템 등) | `ServicePlan.md` §3 |
| Task 진척 (체크리스트·DoD 체크) | 현재 `Document/Build/Slices/S?-*.md` |
| 슬라이스 상태 변경 (⚪→🟢→✅, ⏸) | `Document/Build/ProgressDashboard.md` 표 + 해당 Slice 파일 status 필드 (동시 갱신) |
| 블로커 해소 | 해당 Slice 파일 "의사결정 로그" + `ProgressDashboard.md` §Global Blocker |
| 에이전트·스킬 매핑 변경 | `Document/Process/ExecutionPlaybook.md` §2 |
| 방법론 리파인 (슬라이스 실행 중 깨달은 개선점) | `ExecutionPlaybook.md` §1·§3·§9 변경 이력 |
| 세션 종료 시 작업 큐 갱신 (다음에 할 일) | `HANDOFF.md` |
| 현재 코드베이스 스냅샷 (라우트·파일·환경변수) | `CodebaseStatus.md` |

**원칙**: BusinessPlan은 천천히 변한다. ServicePlan-Admin/Member는 기획 중 자주 변한다. ServicePlan.md(인덱스)는 공통 원칙 변경 시만. ExecutionPlaybook.md는 드물게 변한다(방법론 개선 시만). 현재 Slices/S?-*.md는 매 세션 변한다(일상 작업 파일). ProgressDashboard.md는 슬라이스 상태 전이 시 변한다. HANDOFF.md는 **미래 지향**(다음에 할 일)으로 매 세션 변한다. CodebaseStatus.md는 **현재 지향**(지금 있는 것)으로 구조 변화 시 덮어쓴다.

### Auto-recognition hints (파일 판정 규칙)

- `BusinessPlan` → 사업 레벨. 코드 변경 전에 먼저 참조. 서비스 UX/UI 내용 없음.
- `ServicePlan.md` (확장자만, sub-doc 아님) → **인덱스 + 공통 원칙**. 상세 기획은 여기 없다.
- `ServicePlan-Admin` → **어드민 내부 도구 기획 본체** (v1.4, 2026-05-08 D18). 서비스 기획 편집 1순위. **핵심 개념**: (a) D11 AI 가상 포트 본체 + 3경로 집행(주픽 매뉴얼·주픽 자동매매 S8·외부 바이패스). 승인(Accept)=가상 포트 확정(성능 측정용), 실제 체결은 어드민 독립. (b) D16 어드민 = 내부 투자 도구, Stage 어휘 폐기, 자동매매(주식+바이낸스 선물) S8 통합. (c) D17 DQ-7 Admin Credential System — per-admin UI + AES-256-GCM 암호화 + Vercel 첫 배포 선행 트랙. (d) **D18 S8 자동매매 진입 시점 재조정 — S7d 후 단독 진입 + KIS 발급 비블로커화 + D11 AI 가상 포트 운용 검증 게이트**. 상세 §1A.0 + §1A.5 D18 + §3.13 + `Slices/DQ7-Credentials.md` SoT.
- `ServicePlan-Member` → **멤버 서비스 기획 본체**. Research 블로커 해소 후 착수.
- `ExecutionPlaybook` → **슬라이스 기반 개발 방법론** (S0~S6). 에이전트·스킬·하네스 선정 임의 무시 금지. Waterfall(Phase/BuildPhase) 전면 대체.
- `ProgressDashboard` → **전체 슬라이스 상태판**. 🟢 슬라이스가 현재 1순위. 슬라이스 상태·Must 진행률·Global Blocker 한눈 뷰.
- `Document/Build/Slices/S?-*.md` → **현재 슬라이스 상세** (일상 작업). Tasks·DoD·의사결정 로그. 세션당 편집 빈도 가장 높음.
- `Document/Archive/` 하위 파일 → 폐기된 방법론(Phase·BuildPhase). **참조·편집 금지**. 역사 추적용.
- `HANDOFF.md` → 세션 시작 시 **가장 먼저** 읽는 파일. 세션 종료 전 **마지막으로** 갱신. 미래 지향.
- `CodebaseStatus.md` → 현재 지향 스냅샷. 세션 로그가 아님.

---

## Repository Layout

- `Document/` — 문서 기반 플래닝 시스템. 서브폴더: `Business/`, `Service/{Planning,Report,Build}/`, `Process/`, `Research/`, `Outputs/`.
- `CLAUDE.md` — 이 파일 (프로젝트 루트, Claude Code가 자동 로드)
- `tudal/` — the actual Next.js application. 디렉토리 이름은 리브랜드 전 잔재(`tudal/package.json` name은 `joopick`). **폴더명을 변경하지 말 것** — 하위 문서가 경로를 참조한다.
- `backtest/` — 백테스트 스크립트·결과물.
- `scripts/` — 운영 스크립트(Python 포함). S3에서 신설 (`seed_kr_holidays.py` KRX 영업일 seed 생성기). venv 권장 (Homebrew Python 3.14 PEP 668 제약).

All engineering commands run from inside `tudal/`.

## Commands

```bash
cd tudal
npm run dev     # next dev (Turbopack)
npm run build   # next build — primary verification gate
npm run start   # next start
npm run lint    # eslint via eslint-config-next flat config
npm run test    # vitest watch (개발용)
npm run test:ci # vitest run (S3 도입, G-10=b) — pure 로직 유닛 테스트
```

검증 게이트 = `npm run build` + `npm run lint` + `npm run test:ci` (3종). Vitest는 S3 도입(2026-04-17, G-10 옵션 b) — race condition·영업일 계산·이의 제기 등 순수 로직용. 컴포넌트·RLS 테스트는 스코프 외 (수동 QA). 통합/E2E 테스트 추가는 사용자 확인 후에만.

## Critical: Next.js 16 is not your training data

`tudal/AGENTS.md` (referenced by `tudal/CLAUDE.md` via `@AGENTS.md`) contains a hard warning:

> This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Pinned version: `next@16.2.3`, `react@19.2.4`. 라우팅·미들웨어·서버 액션·메타데이터·`next/*` import 관련 코드를 쓰기 전 **반드시** `tudal/node_modules/next/dist/docs/` 또는 context7 MCP 조회.

## Architecture (big picture)

### App Router with route groups
`tudal/src/app/`는 **3개 라우트 그룹**: `(auth)` (login/signup + pass-through layout) / `(main)` (macro, stock/[ticker] + Header+Footer) / `(admin)` (S0 신설 — /admin 홈·portfolio·report·alerts·track-record·decision-tree·settings + 자체 chrome: 로고·사이드바·면책 Footer). Root `app/layout.tsx` 최소 HTML(`lang="ko"` + Geist), 라우트별 chrome은 그룹 layout에서 담당.

### Middleware runs Supabase session refresh on every request
`tudal/middleware.ts`가 `@/lib/supabase/middleware`의 `updateSession`을 위임 호출. matcher는 정적 자원 제외 — 그 외 모든 요청이 Supabase SSR 코드를 탄다. Supabase SSR 세션 refresh 활성. `.env.local`은 son00326 Supabase 프로젝트(`rbrpcynhphrpljbjirfo`) 기준으로 세팅됨.

### Data layer: mock + 실데이터 hybrid
`tudal/src/lib/data/*.ts`는 현재 mock fixture와 S7e Supabase SELECT wrapper가 공존한다. 실 wrapper: `admin-shortlist.ts`, `admin-reports.ts`, `admin-committee.ts`. 나머지 실데이터 도메인 모듈은 `tudal/src/lib/{briefing,credentials,crypto,news,performance,portfolio,scheduler,supabase,cost,email,health,intraday,notify}/`로 분리. 타입은 `tudal/src/types/`. KRX/DART/pykrx seed 및 남은 mock 전환은 S7-RealData 후속 Task에서 진행.

### API routes & Vercel crons
`tudal/src/app/api/cron/`에 4개 cron 엔드포인트가 활성. 스케줄은 `tudal/vercel.json`에 정의 (`monthly-batch` 매월 1일 00:05 UTC · `morning-briefing` 일 23:00 UTC · `news-sweep` 일 00:00 UTC · `silent-health` 일 15:00 UTC). Vercel Hobby plan 호환 — 일 단위 이상으로만 스케줄 가능. 변경은 운영 영향 있으므로 배포 조율 필요.

### Supabase migrations
`tudal/supabase/migrations/` 10개 적용 (0001 RLS sketch → 0010 alert RLS hardening). DQ-7부터 도입된 컨벤션: 위험한 마이그레이션은 `NNNN_name.sql` + `NNNN_name.rollback.sql` 짝으로 작성 (예: `0009_dq7_credentials.{sql,rollback.sql}`). MCP `mcp__supabase__apply_migration`로 원격 적용.

### Admin credentials (DQ-7 보안 경계)
`tudal/src/lib/credentials/`가 per-admin API 키 보관소. **AES-256-GCM 암호화**로 KIS 증권·바이낸스 키를 Supabase에 저장 (commit `53b48f0` 검증 완료). 평문 키를 코드·로그·테스트 픽스처에 절대 남기지 않을 것.

### Components grouped by domain
`tudal/src/components/{stock,macro,layout,common,ui}`. `ui/`는 shadcn/ui(base-nova, Lucide). Path alias: `@/* → ./src/*`.

### Charts & constants
Recharts (캔들/라인/영역 + MA + 볼린저밴드). `tudal/src/lib/constants.ts` = 브랜드 문자열 + KRW formatters(조/억/만 인식). 3tier `PLANS` scaffolding은 S0에서 제거 완료.

### Deployment
Vercel 배포 활성 (`tudal/.vercel/`, `tudal/vercel.json`). 첫 배포는 DQ-7에서 수행. cron schedule·환경 변수 변경은 production 영향이 있으므로 사용자 확인 후에만.

## 제품 제약 (코드에 직접 반영)

BusinessPlan.md §7 법적 원칙 (어드민 트랙 적용):

1. **멤버 대상 buy/sell recommendations 금지** — 어드민 내부 도구에서는 AI가 Short List·비중·자동매매까지 처리 가능. 멤버 페이지(Deferred-D) 재개 시 "사세요/파세요" 어휘 금지 재적용.
2. **500-user cap + 초대 전용** — **어드민 트랙에 해당 없음** (본인+친구 3명 내부 도구). Deferred-D 멤버 오픈 시 적용.
3. **면책 문구 Footer 고정** — "정보 제공, 투자 자문 아님". 전 라우트 유지.
4. **Korean-first UI**, `<html lang="ko">`.
5. **자동매매 리스크 가드레일 (S8)** — 레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 ≤ 20회. Policy Engine에서 강제, `/admin/settings/risk`에서 조정.
6. **모의↔실 체결 토글** — 대표 1인만 전환 가능. 기본값은 모의(KIS 모의투자 / 바이낸스 테스트넷).

## 에이전트·스킬 선정 규칙

- **슬라이스 작업**은 `Document/Process/ExecutionPlaybook.md` §2 단계별 매핑(킥오프/설계/구현/실데이터/QA/클로즈)의 Primary·Secondary·Skill 그대로 사용. Uncertainty "중간" 이상은 사용자 재확인.
- Playbook 밖 예외 작업(문서 감사·리팩터·리서치 등)은 `~/.claude/skill-routing.md` + Skill Sources 표 참조해 **OMC·superpowers·PM·gstack·Korean Planning·frontend-design·commit-commands·claude-md-management** 등 전 소스를 검토한 뒤 제안.
- 병렬 디스패치는 `ExecutionPlaybook.md` §4 (슬라이스 내부만 병렬, 슬라이스 간 순차) 준수.
- **deepinit은 S0 Foundation에서만 1회** (`oh-my-claudecode:deepinit` 스킬). 이후 슬라이스에서는 `harness`만 사용 — 상세는 Playbook §3.
- **하네스 3종** (구현 하네스 = S0 / 디자인 하네스 = 각 슬라이스 설계 단계 신규 컴포넌트 다수 시 / 데이터 하네스 = S1 또는 S5 첫 실데이터 전환 슬라이스)은 `oh-my-claudecode:harness` 스킬로 호출. 상세 시점은 Playbook §3.
- **ScreenSpec 등 산출 스펙**은 슬라이스 내부 설계 단계에서 필요 시 `Document/Service/Build/`에 생성. 별도 Phase·Task 아님.
