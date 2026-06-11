# ExecutionPlaybook — 주픽 어드민 슬라이스 기반 개발 방법론

> originally architect ID: 전체 슬라이스 방법론 통합 문서 (`.omc/research/must-19-slice-mapping.md` §5·§9 기반)

Status: **v1.1 · 2026-04-16**
선행: `Document/Archive/Phase.md` (기획 방법론, Archive 완료) · `Document/Archive/BuildPhase.md` (구 Waterfall Build, Archive 완료)

---

## §0 Philosophy

기획은 `ServicePlan-Admin.md` v1.1에서 완료. 디자인은 별도 Phase가 아니라 슬라이스 내부 도구.
개발은 **Feature-Slice 방식**: 한 슬라이스 = 디자인 · 구현 · QA 통합.

**핵심 원칙**:
- Waterfall(P0~P8 기획 완료 → B1~B6 순차 Build) 폐기
- 각 슬라이스는 독립된 수직 기능 덩어리 (UI + 로직 + 데이터 + 테스트)
- 슬라이스 간 의존성 방향은 단방향 (앞 슬라이스 완료 후 다음 슬라이스 시작)
- 슬라이스 내부 독립 Task는 병렬 실행 가능

---

## §1 Slice Lifecycle (5단계)

| 단계 | 명칭 | 주요 활동 | 산출물 |
|---|---|---|---|
| 1 | **킥오프** | 스펙 정렬 · 블로커 확인 · Tasks 확정 | 슬라이스 파일 Tasks 섹션 완성 |
| 2 | **설계** | 해당 화면 목업 · 컴포넌트 계약 (필요 시만) | ASCII 와이어프레임 또는 HTML 목업 |
| 3 | **구현** | 컴포넌트 · 라우트 · mock 우선 | `feat(S?):` 커밋 단위 |
| 4 | **실데이터 연결** | mock → Supabase/외부 API 슬라이스 단위 전환 | `feat(S?): connect real data` |
| 5 | **QA·클로즈** | DoD 전부 통과 · 커밋 · 다음 슬라이스 킥오프 준비 | DoD 체크리스트 완료 + HANDOFF 갱신 |

---

## §2 단계별 에이전트·스킬 매핑

| 단계 | 담당 | 도구/스킬 |
|---|---|---|
| 킥오프 | Claude 직접 (PM 역할) | `pm-execution:write-stories` (Must 대비 Tasks 분해 시) |
| 설계 | Claude 직접 (디자이너 역할) | `frontend-design:frontend-design`, gstack `/design-html`·`/design-review` |
| 구현 (복잡) | Claude 직접 (model=opus) | 필요 시 `feature-dev:code-architect`로 설계 후 구현 |
| 구현 (루틴) | Claude 직접 (model=sonnet) | — |
| 실데이터 연결 | Claude 직접 (context7 MCP 선행 조회) | context7 MCP (필수) |
| QA | `feature-dev:code-reviewer` 또는 `pr-review-toolkit:code-reviewer` | gstack `/qa`·`/review` |
| 클로즈 | Claude 직접 | `commit-commands:commit` |

> **SDK/API 코드 작성 전**: context7 MCP로 최신 문서 조회 필수. Next.js 16, Supabase SSR, 한투 API, Telegram Bot API 등.

위 표는 **기본 매핑**이며, 슬라이스 규모에 따라 §2.5의 실행 엔진이 작업을 감싼다.

---

## §2.5 슬라이스 실행 엔진 선택 (결정적 규칙)

> **2026-06-11 갱신**: OMC(oh-my-claudecode) 플러그인 제거로 `ralph`/`team`/`harness`/`deepinit`/`autopilot`/`ultrawork`(OMC 버전) 사용 불가. 아래는 현재 설치된 도구(`ralph-wiggum`, `superpowers-*`, `gstack`, `feature-dev`, `pm-skills`)로 재매핑한 실행 엔진. 2026-04-16 전소스 비교 분석(`dev-workflow-comparison.md`, 현재 미존재)의 "슬라이스 규모별 차등 엔진" 결론은 유지하고 도구만 교체.

### 결정적 규칙 (Task 수 기반)

