# S0 Foundation

> originally architect ID: S0 (`.omc/research/must-19-slice-mapping.md` §5 S0 블록)

---

```
slice_id: S0
slice_name: Foundation
architect_id: S0
status: ⚪ 대기
expected_sessions: 2
current_progress: 0%
```

---

## 목표 (Why)

모든 후속 슬라이스가 의존하는 인프라 토대를 구축한다. Supabase 연결·admin role 가드·디자인 토큰·legacy 제거가 없으면 S1 이후 모든 슬라이스의 인증·RLS·UI가 막힌다. 이 슬라이스가 완료되어야 비로소 기능 개발이 시작된다.

---

## 포함 요구사항

- **Must**: 없음 (선행 인프라 — 모든 Must의 전제 조건)
- **엔티티**: 없음 (스키마 초안 prepare만 — 실 마이그레이션은 각 슬라이스에서)
- **라우트**:
  - `app/(admin)/layout.tsx` 신규 생성 (admin 라우트 그룹)
  - `app/(main)/pricing` legacy 제거 (CLAUDE.md "Pricing scaffolding is legacy")
  - `middleware.ts` admin role 가드 확장
- **신규 엔티티**: 없음 (스키마 파일 stub만 준비)

---

## 선행 조건

- 없음 (최초 슬라이스)
- **단, BL-1·BL-2·BL-6 사용자 결정이 선행되어야 착수 가능**

---

## 외부 의존

| 의존 대상 | 용도 | 슬라이스 내 처리 |
|---|---|---|
| Supabase (프로젝트 키) | SSR 세션·RLS | `.env.local` 세팅 (BL-1 해소 후) |
| Next.js 16 middleware | admin role 가드 | `middleware.ts` 확장 |

---

## 킥오프 체크리스트 (착수 전 확인)

- [ ] BL-1 해소됨: Supabase 프로젝트 URL + anon key + service role key 확보
- [ ] BL-2 해소됨: admin role 방식 결정 (email allowlist vs role claim)
- [ ] CLAUDE.md Entry routine으로 ServicePlan-Admin.md v1.1 확인
- [ ] `tudal/` 디렉토리에서 `npm run build` 현재 상태 확인 (기존 코드 정상 여부)
- [ ] context7 MCP로 Next.js 16 middleware docs 사전 조회 (breaking changes 확인)
- [ ] context7 MCP로 Supabase SSR (@supabase/ssr) 최신 docs 사전 조회

---

## 실행 순서 (Execution Order)

```
Phase ① 클린업 (세션 1 전반)
  T0.1 Legacy 제거 ─────────────────── 직접 실행 (trivial)
    └─ [G-7] legacy 타입(SubscriptionTier 등)도 함께 정리
  T0.8 deepinit ─────────────────────── oh-my-claudecode:deepinit
    └─ T0.1 이후 실행 = clean 코드 기반으로 컨벤션 분석
    └─ [G-1] 상태 관리 방침 3줄 AGENTS.md에 박제
    └─ [G-2] 에러 핸들링·로딩 패턴 AGENTS.md에 박제

Phase ② 인프라 (세션 1 후반)
  T0.2 Supabase env ─────────────────── executor (sonnet) + context7
  T0.3 Admin role 가드 미들웨어 ──────── executor (opus) + context7
    └─ T0.2 선행 (env 없으면 Supabase import 에러)
  T0.4 RLS sketch ───────────────────── executor (sonnet)
    └─ T0.3 선행 (role 모델 확정 후 정책 작성)

Phase ③ UI + 구조 (세션 2, 병렬 가능)
  ┌─ T0.5 Admin layout ──────────────── executor (sonnet) + context7
  ├─ T0.6a 디자인 방향 결정 ─────────── 사용자 Q&A (45분, deep-interview 또는 직접)
  │   └─ [G-8] shadcn 커스텀 수준·아이콘셋·반응형 breakpoint도 함께 결정
  ├─ T0.6b 디자인 토큰 구현 ─────────── designer 에이전트 (T0.6a 결정 기반)
  └─ T0.7 Mock data 구조 ────────────── executor (sonnet)
    ↑ 3개 독립 → 병렬 디스패치 가능 (superpowers:dispatching-parallel-agents)

Phase ④ 검증·클로즈 (세션 2 마감)
  DoD 전수 체크 ──────────────────────── superpowers:verification-before-completion
  커밋 ───────────────────────────────── commit-commands:commit
  HANDOFF + ProgressDashboard 갱신 ──── 직접 실행
```

