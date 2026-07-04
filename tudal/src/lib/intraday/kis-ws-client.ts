import type { IntradayTick } from "@/lib/intraday/anomaly-detect";

// ---------------------------------------------------------------------------
// KIS OpenAPI 실시간 WebSocket 클라이언트 (S7c intraday 연속 WS 워커, 2026-07-04)
// spec: docs/superpowers/specs/2026-07-03-prelaunch-netnew-3-builds.md §3 D-9
// ref: https://apiportal.koreainvestment.com + github.com/koreainvestment/open-trading-api
//
// 구성:
//   - 순수부: 프레임 파서(parseKisWsFrame) / 제어메시지 판별(PINGPONG) /
//     H0STCNT0 record → IntradayTick 매핑 / 지수백오프 계산 — 전부 vitest 커버.
//   - 상태기계: startKisTickStream — WebSocket 구현체 DI(webSocketFactory)로
//     실 네트워크 없이 테스트. 재연결(지수백오프 cap) + 재구독(approval key 재발급).
//   - 실 I/O: fetchKisApprovalKey(POST /oauth2/Approval) — fetchImpl DI seam.
//     appkey/secretkey 값은 로그/에러 메시지에 절대 미포함.
//
// 평문 수신 전제: H0STCNT0 구독은 비암호화 평문("0|...") 수신이 기본.
// 암호화 프레임("1|...")은 지원 밖 — 구조화 경고 후 skip (AES 복호화 미구현).
// ---------------------------------------------------------------------------

export const H0STCNT0_TR_ID = "H0STCNT0";

// H0STCNT0(국내주식 실시간체결가) 필드 인덱스.
// 검증: github.com/koreainvestment/open-trading-api
//   examples_user/domestic_stock/domestic_stock_functions_ws.py ccnl_krx() 컬럼 리스트
//   (2026-07-04 WebFetch 확인 — 0:MKSC_SHRN_ISCD, 1:STCK_CNTG_HOUR, 2:STCK_PRPR, 13:ACML_VOL).
// WATCH: KIS 키 주입 후 실 스모크에서 필드 인덱스 실측 재검증 (USER 게이트 ③ 이후).
export const H0STCNT0_FIELD_INDEX = {
  /** 유가증권 단축 종목코드 (6자리) */
  MKSC_SHRN_ISCD: 0,
  /** 주식 체결 시간 (HHMMSS, KST) */
  STCK_CNTG_HOUR: 1,
  /** 주식 현재가 */
  STCK_PRPR: 2,
  /** 누적 거래량 */
  ACML_VOL: 13,
} as const;

// ---------------------------------------------------------------------------
// endpoints
// ---------------------------------------------------------------------------

export interface KisEndpoints {
  restBase: string;
  wsUrl: string;
}

/** mock=true → 모의투자 도메인 (env KIS_WS_MOCK==="true" 시 caller가 전달). */
export function resolveKisEndpoints(mock: boolean): KisEndpoints {
  return mock
    ? {
        restBase: "https://openapivts.koreainvestment.com:29443",
        wsUrl: "ws://ops.koreainvestment.com:31000",
      }
    : {
        restBase: "https://openapi.koreainvestment.com:9443",
        wsUrl: "ws://ops.koreainvestment.com:21000",
      };
}

// ---------------------------------------------------------------------------
// 프레임 파서 (순수)
// ---------------------------------------------------------------------------

