# 출시 전 UX/UI 정리 — 최종 제안 (2026-07-01)

> **상태**: ✅ **MERGED + DEPLOYED (2026-07-01, USER 승인 후) — main `6b3a501`, Vercel prod live·카나리 4/4.** GLM 5.2 primary 활성(Vercel `OPENROUTER_API_KEY` 주입 + 실 검증 통과). 4-스텝 프로세스 CONVERGED(§10) + 디자인 QA(§10 debt 6). 설계 합의는 OMXY(Codex gpt-5.5 xhigh) 2회 토론 CONVERGED. **잔여 = eval-harness 지속 품질 검증 + 라이브 admin 디자인 육안(로그인 필요) + 디자인 폴리시 debt.**
> **원칙**: 심플·쉬움·사용자 편의. 리팩터링/재설계 아님 = "정리 + 심화 폴리시". 신규 top-level 기능 최소.
> **대상**: 어드민 3인(본인+친구 2명, 비전문가) 내부 투자 도구. 곧 출시("AI 추천 + 가상 포트 + 알림", 자동매매 제외).
> **실행 규율(USER 지시)**: 모든 작업은 **부합하는 스킬/에이전트**로 수행(§4 스킬 실행 맵). 디자인은 디자인 스킬로.

---

## 0. 확정된 결정 (USER 지시 + OMXY 합의)

| # | 결정 | 상태 |
|---|---|---|
| 항목1 | Claude/Anthropic → **GLM 5.2(OpenRouter) primary + Claude fallback 유지**. GPT는 그대로. | USER 확정 |
| 항목2 | 메뉴 전면 한글화. **단 `Track Record`·`Decision Tree`는 영어 유지**. 내부코드 `(M17)/(M18)/(G1)` 제거. | USER 확정 |
| 항목3 | 홈을 **"아이디어 A" 대시보드**로: 상단 "현재 운영 중"(보유+비중+수익률) / 하단 "이번 달 추천 30"(+보유 뱃지). 포트폴리오 중복 30 제거. | USER 확정 |
| 항목4 | "섹터 비교"는 **삭제 아님, 봐야 함** → 위치·워딩 정리(매일 보는 것 vs 가끔 만지는 것 분리). **+ 신규 "추천 30 섹터 분포"** 추가(위치=OMXY 합의). | USER 확정 + OMXY |
| 추가 | 전체 컴포넌트·색상·레이아웃·폰트를 **토스 스타일로 디테일 업그레이드**(D34 위 심화 폴리시). | USER 확정 |

---

## 1. 관통 원칙 (OMXY 합의)

앱에 **(P) 제품 화면**(비전문가 일상: 홈·포트폴리오·성과·리포트·알림)과 **(R) 내부 R&D·운영 화면**(선정 방식 실험·AI 학습 실험·설정군)이 **같은 무게로 섞임**. 정리 = ① **사이드바 3구역**으로 위계 분리 + ② **제품 화면 은어 0** + ③ **D34 위 토스 심화 폴리시**(재설계 아님).

---

## 2. 워크스트림별 최종안

### 2.1 항목1 — GLM 5.2 (OpenRouter) primary + Claude fallback

- 기본 AI = GLM 5.2(OpenRouter), Anthropic 경로는 **fallback으로 유지**(`OPENROUTER_API_KEY` 부재/지원 provider 미가용 시 `ANTHROPIC_API_KEY`가 구성돼 있으면 Claude fallback, 둘 다 부재하면 fail-closed; 일부 JSON 역할은 provider 호출 실패 시 fallback). GPT/OpenAI 경로 불변. **스키마/품질 불합격을 자동 성공으로 간주하지 않음**(eval-harness 게이트).
- 최소 변경: `anthropic-pricing.ts`(`AiProviderId`에 `"openrouter"` + `MODEL_PRICING`에 `glm-5.2` 등록, fail-closed 통과 필수) · **신규** `openrouter-provider.ts`(openai SDK + `baseURL=openrouter.ai/api/v1` + `client.chat.completions.create`, usage 정규화) · `model-registry.ts`(provider 선택 삼항 2곳→맵, 역할 재바인딩, GLM=primary·Claude=fallback) · **주요 AI 호출/게이트를 provider-agnostic 헬퍼로 통일** · `glm-5.2` 단가 등록 후 **비용 projection 보수 산정**(프롬프트 캐시 소멸 반영, 실 비용 확정은 청구서/eval 후).
- **가드레일(OMXY)**: launch blocker로 취급하되 **OpenRouter 키/모델 slug/pricing/응답 계약 확인 전 "go-live 완료" 표현 금지**. 코드 배선은 완료됐지만 prod 활성은 USER 키·eval-harness 후. GLM 출력 스키마 준수는 **`eval-harness`로 별도 품질 검증**(D28 목적함수).
- Effort: M. 코드 배선은 완료. prod 활성·품질검증은 USER 키/eval-harness 후.

