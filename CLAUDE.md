# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
| `Document/Service/Planning/AutoTrading.md` | 자동매매 트랙 설계 (미확정, 재검토 대기). |
| `Document/Build/SliceTemplate.md` | 신규 슬라이스 파일 생성 시 참조 템플릿. |
| `Document/Build/Slices/Deferred-Brokerage.md` | Must 19 밖 증권사 API·매뉴얼 트레이딩 UI 로드맵 (Deferred-X). |
| `Document/Build/Slices/Deferred-AIAgent-Selection.md` | Must 19 밖 AI Agent 기반 선정엔진 v2 로드맵 (Deferred-Y, 2026-04-17 박제). v0(mock)→v1(pykrx+v6)→v2(AI agent) 진화 경로. |
| `Document/Service/Planning/AutoTrading-AI구조설계.md` | AutoTrading 파생 — AI 구조 설계 초안. 재검토 대기 (AutoTrading.md와 쌍). |
| `Document/Archive/` | 폐기된 방법론 문서 보관 (Phase.md·BuildPhase.md). 참조·편집 금지. |
| `Document/Process/Memo/*.md` | 세션별 메모·기준선 정리. 참조용. |

> **Folder convention**: `Document/Business/` (사업), `Document/Service/Planning/` (서비스 기획: ServicePlan 인덱스·Admin·Member·AutoTrading·AutoTrading-AI구조설계), `Document/Service/Report/` (AI 리포트 방법론: `ReportFramework.md` SoT + 초안 `ReportFramework-v3-*` 및 `ReportFramework-BioSector` + `ReaderAnalogyCards-ConstructionToBio`), `Document/Service/Build/` (슬라이스 산출 스펙: FRD·Scenario·ScreenSpec — 필요 시 슬라이스 내부에서 생성), `Document/Build/` (슬라이스 실행: `ProgressDashboard.md` + `Slices/S?-*.md` + `SliceTemplate.md`), `Document/Process/` (방법론·세션·메모 — `ExecutionPlaybook.md`가 중심), `Document/Archive/` (폐기된 방법론 문서 — 참조 금지), `Document/Research/` (리서치 원자료), `Document/Outputs/` (생성 리포트·백테스트 산출물).

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
- `ServicePlan-Admin` → **어드민 서비스 기획 본체**. 서비스 기획 편집 1순위. **핵심 개념 (D11)**: AI 가상 포트 본체 + 3경로 집행(주픽 매뉴얼·주픽 자동매매·외부 바이패스). 승인(Accept)=가상 포트 확정(성능 측정용), 실제 체결은 어드민 독립. 상세 §1A.0 SoT.
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
`tudal/middleware.ts`가 `@/lib/supabase/middleware`의 `updateSession`을 위임 호출. matcher는 정적 자원 제외 — 그 외 모든 요청이 Supabase SSR 코드를 탄다. Supabase 설치됨, `.env.local`은 **S0 Foundation**에서 세팅 예정.

### Data layer is 100% mock
`tudal/src/lib/data/*.ts`가 유일한 데이터 소스. 타입은 `tudal/src/types/`. 실데이터 연결(KRX/한투/DART/pykrx)은 **슬라이스별 실데이터 연결 단계**에서 수행 (S1 홈·S4 성과·S5 스케줄러 등).

### Components grouped by domain
`tudal/src/components/{stock,macro,layout,common,ui}`. `ui/`는 shadcn/ui(base-nova, Lucide). Path alias: `@/* → ./src/*`.

### Charts & constants
Recharts (캔들/라인/영역 + MA + 볼린저밴드). `tudal/src/lib/constants.ts` = 브랜드 문자열 + KRW formatters(조/억/만 인식).

### Pricing scaffolding is legacy
`constants.ts` 3tier `PLANS` + `(main)/pricing` 라우트는 **S0 Foundation**에서 제거 대상. 확장 금지.

## 제품 제약 (코드에 직접 반영)

BusinessPlan.md §7 법적 원칙:

1. **No buy/sell recommendations.** AI 출력은 데이터·분석만. "사세요/파세요" 금지.
2. **500-user cap + 초대 전용.** 공개 가입·마케팅 퍼널 금지.
3. **면책 문구 Footer 고정** — "정보 제공, 투자 자문 아님".
4. **Korean-first UI**, `<html lang="ko">`.

## 에이전트·스킬 선정 규칙

- **슬라이스 작업**은 `Document/Process/ExecutionPlaybook.md` §2 단계별 매핑(킥오프/설계/구현/실데이터/QA/클로즈)의 Primary·Secondary·Skill 그대로 사용. Uncertainty "중간" 이상은 사용자 재확인.
- Playbook 밖 예외 작업(문서 감사·리팩터·리서치 등)은 `~/.claude/skill-routing.md` + Skill Sources 표 참조해 **OMC·superpowers·PM·gstack·Korean Planning·frontend-design·commit-commands·claude-md-management** 등 전 소스를 검토한 뒤 제안.
- 병렬 디스패치는 `ExecutionPlaybook.md` §4 (슬라이스 내부만 병렬, 슬라이스 간 순차) 준수.
- **deepinit은 S0 Foundation에서만 1회** (`oh-my-claudecode:deepinit` 스킬). 이후 슬라이스에서는 `harness`만 사용 — 상세는 Playbook §3.
- **하네스 3종** (구현 하네스 = S0 / 디자인 하네스 = 각 슬라이스 설계 단계 신규 컴포넌트 다수 시 / 데이터 하네스 = S1 또는 S5 첫 실데이터 전환 슬라이스)은 `oh-my-claudecode:harness` 스킬로 호출. 상세 시점은 Playbook §3.
- **ScreenSpec 등 산출 스펙**은 슬라이스 내부 설계 단계에서 필요 시 `Document/Service/Build/`에 생성. 별도 Phase·Task 아님.
