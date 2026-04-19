import { computeCostKrw } from "@/lib/cost/anthropic-pricing";
import type { CostLog, CostPurpose } from "@/types/admin";

// ---------------------------------------------------------------------------
// M17 cost_log mock fixture (S6)
// 2026-04 한 달치 가짜 비용 적재 — base 시나리오 ~270k KRW (35만 경보 미달, 정상 운용 예시).
// 별도 OVER_LIMIT 시드는 검증용으로 별도 export.
// ---------------------------------------------------------------------------

const MONTH = "2026-04-01";
const MODEL_SONNET = "claude-sonnet-4-6";
const MODEL_OPUS = "claude-opus-4-7";

let seq = 0;
function nextId(): string {
  seq += 1;
  return `cost-${String(seq).padStart(4, "0")}`;
}

function makeLog(
  ts: string,
  purpose: CostPurpose,
  model: string,
  tokensIn: number,
  tokensOut: number,
  ticker: string | null,
  personaId: string | null,
  section: string | null,
): CostLog {
  return {
    id: nextId(),
    ts,
    month: MONTH,
    model,
    purpose,
    ticker,
    personaId,
    section,
    tokensPrompt: tokensIn,
    tokensCompletion: tokensOut,
    costKrw: computeCostKrw(model, tokensIn, tokensOut),
  };
}

const logs: CostLog[] = [];

// 1) Short List 1회 (4월 1일 09:05 KST 배치)
logs.push(
  makeLog(
    "2026-04-01T00:05:00Z",
    "shortlist",
    MODEL_SONNET,
    80_000,
    4_000,
    null,
    null,
    "short_list",
  ),
);

// 2) 30종 × 9 섹션 리포트 (4월 1일 ~ 4월 2일 사이) — 대표 5종만 적재 + 나머지 25종 합산 stub 1건씩
const REPRESENTATIVE_TICKERS = ["005930", "000660", "035720", "035420", "207940"];
REPRESENTATIVE_TICKERS.forEach((ticker, tIdx) => {
  for (let sec = 0; sec <= 8; sec += 1) {
    logs.push(
      makeLog(
        `2026-04-0${1 + Math.floor(tIdx / 3)}T${String(2 + tIdx).padStart(2, "0")}:${String(sec * 5).padStart(2, "0")}:00Z`,
        "report",
        MODEL_SONNET,
        6_000,
        1_500,
        ticker,
        null,
        `section_${sec}`,
      ),
    );
  }
});
// 나머지 25종 — 종목별 합산 1건씩 (mock 단순화)
for (let i = 0; i < 25; i += 1) {
  const ticker = `R${String(100 + i).padStart(4, "0")}`;
  logs.push(
    makeLog(
      `2026-04-0${1 + (i % 2)}T${String(10 + (i % 12)).padStart(2, "0")}:00:00Z`,
      "report",
      MODEL_SONNET,
      6_000 * 9,
      1_500 * 9,
      ticker,
      null,
      "sections_0_8_bundle",
    ),
  );
}

// 3) 투심위 — 30종 × 16 페르소나 = 480 votes. 5 대표 종목만 페르소나별 명시 + 나머지 25종 합산.
const CORE_PERSONAS = ["core-buffett", "core-soros", "core-lynch", "core-druckenmiller"];
REPRESENTATIVE_TICKERS.forEach((ticker, tIdx) => {
  CORE_PERSONAS.forEach((persona, pIdx) => {
    logs.push(
      makeLog(
        `2026-04-0${1 + Math.floor(tIdx / 3)}T${String(15 + pIdx).padStart(2, "0")}:${String(tIdx * 7).padStart(2, "0")}:00Z`,
        "committee",
        MODEL_SONNET,
        4_000,
        600,
        ticker,
        persona,
        null,
      ),
    );
  });
});
// 나머지 25종 + 12 페르소나는 종목별 합산 1건
for (let i = 0; i < 25; i += 1) {
  const ticker = `R${String(100 + i).padStart(4, "0")}`;
  logs.push(
    makeLog(
      `2026-04-0${1 + (i % 2)}T${String(16 + (i % 8)).padStart(2, "0")}:30:00Z`,
      "committee",
      MODEL_SONNET,
      4_000 * 16,
      600 * 16,
      ticker,
      null,
      null,
    ),
  );
}

// 4) 모닝 브리핑 — 4월 1일 ~ 4월 19일 (현재 22차 시점)
for (let day = 1; day <= 19; day += 1) {
  logs.push(
    makeLog(
      `2026-04-${String(day).padStart(2, "0")}T23:00:00Z`,
      "briefing",
      MODEL_SONNET,
      4_000,
      1_500,
      null,
      null,
      "morning",
    ),
  );
}

// 5) 재생성 — 종목 2건 manual 1회씩 (Reject 후 재분석 X)
logs.push(
  makeLog(
    "2026-04-10T05:00:00Z",
    "regenerate",
    MODEL_OPUS,
    50_000,
    12_000,
    "005930",
    null,
    "sections_0_8_bundle",
  ),
);
logs.push(
  makeLog(
    "2026-04-15T07:30:00Z",
    "regenerate",
    MODEL_SONNET,
    50_000,
    12_000,
    "000660",
    null,
    "sections_0_8_bundle",
  ),
);

export const MOCK_ADMIN_COST_LOG: CostLog[] = logs;

// 검증용 — 35만 경보 강제 트리거 (40만 hardcap 미만, 별도 month로 격리)
// Opus 5M in + 2.5M out = (75 + 187.5) USD × 1430 = ₩375,375 → 경보 ✅ / hardcap ✗
export const MOCK_ADMIN_COST_LOG_OVER_WARNING: CostLog[] = [
  {
    id: "cost-warn-001",
    ts: "2026-03-15T05:00:00Z",
    month: "2026-03-01",
    model: MODEL_OPUS,
    purpose: "report",
    ticker: "TEST",
    personaId: null,
    section: "stress_test",
    tokensPrompt: 5_000_000,
    tokensCompletion: 2_500_000,
    costKrw: computeCostKrw(MODEL_OPUS, 5_000_000, 2_500_000),
  },
];

// 검증용 — 40만 hardcap 강제 트리거 (재생성 차단 테스트용)
// Opus 6M in + 3M out = (90 + 225) USD × 1430 = ₩450,450 → 경보 ✅ / hardcap ✅
export const MOCK_ADMIN_COST_LOG_OVER_HARDCAP: CostLog[] = [
  {
    id: "cost-cap-001",
    ts: "2026-02-20T05:00:00Z",
    month: "2026-02-01",
    model: MODEL_OPUS,
    purpose: "report",
    ticker: "TEST",
    personaId: null,
    section: "stress_test",
    tokensPrompt: 6_000_000,
    tokensCompletion: 3_000_000,
    costKrw: computeCostKrw(MODEL_OPUS, 6_000_000, 3_000_000),
  },
];