### 2.2 항목2 — 메뉴 전면 한글화

- 사이드바 `ADMIN_NAV`(`layout.tsx`) + 대응 h1만 변경. URL slug/value/id 불변. **§6 매핑표**.
- `Reflection Lab (G1) → AI 학습 (실험)` · `AI 비용 (M17) → AI 비용` · `Health (M18) → 시스템 상태` · `섹터 추천 비교 → 종목 선정 방식 비교 (실험)`(항목4). 종목 탭 `Fundamental 분석 → 기본적 분석` · `Technical 분석 → 기술적 분석`. 리포트 `Appendix → 부록`.
- **`Track Record`·`Decision Tree`는 영어 유지**(USER). 내부코드 `(G1)/(M17)/(M18)` 제거.
- Effort: S. 라벨 assert 테스트 동반 갱신.

### 2.3 항목3 — 홈 "아이디어 A" 대시보드 + 포트폴리오 운영 뷰

- **홈**:
  - **섹션 1 "현재 운영 중"** — 실제 보유 종목 + 비중 + 현금 + 이번 달 수익률(`getCurrentHoldings()`/`portfolio_snapshot`). **"기준월: 2026-06" 표기 필수**(stale 오해 방지, OMXY). '현재 운영 중' 카드는 **헤더/카드 스타일을 아래 추천과 분명히 분리**.
  - **섹션 2 "이번 달 추천 30"**(단/중/장) — 보유 중인 종목엔 **"보유 중" 뱃지**(평이한 말; `accepted`/`active`/`portfolio` 등 내부 상태어 노출 금지, OMXY). 이 섹션 안에 **"추천 30 섹터 분포"**(§2.4).
- **포트폴리오** = "확정 운영 포트폴리오" 상세(보유·비중·현금·수익률 추이·Accept 액션) + 기준월 표기. **하단 중복 30-`BucketSection` 제거**. Accept 전 월 = "아직 운영 포트 확정 전" + 접힌 후보 요약(30 전체 재노출 금지).
- "추천 후보"와 "확정 운영 포트"를 **절대 같은 위계로 병렬 노출 금지**(OMXY 핵심 가드레일).
- Effort: M(신규 대시보드 UI + 데이터 소스 전환).

### 2.4 항목4 — 섹터 비교 relocate/reword + 신규 "추천 30 섹터 분포"

- **(a) 기존 "섹터 추천 비교"(선정 방식 A/B 실험)**: 삭제·완전숨김 아님. **사이드바 "실험·연구" 그룹으로 relocate**(홈/포트폴리오와 동급 노출 해제) + **리네임 "종목 선정 방식 비교 (실험)"** + 평이 설명 **"AI 추천 30과 섹터 가중 후보 30의 결과를 비교하는 참고 실험입니다."** 페이지 재설계 없음(라벨/설명/위치만). `B++`/`Tier`/`shadow`/`마이그번호`/`periodKey` 등 은어는 제품 표면에서 제거(§7).
- **(b) 신규 "추천 30 섹터 분포"**(OMXY 합의 위치): **top-level 메뉴 만들지 않음**. 홈 "이번 달 추천 30" 섹션 안에 **compact 1줄**. 라벨 **반드시 "추천 30 섹터 분포"** 고정(보유 섹터 분포로 오해 방지) + **상위 5개 + 기타**만. 예: `추천 30 섹터 분포: 반도체 8 · 방산 5 · 바이오 4 · 2차전지 3 · 금융 2 · 기타 8`. 상세는 신규 페이지가 아니라 **추천 리스트 "섹터별 보기" 토글**만(최소).
- 데이터: `short_list_30` 각 행의 `sector` 태그 이미 존재(신규 파이프라인 불필요).
- Effort: S~M.

### 2.5 IA — 사이드바 3구역 (OMXY 합의)

구조 정리까지만(페이지 재설계·토큰·신규 컴포넌트 확장 금지, OMXY 가드레일).

