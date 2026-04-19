import type { PipelineHealth, PipelineKind } from "@/types/admin";

// MVP용 mock — S5 실데이터 연결 시 교체 (Supabase SELECT from pipeline_health).
// 5 파이프라인(dart·news·price·ai·alert) 각 24h 내 30~60 run 가정, 일부 failed 섞음.
// 시드: 2026-04-19 09:00 KST 기준으로 24h 역산.

const BASE_TIME = new Date("2026-04-19T00:00:00+09:00").getTime();
const WINDOW_MS = 24 * 60 * 60 * 1000;

interface SeedPlan {
  pipeline: PipelineKind;
  runs: number;
  failedIndexes: number[]; // 몇 번째 run을 failed로 할지
  warningIndexes: number[]; // warning 처리
  avgLatencyMs: number;
}

const SEED_PLANS: SeedPlan[] = [
  // 공시(DART): 거의 완벽 — 0 failed / 60 runs = 100%
  { pipeline: "dart", runs: 60, failedIndexes: [], warningIndexes: [12], avgLatencyMs: 420 },
  // 뉴스: 1 failed / 48 runs = 97.9% (warning 범주)
  { pipeline: "news", runs: 48, failedIndexes: [22], warningIndexes: [30, 41], avgLatencyMs: 680 },
  // 시세: 2 failed / 96 runs = 97.9% (warning)
  { pipeline: "price", runs: 96, failedIndexes: [14, 70], warningIndexes: [50], avgLatencyMs: 140 },
  // AI 판정: 0 failed / 30 runs = 100% (월간 위주)
  { pipeline: "ai", runs: 30, failedIndexes: [], warningIndexes: [], avgLatencyMs: 4300 },
  // 알림: 3 failed / 38 runs = 92.1% (Critical! — R1 완화 증거 시나리오)
  { pipeline: "alert", runs: 38, failedIndexes: [5, 18, 31], warningIndexes: [], avgLatencyMs: 220 },
];

// 결정적 pseudo-random (mulberry32) — SSR 렌더마다 동일 값 보장.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function buildSeed(): PipelineHealth[] {
  const out: PipelineHealth[] = [];
  const rand = mulberry32(20260419);
  SEED_PLANS.forEach((plan) => {
    for (let i = 0; i < plan.runs; i++) {
      const startedMs = BASE_TIME - WINDOW_MS + (i * WINDOW_MS) / plan.runs;
      const latencyJitter = plan.avgLatencyMs * (0.7 + rand() * 0.6);
      const latency = Math.round(latencyJitter);
      const isFailed = plan.failedIndexes.includes(i);
      const isWarning = plan.warningIndexes.includes(i);
      const status = isFailed ? "failed" : isWarning ? "warning" : "success";
      out.push({
        id: `${plan.pipeline}-${i.toString().padStart(3, "0")}`,
        runId: null,
        pipeline: plan.pipeline,
        status,
        startedAt: new Date(startedMs).toISOString(),
        finishedAt: new Date(startedMs + latency).toISOString(),
        latencyMs: latency,
        error: isFailed
          ? `${plan.pipeline} pipeline timeout (mock error for T5a.4 시드)`
          : null,
      });
    }
  });
  return out;
}

export const MOCK_ADMIN_PIPELINE_HEALTH: PipelineHealth[] = buildSeed();
