# ServicePlan.md — 주픽 서비스 기획 인덱스

Last updated: 2026-04-15
Status: 인덱스 전환 — 어드민/멤버 기획 분리 구조

---

## 0. 이 문서의 정체성

이 문서는 **서비스 기획의 인덱스 + 공통 원칙**만 담는다. 상세 기획은 **어드민/멤버로 분리된 sub-doc**에 있다.

- **담는 것**: 사업 레벨 파생 제약·공통 원칙·sub-doc 포인터·통합 Revision.
- **담지 않는 것**: 어드민/멤버 각자의 IA·기능 스펙·User Stories → 각 sub-doc.
- **분리 이유**: 어드민(3명 가정)과 멤버(500cap 초대)는 사용자·기능·제약이 전혀 달라 독립 확정이 필요. 확정 주기도 다르다.

---

## 1. 서비스 기획 분리 구조 (SoT 포인터)

| sub-doc | 대상 | 상태 | SoT |
|---|---|---|---|
| 어드민 메인 서비스 | 어드민(3명 가정) — AI 가상 포트 본체 + 3경로 집행(매뉴얼·자동매매·외부 바이패스) | **v1.1 (13차 후속2) — P5+Q-OP 완료. Must 19.** | → `ServicePlan-Admin.md` |
| 멤버 페이지 | 멤버 — **법적 문제 없는 선의 리서치 웹페이지 수준** (D13, 2026-04-15 축소) | 기획 착수 대기 · 재질문 금지(Q-OP3) | → `ServicePlan-Member.md` |

**진행 순서**: 어드민 v1.1 완료(2026-04-15) → 멤버는 당분간 보류. 어드민 3명 전용 운영 체제가 안정화된 후 리서치 뷰어 수준에서 재착수.

---

## 2. BusinessPlan 파생 제약 (어드민·멤버 공통)

> 사업 레벨에서 이미 확정된 제약. 두 sub-doc 모두 이 범위 안에서 움직인다. 상세는 `BusinessPlan.md` 해당 섹션 참조.

| 항목 | 내용 | 출처(SoT) |
|---|---|---|
| 가격 | 월 19,900원 | → BusinessPlan §Q11 |
| 사용자 규모·법·언어 | 500명 cap · 초대 전용 · 매수/매도 추천 금지 · Footer 면책 · Korean-first | → BusinessPlan §7 |
| 핵심 시스템 1 — AI 투심위 | 2-Layer(Core 11명 + Sector 14×10명), Section 0~8 + Appendix | → BusinessPlan §8 / ReportFramework.md §1·§5~§7 |
| 핵심 시스템 2 — Quant 분석 엔진 | 3축(스코어링·위기감지·리밸런싱), EW + Crisis Layer, 단기30%/중기40%/장기30% | → BusinessPlan §9 (분석 엔진은 전 Stage 공통, 자동매매 실행은 Stage 2~3) |
| 핵심 시스템 3 — 매뉴얼 트레이딩 (어드민 전용) | Short List 30개(10+10+10), 월 1회 재선정 | → BusinessPlan §10 |
| **트레이딩 실행 3-Stage 로드맵** | Stage 1: 매뉴얼(증권앱 직접) → Stage 2: API 연동(승인 후 자동 체결) → Stage 3: 자율 운용(AI 전자동) | → BusinessPlan §12 (2026-04-15 확정) |
| **어드민 실행 모델 (D11, v1.0)** | AI 가상 포트 본체(선착순 Accept=측정용) + 3경로 집행: (1) 주픽 매뉴얼 트레이딩 (2) 주픽 자동매매(미확정) (3) 외부 증권사 앱 바이패스 | → BusinessPlan §12 D11 / ServicePlan-Admin.md §1A.0 |
| **어드민 증권사 API 다중 연결 (D12)** | 동일 증권사라도 전략별 복수 앱키·계좌 허용, 1:N 다대다 | → BusinessPlan §12 D12 / ServicePlan-Admin.md §4.2 E9 |

> **Stage 구분**: Stage 1~2는 어드민 서비스 내 메뉴. Stage 3는 별도 트랙으로 기획·개발하되, 완성 후 어드민 서비스에 메뉴로 통합. 세 Stage 모두 Quant 분석 엔진(핵심 시스템 2)을 공유.

> **가상 포트 vs 실제 집행**: 주픽의 승인(Accept) 결과는 **AI 알고리즘 성능 측정용 가상 포트**. 실제 자금 운용은 어드민 개별 증권사 계좌(API 또는 외부 앱)에서 각자 독립. Track Record·NSM(CAP Months)·Anti-Metric 측정은 가상 포트 기준.
| 운용 자금 | 본인 자금 15억 선행 운용 | → BusinessPlan §Q10 |

---

## 3. 어드민·멤버 공통 원칙

