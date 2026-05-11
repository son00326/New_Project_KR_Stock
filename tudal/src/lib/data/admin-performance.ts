// ---------------------------------------------------------------------------
// admin-performance.ts — portfolio_snapshot 읽기 + 성능 집계 (T7e.6).
// Task 2: DB row 타입 + transformer + COLUMNS.
// Task 3: getPerformanceSummary / getMonthlyPerformance / getBucketPerformance
//         / getCounterfactual 추가 + Track Record 페이지가 사용하는
//         (Monthly|Bucket|Counterfactual)Row · PerformanceSummary 타입 재선언.
// ---------------------------------------------------------------------------

import { getActiveShortList } from "@/lib/data/admin-shortlist";
import { computeMaxDrawdown } from "@/lib/performance/mdd";
import { computeSharpeRatio } from "@/lib/performance/sharpe";
import { createClient } from "@/lib/supabase/server";
import type { BucketKind, PortfolioSnapshot } from "@/types/admin";

// ---------------------------------------------------------------------------
// DB row 타입 + transformer (Task 2)
// ---------------------------------------------------------------------------

export interface PortfolioSnapshotRow {
  id: string;
  date: string;
  month: string;
  ticker: string | null;
  entry_price: string | number | null;
  current_price: string | number | null;
  weight: string | number | null;
  is_cash: boolean;
  daily_return: string | number | null;
  total_return: string | number | null;
  kospi_return: string | number | null;
  alpha: string | number | null;
  sharpe: string | number | null;
}

// 주의: 이 문자열은 PortfolioSnapshotRow 인터페이스와 1:1 동기 — 둘 중 하나가 바뀌면 다른 하나도 갱신.
export const COLUMNS =
  "id, date, month, ticker, entry_price, current_price, weight, is_cash, daily_return, total_return, kospi_return, alpha, sharpe";

function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function transformSnapshotRow(row: PortfolioSnapshotRow): PortfolioSnapshot {
  return {
    id: row.id,
    date: row.date,
    month: row.month,
    ticker: row.ticker,
    entryPrice: num(row.entry_price),
    currentPrice: num(row.current_price),
    weight: num(row.weight),
    isCash: row.is_cash,
    dailyReturn: num(row.daily_return),
    totalReturn: num(row.total_return),
    kospiReturn: num(row.kospi_return),
    alpha: num(row.alpha),
    sharpe: num(row.sharpe),
  };
}

// ---------------------------------------------------------------------------
// Track Record 페이지용 결과 타입 (mock-admin-performance.ts에서 이관 — Task 8에서 mock 삭제)
// ---------------------------------------------------------------------------

export interface MonthlyPerformanceRow {
  /** 'YYYY-MM-01' (DB month 형식 그대로) */
  month: string;
  /** 소수점 (e.g. 0.045 = +4.5%) */
  portfolioReturn: number;
  kospiReturn: number;
  alpha: number;
  sharpe: number;
  /** 해당 월까지의 연속 ○ 스트릭 (chronological 누적, 1·2·3 …) */
  capStreak: number;
}

export interface BucketPerformanceRow {
  bucket: BucketKind;
  cumulativeReturn: number;
  sharpe: number;
  tickerCount: number;
}

export interface CounterfactualComparison {
  /** AI 비중 그대로 따랐을 때 누적 수익률 */
  aiOnlyReturn: number;
  /** 어드민 오버라이드 반영 후 실제 누적 수익률 */
  actualReturn: number;
  /** aiOnlyReturn - actualReturn (양수 = 오버라이드가 수익 감소) */
  deltaPct: number;
  note: string;
}

export interface PerformanceSummary {
  cumulativeReturn: number;
  cumulativeKospi: number;
  cumulativeAlpha: number;
  cumulativeSharpe: number;
  /** 음수 소수점 (e.g. -0.08) */
  cumulativeMdd: number;
  /** 현재 ○ 연속 스트릭 (0~12) — Task 4에서 wired (현재 0) */
  currentCapMonths: number;
  /** 일별 수익률 시계열 — computeSharpeRatio 재검증용 */
  dailyReturns: number[];
  /** 누적 포트폴리오 가치 시계열 (시작값 1.0) — computeMaxDrawdown 재검증용 */
  cumulativeValues: number[];
}