---

## Task별 에이전트·스킬 상세

### T0.1 Legacy 제거

| 항목 | 값 |
|---|---|
| **작업** | `app/(main)/pricing` 라우트·`PLANS` 상수·`subscription-gate.tsx`·`report-limit-banner.tsx` 삭제 + **[G-7]** `types/stock.ts`의 `SubscriptionTier`·`UserProfile.reportViewsRemaining` 등 legacy pricing 타입 정리 |
| **Primary** | 직접 실행 (trivial deletion) |
| **Skill** | 없음 |
| **Pre-check** | `npm run build` 현재 통과 확인 → 삭제 → `npm run build` 재확인 |
| **Rationale** | 3~5개 파일 삭제 + constants.ts PLANS 제거. 에이전트 오버헤드 불필요. |
| **기각 후보** | executor(과잉), autopilot(과잉), simplify(삭제가 리팩터 아님) |

### T0.8 deepinit (구현 하네스)

| 항목 | 값 |
|---|---|
| **작업** | repo 컨벤션·AGENTS.md 계층화·import alias·타입 규칙 박제 + **[G-1]** 상태 관리 방침(Server Components 우선 / 클라이언트=useState·useReducer / 공유=React Context, 라이브러리 추가 불필요) + **[G-2]** 에러 핸들링 패턴(`error.tsx`·`loading.tsx` 글로벌 + 컴포넌트 레벨 loading/error/empty 3상태 + Server Action 반환 `{success, error?}`) |
| **Primary** | `oh-my-claudecode:deepinit` (스킬) |
| **Timing** | T0.1 직후 (legacy 제거된 clean 코드 기반으로 분석) |
| **Rationale** | deepinit은 기존 코드를 분석해 컨벤션을 추출 → clean 상태에서 실행해야 legacy 패턴이 컨벤션으로 오인식되지 않음 |
| **기각 후보** | GSD `gsd:deepinit`(동일 기능이나 .planning/ 전제), superpowers:brainstorming(컨벤션 분석이 아님) |
| **주의** | S0에서 **1회만**. 이후 슬라이스에서 재실행 금지 (CLAUDE.md 규칙) |

### T0.2 Supabase env 세팅

| 항목 | 값 |
|---|---|
| **작업** | `.env.local` 템플릿 + `lib/supabase/{client,server,middleware}.ts` 동작 확인 |
| **Primary** | executor (sonnet) |
| **Skill** | context7 MCP — `@supabase/ssr` 최신 docs 조회 **필수** |
| **Pre-check** | BL-1 해소 확인 (Supabase 프로젝트 키 존재) |
| **Rationale** | 기존 `lib/supabase/` 파일 3개가 이미 있음. env만 채우고 동작 확인이 핵심. SDK 버전 차이 가능 → context7 필수. |
| **기각 후보** | document-specialist(리서치가 아니라 설정), designer(무관) |

### T0.3 Admin role 가드 미들웨어

| 항목 | 값 |
|---|---|
| **작업** | `middleware.ts`에 `/admin/*` 경로 role check 추가 |
| **Primary** | **executor (opus)** |
| **Skill** | context7 MCP — **Next.js 16 middleware docs 필수** (breaking changes 위험) |
| **Pre-check** | BL-2 결정 반영 (email allowlist vs role claim) |
| **Rationale** | Next.js 16 middleware는 학습 데이터와 다를 수 있음 (CLAUDE.md §Critical 경고). 단순 코드지만 **API 변경 리스크 때문에 opus**. context7로 현재 middleware API 확인 후 작성. |
| **기각 후보** | executor(sonnet) — 보통은 충분하나 Next.js 16 breaking change 리스크로 opus 승격, debugger(아직 버그 없음), superpowers:tdd(테스트 프레임워크 없음) |
| **검증** | `npm run build` + 브라우저에서 비인증 `/admin` 접근 → 리다이렉트 확인 |

### T0.4 RLS sketch

