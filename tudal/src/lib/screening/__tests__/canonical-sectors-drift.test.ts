/**
 * Python ↔ TS canonical sector list drift detector (B66 C 하이브리드, plan PR #55).
 *
 * Production TS SoT = tudal/src/lib/screening/canonical-sectors.ts::CANONICAL_SECTORS (14 sector).
 * Python mapper  = scripts/canonical_sector_mapper.py::CANONICAL_SECTORS.
 *
 * Plan R1 lock-in (§6 Test 6): production TS SoT를 그대로 두고, 본 drift test가 Python 파일을
 * 읽어 두 list가 정확히 같은 순서와 원소 14개로 일치하는지 검증한다. canonical-sectors.ts는
 * Python JSON을 import하지 않음 (R1 fix — TS SoT 유지).
 *
 * 실패 시 → 한쪽이 변경되었으나 다른 쪽 미반영. 두 파일을 동기화하는 PR 필요.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CANONICAL_SECTORS, SUB_TAG_CROSSWALK } from "../canonical-sectors";

const __dirname_local = dirname(fileURLToPath(import.meta.url));
const PYTHON_MAPPER_PATH = resolve(
  __dirname_local,
  "../../../../../scripts/canonical_sector_mapper.py",
);

function extractPythonCanonicalSectors(source: string): readonly string[] {
  // 정규식으로 CANONICAL_SECTORS = (...) tuple 본문 추출.
  // 예: CANONICAL_SECTORS: tuple[str, ...] = (\n    "바이오",\n    "반도체",\n    ...\n)
  const m = source.match(/CANONICAL_SECTORS\s*:\s*tuple\[str,\s*\.\.\.\]\s*=\s*\(([^)]+)\)/);
  if (!m) {
    throw new Error(
      "canonical_sector_mapper.py에서 CANONICAL_SECTORS tuple 블록을 찾지 못했습니다.",
    );
  }
  const body = m[1];
  // 각 라인의 따옴표 안 string 추출 (한국어/영어 포함, slash 등 허용)
  const matches = body.match(/"([^"]+)"/g) || [];
  return matches.map((s) => s.slice(1, -1));
}

describe("Python ↔ TS canonical sectors drift", () => {
  it("reads Python mapper CANONICAL_SECTORS without exception", () => {
    expect(() => readFileSync(PYTHON_MAPPER_PATH, "utf-8")).not.toThrow();
  });

  it("Python and TS lists have same length (14)", () => {
    const source = readFileSync(PYTHON_MAPPER_PATH, "utf-8");
    const pythonList = extractPythonCanonicalSectors(source);
    expect(pythonList.length).toBe(14);
    expect(CANONICAL_SECTORS.length).toBe(14);
  });

  it("Python and TS lists match element-by-element in same order", () => {
    const source = readFileSync(PYTHON_MAPPER_PATH, "utf-8");
    const pythonList = extractPythonCanonicalSectors(source);
    expect(pythonList).toEqual([...CANONICAL_SECTORS]);
  });

  it("Python and TS lists have identical element sets (orderless)", () => {
    const source = readFileSync(PYTHON_MAPPER_PATH, "utf-8");
    const pythonSet = new Set(extractPythonCanonicalSectors(source));
    const tsSet = new Set(CANONICAL_SECTORS);
    expect(pythonSet).toEqual(tsSet);
  });
});

describe("canonical-sectors.ts production SoT invariants (B66 R1 lock-in)", () => {
  it("does NOT import scripts/ JSON or Python module (TS SoT 유지)", () => {
    const tsPath = resolve(__dirname_local, "../canonical-sectors.ts");
    const tsSource = readFileSync(tsPath, "utf-8");
    expect(tsSource).not.toMatch(/canonical_sectors\.shared\.json/);
    expect(tsSource).not.toMatch(/canonical_sector_mapper\.py/);
    expect(tsSource).not.toMatch(/from\s+["']\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/scripts/);
  });

  it("has exactly 14 canonical sectors", () => {
    expect(CANONICAL_SECTORS.length).toBe(14);
  });

  it("keeps SUB_TAG_CROSSWALK vocabulary in TS SoT only", () => {
    expect(Object.keys(SUB_TAG_CROSSWALK).sort()).toEqual(
      ["가전", "게임", "방산", "부동산", "조선", "제약", "화학"].sort(),
    );
  });

  it("Python mapper does not generate sub_tags", () => {
    const source = readFileSync(PYTHON_MAPPER_PATH, "utf-8");
    expect(source).not.toMatch(/sub_tags\s*[=:]/);
    expect(source).not.toMatch(/SUB_TAG_CROSSWALK/);
  });
});
