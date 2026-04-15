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
| 2a | `Document/Service/Planning/ServicePlan-Admin.md` | **어드민 메인 서비스 기획 본체**. 사용자·JTBD, 화면 IA·라우트, 기능 스펙, 데이터 모델, 제약. 어드민(사용자 본인 1명) 전용. **서비스 기획 편집 1순위.** | Claude(product-manager) + User | 어드민 서비스 기획 확정·변경 시 |
| 2b | `Document/Service/Planning/ServicePlan-Member.md` | **멤버 페이지 기획 본체**. 멤버(500cap 초대) 전용. Research 보강 블로커 있음 (경쟁사 리서치 선행 필요). | Claude(product-manager) + User | 멤버 서비스 기획 확정·변경 시 |
| 3 | `Document/Process/Phase.md` | **Planning methodology** (Phase 0~6). 기획·리서치·전략·구조화·작성·검증·사양화. 각 Task의 에이전트·스킬 선정 근거. | Claude(meta) | Task 재구성·스킬 선정 변경 시만 |
| 4 | `Document/Process/BuildPhase.md` | **Build methodology** (Stage B1~B6). 디자인·인프라·구현·QA·배포·반복. 각 Task의 에이전트·스킬 선정 근거. | Claude(meta) | Stage 재구성·스킬 선정 변경 시만 |
| 5 | `Document/Process/HANDOFF.md` | **Session continuity + 작업 큐**. 🔴 다음 단계(우선순위) / 🟡 미결·보류 / 📝 최근 세션. 다음 에이전트가 이 파일만 읽어도 즉시 이어받을 수 있어야 함. | Claude | 모든 세션 종료 시 필수 갱신 |

### 보조 문서

| File | Purpose |
|---|---|
| `Document/Process/CodebaseStatus.md` | **현재 지향** 스냅샷. 라우트·파일 수·mock vs 실데이터·환경변수. 구조 변화 시 덮어쓴다. |
| `Document/Service/Report/ReportFramework.md` | AI 투심위 보고서 프레임워크 SoT (Section 0~8 + Appendix, Core Committee, Sector Board). |
| `Document/Service/Planning/AutoTrading.md` | 자동매매 트랙 설계 (미확정, 재검토 대기). |
| `Document/Process/Memo/*.md` | 세션별 메모·기준선 정리. 참조용. |

> **Folder convention**: `Document/Business/` (사업), `Document/Service/Planning/` (서비스 기획: ServicePlan 인덱스·Admin·Member·AutoTrading), `Document/Service/Report/` (AI 리포트 방법론: ReportFramework·ReaderCards), `Document/Service/Build/` (개발 스펙: FRD·Scenario·ScreenSpec — Phase 6 + BuildPhase B3.0 산출물), `Document/Process/` (방법론·세션·메모), `Document/Research/` (리서치 원자료), `Document/Outputs/` (생성 리포트·백테스트 산출물).

### Entry routine (매 세션 시작 시 자동 수행)

1. **Read in order**: `HANDOFF.md` → `ServicePlan.md`(인덱스) → `ServicePlan-Admin.md` → `ServicePlan-Member.md` → `BusinessPlan.md` → `Phase.md` → `BuildPhase.md` → `CodebaseStatus.md`
2. **Identify current work**: `HANDOFF.md` §"🔴 다음 단계"에서 **1순위 작업**을 찾는다. 어드민 기획이면 `ServicePlan-Admin.md`, 멤버 기획이면 `ServicePlan-Member.md`, Planning이면 `Phase.md`, Build이면 `BuildPhase.md`에서 상세 확인.
3. **Lookup agent/skill**: 해당 작업이 Planning이면 `Phase.md`, Build이면 `BuildPhase.md`에서 Primary 에이전트·스킬 + Uncertainty를 확인. 서비스 기획 작업은 `HANDOFF.md`에 명시된 방법론 사용.
4. **Announce**: "이번에 〈작업명〉을 〈에이전트/스킬〉로 진행합니다. Uncertainty: 〈낮/중/높〉"를 사용자에게 먼저 고지. "중간" 이상은 사용자 재확인을 요청.