| 항목 | 값 |
|---|---|
| **작업** | E1~E9 테이블용 admin-only RW 정책 SQL 초안 (`tudal/supabase/migrations/0001_rls_sketch.sql`) |
| **Primary** | executor (sonnet) |
| **Skill** | context7 MCP — Supabase RLS 정책 문법 조회 |
| **Input** | ServicePlan-Admin.md §4.2 (8엔티티 + E9) + T0.3의 role 모델 |
| **Rationale** | SQL 정책 초안이므로 sonnet 충분. 실 마이그레이션은 각 슬라이스에서 실행 — 여기서는 sketch만. |
| **기각 후보** | architect(읽기 전용이라 SQL 작성 불가), document-specialist(SQL 작성이 아닌 문서 조회용) |
| **주의** | 이 파일은 S0에서 **실행하지 않음** (sketch only). S1 킥오프에서 E1만 실행, 이후 슬라이스별 추가. |

### T0.5 Admin layout

| 항목 | 값 |
|---|---|
| **작업** | `app/(admin)/layout.tsx` + Header stub + Footer(면책) + admin nav 뼈대 + 10 라우트 빈 페이지 생성 |
| **Primary** | executor (sonnet) |
| **Skill** | context7 MCP — Next.js 16 App Router layout API 조회 |
| **Input** | ServicePlan-Admin.md §2 (10 라우트 IA) |
| **Rationale** | 표준 Next.js layout + 빈 페이지 생성. 디자인 결정 최소 (면책 Footer 텍스트만). |
| **기각 후보** | designer(빈 페이지에 디자인 불필요), frontend-design(목업이 아님) |
| **병렬**: T0.6·T0.7과 독립 → 동시 실행 가능 |

### T0.6a 디자인 방향 결정 (신규)

| 항목 | 값 |
|---|---|
| **작업** | 레퍼런스 2~3개 합의 · 다크모드 여부 · 한국 증시 관례(빨강=상승·파랑=하락) 확인 · Voice/Tone 3줄 박제 · **[G-8]** shadcn 커스텀 수준(변수만 vs 컴포넌트 래핑) · 아이콘셋(Lucide 단독 vs 추가) · 반응형 breakpoint 1개 확정(<768px 단일 컬럼) |
| **Primary** | 사용자 Q&A (직접 대화) 또는 `oh-my-claudecode:deep-interview` |
| **Skill** | `deep-interview` — 모호한 디자인 선호를 구조화된 결정으로 수렴 |
| **산출물** | S0 의사결정 로그에 5~10줄 박제 (레퍼런스·다크모드·색상관례·Voice/Tone) |
| **소요** | 30분 |
| **Rationale** | 이 결정 없이 T0.6b 토큰을 만들면 임의 선택 → S1~S6 전체 UI 일관성 붕괴. P8 폐기 시 빠진 "디자인 원칙 결정" 역할을 S0 안에서 경량 수행. |
| **기각 후보** | superpowers:brainstorming(디자인 방향은 사용자 선호 의존, 창의 탐색 아님), frontend-design(결정이 선행되어야 목업 가능) |
| **선행**: 없음. Phase ③ 첫 번째. T0.6b·T0.5·T0.7보다 먼저 실행. |

### T0.6b 디자인 토큰 구현

| 항목 | 값 |
|---|---|
| **작업** | T0.6a 결정 기반으로 `globals.css` CSS 변수 — color 6종(primary·bg·text·border·success·danger)·typography 3단계·spacing 4단계. Tailwind v4 `@theme` 블록. |
| **Primary** | **designer** 에이전트 |
| **Skill** | `frontend-design:frontend-design`은 과잉 (목업 제작용). designer가 배색 조화 + CSS 변수 정의. |
| **Input** | T0.6a 결정(레퍼런스·다크모드·관례·Voice/Tone) + ServicePlan.md §3 (base-nova) |
| **Rationale** | T0.6a 근거가 있으므로 designer가 일관된 토큰을 생성 가능. 임의 선택 제거. |
| **기각 후보** | 직접 실행(T0.6a 결정이 있으면 designer가 더 나은 배색 생산), frontend-design(토큰 13개에 과잉) |
| **병렬**: T0.5·T0.7과 독립 → 동시 실행 가능 (T0.6a 완료 후) |

### T0.7 Mock data 구조

| 항목 | 값 |
|---|---|
| **작업** | `tudal/src/lib/data/mock-admin-*.ts` 파일 목록 + TypeScript export shape 정의 (빈 배열이라도 타입 확정) |
| **Primary** | executor (sonnet) |
| **Input** | ServicePlan-Admin.md §4.2 (E1~E9 엔티티 필드 정의) |
| **Rationale** | 엔티티 9개 × export interface 정의. 기존 `mock-stocks.ts` 등 패턴 참조. |
| **기각 후보** | architect(읽기 전용), product-manager(기획 완료) |
| **병렬**: T0.5·T0.6과 독립 → 동시 실행 가능 |

