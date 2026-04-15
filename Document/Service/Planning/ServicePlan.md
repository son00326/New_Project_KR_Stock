# ServicePlan.md — 주픽 서비스 기획 인덱스

Last updated: 2026-04-15
Status: 인덱스 전환 — 어드민/멤버 기획 분리 구조

---

## 0. 이 문서의 정체성

이 문서는 **서비스 기획의 인덱스 + 공통 원칙**만 담는다. 상세 기획은 **어드민/멤버로 분리된 sub-doc**에 있다.

- **담는 것**: 사업 레벨 파생 제약·공통 원칙·sub-doc 포인터·통합 Revision.
- **담지 않는 것**: 어드민/멤버 각자의 IA·기능 스펙·User Stories → 각 sub-doc.
- **분리 이유**: 어드민(사용자 본인 1명)과 멤버(500cap 초대)는 사용자·기능·제약이 전혀 달라 독립 확정이 필요. 확정 주기도 다르다.

---

## 1. 서비스 기획 분리 구조 (SoT 포인터)

| sub-doc | 대상 | 상태 | SoT |
|---|---|---|---|
| 어드민 메인 서비스 | 어드민(사용자 본인) — Top30·풀 리포트·AI 포트폴리오·악재 알림 | 기획 착수 대기 (1순위) | → `ServicePlan-Admin.md` |
| 멤버 페이지 | 멤버(500cap 초대) — 랜딩→로그인→메인(Research 형식) | 기획 착수 대기 (2순위, Research 보강 블로커) | → `ServicePlan-Member.md` |

**진행 순서**: 어드민 먼저(BusinessPlan §10 정의 충분) → 멤버 나중(Research/ 경쟁사 리서치 선행 필요).

---

## 2. BusinessPlan 파생 제약 (어드민·멤버 공통)

> 사업 레벨에서 이미 확정된 제약. 두 sub-doc 모두 이 범위 안에서 움직인다. 상세는 `BusinessPlan.md` 해당 섹션 참조.

| 항목 | 내용 | 출처(SoT) |
|---|---|---|
| 가격 | 월 19,900원 | → BusinessPlan §Q11 |
| 사용자 규모·법·언어 | 500명 cap · 초대 전용 · 매수/매도 추천 금지 · Footer 면책 · Korean-first | → BusinessPlan §7 |
| 핵심 시스템 1 — AI 투심위 | 2-Layer(Core 11명 + Sector 14×10명), Section 0~8 + Appendix | → BusinessPlan §8 / ReportFramework.md §1·§5~§7 |
| 핵심 시스템 2 — 자동매매 3축 Quant | 단기30% / 중기40% / 장기30%, Quant Board 10명, Early Warning + Crisis Layer | → BusinessPlan §9 (미확정, 재검토 대기) |
| 핵심 시스템 3 — 매뉴얼 트레이딩 (어드민 전용) | Short List 30개(10+10+10), 월 1회 재선정 | → BusinessPlan §10 |
| 운용 자금 | 본인 자금 15억 선행 운용 | → BusinessPlan §Q10 |

---

## 3. 어드민·멤버 공통 원칙

- **인증 분리**: 어드민 role vs 멤버 role. 멤버는 어드민 페이지 접근 불가(라우트 가드 + RLS).
- **라우트 그룹**: `/admin/*` (어드민 전용) / `/(main)/*` (멤버) / `/(auth)/*` (로그인·가입).
- **디자인 시스템** (BuildPhase B1.x에서 확정, 여기가 공통 SoT):
  - Base: shadcn/ui base-nova + Lucide
  - 토큰 (컬러/타이포/스페이싱): _B1.2에서 확정 예정_
  - Voice & Tone: _B1.1에서 확정 예정_
  - 컴포넌트 오버라이드: _B1.3에서 확정 예정_
  - Design Source (Figma 등): _B1.7에서 확정 예정_
- **면책 Footer**: 전 페이지 고정 — "정보 제공, 투자 자문 아님".
- **한국어 우선**: `<html lang="ko">` 고정.
- **Next.js 16 Breaking**: 코드 작성 전 `node_modules/next/dist/docs/` 또는 context7 MCP 참조 (tudal/AGENTS.md 규약).

---

## 4. Revision History

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-04-12 | ServicePlan.md 초기 스캐폴드 | 4-문서 구조 전환 |
| 2026-04-12 | BuildPhase 통합 트래커·Infrastructure §2·본문 18 섹션 신설 | 사용자 승인 |
| 2026-04-12 | BusinessPlan §8~§9 동기화 | BusinessPlan 확정 반영 |
| 2026-04-13 | Manual 투자 트랙 §3.22 신설 | 사용자 인터뷰 결과 |
| 2026-04-15 | **전면 리셋**. §2 본체만 담는 문서로 재정의. | 사용자 지시 — "서비스 기획부터 다시" |
| 2026-04-15 | **기준선 정합성 정리**. §3.22 중복 제거, SoT 포인터 재정렬. | 기준선 충돌·중복 정리 |
| **2026-04-15** | **인덱스 전환.** 본 문서를 인덱스+공통 원칙으로 슬림화. 어드민/멤버 기획을 `ServicePlan-Admin.md` / `ServicePlan-Member.md`로 분리. 다음 세션에서 어드민 먼저 착수. | 사용자 지시 — 독립 확정 목적 |
