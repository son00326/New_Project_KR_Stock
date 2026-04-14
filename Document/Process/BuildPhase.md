# BuildPhase.md — 주픽 실행 단계 방법론

Last updated: 2026-04-12
Purpose: Phase.md(기획 단계) 완료 후 **ServicePlan.md v1.0 + FRD + Scenarios 기반으로 실제 서비스를 구축·검증·배포**하는 단계별 방법론.
Scope: 디자인 시안 제작 → 인프라 세팅 → 코드 구현 → QA → 배포 → 반복.
각 Stage Task는 Phase.md와 **동일 포맷**: Primary / Alternatives / Rationale / Uncertainty / Output / Execution Notes(선택).

> 이 문서를 보는 법
> - **산출 라우팅 원칙**: 모든 결과는 ServicePlan.md §3 본문(영구) 또는 `tudal/` 실제 코드로 라우팅. 본 문서엔 **방법론만**.
> - **Phase.md와의 관계**: Phase.md는 기획 방법론, BuildPhase.md는 실행 방법론. 두 문서의 모든 Task 상태는 **ServicePlan.md §0 통합 트래커**에서 관리.
> - **진입 전제**: ServicePlan.md v1.0 확정, FRD.md 확정, Scenarios.md 확정.

---

## 🗺 Stage 맵 (한눈에)

```
[B1] Design Execution       → 디자인 하네스·시각 디자인·토큰·목업·Review
[B2] Pre-Implementation     → deepinit·구현/데이터 하네스·env·DB 스키마·초대 인증
[B3] Implementation         → ScreenSpec → 간소화 → 실데이터 → Must 기능 → Smoke
[B4] QA & Hardening         → QA 루프·보안·성능·접근성·리뷰·버그
[B5] Ship                   → Release·Deploy·Canary·문서 동기화
[B6] Iteration Loop (선택)   → 다음 기능 배치 반복 (retro 포함)
```

**진입 순서**: B1, B2 **병렬 착수 가능** → B3 (B1 + B2 완료 후) → B4 → B5 → (필요 시 B6)

---

## Stage B1 — Design Execution

목표: Phase 6 FRD/Scenarios를 **시각적 디자인 시안(Figma 또는 동등)**으로 풀어내기. 디자인 토큰·컴포넌트 오버라이드 계획·목업·Review까지.

### Task B1.0 — 주픽-디자인 하네스 구성
- **Primary**: `oh-my-claudecode:harness` 스킬
- **Rationale**: "전문 에이전트 + 전용 스킬 조합을 반복 자동화용으로 구성". B1 전체에서 재사용.
- **구성**: `designer` 에이전트 + `frontend-design:design-consultation/design-shotgun/frontend-design/design-review/visual-verdict/plan-design-review` 스킬 묶음 + 주픽 브랜드 규칙(빨간 상승 캔들 + 노란 스파클 + Korean-first UI + 면책 문구)
- **Uncertainty**: 낮음.
- **Output**: `.omc/harnesses/joopick-design.yaml`

### Task B1.1 — 디자인 원칙·Voice·Tone 정립
- **Primary**: `designer` 에이전트 + `frontend-design:design-consultation` 스킬
- **Rationale**: `design-consultation`은 "understands your product, researches the landscape, proposes a comp..." — 프로덕트 이해·경쟁 리서치·방향 제안 통합.
- **Alternatives**:
  - `designer` 에이전트 단독 — 경쟁 리서치는 이미 ServicePlan §3.4에 있어 경량 경로.
- **Uncertainty**: 낮음.
- **Output**: ServicePlan.md §3.18 Design System의 "Voice & Tone"

### Task B1.2 — 디자인 시스템 토큰 결정
- **Primary**: `designer` 에이전트
- **Rationale**: 컬러/타이포/스페이싱/쉐도우/라운드 토큰 정의. shadcn base-nova 위에 주픽 브랜드 적용.
- **Docs**: context7 MCP "tailwindcss v4" 스킴 — CSS 변수 기반 최신 토큰 패턴
- **Alternatives**:
  - `frontend-design:design-html` — Pretext HTML/CSS 생성. 토큰은 부산물.
