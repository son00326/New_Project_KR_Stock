# ReportFramework v3.0 — 확정 결정 박제 (Decisions)

> **[v3.0 확정 전 중간 산출물. v3.0 확정 시 본 문서는 아카이브 예정]**

Last updated: 2026-04-14 (session 2 — P8 🅱+옵션X 확정)
**용도**: ReportFramework v3.0 전면 개정을 위한 **공통 선결(C1~C4) + 세부 결정(P1~P8)** 확정 사항의 단일 레지스트리. `Document/Service/Report/ReportFramework.md` v3.0 전면 개정 시 이 문서가 **입력 컨텍스트**.

**출처**: 2026-04-14 세션(session 2)에서 사용자·critic(opus) 공동 합의. v2.1 critic 적대적 리뷰(CRITICAL 8 + MAJOR 15+) 결과 반영.

---

## 배경 (왜 v3.0 전면 개정인가)
- v2.1 프레임워크에 critic(opus) 적대적 리뷰 결과 **CRITICAL 8건 + MAJOR 15+건** 발견
- 간판 원칙 "위원 독립성"이 Alteogen·Samchundang 보고서에서 체계적 위반 (MDD=기회 논거 3명 중복 등)
- 정량 판정 규칙 공백, 환각 검증 게이트 부재, Horizon 혼선, Track Record 인프라 부재
- **전면 개정(v3.0)** 방향 확정 (사용자 결정)
- 법적 리스크는 **비대상** (사용자 + 공동창업자 2인 내부 리뷰 + 매뉴얼 투자 전용)

---

## 공통 선결 결정 (C1~C4)

| # | 결정 |
|---|---|
| C1 | 전면 개정(v3.0) 채택. v2.1 기본 구조 재편 OK |
| C2 | 기존 Alteogen·Samchundang 2건은 **메타데이터만 backfill** (본문 재작성 안 함). 실수 사례로 보존 |
| C3 | **Co-Chair 구조**: 사용자 + 공동창업자 2명. **모든 포지션 만장일치 서면 필수** |
| C4 | 보고서 분량 균형(1,200~1,500줄, 현재 +43%). 본문 400~500줄 + Appendix 800줄 분리 |

---

## P1. 정량 판정 규칙

| # | 결정 |
|---|---|
| P1-1 | BUY/HOLD/SELL 임계치 = **섹터 변동성 조정** (고정 % 아님). `BUY ≥ +0.5σ 섹터 연변동성` |
| P1-2 | 시나리오 확률 = **하이브리드** (analyst 자동 초안 + 섹터보드 ±10%p 조정) |
| P1-3 | 리스크 매트릭스 = **3×3** (확률 H/M/L × 영향 H/M/L). H=-30%+, M=-10~-30%, L=-10% 미만 |
| P1-4 | **공식 TP = 확률가중 TP** 단일화. 단 모든 TP(평균/중앙/섹터/Core)는 **병기**. 10%+ 차이 시 자동 플래그 |
| P1-5 | 판정 결과 **YAML 구조화**: `{decision, conviction, win_probability, expected_return, volatility}` |

---

## P2. Position Sizing (Kelly 기반)

| # | 결정 |
|---|---|
| P2-1 | **Half Kelly** 공식 채택 |
| P2-2 | 종목 상한 (확신도 티어): 3.0↓=5% / 3.0~4.0=10% / 4.0~4.5=15% / 4.5↑=30% / (섹터+종목 모두 4.5+)=40% |
| P2-3 | 섹터 상한 (확신도 티어): 3.0↓=**10%** / 3.0~4.0=30% / 4.0~4.5=40% / 4.5↑=50% |
| P2-4 | **현금 최소 10%** |
| P2-5 | **모든 포지션 Co-Chair 만장일치 서면 필수** (비중 무관) |
| P2-6 | 변동성 = **EWMA(λ=0.94)** + 소형주(거래일 <500일) 섹터 평균 블렌드 60:40 |

---

## P3. 독립성 operationalization + 환각 게이트

