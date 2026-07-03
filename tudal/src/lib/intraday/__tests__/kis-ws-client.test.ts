// kis-ws-client.test.ts — S7c intraday 연속 WS 워커 (spec 2026-07-03 §3 D-9)
//
// KIS OpenAPI 실 WS 클라이언트의 순수부(파서/제어메시지/tick 매핑/백오프) +
// 상태기계(fake WebSocket DI — 실 네트워크 0). 실 WS/실 KIS 호출은 테스트 금지.

import { describe, expect, it, vi } from "vitest";
import {
  buildKisSubscribeFrame,
  chunkKisDataRecords,
  computeKisBackoffMs,
  fetchKisApprovalKey,
  H0STCNT0_FIELD_INDEX,
  H0STCNT0_TR_ID,
  isKisPingpongControl,
  mapH0stcnt0Record,
  parseKisWsFrame,
  resolveKisEndpoints,
  startKisTickStream,
  summarizeKisControl,
  type KisWebSocketLike,
} from "@/lib/intraday/kis-ws-client";
import type { IntradayTick } from "@/lib/intraday/anomaly-detect";

// ---------------------------------------------------------------------------
// endpoints
// ---------------------------------------------------------------------------

describe("resolveKisEndpoints", () => {
  it("실전: REST 9443 + WS ops:21000", () => {
    const ep = resolveKisEndpoints(false);
    expect(ep.restBase).toBe("https://openapi.koreainvestment.com:9443");
    expect(ep.wsUrl).toBe("ws://ops.koreainvestment.com:21000");
  });

  it("모의(KIS_WS_MOCK): REST 29443 + WS ops:31000", () => {
    const ep = resolveKisEndpoints(true);
    expect(ep.restBase).toBe("https://openapivts.koreainvestment.com:29443");
    expect(ep.wsUrl).toBe("ws://ops.koreainvestment.com:31000");
  });
});

// ---------------------------------------------------------------------------
// frame parser
// ---------------------------------------------------------------------------

// H0STCNT0 44필드 중 앞 14필드만 실값 (index 13 = ACML_VOL). 나머지는 filler.
function h0stcnt0Fields(overrides: Partial<Record<number, string>> = {}): string[] {
  const fields = [
    "005930", // 0 MKSC_SHRN_ISCD
    "093015", // 1 STCK_CNTG_HOUR
    "71900", // 2 STCK_PRPR
    "5",
    "-100",
    "-0.14",
    "72023.83",
    "72100",
    "72400",
    "71700",
    "71900",
    "71800",
    "1",
    "3052507", // 13 ACML_VOL
  ];
  while (fields.length < 44) fields.push("0");
  for (const [idx, v] of Object.entries(overrides)) {
    fields[Number(idx)] = v as string;
  }
  return fields;
}

describe("parseKisWsFrame", () => {
  it("JSON 제어 메시지 → kind=control", () => {
    const raw = JSON.stringify({
      header: { tr_id: "H0STCNT0", tr_key: "005930", encrypt: "N" },
      body: { rt_cd: "0", msg_cd: "OPSP0000", msg1: "SUBSCRIBE SUCCESS" },
    });
    const frame = parseKisWsFrame(raw);
    expect(frame.kind).toBe("control");
  });

  it("파이프 데이터 프레임(0|) → kind=data + trId + count + fields", () => {
    const raw = `0|${H0STCNT0_TR_ID}|001|${h0stcnt0Fields().join("^")}`;
    const frame = parseKisWsFrame(raw);
    expect(frame.kind).toBe("data");
    if (frame.kind !== "data") throw new Error("unreachable");
    expect(frame.trId).toBe(H0STCNT0_TR_ID);
    expect(frame.count).toBe(1);
    expect(frame.fields[H0STCNT0_FIELD_INDEX.MKSC_SHRN_ISCD]).toBe("005930");
    expect(frame.fields[H0STCNT0_FIELD_INDEX.ACML_VOL]).toBe("3052507");
  });

  it("암호화 프레임(1|) → kind=encrypted (지원 밖 — 평문 수신 전제)", () => {
    const frame = parseKisWsFrame("1|H0STCNT0|001|xxxxencryptedxxxx");
    expect(frame.kind).toBe("encrypted");
    if (frame.kind !== "encrypted") throw new Error("unreachable");
    expect(frame.trId).toBe("H0STCNT0");
  });

  it("invalid JSON / 미지 포맷 → kind=unknown (throw 아님)", () => {
    expect(parseKisWsFrame("{broken json").kind).toBe("unknown");
    expect(parseKisWsFrame("not-a-frame").kind).toBe("unknown");
    expect(parseKisWsFrame("").kind).toBe("unknown");
    expect(parseKisWsFrame("0|TOO|FEW").kind).toBe("data"); // 4segment 미달이어도 안전 파싱
  });

  it("count 비정상(0/음수/NaN) → 1로 정규화", () => {
    const raw = `0|${H0STCNT0_TR_ID}|abc|${h0stcnt0Fields().join("^")}`;
    const frame = parseKisWsFrame(raw);
    if (frame.kind !== "data") throw new Error("unreachable");
    expect(frame.count).toBe(1);
  });
});

