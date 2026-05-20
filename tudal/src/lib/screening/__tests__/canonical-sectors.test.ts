// tudal/src/lib/screening/__tests__/canonical-sectors.test.ts
//
// SoT = Document/Service/Report/ReportFramework.md §7.2/§7.3 (v2.5, D21 52차)
// canonical-sectors.ts production code import 0 (tests/만) — D21 isolation 보장.

import { describe, it, expect } from "vitest";
import {
  CANONICAL_SECTORS,
  BASE_SLOTS,
  OVERLAY_SLOTS,
  PRIMARY_OVERLAY_BY_SECTOR,
  SUB_TAG_CROSSWALK,
  SUB_TAG_OVERLAY_ROLES,
  LEGACY_ALIAS_MAP,
  isCanonicalSector,
  resolveSubTag,
  type CanonicalSector,
} from "../canonical-sectors";

describe("CANONICAL_SECTORS — 14 fixed (D21)", () => {
  it("contains exactly 14 sectors", () => {
    expect(CANONICAL_SECTORS).toHaveLength(14);
  });

  it("matches ReportFramework §7.3 first column verbatim", () => {
    expect(CANONICAL_SECTORS).toEqual([
      "바이오",
      "반도체",
      "건설",
      "금융",
      "2차전지",
      "자동차",
      "IT/SW",
      "유통/소비재",
      "에너지",
      "엔터/미디어",
      "통신",
      "철강/소재",
      "운송/물류",
      "보험/증권",
    ]);
  });

  it("has no duplicates", () => {
    expect(new Set(CANONICAL_SECTORS).size).toBe(CANONICAL_SECTORS.length);
  });
});

describe("Slot model — 10 base + 4 overlay = 14 personas/sector", () => {
  it("BASE_SLOTS has 10 entries", () => {
    expect(BASE_SLOTS).toHaveLength(10);
  });

  it("OVERLAY_SLOTS has 4 entries (2 primary + 2 sub_tag)", () => {
    expect(OVERLAY_SLOTS).toHaveLength(4);
    expect(OVERLAY_SLOTS.filter((k) => k.startsWith("primary_"))).toHaveLength(2);
    expect(OVERLAY_SLOTS.filter((k) => k.startsWith("sub_tag_"))).toHaveLength(2);
  });

  it("sums to 14 (matches partA.length = 14 in §4.2.1 contract)", () => {
    expect(BASE_SLOTS.length + OVERLAY_SLOTS.length).toBe(14);
  });
});

describe("PRIMARY_OVERLAY_BY_SECTOR — exactly 2 entries per canonical sector", () => {
  it("covers all 14 canonical sectors", () => {
    const keys = Object.keys(PRIMARY_OVERLAY_BY_SECTOR).sort();
    const sorted = [...CANONICAL_SECTORS].sort();
    expect(keys).toEqual(sorted);
  });

  it("each sector has exactly 2 primary overlay roles", () => {
    for (const sector of CANONICAL_SECTORS) {
      const roles = PRIMARY_OVERLAY_BY_SECTOR[sector];
      expect(roles).toHaveLength(2);
      expect(typeof roles[0]).toBe("string");
      expect(typeof roles[1]).toBe("string");
      expect(roles[0]).not.toBe(roles[1]); // 논거 차별화 (R3.7-7 ④ 정신)
    }
  });
});

describe("SUB_TAG_CROSSWALK — D21 §7.3 운영 UI taxonomy proxy 7개", () => {
  it("contains exactly 7 sub_tags (운영 UI proxy)", () => {
    expect(Object.keys(SUB_TAG_CROSSWALK).sort()).toEqual(
      ["가전", "게임", "방산", "부동산", "제약", "조선", "화학"].sort()
    );
  });

  it.each([
    ["조선", "운송/물류"],
    ["방산", "철강/소재"],
    ["화학", "철강/소재"],
    ["게임", "IT/SW"],
    ["가전", "유통/소비재"],
    ["제약", "바이오"],
    ["부동산", "건설"],
  ] satisfies [string, CanonicalSector][])(
    "%s primary = %s (D21 박제 매핑)",
    (sub_tag, expected_primary) => {
      const mapping = SUB_TAG_CROSSWALK[sub_tag];
      expect(mapping.primary).toBe(expected_primary);
    },
  );

  it("게임 has secondary = '엔터/미디어' (deterministic)", () => {
    const game = SUB_TAG_CROSSWALK["게임"];
    expect(game.secondary).toBe("엔터/미디어");
  });

  it("non-게임 sub_tags have no secondary (single canonical resolution)", () => {
    for (const sub_tag of Object.keys(SUB_TAG_CROSSWALK)) {
      if (sub_tag === "게임") continue;
      const mapping = SUB_TAG_CROSSWALK[sub_tag];
      expect(mapping.secondary).toBeUndefined();
    }
  });

  it("all primary targets are canonical 14", () => {
    for (const mapping of Object.values(SUB_TAG_CROSSWALK)) {
      expect(CANONICAL_SECTORS).toContain(mapping.primary);
      if (mapping.secondary !== undefined) {
        expect(CANONICAL_SECTORS).toContain(mapping.secondary);
      }
    }
  });

  it("each sub_tag mapping has a non-empty rationale (운영 분류 사유 명시)", () => {
    for (const mapping of Object.values(SUB_TAG_CROSSWALK)) {
      expect(mapping.rationale.length).toBeGreaterThan(0);
    }
  });
});

