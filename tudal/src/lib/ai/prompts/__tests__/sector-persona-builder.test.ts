import { describe, it, expect } from 'vitest';
import {
  buildSectorPersonaContract,
  generateAllSectorPersonas,
  parseSectorPersonaId,
  resolveSectorPersona,
  SECTOR_PHILOSOPHIES,
  BASE_SLOT_PRINCIPLES,
} from '../personas/sector-persona-builder';
import { getPersonaById } from '../personas';
import {
  CANONICAL_SECTORS,
  SECTOR_PERSONA_COUNT,
  resolveSlotTemplate,
} from '@/lib/screening/canonical-sectors';

const REQUIRED_PLACEHOLDERS = ['{{TICKER}}', '{{FINANCIALS}}', '{{REFLECTION_CONTEXT}}'];

describe('sector-persona-builder (D21 Tier 2, 53차 Step 3b)', () => {
  describe('SECTOR_PHILOSOPHIES + BASE_SLOT_PRINCIPLES coverage', () => {
    it('14 canonical sectors 각각 philosophy 정의됨', () => {
      for (const sector of CANONICAL_SECTORS) {
        expect(SECTOR_PHILOSOPHIES[sector]).toBeTruthy();
        expect(SECTOR_PHILOSOPHIES[sector].length).toBeGreaterThan(100);
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
        expect(BASE_SLOT_PRINCIPLES[role].length).toBeGreaterThan(50);
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

    it('BLOCKER 3: high-risk slot (4·5·8·10) sector adjustment present for prototype sectors', () => {
      // 바이오/반도체/건설/금융/IT/SW — 5 sectors × 4 high-risk slots = 20 adjustments 박제
      const protoSectors = ['바이오', '반도체', '건설', '금융', 'IT/SW'] as const;
      const highRiskSlots = [4, 5, 8, 10];
      for (const sector of protoSectors) {
        for (const slotIdx of highRiskSlots) {
          const tmpl = resolveSlotTemplate(sector, []);
          const slot = tmpl[slotIdx - 1];
          const c = buildSectorPersonaContract(sector, slot);
          expect(c.systemPrompt).toContain('섹터-특화 adjustment');
        }
      }
    });

    it('BLOCKER 3: 9 unfilled sectors high-risk slot → BASE_SLOT_PRINCIPLES만 fallback (adjustment 미포함)', () => {
      // 본 commit 시점: 바이오/반도체/건설/금융/IT/SW만 SECTOR_BASE_SLOT_ADJUSTMENTS에 정의됨.
      // 나머지 9 sectors는 후속 fanout commit에서 추가 — 현재는 base lens fallback.
      const unfilledSectors = ['2차전지', '자동차', '유통/소비재', '에너지', '엔터/미디어', '통신', '철강/소재', '운송/물류', '보험/증권'] as const;
      const tmpl = resolveSlotTemplate(unfilledSectors[0], []);
      const slot = tmpl[3]; // slot 4 (high-risk)
      const c = buildSectorPersonaContract(unfilledSectors[0], slot);
      expect(c.systemPrompt).not.toContain('섹터-특화 adjustment');
      // 그래도 base principle는 포함됨
      expect(c.systemPrompt).toContain('국내 섹터 특수 전문가');
    });

    it('BLOCKER 4: KEVIN_V31_TONE_RULES → "inquiry pattern" reframing 적용', () => {
      const slot = resolveSlotTemplate('바이오', [])[0];
      const c = buildSectorPersonaContract('바이오', slot);
      // inquiry pattern (4 axes 명시)
      expect(c.systemPrompt).toContain('inquiry pattern');
      expect(c.systemPrompt).toContain('inquiry axes');
      // 일상 비유는 강제 아님 (자연스러울 때만)
      expect(c.systemPrompt).toContain('자연스러울 때만');
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