- **Uncertainty**: 낮음.
- **Output**: `tudal/src/app/globals.css` 토큰 정의 + ServicePlan §3.18 기록

### Task B1.3 — shadcn base-nova 컴포넌트 오버라이드 계획
- **Primary**: `designer` 에이전트
- **Rationale**: `components.json` `style="base-nova"` 베이스에 Button/Card/Dialog/Tabs/Input 등의 브랜드 적용 오버라이드 포인트 식별.
- **Docs**: context7 MCP "shadcn" 스킴으로 최신 커스터마이징 패턴
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.18 "Component Overrides 리스트"

### Task B1.4 — 핵심 플로우 와이어프레임
- **Primary**: `frontend-design:design-shotgun` 스킬
- **Rationale**: "generate multiple AI design variants, open a comparison board, collect s..." — 다변형 생성 + 비교 보드. 초기 와이어프레임 이터레이션에 최적.
- **Alternatives**:
  - `designer` 에이전트 단독 — 단일안 수동.
  - `playground:playground` — 인터랙티브 HTML 탐색기 (경량).
- **Uncertainty**: **중간** — design-shotgun이 한국어 금융 UI에 적합한지 실행 직전 확인 필요.
- **Output**: `.omc/design/wireframes/` 또는 Figma 링크

### Task B1.5 — 고품질 목업 생성
- **Primary**: `frontend-design:frontend-design` 스킬
- **Rationale**: "Create distinctive, production-grade frontend interfaces with high design quality". B1.4 피드백 반영본.
- **Alternatives**:
  - `frontend-design:design-html` — 최종 HTML/CSS 출력. 구현에 더 가까움.
- **Uncertainty**: 낮음.
- **Output**: `.omc/design/mockups/` 또는 Figma 링크

### Task B1.6 — Design Review
- **Primary**: `frontend-design:design-review` 스킬
- **Rationale**: "Designer's eye QA: finds visual inconsistency, spacing issues, hierarchy problems, AI slop" — 디자인 소각 QA.
- **Alternatives**:
  - `frontend-design:plan-design-review` — 플랜 레벨 인터랙티브 검토.
  - `frontend-design:visual-verdict` — 구조화 verdict (목업 ↔ 기준 비교).
- **Uncertainty**: 낮음.
- **Output**: `.omc/design/review-report.md`

### Task B1.7 — 디자인 아카이브 저장
- **Primary**: 직접 Write (Figma 링크·파일 경로 기록)
- **Uncertainty**: 해당 없음.
- **Output**: ServicePlan §3.18 "Design Source" 항목

---

## Stage B2 — Pre-Implementation Setup

목표: 코드 변경 착수 전 **인프라·하네스·deepinit·스키마**를 모두 준비. **B1과 병렬 가능**.

### Task B2.1 — deepinit 수행 (tudal/ 루트)
- **Primary**: `oh-my-claudecode:deepinit` 스킬
- **Rationale**: "Deep codebase initialization with hierarchical AGENTS.md documentation". 실 코드 변경 전에 현 상태 스냅샷을 AGENTS.md로 고정해 재작업 비용 절감.
- **Alternatives**:
  - `oh-my-claudecode:deepsearch` — 탐색만 (스냅샷 생성 없음).
- **Uncertainty**: 낮음.
- **Output**: `tudal/AGENTS.md` 확장 + 하위 디렉토리별 AGENTS.md 자동 생성

### Task B2.2 — Supabase 프로젝트 + .env.local 세팅
- **Primary**: 사용자 직접 (Supabase 대시보드) + 직접 Edit (`tudal/.env.local`)
- **Docs**: context7 MCP "supabase ssr" 스킴 — 최신 SSR 클라이언트 패턴
- **Alternatives**:
  - `oh-my-claudecode:mcp-setup` — MCP 서버 세팅 (Supabase 직접 세팅은 별도).
- **Uncertainty**: 낮음.
- **Output**: `tudal/.env.local` (gitignore 유지), Supabase URL