export type KisWsFrame =
  | { kind: "control"; payload: Record<string, unknown> }
  | { kind: "data"; trId: string; count: number; fields: string[] }
  | { kind: "encrypted"; trId: string }
  | { kind: "unknown"; raw: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

/**
 * KIS WS 수신 원문 파싱.
 * - JSON("{"로 시작) = 제어 메시지 (SUBSCRIBE SUCCESS / PINGPONG 등).
 * - "0|<tr_id>|<count>|<필드^구분>" = 평문 데이터 프레임.
 * - "1|..." = 암호화 프레임 (지원 밖 — caller가 경고 후 skip).
 * 어떤 입력에도 throw 하지 않는다 (unknown fail-soft).
 */
export function parseKisWsFrame(raw: string): KisWsFrame {
  if (raw.startsWith("{")) {
    try {
      const payload: unknown = JSON.parse(raw);
      if (isRecord(payload)) return { kind: "control", payload };
    } catch {
      // fallthrough → unknown
    }
    return { kind: "unknown", raw };
  }
  if (raw.startsWith("0|") || raw.startsWith("1|")) {
    const parts = raw.split("|");
    const trId = parts[1] ?? "";
    if (raw.startsWith("1|")) return { kind: "encrypted", trId };
    // 데이터 본문에 '|'가 포함될 가능성 방어 — 4번째 세그먼트 이후 재결합.
    const payload = parts.slice(3).join("|");
    const countRaw = Number(parts[2]);
    const count =
      Number.isFinite(countRaw) && countRaw > 0 ? Math.floor(countRaw) : 1;
    return { kind: "data", trId, count, fields: payload.split("^") };
  }
  return { kind: "unknown", raw };
}

/** 제어 메시지가 PINGPONG인지 판별 — PINGPONG은 수신 원문 그대로 echo해야 세션 유지. */
export function isKisPingpongControl(payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  const header = payload["header"];
  return isRecord(header) && header["tr_id"] === "PINGPONG";
}

/** 제어 메시지 로그 요약 (tr_id/msg_cd/msg1만 — 키/시크릿 값 미포함). */
export function summarizeKisControl(payload: unknown): string {
  if (!isRecord(payload)) return "control:unknown";
  const header = isRecord(payload["header"]) ? payload["header"] : {};
  const body = isRecord(payload["body"]) ? payload["body"] : {};
  const trId = header["tr_id"] ?? "?";
  const trKey = header["tr_key"] ?? "";
  const msgCd = body["msg_cd"] ?? "";
  const msg1 = body["msg1"] ?? "";
  return `control tr_id=${String(trId)} tr_key=${String(trKey)} msg_cd=${String(msgCd)} msg1=${String(msg1)}`;
}

/**
 * 데이터 프레임 필드 배열 → count개 레코드로 분할.
 * count로 균등분할 불가(레이아웃 불일치) 시 fail-soft로 첫 레코드만 시도.
 */
export function chunkKisDataRecords(
  fields: string[],
  count: number,
): string[][] {
  if (count <= 1) return [fields];
  if (fields.length % count === 0) {
    const width = fields.length / count;
    const records: string[][] = [];
    for (let i = 0; i < count; i++) {
      records.push(fields.slice(i * width, (i + 1) * width));
    }
    return records;
  }
  return [fields];
}

// ---------------------------------------------------------------------------
// H0STCNT0 record → IntradayTick (순수)
// ---------------------------------------------------------------------------

const TICKER_RE = /^\d{6}$/;
const HHMMSS_RE = /^\d{6}$/;
const KST_OFFSET_MS = 9 * 3600 * 1000;

/** 체결시각(HHMMSS, KST) + now의 KST 날짜 → ISO timestamp. 비정상 시각은 now fallback. */
function composeKstTimestamp(hhmmss: string, now: Date): string {
  if (!HHMMSS_RE.test(hhmmss)) return now.toISOString();
  const hh = Number(hhmmss.slice(0, 2));
  const mm = Number(hhmmss.slice(2, 4));
  const ss = Number(hhmmss.slice(4, 6));
  if (hh > 23 || mm > 59 || ss > 59) return now.toISOString();
  const kstDate = new Date(now.getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
  return new Date(
    `${kstDate}T${hhmmss.slice(0, 2)}:${hhmmss.slice(2, 4)}:${hhmmss.slice(4, 6)}+09:00`,
  ).toISOString();
}

/**
 * H0STCNT0 단일 레코드 → IntradayTick. 비정상 레코드는 null (fail-soft — throw 금지).
 * 누적거래량 파싱 실패는 0 (가격 트리거는 유지, 거래량 트리거만 비활성 — anomaly-detect
 * computeVolumeRatio가 avg<=0 → 0 반환하는 fail-soft와 대칭).
 */
export function mapH0stcnt0Record(
  record: string[],
  opts: { now: Date },
): IntradayTick | null {
  const ticker = (record[H0STCNT0_FIELD_INDEX.MKSC_SHRN_ISCD] ?? "").trim();
  if (!TICKER_RE.test(ticker)) return null;
  const lastPrice = Number(record[H0STCNT0_FIELD_INDEX.STCK_PRPR]);
  if (!Number.isFinite(lastPrice) || lastPrice <= 0) return null;
  const volRaw = Number(record[H0STCNT0_FIELD_INDEX.ACML_VOL]);
  const sessionVolume = Number.isFinite(volRaw) && volRaw >= 0 ? volRaw : 0;
  const timestamp = composeKstTimestamp(
    (record[H0STCNT0_FIELD_INDEX.STCK_CNTG_HOUR] ?? "").trim(),
    opts.now,
  );
  return { ticker, lastPrice, timestamp, sessionVolume };
}

// ---------------------------------------------------------------------------
// 구독 프레임 + 백오프 (순수)
// ---------------------------------------------------------------------------

/** H0STCNT0 구독 등록 프레임 (tr_type "1" = 등록). */
export function buildKisSubscribeFrame(
  approvalKey: string,
  ticker: string,
): string {
  return JSON.stringify({
    header: {
      approval_key: approvalKey,
      custtype: "P",
      tr_type: "1",
      "content-type": "utf-8",
    },
    body: { input: { tr_id: H0STCNT0_TR_ID, tr_key: ticker } },
  });
}

const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;

/** 지수백오프: min(base·2^attempt, max). attempt<0은 base. */
export function computeKisBackoffMs(
  attempt: number,
  opts: { baseMs?: number; maxMs?: number } = {},
): number {
  const baseMs = opts.baseMs ?? BACKOFF_BASE_MS;
  const maxMs = opts.maxMs ?? BACKOFF_MAX_MS;
  const n = Math.max(0, Math.floor(attempt));
  return Math.min(baseMs * 2 ** n, maxMs);
}

// ---------------------------------------------------------------------------
// approval key 발급 (실 I/O — fetchImpl DI seam)
// ---------------------------------------------------------------------------

export interface KisApprovalFetchResult {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}
export type KisApprovalFetchImpl = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<KisApprovalFetchResult>;

/**
 * WS approval_key 발급: POST {restBase}/oauth2/Approval
 * body = { grant_type: "client_credentials", appkey, secretkey }.
 * 오류 메시지에 appKey/appSecret 값 절대 미포함.
 */
export async function fetchKisApprovalKey(opts: {
  appKey: string;
  appSecret: string;
  restBase: string;
  fetchImpl?: KisApprovalFetchImpl;
}): Promise<string> {
  if (!opts.appKey.trim() || !opts.appSecret.trim()) {
    throw new Error("kis_approval_credentials_missing");
  }
  const fetchImpl: KisApprovalFetchImpl =
    opts.fetchImpl ??
    (async (url, init) => {
      const r = await fetch(url, init);
      return { ok: r.ok, status: r.status, json: () => r.json() };
    });
  const res = await fetchImpl(`${opts.restBase}/oauth2/Approval`, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      appkey: opts.appKey,
      secretkey: opts.appSecret,
    }),
  });
  if (!res.ok) {
    throw new Error(`kis_approval_failed:${res.status}`); // 키 값 미노출
  }
  const payload = await res.json();
  const key = isRecord(payload) ? payload["approval_key"] : undefined;
  if (typeof key !== "string" || key.length === 0) {
    throw new Error("kis_approval_invalid_response");
  }
  return key;
}

