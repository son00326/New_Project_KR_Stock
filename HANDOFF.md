# HANDOFF — 주픽 (JooPick) 프로젝트

Last updated: 2026-04-11
이 문서만 읽으면 다음 세션에서 즉시 이어서 진행 가능합니다.

---

## 🚨 상시 준수 지침 (매 세션 필수 적용, 업데이트 시에도 보존)

### 규칙 1 — 세션 시작 자동 워크플로우

**매 세션 시작 시 반드시 다음 순서로 진행:**

```
[1] 에이전트·스킬 추천
    ├── 현재 작업 유형 파악 (기획 / 구현 / 리서치 / 리뷰 / 디버깅 / 문서 / 배포)
    ├── 가장 적합한 OMC 에이전트 선택
    │   - 기획·전략 → planner, architect, /omc-plan
    │   - 구현 → executor (복잡 시 model=opus)
    │   - 리서치 → scientist, document-specialist
    │   - 디자인 → designer, /design-consultation
    │   - 리뷰 → critic, code-reviewer, verifier
    │   - 디버깅 → debugger, tracer
    │   - 문서 → writer
    │   - 배포 → /ship, /land-and-deploy
    └── 사용자에게 "이 작업은 X 에이전트로 진행합니다" 고지

[2] 분석
    ├── 작업 맥락 파악 (PLAN.md, 최근 git log, 관련 코드 읽기)
    ├── 목표와 제약 조건 명확화
    └── 숨은 요구사항·리스크 식별

[3] 실행
    ├── 선정된 에이전트·스킬로 작업 수행
    ├── 병렬 가능한 작업은 multi-agent 병렬 호출
    └── TaskCreate/TaskUpdate로 진도 추적

[4] 검증
    ├── code-reviewer 또는 verifier 에이전트로 품질 검토
    ├── 빌드·테스트·린트 통과 확인 (npm run build 등)
    └── 사용자 요구사항 충족 여부 점검

[5] 검증 확인
    ├── 사용자에게 검증 결과 보고
    ├── 추가 수정 사항 확인
    └── 다음 단계 제안
```

### 규칙 2 — 도구 사용 우선순위

**반드시 OMC / gstack 도구·에이전트·스킬 우선 사용.**
기본 Read/Edit/Write/Bash는 **OMC/gstack 대체재가 없을 때만** 사용.

### 규칙 3 — 의사결정 기록

모든 중요 결정은 PLAN.md의 "핵심 의사결정 기록" 섹션에 추가.
결정 근거와 날짜를 함께 남길 것.

### 규칙 4 — HANDOFF.md 갱신

세션 종료 시 반드시 이 문서를 갱신:
- 완료한 작업
- 남은 작업
- 새로 발생한 미결정 사항
- 규칙 1~4는 **절대 삭제하지 말 것**

---

## 📍 현재 단계

```
Stage: 기획 확정 → 실행 착수 대기
Phase: Pre-Implementation (Planning Complete)

확정 완료: Q1~Q11 사업 기획 (PLAN.md 참조)
대기 중:   Q13 (코드베이스 재활용 방식), Q14 (기능 우선순위)
다음 액션: Q13, Q14 답변 → 즉시 실행 착수
```

---

## ✅ 완료된 작업 (직전 세션)

### 사업 기획 (Phase 1~4)
- [x] 3개 병렬 리서치 (planner + analyst + document-specialist)
- [x] architect 시스템 아키텍처 설계 (Opus)
- [x] critic 적대적 검토
- [x] 사용자 피드백 반영하여 "자산운용 피벗" 방향 전환
- [x] 2026년 한국 시장 실증 데이터 확보
- [x] 30개 허들 매트릭스 작성
- [x] Q1~Q11 사용자 답변 수집 및 확정
- [x] PLAN.md 작성 (확정 기획 사항)
- [x] HANDOFF.md 재작성 (현재 문서)

### 네이밍 & 브랜드
- [x] '투달' → '주픽 (JooPick)' 리브랜딩
- [x] KIPRIS 상표 검증 완료
- [x] 프로젝트 전체 코드베이스 리네이밍
- [x] 로고 재설계 (빨간 배경 + 캔들 + 스파클)

### 기존 MVP 프레임워크
- [x] Next.js 16 + TypeScript + TailwindCSS + shadcn/ui 세팅
- [x] 7개 라우트 (랜딩/로그인/회원가입/요금제/매크로/종목/404)
- [x] 종목 분석 4개 탭 (차트/Fundamental/Technical/기업정보)
- [x] 매크로 현황판 (16개 지표)
- [x] 차트 (캔들/라인/영역 + MA + 볼린저밴드)
- [x] Mock 데이터 기반 전체 UI 완성

---

## 🔴 다음 세션 즉시 해야 할 일 (우선순위)

### 🥇 P0 — 지금 즉시 (세션 시작하자마자)

**1. 사용자 Q13, Q14 답변 수집**

