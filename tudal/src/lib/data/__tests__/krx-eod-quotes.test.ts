// krx-eod-quotes.test.ts — S7c 워커 컨텍스트용 additive 확장 (spec 2026-07-03 §3 D-10)
//
// fetchEodQuoteMap(종가+누적거래량 ACC_TRDVOL 동시 반환) + parseKrxVolume.
// 기존 fetchEodCloseMap 시그니처/동작 불변 — 회귀는 krx-eod.test.ts가 pin.

import { describe, expect, it, vi } from 'vitest';
import {
  fetchEodQuoteMap,
  parseKrxVolume,
  type KrxFetchImpl,
} from '@/lib/data/krx-eod';

describe('parseKrxVolume', () => {
  it('콤마 거래량 → number, 0 허용(거래정지)', () => {
    expect(parseKrxVolume('3,052,507')).toBe(3_052_507);
    expect(parseKrxVolume('0')).toBe(0);
    expect(parseKrxVolume(12345)).toBe(12345);
  });

  it("invalid('-'/''/'N/A'/null/음수) → null", () => {
    expect(parseKrxVolume('-')).toBeNull();
    expect(parseKrxVolume('')).toBeNull();
    expect(parseKrxVolume('N/A')).toBeNull();
    expect(parseKrxVolume(null)).toBeNull();
    expect(parseKrxVolume(undefined)).toBeNull();
    expect(parseKrxVolume('-100')).toBeNull();
    expect(parseKrxVolume('abc')).toBeNull();
  });
});

function fetchImplWith(rows: unknown[]): KrxFetchImpl {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ OutBlock_1: rows }),
  }));
}

describe('fetchEodQuoteMap', () => {
  it('OutBlock_1 → Map<6자리 ISU_CD, {close, volume}> (AUTH_KEY 헤더 + endpoint)', async () => {
    const fetchImpl = vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
      expect(url).toBe(
        'https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd?basDd=20260702',
      );
      expect(init.headers.AUTH_KEY).toBe('test-key');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          OutBlock_1: [
            { ISU_CD: '005930', TDD_CLSPRC: '71,900', ACC_TRDVOL: '3,052,507' },
            { ISU_CD: '000660', TDD_CLSPRC: '180,000', ACC_TRDVOL: '0' },
          ],
        }),
      };
    });
    const map = await fetchEodQuoteMap({
      basDd: '20260702',
      market: 'KOSPI',
      authKey: 'test-key',
      fetchImpl,
    });
    expect(map.get('005930')).toEqual({ close: 71_900, volume: 3_052_507 });
    expect(map.get('000660')).toEqual({ close: 180_000, volume: 0 });
  });

  it('종가 invalid 행은 제외 / 거래량 invalid는 volume:null로 보존(가격 트리거용)', async () => {
    const map = await fetchEodQuoteMap({
      basDd: '20260702',
      market: 'KOSDAQ',
      authKey: 'k',
      fetchImpl: fetchImplWith([
        { ISU_CD: '035720', TDD_CLSPRC: '-', ACC_TRDVOL: '100' }, // 종가 invalid → 행 제외
        { ISU_CD: '068270', TDD_CLSPRC: '55,000', ACC_TRDVOL: '-' }, // 거래량 invalid → null
        { ISU_CD: 'BAD', TDD_CLSPRC: '1,000', ACC_TRDVOL: '10' }, // 코드 invalid → 제외
      ]),
    });
    expect(map.has('035720')).toBe(false);
    expect(map.get('068270')).toEqual({ close: 55_000, volume: null });
    expect(map.size).toBe(1);
  });

  it('빈 OutBlock_1(휴장) → 빈 Map / malformed payload → throw', async () => {
    const empty = await fetchEodQuoteMap({
      basDd: '20260702',
      market: 'KOSPI',
      authKey: 'k',
      fetchImpl: fetchImplWith([]),
    });
    expect(empty.size).toBe(0);

    const badImpl: KrxFetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ OutBlock_1: 'not-a-list' }),
    }));
    await expect(
      fetchEodQuoteMap({ basDd: '20260702', market: 'KOSPI', authKey: 'k', fetchImpl: badImpl }),
    ).rejects.toThrow(/krx_eod_payload_invalid:OutBlock_1/);
  });

  it('authKey 빈 값 → krx_auth_key_missing / 4xx 즉시 throw(키 미노출)', async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchEodQuoteMap({ basDd: '20260702', market: 'KOSPI', authKey: '  ', fetchImpl }),
    ).rejects.toThrow('krx_auth_key_missing');
    expect(fetchImpl).not.toHaveBeenCalled();

    const denyImpl: KrxFetchImpl = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({}),
    }));
    await expect(
      fetchEodQuoteMap({
        basDd: '20260702',
        market: 'KOSPI',
        authKey: 'secret-auth-key',
        fetchImpl: denyImpl,
      }),
    ).rejects.toSatisfy((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      return msg.includes('krx_eod_fetch_failed:403') && !msg.includes('secret-auth-key');
    });
  });

  it('429 → backoff 재시도 후 성공', async () => {
    let call = 0;
    const fetchImpl: KrxFetchImpl = vi.fn(async () => {
      call += 1;
      if (call === 1) return { ok: false, status: 429, json: async () => ({}) };
      return {
        ok: true,
        status: 200,
        json: async () => ({
          OutBlock_1: [{ ISU_CD: '005930', TDD_CLSPRC: '100', ACC_TRDVOL: '5' }],
        }),
      };
    });
    const sleeps: number[] = [];
    const map = await fetchEodQuoteMap({
      basDd: '20260702',
      market: 'KOSPI',
      authKey: 'k',
      fetchImpl,
      sleepImpl: async (ms) => {
        sleeps.push(ms);
      },
    });
    expect(map.get('005930')).toEqual({ close: 100, volume: 5 });
    expect(sleeps).toHaveLength(1);
  });
});
