# Spec — Section 8 Part B (쟁점) 실제 issue-extraction (B-PARTB)

- **Status**: AS-BUILT — IMPL CONVERGED + ₩0 in-place 백필 APPLIED (2026-06-25). (이력: PLAN Claude→omxy R1~R3 CONVERGED → IMPL omxy R1+Claude 3-lens review+omxy R2 CONVERGED → backfill omxy R1 CONVERGED+APPLIED.) 잔여 = branch merge/deploy(중: arbiter FE 렌더 production 노출용).
- **Date**: 2026-06-25
- **Branch**: `tier0-bpp-multiregime` (main 미머지)
- **SoT 연계**: `Document/Service/Report/ReportFramework.md §5.1~5.3 + §8` (Part B "쟁점별 찬반 대결") · `tudal/src/lib/report/section-8-schema.ts` (`issueDebateExcerptSchema`, `partB` min3/max5)
- **HANDOFF**: §"🔧 Pre-launch" B-PARTB (코드 ✅ + ₩0 백필 APPLIED ✅, omxy 교차검증 CONVERGED 2026-06-25)

---

## 1. 문제 (백필 전 상태 = 문서화된 deferral, 우발 버그 아님 — 2026-06-25 해소)

> 아래는 **수정 전(as-was)** 상태. `extractIssueDebates` 구현 + ₩0 백필로 해소됨(§6·§8).

수정 전 `tudal/src/lib/report/writer.ts` `buildSection8AndVotes:73-93` 의 Part B는 스텁이었다:

```ts
// 정교한 issue extraction은 후속 PR. 본 PR은 stub 3 issue.
const partB = [
  { issue: '실적 모멘텀',
    pro_quote: personaResults.find(...BUY)?.content.slice(0, 100) ?? '',   // ← raw JSON 노출
    con_quote: personaResults.find(...SELL)?.content.slice(0, 100) ?? '' },
  { issue: '재무 건전성', pro_quote: 'stub', con_quote: 'stub' },           // ← 하드코딩 stub
  { issue: '경영진 품질', pro_quote: 'stub', con_quote: 'stub' },           // ← 하드코딩 stub
];
```

**production 실증 (백필 전 증거 — 2026-06-25 ₩0 in-place 백필로 해소, §6)** (`stock_reports` 2026-06-01, 백필 전 30/30 동일):
- issue1 pro/con = `content.slice(0,100)` = `{\n  "vote": "SELL",\n  "one_line": "...",\n  "argument_excerpt": "티` — JSON 봉투가 그대로 노출 + 단어 중간 절단.
- BUY/SELL 페르소나가 한쪽만 있으면 반대편은 `""` (빈 문자열). 예: 000660은 SELL 0표라 con_quote=`""`, 000500은 BUY 0표라 pro_quote=`""`.
- issue2/3 = 리터럴 `"stub"`.

Section 8 writer 공용 경로(commit_persona_eval / _cron)라 P2b/P4/B++ 전 30 리포트가 동일. **sector board(Tier2)와 무관** — 섹터 writer는 partA/sector_aggregate/votes만 commit한다.

### DoD (성공 기준)
1. raw JSON 노출 제거 — `content.slice()` 직접 노출 0.
2. 하드코딩 `'stub'` 제거 0.
3. 빈 문자열 `pro_quote=''`/`con_quote=''` 제거 — 항상 의미 있는 인용.
4. Core 11 페르소나 응답에서 **실제 의견 대립이 큰 쟁점 3~5개**를 추출, pro_quote/con_quote/(arbiter_quote)를 깔끔한 인용으로 합성.
5. **순수·결정론** (Date/random 없음). `buildSection8AndVotes`는 pure builder 유지.
6. zod `section8Schema` (partB min3/max5, `issueDebateExcerptSchema`) 항상 통과.
7. 단위 테스트로 모든 분기 커버. 기존 게이트 build/lint/test:ci/tsc green.

---

## 2. 입력 데이터 계약 (가용 데이터의 한계)

