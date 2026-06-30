import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

// ---------------------------------------------------------------------------
// G4 가드레일 박제 (spec §1.1 / §6): @/lib/macro 는 "AI 컨텍스트 입력" 전용이며
// Tier0 스크리닝/정량 funnel 코드에서 import 되어선 안 된다(numeric factor 금지).
// 새 importer가 생기면 이 테스트가 실패 → allowlist를 의식적으로 갱신하게 강제한다.
// ---------------------------------------------------------------------------

const SRC = join(process.cwd(), "src");

// @/lib/macro 를 import 해도 되는 합법 consumer (G4 3 consumer + seam). 상대경로(src 기준).
// 주의: persona-panel-adapter.ts 는 macroContextString 을 deps 로 전달받아 pass-through 할 뿐
//   @/lib/macro 를 import 하지 않는다(주입자 = selection-worker). 그래서 allowlist에 없다.
// 주의: fred-adapter.ts / verdict-builder.ts 는 lib/macro/ 내부 파일이지만 '@/lib/macro/*' 가 아니라
//   상대경로(./context, ./verdict-builder)로 import 하므로 MACRO_IMPORT_RE에 잡히지 않는다 → allowlist 불필요.
const ALLOWLIST = new Set(
  [
    "lib/macro/source.ts", // context distill seam (+ FRED 어댑터 호출)
    "lib/report/report-input-enricher.ts", // 리포트 writer 컨텍스트
    "app/api/cron/morning-briefing/route.ts", // 모닝 브리핑(M11)
    "lib/screening/persona-eval.ts", // Tier1 (dangling runMonthlyPersonaEval — 무해 dormant)
    "app/api/cron/monthly-batch/selection-worker/route.ts", // LIVE 선정 cron (macro 주입자)
    "lib/report/full-report-batch-worker.ts", // G4: 리포트 batch chunk당 1회 fetch(직접 import)
  ].map((p) => p.split("/").join(sep)),
);

// Tier0/정량 funnel 핵심 모듈 — 절대 macro 를 import 하면 안 됨(명시 deny, allowlist와 중복이나 가독성).
const TIER0_FUNNEL_DENY = [
  "lib/screening/consensus.ts",
  "lib/screening/tier1-schema.ts",
  "lib/screening/judge-stage.ts",
  "lib/screening/incumbent-merge.ts",
  "lib/screening/selection-period.ts",
];

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "node_modules") continue;
      out.push(...walkTsFiles(full));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const MACRO_IMPORT_RE =
  /(?:from\s+["']@\/lib\/macro|import\s+["']@\/lib\/macro|import\s*\(\s*["']@\/lib\/macro)/;

describe("G4 guardrail — @/lib/macro import allowlist (박제)", () => {
  it("only the allowlisted consumers import @/lib/macro (no Tier0/funnel leak)", () => {
    const importers: string[] = [];
    for (const file of walkTsFiles(SRC)) {
      const text = readFileSync(file, "utf8");
      if (MACRO_IMPORT_RE.test(text)) {
        importers.push(relative(SRC, file));
      }
    }
    const unexpected = importers.filter((f) => !ALLOWLIST.has(f));
    expect(unexpected, `Unexpected @/lib/macro importers: ${unexpected.join(", ")}`).toEqual([]);
    // G4: 외부 importer는 정확히 6개(allowlist 전부 실재). fred-adapter/verdict-builder는 상대경로 import → 비포함.
    expect(importers.length).toBe(6);
    // LIVE 선정 cron이 실제로 macro를 주입하는지(드리프트 방지) 최소 sanity.
    expect(importers).toContain(
      ["app", "api", "cron", "monthly-batch", "selection-worker", "route.ts"].join(sep),
    );
  });

  it("Tier0/funnel 핵심 모듈은 @/lib/macro 를 import 하지 않는다", () => {
    for (const rel of TIER0_FUNNEL_DENY) {
      const full = join(SRC, rel.split("/").join(sep));
      if (!existsSync(full)) continue; // 모듈 이동/리네임 시 skip(테스트 false-fail 방지)
      const text = readFileSync(full, "utf8");
      expect(MACRO_IMPORT_RE.test(text), `${rel} must not import @/lib/macro`).toBe(false);
    }
  });
});
