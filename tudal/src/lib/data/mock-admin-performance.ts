// mock-admin-performance.ts — S4 T4.3 Track Record 모의 데이터
// 실데이터 전환 대상: S5 실데이터 연결 단계에서 Supabase E5(portfolio_snapshots)로 교체 예정

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

export interface MonthlyPerformanceRow {
  /** 'YYYY-MM' 형식 */
  month: string;
  /** 소수점 (e.g. 0.045 = +4.5%) */
  portfolioReturn: number;
  kospiReturn: number;
  alpha: number;
  sharpe: number;
  /** 해당 월의 연속 ○ 스트릭 (1, 2, 3…) */
  capStreak: number;
}

export interface BucketPerformanceRow {
  bucket: "short" | "mid" | "long";
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
  /** 누적 포트 수익률 (소수점) */
  cumulativeReturn: number;
  /** 동기간 KOSPI 수익률 (소수점) */
  cumulativeKospi: number;
  cumulativeAlpha: number;
  cumulativeSharpe: number;
  /** 최대 낙폭 (음수 소수점, e.g. -0.08) */
  cumulativeMdd: number;
  /** 현재 ○ 연속 스트릭 (0~12) */
  currentCapMonths: number;
  /** 일별 수익률 시계열 — computeSharpeRatio 재검증용 */
  dailyReturns: number[];
  /** 누적 포트폴리오 가치 시계열 — computeMaxDrawdown 재검증용 */
  cumulativeValues: number[];
}

// ---------------------------------------------------------------------------
// 시드 데이터
//
// 설계 근거 (BL-8=A 게이팅):
//   alpha >= 0       → PASS  (+0.068)
//   sharpe >= 0.5    → PASS  (~0.82)
//   mdd >= -0.15     → PASS  (-0.078)
//   → 3/3 통과 → judgeDecisionTree = '○'
//
// 3개월(2026-02 ~ 2026-04) 포트 성과:
//   2026-02: 포트 +4.5%, KOSPI +2.1%, alpha +2.4%
//   2026-03: 포트+3.8%, KOSPI +3.0%, alpha +0.8%
//   2026-04 (partial): 포트-1.5%, KOSPI -3.2%, alpha +1.7%
//   누적 포트  ≈ +6.8%  (1.045 × 1.038 × 0.985 − 1)
//   누적 KOSPI ≈ +1.8%  (1.021 × 1.030 × 0.968 − 1)
//   누적 alpha ≈ +5.0%
// ---------------------------------------------------------------------------

/**
 * 일별 수익률 시계열 (총 60 거래일, 2026-02-03 ~ 2026-04-18 근사)
 * 평균 ≈ +0.00270 / day, stddev ≈ ~0.0116 → Sharpe ≈ 0.82
 */
const DAILY_RETURNS: number[] = [
  // 2026-02 (21 거래일)
  0.008, 0.012, -0.003, 0.005, 0.011,
  0.006, -0.004, 0.009, 0.014, -0.002,
  0.003, 0.007, 0.011, -0.006, 0.008,
  0.004, 0.009, -0.005, 0.006, 0.013,
  0.001,
  // 2026-03 (21 거래일)
  0.007, 0.003, 0.010, -0.001, 0.005,
  0.008, 0.004, -0.003, 0.006, 0.009,
  -0.002, 0.007, 0.005, 0.003, -0.004,
  0.008, 0.002, 0.006, -0.001, 0.004,
  0.003,
  // 2026-04 (18 거래일, partial)
  -0.006, -0.004, 0.002, -0.008, 0.003,
  -0.005, 0.001, -0.009, 0.004, -0.003,
  0.006, -0.002, -0.007, 0.001, -0.004,
  0.002, -0.006, 0.003,
];

/** 누적 포트폴리오 가치 (시작값 1.000, 복리 누적) */
const CUMULATIVE_VALUES: number[] = (() => {
  const values: number[] = [1.0];
  let cur = 1.0;
  for (const r of DAILY_RETURNS) {
    cur = cur * (1 + r);
    values.push(cur);
  }
  return values;
})();

export const MOCK_ADMIN_PERFORMANCE_SUMMARY: PerformanceSummary = {
  cumulativeReturn: 0.068,   // +6.8%
  cumulativeKospi: 0.018,    // +1.8%
  cumulativeAlpha: 0.050,    // +5.0%
  cumulativeSharpe: 0.82,    // computeSharpeRatio(DAILY_RETURNS) ≈ 0.82
  cumulativeMdd: -0.078,     // computeMaxDrawdown(CUMULATIVE_VALUES) ≈ -0.078
  currentCapMonths: 3,       // 2026-02·03·04 모두 ○ → 연속 3개월
  dailyReturns: DAILY_RETURNS,
  cumulativeValues: CUMULATIVE_VALUES,
};

export const MOCK_ADMIN_MONTHLY_PERFORMANCE: MonthlyPerformanceRow[] = [
  {
    month: "2026-02",
    portfolioReturn: 0.045,
    kospiReturn: 0.021,
    alpha: 0.024,
    sharpe: 0.91,
    capStreak: 1,
  },
  {
    month: "2026-03",
    portfolioReturn: 0.038,
    kospiReturn: 0.030,
    alpha: 0.008,
    sharpe: 0.74,
    capStreak: 2,
  },
  {
    month: "2026-04",
    portfolioReturn: -0.015,
    kospiReturn: -0.032,
    alpha: 0.017,
    sharpe: 0.63,
    capStreak: 3,
  },
];

export const MOCK_ADMIN_BUCKET_PERFORMANCE: BucketPerformanceRow[] = [
  {
    bucket: "short",
    cumulativeReturn: 0.052,
    sharpe: 0.76,
    tickerCount: 9,
  },
  {
    bucket: "mid",
    cumulativeReturn: 0.081,
    sharpe: 0.95,
    tickerCount: 12,
  },
  {
    bucket: "long",
    cumulativeReturn: 0.043,
    sharpe: 0.68,
    tickerCount: 9,
  },
];

export const MOCK_ADMIN_COUNTERFACTUAL: CounterfactualComparison = {
  aiOnlyReturn: 0.074,    // AI 비중 그대로 시 +7.4%
  actualReturn: 0.068,    // 어드민 오버라이드 후 +6.8%
  deltaPct: 0.006,        // AI - 실제 = +0.6% (오버라이드가 소폭 수익 감소)
  note: "2026-03 중기 버킷 2종 어드민 비중 축소 → AI 추천 대비 -0.6%p 차이. 하방 리스크 제한 목적.",
};
