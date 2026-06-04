# ServicePlan.md — 주픽 서비스 기획 인덱스

Last updated: 2026-06-04
Status: 인덱스 전환 — 어드민/멤버 기획 분리 구조 · 2026-04-21 D16 반영(Stage 어휘 폐기 + 자동매매 S8 승격) · **65차(2026-06-04) 7결정 supersede 포인터 반영** (상세 SoT → HANDOFF.md ⭐ 65차 MVP 엔진 섹션 / ServicePlan-Admin)

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
| 어드민 메인 서비스 | 어드민(본인 + 친구 3명) — **내부 투자 도구** — AI 가상 포트 본체 + 3경로 집행(매뉴얼·자동매매·외부 바이패스) | **v1.3 (2026-04-22) — D17 DQ-7 Admin Credential System 재설계 반영** (D16 이력 포함: 자동매매 S8 승격 · 주식+바이낸스 선물). | → `ServicePlan-Admin.md` |
| 멤버 페이지 | 멤버(Deferred-D) — **법적 문제 없는 선의 리서치 웹페이지 수준** (D13, 2026-04-15 축소) | 기획 착수 대기 · 재질문 금지(Q-OP3) · 현 어드민 플랜과 분리 | → `ServicePlan-Member.md` |

**진행 순서**: 어드민 v1.3 (2026-04-22) → **DQ-7 Admin Credential System** → S7 실데이터 전환 → S9 운용 검증 → 🎉 출시 (자동매매 제외) → **(출시 후) S8 자동매매 프레임** (실운용하며 개발). 멤버 트랙은 어드민 운용 안정화 후 Deferred-D 재개.

---

## 2. BusinessPlan 파생 제약 (어드민·멤버 공통)

> 사업 레벨에서 이미 확정된 제약. 두 sub-doc 모두 이 범위 안에서 움직인다. 상세는 `BusinessPlan.md` 해당 섹션 참조.

| 항목 | 내용 | 출처(SoT) |
|---|---|---|
| 가격 | 월 19,900원 | → BusinessPlan §Q11 |
| 사용자 규모·법·언어 | 500명 cap · 초대 전용 · 매수/매도 추천 금지 · Footer 면책 · Korean-first | → BusinessPlan §7 |
| 핵심 시스템 1 — AI 투심위 | 2-Layer(Core 11명 + Sector Board canonical 14 sectors × 14 personas/sector overlay — D21 52차 박제), Section 0~8 + Appendix. ※ **65차 Q4 supersede (2026-06-04)**: 합의 메커니즘 = Core 11 병렬 독립 채점 + 결정론 합의 에이전트 → **실시간 멀티라운드 AI 반박 토론 loop**로 확장(합의 점수로 최종 선택). 토론 loop schema는 W0~W3 구현 위임 — SoT → HANDOFF.md ⭐ 65차 MVP 엔진 섹션 / ReportFramework §5~§7 / ServicePlan-Admin | → BusinessPlan §8 / ReportFramework.md §1·§5~§7·§7.2/§7.3 v2.5 |
| 핵심 시스템 2 — Quant 분석 엔진 | 3축(스코어링·위기감지·리밸런싱), EW + Crisis Layer, 단기30%/중기40%/장기30%. ※ **65차 Q2 supersede (2026-06-04)**: 단/중/장 고정 분배(30/40/30) 및 '항상 30 전체 운용' 폐기 → **AI 자율 포트구성**(운용여부·총개수·종목·단중장분배·비중·현금 0~30% 전부 AI 자율). 어드민 Accept/Reject만 유지. 포트 proposal schema는 W0~W3 구현 위임 — SoT → HANDOFF.md ⭐ 65차 MVP 엔진 섹션 / BusinessPlan §9 / ServicePlan-Admin | → BusinessPlan §9 (분석 엔진은 전 Stage 공통, 자동매매 실행은 Stage 2~3) |
| 핵심 시스템 3 — 매뉴얼 트레이딩 (어드민 전용) | Short List 30개(10+10+10). ※ **65차 Q1 supersede (2026-06-04)**: '월 1회 단일 재선정' 폐기 → **선정주기 분리 = 단기 주 1회 / 중장기 월 1회**. SoT → HANDOFF.md ⭐ 65차 MVP 엔진 섹션 / ServicePlan-Admin §1A.5 / ReportFramework §8 | → BusinessPlan §10 |
| ~~트레이딩 실행 3-Stage 로드맵~~ | **폐기 (2026-04-21 D16)**. 자동매매 = S8 단일 슬라이스로 통합. 내부 단계: 모의↔실 체결 토글 + Strategy drop-in↔AI 어댑터 embed | → BusinessPlan §12 (2026-04-21 정정) / `Slices/S8-AutoTrading.md` |
| **어드민 실행 모델 (D11, v1.0 · 2026-04-21 보강)** | AI 가상 포트 본체(선착순 Accept=측정용) + 3경로 집행: (1) 주픽 매뉴얼 트레이딩 (2) **주픽 자동매매 (S8, 주식 KIS + 바이낸스 선물)** (3) 외부 증권사/거래소 앱 바이패스 | → BusinessPlan §12 D11 / ServicePlan-Admin.md §1A.0 / `Slices/S8-AutoTrading.md` |
| **어드민 증권사/거래소 API 다중 연결 (D12)** | 동일 증권사라도 전략별 복수 앱키·계좌 허용, 1:N 다대다. **2026-04-21**: 코인 거래소(바이낸스)도 동일 패턴으로 E12 ExchangeConnection 추가. | → BusinessPlan §12 D12 / ServicePlan-Admin.md §4.2 E9 + §3.13 E12 |