// ---------------------------------------------------------------------------
// 내부: portfolio_snapshot SELECT helpers
// ---------------------------------------------------------------------------

/**
 * 0005 §1 portfolio-aggregate 행만 (ticker IS NULL) 시간순으로 가져온다.
 * date ASC 정렬은 호출 측 timeseries 계산이 chronological임을 가정.
 */
async function fetchPortfolioRows(): Promise<PortfolioSnapshotRow[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("portfolio_snapshot")
    .select(COLUMNS)
    .is("ticker", null)
    .eq("is_cash", false)
    .order("date", { ascending: true });

  if (error) {
    throw new Error(
      `portfolio_snapshot summary query failed: ${error.message ?? "unknown error"}`,
    );
  }
  return (data ?? []) as PortfolioSnapshotRow[];
}

/** ticker IS NOT NULL 행 (per-ticker 스냅샷). */
async function fetchTickerRows(): Promise<PortfolioSnapshotRow[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("portfolio_snapshot")
    .select(COLUMNS)
    .not("ticker", "is", null)
    .order("date", { ascending: true });

  if (error) {
    throw new Error(
      `portfolio_snapshot ticker query failed: ${error.message ?? "unknown error"}`,
    );
  }
  return (data ?? []) as PortfolioSnapshotRow[];
}

// ---------------------------------------------------------------------------
// getPerformanceSummary
// ---------------------------------------------------------------------------

export async function getPerformanceSummary(): Promise<PerformanceSummary | null> {
  const rows = await fetchPortfolioRows();
  if (rows.length === 0) return null;

  const snapshots = rows.map(transformSnapshotRow);
  const last = snapshots[snapshots.length - 1];

  const dailyReturns = snapshots.map((s) => s.dailyReturn);
  const cumulativeValues: number[] = [];
  let cur = 1.0;
  for (const r of dailyReturns) {
    cur = cur * (1 + r);
    cumulativeValues.push(cur);
  }

  return {
    cumulativeReturn: last.totalReturn,
    cumulativeKospi: last.kospiReturn,
    cumulativeAlpha: last.alpha,
    cumulativeSharpe: computeSharpeRatio(dailyReturns),
    cumulativeMdd: computeMaxDrawdown(cumulativeValues),
    // TODO(Task 4): getDecisionTreeSnapshot()의 monthly verdicts를 주입.
    // 페이지(Task 5) 또는 별도 wiring에서 합성. 여기서 호출하면 SELECT 중복 + 순환 의존.
    currentCapMonths: 0,
    dailyReturns,
    cumulativeValues,
  };
}

// ---------------------------------------------------------------------------
// getMonthlyPerformance
// ---------------------------------------------------------------------------

export async function getMonthlyPerformance(): Promise<MonthlyPerformanceRow[]> {
  const rows = await fetchPortfolioRows();
  if (rows.length === 0) return [];

  const snapshots = rows.map(transformSnapshotRow);

  // month별 그룹핑 (Map은 insertion order 보존 → 이미 date ASC라 chronological).
  const byMonth = new Map<string, PortfolioSnapshot[]>();
  for (const s of snapshots) {
    const list = byMonth.get(s.month);
    if (list) list.push(s);
    else byMonth.set(s.month, [s]);
  }

  const result: MonthlyPerformanceRow[] = [];
  let prevTotalReturn = 0;
  let prevKospiReturn = 0;
  let streak = 0;

  for (const [month, group] of byMonth) {
    const lastInMonth = group[group.length - 1];
    const portfolioReturn = lastInMonth.totalReturn - prevTotalReturn;
    const kospiReturn = lastInMonth.kospiReturn - prevKospiReturn;
    const alpha = portfolioReturn - kospiReturn;
    const sharpe = computeSharpeRatio(group.map((g) => g.dailyReturn));

    // judgeDecisionTree: month별 mdd는 이번 month group의 cumulative path에서.
    let cur = 1.0;
    const cumValues: number[] = [];
    for (const g of group) {
      cur = cur * (1 + g.dailyReturn);
      cumValues.push(cur);
    }
    const monthMdd = computeMaxDrawdown(cumValues);

    const verdict = judgeMonthly({ alpha, sharpe, mdd: monthMdd });
    if (verdict === "○") streak++;
    else streak = 0;

    result.push({
      month,
      portfolioReturn,
      kospiReturn,
      alpha,
      sharpe,
      capStreak: streak,
    });

    prevTotalReturn = lastInMonth.totalReturn;
    prevKospiReturn = lastInMonth.kospiReturn;
  }

  return result;
}