| 슬라이스 Task 수 | 실행 엔진 | 래핑 방식 |
|---|---|---|
| **≤3 Tasks** | 직접 실행 + `superpowers-verification-before-completion` | 순차 수동 호출 |
| **4~6 Tasks** | **`ralph-wiggum:/ralph-loop`** | Must 항목 → prd.json stories. 완료 후 `feature-dev:code-reviewer`(또는 `pr-review-toolkit:code-reviewer`)로 검증. |
| **7+ Tasks** | **`superpowers-dispatching-parallel-agents` + `ralph-wiggum:/ralph-loop`** | 독립 그룹별로 병렬 디스패치 후, 그룹별 ralph-loop 실행. |

### 슬라이스별 예상 실행 엔진

| 슬라이스 | Task 수 | 엔진 | 비고 |
|---|---|---|---|
| S0 Foundation | 8 (단순) | **직접 + superpowers** | Task가 많지만 전부 trivial (삭제·env·stub). ralph-loop 오버헤드 불필요. |
| S1 Short List 홈 | 4 Must | **ralph-wiggum** | M1·M4·M5·M6 → prd.json stories. UI 복잡(카드·스파크라인·Delta). |
| S2 풀 리포트 | 2 Must | **직접 + superpowers** | M2·M3. Section 0~8 렌더링은 양이 많으나 순차적. |
| S3 승인 | 1 Must (복잡) | **ralph-wiggum** | M7 단일이지만 D15 게이팅 4종 + race condition → 스토리 5~6개 분해. |
| S4 성과 | 3 Must | **ralph-wiggum** | M8·M9·M16. EOD 배치 + Decision Tree 차트. |
| S5 스케줄러·알림 | 7 Must + M18 | **superpowers-dispatching-parallel-agents + ralph-wiggum** | S5a(M10·M11·M12·M18) + S5b(M13·M14·M15) 분할. 가장 큰 슬라이스. |
| S6 Hardening | 2 Must | **직접 + superpowers** | M17·M19. 비용 모니터 + 하트비트. |

### 기각된 도구·조합 (2026-04-16 전소스 비교 결과 — 역사적 기록)

> 아래 GSD·harness·ultrawork·autopilot·OMC ralph/team은 2026-06-11 기준 모두 미설치. 당시 기각 사유는 "왜 멀티 오케스트레이션 도구를 도입하지 않았는지" 결정 기록으로만 보존.

| 도구 | 기각 이유 |
|---|---|
| **GSD** (`gsd:*`) | `.planning/` 디렉토리가 기존 `Document/Build/Slices/` 트래킹 시스템과 충돌. 문서 이중화. |
| **autopilot** | "아이디어→코드" 파이프라인. 기획 완료 + 계획 존재 시 Phase 0~1이 불필요 오버헤드. |
| **harness 단독** (S0) | 30~40분 팀 구축 비용 vs S0의 trivial 8 Task. 비용 대비 효과 0. |
| **ultrawork 단독** | 병렬 실행 컴포넌트일 뿐 세션 간 상태 추적 없음. ralph 내부에서 자동 래핑됨. |
| **GSD + harness** | 두 오케스트레이션 시스템이 경쟁. 상호운용 프로토콜 없음. |

### 서브에이전트 팀 구성 평가 시점 (구 "harness", S0에서 구축 아님!)

> **중요**: deepinit(§3, repo 컨벤션 분석)과 "서브에이전트 팀 구성"은 별개 개념. 전자는 `AGENTS.md` 생성, 후자는 역할별 서브에이전트 팀 구성.

| 시점 | 평가 기준 | 조건부 실행 |
|---|---|---|
| **S1 킥오프** (디자인 팀 구성) | S0의 `tudal/AGENTS.md` + 표준 직접 구현으로 UI 품질 충분한가? | 불충분 시 → `superpowers-subagent-driven-development`로 designer·UI-builder 역할 서브에이전트 팀 구성 |
| **S5 킥오프** (데이터 통합 팀 구성) | 외부 API 4종(텔레그램·이메일·SMS·뉴스) 통합이 표준 직접 구현으로 감당 가능한가? | 불충분 시 → `superpowers-subagent-driven-development`로 api-integrator·pipeline-builder 역할 서브에이전트 팀 구성 |

서브에이전트 팀이 필요하면 `superpowers-subagent-driven-development` 가이드에 따라 역할을 정의하고, 재사용이 필요할 경우 `.claude/agents/`에 에이전트 정의 파일로 직접 등록한다 (CLAUDE.md에 등록 사실 기록). 등록 시 **이후 모든 세션에서 자동 활성화**되므로 한번 만들면 S1~S6 전체에서 재사용 가능.

