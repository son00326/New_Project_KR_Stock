# BuildBoard — 주픽 Build 작업 보드

Last updated: 2026-04-15 (초기 작성)
Parent: → `HANDOFF.md` (세션 진입) / `ServicePlan-Admin.md` v1.1 (기획 SoT)
Status: **Week 1 스프린트 착수 대기** (2026-04-16 ~ 2026-04-23)

---

## 0. 이 문서의 정체성

- **Build 단계의 실시간 칸반 보드**. 매 세션 갱신.
- `HANDOFF.md`는 세션 진입 + Planning 큐 슬림 유지, **BuildBoard**는 Build 세부 진행 SoT.
- 2트랙 병렬 개발 모델: Track A (Design Foundation 축소) ∥ Track B (Backend Foundation) → Track C (Frontend Integration) → B4 QA → B5 Ship → B6 Iteration.
- Build 진입 후 세션은 **이 문서부터 먼저 읽는다** (CLAUDE.md Entry routine 참조).

---

## 1. 현재 스프린트 — Week 1

| 항목 | 내용 |
|---|---|
| 기간 | 2026-04-16 ~ 2026-04-23 (7일) |
| 목표 | Track A 4건 + Track B 6건 완료 → Track C 진입 가능 상태 |
| Track A 진행률 | 0/4 |
| Track B 진행률 | 0/6 |
| Track C 진행률 | Blocked (A·B 완료 대기) |

---

## 2. 작업 보드

### Track A · Design Foundation (축소)

| ID | 작업 | 의존 | 상태 | 담당 | 비고 |
|----|------|------|------|------|------|
| A1 | 디자인 하네스 설정 | - | Todo | Claude | `Document/Service/Build/Prototypes/` 구조 확정 (2026-06-11: 구 `.omc/design/` 경로 대체) · `superpowers-subagent-driven-development` (2026-06-11: 구 `/oh-my-claudecode:harness` 대체) |
| A2 | 토큰 + Voice/Tone 확정 → `UI-Tokens.md` 값 채움 | A1 | Todo | Claude+User | 한국 증시 컨벤션(상승=빨강·하락=파랑) · 다크모드 여부 결정 |
| A3 | 홈 대시보드 정적 HTML 프로토타입 | A2 | Todo | Claude | `Document/Service/Build/Prototypes/home-dashboard.html` (2026-06-11: 구 `.omc/design/prototypes/` 경로 대체) · 토큰 검증용 |
| A4 | 풀 리포트 Section 0~8 정적 HTML 프로토타입 | A2 | Todo | Claude | `Document/Service/Build/Prototypes/report-section.html` (2026-06-11: 구 `.omc/design/prototypes/` 경로 대체) · 정보밀도 검증 |

### Track B · Backend Foundation

| ID | 작업 | 의존 | 상태 | 담당 | 비고 |
|----|------|------|------|------|------|
| B1 | Supabase 프로젝트 생성 | - | **Blocked** | User | 계정 생성 + 프로젝트 URL·KEY 공유 필요 |
| B2 | E1~E9 DDL 마이그레이션 | B1 | Todo | Claude | `Backend-Design.md §1` 기반 · `supabase/migrations/` |
| B3 | Auth + RLS 정책 (어드민 role) | B2 | Todo | Claude | `Backend-Design.md §2` |
| B4 | 환경변수·Vault 시크릿 세팅 | B1 | Todo | User+Claude | `.env.local` · Supabase Vault |
| B5 | DART 크롤러 v1 (공시) | B2, B4 | Todo | Claude | Anti-Metric 방어 핵심 · 이중화 프로토콜 (D10) |
| B6 | 기본 API route 골격 | B2, B4 | Todo | Claude | `app/api/cron/*` + `app/api/portfolio/*` 우선순위 1 |

### Track C · Frontend Integration (Track A·B 완료 후)

