import {
  type PipelineHealth,
  type PipelineHealthSummary,
  type PipelineKind,
  type Severity,
  PIPELINE_HEALTH_CRITICAL_THRESHOLD,
  PIPELINE_HEALTH_WARNING_THRESHOLD,
  PIPELINE_HEALTH_WINDOW_HOURS,
} from "@/types/admin";

// ---------------------------------------------------------------------------
// M18 파이프라인 헬스체크 집계 (S5a T5a.4)
// ref: ServicePlan-Admin §3.12 R3.12-4
//
// 5개 파이프라인(dart · news · price · ai · alert) 최근 24h 성공률 집계.
// successRate < 95% → critical 배너 · < 99% → warning · 이상 → info.
// ---------------------------------------------------------------------------

export const KNOWN_PIPELINES: PipelineKind[] = [
  "dart",
  "news",
  "price",
  "ai",
  "alert",
];

export const PIPELINE_LABEL: Record<PipelineKind, string> = {
  dart: "공시 (DART)",
  news: "뉴스",
  price: "시세",
  ai: "AI 판정",
  alert: "알림 발송",
};

interface AggregateOptions {
  now?: Date;
  windowHours?: number;
}

export function severityFromRate(rate: number): Severity {
  if (rate < PIPELINE_HEALTH_CRITICAL_THRESHOLD) return "critical";
  if (rate < PIPELINE_HEALTH_WARNING_THRESHOLD) return "warning";
  return "info";
}

export function aggregatePipelineHealth(
  records: PipelineHealth[],
  opts: AggregateOptions = {},
): PipelineHealthSummary[] {
  const now = opts.now ?? new Date();
  const windowMs = (opts.windowHours ?? PIPELINE_HEALTH_WINDOW_HOURS) * 3600 * 1000;
  const cutoff = now.getTime() - windowMs;

  const byPipeline = new Map<PipelineKind, PipelineHealth[]>();
  KNOWN_PIPELINES.forEach((p) => byPipeline.set(p, []));

  for (const rec of records) {
    if (new Date(rec.startedAt).getTime() < cutoff) continue;
    if (!byPipeline.has(rec.pipeline)) continue;
    byPipeline.get(rec.pipeline)!.push(rec);
  }

  const summaries: PipelineHealthSummary[] = KNOWN_PIPELINES.map((pipeline) => {
    const runs = byPipeline.get(pipeline) ?? [];
    const total = runs.length;
    const success = runs.filter((r) => r.status === "success").length;
    const failed = runs.filter((r) => r.status === "failed").length;
    const rate = total === 0 ? 1 : success / total;
    const latencies = runs
      .map((r) => r.latencyMs)
      .filter((v): v is number => typeof v === "number");
    const avgLatency =
      latencies.length === 0
        ? null
        : latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const sorted = [...runs].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
    return {
      pipeline,
      total24h: total,
      success24h: success,
      failed24h: failed,
      successRate: rate,
      avgLatencyMs: avgLatency,
      lastRun: sorted[0] ?? null,
      severity: total === 0 ? "warning" : severityFromRate(rate),
    };
  });

  return summaries;
}

// 최근 실패 트레이스 N건 (기본 50) — /admin/settings/health 하단 로그 tail
export function recentFailures(
  records: PipelineHealth[],
  limit = 50,
): PipelineHealth[] {
  return records
    .filter((r) => r.status === "failed")
    .sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )
    .slice(0, limit);
}

// 전체 상태 판정 — 5개 중 하나라도 critical이면 critical, warning이면 warning, 그 외 info.
export function overallSeverity(summaries: PipelineHealthSummary[]): Severity {
  if (summaries.some((s) => s.severity === "critical")) return "critical";
  if (summaries.some((s) => s.severity === "warning")) return "warning";
  return "info";
}
