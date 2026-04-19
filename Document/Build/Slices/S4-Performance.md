# S4 가상 포트·성과 측정 + Decision Tree

> originally architect ID: S4 (`.omc/research/must-19-slice-mapping.md` §5 S4 블록 — 범위 확장: M16 Decision Tree 포함)

---

```
slice_id: S4
slice_name: 가상 포트·성과 측정 + Decision Tree
architect_id: S4
status: ✅ 완료
expected_sessions: 4
current_progress: 100%
```

---

## 목표 (Why)

Accept된 포트폴리오의 성과를 가상으로 측정하고, Decision Tree 게이지로 서비스 지속 여부를 판단하는 인프라를 완성한다. NSM(North Star Metric)인 "CAP Months" 달성 여부가 이 슬라이스에서 가시화된다. M9 재생성 cap 가드도 여기에 포함하여 M17(hardcap)과의 연결 stub을 미리 심는다 (R5 완화).

---

## 포함 요구사항

- **Must**: M8 (가상 포트폴리오 트래킹 엔진), M9 (리포트 재생성 cap 가드), M16 (Decision Tree 진척도 대시보드)
- **엔티티**: E5 PortfolioSnapshot (RW), E8 RegenCounter (RW), E4 PortfolioApproval (R)
- **라우트**: `/admin/track-record`, `/admin/decision-tree`, `/admin/report/[ticker]/regenerate` (또는 모달)
- **근거**: ServicePlan-Admin.md §3.4 R3.4-1~5, §3.11 R3.11-1~9

---

## 선행 조건

- **S3 완료**: M7 Accept가 발생해야 E4에 entry_price 기준 행이 생성됨. E5 PortfolioSnapshot의 W 트리거는 S3 Accept에서 발화.

---

## 외부 의존

| 의존 대상 | 용도 | 슬라이스 내 처리 |
|---|---|---|
| KOSPI 지수 (pykrx) | alpha 계산 벤치마크 | mock fixture로 대체 가능. 실연결은 슬라이스별 실데이터 연결 단계 |
| AI API 비용 메타데이터 | M9와 M17 hardcap 연동 | **cost_log stub 훅만 심기** (실 hardcap은 S6에서 활성화) |

---

## Tasks (체크리스트)

- [x] **T4.1** 마이그레이션 0005 — E5 PortfolioSnapshot(일별 행·entry_price·weight·is_cash) + E8 RegenCounter(ticker+month UNIQUE·auto≤1·manual≤2) + cost_log stub 테이블(timestamp·model·tokens·cost_krw) + RLS
- [x] **T4.2** 순수 로직 레이어 `src/lib/performance/` — `sharpe.ts`·`mdd.ts`·`alpha.ts`·`judge.ts`(복합 AND: alpha≥0 AND Sharpe≥0.5 AND MDD≤-15%)·`cap-months.ts`. 각 파일 vitest 유닛(소수 케이스·경계값)
- [x] **T4.3** `/admin/track-record` 페이지 — 누적 수익률·KOSPI·alpha·Sharpe·MDD 카드 + 월별·버킷별 테이블 + Counterfactual 열 (R3.11-1~4)
- [x] **T4.4** `/admin/decision-tree` 페이지 — 게이지 3종(CAP Months N/12 · 누적 Alpha · Sharpe) + 월별 추이 라인 차트 + 복합 AND ○/△/✕ 배지 + BusinessPlan §Q4 참조 링크 (R3.11-5~9)
- [x] **T4.5** E8 RegenCounter Server Actions + `/admin/report/[ticker]/regenerate` **서브라우트 페이지**(BL-9=A) — 확인 화면 + "이번 달 N/2회 남음" 라벨 + cap 가드 + cost_log stub 훅(R5 완화)
- [x] **T4.6** S3 `acceptShortList` 액션에 E5 snapshot INSERT hook 추가 + S3 hardening 병행(actions.ts 실 Supabase catch · adminId 세션 주입 · dispute_reason btrim DB 제약)

> **병렬 가능**: T4.2(순수 로직) · T4.3 · T4.4 · T4.5는 독립 파일·라우트 → 병렬. T4.1은 선행(스키마). T4.6은 T4.1·S3 코드 교차 → T4.5 이후 순차.

