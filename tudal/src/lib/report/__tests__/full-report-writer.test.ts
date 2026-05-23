import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/ai/full-report-client', () => ({
  callFullReport: vi.fn(),
}));

// 3-track C1 fix: cost-hardcap preflight wire. 기본은 통과시키되 hardcap test에서 throw mock.
vi.mock('@/lib/cost/cost-logger', () => ({
  preflightHardcap: vi
    .fn()
    .mockResolvedValue({ currentTotal: 0, reservation: 0, remaining: 400_000 }),
}));

const validResponse = {
  section_0: {
    headline: '알테오젠 — 글로벌 빅파마 마일스톤 가시화',
    thesis: ['ALT-B4 임상 3상 데이터 2026년 하반기 readout'],
    conviction: 78,
    committeeMini: { core: { approve: 7, reject: 2, abstain: 2 }, sector: { approve: 9, reject: 3, abstain: 2 } },
    priceBands: { bear: '450,000원', base: '620,000원', bull: '820,000원' },
  },
  section_1: { description: '바이오시밀러 + 신약', segments: [{ name: 'ALT-B4', share: '55%' }], keyFacts: [{ label: 'TAM', value: '40조' }] },
  section_2: { summary: '연 매출 1800억', revenue: [{ fy: '2025E', value: '1800억', yoy: '+38%' }], margins: { operating: '12%', net: '8%' }, balance: { debtRatio: '35%', cash: '2400억' } },
  section_3: { summary: 'PSR 18배', multiples: [{ metric: 'PSR', value: '18배', peer: '12배 (삼성바이오)' }] },
  section_4: { summary: '바이오시밀러+신약', drivers: ['ALT-B4 임상 3상'], tam: '40조' },
  section_5: { summary: '금리/환율/규제', risks: [{ title: 'FDA 지연', severity: 'high' as const, detail: '...' }] },
  section_6: { summary: '60일선 위', signals: [{ name: 'MACD', state: 'on' as const, note: '+2.3' }], axis: { trend: 72, momentum: 65, volatility: 48 }, divergencePct: 3.4 },
  section_7: { summary: '임상 3상 readout 2026H2', triggers: ['ALT-B4 readout'], alternatives: [{ label: '삼성바이오', detail: '디스카운트' }] },
  appendix: { technicals: [{ name: 'RSI', value: '58' }], dataSources: ['DART', 'pykrx'] },
};

const baseInput = {
  ticker: '196170',
  name: '알테오젠',
  sector: '바이오',
  month: '2026-06',
  tier1Verdict: 'BUY' as const,
  consensusBadge: '🟢' as const,
  financialsSummary: 'OPM 흑전',
  technicalsSummary: '60일선 위',
  macroSummary: '금리 동결',
  sectorReference: 'Alteogen',
  adminUserId: 'u1',
};

describe('extractJsonObject (R2 B11 fix)', () => {
  it('plain JSON object 그대로 반환', async () => {
    const { extractJsonObject } = await import('@/lib/report/full-report-writer');
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });
  it('markdown fence strip', async () => {
    const { extractJsonObject } = await import('@/lib/report/full-report-writer');
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });
  it('prefix 설명 + JSON object strip', async () => {
    const { extractJsonObject } = await import('@/lib/report/full-report-writer');
    expect(extractJsonObject('Here is the JSON:\n{"a":1}')).toBe('{"a":1}');
  });
  it('JSON object + suffix 설명 strip', async () => {
    const { extractJsonObject } = await import('@/lib/report/full-report-writer');
    expect(extractJsonObject('{"a":1}\nDone.')).toBe('{"a":1}');
  });
  it('JSON object 부재 시 null', async () => {
    const { extractJsonObject } = await import('@/lib/report/full-report-writer');
    expect(extractJsonObject('no object here')).toBeNull();
  });
});