### Task B2.3 — 한국투자증권 OpenAPI 계정·앱키
- **Primary**: 사용자 직접 발급 + `document-specialist` 에이전트 (API 문서 탐색)
- **Alternatives**:
  - `researcher` 에이전트 — 설명 거의 동일.
- **Uncertainty**: 낮음.
- **Output**: 앱키/앱시크릿을 서버 전용 env 저장

### Task B2.4 — DART OpenAPI 키 (공시 백업)
- **Primary**: 사용자 직접 발급
- **Uncertainty**: 낮음.
- **Output**: DART API key → env

### Task B2.5 — pykrx + Quant 런타임 인프라 구조 결정
- **Primary**: `architect` 에이전트 + `document-specialist` 에이전트 (pykrx 문서)
- **Rationale**: pykrx는 Python — Next.js 서버에서 직접 호출 불가. Python 사이드카 vs Supabase Edge Function 결정 필요.
- **Alternatives**:
  - `scientist` 에이전트 — 데이터 분석만.
- **Uncertainty**: **중간** — 사이드카 vs Edge Function은 운영비·복잡도 트레이드.
- **Output**: `.omc/research/pykrx-architecture.md`
- **스코프 확장 (2026-04-12)**: pykrx 단독이 아닌, 3축 Quant 시스템 전체 런타임 인프라를 함께 결정. 포함 대상: Quant Board 실행 인프라(리밸런싱 스케줄러 21/42/63일 주기), 팩터 계산 엔진(모멘텀·밸류·퀄리티·수급·저변동성), Early Warning 트리거(5개 선행지표 복합 점수), Crisis Layer 레짐 감지(Bull/Sideways/Bear). `backtest/full_system_backtest_v6.py`의 로직을 서비스 런타임으로 이식하는 방법도 이 Task에서 결정. Phase 1.8 리서치("무슨 데이터가 필요한가")의 결과를 입력으로 받아 "어떻게 전달할 것인가"를 확정.

### Task B2.6 — DB 스키마 설계 + 마이그레이션
- **Primary**: `architect` 에이전트 (opus)
- **Rationale**: "Strategic Architecture & Debugging Advisor (Opus, READ-ONLY)". users/trades/positions/judgments 4 테이블의 컬럼·인덱스·FK·RLS 정책 설계.
- **Docs**: context7 MCP "supabase migrations" 스킴
- **보조 검증**: `critic` 에이전트 — 스키마 취약점 2차 검토
- **Alternatives**:
  - `db-optimizer` 류 — 존재하지 않음, architect가 최선.
- **Uncertainty**: 낮음.
- **Output**: `tudal/supabase/migrations/*.sql` + ServicePlan §3.17 ERD 요약

### Task B2.7 — 초대 코드 인증 구조 결정
- **Primary**: `architect` 에이전트
- **보조 검증**: `security-reviewer` 에이전트 — 인증 플로우 위협 모델
- **Rationale**: 초대 코드 발급/상환/만료/취소 라이프사이클 + 500명 cap 강제 + Supabase Auth 연계.
- **Alternatives**:
  - `oh-my-claudecode:cso` 스킬 — 감사 가능하나 설계 주도권 없음.
- **Uncertainty**: **중간** — Supabase magic link + 초대 코드 검증 vs 별도 테이블.
- **Output**: ServicePlan §3.10 IA에 "Auth Flow" 서브섹션 + 마이그레이션 포함

### Task B2.8 — 주픽-구현 하네스 구성
- **Primary**: `oh-my-claudecode:harness` 스킬
- **구성**: `executor`(opus) + `code-reviewer` + `verifier` + tudal 컨벤션(Next.js 16 경고, 브랜드 규칙, legacy pricing 금지, 법적 제약 → BusinessPlan §7 참조) 강제 규칙
- **Uncertainty**: 낮음.
- **Output**: `.omc/harnesses/joopick-build.yaml`

