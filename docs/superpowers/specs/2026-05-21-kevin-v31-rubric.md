# Kevin v3.1 Quality Rubric — Persona Prompt Composition Spec

> **목적**: Core 11 + Tier 2 sector 196 = 207 persona의 system prompt가 일관된 Kevin v3.1 quality (어떤 기업이 선정되어도 reference 정도 quality)를 내도록 8 markers를 명문화한다. **본 문서는 rationale only**. CI 검증 대상 SoT는 `tudal/src/lib/ai/prompts/kevin-v31-rubric.ts`.

> **출처**: 53차 §2 omxy R1~R3 CONVERGED (Step 3b 전략 lock-in 박제). 원자료 = `Document/Outputs/Report-Alteogen_196170_v3-Readable.md` (603 lines) + `Document/Service/Report/ReportFramework-v3-{DraftPhilosophy,NarrativeDesign,Decisions,ValuationTrial}.md`.

---

## 1. Kevin v3.1 quality 정의

**중심 가설**:
Kevin reference 본문 (600~1500 lines)을 200자 argument에 reproduce 불가. 본 rubric은 **"4 inquiry axes + 8 quality markers의 일관 적용 grammar"** 로 quality를 정의한다. 어떤 종목이 선정되어도 200자 argument에서 Kevin v3.1 inquiry pattern의 microstructure가 작동한다.

**원자료 (Kevin reference)**:
- `Document/Outputs/Report-Alteogen_196170_v3-Readable.md` (603 lines, v3.1 본문)
- `Document/Outputs/Report-Alteogen_196170_v3-Readable.html` (1383 lines, Bloomberg Light HTML)
- `Document/Outputs/Report-Samchundang_000250.md` (922 lines)
- `Document/Service/Report/ReportFramework-v3-DraftPhilosophy.md` (240 lines, 2-Layer 철학)
- `Document/Service/Report/ReportFramework-v3-NarrativeDesign.md` (319 lines, 5질문 서사 설계)
- `Document/Service/Report/ReportFramework-v3-Decisions.md` (197 lines)
- `Document/Service/Report/ReportFramework-v3-ValuationTrial.md` (291 lines, 시범본 실패 패턴 — 반면교사)
- `Document/Service/Report/ReaderAnalogyCards-ConstructionToBio.md` (386 lines, 비유 카드 50개)

---

## 2. 5질문 (Kevin v3.1 narrative axes)

`ReportFramework-v3-NarrativeDesign.md` §1 Q6 박제 = **5질문 구어체 노출 허용**. 200자 argument는 이 중 **1~2 axes에 답한다**:

| Axis | 구어 라벨 (BUY 기본) | SELL/HOLD 변주 | 답해야 할 것 |
|---|---|---|---|
| Q1 | "이 회사 뭐 하는데?" | — | 사업 모델 1문장 + 섹터 일상 비유 |
| Q2 | "왜 지금 주목?" | SELL: "왜 지금 조심?" / HOLD: "왜 지금 관망?" | 트리거·catalyst·우려 |
| Q3 | "얼마가 적정가인데?" | — | peer multiple / PSR / PER 비교 + 가정 노출 |
| Q4 | "뭐가 틀어지면 안 되나?" | — | invalidation 조건 (price·event·deadline) |
| Q5 | "살까 말까?" | — | BUY/HOLD/SELL + Half Kelly 포지션 (선택) |

**axes 5 ("살까 말까")는 response JSON의 `vote` 필드로 강제 표현**. argument_excerpt 200자에는 Q1~Q4 중 1~2개 답한다.

---

## 3. 8 Quality markers

| # | Marker | rubric instruction substring (CI 검증) | rationale |
|---|---|---|---|
| M1 | inquiry axes 명시 | `Q1:` `Q2:` `Q3:` `Q4:` | 4 axes label substring으로 verifier가 인지 |
| M2 | Financial cite instruction | `재무 데이터 직접 인용` | 환각 방지 1순위 — 숫자는 financials에서만 |
| M3 | No-fabrication rule | `근거 부족` | 재무 부재 시 "근거 부족" fallback (omxy R2 catch) |
| M4 | Peer comparison | `비교 가능한 회사` | Kevin v3.1 §4 "비교 가능한 회사 딱 1곳" 패턴 |
| M5 | Valuation trial | `추정 시` | "PSR 31배 ÷ peer median 10배, peer-수렴 추정 시 -67%" 등 가정 노출 |
| M6 | Judgment exposure | `BUY/HOLD/SELL` | response vote 강제 + argument에 근거 노출 |
| M7 | Korean beginner-friendly | `일상 비유` | "월세 100만원 건물 배수" 등 일상 비유 1순위 |
| M8 | 200자 argument cap | `200자 이내` | argument_excerpt LLM output cap (NOT system prompt cap) |

---

## 4. Persona individuality wrapper 원칙

**omxy R3 catch vi 박제 — rubric = wrapper, NOT replacement**:

- `corePrincipleText` (persona 고유 평가 원칙) = **선행 보존**
  - 예: Buffett = 해자(Moat)·이해도(Circle of Competence)·경영진·가격(Intrinsic Value)
  - 예: Lynch = 이해 가능성·PEG·생활 속 발견·재무 건전성
  - 예: Fisher = 15-Point 성장성·경영진 quality·R&D
