# ServicePlan-Admin.md — 어드민 메인 서비스 기획

Last updated: 2026-04-15
Status: **스켈레톤 (다음 세션 1순위 착수)**
Parent: → `ServicePlan.md` (인덱스·공통 원칙)

---

## 0. 이 문서의 정체성

**어드민 전용 메인 서비스**의 서비스 기획을 단독으로 확정하는 문서. 멤버 페이지와 독립 확정.

- **담는 것**: 어드민(사용자 본인 1명)이 메인 서비스에서 만나는 화면·기능·데이터·제약.
- **담지 않는 것**: 멤버 페이지(`ServicePlan-Member.md`), 공통 원칙(`ServicePlan.md §3`), 사업 제약(`BusinessPlan.md §7·§10`).
- **확정 원칙**: 각 섹션은 brainstorming → product-manager → critic 사이클로 독립 확정. 확정된 것만 본문에 박제.

---

## 진행 트래커

### Planning (Phase.md 방법론 기준)

- [ ] **P0** 의도 정렬
  - [ ] 0.1 스코프·JTBD 합의 (`superpowers:brainstorming`) → §1
  - [ ] 0.2 문서 동기화 (직접 Write)
  - [ ] 0.3 모호성 잔여 확인 → GO/HOLD
- [ ] **P1** 리서치 (7개 병렬)
  - [ ] 1.1 BusinessPlan 기획 갭 분석 (`analyst` opus)
  - [ ] 1.2 경쟁 서비스 스캔 (`external-context` + `competitor-analysis`)
  - [ ] 1.3 페르소나 정의 (`user-personas`)
  - [ ] 1.4 고객 여정 맵 (`customer-journey-map`)
  - [ ] 1.5 Core JTBD (`value-proposition`, 1.3 후)
  - [ ] 1.6 기능 후보 브레인스톰 (`brainstorm-ideas-existing`)
  - [ ] 1.7 투심위 UX 패턴 (`external-context`)
  - [ ] 1.8 Quant 데이터 플로우 (`architect` opus + `scientist`)
- [ ] **P2** 전략 골격 (4개 병렬)
  - [ ] 2.1 Product Vision (`product-vision`)
  - [ ] 2.2 Value Proposition 6-part (`value-proposition`, 1.5 후)
  - [ ] 2.3 9-Section Strategy Canvas (`product-strategy`)
  - [ ] 2.4 가격 전략 근거 (`pricing-strategy`, 2.3 후)
  - [ ] 2.5 북극성 지표 (`north-star-metric`)
- [ ] **P3** 구조화
  - [ ] 3.1 Must/Should/Nice 분류 (`prioritize-features`)
  - [ ] 3.2 리스크 가정 식별 (`identify-assumptions-existing`)
  - [ ] 3.3 가정 우선순위 (`prioritize-assumptions`, 3.2 후)
  - [ ] 3.4 Opportunity Solution Tree (`opportunity-solution-tree`)
  - [ ] 3.5 Information Architecture (`information-architect`)
- [ ] **P4** 기획서 작성 (P7과 병렬)
  - [ ] 4.1 PRD 골격 (`create-prd` + `product-manager`)
  - [ ] 4.2 User Stories (`user-stories`, 3.1 후)
  - [ ] 4.3 Metrics Dashboard (`metrics-dashboard` + `product-analyst`)
  - [ ] 4.4 Acceptance Scenarios (`test-scenarios`)
  - [ ] 4.5 통합·편집 → v0.9 (`writer` + 직접 Write)
- [ ] **P7** UX Design (P4와 병렬, P3 완료 후)
  - [ ] 7.1 핵심 유저 플로우 다이어그램 (`designer`)
  - [ ] 7.2 핵심 화면 와이어프레임 (`design-shotgun`)
  - [ ] 7.3 IA 검증 + 네비게이션 (`ux-researcher`)
- [ ] **P5** 검증 (3개 병렬, P4+P7 완료 후)
  - [ ] 5.1 적대적 검토 (`critic` opus)
  - [ ] 5.2 UX 관점 검토 (`ux-researcher`)
  - [ ] 5.3 Pre-mortem (`pre-mortem`)
  - [ ] 5.4 최종 수렴 → v1.0 (직접 편집)
- [ ] **P6** 사양화
  - [ ] 6.1 FRD (`frd-writer`) → `Document/Service/Build/FRD-Admin.md`
  - [ ] 6.2 사용자 시나리오 (`scenario-system`) → `Document/Service/Build/Scenarios-Admin.md`
- [ ] **P8** UI Design (P6+P7 완료 후)
  - [ ] 8.0 디자인 하네스 구성 (`harness`)
  - [ ] 8.1 디자인 원칙·Voice·Tone (`designer` + `design-consultation`)
  - [ ] 8.2 디자인 토큰 (`designer`) → ServicePlan.md §3 + globals.css
  - [ ] 8.3 shadcn 컴포넌트 오버라이드 계획 (`designer`)
  - [ ] 8.4 고품질 목업 (`frontend-design`)
  - [ ] 8.5 Design Review (`design-review` + `visual-verdict`)
  - [ ] 8.6 디자인 아카이브 저장 (직접 Write)

### Build (BuildPhase.md 방법론 기준)

