import { describe, expect, it, vi, beforeEach } from 'vitest';
import { runMonthlyBatchOrchestrator } from '../monthly-batch-orchestrator';
import type { Tier1Candidate } from '../persona-eval';
import type { PersonaScore, SelectionTrack } from '../tier1-schema';
import { TRACK_FRESH_POOL } from '../tier1-schema';
import { CORE_11_PERSONAS } from '@/lib/ai/prompts/personas';

function buildCandidates(count = 150): Tier1Candidate[] {
  return Array.from({ length: count }, (_, i) => {
    const ticker = String(100000 + i).padStart(6, '0');
    return {
      ticker,
      sector: null,
      tier0_buckets: {
        short: i % 3 === 0,
        mid: i % 3 === 1,
        long: i % 3 === 2,
      },
      tier0_scores: {
        short: i % 3 === 0 ? 100 - i : null,
        mid: i % 3 === 1 ? 100 - i : null,
        long: i % 3 === 2 ? 100 - i : null,
      },
    };
  });
}

/**
 * W2a Task 4 — 트랙별 fresh 후보 풀. short=50(전부 bucket short) / midlong=100(mid/long).
 * orchestrator 길이 게이트가 TRACK_FRESH_POOL[track]를 사용하므로 트랙별 distinct pool 필요.
 */
function buildTrackCandidates(track: SelectionTrack): Tier1Candidate[] {
  const count = TRACK_FRESH_POOL[track];
  return Array.from({ length: count }, (_, i) => {
    const ticker = String(200000 + i).padStart(6, '0');
    if (track === 'short') {
      return {
        ticker,
        sector: null,
        tier0_buckets: { short: true, mid: false, long: false },
        tier0_scores: { short: 100 - i, mid: null, long: null },
      };
    }
    // midlong: 앞 절반 mid, 뒤 절반 long.
    const isMid = i < count / 2;
    return {
      ticker,
      sector: null,
      tier0_buckets: { short: false, mid: isMid, long: !isMid },
      tier0_scores: {
        short: null,
        mid: isMid ? 100 - i : null,
        long: !isMid ? 100 - i : null,
      },
    };
  });
}

function buildPanelPass(): PersonaScore[] {
  return CORE_11_PERSONAS.map((p) => ({
    persona_id: p.id,
    scores: { short: 70, mid: 70, long: 70 },
    winning_timeframe: 'short' as const,
    rationale_kr: '강력한 매수 신호 (테스트 픽스처).',
    conviction: 80,
  }));
}

function makeBaseInput(
  overrides: Partial<Parameters<typeof runMonthlyBatchOrchestrator>[0]> = {},
  track: SelectionTrack = 'midlong',
) {
  const acquire = vi.fn().mockResolvedValue({ acquired: true, resumed: false });
  const release = vi.fn().mockResolvedValue(undefined);
  const persist = vi.fn().mockResolvedValue(undefined);
  const commitBadgeOnly = vi.fn().mockResolvedValue(undefined);
  const recordSchedulerFailAlert = vi.fn().mockResolvedValue(undefined);
  const tier0Source = vi.fn().mockResolvedValue(buildTrackCandidates(track));
  const callPersonaPanel = vi.fn().mockResolvedValue(buildPanelPass());
  const fetchFinancials = vi.fn().mockResolvedValue('mock financials');
  // PR-E (omxy §2.0a) — preflight DI seam (default success). admin은 fail-closed 비용 가드 주입.
  const preflight = vi.fn().mockResolvedValue(undefined);

  return {
    spies: { acquire, release, persist, commitBadgeOnly, recordSchedulerFailAlert, tier0Source, callPersonaPanel, fetchFinancials, preflight },
    input: {
      month: '2026-06',
      track,
      adminUserId: 'cron-system',
      promptVersionId: 'render-user-prompt@v1',
      personasVersionId: 'core11@v3.1',
      tier0Source,
      preflight,
      callPersonaPanel,
      fetchFinancials,
      lock: { acquire, release },
      persist,
      commitBadgeOnly,
      recordSchedulerFailAlert,
      ...overrides,
    },
  };
}

