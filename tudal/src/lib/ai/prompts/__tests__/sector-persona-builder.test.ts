import { describe, it, expect } from 'vitest';
import {
  buildSectorPersonaContract,
  generateAllSectorPersonas,
  parseSectorPersonaId,
  resolveSectorPersona,
  SECTOR_PHILOSOPHIES,
  BASE_SLOT_PRINCIPLES,
  SECTOR_BASE_SLOT_ADJUSTMENTS,
  PRIMARY_OVERLAY_PRINCIPLES,
  SUB_TAG_OVERLAY_PRINCIPLES,
} from '../personas/sector-persona-builder';
import { CORE_11_PERSONAS, getPersonaById } from '../personas';
import {
  KEVIN_V31_QUALITY_MARKERS,
  KEVIN_V31_RUBRIC_INSTRUCTION,
} from '../kevin-v31-rubric';
import {
  BASE_SLOTS,
  CANONICAL_SECTORS,
  SECTOR_PERSONA_COUNT,
  SUB_TAG_OVERLAY_ROLES,
  resolveSlotTemplate,
} from '@/lib/screening/canonical-sectors';

const REQUIRED_PLACEHOLDERS = ['{{TICKER}}', '{{FINANCIALS}}', '{{REFLECTION_CONTEXT}}'];

