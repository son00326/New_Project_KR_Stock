import { describe, expect, it, vi } from 'vitest';
import { recordSchedulerFailAlert } from '../admin-alerts-insert';
import type { BatchRunOutcome } from '@/lib/scheduler/monthly-batch';

function fakeOutcome(): BatchRunOutcome {
  return {
    runId: 'test-run-2026-06',
    startedAt: '2026-06-01T00:00:00.000Z',
    finishedAt: '2026-06-01T00:05:00.000Z',
    totalLatencyMs: 300000,
    overallSuccess: false,
    steps: [
      {
        name: 'orchestrator',
        pipeline: 'dart',
        attempts: 1,
        success: false,
        error: 'tier0_source_not_wired_pr1_followup',
        latencyMs: 10,
        startedAt: '2026-06-01T00:00:00.000Z',
        finishedAt: '2026-06-01T00:00:10.000Z',
      },
    ],
  };
}

describe('recordSchedulerFailAlert', () => {
  it('inserts 9 columns matching alert_event schema (B8 fix)', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ insert }));
    const supabase = { from } as unknown as Parameters<
      typeof recordSchedulerFailAlert
    >[0]['supabase'];

    await recordSchedulerFailAlert({ supabase, outcome: fakeOutcome() });

    expect(from).toHaveBeenCalledWith('alert_event');
    expect(insert).toHaveBeenCalledTimes(1);
    const row = insert.mock.calls[0][0];
    expect(row).toEqual({
      alert_type: 'scheduler_fail',
      ticker: null,
      severity: 'critical',
      trigger_reason: expect.stringContaining('월간 배치 실패'),
      signal_sent_at: '2026-06-01T00:05:00.000Z',
      outcome_at: null,
      t7_price_change: null,
      decision_recorded: null,
      decision_memo: null,
    });
  });

  it('throws scheduler_fail_alert_insert_failed on supabase error', async () => {
    const insert = vi
      .fn()
      .mockResolvedValue({ error: { code: 'PGRST116' } });
    const from = vi.fn(() => ({ insert }));
    const supabase = { from } as unknown as Parameters<
      typeof recordSchedulerFailAlert
    >[0]['supabase'];

    await expect(
      recordSchedulerFailAlert({ supabase, outcome: fakeOutcome() }),
    ).rejects.toThrow(/scheduler_fail_alert_insert_failed:PGRST116/);
  });

  it('payload.alertType is always scheduler_fail invariant', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn(() => ({ insert }));
    const supabase = { from } as unknown as Parameters<
      typeof recordSchedulerFailAlert
    >[0]['supabase'];

    await recordSchedulerFailAlert({ supabase, outcome: fakeOutcome() });
    expect(insert.mock.calls[0][0].alert_type).toBe('scheduler_fail');
  });
});
