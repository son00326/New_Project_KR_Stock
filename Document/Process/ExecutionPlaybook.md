# ExecutionPlaybook — 주픽 어드민 슬라이스 기반 개발 방법론

> originally architect ID: 전체 슬라이스 방법론 통합 문서 (`.omc/research/must-19-slice-mapping.md` §5·§9 기반)

Status: **v1.0 · 2026-04-16**
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

| 단계 | Primary | Secondary | Skill |
|---|---|---|---|
| 킥오프 | product-manager | — | `pm-execution:write-stories` (Must 대비 Tasks 분해 시) |
| 설계 | designer | — | `frontend-design:frontend-design` |
| 구현 (복잡) | executor (opus) | — | — |
| 구현 (루틴) | executor (sonnet) | — | — |
| 실데이터 연결 | document-specialist (SDK 조회) | executor | context7 MCP (필수) |
| QA | verifier | code-reviewer | — |
| 클로즈 | writer | — | `commit-commands:commit` |

> **SDK/API 코드 작성 전**: context7 MCP로 최신 문서 조회 필수. Next.js 16, Supabase SSR, 한투 API, Telegram Bot API 등.

---

## §3 하네스 3종 호출 시점

| 하네스 | 호출 시점 | 스킬 |
|---|---|---|
| **구현 하네스** | S0에서 1회 (repo 초기화 + 컨벤션 박제) | `oh-my-claudecode:deepinit` |
| **디자인 하네스** | 각 슬라이스 설계 단계 진입 시 (신규 컴포넌트 다수 발생 시만) | `oh-my-claudecode:harness` |
| **데이터 하네스** | S1 (mock → Supabase 첫 전환) + S5 (Supabase → 외부 API 첫 전환) 각 1회 | `oh-my-claudecode:harness` |

> `deepinit`은 S0에서 1회만. 이후 슬라이스에서는 harness만.

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
