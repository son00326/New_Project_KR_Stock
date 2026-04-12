# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-12
**목적**: 다음 에이전트가 **이 파일만 읽고 작업을 이어받을 수 있도록** 시도/성공/실패/다음 단계를 누락 없이 기록한다.

---

## 🚨 상시 준수 지침 (갱신 시 보존)

1. **세션 시작 읽기 순서**: ① `BusinessPlan.md` → ② `ServicePlan.md` → ③ `Phase.md` → ④ `BuildPhase.md` → ⑤ 본 문서. 그 다음 **ServicePlan.md §0 통합 트래커**의 첫 미완료 체크박스를 잡는다.
2. **에이전트·스킬 선정은 반드시 Phase.md / BuildPhase.md 참조**. 임의 선정 금지. Uncertainty "중간" 이상은 실행 직전 사용자 재확인.
3. **도구 우선순위**: 스킬·에이전트가 적합하면 그것 우선 (OMC / superpowers / PM / Korean Planning / frontend-design / gstack / commit-commands). 기본 Read/Edit/Write/Bash는 대체재가 없을 때만.
4. **결정 기록 라우팅**:
   - 사업 레벨 (재무·법·피벗) → `BusinessPlan.md` §"핵심 의사결정 기록"
   - 서비스 레벨 (Vision·가격·기능·IA·NSM·Design System) → `ServicePlan.md` §1 확정 사항 + §3 본문
   - Task 진행 상태 (Phase + Build 모두) → `ServicePlan.md` §0 통합 트래커 체크박스
   - 인프라·deepinit·하네스·안정성 → `ServicePlan.md` §2
   - 방법론 리파인 → `Phase.md` 또는 `BuildPhase.md` 해당 Task의 Execution Notes
   - 세션 내러티브 (시도/성공/실패/다음) → 본 문서
5. **본 문서는 세션 종료 시 반드시 갱신**. 상시 준수 지침(이 섹션)은 절대 삭제하지 말 것.
6. **병렬 실행 원칙**: Phase.md / BuildPhase.md 각각 §"병렬 디스패치 원칙" 준수. 독립 작업은 한 메시지 multi-tool call.
7. **문서 역할 불변**: Phase.md와 BuildPhase.md는 **방법론** 순수. 실행 결과는 ServicePlan.md로 라우팅, 방법론 리파인만 Execution Notes에.
8. **검증 명령**: 모든 코드 변경 후 `cd tudal && npm run build && npm run lint`. 테스트 러너 없음 — 이 두 명령이 유일한 게이트.

자세한 세션 진입 규칙·아키텍처는 `CLAUDE.md` 참조.

---

## 🗂 문서 시스템 (5개 문서, 역할 분리)

| # | 파일 | 역할 | 업데이트 빈도 |
|---|---|---|---|
| 1 | `BusinessPlan.md` | 사업 기획 확정본 (Q1~Q11, 3-Layer, 재무, 법) | 거의 고정 |
| 2 | `ServicePlan.md` | 서비스 기획 확정본 + **통합 진행 트래커** (Planning + Build) + Infrastructure. **편집 1순위** | 자주 |
| 3 | `Phase.md` | **Planning 방법론** (Phase 0~6: 기획·리서치·전략·구조화·작성·검증·사양화) | 드물게 |
| 4 | `BuildPhase.md` | **Build 방법론** (Stage B1~B6: 디자인·인프라·구현·QA·배포·반복) | 드물게 |
| 5 | `HANDOFF.md` | 본 문서 — 세션 연속성 로그 (시도/성공/실패/다음) | 매 세션 |

보조:
- `CLAUDE.md` — 프로젝트 전용 Claude Code 진입 가이드
- `tudal/` — Next.js 16 앱 (폴더명 리브랜드 전 잔재, `package.json` name=`joopick`, **폴더명 변경 금지**)

---

## 📍 현재 단계

```
Layer:       Planning (Phase.md) — Phase 0 진입 대기
Next Task:   Phase 0 Task 0.1 — ServicePlan 스코프·독자·깊이·톤 합의 (superpowers:brainstorming)
Block:       없음
Uncertainty: 낮음
Note:        BusinessPlan §8~§9 → 하위 4개 문서 동기화 완료 (2026-04-12)
```