> **Note**: 디자인 **제작**은 Planning P7·P8에서 완료. B1은 디자인→코드 전환만.

- [ ] B1 — 디자인→코드 전환 (P8 목업 → 코드 컴포넌트 / 리뷰)
- [ ] B2 — 인프라 (deepinit / Supabase / 한투 / DART / pykrx / DB / 인증 / 하네스)
- [ ] B3 — 구현 (ScreenSpec / 간소화 / 실데이터 / Must 기능 / Smoke)
- [ ] B4 — QA (QA 루프 / 보안 / 성능 / 접근성 / 리뷰 / 버그 수정)
- [ ] B5 — 배포 (릴리스 / 머지 / 카나리 / 문서)

---

## 1. 사용자·목적

> **[스켈레톤 — 다음 세션에서 brainstorming으로 확정]**

- **사용자**: 어드민 = 사용자 본인 1명 (공동창업자는 운영 파트너, 어드민 로그인 권한 없음 — BusinessPlan §Q10)
- **목적**: 리포트를 실제 투자 집행으로 연결. Short List 30을 매월 검토하고 포트폴리오 추천·조정을 받는다.
- **JTBD** (확정 대기): _다음 세션에서 작성_
- **Non-Goals**: 멤버 대상 노출·공개 마케팅·무료 체험.

---

## 2. 화면 IA · 라우트

> **[스켈레톤]**

- **라우트 그룹**: `/admin/*` (어드민 전용, 미들웨어 role 가드)
- **예상 화면** (확정 대기):
  - `/admin` — Top30 대시보드 (단기10 / 중기10 / 장기10)
  - `/admin/report/[ticker]` — 종목 클릭 시 Document/Outputs/ 형식 풀 리포트
  - `/admin/portfolio` — AI 포트폴리오 추천·조정
  - `/admin/alerts` — 악재 긴급 알림 이력·재조정 제안
- **화면 플로우 다이어그램**: _다음 세션_

---

## 3. 기능 스펙

> **[스켈레톤]**

핵심 기능 후보 (다음 세션에서 Must/Should/Nice 분류):
- (a) Top30 선정 (월 1회 재생성 배치)
- (b) 기업별 풀 리포트 렌더링 (Section 0~8 + Appendix)
- (c) 포트폴리오 추천 알고리즘 (30종목 → 비중·현금 비율)
- (d) 뉴스 악재 감지 (소스·트리거·심각도 레벨)
- (e) 긴급 알림 채널 (이메일·텔레그램, BusinessPlan §10.6)
- (f) 포트폴리오 재조정 제안 (악재 발생 시)
- (g) 과거 Short List·리포트 이력 열람

---

## 4. 데이터 모델·연동

> **[스켈레톤]**

- **데이터 소스** (확정 대기): KRX·한국투자증권 API·DART·pykrx·뉴스 벤더
- **저장** (확정 대기): Supabase (BuildPhase B2.2에서 env 세팅)
- **핵심 엔티티**: Ticker / ReportVersion / ShortListMonth / PortfolioSnapshot / AlertEvent
- **갱신 주기**: 월 1회 Top30 재선정 (**스케줄러 자동 실행**, 수동 트리거 아님) + 실시간 뉴스 감지 (스트림) + 실적 발표/대형 이벤트 시 수시 갱신

---

## 5. 제약

- 공통 원칙 → `ServicePlan.md §3` 참조
- **어드민 고유 제약**:
  - Short List·풀 리포트는 멤버에 노출하지 않음 (BusinessPlan §10.2)
  - **면책 완화 (2026-04-15 확정)**: 어드민 전용이므로 AI가 포트폴리오 **비중까지 결정·추천** 가능. "매수/매도 추천 금지" 원칙은 **멤버·외부 노출 한정**. 어드민 내부 도구에서는 AI가 종목별 비중·현금 비율·재조정 제안까지 제공.
  - 긴급 알림 수신자 = 어드민 1명 고정

---

## 6. 멤버 연결점

> 어드민 서비스와 멤버 서비스가 만나는 지점. 기획·빌드 중 발견될 때마다 양쪽 sub-doc에 동시 기록.

| 연결 지점 | 어드민 측 | 멤버 측 | 공통 SoT |
|---|---|---|---|
| 인증·세션 | `/admin/*` role guard | `/(auth)/*` 초대 코드 | Supabase 미들웨어 (ServicePlan.md §3) |
| 디자인 시스템 | shadcn base-nova + 주픽 토큰 | 동일 | ServicePlan.md §3 |
| 데이터 격리 | Short List·리포트 접근 가능 | RLS로 차단 | Supabase RLS 정책 |
| 면책 Footer | 전 페이지 고정 | 전 페이지 고정 | BusinessPlan §7 |

> 기획 진행하며 행 추가. 빈 칸은 미확정.

---

## 7. Confirmation 로그

| 날짜 | 확정 항목 | 방법 | 링크 |
|---|---|---|---|
| 2026-04-15 | 문서 스켈레톤 신설 | 사용자 지시 (기획 분리) | HANDOFF 2026-04-15 |

> 섹션별 확정 시마다 행 추가. 확정 주체(사용자·critic 통과)와 근거 명시.
