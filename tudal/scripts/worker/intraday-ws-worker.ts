/**
 * S7c intraday 연속 WS 워커 — 외부 tsx 프로세스 (Vercel 앱 라우트 아님).
 * spec: docs/superpowers/specs/2026-07-03-prelaunch-netnew-3-builds.md §3 (D-7~D-12)
 *
 * 실행 (tudal/에서):
 *   INTRADAY_WORKER_CONFIRM=1 npx tsx scripts/worker/intraday-ws-worker.ts
 *   (launchd/pm2 상시 실행 예시는 scripts/worker/README.md)
 *
 * 게이트 구조 (이중):
 *   1. INTRADAY_WORKER_CONFIRM=1  — fail-closed 프로세스 기동 게이트 (P3/P4 full-run 선례).
 *   2. INTRADAY_MONITOR_ENABLED   — runIntradayMonitorPass 내부 소비. off면 pass가
 *      no-op(writes 0)이라 워커는 "shadow 관찰 모드"로 tick 흐름만 로그.
 *
 * Supabase client는 @supabase/supabase-js createClient 직생성.
 *   `@/lib/supabase/service-role`은 (a) `import "server-only"` 가드가 Next.js 빌드 밖
 *   플레인 node/tsx에서 즉시 throw 하고 (b) B17 boundary allowlist가 cron route +
 *   DI seam으로 한정돼 있어 워커에서 import 금지 — boundary 오염 방지 박제.
 *
 * 런타임 정책 (D-12): KST 09:00–15:30 평일 + KRX 휴장 게이트 — 장외엔 WS 미연결
 * 유휴 대기. tick 버퍼 20초 주기 flush → runIntradayMonitorPass. dedup 사전 억제
 * (1분 bucket)로 alert_event/telegram 중복 발송 차단. SIGINT/SIGTERM graceful shutdown.
 */
import { createClient } from "@supabase/supabase-js";
import { subscribeKisTicks } from "@/lib/intraday/kis-websocket";
import { runIntradayMonitorPass } from "@/lib/intraday/run-monitor";
import { isIntradayMonitorEnabled } from "@/lib/intraday/flags";
import { insertIntradayAnomalies } from "@/lib/data/admin-intraday";
import { insertAlertEvents } from "@/lib/data/admin-alerts-insert";
import { sendTelegram, isTelegramConfigured } from "@/lib/notify/telegram";
import { loadKrBusinessDays } from "@/lib/portfolio/calendar";
import { evaluateMarketHours } from "@/lib/intraday/market-hours";
import {
  assembleIntradayWorkerContext,
  createIntradayTickBuffer,
  suppressDuplicateDetections,
} from "@/lib/intraday/worker-context";

const FLUSH_INTERVAL_MS = 20_000;
/** 장외 유휴 대기 재확인 상한 (다음 개장까지 sleep하되 최대 30분 단위로 재평가). */
const IDLE_RECHECK_CAP_MS = 30 * 60_000;
const CALENDAR_LOOKAHEAD_DAYS = 30;

function log(message: string): void {
  console.log(`[intraday-worker] ${new Date().toISOString()} ${message}`);
}

// ---------------------------------------------------------------------------
// 게이트 1: CONFIRM (fail-closed) + env 필수 체크
// ---------------------------------------------------------------------------

if (process.env.INTRADAY_WORKER_CONFIRM !== "1") {
  console.error(
    [
      "[intraday-worker] INTRADAY_WORKER_CONFIRM !== '1' — 기동 거부 (fail-closed).",
      "  실행하려면: INTRADAY_WORKER_CONFIRM=1 npx tsx scripts/worker/intraday-ws-worker.ts",
      "  필수 env: SUPABASE_URL(또는 NEXT_PUBLIC_SUPABASE_URL) / SUPABASE_SERVICE_ROLE_KEY /",
      "            KIS_APP_KEY / KIS_APP_SECRET",
      "  선택 env: KRX_OPENAPI_KEY(거래량·기준가 컨텍스트) / TELEGRAM_BOT_TOKEN+TELEGRAM_CHAT_ID /",
      "            KIS_WS_MOCK=true(모의투자 도메인) / INTRADAY_MONITOR_ENABLED=true(off면 pass no-op)",
    ].join("\n"),
  );
  process.exit(1);
}

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const missing: string[] = [];
if (!supabaseUrl) missing.push("SUPABASE_URL(또는 NEXT_PUBLIC_SUPABASE_URL)");
if (!serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
if (!process.env.KIS_APP_KEY) missing.push("KIS_APP_KEY");
if (!process.env.KIS_APP_SECRET) missing.push("KIS_APP_SECRET");
if (missing.length > 0) {
  console.error(`[intraday-worker] 필수 env 누락: ${missing.join(", ")} — 종료`);
  process.exit(1);
}

if (!isIntradayMonitorEnabled()) {
  log(
    "INTRADAY_MONITOR_ENABLED off — runIntradayMonitorPass는 no-op(writes 0). " +
      "tick 흐름만 관찰하는 shadow 모드로 진행 (활성화 = env INTRADAY_MONITOR_ENABLED=true).",
  );
}
if (!process.env.KRX_OPENAPI_KEY) {
  log("KRX_OPENAPI_KEY 미설정 — 기준가/거래량 컨텍스트 없음 → 전 tick skip (경고).");
}
if (!isTelegramConfigured()) {
  log("Telegram 미설정 — 발송은 mock-mode(무발송), durable alert만 유효.");
}

// 워커 전용 service-role client (RLS 우회 — cron worker 컨텍스트).
const workerClient = createClient(supabaseUrl as string, serviceRoleKey as string, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// graceful shutdown
// ---------------------------------------------------------------------------

let shuttingDown = false;
let interruptSleep: (() => void) | null = null;
let closeActiveSubscription: (() => void) | null = null;

function requestShutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`${signal} 수신 — graceful shutdown (WS close + flush 중단)`);
  closeActiveSubscription?.();
  interruptSleep?.();
}
process.on("SIGINT", () => requestShutdown("SIGINT"));
process.on("SIGTERM", () => requestShutdown("SIGTERM"));

