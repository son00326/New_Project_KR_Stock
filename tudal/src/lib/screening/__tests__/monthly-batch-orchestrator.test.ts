import { describe, expect, it, vi, beforeEach } from 'vitest';
import { runMonthlyBatchOrchestrator } from '../monthly-batch-orchestrator';
import type { Tier1Candidate } from '../persona-eval';
import type { PersonaScore } from '../tier1-schema';
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

function buildPanelPass(): PersonaScore[] {
  return CORE_11_PERSONAS.map((p) => ({
    persona_id: p.id,
    scores: { short: 70, mid: 70, long: 70 },
    winning_timeframe: 'short' as const,
    rationale_kr: '강력한 매수 신호 (테스트 픽스처).',
    conviction: 80,
  }));
}

function makeBaseInput(overrides: Partial<Parameters<typeof runMonthlyBatchOrchestrator>[0]> = {}) {
  const acquire = vi.fn().mockResolvedValue({ acquired: true, resumed: false });
  const release = vi.fn().mockResolvedValue(undefined);
  const persist = vi.fn().mockResolvedValue(undefined);
  const commitBadgeOnly = vi.fn().mockResolvedValue(undefined);
  const recordSchedulerFailAlert = vi.fn().mockResolvedValue(undefined);
  const tier0Source = vi.fn().mockResolvedValue(buildCandidates(150));
  const callPersonaPanel = vi.fn().mockResolvedValue(buildPanelPass());
  const fetchFinancials = vi.fn().mockResolvedValue('mock financials');

  return {
    spies: { acquire, release, persist, commitBadgeOnly, recordSchedulerFailAlert, tier0Source, callPersonaPanel, fetchFinancials },
    input: {
      month: '2026-06',
      adminUserId: 'cron-system',
      promptVersionId: 'render-user-prompt@v1',
      personasVersionId: 'core11@v3.1',
      tier0Source,
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

  it('throws if Tier 0 source yields ≠ 150 candidates (case 1)', async () => {
    const { input, spies } = makeBaseInput({
      tier0Source: vi.fn().mockResolvedValue([]),
    });
    await expect(runMonthlyBatchOrchestrator(input)).rejects.toThrow(
      /tier1_candidates_must_be_150/,
    );
    expect(spies.persist).not.toHaveBeenCalled();
    expect(spies.recordSchedulerFailAlert).toHaveBeenCalledTimes(1);
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

  it('B3 fix: callPersonaPanel all-reject → degraded 30 ⚪ selected + commitBadgeOnly 30회 + lock succeeded (case 3)', async () => {
    const { input, spies } = makeBaseInput({
      callPersonaPanel: vi.fn().mockRejectedValue(new Error('ai_key_unavailable')),
    });
    const outcome = await runMonthlyBatchOrchestrator(input);
    expect(outcome.selectedCount).toBe(30);
    expect(outcome.notSelectedCount).toBe(120);
    expect(outcome.badgeOnlyCount).toBe(30);
    expect(spies.commitBadgeOnly).toHaveBeenCalledTimes(30);
    expect(spies.recordSchedulerFailAlert).not.toHaveBeenCalled();
    expect(spies.release).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded' }),
    );
  });

  it('duplicate ticker in tier0Source → runTier1Screening throw → alert + release failed (case 4)', async () => {
    const dup = buildCandidates(149);
    dup.push({ ...dup[0] }); // duplicate
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

  it('commit_badge_only failure → alert + release failed + throw (case 6)', async () => {
    const { input, spies } = makeBaseInput({
      callPersonaPanel: vi.fn().mockRejectedValue(new Error('ai_key_unavailable')),
      commitBadgeOnly: vi.fn().mockRejectedValue(new Error('commit_badge_only_failed')),
    });
    await expect(runMonthlyBatchOrchestrator(input)).rejects.toThrow(
      /commit_badge_only_failed/,
    );
    expect(spies.recordSchedulerFailAlert).toHaveBeenCalledTimes(1);
    expect(spies.release).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });

  it('normal path all-pass: 30 selected + badgeOnlyCount=0 + alert 0 (case 7)', async () => {
    const { input, spies } = makeBaseInput();
    const outcome = await runMonthlyBatchOrchestrator(input);
    expect(outcome.selectedCount).toBe(30);
    expect(outcome.notSelectedCount).toBe(120);
    expect(outcome.badgeOnlyCount).toBe(0);
    expect(spies.commitBadgeOnly).not.toHaveBeenCalled();
    expect(spies.recordSchedulerFailAlert).not.toHaveBeenCalled();
    expect(spies.release).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded', callCountDone: 150 }),
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
