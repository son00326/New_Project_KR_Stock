// kis-websocket.test.ts — subscribeKisTicks 실모드 배선 (S7c 워커, 2026-07-04)
//
// 계약 불변 pin: KisSubscribeOptions/KisSubscription + 키 부재 시 mock-mode no-op
// fail-soft 의미 보존. 실모드는 kis-ws-client startKisTickStream 위임 (mock 주입).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isKisWebSocketConfigured,
  subscribeKisTicks,
} from "@/lib/intraday/kis-websocket";

const mocks = vi.hoisted(() => ({
  startKisTickStream: vi.fn(),
  fetchKisApprovalKey: vi.fn(),
  streamClose: vi.fn(),
}));

vi.mock("@/lib/intraday/kis-ws-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/intraday/kis-ws-client")>();
  return {
    ...actual,
    startKisTickStream: mocks.startKisTickStream,
    fetchKisApprovalKey: mocks.fetchKisApprovalKey,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.startKisTickStream.mockReturnValue({ close: mocks.streamClose });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isKisWebSocketConfigured", () => {
  it("KIS_APP_KEY/SECRET 둘 다 있어야 true", () => {
    vi.stubEnv("KIS_APP_KEY", "");
    vi.stubEnv("KIS_APP_SECRET", "");
    expect(isKisWebSocketConfigured()).toBe(false);
    vi.stubEnv("KIS_APP_KEY", "k");
    expect(isKisWebSocketConfigured()).toBe(false);
    vi.stubEnv("KIS_APP_SECRET", "s");
    expect(isKisWebSocketConfigured()).toBe(true);
  });
});

describe("subscribeKisTicks", () => {
  it("키 부재 → mock-mode no-op (기존 fail-soft 의미 보존, 실 클라이언트 미기동)", () => {
    vi.stubEnv("KIS_APP_KEY", "");
    vi.stubEnv("KIS_APP_SECRET", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sub = subscribeKisTicks({
      tickers: ["005930"],
      onTick: () => {},
    });
    expect(sub.mockMode).toBe(true);
    expect(mocks.startKisTickStream).not.toHaveBeenCalled();
    sub.close(); // no-op이어야
    expect(mocks.streamClose).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("키 존재 → 실모드 스트림 기동 (실전 endpoint) + close 위임", () => {
    vi.stubEnv("KIS_APP_KEY", "app-key");
    vi.stubEnv("KIS_APP_SECRET", "app-secret");
    vi.stubEnv("KIS_WS_MOCK", "");
    const onTick = vi.fn();
    const sub = subscribeKisTicks({ tickers: ["005930", "000660"], onTick });
    expect(sub.mockMode).toBe(false);
    expect(mocks.startKisTickStream).toHaveBeenCalledTimes(1);
    const [optionsArg, depsArg] = mocks.startKisTickStream.mock.calls[0];
    expect(optionsArg.tickers).toEqual(["005930", "000660"]);
    expect(depsArg.wsUrl).toBe("ws://ops.koreainvestment.com:21000");
    sub.close();
    expect(mocks.streamClose).toHaveBeenCalledTimes(1);
  });

  it("KIS_WS_MOCK=true → 모의투자 WS 도메인", () => {
    vi.stubEnv("KIS_APP_KEY", "app-key");
    vi.stubEnv("KIS_APP_SECRET", "app-secret");
    vi.stubEnv("KIS_WS_MOCK", "true");
    subscribeKisTicks({ tickers: ["005930"], onTick: () => {} });
    const [, depsArg] = mocks.startKisTickStream.mock.calls[0];
    expect(depsArg.wsUrl).toBe("ws://ops.koreainvestment.com:31000");
  });

  it("getApprovalKey는 env 키로 fetchKisApprovalKey에 위임 (모의 REST 도메인)", async () => {
    vi.stubEnv("KIS_APP_KEY", "app-key");
    vi.stubEnv("KIS_APP_SECRET", "app-secret");
    vi.stubEnv("KIS_WS_MOCK", "true");
    mocks.fetchKisApprovalKey.mockResolvedValue("appr-1");
    subscribeKisTicks({ tickers: ["005930"], onTick: () => {} });
    const [, depsArg] = mocks.startKisTickStream.mock.calls[0];
    await expect(depsArg.getApprovalKey()).resolves.toBe("appr-1");
    expect(mocks.fetchKisApprovalKey).toHaveBeenCalledWith({
      appKey: "app-key",
      appSecret: "app-secret",
      restBase: "https://openapivts.koreainvestment.com:29443",
    });
  });
});
