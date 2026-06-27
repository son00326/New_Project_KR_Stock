import type { AlertEvent, BucketKind, ExitDecision, Severity } from "@/types/admin";

// ---------------------------------------------------------------------------
// M15 Exit 시그널 평가 — 순수 로직 (S7c, 2026-06-27)
// ref: ServicePlan-Admin §3.10 R3.10-11~15
//
// trigger 3종(결정론 우선순위): 목표가 도달 / 모멘텀 꺾임(thesis break·악재) / 시간 만료.
// 입력 = 보유 포지션(portfolio_snapshot entryPrice/currentPrice + holdingDays + bucket horizon
//        + 선택 targetPrice[report §7]/peakPrice). I/O 없음 — 외부 주입형, Vitest 친화.
// shadow-first: EXIT_SIGNAL_ENABLED off → 호출부가 평가 미실행(본 모듈은 env 미접근).
// ---------------------------------------------------------------------------

export type ExitTrigger = "target_reached" | "momentum_break" | "time_expired";

export interface ExitPosition {
  ticker: string;
  bucket: BucketKind;
  entryPrice: number;
  currentPrice: number;
  holdingDays: number;
  /** report §7 목표가 (없으면 target_reached 미적용) */
  targetPrice?: number | null;
  /** 보유 기간 중 최고가 (없으면 trailing drawdown 미적용) */
  peakPrice?: number | null;
}

export interface ExitSignal {
  ticker: string;
  trigger: ExitTrigger;
  severity: Severity;
  reason: string;
  /** entry 대비 수익률 (percentage points, 예: -15.0) */
  returnPct: number;
  holdingDays: number;
}

export interface ExitSignalConfig {
  /** entry 대비 손실 이 값 이상이면 momentum_break (기본 0.15 = -15%) */
  stopLossPct?: number;
  /** peak 대비 하락 이 값 이상이면 momentum_break (기본 0.12 = -12%, peakPrice 있을 때) */
  trailingDrawdownPct?: number;
  /** bucket horizon별 최대 보유일 (초과 시 time_expired) */
  maxHoldingDays?: Record<BucketKind, number>;
}

const DEFAULT_STOP_LOSS_PCT = 0.15;
const DEFAULT_TRAILING_DRAWDOWN_PCT = 0.12;
const DEFAULT_MAX_HOLDING_DAYS: Record<BucketKind, number> = {
  short: 30,
  mid: 90,
  long: 365,
};

function pct(n: number): number {
  return Number((n * 100).toFixed(2));
}

function fmtKrw(n: number): string {
  return Math.round(n).toLocaleString("ko-KR");
}

/**
 * 보유 포지션 → Exit 시그널(or null). 결정론 우선순위:
 *   1. target_reached  — targetPrice 도달 (익절 후보, warning)
 *   2. momentum_break  — entry 대비 -stopLoss 또는 peak 대비 -trailing drawdown (critical)
 *   3. time_expired    — bucket horizon 초과 (warning)
 * entryPrice/currentPrice ≤ 0 → null (수익률 계산 불가, fail-soft).
 */