| # | 결정 |
|---|---|
| P3-1 | **공통 8개 태그**: `valuation / macro / catalyst / risk / governance / technical / comparative / thematic`. 섹터별 특화 태그 불채택 (유지보수 ROI 낮음) |
| P3-2 | "동일 논거 금지" = **중간 제약**: `argument_tag` 조합 + 주장 핵심 키워드 **둘 다** 중복 시 위반 |
| P3-3 | **`[1차/2차/추정]` 태그** — 투자 아이디어·주요 투자 결정 핵심 수치에 강제 (예: TP·PER·로열티율·딜밸류·경영진 지분·특허 만료일). 배경 수치(현재가·시총) 면제 |
| P3-4 | critic 게이트: **`[1차]` 태그 원문 대조율 ≥90%** 통과. 미달 시 writer 재작성 강제. WebFetch/DART API 활용 |

---

## P4. Invalidation + Horizon

| # | 결정 |
|---|---|
| P4-1 | Invalidation 3요소: **`{price_level, event, deadline}`** |
| P4-2 | **위원 전원 필수** (HOLD 포함 — 전환 조건 양방향 명시) |
| P4-3 | Horizon **3개** (단기 3M / 중기 12M / 중장기 36M) — 사용자 원래 "단기10/중기10/중장기10" 컨셉 일치 |
| P4-4 | **Core Committee 2/4/4 고정 10명 + Sector Board 3/4/3 슬롯**. Sector Board 인물은 **섹터마다 100% 교체** |

### Core Committee 10명 최종 (전 섹터 공통·고정)
| Horizon | 인물 | 철학 |
|---|---|---|
| 단기 (2) | Druckenmiller, 홍춘욱 | 트렌드·기술적 매크로 / 한국 매크로 |
| 중기 (4) | Dalio, Marks, 이채원, 박현주 | 글로벌 매크로 / 역발상 / 한국 가치 / 한국 글로벌 |
| 중장기 (4) | Buffett, **Peter Lynch**, 강방천, 최윤식 | 장기 가치 / GARP / 한국 장기 / 미래 트렌드 |

> ⚠️ Cathie Wood 제외(사용자 철학 불일치) → **Peter Lynch(GARP·소비자 관점)** 로 대체.

### Sector Board 3/4/3 슬롯 매핑 (인물은 섹터별 교체)
- 단기(3): 슬롯 3 국내 애널리스트 / 슬롯 6 글로벌 IB 애널 / 슬롯 9 헤지펀드
- 중기(4): 슬롯 4 섹터 특수 전문가 / 슬롯 5 학술 / 슬롯 7 글로벌 IB fundamental / 슬롯 10 인접 분야 (회의주의자 성향 선호)
- 중장기(3): 슬롯 1·2 국내 산업 내부자 / 슬롯 8 해외 전직 경영자

---

## P5. Track Record 인프라

| # | 결정 |
|---|---|
| P5-1 | YAML frontmatter **중간안(약 20개 필드)**: 판정·TP·확률·Invalidation·Position Size·Committee 투표·Critic 검증 결과·위원별 개별 의견 포함 |
| P5-2 | 다차원 스코어 (100점): **방향 40 / TP 근접 30 / Invalidation 20 / Brier 10** |
| P5-3 | 반자동 **`/track-record` 슬래시 커맨드** (월 1회 사용자 실행) + `Document/TrackRecord.md` 저장 |
| P5-4 | 실패 자동 분석 (프레임워크 위반/외부 shock/논리 오류/데이터 오류) + 사용자 수동 개선 결정 |

---

## P6. Core Committee 사각지대 보완 (Red Flag 게이트)

