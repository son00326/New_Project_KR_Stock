# Step 3b Curated 28 Sample Fixture (Manual Review)

> **목적**: 53차 §2 Step 3b Kevin v3.1 quality rubric injection을 manual review로 검증하는 fixture.
> CI gate 외 (LLM judge 비용·flaky 회피, omxy Layer a R1 catch 박제). 207 persona × 8 markers는 structural deterministic test가 CI에서 검증.

> **생성 시점**: 53차 §2 Step 3b Layer (g) Step 3 R2 CONVERGED 후 (commit `4b22740`, branch `feat/tier2-step3b-prompts-196`).

> **운영 원칙**: 본 fixture는 14 sectors × {high-risk base slot 1개 + overlay 1개} = 28 personas의 systemPrompt를 manual review 대상으로 박제. 실제 systemPrompt 본문은 코드에서 dynamic 생성되므로 spot-check script로 출력 후 manual 검증.

---

## Spot-check helper script

> 참고: CI에는 별도 "samples spot-check" test title이 없습니다 (omxy R1 catch 후 정정). LLM judge 없이 manual reviewer가 28 systemPrompt 본문을 직접 출력해서 검토하는 용도. structural invariants는 `sector-persona-builder.test.ts` + `kevin-v31-rubric.test.ts`에서 이미 CI enforce.

```bash
# 개별 sample systemPrompt 출력 (sector-persona-builder.ts API 직접 호출):
cd tudal && npx tsx -e "
import { resolveSectorPersona } from './src/lib/ai/prompts/personas/sector-persona-builder';
const c = resolveSectorPersona('sector-바이오-slot-8');  // personaId 변경하여 28 samples 순회
console.log(c?.systemPrompt);
" | less

# 또는 28 samples 한번에 dump (operator가 필요 시 임시 script로 작성):
cd tudal && npx tsx -e "
import { resolveSectorPersona } from './src/lib/ai/prompts/personas/sector-persona-builder';
const ids = [
  'sector-바이오-slot-8','sector-바이오-slot-11',
  'sector-반도체-slot-8','sector-반도체-slot-11',
  'sector-건설-slot-4','sector-건설-slot-12',
  // ... 28 samples matrix는 아래 표 참조
];
for (const id of ids) {
  console.log('=== ' + id + ' ===');
  console.log(resolveSectorPersona(id)?.systemPrompt);
  console.log();
}
" | less
```

---

## 14 sectors × 2 = 28 sample matrix

| # | Sector | Sample A (high-risk base 4/5/8/10 중 1) | Sample B (primary 11/12 or sub_tag 13/14) |
|---|---|---|---|
| 1 | 바이오 | `sector-바이오-slot-8` (global_industry_veteran + 빅파마/바이오텍 adj) | `sector-바이오-slot-11` (임상시험 통계학자 primary) |
| 2 | 반도체 | `sector-반도체-slot-8` (global_industry_veteran + 글로벌 파운드리/메모리 adj) | `sector-반도체-slot-11` (EUV/3nm 공정 전문가 primary) |
| 3 | 건설 | `sector-건설-slot-4` (domestic_special_expert + PF 리스크 adj) | `sector-건설-slot-12` (인프라 PPP 전문가 primary) |
| 4 | 금융 | `sector-금융-slot-8` (global_industry_veteran + 글로벌 IB adj) | `sector-금융-slot-11` (신용 분석가 primary) |
| 5 | 2차전지 | `sector-2차전지-slot-4` (domestic_special_expert + 셀 메이커 고객 다변화) | `sector-2차전지-slot-12` (EV 보급 모델러 primary) |
| 6 | 자동차 | `sector-자동차-slot-8` (global_industry_veteran + 글로벌 OEM adj) | `sector-자동차-slot-11` (ADAS 시스템 primary) |
| 7 | IT/SW | `sector-IT/SW-slot-8` (global_industry_veteran + SaaS/하이퍼스케일러 adj) | `sector-IT/SW-slot-12` (SaaS 비즈니스 모델 primary) |
| 8 | 유통/소비재 | `sector-유통/소비재-slot-8` (global_industry_veteran + retail/소비재 adj) | `sector-유통/소비재-slot-11` (옴니채널 commerce primary) |
| 9 | 에너지 | `sector-에너지-slot-4` (domestic_special_expert + 전력 공기업 adj) | `sector-에너지-slot-11` (신재생 grid primary) |
| 10 | 엔터/미디어 | `sector-엔터/미디어-slot-8` (global_industry_veteran + OTT/음악 레이블 adj) | `sector-엔터/미디어-slot-12` (K-콘텐츠 글로벌 라이센싱 primary) |
| 11 | 통신 | `sector-통신-slot-10` (global_adjacent_expert + 통신+클라우드 통합 adj) | `sector-통신-slot-11` (5G/6G 표준 primary) |
| 12 | 철강/소재 | `sector-철강/소재-slot-4` (domestic_special_expert + 국내 대형 철강사 adj) | `sector-철강/소재-slot-12` (글로벌 강재 수급 primary) |
| 13 | 운송/물류 | `sector-운송/물류-slot-8` (global_industry_veteran + 해운/항공 cargo adj) | `sector-운송/물류-slot-13-subtag-조선` (조선 PE/PC 엔지니어 sub_tag) |
| 14 | 보험/증권 | `sector-보험/증권-slot-8` (global_industry_veteran + 보험/자산운용 adj) | `sector-보험/증권-slot-12` (보험상품 actuarial primary) |

