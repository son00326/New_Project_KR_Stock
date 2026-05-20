// tudal/src/lib/data/__tests__/legacy.5lean.test.ts
//
// D21 (52차) 격리 fixture — 기존 5인 lean 로스터 (21 sectors × 5인 = 110 mock) 보존 검증.
// omxy R2 B1 + D-R2-4: "기존 5 lean 이름/주석은 제거 또는 legacy fixture로 격리".
//
// 본 test file은 기존 SECTOR_ROSTER + SECTOR_PERSONAS + getSectorPersonas() 호환 유지를
// 박제 — UI consumer (`app/(admin)/admin/report/[ticker]/page.tsx`, `mock-admin-committee.ts`)
// 가 점진 마이그 (별도 PR)할 때까지 보존.
//
// 신규 canonical 14×14 = 196 stub은 CANONICAL_SECTOR_PERSONAS + getCanonicalSectorPersonas로 별도.

import { describe, it, expect } from "vitest";
import {
  CORE_PERSONAS,
  SECTOR_PERSONAS,
  getSectorPersonas,
} from "../mock-admin-committee-personas";

describe("legacy 5인 lean sector roster (D21 격리 보존)", () => {
  it("Core 11 그대로 (Sector layer와 분리)", () => {
    expect(CORE_PERSONAS).toHaveLength(11);
    expect(CORE_PERSONAS.every((p) => p.layer === "core")).toBe(true);
  });

  it("기존 SECTOR_PERSONAS는 legacy lean snapshot (length=105, 21 sectors × 5인 또는 일부 미충족 — UI 호환 유지)", () => {
    // 실측 length (UI consumer 호환 박제). 21 sectors × 5 = 105 (일부 sector empty/<5).
    expect(SECTOR_PERSONAS).toHaveLength(105);
    expect(SECTOR_PERSONAS.every((p) => p.layer === "sector")).toBe(true);
  });

  it("getSectorPersonas('반도체') === 5 (legacy lean, UI consumer 호환)", () => {
    expect(getSectorPersonas("반도체")).toHaveLength(5);
  });

  it("getSectorPersonas('바이오') === 5 (legacy lean)", () => {
    expect(getSectorPersonas("바이오")).toHaveLength(5);
  });

  it("legacy persona ID 패턴 = sector-{kr-name}-{1~5} (canonical-sectors.ts와 분리)", () => {
    const banbado = getSectorPersonas("반도체");
    expect(banbado[0].id).toBe("sector-반도체-1");
    expect(banbado[4].id).toBe("sector-반도체-5");
  });

  it("non-existing sector → [] (legacy lean filter)", () => {
    expect(getSectorPersonas("unknown_sector")).toEqual([]);
  });
});
