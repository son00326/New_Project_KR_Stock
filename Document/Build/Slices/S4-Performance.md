# S4 가상 포트·성과 측정 + Decision Tree

> originally architect ID: S4 (`.omc/research/must-19-slice-mapping.md` §5 S4 블록 — 범위 확장: M16 Decision Tree 포함)

---

```
slice_id: S4
slice_name: 가상 포트·성과 측정 + Decision Tree
architect_id: S4
status: ⚪ 대기
expected_sessions: 4
current_progress: 0%
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

- [ ] **T4.1** E5 PortfolioSnapshot 스키마 + EOD 배치 로직 — `portfolio.daily_snapshot` 이벤트, entry_price=Accept 시점 종가, 현금 비율 별도 행(weight%·is_cash)
- [ ] **T4.2** `/admin/track-record` 페이지 — 누적 수익률·KOSPI·alpha·Sharpe 카드 + 월별·버킷별 테이블 + Counterfactual 열
- [ ] **T4.3** E8 RegenCounter 스키마 + `/admin/report/[ticker]/regenerate` UI — "N/2회 남음" 라벨, 한도 소진 시 버튼 비활성, 매월 1일 00:00 리셋, 재생성 확인 플로우 (BL-9 결정 후 서브라우트 vs 모달 확정)
- [ ] **T4.4** `/admin/decision-tree` 페이지 — 게이지 3종(CAP Months·누적 Alpha·Sharpe) + 월별 추이 차트 + ○/△/✕ 판정 + 부분 게이지(N/12)
- [ ] **T4.5** **cost_log stub 훅 심기** (R5 완화) — M9 재생성 API handler 진입점에서 `if total_ai_cost >= 400000: return {blocked: false, reason: 'stub'}` 형태로 삽입. S6 M17 구현 시 활성화.

> **병렬 가능**: T4.2 + T4.3 + T4.4는 독립 라우트이므로 병렬 작업 가능.

---

## DoD (Definition of Done)

- [ ] `/admin/track-record`: 누적 수익률·alpha·Sharpe 카드 표시, mock E5 데이터로 오류 없음
- [ ] `/admin/track-record`: 월별·버킷별 테이블 + Counterfactual 열 표시
- [ ] E8 RegenCounter: 재생성 버튼 클릭 시 카운터 -1, 0 도달 시 비활성
- [ ] `/admin/decision-tree`: 게이지 3종 + ○/△/✕ 판정 + 부분 게이지(N/12) 렌더링
- [ ] cost_log 차단 stub 존재 확인 (함수 내 stub 코드 주석 명시)
- [ ] `npm run build` 오류 0, `npm run lint` 경고 0
- [ ] 커밋: `feat(S4): 가상 포트 트래킹 + Decision Tree — M8·M9·M16 + cost_log stub`

---

## 블로커 / 사용자 결정 필요

- **BL-8** (Low): ○/△/✕ 판정 기준 MVP 기본값 — R3.11-9 제안(alpha≥0 AND Sharpe≥0.5 AND MDD≤-15%). B4 재검증 전 MVP 기본값 확정 요청 — ProgressDashboard §5 참조
- **BL-9** (Low): 재생성 확인 = 서브라우트(`/admin/report/[ticker]/regenerate`) vs Next.js 16 인터셉트 모달 중 택 1

---

## 리스크

- **R5** (architect §8): M9 재생성 cap과 M17 hardcap 상호작용 버그 — cap 우회 루프 가능성. T4.5에서 stub 선행 심기로 완화. S6 M17 구현 시 stub 활성화 + E2E 차단 테스트 필수.

---

## 의사결정 로그

- 2026-04-16: 슬라이스 파일 생성. architect 재조정 R4에 의해 M16(Decision Tree)을 S6에서 S4로 이관. cost_log stub T4.5에 포함.

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S4 블록 기반. M16 추가(R4 재조정). cost_log stub 훅(R5 완화) 명시. |