// ---------------------------------------------------------------------------
// 상태기계: 연결 → 구독 → 수신 dispatch → 재연결(백오프) — WebSocket DI
// ---------------------------------------------------------------------------

/** WHATWG WebSocket 최소 계약 (Node 22+ 내장 WebSocket 호환·테스트 fake 주입용). */
export interface KisWebSocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(
    type: "open" | "message" | "close" | "error",
    listener: (event: { data?: unknown }) => void,
  ): void;
}

export interface KisTickStreamOptions {
  tickers: string[];
  onTick: (tick: IntradayTick) => void | Promise<void>;
  onError?: (error: Error) => void;
}

export interface KisTickStreamDeps {
  wsUrl: string;
  getApprovalKey: () => Promise<string>;
  webSocketFactory: (url: string) => KisWebSocketLike;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  log?: (message: string) => void;
  maxBackoffMs?: number;
}

export interface KisTickStream {
  close: () => void;
  /** test-only — 대기 중 close waiter 수 (omxy R2 MEDIUM leak 회귀 pin용). */
  __waiterCountForTests: () => number;
}

/**
 * 연속 tick 스트림: approval key 발급 → 연결 → 전 ticker 구독 → 수신 dispatch.
 * 끊기면 지수백오프(cap) 후 key 재발급 + 재연결 + 재구독. close()로 영구 종료.
 * onTick/onError 콜백 내 예외는 스트림을 죽이지 않는다 (fail-soft).
 */