| # | 결정 |
|---|---|
| P6-1 | **🅴 Red Flag 자동 게이트 단독 채택** (가중 투표 F·F 병행 G 모두 철회) |
| P6-2 | Tier 1 (자동 SELL, Position 0%): 불성실공시법인 지정, 감사의견 거절·한정, 경영진 횡령·배임, 대주주 반대매매 임박 |
| P6-3 | Tier 2 (자동 HOLD 하향): 2년 공시 정정 ≥3회, 회계법인 교체+의견 불일치, IR 해명 번복, 단일 공시 시총 50%+ 급변 |
| P6-4 | Tier 3 (모니터링 배지): 대주주 지분 감소, CEO/CFO 사임 6개월 내 등 |
| P6-5 | 본문은 정상 작성, **판정·Position Size만 오버라이드**. 🚨 배너 Summary 상단 |
| P6-6 | Sector Board 슬롯 10 "회의주의자 성향 선호" **권고 문구만** 추가(강제 X) |

---

## P7. Sources 규격 + Summary TP drift

| # | 결정 |
|---|---|
| P7-1 | **Sources 6필드** 표준: 출처명 / 유형([1차/2차/추정]) / URL(또는 문서번호) / 접근일 / 인용 위치 / 신뢰도(H/M/L) |
| P7-2 | **[1차] 없는 중요 수치 사용 불가** (critic FAIL) |
| P7-3 | Summary TP drift는 P1-4에서 해결 완료 (공식 TP 단일화 + 병기 + 플래그) |

---

## P8. 경쟁사 분석 (Peer Analysis) — 🅱 + 옵션 X 채택

### 최종 결정 (critic 권고 그대로 수용)
| 구분 | 채택 기법 | 적용 위치 |
|---|---|---|
| **MUST (6)** | ① Peer 5축 필터링 · ② Pure-play vs Secondary 분리 · ④ LTM+NTM+3Y Fwd 병기 · ⑦ 프리미엄/디스카운트 근거 단락 · ⑧ 사업모델 차이 해석 규칙(R1~R3) · Bridge 1 (양적 연결·75th %ile) | v3 §4 **본문 필수** |
| **SHOULD (3)** | ③ 통계 요약 (min/25%/median/75%/max) · ⑥ Moat Type(표 필드만) · Bridge 2 (Moat→WACC 질적 연결) | v3 §4 **본문 권장** |
| **NICE (2, 조건부 존속)** | ⑤ 기술력 정량화 (DART [1차] 치환 조건) · Bridge 3 (재분류 peer 5축 선정 근거 명시 조건) | v3 §4 **Appendix, 조건 충족 시만** |
| **DROP (2, 금지)** | ⑨ 5×5 경쟁력 스코어카드 · ⑩ 2×2 Strategic Group Map | v3 본문·Appendix **미포함** |

### v3 §4 규격 (ReportFramework.md v3.0 박제 대상)
- 본문 분량 목표: **~120줄** (MUST 6 기반). SHOULD 3 포함 시 ~140줄
- 전체 보고서 예상: **~1,100~1,300줄** → C4(1,200~1,500) 달성 가능

### CRITICAL 수정 요구 (시범본 발견, v3 문서 통합 시 선결)
1. v2 PSR 3.1배 → **31.3배 정정 확정**. LTM PSR 130.6배는 [1차] 근거 없으면 [2차] 강등 의무
2. Bridge 3 채택 시 재분류 peer (Royalty Pharma·Ionis 등) **선정 5축 필터 명시 의무** — 아니면 Bridge 3 제외
3. Appendix 기술력 정량화 존치 시 특허 수·R&D 집약도 **DART [1차] 치환 의무** (P7-2 저촉 방지)

### 10가지 핵심 기법 (MUST/SHOULD/NICE/DROP 확정)
**출처**: document-specialist(opus)가 해외 IB(MS·GS·JPM·Halozyme) + 국내 증권사(한투·삼성·미래) 실물 리포트 분석으로 도출.

1. Peer 선정 5축 필터링 — **MUST**
2. Pure-play vs Secondary Comp 분리 — **MUST**
3. 통계 요약 행 (min/25%/median/75%/max) — **SHOULD**
4. LTM + NTM + **3Y Fwd** 병행 제시 — **MUST** (3Y 추가)
5. 기술력 정량화 3개+ — **NICE** (DART [1차] 치환 조건)
6. Moat Type 명시 (표 필드만) — **SHOULD**
7. 프리미엄/디스카운트 근거 단락 필수화 — **MUST**
8. 사업모델 차이 해석 규칙 (R1 매출 인식 / R2 OPM 보정 / R3 Duration 차이) — **MUST** (핵심)
9. 경쟁력 스코어카드 5×5 — **DROP** (환각 H, 중복)
10. 2×2 Strategic Group Map — **DROP** (축 임의, 중복)