`buildSection8AndVotes(personaResults: CallPersonaResult[11], personaIds: string[11])`.
각 `personaResults[i].content` = 페르소나 응답 JSON 문자열 (`user-prompt-template.ts`):

```json
{ "vote": "BUY"|"HOLD"|"SELL", "one_line": "한 줄 평가(≤80자)", "argument_excerpt": "상세 논거(≤200자)" }
```

malformed 시 `parseContent` catch → `{vote:'HOLD', one_line:'parse failed', argument_excerpt: content.slice(0,200)}`.

**핵심 제약**: 페르소나 응답에는 "쟁점(issue) 축"이 구조화돼 있지 않다. vote + one_line + argument_excerpt 자유 텍스트뿐이다. 따라서 Part B 쟁점은 **11개 응답에서 결정론적 휴리스틱으로 도출**해야 하며(LLM 추가 호출 없음 — pure builder), AI가 쟁점을 따로 태깅해 주지 않는다. (ReportFramework §5.1~5.3의 "Step 2 핵심 쟁점 도출 / Step 3 쟁점별 찬반 토론"은 prompt 레벨의 지향이고, 실제 캡처 데이터는 위 3필드뿐 — 이 spec은 그 데이터로 §5.3 형식을 근사한다.)

§5.2 독립성 원칙("동일 논거 2명 금지 · 투자 철학 반영 강제")에 의해 11 페르소나의 논거는 자연히 서로 다른 축(밸류에이션·기술·매크로·혁신 등)에 분포한다 → 테마 기반 클러스터링의 근거.

---

## 3. 알고리즘 (pure, deterministic)

신규 export 순수 함수 `extractIssueDebates(personaResults, personaIds): IssueDebateExcerpt[]`. `buildSection8AndVotes`가 호출.