---

## DoD (Definition of Done)

- [x] `/admin/track-record`: 누적 수익률·KOSPI·alpha·Sharpe·MDD 카드 + 월별·버킷별 테이블 + Counterfactual 열 (mock E5)
- [x] `/admin/decision-tree`: 게이지 3종(CAP Months·Alpha·Sharpe) + 월별 추이 차트 + 복합 AND ○/△/✕ 배지 + 부분 게이지(N/12)
- [x] `/admin/report/[ticker]/regenerate`: 서브라우트 확인 화면 + "이번 달 N/2회 남음" + cap 가드 + cost_log stub 주석
- [x] E8 RegenCounter UNIQUE(ticker+month) 준수, 자동≤1·수동≤2 카운트 분리
- [x] `acceptShortList`에서 E5 snapshot INSERT hook 동작 + S3 hardening(실 Supabase catch · adminId · btrim) 통합
- [x] Vitest: `src/lib/performance/__tests__/` Sharpe·MDD·judge·cap-months 유닛 전원 pass
- [x] `npm run build` 오류 0 · `npm run lint` 경고 0 · `npm run test:ci` pass
- [x] 커밋: `feat(S4): 가상 포트 트래킹 + Decision Tree — M8·M9·M16 + S3 hardening + cost_log stub`

---

## 블로커 / 사용자 결정 필요

- ~~**BL-8**~~ ✅ 해소 (2026-04-19 20차 킥오프) — **옵션 A 복합 AND** 채택: `alpha≥0 AND Sharpe≥0.5 AND MDD≤-15%` (R3.11-9 기본값)
- ~~**BL-9**~~ ✅ 해소 (2026-04-19 20차 킥오프) — **옵션 A 서브라우트** 채택: `/admin/report/[ticker]/regenerate` (S0 stub 재활용, 명시적 확인 플로우)
- **S3 hardening 병행** (2026-04-19 결정): 옵션 B 채택 — S4 T4.6에서 S3 `actions.ts` 실 Supabase catch · adminId 세션 · dispute_reason btrim 통합 처리

---

## 리스크

- **R5** (architect §8): M9 재생성 cap과 M17 hardcap 상호작용 버그 — cap 우회 루프 가능성. T4.5에서 stub 선행 심기로 완화. S6 M17 구현 시 stub 활성화 + E2E 차단 테스트 필수.

---

## 의사결정 로그

- 2026-04-16: 슬라이스 파일 생성. architect 재조정 R4에 의해 M16(Decision Tree)을 S6에서 S4로 이관. cost_log stub T4.5에 포함.
- 2026-04-19 (20차 킥오프): BL-8=A(복합 AND) · BL-9=A(서브라우트) · S3 hardening=B(S4 T4.6 병행). status ⚪→🟢. Task 6개 재편성(T4.1 선행 스키마 + T4.2 순수 로직 + T4.3/T4.4/T4.5 병렬 UI + T4.6 hook+hardening). 실행 엔진: `ralph` (Task 6개, Playbook §2.5 결정적 규칙).
- 2026-04-19 (20차 클로즈): ralph 6 스토리 + architect APPROVED + ai-slop-cleaner 패스. T4.2 41 tests · T4.5 12 tests · T4.6 3 trim tests 신설(43→87 tests). 비블로킹 이월 1건(RegenCounter 스네이크 매핑 → S5 실데이터 전환 시). status 🟢→✅. **Must 10/19 달성 (M8·M9·M16 추가, 53%)**.

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S4 블록 기반. M16 추가(R4 재조정). cost_log stub 훅(R5 완화) 명시. |
| 2026-04-19 | 20차 킥오프. BL-8·BL-9 해소. status ⚪→🟢. Tasks 5→6개 재편성 (T4.6 S3 hardening 병행 추가). |
| 2026-04-19 | 20차 ✅ 완료. 0005 마이그레이션 + `src/lib/performance/` 6모듈 + 3라우트(track-record·decision-tree·regenerate) + S3 hardening(resolveAdminId·trim·try/catch)·E5 snapshot hook. 87 tests · lint 0 · build 17 routes. architect APPROVED. Must 10/19 (53%). |