/** shutdown 시 즉시 깨어나는 sleep. */
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      interruptSleep = null;
      resolve();
    }, ms);
    interruptSleep = () => {
      clearTimeout(timer);
      interruptSleep = null;
      resolve();
    };
  });
}

async function loadCalendarSafe(now: Date) {
  const from = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
  const to = new Date(now.getTime() + CALENDAR_LOOKAHEAD_DAYS * 24 * 3600 * 1000);
  try {
    return await loadKrBusinessDays(from, to);
  } catch (err) {
    log(
      `캘린더 로드 실패(${err instanceof Error ? err.message : String(err)}) — 평일 fallback`,
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// 장중 세션 1회: context 조립 → WS 구독 → 20s flush 루프 → 마감/shutdown 시 정리
// ---------------------------------------------------------------------------

async function runMarketSession(): Promise<void> {
  const now = new Date();
  // 세션(거래일) 단위 캘린더 캐시 — 15:30 마감 판정용. 장중 재로드 불필요
  // (loadKrBusinessDays가 실 Supabase SELECT로 전환돼도 flush마다 조회하지 않도록).
  const sessionCalendar = await loadCalendarSafe(now);
  const context = await assembleIntradayWorkerContext({
    client: workerClient,
    krxAuthKey: process.env.KRX_OPENAPI_KEY,
    now,
    log,
  });
  if (context.tickers.length === 0) {
    log("universe 비어있음(보유/Short List 없음) — 이번 세션 구독 생략");
    await sleep(IDLE_RECHECK_CAP_MS);
    return;
  }
  log(
    `세션 시작 — universe ${context.tickers.length}개, ctx ${context.contexts.size}개, ` +
      `prefs ${context.prefs.size}개, warnings ${context.warnings.length}건`,
  );

  const buffer = createIntradayTickBuffer();
  const seenDedupKeys = new Set<string>(); // 세션(=거래일) 단위 리셋
  const subscription = subscribeKisTicks({
    tickers: context.tickers,
    onTick: (tick) => buffer.push(tick),
    onError: (err) => log(`kis-ws error: ${err.message}`),
  });
  closeActiveSubscription = () => subscription.close();
  if (subscription.mockMode) {
    log("KIS 키 부재 mock-mode — tick 유입 없음 (구독 no-op)");
  }

  try {
    while (!shuttingDown) {
      const state = evaluateMarketHours(new Date(), sessionCalendar);
      if (!state.open) {
        log(`장마감(${state.reason}) — 세션 종료`);
        return;
      }
      await sleep(Math.min(FLUSH_INTERVAL_MS, state.msUntilNextTransition));
      if (shuttingDown) return;

      const ticks = buffer.drain();
      if (ticks.length === 0) continue;
      const { ticks: dispatchable, newDedupKeys } = suppressDuplicateDetections(
        ticks,
        { contexts: context.contexts, prefs: context.prefs },
        seenDedupKeys,
      );
      if (dispatchable.length === 0) continue;
      try {
        const result = await runIntradayMonitorPass(
          {
            ticks: dispatchable,
            contexts: context.contexts,
            prefs: context.prefs,
          },
          {
            insertAnomalies: (events) =>
              insertIntradayAnomalies(events, { client: workerClient }),
            insertAlerts: (events) =>
              insertAlertEvents(events, { client: workerClient }),
            sendTelegram: (text) => sendTelegram({ text }),
          },
        );
        // pass 성공 후에만 dedup 키 확정 (실패 시 다음 flush 재시도).
        newDedupKeys.forEach((k) => seenDedupKeys.add(k));
        if (result.skipped === "flag_off") {
          log(`flush: ${ticks.length} ticks (flag off — no-op)`);
        } else {
          log(
            `flush: ${ticks.length} ticks → evaluated ${result.evaluated}, ` +
              `detected ${result.detected}, inserted ${result.inserted}, ` +
              `telegram ${result.telegramDelivered}`,
          );
        }
      } catch (err) {
        // fail-soft: DB/telegram 일시 오류로 워커를 죽이지 않음. dedup 키 미확정 → 재시도.
        log(`flush 실패(다음 주기 재시도): ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } finally {
    closeActiveSubscription = null;
    subscription.close();
    log("WS 구독 종료");
  }
}

// ---------------------------------------------------------------------------
// 메인 루프: 장외 유휴 대기 ↔ 장중 세션
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log(
    `기동 — flush ${FLUSH_INTERVAL_MS / 1000}s, monitor flag ${
      isIntradayMonitorEnabled() ? "ON" : "OFF(no-op)"
    }, KIS_WS_MOCK ${process.env.KIS_WS_MOCK === "true" ? "모의" : "실전"}`,
  );
  while (!shuttingDown) {
    const now = new Date();
    const state = evaluateMarketHours(now, await loadCalendarSafe(now));
    if (state.open) {
      await runMarketSession();
      continue;
    }
    const waitMs = Math.min(state.msUntilNextTransition, IDLE_RECHECK_CAP_MS);
    log(
      `장외(${state.reason}) — ${Math.round(waitMs / 60_000)}분 유휴 대기 ` +
        `(다음 전이까지 ${Math.round(state.msUntilNextTransition / 60_000)}분, WS 미연결)`,
    );
    await sleep(waitMs);
  }
  log("종료 완료");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[intraday-worker] fatal:", err);
    process.exit(1);
  });
