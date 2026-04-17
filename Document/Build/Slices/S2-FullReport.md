# S2 풀 리포트 + 투심위

> originally architect ID: S5 (`.omc/research/must-19-slice-mapping.md` §5 S5 블록 — **초안 S5를 앞당김**)

---

```
slice_id: S2
slice_name: 풀 리포트 + 투심위
architect_id: S5
status: 🟢 진행 가능 (2026-04-17 — BL-4·BL-5·G-5·G-11 4건 해소 완료)
expected_sessions: 3
current_progress: 0%
```

---

## 목표 (Why)

어드민이 종목별 풀 리포트(Section 0~8)와 투심위 패널을 열람한다. **이 슬라이스가 S3(승인) 앞에 반드시 선행**되어야 하는 이유: M7(D15) 2인 게이팅은 `report_view_log` 테이블의 `DISTINCT admin_id` 집계가 ≥2인지 확인하는 로직에 의존한다. `report.view` 로그 파이프가 없으면 S3 승인 워크플로우의 핵심 게이팅이 성립하지 않는다 (architect R-B Critical).

---

## 포함 요구사항

- **Must**: M2 (풀 리포트 렌더링), M3 (투심위 투표 요약 패널)
- **엔티티**:
  - E2 StockReport (R) · E3 CommitteeVote (R)
  - **신규 E10 ReportViewLog (W)** — append-only 열람 로그. 컬럼: `id` / `admin_id` / `report_id` / `view_date` (DATE) / `viewed_at` (TIMESTAMPTZ). UNIQUE(admin_id, report_id, view_date)로 1일 1회 dedupe. S3 M7은 `SELECT COUNT(DISTINCT admin_id) FROM report_view_log WHERE report_id = ?`로 2인 게이팅 판정.
  - E4 PortfolioApproval은 **본 슬라이스에서 건드리지 않음** ([G-11] B 결정으로 독립)
- **라우트**: `/admin/report/[ticker]`
- **근거**: ServicePlan-Admin.md §3.7 R3.7-1~8

---

## 선행 조건

- **S1 완료** ✅ (2026-04-17): 종목 카드의 "풀 리포트" 링크가 이 라우트로 연결되므로 S1 완료 후 실제 내비게이션 가능
- **`report_view_log` 파이프**: S2 완료 시점에 E10 INSERT 훅이 반드시 작동해야 함 — S3 게이팅 선행 조건

---

## 외부 의존

| 의존 대상 | 용도 | 슬라이스 내 처리 |
|---|---|---|
| ReportFramework.md Section 0~8 정의 | 리포트 섹션 구조 | `Document/Service/Report/ReportFramework.md` 참조 |
| E2 StockReport mock 원고 | 8개 섹션 내용 | **BL-4 B**: T2.1 내부 AI codegen 인라인. 대표 3~5종(005930·000660·012450·196170·373220 가령)만 Section 0~8 상세 작성, 나머지 27종은 템플릿 반복 + 점수/티커만 치환 |
| E3 CommitteeVote mock | 투심위 투표 집계 | Core 11명 + Sector Board. 대표 3~5종만 고유 논거, 나머지는 집계표만 |

---

## Tasks (체크리스트)

- [ ] **T2.1** E2 StockReport + E3 CommitteeVote + **E10 ReportViewLog** Supabase 스키마 생성 + mock fixture. E2는 대표 3~5종 Section 0~8 상세 · 나머지 27종 템플릿 반복 (BL-4 B). E10은 UNIQUE(admin_id, report_id, view_date) + RLS(admin-only INSERT/SELECT).
- [ ] **T2.2** `/admin/report/[ticker]` 페이지 — Sticky Side Nav + 단일 스크롤 레이아웃
- [ ] **T2.3** Section 0~8 렌더러 — accordion (Section 0 펼침 디폴트), 각 섹션 컨텐츠 컴포넌트
- [ ] **T2.4** `report_view_log` INSERT 파이프 — 페이지 진입 Server Action 또는 route handler에서 upsert(onConflict `(admin_id, report_id, view_date)` do nothing). mock 단계에서는 console.log + in-memory Set 대체 가능하나 Supabase 마이그레이션 준비된 schema만 확정.
- [ ] **T2.5** 이전/다음 종목 내비 (버킷 내 순서)
- [ ] **T2.6** Section 8 투심위 패널 — Core 11명 + Sector Board 집계 표 + 핵심 논거 3~5건 표시
- [ ] **T2.7** Section 6 M4 분석엔진 출력 인터랙티브 차트 (MVP 최소 Recharts — S1 카드 컴포넌트 재사용)