---

## 전소스 에이전트·스킬 비교 (S0 기준)

| Source | 후보 | S0 적합도 | 사용 Task | 비고 |
|---|---|---|---|---|
| **OMC** | `deepinit` | ★★★★★ | T0.8 | S0 전용. 1회만. |
| **OMC** | `harness` (디자인) | ★ | — | S0에 신규 컴포넌트 다수 아님. S1~에서 필요 시 |
| **OMC** | `harness` (데이터) | ★ | — | S0은 mock 구조만. S1 첫 Supabase 전환 시 |
| **OMC** | `autopilot` | ★★ | — | S0 Task 8개 규모에 과잉. 순차 실행이 안전 |
| **OMC** | `ultrawork` | ★★★ | Phase ③ 병렬 | T0.5∥T0.6∥T0.7에 유효. 단 3개뿐이라 직접 디스패치도 충분 |
| **OMC** | `ralph` | ★★ | — | S0은 검증 루프 필요 없을 정도로 단순 |
| **superpowers** | `brainstorming` | ★ | — | S0은 결정 완료. 창의적 탐색 불필요 |
| **superpowers** | `tdd` | ★ | — | 테스트 프레임워크 없음 (CLAUDE.md "검증 게이트 = build + lint") |
| **superpowers** | `executing-plans` | ★★★★ | 전체 | 이 문서 자체가 plan → 실행 시 이 스킬 활용 가능 |
| **superpowers** | `verification-before-completion` | ★★★★★ | Phase ④ | S0 DoD 클로즈 시 **필수** |
| **superpowers** | `dispatching-parallel-agents` | ★★★ | Phase ③ | T0.5∥T0.6∥T0.7 병렬 |
| **superpowers** | `writing-plans` | ★ | — | 이미 계획 작성 완료 (이 파일) |
| **GSD** | `gsd:*` 전체 | ★ | — | `.planning/` 디렉토리 전제. 본 프로젝트 미사용 |
| **gstack** | `/browse` | ★ | — | S0에 브라우저 QA 불필요 |
| **gstack** | `/qa` | ★ | — | S0 DoD는 build+lint만 |
| **frontend-design** | `frontend-design` | ★★ | — | 프로덕션 목업 스킬. 토큰 seed에는 과잉 |
| **commit-commands** | `commit` | ★★★★ | Phase ④ | 슬라이스 클로즈 커밋 |
| **claude-md-management** | `*` | ★ | — | S0과 무관 |
| **PM** | `*` | ★ | — | 기획 완료 |
| **context7 MCP** | docs lookup | ★★★★★ | T0.2·T0.3·T0.4·T0.5 | Next.js 16 + Supabase SSR **필수 조회** |

### 결론: S0 실행 모드 (전소스 비교 확정)

> 근거: `ExecutionPlaybook.md` §2.5 + `.omc/research/dev-workflow-comparison.md` (architect 7조합 비교)

**직접 실행 (순차 + Phase ③만 병렬)**이 최적.
- **ralph**: S0 Task는 전부 trivial (삭제·env·stub). prd.json 스토리 분해 오버헤드가 작업 자체보다 큼. **S1부터 기본 엔진**.
- **harness**: 30~40분 팀 구축 비용 vs S0의 trivial Task. S0에서 구축하면 비용 대비 재사용 0. **S1 킥오프에서 평가**.
- **autopilot**: "아이디어→코드" 파이프라인. 기획 완료 + 계획 존재 → Phase 0~1 불필요 오버헤드.
- **GSD**: `.planning/` 디렉토리가 `Document/Build/Slices/` 트래킹과 충돌. **채택 금지**.
- **team**: 8 Task이지만 전부 trivial이므로 팀 조율 오버헤드만 추가.
- Phase ③ 3개 병렬은 `superpowers:dispatching-parallel-agents` 또는 수동 Agent 3개 디스패치
- 검증은 `superpowers:verification-before-completion` 필수
- **context7 MCP가 S0에서 가장 중요한 도구** (Next.js 16 breaking changes)

### S1~S6 실행 엔진 참고 (ExecutionPlaybook §2.5)