### Task B2.9 — 주픽-데이터 하네스 구성
- **Primary**: `oh-my-claudecode:harness` 스킬
- **구성**: `document-specialist` + `scientist` + 한투 OpenAPI/DART/pykrx 문서 컨텍스트 프리셋 + 속도 제한·토큰 갱신 규칙
- **Uncertainty**: 낮음.
- **Output**: `.omc/harnesses/joopick-data.yaml`
- **컨텍스트 추가 (2026-04-12)**: `backtest/` Python 코드(특히 `backtest/full_system_backtest_v6.py`)를 하네스 참조 컨텍스트에 포함 — v6.1 시스템 구성(Early Warning 5개 선행지표, Crisis Layer 2단계, 3축 팩터 가중치, Quant Board 10명 투표 로직) 이해용. 서비스 런타임에서 동일 로직을 재구현할 때 참조 기준.

---

## Stage B3 — Implementation

목표: 실제 코드 변경. **B1 + B2 완료 후 진입**. 매 Task 후 `cd tudal && npm run build && npm run lint` 검증.

### Task B3.0 — ScreenSpec.pptx 작성 (기존 Phase 6.3에서 이동)
- **Primary**: `screen-spec-writer` 스킬 (Korean Planning 번들)
- **Rationale**: "Figma URL/스크린샷 + FRD → PPT 형식 화면 설계서". B1에서 확보한 Figma가 선행 조건이라 원래 Phase 6.3 위치보다 여기(B3.0)가 올바름.
- **전제**: B1 완료 (디자인 시안 확보) + FRD.md 확정 (Phase 6.1)
- **Uncertainty**: 낮음.
- **Output**: `ScreenSpec.pptx`

### Task B3.1 — 코드베이스 간소화 (legacy 제거)
- **Primary**: `oh-my-claudecode:ai-slop-cleaner` 스킬 + `code-simplifier` 에이전트
- **Rationale**: "Clean AI-generated code slop with a regression-safe, deletion-first workflow" — 삭제 우선 안전 워크플로. 대상: 3tier pricing, 초보 레벨 분석 `[TBD — 멤버 페이지 정의(ServicePlan §2) 후 결정]`, 구독 게이트, 공개형 login.
- **실행 엔진**: `/oh-my-claudecode:ralph` 또는 `/oh-my-claudecode:autopilot`
- **검증**: 삭제 단위마다 `npm run build && npm run lint`
- **커밋**: `commit-commands:commit` (1 Task = 1 commit 원칙)
- **Uncertainty**: 낮음.
- **Output**: tudal/ 코드 변경 + N개 커밋

### Task B3.2 — 실데이터 파이프라인 연결
- **Primary**: `executor` 에이전트 (opus) + **주픽-데이터 하네스(B2.9)**
- **Docs**: context7 MCP "한국투자증권 OpenAPI" / "DART opendart" / "pykrx"
- **실행 엔진**: `/oh-my-claudecode:ralph` (자가 루프, 검증 반복)
- **보조**: `superpowers:test-driven-development` — 테스트 러너 도입 시에만 (현재는 build/lint로 대체)
- **Uncertainty**: **중간** — 호출 빈도 제한·토큰 갱신 주기는 런타임 판단.
- **Output**: `tudal/src/lib/data/*` 실데이터 어댑터 + Supabase 캐시 레이어
- **데이터 소스 확대 (2026-04-12)**: 기존 "KRX/한투/DART/pykrx" 범위에 투심위 8-Section 보고서 데이터 소스 추가 — Earnings Model(한투 실적 API + DART 공시), Valuation(PER/PBR/EV 계산 엔진), Industry Fundamentals(산업 리서치 외부 API 또는 수동 입력), Macro Sensitivity(거시지표 API: 환율/금리/원자재), Catalyst Calendar(실적 발표·정책 일정 API), Risk Quantification(변동성·Beta·VaR 계산 엔진). Phase 1.7/1.8 리서치 결과에서 구체 API 매핑 확정.

