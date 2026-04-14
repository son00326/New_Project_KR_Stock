# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 📚 Document System (AUTO-RECOGNIZE)

This repository uses a **5-document planning system**, organized into subfolders under **`Document/`**. Each document has a distinct purpose. At session start, Claude MUST recognize all five and route updates to the correct one. **Never collapse them, never duplicate content across files, never write business decisions into HANDOFF.md or service progress into BusinessPlan.md.**

| # | File | Purpose | Who writes | Update trigger |
|---|---|---|---|---|
| 1 | `Document/Business/BusinessPlan.md` | **Business direction (frozen-ish)**. Q1~Q11 확정본, 3-Layer 구조, 재무, 법, 핵심 의사결정 기록. | User + Claude(planner/analyst/critic) | 사업 피벗·재무·법적 구조 변경 시 |
| 2 | `Document/Service/Planning/ServicePlan.md` | **Service plan + UNIFIED work tracker**. §0이 Phase+Build 두 방법론 문서의 모든 Task 상태를 하나로 관리. 확정 사항, 진행 트래커, Infrastructure, 본문 18 섹션. **편집 1순위.** | Claude(product-manager) + User | 서비스 결정, Task 상태 변화, Design System, 인프라 위치 확정 시 |
| 3 | `Document/Process/Phase.md` | **Planning methodology** (Phase 0~6). 기획·리서치·전략·구조화·작성·검증·사양화. 각 Task의 에이전트·스킬 선정 근거. | Claude(meta) | Task 재구성·스킬 선정 변경 시만 |
| 4 | `Document/Process/BuildPhase.md` | **Build methodology** (Stage B1~B6). 디자인·인프라·구현·QA·배포·반복. 각 Task의 에이전트·스킬 선정 근거. | Claude(meta) | Stage 재구성·스킬 선정 변경 시만 |
| 5 | `Document/Process/HANDOFF.md` | **Session continuity log**. 시도 / 성공 / 실패 / 다음 단계 4블록. 다음 에이전트가 이 파일 + ServicePlan §0만 읽어도 즉시 이어받을 수 있어야 함. | Claude | 모든 세션 종료 시 필수 갱신 |

> **Folder convention**: `Document/Business/` (사업), `Document/Service/Planning/` (서비스 본체 기획: ServicePlan·AutoTrading), `Document/Service/Report/` (AI 리포트 작성 방법론: ReportFramework·ReaderCards), `Document/Service/Build/` (개발 진행용 스펙: FRD·Scenario·ScreenSpec — Phase 6 + BuildPhase B3.0 산출물), `Document/Process/` (방법론·세션), `Document/Research/` (리서치 원자료), `Document/Outputs/` (생성 리포트·백테스트 산출물). 문서 내부에서 서로 참조할 때는 bare 이름(`Phase.md`)을 써도 되지만, 실제 읽을 때는 위 서브폴더 경로를 사용한다. CLAUDE.md와 `tudal/`, `backtest/`만 루트에 있다.

### Entry routine (매 세션 시작 시 자동 수행)

1. **Read in order**: `Document/Business/BusinessPlan.md` → `Document/Service/Planning/ServicePlan.md` → `Document/Process/Phase.md` → `Document/Process/BuildPhase.md` → `Document/Process/HANDOFF.md` → `Document/Process/CodebaseStatus.md`
2. **Identify current Task**: `Document/Service/Planning/ServicePlan.md` §0 통합 트래커에서 **첫 번째 미완료 체크박스**를 찾는다. Phase 또는 Build 어느 쪽인지 판별. 없으면 `Document/Process/HANDOFF.md` §"다음 단계"로 폴백.
3. **Lookup agent/skill**: 해당 Task가 Planning이면 `Document/Process/Phase.md`, Build이면 `Document/Process/BuildPhase.md`에서 Primary 에이전트·스킬 + Uncertainty를 확인.
4. **Announce**: "이번에 Task X.Y를 〈에이전트/스킬〉로 진행합니다. Uncertainty: 〈낮/중/높〉"를 사용자에게 먼저 고지. "중간" 이상은 사용자 재확인을 요청.

### Update routing (무엇을 어디에 쓸 것인가)

| 변화 유형 | 기록 위치 |
|---|---|
| 사업 피벗, 재무 가정, 법적 원칙 변경 | `BusinessPlan.md` §"핵심 의사결정 기록" |
| 서비스 기획 확정 (Vision / NSM / 가격 / IA / 기능 / Design System) | `ServicePlan.md` §1 확정 사항 + §3 본문 |
| Task 진행 상태 (Phase + Build 모두) | `ServicePlan.md` §0 통합 트래커 체크박스 |
| deepinit / 하네스 / 안정성 / 롤백 / 외부 의존성 | `ServicePlan.md` §2 Infrastructure & Stability |
| Task → 에이전트·스킬 매핑 변경 | `Phase.md` 또는 `BuildPhase.md` |
| 방법론 리파인 (Task 실행 시 깨달은 개선점) | `Phase.md` 또는 `BuildPhase.md` 해당 Task의 Execution Notes |
| 세션 종료 시 요약 (시도/성공/실패/다음) | `HANDOFF.md` |
| 현재 코드베이스 스냅샷 (라우트·파일·실데이터 연결·환경변수 상태) | `CodebaseStatus.md` |

**원칙**: BusinessPlan은 천천히 변한다. ServicePlan은 자주 변한다. Phase.md/BuildPhase.md는 드물게 변한다. HANDOFF.md는 **미래 지향**(다음에 할 일)으로 매 세션 변한다. CodebaseStatus.md는 **현재 지향**(지금 있는 것)으로 구조 변화 시 덮어쓴다.

### Auto-recognition hints (파일 판정 규칙)

- 파일명에 `Business`가 있으면 → 사업 레벨. 코드 변경 전에 먼저 참조.
- 파일명에 `Service`가 있으면 → 서비스 레벨 + **통합 트래커**. 편집·체크 대상 1순위.
- 파일명에 `Phase`가 있으면 → 방법론 문서. 변경 전 무결성 확인 필수. 여기 기록된 에이전트·스킬 선정을 임의 무시 금지.
- `HANDOFF.md` → 세션 종료 전 마지막으로 손대는 파일. **미래 지향** — "다음 세션에 할 일"만 적는다. 현재 상태 스냅샷·파일 개수·라우트 목록은 여기에 쓰지 않는다.
- `CodebaseStatus.md` → **현재 지향** 스냅샷. 라우트·TS 파일 수·mock vs 실데이터 연결·환경변수 세팅 여부. 구조 변화 시 덮어쓴다. 세션 로그가 아님.

---

## Repository Layout

- `Document/` — 5-문서 플래닝 시스템 + 리서치 + 산출물. 서브폴더: `Business/`, `Service/{Planning,Report,Build}/`, `Process/`, `Research/`, `Outputs/`.
- `CLAUDE.md` — 이 파일 (프로젝트 루트, Claude Code가 자동 로드)
- `tudal/` — the actual Next.js application. 디렉토리 이름은 리브랜드 전 잔재(`tudal/package.json` name은 `joopick`). **폴더명을 변경하지 말 것** — 하위 문서가 경로를 참조한다.

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
- **하네스 4종** (디자인 B1.0 / 구현 B2.8 / 데이터 B2.9 / 기획-선택)은 `oh-my-claudecode:harness` 스킬로 각 단계 직전 구성.
- **ScreenSpec 작성은 BuildPhase B3.0** (기존 Phase 6.3에서 이동 — 디자인 시안 선행 필요).