### 3.1 usable 페르소나 추출 (strict validation — omxy R1 #4)
각 i에 대해 **strict local parse** (lenient `parseContent`에 의존하지 않음 — 그건 vote/타입 미검증):
- `JSON.parse(content)` 성공해야 함 (실패 → unusable).
- `vote ∈ {'BUY','HOLD','SELL'}` (예: `'NEUTRAL'`/누락 → unusable).
- `typeof one_line === 'string'` 그리고 `one_line.trim().length > 0` (`.toLowerCase()` 크래시·whitespace-only 차단).
- **quote-safe(one_line)** — JSON 누출 방지(omxy R1 #3): `s.trim()` 이 `'{'`로 시작하지 않고, `s` 가 `'"vote"'`/`'"one_line"'` 미포함, `s.trim() !== 'stub'`. (legit 한국어 one_line은 이 패턴 없음 — JSON-ish/stub만 배제, 일반 `{...}` 토큰 오탐 최소화.)

label = `getPersonaById(personaIds[i])?.label ?? personaIds[i]`.
usable이 아닌 응답은 **인용 후보에서 완전 제외** → raw JSON/stub 누출 원천 차단 (DoD #1·#3).

각 usable persona: `{ personaId, label, vote, oneLine: one_line.trim(), argument, idx }` (idx = personaIds 내 위치 = 결정론 tie-break 키).
- `argument = typeof parsed.argument_excerpt === 'string' ? parsed.argument_excerpt.trim() : ''` (omxy R2 #2 — 비-string/누락도 크래시 없이 빈 문자열). argument는 **테마 매칭용으로만** 사용(quote/caution-판정엔 미사용 — 아래 §3.5 참고).

### 3.2 테마 카탈로그 (고정 순서 = 결정론 우선순위)
7개 canonical 쟁점 테마. 각 테마 = `{ title(쟁점 제목), keywords[] }`. 매칭 = `(oneLine + ' ' + argument).toLowerCase()` 가 keyword(소문자) substring 포함.

| idx | title | keywords (대표) |
|---|---|---|
| 0 | 밸류에이션 | 밸류, 가치평가, per, pbr, ev/, 고평가, 저평가, 비싸, 싸, 멀티플, 할인, 프리미엄, 목표주가, 적정주가, 주가수준 |
| 1 | 실적·성장 모멘텀 | 실적, 성장, 매출, 영업이익, 순이익, 이익, 모멘텀, 가이던스, 수주, 턴어라운드, 증익, opm, 마진, 수익성, 흑자, 적자 |
| 2 | 재무 건전성 | 부채, 차입, 현금, 유동성, 재무, 자본, 잉여현금, fcf, 부채비율, 이자보상, 자산, 신용 |
| 3 | 사업 해자·경쟁력 | 해자, 경쟁, 점유율, 진입장벽, 독점, 과점, 기술력, 특허, 브랜드, 공급망, hbm, 점유, 지배력 |
| 4 | 성장 동력·혁신 | 혁신, 신사업, 신제품, tam, 시장확대, 전환, 디스럽션, 파괴적, 신약, 파이프라인, 플랫폼, 신기술 |
| 5 | 거버넌스·자본배분 | 경영, 경영진, 거버넌스, 지배구조, 배당, 자사주, 주주환원, 대주주, 오너, 자본배분, 인수, m&a |
| 6 | 거시·리스크 | 거시, 매크로, 금리, 환율, 규제, 경기, 사이클, 변동성, 불확실, 리스크, 지정학, 수요둔화, 침체, 하방 |

키워드는 `ai`처럼 너무 광범위/오탐 큰 토큰은 제외(예: "ai"는 본문 다수 등장 → 4번 테마 keyword에서 뺀다). 한국어 substring 매칭 기준.

### 3.3 테마별 polarity (§5.3 찬성 대표 / 반대 대표 / 중재)
`voteRank: BUY=2, HOLD=1, SELL=0`.
테마 t의 matcher 집합 M_t (usable 중 keyword 매칭).
- **pro** = M_t에서 voteRank 최대(가장 강세). tie → idx 오름차순(첫 페르소나).
- **con** = M_t에서 voteRank 최소(가장 약세/신중). tie → idx 내림차순(마지막 페르소나) → pro와 다른 페르소나 우선.
- **clash** = `pro.voteRank − con.voteRank` (0..2). clash ≥ 1 이고 pro≠con(서로 다른 페르소나)면 "진짜 양면 쟁점".
- **arbiter** (optional) = M_t 중 vote==HOLD 이며 pro/con과 다른 페르소나, 우선 `chair`(id==='chair')가 매칭하면 chair, 없으면 idx 최소 HOLD. 없으면 undefined.

### 3.4 후보·정렬·선택 (결정론 total-order — omxy R1 #5)
**0. zero-usable 안전망 (omxy R1 #1)**: `usable.length === 0` (전원 parse-fail/invalid)이면 fallback chain이 pro source가 없어 3을 못 채운다. → 카탈로그 앞 3 테마 title로 3 issue를 만들고 pro_quote = con_quote = `평가 데이터 부족 — 위원 응답 파싱/검증 실패` (정직한 사실 진술, stub 아님). 즉시 반환. (정상 orchestrator에선 발생 안 하나 schema-safety 보장.)
1. 7 테마 중 clash≥1 ∧ pro≠con 인 것 = **Tier-1 후보** (진짜 양면 쟁점).
2. 정렬키: `clash desc`, `|M_t| desc`(매칭 폭=토론 활발도), `theme idx asc`. **전부 fixed-array index 기반 total order — object/Map key 순서에 의존하는 선택 금지.**
3. `selected = Tier-1[0 .. min(5, len)-1]`.
4. `len(selected) ≥ 3` → 그대로 반환(이미 ≤5). **실제 production 30 리포트의 지배적 경로** (11 이념 다양 페르소나 → 거의 항상 3+ 테마 clash).

### 3.5 fallback (Tier-1 < 3 — 합의가 강한 드문 케이스)
`usable.length ≥ 1` 전제(0이면 §3.4-0에서 이미 반환). 3개가 될 때까지 아래 순서. **절대 stub/JSON/빈 문자열 미사용. 동일-vote persona를 가짜 반대(반:)로 세우지 않는다 (omxy R1 #2).**
**con 인용↔라벨 정합 규칙 (omxy R2 #1)**: con_quote는 항상 그 persona의 **one_line**으로 렌더되므로, "반(신중)"으로 세우려면 **표시될 one_line 자체가 덜-강세이거나 신중해야** 한다. 따라서 con 후보는 ① pro보다 **엄격히 낮은 voteRank** matcher(one_line 그대로도 덜 강세 → 정당) 또는 ② **one_line 자체가 caution 키워드 포함**(`리스크, 우려, 다만, 그러나, 단서, 부담, 주의, 변동성, 둔화, 불확실, 하방, 약점` 중 one_line에 등장)인 matcher만 허용. argument에만 caution이 있고 one_line이 강세인 경우는 con으로 쓰지 않음(가짜 반대 방지).
- **Tier-2** (one-sided 테마, 정렬 `|M_t| desc, theme idx asc`): Tier-1·이미 쓴 title 제외, `|M_t| ≥ 1` 테마. pro = voteRank 최대 matcher(tie idx asc). con 우선순위:
  1. voteRank가 pro보다 **엄격히 낮은** matcher (one_line 표시도 덜 강세) → idx asc.
  2. 없으면 **one_line에 caution 키워드** 포함한 **다른** matcher → idx asc (표시 quote가 실제 신중).
  3. 둘 다 없으면 con_quote = **정직 문구** `반대 의견 없음 (위원 의견 수렴)` — 같은-vote 강세 one_line을 반대로 위장하지 않음.
- **Tier-3 (degenerate pad — 거의 발생 안 함)**: 그래도 3 미만이면, 아직 안 쓴 카탈로그 title 순서로 padding. pro = usable 전체 voteRank 최대(tie idx asc)의 인용. con = (1) 더 낮은 voteRank usable (2) **one_line이** caution-bearing인 usable (3) 둘 다 없으면 `반대 의견 없음 (위원 의견 수렴)`. title은 카탈로그 7개로 항상 unique 3개 이상 확보 가능.

**불변식**: 함수는 항상 `3 ≤ len ≤ 5`. 어떤 issue도 pro_quote/con_quote 빈 문자열·`'stub'`·JSON-ish 아님. issue title 중복 없음. 동일-vote 인용을 `반:`으로 위장 안 함.

### 3.6 인용 합성 (quote cleaning)
- 인용 = `${label}: ${oneLine}` (예: `워런 버핏: 해자가 견고하다`). one_line(≤80자, §3.1에서 trim + quote-safe 검증 완료) = 페르소나 헤드라인 → 깔끔·짧음, UI 카드(찬:/반:/중:)에 적합.
- usable 정의(§3.1)가 이미 비어있음/JSON-ish/stub을 배제하므로 `${label}: ${oneLine}` 는 항상 안전. raw `content`/`content.slice()` 절대 미사용.
- 정직 sentinel 문구(`반대 의견 없음 (위원 의견 수렴)`, `평가 데이터 부족 — 위원 응답 파싱/검증 실패`)는 quote-safe 보장(중괄호/`"vote"`/`stub` 미포함).
- arbiter_quote도 동일 형식, 있을 때만 채움(schema optional).

### 3.7 결정론 구현 가드 (omxy R1 #5)
- 테마 카탈로그·persona 후보는 **고정 배열 + index 기반 total-order sort**로만 순회·선택. plain object/Map 의 key 열거 순서에 의존하는 선택 금지(있으면 정렬 키에 theme idx / persona idx를 명시 포함).
- Date/random 미사용. 동일 입력 → deep-equal 출력.

---

## 4. 코드 변경 범위 (surgical)

1. `tudal/src/lib/report/writer.ts`:
   - 신규 pure export `extractIssueDebates(personaResults, personaIds): IssueDebateExcerpt[]` (+ 내부 테마 카탈로그 상수 + 헬퍼).
   - `buildSection8AndVotes`의 `partB` 블록(73-93)을 `const partB = extractIssueDebates(personaResults, personaIds);`로 교체.
   - partD/partC/votes/Sector 경로 **무변경** (parseContent core 정책 유지).
   - `IssueDebateExcerpt` 타입은 `section-8-schema.ts`의 `issueDebateExcerptSchema` z.infer 재사용(재정의 금지).
2. `tudal/src/lib/report/__tests__/writer.test.ts`: `extractIssueDebates` + buildSection8AndVotes partB 단위 테스트 추가 (아래 §5).
3. **(in-scope, 소규모 — omxy R1 #7 확인)** `page.tsx` Part B 카드(~889)에 `b.arbiter_quote` 있을 때 "중:" 1줄 null-guard 렌더 추가 — §5.3 중재자 형식 완성. **백필 전** 옛 리포트엔 arbiter_quote 없음(contract-safe); **백필 후** 일부 리포트는 arbiter_quote 포함(중재자 HOLD 존재 시). ⚠️ 단 `중:` 렌더 자체는 branch-only 코드(main 미머지·미배포) → merge/deploy 전까지 production FE 비노출(DB엔 arbiter_quote 존재, 배포 FE는 찬/반만 렌더).

**비변경**: schema(section-8-schema.ts) — 이미 partB min3/max5 + issueDebateExcerpt 정의 충족. 변경 불필요·금지. report-section-schemas.ts(read-path alias) 무변경.

---

## 5. 테스트 매트릭스 (단위, 결정론)

`extractIssueDebates` 직접 + `buildSection8AndVotes` 통합 (omxy R1 #8 반영):
1. **혼합 BUY/SELL/HOLD** (밸류·실적·리스크 등 다축 텍스트) → ≥3 issue, 각 pro≠con, clash≥1, quote에 label 포함, JSON 미포함.
2. **항상 3~5 불변식** — 다양한 입력에서 `len∈[3,5]`.
3. **raw JSON 누출 0** — 어떤 quote도 `'{'`/`'"vote"'` 미포함.
4. **stub/빈문자열 0** — 어떤 quote도 `=== 'stub'` 아님, `=== ''` 아님.
5. **parse-failed 페르소나 제외** — 일부 content가 `'not-json'`이어도 그 raw가 quote에 안 들어감.
6. **한쪽 vote 부재** — BUY만 11 (SELL/HOLD 0): fallback이 clean issue 3개 생성(production 000660 류). con이 정직 문구거나 caution matcher (동일-vote 위장 반대 0).
7. **전원 동일 vote·다축 텍스트·caution 없음** → 여전히 3 issue, con은 `반대 의견 없음 (위원 의견 수렴)` (다른 BUY 인용을 반대로 안 씀), title 중복 없음.
8. **결정론** — 동일 입력 2회 호출 = deep-equal.
9. **schema 통과** — 결과를 `section8Schema.partB`(또는 issueDebateExcerpt array)로 safeParse → success.
10. **production 형태 회귀** — 000500(SELL 우세, BUY 0)·000660(BUY 우세, SELL 0) 모사 입력으로 빈문자열/JSON 0 확인.
11. **전원 parse-fail (usable=0)** → §3.4-0 sentinel 3 issue, `평가 데이터 부족…`, schema 통과.
12. **usable=1** → 3 issue, pro=그 1인 인용, con=정직 문구, title unique.
13. **keyword 매칭 0** (one_line이 어떤 테마 키워드도 미포함) → Tier-3 pad가 3 issue 생성.
14. **invalid vote/누락/non-string one_line/whitespace-only** → 해당 persona unusable 처리(크래시 0), 나머지로 추출.
15. **raw-JSON-in-one_line** (`one_line` 자체가 `{"vote":...}` 텍스트) → quote-safe가 배제 → quote에 JSON 0.
16. **duplicate title fallback** — fallback이 이미 쓴 title 재사용 안 함(전 issue title distinct).
17. **tie (clash·|M_t| 동일)** → theme idx asc로 결정론 정렬(2회 호출 deep-equal).
18. **non-string/누락 argument_excerpt** (valid vote + valid one_line) → usable 유지(argument='') · 크래시 0 · 테마 매칭은 one_line만으로 동작.
19. **caution-in-argument-only** — one_line은 강세("성장성 우수")이고 argument에만 "다만 리스크" → 그 persona는 con으로 선택 안 됨(가짜 반대 0); con은 lower-voteRank/one_line-caution/정직문구 중 하나.

---

## 6. 기존 30 리포트 반영 — ₩0 in-place 백필로 RESOLVED (2026-06-25)

기존 30 리포트의 Part B는 코드 적용 후에도 DB에 옛 stub/JSON이 남으므로 반영이 필요했다. USER 결정 = **₩0 in-place 백필**(실 AI 재생성 ~₩30k 경로는 reject — Part B만 고치는 데 과함). DB에 이미 있는 `section_8.partD.one_line`(11) + `committee_votes` core `argument_excerpt`(11)로 생성 시점 persona content를 재구성 → `extractIssueDebates` 재실행 → `section_8.partB`만 UPDATE(나머지 무변경). AI 호출 0원. **APPLIED ✅** (gated driver `tudal/src/lib/report/__tests__/b-partb-backfill.live.test.ts`, omxy CONVERGED): backup→apply 30→post-verify 30/30 schema-valid+clean. 결함 인용 117(stub 60 + json-leak 30 + empty 27) → 0. backup `scripts/out/b-partb-backfill-backup-2026-06-01.json`(full old section_8, rollback). idempotent(partD/votes 불변 → 재실행 동일).

---

## 7. 프로세스 (사용자 명시, 강제)

- PLAN: ①Claude 작성(본 spec) → ②omxy catch-only → ③Claude fix → 수렴.
- IMPL: ①Claude dynamic Workflow 1차 드래프트(설계 패널→합성→구현→자가리뷰, subagent 필수) → ②omxy 적대 검토 + 직접 수정 → ③Claude 적대 검토(드래프팅과 다른 review-목적 에이전트/스킬) + 수정 → ④omxy 재검토 → CONVERGED. 연결포인트(buildSection8AndVotes 호출부·FE 렌더·schema·read-path) 검증 포함.
- DOCS: 동일 프로세스로 HANDOFF/ReportFramework/ServicePlan-Admin/memory 최신화.
- 검증 게이트: build/lint/test:ci/tsc 전부 green 유지.

---

## 8. 적대 검토 결과 (as-built, IMPL 단계 수렴)

### 8.1 omxy 적대 검토 (impl R1, catch-only) — 1 BLOCKER fix CONVERGED
- **isQuoteSafe brace 가드**: `!t.startsWith('{')` → `!s.includes('{')`. embedded brace(`밸류 저평가 {draft}`)가 통과해 quote에 `{` 노출 → `assertInvariants(q.includes('{')===false)` 불변식과 자기모순. 어떤 위치의 `{`든 배제로 수정 + test 15 embedded-brace 회귀 추가. (commit `ed8a559`)
- §3.1의 "trim startsWith '{'" 표현은 본 fix로 **"어떤 `{`든 배제"로 상향** (stricter, 불변식 정합).

### 8.2 Claude 적대 검토 (general-purpose 3-lens: bug-hunt / test-rigor / spec-conformance) — 보강
드래프팅(설계패널/구현)과 다른 **리뷰-목적** 에이전트로 mutation-survive 불변식을 catch:
- **(test-rigor HIGH) cap=5 / arbiter 경로 vacuous** → test 21(7-theme-clash→len===5) + test 22(populated arbiter `캐시 우드: 실적 중립 관망`, pro/con과 distinct) 추가.
- **(test-rigor MED) Tier-1 primary sort(clash desc, |M| desc) + isQuoteSafe stub/"vote" 서브가드 vacuous** → test 23(clash desc) + test 24(|M| desc, theme-idx 역행) + test 25(one_line='stub' 제외, 비-vacuous) + test 26(one_line에 `"vote"` 제외) 추가.
- **(test-rigor LOW) tie-break 방향 / con-fallback 우선순위 미검증** → test 27(pickPro idx-asc tie) + test 28(con-fallback ① lower-voteRank가 ② caution보다 우선, Tier-3) 추가.
- **(bug-hunt LOW) label이 quote-safe 미적용 + 길이 가드 부재** → `buildUsablePersonas`에서 label fail-soft + quote-safe(`isQuoteSafe(candidate)?...:`위원 N``) + 비-string id 시 `getPersonaById` 미호출(크래시 0). test 29 추가. **production 미도달**(항상 CORE_11 id) — pure-함수 계약 완결용.
- **(bug-hunt LOW, 의도 유지) brace one_line drop = recall 손실**: `{` 포함 one_line은 usable에서 제외(인용뿐 아니라 vote도 손실). AI 생성 80자 한국어 평가에 `{`는 매우 드묾 + 불변식 안전(Tier-3 backstop) → **의도적 단순화로 유지**(코드 변경 없음, 본 노트로 박제).
- **(spec-conformance LOW, 문서 정정) §3.2 키워드 7개 drop**: 코드 THEME_CATALOG가 §3.2 표 대비 `싸/이익/opm/자산/점유/전환/경영` 추가 제외(sanctioned `ai` 외). 전부 over-broad/단어-부분-중복 토큰(`이익`⊂`영업이익`, `경영`⊂`경영진`, `점유`⊂`점유율`) → 비용은 mis-tag뿐(bad quote 0). spec §3.2 의도("너무 광범위 토큰 제외")와 정합. **의도적 제외로 박제**(2 sanctioned deviation에 추가).

### 8.3 flaky-gate 주장 검증 (spec-conformance HIGH) — 재현 안 됨, latent hazard만 하드닝
- 주장: 부분 `vi.mock('@/lib/report/writer')` factory(`track-record/actions.test.ts`, `section8-step-preflight.test.ts`)가 `extractIssueDebates` 누락 → fork-pool worker recycle 시 leak → writer.test.ts 간헐 FAIL.
- **검증(§2.0a ④ 맹목 수용 X)**: 3-file 결합 25회 + full `test:ci` 12회 = **37 clean run, 0 fail**. + root-cause 모순(undefined export면 20개 전부 실패해야 하나 주장은 9·11만). 리뷰 중 3 review 에이전트가 vitest 동시 실행한 contention이 원인으로 추정. **gate는 `isolate:true`에서 flaky 아님**.
- **단, latent hazard 실재** → 두 부분 mock을 `importOriginal` spread로 하드닝(실 export 보존, spy override 유지). 신규 export가 부분 mock에 빠지는 미래 회귀 차단.

### 8.4 as-built 변경 파일
- `writer.ts`: extractIssueDebates + helpers + partB swap + isQuoteSafe(any-brace) + label fail-soft.
- `writer.test.ts`: B-PARTB 29 tests (20 초안 + omxy test15 보강 + Claude review 21~29).
- `page.tsx`: 중: arbiter null-guard render.
- `actions.test.ts` / `section8-step-preflight.test.ts`: writer mock importOriginal 하드닝(누출 방지).
- `b-partb-backfill.live.test.ts`: ₩0 in-place 백필 driver(gated, 2-phase, §6).
- schema/read-path/partD/votes/Sector = 무변경.

### 8.5 backfill driver 적대 검토 (omxy R1) — 1 BLOCKER fix + APPLIED
- **faithfulness fix**: 누락/중복 committee_votes가 silent `argument_excerpt:''`로 되면 theme 매칭 왜곡 → 충실성 깨짐. fix = 정확히 30×11 core votes 요구 + 중복 거부 + per-report 11 args + partD.persona_id 전수 커버 + 기존 section_8 schema 선검증.
- **write 하드닝**: APPLY UPDATE를 id+month scope + `.select('id').single()`(0/다중 row loud fail). post-write 재검증 = schema + 3~5 + distinct titles + clean quotes.
- **faithfulness 확인**: writer가 partD를 `personaIds.map`으로 생성 → 저장 JSON 배열순서 = 원 tie-break 순서 → 백필 산출 partB = 생성 시점 신규 writer가 냈을 partB와 동일.
- **APPLIED 2026-06-25**: dry-run(no write) 30 검증 → APPLY 30 UPDATE → post-verify 30/30 clean. 결함 117→0. residual risk = 순차 no-txn 부분 업데이트(중단 시) but backup + idempotent rerun으로 복구 가능(one-off 허용).
