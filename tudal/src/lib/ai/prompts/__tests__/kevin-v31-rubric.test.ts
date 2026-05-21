import { describe, it, expect } from "vitest";
import {
  KEVIN_V31_INQUIRY_AXES,
  KEVIN_V31_QUALITY_MARKERS,
  KEVIN_V31_RUBRIC_INSTRUCTION,
  applyKevinV31Rubric,
} from "../kevin-v31-rubric";

describe("kevin-v31-rubric", () => {
  describe("KEVIN_V31_INQUIRY_AXES", () => {
    it("contains exactly 4 axes Q1~Q4", () => {
      expect(KEVIN_V31_INQUIRY_AXES).toHaveLength(4);
      KEVIN_V31_INQUIRY_AXES.forEach((axis, i) => {
        expect(axis).toContain(`Q${i + 1}:`);
      });
    });

    it("axes Q1~Q4 cover 사업 모델 / catalyst / valuation / invalidation", () => {
      const joined = KEVIN_V31_INQUIRY_AXES.join(" | ");
      expect(joined).toContain("사업 모델");
      expect(joined).toContain("catalyst");
      expect(joined).toContain("peer multiple");
      expect(joined).toContain("invalidation");
    });
  });

  describe("KEVIN_V31_QUALITY_MARKERS", () => {
    it("contains exactly 8 markers M1~M8", () => {
      const keys = Object.keys(KEVIN_V31_QUALITY_MARKERS);
      expect(keys).toHaveLength(8);
      expect(keys).toEqual([
        "M1_inquiry_axes",
        "M2_financial_cite",
        "M3_no_fabrication",
        "M4_peer_comparison",
        "M5_valuation_trial",
        "M6_judgment_exposure",
        "M7_beginner_friendly",
        "M8_argument_cap",
      ]);
    });

    it("each marker has non-empty substring value", () => {
      Object.values(KEVIN_V31_QUALITY_MARKERS).forEach((marker) => {
        expect(typeof marker).toBe("string");
        expect(marker.length).toBeGreaterThan(0);
      });
    });
  });

  describe("KEVIN_V31_RUBRIC_INSTRUCTION", () => {
    it("contains all 8 marker substrings (CI invariant)", () => {
      const instruction = KEVIN_V31_RUBRIC_INSTRUCTION;
      Object.entries(KEVIN_V31_QUALITY_MARKERS).forEach(([key, marker]) => {
        expect(instruction, `marker ${key} (${marker}) not found in rubric instruction`).toContain(marker);
      });
    });

    it("contains 4 inquiry axes Q1~Q4 labels", () => {
      const instruction = KEVIN_V31_RUBRIC_INSTRUCTION;
      ["Q1:", "Q2:", "Q3:", "Q4:"].forEach((label) => {
        expect(instruction).toContain(label);
      });
    });

    it("explicitly forbids meta analysis terms in body output", () => {
      // rubric instruction은 본문 금지 단어 ("Peer 5축", "Pure-play", "Bridge")를 "금지" 문맥에서 명시
      const instruction = KEVIN_V31_RUBRIC_INSTRUCTION;
      expect(instruction).toContain("메타 분석 용어");
      expect(instruction).toContain("출현 금지");
    });

    it("mentions persona individuality wrapper principle", () => {
      const instruction = KEVIN_V31_RUBRIC_INSTRUCTION;
      // wrapper 원칙 명시: persona 고유 원칙은 답변에 선행, rubric은 표현 방식에만 적용
      expect(instruction).toContain("페르소나 고유 평가 원칙");
      expect(instruction).toContain("wrapper");
    });
  });

  describe("applyKevinV31Rubric", () => {
    it("preserves core principle text (persona individuality wrapper)", () => {
      const core = "당신은 워런 버핏입니다. 해자·이해도·경영진·가격을 봅니다.";
      const result = applyKevinV31Rubric(core);
      expect(result).toContain(core);
      expect(result).toContain(KEVIN_V31_RUBRIC_INSTRUCTION);
      // core가 rubric보다 먼저 등장 (wrapper 원칙)
      expect(result.indexOf(core)).toBeLessThan(
        result.indexOf(KEVIN_V31_RUBRIC_INSTRUCTION),
      );
    });

    it("appends sector context when provided (Tier 2 case)", () => {
      const core = "당신은 바이오 도메스틱 인사이더입니다.";
      const sector =
        "바이오는 임상 결과 1건이 시총을 2배로 만들거나 80% 날려버리는 binary 산업입니다.";
      const result = applyKevinV31Rubric(core, sector);
      expect(result).toContain(core);
      expect(result).toContain(sector);
      expect(result).toContain(KEVIN_V31_RUBRIC_INSTRUCTION);
      // 순서: core → sector → rubric
      expect(result.indexOf(core)).toBeLessThan(result.indexOf(sector));
      expect(result.indexOf(sector)).toBeLessThan(
        result.indexOf(KEVIN_V31_RUBRIC_INSTRUCTION),
      );
    });

    it("omits sector block when sectorContext undefined (Core 11 case)", () => {
      const core = "당신은 워런 버핏입니다.";
      const result = applyKevinV31Rubric(core);
      // Core 11은 core → rubric만. sector context 없음.
      const coreIdx = result.indexOf(core);
      const rubricIdx = result.indexOf(KEVIN_V31_RUBRIC_INSTRUCTION);
      expect(coreIdx).toBeGreaterThanOrEqual(0);
      expect(rubricIdx).toBeGreaterThan(coreIdx);
      // core 끝과 rubric 시작 사이에는 \n\n만 존재 (sector block 0)
      const between = result.substring(coreIdx + core.length, rubricIdx);
      expect(between).toBe("\n\n");
    });

    it("omits sector block when sectorContext is empty string (omxy R1 BLOCKER 1)", () => {
      const core = "당신은 워런 버핏입니다.";
      const result = applyKevinV31Rubric(core, "");
      const coreIdx = result.indexOf(core);
      const rubricIdx = result.indexOf(KEVIN_V31_RUBRIC_INSTRUCTION);
      const between = result.substring(coreIdx + core.length, rubricIdx);
      // sectorContext === "" 전달 시에도 sector block 0 (\n\n\n\n 발생 금지)
      expect(between).toBe("\n\n");
    });

    it("omits sector block when sectorContext is whitespace-only", () => {
      const core = "당신은 워런 버핏입니다.";
      const result = applyKevinV31Rubric(core, "   \n  \t  ");
      const coreIdx = result.indexOf(core);
      const rubricIdx = result.indexOf(KEVIN_V31_RUBRIC_INSTRUCTION);
      const between = result.substring(coreIdx + core.length, rubricIdx);
      expect(between).toBe("\n\n");
    });

    it("trims sector context whitespace before injecting", () => {
      const core = "Core principle.";
      const sector = "  바이오는 binary 산업입니다.  ";
      const result = applyKevinV31Rubric(core, sector);
      // trimmed version만 inject
      expect(result).toContain("바이오는 binary 산업입니다.");
      // leading/trailing whitespace 그대로 inject 금지
      expect(result).not.toContain("  바이오는");
      expect(result).not.toContain("산업입니다.  ");
    });

    it("result contains all 8 markers via rubric injection", () => {
      const core = "당신은 워런 버핏입니다.";
      const result = applyKevinV31Rubric(core);
      Object.entries(KEVIN_V31_QUALITY_MARKERS).forEach(([key, marker]) => {
        expect(result, `marker ${key} (${marker}) missing in composed prompt`).toContain(marker);
      });
    });
  });
});
