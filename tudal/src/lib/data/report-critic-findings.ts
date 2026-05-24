// PR3c — report_critic_findings helper (atomic RPC + run_id pinning).
// SoT = plan v6, omxy R6 CONVERGED.
//
// B6 fix (omxy R2): run_id pinning (매 INSERT new run_id, findings 중복 누적 차단).
// B12 fix (omxy R2): getCriticFindingsByRunId strict latest (orchestrate 반환 run_id 사용).
//   listLatestRunCriticFindings는 "다른 admin이 본 latest"용 (mixed-run 안전).
// B19 fix (omxy R4): target_stage 파라미터 default 'writer_draft' (PR3c 1회 hard cap).

import { createClient } from '@/lib/supabase/server';
import type { CriticResultJson } from '@/lib/ai/critic-client';

export type CriticTargetStage = 'writer_draft' | 'revised';

export interface CriticFindingRow {
  id: string;
  report_id: string;
  run_id: string;
  target_stage: CriticTargetStage;
  axis: string;
  verdict: string;
  reason: string;
  created_at: string;
}

/**
 * Atomic RPC — new run_id 발급 + 6 row INSERT.
 * target_stage default 'writer_draft' (PR3c orchestrator 1회 hard cap, 미래 'revised' 확장 hook).
 */
export async function insertCriticFindingsRun(
  reportId: string,
  verdict: CriticResultJson,
  targetStage: CriticTargetStage = 'writer_draft',
): Promise<{ runId: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('insert_critic_findings_run', {
    p_report_id: reportId,
    p_verdict: verdict,
    p_target_stage: targetStage,
  });
  if (error) {
    throw new Error(`report_critic_findings_rpc_failed:${error.code ?? 'unknown'}`);
  }
  return { runId: data as string };
}

/**
 * B12 fix (omxy R2): strict latest — orchestrate 반환 run_id로 6 row 조회.
 * concurrent INSERT race safe.
 */
export async function getCriticFindingsByRunId(
  reportId: string,
  runId: string,
): Promise<CriticFindingRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('report_critic_findings')
    .select('*')
    .eq('report_id', reportId)
    .eq('run_id', runId);
  if (error) {
    throw new Error(`report_critic_findings_list_failed:${error.code ?? 'unknown'}`);
  }
  return (data ?? []) as CriticFindingRow[];
}

/**
 * "다른 admin이 본 latest"용 — concurrent INSERT 시 stale latest 가능 (mixed-run 안전).
 * "방금 insert한 결과"는 getCriticFindingsByRunId(reportId, criticRunId) 사용 권장.
 */
export async function listLatestRunCriticFindings(reportId: string): Promise<CriticFindingRow[]> {
  const supabase = await createClient();
  // 1) latest run_id 조회
  const { data: latestRow, error: latestErr } = await supabase
    .from('report_critic_findings')
    .select('run_id, created_at')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) {
    throw new Error(`report_critic_findings_list_failed:${latestErr.code ?? 'unknown'}`);
  }
  if (latestRow === null) return [];
  // 2) latest run의 6 row 반환
  const { data, error } = await supabase
    .from('report_critic_findings')
    .select('*')
    .eq('report_id', reportId)
    .eq('run_id', (latestRow as { run_id: string }).run_id);
  if (error) {
    throw new Error(`report_critic_findings_list_failed:${error.code ?? 'unknown'}`);
  }
  return (data ?? []) as CriticFindingRow[];
}
