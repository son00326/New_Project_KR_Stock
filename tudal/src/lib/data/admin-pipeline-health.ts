// tudal/src/lib/data/admin-pipeline-health.ts
// Mock cleanup Step 2.5 (2026-05-28): health page (`/admin/settings/health`)의
// `MOCK_ADMIN_PIPELINE_HEALTH` → 실 `pipeline_health` SELECT 전환.
//
// Step 2.3/2.4 hardening 패턴 정합:
//   - pagination loop (PAGE_SIZE=1000) — 24h window 내 수만 row 누적 시 truncate 차단
//   - monotonic ordering snapshot (`started_at` DESC primary + `id` ASC tiebreak)
//   - schema fail-closed (pipeline / status enum 위반 + non-finite latency_ms throw)
//   - DI seam (`options: { client?: SupabaseClient } = {}`)
//
// 윈도우: 기본 7일 (168h) — page aggregate(24h) + recentFailures(50 most recent)
// 두 use case 모두 cover (failures tail은 24h 외도 포함하므로 여유 윈도우 필요).
// cron 가동 후 trafic 증가 시 windowDays 축소 또는 server-side WHERE 강화 필요
// (현재 production pipeline_health rows=0, 사이즈 미미).
//
// RLS: `using (public.is_admin())` (마이그 0006 §1) — non-admin caller에게 silent-0.
// W-pipeline-health-admin-assertion 박제 (§9.5): cost_log silent-0 패턴 정합,
// hardening = rpc('is_admin') 또는 SECURITY DEFINER RPC. mock parity 유지.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { PipelineHealth, PipelineKind } from "@/types/admin";
import { KNOWN_PIPELINES } from "@/lib/health/pipeline-health";

export interface AdminPipelineHealthOptions {
  client?: SupabaseClient;
  refNow?: Date;
  windowDays?: number;
}

const ALLOWED_STATUS: ReadonlySet<PipelineHealth["status"]> = new Set([
  "success",
  "warning",
  "failed",
]);

interface DbPipelineHealthRow {
  id: string;
  run_id: string | null;
  pipeline: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  latency_ms: number | string | null;
  error: string | null;
}

function transformPipelineHealthRow(row: DbPipelineHealthRow): PipelineHealth {
  // schema fail-closed — enum 위반 row가 page render에서 silent miscount되지 않도록 차단.
  if (!KNOWN_PIPELINES.includes(row.pipeline as PipelineKind)) {
    throw new Error(
      `pipeline_health_select_failed:invalid_pipeline:${row.pipeline}`,
    );
  }
  if (!ALLOWED_STATUS.has(row.status as PipelineHealth["status"])) {
    throw new Error(`pipeline_health_select_failed:invalid_status:${row.status}`);
  }
  let latencyMs: number | null = null;
  if (row.latency_ms !== null) {
    const n = typeof row.latency_ms === "number"
      ? row.latency_ms
      : Number(row.latency_ms);
    if (!Number.isFinite(n)) {
      throw new Error(`pipeline_health_select_failed:non_finite_latency`);
    }
    latencyMs = n;
  }
  return {
    id: row.id,
    runId: row.run_id,
    pipeline: row.pipeline as PipelineKind,
    status: row.status as PipelineHealth["status"],
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    latencyMs,
    error: row.error,
  };
}

const PIPELINE_HEALTH_PAGE_SIZE = 1000;
const PIPELINE_HEALTH_SELECT_COLUMNS = [
  "id",
  "run_id",
  "pipeline",
  "status",
  "started_at",
  "finished_at",
  "latency_ms",
  "error",
].join(", ");

// 기본 7일 윈도우 — page aggregate(24h) + recentFailures(50 most recent, 24h 외 포함)
// 양쪽 use case cover. production traffic 증가 시 page-side에서 windowDays 축소 가능.
export async function getRecentPipelineHealth(
  options: AdminPipelineHealthOptions = {},
): Promise<PipelineHealth[]> {
  const refNow = options.refNow ?? new Date();
  const windowDays = options.windowDays ?? 7;
  const cutoff = new Date(
    refNow.getTime() - windowDays * 24 * 3600 * 1000,
  ).toISOString();

  const supabase = options.client ?? (await createClient());
  const result: PipelineHealth[] = [];
  let offset = 0;
  // 무한 loop 차단: PAGE_SIZE 미만 page 도달 시 break.
  // worst case (5 파이프라인 × 분 단위 run × 7일 = ~50k rows) 대비 50 round trips.
  // 현재 production rows=0이고 cron 가동 후도 단위는 미미.
  for (;;) {
    const { data, error } = await supabase
      .from("pipeline_health")
      .select(PIPELINE_HEALTH_SELECT_COLUMNS)
      .gte("started_at", cutoff)
      .order("started_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + PIPELINE_HEALTH_PAGE_SIZE - 1);
    if (error) {
      throw new Error(
        `pipeline_health_select_failed:${error.code ?? "unknown"}`,
      );
    }
    if (!data || data.length === 0) break;
    // PostgREST inferred type (`GenericStringError[]`) → unknown 경유 cast. 런타임 shape는
    // transformPipelineHealthRow 내부 fail-closed guard가 검증.
    const rows = data as unknown as DbPipelineHealthRow[];
    for (const row of rows) {
      result.push(transformPipelineHealthRow(row));
    }
    if (rows.length < PIPELINE_HEALTH_PAGE_SIZE) break;
    offset += PIPELINE_HEALTH_PAGE_SIZE;
  }
  return result;
}