describe("isKisPingpongControl + summarizeKisControl", () => {
  it("header.tr_id=PINGPONG → true", () => {
    expect(
      isKisPingpongControl({ header: { tr_id: "PINGPONG", datetime: "20260703" } }),
    ).toBe(true);
  });

  it("일반 구독 응답 → false + summarize에 msg 노출(키 미노출)", () => {
    const payload = {
      header: { tr_id: "H0STCNT0" },
      body: { rt_cd: "0", msg_cd: "OPSP0000", msg1: "SUBSCRIBE SUCCESS" },
    };
    expect(isKisPingpongControl(payload)).toBe(false);
    const summary = summarizeKisControl(payload);
    expect(summary).toContain("H0STCNT0");
    expect(summary).toContain("SUBSCRIBE SUCCESS");
  });

  it("비-object payload → false / summarize 안전", () => {
    expect(isKisPingpongControl(null)).toBe(false);
    expect(isKisPingpongControl("PINGPONG")).toBe(false);
    expect(summarizeKisControl(null)).toBe("control:unknown");
  });
});

describe("chunkKisDataRecords", () => {
  it("count=1 → 전체 필드 단일 레코드", () => {
    const fields = h0stcnt0Fields();
    expect(chunkKisDataRecords(fields, 1)).toEqual([fields]);
  });

  it("count=2, 균등분할 가능 → 레코드 2개", () => {
    const a = h0stcnt0Fields();
    const b = h0stcnt0Fields({ 0: "000660", 2: "180000", 13: "999" });
    const records = chunkKisDataRecords([...a, ...b], 2);
    expect(records).toHaveLength(2);
    expect(records[0][0]).toBe("005930");
    expect(records[1][0]).toBe("000660");
    expect(records[1][13]).toBe("999");
  });

  it("count 불일치(비균등) → fail-soft 첫 레코드만", () => {
    const fields = h0stcnt0Fields();
    const records = chunkKisDataRecords([...fields, "extra"], 2);
    expect(records).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// tick 매핑
// ---------------------------------------------------------------------------

describe("mapH0stcnt0Record", () => {
  const now = new Date("2026-07-03T00:30:20Z"); // = 2026-07-03 09:30:20 KST

  it("정상 레코드 → IntradayTick (KST 날짜 + 체결시각 합성)", () => {
    const tick = mapH0stcnt0Record(h0stcnt0Fields(), { now });
    expect(tick).not.toBeNull();
    expect(tick?.ticker).toBe("005930");
    expect(tick?.lastPrice).toBe(71_900);
    expect(tick?.sessionVolume).toBe(3_052_507);
    // 093015 KST = 00:30:15 UTC
    expect(new Date(tick?.timestamp ?? "").toISOString()).toBe(
      "2026-07-03T00:30:15.000Z",
    );
  });

  it("6자리 아님 ticker → null (fail-soft)", () => {
    expect(mapH0stcnt0Record(h0stcnt0Fields({ 0: "12345" }), { now })).toBeNull();
    expect(mapH0stcnt0Record(h0stcnt0Fields({ 0: "" }), { now })).toBeNull();
  });

  it("가격 비정상(0/음수/NaN) → null", () => {
    expect(mapH0stcnt0Record(h0stcnt0Fields({ 2: "0" }), { now })).toBeNull();
    expect(mapH0stcnt0Record(h0stcnt0Fields({ 2: "-100" }), { now })).toBeNull();
    expect(mapH0stcnt0Record(h0stcnt0Fields({ 2: "abc" }), { now })).toBeNull();
  });

  it("누적거래량 비정상 → 0 (가격 트리거는 유지)", () => {
    const tick = mapH0stcnt0Record(h0stcnt0Fields({ 13: "-" }), { now });
    expect(tick?.sessionVolume).toBe(0);
  });

  it("체결시각 비정상 → now fallback", () => {
    const tick = mapH0stcnt0Record(h0stcnt0Fields({ 1: "999999" }), { now });
    expect(tick?.timestamp).toBe(now.toISOString());
  });
});

// ---------------------------------------------------------------------------
// 구독 프레임 + 백오프
// ---------------------------------------------------------------------------

describe("buildKisSubscribeFrame", () => {
  it("spec 구독 프레임 형태 (approval_key/custtype/tr_type/content-type + tr_id/tr_key)", () => {
    const frame = JSON.parse(buildKisSubscribeFrame("appr-key-1", "005930"));
    expect(frame.header).toEqual({
      approval_key: "appr-key-1",
      custtype: "P",
      tr_type: "1",
      "content-type": "utf-8",
    });
    expect(frame.body.input).toEqual({ tr_id: H0STCNT0_TR_ID, tr_key: "005930" });
  });
});

describe("computeKisBackoffMs", () => {
  it("지수 증가 + max cap", () => {
    expect(computeKisBackoffMs(0)).toBe(1_000);
    expect(computeKisBackoffMs(1)).toBe(2_000);
    expect(computeKisBackoffMs(3)).toBe(8_000);
    expect(computeKisBackoffMs(20)).toBe(60_000); // cap
    expect(computeKisBackoffMs(2, { baseMs: 500, maxMs: 1_500 })).toBe(1_500);
  });

  it("음수 attempt → base", () => {
    expect(computeKisBackoffMs(-1)).toBe(1_000);
  });
});

// ---------------------------------------------------------------------------
// approval key 발급
// ---------------------------------------------------------------------------

describe("fetchKisApprovalKey", () => {
  it("POST /oauth2/Approval {grant_type, appkey, secretkey} → approval_key", async () => {
    const fetchImpl = vi.fn(async (url: string, init: { body: string }) => {
      expect(url).toBe("https://openapi.koreainvestment.com:9443/oauth2/Approval");
      expect(JSON.parse(init.body)).toEqual({
        grant_type: "client_credentials",
        appkey: "AK",
        secretkey: "AS",
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ approval_key: "appr-1" }),
      };
    });
    const key = await fetchKisApprovalKey({
      appKey: "AK",
      appSecret: "AS",
      restBase: "https://openapi.koreainvestment.com:9443",
      fetchImpl,
    });
    expect(key).toBe("appr-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("HTTP 오류 → typed error (키 값 미노출)", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({}),
    }));
    await expect(
      fetchKisApprovalKey({
        appKey: "SECRET-APP-KEY",
        appSecret: "SECRET-APP-SECRET",
        restBase: "https://x",
        fetchImpl,
      }),
    ).rejects.toSatisfy((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      return (
        msg.includes("kis_approval_failed:403") &&
        !msg.includes("SECRET-APP-KEY") &&
        !msg.includes("SECRET-APP-SECRET")
      );
    });
  });

  it("approval_key 부재 응답 → kis_approval_invalid_response", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ something: "else" }),
    }));
    await expect(
      fetchKisApprovalKey({
        appKey: "AK",
        appSecret: "AS",
        restBase: "https://x",
        fetchImpl,
      }),
    ).rejects.toThrow(/kis_approval_invalid_response/);
  });

  it("appKey/appSecret 빈 값 → fail-closed (fetch 미호출)", async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchKisApprovalKey({ appKey: "", appSecret: "AS", restBase: "https://x", fetchImpl }),
    ).rejects.toThrow(/kis_approval_credentials_missing/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 상태기계 (fake WebSocket DI)
// ---------------------------------------------------------------------------

type Listener = (event: { data?: unknown }) => void;

class FakeWebSocket implements KisWebSocketLike {
  sent: string[] = [];
  closedByClient = false;
  private listeners = new Map<string, Listener[]>();

  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closedByClient = true;
    this.emit("close", {});
  }
  addEventListener(type: string, listener: Listener): void {
    const arr = this.listeners.get(type) ?? [];
    arr.push(listener);
    this.listeners.set(type, arr);
  }
  emit(type: string, event: { data?: unknown }): void {
    for (const l of this.listeners.get(type) ?? []) l(event);
  }
}