### Tasks B3.3~B3.N — Must 기능 구현 (TBD — Phase 3.1 완료 후 세분화)
- **Primary**: 기능 수·독립성에 따라 분기 (skill-routing.md §Execution Engines)
  | 상황 | 스킬 |
  |---|---|
  | 단일 기능, 자가 검증 루프 | `/oh-my-claudecode:ralph` |
  | 4+ 독립 병렬 | `/oh-my-claudecode:ultrawork` |
  | 2~3 독립 병렬 | `superpowers:dispatching-parallel-agents` |
  | 단계별 체크포인트 | `superpowers:executing-plans` |
  | 아이디어→코드 전체 자동 | `/oh-my-claudecode:autopilot` |
  | N-agent 팀 협업 | `/oh-my-claudecode:team` |
- **기본 에이전트**: `executor` (opus) + **주픽-구현 하네스(B2.8)**
- **매 Task 후 검증**: `verifier` 에이전트 + `superpowers:verification-before-completion`
- **선행 조건**: Phase 3.1 Must 목록 확정 (ServicePlan §3.8)
- **Uncertainty**: **높음** — 런타임 분기.
- **Output**: 기능별 commit, ServicePlan §0 체크박스 업데이트
- **주의**: 이 블록은 Phase 3.1 완료 전까지 TBD 플레이스홀더. 완료 시 **1 Must 기능 = 1 Task**로 세분화해 여기 추가한다.
- **규모 예측 (2026-04-12)**: BusinessPlan §8~§9 기반 feature 후보 — 투심위(A1~A7: 7개), Quant(B1~B6: 6개), 매크로(C1~C2: 2개), 인증(D1~D4: 4개), 운용(E1~E3: 3개), 과금(F1: 1개) = 최대 23개. Phase 3.1 Must 분류 후 실제 Task 수 확정. Must가 10개 이상이면 `/oh-my-claudecode:ultrawork`(4+ 병렬) 또는 `/oh-my-claudecode:team`(N-agent) 우선 고려.

### Task B3.N+1 — Integration Smoke
- **Primary**: `/gstack:qa` 스킬
- **Alternatives**:
  - `/gstack:browse` — 헤드리스 브라우저 직접 조작.
  - `/gstack:qa-only` — 보고서만.
  - `qa-tester` 에이전트 — tmux 기반 인터랙티브.
- **Uncertainty**: 낮음.
- **Output**: `.omc/qa/smoke-report.md`

---

## Stage B4 — QA & Hardening

목표: v1 배포 후보 생성. 품질·보안·성능·접근성·리뷰 5축 병렬 검증 후 버그 수정.

### Task B4.1 — QA 루프
- **Primary**: `/oh-my-claudecode:ultraqa` 스킬 (QA 사이클 반복)
- **Alternatives**:
  - `/gstack:qa` — 1회 QA + 버그 수정.
  - `/gstack:qa-only` — 보고서만.
- **Uncertainty**: 낮음.
- **Output**: `.omc/qa/ultraqa-log.md`

### Task B4.2 — 보안 리뷰
- **Primary**: `/gstack:security-review` 스킬 + `security-reviewer` 에이전트
- **Alternatives**:
  - `/oh-my-claudecode:cso` — 인프라 중심.
- **범위**: OWASP Top 10 / 초대 코드 플로우 / Supabase RLS / 면책 문구 존재 확인 / AI 출력 "사세요/파세요" 탐지 / **투심위 컴플라이언스 검증** — Committee Votes 최종 의견이 "분석 의견"을 넘어 투자 권유로 해석될 수 있는 경계선 탐지, Bull/Base/Bear Target Price 표현이 "사세요/파세요" 원칙(BusinessPlan §7.2)을 위반하지 않는지 검증
- **Uncertainty**: 낮음.
- **Output**: `.omc/security/review.md`

### Task B4.3 — 성능 감사
- **Primary**: `performance-reviewer` 에이전트
- **Alternatives**:
  - `/gstack:benchmark` — 실측 벤치마크.
- **범위**: N+1 DB 호출, Next.js 번들 크기, 차트 렌더 비용, 한투 API 호출 캐싱
- **Uncertainty**: 낮음.
- **Output**: `.omc/perf/audit.md`

### Task B4.4 — 접근성 감사
- **Primary**: `ux-researcher` 에이전트 + `/gstack:browse` (키보드·스크린 리더 테스트)
- **범위**: WCAG AA, Korean 폰트 렌더링, 차트 alt text, 컬러 대비, 키보드 내비게이션
- **Uncertainty**: 낮음.
- **Output**: `.omc/a11y/audit.md`

