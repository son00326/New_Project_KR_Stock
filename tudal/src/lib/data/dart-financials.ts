// PR-B — DART 재무 공유 모듈 (corp_code 브리지 + 파생).
// ADR: docs/superpowers/specs/2026-05-31-realdata-realai-e2e-decisions.md (PR-B, B3 guaranteed-throw 버그fix).
//
// dart_financial_cache는 corp_code 키(ticker 컬럼 없음) → dart_corp_codes(ticker→corp_code) JOIN 필요.
// 기존 track-record/actions.ts fetchFinancials는 존재하지 않는 컬럼(ticker/quarter_revenue/trailing_revenue/quality_score)
// 조회 → 모든 ticker `financials_fetch_failed` throw (B3 확정 버그). 본 모듈이 단일 SoT로 대체.
//
// 파생 공식 = scripts/dart_signals.py compute_quality_score 정합:
//   ROE = net_income / total_equity (equity>0)
//   영업이익률(op_margin) = op_income / revenue
//   부채비율(debt_to_equity) = total_debt / total_equity (equity>0)
//   매출/영업이익 YoY = (당기 - 전기) / 전기
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AnnualFinancials {
  periodKey: string;
  revenue: number | null;
  opIncome: number | null;
  netIncome: number | null;
  totalEquity: number | null;
  totalDebt: number | null;
}

export interface DerivedFinancials {
  periodKey: string;
  revenue: number | null;
  opIncome: number | null;
  netIncome: number | null;
  roe: number | null; // net_income / total_equity
  opMargin: number | null; // op_income / revenue
  debtToEquity: number | null; // total_debt / total_equity
  revenueYoy: number | null; // (rev - prior_rev) / prior_rev
  opIncomeYoy: number | null; // (op - prior_op) / prior_op
}

// dart_signals.py _safe_div 정합: 분모 null/0이면 null.
function safeDiv(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

// YoY: 당기·전기 둘 다 유효 + 전기≠0 일 때만.
function yoy(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null || prior === 0) return null;
  return (current - prior) / prior;
}

/**
 * 순수 파생 로직 (유닛테스트 대상). latest 연간 + prior 연간(YoY용, 없으면 null).
 */
export function deriveFinancials(
  latest: AnnualFinancials,
  prior: AnnualFinancials | null,
): DerivedFinancials {
  const equityPositive = latest.totalEquity !== null && latest.totalEquity > 0;
  return {
    periodKey: latest.periodKey,
    revenue: latest.revenue,
    opIncome: latest.opIncome,
    netIncome: latest.netIncome,
    roe: equityPositive ? safeDiv(latest.netIncome, latest.totalEquity) : null,
    opMargin: safeDiv(latest.opIncome, latest.revenue),
    debtToEquity: equityPositive ? safeDiv(latest.totalDebt, latest.totalEquity) : null,
    revenueYoy: prior ? yoy(latest.revenue, prior.revenue) : null,
    opIncomeYoy: prior ? yoy(latest.opIncome, prior.opIncome) : null,
  };
}

/**
 * 페르소나 패널/리포트 프롬프트 입력용 한국어 1줄 요약 (순수, 유닛테스트 대상).
 * 데이터 없으면 명시적 "재무 데이터 없음" — throw 대신 graceful (단일 ticker 누락이 batch를 깨지 않게).
 */
export function formatFinancialsSummary(
  ticker: string,
  derived: DerivedFinancials | null,
): string {
  if (!derived) return `[${ticker}] 재무 데이터 없음`;
  const pct = (v: number | null) => (v === null ? "N/A" : `${(v * 100).toFixed(1)}%`);
  // 억원 단위 (원 → /1e8).
  const eok = (v: number | null) => (v === null ? "N/A" : `${Math.round(v / 1e8).toLocaleString()}억`);
  return [
    `[${ticker} ${derived.periodKey} 연간]`,
    `매출 ${eok(derived.revenue)}`,
    `영업이익 ${eok(derived.opIncome)}`,
    `순이익 ${eok(derived.netIncome)}`,
    `ROE ${pct(derived.roe)}`,
    `영업이익률 ${pct(derived.opMargin)}`,
    `부채비율 ${pct(derived.debtToEquity)}`,
    `매출YoY ${pct(derived.revenueYoy)}`,
    `영업이익YoY ${pct(derived.opIncomeYoy)}`,
  ].join(" · ");
}

// numeric 컬럼은 string("1098306886000.0")으로 오므로 안전 파싱.
function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

interface FinancialRow {
  period_key: unknown;
  revenue: unknown;
  op_income: unknown;
  net_income: unknown;
  total_equity: unknown;
  total_debt: unknown;
}

function toAnnual(row: FinancialRow): AnnualFinancials {
  return {
    periodKey: String(row.period_key),
    revenue: toNum(row.revenue),
    opIncome: toNum(row.op_income),
    netIncome: toNum(row.net_income),
    totalEquity: toNum(row.total_equity),
    totalDebt: toNum(row.total_debt),
  };
}

/**
 * ticker → corp_code(dart_corp_codes) → 최신 2개 연간(dart_financial_cache, status='ok') → 파생 → 한국어 요약.
 * cron/admin/track-record 공유 import (단일 SoT). client는 DI (cron=service-role, admin=session).
 */
export async function fetchFinancialsSummary(
  ticker: string,
  options: { client: SupabaseClient },
): Promise<string> {
  const { client } = options;

  // ticker → corp_code 브리지
  const { data: corp, error: corpErr } = await client
    .from("dart_corp_codes")
    .select("corp_code")
    .eq("ticker", ticker)
    .maybeSingle();
  if (corpErr) {
    throw new Error(`financials_corp_lookup_failed:${corpErr.code ?? "unknown"}`);
  }
  const corpCode = (corp as { corp_code?: string } | null)?.corp_code;
  if (!corpCode) return formatFinancialsSummary(ticker, null);

  // 최신 2개 연간 (period_key="2025"/"2024" desc → YoY)
  const { data: rows, error: finErr } = await client
    .from("dart_financial_cache")
    .select("period_key, revenue, op_income, net_income, total_equity, total_debt")
    .eq("corp_code", corpCode)
    .eq("period_type", "annual")
    .eq("status", "ok")
    .order("period_key", { ascending: false })
    .limit(2);
  if (finErr) {
    throw new Error(`financials_fetch_failed:${finErr.code ?? "unknown"}`);
  }
  const list = (rows ?? []) as FinancialRow[];
  if (list.length === 0) return formatFinancialsSummary(ticker, null);

  const latest = toAnnual(list[0]);
  const prior = list[1] ? toAnnual(list[1]) : null;
  return formatFinancialsSummary(ticker, deriveFinancials(latest, prior));
}