---

## DoD (Definition of Done)

- [ ] `/admin/report/[ticker]` 접근 시 Section 0~8 전부 렌더링, 오류 없음
- [ ] Sticky Side Nav: 스크롤 시 고정, 클릭 시 해당 섹션으로 스크롤
- [ ] 페이지 진입 시 `report_view_log` INSERT (또는 mock 로그) 확인 + UNIQUE 제약으로 동일 어드민·동일 리포트 하루 내 재진입 시 에러 없이 no-op 동작
- [ ] Section 8: Core 11명 투표 집계 + Sector Board 표시 + 논거 최소 3건
- [ ] "← Short List" 복귀 링크 동작 (스크롤 위치 복원)
- [ ] `npm run build` 오류 0, `npm run lint` 경고 0
- [ ] 커밋: `feat(S2): 풀 리포트 렌더링 + 투심위 패널 — M2·M3 + report_view_log 파이프`

---

## 블로커 / 사용자 결정 필요

- ~~**BL-4**~~ ✅ 해소 (2026-04-17) — **옵션 B 채택**: T2.1 내부 AI codegen 인라인. 대표 3~5종 상세 작성, 나머지 27종 템플릿 반복. 이유: mock 목적은 Section 0~8 구조·UI 검증이지 최종 품질 아님. 실제 품질은 S5 M10 실데이터 + AI 엔진 연결 시 해결.
- ~~**BL-5**~~ ✅ 해소 (2026-04-17) — **옵션 B 채택**: `report_view_log`에 `admin_id + report_id + view_date` UNIQUE 제약으로 1일 1회 write. 이유: A(진입마다 write)는 로그 폭주, C(영구 1회)는 재열람 신호 손실. B는 날짜별 열람 패턴 보존 + 볼륨 통제. 게이팅은 어차피 DISTINCT admin_id.
- ~~**[G-5]**~~ ✅ 해소 (2026-04-17) — **옵션 B 채택**: E4 `report_view_count` 제거. 별도 `report_view_log` 테이블로 분리. S3 M7은 `COUNT(DISTINCT admin_id)`로 2인 게이팅 판정. 이유: 감사 로그 재사용·쿼리 용이·스케일성·G-11 동시 해소.
- ~~**[G-11]**~~ ✅ 해소 (2026-04-17) — **G-5 B 채택으로 자동 해소**: `report_view_log`는 E4와 독립 테이블이므로 S2 시점 E4 Row 없어도 INSERT 가능. S3 승인 로직이 집계.

---

## 리스크

- **R-B (Critical)** (architect): `report.view` 파이프 없이 S3에 진입하면 D15 2인 게이팅이 항상 0/2 → Accept 불가 상태. S2 DoD에 `report_view_count` 이벤트 확인 항목 필수.

---

## 의사결정 로그

- 2026-04-17 (17차 — 블로커 4건 해소):
  - **BL-4 = B** (codegen 인라인, 대표 3~5종 상세 + 나머지 27종 템플릿 반복). 이유: mock 목적은 구조 검증, 품질은 실데이터 연결 시 개선.
  - **BL-5 = B** (1일 1회 dedupe, UNIQUE on admin_id+report_id+view_date). 이유: A는 로그 폭주, C는 재열람 신호 손실.
  - **G-5 = B** (`report_view_log` 별도 테이블, DISTINCT 집계). 이유: 감사 로그화·쿼리 용이·스케일성·G-11 동시 해소.
  - **G-11 = 자동 해소** (G-5 B 채택). E4 독립.
  - 파생 스키마 변경: E4에서 `report_view_count` 필드 제거 결정. S2 진입 전 ServicePlan-Admin §4.2 E4 정의 수정 필요 (S2 킥오프 첫 행동으로 편입). 신규 엔티티 E10 ReportViewLog를 ServicePlan-Admin §4.2에 추가.
- 2026-04-16: 슬라이스 파일 생성. architect 재조정 R5·R2에 의해 초안 S5→실행 순서 S2로 앞당김. S3 선행 이유 명시.

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S5 블록 기반. 실행 순서 앞당김 이유(R-B Critical) 명시. |
| 2026-04-17 | **블로커 4건 해소** (BL-4 B·BL-5 B·G-5 B·G-11 자동). E10 ReportViewLog 엔티티 도입, E4에서 report_view_count 제거. Tasks·DoD·엔티티·외부의존 갱신. Status ⚪ → 🟢. |
