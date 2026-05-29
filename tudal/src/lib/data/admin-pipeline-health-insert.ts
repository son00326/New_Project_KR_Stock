// PR5 — pipeline_health INSERT helper (run당 1 row, pipeline='ai').
// plan §4.2 C3. read helper(admin-pipeline-health.ts::getRecentPipelineHealth)는 존재하나 INSERT는 없었음.
// DI seam: insertAlertEvents(admin-alerts-insert.ts:73) 패턴. cron service-role client 주입 시 RLS using(is_admin()) bypass.
// service-role.ts B17 boundary "허용 DI seam" 등록.
// 0006 pipeline_health 컬럼 (snake_case): run_id uuid / pipeline text / status text / started_at(default now())
//   / finished_at / latency_ms int / error text. PipelineKind/PipelineStatus enum 정합.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { PipelineKind, PipelineStatus } from '@/types/admin';

export interface PipelineHealthInsert {
  runId?: string | null;
  pipeline: PipelineKind;
  status: PipelineStatus;
  finishedAt?: string | null;
  latencyMs?: number | null;
  error?: string | null;
}

const PIPELINE_SET: ReadonlySet<PipelineKind> = new Set<PipelineKind>([
  'dart',
  'news',
  'price',
  'ai',
  'alert',
]);
const STATUS_SET: ReadonlySet<PipelineStatus> = new Set<PipelineStatus>([
  'success',
  'warning',
  'failed',
]);

export async function insertPipelineHealth(
  row: PipelineHealthInsert,
  options: { client?: SupabaseClient } = {},
): Promise<void> {
  if (!PIPELINE_SET.has(row.pipeline)) {
    throw new Error(`pipeline_health_invalid_pipeline:${row.pipeline}`);
  }
  if (!STATUS_SET.has(row.status)) {
    throw new Error(`pipeline_health_invalid_status:${row.status}`);
  }
  const supabase = options.client ?? (await createClient());
  const { error } = await supabase.from('pipeline_health').insert({
    run_id: row.runId ?? null,
    pipeline: row.pipeline,
    status: row.status,
    finished_at: row.finishedAt ?? null,
    latency_ms: row.latencyMs ?? null,
    error: row.error ?? null,
  });
  if (error) {
    throw new Error(`pipeline_health_insert_failed:${error.code ?? 'unknown'}`);
  }
}
