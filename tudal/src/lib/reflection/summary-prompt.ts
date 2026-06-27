// PR-K Reflection — (선택) LLM 케이스 요약 프롬프트 빌더 (pure·결정론).
//   직전 사이클 실현 성과 + 페르소나 메트릭을 1~2줄 회고 요약으로 정리시키는 프롬프트.
//   회고지 예측 아님: 미래 수익 예측을 요구하지 않는다(과거 정렬도 요약만).
// SoT: docs/superpowers/specs/2026-06-27-reflection-prk-build.md §4.

import type { ReflectionMetrics, ReflectionTrack } from "@/lib/reflection/types";

export const REFLECTION_SUMMARY_SYSTEM_PROMPT =
  "당신은 투자 선정 사이클의 과거 실현 성과를 회고 요약하는 분석가입니다. 미래 수익을 예측하지 않고, 어떤 페르소나의 확신이 과거 결과와 정렬됐는지만 사실적으로 정리합니다.";

function fmtPct(v: number | null): string {
  return v === null ? "N/A" : `${(v * 100).toFixed(1)}%`;
}

export function buildReflectionSummaryPrompt(
  metrics: ReflectionMetrics,
  track: ReflectionTrack,
): string {
  const personaLines = metrics.perPersona
    .filter((p) => p.sampleSize > 0)
    .map(
      (p) =>
        `- ${p.personaId}: 적중률 ${fmtPct(p.hitRate)}, 확신-가중 실현 ${fmtPct(p.convictionWeightedReturn)}, 평균확신 ${p.avgConviction?.toFixed(0) ?? "N/A"} (표본 ${p.sampleSize})`,
    )
    .join("\n");

  return [
    `[${track} 트랙 직전 사이클 평가군(후보 풀) 회고 — 선정 30 subset 아님]`,
    `평가군 전체 실현 성과: 평균 실현 수익률 ${fmtPct(metrics.overallAvgRealizedReturn)}, 적중률 ${fmtPct(metrics.overallHitRate)} (가격확정 ${metrics.pricedCount}/${metrics.selectedCount} 평가 종목).`,
    `페르소나별 과거 정렬도:`,
    personaLines || "(가격확정 표본 없음)",
    "",
    "지시: 위 과거 실현 데이터만 근거로, 어떤 페르소나의 확신이 결과와 잘/못 정렬됐는지 1~2줄(한국어, ≤200자)로 회고 요약하세요. 미래 수익을 예측하지 마세요 — 과거 회고만. JSON·마크다운 없이 평문으로.",
  ].join("\n");
}
