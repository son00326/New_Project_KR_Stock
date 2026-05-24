// PR3c Task 7 — sector-reference-backlog helper test (B16 + B18 + B20 fix).
// SoT = plan v6, omxy R6 CONVERGED.

import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => {
  const rpc = vi.fn();
  const select = vi.fn();
  const order = vi.fn();
  const fromObj = { select: () => ({ order: () => ({ data: [], error: null }) }) };
  return {
    createClient: vi.fn().mockResolvedValue({
      rpc,
      from: () => fromObj,
    }),
    __rpc: rpc,
    __select: select,
    __order: order,
  };
});

import { CANONICAL_SECTORS } from '@/lib/screening/canonical-sectors';

describe('hasLevelABodyReference + LEVEL_A_SECTORS_WITH_BODY (B20 fix omxy R5)', () => {
  it('LEVEL_A_SECTORS_WITH_BODY = {바이오, 반도체} (사용자 lock-in §1.7)', async () => {
    const { LEVEL_A_SECTORS_WITH_BODY } = await import('@/lib/data/sector-reference-backlog');
    expect(LEVEL_A_SECTORS_WITH_BODY.has('바이오')).toBe(true);
    expect(LEVEL_A_SECTORS_WITH_BODY.has('반도체')).toBe(true);
    expect(LEVEL_A_SECTORS_WITH_BODY.size).toBe(2);
  });

  it('hasLevelABodyReference for 바이오·반도체 = true', async () => {
    const { hasLevelABodyReference } = await import('@/lib/data/sector-reference-backlog');
    expect(hasLevelABodyReference('바이오')).toBe(true);
    expect(hasLevelABodyReference('반도체')).toBe(true);
  });

  it('hasLevelABodyReference for 건설·금융·기타 = false', async () => {
    const { hasLevelABodyReference } = await import('@/lib/data/sector-reference-backlog');
    expect(hasLevelABodyReference('건설')).toBe(false);
    expect(hasLevelABodyReference('금융')).toBe(false);
    expect(hasLevelABodyReference('2차전지')).toBe(false);
  });

  it('missing 12 invariant (B20 fix — canonical 14 - LEVEL_A 2 = 12)', async () => {
    const { LEVEL_A_SECTORS_WITH_BODY } = await import('@/lib/data/sector-reference-backlog');
    const missing = CANONICAL_SECTORS.filter((s) => !LEVEL_A_SECTORS_WITH_BODY.has(s));
    expect(missing).toHaveLength(12);
  });
});

describe('insertOrBumpBacklog — Level A guard + trim + canonical guard', () => {
  beforeEach(async () => {
    const sb = await import('@/lib/supabase/server');
    const rpc = (sb as unknown as { __rpc: ReturnType<typeof vi.fn> }).__rpc;
    rpc.mockReset();
    rpc.mockResolvedValue({ data: null, error: null });
  });

  it('happy path — 건설 (Level A 부족 sector) RPC 호출', async () => {
    const sb = await import('@/lib/supabase/server');
    const rpc = (sb as unknown as { __rpc: ReturnType<typeof vi.fn> }).__rpc;
    const { insertOrBumpBacklog } = await import('@/lib/data/sector-reference-backlog');
    await insertOrBumpBacklog('건설');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('insert_or_bump_sector_backlog', { p_sector: '건설' });
  });

  it('B20 guard — 바이오 (Level A 보유) RPC 미호출 (early return)', async () => {
    const sb = await import('@/lib/supabase/server');
    const rpc = (sb as unknown as { __rpc: ReturnType<typeof vi.fn> }).__rpc;
    const { insertOrBumpBacklog } = await import('@/lib/data/sector-reference-backlog');
    await insertOrBumpBacklog('바이오');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('B20 guard — 반도체 (Level A 보유) RPC 미호출 (early return)', async () => {
    const sb = await import('@/lib/supabase/server');
    const rpc = (sb as unknown as { __rpc: ReturnType<typeof vi.fn> }).__rpc;
    const { insertOrBumpBacklog } = await import('@/lib/data/sector-reference-backlog');
    await insertOrBumpBacklog('반도체');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('B16 trim — 트레일링 whitespace 후 valid canonical', async () => {
    const sb = await import('@/lib/supabase/server');
    const rpc = (sb as unknown as { __rpc: ReturnType<typeof vi.fn> }).__rpc;
    const { insertOrBumpBacklog } = await import('@/lib/data/sector-reference-backlog');
    await insertOrBumpBacklog('건설  ');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('insert_or_bump_sector_backlog', { p_sector: '건설' });
  });

  it('B16 invalid — 비-canonical sector throw', async () => {
    const sb = await import('@/lib/supabase/server');
    const rpc = (sb as unknown as { __rpc: ReturnType<typeof vi.fn> }).__rpc;
    const { insertOrBumpBacklog } = await import('@/lib/data/sector-reference-backlog');
    await expect(insertOrBumpBacklog('블록체인')).rejects.toThrow(
      /sector_reference_backlog_invalid_sector:not_canonical/,
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it('B16 invalid — empty string throw', async () => {
    const { insertOrBumpBacklog } = await import('@/lib/data/sector-reference-backlog');
    await expect(insertOrBumpBacklog('')).rejects.toThrow(
      /sector_reference_backlog_invalid_sector:empty/,
    );
  });

  it('B16 invalid — only whitespace throw', async () => {
    const { insertOrBumpBacklog } = await import('@/lib/data/sector-reference-backlog');
    await expect(insertOrBumpBacklog('   ')).rejects.toThrow(
      /sector_reference_backlog_invalid_sector:empty/,
    );
  });

  it('RPC error propagation', async () => {
    const sb = await import('@/lib/supabase/server');
    const rpc = (sb as unknown as { __rpc: ReturnType<typeof vi.fn> }).__rpc;
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'XX001', message: 'rpc fail' } });
    const { insertOrBumpBacklog } = await import('@/lib/data/sector-reference-backlog');
    await expect(insertOrBumpBacklog('건설')).rejects.toThrow(
      /sector_reference_backlog_rpc_failed:XX001/,
    );
  });

  it('idempotent — 같은 sector 2회 호출 모두 RPC 진입 (DB ON CONFLICT가 처리)', async () => {
    const sb = await import('@/lib/supabase/server');
    const rpc = (sb as unknown as { __rpc: ReturnType<typeof vi.fn> }).__rpc;
    const { insertOrBumpBacklog } = await import('@/lib/data/sector-reference-backlog');
    await insertOrBumpBacklog('건설');
    await insertOrBumpBacklog('건설');
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
