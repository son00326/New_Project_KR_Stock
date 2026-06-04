// W3a (D1/D2/D3) — KRX EOD 종가 fetcher + 거래일 해석 + 콤마 파서.
import { describe, it, expect } from 'vitest';
import {
  parseKrxClose,
  fetchEodCloseMap,
  resolveLatestCompletedTradingDay,
  resolveEntryPricesKrw,
  type KrxFetchResult,
} from '../krx-eod';

describe('parseKrxClose', () => {
  it('콤마 종가 → positive number / invalid·zero·negative → null', () => {
    expect(parseKrxClose('71,200')).toBe(71200);
    expect(parseKrxClose('1500')).toBe(1500);
    for (const v of ['-', '', 'N/A', 'n/a', null, '0', '-10']) {
      expect(parseKrxClose(v)).toBeNull();
    }
  });
});

function okJson(rows: unknown): KrxFetchResult {
  return { ok: true, status: 200, json: async () => ({ OutBlock_1: rows }) };
}

describe('fetchEodCloseMap', () => {
  it('OutBlock_1 → Map<6자리 ISU_CD, 종가>, AUTH_KEY 헤더 주입 + endpoint/basDd', async () => {
    const calls: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchImpl = async (url: string, init: { headers: Record<string, string> }) => {
      calls.push({ url, headers: init.headers });
      return okJson([
        { ISU_CD: '005930', ISU_NM: '삼성전자', TDD_CLSPRC: '71,200' },
        { ISU_CD: '000660', ISU_NM: 'SK하이닉스', TDD_CLSPRC: '180,000' },
        { ISU_CD: 'BADCODE', TDD_CLSPRC: '1' }, // 6자리 아님 → skip
        { ISU_CD: '111111', TDD_CLSPRC: '-' }, // 종가 invalid → skip
      ]);
    };
    const m = await fetchEodCloseMap({ basDd: '20260605', market: 'KOSPI', fetchImpl, authKey: 'k' });
    expect(m.get('005930')).toBe(71200);
    expect(m.get('000660')).toBe(180000);
    expect(m.size).toBe(2);
    expect(calls[0].headers.AUTH_KEY).toBe('k');
    expect(calls[0].url).toContain('stk_bydd_trd');
    expect(calls[0].url).toContain('basDd=20260605');
  });

  it('빈 OutBlock_1(휴장/미갱신) = 빈 Map', async () => {
    const m = await fetchEodCloseMap({
      basDd: '20260606',
      market: 'KOSPI',
      fetchImpl: async () => okJson([]),
      authKey: 'k',
    });
    expect(m.size).toBe(0);
  });

  it('KOSDAQ endpoint 정합', async () => {
    const calls: string[] = [];
    await fetchEodCloseMap({
      basDd: '20260605',
      market: 'KOSDAQ',
      fetchImpl: async (url) => {
        calls.push(url);
        return okJson([{ ISU_CD: '035720', TDD_CLSPRC: '50,000' }]);
      },
      authKey: 'k',
    });
    expect(calls[0]).toContain('ksq_bydd_trd');
  });

  it('authKey 빈 값 → krx_auth_key_missing (fetch 미호출)', async () => {
    let called = false;
    await expect(
      fetchEodCloseMap({
        basDd: '20260605',
        market: 'KOSPI',
        fetchImpl: async () => {
          called = true;
          return okJson([]);
        },
        authKey: '  ',
      }),
    ).rejects.toThrow('krx_auth_key_missing');
    expect(called).toBe(false);
  });

  it('payload malformed(OutBlock_1 비-list, root 비-object) → krx_eod_payload_invalid throw', async () => {
    await expect(
      fetchEodCloseMap({
        basDd: '20260605',
        market: 'KOSPI',
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ OutBlock_1: 'nope' }) }),
        authKey: 'k',
      }),
    ).rejects.toThrow('krx_eod_payload_invalid:OutBlock_1');
    await expect(
      fetchEodCloseMap({
        basDd: '20260605',
        market: 'KOSPI',
        fetchImpl: async () => ({ ok: true, status: 200, json: async () => [1, 2] }),
        authKey: 'k',
      }),
    ).rejects.toThrow('krx_eod_payload_invalid:root');
    await expect(
      fetchEodCloseMap({
        basDd: '20260605',
        market: 'KOSPI',
        fetchImpl: async () => okJson([null]),
        authKey: 'k',
      }),
    ).rejects.toThrow('krx_eod_payload_invalid:OutBlock_1_row');
  });

  it('4xx 즉시 throw(키 미노출) / 429 backoff 후 성공', async () => {
    await expect(
      fetchEodCloseMap({
        basDd: '20260605',
        market: 'KOSPI',
        fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }),
        authKey: 'secret',
      }),
    ).rejects.toThrow(/krx_eod_fetch_failed:401/);

    let n = 0;
    const m = await fetchEodCloseMap({
      basDd: '20260605',
      market: 'KOSDAQ',
      sleepImpl: async () => {},
      fetchImpl: async () =>
        ++n < 2
          ? { ok: false, status: 429, json: async () => ({}) }
          : okJson([{ ISU_CD: '035720', TDD_CLSPRC: '50,000' }]),
      authKey: 'k',
    });
    expect(m.get('035720')).toBe(50000);
    expect(n).toBe(2);
  });

  it('throw 메시지에 authKey 비노출', async () => {
    let captured = '';
    try {
      await fetchEodCloseMap({
        basDd: '20260605',
        market: 'KOSPI',
        fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }),
        authKey: 'SUPERSECRET',
      });
    } catch (e) {
      captured = String(e);
    }
    expect(captured).not.toContain('SUPERSECRET');
    expect(captured).toContain('krx_eod_fetch_failed');
  });
});