function flushMicrotasks(times = 6): Promise<void> {
  let p = Promise.resolve();
  for (let i = 0; i < times; i++) p = p.then(() => undefined);
  return p;
}

function streamHarness(overrides: { approvalKeys?: string[] } = {}) {
  const sockets: FakeWebSocket[] = [];
  const sleeps: number[] = [];
  let sleepResolvers: Array<() => void> = [];
  const approvalKeys = overrides.approvalKeys ?? ["appr-1", "appr-2", "appr-3"];
  let approvalCall = 0;
  const ticks: IntradayTick[] = [];
  const errors: Error[] = [];

  const deps = {
    wsUrl: "ws://fake:21000",
    getApprovalKey: vi.fn(async () => {
      const key = approvalKeys[Math.min(approvalCall, approvalKeys.length - 1)];
      approvalCall += 1;
      return key;
    }),
    webSocketFactory: vi.fn((url: string) => {
      expect(url).toBe("ws://fake:21000");
      const ws = new FakeWebSocket();
      sockets.push(ws);
      return ws;
    }),
    sleep: vi.fn((ms: number) => {
      sleeps.push(ms);
      return new Promise<void>((resolve) => {
        sleepResolvers.push(resolve);
      });
    }),
    log: vi.fn(),
  };

  const releaseSleeps = () => {
    const rs = sleepResolvers;
    sleepResolvers = [];
    rs.forEach((r) => r());
  };

  return { deps, sockets, sleeps, ticks, errors, releaseSleeps };
}