### Update routing (무엇을 어디에 쓸 것인가)

| 변화 유형 | 기록 위치 |
|---|---|
| 사업 피벗, 재무 가정, 법적 원칙 변경 | `BusinessPlan.md` §"핵심 의사결정 기록" |
| 어드민 서비스 기획 확정 (IA / 기능 / 데이터 / UX) | `ServicePlan-Admin.md` 해당 섹션 |
| 멤버 서비스 기획 확정 (IA / 기능 / 데이터 / UX) | `ServicePlan-Member.md` 해당 섹션 |
| 어드민·멤버 공통 원칙 변경 (인증 분리, 디자인 시스템 등) | `ServicePlan.md` §3 |
| Task → 에이전트·스킬 매핑 변경 | `Phase.md` 또는 `BuildPhase.md` |
| 방법론 리파인 (Task 실행 시 깨달은 개선점) | `Phase.md` 또는 `BuildPhase.md` 해당 Task의 Execution Notes |
| 세션 종료 시 작업 큐 갱신 (다음에 할 일) | `HANDOFF.md` |
| 현재 코드베이스 스냅샷 (라우트·파일·환경변수) | `CodebaseStatus.md` |

**원칙**: BusinessPlan은 천천히 변한다. ServicePlan-Admin/Member는 기획 중 자주 변한다. ServicePlan.md(인덱스)는 공통 원칙 변경 시만. Phase.md/BuildPhase.md는 드물게 변한다. HANDOFF.md는 **미래 지향**(다음에 할 일)으로 매 세션 변한다. CodebaseStatus.md는 **현재 지향**(지금 있는 것)으로 구조 변화 시 덮어쓴다.

### Auto-recognition hints (파일 판정 규칙)

- `BusinessPlan` → 사업 레벨. 코드 변경 전에 먼저 참조. 서비스 UX/UI 내용 없음.
- `ServicePlan.md` (확장자만, sub-doc 아님) → **인덱스 + 공통 원칙**. 상세 기획은 여기 없다.
- `ServicePlan-Admin` → **어드민 서비스 기획 본체**. 서비스 기획 편집 1순위.
- `ServicePlan-Member` → **멤버 서비스 기획 본체**. Research 블로커 해소 후 착수.
- `Phase` → Planning 방법론. 에이전트·스킬 선정 임의 무시 금지.
- `BuildPhase` → Build 방법론. 에이전트·스킬 선정 임의 무시 금지.
- `HANDOFF.md` → 세션 시작 시 **가장 먼저** 읽는 파일. 세션 종료 전 **마지막으로** 갱신. 미래 지향.
- `CodebaseStatus.md` → 현재 지향 스냅샷. 세션 로그가 아님.

---

## Repository Layout

- `Document/` — 문서 기반 플래닝 시스템. 서브폴더: `Business/`, `Service/{Planning,Report,Build}/`, `Process/`, `Research/`, `Outputs/`.
- `CLAUDE.md` — 이 파일 (프로젝트 루트, Claude Code가 자동 로드)
- `tudal/` — the actual Next.js application. 디렉토리 이름은 리브랜드 전 잔재(`tudal/package.json` name은 `joopick`). **폴더명을 변경하지 말 것** — 하위 문서가 경로를 참조한다.
- `backtest/` — 백테스트 스크립트·결과물.

All engineering commands run from inside `tudal/`.

## Commands

```bash
cd tudal
npm run dev     # next dev (Turbopack)
npm run build   # next build — primary verification gate
npm run start   # next start
npm run lint    # eslint via eslint-config-next flat config
```

테스트 프레임워크 없음. 검증 게이트 = `npm run build` + `npm run lint`. 테스트 프레임워크 추가는 사용자 확인 후에만.

