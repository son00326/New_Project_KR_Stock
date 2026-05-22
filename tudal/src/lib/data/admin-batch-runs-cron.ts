// PR1 B1 fix (omxy R1) — cron caller variant of acquireBatchLock + releaseBatchLock.
// service-role client 사용 (Vercel cron route 전용). admin server action은 admin-batch-runs.ts 그대로 사용.
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type {
  AcquireBatchLockResult,
  ReleaseBatchLockInput,
} from './admin-batch-runs';

export async function acquireBatchLockCron(
  month: string,
): Promise<AcquireBatchLockResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc('acquire_batch_lock_v2', {
    p_month: month,
    p_caller_kind: 'cron',
  });
  if (error) throw new Error(error.message);
  if (!data?.acquired) throw new Error('batch_lock_acquire_failed');
  return { acquired: true, resumed: data.resumed ?? false };
}

export async function releaseBatchLockCron(
  input: ReleaseBatchLockInput,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from('monthly_batch_runs')
    .update({
      status: input.status,
      finished_at: new Date().toISOString(),
      call_count_done: input.callCountDone,
      error_code: input.errorCode ?? null,
    })
    .eq('month', input.month);
  if (error) {
    throw new Error(`batch_lock_release_failed:${error.code ?? 'unknown'}`);
  }
}
