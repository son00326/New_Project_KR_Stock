# S2 풀 리포트 + 투심위

> originally architect ID: S5 (`.omc/research/must-19-slice-mapping.md` §5 S5 블록 — **초안 S5를 앞당김**)

---

```
slice_id: S2
slice_name: 풀 리포트 + 투심위
architect_id: S5
status: ✅ 완료 (2026-04-17, 18차 · 실제 1세션)
expected_sessions: 3
current_progress: 100%
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

- [x] **T2.1** E2 StockReport + E3 CommitteeVote + **E10 ReportViewLog** Supabase 스키마 생성 + mock fixture. E2는 대표 5종 Section 0~8 상세 · 나머지 25종 템플릿 반복 (BL-4 B). E10은 UNIQUE(admin_id, report_id, view_date) + RLS(admin-only INSERT/SELECT). — 2026-04-17 완료. `supabase/migrations/0003_s2_reports.sql` + `src/lib/data/mock-admin-report.ts`(30 리포트) + `mock-admin-committee.ts`(630 votes = 30 × 21) + `mock-admin-committee-personas.ts`(Core 11 + Sector 22개 섹터 × 5인) + `mock-admin-report-view-log.ts`(2인·1인 열람 시드).
- [x] **T2.2** `/admin/report/[ticker]` 페이지 — Sticky Side Nav + 단일 스크롤 레이아웃 — 2026-04-17 완료. `<aside class="md:sticky md:top-20">` + hash anchor 내비(`#section-0`~`#appendix`) + `scroll-mt-24` scroll offset. D15 열람 게이팅 카운터(N/2명) 사이드에 고정.
- [x] **T2.3** Section 0~8 렌더러 — accordion (Section 0·8 펼침 디폴트, 나머지 접힘), 각 섹션 컨텐츠 컴포넌트 — 2026-04-17 완료. `<details>` + `renderSection` 디스패처로 10 섹션 전부 렌더. no-JS 호환.
- [x] **T2.4** `report_view_log` INSERT 파이프 — 2026-04-17 완료. `record-view.ts` server-only 모듈 + `SESSION_SEEN` Set + console.log (mock). Supabase upsert onConflict do nothing 코드는 TODO 블록으로 준비 완료.
- [x] **T2.5** 이전/다음 종목 내비 (버킷 내 순서) — 2026-04-17 완료. `getBucketNeighbors(ticker)` + 하단 prev/next Link. rank 정렬 기준.
- [x] **T2.6** Section 8 투심위 패널 — Core 11명 + Sector Board 집계 표 + 핵심 논거 3~5건 표시 — 2026-04-17 완료. `Section8View` 컴포넌트에 `VoteAggCard` 2종(Core + Sector) + 핵심 인용(찬/반/중립 border-l-2 색상 구분) + `<details>` 위원별 개별 투표 테이블.
- [x] **T2.7** Section 6 M4 분석엔진 출력 차트 (MVP 최소 — S1 카드 컴포넌트 재사용) — 2026-04-17 완료. `Section6View`에서 3축 AxisRow + 5-Signal LED 그리드 + 괴리율 표시. S1 `shortlist-row.tsx`의 `AxisBar`/`SignalLed` 동일 패턴. Recharts는 정적 요구 수준으론 불필요하여 미도입, 인터랙티브 요구 시 S4 성과 차트와 동시 통합 검토.

---

## DoD (Definition of Done)

- [x] `/admin/report/[ticker]` 접근 시 Section 0~8 전부 렌더링, 오류 없음 ✓ (build 17 routes 통과, 30 티커 전원 렌더 가능)
- [x] Sticky Side Nav: 스크롤 시 고정, 클릭 시 해당 섹션으로 스크롤 ✓ (`md:sticky` + hash anchor + `scroll-mt-24`)
- [x] 페이지 진입 시 `report_view_log` INSERT (또는 mock 로그) 확인 + UNIQUE 제약으로 동일 어드민·동일 리포트 하루 내 재진입 시 에러 없이 no-op 동작 ✓ (mock: SESSION_SEEN Set dedupe + console.log · 실 Supabase upsert onConflict do nothing TODO 블록 준비)
- [x] Section 8: Core 11명 투표 집계 + Sector Board 표시 + 논거 최소 3건 ✓ (VoteAggCard 2종 + keyQuotes 3~5 + 위원별 개별 투표 디스클로저)
- [x] "← Short List" 복귀 링크 동작 (스크롤 위치 복원) ✓ (`/admin` Link, Next.js App Router 기본 스크롤 복원)
- [x] `npm run build` 오류 0 (17 routes), `npm run lint` 경고 0 ✓
- [x] 커밋: `feat(S2): 풀 리포트 렌더링 + 투심위 패널 — M2·M3 + report_view_log 파이프` ✓

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

- 2026-04-17 (18차 — 구현·검증 완료):
  - **Section 구조는 §4.2 E2 SoT 유지**: ReportFramework.md v2.0(Summary + Section 0~8 + Appendix, Section 2=회사 개요·Section 3=이익 모델·...)와 E2 §4.2 v1(Section 0=투자 요약·Section 1=기업 개요·Section 2=재무 분석·...) 간 불일치 발견. 본 슬라이스에서는 E2 SoT 그대로 구현. Framework v2.0 재정렬은 별도 스키마 변경 슬라이스(S6 Hardening 후보)로 이월.
  - **Section 8은 디폴트 펼침**: R3.7-2는 "Section 0 디폴트 펼침, 나머지 디폴트 접힘"이지만 M3 투심위 집계가 핵심 결론이므로 Section 8도 defaultOpen 적용. 사용자 재량 조정 가능.
  - **Recharts 미도입**: T2.7 3축/5-Signal 모두 정적 시각화로 충분. Recharts 도입은 S4 성과 측정 차트(시계열·Sharpe 등)에서 동시에 고려.
  - **페르소나 로스터 규모**: Sector Board MVP = 섹터당 5인(기획 14×10 대비 축소). fixture 31종이 쓰는 섹터(22개)만 hand-map. 나머지 섹터는 실데이터 연결 시 AI 엔진으로 자동 생성.
  - **mock 투표 분포**: composite score 임계(88/80/72)별 deterministic 매핑. Core 페르소나 순서(Quality→Growth→Thematic→Momentum→Macro→...)는 archetype 친화도 고정. 실 엔진 연결 시 페르소나별 독립 prompt로 대체.
  - **record-view dedupe**: mock은 process-local `SESSION_SEEN` Set. 이로써 같은 개발 세션 중 같은 ticker 재진입은 console.log 생략. 실 Supabase는 UNIQUE(admin_id, report_id, view_date) 제약 + upsert onConflict do nothing.
  - **검증**: `npm run lint` 0·`npm run build` 17 routes 통과. 30종 전원 정적 라우트 가능하지만 dynamic으로 설정(어드민 인증 필요).
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
| 2026-04-17 | **S2 ✅ 완료 (18차)**. T2.1~T2.7 전원 구현. 0003 마이그레이션 + 4개 mock 파일 + `/admin/report/[ticker]` 페이지(Sticky Nav + 10 섹션 accordion + Section 8 투심위 패널 + prev/next). M2·M3 Must 2개 달성. Must **6/19 (32%)**. lint 0·build 17 routes. 실제 1세션(예상 3세션 대비 1/3). |