## Critical: Next.js 16 is not your training data

`tudal/AGENTS.md` (referenced by `tudal/CLAUDE.md` via `@AGENTS.md`) contains a hard warning:

> This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

Pinned version: `next@16.2.3`, `react@19.2.4`. 라우팅·미들웨어·서버 액션·메타데이터·`next/*` import 관련 코드를 쓰기 전 **반드시** `tudal/node_modules/next/dist/docs/` 또는 context7 MCP 조회.

## Architecture (big picture)

### App Router with route groups
`tudal/src/app/`는 두 라우트 그룹을 가진다 (`(auth)`: login/signup + 자체 layout / `(main)`: macro, pricing(legacy), stock/[ticker]). Root `app/page.tsx` 랜딩, `app/not-found.tsx` 404. 공통 `app/layout.tsx` (Header + Footer + Geist + `lang="ko"`).

### Middleware runs Supabase session refresh on every request
`tudal/middleware.ts`가 `@/lib/supabase/middleware`의 `updateSession`을 위임 호출. matcher는 정적 자원 제외 — 그 외 모든 요청이 Supabase SSR 코드를 탄다. Supabase 설치됨, `.env.local`은 BuildPhase B2.2에서 세팅 예정.

### Data layer is 100% mock
`tudal/src/lib/data/*.ts`가 유일한 데이터 소스. 타입은 `tudal/src/types/`. 실데이터 연결(KRX/한투/DART/pykrx)은 BuildPhase B3.2에서 수행.

### Components grouped by domain
`tudal/src/components/{stock,macro,layout,common,ui}`. `ui/`는 shadcn/ui(base-nova, Lucide). Path alias: `@/* → ./src/*`.

### Charts & constants
Recharts (캔들/라인/영역 + MA + 볼린저밴드). `tudal/src/lib/constants.ts` = 브랜드 문자열 + KRW formatters(조/억/만 인식).

### Pricing scaffolding is legacy
`constants.ts` 3tier `PLANS` + `(main)/pricing` 라우트는 **BuildPhase B3.1**에서 제거 대상. 확장 금지.

## 제품 제약 (코드에 직접 반영)

BusinessPlan.md §7 법적 원칙:

1. **No buy/sell recommendations.** AI 출력은 데이터·분석만. "사세요/파세요" 금지.
2. **500-user cap + 초대 전용.** 공개 가입·마케팅 퍼널 금지.
3. **면책 문구 Footer 고정** — "정보 제공, 투자 자문 아님".
4. **Korean-first UI**, `<html lang="ko">`.

## 에이전트·스킬 선정 규칙

- **Planning 단계 작업**은 `Phase.md`의 Primary 에이전트·스킬 그대로 사용. Uncertainty "중간" 이상은 사용자 재확인.
- **Build 단계 작업**은 `BuildPhase.md`의 Primary 에이전트·스킬 그대로 사용. Uncertainty "중간" 이상은 사용자 재확인.
- Phase/BuildPhase 밖 작업은 `~/.claude/skill-routing.md` + Skill Sources 표 참조해 **OMC·superpowers·PM·gstack·Korean Planning·frontend-design·commit-commands·claude-md-management** 등 전 소스를 검토한 뒤 제안.
- 병렬 디스패치는 Phase.md / BuildPhase.md §"병렬 디스패치 원칙" 준수.
- **deepinit은 BuildPhase B2.1에서만** (`oh-my-claudecode:deepinit` 스킬).
- **하네스 3종** (디자인 **P8.0** / 구현 B2.8 / 데이터 B2.9)은 `oh-my-claudecode:harness` 스킬로 각 단계 직전 구성. 기획 Phase는 Task별 에이전트/스킬이 상이하여 하네스 불필요.
- **ScreenSpec 작성은 BuildPhase B3.0** (기존 Phase 6.3에서 이동 — 디자인 시안 선행 필요).