- **인증 분리**: 어드민 role vs 멤버 role. 멤버는 어드민 페이지 접근 불가(라우트 가드 + RLS).
- **라우트 그룹**: `/admin/*` (어드민 전용) / `/(main)/*` (멤버) / `/(auth)/*` (로그인·가입).
- **디자인 시스템** (S0 Foundation 또는 해당 슬라이스 설계 단계에서 확정, 여기가 공통 SoT):
  - Base: shadcn/ui base-nova + Lucide
  - 토큰 (컬러/타이포/스페이싱): _S0 Foundation에서 확정 예정_
  - Voice & Tone: _S0 Foundation에서 확정 예정_
  - 컴포넌트 오버라이드: _S0 Foundation에서 확정 예정_
  - Design Source (Figma 등): _S0 Foundation에서 확정 예정_
- **면책 Footer**: 전 페이지 고정 — "정보 제공, 투자 자문 아님".
- **한국어 우선**: `<html lang="ko">` 고정.
- **Next.js 16 Breaking**: 코드 작성 전 `node_modules/next/dist/docs/` 또는 context7 MCP 참조 (tudal/AGENTS.md 규약).
- **API 시크릿 관리** (D12, v1.0): 증권사·거래소 API 키는 평문 저장 금지. Vault/Secrets 참조 방식(`api_key_ref`). 본인 키는 본인만 접근(Supabase RLS로 강제). 상세 `ServicePlan-Admin.md §4.2 E9 / §4.5`.
- **멤버 스코프** (D13, v1.0): 멤버 페이지는 법적 문제 없는 선의 리서치 웹페이지 수준. 매수/매도 추천 금지 유지. Short List·풀 리포트·포트폴리오·Exit 시그널 등 어드민 전용 데이터 노출 금지.

---

## 4. Revision History

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-04-12 | ServicePlan.md 초기 스캐폴드 | 4-문서 구조 전환 |
| 2026-04-12 | `Document/Build/ProgressDashboard.md`·Infrastructure §2·본문 18 섹션 신설 | 사용자 승인 |
| 2026-04-12 | BusinessPlan §8~§9 동기화 | BusinessPlan 확정 반영 |
| 2026-04-13 | Manual 투자 트랙 §3.22 신설 _(구 번호, 인덱스 전환 후 ServicePlan-Admin.md로 흡수)_ | 사용자 인터뷰 결과 |
| 2026-04-15 | **전면 리셋**. §2 본체만 담는 문서로 재정의. | 사용자 지시 — "서비스 기획부터 다시" |
| 2026-04-15 | **기준선 정합성 정리**. §3.22 _(구 번호)_ 중복 제거, SoT 포인터 재정렬. | 기준선 충돌·중복 정리 |
| **2026-04-15** | **인덱스 전환.** 본 문서를 인덱스+공통 원칙으로 슬림화. 어드민/멤버 기획을 `ServicePlan-Admin.md` / `ServicePlan-Member.md`로 분리. 다음 세션에서 어드민 먼저 착수. | 사용자 지시 — 독립 확정 목적 |
| 2026-04-15 | 어드민 인원 1명→2~3명 반영 (§0·§1). P0 Task 0.2 동기화. | P0 Task 0.1 brainstorming 결과 |
| 2026-04-15 | §2 "자동매매 3축 Quant" → "Quant 분석 엔진" 명칭 변경 + 3-Stage 로드맵 추가. 승인 워크플로우(Accept/Reject, 선착순), 트랙 레코드 기준가(승인가) 확정. | P1 리서치 결과 + 사용자 결정 |
| 2026-04-15 | **P3.0 Pre-P3 Q&A 10차** — 어드민 인원 "3명 가정"으로 확정(§0), 어드민 결정 9건(D1~D9) 박제는 `ServicePlan-Admin.md §1A.5`. Short List 30(단10·중10·장10) **Must 고정** 공통 제약으로 격상. | P3.0 Q&A 결과 |
| 2026-04-15 | **P5 검증 → v1.0 (12차)** — §2 공통 제약에 D11 어드민 실행 모델(3경로 집행)·D12 증권사 API 다중 연결 행 추가. §3 공통 원칙에 API 시크릿 관리·멤버 스코프 축소 원칙 추가. §1 SoT 포인터 표 갱신(어드민 v1.0, 멤버 D13 스코프 축소). | P5 검증 결과 + 사용자 결정 D10~D13 |
| 2026-04-15 | **Q-OP1·Q-OP2 해소 → 어드민 v1.1 (13차 후속2)** — §1 SoT 포인터 표를 v1.1·Must 19로 갱신. 공통 원칙 변경은 없음(어드민 내부 결정 D14·D15). 멤버 상태 표기에 Q-OP3 재질문 금지 명시. | ServicePlan-Admin v1.1 반영 |