describe('runMonthlyBatchOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws if Tier 0 source yields ≠ TRACK_FRESH_POOL[track] candidates (midlong=100, case 1)', async () => {
    const { input, spies } = makeBaseInput({
      tier0Source: vi.fn().mockResolvedValue([]),
    });
    await expect(runMonthlyBatchOrchestrator(input)).rejects.toThrow(
      /tier1_candidates_must_be_100 \(got 0\)/,
    );
    expect(spies.persist).not.toHaveBeenCalled();
    expect(spies.recordSchedulerFailAlert).toHaveBeenCalledTimes(1);
    expect(spies.release).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('W2a Task 4 — short 트랙: pool 50 → 10 selected + track이 runTier1Screening에 전파', async () => {
    const { input, spies } = makeBaseInput({}, 'short');
    const outcome = await runMonthlyBatchOrchestrator(input);
    expect(outcome.selectedCount).toBe(10);
    expect(outcome.notSelectedCount).toBe(40);
    expect(spies.preflight).toHaveBeenCalledWith({ month: '2026-06', callCount: 50 * 11 });
    expect(spies.release).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded', callCountDone: 50 }),
    );
  });

  it('W2a Task 4 — short 트랙 길이 게이트: 100 후보 주입 시 tier1_candidates_must_be_50 throw', async () => {
    const { input, spies } = makeBaseInput(
      { tier0Source: vi.fn().mockResolvedValue(buildTrackCandidates('midlong')) },
      'short',
    );
    await expect(runMonthlyBatchOrchestrator(input)).rejects.toThrow(
      /tier1_candidates_must_be_50 \(got 100\)/,
    );
    expect(spies.persist).not.toHaveBeenCalled();
    expect(spies.release).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('lock acquire failure propagates without persist/alert (case 2)', async () => {
    const { input, spies } = makeBaseInput();
    spies.acquire.mockRejectedValueOnce(new Error('batch_already_running'));
    await expect(runMonthlyBatchOrchestrator(input)).rejects.toThrow(
      /batch_already_running/,
    );
    expect(spies.persist).not.toHaveBeenCalled();
    expect(spies.recordSchedulerFailAlert).not.toHaveBeenCalled();
    expect(spies.release).not.toHaveBeenCalled();
  });

  it('PR-E (supersedes B3): callPersonaPanel all-reject → 150/150 게이트가 tier1_panel_incomplete throw → no persist + alert + release failed (case 3)', async () => {
    // omxy §2.0a 합의: 실 AI path는 degraded(⚪)를 persist하지 않는다 (clobber 방지). PR1 B3 "30 ⚪ success" supersede.
    const { input, spies } = makeBaseInput({
      callPersonaPanel: vi.fn().mockRejectedValue(new Error('ai_key_unavailable')),
    });
    await expect(runMonthlyBatchOrchestrator(input)).rejects.toThrow(
      /tier1_panel_incomplete:0\/100/,
    );
    expect(spies.persist).not.toHaveBeenCalled();
    expect(spies.commitBadgeOnly).not.toHaveBeenCalled();
    expect(spies.recordSchedulerFailAlert).toHaveBeenCalledTimes(1);
    expect(spies.release).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('duplicate ticker in tier0Source → runTier1Screening throw → alert + release failed (case 4)', async () => {
    // midlong 트랙 pool=100 → 길이 게이트 통과(100) 후 runTier1Screening 내부 dup 게이트 발동.
    const dup = buildTrackCandidates('midlong');
    dup[dup.length - 1] = { ...dup[0] }; // duplicate ticker (길이 100 유지)
    const { input, spies } = makeBaseInput({
      tier0Source: vi.fn().mockResolvedValue(dup),
    });
    await expect(runMonthlyBatchOrchestrator(input)).rejects.toThrow(
      /tier1_candidates_have_duplicate_tickers/,
    );
    expect(spies.recordSchedulerFailAlert).toHaveBeenCalledTimes(1);
    expect(spies.release).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('persist failure → alert + release failed + throw propagate (case 5)', async () => {
    const { input, spies } = makeBaseInput({
      persist: vi.fn().mockRejectedValue(new Error('shortlist_persist_failed:23505')),
    });
    await expect(runMonthlyBatchOrchestrator(input)).rejects.toThrow(
      /shortlist_persist_failed/,
    );
    expect(spies.recordSchedulerFailAlert).toHaveBeenCalledTimes(1);
    expect(spies.release).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('PR-E gate: partial panel (99/100 성공) → tier1_panel_incomplete:99/100 → no persist + alert + release failed (case 6)', async () => {
    // 1 ticker만 panel reject → commentsByTicker 99 → 게이트 차단 (부분 성공은 ranking 왜곡 → persist 금지).
    const { input, spies } = makeBaseInput({
      callPersonaPanel: vi.fn(async ({ ticker }: { ticker: string }) => {
        if (ticker === '200000') throw new Error('ai_call_failed');
        return buildPanelPass();
      }),
    });
    await expect(runMonthlyBatchOrchestrator(input)).rejects.toThrow(
      /tier1_panel_incomplete:99\/100/,
    );
    expect(spies.persist).not.toHaveBeenCalled();
    expect(spies.recordSchedulerFailAlert).toHaveBeenCalledTimes(1);
    expect(spies.release).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('normal path all-pass (midlong): 20 selected + badgeOnlyCount=0 + alert 0 + persist receives 100 commentsByTicker (case 7)', async () => {
    const { input, spies } = makeBaseInput();
    const outcome = await runMonthlyBatchOrchestrator(input);
    expect(outcome.selectedCount).toBe(20);
    expect(outcome.notSelectedCount).toBe(80);
    expect(outcome.badgeOnlyCount).toBe(0);
    expect(spies.commitBadgeOnly).not.toHaveBeenCalled();
    expect(spies.recordSchedulerFailAlert).not.toHaveBeenCalled();
    expect(spies.release).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded', callCountDone: 100 }),
    );
    // PR-E: 100/100 게이트 통과 → persist가 commentsByTicker(100 keys) 3번째 인자로 받음.
    const persistArgs = spies.persist.mock.calls[0];
    expect(Object.keys(persistArgs[2] ?? {})).toHaveLength(100);
  });

  it('PR-E: preflight invoked with callCount=1100 (midlong 100×11) before screening (case 10)', async () => {
    const { input, spies } = makeBaseInput();
    await runMonthlyBatchOrchestrator(input);
    expect(spies.preflight).toHaveBeenCalledTimes(1);
    expect(spies.preflight).toHaveBeenCalledWith({ month: '2026-06', callCount: 1100 });
  });

  it('PR-E: preflight throw (cost guard fail-closed) → no callPersonaPanel/persist + alert + release failed (case 11)', async () => {
    const { input, spies } = makeBaseInput({
      preflight: vi.fn().mockRejectedValue(new Error('cost_logging_disabled')),
    });
    await expect(runMonthlyBatchOrchestrator(input)).rejects.toThrow(
      /cost_logging_disabled/,
    );
    expect(spies.callPersonaPanel).not.toHaveBeenCalled();
    expect(spies.persist).not.toHaveBeenCalled();
    expect(spies.recordSchedulerFailAlert).toHaveBeenCalledTimes(1);
    expect(spies.release).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('outcome metadata reflects input version ids (case 8)', async () => {
    const { input } = makeBaseInput({
      promptVersionId: 'custom-prompt@v9',
      personasVersionId: 'custom-personas@v9',
    });
    const outcome = await runMonthlyBatchOrchestrator(input);
    expect(outcome.promptVersionId).toBe('custom-prompt@v9');
    expect(outcome.personasVersionId).toBe('custom-personas@v9');
  });

  it('alert insert failure does NOT prevent release failed propagation (case 9)', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { input, spies } = makeBaseInput({
      persist: vi.fn().mockRejectedValue(new Error('shortlist_persist_failed')),
      recordSchedulerFailAlert: vi
        .fn()
        .mockRejectedValue(new Error('scheduler_fail_alert_insert_failed')),
    });
    await expect(runMonthlyBatchOrchestrator(input)).rejects.toThrow(
      /shortlist_persist_failed/,
    );
    expect(spies.release).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', errorCode: expect.stringContaining('shortlist_persist_failed') }),
    );
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