describe('resolveLatestCompletedTradingDay', () => {
  const days = [
    { date: '2026-06-04', isBusinessDay: true, holidayName: null },
    { date: '2026-06-05', isBusinessDay: true, holidayName: null },
    { date: '2026-06-06', isBusinessDay: false, holidayName: '현충일' },
    { date: '2026-06-07', isBusinessDay: false, holidayName: null },
  ];

  it('KST cutoff: 영업일 당일이어도 장마감 전(18시 KST)이면 직전 영업일', () => {
    // 2026-06-05T05:00Z = 14:00 KST < 18 → 직전 영업일 06-04
    expect(resolveLatestCompletedTradingDay(new Date('2026-06-05T05:00:00Z'), days)).toBe('20260604');
  });

  it('KST cutoff 후(18시 이후)면 당일', () => {
    // 2026-06-05T09:30Z = 18:30 KST ≥ 18 → 당일 06-05
    expect(resolveLatestCompletedTradingDay(new Date('2026-06-05T09:30:00Z'), days)).toBe('20260605');
  });

  it('주말/공휴일 walk-back', () => {
    // 2026-06-07(일) → 06-06(현충일 토)·06-05(금)으로 walk-back
    expect(resolveLatestCompletedTradingDay(new Date('2026-06-07T05:00:00Z'), days)).toBe('20260605');
  });

  it('stale calendar fail-closed: 후보가 maxLookbackDays 밖 → null (연도경계 stale 종가 방지)', () => {
    expect(resolveLatestCompletedTradingDay(new Date('2027-06-05T05:00:00Z'), days)).toBeNull();
  });

  it('영업일 전무 → null', () => {
    expect(
      resolveLatestCompletedTradingDay(new Date('2026-06-07T05:00:00Z'), [
        { date: '2026-06-06', isBusinessDay: false },
        { date: '2026-06-07', isBusinessDay: false },
      ]),
    ).toBeNull();
  });
});

describe('resolveEntryPricesKrw', () => {
  it('KOSPI+KOSDAQ 2콜 병합 + tickers만 lookup (누락은 Map 부재)', async () => {
    const fetchImpl = async (url: string): Promise<KrxFetchResult> =>
      url.includes('stk_bydd_trd')
        ? okJson([{ ISU_CD: '005930', TDD_CLSPRC: '71,200' }])
        : okJson([{ ISU_CD: '035720', TDD_CLSPRC: '50,000' }]);
    const m = await resolveEntryPricesKrw(['005930', '035720', '999999'], {
      authKey: 'k',
      basDd: '20260605',
      fetchImpl,
    });
    expect(m.get('005930')).toBe(71200);
    expect(m.get('035720')).toBe(50000);
    expect(m.has('999999')).toBe(false); // 누락
    expect(m.size).toBe(2);
  });
});