describe('sector-persona-builder (D21 Tier 2, 53차 Step 3b)', () => {
  describe('SECTOR_PHILOSOPHIES + BASE_SLOT_PRINCIPLES coverage', () => {
    it('14 canonical sectors 각각 philosophy 정의됨', () => {
      for (const sector of CANONICAL_SECTORS) {
        expect(SECTOR_PHILOSOPHIES[sector]).toBeTruthy();
        // 53차 §2 Layer (b) 보강 후: 4 anchor (재무/peer/밸류/일상비유) 추가로 ≥300자
        expect(SECTOR_PHILOSOPHIES[sector].length).toBeGreaterThan(300);
      }
    });

    it('14 sectors 모두 4 anchor (M2/M4/M5/M7 enforce) 포함 — 53차 Layer (b)', () => {
      // 재무 인용 (M2), peer 비교 (M4), 밸류 가정 패턴 (M5), 일상 비유 (M7) — KEVIN_V31_QUALITY_MARKERS와 정합
      for (const sector of CANONICAL_SECTORS) {
        const philosophy = SECTOR_PHILOSOPHIES[sector];
        // omxy Layer (b) R1 BLOCKER 3: markdown ** + 'anchor' scaffold 누출 회피 — 자연어 label로 교체
        expect(philosophy, `${sector}: '재무 확인:' label 누락`).toContain('재무 확인:');
        expect(philosophy, `${sector}: '비교 기준:' label 누락`).toContain('비교 기준:');
        expect(philosophy, `${sector}: '밸류 가정:' label 누락`).toContain('밸류 가정:');
        expect(philosophy, `${sector}: '쉬운 비유:' label 누락`).toContain('쉬운 비유:');
      }
    });

    it('14 sectors philosophies 안에 banned literal 0 match (Layer a R2 invariant)', () => {
      // omxy Layer (a) R2 BLOCKER 박제 — banned literal이 sector philosophy에도 출현 금지
      for (const sector of CANONICAL_SECTORS) {
        const philosophy = SECTOR_PHILOSOPHIES[sector];
        expect(philosophy, `${sector}: "Peer 5축" 등장`).not.toContain('Peer 5축');
        expect(philosophy, `${sector}: "Pure-play" 등장`).not.toContain('Pure-play');
        expect(philosophy, `${sector}: "Bridge" 등장`).not.toContain('Bridge');
      }
    });

    it('10 base slot 각각 principle 정의됨', () => {
      const baseRoles = [
        'domestic_insider_1',
        'domestic_insider_2',
        'domestic_sector_analyst',
        'domestic_special_expert',
        'domestic_academic',
        'global_sector_analyst_1',
        'global_sector_analyst_2',
        'global_industry_veteran',
        'global_sector_investor',
        'global_adjacent_expert',
      ];
      for (const role of baseRoles) {
        expect(BASE_SLOT_PRINCIPLES[role]).toBeTruthy();
        // 53차 §2 Layer (c) 보강 후: 재무 확인 label 추가로 ≥190자 (base prose 평균 ~150자 + 재무 확인 anchor 평균 ~60자)
        expect(BASE_SLOT_PRINCIPLES[role].length).toBeGreaterThan(190);
      }
    });

    it('10 base slot 모두 "재무 확인:" label (M2 enforce) 포함 — 53차 Layer (c)', () => {
      // sector-agnostic financial lens 일관 적용. sector philosophy `재무 확인:`은 sector dynamics,
      // base slot `재무 확인:`은 persona type별 보는 line items.
      const baseRoles = Object.keys(BASE_SLOT_PRINCIPLES);
      expect(baseRoles).toHaveLength(10);
      for (const role of baseRoles) {
        const principle = BASE_SLOT_PRINCIPLES[role];
        expect(principle, `${role}: '재무 확인:' label 누락`).toContain('재무 확인:');
      }
    });

    it('10 base slot 안에 banned literal 0 match (Layer a R2 invariant)', () => {
      const baseRoles = Object.keys(BASE_SLOT_PRINCIPLES);
      for (const role of baseRoles) {
        const principle = BASE_SLOT_PRINCIPLES[role];
        expect(principle, `${role}: "Peer 5축" 등장`).not.toContain('Peer 5축');
        expect(principle, `${role}: "Pure-play" 등장`).not.toContain('Pure-play');
        expect(principle, `${role}: "Bridge" 등장`).not.toContain('Bridge');
      }
    });
  });

  describe('PRIMARY_OVERLAY_PRINCIPLES coverage (53차 Layer d)', () => {
    it('14 sectors × 2 = 28 primary overlay principles 정의됨', () => {
      const sectors = Object.keys(PRIMARY_OVERLAY_PRINCIPLES);
      expect(sectors).toHaveLength(14);
      for (const sector of CANONICAL_SECTORS) {
        const pair = PRIMARY_OVERLAY_PRINCIPLES[sector];
        expect(pair).toHaveLength(2);
        // role-specific principle + 재무 확인 anchor 합쳐 ≥85자 (가장 짧은 사례 ~88자, omxy R1 bridge→브릿지론 5자 감소 반영)
        expect(pair[0].length).toBeGreaterThan(85);
        expect(pair[1].length).toBeGreaterThan(85);
      }
    });

    it('28 primary overlay principles 모두 "재무 확인:" label (M2 enforce) 포함', () => {
      for (const sector of CANONICAL_SECTORS) {
        const [p1, p2] = PRIMARY_OVERLAY_PRINCIPLES[sector];
        expect(p1, `${sector} primary[0]: 재무 확인: 누락`).toContain('재무 확인:');
        expect(p2, `${sector} primary[1]: 재무 확인: 누락`).toContain('재무 확인:');
      }
    });

    it('28 primary overlay principles 안에 banned literal 0 match (case-insensitive bridge — omxy R1 BLOCKER 1)', () => {
      // omxy Layer (d) R1 BLOCKER 1 박제: case-sensitive "Bridge"만 막으면 "bridge loan" 통과 — case-insensitive로 확장.
      for (const sector of CANONICAL_SECTORS) {
        const [p1, p2] = PRIMARY_OVERLAY_PRINCIPLES[sector];
        for (const p of [p1, p2]) {
          expect(p).not.toContain('Peer 5축');
          expect(p).not.toContain('Pure-play');
          expect(p.toLowerCase()).not.toContain('bridge');
        }
      }
    });

    it('28 primary overlay principles 안에 specific 회사명/브랜드 0 (omxy R1 BLOCKER 2)', () => {
      // omxy Layer (d) R1 BLOCKER 2 박제: 회사/브랜드 0 assertion 추가.
      // 자주 등장 가능한 글로벌/국내 specific company/brand 직접 인용 차단.
      const bannedCompanies = [
        'Apple', 'Microsoft', 'Google', 'Amazon', 'Meta', 'NVIDIA',
        'TSMC', 'Intel', 'Samsung', '삼성전자', '삼성',
        'Tesla', 'Toyota', '현대', '기아', '현대차',
        'Pfizer', 'Roche', 'Novartis', 'Moderna', 'BioNTech',
        'JPMorgan', 'Goldman Sachs', 'BlackRock', 'Allianz', 'AXA',
        'Netflix', '넷플릭스', 'Disney', 'Spotify', 'Sony Music',
        'Maersk', 'MSC', 'FedEx', 'UPS',
        'Halozyme', 'Bechtel', 'Vinci',
      ];
      for (const sector of CANONICAL_SECTORS) {
        const [p1, p2] = PRIMARY_OVERLAY_PRINCIPLES[sector];
        for (const p of [p1, p2]) {
          for (const company of bannedCompanies) {
            expect(p, `${sector}: "${company}" 직접 인용`).not.toContain(company);
          }
        }
      }
    });

    it('primary_overlay branch가 PRIMARY_OVERLAY_PRINCIPLES 사용 (이전 generic 폐기)', () => {
      // sector primary overlay (slot 11/12) PersonaContract systemPrompt에 새 principle substring 포함
      for (const sector of CANONICAL_SECTORS) {
        const [p1, p2] = PRIMARY_OVERLAY_PRINCIPLES[sector];
        const contract11 = resolveSectorPersona(`sector-${sector}-slot-11`);
        const contract12 = resolveSectorPersona(`sector-${sector}-slot-12`);
        expect(contract11?.systemPrompt).toContain(p1);
        expect(contract12?.systemPrompt).toContain(p2);
        // 이전 generic phrase 폐기 확인
        expect(contract11?.systemPrompt).not.toContain(`${sector} 섹터의`);
      }
    });
  });

  describe('SUB_TAG_OVERLAY_PRINCIPLES coverage (53차 Layer e)', () => {
    // omxy Layer (e) R1 BLOCKER 2 정정: hardcoded subTags 대신 canonical SoT 사용 — drift 차단.
    const subTags = Object.keys(SUB_TAG_OVERLAY_ROLES);

    it('SUB_TAG_OVERLAY_PRINCIPLES keys === SUB_TAG_OVERLAY_ROLES keys (canonical SoT 1:1)', () => {
      const principleKeys = Object.keys(SUB_TAG_OVERLAY_PRINCIPLES).sort();
      const roleKeys = Object.keys(SUB_TAG_OVERLAY_ROLES).sort();
      expect(principleKeys).toEqual(roleKeys);
    });

    it('각 sub_tag pair principle이 SUB_TAG_OVERLAY_ROLES role name 포함', () => {
      // 각 principle 안에 해당 sub_tag role 이름이 직접 등장하여 drift 방지
      for (const subTag of subTags) {
        const [r1, r2] = SUB_TAG_OVERLAY_ROLES[subTag];
        const [p1, p2] = SUB_TAG_OVERLAY_PRINCIPLES[subTag];
        // role name 첫 핵심어 (앞 4~6자) substring 검증 — 전체 match는 too brittle
        const r1Core = r1.split(/[ /·]/)[0]; // e.g. "조선 PE/PC 엔지니어" → "조선"
        const r2Core = r2.split(/[ /·]/)[0];
        expect(p1, `${subTag} principle[0]에 role[0] 핵심어 "${r1Core}" 누락`).toContain(r1Core);
        expect(p2, `${subTag} principle[1]에 role[1] 핵심어 "${r2Core}" 누락`).toContain(r2Core);
      }
    });

    it('7 sub_tags × 2 = 14 sub_tag overlay principles 정의됨', () => {
      expect(Object.keys(SUB_TAG_OVERLAY_PRINCIPLES)).toHaveLength(7);
      for (const subTag of subTags) {
        const pair = SUB_TAG_OVERLAY_PRINCIPLES[subTag];
        expect(pair, `${subTag} principles 누락`).toBeDefined();
        expect(pair).toHaveLength(2);
        expect(pair[0].length).toBeGreaterThan(85);
        expect(pair[1].length).toBeGreaterThan(85);
      }
    });

    it('14 sub_tag overlay principles 모두 "재무 확인:" label (M2 enforce) 포함', () => {
      for (const subTag of subTags) {
        const [p1, p2] = SUB_TAG_OVERLAY_PRINCIPLES[subTag];
        expect(p1, `${subTag} sub_tag[0]: 재무 확인: 누락`).toContain('재무 확인:');
        expect(p2, `${subTag} sub_tag[1]: 재무 확인: 누락`).toContain('재무 확인:');
      }
    });

    it('14 sub_tag overlay principles 안에 banned literal 0 (case-insensitive bridge 포함)', () => {
      for (const subTag of subTags) {
        const [p1, p2] = SUB_TAG_OVERLAY_PRINCIPLES[subTag];
        for (const p of [p1, p2]) {
          expect(p).not.toContain('Peer 5축');
          expect(p).not.toContain('Pure-play');
          expect(p.toLowerCase()).not.toContain('bridge');
        }
      }
    });

    it('14 sub_tag overlay principles 안에 specific 회사명/브랜드 0', () => {
      const bannedCompanies = [
        'Apple', 'Microsoft', 'Google', 'Amazon', 'NVIDIA',
        'TSMC', 'Intel', 'Samsung', '삼성전자',
        'Tesla', 'Toyota',
        'Pfizer', 'Roche', 'Moderna', 'Halozyme',
        'JPMorgan', 'Goldman Sachs', 'BlackRock',
        'Netflix', '넷플릭스', 'Disney', 'Sony Music',
        'Maersk', 'FedEx',
      ];
      for (const subTag of subTags) {
        const [p1, p2] = SUB_TAG_OVERLAY_PRINCIPLES[subTag];
        for (const p of [p1, p2]) {
          for (const company of bannedCompanies) {
            expect(p, `${subTag}: "${company}" 직접 인용`).not.toContain(company);
          }
        }
      }
    });

    it('sub_tag_overlay branch가 SUB_TAG_OVERLAY_PRINCIPLES 사용 (이전 inline ternary 폐기)', () => {
      // 바이오 sector + 제약 sub_tag = canonical 매칭 case
      const [제약P1, 제약P2] = SUB_TAG_OVERLAY_PRINCIPLES['제약'];
      const contract13 = resolveSectorPersona(`sector-바이오-slot-13-subtag-제약`);
      const contract14 = resolveSectorPersona(`sector-바이오-slot-14-subtag-제약`);
      expect(contract13?.systemPrompt).toContain(제약P1);
      expect(contract14?.systemPrompt).toContain(제약P2);
      // 이전 inline ternary 텍스트 폐기 확인
      expect(contract13?.systemPrompt).not.toContain('보완 시각을 제공한다.');
    });
  });

  describe('Core 11 Kevin v3.1 rubric inject (53차 Layer f)', () => {
    it('Core 11 personas 모두 KEVIN_V31_RUBRIC_INSTRUCTION inject', () => {
      expect(CORE_11_PERSONAS).toHaveLength(11);
      for (const p of CORE_11_PERSONAS) {
        expect(p.systemPrompt, `${p.id}: KEVIN_V31_RUBRIC_INSTRUCTION 누락`).toContain(
          KEVIN_V31_RUBRIC_INSTRUCTION,
        );
      }
    });

    it('Core 11 personas 모두 8 markers (M1~M8) substring 포함', () => {
      for (const p of CORE_11_PERSONAS) {
        for (const [key, marker] of Object.entries(KEVIN_V31_QUALITY_MARKERS)) {
          expect(p.systemPrompt, `${p.id}: marker ${key} (${marker}) 누락`).toContain(marker);
        }
      }
    });

    it('Core 11 persona individuality 보존 — label 한국어 이름이 systemPrompt에 유지', () => {
      // omxy R3 catch vi 박제: rubric = wrapper, NOT replacement.
      // 각 persona의 label (한국어 이름)이 systemPrompt 안에 보존되어야 함.
      for (const p of CORE_11_PERSONAS) {
        expect(p.systemPrompt, `${p.id}: label "${p.label}" 누락 (individuality 손실)`).toContain(p.label);
      }
    });

    it('Core 11 persona individuality 보존 — 고유 lens keyword 유지 (omxy Layer f R1 BLOCKER 박제)', () => {
      // omxy Layer (f) R1 BLOCKER: label-only test는 tautology — 각 persona 고유 lens keyword 검증.
      // 각 persona는 아래 keywords 중 1개 이상 systemPrompt에 포함해야 함.
      const lensKeywords: Record<string, string[]> = {
        'warren-buffett': ['해자', 'Moat', 'Circle of Competence', 'Intrinsic Value'],
        'stanley-druckenmiller': ['매크로', '비대칭', '모멘텀'],
        'cathie-wood': ['파괴적 혁신', 'TAM', '플랫폼'],
        'peter-lynch': ['PEG', '일상', 'Invest in what you know'],
        'charlie-munger': ['격자형', 'Latticework', 'Wonderful business'],
        'phil-fisher': ['15 포인트', 'Scuttlebutt', 'R&D'],
        'rakesh-jhunjhunwala': ['신흥', '컴파운딩', 'ROE'],
        'mohnish-pabrai': ['Dhandho', '다바왈라', 'Cloning', '복제'],
        'michael-burry': ['컨트래리언', 'Free Cash Flow', 'FCF Yield'],
        'nassim-taleb': ['반취약성', '블랙스완', 'Antifragile', '볼록성'],
        // chair: '위원장'은 label과 중복 — tautology 회피 위해 individuality keyword에서 제외 (omxy Layer f R2 박제)
        'chair': ['11명', '5종 배지'],
      };
      for (const p of CORE_11_PERSONAS) {
        const expected = lensKeywords[p.id];
        expect(expected, `${p.id}: lens keywords 정의 누락 (test fixture 갱신 필요)`).toBeDefined();
        const found = expected.some((k) => p.systemPrompt.includes(k));
        expect(found, `${p.id}: 어떤 lens keyword도 발견 못함 (${expected.join(' / ')})`).toBe(true);
      }
    });

    it('Core 11 rubric inject 후에도 기존 평가 원칙 keyword 등장 (wrapper 순서)', () => {
      // applyKevinV31Rubric은 core principle을 rubric보다 먼저 배치 — Layer a R3 catch vi
      for (const p of CORE_11_PERSONAS) {
        const rubricIdx = p.systemPrompt.indexOf(KEVIN_V31_RUBRIC_INSTRUCTION);
        expect(rubricIdx).toBeGreaterThan(0);
        // rubric 앞에는 persona-specific core principle이 있어야 함
        const before = p.systemPrompt.substring(0, rubricIdx).trim();
        expect(before.length, `${p.id}: rubric 앞 core principle 없음`).toBeGreaterThan(50);
      }
    });
  });

  describe('196 sector personas Kevin v3.1 rubric inject coverage (53차 Layer g step 2)', () => {
    it('196 sector personas 모두 KEVIN_V31_RUBRIC_INSTRUCTION inject', () => {
      const all = generateAllSectorPersonas();
      expect(all).toHaveLength(196);
      for (const p of all) {
        expect(p.systemPrompt, `${p.id}: KEVIN_V31_RUBRIC_INSTRUCTION 누락`).toContain(
          KEVIN_V31_RUBRIC_INSTRUCTION,
        );
      }
    });

    it('196 sector personas 모두 8 markers (M1~M8) substring 포함', () => {
      const all = generateAllSectorPersonas();
      for (const p of all) {
        for (const [key, marker] of Object.entries(KEVIN_V31_QUALITY_MARKERS)) {
          expect(p.systemPrompt, `${p.id}: marker ${key} (${marker}) 누락`).toContain(marker);
        }
      }
    });

    it('196 sector personas wrapper 순서: core principle → sector philosophy → rubric (index 전수 검증)', () => {
      // omxy Layer (g) Step 2 R1 BLOCKER 1 박제: sector position을 전수 index로 검증.
      // applyKevinV31Rubric(corePrincipleText, sectorPhilosophy):
      //   결과: corePrincipleText + "\n\n" + sectorPhilosophy + "\n\n" + KEVIN_V31_RUBRIC_INSTRUCTION
      const all = generateAllSectorPersonas();
      for (const p of all) {
        const sectorName = p.label.split(' ')[0]; // canonical sector (공백 없음) — "IT/SW", "유통/소비재" 등 그대로
        const sectorPhilosophy = SECTOR_PHILOSOPHIES[sectorName as keyof typeof SECTOR_PHILOSOPHIES];
        expect(sectorPhilosophy, `${p.id}: SECTOR_PHILOSOPHIES["${sectorName}"] 미정의`).toBeTruthy();

        const coreIdx = p.systemPrompt.indexOf('평가 원칙');
        const sectorIdx = p.systemPrompt.indexOf(sectorPhilosophy);
        const rubricIdx = p.systemPrompt.indexOf(KEVIN_V31_RUBRIC_INSTRUCTION);

        expect(coreIdx, `${p.id}: '평가 원칙' 누락`).toBeGreaterThanOrEqual(0);
        expect(sectorIdx, `${p.id}: sector philosophy 누락`).toBeGreaterThan(0);
        expect(rubricIdx, `${p.id}: rubric 누락`).toBeGreaterThan(0);
        // 순서 = core < sector < rubric
        expect(coreIdx, `${p.id}: 순서 위반 (core < sector)`).toBeLessThan(sectorIdx);
        expect(sectorIdx, `${p.id}: 순서 위반 (sector < rubric)`).toBeLessThan(rubricIdx);
      }
    });

    it('196 sector personas sector identity 보존 — full sector name이 systemPrompt 안에 등장 (BLOCKER 2)', () => {
      // omxy Layer (g) Step 2 R1 BLOCKER 2 박제: "/" sector도 full name으로 검증.
      // canonical sector는 공백이 없으므로 label.split(' ')[0]이 전체 sector name.
      const all = generateAllSectorPersonas();
      for (const p of all) {
        const sectorName = p.label.split(' ')[0]; // "IT/SW", "유통/소비재" 등 full name
        expect(p.systemPrompt, `${p.id}: full sector identity "${sectorName}" 누락`).toContain(sectorName);
      }
    });

    it('7 sub_tag × 2 = 14 sub_tag matched personas rubric inject smoke (omxy R1 claim correction)', () => {
      // omxy claim correction 박제: generateAllSectorPersonas()는 sub_tag matched personas (sub_tag suffix) 생성 안 함.
      // 별도 smoke: 각 sub_tag별 canonical sector에 활성화한 contracts 14개 검증.
      // SUB_TAG_CROSSWALK 박제: 조선 → 운송/물류, 방산 → 철강/소재, 화학 → 철강/소재, 게임 → IT/SW, 가전 → 유통/소비재, 제약 → 바이오, 부동산 → 건설
      const subTagToSector: Record<string, string> = {
        '조선': '운송/물류',
        '방산': '철강/소재',
        '화학': '철강/소재',
        '게임': 'IT/SW',
        '가전': '유통/소비재',
        '제약': '바이오',
        '부동산': '건설',
      };
      for (const [subTag, sector] of Object.entries(subTagToSector)) {
        for (const slotIdx of [13, 14]) {
          const personaId = `sector-${sector}-slot-${slotIdx}-subtag-${subTag}`;
          const contract = resolveSectorPersona(personaId);
          expect(contract, `${personaId} 생성 실패`).not.toBeNull();
          expect(contract!.systemPrompt).toContain(KEVIN_V31_RUBRIC_INSTRUCTION);
          // 8 markers
          for (const marker of Object.values(KEVIN_V31_QUALITY_MARKERS)) {
            expect(contract!.systemPrompt, `${personaId}: marker "${marker}" 누락`).toContain(marker);
          }
        }
      }
    });
  });

  describe('buildSectorPersonaContract', () => {
    it('14 sectors × 14 slots = 196 contracts 모두 valid PersonaContract', () => {
      const all = generateAllSectorPersonas();
      expect(all).toHaveLength(CANONICAL_SECTORS.length * SECTOR_PERSONA_COUNT);
      expect(all).toHaveLength(196);

      // 모든 contract가 required field를 가짐
      for (const c of all) {
        expect(c.id).toBeTruthy();
        expect(c.label).toBeTruthy();
        expect(c.version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(c.philosophy).toBeTruthy();
        expect(c.systemPrompt.length).toBeGreaterThan(200);
        for (const ph of REQUIRED_PLACEHOLDERS) {
          expect(c.userPromptTemplate).toContain(ph);
        }
      }
    });

    it('systemPrompt에 Kevin v3.1 톤 규칙 포함', () => {
      const slot = resolveSlotTemplate('바이오', [])[0];
      const contract = buildSectorPersonaContract('바이오', slot);
      expect(contract.systemPrompt).toContain('Kevin v3.1');
      expect(contract.systemPrompt).toContain('일상 비유');
      expect(contract.systemPrompt).toContain('BUY/HOLD/SELL');
      expect(contract.systemPrompt).toContain('200자 이내');
    });

    it('sector philosophy가 systemPrompt에 포함', () => {
      const slot = resolveSlotTemplate('반도체', [])[0];
      const contract = buildSectorPersonaContract('반도체', slot);
      // 반도체 philosophy: "4년 주기 사이클" 포함
      expect(contract.systemPrompt).toContain('4년 주기');
    });

    it('primary overlay (slot 11/12) sector-specific 역할 명시', () => {
      const slot11 = resolveSlotTemplate('바이오', [])[10]; // index 10 = slot 11
      const slot12 = resolveSlotTemplate('바이오', [])[11];
      expect(slot11.role).toBe('임상시험 통계학자');
      expect(slot12.role).toBe('FDA 정책 전문가');

      const contract11 = buildSectorPersonaContract('바이오', slot11);
      const contract12 = buildSectorPersonaContract('바이오', slot12);
      expect(contract11.systemPrompt).toContain('임상시험 통계학자');
      expect(contract12.systemPrompt).toContain('FDA 정책 전문가');
    });

    it('sub_tag overlay (slot 13/14) sub_tag context 반영', () => {
      // 조선 sub_tag 활성화
      const tmpl = resolveSlotTemplate('운송/물류', ['조선']);
      const slot13 = tmpl[12]; // index 12 = slot 13
      expect(slot13.role).toBe('조선 PE/PC 엔지니어');
      expect(slot13.sub_tag).toBe('조선');

      const contract = buildSectorPersonaContract('운송/물류', slot13);
      expect(contract.id).toBe('sector-운송/물류-slot-13-subtag-조선');
      expect(contract.systemPrompt).toContain('조선');
      expect(contract.systemPrompt).toContain('수주잔고');
    });

    it('sub_tag 미매칭 시 backup slot (52차 박제 backwards-compat)', () => {
      const tmpl = resolveSlotTemplate('금융', []);
      const slot13 = tmpl[12];
      expect(slot13.sub_tag).toBeUndefined();

      const contract = buildSectorPersonaContract('금융', slot13);
      // backup = no -backup suffix (52차 박제)
      expect(contract.id).toBe('sector-금융-slot-13');
      expect(contract.systemPrompt).toContain('quant/data');
    });
  });

  describe('parseSectorPersonaId', () => {
    it('slot 1~12 패턴 parsing', () => {
      const p1 = parseSectorPersonaId('sector-바이오-slot-1');
      expect(p1).toEqual({ sector: '바이오', slot_index: 1, sub_tag: undefined, is_backup: false });

      const p11 = parseSectorPersonaId('sector-반도체-slot-11');
      expect(p11).toEqual({ sector: '반도체', slot_index: 11, sub_tag: undefined, is_backup: false });
    });

    it('slot 13/14 no-suffix = backup', () => {
      const p13 = parseSectorPersonaId('sector-금융-slot-13');
      expect(p13).toEqual({ sector: '금융', slot_index: 13, sub_tag: undefined, is_backup: true });
    });

    it('slot 13/14 -subtag- suffix parsing', () => {
      const p = parseSectorPersonaId('sector-운송/물류-slot-13-subtag-조선');
      expect(p).toEqual({ sector: '운송/물류', slot_index: 13, sub_tag: '조선', is_backup: false });
    });

    it('invalid sector → null', () => {
      const p = parseSectorPersonaId('sector-비존재-slot-1');
      expect(p).toBeNull();
    });

    it('invalid slot index → null', () => {
      const p = parseSectorPersonaId('sector-바이오-slot-15');
      expect(p).toBeNull();
    });

    it('Core 11 패턴 (sector- prefix 없음) → null', () => {
      const p = parseSectorPersonaId('peter-lynch');
      expect(p).toBeNull();
    });
  });

  describe('resolveSectorPersona', () => {
    it('valid sector personaId → PersonaContract', () => {
      const c = resolveSectorPersona('sector-바이오-slot-1');
      expect(c).not.toBeNull();
      expect(c?.id).toBe('sector-바이오-slot-1');
    });

    it('sub_tag matched personaId → sub_tag-aware contract', () => {
      const c = resolveSectorPersona('sector-운송/물류-slot-13-subtag-조선');
      expect(c).not.toBeNull();
      expect(c?.systemPrompt).toContain('조선');
    });

    it('Core 11 personaId → null (caller fallback)', () => {
      expect(resolveSectorPersona('peter-lynch')).toBeNull();
    });
  });

  describe('getPersonaById dynamic sector resolution', () => {
    it('Core 11 ID → CORE_11_PERSONAS hit', () => {
      const p = getPersonaById('peter-lynch');
      expect(p).toBeDefined();
      expect(p?.label).toBe('피터 린치');
    });

    it('sector ID → dynamic resolution hit', () => {
      const p = getPersonaById('sector-반도체-slot-11');
      expect(p).toBeDefined();
      expect(p?.systemPrompt).toContain('EUV/3nm');
    });

    it('미정의 ID → undefined', () => {
      const p = getPersonaById('sector-비존재-slot-1');
      expect(p).toBeUndefined();
    });
  });

  describe('196 unique IDs (cell coverage)', () => {
    it('14 sectors × 14 slots ID 중복 0', () => {
      const all = generateAllSectorPersonas();
      const ids = all.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('모든 systemPrompt 길이 ≥ 300 (Kevin v3.1 inquiry pattern minimum)', () => {
      const all = generateAllSectorPersonas();
      for (const c of all) {
        expect(c.systemPrompt.length).toBeGreaterThanOrEqual(300);
      }
    });
  });

  // omxy R1 BLOCKER 5 invariant tests (53차 Step 3b R2 박제)
  describe('omxy R1 fixes — invariant tests', () => {
    it('BLOCKER 1: slot 1~12 + sub_tag suffix → parseSectorPersonaId null', () => {
      expect(parseSectorPersonaId('sector-바이오-slot-1-subtag-조선')).toBeNull();
      expect(parseSectorPersonaId('sector-반도체-slot-12-subtag-제약')).toBeNull();
      expect(parseSectorPersonaId('sector-IT/SW-slot-5-subtag-게임')).toBeNull();
    });

    it('BLOCKER 1: slot 13/14 + unknown sub_tag → parseSectorPersonaId null', () => {
      expect(parseSectorPersonaId('sector-바이오-slot-13-subtag-비존재')).toBeNull();
      expect(parseSectorPersonaId('sector-운송/물류-slot-14-subtag-fake')).toBeNull();
    });

    it('BLOCKER 2: cross-sector subtag mismatch → null', () => {
      // 조선 sub_tag의 primary는 운송/물류 — 바이오에 attach는 invalid
      expect(parseSectorPersonaId('sector-바이오-slot-13-subtag-조선')).toBeNull();
      // 제약은 바이오 primary — 반도체에 attach는 invalid
      expect(parseSectorPersonaId('sector-반도체-slot-13-subtag-제약')).toBeNull();
      // 가전은 유통/소비재 primary — 자동차에 attach는 invalid
      expect(parseSectorPersonaId('sector-자동차-slot-13-subtag-가전')).toBeNull();
    });

    it('BLOCKER 2: sub_tag primary == sector OR secondary == sector → valid', () => {
      // 조선 primary = 운송/물류 → OK
      expect(parseSectorPersonaId('sector-운송/물류-slot-13-subtag-조선')).not.toBeNull();
      // 제약 primary = 바이오 → OK
      expect(parseSectorPersonaId('sector-바이오-slot-13-subtag-제약')).not.toBeNull();
      // 게임 secondary = 엔터/미디어 → OK
      expect(parseSectorPersonaId('sector-엔터/미디어-slot-13-subtag-게임')).not.toBeNull();
      // 게임 primary = IT/SW → OK
      expect(parseSectorPersonaId('sector-IT/SW-slot-13-subtag-게임')).not.toBeNull();
    });

    it('BLOCKER 5: resolveSectorPersona returned contract.id === requested id', () => {
      const cases = [
        'sector-바이오-slot-1',
        'sector-반도체-slot-11',
        'sector-IT/SW-slot-14',
        'sector-운송/물류-slot-13-subtag-조선',
        'sector-바이오-slot-13-subtag-제약',
      ];
      for (const id of cases) {
        const c = resolveSectorPersona(id);
        expect(c).not.toBeNull();
        expect(c!.id).toBe(id);
      }
    });

    it('BLOCKER 5: malformed IDs all return null in resolveSectorPersona', () => {
      const malformed = [
        'sector-바이오-slot-1-subtag-조선', // slot 1 + sub_tag
        'sector-바이오-slot-13-subtag-비존재', // unknown subtag
        'sector-바이오-slot-13-subtag-조선', // cross-sector mismatch
        'peter-lynch', // Core 11
        'sector-비존재-slot-1', // invalid sector
        'sector-바이오-slot-15', // invalid slot
      ];
      for (const id of malformed) {
        expect(resolveSectorPersona(id)).toBeNull();
      }
    });

    it('BLOCKER 3 + B: 14 sectors × 4 high-risk slots = 56 adjustments full coverage', () => {
      // Step 3b §5 fanout 완료 — 14 sectors 모두 high-risk slot adjustment 정의됨.
      const highRiskSlots = [4, 5, 8, 10];
      for (const sector of CANONICAL_SECTORS) {
        for (const slotIdx of highRiskSlots) {
          const tmpl = resolveSlotTemplate(sector, []);
          const slot = tmpl[slotIdx - 1];
          const c = buildSectorPersonaContract(sector, slot);
          expect(c.systemPrompt).toContain('섹터-특화 adjustment');
        }
      }
    });

    it('BLOCKER A: SECTOR_BASE_SLOT_ADJUSTMENTS key는 모두 BASE_SLOTS 서브셋 (typo 차단)', () => {
      // BaseSlotRole type-tightened 후 typo는 컴파일 차단. 추가로 runtime 검증.
      const validKeys = new Set<string>(BASE_SLOTS);
      for (const sector of Object.keys(SECTOR_BASE_SLOT_ADJUSTMENTS) as Array<keyof typeof SECTOR_BASE_SLOT_ADJUSTMENTS>) {
        const adj = SECTOR_BASE_SLOT_ADJUSTMENTS[sector];
        if (adj === undefined) continue;
        for (const key of Object.keys(adj)) {
          expect(validKeys).toContain(key);
        }
      }
    });

    it('BLOCKER A: high-risk slot 4 keys = domestic_special_expert (BASE_SLOTS[3])', () => {
      expect(BASE_SLOTS[3]).toBe('domestic_special_expert');
      expect(BASE_SLOTS[4]).toBe('domestic_academic');
      expect(BASE_SLOTS[7]).toBe('global_industry_veteran');
      expect(BASE_SLOTS[9]).toBe('global_adjacent_expert');
    });

    it('BLOCKER C: buildSectorPersonaContract direct call cross-sector mismatch → throw', () => {
      // sector='바이오' with slot.sub_tag='조선' (cross-sector) → throw
      expect(() => {
        buildSectorPersonaContract('바이오', {
          slot_index: 13,
          slot_type: 'sub_tag_overlay',
          role: '조선 PE/PC 엔지니어',
          sub_tag: '조선',
        });
      }).toThrow(/sub_tag_sector_mismatch/);

      // 반도체 + 제약 (제약 primary=바이오) → throw
      expect(() => {
        buildSectorPersonaContract('반도체', {
          slot_index: 14,
          slot_type: 'sub_tag_overlay',
          role: '제약 R&D 임원',
          sub_tag: '제약',
        });
      }).toThrow(/sub_tag_sector_mismatch/);
    });

    it('BLOCKER C: unknown sub_tag → throw', () => {
      expect(() => {
        buildSectorPersonaContract('바이오', {
          slot_index: 13,
          slot_type: 'sub_tag_overlay',
          role: 'fake role',
          sub_tag: '비존재',
        });
      }).toThrow(/unknown_sub_tag/);
    });

    it('BLOCKER C: valid sub_tag combination (primary or secondary) → no throw', () => {
      // 운송/물류 + 조선 (primary 매치) → OK
      expect(() => {
        buildSectorPersonaContract('운송/물류', {
          slot_index: 13,
          slot_type: 'sub_tag_overlay',
          role: '조선 PE/PC 엔지니어',
          sub_tag: '조선',
        });
      }).not.toThrow();

      // 엔터/미디어 + 게임 (secondary 매치) → OK
      expect(() => {
        buildSectorPersonaContract('엔터/미디어', {
          slot_index: 14,
          slot_type: 'sub_tag_overlay',
          role: 'IP/콘텐츠 라이센싱',
          sub_tag: '게임',
        });
      }).not.toThrow();
    });

    it('BLOCKER 4: Kevin v3.1 inquiry pattern reframing 적용 (53차 Layer g 후 KEVIN_V31_RUBRIC_INSTRUCTION 경유)', () => {
      const slot = resolveSlotTemplate('바이오', [])[0];
      const c = buildSectorPersonaContract('바이오', slot);
      // inquiry pattern + 4 axes 명시 (KEVIN_V31_RUBRIC_INSTRUCTION 안)
      expect(c.systemPrompt).toContain('Kevin v3.1 inquiry pattern');
      expect(c.systemPrompt).toContain('Q1:');
      expect(c.systemPrompt).toContain('Q4:');
      // 일상 비유 marker (M7 enforce, 강제 + 영어 약자 풀이 시 사용)
      expect(c.systemPrompt).toContain('일상 비유');
    });

    it('BLOCKER 5: 모든 systemPrompt에 sector + slot role + sector-specific keyword 포함', () => {
      // 5 prototype sectors의 high-risk slot에서 sector-specific keyword (philosophy 첫 문장에서 추출) 확인
      const checks: Array<{ sector: 'CanonicalSector' | string; keyword: string }> = [
        { sector: '바이오', keyword: '임상' },
        { sector: '반도체', keyword: '사이클' },
        { sector: '건설', keyword: '수주' },
        { sector: '금융', keyword: 'NIM' },
        { sector: 'IT/SW', keyword: 'SaaS' },
      ];
      for (const { sector, keyword } of checks) {
        const tmpl = resolveSlotTemplate(sector as never, []);
        for (const slot of tmpl) {
          const c = buildSectorPersonaContract(sector as never, slot);
          expect(c.systemPrompt).toContain(sector);
          // sector philosophy 키워드 포함 (sector context가 system prompt에 반영됨을 보장)
          expect(c.systemPrompt).toContain(keyword);
        }
      }
    });
  });
});