> **Q13. 기존 코드베이스 재활용 방식**  
> (A) 완전 재활용 (최소 수정)  
> (B) 선별 재활용 + 대폭 간소화 ← **권장**  
> (C) 완전 재시작  
> (D) 병렬 운영  

> **Q14. 플랫폼 필수 기능 우선순위**  
> 14개 기능 후보를 🔴 Must Have (6개월) / 🟡 Should Have (12개월) / 🟢 Nice to Have (Y2+) 로 분류  
> 
> 기능 후보:  
> ① 실시간 종목 검색 ② 실시간 시세·차트 ③ Fundamental 분석 ④ Technical 분석 ⑤ 기업정보  
> ⑥ My Portfolio ⑦ TP 자동 추적 ⑧ 매매 의사결정 로그 ⑨ 리스크 대시보드 ⑩ 월간/분기 리포트  
> ⑪ 매크로 현황판 ⑫ 공시·뉴스 자동 수집 ⑬ 애널리스트 리포트 집계 ⑭ 섹터별 트렌드

### 🥈 P1 — Q13, Q14 답변 후 즉시 실행

**Q13이 (B) 선별 재활용인 경우:**

1. **executor (Opus) 에이전트로 코드베이스 정리**
   - 랜딩 페이지 → 홈 대시보드로 변경
   - 요금제 페이지 숨김 처리
   - 구독 게이트 제거
   - 초보 레벨 분석 제거 (전문가 레벨만)
   - 로그인 → 초대 코드 기반으로 변경
   - 검증: code-reviewer 에이전트

2. **executor 에이전트로 실데이터 연결**
   - Supabase 프로젝트 생성 및 .env.local 설정
   - 한국투자증권 OpenAPI 연동 (무료)
   - pykrx 또는 DART OpenAPI 연동 (백업)
   - KOSPI/KOSDAQ 전종목 데이터 파이프라인
   - 검증: verifier 에이전트

3. **architect 에이전트로 데이터 스키마 설계**
   - users (user_id, role, invited_by, invited_at)
   - trades (user_id, ticker, action, price, quantity, reason, timestamp)
   - positions (user_id, ticker, avg_price, quantity, current_value)
   - judgments (user_id, ticker, thesis, target_price, horizon, created_at)
   - 검증: critic 에이전트 (스키마 취약점)

### 🥉 P2 — Stage 2 준비 (M3-6 시점)

1. **법무 자문 준비**
   - document-specialist 에이전트로 법무법인 후보 리서치 (세움, 디라이트 등)
   - 이용약관 + 면책 동의서 초안 작성
   - 스팟 자문 50만원 이내 예산

2. **초대 기반 배포 설계**
   - designer 에이전트로 초대 코드 발급 UX
   - 지인용 온보딩 플로우

---

## 🟡 미결정 사항 (유보)

다음 결정은 **현재 실행에 필수 아님**. 해당 시점 도달 시 다시 논의.

| # | 질문 | 필요 시점 |
|---|------|----------|
| Q3 | 목표 최종 규모 | Y1 말 (플랫폼 output 보고 결정) |
| Q4 | 법적 등록 시점·종류 | Y1 말 Decision Tree 적용 시 |
| Q11 Vesting | 지분 Vesting 조항 | 플랫폼 품질 안정화 후 |
| Q12 | 공동창업자 피벗 합의 | git push 후 R&R 정의 시 |
| Q14 Must/Should/Nice | 기능 우선순위 | **지금 답변 필요** |
| Q15 | 플랫폼 외부 공개 세부 | 배포 시점 |
| Q16 | 법무 자문 이력 | Stage 2 진입 전 |
| Q17 | 계약서 준비 | Stage 3 직전 |
| Q18 | 손실 시 책임 | Y1 말 Layer 3 결정 시 |
| Q19 | 창업 동기 재점검 | 심리 상태 점검 필요 시 |
| Q20 | 5년 후 이상적 모습 | 비전 정립 필요 시 |

---

## 🗂 핵심 참조 파일

