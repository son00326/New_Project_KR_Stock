# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-14 (session 2 — P8 🅱+옵션X 확정)
**목적**: 다음 에이전트가 **이 파일만 읽고 작업을 이어받을 수 있도록** 시도/성공/실패/다음 단계를 누락 없이 기록한다.

> **⚡ 다음 세션 진입 안내 (2026-04-14 세션 말미 기록)**
> 사용자가 "@Document/HANDOFF.md 문서를 보고 이어서 작업해줘"라고 입력하면, 본 문서 **§"🚧 진행 중: ReportFramework v3 고도화"** 블록으로 바로 점프할 것. Planning/Build Task Tracker 경로가 아니라 **ReportFramework v3 작업이 현재 우선 컨텍스트**이다.

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
Active Work:  ReportFramework v3 고도화 (P1~P8 전면 확정)
Phase:        P1~P8 모두 확정 완료 / §4 시범본 작성·critic 검증 완료
Track:        Planning (Phase.md) Task 트래커와 별개 우선순위 작업
Block:        없음 — 다음 세션 D 루트(v3 문서 통합) 즉시 착수 가능
Uncertainty: 낮음 (모든 결정 확정, 남은 것은 통합 편집)
```

### ReportFramework v3 대기 작업 1줄 요약
P1~P8 확정사항 + §4 시범본 교훈(CRITICAL 3건 선결) 반영해 `Document/ReportFramework.md` v3.0으로 전면 개정 → 알테오젠 풀 보고서 v3 재작성 → critic 재검증.

---

## 🚧 진행 중: ReportFramework v3 고도화 (2026-04-14 세션 시작)

### 배경 (왜 이 작업을 하는가)
- v2.1 프레임워크에 critic(opus) 적대적 리뷰 결과 **CRITICAL 8건 + MAJOR 15+건** 발견
- 간판 원칙인 "위원 독립성"이 실제 Alteogen·Samchundang 보고서에서 체계적 위반 중 (MDD=기회 논거 3명 중복 등)
- 정량 판정 규칙 공백, 환각 검증 게이트 부재, Horizon 혼선, Track Record 인프라 부재
- 사용자가 **전면 개정(v3.0)** 방향 선택 → 세부 결정 진행
- 법적 리스크는 **비대상** (사용자 + 공동창업자 2인 내부 리뷰 + 매뉴얼 투자 전용)

### 공통 선결 결정 (C1~C4) — 모두 확정
| # | 결정 |
|---|---|
| C1 | 전면 개정(v3.0) 채택. v2.1 기본 구조 재편 OK |
| C2 | 기존 Alteogen·Samchundang 2건은 **메타데이터만 backfill** (본문 재작성 안 함). 실수 사례로 보존 |
| C3 | **Co-Chair 구조**: 사용자 + 공동창업자 2명. **모든 포지션 만장일치 서면 필수** |
| C4 | 보고서 분량 균형(1,200~1,500줄, 현재 +43%). 본문 400~500줄 + Appendix 800줄 분리 |

### P1. 정량 판정 규칙 — 확정
| # | 결정 |
|---|---|
| P1-1 | BUY/HOLD/SELL 임계치 = **섹터 변동성 조정** (고정 % 아님). `BUY ≥ +0.5σ 섹터 연변동성` |
| P1-2 | 시나리오 확률 = **하이브리드** (analyst 자동 초안 + 섹터보드 ±10%p 조정) |
| P1-3 | 리스크 매트릭스 = **3×3** (확률 H/M/L × 영향 H/M/L). H=-30%+, M=-10~-30%, L=-10% 미만 |
| P1-4 | **공식 TP = 확률가중 TP** 단일화. 단 모든 TP(평균/중앙/섹터/Core)는 **병기**. 10%+ 차이 시 자동 플래그 |
| P1-5 | 판정 결과 **YAML 구조화**: `{decision, conviction, win_probability, expected_return, volatility}` |

### P2. Position Sizing (Kelly 기반) — 확정
| # | 결정 |
|---|---|
| P2-1 | **Half Kelly** 공식 채택 |
| P2-2 | 종목 상한 (확신도 티어): 3.0↓=5% / 3.0~4.0=10% / 4.0~4.5=15% / 4.5↑=30% / (섹터+종목 모두 4.5+)=40% |
| P2-3 | 섹터 상한 (확신도 티어): 3.0↓=**10%** / 3.0~4.0=30% / 4.0~4.5=40% / 4.5↑=50% |
| P2-4 | **현금 최소 10%** |
| P2-5 | **모든 포지션 Co-Chair 만장일치 서면 필수** (비중 무관) |
| P2-6 | 변동성 = **EWMA(λ=0.94)** + 소형주(거래일 <500일) 섹터 평균 블렌드 60:40 |

### P3. 독립성 operationalization + 환각 게이트 — 확정
| # | 결정 |
|---|---|
| P3-1 | **공통 8개 태그**: `valuation / macro / catalyst / risk / governance / technical / comparative / thematic`. 섹터별 특화 태그 불채택 (유지보수 ROI 낮음) |
| P3-2 | "동일 논거 금지" = **중간 제약**: `argument_tag` 조합 + 주장 핵심 키워드 **둘 다** 중복 시 위반 |
| P3-3 | **`[1차/2차/추정]` 태그** — 투자 아이디어·주요 투자 결정 핵심 수치에 강제 (예: TP·PER·로열티율·딜밸류·경영진 지분·특허 만료일). 배경 수치(현재가·시총) 면제 |
| P3-4 | critic 게이트: **`[1차]` 태그 원문 대조율 ≥90%** 통과. 미달 시 writer 재작성 강제. WebFetch/DART API 활용 |

### P4. Invalidation + Horizon — 확정
| # | 결정 |
|---|---|
| P4-1 | Invalidation 3요소: **`{price_level, event, deadline}`** |
| P4-2 | **위원 전원 필수** (HOLD 포함 — 전환 조건 양방향 명시) |
| P4-3 | Horizon **3개** (단기 3M / 중기 12M / 중장기 36M) — 사용자 원래 "단기10/중기10/중장기10" 컨셉 일치 |
| P4-4 | **Core Committee 2/4/4 고정 10명 + Sector Board 3/4/3 슬롯**. Sector Board 인물은 **섹터마다 100% 교체** |

#### Core Committee 10명 최종 (전 섹터 공통·고정)
| Horizon | 인물 | 철학 |
|---|---|---|
| 단기 (2) | Druckenmiller, 홍춘욱 | 트렌드·기술적 매크로 / 한국 매크로 |
| 중기 (4) | Dalio, Marks, 이채원, 박현주 | 글로벌 매크로 / 역발상 / 한국 가치 / 한국 글로벌 |
| 중장기 (4) | Buffett, **Peter Lynch**, 강방천, 최윤식 | 장기 가치 / GARP / 한국 장기 / 미래 트렌드 |

> ⚠️ Cathie Wood 제외(사용자 철학 불일치) → **Peter Lynch(GARP·소비자 관점)** 로 대체.

#### Sector Board 3/4/3 슬롯 매핑 (인물은 섹터별 교체)
- 단기(3): 슬롯 3 국내 애널리스트 / 슬롯 6 글로벌 IB 애널 / 슬롯 9 헤지펀드
- 중기(4): 슬롯 4 섹터 특수 전문가 / 슬롯 5 학술 / 슬롯 7 글로벌 IB fundamental / 슬롯 10 인접 분야 (회의주의자 성향 선호)
- 중장기(3): 슬롯 1·2 국내 산업 내부자 / 슬롯 8 해외 전직 경영자

### P5. Track Record 인프라 — 확정
| # | 결정 |
|---|---|
| P5-1 | YAML frontmatter **중간안(약 20개 필드)**: 판정·TP·확률·Invalidation·Position Size·Committee 투표·Critic 검증 결과·위원별 개별 의견 포함 |
| P5-2 | 다차원 스코어 (100점): **방향 40 / TP 근접 30 / Invalidation 20 / Brier 10** |
| P5-3 | 반자동 **`/track-record` 슬래시 커맨드** (월 1회 사용자 실행) + `Document/TrackRecord.md` 저장 |
| P5-4 | 실패 자동 분석 (프레임워크 위반/외부 shock/논리 오류/데이터 오류) + 사용자 수동 개선 결정 |

### P6. Core Committee 사각지대 보완 — 확정
| # | 결정 |
|---|---|
| P6-1 | **🅴 Red Flag 자동 게이트 단독 채택** (가중 투표 F·F 병행 G 모두 철회) |
| P6-2 | Tier 1 (자동 SELL, Position 0%): 불성실공시법인 지정, 감사의견 거절·한정, 경영진 횡령·배임, 대주주 반대매매 임박 |
| P6-3 | Tier 2 (자동 HOLD 하향): 2년 공시 정정 ≥3회, 회계법인 교체+의견 불일치, IR 해명 번복, 단일 공시 시총 50%+ 급변 |
| P6-4 | Tier 3 (모니터링 배지): 대주주 지분 감소, CEO/CFO 사임 6개월 내 등 |
| P6-5 | 본문은 정상 작성, **판정·Position Size만 오버라이드**. 🚨 배너 Summary 상단 |
| P6-6 | Sector Board 슬롯 10 "회의주의자 성향 선호" **권고 문구만** 추가(강제 X) |

### P7. Sources 규격 + Summary TP drift — 확정
| # | 결정 |
|---|---|
| P7-1 | **Sources 6필드** 표준: 출처명 / 유형([1차/2차/추정]) / URL(또는 문서번호) / 접근일 / 인용 위치 / 신뢰도(H/M/L) |
| P7-2 | **[1차] 없는 중요 수치 사용 불가** (critic FAIL) |
| P7-3 | Summary TP drift는 P1-D1-4에서 해결 완료 (공식 TP 단일화 + 병기 + 플래그) |

### P8. 경쟁사 분석 (Peer Analysis) — ✅ **확정 (2026-04-14 옵션 X 채택)**

#### 최종 결정 (🅱 + 옵션 X: critic 권고 그대로 수용)
| 구분 | 채택 기법 | 적용 위치 |
|---|---|---|
| **MUST (6)** | ① Peer 5축 필터링 · ② Pure-play vs Secondary 분리 · ④ LTM+NTM+3Y Fwd 병기 · ⑦ 프리미엄/디스카운트 근거 단락 · ⑧ 사업모델 차이 해석 규칙(R1~R3) · Bridge 1 (양적 연결·75th %ile) | v3 §4 **본문 필수** |
| **SHOULD (3)** | ③ 통계 요약 (min/25%/median/75%/max) · ⑥ Moat Type(표 필드만) · Bridge 2 (Moat→WACC 질적 연결) | v3 §4 **본문 권장** |
| **NICE (2, 조건부 존속)** | ⑤ 기술력 정량화 (DART [1차] 치환 조건) · Bridge 3 (재분류 peer 5축 선정 근거 명시 조건) | v3 §4 **Appendix, 조건 충족 시만** |
| **DROP (2, 금지)** | ⑨ 5×5 경쟁력 스코어카드 · ⑩ 2×2 Strategic Group Map | v3 본문·Appendix **미포함** |

#### v3 §4 규격 (ReportFramework.md v3.0 박제 대상)
- 본문 분량 목표: **~120줄** (MUST 6 기반). SHOULD 3 포함 시 ~140줄
- 전체 보고서 예상: **~1,100~1,300줄** → C4(1,200~1,500) 달성 가능
- CRITICAL 수정 요구(시범본 발견, v3 문서 통합 시 선결):
  1. v2 PSR 3.1배 → **31.3배 정정 확정**. LTM PSR 130.6배는 [1차] 근거 없으면 [2차] 강등 의무
  2. Bridge 3 채택 시 재분류 peer (Royalty Pharma·Ionis 등) **선정 5축 필터 명시 의무** — 아니면 Bridge 3 제외
  3. Appendix 기술력 정량화 존치 시 특허 수·R&D 집약도 **DART [1차] 치환 의무** (P7-2 저촉 방지)

#### 시범본 산출물 (2026-04-14)
- `Document/Report-Alteogen_196170_v3-Section4-Trial.md` (약 250줄) — 10기법 전수 적용 샘플. v2 원본 §4 대체용 드롭인 구조. **보존**(empirical 근거 유지)
- v2 §4의 **PSR 계산 오류 (3.1배 → 31.3배)** 이 시범본에서 최초 발견. 결론 역전 ("Halozyme 대비 저평가" → "Halozyme 2.4× 프리미엄")

#### critic(opus) 적대적 평가 주요 발견
- 10기법 전수 채택 시 §4만 50→250줄 5.0× 팽창 → 전 섹션 보정 후 ~2,350줄, C4 대비 +57% 초과
- 기법 9 스코어카드: 가중치 자의성 + 점수 [추정] 태그 없음 → 환각 H
- 기법 10 2×2 Map: 축 정의 임의적 + 기법 2와 시각 중복
- Bridge 3: Royalty Pharma(IP 매입형)를 알테오젠(로열티 수취)과 섞은 근거 부재 → 순환 논증 위험

#### OMC 병렬 에이전트 리서치 결과 (보존·참고)
- **document-specialist (opus)**: 해외 IB(Morgan Stanley, Goldman, JPM, Halozyme 리포트) + 국내 증권사(한국투자·삼성·미래에셋) 실물 구조 분석. 10가지 기법 + 14개 섹터 지표 매트릭스 완성. 14섹터 매트릭스는 **v3 Appendix 또는 별도 참조 문서로 활용**.
- **analyst (opus)**: 요구사항 점검 모드로 동작 → 7 Missing Q + 5 Undefined Guardrail + 5 Scope Risk 식별.

#### 14 섹터 지표 매트릭스 처리 (옵션 X 하위 결정)
- v3 §4 본문에 **삽입하지 않음** (분량 타협)
- 별도 참조 문서 `Document/ReportFramework-SectorMetrics.md`로 분리 예정 (v3.0 통합 시)


#### 2026-04-14 세션에서 확정한 중간 방향
- Base Rate / Historical Analog **독립 섹션 신설 철회** (독자 피로도 높음)
- 대신 **Section 4(밸류에이션) 내 "현 시점 경쟁사 비교" 대폭 강화** 방향
- 비교 테이블에 **현재 + 미래 3Y(2028E) 양쪽 수치** 병기 필수 (PSR/PER 왜곡 방지)
- **사업모델 차이 해석 규칙** 필수 (로열티 vs 제품 PSR 왜곡 등)

#### 10가지 핵심 기법 + Bridge 3 Narrative (MUST/SHOULD/NICE/DROP 확정)
**출처**: document-specialist(opus)가 해외 IB(MS·GS·JPM·Halozyme) + 국내 증권사(한투·삼성·미래) 실물 리포트 분석으로 도출. 14 섹터 매트릭스는 별도 문서로 분리 예정.

#### 10가지 핵심 기법
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

#### Investment Thesis Bridge 3 Narrative (MUST/SHOULD/NICE 분류 확정)
1. **양적 연결** (75th percentile 논리) — **MUST**
2. **질적 연결** (Moat 서사 → WACC 1~2%p 차감) — **SHOULD**
3. **모델 재분류** (플랫폼/로열티 peer) — **NICE** (재분류 peer 5축 선정 기준 명시 조건)

### 남은 의사결정
- [x] ~~P8 경쟁사 분석 최종 방향 선택~~ → **🅱 + 옵션 X 확정 (2026-04-14)**
- [ ] v3 프레임워크 문서 통합 작성 (`Document/ReportFramework.md` 전면 개정) — **다음 세션 최우선**
- [ ] 시범 보고서 1건 v3 규격 (알테오젠 §4 시범 완료 → 나머지 섹션 확장 or 신규 종목)
- [ ] critic 재검증 (v3로도 critic 통과하는지)
- [ ] 14 섹터 매트릭스 별도 문서 분리 (`Document/ReportFramework-SectorMetrics.md`)
- [ ] 경쟁사 리서치 스킬/에이전트 전수 매칭도 정량 평가 (아래 별도 작업)

---

## 🧭 후순위 작업 (D-3 옵션) — 스킬/에이전트 매칭도 정량 평가
13 아이디어(10기법+Bridge 3) × 로컬 카탈로그 도구(Agent 19개 + Skill 50+ + 신규 플러그인 8개 세부 스킬 ~60개, 총 ~100개) 매칭 매트릭스 산출. 산출물: `Document/ReportFramework-Peer-Tool-Matching.md`.
**실행 절차**: Step 1 병렬(Explore thorough + analyst opus) → Step 2 analyst 통합 매트릭스 → Step 3 critic 검증 → Step 4 Top 5 갭 + 설치 ROI. **Uncertainty 중간** (매칭 스코어 주관성). v3 문서 통합(D-1) 이후로 보류 가능.

---

### 자동화 백테스트: ✅ v6.1 FINAL 확정 (파일 `backtest/full_system_backtest_v6.py`)
CAGR 20.3% · Sharpe 0.99 · Calmar 0.78 · Max DD -25.8%. 삼성전자 B&H 위험조정 beat. 상세 수치·시스템 구성·최적화 이력은 메모리(`project_backtest_v6_final.md`) 참조.

---

## ✅ 시도하여 성공한 것 (Succeeded)

### 2026-04-14 세션 산출물 — ReportFramework v3.0 기획 완료
- v2.1 critic(opus) 적대적 리뷰: CRITICAL 8건 + MAJOR 15건 → v3.0 전면 개정 착수 (법적 축 비대상)
- **C1~C4 + P1~P8 전면 확정** (상세는 §"🚧 진행 중: ReportFramework v3 고도화" 블록)
- **§4 v3 시범본 작성**: `Document/Report-Alteogen_196170_v3-Section4-Trial.md` (약 250줄). 10기법 + Bridge 3 전수 적용
- **v2 §4 PSR 계산 오류 발견·정정**: v2 "3.1배" → 실제 **31.3배** (1/10 타이포). 결론 역전 ("저평가" → "Halozyme 2.4× 프리미엄")
- **critic(opus) 적대적 평가 완료 → P8 🅱 + 옵션 X 확정**: MUST 6 / SHOULD 3 / NICE 2 조건부 / DROP 2
- **CRITICAL 수정 지침 3건 도출** (v3 문서 통합 시 선결): LTM PSR 출처, Bridge 3 peer 근거, Appendix 환각 치환
- **분량 예측**: MUST 기반 v3 본문 ~1,100~1,300줄 (C4 1,200~1,500 달성 가능)
- **플러그인 설치**: `pm-skills` + `superpowers-marketplace` 마켓플레이스 2개 + 플러그인 8개. v3 §4 직결: `pm-market-research:competitor-analysis`, `pm-product-strategy:competitive-landscape`, `superpowers:brainstorming`
- **메모리 저장**: `project_report_legal_scope.md` (법적 리스크 비대상 원칙)

### 이전 세션 산출물 (축적, 참조용 요약)
- **2026-04-12**: `BusinessPlan §8~§9 → 하위 4개 문서 동기화` / `CLAUDE.md` 루트 작성 / `PLAN.md` → `BusinessPlan.md` git mv / `Phase.md` Phase 0~6 확정 / **`BuildPhase.md` 신규 작성** (Stage B1~B6) / 하네스 4종 정의 / deepinit 위치 확정(B2.1) / ServicePlan §3 18 섹션 + §0 통합 트래커 구조화
- **2026-04-13**: **Manual 투자 트랙 설계 확정** (AI 전종목 스캔 → Short List 30개 / 업황 2단계 스크리닝 / 리포트 3-Tier / 어드민 전용 BUY만 / 월간 비용 ~49만원) → BusinessPlan §10 + ServicePlan §3.22 신설. **보고서 프레임워크 v2.0 작성** (`Document/ReportFramework.md`): 8-Section + Appendix, 쟁점별 찬반 토론, 위원 독립성, Core Committee 10인, Sector Board 14섹터. 알테오젠 HTML 변환.
- **백테스트 v6.1 FINAL** (2026-04-12): `backtest/full_system_backtest_v6.py`. 3축 분화 + Early Warning + 부분 리밸런싱. 세부 수치·최적화 이력은 메모리.
- **Base 스택**: Next.js 16.2.3 + React 19 + TS + Tailwind v4 + shadcn(base-nova), App Router `(auth)`/`(main)` 7 라우트, 종목 분석 4탭 + 매크로 16지표 + 차트, `tudal/src/lib/data/*` mock, Supabase SSR 미들웨어(env 미연결), '주픽' 리브랜딩 + KIPRIS 검증.
- **사업 기획 완료분**: Q1~Q11 확정 → BusinessPlan.md, Dual Trader 구조, 외부 투자 X, 과금 월 19,900원.

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

### 상시 경고 (Hard Constraints)
- **Next.js 16 학습 데이터 불일치**: `tudal/AGENTS.md`. 라우팅·미들웨어·메타데이터·서버 액션은 `tudal/node_modules/next/dist/docs/` 또는 context7 MCP 참조 의무.
- **테스트 러너 없음**: `cd tudal && npm run build && npm run lint`가 유일한 검증 게이트.
- **pricing 스캐폴드 legacy**: 3tier PLANS + `(main)/pricing` 라우트는 B3.1에서 제거 대상. 확장 금지.
- **"사세요/파세요" 금지**: AI 출력은 데이터·분석만. BusinessPlan §7.
- **500명 cap + 초대 전용**: 공개 가입·광고 금지.

---

## 🔴 다음 단계 (Next Steps)

### ⭐ STEP 0 (2026-04-14 이후 최우선) — ReportFramework v3 **D 루트(문서 통합)** 즉시 착수

사용자 진입 시 "@Document/HANDOFF.md 보고 이어서 작업해줘" 입력 예상.

**첫 행동 (순서대로)**:
1. 본 문서의 §"🚧 진행 중: ReportFramework v3 고도화" 블록 정독 — C1~C4·P1~P8 모두 확정 상태 확인 (P8은 🅱 + 옵션 X)
2. 사용자에게 D 루트 착수 확인 요청 (분기 선택지 없음 — P8까지 전부 확정됨). 추가 옵션:
   - **(D-1)** writer(opus)로 v3.0 전면 개정 바로 착수 (표준)
   - **(D-2)** 14 섹터 매트릭스 별도 문서 분리 먼저 (`ReportFramework-SectorMetrics.md`) 후 D-1
   - **(D-3)** 스킬 매칭도 정량 평가 먼저 (§"🧭 신규 작업" 블록, 후순위 가능)

**D 루트 세부 (v3 문서 통합 실행 프로토콜)**:
- `writer(opus)` 에이전트 호출 → `Document/ReportFramework.md` v3.0 전면 개정
- 입력 컨텍스트:
  1. 본 HANDOFF §"🚧 진행 중" 블록 전체 (C1~C4·P1~P8 확정안)
  2. §4 시범본 `Document/Report-Alteogen_196170_v3-Section4-Trial.md` (MUST/SHOULD 기법 적용 예시)
  3. critic 발견 CRITICAL 3건 **선결 수정 지침**:
     - v2 PSR 정정 시 LTM PSR [1차] 출처 없으면 [2차] 강등
     - Bridge 3 채택 시 재분류 peer 5축 필터 필수 명시
     - Appendix 기술력 정량화 [1차] 치환 의무
  4. MUST 6 / SHOULD 3 / NICE 2 조건부 / DROP 2 금지 분류표
- 산출 후 `critic(opus)`로 적대적 재검증 (v2.1 6축 + 신규 3축: 정량 규칙 일관성·Red Flag 스캔·YAML 무결성)
- 합격 시 v3.0 확정, 실패 시 차이점 기록 후 재작성

### STEP 1 — 알테오젠 풀 보고서 v3 재작성 (D 루트 완료 후)
시범 §4만 있는 현 상태를 전 섹션으로 확장. `document-specialist + analyst` 병렬 리서치 → `writer(opus)` 통합 → `critic(opus)` 재검증. 기존 v2 보존, 신규 `Report-Alteogen_196170_v3.md`. 동시에 Samchundang(000250) v3 backfill(C2 원칙, 메타데이터만).

### STEP 2 — Track Record 인프라 초기화
`Document/TrackRecord.md` 스켈레톤 + `/track-record` 커맨드(analyst 기반) + 기존 2건 YAML frontmatter backfill.

### STEP 3 — critic 체크리스트 박제
기존 6축(팩트·논리·누락·구조·편향·독자수준) + 신규 3축(정량 규칙 일관성·Red Flag 스캔·YAML 무결성) → `Document/ReportFramework.md` §"비판 체크리스트"에 박제.

---

### 📦 Planning + Build Phase 후속 작업 (v3 완료 후 재개)

ReportFramework v3 확정 후 재개할 대기 작업 포인터. **상세 에이전트·스킬 매핑은 `Document/Phase.md` / `Document/BuildPhase.md`에 박제되어 있으므로 중복 기록 불요**.

- **Planning Phase**: ServicePlan §0 통합 트래커의 첫 미완료 체크박스(Task 0.1 `superpowers:brainstorming` — 독자/깊이/목차/톤 4합의 → Task 0.3 게이팅 → Phase 1 병렬 7 에이전트 디스패치 → Phase 2~5 → Phase 6 FRD+Scenarios)
- **Build Phase**: Planning Phase 5 v1.0 확정 후 진입. B1(디자인)+B2(Pre-impl) 병렬 → B3 구현 → B4 5축 QA → B5 Ship → B6 iteration
- **Track Record 인프라 초기화** (ReportFramework v3 완료 직후 권장): `Document/TrackRecord.md` 스켈레톤 + `/track-record` 커맨드 + 기존 2건(알테오젠·삼천당) YAML backfill

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