---

## §3 deepinit (repo 컨벤션 설정)

| 항목 | 값 |
|---|---|
| **호출 시점** | S0 Phase 0.5 (legacy 제거 직후, 구현 전) |
| **방법** | (2026-06-11 갱신) `oh-my-claudecode:deepinit` 스킬 제거됨 — Claude가 직접 `tudal/` 코드베이스(컴포넌트 패턴·import alias·타입·린트 규칙)를 분석해 `tudal/AGENTS.md`(필요 시 하위 디렉토리별 AGENTS.md)를 작성/갱신 |
| **하는 일** | 기존 코드 분석 → repo 컨벤션 추출 → `AGENTS.md` 계층 생성 → import alias·타입·린트 규칙 박제 |
| **1회만** | S0에서 1회. 이후 슬라이스에서 재실행 금지(컨벤션 변경 시에만 갱신). |

> **deepinit ≠ 서브에이전트 팀 구성(§2.5)**. deepinit은 "코드를 분석해 규칙을 뽑는" 작업. 서브에이전트 팀 구성은 "전문 에이전트 팀을 만드는" 작업. 혼동 금지.

---

## §3.5 슬라이스 킥오프 전 체크리스트 (매 슬라이스 공통)

각 슬라이스 착수 전 아래를 확인. Slice 파일에 "킥오프 체크리스트" 섹션으로 구체화.

1. **블로커 해소 확인** — 해당 Slice 파일의 블로커 전원 해소 (또는 우회안 확정)
2. **선행 슬라이스 DoD 통과 확인** — ProgressDashboard에서 선행 슬라이스 ✅ 확인
3. **SoT 재정렬** — ServicePlan-Admin.md 해당 §3 Must R번호 + AC + DoD 정독
4. **context7 사전 조회** — 해당 슬라이스에서 쓸 SDK/API docs 선행 조회 (Next.js 16·Supabase·외부 API)
5. **에이전트·스킬 확인** — 해당 Slice 파일의 "Task별 에이전트·스킬 상세" 섹션 참조. 없으면 킥오프 시 작성.
6. **실행 엔진 결정** — §2.5 결정적 규칙 따름:
   - ≤3 Tasks (또는 전부 trivial): **직접 + `superpowers-verification-before-completion`**
   - 4~6 Tasks: **`ralph-wiggum:/ralph-loop`** (Must → prd.json stories)
   - 7+ Tasks: **`superpowers-dispatching-parallel-agents` + `ralph-wiggum:/ralph-loop`**
   - 서브에이전트 팀 구성 평가: S1·S5 킥오프에서만 (§2.5 참조)
7. **`npm run build` 현재 통과 확인** — 깨진 상태에서 시작 금지

---

## §4 병렬 디스패치 원칙

- 슬라이스 **내부** 독립 Task 2+개 → 병렬 실행 가능
  - 예: S1의 "Delta 뷰 컴포넌트"와 "3줄 근거 팝오버"는 독립 → 병렬
- 슬라이스 **간**은 순차 (의존성 방향 강제)
  - 예: S2(풀 리포트)는 S1(홈) 완료 후에만 시작
- **예외**: S5 내부 S5a·S5b는 분할 후 순차 실행

---

## §5 슬라이스 정의 (축약)

상세 정의는 `Document/Build/ProgressDashboard.md` + `Document/Build/Slices/*.md` 참조.

| 순서 | 슬라이스 | Must | 세션 |
|---|---|---|---|
| 1 | S0 Foundation | 없음 | 2 |
| 2 | S1 Short List 30 홈 | M1·M4·M5·M6 | 4 |
| 3 | S2 풀 리포트·투심위 | M2·M3 | 3 |
| 4 | S3 승인 워크플로우 | M7 | 4 |
| 5 | S4 성과·Decision Tree | M8·M9·M16 | 4 |
| 6 | S5 스케줄러·알림·자동화 | M10·M11·M12·M13·M14·M15·M18 | 5 |
| 7 | S6 Hardening | M17·M19 | 3 |

총 25세션. `Deferred-X`(증권사 API·매뉴얼 트레이딩 UI)는 Must 19 밖 별도 로드맵.

---