### Investment Thesis Bridge 3 Narrative
1. **양적 연결** (75th percentile 논리) — **MUST**
2. **질적 연결** (Moat 서사 → WACC 1~2%p 차감) — **SHOULD**
3. **모델 재분류** (플랫폼/로열티 peer) — **NICE** (재분류 peer 5축 선정 기준 명시 조건)

### 14 섹터 지표 매트릭스 처리 (옵션 X 하위 결정)
- v3 §4 본문에 **삽입하지 않음** (분량 타협)
- 별도 참조 문서 `Document/Service/Report/ReportFramework-SectorMetrics.md`로 분리 예정 (v3.0 통합 시)

### 2026-04-14 세션 중간 방향
- Base Rate / Historical Analog **독립 섹션 신설 철회** (독자 피로도 높음)
- 대신 **Section 4(밸류에이션) 내 "현 시점 경쟁사 비교" 대폭 강화** 방향
- 비교 테이블에 **현재 + 미래 3Y(2028E) 양쪽 수치** 병기 필수 (PSR/PER 왜곡 방지)
- **사업모델 차이 해석 규칙** 필수 (로열티 vs 제품 PSR 왜곡 등)

### critic(opus) 적대적 평가 주요 발견 (DROP 2건 근거)
- 10기법 전수 채택 시 §4만 50→250줄 5.0× 팽창 → 전 섹션 보정 후 ~2,350줄, C4 대비 +57% 초과
- 기법 9 스코어카드: 가중치 자의성 + 점수 [추정] 태그 없음 → 환각 H
- 기법 10 2×2 Map: 축 정의 임의적 + 기법 2와 시각 중복
- Bridge 3: Royalty Pharma(IP 매입형)를 알테오젠(로열티 수취)과 섞은 근거 부재 → 순환 논증 위험

### OMC 병렬 에이전트 리서치 결과 (보존·참고)
- **document-specialist (opus)**: 해외 IB(Morgan Stanley, Goldman, JPM, Halozyme 리포트) + 국내 증권사(한국투자·삼성·미래에셋) 실물 구조 분석. 10가지 기법 + 14개 섹터 지표 매트릭스 완성. 14섹터 매트릭스는 **v3 Appendix 또는 별도 참조 문서로 활용**.
- **analyst (opus)**: 요구사항 점검 모드로 동작 → 7 Missing Q + 5 Undefined Guardrail + 5 Scope Risk 식별.

### 시범본 산출물 (2026-04-14)
- `Document/Service/Report/ReportFramework-v3-ValuationTrial.md` (약 250줄) — 10기법 전수 적용 샘플. v2 원본 §4 대체용 드롭인 구조. **보존**(empirical 근거 유지)
- v2 §4의 **PSR 계산 오류 (3.1배 → 31.3배)** 이 시범본에서 최초 발견. 결론 역전 ("Halozyme 대비 저평가" → "Halozyme 2.4× 프리미엄")

---

## 남은 작업 (v3.0 통합 시)

- [ ] v3 프레임워크 문서 통합 작성 (`Document/Service/Report/ReportFramework.md` 전면 개정) — **최우선**
- [ ] 알테오젠 풀 보고서 v3 재작성 (§4 시범 완료 → 전 섹션 확장)
- [ ] critic 재검증 (v3 적대적 리뷰 통과)
- [ ] 14 섹터 매트릭스 별도 문서 분리 (`ReportFramework-SectorMetrics.md`)
- [ ] 경쟁사 리서치 스킬/에이전트 전수 매칭도 정량 평가 (후순위 — `ReportFramework-Peer-Tool-Matching.md`)