export function evaluateExitSignal(
  position: ExitPosition,
  config: ExitSignalConfig = {},
): ExitSignal | null {
  const { ticker, bucket, entryPrice, currentPrice, holdingDays } = position;
  if (!(entryPrice > 0) || !(currentPrice > 0)) return null;

  const stopLossPct = config.stopLossPct ?? DEFAULT_STOP_LOSS_PCT;
  const trailingDrawdownPct =
    config.trailingDrawdownPct ?? DEFAULT_TRAILING_DRAWDOWN_PCT;
  const maxHoldingDays = config.maxHoldingDays ?? DEFAULT_MAX_HOLDING_DAYS;

  const returnRatio = (currentPrice - entryPrice) / entryPrice;
  const returnPct = pct(returnRatio);

  // 1. 목표가 도달
  const targetPrice = position.targetPrice;
  if (
    targetPrice !== null &&
    targetPrice !== undefined &&
    targetPrice > 0 &&
    currentPrice >= targetPrice
  ) {
    return {
      ticker,
      trigger: "target_reached",
      severity: "warning",
      reason: `목표가 ${fmtKrw(targetPrice)}원 도달 (현재 ${fmtKrw(currentPrice)}원 · 수익 ${returnPct > 0 ? "+" : ""}${returnPct}%) — 익절 검토`,
      returnPct,
      holdingDays,
    };
  }

  // 2. 모멘텀 꺾임 (thesis break / 악재)
  const peakPrice = position.peakPrice;
  const stopHit = returnRatio <= -stopLossPct;
  const drawdownRatio =
    peakPrice !== null && peakPrice !== undefined && peakPrice > 0
      ? (currentPrice - peakPrice) / peakPrice
      : 0;
  const drawdownHit =
    peakPrice !== null && peakPrice !== undefined && peakPrice > 0
      ? drawdownRatio <= -trailingDrawdownPct
      : false;
  if (stopHit || drawdownHit) {
    const reasonParts: string[] = [];
    if (stopHit) {
      reasonParts.push(`진입가 대비 ${returnPct}% (손절선 -${pct(stopLossPct)}%)`);
    }
    if (drawdownHit) {
      reasonParts.push(`고점 대비 ${pct(drawdownRatio)}% (추적 손절 -${pct(trailingDrawdownPct)}%)`);
    }
    return {
      ticker,
      trigger: "momentum_break",
      severity: "critical",
      reason: `모멘텀 꺾임 — ${reasonParts.join(" · ")}`,
      returnPct,
      holdingDays,
    };
  }

  // 3. 시간 만료 (horizon 초과)
  const maxDays = maxHoldingDays[bucket];
  if (typeof maxDays === "number" && holdingDays >= maxDays) {
    return {
      ticker,
      trigger: "time_expired",
      severity: "warning",
      reason: `보유 기간 만료 — ${holdingDays}일 보유 (${bucket} horizon ${maxDays}일 초과 · 수익 ${returnPct > 0 ? "+" : ""}${returnPct}%)`,
      returnPct,
      holdingDays,
    };
  }

  return null;
}

export interface ExitAlternative {
  key: ExitDecision;
  title: string;
  body: string;
}

const ALTERNATIVE_TITLE: Record<ExitDecision, string> = {
  sell_all: "매도 전량",
  partial_sell: "분할매도",
  hold: "홀딩",
};

/**
 * Exit 시그널 → 3종 대안 시나리오 (sell_all/partial_sell/hold). trigger 맞춤 한국어 rationale.
 * /admin/alerts/[id] 정적 stub 대체 — 결정론(같은 trigger → 같은 문구).
 */
export function buildExitAlternatives(signal: ExitSignal): ExitAlternative[] {
  const byTrigger: Record<ExitTrigger, Record<ExitDecision, string>> = {
    target_reached: {
      sell_all: "목표가 도달 — 전량 익절로 수익 확정. 재진입은 조정 시 검토.",
      partial_sell: "목표가 1차 도달 — 절반 익절 후 잔여로 추가 상승 추적(트레일링 스톱).",
      hold: "목표가를 넘는 추세 강도면 유지 — §7 상향 목표 재산정 후 재점검.",
    },
    momentum_break: {
      sell_all: "모멘텀 훼손 — 전량 청산으로 손실 확대 차단. 유동성·KOSPI 방향 우선.",
      partial_sell: "추세 약화 — 50% 축소로 리스크 절반 + 반등 시 재평가 여지 확보.",
      hold: "트리거가 단기 소음일 가능성 — §7 thesis 재확인 후 익일 장전 재점검(권장도 낮음).",
    },
    time_expired: {
      sell_all: "보유 horizon 만료 — 자본 회전 위해 청산하고 신규 후보로 교체.",
      partial_sell: "만료 시점 — 절반 정리 후 잔여는 신규 촉매 확인 시까지 단기 유지.",
      hold: "만료지만 thesis 유효 + 신규 촉매 임박 시 horizon 연장 검토.",
    },
  };
  const map = byTrigger[signal.trigger];
  return (["sell_all", "partial_sell", "hold"] as ExitDecision[]).map((key) => ({
    key,
    title: ALTERNATIVE_TITLE[key],
    body: map[key],
  }));
}

/** Exit 시그널 → durable alert_event payload (alert_type=exit_signal). */
export function buildExitSignalAlert(
  signal: ExitSignal,
  now: Date,
): Omit<AlertEvent, "id" | "isRead"> {
  return {
    alertType: "exit_signal",
    ticker: signal.ticker,
    severity: signal.severity,
    triggerReason: signal.reason,
    signalSentAt: now.toISOString(),
    outcomeAt: null,
    t7PriceChange: null,
    decisionRecorded: null,
    decisionMemo: null,
  };
}
