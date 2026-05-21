# ServicePlan-Admin.md — 어드민 메인 서비스 기획

Last updated: 2026-05-21 (53차 §5 — shortlist 30종목 + 풀 리포트 흐름 정정 박제. D23 신설 (D19/D21/D22 supersession entry) + 박제 vs 코드 mismatch Group A-H 8 그룹 catch + canonical 후속 PR 순서 PR2→PR3a→PR1→PR3b→PR4 + Hard gate (PR1 ⊥ PR3a 미선행 = page crash). OMXY 적대적 검토 R1~R5 누적 21 BLOCKERS catch & fix → CONVERGED. spec doc `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md`. 이전: 53차 §3 — Step 3b 207 persona Kevin v3.1 quality 본문 완성, PR #8 OPEN.)
Status: **v1.9 (2026-05-21, 53차 §5 — shortlist 30종목 + 풀 리포트 흐름 정정 박제 + D23 신설). 메인 path = Tier 0 인디케이터·DART numeric narrow → Tier 1 Core 11 AI 평가 + 시간대별 페르소나 가중치 → 30 선정 + Tier 2 sector 14 페르소나 Section 8 plug-in + writer Section 0~7 통합 = 30 풀 리포트 (단일 산출물). fallback = AI 키 미발급 시 Tier 0 단독 30 직선정 (현 production 상태). Group H Critical schema drift + PR3a Hard gate 선행 박제. 이전 이력: v1.8 (2026-05-20, 52차 — Tier 2 impl PR #5 + D22 Kevin v3.1 quality target). D21 (v1.7) Tier 2 SoT PR #4 + D22 Tier 2 production prompts quality target = `origin/IMVCOM @ 1faee1b` Kevin v3.1 reference 박제. 마이그 0019 commit_sector_personas RPC + commitSectorReport + parseSectorContentStrict + runSectorEval scaffold + 196 mock stub. omxy 69 rounds CONVERGED 누적. (이전 이력: v1.7 (2026-05-20, 52차) — D21 Tier 2 Sector Board slot 모델 정정 + SoT PR 박제. canonical 14 sectors × 14 personas/sector overlay (10 base + 2 primary + 2 sub_tag). sub_tags jsonb crosswalk 7개 운영 UI proxy. mig 0018 + `canonical-sectors.ts` 신규 (production import 0). `commit_sector_personas` RPC + Section 8 render는 Tier 2 implementation 후속 PR OOS. omxy R1~R4 CONVERGED. (v1.6 이력: 2026-05-19 S7a 49차 5종 합의 배지 박제. v1.5 이력: 2026-05-08 D19 — JooPick AI 강화 Tier 0/1/2 병렬 + 합의 배지(4종) + Reflection. v1.4 이력: 2026-05-08 D18 — S8 자동매매 진입 시점 재조정 + KIS 발급 비블로커화. v1.3 이력: 2026-04-22 D17 — DQ-7 per-admin UI + AES-256-GCM + Vercel 첫 배포 트랙. v1.2 이력: D16 어드민 내부 도구 재정의 + 자동매매 S8 승격.)**
Prior: v1.1 (13차 후속) — Q-OP1·Q-OP2 반영 완료(Must 승격 3건 + Holding Period 24h + 2인 게이팅). Q-OP3·Q-OP4는 개발 완료 전까지 유보 고정. Must 19 / Should 17 / Nice 6 / Deferred 7.
Prior: v1.0 (13차) — P5 검증 완료. Critical 3건(I-01/I-02/I-03) 해소 · Major 10건 전원 해소(I-04~I-13) · 사용자 결정 D10~D13 박제.
Parent: → `ServicePlan.md` (인덱스·공통 원칙)

---

## 0. 이 문서의 정체성

**어드민 내부 도구의 서비스 기획**을 단독으로 확정하는 문서. 멤버 페이지와 독립 확정.

> **2026-04-21 재정의 (D16)**: 어드민은 "대외 서비스"가 아니라 **본인 + 친구 3명(Q10 참조)이 주식·코인 투자를 편하게 하기 위한 내부 도구**. 멤버 배포(500cap)·MVP Stage 1/2·Friends & Family Beta 같은 공개 서비스 프레임은 이 문서 범위 밖. 관련 어휘는 보존 가치가 있는 경우 아카이브 형태로만 유지한다.

- **담는 것**: 어드민 3명(§1.1)이 내부 도구로 쓰는 화면·기능·데이터·제약 + 자동매매 프레임(S8) 개요.
- **담지 않는 것**: 멤버 페이지(`ServicePlan-Member.md`, Deferred-D), 공통 원칙(`ServicePlan.md §3`), 사업 제약(`BusinessPlan.md §7·§10`), 자동매매 슬라이스 상세(`Document/Build/Slices/S8-AutoTrading.md`).
- **확정 원칙**: 각 섹션은 brainstorming → product-manager → critic 사이클로 독립 확정. 확정된 것만 본문에 박제.

---

## 진행 트래커

### Planning (Phase.md 방법론 기준)

- [x] **P0** 의도 정렬 ✅ (2026-04-15 완료, GO 판정)
  - [x] 0.1 스코프·JTBD 합의 (`superpowers:brainstorming`) → §1
  - [x] 0.2 문서 동기화 (직접 Write)
  - [x] 0.3 모호성 잔여 확인 → **GO** (2026-04-15, 모호성 없음 판정)
- [x] **P1** 리서치 (7개 병렬 + 1 후속) ✅ (2026-04-15 완료, 8/8 태스크)
  - [x] 1.1 BusinessPlan 기획 갭 분석 (`analyst` opus) — 30개 갭, Critical 5건
  - [x] 1.2 경쟁 서비스 스캔 (`researcher`) — 8개 경쟁사, 직접 포지션 중복 없음
  - [x] 1.3 페르소나 정의 (`user-personas`) — 3인: 김재혁(시스템 신뢰자), 박소연(적극적 검증자), 이준호(트랙 레코드 빌더)
  - [x] 1.4 고객 여정 맵 (`customer-journey-map`) — 4개 여정 (월간/일간/긴급/온보딩)
  - [x] 1.5 Core JTBD (`value-proposition`, 1.3 후) — 6-part VP + 페르소나별 VP + Canvas
  - [x] 1.6 기능 후보 브레인스톰 (`brainstorm-ideas-existing`) — 기존23+신규26=49개
  - [x] 1.7 투심위 UX 패턴 (`document-specialist`) — 6카테고리 패턴 + 한국 색상 컨벤션
  - [x] 1.8 Quant 데이터 플로우 (`architect` opus) — v6 분석, 16엔티티, 5 ADR
- [x] **P2** 전략 골격 ✅ (2026-04-15 완료, 정리 세션 후 §1A SoT 단일화)
  - [x] 2.1 Product Vision → §1A.1
  - [x] 2.2 Value Proposition 6-part → §1.2 Core JTBD + P1.5 원자료(`core-jtbd-value-proposition.md`)
  - [x] 2.3 9-Section Strategy Canvas → §1A.2 Unfair Advantages + §1A.5 (P2 시점 미해결 7건 박제 → 10차 P3.0 Q&A에서 D1~D9로 해소)
  - [x] 2.4 가격 전략 근거 → BusinessPlan §Q11(월 19,900원 확정) + §1A.5 말미 BEP 51명(중복·과잉으로 별도 문서 삭제)
  - [x] 2.5 북극성 지표 → §1A.3 NSM + 측정 스펙 + 리뷰 프로토콜 + §1A.4 Anti-Metrics
- [x] **P3** 구조화 ✅ (2026-04-15 완료, 3/3 태스크)
  - [x] **P3.0** Pre-P3 사용자 Q&A 세션 ✅ (2026-04-15, 9개 결정 D1~D9 + 보류 1건 확정, §1A.5 재작성)
  - [x] 3.1 Must/Should/Nice 분류 (`prioritize-features`) ✅ — Must 19 / Should 17 / Nice 6 / Deferred 7. §3.7~§3.12 운영. 원자료: `.omc/research/p3-1-feature-prioritization.md` (v1.1에서 D-OOS-6·D-OOS-7·Silent Health를 Must 승격, D14 박제)
  - [x] 3.2 Information Architecture (`information-architect`) ✅ — 메인 7 + 서브 3 = 10 라우트. Short List 30 = 3고정섹션 세로 스택. 3모드 = Header 드롭다운 + Settings. 원자료: `.omc/research/p3-2-information-architecture.md`
- [x] **P4** 기획서 작성 (P7과 병렬) ✅ (2026-04-15 12차, 4/4 태스크)
  - [x] 4.1 PRD 골격 (`create-prd` + `product-manager`) — §3 요구사항 R번호체계 본문화 + §4 데이터 모델 8엔티티. 미해결 5건 해소/이관.
  - [x] 4.2 User Stories (`user-stories`) — Must 16개 × Story+AC (17블록, M13 설정/동작 분리) · v1.1에서 M17·M18·M19 추가 Story+AC 부착
  - [x] 4.3 DoD 체크리스트 (`test-scenarios`) — Must 16개 × DoD 3~5개 (17블록, Gherkin 금지) · v1.1에서 M17·M18·M19 DoD 부착 + M7 DoD에 Holding/게이팅/이의 3개 추가
  - [x] 4.4 통합·편집 → v0.9 (직접 Write) → **ServicePlan-Admin.md v0.9**
- [x] **P7** UX Design (P4와 병렬) ✅ (2026-04-15 12차, 3/3 태스크)
  - [x] 7.1 유저 플로우 (`designer`) — 5개 mermaid (J1~J4 + 3모드). `.omc/design/flows/admin-flows.md`
  - [x] 7.2 와이어프레임 (`designer`) — 글로벌+5종 ASCII. `.omc/design/wireframes/admin-wireframes.md`
  - [x] 7.3 IA 검증 (`architect`) — BLOCK 0 / FLAG 3 / Suggestion 3. `.omc/design/ia-verification.md`
- [x] **P5** 검증 (3개 병렬, P4+P7 완료 후) ✅ (2026-04-15 13차, 4/4 태스크)
  - [x] 5.1 적대적 검토 (`critic` opus) → `serviceplan-admin-critique.md` — REJECT 판정, Critical 3 + Major 10 → D10~D13 + 기계 해소
  - [x] 5.2 UX 관점 검토 (`ux-researcher`) → `serviceplan-admin-ux-audit.md`
  - [x] 5.3 Pre-mortem (`pre-mortem`) — Anti-Metrics 4개 × 6개월 타임라인 시나리오 + 예방 조치
  - [x] 5.4 최종 수렴 → **ServicePlan-Admin.md v1.0** (직접 편집)
- [ ] **P6** 사양화
  - [ ] 6.1 FRD (`frd-writer`) → `Document/Service/Build/FRD-Admin.md`
  - [ ] 6.2 사용자 시나리오 (`scenario-system`) — customer-journey 4여정 변환 + 온보딩/초대 + edge 2~3 → `Scenarios-Admin.md`
- [ ] **P8** UI Design (P6+P7 완료 후) — 6개 _(8차 재정비: 구 8.3 shadcn 오버라이드 삭제 → ServicePlan.md §3 base-nova 확정 + B1 흡수)_
  - [ ] 8.0 디자인 하네스 구성 (`harness`)
  - [ ] 8.1 디자인 원칙·Voice·Tone (`designer` + `design-consultation`) — §1A.1 3대 약속 + 규약 재형식화
  - [ ] 8.2 디자인 토큰 (`designer`) → ServicePlan.md §3 + globals.css
  - [ ] 8.3 고품질 목업 (`frontend-design`) _(구 8.4)_ — Must 4~6종 (P7.2 확정 후 결정)
  - [ ] 8.4 Design Review (`design-review` + `visual-verdict`) _(구 8.5)_
  - [ ] 8.5 디자인 아카이브 저장 (직접 Write) _(구 8.6)_

### Build (BuildPhase.md 방법론 기준)

> **Note**: 디자인 **제작**은 Planning P7·P8에서 완료. B1은 디자인→코드 전환만.

- [ ] B1 — 디자인→코드 전환 (P8 목업 → 코드 컴포넌트 / 리뷰)
- [ ] B2 — 인프라 (deepinit / Supabase / 한투 / DART / pykrx / DB / 인증 / 하네스)
- [ ] B3 — 구현 (ScreenSpec / 간소화 / 실데이터 / Must 기능 / Smoke)
- [ ] B4 — QA (QA 루프 / 보안 / 성능 / 접근성 / 리뷰 / 버그 수정)
- [ ] B5 — 배포 (릴리스 / 머지 / 카나리 / 문서)

---

## 1. 사용자·JTBD·스코프

> **P0 Task 0.1 확정 (2026-04-15)** — brainstorming 완료, 사용자 승인.

### §1.1 사용자

| 항목 | 정의 |
|---|---|
| 역할 | 어드민 **3명** 가정 (사용자 본인 + 공동창업자 2명). 2명 운영도 동일 설계로 가능 — 차이는 계정 수뿐. |
| 권한 | `/admin/*` 전체 접근. 어드민 계정 간 동일 권한 |
| 맥락 | 본인 자금 15억 직접 운용. 동일 Short List 30·리포트·포트폴리오 뷰 공유 |
| 매매 실행 | 각 어드민이 외부 증권 앱에서 직접 실행. 주픽은 매매하지 않음 |

> **BusinessPlan §Q10 변경**: 기존 "1명 고정" → "2~3명". 혹시 모를 확장 대비.

**어드민 3인 역할 분담 (선택적 가이드, P5 I-06 박제)**: 3인 동일 권한·동일 뷰가 기본. 운영상 자연스럽게 형성되는 역할(의사결정 주도 / 검증 / 기록)은 문서·슬랙에서 조율한다. 시스템은 역할을 강제하지 않는다. 페르소나 3인(김재혁·박소연·이준호, P1.3)은 제품 설계 참조용일 뿐, 실제 어드민 3명과 1:1 매핑되지 않는다.

---

### §1.2 Core JTBD

> **"매월 AI 가상 펀드매니저가 선정한 Short List 30과 풀 리포트를 기반으로, 15억 자금을 직접 운용하여 Y1 말까지 KOSPI 대비 alpha가 있는 트랙 레코드를 구축하고 싶다."**

---

### §1.3 Sub-Jobs (워크플로우 순)

#### J1. 월간 선정 (매월 1일)

> "이번 달 뭘 살지 — AI가 분석한 30종목 리스트와 비중 제안을 받아 포트폴리오를 확정하고 싶다."

- AI가 전종목 스크리닝 → Short List 30 생성 (단기10/중기10/장기10)
- 각 종목 풀 리포트 (Section 0~8) 제공
- 포트폴리오 비중 제안 (현금 비율 0~30% 포함) → 어드민 승인 → 가상 포트폴리오 트래킹 시작
  - **승인 방식**: Accept/Reject 모델. 어드민이 종목·비중을 수동 수정하지 않음.
  - **승인 권한**: 어드민 동등 권한, **먼저 승인한 사람이 확정** (선착순).
  - **Reject 처리** (D1): Reject 시 AI 즉시 재분석 1회 → **재분석본도 Reject되면 그 달은 전월 포트 유지**.
  - **미승인 마감** (D2): 매월 1일 생성 후 **D+5 영업일** 미승인 시 전월 포트 유지 + 텔레그램 경고 발송.
  - **트래킹 기준가**: 승인 시점 종가 (= 승인가).
- 전월 대비 편입/유지/제외 + 변동 사유 명시

#### J2. 일간 모니터링 (매일 아침, 디폴트 모드)

> "내 포지션이 괜찮은지 — 보유 종목 현황·밤사이 뉴스·이슈를 한눈에 파악하고 싶다."

- 보유 30종목 수익률 요약 (종목별 + 전체)
- 밤사이 뉴스·공시·이벤트 하이라이트
- 주의 필요 종목 플래그 (급등락·뉴스 악재·목표가 근접)

#### J3. Exit 타이밍 (상시)

> "언제 팔지 — 목표가 도달·모멘텀 꺾임·악재 발생 시 즉시 매도 시그널을 받고 싶다."

- 단기 종목: 홀딩 기간 내 적극적 매도 타이밍 제안
- 중기/장기 종목: 목표가 변동·펀더멘탈 훼손 시 알림
- 긴급 알림 채널: 이메일·텔레그램 즉시 발송
- 매도 제안 시 근거(리포트 섹션 참조) + 대안 시나리오 제시

#### J4. 성과 추적 (월말 + 상시)

> "얼마나 벌었나 — 승인 시점 기준 수익률·Sharpe·alpha를 측정하고 트랙 레코드로 누적하고 싶다."

- 종목별 수익률 (승인가 기준)
- 포트폴리오 전체 수익률·Sharpe·KOSPI 대비 alpha
- 월간/누적 트랙 레코드 기록
- 단기/중기/장기 관점별 성과 분리 집계
- **체결 가정 (D3)**: 승인 시점 **종가로 100% 일괄 매수** 가정. 슬리피지·수수료 0% (단순 모델 — 가상 포트 성능 측정 전용).
- **현금 (D4)**: AI 제안 현금 비율(0~30%)만큼 매수 제외 → 별도 항목으로 추적

---

### §1.4 사용 모드 (어드민 설정에서 전환)

홈 화면은 **모든 모드에서 동일**: Short List 30 (단기/중기/장기) + 상단 일간 요약 섹션.

```
┌─────────────────────────────────────────┐
│  일간 요약 (항상 상단 고정)               │
│  전체 수익률 | 주의 종목 | 뉴스 건수      │
├─────────────────────────────────────────┤
│  단기 Top 10  (종목명·현재가·수익률·상태)  │
├─────────────────────────────────────────┤
│  중기 Top 10                             │
├─────────────────────────────────────────┤
│  장기 Top 10                             │
└─────────────────────────────────────────┘
```

모드가 제어하는 것은 **알림·데이터 갱신·모니터링 깊이**:

| 모드 | 알림 빈도 | 데이터 갱신 | 모니터링 깊이 | MVP |
|---|---|---|---|---|
| **모닝 대시보드** (디폴트) | 아침 브리핑 + 긴급 즉시 | 장 마감 후 배치 | 일 1회 | ✅ |
| **상시 모니터링** | 임계치 기반 즉시 | 실시간 스트림 | 장중 상시 | ✅ (D7: 임계치 UI 단순화 — 디폴트 임계치 + 종목별 on/off만) |
| **월간 리밸런싱** | 재선정 시점 + 긴급 즉시 | 월 1회 배치 | 주 1회 요약 | ✅ |

- 세부 항목(알림 채널·임계치 등)은 개별 오버라이드 가능
- J3 Exit 시그널의 긴급 알림은 **모든 모드에서 즉시 발송** (모드 무관)
- **상시 모니터링 MVP 임계치 스펙 (D7)**: 디폴트 임계치 3종(급등락·뉴스 악재·목표가 근접) + 종목별 on/off 토글만. 구체 임계치 값은 P4 PRD 또는 BuildPhase B3에서 확정. 세밀한 임계치 커스텀 UI는 Phase 2.

---

### §1.5 AI 역할 경계

> **승인(Accept) = AI 가상 포트 확정이며 실제 체결 강제 아님**. 실제 체결은 §1A.0의 3경로(매뉴얼/자동매매/외부 바이패스)에서 각 어드민 독립 의사결정. D11 박제.
>
> **2026-04-21 보강 (D16)**: 자동매매(S8)는 "AI가 주문까지 자동 실행"을 목표로 하지만, AI agent·skill 본체는 어드민이 추후 drop-in하는 구조. 현 S8 범위는 인터페이스·데이터·가드레일·주문 파이프라인만 구현.

| AI가 하는 것 (가상 펀드매니저 + 자동매매 어댑터) | AI가 하지 않는 것 |
|---|---|
| 전종목 스크리닝 → Short List 30 선정 | (별도 drop-in 없이는) 자율 주문 실행 |
| 종목별 풀 리포트 (Section 0~8) 작성 | 어드민 대신 승인·의사결정 |
| 포트폴리오 비중 제안 | 실제 체결가·잔고 동기화 (증권사 API로 상호 조회는 S8에서 수행) |
| 승인 후 가상 포트폴리오 수익률 트래킹 | 멤버에게 Short List·리포트 노출 |
| 보유 종목 리스크 상시 모니터링 | 리스크 가드레일 override (레버리지·일일 손실·주문 cap) |
| Exit 타이밍 제안 (매도 시그널 + 근거) | |
| 악재 감지 → 긴급 알림 + 재조정 제안 | |
| 월간/누적 트랙 레코드 기록 | |
| **(S8)** Strategy 폴더 drop-in 및 AI 어댑터 embed 인터페이스 제공 — 자동매매 주문 파이프라인(모의→실계좌, 주식+바이낸스 선물) | |

---

### §1.6 Non-Goals

- 멤버(500cap)에게 Short List·풀 리포트 노출 (Deferred-D, 별도 트랙)
- 공개 마케팅·무료 체험·가입 퍼널 (어드민 내부 도구이므로 해당 없음)
- Friends & Family Beta·Closed Beta 등 지인 배포 워크플로우 (현 플랜에서 분리, Deferred-D 재개 시)
- AI agent·skill 본체 구현 (어드민이 추후 drop-in — S8 어댑터 인터페이스만 기본 제공)
- 리스크 가드레일 자동 override (레버리지·일일 손실·주문 cap 한도 초과 자동 허용 금지)

> **2026-04-21 어휘 정리 (D16)**: 구 "트레이딩 실행 3-Stage 로드맵(Stage 1 매뉴얼 → Stage 2 API → Stage 3 AI 자율)"은 **폐기**. 대신 **자동매매 = S8 단일 슬라이스**로 통합되고, 내부 단계가 (i) 모의↔실 체결, (ii) Strategy drop-in↔AI 어댑터 embed로 세분화된다. 상세: `Document/Build/Slices/S8-AutoTrading.md`.
>
> **범위**: S8은 주식(KIS 모의→실계좌) + 코인(바이낸스 USDT-M 선물 테스트넷→메인넷)을 모두 포함. 대상 종목 스코프는 **Short List / 자유 종목 / 바이낸스 선물** 중 어드민 선택.

---

### §1.7 성공 기준

| 지표 | 목표 | 측정 시점 |
|---|---|---|
| 트랙 레코드 누적 | 12개월 연속 기록 | Y1 말 |
| KOSPI 대비 alpha | 양(+)의 alpha | 월간·누적 |
| Sharpe Ratio | > 1.0 | 누적 |
| Short List 적중률 | 편입 종목 중 수익 종목 비율 추적 | 월간 |
| 플랫폼 사용 빈도 | 어드민이 실제로 매일 쓰는가 | 주간 체크 |
| Exit 시그널 품질 | 매도 제안 후 추가 하락 비율 | 분기 리뷰 |

- 성공 기준은 P4(PRD)에서 정량 KPI로 세분화
- Y1 말 Decision Tree(BusinessPlan §Q4)와 연동: alpha·Sharpe가 법적 등록 판단 근거
- **Decision Tree 진척도 대시보드 (D9)**: `/admin/decision-tree` 별도 화면에서 alpha·Sharpe·CAP Months vs Y1 목표 진척도 상시 표시

---

## 1A. 전략 골격 (P2 SoT)

> **P2 완료 (2026-04-15)**. 본 섹션이 SoT. VP/페르소나/경쟁사 원자료는 `.omc/research/` (P1.2·1.3·1.5).

### §1A.0 어드민 실행 모델 (v1.0 신설, P5 D11)

> **개념**: 주픽 어드민은 단일 매매 시스템이 아니라 **AI 가상 포트폴리오 본체 + 2개 집행 서브시스템 + 외부 바이패스**로 구성된다. Critic I-05 지적(가상 포트 vs 실제 자금 실행 경로 모호)을 해소하기 위해 박제.

**3경로 집행 모델**:

| 경로 | 내용 | 주픽 내부 여부 | 측정 대상 |
|---|---|---|---|
| **(1) AI 분석·가상 포트폴리오** | Short List 30 → 투심위 → 선착순 Accept → 가상 포트 확정·일별 스냅샷. **서비스 본체**. | ✅ (메인 서비스) | Track Record · NSM(CAP Months) · Anti-Metric "오버라이드 비율"의 **모든 측정 대상** |
| **(2) 매뉴얼 트레이딩 서브시스템** | 각 어드민 계정에 본인 증권사 API 연결(§4.2 E9). 수동 주문. | ✅ (서브시스템, BusinessPlan §10) | 본인 계정 성과(개인 자금) |
| **(3) 자동매매 서브시스템** | 주식(KIS) + 코인(바이낸스 선물). Strategy drop-in + AI 어댑터 embed. **S8에서 구현**. | ✅ (서브시스템) | `Document/Build/Slices/S8-AutoTrading.md` |
| **(4) 외부 바이패스** | 어드민이 주픽 안에서 주문 안 하고 본인 증권사 앱 직접 사용 | ❌ (주픽 외부) | 측정 안 함 |

**핵심 규칙**:
- **승인(Accept)의 용도 = AI 분석·알고리즘 성능 측정용 가상 포트 확정**. 실제 자금 운용 강제 아님.
- **Q10 "독립 자금·독립 의사결정"** = 위 (2)(3)(4)의 실제 체결 레이어. 각자 독립.
- **선착순 단일 Accept**(§3.3 R3.3-2) = 가상 포트 기록 1건. Q10 독립 자금과 충돌 없음(실제 체결과 분리되어 있으므로).
- §4.2 E5 PortfolioSnapshot은 실제 증권사 계좌 포지션과 별개의 **가상 트래킹**이다.

```
┌────────────────────────────────────────────────────────────┐
│                   주픽 어드민 서비스                         │
├────────────────────────────────────────────────────────────┤
│  (1) AI 가상 포트폴리오 [본체]                              │
│      Short List 30 → 투심위 → Accept → 가상 트래킹           │
│      (NSM·Anti-Metric 측정 대상)                            │
│                                                            │
│  (2) 매뉴얼 트레이딩 서브시스템                              │
│      E9 BrokerageConnection → 수동 주문                     │
│                                                            │
│  (3) 자동매매 서브시스템 (S8 구현)                           │
│      주식: E9 BrokerageConnection (KIS 모의→실계좌)          │
│      코인: E12 ExchangeConnection (바이낸스 테스트넷→메인넷) │
│      Strategy 폴더 drop-in + AI 어댑터 embed 인터페이스      │
│      대상: Short List / 자유 종목 / 바이낸스 선물 선택 가능  │
├────────────────────────────────────────────────────────────┤
│  (4) 외부 바이패스: 어드민이 본인 증권사 앱 직접 사용         │
└────────────────────────────────────────────────────────────┘
```

### §1A.1 Product Vision

> "내 돈으로 직접 운용하는 투자자가, AI 가상 펀드매니저의 **투명한 분석**을 믿고 매달 30종목을 승인하며, 12개월 뒤 **자기 이름으로 된 트랙 레코드**를 손에 쥔다."

- 3대 약속: **투명한 분석** · **끊기지 않는 루프** · **측정 가능한 성과**
- 검증 체크포인트: **M6 행동 지표** (아침 10분 루틴 · Excel 중단 · 첫 Exit 경험) / **Y1 정량 목표** → §1.7

### §1A.2 Unfair Advantages (복제 장벽)

| # | 제목 | 복제 장벽 |
|---|------|----------|
| **UA1** | **투심위 2-Layer 투명성** — Core 11 + Sector Board (canonical 14 sectors × 14 personas overlay = 207 roster, per-stock 14인 활성화 — D21 정정 박제), 찬반·논거 리포트 기록 | 프롬프트로 복제 불가. 운용 철학 + 섹터 전문성 + 토론 구조 내재화 필요 |
| **UA2** | **Quant 3축 Early Warning + Crisis Layer** — 7~15일 선행, 5-Signal Composite(MA구조·모멘텀·변동성·거래량·RSI) | v1→v6 백테스트 데이터 + 파라미터 튜닝 축적물. 공개 전략 패턴 아님 |
| **UA3** | **투자 결정 루프 완성** — 선정→리포트→승인→모니터링→Exit→트랙 레코드 단일 시스템 | "시간 효과" — 12개월 운용 데이터가 쌓일수록 AI 보정·오버라이드 패턴·트랙 레코드 가치 누적 |

경쟁 포지셔닝 매트릭스·8사 비교 → `.omc/research/competitors.md`.

### §1A.3 북극성 지표 (NSM) + 측정 스펙

**NSM**: **연속 승인 월수 (Consecutive Approved Portfolio Months / CAP Months)**
- 정의: 어드민이 AI Short List를 검토·승인하여 가상 포트폴리오 트래킹이 시작된 연속 월수
- Y1 목표: **12개월 연속** → Core JTBD 1:1 대응
- **포함 규칙 (P5 I-12 박제)**: Reject → 재분석 → Accept로 **최종 승인된 월도 CAP Months에 포함**한다. Reject 최종(재분석 후에도 Reject)은 미포함(R3.3-4). 미달 월(30종목 미만)은 전월 포트 유지로 운용 연속성이 유지되므로 포함(§3.2 미달 정책 b).

**서포팅 입력 지표 5개**:

| ID | 지표 | 측정 | 목표 | 주기 |
|----|------|------|------|------|
| IM-1 | 리포트 소비율 | 신규 편입 종목 Section 0+ 열람 비율 | 신규 100%, 전체 80% | 월간 |
| IM-2 | 승인 리드 타임 | `shortlist.generated` → `portfolio.approved` 경과 일수 | ≤ 5일 | 월간 |
| IM-3 | Exit 시그널 신뢰도 | 시그널 발송 후 T+7일 추가 하락 비율 | 65%+ | 분기 |
| IM-4 | 모닝 브리핑 참여율 | 장운영일 중 브리핑 열람 일수 / 총 장운영일 | 80%+ | 주간 |
| IM-5 | 누적 Alpha | 승인가 기준 포트 수익률 − KOSPI 동기간 | 양(+) | 월간 |

**이벤트 트래킹 스펙** (B3 구현 시):

| 이벤트 | 속성 | 연결 |
|--------|------|------|
| `shortlist.generated` | month, timestamp, new_count, hold_count, removed_count | IM-2 시작 |
| `report.view` | ticker, section, admin_id, timestamp, duration_sec | IM-1 |
| `portfolio.approved` | month, admin_id, timestamp, approval_type (accept/reject) | NSM, IM-2 종료 |
| `briefing.viewed` | admin_id, channel (telegram/dashboard), timestamp | IM-4 |
| `exit.signal.sent` | ticker, severity, timestamp, trigger_reason | IM-3 시작 |
| `exit.signal.outcome` | ticker, signal_timestamp, t7_price_change | IM-3 결과 |
| `portfolio.daily_snapshot` | date, total_return, kospi_return, alpha, sharpe | IM-5 |

**리뷰 프로토콜**: 주간(IM-4) · 월간(NSM + IM-1·2·5) · 분기(IM-3 + NSM 정의 유효성) · Y1말(NSM 달성 → Decision Tree 발동)

### §1A.4 Anti-Metrics (경계 지표)

| 지표 | 임계치 | 의미 | 방어 기능 |
|------|--------|------|----------|
| AI API 월 비용 | > 40만원 | 리포트 생성 비용 초과 → 모델·프롬프트 최적화 필요 | **M17(실시간 비용 모니터링 + 35만원 경보 + 40만원 하드 캡)** |
| 어드민 오버라이드 비율 | > 50% | AI 신뢰 실패 → 투심위 품질 재검토 | §3.3 승인 로그 + M16 Counterfactual |
| Exit 시그널 미수신 | 1건+ | 시스템 신뢰 붕괴 (전 페르소나 최대 불안 트리거) | M15 백업 채널(D10) · **M18 파이프라인 헬스체크** · **M19 Silent Health 하트비트** |
| 리포트 생성 실패 | Short List 30 중 1건+ | 데이터 파이프라인 장애 | **M18(파이프라인 헬스체크 + 95% 미만 즉시 호출)** · **M19(일간 하트비트로 조용한 장애 방지)** |

> **AI API 비용 추정 재산정 과제 (P5 I-03 박제)**: Tier 1(30종) 기준 정기 배치 실제 비용을 BuildPhase B3.3 직전 dry-run으로 실측. 추정 비용이 30만원 초과 시 프롬프트 압축 · Sector Board 샘플링 축소 등을 선제 적용하여 40만원 하드 캡 진입을 예방한다. 월 누적 AI 비용 35만원 경보 / 40만원 도달 시 자동 재생성 차단은 §3.9 M10 DoD에 박제.

### §1A.5 해소된 결정 (P3.0 Q&A, 2026-04-15)

> Pre-P3 Q&A 세션에서 9개 의제 전부 사용자 결정. 본 표가 SoT. §1.3·§1.4·§3·§4·§1.7 본문에 반영.

| # | 의제 | 결정 | 박제 위치 |
|---|------|------|----------|
| **D1** | Reject 후 처리 | AI 즉시 재분석 1회 → 재분석본도 Reject 시 **전월 포트 유지** | §1.3 J1 |
| **D2** | 미승인 마감 | **D+5 영업일** 미승인 시 전월 포트 유지 + 텔레그램 경고 | §1.3 J1 |
| **D3** | 가상 포트 체결 가정 | 승인 시점 **종가로 100% 일괄 매수** (단순 가정) | §1.3 J4, §3 |
| **D4** | 현금 비중 | AI가 비중 결정 시 **현금 비율도 제안 (0~30%)** | §1.3 J1, §3 |
| **D5** | 분석엔진 MVP 표시 | **5-Signal Composite 점수 + 3축(추세·모멘텀·변동성) 각각 별도 표시** + 신호 텍스트 | §3 |
| **D6** | Short List 30 vs 백테스트 갭 | **Must 고정 (MVP 축소 불가)**: Short List **30 (단기 10 · 중기 10 · 장기 10)** 표시. 종목 수·관점 분배 변경 금지. 분석 로직 = **인디케이터(숫자 에이전트) + AI 투심위(Core 11 + Sector Board canonical 14 sectors × 14 personas overlay, `ReportFramework.md`) 판단 기준 + 리포트 워딩(Section 0~8)** **병렬 + 합의** 구조 — **D19 (2026-05-08, 35차)에서 직렬→병렬+합의 강화 · D21 (2026-05-20, 52차)에서 slot 모델 정정**. **백테스트는 6종목에서 시작 → 같은 알고리즘으로 점진 확장**. 백테스트 6종 단기/중기/장기 배분은 P3.1/B3에서 결정 (Short List 30 노출 구조와는 무관). | §3, §4, D19, D21 |
| **D7** | 상시 모니터링 모드 | **MVP 포함**. 단, 임계치 설정 UI는 단순화(디폴트 임계치 + 종목별 on/off만) | §1.4, §3 |
| **D8** | 리포트 재생성 cap | Reject 시 자동 재분석 **월 1회** + 어드민 수동 재생성 **종목당 월 2회**까지 (Anti-Metric AI 비용 40만원 고려) | §3 |
| **D9** | Y1 Decision Tree 대시보드 | **`/admin/decision-tree` 별도 화면** (BusinessPlan §Q4 진척도 — alpha·Sharpe·CAP Months vs 목표) | §1.7, §2 |

**보류 (서비스 설계 비영향)**:
- **Q12 공동창업자**: 어드민 인원 = **3명 가정** (본인 + 공동창업자 2명). 실존 여부는 서비스 설계에 비영향 — 계정 수 차이뿐. §1.1 반영.

> 가격 전략: 월 19,900원은 BusinessPlan §Q11 확정. BEP 51명(cap 10.2%). 추가 근거 문서 없음.

#### P5 검증 추가 결정 (v1.0, 2026-04-15)

| # | 의제 | 결정 | 박제 위치 |
|---|------|------|----------|
| **D10** | Exit 시그널 백업 채널 | Critic I-01 해소 — 텔레그램·이메일 중 하나 실패 시 다른 채널 catch-up. ~~둘 다 실패 시 SMS 1회 재시도~~ → **2026-04-19 (22차) 재결정**: **SMS 제거**, 2채널(텔레그램+이메일) + 이메일 재시도 + 대시보드 배지로 축소. 어드민 3명·500cap 초대제에서 SMS 추가 가치 낮음, 텔레그램 푸시가 잠금화면 알림 대체. BL-12 폐기. | §3.10 R3.10-15 |
| **D11** | 어드민 실행 모델 | Critic I-05 해소 — 주픽 어드민 = **AI 가상 포트 본체 + 2개 집행 서브시스템 + 외부 바이패스**(3경로 + 1 바이패스). 승인(Accept) = 가상 포트 확정이며 실제 체결 강제 아님. 선착순 단일 Accept는 가상 포트 기록 1건으로 Q10 독립 자금과 충돌 없음. | §1A.0 신설 · §1.5 · §3.3 · §4.2 E5 |
| **D12** | 어드민 증권사 API 다중 연결 | 신규 엔티티 E9 BrokerageConnection 추가. 어드민별 증권사·거래소 N개 앱키 등록, 동일 증권사라도 전략별 복수 등록 허용. scope(manual/auto/both) 구분. 시크릿 Vault 참조·평문 금지. | §4.2 E9 신설 · §4.3 · §4.5 |
| **D13** | 멤버 스코프 축소 | Critic I-11 대응 — 멤버는 **법적 문제 없는 리서치 웹페이지 수준**으로 축소. 어드민 3명 전용 운영 중심. 멤버 서비스 재정의는 `ServicePlan-Member.md` 별도 처리. | §6 연결점 |

**Must 승격 완료 (D14, v1.1)**:
- **D-OOS-6 AI API 비용 모니터링 대시보드** → **M17로 승격 완료**. Anti-Metric "월 40만원" 실시간 추적·35만원 경보·40만원 하드 캡. 박제 위치: §3.12 M17.
- **D-OOS-7 데이터 파이프라인 헬스체크 대시보드** → **M18로 승격 완료**. 5개 핵심 파이프라인 성공률 모니터링·95% 미만 즉시 호출. 박제 위치: §3.12 M18.
- **Silent Health 하트비트** → **M19로 신설·Must 확정**. 일간 "오늘 이상 없음" 브리핑으로 조용한 장애 원천 차단. 박제 위치: §3.12 M19.

**Q-OP 유보 해소 (D15, v1.1)**:
- **승인 Holding Period 24시간 + 2인 열람 게이팅 + 이의 제기 48h** → **도입 완료**. R3.3-7~R3.3-10 박제. D1 "선착순"은 유지하되 "24h 숙고 완료 + 2인 이상 풀 리포트 열람" 이후에만 Accept 버튼 활성. 연휴 우회 조항(24h vs D+4 영업일 중 짧은 쪽). B·C 이의 제기 시 48h 추가 Hold. 박제 위치: §3.3 R3.3-7~10.

**Q-OP 유보 고정 (개발 완료 전까지 재질문 금지, v1.1)**:
- **Q-OP3 멤버 유료 모델 재검토 (D13 파생)**: BusinessPlan §Q11(월 19,900원) 유지 전제. 어드민은 지불 주체가 아님 — "돈은 멤버 플랜에서 나옴, 어드민은 누가 돈내고 씀"이라는 사용자 피드백 박제. 개발 완료 전까지 재질문 금지.
- **Q-OP4 Y1 법적 등록 재검토**: 변호사 자문 결과가 도출되기 전까지 유보. 개발 완료 전까지 재질문 금지.

### D14·D15 요약 표

| # | 의제 | 결정 | 박제 위치 |
|---|------|------|----------|
| **D14** | Q-OP1 해소 — Anti-Metric 방어 3건 Must 승격 | D-OOS-6 → **M17** AI API 비용 모니터링 · D-OOS-7 → **M18** 파이프라인 헬스체크 · 신규 **M19** Silent Health 하트비트. Must 16 → **19**. Anti-Metric 4종 전부에 방어 기능 링크 확보. | §3.12 신설 · §1A.4 방어 기능 열 추가 |
| **D15** | Q-OP2 해소 — 승인 Holding Period 24h + 2인 게이팅 + 이의 48h | R3.3-7 24h Hold(연휴는 24h vs D+4 영업일 중 짧은 쪽) · R3.3-8 2인 풀 리포트 열람 이후에만 Accept 활성 · R3.3-9 연휴 우회 조항 · R3.3-10 B·C 이의 시 48h 추가 Hold. D1 "선착순" 유지, 게이팅 조건 추가. | §3.3 R3.3-7~10 · §4.2 E4 Holding 필드 |
| **D16** | 어드민 내부 도구 재정의 + 자동매매 S8 승격 + Stage 어휘 폐기 (2026-04-21) | (a) 어드민은 본인+친구 3명 내부 투자 도구. Must 19/MVP Stage 어휘는 어드민 트랙 강제 게이트 아님. (b) 구 트레이딩 3-Stage(매뉴얼→API→AI 자율) 폐기, 자동매매 = S8 단일 슬라이스 통합. (c) 자동매매 자산군: 주식(KIS) + 바이낸스 선물. 대상: Short List/자유/선물 선택. (d) Strategy drop-in + AI 어댑터 embed 이중 경로. AI 본체는 어드민 추후 drop-in. (e) 리스크 기본값: 레버리지 ≤5x · 일일 -3% 정지 · AI 일 주문 ≤20회. (f) Deferred-X → S8 승격, Deferred-Y → S8 AI 어댑터에 흡수 예정. | §0 재정의 · §1.5 AI 경계 보강 · §1.6 Non-Goals 재작성 · §1A.0 (3) 업데이트 · §2 S8 라우트 블록 · §3.13 신설 · `Slices/S8-AutoTrading.md` 신설 |
| **D17** | Admin Credential System 재설계 + DQ-7이 S7a보다 선행 (2026-04-22) | (a) KIS·Binance API 키는 env pre-wire 폐기 → 어드민 각자 UI 입력 · DB 암호화 저장. (b) 암호화 = **App-layer AES-256-GCM** (Node crypto stdlib, zero-dep · MEK는 Vercel env `API_CRED_MASTER_KEY`). (c) DB 스키마 = **분리 2 테이블** (E9 확장 + E12 신설 · provider-specific divergence 대응). (d) Vercel 첫 프리뷰 배포를 DQ-7 슬라이스에서 수행(최소 env 7개). (e) "테스트 연결" 버튼은 DQ-7에서 UI만 · 실 ping은 S8-Scaffold T8.4에서 연결. (f) **실계좌·메인넷 저장 권한 = 대표 1인** (env `ADMIN_REP_EMAIL` 신설). (g) 마이그레이션 번호 재배정: 0009 = DQ-7 credential 선점 · 0010 = alert_event CHECK 확장(BL-KRIT-7). (h) S8-AutoTrading T8.4·T8.5 UI는 DQ-7에서 선행 이관, S8 Scaffold는 `/risk`·`/strategy`·`/trading/*` 4 라우트만 담당. | §4.2 E9 필드 재정의 · §4.5 시크릿 정책 갱신 · E12 ExchangeConnection 정책 신설 · `Slices/DQ7-Credentials.md` 신설(SoT) · S8-AutoTrading.md T8.4 주석 |
| **D18** | S8 자동매매 진입 시점 재조정 + KIS 발급 비블로커화 + D11 가상 포트 운용 검증 게이트 (2026-05-08, 34차) | (a) **S8 자동매매를 S7 series 다음으로 분리**. v2 "S7e 직후 S8-Scaffold 병행 + S7c·S7d 강등 큐" 폐기. v3 시퀀스 = `S7a → S7e → S7b → ★ D11 AI 가상 포트 1차 가동 (KIS 0개) → 운용 검증 며칠~1주 → S7c (KIS 본인 1개 read-only) → S7d → S8 자동매매 (KIS 자동매매 권한)`. (b) **KIS 용도 명확화**: KIS는 자동매매 전용. 일간 데이터·리포트·AI 가상 포트는 KRX/pykrx/DART/네이버로 충분 (KIS 0개로 작동). S7c WS 실시간 시세는 본인 1개로 충분. (c) **son00326·Kevin KIS 발급 지연 = S7c까지 비블로커** (BL-KRIT-2 영향 범위 축소). S8 진입 시점에 (i) 3명 각자 계정 동시 또는 (ii) 본인 단독 자동매매 + 친구 2명 모의/외부 바이패스 결정. (d) **D11 AI 가상 포트 운용 검증을 S8 선행 게이트로 명시** — 가상 포트 의사결정 품질을 어드민 3인이 며칠~1주 사용해 본 후 자동매매 도입. v2의 자동매매 최단 경로 가정 폐기. (e) S7c·S7d 강등 큐 폐기, 정규 시퀀스 복귀. 자동매매 실체결 도달 = v2 9세션 → **v3 약 12~14세션** (D11 운용 검증 추가). | `Slices/S8-AutoTrading.md` 선행 조건·Phase 헤더·status 필드 + `ProgressDashboard.md §2` v3 다이어그램 + `HANDOFF.md §2.D` (후속 슬라이스 시퀀스) + `CLAUDE.md` 상단 시퀀스 |
| **D20** | Section 8 위원별 전원 표 박제 — Sector 14명 + Core 11명 한 줄 의견 (2026-05-12, 45차) | (a) **Section 8 정적 표 4종 박제**: ① Sector Board 위원별 한 줄 의견 표(해당 섹터 14명 전원), ② **Core 11 위원별 한 줄 의견 표(11명 전원, 신규)**, ③ 쟁점별 찬반 토론 인용 3~5건, ④ 최종 합의 패널(Sector·Core 집계 + Co-Chair 만장일치 여부 + 공식 판정 + 근거). (b) **사용자 요구 직접 반영**: 사용자가 카드 1~2줄 합의 코멘트 외에 "각 페르소나가 어떤 평가를 내렸는지"를 풀 리포트에서 볼 수 있도록 요구. Reference `Document/Outputs/Report-Alteogen_196170_v3-Readable.md` §Section 8 Part A 패턴을 Core·Sector 양쪽에 대칭 적용. (c) **인터랙티브 페르소나 탐색은 Should S2 유지** — 위원 이름은 비-인터랙티브 텍스트, 클릭→풀 프로필 모달은 MVP 외. (d) **카드 1~2줄 합의 코멘트와 분업**: 리스트 화면(/admin)에서는 1~2줄 합의 발췌만 노출, 풀 리포트 Section 8에서 11명+14명 전원 한 줄씩 + 쟁점별 인용 + 최종 합의. (e) DB 영향 없음 — `committee_votes` 테이블(0003)에 11+14명 row가 이미 들어가도록 박제됨. R3.7-6/7/8 본문만 보강. | §3.7 R3.7-6/7/8 보강 · M3 AC·DoD 갱신 · 본 §6 D20 항목 |
| **D22** | Tier 2 production sector persona prompts quality target = Kevin v3.1 reference **코드 박제 완료 (53차 §3, PR #8 OPEN)** | (a) **product/spec decision**: D21에서 박제한 canonical 14 sectors × 14 personas/sector overlay (196 persona)의 **실제 production system prompts**가 **53차 §3 Layer (a~g) ALL CONVERGED**로 박제 완료 — `tudal/src/lib/ai/prompts/kevin-v31-rubric.ts` (4 inquiry axes + 8 quality markers + applyKevinV31Rubric helper) + `personas/sector-persona-builder.ts` 확장 + `personas/index.ts` Core 11 wrapping. 207 persona × 8 markers = 1656 assertions 전수 통과. 회사명 50+ tokens grep 0. (b) **Kevin v3.1 reference 자료** (main 보존, 53차 §0 stale-fix 박제로 origin/IMVCOM 4 commits 모두 main ancestor 확정): `Document/Outputs/Report-Alteogen_196170_v3-Readable.{md,html}` + `Document/Service/Report/ReportFramework-v3-{DraftPhilosophy,NarrativeDesign,Decisions,ValuationTrial}.md` + `ReaderAnalogyCards-ConstructionToBio.md` + Samchundang + BioSectorReport-Alteogen. **Step 3a SKIPPED** (53차 §0 박제 — IMVCOM 이미 main ancestor). (c) **Step 3b 진행 순서**: 53차 §2 builder PR #7 MERGED `02c7947a` → 53차 §3 Layer (a) Kevin rubric SoT → Layer (b~e) sector philosophies + base + overlay principles → Layer (f) Core 11 inject → Layer (g) builder cleanup + 196 coverage + 회사명 cleanup → PR #8 OPEN. (d) **quality follow 항목 코드 박제**: 4 inquiry axes (Q1~Q4) + 8 markers (M1 axes / M2 financial cite / M3 no-fabrication / M4 peer / M5 valuation trial / M6 BUY/HOLD/SELL / M7 일상 비유 / M8 200자 cap) + persona individuality wrapper + 회사명 invariant + 28 manual review sample fixture (docs/superpowers/snapshots/2026-05-21-step3b-prompt-samples.md). | 본 §1A.5 D22 (본 행, 53차 §3 갱신) · §8 v1.8 changelog · `Document/Process/HANDOFF.md §5 SoT 표 + §9 운영 원칙 박제 [[handoff_kevin_v31_quality_target]]` + `docs/superpowers/specs/2026-05-21-kevin-v31-rubric.md` (rationale) + `docs/superpowers/snapshots/2026-05-21-step3b-prompt-samples.md` (manual review only) 동시 박제 |
| **D21** | Tier 2 Sector Board slot 모델 정정 — Option C overlay 14 personas/sector 박제 (2026-05-20, 52차) | (a) **slot 모델 정정**: D19에서 사용된 "Sector Board 14 sectors / 10 slots per sector (= 140 페르소나 roster)" 표현은 §4.2.1 partA contract (`length ∈ {0, 14}`)와 사전 충돌이었음. **본 D21에서 Option C overlay 박제** = **canonical 14 sectors × 14 personas/sector** (10 base slot + 2 primary overlay + 2 sub_tag overlay). roster total = 14 × 14 = 196. per-stock 활성화 = 해당 섹터 14인. partA contract는 D21 supersession 후 정확. (b) **sub_tags jsonb crosswalk 7개** (`short_list_30.sub_tags`, mig 0018): 조선→운송/물류 · 방산→철강/소재 · 화학→철강/소재 · 게임→IT/SW (primary) + 엔터/미디어 (secondary) · 가전→유통/소비재 · 제약→바이오 · 부동산→건설. **운영 UI taxonomy proxy** (개념 정합 아님 — canonical 14 유지 목적). (c) **`tudal/src/lib/screening/canonical-sectors.ts` 신규** (hardcode 14 sectors + 10 base slot + 2 primary overlay + 2 sub_tag overlay + sub_tag crosswalk + LEGACY_ALIAS_MAP 좁게). 본 PR 시점 production code import 0 (tests/만). (d) **마이그 0018**: `short_list_30.sub_tags jsonb NULL` 추가 + GIN index. row backfill 없음 (Tier 2 impl PR 책임). (e) **`commit_sector_personas` 신규 RPC** = **Tier 2 implementation PR scope (본 PR OOS)**. (f) cost worst-case = Core 11 + Sector 14 + chair 1 = 26 calls/stock × 30 = 780 정기 + regen 2× = 2,340 worst-case ≈ 33만원 cache-off (M17 400k hardcap 내). (g) **D19/D20 본문 inline 정정**: 모든 "Sector Board 14 sectors / 10 slots per sector" 어휘 = "Sector Board canonical 14 sectors × 14 personas overlay"로 치환. supersede 주석 추가. | §1A.5 D21 신설 (본 행) · D6 본문 보강 · §3.2 R3.2-4 inline 정정 · §3.7 R3.7-6 inline 정정 · §4.2 E1 ShortList30 sub_tags 컬럼 행 추가 · §4.2.1 partA 주석 ("14 = overlay 후 canonical fixed") · §8 v1.7 changelog · `Service/Report/ReportFramework.md` §7.2 14-slot 재작성 + §7.3 sub_tag 크로스워크 표 신설 + §8 v2.5 + §10 v2.5 · `tudal/src/lib/screening/canonical-sectors.ts` 신규 · `tudal/supabase/migrations/0018_short_list_30_sub_tags.sql` + rollback · `Document/Process/HANDOFF.md` §6 51차 next-action 갱신 |
| **D23** | shortlist 30종목 + 풀 리포트 흐름 정정 박제 (2026-05-21, 53차 §5) — D19/D21/D22의 supersession entry, 박제 vs 코드 mismatch 정정 | (a) **product/spec decision (사용자 lock-in 8 항목)**: ① 30종목 선정 흐름 = Tier 0 인디케이터·DART numeric narrow → Tier 1 Core 11 AI 평가 + 시간대별 페르소나 가중치 → 단/중/장 top 10 = 30 (AI가 단/중/장 분류 결정에 직접 영향, Tier 0 단독은 fallback). ② 풀 리포트 흐름 = writer Section 0~7 통합 + Tier 2 sector 14 페르소나 Section 8 partA/partD = **단일 산출물**. 선정 30 = 풀 리포트 30. ③ AI 호출 트리거 3 path = (a) cron 매월 자동 / (b) reject 후 trigger 버튼 / (c) 종목별 Regen 버튼. ④ UI 흐름 = `/admin` 또는 `/admin/portfolio` 30종목 리스트 → 종목 클릭 → `<details>` accordion 펼침 → "풀 리포트" 버튼 → `/admin/report/[ticker]`. ⑤ Track Record 의미 재정의 = 누적 성과 + 월별 리포트 아카이브 **한 페이지 탭 분리**. ⑥ Kevin v3.1 quality target 박제 (D22 박제 보존, 53차 §3 PR #8 머지). ⑦ Sector reference 자료 3-level 분류 (Level A 본문 reference 2/12 · Level B §9.2 체크리스트 4/10 · Level C SECTOR_PHILOSOPHIES 14/0). ⑧ API 금액 무관 — Tier 1 호출 범위(60/90/150) 후속 PR2 결정. (b) **박제 vs 코드 mismatch Group A-H (8 그룹)**: Group A track-record가 trigger 위치 박제 (실제 = 누적 성과 read-only) · Group B 30종목 선정 AI 부재 (현 코드 = Tier 0 단독 30 직선정, fallback이 메인 path로 굳어진 상태) · Group C cron monthly-batch mock dry-run only · Group D Step 3c "DONE" 박제 (실제 = PARTIAL — dangling server action `triggerMonthlyPersonaEvalAction`) · Group E writer Section 0~7 본문 미구현 박제 누락 (현 코드 = `section_8` jsonb commit만 가능) · Group F Track Record 의미 박제 (누적 성과 vs 과거 아카이브 분리 누락) · Group G Sector reference 3-level 분류 (본문/체크리스트/philosophies 미분리, "12 부족" 어휘 모호) · **Group H Critical** stock_reports schema drift + report page crash 위험 (admin-reports.ts validation 0 + page.tsx section0.conviction early deref + Section 0~7 nested deref + Section 8 partA/B/C/D 신규 shape vs old conclusion/recommendation/keyQuotes shape mismatch). (c) **canonical 후속 implementation 순서 (PR scope)**: **PR2 (Tier 1 AI 30 선정 screening) → PR3a (Group H schema drift fix Hard gate) → PR1 (cron monthly-batch real path, server-side only) → PR3b (writer Section 0~7 본문 구현) → PR4 (UI trigger 버튼 + Track Record 탭 + Regen 실 호출 wire)**. **Hard gate (PR1 ⊥ PR3a 미선행 = page crash inevitable)** — 사용자가 종목 클릭 시 `section0.conviction` early deref crash. (d) **OMXY 적대적 검토 R1~R5 누적 21 BLOCKERS catch & fix** (R1 6 BLOCKERS · R2 4 BLOCKERS · R3 6 BLOCKERS · R4·R5 5 BLOCKERS · 21 total). (e) **spec doc path**: `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md` (전문 SoT). (f) **정정 대상 file matrix**: HANDOFF.md (§0·§1·§2.1·§3·§6) + ServicePlan-Admin.md (§1A.5 D19·D23 신설·§3·§4 E1·§8 v1.9) + ReportFramework.md (§8 Step 0·1~4·§9.2) + ProgressDashboard.md (Step 3c 행 + 잔여 task) + CodebaseStatus.md (writer.ts·dangling exports·short_list_30·Group H schema drift·Regen 미구현) + CLAUDE.md (상단 시퀀스 v3.3) + S7-RealData.md (T7e.8 fallback 명시). | §1A.5 D23 신설 (본 행) · §1A.5 D19 inline 정정 (메인 path/fallback 분리) · §3 페이지 IA 정정 (track-record 탭 분리 + report/[ticker] 풀 리포트 + portfolio 30종목 + UI 흐름) · §4 E1 short_list_30 현재 상태 박제 (현재 = Tier 0 단독 30 / 정정 후 = Tier 1 AI 30 PR2 후속) · §8 v1.9 changelog · spec doc `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md` |
| **D19** | JooPick AI 강화 — Tier 0/1/2 병렬 + 합의 배지 + Reflection (2026-05-08, 35차) — **D23 (53차 §5)에서 메인 path vs fallback 어휘 정정 박제** | (a) **Short List 30 선정 = "숫자(인디케이터) + AI(Core 11 페르소나) 병렬 + 합의 에이전트" 구조 박제**. 외부 레퍼런스 [TauricResearch/TradingAgents](https://github.com/TauricResearch/TradingAgents) Analyst Team + Reflection 패턴 차용 + JooPick 박제 (Core 11 + Sector Board canonical 14 sectors × 14 personas overlay) 보존 — **slot 모델 = D21 (52차) supersede**. (b) **Tier 0 — 인디케이터·DART numeric narrow (메인 path 1단계)**: pykrx·KRX·DART로 코스피·코스닥 ~2,500종 → 5-Signal Composite × 시간대별 가중치 → 단/중/장 후보 50씩 = 150. AI 키 없이도 후보 150 산출 가능. **AI 키 발급 후 = Tier 1 입력**. **AI 키 미발급 시 fallback = Tier 0 단독 30 직선정** (현 production 상태, D23 §5 정정 박제). (c) **Tier 1 — Core 11 페르소나 평가 + 시간대별 페르소나 가중치 (메인 path 2단계, 메인 path 30 선정 결정자)**: 150 후보 → 시간대별 페르소나 가중치 (단기엔 Druckenmiller·Burry ↑, 중기엔 Lynch ↑, 장기엔 Buffett·Munger·Fisher·Pabrai ↑) → 단/중/장 각 top 10 = 30 선정. **AI가 단/중/장 분류 결정에 직접 영향** (D23 §5 lock-in 1.1 박제). **현 코드 상태 = 미구현 (PR2 후속)**. (d) **Tier 2 — Sector Board overlay 활성화 (선정된 30종목만)** — **D21 정정**: 종목별 해당 섹터 14인 활성화 (canonical 14 sectors × 14 personas/sector roster 중 매칭 섹터의 14인). 종목당 Core 11 + Sector 14 = 25명 (+ chair 1 = 26) × 30종 ≈ 780 LLM call/월 정기 (+ regen worst-case 2,340 ≈ 33만원 cache-off, M17 hardcap 40만원 내). Section 0~8 풀 리포트 + 쟁점별 찬반 대결 (현 §5 박제 그대로). (e) **합의 에이전트 — 5종 배지 (49차 Q5b CONVERGED)**: 🟢 강한 합의 (둘 다 추천 우선) / 🔵 숫자 우세 (모멘텀 강하나 정성 우려) / 🟣 AI 우세 (정성 좋으나 차트 약함) / 🟡 **관망** (둘 다 비-top tier, 시기 미상 — Q5b 49차) / ⚪ AI 분석 대기 (AI 키 미발급 placeholder). 어드민 Short List 30 카드에 🔢 숫자 점수(0~100) + 🤖 AI 점수(0~100) + 합의 배지 + AI 코멘트 1~2줄 노출. 클릭→풀 리포트(Section 0~8). (f) **Reflection — 자가학습 (TradingAgents 차용)**: 매월 말 지난달 추천 30종목의 실현 수익률 → 다음달 Tier 1 prompt에 주입 → 페르소나 가중치 자가조정. trading_memory 패턴. (g) **메인 path vs fallback 분리 (D23 §5 정정 박제)**: **메인 path** = Tier 0 인디케이터·DART numeric narrow → Tier 1 Core 11 AI 평가 + 시간대별 페르소나 가중치 → 단/중/장 top 10 = 30 선정 + Tier 2 sector 14 페르소나 Section 8 partA/partD plug-in (선정된 30종목만). **fallback** = AI 키 미발급 시 Tier 0 단독 30 직선정 (현 production 상태, PR2 미진입). **AI 키 발급 후** = Tier 1 AI 30 선정 enable + Tier 2 plug-in. (g') **Tier 1 호출 범위 = open question (D23 §5 lock-in 1.8 박제)**: 150 후보 전체 호출 / 60 narrow (단/중/장 20씩) / 30 narrow 중 후속 PR2에서 결정 — 사용자 명시 "API 금액 무관, 비용 결정 후속 PR로". (h) **Smoke #3 (Binance) ⏸ 유예**: Binance 키 미발급 + S8 자동매매 분리(D18) → S8 진입 시점에 진행. DQ-7 Session 3 종결 = Smoke #4·#5만으로. | §1A.5 D19 신설 · D6 본문 보강(병렬 + 합의) · §3.1 R3.1-6 신설(이중 배지·합의·AI 코멘트 1~2줄) · §2 라우트 블록 컬럼 명세 갱신 · `Service/Report/ReportFramework.md` §8 Step 0 + Step 4 후속 보강 · `Slices/S7-RealData.md` Tier 0 분기 + 30개 검증 DoD · `Slices/DQ7-Credentials.md` Smoke #3 ⏸ 유예 · `ProgressDashboard.md §2` v3.1 다이어그램 + Tier 0 게이트 박스 · `HANDOFF.md §1·§2·§4·§7` · `CLAUDE.md` 상단 시퀀스 v3.1 + D19 라인 · **D23 (53차 §5) 정정 박제 (메인 path/fallback 분리 + Tier 1 호출 범위 open question)** |

---

## 2. 화면 IA · 라우트

> **P3.2 확정 (2026-04-15)**. 상세 IA·네비게이션 전환 맵·4여정 Entry Path → `.omc/research/p3-2-information-architecture.md`.

- **라우트 그룹**: `app/(admin)/` 신설. `(admin)/layout.tsx`에 어드민 전용 레이아웃(Header·Sidebar·Footer) + Supabase role 가드 미들웨어. 기존 `(auth)`·`(main)` 그룹과 분리.
- **메인 7 + 서브 3 = 총 10 라우트**:
  - `/admin` — Short List 30 홈 (단기10·중기10·장기10) + 일간 요약 상단 고정. **D23 (53차 §5)**: 30종목 리스트 (`ShortlistRow` accordion `<details>` native). 종목 클릭 → details 펼침 → "풀 리포트" 버튼 → `<Link href="/admin/report/[ticker]">`.
  - `/admin/report/[ticker]` — **풀 리포트 페이지** (Section 0~7 writer 본문 + Section 8 partA/B/C/D Tier 2 sector 14 페르소나 + Appendix). **D23 (53차 §5)**: 30종목 클릭 시 진입하는 단일 산출물. 선정 30 = 풀 리포트 30 (분리되지 않음, lock-in 1.2). 현 코드 상태 = Group H Critical schema drift (section0.conviction early deref 위험, PR3a fix 선행).
  - `/admin/report/[ticker]/regenerate` (D8) — 재생성 확인 + cap 상태 (서브라우트, 구현은 인터셉트 라우트 모달 가능 — B3 결정). **D23 (53차 §5)**: 종목별 'Regen' 버튼 = AI 호출 트리거 (c) path. 현 코드 = UI + quota counter 박제, 실 AI 재생성 호출 0 (PR4 wire).
  - `/admin/portfolio` — AI 비중 제안·현금(D3·D4) + Accept/Reject 승인(D1·D2). **D23 (53차 §5)**: 30종목 리스트 (`ShortlistRow` accordion) + **(PR4 후) trigger 버튼** (사용자 reject 후 새 30 선정 + 새 풀 리포트 = AI 호출 트리거 (b) path) + **종목별 Regen 버튼** (c) path 실 호출. 현 코드 상태 = trigger 버튼 UI 0, server action `triggerMonthlyPersonaEvalAction` dangling (PR4 wire).
  - `/admin/alerts` — 긴급 알림 이력 (Amber/Orange/Dark Purple 심각도)
  - `/admin/alerts/[id]` — 알림 상세 (트리거·심각도·대안 시나리오 + §7 Exit 대조)
  - `/admin/track-record` — **누적 성과 + 월별 리포트 아카이브 한 페이지 탭 분리** (D23 (53차 §5) lock-in 1.5 박제). **탭 1** = 누적 성과 (월간/누적 수익률·Sharpe·alpha + 버킷별·Counterfactual, 현 코드 = 5 summary cards + 월별 + 버킷별 + Counterfactual). **탭 2** = 월별 리포트 아카이브 (과거 월 선정 30 + 풀 리포트 30 리스트 + 클릭 시 `/admin/report/[ticker]?month=YYYY-MM` 또는 모달). **D23 정정 — track-record는 trigger 위치 아님** (Group A mismatch 정정 박제). trigger 버튼 위치 = `/admin/portfolio` 또는 `/admin`.
  - `/admin/decision-tree` (D9) — Y1 Decision Tree 진척도 (CAP Months·alpha·Sharpe 게이지 3종, 단독 화면)
  - `/admin/settings` — 3모드 전환(§1.4) + 상시 모니터링 디폴트 임계치·종목별 on/off(D7)
  - `/admin/settings/notifications` — 텔레그램·이메일 채널 + 온보딩 4-D
- **S8 자동매매 추가 라우트 (2026-04-21 D16, 상세 `Slices/S8-AutoTrading.md`)**:
  - `/admin/settings/brokerage` — KIS(주식) API 키 + 모의↔실계좌 토글 + 복수 앱키·계좌(D12)
  - `/admin/settings/binance` — 바이낸스 선물 API 키 + 테스트넷↔메인넷 토글 + 레버리지 상한
  - `/admin/settings/risk` — 리스크 가드레일(레버리지·일일 손실·AI 일 주문 cap) · 기본값: ≤5x / -3% / ≤20회
  - `/admin/settings/strategy` — Strategy 폴더 파일 목록 + 활성/비활성 토글 + AI 어댑터 embed 상태
  - `/admin/trading/stock` — 주식 수동 주문 폼 + 자동 주문 큐 + 체결·포지션·PnL 로그
  - `/admin/trading/crypto` — 바이낸스 선물 주문 폼 + 레버리지/SL/TP + 포지션·청산가·펀딩 로그
- **Short List 30 홈 구조**: **3 고정 섹션 세로 스택** (단기10 → 중기10 → 장기10). 탭·단일 스크롤 기각 — 30종목 동시 비교·버킷 간 delta 파악이 J1 핵심이므로 섹션 스택으로 확정. 각 섹션 컬럼: 종목명·섹터·**🔢 5-Signal Composite 점수(0~100, Tier 0)**·**🤖 Core 11 페르소나 점수(0~100, Tier 1)**·**합의 배지(🟢/🔵/🟣/🟡/⚪)**·**AI 코멘트 1~2줄**·투심위 미니바·목표가 괴리율·7일 스파크라인·NEW/HOLD/REMOVED 배지. **D19 (2026-05-08, 35차)** 신설 · **49차 Q5b로 🟡 관망 추가하여 5종**: 🔢🤖 이중 점수 + 합의 배지 + AI 코멘트 1~2줄. AI 키 미발급 시 🤖·AI 코멘트는 placeholder, 🔢·합의 배지(⚪)는 동작 → §3.1 R3.1-6 박제.
- **UI 흐름 박제 (D23, 53차 §5 lock-in 1.4)**: 30종목 클릭 시 풀 리포트 진입 흐름을 다음과 같이 박제한다.
  ```
  /admin 홈 또는 /admin/portfolio
    ↓ 30종목 리스트 (ShortlistRow 컴포넌트, <details> accordion native, 코드 SoT = `tudal/src/components/admin/shortlist/shortlist-row.tsx`)
    ↓ 종목 클릭
    ↓ details 펼침 (1~2줄 합의 코멘트 + 🔢🤖 이중 점수 + 합의 배지)
    ↓ "풀 리포트" 버튼 클릭
    ↓ <Link href="/admin/report/[ticker]">
    ↓
  /admin/report/[ticker] (Section 0~7 writer 본문 + Section 8 partA/B/C/D Tier 2 sector 14 페르소나 + Appendix = 단일 산출물)
  ```
  - **선정 30 = 풀 리포트 30** (lock-in 1.2 박제). 선정과 풀 리포트는 분리되지 않으며, 30종목 선정과 동시에 30 풀 리포트가 함께 생성된다.
  - **메인 path (D19 + D23)**: Tier 0 인디케이터·DART numeric narrow → Tier 1 Core 11 AI 평가 + 시간대별 페르소나 가중치 → 30 선정 + Tier 2 sector 14 페르소나 Section 8 plug-in → writer Section 0~7 통합 + Section 8 partA/B/C/D = 30 풀 리포트.
  - **fallback**: AI 키 미발급 시 Tier 0 단독 30 직선정 (현 production 상태, PR2 미진입). 풀 리포트 = Section 0~7 미구현 + Section 8 partA `[]` (Tier 2 deferred).
  - **현 코드 상태 = Group H Critical** (D23 §5 박제 보강): `getReportByTicker` mapping/validation 0 + page.tsx `section0.conviction` header early deref + Section 0~7 nested array/string deref + Section 8 신규 partA/B/C/D shape vs old conclusion/recommendation/keyQuotes shape mismatch → PR3a Hard gate 선행 필수.
- **3모드 전환**: Header 고정 드롭다운(1-tap, 주사용) + `/admin/settings` 상세(온보딩·숙고용). 상태는 Supabase 계정 단위 영속, 어드민 3명 각자 독립.
- **글로벌 레이아웃**: Header(로고·모드 드롭다운·알림 종·아바타) + 좌측 Sidebar(7 라우트, `/admin/report/*`는 종목 클릭 전용) + Footer(면책 문구 고정, BusinessPlan §7).
- **모바일 대응**: 현 범위는 **데스크톱 전용**. 모바일 반응형(사이드바 → 바텀 탭바, 리포트 Sticky Tab 전환)은 **별도 나중 트랙**(어드민 내부 운용 안정화 이후 검토). 단, 텔레그램·이메일 딥링크는 지금부터 동작 — **P7.3 권장(⑧)**: `/admin/alerts/[id]`와 `/admin/report/[ticker]` Section 0만 CSS 단일 컬럼 스택(`<768px`)으로 최소 readable 제공. 풀 모바일 UI는 추후.
- **화면 플로우 다이어그램**: P7.1 완료 (2026-04-15). 파일: `.omc/design/flows/admin-flows.md`.
  - 다이어그램 1: J1 월간 선정 플로우 (AI 스크리닝 → Short List 30 → 리포트 열람 → Accept/Reject → 트래킹 시작. Reject 재분석 1회·전월 유지·D+5 미승인 분기 포함)
  - 다이어그램 2: J2 일간 모니터링 플로우 (모닝 브리핑 → 대시보드 스캔 → 주의 종목 드릴다운 → 설정 조정)
  - 다이어그램 3: J3 Exit 타이밍 플로우 (AI 악재 감지 → 심각도 분류 → 3채널 알림 → 알림 상세 → 매도 결정 기록)
  - 다이어그램 4: J4 성과 추적 플로우 (일간 스냅샷 → 월간 집계 → 트랙 레코드 → Decision Tree 진척도)
  - 다이어그램 5: 3모드 상태 전환 다이어그램 (모닝 대시보드 ↔ 상시 모니터링 ↔ 월간 리밸런싱. Header 드롭다운 + Settings 전환 경로·영속성 표기)
  - ~~미해결 3건~~ → **P7.3 권장안 확정**: ⑥ 종목 내비 = **버킷 내(10종목) 디폴트** + 경계 표시("단기 10 끝. 다음: 중기 10 첫 번째"), ⑦ Decision Tree 부분 표시 = **N/12 부분 게이지 + 월별 차트 점선 투영**, ⑧ 모바일 딥링크 = alerts/[id] + report Section 0 최소 readable CSS
- **P7.3 IA 검증 결과** (2026-04-15): BLOCK 0 / FLAG 3 / Suggestion 3. 상세: `.omc/design/ia-verification.md`.
  - FLAG-1: `/admin/track-record` 와이어프레임 누락 → P8.3 목업 시 보완
  - FLAG-2: track-record ↔ decision-tree 핑퐁 네비 → track-record에서 decision-tree 단방향 링크만 유지 권장
  - FLAG-3: 일간 요약바에 "마지막 갱신 시각" 누락 → 추가 권장 ("갱신: 2026-04-14 16:00 장마감 배치")

---

## 3. 기능 스펙

> **P4.1 본문화 완료 (2026-04-15)** — **v1.1 기준 Must 19 / Should 17 / Nice 6 / Deferred 7**. §3.1~§3.5는 P3.0 결정 D1~D9 박제 + 정식 요구사항 보강. §3.7~§3.11은 Must 기능 AC 힌트 → 정식 요구사항 승격 + Should/Nice 확장 후보 서브섹션 추가. **§3.12는 v1.1 신설** — D14 Must 승격 3건(M17·M18·M19 시스템 관측·가드레일). 미해결 5건은 각 해당 섹션에 결정 또는 Build 이관 명시. 원자료: `.omc/research/p3-1-feature-prioritization.md`.

### §3.1 분석엔진 출력 (D5)

> **→ 전략 배경**: §1A.1 Product Vision · §1A.2 UA2 Quant Early Warning 참조.

어드민 UI에 표시되는 분석엔진 산출물. P3.0 결정 D5 박제.

**기능 설명**: 백테스트 v6 기반 5-Signal Composite 점수와 3축 분석 결과를 어드민 대시보드에 가시화한다. 어드민이 Short List 30 종목의 선정 근거와 리스크 상태를 수치로 확인할 수 있게 하여 "AI 블랙박스" 불신을 방지한다.

**핵심 요구사항**:
- R3.1-1: 종목 카드마다 5-Signal Composite 점수(0~100 정수)를 표시한다. 점수 산출 기준은 quant-data-architecture.md EarlyWarning 5-Signal 가중치 그대로 적용.
- R3.1-2: 추세(MA 구조) · 모멘텀(RSI/MACD) · 변동성(BB 폭/ATR) 3축 점수를 Composite와 별도로 각각 표시한다. 각 축은 점수 숫자 + 방향 지표(▲/▼/─)를 함께 노출.
- R3.1-3: 각 신호 트리거에 대응하는 단문 라벨("MA 이탈", "RSI 과열", "BB 상단 돌파" 등)을 1줄 이내로 표시한다.
- R3.1-4: Crisis Layer가 발동된 종목은 경고 플래그(배지)를 표시한다. Crisis 임계치는 quant-data-architecture.md CrisisLayer 기준(일일 수익률 < −6% 또는 5일 연속 하락 등) 적용.
- R3.1-5: 모든 분석엔진 출력은 EOD 배치 기준으로 갱신된다(상시 모니터링 모드에서는 장중 스트림 추가, §3.5 참조). 추가 지표 확장(업황 사이클·섹터 로테이션 등)은 어드민 운용 안정화 이후 재검토.
- R3.1-6 **(D19, 2026-05-08 35차 · 49차 Q5b 5종 배지 박제)**: 종목 카드에 **🔢 숫자 점수**(0~100, Tier 0 = 5-Signal Composite × 시간대별 가중치)와 **🤖 AI 점수**(0~100, Tier 1 = Core 11 페르소나 합산) **이중 배지**를 노출한다. 두 점수의 비교 결과는 **5종 합의 배지**로 시각화: 🟢 **강한 합의** (둘 다 상위, 우선 노출) · 🔵 **숫자 우세** (모멘텀 강하나 정성 우려) · 🟣 **AI 우세** (정성 좋으나 차트 약함) · 🟡 **관망** (둘 다 비-top tier, 시기 미상 — Q5b 49차 omxy CONVERGED) · ⚪ **AI 분석 대기** (AI 키 미발급 placeholder). 각 카드에 **AI 코멘트 1~2줄**(Core 11 합의 핵심 논거 발췌, 있을 시 표시 / 없을 시 "AI 분석 대기 중" placeholder). 카드 클릭 → 풀 리포트 Section 0~8(`ReportFramework.md §8` Step 1~4 산출물). **AI 키 미발급 fallback**: 🤖·AI 코멘트는 placeholder, 🔢·합의 배지는 ⚪로 동작. 진짜 코스피·코스닥 30종목 + 실 가격·재무·뉴스는 그대로 노출. 코드 SoT: `tudal/src/lib/screening/consensus.ts` (5종 type union + `assignBadge` 5분기). 박제: D19 + `Service/Report/ReportFramework.md §8` Step 0.

**확장 후보 (Should/Nice)**:
- S7 Crisis Layer 상세 패널: Composite 점수 분해(5-Signal 각 기여도 바차트) + Crisis 발동 이력. M4 위 세부 레이어. → BuildPhase B3.2 이후 추가 가능.
- S5 백테스트 결과 뷰어: 6종 백테스트 결과를 어드민이 열람할 수 있는 별도 뷰. UA2 Early Warning 근거 가시화. → S5 구현은 P3.1 Should 분류, B3 단계.
- S6 매크로 컨텍스트 축소판: 모닝 브리핑(M11)에 KOSPI/금리/환율 미니 차트 삽입. → §3.10 M11 확장 시 연동.


#### User Story & AC — M4 5-Signal Composite + 3축 분석엔진 출력
- **Story**: 어드민으로서, 종목 선정의 AI 근거를 수치로 확인하기 위해, 5-Signal Composite 점수와 추세·모멘텀·변동성 3축 결과가 종목 카드에 표시되는 기능을 원한다.
- **AC**:
  - [ ] 각 종목 카드에 Composite 점수(0~100)와 3축(추세·모멘텀·변동성) 점수가 방향 지표(▲/▼/─)와 함께 표시된다.
  - [ ] Crisis Layer 발동 종목에는 경고 배지가 표시되고, 신호 트리거 단문 라벨("MA 이탈" 등)이 1줄 이내로 노출된다.
  - [ ] 모든 출력은 EOD 배치 기준으로 갱신된다(상시 모니터링 모드에서는 장중 스트림 추가).
#### DoD (Definition of Done) — M4 5-Signal Composite + 3축 분석엔진 출력
- [ ] 각 종목 카드에 Composite 점수(0~100)와 추세·모멘텀·변동성 3축 점수가 방향 지표(▲/▼/─)와 함께 표시된다.
- [ ] Crisis Layer 발동 종목에 경고 배지가 표시되고, 신호 트리거 단문 라벨("MA 이탈" 등)이 1줄 이내로 노출된다.
- [ ] 모든 분석엔진 출력이 EOD 배치 기준으로 갱신된다.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.2 Short List 30 산출 로직 (D6)

> **→ 전략 배경**: §1.2 Core JTBD · §1A.2 UA1·UA2 참조. 🔴 Must 고정 — Should/Nice 강등 금지.

**기능 설명**: 매월 1일 AI 분석엔진이 전종목 스크리닝을 수행하여 단기10·중기10·장기10으로 구성된 Short List 30을 생성한다. 이것이 어드민 홈의 유일한 진입점이며, NSM(CAP Months) 트리거 이벤트(`shortlist.generated`)의 시작점이다.

**핵심 요구사항**:
- R3.2-1: 홈 화면(`/admin`)은 Short List 30을 단기 10 · 중기 10 · 장기 10으로 구분하여 3 고정 섹션 세로 스택으로 반드시 표시한다. 종목 수(30) 및 버킷 분배(10/10/10) 변경 불가. D6 Must 고정.
- R3.2-2: 각 종목 행에는 종목명(티커) · 섹터 · 5-Signal Composite 점수 · 투심위 분포 미니바 · 목표가 괴리율 · 7일 스파크라인 · NEW/HOLD/REMOVED 배지를 표시한다.
- R3.2-3: 30종목 미달 시(스크리닝 결과 부족) 명시적 경고("Short List 생성 불완전 — N종목 생성됨")를 홈 상단에 표시하고 이전 달 Short List를 유지한다.
- R3.2-4: 분석 로직은 §3.1 5-Signal Composite·3축 인디케이터와 AI 투심위(Core 11 + Sector Board canonical 14 sectors × 14 personas overlay, `ReportFramework.md`) 판단 기준 + 리포트 워딩(Section 0~8)을 결합한 분석엔진 전체를 사용한다. 같은 로직이 30종목 전부에 적용된다. **D21 (52차)**: 슬롯 모델은 10 base + 2 primary overlay + 2 sub_tag overlay = canonical 14 fixed.
- R3.2-5: 백테스트 검증은 6종목에서 시작하여 같은 알고리즘으로 점진 확장한다. 백테스트 범위 축소가 Short List 30 노출 구조 축소로 이어지지 않는다.

**미달 상태 정책 (P5 I-04 박제)**:
- (a) **원인 분리**: 30종목 미달의 원인을 (i) 스크리닝 결과 부족(품질 문제) vs (ii) 데이터 장애(파이프라인 실패)로 명시적으로 분리 기록한다. 홈 배너·운영 로그에 원인 구분 표시.
- (b) **미달 월의 CAP Months 포함 여부 = 포함**: 전월 포트 유지로 운용 연속성이 유지되므로 해당 월도 CAP Months 카운트에 포함한다. (Reject 2차 후 전월 유지는 D1에 따라 미포함과 별개)
- (c) **3개월 연속 미달 시 Anti-Metric 트리거로 승격**: 분석엔진·파이프라인 구조적 문제 신호로 간주하고 투심위 품질·데이터 소스 전면 재검토.

**확장 후보 (Should/Nice)**:
- S12 Short List 후보군 31~50위 뷰: 박소연 페르소나 "왜 이 종목이 탈락했나" 검증 욕구 충족. 풀 리포트는 30종목에만 제공. → Should, B3 단계.
- S5 백테스트 결과 뷰어: 6종 알고리즘 성과를 어드민이 열람. D6 "백테스트 trace" 가시화. → Should, B3 단계.


#### User Story & AC — M1 Short List 30 홈 표시
- **Story**: 어드민으로서, 이번 달 투자 대상을 한눈에 파악하기 위해, 단기·중기·장기 각 10종목이 종목명·현재가·수익률·상태와 함께 홈 화면에 표시되는 기능을 원한다.
- **AC**:
  - [ ] `/admin` 진입 시 단기 10 · 중기 10 · 장기 10의 3섹션 세로 스택이 렌더되고, 각 행에 종목명(티커)·Composite 점수·목표가 괴리율·NEW/HOLD/REMOVED 배지가 표시된다.
  - [ ] 30종목 미달 시 "Short List 생성 불완전 — N종목 생성됨" 경고가 홈 상단에 표시된다.
#### DoD (Definition of Done) — M1 Short List 30 홈 표시
- [ ] `/admin` 진입 시 단기 10 · 중기 10 · 장기 10의 3섹션 세로 스택이 렌더되고, 각 행에 종목명(티커)·Composite 점수·목표가 괴리율·NEW/HOLD/REMOVED 배지가 표시된다.
- [ ] 30종목 미달 시 "Short List 생성 불완전 — N종목 생성됨" 경고가 홈 상단에 표시되고 이전 달 Short List가 유지된다.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.3 승인 워크플로우 (D1·D2)

> **→ 전략 배경**: §1.3 J1 월간 선정 · §1A.3 NSM(CAP Months) 트리거 참조.

> **본 워크플로우는 AI 가상 포트 확정용**. 실제 체결 3경로(매뉴얼·자동매매·외부 바이패스)는 §1A.0 참조. D11 박제.

**기능 설명**: 매월 Short List 30 생성 후 어드민이 AI 비중 제안을 Accept 또는 Reject하는 워크플로우다. 어드민 3명 중 먼저 승인한 1인이 확정권을 가진다(선착순). 이 이벤트가 NSM 카운트의 트리거이며, 가상 포트폴리오 트래킹의 시작점이다.

**핵심 요구사항**:
- R3.3-1: `/admin/portfolio` 화면에 전체 Accept 버튼과 전체 Reject 버튼을 제공한다. 승인 시 확인 모달을 표시하고, 확인 후 `portfolio.approved` 이벤트(month · admin_id · timestamp · approval_type)를 기록한다. 이 타임스탬프가 승인가(종가) 기준이 된다.
- R3.3-2: 어드민 3명 중 1인이 Accept를 완료하면 즉시 "승인 완료" 상태로 잠기고, 나머지 어드민에게는 "이미 승인됨(승인자·시각 표시)" 배너를 보여준다. 이후 Accept/Reject 버튼은 비활성화된다. **미해결 ①(멀티어드민 race) 해소**: 선착순 단일 확정으로 UI 단순화. 동시 클릭 race condition 처리(낙관적 락 또는 DB 유니크 제약)는 → BuildPhase B3 이관.
- R3.3-3: Reject 시 AI 자동 재분석 1회를 큐에 등록하고, 어드민에게 "재분석 중" 상태를 표시한다. 재분석 완료 후 새 Short List로 포트폴리오 화면을 갱신하고 텔레그램 알림을 발송한다.
- R3.3-4: 재분석본도 Reject되면 "전월 포트폴리오 유지" 배너를 표시하고 해당 월은 CAP Months에 미포함 처리한다.
- R3.3-5: Short List 생성일로부터 D+5 영업일 내 미승인 시 자동으로 "전월 포트 유지" 처리하고, 어드민 3인에게 텔레그램 경고를 발송한다. 홈 화면에 "승인 마감 D-N일" 카운터를 상시 표시한다.
- **R3.3-7 (D15, v1.1): 승인 Holding Period 24시간**. Short List 생성 후 `shortlist.generated_at + 24h` 이전 Accept 시도는 "숙고 기간 중 — 24시간 경과 후 Accept 가능" 메시지와 함께 차단한다. Accept 버튼은 Holding 기간 동안 disabled 상태.
- **R3.3-8 (D15, v1.1 · S2 G-5 B 보정): 2인 풀 리포트 열람 게이팅**. 어드민 3인 중 **최소 2인이 풀 리포트를 Section 0 이상 열람**(`report.view` 이벤트 발생) 한 경우에만 Accept 버튼 활성화. 판정 로직: `SELECT COUNT(DISTINCT admin_id) FROM report_view_log WHERE report_id = ? >= 2` (E10 ReportViewLog, 2026-04-17 S2 [G-5] 옵션 B 해소). 열람 카운터는 `/admin/portfolio` 화면에 "현재 N/2명 열람 완료" 형태로 노출한다. 게이트가 false이면 버튼 disabled + 미열람 어드민 안내 표시.
- **R3.3-9 (D15, v1.1): 연휴 우회 조항**. 24h Holding이 장기 연휴로 인해 D+5 영업일(R3.3-5) 상한을 침범할 경우 **24h 또는 D+4 영업일 중 짧은 쪽**을 적용한다. D+5 마감을 침범하지 않는 범위에서 Holding 단축.
- **R3.3-10 (D15, v1.1): 이의 제기 48h 추가 Hold**. 어드민 B 또는 C가 "이의 제기" 버튼을 통해 공식 이의를 등록하면 **추가 48h Hold**가 발동한다. `dispute_raised_at`부터 48h 경과 또는 이의 제기자의 "이의 해결" 액션 중 먼저 발생하는 시점에 Hold 해제 → Accept 버튼 재활성화. 연휴 우회(R3.3-9)는 이의 48h에도 동일하게 적용.

**확장 후보 (Should/Nice)**:
- S10 포트폴리오 Override 도구: 박소연 페르소나가 AI 제안 비중을 종목 단위로 조정(전체 Accept/Reject 외 중간 선택지). Anti-Metric "오버라이드 > 50%" 측정 메커니즘 연동. → Should, MVP 이후 Stage 1.5.
- S11 What-if 시뮬레이터: Override 후 예상 포트폴리오 수익률 시뮬. → Should, S10 구현 후.


#### User Story & AC — M7 승인 워크플로우
- **Story**: 어드민으로서, 이번 달 포트폴리오를 확정하기 위해, AI 비중 제안을 Accept 또는 Reject하고 결과가 즉시 가상 포트폴리오에 반영되는 승인 워크플로우를 원한다.
- **AC**:
  - [ ] `/admin/portfolio`에서 Accept 클릭 → 확인 모달 → 확인 후 `portfolio.approved` 이벤트가 기록되고, 나머지 어드민에게 "이미 승인됨" 배너가 표시된다.
  - [ ] Reject 시 AI 재분석이 1회 큐에 등록되고 "재분석 중" 상태가 표시된다. 재분석본도 Reject되면 "전월 포트 유지" 배너가 표시된다.
  - [ ] D+5 영업일 카운터가 홈 화면에 상시 표시되고, 기한 내 미승인 시 어드민 3인에게 텔레그램 경고가 발송된다.
  - [ ] **(D15)** Short List 생성 후 24h 경과 이전에는 Accept 버튼이 disabled이며, 시도 시 "숙고 기간 중" 메시지가 표시된다.
  - [ ] **(D15)** 어드민 2인 이상 풀 리포트 열람(`report.view` 기록) 이전에는 Accept 버튼이 disabled이며, "현재 N/2명 열람 완료" 카운터가 `/admin/portfolio`에 표시된다.
  - [ ] **(D15)** 어드민 B·C 이의 제기 시 추가 48h Hold가 발동하여 Accept 버튼이 다시 disabled된다. 48h 경과 또는 이의 해결 후 재활성화된다.
#### DoD (Definition of Done) — M7 승인 워크플로우
- [ ] `/admin/portfolio`에서 Accept 클릭 → 확인 모달 → 확인 후 `portfolio.approved` 이벤트가 기록되고, 나머지 어드민에게 "이미 승인됨(승인자·시각)" 배너가 표시되며 Accept/Reject 버튼이 비활성화된다.
- [ ] Reject 시 AI 재분석이 1회 큐에 등록되고 "재분석 중" 상태가 표시된다. 재분석본도 Reject되면 "전월 포트 유지" 배너가 표시된다.
- [ ] D+5 영업일 카운터가 홈 화면에 상시 표시되고, 기한 내 미승인 시 어드민 3인에게 텔레그램 경고가 발송된다.
- [ ] **(D15 R3.3-7) 24h Hold가 정상 동작**: `shortlist.generated_at + 24h` 이전 Accept 시도 차단 + 안내 메시지. 연휴로 D+4 영업일이 24h보다 짧으면 짧은 쪽 적용(R3.3-9).
- [ ] **(D15 R3.3-8) 2인 열람 게이팅 false 시 버튼 disabled**: `report.view` 기록이 2인 미만이면 Accept 버튼 disabled 상태 유지 + "N/2명 열람 완료" 카운터 노출.
- [ ] **(D15 R3.3-10) 이의 제기 시 48h 연장**: `dispute_raised_at` 기록 후 48h 경과 또는 이의 해결 시점 중 먼저 도래하는 시점에 Accept 활성 복귀.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.4 가상 포트폴리오 트래킹 (D3·D4·D8)

> **→ 전략 배경**: §1.3 J4 성과 추적 · §1A.3 IM-5 누적 Alpha · §1A.4 Anti-Metrics 참조.

**기능 설명**: 승인 완료 시점부터 가상 포트폴리오를 생성하고, 일별 수익률·Sharpe·KOSPI 대비 alpha를 트래킹한다. 트랙 레코드 12개월 누적이 Core JTBD(J4)의 최종 산출물이며, Y1 Decision Tree(BusinessPlan §Q4)의 판단 입력값이다. 재생성 cap은 Anti-Metric "AI API 월 40만원" 초과를 방지한다.

**핵심 요구사항**:
- R3.4-1: 승인 확정 시점의 당일 종가를 모든 종목의 매수가(승인가)로 기록한다. 슬리피지·수수료 0%, 100% 일괄 매수 가정 (단순 모델).
- R3.4-2: AI가 제안한 현금 비율(0~30%)만큼 총 자산에서 매수를 제외하고, 현금 항목을 별도 행으로 포트폴리오에 표시한다. 현금 부분은 수익률·alpha 계산에서 제외하여 별도 추적한다.
- R3.4-3: 매일 장 마감 후 `portfolio.daily_snapshot`(date · total_return · kospi_return · alpha · sharpe)을 적재한다. `/admin/track-record` 화면은 이 데이터를 기반으로 월간/누적/버킷별 성과를 표시한다.
- R3.4-4: 종목당 월간 재생성 카운터를 관리한다. Reject 시 자동 재분석 0/1회, 어드민 수동 재생성 0/2회를 별도 카운트한다. 수동 재생성 버튼에 "이번 달 N/2회 남음" 라벨을 표시하고, 한도 소진 시 버튼을 비활성화하고 "이번 달 재생성 한도 소진" 툴팁을 표시한다. 카운터는 매월 1일 00:00 KST 리셋.
- R3.4-5: 재생성 확인 플로우: "리포트 재생성" 버튼 클릭 → `/admin/report/[ticker]/regenerate` 진입(확인 화면 또는 인터셉트 모달) → 확인 → "재생성 중" 스피너 → 완료 후 리포트 갱신. **미해결 ④(regenerate 서브라우트 vs 인터셉트 모달) 해소**: 서비스 기획 수준에서 두 방식 모두 허용 — 구현 방식은 → BuildPhase B3 이관. 기능 요구사항은 "확인 단계 필수 + cap 상태 표시"로 고정.

**확장 후보 (Should/Nice)**:
- S3 리포트 버전 히스토리: 이전 월 리포트와 현재 비교. 트랙 레코드 감사 가능성. → Should, B3 단계.
- S4 리포트 PDF/HTML export: 이준호 페르소나 "투심위 자료" 활용. Y1 법적 등록 근거 문서화. → Should, B3 단계.
- N2 Drawdown 분석(MDD·회복기간): M16 Decision Tree에 핵심 수치만 흡수. 상세는 12개월 데이터 누적 후 의미. → Nice, Y2.


#### User Story & AC — M8 가상 포트폴리오 트래킹 엔진
- **Story**: 어드민으로서, 15억 운용 성과를 객관적으로 측정하기 위해, 승인 시점 종가 기준으로 가상 포트폴리오 수익률·alpha·Sharpe를 자동 트래킹하는 기능을 원한다.
- **AC**:
  - [ ] 승인 확정 시 당일 종가로 전 종목 매수가가 기록되고, 슬리피지·수수료 0% 가정 하에 `PortfolioSnapshot`이 생성된다.
  - [ ] 매일 장 마감 후 `portfolio.daily_snapshot`이 자동 적재되고, `/admin/track-record`에 누적 수익률·alpha·Sharpe가 표시된다.
#### DoD (Definition of Done) — M8 가상 포트폴리오 트래킹 엔진
- [ ] 승인 확정 시 당일 종가로 전 종목 매수가가 기록되고, 슬리피지·수수료 0% 가정 하에 `PortfolioSnapshot`이 생성된다.
- [ ] AI 제안 현금 비율(0~30%)만큼 매수를 제외한 현금 항목이 별도 행으로 포트폴리오에 표시된다.
- [ ] 매일 장 마감 후 `portfolio.daily_snapshot`이 자동 적재되고, `/admin/track-record`에 누적 수익률·alpha·Sharpe가 표시된다.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M9 리포트 재생성 cap 가드
- **Story**: 어드민으로서, AI API 비용 폭주를 막기 위해, 종목당 월간 재생성 횟수를 자동으로 제한하는 기능을 원한다.
- **AC**:
  - [ ] 수동 재생성 버튼에 "이번 달 N/2회 남음" 라벨이 표시되고, 한도 소진 시 버튼이 비활성화되며 "재생성 한도 소진" 툴팁이 표시된다.
  - [ ] 카운터는 매월 1일 00:00 KST에 자동 리셋된다.
#### DoD (Definition of Done) — M9 리포트 재생성 cap 가드
- [ ] 수동 재생성 버튼에 "이번 달 N/2회 남음" 라벨이 표시되고, 한도 소진 시 버튼이 비활성화되며 "재생성 한도 소진" 툴팁이 표시된다.
- [ ] 재생성 확인 플로우(버튼 → 확인 단계 → 스피너 → 완료 갱신)가 작동한다.
- [ ] 카운터는 매월 1일 00:00 KST에 자동 리셋된다.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.5 상시 모니터링 모드 MVP (D7)

> **→ 전략 배경**: §1.4 사용 모드 · §1.3 J3 Exit 타이밍 참조. D7 Must 박제.

**기능 설명**: 어드민이 "상시 모니터링" 모드를 선택하면 보유 종목의 장중 실시간 스트림이 활성화되고, 디폴트 임계치 3종 중 하나라도 발동 시 즉시 알림을 발송한다. 종목별 on/off 토글로 알림 피로를 조절한다. 세밀한 임계치 커스텀은 Phase 2 범위.

**핵심 요구사항**:
- R3.5-1: "상시 모니터링" 모드 활성 시 보유 30종목의 장중 가격 데이터를 실시간 스트림(한투 API, ADR-1 참조)으로 수신한다. 모드 비활성 시 EOD 배치 전환. **구현 대안 (P5 I-10)**: 한투 API WebSocket 실시간 스트림이 인프라 부담 시 **1분 폴링 방식으로 대체 허용**. 실시간/폴링 선택은 BuildPhase B3.2에서 실측 후 결정.
- R3.5-2: 디폴트 임계치 3종을 제공한다 — ①급등락 감지(±5% 또는 거래량 3배, §3.10 M13의 수치 기준), ②뉴스 악재 감지(§3.10 M12 Critical 등급 이상), ③목표가 근접 감지(목표가 대비 괴리율 ≤ 5%). 구체 수치는 → BuildPhase B3 확정.
- R3.5-3: `/admin/settings` 화면에서 디폴트 임계치 3종 각각의 ON/OFF 토글과, Short List 30 종목별 모니터링 ON/OFF 토글을 제공한다. 기본값은 전체 ON.
- R3.5-4: 임계치 발동 시 텔레그램 즉시 알림 + `/admin` 홈 상단 배지(읽지 않은 알림 수)를 동시에 트리거한다. 알림은 `/admin/alerts`에 이력 저장.
- R3.5-5: J3 Exit 시그널 긴급 알림(§3.10 M15)은 모드 설정과 무관하게 모든 모드에서 항상 즉시 발송한다.

**확장 후보 (Should/Nice)**:
- 세밀 임계치 커스텀 UI(종목별 ±% 직접 입력): Phase 2 로드맵. D7에서 명시적 제외.
- S9 매크로 이슈 캘린더: FOMC·CPI 등 일정이 임계치 발동 컨텍스트로 연동. → Should, B3 단계.
- S16 홀딩 기간 초과 경보: 단기/중기/장기 버킷별 홀딩 기간 초과 시 알림. 이준호 페르소나 "단기 어정쩡" 통점. → Should.


#### User Story & AC — M13 장중 이상 감지 알림 (상시 모니터링 모드 설정)
- **Story**: 어드민으로서, 알림 피로 없이 중요한 장중 변동만 받기 위해, 종목별 모니터링 on/off와 디폴트 임계치 설정을 관리하는 기능을 원한다.
- **AC**:
  - [ ] `/admin/settings`에서 디폴트 임계치 3종(급등락·뉴스 악재·목표가 근접) 각각의 ON/OFF 토글과 종목별 ON/OFF 토글이 제공되고, 기본값은 전체 ON이다.
  - [ ] J3 Exit 시그널 긴급 알림은 모드 설정·종목 토글과 무관하게 항상 즉시 발송된다.
#### DoD (Definition of Done) — M13 상시 모니터링 모드 설정
- [ ] `/admin/settings`에서 디폴트 임계치 3종(급등락·뉴스 악재·목표가 근접) 각각의 ON/OFF 토글과 종목별 ON/OFF 토글이 제공되며 기본값은 전체 ON이다.
- [ ] J3 Exit 시그널 긴급 알림은 모드 설정·종목 토글 상태와 무관하게 항상 즉시 발송된다.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M14 종목별 커스텀 임계치 on/off
- **Story**: 어드민으로서, 변동성이 낮은 종목의 불필요한 알림을 끄기 위해, Short List 30 각 종목의 모니터링 알림을 개별적으로 on/off하는 기능을 원한다.
- **AC**:
  - [ ] `/admin/settings` 종목 목록에서 각 종목의 알림 토글을 on/off할 수 있고, 변경 사항이 즉시 저장된다.
  - [ ] OFF 상태 종목은 임계치 발동 시에도 텔레그램 알림·홈 배지가 발송되지 않는다.
#### DoD (Definition of Done) — M14 종목별 커스텀 임계치 on/off
- [ ] `/admin/settings` 종목 목록에서 각 종목의 알림 토글을 on/off할 수 있고, 변경 사항이 즉시 저장된다.
- [ ] OFF 상태 종목은 임계치 발동 시에도 텔레그램 알림·홈 배지가 발송되지 않는다.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.6 미분류 기능 후보 → P3.1에서 해소 ✅

P3.1 `prioritize-features` 완료 (2026-04-15). 49개 후보 + §3.6 미분류 항목 통합 결과 P3.1 시점 **Must 16 / Should 17 / Nice 6 / Deferred 10** → **v1.1 D14 반영 후 Must 19 / Should 17 / Nice 6 / Deferred 7** (D-OOS-6·D-OOS-7·Silent Health Must 승격). 상세 매트릭스·근거 → `.omc/research/p3-1-feature-prioritization.md`. 아래 §3.7~§3.11이 P3.1 원 Must 기능 박제 영역이며, **§3.12가 v1.1 신설 Must 3건(M17·M18·M19) 박제 영역**. Should/Nice는 각 §3.X 하단 "확장 후보" 서브섹션으로 재구조(P4에서 본문화).

원 미분류 항목 → 흡수 위치:
- Top30 월배치 선정 → §3.2 D6 Must 고정
- 풀 리포트 렌더링 → **§3.7 M2**
- 뉴스 악재 감지 → **§3.10 M12**
- 긴급 알림 채널 → **§3.10 M15** (이메일·텔레그램, BusinessPlan §10.6)
- 포트폴리오 재조정 제안 (악재 발생 시) → **§3.10 M15** 대안 시나리오
- 과거 Short List·리포트 이력 열람 → Should(S3 리포트 버전 히스토리), P4에서 본문화
- Y1 Decision Tree 대시보드 (D9) → **§3.11 M16**

---

### §3.7 풀 리포트 + 투심위 가시화 (J1 · Must M2·M3)

> **→ 전략 배경**: §1.3 J1 · §1A.2 UA1 투심위 2-Layer 투명성 참조.

**기능 설명**: 어드민이 종목 카드를 클릭하면 `/admin/report/[ticker]`로 진입하여 Section 0~8 + Appendix 구조의 풀 리포트를 열람한다. AI 투심위의 찬반 논거가 Section 8에 집약 표시되어 "왜 이 종목이 선정됐는가"의 투명성을 제공한다. 박소연 페르소나의 검증 욕구를 충족시키는 핵심 화면. **미해결 ②(리포트 상세도) 해소**: §3.7 정식 요구사항으로 수준 확정(아래 R3.7-2 참조).

**M2 핵심 요구사항 — 풀 리포트 렌더링**:
- R3.7-1: `/admin/report/[ticker]`는 Section 0~8을 좌측 Sticky Side Nav(섹션 앵커) + 우측 단일 스크롤 레이아웃으로 렌더링한다. Section 0(투자 요약 + Conviction 게이지 + 투심위 미니바)은 디폴트 펼침 상태.
- R3.7-2: 각 섹션은 **접기·펼치기(accordion)**를 기본으로 제공한다. Section 0는 디폴트 펼침, 나머지 섹션은 디폴트 접힘. **미해결 ② 확정**: 정적 텍스트 + 접기·펼치기 수준으로 MVP를 고정. 인터랙티브 차트(MA·볼린저 등)는 §6 모멘텀 섹션에 한해 포함(§3.1 분석엔진 출력 위치). 완전 인터랙티브 페르소나 탐색은 Should(S2) 범위.
- R3.7-3: 리포트 열람 시 `report.view` 이벤트(ticker · section · admin_id · timestamp · duration_sec)를 기록한다. IM-1(리포트 소비율) 측정의 유일한 데이터 소스.
- R3.7-4: 이전/다음 종목 내비게이션을 리포트 하단에 제공한다. 탐색 범위는 해당 버킷(단기/중기/장기) 내 순서 기준. 버킷 간 이동은 홈으로 복귀 후 재진입. _(범위 최종 확정은 P7.1)_
- R3.7-5: Sticky Side Nav 상단에 "← Short List" 링크를 제공하여 `/admin` 홈 복귀 시 스크롤 위치를 복원한다.

**M3 핵심 요구사항 — 투심위 투표 요약 패널**:
- R3.7-6: Section 8에 투심위 투표 요약 패널을 표시한다. Core 11 위원 찬/반/기권 카운트 + 해당 섹터 Board 위원(Sector Board canonical 14 sectors × 14 personas overlay 중 해당 섹터의 14인) 찬/반/기권 카운트를 각각 집계한다. **D21 (52차)**: 14 = 10 base + 2 primary + 2 sub_tag overlay.
- R3.7-7 **(D20, 2026-05-12 45차 보강)**: Section 8은 다음 3개 정적 표 + 1개 합의 패널 구조로 렌더된다. 모든 표는 접기·펼치기 없는 정적 표 (MVP).
  1. **Sector Board 위원별 한 줄 의견 표** — 해당 종목 섹터 14명 전원(없을 경우 활성화된 위원 수). 컬럼: 번호 · 위원 이름 · 배경(한 줄) · 의견(BUY/HOLD/SELL) · 한 줄 논거. Reference: `Document/Outputs/Report-Alteogen_196170_v3-Readable.md` §Section 8 Part A `위원별 한 줄 의견·투표` 표 형식.
  2. **Core 11 위원별 한 줄 의견 표 (전원 11명)** — Core Committee 11명 전원. 컬럼: 번호 · 위원 이름(투자 철학 라벨 포함, 예: "Warren Buffett (장기 가치)") · 의견(BUY/HOLD/SELL/기권) · 한 줄 논거. Reference 알테오젠은 Core Committee를 쟁점별 대표 인용만 했으나, 45차 결정으로 **Core 11도 전원 한 줄 표를 추가**(reference 패턴을 Sector·Core 양쪽에 대칭 적용).
  3. **쟁점별 찬반 토론 인용 (3~5건)** — Core 11 발언 중 핵심 쟁점 2~3개를 발췌. 각 쟁점당 찬성 대표 1 + 반대 대표 1 + 중재 1 형식 (Reference Part B 패턴 유지).
  4. **최종 합의 패널** — 섹터 보드 집계(BUY/HOLD/SELL 카운트) · Core Committee 집계(쟁점 토론 반영 후 재투표 카운트) · **Co-Chair 최종 의견(만장일치 여부 명시)** · 공식 판정(BUY/HOLD/SELL) · 근거 1~3줄. Reference Part C 패턴.
- R3.7-8 **(D20, 45차 명확화)**: 정적 표(R3.7-7의 1·2·3·4 항목)는 MVP에 포함. **인터랙티브 페르소나 탐색**(개별 위원 클릭 → 모달/별도 페이지로 그 위원의 과거 트랙 레코드·풀 프로필·이번 종목 발언 풀 텍스트 등)은 Should(S2) 범위. MVP에서는 위원 이름·한 줄 논거까지가 한계이며, 위원 이름은 비-인터랙티브 텍스트로 표시한다.
- R3.7-9 **(D19, 2026-05-19 49차 · Q4 omxy CONVERGED)**: Core 11 prompt 변경은 dev PR 통해서만. 비-dev 어드민(son00326·shjang1001)은 GitHub 이슈로 초안 제출 → dev 검토 후 PR 반영.

**확장 후보 (Should/Nice)**:
- S1 시나리오 패널(Bull/Base/Bear + 시나리오-실제 乖離): M3 투표 패널 위 레이어. UA1 깊이 보강. → Should.
- S2 어드민 메모/주석(종목별): 박소연 검증 워크플로우 + 멀티어드민 협업. K2와 통합. → Should.
- S3 리포트 버전 히스토리(이전 월 비교): 트랙 레코드 감사 가능성. → Should.
- S4 리포트 PDF/HTML export: 이준호 "투심위 자료" 동기. Y1 법적 등록 근거. → Should.


#### User Story & AC — M2 풀 리포트 렌더링
- **Story**: 어드민으로서, AI 선정 근거를 투명하게 검증하기 위해, Section 0~8 전체를 접기·펼치기로 열람할 수 있는 풀 리포트 화면을 원한다.
- **AC**:
  - [ ] `/admin/report/[ticker]` 진입 시 Section 0~8이 Sticky Side Nav + 단일 스크롤 레이아웃으로 렌더되고, Section 0는 디폴트 펼침 상태다.
  - [ ] 리포트 열람 시 `report.view` 이벤트(ticker·section·duration_sec)가 기록되어 IM-1(리포트 소비율) 측정에 반영된다.
  - [ ] 이전/다음 종목 내비게이션이 리포트 하단에 제공되고, "← Short List" 링크 클릭 시 홈 스크롤 위치가 복원된다.
#### DoD (Definition of Done) — M2 풀 리포트 렌더링
- [ ] `/admin/report/[ticker]` 진입 시 Section 0~8이 Sticky Side Nav + 단일 스크롤 레이아웃으로 렌더되고, Section 0는 디폴트 펼침, 나머지 섹션은 디폴트 접힘 상태다.
- [ ] 리포트 열람 시 `report.view` 이벤트(ticker·section·admin_id·timestamp·duration_sec)가 기록된다.
- [ ] 이전/다음 종목 내비게이션이 리포트 하단에 제공되고, "← Short List" 링크 클릭 시 홈 스크롤 위치가 복원된다.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M3 투심위 투표 요약 패널
- **Story**: 어드민으로서, "왜 이 종목이 선정됐는가"를 위원 개개인의 평가 수준까지 추적하기 위해, Sector Board 14명·Core 11 11명 각자의 한 줄 의견·논거와 최종 합의 결과를 Section 8에서 보는 기능을 원한다.
- **AC** (D20, 45차):
  - [ ] Section 8에 **Sector Board 위원별 한 줄 의견 표(해당 섹터 14명 전원)**가 렌더된다. 컬럼: 번호·위원 이름·배경 한 줄·의견(BUY/HOLD/SELL)·한 줄 논거.
  - [ ] Section 8에 **Core 11 위원별 한 줄 의견 표(11명 전원)**가 렌더된다. 컬럼: 번호·위원 이름(투자 철학 라벨 포함)·의견·한 줄 논거.
  - [ ] Section 8에 **쟁점별 찬반 토론 인용 3~5건**(찬성 1~2·반대 1~2·중립 1)이 정적 텍스트로 렌더된다.
  - [ ] Section 8 하단에 **최종 합의 패널**이 표시된다: Sector 집계 카운트 · Core Committee 집계 카운트 · Co-Chair 최종 의견(만장일치 여부) · 공식 판정(BUY/HOLD/SELL) · 근거 1~3줄.
#### DoD (Definition of Done) — M3 투심위 투표 요약 패널
- [ ] Section 8에 Sector Board 위원별 한 줄 의견 표(해당 섹터 14명 전원)가 렌더된다.
- [ ] Section 8에 Core 11 위원별 한 줄 의견 표(11명 전원)가 렌더된다.
- [ ] Section 8에 쟁점별 찬반 토론 인용 3~5건이 정적 텍스트로 렌더된다.
- [ ] Section 8 하단에 최종 합의 패널(Sector·Core 집계 + Co-Chair 만장일치 여부 + 공식 판정)이 표시된다.
- [ ] 인터랙티브 페르소나 탐색(위원 클릭 → 풀 프로필 모달/별도 페이지)은 표시되지 않는다(Should S2 범위).
- [ ] `npm run build` + `npm run lint` 통과.
### §3.8 월간 선정 보조 뷰 (J1 · Must M5·M6)

> **→ 전략 배경**: §1.3 J1 · §1A.3 IM-1(리포트 소비율) · IM-2(승인 리드 ≤5일) 참조.

**기능 설명**: 30종목 전수 리포트 검토는 시간 압박이 크다(Journey 1-C, customer-journey.md). Delta 뷰는 전월 대비 변경분을 즉시 파악하게 하고, 요약 카드는 신규 편입 종목 우선 검토를 유도하여 D+5 마감 내 승인을 돕는다.

**M5 핵심 요구사항 — 편입/유지/제외 Delta 뷰**:
- R3.8-1: `/admin` 홈 Short List 섹션 상단(단기10 위쪽)에 이번 달 변경 요약 배너를 표시한다. 형식: "편입 N종목 · 유지 N종목 · 제외 N종목".
- R3.8-2: 배너 클릭 시 Delta 상세 패널(또는 모달)을 펼쳐 편입·유지·제외 종목 목록과 각 변동 사유 1~2줄을 표시한다.
- R3.8-3: Short List 테이블에서 NEW(편입) / HOLD(유지) / REMOVED(제외) 배지를 각 종목 행에 표시한다. REMOVED 종목은 Short List에서 제외되지만 Delta 상세 패널에는 목록으로 유지한다.
- R3.8-4: Delta 상세 패널의 특정 종목 클릭 시 해당 종목 섹션(단기/중기/장기)으로 홈 스크롤 이동한다.

**M6 핵심 요구사항 — 선정 근거 요약 카드 (3줄)**:
- R3.8-5: Short List 테이블의 각 종목 행에 hover 또는 펼침 시 3줄 이내 선정 근거 요약을 팝오버로 표시한다. 팝오버 내 "풀 리포트 보기" 링크를 포함한다.
- R3.8-6: 3줄 요약은 분석엔진이 Section 0의 핵심 논거를 자동 추출한 텍스트다. 어드민이 편집할 수 없다(읽기 전용).
- R3.8-7: NEW 배지 종목은 요약 카드에 "신규 편입" 레이블을 추가하여 우선 검토를 시각적으로 유도한다.

**확장 후보 (Should/Nice)**:
- S12 Short List 후보군 31~50위 뷰: 박소연 "왜 탈락했나" 검증. 풀 리포트는 30종목 한정. → Should.
- S13 종목 히트맵 뷰: J2 일간 시각화 보강. 모닝 10분 효율. → Should.
- S14 동종 섹터 비교 패널: 박소연 섹터 검증. UA1 Sector Board 결과 활용. → Should.


#### User Story & AC — M5 편입/유지/제외 Delta 뷰
- **Story**: 어드민으로서, 30종목 변경분을 빠르게 파악하여 승인 검토 시간을 줄이기 위해, 이번 달 편입·유지·제외 요약을 한눈에 보는 기능을 원한다.
- **AC**:
  - [ ] `/admin` 홈 Short List 상단에 "편입 N · 유지 N · 제외 N" 배너가 표시되고, 클릭 시 각 종목 목록과 변동 사유 1~2줄이 펼쳐진다.
  - [ ] Short List 테이블 각 행에 NEW/HOLD/REMOVED 배지가 표시된다.
#### DoD (Definition of Done) — M5 편입/유지/제외 Delta 뷰
- [ ] `/admin` 홈 Short List 상단에 "편입 N · 유지 N · 제외 N" 배너가 표시된다.
- [ ] 배너 클릭 시 편입·유지·제외 종목 목록과 각 변동 사유 1~2줄이 펼쳐지고, 종목 클릭 시 해당 섹션으로 홈 스크롤 이동한다.
- [ ] Short List 테이블 각 행에 NEW/HOLD/REMOVED 배지가 표시된다.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M6 선정 근거 요약 카드 (3줄)
- **Story**: 어드민으로서, 30개 풀 리포트를 전수 열람하지 않고도 핵심 논거를 파악하기 위해, 종목 카드 hover 시 3줄 요약 카드를 원한다.
- **AC**:
  - [ ] 종목 행 hover 또는 펼침 시 3줄 이내 선정 근거 팝오버가 표시되고, "풀 리포트 보기" 링크가 포함된다.
  - [ ] NEW 배지 종목의 요약 카드에는 "신규 편입" 레이블이 추가되어 시각적으로 구분된다.
#### DoD (Definition of Done) — M6 선정 근거 요약 카드 (3줄)
- [ ] 종목 행 hover 또는 펼침 시 3줄 이내 선정 근거 팝오버가 표시되고 "풀 리포트 보기" 링크가 포함된다.
- [ ] 팝오버 텍스트는 읽기 전용이며 어드민이 편집할 수 없다.
- [ ] NEW 배지 종목의 팝오버에 "신규 편입" 레이블이 추가된다.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.9 월간 스케줄러 + 운영 (Cross · Must M10)

> **→ 전략 배경**: §1.3 J1 · §1A.5 D2(D+5 마감) · §1A.5 D8(재생성 cap) 참조.

**기능 설명**: 매월 1일 09:00 KST에 자동 실행되는 배치 파이프라인이 Short List 30 생성과 리포트 생성을 처리한다. 어드민의 수동 트리거 없이 자동 실행되어야 한다. 실패 시 어드민에게 즉시 알림을 보내고, D+5 마감 카운터가 정상 작동하도록 한다.

**M10 핵심 요구사항 — 월간 자동 배치 스케줄러**:
- R3.9-1: 매월 1일 09:00 KST에 배치를 자동 실행한다. 실행 순서: 전종목 스크리닝 → Short List 30 선정 → 종목별 리포트 생성(Section 0~8) → 어드민 3명 텔레그램 알림. 수동 트리거 방식은 허용하지 않는다.
- R3.9-2: 배치 완료 시 `shortlist.generated` 이벤트(month · timestamp · new_count · hold_count · removed_count)를 기록한다. 이 이벤트가 D+5 마감 카운터의 시작 기준이다.
- R3.9-3: 배치 실패(스크리닝 오류·리포트 생성 오류 등) 시 `shortlist.generation_failed` 이벤트를 기록하고, 어드민 3인에게 텔레그램 실패 알림을 즉시 발송한다. 재시도 큐에 등록하여 최대 3회 재시도한다.
- R3.9-4: 배치 실패로 인해 Short List가 생성되지 않은 경우 전월 Short List를 유지하고 홈 화면에 "이번 달 Short List 생성 지연" 배너를 표시한다. **미해결 ③(스케줄러 실패 시 D+5 카운터 상호작용) 해소**: 실패 상태에서는 D+5 카운터를 시작하지 않는다. 배치 성공(`shortlist.generated`) 시점부터 카운터를 기산한다. 상세 SLA(재시도 간격·최대 지연 허용치) → BuildPhase B3 이관.
- R3.9-5: 매월 1일 배치 외에 어드민 수동 재생성(종목당 월 2회 한도, §3.4 R3.4-4)은 별도 흐름으로 처리한다. 월간 배치와 수동 재생성의 cap 카운터는 독립적으로 관리한다.

**D+5 예외 규칙 (P5 I-02 박제)**:
- (i) **장기 연휴 처리**: 해당 월의 연휴 영업일수(N)만큼 D+5를 D+(5+N)으로 자동 연장한다.
- (ii) **스케줄러 지연 시 기산점**: D+5 카운터의 시작은 달력 1일이 아니라 `shortlist.generated` 이벤트 시각. 스케줄러가 재시도 후 1일 18:00에 완료되면 거기서부터 D+5 재기산.
- (iii) **재분석(Reject→재생성) SLA**: 재분석 큐 등록부터 완료까지 **최대 3시간**. 재분석 소요 시간은 D+5 총량에 포함(재분석 지연으로 D+5가 연장되지 않음).

**확장 후보 (Should/Nice)**:
- ~~D-OOS-7 데이터 파이프라인 헬스체크 대시보드~~ → **M18로 Must 승격 (v1.1 · D14)**. 박제 위치: `§3.12 M18`.
- ~~D-OOS-6 AI API 비용 모니터링~~ → **M17로 Must 승격 (v1.1 · D14)**. 박제 위치: `§3.12 M17`.


#### User Story & AC — M10 월간 자동 배치 스케줄러
- **Story**: 어드민으로서, 매월 선정 작업을 빠뜨리지 않기 위해, 매월 1일 09:00 KST에 Short List 30 생성과 리포트가 자동으로 완료되는 기능을 원한다.
- **AC**:
  - [ ] 매월 1일 09:00 KST에 수동 조작 없이 배치가 실행되고, 완료 시 어드민 3명에게 텔레그램 알림이 발송된다.
  - [ ] 배치 성공 시 `shortlist.generated` 이벤트가 기록되고, 이 시점부터 D+5 마감 카운터가 기산된다.
  - [ ] 배치 실패 시 `shortlist.generation_failed` 이벤트 기록 + 텔레그램 실패 알림 발송 + 재시도 큐 등록이 이루어지고, 홈 화면에 "Short List 생성 지연" 배너가 표시된다.
#### DoD (Definition of Done) — M10 월간 자동 배치 스케줄러
- [ ] 매월 1일 09:00 KST에 수동 조작 없이 배치가 실행되고, 완료 시 어드민 3명에게 텔레그램 알림이 발송된다.
- [ ] 배치 성공 시 `shortlist.generated` 이벤트가 기록되고 D+5 마감 카운터가 기산된다(장기 연휴 시 영업일수만큼 연장).
- [ ] 배치 실패 시 `shortlist.generation_failed` 이벤트 기록 + 텔레그램 실패 알림 + 재시도 큐 등록이 이루어지며, 최대 3회 재시도 후에도 실패하면 전월 Short List가 유지되고 홈에 "Short List 생성 지연" 배너가 표시된다.
- [ ] **AI API 비용 가드 (P5 I-03)**: 월 누적 AI 비용 35만원 도달 시 어드민 3인에게 경보 알림, 40만원 도달 시 자동 재생성(수동·자동 재분석 모두) 하드 캡으로 차단한다.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.10 일간/이벤트 알림 (J2·J3 · Must M11·M12·M13·M15)

> **→ 전략 배경**: §1.3 J2 일간 모니터링 · J3 Exit 타이밍 · §1A.3 IM-3(Exit 신뢰도) · IM-4(모닝 브리핑 참여율) 참조.

**기능 설명**: 어드민의 일간 루틴(Journey 2, customer-journey.md)과 긴급 Exit 여정(Journey 3)을 지원하는 알림 계층. 모닝 브리핑으로 하루를 시작하고, 장중 이상 감지로 즉각 대응하며, Exit 시그널로 매도 타이밍을 놓치지 않는다. §1A.4 Anti-Metric "Exit 시그널 미수신 1건+"를 방어하는 핵심 기능군.

**M11 핵심 요구사항 — 모닝 브리핑 요약 카드**:
- R3.10-1: 매일 08:00 KST에 자동으로 모닝 브리핑을 생성하여 텔레그램 + `/admin` 홈 상단 카드로 동시 발송한다.
- R3.10-2: 브리핑 내용은 전체 포트폴리오 P&L(승인가 기준 당일 수익률) · 주의 종목 N건(Crisis 플래그 또는 뉴스 Warning 이상) · 핵심 뉴스 3건(M12 분류 결과 상위)을 1화면(3~5줄) 이내로 요약한다.
- R3.10-3: 어드민이 브리핑 카드(텔레그램 또는 대시보드)를 열람하면 `briefing.viewed` 이벤트(admin_id · channel · timestamp)를 기록한다. IM-4(모닝 브리핑 참여율 80%+) 측정의 기반.
- R3.10-4: 브리핑 생성 실패(데이터 파이프라인 오류 등) 시 "오늘 브리핑 생성 불가" 텍스트를 대신 발송하고 `briefing.failed` 이벤트를 기록한다.

**M12 핵심 요구사항 — 뉴스 심각도 분류기**:
- R3.10-5: 보유 30종목 각각에 대해 전날 밤사이 뉴스·공시를 Critical / Warning / Info 3등급으로 자동 분류한다. 분류 근거 1줄을 각 뉴스 항목에 동반 표시한다.
- R3.10-6: Critical 등급 뉴스 발생 시 텔레그램 즉시 알림을 발송하고 `/admin/alerts`에 이력을 저장한다. Warning 등급은 모닝 브리핑(M11)에 포함. Info 등급은 `/admin/alerts` 이력에만 기록.
- R3.10-7: 뉴스 분류 결과는 IM-3(Exit 시그널 신뢰도) 계산의 입력 데이터로 사용된다. Critical 뉴스가 M15 Exit 시그널 트리거의 우선 후보가 된다.

**M13 핵심 요구사항 — 장중 이상 감지 알림**:
- R3.10-8: 상시 모니터링 모드(§3.5) 활성 시 보유 종목 중 ±5% 가격 변동 또는 거래량 3배 초과를 감지하면 텔레그램 즉시 알림 + `/admin` 홈 상단 배지를 동시에 트리거한다.
- R3.10-9: 종목별 on/off 토글(§3.5 R3.5-3)이 OFF인 종목은 장중 이상 감지 알림을 발송하지 않는다. 디폴트는 전체 ON.
- R3.10-10: 임계치 수치(±5%, 거래량 3배)는 현재 고정값이며, 세밀한 커스텀은 Phase 2 범위(§3.5 확장 후보 참조).

**M15 핵심 요구사항 — Exit 시그널 발송 + 근거 + 대안**:
- R3.10-11: Exit 트리거(목표가 도달 · 모멘텀 꺾임 · 악재 발생) 감지 시 텔레그램 + 이메일 + `/admin/alerts` 세 채널에 동시 발송한다. 어드민 3인 모두 수신.
- R3.10-12: Exit 시그널 발송 시 `exit.signal.sent` 이벤트(ticker · severity · timestamp · trigger_reason)를 즉시 기록한다. T+7일 후 해당 종목 가격 변화를 조회하여 `exit.signal.outcome`(t7_price_change)을 자동 적재한다. IM-3(Exit 시그널 신뢰도 65%+) 측정의 유일한 데이터 소스.
- R3.10-13: `/admin/alerts/[id]` 상세 화면에 트리거 이벤트 설명 · 심각도 · 매도 근거 · 대안 시나리오 3개(매도 전량 / 분할매도 / 홀딩)를 표시한다. 리포트 §7 Exit 조건과 현재 상황의 자동 대조 블록을 포함한다.
- R3.10-14: `/admin/alerts/[id]`에서 어드민이 "매도 전량 / 분할매도 / 홀딩" 중 하나를 선택하고 근거 메모를 입력할 수 있는 결정 기록 입력란을 제공한다. 입력된 기록은 이력에 저장한다.
- R3.10-15: **Exit 시그널 백업 채널 (D10, P5 I-01 해소 · 2026-04-19 22차 재결정)**: 텔레그램·이메일 2채널 중 **하나 실패 시 다른 채널이 catch-up**(재시도 포함)한다. **둘 다 실패 시 D10 catch-up: 이메일 1회 추가 재시도**를 수행한다. 2채널 + 재시도 모두 실패 시에도 `/admin` 대시보드 상단 배지는 **항상 작동**하여 최소 1채널을 보장한다. Anti-Metric "Exit 시그널 미수신 1건+" 방어를 Must 범위에 포함. **SMS는 제거됨** — 어드민 3명·500cap 초대제에서 텔레그램 푸시가 잠금화면 알림을 대체, SMS 추가 가치 대비 벤더·비용 복잡도 과대.

**확장 후보 (Should/Nice)**:
- S15 Exit 저널(매도 이유 + 사후 추적): IM-3 신뢰도 데이터 풍부화. 박소연 "내가 틀렸나 AI가 틀렸나" 검증. → Should.
- S16 홀딩 기간 초과 경보: 단기/중기/장기 버킷별 홀딩 기간 초과 시 알림. → Should.
- S6 매크로 컨텍스트 축소판(M11 보강): KOSPI/금리/환율 미니 차트를 모닝 브리핑에 추가. → Should.


#### User Story & AC — M11 모닝 브리핑 요약 카드
- **Story**: 어드민으로서, 매일 아침 10분 안에 포지션 상태를 파악하기 위해, 08:00 KST 자동 생성되는 브리핑 카드를 원한다.
- **AC**:
  - [ ] 매일 08:00 KST에 브리핑이 텔레그램과 `/admin` 홈 상단 카드에 동시 표시된다.
  - [ ] 브리핑 열람 시 `briefing.viewed` 이벤트가 기록되어 IM-4(모닝 브리핑 참여율) 측정에 반영된다.
#### DoD (Definition of Done) — M11 모닝 브리핑 요약 카드
- [ ] 매일 08:00 KST에 수동 조작 없이 브리핑이 생성되어 텔레그램과 `/admin` 홈 상단 카드에 동시 표시된다.
- [ ] 브리핑 내용에 전체 P&L · 주의 종목 건수 · 핵심 뉴스 3건이 3~5줄 이내로 요약된다.
- [ ] 브리핑 열람 시 `briefing.viewed` 이벤트가 기록되고, 생성 실패 시 "오늘 브리핑 생성 불가" 텍스트와 `briefing.failed` 이벤트가 기록된다.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M12 뉴스 심각도 분류기
- **Story**: 어드민으로서, 노이즈를 걸러내고 실질적 위험에 집중하기 위해, 보유 종목 뉴스를 Critical/Warning/Info로 자동 분류하는 기능을 원한다.
- **AC**:
  - [ ] 보유 30종목의 밤사이 뉴스·공시가 3등급으로 분류되고, 각 항목에 분류 근거 1줄이 표시된다.
  - [ ] Critical 등급 뉴스 발생 시 텔레그램 즉시 알림이 발송되고 `/admin/alerts`에 이력이 저장된다.
#### DoD (Definition of Done) — M12 뉴스 심각도 분류기
- [ ] 보유 30종목의 밤사이 뉴스·공시가 Critical / Warning / Info 3등급으로 분류되고, 각 항목에 분류 근거 1줄이 표시된다.
- [ ] Critical 등급 뉴스 발생 시 텔레그램 즉시 알림이 발송되고 `/admin/alerts`에 이력이 저장된다. Warning은 모닝 브리핑에 포함, Info는 이력에만 기록된다.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M13 장중 이상 감지 알림
- **Story**: 어드민으로서, 장중 급변 종목을 놓치지 않기 위해, ±5% 가격 변동 또는 거래량 3배 초과 시 즉시 알림을 받는 기능을 원한다.
- **AC**:
  - [ ] 상시 모니터링 모드 활성 시 임계치 발동 종목에 대해 텔레그램 즉시 알림과 홈 상단 배지가 동시에 트리거된다.
  - [ ] 종목별 on/off 토글이 OFF인 종목은 임계치 발동 시에도 알림이 발송되지 않는다.
#### DoD (Definition of Done) — M13 장중 이상 감지 알림
- [ ] 상시 모니터링 모드 활성 시 ±5% 가격 변동 또는 거래량 3배 초과 종목에 대해 텔레그램 즉시 알림과 `/admin` 홈 상단 배지가 동시에 트리거된다.
- [ ] 종목별 ON/OFF 토글이 OFF인 종목은 임계치 발동 시에도 알림·배지가 발송되지 않는다.
- [ ] `npm run build` + `npm run lint` 통과.

#### User Story & AC — M15 Exit 시그널 발송 + 근거 + 대안
- **Story**: 어드민으로서, 매도 타이밍을 절대 놓치지 않기 위해, Exit 트리거 발생 시 근거와 대안 시나리오가 포함된 즉시 알림을 원한다.
- **AC**:
  - [ ] Exit 트리거 감지 시 텔레그램·이메일 2채널 + `/admin/alerts` 배지가 동시 발송되고 `exit.signal.sent` 이벤트가 기록된다.
  - [ ] `/admin/alerts/[id]` 상세 화면에 트리거 설명·심각도·대안 시나리오 3개(매도 전량/분할매도/홀딩)와 어드민 결정 기록 입력란이 표시된다.
  - [ ] T+7일 후 `exit.signal.outcome`이 자동 적재되어 IM-3(Exit 시그널 신뢰도) 측정에 반영된다.
#### DoD (Definition of Done) — M15 Exit 시그널 발송 + 근거 + 대안
- [ ] Exit 트리거 감지 시 텔레그램·이메일 2채널 + `/admin/alerts` 배지가 동시 발송되고 `exit.signal.sent` 이벤트(ticker·severity·timestamp·trigger_reason)가 기록된다.
- [ ] **백업 채널 (D10, 22차 재결정)**: 텔레그램·이메일 중 하나 실패 시 다른 채널 catch-up, 둘 다 실패 시 이메일 1회 추가 재시도가 작동한다. 대시보드 상단 배지는 항상 작동. (SMS 제거 — 22차)
- [ ] `/admin/alerts/[id]` 상세 화면에 트리거 설명·심각도·대안 시나리오 3개(매도 전량/분할매도/홀딩)와 어드민 결정 기록 입력란이 표시되며, 입력된 기록이 이력에 저장된다.
- [ ] T+7일 후 해당 종목 가격 변화를 조회하여 `exit.signal.outcome`이 자동 적재된다.
- [ ] **(v1.1 D14 연동)** Exit 시그널 발송 경로는 **M18 파이프라인 헬스체크**(알림 발송 파이프라인 성공률 95%+)와 **M19 Silent Health 일간 하트비트**(알림 발송 불능 상태에서 "조용한 장애" 방지)로 이중 감시된다. M18 warning 또는 M19 적색 경보 발생 시 Exit 시그널 신뢰도 계산에서 해당 시점을 블랙아웃 처리.
- [ ] `npm run build` + `npm run lint` 통과.
### §3.11 성과 측정 + Decision Tree (J4 · Must M8·M16)

> **→ 전략 배경**: §1.3 J4 성과 추적 · §1.7 성공 기준 · §1A.3 NSM(CAP Months) · BusinessPlan §Q4 참조.

**기능 설명**: 가상 포트폴리오 일별 스냅샷(M8)을 기반으로 월간/누적 수익률·Sharpe·alpha를 `/admin/track-record`에 표시하고, Y1 Decision Tree 진척도를 `/admin/decision-tree` 단독 화면(D9)에서 게이지로 시각화한다. 12개월 누적이 Core JTBD 완성의 측정 기준이며 법적 등록 판단의 근거가 된다.

**M8 핵심 요구사항 — `/admin/track-record`**:
- R3.11-1: `/admin/track-record`는 누적 수익률 · KOSPI 동기간 수익률 · alpha · Sharpe를 요약 카드 행으로 최상단에 표시한다.
- R3.11-2: 월별 성과 테이블(월 · 포트 수익률 · KOSPI · alpha · Sharpe · CAP 연속 월수)과 버킷별(단기/중기/장기) 분리 집계를 제공한다.
- R3.11-3: Counterfactual 블록("AI 비중 그대로 따랐으면 수익률 X%")을 표시하여 어드민 오버라이드의 영향을 가시화한다.
- R3.11-4: NSM(CAP Months) 수치를 track-record 화면에 참조용으로 함께 표시하되, Decision Tree 상세는 `/admin/decision-tree`로 분리한다.

**M16 핵심 요구사항 — `/admin/decision-tree` (D9)**:
- R3.11-5: `/admin/decision-tree`는 대시보드 위젯이 아닌 단독 화면으로 구성한다. 좌측 사이드바 탐색에서 "Decision Tree" 항목으로 직접 접근 가능.
- R3.11-6: 게이지 3종을 페이지 상단에 나란히 표시한다 — ①CAP Months(현재 N / 목표 12, 진행 바) · ②누적 Alpha(현재 +X.X% / 목표 양(+), 게이지) · ③Sharpe(현재 X.XX / 목표 > 1.0, 게이지).
- R3.11-7: 게이지 아래 월별 추이 라인 차트(CAP Months 누적 · alpha 추이 · Sharpe 추이)를 제공한다.
- R3.11-8: **미해결 ⑤(부분 표시 UX) 해소**: M1~M6(운용 1~6개월) 동안 데이터가 불완전한 게이지는 "N/12개월 진행 중" 레이블과 함께 현재까지 데이터만으로 부분 렌더링한다. 빈 게이지보다 진행률 표시가 어드민 동기부여에 유리하다. 애니메이션·색상 처리 상세는 → P7 UX 이관.
- R3.11-9: "Y1 목표 달성 예상" 요약 블록(현재 경로 기준 ○/△/✕)과 BusinessPlan §Q4 원문 참조 링크(내부 문서)를 하단에 제공한다.

**확장 후보 (Should/Nice)**:
- S17 Short List 적중률 트래커: §1.7 성공 기준 박제. M8 트래킹 엔진 위 집계 레이어(편입 종목 중 수익 종목 비율). → Should.
- N1 Attribution 분석(선택/타이밍/비중): 12개월 데이터 누적 후 의미 있음. → Nice, Y2.
- N2 Drawdown 분석(MDD·회복기간): M16 Decision Tree 핵심 수치만 흡수, 상세는 Y2. → Nice.

#### User Story & AC — M16 Decision Tree 진척도 대시보드
- **Story**: 어드민으로서, Y1 말 법적 등록 판단을 준비하기 위해, CAP Months·누적 alpha·Sharpe를 한눈에 볼 수 있는 전용 화면을 원한다.
- **AC**:
  - [ ] `/admin/decision-tree`에서 게이지 3종(CAP Months / 누적 Alpha / Sharpe)이 현재값과 목표값 함께 표시된다.
  - [ ] 게이지 아래 월별 추이 라인 차트가 렌더되고, 운용 1개월 시점에도 "N/12개월 진행 중" 레이블과 함께 부분 렌더링된다.
  - [ ] "Y1 목표 달성 예상 ○/△/✕" 요약 블록이 게이지 데이터와 연동되어 자동 갱신된다.
#### DoD (Definition of Done) — M16 Decision Tree 진척도 대시보드
- [ ] `/admin/decision-tree` 단독 화면이 사이드바 탐색에서 직접 접근 가능하고, 게이지 3종(CAP Months / 누적 Alpha / Sharpe)이 현재값·목표값과 함께 렌더된다.
- [ ] 운용 1개월 시점처럼 데이터가 불완전한 경우에도 "N/12개월 진행 중" 레이블과 함께 부분 렌더링이 표시된다(빈 게이지 없음).
- [ ] 게이지 아래 월별 추이 라인 차트가 렌더되고, "Y1 목표 달성 예상 ○/△/✕" 요약 블록이 게이지 데이터와 연동되어 자동 갱신된다.
- [ ] **○/△/✕ 판정 기준 (P5 I-13)**: ○ = alpha ≥ 0 **AND** Sharpe ≥ 0.5 **AND** MDD ≤ -15% 이상 양호 / △ = 중간(하나 경계 미달) / ✕ = 둘 이상 미달. 기준은 Y1 Decision Tree 실제 발동 이전 BuildPhase B4에서 재검증.
- [ ] `npm run build` + `npm run lint` 통과.

### §3.12 시스템 관측·가드레일 (J5 · Must M17·M18·M19)

> **v1.1 신설 (D14, Q-OP1 해소)** — Anti-Metric 4종 전체의 실시간 방어층. Deferred에 있던 D-OOS-6·D-OOS-7 + 신규 Silent Health Must 승격. Anti-Metric "AI API 월 40만원" · "Exit 시그널 미수신" · "리포트 생성 실패 1건+"를 조기 감지·차단.
>
> **→ 전략 배경**: §1A.4 Anti-Metrics 방어 기능 열 · §3.10 M15 Exit 시그널 · §3.9 M10 스케줄러 참조.

**기능 설명**: 어드민 3인이 시스템이 "조용한지 / 정상인지 / 장애인지"를 즉시 구분할 수 있도록 하는 관측 레이어. (1) 비용이 폭주하는지 (M17), (2) 파이프라인이 죽었는지 (M18), (3) 아무 일도 없는지 혹은 적색 경보인지 (M19)를 일간 단위로 분리 감지한다.

#### M17 핵심 요구사항 — AI API 비용 실시간 모니터링 대시보드 (D-OOS-6)

- R3.12-1: `/admin/settings` 또는 어드민 대시보드 상단에 **당월 누적 AI API 비용 위젯**을 배치한다. 일별·월별 추이 라인 차트 + 현재 금액(₩) + 당월 cap 대비 진행률(%)을 표시한다. EOD 배치 + 상시 모니터링 모드에서는 장중 갱신.
- R3.12-2: **35만원 도달 시** 경보 알림(텔레그램·이메일)을 어드민 3인에게 발송한다. **40만원 도달 시 자동 재생성 차단 하드 캡**이 발동하여 수동 재생성 버튼(§3.4 R3.4-4)과 자동 재분석(R3.3-3)을 모두 차단한다. 사용자 override 액션으로만 해제 가능하며, override는 `admin/settings` 별도 토글로 로그 기록.
- R3.12-3: 비용 기여 상위(종목·페르소나·섹션·모델) 브레이크다운 테이블을 위젯 하단에 제공한다. Top 5 비용 기여 항목을 일별/월별로 스위치하여 조회 가능. 프롬프트 최적화 판단 지원.

- **User Story**: 어드민으로서 당월 AI 비용을 실시간으로 볼 수 있어, Anti-Metric 40만원 트리거 이전에 선제 대응하고 싶다.
- **AC**:
  - [ ] `/admin` 또는 `/admin/settings`에 당월 누적 AI API 비용 위젯이 렌더되고, 일별·월별 추이 + 현재 금액 + cap 대비 진행률이 표시된다.
  - [ ] 35만원 도달 시 텔레그램·이메일 경보가 어드민 3인에게 발송된다.
  - [ ] 40만원 도달 시 수동 재생성 버튼과 자동 재분석이 자동 차단되고, 차단 해제는 설정 override로만 가능하다.
  - [ ] 비용 기여 상위 Top 5(종목·페르소나·섹션·모델) 테이블이 일별/월별 스위치로 제공된다.
  - [ ] 비용 추정 실패·수집 누락 시 "비용 데이터 일시 중단" 표시가 노출되고 `cost.feed.failed` 이벤트가 기록된다.

- **DoD**:
  - [ ] 당월 누적 AI API 비용 위젯이 일별·월별 추이·현재 금액·cap 진행률과 함께 정상 렌더된다.
  - [ ] 35만원 도달 시 텔레그램·이메일 경보가 발송되고, 40만원 도달 시 자동 재생성 하드 캡이 실제로 재생성 경로를 차단한다.
  - [ ] override 토글 작동 + override 사용 내역이 로그에 기록된다.
  - [ ] Top 5 비용 기여 브레이크다운이 종목·페르소나·섹션·모델 기준으로 전환 가능하다.
  - [ ] `npm run build` + `npm run lint` 통과.

#### M18 핵심 요구사항 — 파이프라인 헬스체크 대시보드 (D-OOS-7)

- R3.12-4: 5개 핵심 파이프라인(**DART 크롤러·뉴스 수집·가격 피드·AI 호출·알림 발송**)의 일간 성공률을 모니터링한다. 각 파이프라인별 건수/성공수/성공률(%)·마지막 성공 시각·마지막 실패 시각을 `/admin/health` 또는 관측 대시보드에 표시한다.
- R3.12-5: **성공률 95% 미만 시 자동 운영자 호출**(텔레그램·이메일 Critical 등급)을 어드민 3인에게 발송한다. **99% 미만이면 warning 등급**으로 대시보드 배지만 표시(호출 없음).
- R3.12-6: **실시간 error log tail**(최근 50줄) + 최근 24시간 실패 트레이스(타임스탬프 · 파이프라인 · 스택 요약)를 대시보드 하단에 제공한다. 로그 적재 실패 시 "로그 파이프라인 단절" 배너 자체가 Critical 경보를 트리거한다.

- **User Story**: 어드민으로서 파이프라인 장애를 조기 감지하여, Exit 시그널 미수신 리스크(Anti-Metric)와 리포트 생성 실패(Anti-Metric)를 방지하고 싶다.
- **AC**:
  - [ ] `/admin/health`에 5개 파이프라인의 성공률·마지막 성공/실패 시각이 표시된다.
  - [ ] 성공률 95% 미만 시 Critical 알림이 텔레그램·이메일로 어드민 3인에게 발송된다.
  - [ ] 성공률 99% 미만 시 warning 배지만 대시보드에 표시되고 호출은 발생하지 않는다.
  - [ ] 실시간 error log tail과 최근 24시간 실패 트레이스가 렌더된다.
  - [ ] 로그 파이프라인 자체 단절 시 "로그 파이프라인 단절" Critical 배너가 트리거된다.

- **DoD**:
  - [ ] 5개 핵심 파이프라인(DART·뉴스·가격·AI·알림 발송) 각각의 일간 성공률·마지막 성공/실패 시각이 `/admin/health`에 렌더된다.
  - [ ] 95% 미만 Critical 알림 / 99% 미만 warning 배지 2단 분기가 정상 작동한다.
  - [ ] error log tail(최근 50줄)과 최근 24시간 실패 트레이스가 표시된다.
  - [ ] 로그 파이프라인 단절 시 자체 Critical 배너가 트리거된다.
  - [ ] `npm run build` + `npm run lint` 통과.

#### M19 핵심 요구사항 — Silent Health 일간 하트비트

- R3.12-7: **장 운영일 자정 배치**가 성공하면 **"오늘 이상 없음" 브리핑 카드**를 어드민 3인에게 텔레그램·이메일·앱(대시보드) 3채널로 **무조건** 발송한다. 카드 내용: 일자·5개 파이프라인 성공률 요약·당월 AI 비용 현황·Exit 시그널 발송 건수·브리핑 수신 확인.
- R3.12-8: 자정 배치 실패 또는 핵심 파이프라인 중 하나라도 Critical 상태이면 하트비트 카드를 **"적색 경보" 카드로 전환**하여 동일 3채널에 발송한다. "조용한 장애"(시스템이 죽었는데 알림도 없는 상태)를 원천 방지하는 최후 안전망.

- **User Story**: 어드민으로서 시스템이 조용할 때 "장애인지 평온인지"를 즉시 구분하여, Exit 시그널 미수신 Anti-Metric을 원천 방어하고 싶다.
- **AC**:
  - [ ] 장 운영일 자정 배치 성공 시 "오늘 이상 없음" 하트비트 카드가 텔레그램·이메일·앱 3채널에 무조건 발송된다.
  - [ ] 자정 배치 실패 또는 파이프라인 Critical 시 "적색 경보" 카드로 전환되어 동일 3채널에 발송된다.
  - [ ] 하트비트 카드에 일자·파이프라인 성공률·AI 비용·Exit 시그널 건수·수신 확인 링크가 포함된다.
  - [ ] 어드민 3인 모두 카드 수신 없이 24h 경과하면 `heartbeat.missing` 이벤트가 기록되어 별도 감사 로그로 적재된다.
  - [ ] 채널 중 하나 실패 시 나머지 2채널이 catch-up 발송한다(M15 D10 백업 로직 재사용).

- **DoD**:
  - [ ] 장 운영일 자정 배치 성공 시 "오늘 이상 없음" 카드가 텔레그램·이메일·앱 3채널에 무조건 발송된다.
  - [ ] 배치 실패·파이프라인 Critical 시 "적색 경보" 카드로 전환되어 동일 3채널에 발송된다.
  - [ ] 카드 내용에 일자·파이프라인 성공률·AI 비용·Exit 시그널 건수·수신 확인 링크가 포함된다.
  - [ ] 3채널 중 1채널 실패 시 나머지 채널이 catch-up하고, 24h 전원 미수신 시 `heartbeat.missing`이 기록된다.
  - [ ] `npm run build` + `npm run lint` 통과.

**확장 후보 (Should/Nice)**:
- S18 비용 최적화 시뮬레이터: 프롬프트 압축·Sector Board 샘플링 축소 시 예상 비용을 시뮬레이션. M17 위 레이어. → Should, B3 이후.
- S19 파이프라인 SLA 리포트: 월간 파이프라인 SLA 요약 PDF. → Should.
- N3 하트비트 히스토리 캘린더 뷰: 12개월 Silent Health 이력 캘린더. → Nice.

---

### §3.13 자동매매 프레임 (S8, 2026-04-21 D16 신설)

> **본 섹션은 개요·경계만**. 요구사항(R3.13-x)·Tasks·DoD 상세는 `Document/Build/Slices/S8-AutoTrading.md`. 본 섹션 변경 시 슬라이스 파일도 동시 갱신.

**기능 설명**: 어드민이 가상 포트(레이어 A)를 실제 자금으로 옮겨 담는 집행 서브시스템(§1A.0 경로 2). 주식(KIS) + 코인(바이낸스 USDT-M 선물)을 모두 포함한다. "**Strategy 파일 drop-in + AI 어댑터 embed**" 이중 경로 설계로, AI agent·skill 본체는 어드민이 추후 교체 가능하도록 인터페이스만 박제한다.

**핵심 범위 (S8)**:

| 축 | 내용 |
|---|---|
| **자산군** | 주식(KIS 국내·모의↔실계좌) · 코인(바이낸스 USDT-M 선물·테스트넷↔메인넷) |
| **대상 종목 스코프** | Short List 30 / 자유 종목 (어드민 임의 추가) / 바이낸스 선물 종목 — UI에서 **선택 가능** |
| **의사결정 경로** | (1) Strategy 파일 drop-in · (2) AI 어댑터 embed — 둘 다 기본 제공 (AI 본체는 추후) |
| **리스크 가드레일 (기본값)** | 레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 횟수 ≤ 20회 — `/admin/settings/risk`에서 조정 |
| **체결 모드** | 모의(KIS 모의투자 / 바이낸스 테스트넷) → 실(실계좌 / 메인넷) · 사용자 명시 토글로만 전환 |
| **로그** | 주문 큐 · 체결 이력 · 포지션 · 미실현 PnL · (코인) 청산가 · 펀딩비 |
| **신규 엔티티** | E12 ExchangeConnection(코인) · E13 OrderQueue · E14 TradeExecution · E15 RiskPolicy (S8에서 마이그레이션 0009+) |
| **라우트** | §2 "S8 자동매매 추가 라우트" 표 참조 (6종) |

**요구사항 요약 (상세 R번호는 S8 슬라이스 파일)**:

- (1) 모의↔실 체결 토글은 **대표 1인만** 전환 가능(Q3 추천 유지). 나머지 2인은 읽기/모의까지만.
- (2) 주식 자동매매는 AI 가상 포트 Accept 종목에 자동 반영하는 옵션 외, 자유 종목 수동 추가도 허용.
- (3) 바이낸스 선물은 `SYMBOL` 입력 기반(예: BTCUSDT·ETHUSDT). 공매도/롱숏 양방향 허용. 레버리지·SL/TP 필수 입력.
- (4) Strategy 파일은 `src/lib/trading/strategies/{stock,crypto}/*.ts`에 drop-in. 공통 타입(`TradingStrategy`)을 구현하면 자동 인식. 각 파일 활성/비활성 토글.
- (5) AI 어댑터(`decideOrder(state) → OrderPlan`)는 빈 인터페이스로 박아두고, Anthropic SDK wrapper 연결은 Policy Engine 아래 `src/lib/trading/ai/`에 둔다. 본체 함수는 throw(`not-embedded`) 기본, 어드민이 skill/agent 파일 drop-in.
- (6) Policy Engine은 주문 생성 직전 최종 가드: 가드레일 초과 주문은 drop + `RiskViolationEvent` 기록.
- (7) Q16 법무·Q17 약관은 어드민 내부 도구 단계에서 불필요. Deferred-D 재개 시 재검토.

**AI 역할 경계 (§1.5 보강과 정합)**:
- AI는 Strategy·어댑터 **둘 중 하나**를 통해 주문 plan을 제안. 최종 실행 전 Policy Engine 가드 필수.
- 어드민이 수동 override 가능: 모든 AI 제안 주문은 `requires_confirmation` 플래그로 dry-run 기본 → 어드민 승인 후 체결(대표 선택 시 자동 실행 모드 활성 가능).

**DoD (슬라이스 수준 요약)**:
- [ ] 6개 라우트 렌더 + `npm run build` 통과
- [ ] Strategy drop-in 규약 문서 + 샘플 전략 2건(주식 1 + 코인 1) mock 체결까지 동작
- [ ] AI 어댑터 인터페이스 + 빈 훅(`throw`) + Anthropic SDK wrapper 연결 위치만 스텁
- [ ] Policy Engine 기본값 테스트 (`test:ci` 케이스 추가)
- [ ] 모의↔실 토글 대표 1인 권한 가드 동작

**확장 후보 (S8 이후)**:
- Strategy 백테스트 러너(`/admin/trading/backtest`)
- 포지션 상관관계·섹터 집중도 경고
- 옵션·현물 코인 확장

---

## 4. 데이터 모델·연동

> **P4.1 본문화 완료 (2026-04-15)**. 원자료: `.omc/research/quant-data-architecture.md` (16 엔티티 카탈로그 + 5 ADR). Supabase 스키마 상세·인덱스·RLS 정책은 BuildPhase B2.2에서 확정.

### §4.1 외부 데이터 소스

| 소스 | 용도 | 갱신 | Stage 1 포함 |
|---|---|---|---|
| **pykrx** (`krx.get_market_ohlcv`) | OHLCV 일별 가격 데이터 | EOD(장 마감 후) | ✅ |
| **pykrx** (`krx.get_market_cap`) | 유니버스 구성 (KOSPI top25 + KOSDAQ top15 ≈ 40종목) | 분기 | ✅ |
| **한국투자증권 API** | 장중 실시간 가격 스트림 (상시 모니터링 모드 전용) | 실시간 | ✅ (상시 모드) |
| **DART** | 재무 데이터 (PER/PBR/ROE, 리포트 Section 2·3) | 분기·수시 | ✅ |
| **뉴스 벤더** | 종목별 뉴스·공시 (M12 분류기 입력) | 이벤트 드리븐 | ✅ |
| KRX 경제 캘린더 | FOMC·CPI 등 거시 이벤트 일정 | 주간 | Should (S9) |

> 실데이터 연결 구현은 BuildPhase B3.2. Stage 1 개발 중 모든 소스는 `tudal/src/lib/data/mock-*.ts` mock으로 대체.

---

### §4.2 핵심 엔티티 (서비스 기획 뷰)

어드민 서비스 기능과 직결되는 8개 엔티티. 전체 16 엔티티 상세는 `quant-data-architecture.md §Data Entity Catalog` 참조.

#### E1. ShortList30 (월간 Short List)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| month | date | 해당 월 (YYYY-MM-01) |
| ticker | varchar | 종목 코드 |
| bucket | enum | short / mid / long |
| rank | int | 버킷 내 순위 (1~10) |
| composite_score | numeric | 5-Signal Composite (0~100) |
| trend_score | numeric | 추세 축 점수 |
| momentum_score | numeric | 모멘텀 축 점수 |
| volatility_score | numeric | 변동성 축 점수 |
| signal_label | text | 단문 신호 텍스트 |
| delta_status | enum | new / hold / removed |
| delta_reason | text | 변동 사유 1~2줄 |
| summary_3line | text | 선정 근거 3줄 요약 (M6) |
| suggested_weight | numeric | AI 제안 비중 (%) |
| created_at | timestamptz | 배치 생성 시각 |
| name | text NULL | 종목명 (mig 0012). nullable additive — Python seed 채움. |
| sector | text NULL | canonical 14 sector 중 하나 (mig 0012). nullable additive. canonical 결정성 = `canonical-sectors.ts` SoT. |
| sub_tags | jsonb NULL | **D21 (52차, mig 0018)** 신규. 운영 UI taxonomy sub_tags (조선·방산·화학·게임·가전·제약·부동산 등). canonical sector는 sector 컬럼 (primary), sub_tags는 secondary descriptors. NULL 허용 첫 단계 — Tier 2 impl PR이 backfill 정책 결정. GIN index `short_list_30_sub_tags_gin_idx`. |

**갱신 주기**: 월 1회 배치 (매월 1일 09:00 KST, M10 스케줄러). **관계**: StockReport(1:1, 같은 ticker+month), PortfolioSnapshot(N:1, 같은 month).

**현재 상태 vs 정정 후 박제 (D23, 53차 §5 Group B mismatch 정정)**:

| 시점 | 30 rows 산출 방식 | 마이그 | Tier 1 AI 호출 | 박제 SoT |
|---|---|---|---|---|
| **현재 (production)** | **Tier 0 단독 30 직선정** (인디케이터·DART numeric narrow만 사용, AI 키 0 fallback) | 0002 신설 + 0012 name·sector + 0018 sub_tags jsonb | **0 호출** | T7e.8 박제 (45차) + D23 (53차 §5) 정정 |
| **정정 후 (PR2 implementation 후)** | **Tier 1 AI 30 선정** (Tier 0 150 후보 → Core 11 AI 평가 + 시간대별 페르소나 가중치 → 단/중/장 top 10 = 30) | (PR2 시 마이그 추가 또는 0002~0018 컬럼 재사용 결정) | 150 후보 전체 또는 60/30 narrow (PR2 결정, 사용자 API 금액 무관 명시) | D19 + D23 메인 path 박제 |

**중요**: "AI 키 미발급 fallback = Tier 0 단독" 어휘 (D19 (g) 원본)는 **D23 (53차 §5)에서 메인 path가 아닌 fallback으로 명확화**됨. fallback이 메인 path로 굳어진 상태가 Group B mismatch. PR2 후속 implementation으로 메인 path = Tier 1 AI 30 선정 enable.

---

#### E2. StockReport (종목 풀 리포트)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| ticker | varchar | 종목 코드 |
| month | date | 보고서 기준 월 |
| version | int | 재생성 시 증가 (1부터) |
| schema_version | int | 스키마 버전 (NOT NULL DEFAULT 1, P5 I-07) |
| is_latest | boolean | 동일 (month, ticker) 내 최신 1건만 true (P5 I-07) |
| section_0 | jsonb | 투자 요약 + Conviction 게이지 + 투심위 미니바 |
| section_1 | jsonb | 기업 개요 |
| section_2 | jsonb | 재무 분석 |
| section_3 | jsonb | 밸류에이션 |
| section_4 | jsonb | 성장성 |
| section_5 | jsonb | 리스크 |
| section_6 | jsonb | 모멘텀 (5-Signal + 3축 출력 포함) |
| section_7 | jsonb | Exit 조건 |
| section_8 | jsonb | 최종 의견 + 투심위 투표 요약 (M3) — canonical contract: **§4.2.1** |
| appendix | jsonb | 부록 |
| regen_auto_count | int | 자동 재분석 사용 횟수 (월간, 상한 1) |
| regen_manual_count | int | 수동 재생성 사용 횟수 (월간, 상한 2) |
| generated_at | timestamptz | 생성 시각 |
| consensus_badge | text NULL | 합의 배지 5종 enum: **저장값 = emoji literal** `🟢 / 🔵 / 🟣 / 🟡 / ⚪` (labels: 🟢=strong/🔵=numeric/🟣=ai/🟡=wait/⚪=pending). **v1.6 (49차)** 신규. 마이그 0017 check constraint: `consensus_badge in ('🟢','🔵','🟣','🟡','⚪')`. Legacy nullable (backward compat); S7a 신규 row는 RPC가 NOT NULL 강제 (commit_persona_eval / commit_badge_only RPC body). UI 표시: NULL → ⚪ fallback 렌더 (Plan R3 BLOCKER 7). 코드 SoT: `tudal/src/lib/screening/consensus.ts` (`ConsensusBadge` type union 5 emoji literals). |

**갱신 주기**: 월 1회 배치 생성 + 재생성 시 version 증가. **관계**: ShortList30(1:1), CommitteeVote(1:N).

**인덱스 메모 (P5 I-07)**: section_* jsonb 필드에 **GIN 인덱스**(BuildPhase B2.3에서 확정) — 특정 지표 검색·Full-Text 쿼리용. **version 정책**: 동일 (month, ticker) 내 최신 1건만 `is_latest=true`, 이전 version은 이력 보존하며 `is_latest=false`.

---

##### §4.2.1 stock_reports.section_8 jsonb canonical contract (v1.6, 49차 신설)

> **SoT**: 본 항목은 `stock_reports.section_8` jsonb 컬럼의 canonical shape를 박제한다. **실제 zod schema = `tudal/src/lib/report/section-8-schema.ts`** (런타임 검증). 변경 시 본 문서와 코드 동기 갱신 (Q3 omxy 합의).

**canonical JSON shape** (요약):

```jsonc
{
  "partA": [ /* sectorVoteRow × (0 or 14) */ ],
  "partB": [ /* issueDebateExcerpt × 3~5 */ ],
  "partC": {
    "sector_aggregate": { "buy": number, "hold": number, "sell": number },
    "core_revote":       { "buy": number, "hold": number, "sell": number },
    "co_chair_unanimous": boolean,
    "verdict": "BUY" | "HOLD" | "SELL",
    "rationale": [ string ] // length 1~5
  },
  "partD": [ /* coreVoteRow × 11 */ ]
}
```

**필드 의미 표**:

| 필드 | 타입 | 필수 | 길이 | 의미 / 활성 조건 |
|---|---|---|---|---|
| `partA` | array(sectorVoteRow) | **required (property 자체)** | **0 또는 14** | Sector Board 위원별 한 줄 의견 표. **property는 항상 present** (zod schema `partA: z.array(...).refine(len === 0 || len === 14)`). 값으로 분기: **본 PR 범위 B** = `[]` (length 0, Tier 2 deferred). Tier 2 활성 시 = length 14 (해당 종목 섹터 14명 전원). **1~13은 invalid** (R3.7-7 ①, omxy R1 BLOCKER 2). **D21 (52차) 주석**: `14` = canonical 14 sectors × 14 personas/sector overlay 적용 후 fixed 활성화 수. slot 모델 = 10 base + 2 primary overlay + 2 sub_tag overlay. canonical 14 SoT = `Service/Report/ReportFramework.md §7.2/§7.3` + 코드 SoT = `tudal/src/lib/screening/canonical-sectors.ts`. |
| `partB` | array(issueDebateExcerpt) | required | 3~5 | 쟁점별 찬반 토론 인용 (찬성·반대·중재). R3.7-7 ③. |
| `partC` | object | required | — | 최종 합의 패널: sector_aggregate + core_revote + co_chair_unanimous + verdict + rationale(1~5줄). R3.7-7 ④. |
| `partD` | array(coreVoteRow) | required | **정확히 11** | Core 11 위원별 한 줄 의견 표. R3.7-7 ②. |

**vote 매핑 (writer ↔ DB)**:
- `section_8.partD[*].vote` (writer 산출물) = `BUY` / `HOLD` / `SELL` (3-way).
- DB 저장 시 `commit_persona_eval` RPC가 case 매핑: `BUY` → `approve` / `HOLD` → `abstain` / `SELL` → `reject` — `committee_votes.vote` check constraint(approve/reject/abstain) 호환. 매핑 책임 = RPC 내부 (마이그 0017).

**semantic constraints**:
- `partA.length ∈ {0, 14}` (부분 활성 금지 — 1~13 invalid).
- `partB.length ∈ [3, 5]`.
- `partC.rationale.length ∈ [1, 5]`.
- `partD.length === 11` (정확히).
- 모든 `vote` enum = `BUY | HOLD | SELL` (writer 레이어 표준; DB persist 시 RPC가 매핑).

---

#### E3. CommitteeVote (투심위 투표 기록)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| report_id | uuid | FK → StockReport |
| persona_id | varchar | 위원 식별자 (Core 11 + Sector board) |
| persona_layer | enum | core / sector |
| sector | varchar | 섹터 코드 (sector layer만) |
| vote | enum | approve / reject / abstain |
| argument_excerpt | text | 핵심 논거 인용 (M3 표시용) |
| created_at | timestamptz | 투표 기록 시각 |

**갱신 주기**: StockReport 생성 시 동기 생성. **관계**: StockReport(N:1).

---

#### E4. PortfolioApproval (승인 이벤트)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| month | date | 승인 대상 월 |
| admin_id | uuid | 승인 어드민 계정 ID |
| approval_type | enum | accept / reject |
| approved_at | timestamptz | 승인 확정 타임스탬프 (= 승인가 기준) |
| is_final | boolean | 확정 승인 여부 (선착순 1건만 true) |
| prev_portfolio_held | boolean | 전월 포트 유지 여부 (Reject 2차 또는 D+5 초과) |
| shortlist_generated_at | timestamptz | Short List 생성 시각 (FK 참조). **D15 R3.3-7 24h Holding 계산 기준** |
| dispute_raised_at | timestamptz NULL | 이의 제기 시각 (B·C 어드민). **D15 R3.3-10 48h 추가 Hold 기준** |
| dispute_raised_by | uuid NULL | 이의 제기 어드민 ID (v1.3, BL-7 A) |
| dispute_reason | text NULL | 이의 사유 자유 텍스트. DB constraint `length >= 20` (앱에서 `trim().length` 선검증). **v1.3 BL-7 A** |
| dispute_resolved_at | timestamptz NULL | 이의 해결 시각 (제기자 액션). dispute_raised_at + 48h 또는 dispute_resolved_at 중 먼저 도래 시 Hold 해제 |
| gating_auto_relief_active | boolean | 7일 연속 단일 admin_id 접속 감지 시 D15 2인 게이팅 자동 바이패스 활성 플래그 (v1.3, BL-20 A). AlertEvent `gating_auto_relief`와 매칭 |
| reanalysis_count | int | Reject 후 재분석 큐 진입 횟수 (상한 1). 재분석본 Reject 시 `prev_portfolio_held=true` + CAP Months 미포함 (v1.3, T3.4) |

> **v1.3 (S3 완료, 2026-04-17)**: (1) **BL-7 A**: `dispute_reason` 자유 텍스트(min 20자) + `dispute_raised_by` 추가. DB constraint `portfolio_approval_dispute_reason_min_len` (0004 §1)로 이중 가드. (2) **BL-20 A**: `gating_auto_relief_active` 추가. 7일 연속 단일 접속 감지 시 자동 바이패스. (3) **T3.4**: `reanalysis_count` 추가(≤1). Reject → 재분석 큐 stub.
>
> **v1.2 (S2 [G-5] 해소, 2026-04-17)**: `report_view_count` 필드 **삭제**. 2인 열람 게이팅은 E10 ReportViewLog 테이블에서 `COUNT(DISTINCT admin_id)` 집계로 대체. 사유: int 캐시는 1인 2회 열람을 2인으로 오판하는 버그 위험. E4는 월 1회 승인 이벤트에 단일 책임을 갖도록 정리.

**갱신 주기**: 어드민 승인 액션 시. **관계**: PortfolioSnapshot(1:N, 해당 month), ReportViewLog(게이팅 판정 시 읽기, FK 없음).

**유니크 제약 (P5 I-08)**: `UNIQUE (month) WHERE is_final=true` — 월당 확정 승인 1건만 허용. 선착순 race condition 방어(BuildPhase B3에서 DB 제약 + 낙관적 락 병행). **v1.1 D15 반영**: 유니크 제약은 변경 없음. Holding Period·2인 게이팅·이의 48h는 애플리케이션 레이어 가드(Accept 버튼 disabled + API 사전 검증)로 구현.

---

#### E5. PortfolioSnapshot (가상 포트 일별 스냅샷)

> **D11 박제**: 본 엔티티는 AI 가상 포트폴리오 트래킹 전용이며, 어드민의 **실제 증권사 계좌 포지션과 별개**의 가상 트래킹이다. 실제 체결 레이어는 E9 BrokerageConnection으로 분리(§1A.0 3경로 실행 모델).


| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| date | date | 스냅샷 날짜 |
| month | date | 포트폴리오 기준 월 |
| ticker | varchar | 종목 코드 (null = 포트 전체 행) |
| entry_price | numeric | 승인가 (종가 기준) |
| current_price | numeric | 당일 종가 |
| weight | numeric | AI 제안 비중 (%) |
| is_cash | boolean | 현금 항목 여부 |
| daily_return | numeric | 당일 수익률 |
| total_return | numeric | 승인가 대비 누적 수익률 |
| kospi_return | numeric | KOSPI 동기간 수익률 |
| alpha | numeric | total_return − kospi_return |
| sharpe | numeric | 누적 Sharpe Ratio |

**갱신 주기**: EOD 배치 (매일 장 마감 후). `portfolio.daily_snapshot` 이벤트와 1:1 매핑. **관계**: PortfolioApproval(N:1, 같은 month).

**entry_price 재계산 정책 (P5 I-09)**: `entry_price = PortfolioApproval.approved_at 당일 종가`. Reject → 재분석 → Accept 경로도 **최종 Accept 시점**의 당일 종가 기준으로 재계산한다(최초 Reject 시점 아님).

---

#### E6. AlertEvent (알림 이벤트)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| alert_type | enum | exit_signal / news_critical / price_anomaly / briefing / scheduler_fail / **gating_auto_relief** (v1.3, S3 BL-20 A) |
| ticker | varchar | 관련 종목 (없으면 null) |
| severity | enum | critical / warning / info |
| trigger_reason | text | 발동 이유 1줄 |
| signal_sent_at | timestamptz | 발송 시각 |
| outcome_at | timestamptz | T+7일 결과 적재 시각 (exit_signal만) |
| t7_price_change | numeric | T+7일 가격 변화율 (exit_signal만, IM-3 입력) |
| decision_recorded | enum | sell_all / partial_sell / hold / null | 
| decision_memo | text | 어드민 결정 메모 |
| is_read | boolean | 어드민 열람 여부 |

**갱신 주기**: 이벤트 드리븐 (실시간). T+7일 outcome은 배치로 자동 적재. **관계**: StockReport(N:1, ticker+month 기준).

---

#### E7. BriefingLog (모닝 브리핑 발송 기록)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| date | date | 브리핑 날짜 |
| content_summary | text | 발송 내용 요약 (3~5줄) |
| generated_at | timestamptz | 생성 시각 |
| sent_channels | jsonb | 발송 채널 목록 (telegram/dashboard) |
| view_events | jsonb | 열람 이벤트 배열 (admin_id·channel·viewed_at), IM-4 측정용 |
| generation_failed | boolean | 생성 실패 여부 |

**갱신 주기**: 매일 08:00 KST 배치. **관계**: AlertEvent(1:N, 해당 날짜 News·Anomaly 이벤트 참조).

---

#### E8. RegenCounter (재생성 카운터)

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| ticker | varchar | 종목 코드 |
| month | date | 기준 월 |
| auto_count | int | 자동 재분석 사용 횟수 (상한 1) |
| manual_count | int | 수동 재생성 사용 횟수 (상한 2) |
| reset_at | timestamptz | 다음 리셋 예정 시각 (매월 1일 00:00 KST) |

**갱신 주기**: 재생성 액션 시 증가, 매월 1일 리셋. **관계**: StockReport(N:1, ticker+month).

---

#### E9. BrokerageConnection (어드민 증권사/거래소 API 연결, D12 신설)

> **P5 D12 박제**: §1A.0 3경로 실행 모델 중 (2) 매뉴얼 트레이딩 · (3) 자동매매 서브시스템의 실제 체결 레이어. 가상 포트(E5)와 분리된 실계좌 연결 정보.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| admin_id | uuid | FK → 어드민 계정 (E6 AlertEvent의 admin_id 참조 대상과 동일 테이블) |
| broker | enum | KIS · Kiwoom · Samsung · KB · Mirae · Upbit · Binance · ... |
| account_no | varchar | 계좌번호 (평문 저장 · UI에서 마스킹, 예: `12345678-**`) |
| ~~api_key_ref~~ | ~~text~~ | **⚠️ DQ-7(2026-04-22)에서 폐기** — app-layer AES-256-GCM 암호화 컬럼 6개(`ciphertext_app_key·iv_app_key·auth_tag_app_key` + `ciphertext_app_secret·iv_app_secret·auth_tag_app_secret`)로 교체. 상세: `Slices/DQ7-Credentials.md §4.2` |
| mock_mode | boolean | DQ-7 신설 · KIS 모의투자(true)/실계좌(false). 실계좌 저장은 대표 1인만 허용 |
| strategy_label | varchar | 전략 라벨 — "단기 모멘텀", "장기 가치" 등 자유 텍스트 |
| scope | enum | manual · auto · both |
| is_active | boolean | 활성 여부 |
| created_at | timestamptz | 등록 시각 |
| last_used_at | timestamptz | 마지막 사용 시각 |

**제약**: `UNIQUE (admin_id, broker, account_no, strategy_label)` — **동일 증권사라도 전략별 복수 앱키 등록 허용** (1:N). **갱신 주기**: 어드민 등록·수정 액션 시. **관계**: Admin(N:1). E5 PortfolioSnapshot과는 **직접 관계 없음**(가상 트래킹과 분리).

---

#### E10. ReportViewLog (리포트 열람 로그, S2 G-5 옵션 B 신설)

> **2026-04-17 S2 [G-5] 옵션 B 해소**: D15 R3.3-8 2인 열람 게이팅을 E4 `report_view_count` int 캐시 대신 본 테이블의 `COUNT(DISTINCT admin_id)` 집계로 판정한다. 1인 2회 재진입이 게이팅 통과하는 버그를 배제. 감사 로그·참여율 분석 등 후속 지표(IM-1·IM-4)의 데이터 소스로도 재사용.

| 필드 | 타입 | 설명 |
|---|---|---|
| id | uuid | PK |
| admin_id | uuid | 열람 어드민 계정 ID |
| report_id | uuid | FK → StockReport (E2) |
| view_date | date | 열람 날짜 (KST 기준, UNIQUE 제약용) |
| viewed_at | timestamptz | 실제 진입 시각 |

**제약**: `UNIQUE (admin_id, report_id, view_date)` — 동일 어드민·동일 리포트 하루 내 재진입은 INSERT 시 onConflict do nothing. 2026-04-17 **BL-5 옵션 B** 해소 반영 (1일 1회 dedupe).

**갱신 주기**: 어드민이 `/admin/report/[ticker]` 진입 시 INSERT. **관계**: StockReport(N:1). E4 PortfolioApproval과는 **직접 FK 없음** — 게이팅 판정 시 집계 조회만([G-11] 자동 해소).

**RLS**: admin-only INSERT/SELECT (is_admin()). service_role 예외.

---

#### E11. KrBusinessDays (한국 영업일 캘린더, S3 BL-19 옵션 D 신설)

> **2026-04-17 S3 [BL-19] 옵션 D 해소**: D+5 영업일 카운터 + D15 R3.3-9 연휴 우회 계산의 단일 정본. pykrx 매 호출 대신 Supabase 캐시 테이블로 중앙화. 초기 seed는 0004 마이그레이션 수기 UPDATE(2024·2025·2026). 2027~2030은 S5 M10 월간 배치(`scripts/seed_kr_holidays.py`, venv + pykrx)가 덮어씀. 임시공휴일은 정부 발표 후 수기 또는 배치로 갱신.

| 필드 | 타입 | 설명 |
|---|---|---|
| date | date | PK — 모든 날짜 1행 |
| is_business_day | boolean | 개장일 여부 (주말·공휴일·임시휴장 false) |
| holiday_name | text NULL | 공휴일 명칭 (예: '설날', '대체공휴일(광복절)', '연말 휴장'). 평일·주말은 NULL |

**인덱스**: `(date) WHERE is_business_day = true` 부분 인덱스 — D+5 카운터 범위 스캔 최적화.

**갱신 주기**: 초기 seed 1회 + S5 M10 월간 배치 + 임시공휴일 발표 시 수기 UPDATE.
**관계**: PortfolioApproval(간접 — `shortlist_generated_at` 기준 영업일 계산 소스). 직접 FK 없음.

**RLS**: admin-only SELECT (is_admin()). 쓰기는 service_role (배치 스크립트·seed 마이그레이션).

**v1.3 반영**: E4 R3.3-9 "24h vs D+4 영업일 중 늦은 쪽 만료" 판정 소스. `src/lib/portfolio/business-days.ts`의 순수 함수 `addBusinessDays·countBusinessDaysBetween`이 본 테이블을 입력으로 받음.

---

### §4.3 엔티티 관계 요약

```
ShortList30 (month+ticker)
  ├─ 1:1 ─ StockReport (month+ticker, version 관리)
  │          ├─ 1:N ─ CommitteeVote (투심위 투표 기록)
  │          └─ 1:N ─ ReportViewLog (E10, 어드민 열람 로그 · D15 2인 게이팅 소스)
  └─ N:1 ─ PortfolioApproval (month 기준 승인 이벤트)
              └─ 1:N ─ PortfolioSnapshot (일별, NSM·alpha·Sharpe 계산)

AlertEvent (이벤트 드리븐)
  ├─ exit_signal → outcome T+7 자동 적재 (IM-3)
  └─ 참조: StockReport §7 Exit 조건

BriefingLog (일별 배치)
  └─ view_events → IM-4 모닝 브리핑 참여율

RegenCounter (ticker+month)
  └─ auto_count ≤1, manual_count ≤2 (D8 cap 가드)

BrokerageConnection (admin+broker+account+strategy, D12)
  └─ §1A.0 경로 (2)(3) 실제 체결 레이어. 가상 포트(E5)와 분리.
```

---

### §4.4 갱신 주기 요약

| 주기 | 대상 엔티티 | 트리거 |
|---|---|---|
| **월 1회 배치** (매월 1일 09:00 KST) | ShortList30 · StockReport · CommitteeVote | M10 스케줄러 자동 실행 |
| **EOD 배치** (매일 장 마감 후) | PortfolioSnapshot · TechnicalIndicators · EarlyWarningState | pykrx EOD 데이터 수신 후 |
| **실시간 스트림** (상시 모니터링 모드) | AlertEvent(price_anomaly) | 한투 API 이벤트 |
| **이벤트 드리븐** | AlertEvent(exit_signal · news_critical · scheduler_fail) | 분류기·시그널 엔진 트리거 |
| **어드민 액션** | PortfolioApproval · RegenCounter · AlertEvent(decision) | 어드민 UI 인터랙션 |
| **T+7일 배치** | AlertEvent(outcome) | exit_signal 발송 후 7일 경과 |
| **분기** | UniverseSnapshot (유니버스 구성) | pykrx market_cap 조회 |

---

### §4.5 데이터 저장 및 접근 제약

- **저장소**: Supabase (PostgreSQL). BuildPhase B2.2에서 env 세팅 및 스키마 마이그레이션.
- **접근 격리**: Supabase RLS(Row Level Security)로 어드민 계정만 모든 엔티티 접근 허용. 멤버 계정은 ShortList30·StockReport·CommitteeVote 접근 차단. (→ ServicePlan.md §3 공통 원칙, §6 멤버 연결점).
- **서버 컴포넌트 접근**: Next.js Server Actions를 통해 Supabase에 접근. 클라이언트 직접 접근 금지.
- **mock → 실데이터 전환**: 현재 `tudal/src/lib/data/mock-*.ts`가 모든 데이터 소스. 실데이터 연결은 BuildPhase B3.2. 전환 시 엔티티 타입(`tudal/src/types/`)과 mock 구조를 기준으로 Supabase 스키마 정합성 검증 필요.
- **E9 BrokerageConnection 시크릿 정책 (D12 P5 + DQ-7 갱신, 2026-04-22)**: ~~api_key_ref Vault 참조~~ → **app-layer AES-256-GCM** 암호화 컬럼 6개(`ciphertext·iv·auth_tag × 2`)로 구현. MEK는 Vercel env `API_CRED_MASTER_KEY` (32-byte hex). 로컬 dev와 Vercel이 같은 Supabase 공유하므로 MEK 동일 유지 필수. 본인 admin_id만 접근 RLS + `is_admin()` 이중 가드. 로테이션 스크립트: `scripts/rotate-cred-mek.ts --old <hex> --new <hex> [--dry-run]` (단일 트랜잭션 전수 re-encrypt). `last_used_at`는 S8 test-connection 성공 시 UPDATE. 상세: `Slices/DQ7-Credentials.md §3·§4`.
- **E12 ExchangeConnection 시크릿 정책 (DQ-7 신설, 2026-04-22)**: Binance USDT-M 선물용. E9와 동일 AES-256-GCM 패턴 + `testnet_mode boolean`. `UNIQUE(admin_id, exchange, label)`로 같은 어드민이 "main-futures" · "sub-account" 등 복수 등록 가능.

---

## 5. 제약

- 공통 원칙 → `ServicePlan.md §3` 참조
- **어드민 고유 제약**:
  - Short List·풀 리포트는 멤버에 노출하지 않음 (BusinessPlan §10.2)
  - **면책 완화 (2026-04-15 확정)**: 어드민 전용이므로 AI가 포트폴리오 **비중까지 결정·추천** 가능. "매수/매도 추천 금지" 원칙은 **멤버·외부 노출 한정**. 어드민 내부 도구에서는 AI가 종목별 비중·현금 비율·재조정 제안까지 제공.
  - 긴급 알림 수신자 = 어드민 3명 (§1.1 참조, 10차 결정)

---

## 6. 멤버 연결점

> **P5 D13 박제 (2026-04-15)**: 멤버는 **법적 문제 없는 리서치 웹페이지 수준으로 축소**. 어드민 3명 전용 운영 중심. 멤버 서비스 상세 재정의는 `ServicePlan-Member.md` 별도 문서에서 처리(본 문서 범위 외).

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
| 2026-04-15 | §1 사용자·JTBD·스코프 전체 확정 (§1.1~§1.7) | P0 Task 0.1 brainstorming → 사용자 승인 | `docs/superpowers/specs/2026-04-15-admin-scope-jtbd-design.md` |
| 2026-04-15 | Task 0.2 문서 동기화 4건 완료 | 직접 Write | HANDOFF.md Task 0.2 |
| 2026-04-15 | §1A 전략 골격 확정 (P2 Task 2.1~2.5) | PM 스킬 5종 병렬 실행 → 정리 세션에서 중복·과잉 판정, 고유 가치만 §1A에 흡수·SoT 단일화 | ServicePlan-Admin.md §1A |
| 2026-04-15 | Phase P3~P8 재정비 (감사 3건 종합) | 삭제 2·병합 1·번호 재배치·Output 라우팅 치환·스코프 조정 9·병렬 지도 추가 | Phase.md + HANDOFF.md + 본 트래커 동기화 |
| 2026-04-15 | P3 재축소 (9차) | 구 3.2 가정 대장·구 3.3 OST 삭제 → Pre-P3 사용자 Q&A로 대체. P3 4→2 태스크(3.1 Must + 3.2 IA). 근거: 어드민 2~3명 자금 프로젝트 특성상 DVF 매트릭스·시각화 청중 불명확 | Phase.md P3 섹션 + HANDOFF.md |
| 2026-04-15 | **P3.0 Pre-P3 Q&A 완료** (10차) — 9개 결정 + 보류 1건 | D1 Reject→재분석1회→전월유지 · D2 D+5 미승인→전월유지 · D3 승인 종가 일괄매수 · D4 현금 0~30% · D5 분석엔진 Composite+3축 · D6 Short List 30 산출(백테 6→점진 확장, 리포트 워딩 포함) · D7 상시 모니터링 MVP 포함(임계치 단순화) · D8 재생성 cap 자동1·수동2 · D9 /admin/decision-tree 별도 · 어드민 3명 가정 | §1A.5 재작성 + §1.1·§1.3·§1.4·§1.7·§2·§3 동기화 |
| 2026-04-15 | **P3.1 기능 분류 + P3.2 IA 완료** (11차, 병렬) | P3.1: Must 16 / Should 17 / Nice 6 / Deferred 10. §3.6 해소 + §3.7~§3.11 신설. D6 Short List 30 Must 고정 유지. P3.2: 메인 7 + 서브 3 = 10 라우트. `app/(admin)/` 그룹 신설. Short List 30 = 3고정섹션 세로 스택(탭 기각). 3모드 = Header 드롭다운 + Settings. 모바일은 Stage 2. | §2 본문화 + §3 확장. 원자료: `.omc/research/p3-1-feature-prioritization.md`, `.omc/research/p3-2-information-architecture.md` |
| 2026-04-15 | **P4.1 PRD 골격 완료** (12차) | §3.1~§3.11 각 Must 기능 AC 힌트 → 정식 요구사항(R번호체계) 승격. 섹션별 Should/Nice 확장 후보 서브섹션 신설. §4 데이터 모델 스켈레톤 → 8 엔티티(E1~E8) 필드·관계·갱신주기 본문화. P3→P4 이관 미해결 5건: ①멀티어드민 race → R3.3-2 UI 해소 + B3 이관, ②리포트 상세도 → R3.7-2 접기·펼치기 확정, ③스케줄러 실패 D+5 → R3.9-4 해소, ④regenerate 방식 → R3.4-5 기능 고정 + B3 이관, ⑤부분표시 UX → R3.11-8 해소 + P7 이관. | `ServicePlan-Admin.md` §3·§4 직접 편집. 원자료: `p3-1-feature-prioritization.md`, `p3-2-information-architecture.md`, `quant-data-architecture.md`, `customer-journey.md`. |
| 2026-04-15 | **P4.2 User Stories 완료** (12차) | Must 16개 기능에 User Story 1개 + AC 2~4개씩 부착 (17블록, M13은 설정/동작 분리). §3 기존 요구사항·AC 힌트 보존. | `ServicePlan-Admin.md` §3 직접 편집. `pm-execution:user-stories` 가이드. |
| 2026-04-15 | **P4.3 DoD 완료** (12차) | Must 16개 기능에 DoD 3~5개씩 부착 (17블록). 검증 항목은 수동 확인 가능 동작 + `npm run build` + `npm run lint` 통과. Gherkin 금지. | `ServicePlan-Admin.md` §3 직접 편집. `pm-execution:test-scenarios` 가이드. |
| 2026-04-15 | **P7.1 유저 플로우 완료** (12차) | mermaid 다이어그램 5개 (J1 월간선정 · J2 일간모니터링 · J3 Exit · J4 성과추적 · 3모드 전환). 라우트 매핑 표 포함. 미확정 3건(⑥⑦⑧) 마커. | `.omc/design/flows/admin-flows.md` 신규 + §2 포인터 갱신. |
| 2026-04-15 | **P7.2 와이어프레임 완료** (12차) | 글로벌 레이아웃 + 5종 ASCII 와이어프레임 (홈 · 풀리포트 · 포트폴리오승인 · 알림 · Decision Tree). committee-ux-patterns 한국 금융 UX 반영. | `.omc/design/wireframes/admin-wireframes.md` 신규. |
| 2026-04-15 | **P7.3 IA 검증 완료** (12차) | BLOCK 0 / FLAG 3 (track-record 와이어프레임 누락 · 핑퐁 네비 · 갱신시각 누락) / Suggestion 3. 미확정 3건 권장안: ⑥ 버킷 내 디폴트+경계표시, ⑦ N/12 부분게이지+점선투영, ⑧ alerts/[id]+report §0 최소 readable CSS. 페르소나 3인 여정 워크스루 PASS. 한국 금융 UX 7패턴+7안티패턴 전수 준수. | `.omc/design/ia-verification.md` 신규 + §2 검증결과 반영. |
| 2026-04-15 | **P4.4 통합 편집 → v0.9** (12차) | 상태 v0.9 갱신 · 트래커 P4+P7 전체 체크 · P7.3 FLAG 3건+미확정 권장안 §2 반영 · §7 확인 로그 6행 추가. | `ServicePlan-Admin.md` 직접 편집. |
| 2026-04-15 | **P5 검증 → v1.0 수렴** (13차) | P5 검증 3병렬(critic REJECT → 해소 / ux-researcher / pre-mortem) + 사용자 결정 D10~D13. Critical 3건(I-01 Exit 백업채널 Must 원복 / I-02 D+5×공휴일×스케줄러 / I-03 AI 비용 하드캡) 해소 · Major 8건 해소(I-04 미달·I-06 역할·I-07 schema_version·I-08 UNIQUE·I-09 entry_price·I-10 폴링대체·I-12 NSM·I-13 판정기준) · 신규 §1A.0 3경로 실행 모델 · E9 BrokerageConnection 박제. | `ServicePlan-Admin.md` 직접 편집 (executor). 원자료: `.omc/research/serviceplan-admin-critique.md`, `.omc/research/serviceplan-admin-ux-audit.md`, `.omc/research/premortem.md`. |
| 2026-04-15 | **Q-OP1·Q-OP2 해소 → v1.1** (13차 후속) | **D14 Must 승격 3건**(M17 AI 비용 모니터링 · M18 파이프라인 헬스체크 · M19 Silent Health 하트비트). Must 16 → **19**. §3.12 시스템 관측·가드레일 섹션 신설. §1A.4 Anti-Metrics 방어 기능 열 추가. **D15 Holding Period + 2인 게이팅 + 이의 48h** 도입(R3.3-7~R3.3-10). §4.2 E4에 shortlist_generated_at·dispute_raised_at·dispute_resolved_at·report_view_count 필드 추가. Q-OP3(멤버 유료 재검토)·Q-OP4(Y1 법적 등록 재검토)는 개발 완료 전까지 재질문 금지로 고정. | `ServicePlan-Admin.md` 직접 편집 (executor). 사용자 결정 D14·D15. |
| 2026-04-21 | **어드민 = 본인+친구 3명 내부 투자 도구 재정의 + 자동매매 S8 승격 → v1.2** | D16 박제. §0 정체성 재정의 · §1.5 AI 경계에 S8 자동매매 어댑터 행 추가 · §1.6 Non-Goals 재작성(Stage 2/3 문구 삭제 + 지인 Beta 분리 + AI 본체 drop-in Non-Goal) · §1A.0 경로 (3) 자동매매를 S8 구현으로 확정 + 아스키 다이어그램에 E12·Strategy·AI 어댑터 반영 · §2 라우트 블록에 `/admin/settings/{brokerage,binance,risk,strategy}` + `/admin/trading/{stock,crypto}` 6종 추가 · §3.1·§3.4·§1.3 J4 "Stage 1 한정" 문구 제거 · **§3.13 자동매매 프레임 신설** · §1A.5 D16 추가. | `ServicePlan-Admin.md` 직접 편집. 사용자 결정 D16 + Q1~Q3 답(D-T1 b·c 코인 포함 / D-T2 c 이중 경로 / D-T3 선택 가능+바이낸스 선물). |

> 섹션별 확정 시마다 행 추가. 확정 주체(사용자·critic 통과)와 근거 명시.

---

## 8. Revision History

| 버전 | 날짜 | 주요 변경 |
|---|---|---|
| v0.1 | 2026-04-15 | 문서 스켈레톤 신설 (기획 분리) |
| v0.2~0.8 | 2026-04-15 | §1 JTBD · §1A 전략골격 · P3.0 Q&A D1~D9 · P3.1/P3.2 Must·IA 박제 |
| v0.9 | 2026-04-15 | P4 기획서 작성 + P7 UX Design 완료. Must 16 정식 요구사항·User Story·AC·DoD + 데이터 모델 8 엔티티 본문화 |
| **v1.0** | **2026-04-15** | **P5 검증 완료 → 수렴.** Critical 3건(I-01/I-02/I-03) 해소 · **Major 10건 전원 해소(I-04~I-13)** · 신규 개념 (3경로 실행 모델 §1A.0, E9 멀티 API) 박제. **D10~D13 결정 추가** (Exit 백업채널 Must 원복 · 3경로 실행 모델 · E9 증권사 API 다중 연결 · 멤버 스코프 축소). Must 승격 검토 대기 3건(D-OOS-6·7·Silent Health)과 Q-OP 유보 2건(Holding Period·2인 게이팅)은 §1A.5에 박제하여 사용자 추가 결정 대기. 상위 문서 정합(BusinessPlan §Q4·§Q10·§Q11·§10.5·§10.8·§12 + ServicePlan.md + ServicePlan-Member.md + AutoTrading.md) 동시 갱신. |
| **v1.1** | **2026-04-15** | **Q-OP1·Q-OP2 반영.** D14 Must 16→19 (M17 AI 비용 · M18 헬스체크 · M19 Silent Health) · D15 R3.3-7~10 (Holding 24h + 2인 게이팅 + 이의 48h). §3.12 시스템 관측·가드레일 섹션 신설. §4.2 E4 Holding 필드 추가. Q-OP3·Q-OP4는 개발 완료 전까지 재질문 금지. |
| **v1.2** | **2026-04-21** | **어드민 내부 도구 재정의 + 자동매매 S8 승격.** D16 박제: (a) 본인+친구 3명 투자 내부 도구로 범위 축소, 멤버·Stage 어휘 분리 · (b) 구 트레이딩 3-Stage(매뉴얼→API→AI 자율) 폐기, 자동매매 = S8 단일 슬라이스 통합(주식 KIS + 바이낸스 선물 포함) · (c) Strategy drop-in + AI 어댑터 embed 이중 경로 · (d) 리스크 가드레일 기본값 박제(레버리지 ≤5x · 일일 -3% 정지 · AI 일 20회). §0·§1.5·§1.6·§1A.0·§2·§3.1·§3.4·§3.13 편집, §1A.5 D16 추가. `Slices/S8-AutoTrading.md` 신설 연동. |
| **v1.3** | **2026-04-22** | **Admin Credential System 재설계 + DQ-7이 S7a 선행 트랙으로 승격.** D17 박제: (a) KIS·Binance 키 per-admin UI + AES-256-GCM 암호화 (env pre-wire 폐기) · (b) DB 분리 2테이블 (E9 확장 + E12 신설) · (c) Vercel 첫 배포 DQ-7에서 수행 · (d) 실계좌/메인넷 저장 권한 = 대표 1인 (`ADMIN_REP_EMAIL` env) · (e) 마이그레이션 번호 재배정(0009=DQ-7 · 0010=BL-KRIT-7) · (f) S8-AutoTrading T8.4·T8.5 UI DQ-7 선행 이관. §4.2 E9 필드 갱신(`api_key_ref` 폐기 · 암호화 컬럼 6개 + `mock_mode`) · §4.5 시크릿 정책 재작성 · E12 정책 신설 · §1A.5 D17 추가. `Slices/DQ7-Credentials.md` 신설 (858 줄, 17 섹션, 20 Tasks, Task-level agent·skill 매핑). |
| **v1.4** | **2026-05-08** | **S8 자동매매 진입 시점 재조정 + KIS 발급 비블로커화.** D18 박제: (a) S8 자동매매를 S7 series 다음으로 분리. v3 시퀀스 = `S7a → S7e → S7b → ★ D11 AI 가상 포트 1차 가동 (KIS 0개) → 운용 검증 → S7c (KIS 본인 1개) → S7d → S8` · (b) KIS 용도 = 자동매매 전용 (일간 데이터·AI 가상 포트는 KRX/pykrx/DART/네이버로 충분) · (c) son00326·Kevin KIS 발급 지연 = S7c까지 비블로커. S8 시점에 (i) 3명 동시 또는 (ii) 본인 단독 결정 · (d) D11 운용 검증 며칠~1주를 S8 선행 게이트로 명시 · (e) S7c·S7d 강등 큐 폐기, 정규 시퀀스 복귀. 자동매매 실체결 도달 = v2 9세션 → v3 약 12~14세션. §1A.5 D18 추가. 동기화: `Slices/S8-AutoTrading.md` 선행 조건·Phase 헤더 + `ProgressDashboard.md §2` v3 다이어그램 + `HANDOFF.md §2.D` (후속 슬라이스 시퀀스) + `CLAUDE.md` 상단 시퀀스. |
| **v1.5** | **2026-05-08** | **JooPick AI 강화 — Tier 0/1/2 병렬 + 합의 배지 + Reflection (35차).** D19 박제: (a) Short List 30 선정 = "숫자(인디케이터) + AI(Core 11 페르소나) 병렬 + 합의 에이전트" 구조. TauricResearch/TradingAgents Analyst Team + Reflection 패턴 차용 + JooPick Core 11 + Sector Board (canonical 14 sectors × 14 personas overlay) 박제 보존 — slot 모델은 **D21 (52차)** supersede · (b) Tier 0 인디케이터 자동 스크리닝(2,500→150, AI 키 불필요) + Tier 1 Core 11 평가(150→30, 시간대별 가중치) + Tier 2 Sector Board 활성화(30종목 해당 섹터 14인만) · (c) 합의 배지 4종(🟢 강한 합의/🔵 숫자 우세/🟣 AI 우세/⚪ AI 분석 대기) + 어드민 카드에 🔢🤖 이중 점수 + AI 코멘트 1~2줄 + 클릭→풀 리포트 · (d) Reflection = 매월 말 실현 수익률 → 다음달 prompt 주입 · (e) AI 키 미발급 fallback = Tier 0 단독으로 실 코스피·코스닥 30종목 + 실 가격·재무·뉴스. AI 키 발급 시 plug-in · (f) Smoke #3 (Binance) ⏸ S8까지 유예 · (g) D6 본문 보강(직렬→병렬+합의). §1A.5 D19 추가 · §3.1 R3.1-6 신설 · §2 라우트 컬럼 명세 갱신. 동기화: `Service/Report/ReportFramework.md §8` Step 0 + Step 4 후속 + `Slices/S7-RealData.md` Tier 0 분기 + `Slices/DQ7-Credentials.md` Smoke #3 ⏸ + `ProgressDashboard.md §2` v3.1 + `HANDOFF.md §1·§2·§4·§7` + `CLAUDE.md` 상단 시퀀스 v3.1 + D19 라인. |
| **v1.6** | **2026-05-19** | **S7a 49차 — 5종 합의 배지 박제 (🟡 관망 신규)**. Q5b omxy CONVERGED 결과 박제: 비-top tier + 비-top tier + AI 가용 케이스를 ⚪(AI 분석 대기)와 구별해 🟡 **관망**으로 분류. §1A.5 D19 entry + §3.1 R3.1-6 + Short List 30 컬럼 명세 갱신. 동기화: `tudal/src/lib/screening/consensus.ts` (5종 type union + assignBadge 5분기) · `Service/Report/ReportFramework.md §8` Step 0 5종 표 · 마이그 0017 `stock_reports.consensus_badge` 컬럼 박제 · S7a plan Q5b CONVERGED. |
| **v1.7** | **2026-05-20** | **52차 — D21 Tier 2 Sector Board slot 모델 정정 (Option C overlay) + SoT PR 박제.** 51차 brainstorm R3~R7 누적 56 rounds + 52차 본 PR omxy R1~R4 4 rounds + final R1 5 findings catch + R2 hotfix → 누적 60+ rounds CONVERGED 결과 박제: **slot 모델 = canonical 14 sectors × 14 personas/sector overlay** (10 base + 2 primary overlay + 2 sub_tag overlay). 구 "Sector Board 14 sectors / 10 slots per sector" 표현은 §4.2.1 partA contract (`length ∈ {0,14}`)와 사전 충돌 — D21 정정. **sub_tags jsonb crosswalk 7개** (조선/방산→운송/물류 또는 철강/소재 · 화학→철강/소재 · 게임→IT/SW+엔터/미디어 secondary · 가전→유통/소비재 · 제약→바이오 · 부동산→건설). **운영 UI taxonomy proxy** (개념 정합 아님). 신규: `tudal/src/lib/screening/canonical-sectors.ts` (production import 0 — tests/만) + `tudal/supabase/migrations/0018_short_list_30_sub_tags.sql` (jsonb + GIN). **8 files** 변경: §1A.5 D21 신설 · §1A.2 UA1 · §3.2 R3.2-4 · §3.7 R3.7-6 · §4.2 E1 sub_tags 컬럼 · §4.2.1 partA 주석 갱신 + `Service/Planning/ServicePlan.md` §3 표 D21 정정 (final R1 catch hotfix) · `Service/Report/ReportFramework.md` §5 "위원 10명"·"섹터 보드 10명" 정정 + §7.2/§7.3 재작성 + §8/§10 v2.5 (final R1 catch + 본 v1.7) · `Document/Process/HANDOFF.md` §6 51차 next-action + §2.1 Step 3 literal 정정. canonical-sectors.ts rationale ↔ ReportFramework §7.3 crosswalk = **semantic match** (byte-identical 아님 — final R1 4번 catch 박제). **`commit_sector_personas` RPC + Section 8 partA render + mock fixture migration = Tier 2 implementation 후속 PR OOS**. |
| **v1.8** | **2026-05-20** | **52차 — D21 Tier 2 implementation PR #5 (stacked from PR #4) + D22 Kevin v3.1 quality target 박제.** PR #5 omxy R1~R3 4 rounds + final R1 3 BLOCKERS + R2 hotfix → 누적 6 rounds CONVERGED + subagent gsd 9 BLOCKERS. **신규**: 마이그 0019 `commit_sector_personas` RPC (SECURITY DEFINER triad + SELECT FOR UPDATE race-free + section_8 `coalesce \|\| jsonb_build_object` Core 필드 보존 + p_sector_aggregate exact keys + integer/non-negative validation + DELETE persona_layer='sector' first → INSERT 14 idempotency) + canonical-sectors.ts 추가 (`SECTOR_PERSONA_COUNT=14` + `TIER2_CALLS_PER_TICKER=25` + `resolveSlotTemplate`) + writer.ts `commitSectorReport()` + `parseSectorContentStrict()` (malformed AI content RPC 차단) + persona-eval.ts `runSectorEval()` scaffold + mock-admin-committee-personas.ts `CANONICAL_SECTOR_PERSONAS` 196 stub + `getCanonicalSectorPersonas()` (legacy 5인 lean 105 격리 보존). **+46 tests** (legacy.5lean + canonical-sector-personas + canonical-sectors 추가 22 + persona-eval 추가 8 + writer 추가 10 strict parser 3 포함). production import 정확 3 파일 (persona-eval / writer / mock-fixture, tests 제외). cron/admin route 변경 0 (caller wiring Step 3c OOS). **D22 신설 (본 row 하단 참조)**: Tier 2 production sector persona prompts 196 작성 시 quality target = `origin/IMVCOM @ 1faee1b` Kevin v3.1 초보 친화 알테오젠 리포트 reference. **HANDOFF 박제 동기화** (PR #5 docs-only terminal commit): HANDOFF §1·§2.1 Step 3 DONE + Step 3a/3b/3c 신설 + §3 사용자 액션 큐 + §5 Kevin reference + §6 본 entry + §7.7 누적 69 rounds + §8.3 + §9. `Build/ProgressDashboard.md` + `Process/CodebaseStatus.md` + `CLAUDE.md` 상단 시퀀스 v3.2 동기화. **Step 3a 정합 머지 → Step 3b production prompts → Step 3c caller wiring → Step 4 Reflection** 순서 박제. |
| **v1.9** | **2026-05-21** | **53차 §5 — shortlist 30종목 + 풀 리포트 흐름 정정 박제.** OMXY 적대적 검토 R1~R5 5 rounds 누적 21 BLOCKERS catch & fix → CONVERGED. **D23 신설** (D19/D21/D22 ancestry supersession entry): (a) **사용자 lock-in 8 항목 박제** = ① 30종목 선정 흐름 (Tier 0 → Tier 1 AI 합의 → 30, AI가 단/중/장 분류 결정에 직접 영향) ② 풀 리포트 흐름 (writer Section 0~7 통합 + Tier 2 Section 8 partA/partD = 단일 산출물) ③ AI 호출 트리거 3 path (cron/reject trigger 버튼/Regen 버튼) ④ UI 흐름 (admin 홈 또는 portfolio → ShortlistRow accordion 클릭 → "풀 리포트" 버튼 → /admin/report/[ticker]) ⑤ Track Record 의미 재정의 (누적 성과 + 월별 아카이브 한 페이지 탭 분리) ⑥ Kevin v3.1 quality target 박제 (D22 보존) ⑦ Sector reference 3-level 분류 (Level A 본문 2/12 · Level B 체크리스트 4/10 · Level C philosophies 14/0) ⑧ API 금액 무관 — Tier 1 호출 범위(60/90/150) 후속 PR2 결정. (b) **박제 vs 코드 mismatch Group A-H (8 그룹) catch**: Group A track-record가 trigger 위치 박제 · Group B 30종목 선정 AI 부재 (Tier 0 단독 30이 fallback에서 메인 path로 굳어진 상태) · Group C cron monthly-batch mock dry-run only · Group D Step 3c "DONE" → PARTIAL — dangling server action `triggerMonthlyPersonaEvalAction` · Group E writer Section 0~7 본문 미구현 박제 누락 (`section_8` jsonb commit만 가능) · Group F Track Record 의미 박제 (누적 성과 vs 과거 아카이브 분리 누락) · Group G Sector reference 3-level 분류 미박제 · **Group H Critical** stock_reports schema drift + report page crash 위험 (admin-reports.ts validation 0 + page.tsx section0.conviction early deref + Section 0~7 nested deref + Section 8 신규 partA/B/C/D vs old conclusion/recommendation/keyQuotes shape mismatch). (c) **canonical 후속 implementation 순서** = **PR2 (Tier 1 AI 30 선정 screening) → PR3a (Group H schema drift fix Hard gate) → PR1 (cron monthly-batch real path, server-side only) → PR3b (writer Section 0~7 본문 구현) → PR4 (UI trigger 버튼 + Track Record 탭 + Regen 실 호출 wire)**. **Hard gate (PR1 ⊥ PR3a 미선행 = page crash inevitable)** — 사용자 종목 클릭 시 section0.conviction early deref crash. (d) **OMXY 적대적 검토 R1~R5 누적 21 BLOCKERS catch & fix** (R1 6 · R2 4 · R3 6 · R4·R5 5 = 21 total). (e) **spec doc path** = `docs/superpowers/specs/2026-05-21-shortlist-report-flow-correction.md` (전문 SoT). **변경 파일 (matrix)**: §1A.5 D23 신설 + D19 inline 정정 (메인 path/fallback 분리 + Tier 1 호출 범위 open question) · §3 페이지 IA (10 라우트 inline 정정: track-record 탭 분리 + report/[ticker] 풀 리포트 + portfolio 30 + UI 흐름 박제) · §4 E1 short_list_30 현재 상태 vs 정정 후 박제 · §8 v1.9 changelog (본 행) · 동기화 = HANDOFF.md §0·§1·§2.1·§3·§6 + ReportFramework.md §8 Step 0·1~4·§9.2 + ProgressDashboard.md (Step 3c PARTIAL + 잔여 5 task canonical) + CodebaseStatus.md (writer.ts·dangling exports·Group H schema drift·Regen 미구현) + CLAUDE.md 상단 시퀀스 v3.3 + S7-RealData.md T7e.8 fallback 명시. |
