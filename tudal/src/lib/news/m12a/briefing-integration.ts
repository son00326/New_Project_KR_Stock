import type { SupabaseClient } from "@supabase/supabase-js";
import { isM12aNewsEvalEnabled } from "@/lib/news/m12a/flags";
import { runM12aNewsEvaluation } from "@/lib/news/m12a/orchestrator";
import {
  makeM12aNewsEvaluator,
  type M12aNewsItem,
} from "@/lib/news/m12a/evaluator";
import { getRecentNewsEventsForUniverse } from "@/lib/data/admin-news";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import { insertM12aAssessments } from "@/lib/data/admin-m12a";
import { insertAlertEvents } from "@/lib/data/admin-alerts-insert";
import { sendTelegram } from "@/lib/notify/telegram";
import { callPersona } from "@/lib/ai/anthropic-client";
import { CORE_11_PERSONAS } from "@/lib/ai/prompts/personas";
import { preflightHardcap } from "@/lib/cost/cost-logger";
import {
  getRoleWorstCaseMaxCostPerCallKrw,
  isRoleProviderAvailable,
} from "@/lib/ai/model-registry";

// ---------------------------------------------------------------------------
// M12a 모닝 브리핑(M11) 통합 — 08:00 KST cron 슬롯에서 M12a를 dormant로 1회 실행.
//   flag(M12A_NEWS_EVAL_ENABLED) off → { attentionTickers: [], ran: false } (DB/AI 0 → 브리핑 byte-identical).
//   on → 활성 short_list_30 유니버스 + 최근 news_event를 Core 11로 평가 → orchestrator → attentionTickers(R3.10-2).
//
// shadow-first 코드 guard(GAP4): 자동 제거 mutation/현금화는 "출시 후 fast-follow"이므로 throw-stub.
//   flag M12A_AUTO_REMOVE_ENABLED를 켜도 orchestrator가 resolveCashout/applyAutoRemove에서 throw → 부분 mutation 차단.
//   (orchestrator의 removed 경로는 단위 테스트에서 mock DI로 검증. 실 mutation 배선은 D11 운용검증 후.)
//
// fail-closed step-0 (sibling tier1-selection-batch-worker parity, deep-review HIGH #3/#4):
//   실 Core 11 AI spend 전에 (a) AI_COST_LOG_REAL_INSERT_ENABLED!=='true'면 skip(로깅 off → insertCostLog
//   noop → getMonthlyTotal=0 → preflightHardcap fail-open으로 50만 hardcap 무력화) + (b) CRON_SYSTEM_USER_ID
//   가 유효 UUID이고 auth.users에 존재해야 함(cost_log.called_by FK + 빈 문자열 silent burn 차단). 미충족 시
//   M12a AI run 자체를 skip(₩0). shadow phase도 실 AI 평가비를 쓰므로 동일 게이트 적용.
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RunM12aForBriefingInput {
  client: SupabaseClient;
  nowIso: string;
  adminUserId: string;
  alertsUrl?: string;
}

export interface M12aBriefingAttention {
  ticker: string;
  name: string;
  reason: string;
}

export interface RunM12aForBriefingResult {
  ran: boolean;
  attentionTickers: M12aBriefingAttention[];
}

