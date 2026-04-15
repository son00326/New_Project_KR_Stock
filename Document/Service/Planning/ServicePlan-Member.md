# ServicePlan-Member.md — 멤버 페이지 기획

Last updated: 2026-04-15
Status: **스켈레톤 (2순위, Research 보강 블로커 해소 후 착수)**
Parent: → `ServicePlan.md` (인덱스·공통 원칙)

---

## 0. 이 문서의 정체성

**멤버 페이지**의 서비스 기획을 단독으로 확정하는 문서. 어드민 메인 서비스와 독립 확정.

- **담는 것**: 멤버(500cap 초대)가 만나는 화면·기능·데이터·제약.
- **담지 않는 것**: 어드민 메인 서비스(`ServicePlan-Admin.md`), 공통 원칙(`ServicePlan.md §3`), 사업 제약(`BusinessPlan.md §7`).
- **착수 블로커**: `Document/Research/` 폴더가 BigFinance Stage 0 하나뿐이라 "Research 사례와 동일" 기준선의 참조 대상이 부족. 경쟁사 리서치 2~3개 선행 필요.
- **확정 원칙**: brainstorming → product-manager → critic 사이클. 확정된 것만 본문에 박제.

---

## 진행 트래커

### Planning (Phase.md 방법론 기준)
- [ ] P0 — 스코프·JTBD 확정
- [ ] P1 — 리서치 병렬 (경쟁 스캔 / 페르소나 / 여정 / JTBD / 기능 후보)
- [ ] P2 — 전략 골격 (비전 / VP / 가격 / NSM)
- [ ] P3 — 구조화 (Must·Should·Nice 분류 / 가정 / OST / IA)
- [ ] P4 — 기획서 작성 → ServicePlan-Member.md v0.9
- [ ] P5 — 검증 (적대적 / UX / Pre-mortem) → v1.0
- [ ] P6 — 사양화 (FRD-Member / Scenarios-Member)

### Build (BuildPhase.md 방법론 기준)
- [ ] B1 — 디자인 (하네스 / 토큰 / 와이어프레임 / 목업 / 리뷰)
- [ ] B2 — 인프라 (Supabase / 초대 코드 / DB / 하네스)
- [ ] B3 — 구현 (ScreenSpec / 기능 / Smoke)
- [ ] B4 — QA (QA 루프 / 보안 / 성능 / 접근성 / 리뷰 / 버그 수정)
- [ ] B5 — 배포 (릴리스 / 머지 / 카나리 / 문서)

### 블로커
- [ ] `Document/Research/` 경쟁사 리서치 2~3개 선행 필요 (현재 BigFinance Stage 0 하나뿐)

---

## 1. 사용자·목적

> **[스켈레톤 — Research 보강 후 brainstorming으로 확정]**

- **사용자**: 멤버 = 초대 코드를 받은 일반 사용자. 500명 cap.
- **목적** (확정 대기): 메인 페이지에서 무엇을 얻는가? Research 사례(BigFinance 등)의 어떤 패턴을 차용?
- **JTBD** (확정 대기): _다음 세션 이후_
- **Non-Goals**: Short List 30·풀 리포트 열람 불가 (어드민 전용, BusinessPlan §10.2). 공개 가입·SNS 공유 없음.

---

## 2. 화면 IA · 라우트

> **[스켈레톤]**

- **라우트 그룹**: `/(auth)/*` (로그인·초대 코드 인증) + `/(main)/*` (멤버 메인)
- **기본 플로우**: 랜딩 → 로그인(초대 코드) → 메인페이지
- **메인 페이지 구성** (확정 대기, Research 사례 참조):
  - Research/BigFinance Stage 1~7 완료 후 패턴 도출
  - 경쟁사 리서치 2~3개 추가 후 공통 요소 추출
- **화면 플로우 다이어그램**: _Research 보강 후_

---

## 3. 기능 스펙

> **[스켈레톤 — Research 보강 후 Must/Should/Nice 분류]**

후보 (Research 사례 결과에 따라 결정):
- (a) 랜딩 페이지 (브랜드 소개·면책·초대 안내)
- (b) 로그인·초대 코드 인증
- (c) 메인 콘텐츠 (Research 형식 — 구체는 리서치 결과 대기)
- (d) 프로필·설정
- (e) 월 19,900원 결제 플로우 (BusinessPlan §Q11)

---

## 4. 데이터 모델·연동

> **[스켈레톤]**

- **저장**: Supabase (공통, BuildPhase B2.2)
- **핵심 엔티티** (확정 대기): Member / InviteCode / Subscription / MemberSession
- **어드민 데이터 격리**: 멤버는 Short List·리포트·포트폴리오 테이블에 RLS로 접근 차단

---

## 5. 제약

- 공통 원칙 → `ServicePlan.md §3` 참조
- **멤버 고유 제약**:
  - 500명 cap 엄수 (BusinessPlan §7 항목 1)
  - 공개 가입·마케팅 퍼널 금지 (초대 전용)
  - 어드민 데이터(Short List·풀 리포트·포트폴리오·알림) 접근 불가
  - 매수/매도 추천 금지 원칙 유지

---

## 6. 어드민 연결점

> 멤버 서비스와 어드민 서비스가 만나는 지점. 기획·빌드 중 발견될 때마다 양쪽 sub-doc에 동시 기록.

| 연결 지점 | 멤버 측 | 어드민 측 | 공통 SoT |
|---|---|---|---|
| 인증·세션 | `/(auth)/*` 초대 코드 | `/admin/*` role guard | Supabase 미들웨어 (ServicePlan.md §3) |
| 디자인 시스템 | shadcn base-nova + 주픽 토큰 | 동일 | ServicePlan.md §3 |
| 데이터 격리 | RLS로 어드민 데이터 차단 | Short List·리포트 접근 가능 | Supabase RLS 정책 |
| 면책 Footer | 전 페이지 고정 | 전 페이지 고정 | BusinessPlan §7 |

> 기획 진행하며 행 추가. 빈 칸은 미확정.

---

## 7. Confirmation 로그

| 날짜 | 확정 항목 | 방법 | 링크 |
|---|---|---|---|
| 2026-04-15 | 문서 스켈레톤 신설 | 사용자 지시 (기획 분리) | HANDOFF 2026-04-15 |

> 섹션별 확정 시마다 행 추가.
