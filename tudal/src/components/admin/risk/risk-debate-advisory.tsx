import {
  RISK_VERDICT_LABEL,
  type RiskJudgment,
  type RiskVote,
} from "@/lib/risk/risk-debate";

// G3 Risk 3자 토론 advisory 배너 (presentational).
// **advisory only** — Accept 차단/대체 아님. verdict가 reject여도 Accept 동작 무변경(참고용).

const VERDICT_STYLE: Record<RiskVote, string> = {
  pass: "border-market-up bg-market-up/10 text-market-up",
  conditional: "border-warning bg-warning/10 text-warning",
  reject: "border-market-down bg-market-down/10 text-market-down",
};

const STANCE_LABEL: Record<string, string> = {
  aggressive: "공격",
  conservative: "보존",
  neutral: "중립",
};

export interface RiskDebateAdvisoryData {
  finalVerdict: RiskVote;
  votes: RiskJudgment[];
  summary: string;
}

export function RiskDebateAdvisory({
  assessment,
}: {
  assessment: RiskDebateAdvisoryData | null;
}) {
  if (!assessment) return null;
  return (
    <section
      aria-label="위험 재판정 (G3 advisory)"
      className={`rounded-2xl border px-5 py-4 text-sm shadow-toss-sm ${VERDICT_STYLE[assessment.finalVerdict]}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">
          위험 재판정(G3): {RISK_VERDICT_LABEL[assessment.finalVerdict]}
        </span>
        <span className="text-xs font-normal">
          ※ advisory — Accept 차단 아님, 참고용(공격/보존/중립 3자)
        </span>
      </div>
      {assessment.votes.length > 0 && (
        <ul className="mt-2 space-y-1.5 text-xs font-normal">
          {assessment.votes.map((v) => (
            <li key={v.stance}>
              <strong>{STANCE_LABEL[v.stance] ?? v.stance}</strong>:{" "}
              {RISK_VERDICT_LABEL[v.verdictVote]} ({v.concernLevel})
              {v.keyRisks.length > 0 && ` — ${v.keyRisks.slice(0, 2).join(", ")}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
