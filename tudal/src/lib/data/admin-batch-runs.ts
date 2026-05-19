// Plan R3 BLOCKER 6: caller-supplied uuid 위험 제거. RPC 내부 auth.uid() 사용.
import { createClient } from '@/lib/supabase/server';

export interface AcquireBatchLockResult {
  acquired: boolean;
  resumed: boolean;
}

export async function acquireBatchLock(month: string): Promise<AcquireBatchLockResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('acquire_batch_lock', { p_month: month });
  if (error) {
    // P0001 raise exception 메시지를 그대로 코드로 throw — format-error에서 한국어 매핑
    throw new Error(error.message);
  }
  if (!data?.acquired) {
    throw new Error('batch_lock_acquire_failed');
  }
  return { acquired: true, resumed: data.resumed ?? false };
}

export interface ReleaseBatchLockInput {
  month: string;
  status: 'succeeded' | 'failed';
  callCountDone: number;
  errorCode?: string;
}

export async function releaseBatchLock(input: ReleaseBatchLockInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('monthly_batch_runs')
    .update({
      status: input.status,
      finished_at: new Date().toISOString(),
      call_count_done: input.callCountDone,
      error_code: input.errorCode ?? null,
    })
    .eq('month', input.month);
  if (error) throw new Error(`batch_lock_release_failed:${error.code ?? 'unknown'}`);
}