| ID | 작업 | 의존 | 상태 | 담당 | 비고 |
|----|------|------|------|------|------|
| C1 | Next.js 스캐폴딩 + shadcn 설치 + 토큰 주입 | A2, B1 | Blocked | Claude | `tudal/` 재활용 여부는 Q13 사용자 결정 대기 |
| C2 | `/admin/*` 라우트 10개 생성 | C1 | Blocked | Claude | `ServicePlan-Admin.md §2` IA |
| C3 | 홈 대시보드 React 구현 | C1, A3, B2 | Blocked | Claude | 첫 레퍼런스 화면 |
| C4 | 풀 리포트 Section 0~8 React 구현 | C3, A4, B5 | Blocked | Claude | 정적 HTML → 컴포넌트 |
| C5 | 승인 워크플로우 (Holding·게이팅·이의) | C3, B3 | Blocked | Claude | R3.3-7~10 · M7 |
| C6 | 가상 포트폴리오 트래킹 (E5) | C3, B2 | Blocked | Claude | 레이어 A 본체 |
| C7 | Decision Tree 대시보드 (M16) | C3 | Blocked | Claude | Recharts · ○/△/✕ 판정 |
| C8 | M17 AI 비용 모니터링 대시보드 | C3, B6 | Blocked | Claude | v1.1 신규 |
| C9 | M18 파이프라인 헬스체크 대시보드 | C3, B6 | Blocked | Claude | v1.1 신규 |
| C10 | M19 Silent Health 하트비트 UI + 발송 로직 | C3, B6 | Blocked | Claude | v1.1 신규 |
| C11 | 알림·Exit 시그널 (M11·M12·M13·M15) | C3, B5 | Blocked | Claude | 3채널 ACK (D10) |
| C12 | Short List 월간 배치 UI (M1·M10) | C3, B6 | Blocked | Claude | Cron 연결 |

### B4 QA · B5 Ship · B6 Iteration

Track C 주요 기능 완료 후 진입. 세부 태스크는 `Document/Process/ExecutionPlaybook.md` 참조.

---

## 3. 블로커·이슈 (Open)

| # | 내용 | 영향 | 해소 계획 |
|---|------|------|-----------|
| BL-01 | Supabase 계정 생성 (사용자 행동 필요) | B1·B2·B3·B4 착수 불가 → Track B 전체 정지 | 사용자가 https://supabase.com 가입 · 프로젝트 생성 후 URL/anon key/service role key 공유 |
| BL-02 | Q13 기존 `tudal/` 코드베이스 재활용 방식 미확정 | C1 스캐폴딩 전략 결정 필요 | Claude 권장: (B) 선별 재활용. 사용자 최종 확정 필요 |
| BL-03 | 증권사 API 계정·앱키 (한투/키움) | B5 이후·E9 구현 시 필요 | 사용자가 한투 OpenAPI·DART OpenAPI 키 발급 |
| BL-04 | 텔레그램 Bot Token · 이메일 서비스 (Resend 등) | C11 알림 발송 구현 시 필요 | 사용자 계정 생성 후 공유 |

---

## 4. 최근 세션 (최근 3개)

- **2026-04-15** BuildBoard 초기 작성. 2트랙 병렬 모델 확정. Week 1 스프린트 정의.

---

## 5. 커밋 대기

- 2026-04-15 **Build 문서 3종 신규 + BuildPhase 재구성 + Phase P8 축소 + HANDOFF 슬림화 + CLAUDE Entry 갱신 + Planning 아카이빙** (14차 세션) — 사용자 검토 후 커밋.

---

## 6. 의존 다이어그램

```
[Track A — Design Foundation]   [Track B — Backend Foundation]
 A1 → A2 → A3 ∥ A4                B1 → B2 → B3 → B5
                                   ↓     ↓
                                   B4    B6
           ↓                         ↓
           └─────────┬───────────────┘
                     ▼
         [Track C — Frontend Integration]
          C1 → C2 → C3 (홈) → C4 (풀리포트)
                          ↓
                  C5~C12 (순차·병렬 혼용)
                     ▼
               [B4 QA & Hardening]
                     ▼
                  [B5 Ship]
                     ▼
             [B6 Iteration Loop]
```

---

## 7. 다음 세션 첫 행동

```
1. BuildBoard §3 블로커 확인 → BL-01 Supabase 계정 상태 확인
2. 블로커 해소 상황에 따라 분기:
   - BL-01 해소됨: Track A1 + Track B1 병렬 착수 즉시 가능
   - BL-01 미해소: Track A1~A4 단독 진행 (Track B 대기)
3. Track A2 토큰 확정 전 사용자 디자인 톤 선호 확인:
   - 다크모드 Must 여부
   - 톤 스펙트럼 (Bloomberg Terminal 프로 vs Toss 친근 프리미엄)
   - 브랜드 컬러 출발점 (로고 빨강 기조 유지 확정?)
```

---

## 8. Revision History

| 버전 | 날짜 | 변경 |
|---|---|---|
| v0.1 | 2026-04-15 | 초기 작성. 2트랙 병렬 모델 · Week 1 스프린트 · Track A 4건 · Track B 6건 · Track C 12건 정의. |