### 자동화 프로그램 백테스트 상태: ✅ v6.1 FINAL 확정
- 파일: `backtest/full_system_backtest_v6.py`
- CAGR 20.3% | Sharpe 0.99 | Calmar 0.78 | Max DD -25.8%
- 위험조정 수익률 기준 삼성전자 B&H beat (Sharpe 0.99 > 0.81)

---

## ✅ 시도하여 성공한 것 (Succeeded)

### 직전 세션까지 축적
- 사업 기획 Phase 1~4 완료 (3 병렬 리서치 → architect → critic → 피벗)
- Q1~Q11 사용자 답변 확정 → BusinessPlan.md 저장
- Dual Trader 구조·과금 철학·외부 투자 X 확정
- '투달' → '주픽 (JooPick)' 리브랜딩 + KIPRIS 상표 검증
- `tudal/src/lib/constants.ts` 주픽 브랜드 반영, 커스텀 로고 SVG
- Next.js 16.2.3 + React 19 + TS + Tailwind v4 + shadcn(base-nova) 세팅
- App Router `(auth)`/`(main)` 라우트 그룹 + 7 라우트
- 종목 분석 4탭 + 매크로 현황판 16지표 + 차트(캔들/라인/영역/MA/볼린저)
- `tudal/src/lib/data/*` mock 세트, `tudal/src/lib/supabase/*` SSR 스켈레톤
- `tudal/middleware.ts` Supabase 세션 갱신 훅 (env 미연결)

### 현 세션 산출물 (전부)
- **BusinessPlan §8~§9 → 하위 문서 동기화 (2026-04-12)**:
  - ServicePlan.md: §1.2에 투심위·Quant·백테스트 확정 기록, §3.19/§3.20/§3.21 신설(18→21 섹션), §2.6 백테스트 코드 위치, §0 트래커에 Task 1.7/1.8 추가, §4 Revision History 갱신
  - Phase.md: Task 1.7(투심위 UX 리서치/document-specialist) + 1.8(Quant 데이터 플로우/architect) 신규, Task 1.1/1.6/2.3/3.1 스코프 노트, 병렬 디스패치 5→7개, 소스별 스킬 요약·Phase Gate 갱신
  - BuildPhase.md: B2.5 Quant 런타임 스코프 확장, B2.9 backtest/ 컨텍스트, B3.2 투심위 데이터 소스, B3.3~N 규모 예측(23개), B4.2 투심위 컴플라이언스 검증
  - HANDOFF.md: 현재 단계·다음 단계·성공 블록 동기화
- `CLAUDE.md` 프로젝트 루트 작성 → 5-문서 시스템 인식 규칙 포함
- `PLAN.md` → `BusinessPlan.md` git mv (SHA 동일성 검증 완료)
- `Phase.md` 작성 → 범위 Phase 0~6으로 축소 (6.4/Phase 7 제거), Task 2.3 재결정, Uncertainty 플래그
- `ServicePlan.md` 작성 → §3 본문 18 섹션으로 확장(Vision/Competitive/Strategy Canvas/Design System 추가), §0 **Planning + Build 통합 트래커**, §2 Infrastructure에 BuildPhase Task ID 링크
- **`BuildPhase.md` 신규 작성** → Stage B1~B6 전체, 각 Task에 Primary/Alternatives/Rationale/Uncertainty/Output
- 하네스 4종 정의 (주픽-디자인 B1.0 / 주픽-구현 B2.8 / 주픽-데이터 B2.9 / 주픽-기획 선택)
- deepinit 수행 위치 확정 (B2.1, tudal/ 루트)
- Phase 6.3 ScreenSpec → BuildPhase B3.0으로 이동 (디자인 시안 선행 의존)
- `HANDOFF.md`(본 문서) 5-문서 시스템 반영 재구성
- 로컬 프로젝트 메모리 생성: 주픽 프로젝트 활성화 기록

### 자동화 프로그램 백테스트 세션 산출물 (2026-04-12)