export function startKisTickStream(
  options: KisTickStreamOptions,
  deps: KisTickStreamDeps,
): KisTickStream {
  const sleep =
    deps.sleep ??
    ((ms: number) =>
      new Promise<void>((r) => {
        const t = setTimeout(r, ms);
        // omxy R1 MEDIUM: 백오프 타이머가 프로세스 종료를 붙잡지 않게 unref
        // (close 후에는 아래 closeSignal race 승자가 루프를 즉시 탈출시킨다).
        (t as unknown as { unref?: () => void }).unref?.();
      }));
  const log = deps.log ?? ((m: string) => console.log(m));
  const nowFn = deps.now ?? (() => new Date());

  let closed = false;
  let activeSocket: KisWebSocketLike | null = null;
  let attempt = 0;
  // close() 시 진행 중 백오프 sleep을 즉시 이기는 race 신호 (최대 60s 종료 지연 방지).
  // omxy R2 MEDIUM: sleep이 race를 이기면 resolver를 즉시 제거(finally cleanup) — 장중
  // 재연결이 반복돼도 waiter가 누적되지 않는다(resolver 미참조 → signal promise GC 가능).
  const closeWaiters: Array<() => void> = [];
  const interruptibleBackoff = async (ms: number) => {
    if (closed) return;
    let cleanup = () => {};
    const signal = new Promise<void>((resolve) => {
      closeWaiters.push(resolve);
      cleanup = () => {
        const i = closeWaiters.indexOf(resolve);
        if (i >= 0) closeWaiters.splice(i, 1);
      };
    });
    try {
      await Promise.race([sleep(ms), signal]);
    } finally {
      cleanup();
    }
  };

  const reportError = (err: unknown) => {
    try {
      options.onError?.(err instanceof Error ? err : new Error(String(err)));
    } catch {
      // onError 콜백 예외는 무시 (스트림 유지)
    }
  };

  const handleMessage = (socket: KisWebSocketLike, data: unknown) => {
    if (typeof data !== "string") return; // binary 미지원 (평문 수신 전제)
    const frame = parseKisWsFrame(data);
    if (frame.kind === "control") {
      if (isKisPingpongControl(frame.payload)) {
        socket.send(data); // PINGPONG은 수신 원문 그대로 echo
        return;
      }
      log(`[kis-ws] ${summarizeKisControl(frame.payload)}`);
      return;
    }
    if (frame.kind === "encrypted") {
      log(
        `[kis-ws] encrypted frame 수신(tr_id=${frame.trId}) — 평문 구독 전제라 지원 밖, skip`,
      );
      return;
    }
    if (frame.kind === "data") {
      if (frame.trId !== H0STCNT0_TR_ID) return;
      for (const record of chunkKisDataRecords(frame.fields, frame.count)) {
        const tick = mapH0stcnt0Record(record, { now: nowFn() });
        if (!tick) continue;
        try {
          const result = options.onTick(tick);
          // omxy R1 MEDIUM: async 콜백 rejection도 스트림을 죽이지 않게 catch
          // (sync throw만 잡으면 Promise<void> 계약 절반이 unhandled rejection).
          // omxy R2 LOW: instanceof Promise 대신 thenable 판정 — cross-realm/라이브러리
          // PromiseLike 반환도 Promise.resolve로 감싸 rejection을 흡수.
          if (
            result &&
            typeof (result as PromiseLike<void>).then === "function"
          ) {
            void Promise.resolve(result).then(undefined, reportError);
          }
        } catch (err) {
          reportError(err);
        }
      }
      return;
    }
    log(`[kis-ws] unknown frame 수신 — skip (${data.slice(0, 40)})`);
  };

  const connectOnce = (approvalKey: string): Promise<void> =>
    new Promise<void>((resolve) => {
      const socket = deps.webSocketFactory(deps.wsUrl);
      activeSocket = socket;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      socket.addEventListener("open", () => {
        attempt = 0; // 연결 성공 → 백오프 리셋
        for (const ticker of options.tickers) {
          socket.send(buildKisSubscribeFrame(approvalKey, ticker));
        }
        log(
          `[kis-ws] connected — ${options.tickers.length}개 ticker 구독 프레임 전송`,
        );
      });
      socket.addEventListener("message", (ev) => handleMessage(socket, ev.data));
      socket.addEventListener("error", () => {
        reportError(new Error("kis_ws_socket_error"));
      });
      socket.addEventListener("close", finish);
    });

  const runLoop = async () => {
    while (!closed) {
      try {
        const approvalKey = await deps.getApprovalKey();
        if (closed) return;
        await connectOnce(approvalKey);
      } catch (err) {
        reportError(err);
      }
      if (closed) return;
      const delayMs = computeKisBackoffMs(attempt, {
        maxMs: deps.maxBackoffMs,
      });
      attempt += 1;
      log(`[kis-ws] 재연결 대기 ${delayMs}ms (attempt ${attempt})`);
      await interruptibleBackoff(delayMs);
    }
    log("[kis-ws] stream 종료(close)");
  };

  void runLoop();

  return {
    close: () => {
      closed = true;
      for (const resolve of closeWaiters.splice(0)) resolve();
      try {
        activeSocket?.close();
      } catch {
        // close 중 예외 무시
      }
    },
    __waiterCountForTests: () => closeWaiters.length,
  };
}