| 그룹 | 항목 | 성격 |
|---|---|---|
| **메인** (자주) | 홈 · 포트폴리오 · Track Record · Decision Tree · 알림 | 매일 보는 제품·성과 화면 |
| **실험·연구** (가끔) | 종목 선정 방식 비교 (실험) · AI 학습 (실험) | 접근 가능하되 기본 동선 아님 |
| **설정** | 알림 채널 · AI 비용 · 시스템 상태 · 증권사 키 · 거래소 키 | 운영 설정 |

- **실험·연구**: 두 화면 모두 "(실험)" 톤 일관 적용(한쪽만 평이화 금지, OMXY).
- **Decision Tree**: 실험 아니라 **운영 성과 분석** → 메인(성과)에 유지하되 설명에서 "운영 결과를 확인하는 분석 화면"임을 명시(OMXY). 라벨은 영어 유지(USER).
- 증권사/거래소 키(S8 출시 후 전용)는 "설정" 하위(원하면 접힘). 리포트 발견성: 종목 카드 "리포트 보기"를 더 눈에 띄게.

### 2.6 (신규) 토스 심화 디자인 폴리시

- **재설계·재시스템 아님**(OMXY). D34 토스 시스템 위에 얹는 **출시 전 디테일 패스**.
- 착수 전 **1페이지 "토스 심화 폴리시"** 확정: 여백·카드 밀도·숫자 강조·색상 의미(빨강↑/파랑↓·상태색)·버튼/뱃지 톤·표/리스트 규칙·모션.
- 변경 컴포넌트(IA·홈·포트폴리오·섹터 분포)에 우선 적용 → 마지막 **전역 어긋남만** `/gstack-design-review`로 폴리시. **폰트/토큰/컴포넌트 체계 재작업 금지**(OMXY).
- Effort: S(폴리시 1p) + M(적용·폴리시 패스).

---

## 3. OMXY 토론 결과 (2회 CONVERGED)

- **DEBATE-1 (Round 2 CONVERGED)**: 문서화-우선 + 최소 launch-critical 프레임. 제품/내부 화면 분리 원칙. 가드레일 4(IA=구조 정리까지만 / 메뉴=단일 매핑표 / 추천≠확정 위계 분리 / 포트폴리오 기준월 표기). ⚠️ omxy가 항목4를 '법적 고지'로 치환한 scope drift는 Round 2에서 정정(면책은 기존 Footer로 커버).
- **DEBATE-2 (Round 2 CONVERGED)**: 섹터 분포=홈 "추천 30 섹터 분포" 1줄(top5+기타) · 섹터비교=**사이드바 3구역** "실험·연구"로 relocate+reword · 디자인=1페이지 폴리시로 축소(재작업 금지) · GLM=키/slug/schema 확인 전 완료 금지 · 보유 뱃지 내부 상태어 금지 · Decision Tree는 운영 분석으로 성격 명시.

---

## 4. 스킬 / 에이전트 실행 맵 (USER 지시 — 워크스트림별)

> 스킬 라우팅 = `~/.claude/skill-routing.md` 기준. **참고**: `grill-me`는 별도 설치 스킬이 아님(레지스트리상 "recommended-default 규칙"으로 흡수) → 압박·적대 검토는 **OMXY `/debate-omx` + `superpowers:brainstorming`(stress-test)**로 대체.

| 워크스트림 | 설계/탐색 | 구현 | 검증 |
|---|---|---|---|
| 항목1 GLM | `context7`(OpenRouter/openai SDK 계약) + `superpowers:brainstorming` | `superpowers:test-driven-development` + `vercel:ai-sdk`(참고) | **`eval-harness`(GLM 스키마 준수/출력 품질)** + `/gstack-review` + build/lint/test:ci/tsc |
| 항목2 메뉴 | 매핑표(§6) | `superpowers:test-driven-development`(라벨 assert) | `/gstack-review` + `/gstack-browse`(육안) |
| 항목3 홈/포트 | `superpowers:brainstorming`(대시보드 A 확정됨) | `/gstack-design-html`(신규 대시보드 UI) + TDD(데이터 로직) | `/gstack-design-review` + `/gstack-browse` |
| 항목4 섹터 | `/debate-omx`(위치 합의 ✅) | `/gstack-design-html`(섹터 분포 칩) + 라벨/relocate 편집 | `/gstack-design-review` |
| IA 3구역 | 본 문서 | `layout.tsx` `ADMIN_NAV` 구조화(프레젠테이션) | `/gstack-review`(nav 테스트) + `/gstack-browse` |
| 디자인 폴리시 | **`/gstack-design-consultation`(1p 폴리시로 스코프)** | 변경 컴포넌트 적용 | **`/gstack-design-review`(전역 어긋남 최종)** |
| 공통(오케스트레이션·리뷰) | **Workflow tool**(ultracode 병렬 조사/리뷰) · `/debate-omx`(쟁점 교차검증) · 머지 `/gstack-ship` 또는 `commit-commands:commit-push-pr` | | `superpowers:verification-before-completion` |