**백테스트 코드 (6개 버전 반복 최적화)**:
- `backtest/crisis_layer_backtest.py` — Crisis Layer v1 (VKOSPI 과대추정 문제)
- `backtest/crisis_layer_backtest_v2.py` — Crisis Layer v2 (CAGR 19.1%, Sharpe 1.24)
- `backtest/full_system_backtest.py` — 3축 통합 v1 (버그 수정 후 CAGR 11.9%)
- `backtest/full_system_backtest_v2.py` — v2: 8대 갭 수정 시도 (외국인/PBR API 실패)
- `backtest/full_system_backtest_v3.py` — v3: 공격적 Crisis Layer
- `backtest/full_system_backtest_v4.py` — v4: 트렌드 팔로잉 (비용 과다)
- `backtest/full_system_backtest_v5.py` — v5: 풀투자 + 반응형 위기관리
- **`backtest/full_system_backtest_v6.py` — v6.1 FINAL: Early Warning + 풀투자 (최종)**

**v6.1 FINAL 핵심 수치** (2019.01~2026.04, 7.3년):
| 지표 | B&H (삼성전자) | 주픽 v6.1 |
|---|---|---|
| 총 수익률 | +431.6% | +269.8% |
| CAGR | +26.6% | +20.3% |
| Max DD | -45.2% | -25.8% |
| **Sharpe** | 0.81 | **0.99** |
| **Calmar** | 0.59 | **0.78** |
| 월간 Win Rate | 48.9% | 55.7% |
| COVID DD 회피 | -31.2% | -19.2% (12.0%p 방어) |

**v6.1 시스템 구성**:
1. **Early Warning System** — 5개 선행지표(MA구조+모멘텀다이버전스+변동성+거래량+RSI급락) 복합, 3일 확인 윈도우, 점진적 디리스킹
2. **Crisis Layer v6** — EW(선행) + Reactive(반응) 2단계 방어. 크래시 시 즉시 10-25%
3. **3축 완전 분화** — 단기(21일/모멘텀+수급) + 중기(42일/균형) + 장기(63일/밸류+퀄리티)
4. **부분 리밸런싱** — 유지 종목 거래 안 함, 변경분만 매매
5. **동적 유니버스** — 분기별 시총 상위 40종목 재구성 (생존편향 제거)
6. **복합 레짐 감지** — MA4종 + 모멘텀2종 + RSI 복합 (sideways 과다분류 해소)

**최적화 이력 (v1→v6.1)**:
| 버전 | CAGR | Sharpe | Max DD | 핵심 변경 |
|---|---|---|---|---|
| v1 | 11.9% | 0.68 | -20.4% | 포지션 키 중복 버그 수정 |
| v3 | 11.1% | 0.57 | -23.8% | 공격적 Crisis Layer |
| v5 | 8.6% | 0.38 | -31.9% | 반응형 위기관리 (한계 확인) |
| v6 원본 | 16.3% | 0.83 | -25.7% | Early Warning 도입 |
| **v6.1** | **20.3%** | **0.99** | **-25.8%** | **EW 민감도 튜닝** |

**발견된 구조적 한계**:
- 삼성전자 +431% (반도체 슈퍼사이클) = 분산 포트폴리오로 절대수익 beat 불가
- pykrx 외국인순매수/PBR API가 현 버전에서 empty 반환 → 거래량 proxy 사용
- 월간 WR 55.7% (목표 70% 미달) — 2023/2025/2026은 67-75% 달성
- 비용률 14.48% — 부분 리밸런싱으로 v4(28%) 대비 절반 감소

---

## ❌ 실패 / 보류 / 미결 (Failed / Pending)

### 기획 미결 (사용자 답변 필요)
- [ ] **Q13** 기존 코드베이스 재활용 방식 — **(B) 선별 재활용** 권장
- [ ] **Q14** 14개 기능 후보 Must/Should/Nice 분류 — Phase 3.1에서 해소
- [ ] Q12 공동창업자 피벗 합의 — R&R 정의 후
- [ ] Q16 법무 자문 이력·후보 — Phase 6 완료 직후
- [ ] Q17 이용약관·면책 동의서 계약 — BuildPhase B5 이전

### 실행 미시작 (BuildPhase 영역)
- [ ] deepinit (B2.1) — 아직 미실행
- [ ] 실데이터 연결 (B3.2) — 현재 100% mock
- [ ] Supabase 프로젝트 + `.env.local` (B2.2) — SSR 미들웨어 존재하나 env 0
- [ ] DB 스키마 (B2.6) — users/trades/positions/judgments 미설계
- [ ] 초대 코드 인증 (B2.7) — 공개형 로그인 스캐폴드 잔존
- [ ] 하네스 4종 전부 미구성 (B1.0 / B2.8 / B2.9)
- [ ] 디자인 시스템 (B1 전체) — 브랜드 로고만 있음
- [ ] UI 실물화·코드 변경·배포 전체 (B3~B5)