> **Stage 구분 (2026-04-21 폐기)**: 구 "Stage 1 매뉴얼 → Stage 2 API → Stage 3 AI 자율" 어휘는 현재 사용하지 않는다. 자동매매 = **S8 단일 슬라이스**로 통합되며, 내부 단계로 (i) 모의↔실 체결 토글, (ii) Strategy drop-in↔AI 어댑터 embed를 세분화한다. 상세 `Slices/S8-AutoTrading.md`.

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
- **AI 모델/프로바이더 추상화** (65차 Q3, 2026-06-04): AI 모델 ID 하드코딩 금지 → 설정값(모델 레지스트리)화. 역할별 모델 차등(토론 참가 = 저가 모델 / 최종 judge·리포트 = 고가 모델). **Claude + GPT 멀티프로바이더** — provider availability auto-detect(GPT 키 없으면 Claude-only fallback). 구 'AI 키 = Anthropic 유일 공통 키' 전제 폐기. 레지스트리·provider 어댑터 구현은 W0~W3 위임. SoT → HANDOFF.md ⭐ 65차 MVP 엔진 섹션 / ServicePlan-Admin.
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
| **2026-04-21** | **D16 어드민 내부 도구 재정의 + 자동매매 S8 승격** — §1 표를 v1.2로 갱신 + 어드민 범위를 "본인+친구 3명 내부 투자 도구"로 명시. §2 "트레이딩 실행 3-Stage 로드맵" 행을 **폐기 상태**로 표기, D11·D12 행에 S8·바이낸스 선물·Strategy drop-in·AI 어댑터 반영. §2 하단 Stage 구분 주석도 폐기 선언으로 교체. | ServicePlan-Admin v1.2 반영 + 사용자 Q1~Q3 답 |
| **2026-04-22** | **D17 DQ-7 Admin Credential System 재설계 반영** — §1 표를 v1.3으로 갱신. ServicePlan-Admin v1.3 (D17) 반영 트리거: (a) per-admin API 키 UI + AES-256-GCM 암호화, (b) DB 분리 2 테이블 (E9 확장 + E12 신설), (c) Vercel 첫 배포 DQ-7 선행, (d) 실계좌/메인넷 권한 = 대표 1인(`ADMIN_REP_EMAIL`), (e) 마이그레이션 번호 재배정(0009=DQ-7·0010=BL-KRIT-7). §3 "API 시크릿 관리" 원칙은 변경 없음 — Vault/Secrets 참조 원칙이 AES-256-GCM 암호화 컬럼으로 구현됨(DQ-7 spec §3.1). | ServicePlan-Admin v1.3 반영 + 28차 docs cleanup |
| **2026-06-04** | **65차 7결정 supersede 포인터 반영** — §2 매뉴얼 트레이딩 행에 선정주기 단기 주1회/중장기 월1회 분리(Q1), AI 투심위 행에 실시간 멀티라운드 토론 loop supersede 포인터(Q4), Quant 분석 엔진 행에 AI 자율 포트구성 supersede 포인터(Q2), §3 공통원칙에 'AI 모델/프로바이더 추상화' 항목 신설(Q3 — 역할별 모델 차등·멀티프로바이더 auto-detect). hardcap 40만→50만·MVP 재정의·빌드순서 W0→W2→W1→W3·역할별 모델 차등 비용은 본 인덱스 문서에 직접 텍스트 없음 → ServicePlan-Admin / HANDOFF SoT 참조. 깊은 spec/schema 재작성은 W0~W3 구현 위임. | 65차 사용자 확정 7결정 (omxy CONVERGED) |