---

## 5. PR 분해 + 순서

| 순서 | PR | 내용 | 스킬 | launch |
|---|---|---|---|---|
| 0 | 폴리시 | 1페이지 "토스 심화 폴리시" 확정 | `/gstack-design-consultation`(스코프) | ✅ |
| 1 | **PR-C1** | 메뉴 한글화 + 내부코드 제거(Track Record·Decision Tree 영어 유지) | TDD | ✅ |
| 2 | **PR-C2** | 제품 화면 은어 평이화 + 빈상태 카피(§7) | edit + `/gstack-review` | ✅ |
| 3 | **PR-C3** | 사이드바 3구역 + 섹터비교 relocate·reword | design-review | ✅ |
| 4 | **PR-C4** | 홈 대시보드 A(현재 운영 중 + 추천 30 + 섹터 분포) + 포트폴리오 운영 뷰(중복 30 제거·기준월) | `/gstack-design-html` + TDD | ✅ |
| 5 | 폴리시 패스 | 변경 화면 전역 디자인 폴리시 | `/gstack-design-review` | ✅ |
| — | **PR-C5** | GLM openrouter-provider 배선 + 주요 AI 게이트 통일 | TDD + `eval-harness` | 코드 배선 완료, prod 활성·품질검증은 USER 키+eval 후 |
| — | 체크 | 면책 Footer 문구 노출 확인 | — | ✅(기존) |