describe("SUB_TAG_OVERLAY_ROLES — 7 sub_tags × 2 overlay roles", () => {
  it("covers all 7 sub_tags from SUB_TAG_CROSSWALK", () => {
    expect(Object.keys(SUB_TAG_OVERLAY_ROLES).sort()).toEqual(
      Object.keys(SUB_TAG_CROSSWALK).sort()
    );
  });

  it("each sub_tag has exactly 2 overlay roles (slot 13 · 14)", () => {
    for (const roles of Object.values(SUB_TAG_OVERLAY_ROLES)) {
      expect(roles).toHaveLength(2);
      expect(roles[0]).not.toBe(roles[1]);
    }
  });
});

describe("isCanonicalSector — type guard", () => {
  it("returns true for all canonical 14", () => {
    for (const sector of CANONICAL_SECTORS) {
      expect(isCanonicalSector(sector)).toBe(true);
    }
  });

  it("returns false for non-canonical strings", () => {
    expect(isCanonicalSector("산업재")).toBe(false);
    expect(isCanonicalSector("전기전자")).toBe(false); // D21 broad alias 미지정
    expect(isCanonicalSector("조선")).toBe(false); // sub_tag, not canonical
    expect(isCanonicalSector("방산")).toBe(false);
    expect(isCanonicalSector("")).toBe(false);
  });
});

describe("LEGACY_ALIAS_MAP — 좁은 mock normalization", () => {
  it("does NOT include '전기전자' (broad alias 명시적 미지정 — D-R3-2)", () => {
    expect(LEGACY_ALIAS_MAP["전기전자"]).toBeUndefined();
  });

  it("all alias targets are canonical 14", () => {
    for (const target of Object.values(LEGACY_ALIAS_MAP)) {
      expect(CANONICAL_SECTORS).toContain(target);
    }
  });

  it.each([
    ["의약품", "바이오"],
    ["운수장유", "자동차"],
    ["원전", "에너지"],
    ["전력기기", "에너지"],
    ["서비스업", "IT/SW"],
    ["인터넷플랫폼", "IT/SW"],
    ["지주/건설", "건설"],
  ] satisfies [string, CanonicalSector][])(
    "%s → %s (좁은 alias)",
    (legacy, canonical) => {
      expect(LEGACY_ALIAS_MAP[legacy]).toBe(canonical);
    },
  );
});

describe("resolveSubTag — D21 lookup", () => {
  it("returns mapping for known sub_tags", () => {
    const mapping = resolveSubTag("조선");
    expect(mapping).not.toBeNull();
    expect(mapping?.primary).toBe("운송/물류");
  });

  it("returns null for unknown sub_tags", () => {
    expect(resolveSubTag("우주항공")).toBeNull();
    expect(resolveSubTag("")).toBeNull();
    expect(resolveSubTag("산업재")).toBeNull(); // canonical에도 없고 sub_tag에도 없음
  });

  it("returns null for canonical sectors used as if they were sub_tags", () => {
    expect(resolveSubTag("바이오")).toBeNull(); // 바이오는 canonical, sub_tag 아님
    expect(resolveSubTag("IT/SW")).toBeNull();
  });
});

describe("D21 박제 정합 — partA contract", () => {
  it("base + overlay = 14 (matches §4.2.1 partA.length === 14)", () => {
    const total = BASE_SLOTS.length + OVERLAY_SLOTS.length;
    expect(total).toBe(14);
  });

  it("CANONICAL_SECTORS.length × (base + overlay) = 196 roster total (per ReportFramework §7.2)", () => {
    const personas_per_sector = BASE_SLOTS.length + OVERLAY_SLOTS.length;
    const roster = CANONICAL_SECTORS.length * personas_per_sector;
    expect(roster).toBe(196);
  });
});