describe("startKisTickStream (상태기계)", () => {
  it("연결 → 전 ticker 구독 프레임 전송", async () => {
    const h = streamHarness();
    const stream = startKisTickStream(
      { tickers: ["005930", "000660"], onTick: (t) => {
        h.ticks.push(t);
      } },
      h.deps,
    );
    await flushMicrotasks();
    expect(h.sockets).toHaveLength(1);
    h.sockets[0].emit("open", {});
    expect(h.sockets[0].sent).toHaveLength(2);
    const first = JSON.parse(h.sockets[0].sent[0]);
    expect(first.header.approval_key).toBe("appr-1");
    expect(first.body.input.tr_key).toBe("005930");
    expect(JSON.parse(h.sockets[0].sent[1]).body.input.tr_key).toBe("000660");
    stream.close();
  });

  it("PINGPONG 제어 → 수신 원문 그대로 echo", async () => {
    const h = streamHarness();
    const stream = startKisTickStream(
      { tickers: ["005930"], onTick: (t) => {
        h.ticks.push(t);
      } },
      h.deps,
    );
    await flushMicrotasks();
    const ws = h.sockets[0];
    ws.emit("open", {});
    const raw = JSON.stringify({ header: { tr_id: "PINGPONG", datetime: "x" } });
    ws.emit("message", { data: raw });
    expect(ws.sent).toContain(raw);
    stream.close();
  });

  it("데이터 프레임 → onTick 호출 (multi-record 포함)", async () => {
    const h = streamHarness();
    const stream = startKisTickStream(
      { tickers: ["005930"], onTick: (t) => {
        h.ticks.push(t);
      } },
      h.deps,
    );
    await flushMicrotasks();
    const ws = h.sockets[0];
    ws.emit("open", {});
    const a = h0stcnt0Fields();
    const b = h0stcnt0Fields({ 0: "000660", 2: "180000" });
    ws.emit("message", {
      data: `0|${H0STCNT0_TR_ID}|002|${[...a, ...b].join("^")}`,
    });
    expect(h.ticks).toHaveLength(2);
    expect(h.ticks[0].ticker).toBe("005930");
    expect(h.ticks[1].ticker).toBe("000660");
    expect(h.ticks[1].lastPrice).toBe(180_000);
    stream.close();
  });

  it("암호화 프레임(1|) → skip (onTick 미호출) + 구조화 경고 로그", async () => {
    const h = streamHarness();
    const stream = startKisTickStream(
      { tickers: ["005930"], onTick: (t) => {
        h.ticks.push(t);
      } },
      h.deps,
    );
    await flushMicrotasks();
    const ws = h.sockets[0];
    ws.emit("open", {});
    ws.emit("message", { data: "1|H0STCNT0|001|encrypted-body" });
    expect(h.ticks).toHaveLength(0);
    expect(
      (h.deps.log.mock.calls as string[][]).some((c) =>
        String(c[0]).includes("encrypted"),
      ),
    ).toBe(true);
    stream.close();
  });

  it("close 이벤트 → 지수백오프 재연결 + 재구독 (새 approval key)", async () => {
    const h = streamHarness();
    const stream = startKisTickStream(
      { tickers: ["005930"], onTick: (t) => {
        h.ticks.push(t);
      } },
      h.deps,
    );
    await flushMicrotasks();
    h.sockets[0].emit("open", {});
    h.sockets[0].emit("close", {});
    await flushMicrotasks();
    expect(h.sleeps).toHaveLength(1); // backoff 대기 진입
    h.releaseSleeps();
    await flushMicrotasks();
    expect(h.sockets).toHaveLength(2); // 재연결
    h.sockets[1].emit("open", {});
    expect(h.sockets[1].sent).toHaveLength(1); // 재구독
    expect(JSON.parse(h.sockets[1].sent[0]).header.approval_key).toBe("appr-2");
    stream.close();
  });

  it("연속 실패 → 백오프 증가, open 성공 시 attempt 리셋", async () => {
    const h = streamHarness();
    const stream = startKisTickStream(
      { tickers: ["005930"], onTick: (t) => {
        h.ticks.push(t);
      } },
      h.deps,
    );
    await flushMicrotasks();
    // 1차: open 없이 즉시 close (실패)
    h.sockets[0].emit("close", {});
    await flushMicrotasks();
    h.releaseSleeps();
    await flushMicrotasks();
    // 2차: 또 실패
    h.sockets[1].emit("close", {});
    await flushMicrotasks();
    expect(h.sleeps[1]).toBeGreaterThan(h.sleeps[0]); // 지수 증가
    h.releaseSleeps();
    await flushMicrotasks();
    // 3차: open 성공 → attempt 리셋
    h.sockets[2].emit("open", {});
    h.sockets[2].emit("close", {});
    await flushMicrotasks();
    expect(h.sleeps[2]).toBe(h.sleeps[0]); // 리셋 후 base 백오프
    stream.close();
  });

  it("stream.close() → 소켓 close + 재연결 중단", async () => {
    const h = streamHarness();
    const stream = startKisTickStream(
      { tickers: ["005930"], onTick: (t) => {
        h.ticks.push(t);
      } },
      h.deps,
    );
    await flushMicrotasks();
    h.sockets[0].emit("open", {});
    stream.close();
    await flushMicrotasks();
    h.releaseSleeps();
    await flushMicrotasks();
    expect(h.sockets[0].closedByClient).toBe(true);
    expect(h.sockets).toHaveLength(1); // 재연결 없음
  });

  it("approval key 발급 실패 → onError + 백오프 후 재시도", async () => {
    const errors: Error[] = [];
    const h = streamHarness();
    h.deps.getApprovalKey
      .mockRejectedValueOnce(new Error("kis_approval_failed:500"))
      .mockResolvedValue("appr-late");
    const stream = startKisTickStream(
      {
        tickers: ["005930"],
        onTick: () => {},
        onError: (e) => errors.push(e),
      },
      h.deps,
    );
    await flushMicrotasks();
    expect(errors.some((e) => e.message.includes("kis_approval_failed"))).toBe(true);
    expect(h.sockets).toHaveLength(0); // 발급 실패 → 연결 미시도
    h.releaseSleeps();
    await flushMicrotasks();
    expect(h.sockets).toHaveLength(1); // 백오프 후 재시도
    stream.close();
  });

  it("비문자열 message data → skip (binary 미지원)", async () => {
    const h = streamHarness();
    const stream = startKisTickStream(
      { tickers: ["005930"], onTick: (t) => {
        h.ticks.push(t);
      } },
      h.deps,
    );
    await flushMicrotasks();
    h.sockets[0].emit("open", {});
    h.sockets[0].emit("message", { data: new ArrayBuffer(8) });
    expect(h.ticks).toHaveLength(0);
    stream.close();
  });
});