- **PLAN.md** — 확정된 기획 사항 (Q1~Q11 답변, 사업 구조, 재무, 법적 원칙)
- **tudal/** — 현재 Next.js 코드베이스 (폴더명은 '주픽' 리네이밍 미완, 그대로 유지)
- **tudal/src/app/** — 라우트 및 페이지
- **tudal/src/components/** — UI 컴포넌트 (stock, macro, layout, common, ui)
- **tudal/src/lib/data/** — Mock 데이터 (실데이터 연결 대상)
- **tudal/src/lib/supabase/** — Supabase SSR 구조 (미연동)
- **tudal/src/lib/constants.ts** — 서비스 상수 (주픽 브랜드 적용 완료)
- **tudal/src/components/layout/logo.tsx** — 로고 컴포넌트 (커스텀 SVG)

---

## 🧠 중요한 사업 프레임 (절대 잊지 말 것)

### 본질의 재정의
```
주픽은 "자산운용 사업"이 아님.
주픽은 "매일 쓸 최고 품질 플랫폼 + 본인 자금 실전 검증 + 신뢰 배포" 프로젝트.
실패 개념 자체가 없음 (최악 시 개인 도구로 계속 사용).
```

### 3층 구조
```
L1 플랫폼    ← 본질, 개인용 + 지인 배포 (30~500명)
L2 운용      ← 본인 15억 자금, 공동창업자 별도, 각자 독립
L3 확장      ← Y1 말 성과 기반 동적 결정 (가족→친지→LP)
```

### 재무 제약
```
운용 자본: 15억 (본인)
운영비: 월 100만 MAX
생활비: 12개월 여유
외부 투자: 0
과금 철학: 비용 충당 수준, 이익 X
```

### 법적 원칙
```
1. 배포 500명 이하
2. AI 판단 금지 (데이터·분석만)
3. 신원 확인 (초대 기반)
4. 면책 문구 필수
5. 자기 자금만 운용 (Y1까지)
```

---

## 🛠 사용해야 할 OMC 에이전트·스킬 (작업 유형별)

### 작업별 에이전트 매핑 (필수 참고)

| 작업 유형 | 1순위 에이전트 | 2순위 | 스킬 |
|----------|-------------|-------|------|
| 전략 기획 | planner (opus) | architect | /omc-plan, /autoplan |
| 시스템 설계 | architect (opus) | planner | - |
| 코드 구현 | executor (opus for complex) | - | /autopilot, /ralph |
| 리서치·조사 | scientist, document-specialist | Explore | - |
| 웹 검색 기반 리서치 | document-specialist | scientist | - |
| 적대적 검토 | critic | code-reviewer | /plan-ceo-review (no-skill, use planner) |
| 코드 리뷰 | code-reviewer | verifier | /review |
| 검증 | verifier | code-reviewer | /health |
| 디버깅 | debugger | tracer | /investigate |
| 디자인 (UI/UX) | designer | - | /design-consultation, /design-html |
| 디자인 리뷰 | designer | - | /design-review |
| 문서 작성 | writer | - | - |
| 보안 검토 | security-reviewer | - | /cso |
| 테스트 전략 | test-engineer | - | /qa |
| 배포 | - | - | /ship, /land-and-deploy |
| 심플화/리팩토링 | code-simplifier | - | /simplify |
| 스킬 발견 | - | - | omc-reference |

### 병렬 실행 원칙
- **독립 리서치 작업은 반드시 병렬** (한 메시지에 multiple Agent tool calls)
- **의존성 있는 작업만 순차**
- **품질 검증은 마지막에 verifier/critic 병렬**

### 금지 사항
- ❌ OMC 에이전트 없이 직접 복잡한 작업 수행
- ❌ 기획 → 바로 실행 (반드시 분석 단계 거칠 것)
- ❌ 실행 → 바로 완료 선언 (반드시 검증 거칠 것)
- ❌ HANDOFF.md의 상시 지침 삭제

---

## 📋 다음 세션 시작 체크리스트

세션 시작 시 다음 순서로 수행:

- [ ] HANDOFF.md 읽기 (이 문서)
- [ ] PLAN.md 읽기 (확정 기획 사항 복습)
- [ ] `cd /Users/kevinoh/Work/Work\ 1 && git log --oneline -5` (최근 커밋)
- [ ] `cd /Users/kevinoh/Work/Work\ 1/tudal && ls src/` (코드베이스 확인)
- [ ] "다음 세션 즉시 해야 할 일 (P0)" 확인
- [ ] 적절한 OMC 에이전트 선정 고지
- [ ] 사용자에게 진행 방향 승인 요청
- [ ] TaskCreate로 진도 추적 시작
- [ ] 자동 워크플로우 (추천→분석→실행→검증→검증확인) 적용

---

## 💬 직전 세션 마지막 상태

**사용자 마지막 요청**:
> "PLAN.md에는 정해진 기획 사항만, HANDOFF.md에는 다음 진행 사항 + 매 세션 상시 지침 (에이전트·스킬 추천→분석→실행→검증→검증확인 워크플로우, OMC·gstack 우선 사용) 을 포함하여 정리"

**Assistant 마지막 상태**:
- PLAN.md 작성 완료
- HANDOFF.md 작성 완료 (본 문서)
- 대기 중: 사용자가 Q13, Q14 답변하면 즉시 executor 에이전트로 실행 착수

**다음 세션 첫 메시지 권장**:
```
"HANDOFF.md를 읽고 다음 세션을 이어서 진행하겠습니다.
현재 Q13(코드베이스 재활용 방식)과 Q14(기능 우선순위) 답변이 필요합니다.
답변 주시면 executor 에이전트로 즉시 실행 착수하겠습니다."
```

---

**이 문서는 다음 세션의 "단일 진입점"입니다. 이 문서만 읽으면 즉시 작업 재개 가능해야 합니다.**
**상시 지침 섹션(🚨)은 절대 삭제하지 마시고, 업데이트 시에도 반드시 보존하세요.**