### Task B4.5 — 코드 리뷰 (Pre-landing)
- **Primary**: `/gstack:review` 스킬 (skill-routing.md 기본값)
- **Alternatives**:
  - `code-reviewer` 에이전트 — 에이전트 직접.
  - `/gstack:codex` — Codex CLI 독립 크로스 체크.
  - `/oh-my-claudecode:ccg` — Claude+Codex+Gemini 3자 오케스트레이션 (고위험 변경 시).
- **Uncertainty**: 낮음.
- **Output**: `.omc/review/pre-land.md`

### Task B4.6 — 버그 수정 사이클
- **Primary**: `debugger` 에이전트 + `/gstack:investigate` 스킬
- **내부 프로세스**: `superpowers:systematic-debugging` (자동 적용)
- **Alternatives**:
  - `/oh-my-claudecode:ultraqa` — 자동 루프 (B4.1과 결합 가능).
- **Uncertainty**: 낮음.
- **Output**: 버그 수정 커밋 (commit-commands:commit)

---

## Stage B5 — Ship

목표: v1 프로덕션 배포 + 포스트-배포 모니터링.

### Task B5.1 — 릴리스 준비 + PR
- **Primary**: `/gstack:ship` 스킬 (공식 릴리스: 버전 bump + CHANGELOG + PR)
- **Alternatives**:
  - `commit-commands:commit-push-pr` — 간단 PR만.
  - `superpowers:finishing-a-development-branch` — 통합 방식 결정 보조.
- **Uncertainty**: 낮음.
- **Output**: GitHub PR URL

### Task B5.2 — 머지·CI·배포
- **Primary**: `/gstack:land-and-deploy` 스킬 (PR 머지 → CI 대기 → Vercel 배포 → 프로덕션 헬스체크)
- **사전 조건**: B5.1 PR 통과
- **Uncertainty**: 낮음.
- **Output**: Vercel production URL

### Task B5.3 — 포스트-배포 카나리 모니터링
- **Primary**: `/gstack:canary` 스킬 (console error, perf regression, uptime 감시)
- **Uncertainty**: 낮음.
- **Output**: `.omc/canary/post-deploy.md`

### Task B5.4 — 문서 동기화
- **Primary**: 직접 Write + `/gstack:document-release`(선택) + `claude-md-management:revise-claude-md`(세션 학습 반영)
- **Rationale**: 배포 후 ServicePlan §4 Revision History, HANDOFF.md, CLAUDE.md(학습 적용 필요 시)에 v1 출시 기록.
- **Uncertainty**: 낮음.
- **Output**: ServicePlan/HANDOFF/CLAUDE 동기 갱신

---

## Stage B6 — Iteration Loop (선택적)

### Task B6.1 — 스프린트/배치 Retro
- **Primary**: `/gstack:retro` (git history 기반 자동) 또는 `pm-execution:retro`
- **Uncertainty**: 낮음.
- **Output**: `.omc/retro/{date}.md`

### Task B6.2 — 다음 배치 우선순위 재조정
- **Primary**: `pm-product-discovery:prioritize-features` (재사용)
- **보조**: `pm-execution:sprint-plan` — 배치 단위 기획
- **Uncertainty**: 낮음.
- **Output**: ServicePlan §3.8 업데이트

### Task B6.3 — B3~B5 반복
- Stage B3로 복귀, 새 Must/Should 배치 진입. BuildPhase는 본질적으로 순환형 — v1 배포 이후는 B6 → B3 → B4 → B5 루프.

---

## 📌 소스별 사용 스킬 요약 (감사 체크리스트)