describe('commitFullReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('happy path — prompt builder 호출 + extractJsonObject + per-section 검증 + RPC UPDATE 성공', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify(validResponse),
      usage: { input_tokens: 1500, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 4500 },
      costKrw: 1200,
    });
    const rpc = vi.fn().mockResolvedValueOnce({ data: { success: true, report_id: 'r1' }, error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    const result = await commitFullReport(baseInput);
    expect(result.reportId).toBe('r1');
    expect(result.costKrw).toBe(1200);
    expect(callFullReport).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: '196170',
        month: '2026-06',
        adminUserId: 'u1',
        systemPrompt: expect.stringContaining('투자 요약'),
        userPrompt: expect.stringContaining('알테오젠'),
      }),
    );
    expect(rpc).toHaveBeenCalledWith(
      'update_report_sections_0_7',
      expect.objectContaining({ p_ticker: '196170', p_month: '2026-06', p_section_0: validResponse.section_0 }),
    );
  });

  // R2 B11 fix
  it('B11 — markdown fence wrapped 응답도 strip + parse 성공', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: '```json\n' + JSON.stringify(validResponse) + '\n```',
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 100,
    });
    const rpc = vi.fn().mockResolvedValueOnce({ data: { success: true, report_id: 'r2' }, error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    const result = await commitFullReport(baseInput);
    expect(result.reportId).toBe('r2');
  });

  it('B11 — prefix 설명 + JSON 응답도 strip + parse 성공', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: 'Here is the JSON:\n' + JSON.stringify(validResponse),
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 100,
    });
    const rpc = vi.fn().mockResolvedValueOnce({ data: { success: true, report_id: 'r3' }, error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    const result = await commitFullReport(baseInput);
    expect(result.reportId).toBe('r3');
  });

  // B19 fix (R3 P2)
  it('B19 — JSON + suffix 설명도 strip + parse 성공', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify(validResponse) + '\n\n(이상으로 풀 리포트 작성을 마칩니다.)',
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 100,
    });
    const rpc = vi.fn().mockResolvedValueOnce({ data: { success: true, report_id: 'r3b' }, error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    const result = await commitFullReport(baseInput);
    expect(result.reportId).toBe('r3b');
  });

  it('LLM 응답에 JSON object 0이면 full_report_parse_failed throw', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: 'no json here',
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 0,
    });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await expect(commitFullReport(baseInput)).rejects.toThrow(/full_report_parse_failed/);
  });

  it('section_0 conviction이 zod 범위 밖이면 full_report_validation_failed:section_0:conviction throw', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const invalid = { ...validResponse, section_0: { ...validResponse.section_0, conviction: 150 } };
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify(invalid),
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 0,
    });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await expect(commitFullReport(baseInput)).rejects.toThrow(/full_report_validation_failed:section_0/);
  });

  it('RPC가 report_not_found_for_section_0_7_update message로 raise 시 동일 string throw', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify(validResponse),
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 0,
    });
    const rpc = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { code: 'P0002', message: 'report_not_found_for_section_0_7_update' },
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await expect(commitFullReport(baseInput)).rejects.toThrow('report_not_found_for_section_0_7_update');
  });

  it('일반 RPC error → update_report_sections_0_7_failed:<code> throw', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify(validResponse),
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 0,
    });
    const rpc = vi.fn().mockResolvedValueOnce({
      data: null,
      error: { code: '42501', message: 'admin_required' },
    });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await expect(commitFullReport(baseInput)).rejects.toThrow(/update_report_sections_0_7_failed:42501/);
  });

  // 3-track C1 fix: preflightHardcap이 cost_hardcap_40man throw 시 LLM 호출 차단 검증.
  it('C1 — cost hardcap 초과 시 preflightHardcap throw → callFullReport 미호출', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { preflightHardcap } = await import('@/lib/cost/cost-logger');
    (preflightHardcap as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('cost_hardcap_40man'),
    );
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await expect(commitFullReport(baseInput)).rejects.toThrow('cost_hardcap_40man');
    expect(callFullReport).not.toHaveBeenCalled();
  });

  // 3-track C1 fix: preflightHardcap 호출 시 FULL_REPORT_MAX_COST_PER_CALL_KRW override 주입 검증.
  it('C1 — preflightHardcap 호출 시 FULL_REPORT_MAX_COST_PER_CALL_KRW override 주입', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    const { preflightHardcap } = await import('@/lib/cost/cost-logger');
    const { FULL_REPORT_MAX_COST_PER_CALL_KRW } = await import('@/lib/cost/pricing');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify(validResponse),
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 100,
    });
    const rpc = vi.fn().mockResolvedValueOnce({ data: { success: true, report_id: 'r5' }, error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await commitFullReport(baseInput);
    expect(preflightHardcap).toHaveBeenCalledWith(
      expect.objectContaining({
        month: '2026-06',
        callCount: 1,
        maxCostPerCallKrw: FULL_REPORT_MAX_COST_PER_CALL_KRW,
      }),
    );
  });

  it('section_8 키는 응답에 있어도 RPC payload에서 제외', async () => {
    const { callFullReport } = await import('@/lib/ai/full-report-client');
    const { createClient } = await import('@/lib/supabase/server');
    (callFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      content: JSON.stringify({ ...validResponse, section_8: { foo: 'bar' } }),
      usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
      costKrw: 0,
    });
    const rpc = vi.fn().mockResolvedValueOnce({ data: { success: true, report_id: 'r4' }, error: null });
    (createClient as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ rpc });
    const { commitFullReport } = await import('@/lib/report/full-report-writer');
    await commitFullReport(baseInput);
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(args).not.toHaveProperty('p_section_8');
  });
});
