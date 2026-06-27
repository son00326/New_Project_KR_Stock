import {
  aggregateRiskVerdict,
  buildRiskDebatePrompt,
  parseRiskJudgment,
  RISK_STANCES,
  type RiskJudgment,
  type RiskPortfolioInput,
  type RiskVote,
} from "@/lib/risk/risk-debate";
import { isRiskDebateEnabled } from "@/lib/risk/flags";

// G3 Risk 3자 토론 orchestrator (advisory/shadow, D33).
// 게이트(isRiskDebateEnabled)를 본 진입에서 소비 — off → no-op·AI 0·비용 0·mutation 0(Accept 비차단).
// 3 stance 병렬 LLM(DI) → parse → aggregate → insert(advisory). portfolio/approval/snapshot 무변경.
// 비용: 포트 구성당 1회(호출부 month idempotent). LLM은 DI라 테스트 ₩0.

export interface RunRiskDebateDeps {
  /** stance별 LLM 호출(W0 provider + hardcap reservation는 호출부 wiring). raw JSON 반환. */
  callRiskDebator: (prompt: string, stance: string) => Promise<unknown>;
  insert: (assessment: {
    month: string;
    finalVerdict: RiskVote;
    votes: RiskJudgment[];
    summary: string;
  }) => Promise<void>;
}

export interface RunRiskDebateResult {
  skipped?: "flag_off";
  finalVerdict: RiskVote | null;
  voteCount: number;
}

function buildSummary(votes: RiskJudgment[], verdict: RiskVote): string {
  const parts = votes.map(
    (v) => `${v.stance}:${v.verdictVote}(${v.concernLevel})`,
  );
  return `최종 ${verdict} — ${parts.join(" · ")} [advisory · Accept 비차단]`;
}

export async function runRiskDebate(
  portfolio: RiskPortfolioInput,
  deps: RunRiskDebateDeps,
): Promise<RunRiskDebateResult> {
  if (!isRiskDebateEnabled()) {
    return { skipped: "flag_off", finalVerdict: null, voteCount: 0 };
  }

  const votes: RiskJudgment[] = [];
  for (const stance of RISK_STANCES) {
    try {
      const raw = await deps.callRiskDebator(
        buildRiskDebatePrompt(stance, portfolio),
        stance,
      );
      votes.push(parseRiskJudgment(stance, raw));
    } catch {
      // LLM 실패 → 해당 stance 보수적 기본(conditional) 산입 (advisory — 전체 차단 안 함).
      votes.push(parseRiskJudgment(stance, {}));
    }
  }

  const finalVerdict = aggregateRiskVerdict(votes);
  await deps.insert({
    month: portfolio.month,
    finalVerdict,
    votes,
    summary: buildSummary(votes, finalVerdict),
  });

  return { finalVerdict, voteCount: votes.length };
}
