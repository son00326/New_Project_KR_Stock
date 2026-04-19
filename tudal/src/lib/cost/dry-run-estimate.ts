// ---------------------------------------------------------------------------
// BL-18 (B) 견적 임계치 — 실 API 호출 없이 보수적 월간 비용 상한 산정 (S6 진입 게이트)
// ref: ServicePlan-Admin §1A.0 · §3.12 R3.12-1~3
//
// 목적: M17 35만 경보·40만 hardcap이 실측값으로 검증되기 전, 토큰 사용량을 보수적으로
//       추정해 임계치가 합리적인지 확인. 실 API 토큰 dry-run은 KIS·Anthropic 키 확보 후
//       추후 진행. 본 모듈은 추정 시나리오 3종(low/base/worst) + 산식 박제.
//
// 워크로드 가정 (ServicePlan-Admin):
//   - Short List: 월 1회, 30종 선정 단계
//   - Report: 월 1회 × 30종 × Section 0~8 (9 섹션) × 1 회 + Reject 재분석 ≤1회
//   - Committee: 보고서당 Core 11 + Sector 5(해당 섹터만) = 16 페르소나 투표
//   - Briefing: 매일 1회 × 약 22 영업일 (KRX)
//   - Regenerate: 종목당 월 manual ≤2 + auto ≤1 (가산은 Reject 재분석으로 한정)
//
// 보수성: token 가정은 실측 전이므로 일부러 상한을 넓게 잡음. base = 현실 추정,
//         worst = base × 1.5 안전 margin, low = base × 0.6 (낙관적 캐싱 적용 시).
// ---------------------------------------------------------------------------

import { computeCostKrw } from "@/lib/cost/anthropic-pricing";
import { COST_HARDCAP_KRW, COST_WARNING_THRESHOLD_KRW } from "@/types/admin";

export interface WorkloadAssumption {
  shortlistRunsPerMonth: number;
  shortlistTokensIn: number;
  shortlistTokensOut: number;
  reportTickerCount: number;
  reportSectionsPerTicker: number;
  reportRegenFactor: number; // 1.0 = 재분석 없음, 1.3 = 30% 종목이 Reject 재분석 1회
  reportTokensInPerSection: number;
  reportTokensOutPerSection: number;
  committeePersonasPerReport: number;
  committeeTokensInPerVote: number;
  committeeTokensOutPerVote: number;
  briefingDaysPerMonth: number;
  briefingTokensIn: number;
  briefingTokensOut: number;
}

// base 시나리오 — ServicePlan-Admin §1A.0 SoT 가정
export const BASE_WORKLOAD: WorkloadAssumption = {
  shortlistRunsPerMonth: 1,
  shortlistTokensIn: 80_000, // 200종 후보 스크리닝 데이터 + 5-Signal 파이프
  shortlistTokensOut: 4_000, // 30종 ranked list + 3줄 근거
  reportTickerCount: 30,
  reportSectionsPerTicker: 9,
  reportRegenFactor: 1.2, // 종목 20%가 1회 재분석된다고 가정
  reportTokensInPerSection: 6_000, // 재무·시세·뉴스·섹터 데이터 주입
  reportTokensOutPerSection: 1_500,
  committeePersonasPerReport: 16, // Core 11 + Sector 5
  committeeTokensInPerVote: 4_000, // 페르소나 시스템 프롬프트 + 리포트 요약
  committeeTokensOutPerVote: 600, // 투표 + 1줄 논거
  briefingDaysPerMonth: 22, // KRX 평균 영업일
  briefingTokensIn: 4_000,
  briefingTokensOut: 1_500,
};

export interface CostScenarioBreakdown {
  shortlistKrw: number;
  reportKrw: number;
  committeeKrw: number;
  briefingKrw: number;
  totalKrw: number;
  totalTokensPrompt: number;
  totalTokensCompletion: number;
}

