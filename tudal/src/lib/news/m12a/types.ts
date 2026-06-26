import type { Severity } from "@/types/admin";

// ---------------------------------------------------------------------------
// M12a — 뉴스 기반 자동 제외 (AI 페르소나) · 공유 타입 (shadow-first)
// SoT: ServicePlan-Admin §3.10 R3.10-5~7g · docs/superpowers/specs/2026-06-26-m12a-news-auto-remove-shadow-first.md
//
// 범주 분리(코드 불변식): M12a = per-ticker thesis-break 제거.
//   ≠ G4 macro(거시 컨텍스트 입력) ≠ M15 Exit(보유 매도 신호) ≠ D19 합의 배지 ≠ D27 incumbent.
// ---------------------------------------------------------------------------

export type M12aScope = "company" | "sector" | "market" | "unknown";
export type M12aLevel = "low" | "medium" | "high";
export type M12aDirectness = "direct" | "indirect";
export type M12aSurface = "list" | "portfolio";

// per-ticker 최종 판정(결정론). hold_for_review는 brake(run-level) 산출.
export type RecommendedAction = "auto_remove" | "alert_only" | "hold_for_review";
// GAP1 m12a_risk_action 귀속(Track Record 3-layer 분리의 층 ③).
export type ActionTaken = "shadowed" | "held_by_brake" | "removed";

/**
 * AI 페르소나(Core 11)가 (뉴스, 종목) 1쌍에 대해 산출하는 구조화 판정(R3.10-6).
 * recommended_action은 self-report를 신뢰하지 않고 구조화 필드에서 decideRecommendedAction이 결정론 파생.
 */
export interface PerTickerAssessment {
  ticker: string; // KRX 6자리
  surface: M12aSurface; // 홈 리스트 vs 가상포트(둘 다면 2 row)
  track?: "short" | "midlong"; // surface='list'일 때 트랙(floor 계산용)
  scope: M12aScope; // 메타데이터(게이트 아님)
  severity: Severity;
  confidence: M12aLevel;
  materiality: M12aLevel;
  directness: M12aDirectness;
  thesisBreak: boolean;
  thesisBreakReason: string | null;
  affectedTickers: string[]; // AI가 명시한 영향 종목
  newsEventId: string; // FK → news_event.id
  newsTitle: string;
  newsUrl: string;
}

// ── brake (R3.10-7a) ───────────────────────────────────────────────────────
export interface BrakeConfig {
  maxAutoRemovalsPerRun: number; // 기본 3 (4건↑ → mass hold)
  listFloors: { short: number; midlong: number; full: number }; // 70%: 7/14/21
  concentratedPortfolioMax: number; // N < 이 값 = 집중포트(1건 자동·2건↑ 보류)
}

export interface BrakeCandidate {
  ticker: string;
  surface: M12aSurface;
  track?: "short" | "midlong"; // list candidate의 트랙
}

export interface ApplySmartBrakeInput {
  candidates: BrakeCandidate[]; // verdict=auto_remove 후보(run 전체)
  listTrackSizes: { short: number; midlong: number; full: number }; // 현 리스트 크기
  portfolioSize: number; // 보유 종목 수 N
  config: BrakeConfig;
}

export type BrakeReason =
  | "mass_removal" // > maxAutoRemovalsPerRun
  | "list_track_floor" // 트랙 70% floor 위반
  | "portfolio_floor" // 가상포트 floor/집중포트 규칙 위반
  | null;

export interface BrakeOutcome {
  brakeTriggered: boolean;
  reasons: Exclude<BrakeReason, null>[]; // 트리거된 사유(중첩 가능)
  // 후보별 최종 action_taken (brake 발동 시 전건 held_by_brake — 부분 제외 없음)
  // 'removed' 여부는 orchestrator의 auto-remove flag로 최종 결정(shadow면 'shadowed').
  heldByBrake: boolean;
}

// ── ledger (R3.10-7c · GAP1) ───────────────────────────────────────────────
export interface M12aTickerLedgerRow {
  newsEventId: string;
  runId: string;
  month: string; // YYYY-MM-01
  ticker: string;
  surface: M12aSurface;
  scope: M12aScope;
  severity: Severity;
  confidence: M12aLevel;
  materiality: M12aLevel;
  directness: M12aDirectness;
  thesisBreak: boolean;
  thesisBreakReason: string | null;
  recommendedAction: RecommendedAction;
  actionTaken: ActionTaken;
  heldByBrake: boolean;
  priceBasisDate: string | null; // GAP2 (removed만)
  priceSource: "KRX_EOD" | null;
  executionAssumption: "virtual_eod" | null;
  alertEventId: string | null; // optional link
}

// ── cashout (GAP2) ─────────────────────────────────────────────────────────
export interface CashoutRecord {
  ticker: string;
  price: number; // 최신 완료 KRX EOD 종가
  priceBasisDate: string; // YYYYMMDD
  priceSource: "KRX_EOD";
  executionAssumption: "virtual_eod";
}
