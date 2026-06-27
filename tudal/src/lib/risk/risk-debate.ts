// G3 Risk 3자 토론 — 공격/보존/중립 위험 재판정 (순수 로직, D33).
// advisory/shadow layer — Accept 게이트 substitute 아님(비강제). 포트 구성당 1회(cost cap).
// LLM 호출은 DI — 순수 aggregation/parse는 env/AI 미접근. Vitest 친화(₩0).
// 범주 분리: G3(포트 위험 재판정) ≠ M12a(뉴스) ≠ G1(funnel 회고) ≠ 합의배지(선정).

export type RiskStance = "aggressive" | "conservative" | "neutral";
export type RiskVote = "pass" | "conditional" | "reject";
export type ConcernLevel = "low" | "medium" | "high";

export const RISK_STANCES: readonly RiskStance[] = [
  "aggressive",
  "conservative",
  "neutral",
];

export interface RiskJudgment {
  stance: RiskStance;
  concernLevel: ConcernLevel;
  keyRisks: string[];
  verdictVote: RiskVote;
}

export interface RiskPortfolioInput {
  month: string;
  holdings: Array<{ ticker: string; sector: string; weight: number }>;
  cashWeight: number;
  bucketMix: { short: number; mid: number; long: number };
}

const VOTE_SET: ReadonlySet<string> = new Set(["pass", "conditional", "reject"]);
const CONCERN_SET: ReadonlySet<string> = new Set(["low", "medium", "high"]);

/**
 * 3 stance 표 → 최종 verdict (결정론·advisory):
 *   reject ≥2 → reject / (pass 과반 ∧ reject 0) → pass / else conditional.
 * 입력 부족(<1) → conditional(보수적, advisory).
 */
export function aggregateRiskVerdict(votes: RiskJudgment[]): RiskVote {
  if (votes.length === 0) return "conditional";
  const rejects = votes.filter((v) => v.verdictVote === "reject").length;
  const passes = votes.filter((v) => v.verdictVote === "pass").length;
  if (rejects >= 2) return "reject";
  if (passes > votes.length / 2 && rejects === 0) return "pass";
  return "conditional";
}

const STANCE_FRAME: Record<RiskStance, string> = {
  aggressive: "공격적 관점(상승 여력·기회비용 우선)",
  conservative: "보존적 관점(하방 위험·집중도·유동성 우선)",
  neutral: "중립 관점(균형·분산·시나리오 대칭)",
};

/** stance별 위험 재판정 프롬프트(LLM 입력). 결정론 텍스트. */
export function buildRiskDebatePrompt(
  stance: RiskStance,
  portfolio: RiskPortfolioInput,
): string {
  const lines = [
    `당신은 포트폴리오 위험 심사위원입니다 — ${STANCE_FRAME[stance]}.`,
    `대상 포트(${portfolio.month}): 종목 ${portfolio.holdings.length} · 현금 ${(portfolio.cashWeight * 100).toFixed(0)}% · 단/중/장 ${portfolio.bucketMix.short}/${portfolio.bucketMix.mid}/${portfolio.bucketMix.long}.`,
    `종목: ${portfolio.holdings.map((h) => `${h.ticker}(${h.sector} ${(h.weight * 100).toFixed(0)}%)`).join(", ")}`,
    "이 포트의 위험을 평가하고 JSON으로만 답하라:",
    `{"concern_level":"low|medium|high","key_risks":["..."],"verdict_vote":"pass|conditional|reject"}`,
    "※ advisory 평가 — 매매 지시가 아니라 위험 관점 제공.",
  ];
  return lines.join("\n");
}

interface RawJudgment {
  concern_level?: unknown;
  key_risks?: unknown;
  verdict_vote?: unknown;
}

/** LLM 응답 → RiskJudgment. 불량값은 보수적 기본(concern=high, vote=conditional). */
export function parseRiskJudgment(stance: RiskStance, raw: unknown): RiskJudgment {
  const r = (raw ?? {}) as RawJudgment;
  const concernLevel: ConcernLevel = CONCERN_SET.has(String(r.concern_level))
    ? (r.concern_level as ConcernLevel)
    : "high";
  const verdictVote: RiskVote = VOTE_SET.has(String(r.verdict_vote))
    ? (r.verdict_vote as RiskVote)
    : "conditional";
  const keyRisks = Array.isArray(r.key_risks)
    ? r.key_risks.filter((x): x is string => typeof x === "string").slice(0, 5)
    : [];
  return { stance, concernLevel, keyRisks, verdictVote };
}

/** verdict별 한국어 라벨. */
export const RISK_VERDICT_LABEL: Record<RiskVote, string> = {
  pass: "통과",
  conditional: "조건부",
  reject: "거절",
};