export function estimateMonthlyCost(
  workload: WorkloadAssumption,
  model: string,
): CostScenarioBreakdown {
  // shortlist
  const shortlistIn = workload.shortlistRunsPerMonth * workload.shortlistTokensIn;
  const shortlistOut =
    workload.shortlistRunsPerMonth * workload.shortlistTokensOut;
  const shortlistKrw = computeCostKrw(model, shortlistIn, shortlistOut);

  // report (Section 0~8 × ticker × regen factor)
  const reportRuns =
    workload.reportTickerCount *
    workload.reportSectionsPerTicker *
    workload.reportRegenFactor;
  const reportIn = reportRuns * workload.reportTokensInPerSection;
  const reportOut = reportRuns * workload.reportTokensOutPerSection;
  const reportKrw = computeCostKrw(model, reportIn, reportOut);

  // committee (per report × personas)
  const committeeRuns =
    workload.reportTickerCount * workload.committeePersonasPerReport;
  const committeeIn = committeeRuns * workload.committeeTokensInPerVote;
  const committeeOut = committeeRuns * workload.committeeTokensOutPerVote;
  const committeeKrw = computeCostKrw(model, committeeIn, committeeOut);

  // briefing
  const briefingIn = workload.briefingDaysPerMonth * workload.briefingTokensIn;
  const briefingOut = workload.briefingDaysPerMonth * workload.briefingTokensOut;
  const briefingKrw = computeCostKrw(model, briefingIn, briefingOut);

  return {
    shortlistKrw,
    reportKrw,
    committeeKrw,
    briefingKrw,
    totalKrw:
      Math.round((shortlistKrw + reportKrw + committeeKrw + briefingKrw) * 100) /
      100,
    totalTokensPrompt: shortlistIn + reportIn + committeeIn + briefingIn,
    totalTokensCompletion: shortlistOut + reportOut + committeeOut + briefingOut,
  };
}

export interface DryRunReport {
  model: string;
  scenarios: {
    low: CostScenarioBreakdown;
    base: CostScenarioBreakdown;
    worst: CostScenarioBreakdown;
  };
  warningThresholdKrw: number;
  hardcapKrw: number;
  worstExceedsWarning: boolean;
  worstExceedsHardcap: boolean;
  verdict: "safe" | "tight" | "over";
  notes: string[];
}

// 종합 견적 — base × {0.6, 1.0, 1.5} 시나리오 + 임계치 비교 + 결론
export function buildDryRunReport(
  model: string,
  workload: WorkloadAssumption = BASE_WORKLOAD,
): DryRunReport {
  const scaled = (factor: number): WorkloadAssumption => ({
    ...workload,
    shortlistTokensIn: workload.shortlistTokensIn * factor,
    shortlistTokensOut: workload.shortlistTokensOut * factor,
    reportTokensInPerSection: workload.reportTokensInPerSection * factor,
    reportTokensOutPerSection: workload.reportTokensOutPerSection * factor,
    committeeTokensInPerVote: workload.committeeTokensInPerVote * factor,
    committeeTokensOutPerVote: workload.committeeTokensOutPerVote * factor,
    briefingTokensIn: workload.briefingTokensIn * factor,
    briefingTokensOut: workload.briefingTokensOut * factor,
  });

  const low = estimateMonthlyCost(scaled(0.6), model);
  const base = estimateMonthlyCost(workload, model);
  const worst = estimateMonthlyCost(scaled(1.5), model);

  const worstExceedsWarning = worst.totalKrw >= COST_WARNING_THRESHOLD_KRW;
  const worstExceedsHardcap = worst.totalKrw >= COST_HARDCAP_KRW;

  let verdict: DryRunReport["verdict"];
  if (worstExceedsHardcap) verdict = "over";
  else if (worstExceedsWarning) verdict = "tight";
  else verdict = "safe";

  const notes: string[] = [
    "BL-18 = B (견적 임계치) — 실 API dry-run 미실시.",
    `모델: ${model}. 환율: USD 1 = ₩${1430}.`,
    "low = base × 0.6 (캐싱 적용 낙관). worst = base × 1.5 (안전 margin).",
    verdict === "over"
      ? "⚠️ worst 시나리오가 40만 hardcap을 초과 — 모델 다운그레이드 또는 페르소나 수 축소 검토."
      : verdict === "tight"
        ? "⚠️ worst 시나리오가 35만 경보를 초과 — base 운용 중에는 안전하나 마진 좁음."
        : "✅ worst 시나리오가 임계치 이내. 정상 운용 가능.",
  ];

  return {
    model,
    scenarios: { low, base, worst },
    warningThresholdKrw: COST_WARNING_THRESHOLD_KRW,
    hardcapKrw: COST_HARDCAP_KRW,
    worstExceedsWarning,
    worstExceedsHardcap,
    verdict,
    notes,
  };
}
