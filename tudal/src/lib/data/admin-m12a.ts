// admin-m12a.ts — m12a_ticker_assessment durable ledger INSERT/SELECT helper.
//
// M12a 뉴스 기반 자동 제외(R3.10-7c): news_event 1건 + per-ticker assessment N건.
// 본 테이블은 마이그 0042(DORMANT, USER apply-only). flag off → orchestrator 미호출이라 미적용도 안전.
// service-role client 주입 시 RLS using(is_admin()) 우회(cron context). admin-news insertNewsEvents 패턴.
//
// SoT: docs/superpowers/specs/2026-06-26-m12a-news-auto-remove-shadow-first.md §2 + ServicePlan-Admin §3.10 R3.10-7c.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type {
  ActionTaken,
  M12aTickerLedgerRow,
  RecommendedAction,
  M12aScope,
  M12aSurface,
} from "@/lib/news/m12a/types";

const TICKER_RE = /^\d{6}$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])-01$/;
const PRICE_BASIS_DATE_RE = /^\d{8}$/;
const SURFACE_SET: ReadonlySet<M12aSurface> = new Set<M12aSurface>([
  "list",
  "portfolio",
]);
const SCOPE_SET: ReadonlySet<M12aScope> = new Set<M12aScope>([
  "company",
  "sector",
  "market",
  "unknown",
]);
const ACTION_SET: ReadonlySet<RecommendedAction> = new Set<RecommendedAction>([
  "auto_remove",
  "alert_only",
  "hold_for_review",
]);
const TAKEN_SET: ReadonlySet<ActionTaken> = new Set<ActionTaken>([
  "shadowed",
  "held_by_brake",
  "removed",
]);

/**
 * per-ticker assessment ledger rows를 m12a_ticker_assessment에 batch INSERT(append-only).
 *
 * - 입력 검증: ticker 6자리 / surface·scope·recommendedAction·actionTaken enum 정합(DB CHECK 1:1 선행 가드).
 * - shadow phase(actionTaken=shadowed/held_by_brake)도 동일 INSERT — would-remove 감사 추적.
 * - alert_event_id는 nullable link(알림 발송 후 회수). 0042 미적용 env에서는 호출되지 않음(flag off).
 */
export async function insertM12aAssessments(
  rows: M12aTickerLedgerRow[],
  options: { client?: SupabaseClient } = {},
): Promise<void> {
  if (rows.length === 0) return;
  for (const r of rows) {
    if (!TICKER_RE.test(r.ticker)) {
      throw new Error(`m12a_assessment_invalid_ticker:${r.ticker}`);
    }
    if (!MONTH_RE.test(r.month)) {
      throw new Error(`m12a_assessment_invalid_month:${r.month}`);
    }
    if (!SURFACE_SET.has(r.surface)) {
      throw new Error(`m12a_assessment_invalid_surface:${r.surface}`);
    }
    if (!SCOPE_SET.has(r.scope)) {
      throw new Error(`m12a_assessment_invalid_scope:${r.scope}`);
    }
    if (!ACTION_SET.has(r.recommendedAction)) {
      throw new Error(
        `m12a_assessment_invalid_action:${r.recommendedAction}`,
      );
    }
    if (!TAKEN_SET.has(r.actionTaken)) {
      throw new Error(`m12a_assessment_invalid_action_taken:${r.actionTaken}`);
    }
    if (
      r.priceBasisDate !== null &&
      !PRICE_BASIS_DATE_RE.test(r.priceBasisDate)
    ) {
      throw new Error(
        `m12a_assessment_invalid_price_basis_date:${r.priceBasisDate}`,
      );
    }
  }
  const supabase = options.client ?? (await createClient());
  const payload = rows.map((r) => ({
    news_event_id: r.newsEventId,
    run_id: r.runId,
    month: r.month,
    ticker: r.ticker,
    surface: r.surface,
    scope: r.scope,
    severity: r.severity,
    confidence: r.confidence,
    materiality: r.materiality,
    directness: r.directness,
    thesis_break: r.thesisBreak,
    thesis_break_reason: r.thesisBreakReason,
    recommended_action: r.recommendedAction,
    action_taken: r.actionTaken,
    held_by_brake: r.heldByBrake,
    price_basis_date: r.priceBasisDate,
    price_source: r.priceSource,
    execution_assumption: r.executionAssumption,
    alert_event_id: r.alertEventId,
  }));
  const { error } = await supabase
    .from("m12a_ticker_assessment")
    .insert(payload);
  if (error) {
    throw new Error(`m12a_assessment_insert_failed:${error.code ?? "unknown"}`);
  }
}