각 PR 게이트: `build + lint + test:ci + tsc` + `/gstack-browse` 육안 + 은어/라벨 grep 회귀 + omxy 적대 검토(옵션 C').

---

## 6. 메뉴 라벨 매핑표

| 위치 | 구현 전 표현 | 주요 파일 | 구현 후 표현 | 비고 |
|---|---|---|---|---|
| 사이드바 | Track Record | layout.tsx | **Track Record(유지)** | USER: 영어 유지 |
| 사이드바 | 섹터 추천 비교 | layout.tsx | 종목 선정 방식 비교 (실험) | relocate: 실험·연구 |
| 사이드바 | Reflection Lab (G1) | layout.tsx | AI 학습 (실험) | (G1) 제거, 실험·연구 |
| 사이드바 | Decision Tree | layout.tsx | **Decision Tree(유지)** | USER: 영어 유지, 메인(성과) |
| 사이드바 | AI 비용 (M17) | layout.tsx | AI 비용 | (M17) 제거 |
| 사이드바 | Health (M18) | layout.tsx | 시스템 상태 | (M18) 제거, h1 정합 |
| 종목 탭 | Fundamental 분석 | stock-tabs.tsx | 기본적 분석 | value 불변 |
| 종목 탭 | Technical 분석 | stock-tabs.tsx | 기술적 분석 | value 불변 |
| 리포트 | Appendix | report/[ticker]/page.tsx | 부록 | id 불변 |

(홈/포트폴리오/알림/설정/알림 채널/증권사 키/거래소 키 = 이미 한글, 유지)

## 7. 은어 → 평이한 한국어 매핑표

| 구현 전 표현(제품 화면) | 주요 파일 | 구현 후 표현 |
|---|---|---|
| Short List 30 | admin/page.tsx, portfolio/page.tsx | 이번 달 추천 30 |
| Tier 0 지표/점수 | shortlist-row.tsx | 기초 점수 |
| Tier 1 합의 평가 대기(투심위 미생성…) | report/[ticker]/page.tsx | AI 심층 평가 대기 중 |
| AI 분석 대기 (Tier 0 지표만) | shortlist-row.tsx | 심층 분석 준비 중 (기초 지표만) |
| 섹터 14인 패널 미활성 — Tier 2 cost gate OFF… | report/[ticker]/page.tsx | 섹터 전문가 패널 미포함 |
| composite score | shortlist-row.tsx | 종합 점수 |
| production B++ 30 / Track-2 sector-soft-tilt 30 | sector-comparison/page.tsx | AI 추천 30 / 섹터 가중 후보 30 |
| CAP Months·누적 Alpha·Sharpe·복합 AND(BL-8 A) | decision-tree/page.tsx | 성과 판정 기준(툴팁: 초과수익·위험대비수익·최대낙폭) |
| ※ T7e.8 Tier 0 seed 후…, 마이그 00xx apply + FLAG=true | portfolio/page.tsx, funnel-reflection, sector-comparison/page.tsx | "아직 준비 중입니다"(운영 안내는 시스템 상태 화면에만) |
| 관리자 배치 (청크 워커 경로) / 30 재선정 — 청크 경로 사용 필요 | portfolio-panel.tsx | 고급 영역 접기 + 비활성 버튼 disabled |
| 보유 상태어(accepted/active/portfolio) | (신규 뱃지) | "보유 중" |

> 용어 확정 표기는 단일 용어집으로 관리(임의 번역 금지, OMXY 가드레일).

## 8. 범위 밖

- 자동매매(S8, 출시 후) · 멤버 페이지(Deferred-D) · 선정 방법론(B++/Tier0 diagnostic funnel) 로직 변경(은어 노출만 정리) · **디자인 폰트/토큰/컴포넌트 체계 재작업**(D34 위 폴리시만) · 신규 top-level 기능/페이지 재설계.

## 9. 리스크 / 검증

- 항목 2·4(a)·IA = 저리스크(문자열·구조 프레젠테이션, 로직/라우팅/서버액션 불변).
- 항목 3·4(b) = 신규 UI + 데이터 소스 전환(M).
- 항목 1 = 별도 트랙(키 게이트 + GLM 품질 `eval-harness` + hardcap 재산정 + D28 사업결정 반영).
- 디자인 = 출시 지연 방지 위해 **1p 폴리시로 스코프 고정**(재시스템 금지, OMXY).
- 게이트: `build + lint + test:ci + tsc` + `/gstack-browse`/playwright 육안 + 은어/라벨 grep 회귀 + omxy 적대 검토.

---

## 10. 구현 완료 (2026-07-01) — 4-스텝 프로세스 CONVERGED

**워킹트리 `prelaunch-ux-cleanup` 기준 구현 완료 · 게이트 GREEN(build ✓ / lint ✓ / test:ci 2623 pass·6 skip / tsc 0) · 실 키 유출 0(추적 파일).**
Diff stat은 문서 추가/수정 포함 여부에 따라 변동하므로 고정 박제하지 않는다.

**프로세스(USER 명령)**: ① Claude dynamic workflow(3 병렬 disjoint-ownership: GLM / 네비·라벨·은어 / 홈·포트·섹터분포 → 통합 검증) → ② omxy(fresh pane) 리뷰+직접수정 15건 → ③ Claude 적대 리뷰(리뷰-목적 서브에이전트 + 실 OpenRouter API 계약 실측)+수정 5건 → ④ omxy 재검토+수정 21건 → **CONVERGED**. 연결포인트 검증 포함.

**구현 요지**:
- **항목1 GLM**: 신규 `openrouter-provider.ts`(Chat Completions, `reasoning_effort:'high'`[GLM 5.2 메타 정합], JSON 역할만 `response_format:json_object`, `finish_reason=length`→transient, usage fail-closed, **apiKey 명시 가드로 OPENROUTER 부재 시 OPENAI 키 누출 차단**) + `model-registry` provider record 맵 + GLM primary/Claude fallback 재바인딩 + `MODEL_PRICING glm-5.2`(z-ai/glm-5.2, $0.93/$3/캐시 $0.18) + 주요 AI 호출/게이트(provider gate, M12a, portfolio action 포함) provider-agnostic 통일. GPT 불변. 비용 예약은 `getRoleWorstCaseMaxCostPerCallKrw`로 preferred/fallback 중 비싼 쪽 기준을 사용하며, GLM 실 비용·품질 확정 claim은 eval-harness/청구서 보정 전 금지.
- **항목2 메뉴**: 사이드바 3구역 + 한글화(`Track Record`·`Decision Tree` 영어 유지) + 내부코드 제거. 종목탭·부록·report/decision-tree/funnel/sector-comparison 은어 평이화.
- **항목3 홈/포트**: 홈 대시보드(`current-holdings-card`[getCurrentHoldings·기준월·조회실패=명시 오류] + 추천 30 + `sector-distribution` "추천 30 섹터 분포" top5+기타 + "보유 중" 뱃지) · 포트폴리오 중복 30 제거→운영뷰.
- **항목4 섹터**: sector-comparison → "종목 선정 방식 비교 (실험)" 리네임/relocate/reword + 신규 섹터 분포(홈).
- **디자인**: 토스 심화 폴리시(별도 spec) 적용 + 상태색 semantic 토큰 보정.

**GLM 실 API 실측 검증**(Claude STEP 3): OpenRouter `z-ai/glm-5.2`가 `reasoning_effort` + `response_format:json_object` 수용(finish_reason=stop, JSON 파싱 정상). GLM=reasoning 모델(reasoning_tokens 소비) → length는 transient 처리. judge/portfolio는 provider 호출 실패 시 Claude fallback, parse/log 실패 후 재호출 금지(중복 과금 위험 축소). 단 provider-call fallback 자체의 운영 관측성(log/metric)은 prod 전 eval-harness/실측 로그로 확인 또는 보강 필요. JSON 역할 responseFormat + 페르소나 `userPrompt.includes('json')` 조건부 responseFormat(OpenRouter "json 키워드" 제약 충족 + 산문 페르소나 미적용).

**남은 debt / go-live USER 게이트**:
1. ✅ **GLM prod 활성 — DONE (2026-07-01).** USER 승인 후 Vercel prod+dev `OPENROUTER_API_KEY` 주입 + 실 검증(프로즈 live smoke 실 provider ₩3.07 + judge/portfolio/persona JSON 스키마) 통과 → main 머지·배포. 키 부재 시 `ANTHROPIC_API_KEY` Claude fallback(무회귀). 로컬 키는 `.env.local`(gitignored)에만.
2. **GLM 출력 품질 = eval-harness 게이트**(D28 목적함수: judge/portfolio JSON 스키마 준수 + tier1_panel 페르소나 파싱률 + full_report/revise 품질 + fallback 관측성 확인; critic은 GPT 경로 불변). GLM primary go-live 전 필수.
3. **TriggerFullReportButton orphan**(개별 티커 수동 리포트 트리거) — 배치 생성+regenerate로 커버, 삭제 대신 문서 debt(비파괴, omxy 동의).
4. ✅ **commit/merge/prod deploy — DONE (2026-07-01).** main `c25c061`(엔진/UX) → `5b058f3`(docs) → `6b3a501`(디자인 폴리시), Vercel prod Ready·카나리 4/4. 잔여 = 라이브 `/gstack-design-review`(populated+auth, admin 인증 뒤라 USER 세션 필요).
5. `cacheWriteMult`/GLM write 단가 = 추정 상한 → 실 청구서 보정 TODO.
6. **디자인 QA(2026-07-01, App-UI 감사 · AI-slop B+/A− · HIGH 0) 후속 폴리시 debt** — ✅ 적용(commit `6b3a501`): 홈 focal 정리(h1 "홈" + 장중/브리핑 보조 이동) · 잔여 은어("축 비중"/"(Short)") · 9px→11px 가독성. ⏸ 미적용(taste/다중 컴포넌트, 별도 신중): 시장색 오버로드(빨강/파랑 가격방향+델타상태 이중의미 → 델타 배지 success/muted 분리) · 이모지→lucide(📅👥⚠️🤖, 합의배지 예외) · 카드 border 드리프트(`border`→`border-border/70`) · 배너 본문 착색→foreground.

## 부록 — OMXY 토론 로그 요약

- DEBATE-1: R1 omxy(문서화-우선·최소 critical, 항목4→법적고지 drift) → R2 orchestrator(drift 정정 + Accept/snapshot 실존 반영 + resolved) → R2 omxy **CONVERGED**(가드레일 4).
- DEBATE-2: R1 orchestrator(섹터 분포 위치·섹터비교 배치·디자인 순서) → R1 omxy(추천30 섹터분포 라벨 고정·top5+기타 / 실험을 설정과 분리 / 디자인 1p 폴리시로 축소) → R2 orchestrator(수용 + 사이드바 3구역) → R2 omxy **CONVERGED**(Decision Tree=운영분석 성격 명시·보유 뱃지 내부어 금지·폰트/토큰 재작업 금지·GLM 완료표현 금지).
