// tudal/src/lib/data/__tests__/canonical-sector-personas.test.ts
//
// D21 (52차) Tier 2 mock fixture migration — canonical 14 sectors × 14 personas/sector = 196 stub.
// SoT = ReportFramework §7.2 v2.5 + canonical-sectors.ts.
//
// 본 test는 신규 export `CANONICAL_SECTOR_PERSONAS` + `getCanonicalSectorPersonas()` +
// `CANONICAL_SECTOR_PERSONAS_TOTAL` 검증. legacy 5인 lean은 legacy.5lean.test.ts에서 별도 격리.

import { describe, it, expect } from "vitest";
import {
  CANONICAL_SECTOR_PERSONAS,
  CANONICAL_SECTOR_PERSONAS_TOTAL,
  getCanonicalSectorPersonas,
} from "../mock-admin-committee-personas";
import {
  CANONICAL_SECTORS,
  SECTOR_PERSONA_COUNT,
} from "@/lib/screening/canonical-sectors";

describe("CANONICAL_SECTOR_PERSONAS — 14 sectors × 14 personas = 196 (D21 stub)", () => {
  it("CANONICAL_SECTOR_PERSONAS_TOTAL === 196", () => {
    expect(CANONICAL_SECTOR_PERSONAS_TOTAL).toBe(196);
    expect(CANONICAL_SECTOR_PERSONAS_TOTAL).toBe(CANONICAL_SECTORS.length * SECTOR_PERSONA_COUNT);
  });

  it("CANONICAL_SECTOR_PERSONAS 길이 === 196", () => {
    expect(CANONICAL_SECTOR_PERSONAS).toHaveLength(196);
  });

  it("모든 entry는 layer='sector'", () => {
    expect(CANONICAL_SECTOR_PERSONAS.every((p) => p.layer === "sector")).toBe(true);
  });

  it("모든 entry는 canonical 14 sector 중 하나에 속함", () => {
    const sectorSet = new Set(CANONICAL_SECTORS as readonly string[]);
    for (const p of CANONICAL_SECTOR_PERSONAS) {
      expect(p.sector).toBeDefined();
      expect(sectorSet.has(p.sector!)).toBe(true);
    }
  });

  it("각 canonical sector마다 정확히 14 persona", () => {
    for (const sector of CANONICAL_SECTORS) {
      const personas = CANONICAL_SECTOR_PERSONAS.filter((p) => p.sector === sector);
      expect(personas).toHaveLength(SECTOR_PERSONA_COUNT);
    }
  });

  it("persona ID 패턴 = sector-{canonical}-slot-{1~14}", () => {
    const bioPersonas = CANONICAL_SECTOR_PERSONAS.filter((p) => p.sector === "바이오");
    expect(bioPersonas[0].id).toBe("sector-바이오-slot-1");
    expect(bioPersonas[13].id).toBe("sector-바이오-slot-14");
  });

  it("ID는 전체 unique (Core 11 layer와 분리)", () => {
    const ids = CANONICAL_SECTOR_PERSONAS.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe("getCanonicalSectorPersonas — sub_tags 통합 (D21)", () => {
  it("baseline (sub_tags=[]) → 14 persona 반환", () => {
    const personas = getCanonicalSectorPersonas("바이오");
    expect(personas).toHaveLength(SECTOR_PERSONA_COUNT);
  });

  it("sub_tags=['조선'] + sector=운송/물류 → slot 13·14 sub_tag overlay 활성", () => {
    const personas = getCanonicalSectorPersonas("운송/물류", ["조선"]);
    expect(personas).toHaveLength(SECTOR_PERSONA_COUNT);
    // slot 13·14 (index 12·13)는 sub_tag overlay
    expect(personas[12].bio).toContain("조선");
    expect(personas[13].bio).toContain("조선");
  });

  it("sub_tags=['게임'] + sector=IT/SW → slot 13·14 게임 overlay", () => {
    const personas = getCanonicalSectorPersonas("IT/SW", ["게임"]);
    expect(personas).toHaveLength(SECTOR_PERSONA_COUNT);
    expect(personas[12].bio).toContain("게임");
  });

  it("매칭되지 않은 sub_tag → slot 13·14 = base axis backup (deterministic)", () => {
    const personas = getCanonicalSectorPersonas("반도체", ["unknown_tag"]);
    expect(personas).toHaveLength(SECTOR_PERSONA_COUNT);
    expect(personas[12].bio).toContain("backup");
    expect(personas[13].bio).toContain("backup");
  });
});