export async function runM12aForBriefing(
  input: RunM12aForBriefingInput,
): Promise<RunM12aForBriefingResult> {
  // dormant: flag off → 즉시 반환(DB/AI 0). 브리핑 attentionTickers=[] → byte-identical.
  if (!isM12aNewsEvalEnabled()) return { ran: false, attentionTickers: [] };

  // fail-closed step-0 (실 AI spend 전 — 미충족이면 skip, ₩0). sibling worker step-0 parity.
  if (process.env.AI_COST_LOG_REAL_INSERT_ENABLED !== "true") {
    console.warn(
      JSON.stringify({ event: "m12a_skip", reason: "cost_logging_disabled" }),
    );
    return { ran: false, attentionTickers: [] };
  }
  if (!UUID_RE.test(input.adminUserId)) {
    console.warn(
      JSON.stringify({ event: "m12a_skip", reason: "cron_system_user_id_invalid" }),
    );
    return { ran: false, attentionTickers: [] };
  }
  const { data: userData, error: userErr } =
    await input.client.auth.admin.getUserById(input.adminUserId);
  if (userErr || !userData?.user) {
    console.warn(
      JSON.stringify({ event: "m12a_skip", reason: "cron_system_user_not_found" }),
    );
    return { ran: false, attentionTickers: [] };
  }

  const costMonth = input.nowIso.slice(0, 7); // YYYY-MM (cost_log/preflight 정합)
  const ledgerMonth = `${costMonth}-01`; // YYYY-MM-01 (ledger/short_list_30 정합)

  // 유니버스: 활성 short_list_30(track 크기 + ticker→name). bucket short→short, mid/long→midlong.
  const shortlist = await getActiveShortList({ client: input.client });
  const listTracks = new Map<string, "short" | "midlong">();
  const nameByTicker = new Map<string, string>();
  let short = 0;
  let midlong = 0;
  for (const item of shortlist) {
    const track: "short" | "midlong" =
      item.bucket === "short" ? "short" : "midlong";
    listTracks.set(item.ticker, track);
    nameByTicker.set(item.ticker, item.name);
    if (track === "short") short += 1;
    else midlong += 1;
  }
  const listTrackSizes = { short, midlong, full: short + midlong };
  // 가상포트 보유 종목 연결은 D11 운용검증 시(shadow-first: 빈 set).
  const portfolioTickers = new Set<string>();

  // 종목별 윈도로 활성 short_list_30 전체 유니버스의 최근 news_event를 읽는다(per-ticker bounded
  //   read). 구 전역 top-50 윈도는 hot 종목이 윈도를 잠식 → quiet 종목이 0건으로 굶는 tail
  //   starvation 결함이 있었다. universe read는 종목별 .limit(perTickerLimit)이라 한 종목이 다른
  //   종목 슬롯을 못 먹고, null-ticker 시장뉴스는 아예 쿼리되지 않는다(모닝 브리핑 topNews 다이제스트는
  //   설계상 전역 read로 분리 유지). 반환 행은 전부 ticker 귀속 → 구 .filter(n=>n.ticker) 불필요.
  const universe = [...listTracks.keys()];
  const news = await getRecentNewsEventsForUniverse(universe, {
    perTickerLimit: 2,
    client: input.client,
  });
  const newsItems: M12aNewsItem[] = news.map((n) => ({
    newsEventId: n.id,
    ticker: n.ticker,
    title: n.title,
    url: n.url,
  }));

  const evaluate = makeM12aNewsEvaluator({
    callPersona,
    personas: CORE_11_PERSONAS,
    adminUserId: input.adminUserId,
    costClient: input.client,
    costLogMonth: costMonth,
  });

  const result = await runM12aNewsEvaluation({
    month: ledgerMonth,
    runId: `m12a-${ledgerMonth}-${input.nowIso}`,
    nowIso: input.nowIso,
    // 항목1 — M12a 뉴스 평가는 callPersona(tier1_panel 역할) 사용 → 해당 역할 provider(GLM→Claude) 가용성.
    aiAvailable: isRoleProviderAvailable("tier1_panel"),
    listTrackSizes,
    portfolioSize: portfolioTickers.size,
    alertsUrl: input.alertsUrl ?? "/admin/alerts",
    preflight: async () => {
      if (newsItems.length === 0) return; // 평가 대상 0 → 예약 불필요
      await preflightHardcap(
        {
          month: costMonth,
          callCount: newsItems.length * CORE_11_PERSONAS.length,
          maxCostPerCallKrw: getRoleWorstCaseMaxCostPerCallKrw("tier1_panel"),
        },
        { client: input.client, callerKind: "service-role" },
      );
    },
    evaluateNews: () => evaluate({ newsItems, listTracks, portfolioTickers }),
    // shadow-first 코드 guard: 자동 제거 가격/실행은 출시 후 fast-follow → throw(부분 mutation 차단).
    resolveCashout: async () => {
      throw new Error("m12a_auto_remove_cashout_not_implemented_shadow_first");
    },
    applyAutoRemove: async () => {
      throw new Error("m12a_auto_remove_mutation_not_implemented_shadow_first");
    },
    insertAssessments: (rows) =>
      insertM12aAssessments(rows, { client: input.client }),
    insertAlertEvents: (events) =>
      insertAlertEvents(events, { client: input.client }),
    sendTelegram: (text) => sendTelegram({ text }),
  });

  return {
    ran: !result.skipped,
    attentionTickers: result.attentionTickers.map((a) => ({
      ticker: a.ticker,
      name: nameByTicker.get(a.ticker) ?? a.ticker,
      reason: a.reason,
    })),
  };
}