| 소스 | 사용 Task |
|---|---|
| **OMC 에이전트** | B1.1~B1.3(designer), B2.5/B2.6/B2.7(architect), B2.3(document-specialist), B2.6/B2.7 검증(critic, security-reviewer), B3.1(code-simplifier), B3.2/B3.3+(executor), B3.3+ 검증(verifier), B4.2(security-reviewer), B4.3(performance-reviewer), B4.4(ux-researcher), B4.5(code-reviewer), B4.6(debugger) |
| **OMC 스킬** | B1.0/B2.8/B2.9(harness), B2.1(deepinit), B3.1(ai-slop-cleaner), B3.1/B3.2/B3.3(ralph/autopilot/ultrawork/team), B4.1/B4.6(ultraqa), B4.2(cso 대안), B4.5(ccg 대안) |
| **superpowers** | B3.2(test-driven-development 조건부), B3.3(dispatching-parallel-agents, executing-plans), B3.3 검증(verification-before-completion), B4.6(systematic-debugging 내부), B5.1(finishing-a-development-branch) |
| **gstack** | B3.N+1(qa/browse), B4.1(qa/qa-only), B4.2(security-review), B4.3(benchmark), B4.4(browse), B4.5(review, codex), B4.6(investigate), B5.1(ship), B5.2(land-and-deploy), B5.3(canary), B5.4(document-release), B6.1(retro) |
| **frontend-design** | B1.1(design-consultation), B1.2(design-html 대안), B1.4(design-shotgun), B1.5(frontend-design, design-html), B1.6(design-review, plan-design-review, visual-verdict) |
| **Korean Planning** | B3.0(screen-spec-writer) |
| **PM** | B6.1(retro), B6.2(prioritize-features, sprint-plan) |
| **commit-commands** | B3.1+ 매 Task(commit), B5.1 대안(commit-push-pr) |
| **claude-md-management** | B5.4(revise-claude-md) |
| **playground** | B1.4 대안(playground) |
| **crypto-*** | 사용 안 함 — 주식 도메인 |
| **GSD** | 사용 안 함 — `.planning/` 미채택 |
| **skill-creator** | 사용 안 함 — 기존 스킬 충분 |

---

## 🚦 진입 조건 (Stage Gates)

| Stage | 진입 전제 | 종료 기준 |
|---|---|---|
| B1 | Phase.md 완료 (ServicePlan v1.0 + FRD + Scenarios) | 디자인 하네스 + 토큰 + 오버라이드 계획 + 목업 + Review pass |
| B2 | Phase.md 완료 (B1과 병렬 가능) | deepinit + env + 구현 하네스 + 데이터 하네스 + DB 스키마 + 초대 코드 구조 |
| B3 | B1 + B2 완료 | ScreenSpec + 간소화 + 실데이터 + 모든 Must 기능 + Smoke pass |
| B4 | B3 완료 | 5축(QA/보안/성능/a11y/리뷰) 리포트 + 버그 수정 완료 |
| B5 | B4 전 항목 pass | 프로덕션 deploy + canary pass + 문서 동기화 완료 |
| B6 | 새 기능 배치 요청 | B6.3가 B3 진입을 트리거 |

**BuildPhase 종료 = v1 프로덕션 배포 + 문서 동기화.**

---

## 🔁 병렬 디스패치 원칙

- **B1 + B2 병렬** (Phase.md 완료 후 동시 착수)
- **B1 내부**: B1.0 선행 → B1.1 → (B1.2 + B1.3 병렬) → B1.4 → B1.5 → B1.6 → B1.7
- **B2 내부**: B2.1 선행 → (B2.2~B2.7 병렬) → (B2.8 + B2.9 병렬)
- **B3 내부**: B3.0 → B3.1 → B3.2 순차, B3.3~B3.N은 ultrawork로 병렬 (Must 기능 독립성 확인 후)
- **B4 내부**: B4.1~B4.5 병렬(5개), B4.6은 결과 종합 후
- **B5 내부**: 순차 (B5.1 → B5.2 → B5.3 → B5.4)
- **B6 내부**: B6.1 → B6.2 순차 → B6.3는 B3 재진입

---

## 📍 현재 위치

- **완료**: (BuildPhase 착수 전 — Phase.md 완료 대기)
- **다음**: Phase.md Phase 0 Task 0.1 (BuildPhase 진입 전제)
- **블록**: Phase.md 미완료