## §6 Slice 상태 전이

```
⚪ 대기
  → (킥오프 완료)
🟢 진행 중
  → (DoD 전부 통과 + 커밋)
✅ 완료
  → [아카이브]

⏸ 보류 = 블로커 대기 (언제든 재활성 가능)
```

---

## §7 커밋·PR 프로토콜

- **Task 단위 커밋**: 슬라이스 내부 Task 완료 시마다 커밋 (atomic)
- **커밋 prefix**:
  - `feat(S{N}):` — 신규 기능
  - `fix(S{N}):` — 버그 수정
  - `refactor(S{N}):` — 리팩터링
  - `docs(S{N}):` — 문서 변경
- **슬라이스 클로즈 시점 동시 갱신**:
  1. `ProgressDashboard.md` — 슬라이스 상태 ✅ + Must 진행률 업데이트
  2. 해당 Slice 파일 — status ✅ + current_progress 100%
  3. `HANDOFF.md` — 다음 슬라이스 포인터

---

## §8 문서 갱신 라우팅

| 트리거 | 갱신 위치 |
|---|---|
| Task 진척 | 해당 Slice 파일 체크리스트 |
| 슬라이스 상태 변경 | ProgressDashboard.md 표 + 해당 Slice 파일 status 필드 |
| 블로커 해소 | Slice 파일 "의사결정 로그" + ProgressDashboard §5 Global Blocker |
| 세션 종료 | HANDOFF.md (다음 세션 포인터만) |
| 에이전트·스킬 매핑 개선 | 본 Playbook §2 |
| 코드베이스 구조 변화 | CodebaseStatus.md (현재 지향 스냅샷) |

---

## §9 초기 계획 대비 변경 이력

| 날짜 | 버전 | 내용 |
|---|---|---|
| 2026-04-16 | v1.0 | Waterfall(P0~P8 기획 → B1~B6 Build) 폐기, 슬라이스 방식 채택. architect audit(`.omc/research/must-19-slice-mapping.md`) 결과 반영. S3(집행 3경로) Must 19 밖 이관. Must 번호 재할당 (M1=홈, M4=분석엔진, M5=Delta, M6=3줄 카드, M7=승인). M18을 S7에서 S5와 동시로 앞당김. 총 25세션. |
| 2026-04-16 | v1.1 | **전소스 실행 엔진 비교 분석** 반영 (architect `dev-workflow-comparison.md`). §2.5 신설 — Task 수 기반 결정적 규칙(≤3 직접/4~6 ralph/7+ team+ralph). §3 deepinit≠harness 명확화. 하네스는 S1·S5 킥오프에서 조건부 평가(S0 구축 아님). GSD·autopilot·harness 단독 기각 근거 박제. 슬라이스별 예상 실행 엔진 표 추가. |
| 2026-06-11 | v1.2 | **OMC(oh-my-claudecode) 플러그인 제거에 따른 도구 재매핑**. `ralph`→`ralph-wiggum:/ralph-loop`, `team`/`ultrawork`→`superpowers-dispatching-parallel-agents`, `harness`→`superpowers-subagent-driven-development`(서브에이전트 팀 구성), `deepinit`→Claude 직접 분석 + `tudal/AGENTS.md` 작성. §2 에이전트 페르소나(executor/verifier/designer/product-manager 등)를 실제 설치된 도구(feature-dev:code-architect/code-reviewer, pr-review-toolkit:code-reviewer, gstack, pm-skills, frontend-design)로 교체. §2.5 기각 도구 표는 역사적 기록으로 보존(현재 모두 미설치). |

> **참고 (2026-06-11)**: 본 프로젝트의 여러 문서(`BusinessPlan.md`, `ProgressDashboard.md`, `Slices/S?-*.md`, `ServicePlan-Admin.md`, `Process/Memo/*.md` 등)가 `.omc/research/*.md`, `.omc/design/*.md` 경로의 "원자료"를 인용하지만, 이 파일들은 OMC 작업 디렉토리(`.omc/research/`, `.omc/design/`)에 실제로 생성된 적이 없다 — OMC 제거 이전부터 존재한 dead link다. 인용된 분석 결론은 각 인용처의 본문(표·요약)에 이미 반영되어 있으므로 정보 손실은 없으며, 경로 자체는 역사적 출처 표기로만 보존한다 (개별 수정 불필요).