| 슬라이스 | 엔진 | 이유 |
|---|---|---|
| S1 Short List 홈 | **ralph** | 4 Must, UI 복잡 (카드·스파크라인·Delta) |
| S2 풀 리포트 | 직접 + superpowers | 2 Must, 순차적 렌더링 작업 |
| S3 승인 | **ralph** | 1 Must이지만 D15 게이팅 4종 + race condition → 스토리 5~6개 |
| S4 성과 | **ralph** | 3 Must, EOD 배치 + Decision Tree |
| S5 스케줄러 | **team + ralph** | 7 Must + M18, 외부 API 4종, 가장 큰 슬라이스 |
| S6 Hardening | 직접 + superpowers | 2 Must, 비용 모니터 + 하트비트 |

---

## DoD (Definition of Done)

- [ ] `app/(main)/pricing` 라우트 접근 시 404 반환 (또는 리다이렉트)
- [ ] `constants.ts`에서 `PLANS` 관련 코드 0건
- [ ] `/admin` 경로: 비인증 접근 시 `/login`으로 리다이렉트
- [ ] `/admin` 경로: admin role 없는 인증 유저 접근 시 403/리다이렉트
- [ ] `app/(admin)/layout.tsx` 존재 + 면책 Footer 문구 포함
- [ ] 10 라우트 전부 빈 페이지로 200 응답
- [ ] T0.6a 디자인 방향 결정 박제됨 (레퍼런스·다크모드·색상관례·Voice/Tone, 의사결정 로그에 5줄+)
- [ ] `globals.css` CSS 변수 정의됨 (T0.6a 근거 기반, 최소 color 6 · font-size 3 · spacing 4)
- [ ] `mock-admin-*.ts` 파일 구조 확정 (빈 배열이라도 export shape + 타입 존재)
- [ ] `npm run build` 오류 0
- [ ] `npm run lint` 경고 0
- [ ] deepinit 실행 완료 (`tudal/AGENTS.md` 또는 하위 AGENTS.md 갱신 확인)

### DoD 검증 방법
- **`superpowers:verification-before-completion`** 스킬로 DoD 전수 체크
- 각 항목별 증거 수집 (build output, 파일 존재 확인, 브라우저 접근 테스트)
- 모든 항목 ✅ 후에만 `commit-commands:commit`으로 클로즈 커밋

---

## 블로커 / 사용자 결정 필요

- **BL-1** (High — S0 착수 전 필수): Supabase 프로젝트 키·URL·Anon Key 세팅 (S0 Foundation 인프라 단계) — ProgressDashboard §5 참조
- **BL-2** (High — S0 착수 전 필수): admin role 정의 방식 결정 — email allowlist (`ADMIN_EMAILS` env) vs Supabase user_metadata role claim 중 택 1
- **BL-6** (High — S0 착수 후 S5 진입 전까지 확정 필수. S0 시점엔 권장): `/admin/health` 라우트를 IA 11번째 독립 라우트로 승격할지 vs `/admin/settings/health` 서브라우트로 편입할지 결정 (S5 진입 전 IA 재협상 방지)

---

## 리스크

- **R-C** (architect): Supabase env + admin role 가드 미들웨어 누락 시 모든 후속 슬라이스의 인증·RLS 차단. T0.2·T0.3을 S0 1세션 내 완료 강제.
- **LR-S0-1**: Next.js 16 middleware API가 학습 데이터와 다를 수 있음 → context7 조회 없이 작성 시 build 실패 위험. **완화**: T0.3에서 context7 **필수** 선행.

---

## 의사결정 로그

- 2026-04-16: 슬라이스 파일 생성. BL-1·BL-2 해소 후 착수 예정.
- 2026-04-16: Task별 에이전트·스킬 상세 매핑 + 전소스 비교 보강. deepinit 순서 = T0.1 직후(clean code 기반).

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S0 블록 기반. deepinit 하네스 T0.8에 포함. |
| 2026-04-16 | critic I-03(BL-6 긴급도)·I-14(RLS 경로) 교정. |
| 2026-04-16 | **보강**: 실행 순서(4 Phase)·Task별 에이전트 상세(8건)·전소스 비교(15 소스)·킥오프 체크리스트·DoD 검증 방법 추가. |
| 2026-04-16 | **전소스 비교 확정**: architect 7조합 비교 결과 반영. S0=직접+superpowers 확정. ralph/harness/GSD/autopilot 기각 근거 박제. S1~S6 실행 엔진 참고표 추가. deepinit≠harness 명확화. |