// 인라인 ○/△/✕ 판정 — judgeDecisionTree와 동일 임계값을 사용 (alpha>=0, sharpe>=0.5, mdd>=-0.15).
// admin-performance.ts → judge.ts 의존을 굳이 추가하지 않기 위해 인라인.
function judgeMonthly(input: {
  alpha: number;
  sharpe: number;
  mdd: number;
}): "○" | "△" | "✕" {
  const passCount =
    (input.alpha >= 0 ? 1 : 0) +
    (input.sharpe >= 0.5 ? 1 : 0) +
    (input.mdd >= -0.15 ? 1 : 0);
  if (passCount === 3) return "○";
  if (passCount === 2) return "△";
  return "✕";
}

// ---------------------------------------------------------------------------
// getBucketPerformance
// ---------------------------------------------------------------------------

/**
 * Per-ticker 행을 short_list_30 bucket 매핑으로 묶어 short/mid/long 누적 성능을 낸다.
 *
 * 설계 선택 (Task 3 plan 명시):
 *   - cumulativeReturn = ticker별 last-row totalReturn의 weight 가중평균.
 *   - sharpe = ticker별 last-row sharpe의 단순 평균 (fallback).
 *     bucket 시계열 합성 sharpe는 date 정렬·padding이 필요해 fixture가 비대해진다.
 *     실 운용 데이터 도입(Task 5/D11) 후 정합성 검토 시 격상 가능.
 */
export async function getBucketPerformance(): Promise<BucketPerformanceRow[]> {
  const tickerRows = await fetchTickerRows();
  if (tickerRows.length === 0) return [];

  const snapshots = tickerRows.map(transformSnapshotRow);

  // 가장 최근 month 기준 short_list로 ticker→bucket lookup 구성.
  const latestMonth = snapshots[snapshots.length - 1].month;
  const shortlist = await getActiveShortList({ month: latestMonth });
  if (shortlist.length === 0) return [];

  const tickerToBucket = new Map<string, BucketKind>();
  for (const item of shortlist) {
    tickerToBucket.set(item.ticker, item.bucket);
  }

  // ticker별 last-row만 (date ASC 정렬돼 있으니 마지막 등장이 최신).
  const lastByTicker = new Map<string, PortfolioSnapshot>();
  for (const s of snapshots) {
    if (s.ticker !== null) lastByTicker.set(s.ticker, s);
  }

  const buckets: BucketKind[] = ["short", "mid", "long"];
  const result: BucketPerformanceRow[] = [];

  for (const bucket of buckets) {
    const members = Array.from(lastByTicker.values()).filter(
      (s) => s.ticker !== null && tickerToBucket.get(s.ticker) === bucket,
    );

    if (members.length === 0) {
      result.push({ bucket, cumulativeReturn: 0, sharpe: 0, tickerCount: 0 });
      continue;
    }

    const weightSum = members.reduce((sum, m) => sum + m.weight, 0);
    const cumulativeReturn =
      weightSum > 0
        ? members.reduce((sum, m) => sum + m.totalReturn * m.weight, 0) /
          weightSum
        : members.reduce((sum, m) => sum + m.totalReturn, 0) / members.length;
    const sharpe =
      members.reduce((sum, m) => sum + m.sharpe, 0) / members.length;

    result.push({
      bucket,
      cumulativeReturn,
      sharpe,
      tickerCount: members.length,
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// getCounterfactual
// ---------------------------------------------------------------------------

/**
 * AI 비중 그대로 따랐을 때 vs 어드민 오버라이드 반영 시 비교.
 *
 * 결정 (T7e.6): null pin.
 * portfolio_snapshot에는 어드민 오버라이드 이후의 실 비중만 보관되며,
 * AI 원본 비중 시계열은 별도 저장소가 없다. D11 운용 검증 / S9에서
 * AI 추천 비중 로깅 인프라가 들어와야 비교가 가능 → 그 전까지 페이지에는
 * "데이터 수집 중" 빈 상태를 표시.
 */
export async function getCounterfactual(): Promise<CounterfactualComparison | null> {
  return null;
}