### 현 세션에서 방향 전환
- Phase.md 초기 범위(0~7) → **Phase 0~6 + BuildPhase B1~B6** 두 문서로 분리
- Task 2.3 Startup Canvas → 9-section Product Strategy
- Phase 6.3 ScreenSpec → BuildPhase B3.0 (디자인 시안 선행 필요)
- 하네스 3종 → 4종 (디자인 하네스 추가)
- ServicePlan §3 17→18 섹션 (§3.18 Design System 추가)

### 상시 경고 (Hard Constraints)
- **Next.js 16 학습 데이터 불일치**: `tudal/AGENTS.md`. 라우팅·미들웨어·메타데이터·서버 액션은 `tudal/node_modules/next/dist/docs/` 또는 context7 MCP 참조 의무.
- **테스트 러너 없음**: `cd tudal && npm run build && npm run lint`가 유일한 검증 게이트.
- **pricing 스캐폴드 legacy**: 3tier PLANS + `(main)/pricing` 라우트는 B3.1에서 제거 대상. 확장 금지.
- **"사세요/파세요" 금지**: AI 출력은 데이터·분석만. BusinessPlan §7.
- **500명 cap + 초대 전용**: 공개 가입·광고 금지.

---

## 🔴 다음 단계 (Next Steps)

### STEP 0 — 문서 동기화 ✅ 완료 (2026-04-12)
BusinessPlan §8 투심위 + §9 Quant + §9.3 백테스트 → ServicePlan/Phase/BuildPhase/HANDOFF 4개 문서 동기화. Phase.md Task 1.7/1.8 신규 추가, ServicePlan §3.19~§3.21 신설, BuildPhase 스코프 확장.

### STEP 1 — 지금 즉시: Phase 0 Task 0.1
**`superpowers:brainstorming` 스킬을 기동해 사용자와 아래 4개 합의**:
1. **ServicePlan.md 독자** — 본인 전용 / 공동창업자 공유 / 미래 개발 레퍼런스 중 어디까지?
2. **깊이** — 한 장 전략 요약 / 8-section PRD / FRD 수준 화면별 기능 중 택
3. **목차** — ServicePlan §3 본문 **21 섹션** 골격 승인 여부 (§3.19 투심위 / §3.20 Quant / §3.21 백테스트 포함)
4. **톤** — 한국어·존댓말 기본 / 기술 용어 비율 / 다이어그램 포함 여부

합의 완료 시:
- ServicePlan.md §1.1에 기록 + §0 [0.1] → `[x]`
- §4 Revision History 한 줄 추가
- 본 문서 §"성공" 블록에 체크, §"다음 단계"를 STEP 2로 갱신

### STEP 2 — Phase 0 Task 0.3 게이팅
잔여 모호성 있으면 `oh-my-claudecode:deep-interview` 에스컬레이션, 없으면 STEP 3 진입.

### STEP 3 — Phase 1 병렬 디스패치 (한 메시지 7 에이전트)
```
• analyst                                                → 1.1 BusinessPlan 갭 분석 (§8~§9 포함)
• document-specialist + pm-market-research:competitor-analysis → 1.2 경쟁 스캔
• pm-market-research:user-personas                       → 1.3 페르소나
• pm-market-research:customer-journey-map                → 1.4 고객 여정
• pm-product-discovery:brainstorm-ideas-existing         → 1.6 기능 풀 (23개 feature 후보 입력)
• document-specialist                                    → 1.7 투심위 UX 패턴 리서치
• architect (opus) + scientist (보조)                    → 1.8 Quant 데이터 플로우 리서치
```
1.5 Core JTBD(`pm-product-strategy:value-proposition`)는 1.3 이후 순차.