**28 samples 분포 (omxy Layer g step 2 R1 BLOCKER 2 박제 — full sector identity, "/" sector 포함)**:
- High-risk base slot 14 (4 = 6개 / 5 = 0개 / 8 = 7개 / 10 = 1개)
- Primary overlay 12 (slot 11 = 7개 / slot 12 = 5개)
- Sub_tag overlay 1 (조선 → 운송/물류 매핑)
- Backup slot 0 (sub_tag 미매칭 backup은 별도 검증 — sector-금융-slot-13 등)

총 28 samples로 14 sector × {drift 가능성 높은 high-risk lens + overlay 변화} cover.

---

## Manual review 체크리스트 (각 sample에 적용)

각 sample systemPrompt를 출력 후 다음 8 markers + 4 invariant + 3 quality 체크:

### 8 quality markers (M1~M8, KEVIN_V31_QUALITY_MARKERS)
- [ ] M1: `Q1:` (4 inquiry axes 명시)
- [ ] M2: `재무 데이터 직접 인용`
- [ ] M3: `근거 부족` (no-fabrication fallback)
- [ ] M4: `비교 가능한 회사`
- [ ] M5: `추정 시` (valuation trial)
- [ ] M6: `BUY/HOLD/SELL`
- [ ] M7: `일상 비유`
- [ ] M8: `200자 이내`

### 4 wrapper invariant
- [ ] core principle 선행 (`평가 원칙` 등장)
- [ ] sector philosophy 중간 (SECTOR_PHILOSOPHIES[sector] substring)
- [ ] rubric 후단 (KEVIN_V31_RUBRIC_INSTRUCTION substring)
- [ ] 순서: core < sector < rubric (index 비교)

### 3 quality (manual judgement)
- [ ] persona identity 명확 (role description + sector context 자연스러운가)
- [ ] sector-specific dynamics 보존 (회사명 X, 산업 descriptor O)
- [ ] LLM이 200자 argument에 inquiry axes 1~2개 적용 가능한 prompt 구조 (직관적)

---

## OOS (Out-of-scope)

- 본 fixture는 manual review만. CI에서 LLM judge 자동 실행 금지 (omxy Layer a R1 박제).
- 28 sample을 자동으로 systemPrompt 본문에 dump하는 test/script는 별도 작업 (manual operator가 필요 시 생성).
- Step 3b 후속 (Step 3c caller wiring / Step 4 Reflection / billing-on smoke)는 별도.

---

## Changelog

- 2026-05-21 (53차 §2 Layer g step 3 R2 CONVERGED): 초안 작성. 14 sectors × 2 = 28 sample matrix + 8 markers + 4 wrapper invariant + 3 quality manual review checklist.