- `KEVIN_V31_RUBRIC_INSTRUCTION` = **답변 방식 / 근거 품질 / 환각 방지 규칙 후단 적용**
- 테스트 = "기존 persona keyword 보존 + rubric markers 포함" **동시 검증**

---

## 5. 일상 비유 1순위 pool (M7 enforce 자료)

`NarrativeDesign §12.2` 박제 — 본문 1순위는 **일상 비유**, 2순위가 섹터 예시:

| 개념 | 1순위 (일상) | 2순위 (섹터 예시 병기 가능) |
|---|---|---|
| 로열티 | 카페 본사가 가맹점 매출의 5% / 넷플릭스 구독료 | 건설: 공법 라이선스 / IT: API 호출 과금 |
| 기술이전 | 프랜차이즈 가맹 계약 | 건설 공법 판매 / IT SDK 라이선스 |
| 마일스톤 | 집 매매 계약금·중도금·잔금 | 건설 기성금 / 영화 제작 투자금 트랜치 |
| 파이프라인 | 음식점 메뉴 개발 리스트 / 영화 라인업 | 건설 수주잔고 / IT 로드맵 |
| PSR | 월세 100만원 건물이 얼마에 팔리는가 배수 | — |
| 해자(Moat) | 스타벅스 브랜드·애플 생태계·원조 맛집 비법 | — |
| FDA 승인 | 식당 영업 허가증 / 건물 준공 허가 | — |
| 빅파마 | 글로벌 대형 프랜차이즈 본사 (맥도날드급) | — |
| 임상 1/2/3상 | 1차 시식회 → 시범 운영 → 정식 오픈 | 건설: 안전진단→정비구역→사업시행→관리처분 |
| 바이오시밀러 | 복제 우산 / 노브랜드 PB 상품 | — |
| 특허 절벽 | 독점 프랜차이즈 계약 만료 / 독점 방영권 종료 | — |
| 시나리오 분석 | 여행 날씨 플랜 A/B/C | — |
| 확률가중 TP | (대박 확률 × 대박 이익) + (보통 × 보통) + (실패 × 손실) | — |

---

## 6. 본문 금지 표현 (M7 + meta analysis 차단)

`DraftPhilosophy §4` 박제:

**메타 분석 용어 (본문 0건)**:
- `Peer 5축`, `Pure-play`, `Bridge 1/2/3`, `재분류`, `통계 요약`

**영어 약자 무해설 0건** (첫 등장 시 일상 비유 선행):
- `PSR`, `PER`, `WACC`, `DCF`, `LTM`, `NTM`, `OPM`, `EV/EBITDA`, `EWMA`, `CAGR`, `TP`

200자 argument는 cap 제약상 영어 약자를 절제 (1~2개 max). 그러나 etc 약자 등장 시 **일상 비유 선행** 또는 즉시 한글 풀이 병기.

---

## 7. Out of scope

- **Full Kevin excerpts prompt inject 금지** (omxy R1/R2 catch). v1 = `KEVIN_V31_RUBRIC_INSTRUCTION` 내부 짧은 예시 2~3개로 제한. Full 텍스트는 `docs/superpowers/snapshots/` curated fixture로만.
- **LLM judge CI gate 금지** (omxy R1 catch). CI는 structural deterministic markers만. semantic 검증은 curated 28 sample manual review.
- **Caching 의존 DoD 금지** (omxy R1/R2 catch). prompt caching은 cost optimization 후속 작업.
- **SECTOR_BASE_SLOT_ADJUSTMENTS 140 manual 확장 금지** (omxy R1 catch 2). 현재 56 high-risk slot (4/5/8/10) coverage 유지 + default base + sector philosophy + overlay templates로 충분.

---

## 8. Test plan (rationale; 실제 검증은 in-code test)

`tudal/src/lib/ai/prompts/__tests__/kevin-v31-rubric.test.ts`:
- `KEVIN_V31_INQUIRY_AXES`: exactly 4 axes, Q1~Q4 라벨
- `KEVIN_V31_QUALITY_MARKERS`: 8 keys M1~M8 정합성
- `KEVIN_V31_RUBRIC_INSTRUCTION`: 8 marker substring 모두 포함
- `applyKevinV31Rubric(core, sectorContext?)`: persona individuality wrapper (core가 rubric보다 선행) + sectorContext optional 처리

후속 207 persona 통합 검증은:
`tudal/src/lib/ai/prompts/__tests__/persona-rubric-coverage.test.ts` (Step 3b §4 layer (f) 완료 후 작성):
- Core 11 + sector 196 generation 각각 8 markers substring 검증
- Core 11 persona individuality keyword 보존 검증 (Buffett: 해자, Lynch: 이해 등)

---

## 9. Curated sample fixture (CI 외, manual review용)

`docs/superpowers/snapshots/2026-05-21-step3b-prompt-samples.md` (Step 3b 작성 완료 후 생성):
- 28 samples = 14 sectors × {high-risk base slot (4/5/8/10 중 1) + primary/sub_tag overlay 1}
- LLM judge 없이 사용자/팀 manual review용

---

## 10. Changelog

- 2026-05-21 (53차 §2 omxy R1~R3 CONVERGED): 초안 작성. 8 markers + persona individuality wrapper + 200자 = argument cap + OOS 4건 박제.