**주의**:
- 1.2 document-specialist vs researcher: Uncertainty 중간, 실행 직전 확인
- 1.6 existing vs new: Uncertainty 중간, mock 스캐폴드 해석 재확인
- 1.7 document-specialist: Uncertainty 중간, 한국 금융 UX 레퍼런스 가용성 확인. 조사 대상 4개 이상 시 `oh-my-claudecode:external-context` 승격 고려
- 1.8 architect + scientist: Uncertainty 중간, Python↔Next.js 브릿지가 B2.5와 상호 의존

### STEP 4~7 — Phase 2~5
Phase.md §진입 조건 따라 순차. Phase 5 v1.0 확정 전까지 BuildPhase 진입 금지.

### STEP 8 — Phase 6 (FRD + Scenarios)
- 6.1 `frd-writer` → FRD.md
- 6.2 `scenario-system` → Scenarios.md
- 완료 = Planning Phase 종료 → BuildPhase 진입 전제 충족

### STEP 9 — BuildPhase B1 + B2 병렬 착수
- **B1 Design Execution**: B1.0(디자인 하네스) → B1.1~B1.7 (frontend-design 스킬 활용)
- **B2 Pre-Implementation**: B2.1(deepinit) 선행 → B2.2~B2.9 병렬 가능

### STEP 10 — BuildPhase B3 Implementation
B1 + B2 완료 후 착수. B3.3~B3.N Must 기능은 Phase 3.1 결과로 세분화된 대로 `/ultrawork` 또는 `/ralph`.

### STEP 11 — BuildPhase B4 (5축 병렬) → B5 Ship
`/ultraqa` + `/security-review` + `performance-reviewer` + `ux-researcher` + `/gstack:review` 병렬 → `/ship` → `/land-and-deploy` → `/canary`.

### STEP 12 — 문서 동기화 (B5.4)
ServicePlan §4, HANDOFF, CLAUDE.md(학습 반영 필요 시 `claude-md-management:revise-claude-md`).

### STEP 13+ — Iteration Loop (B6)
`/gstack:retro` → `pm-product-discovery:prioritize-features` → B3~B5 반복.

---

## 📋 세션 시작 체크리스트 (복붙용)

```
- [ ] BusinessPlan.md 읽기 (§11 의사결정 기록 최신)
- [ ] ServicePlan.md §0 통합 트래커에서 현재 Task 확인
- [ ] Phase.md (Planning 단계일 때) 또는 BuildPhase.md (Build 단계일 때) 해당 Task 블록 정독
- [ ] HANDOFF.md (본 문서) §"현재 단계" + §"다음 단계" 확인
- [ ] Uncertainty 플래그 확인 — "중간" 이상이면 사용자 재확인
- [ ] 사용자에게 "Task X를 〈에이전트/스킬〉로 진행합니다. Uncertainty: 〈낮/중/높〉" 고지
- [ ] 병렬 디스패치 가능 여부 확인
- [ ] 실행 → 산출물 라우팅 (ServicePlan.md §3 / .omc/research/ / tudal/ 코드)
- [ ] ServicePlan.md §0 체크박스 업데이트
- [ ] ServicePlan.md §4 Revision History 한 줄 추가
- [ ] 세션 종료 전 본 문서 §"시도/성공/실패/다음" 4블록 갱신
- [ ] 중요 결정 라우팅: 사업 → BusinessPlan.md, 서비스 → ServicePlan.md §1, 인프라 → ServicePlan.md §2
```

---

## 🧠 절대 잊지 말 것 (BusinessPlan §7)

```
본질:
  주픽은 "자산운용 사업"이 아님.
  "매일 쓸 최고 품질 플랫폼 + 본인 자금 실전 검증 + 신뢰 배포" 프로젝트.
  최악 시 개인 도구로 계속 사용 → 실패 개념 자체가 없음.

재무:
  운용 자본 15억(본인), 월 운영비 100만 MAX, 외부 투자 0,
  과금 철학 = 비용 충당 수준(월 19,900원), 이익 추구 X.

법적:
  ① 배포 500명 이하
  ② AI 판단 금지 — "사세요/파세요" 금지
  ③ 초대 기반 신원 확인, 광고 모집 금지
  ④ 면책 문구 모든 페이지 하단 고정
  ⑤ 자기 자금만 운용 (Y1 말까지)
```

---

**이 문서는 세션 단일 진입점입니다. 다음 에이전트는 이 문서 + ServicePlan.md §0만 읽으면 즉시 작업 재개 가능합니다.**
