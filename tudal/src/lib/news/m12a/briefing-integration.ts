import type { SupabaseClient } from "@supabase/supabase-js";
import { isM12aNewsEvalEnabled } from "@/lib/news/m12a/flags";
import { runM12aNewsEvaluation } from "@/lib/news/m12a/orchestrator";
import {
  makeM12aNewsEvaluator,
  type M12aNewsItem,
} from "@/lib/news/m12a/evaluator";
import { getRecentNewsEvents } from "@/lib/data/admin-news";
import { getActiveShortList } from "@/lib/data/admin-shortlist";
import { insertM12aAssessments } from "@/lib/data/admin-m12a";
import { insertAlertEvents } from "@/lib/data/admin-alerts-insert";
import { sendTelegram } from "@/lib/notify/telegram";
import { callPersona } from "@/lib/ai/anthropic-client";
import { CORE_11_PERSONAS } from "@/lib/ai/prompts/personas";
import { isAnthropicAvailable } from "@/lib/ai/provider";
import { preflightHardcap } from "@/lib/cost/cost-logger";
import { getRoleWorstCaseMaxCostPerCallKrw } from "@/lib/ai/model-registry";

// ---------------------------------------------------------------------------
// M12a 모닝 브리핑(M11) 통합 — 08:00 KST cron 슬롯에서 M12a를 dormant로 1회 실행.
//   flag(M12A_NEWS_EVAL_ENABLED) off → { attentionTickers: [], ran: false } (DB/AI 0 → 브리핑 byte-identical).
//   on → 활성 short_list_30 유니버스 + 최근 news_event를 Core 11로 평가 → orchestrator → attentionTickers(R3.10-2).
//
// shadow-first 코드 guard(GAP4): 자동 제거 mutation/현금화는 "출시 후 fast-follow"이므로 throw-stub.
//   flag M12A_AUTO_REMOVE_ENABLED를 켜도 orchestrator가 resolveCashout/applyAutoRemove에서 throw → 부분 mutation 차단.
//   (orchestrator의 removed 경로는 단위 테스트에서 mock DI로 검증. 실 mutation 배선은 D11 운용검증 후.)
// ---------------------------------------------------------------------------

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

  // 최근 news_event(회사 귀속만) → M12aNewsItem.
  const news = await getRecentNewsEvents({ client: input.client, limit: 50 });
  const newsItems: M12aNewsItem[] = news
    .filter((n) => n.ticker)
    .map((n) => ({
      newsEventId: n.id,
      ticker: n.ticker as string,
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
    aiAvailable: isAnthropicAvailable(),
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
