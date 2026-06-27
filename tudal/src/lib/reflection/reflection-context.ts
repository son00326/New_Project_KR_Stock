// PR-K Reflection — 회고 컨텍스트 빌더 (pure·결정론·₩0).
//   직전 사이클 회고를 다음 선정 prompt에 "AI 컨텍스트 입력"으로 주입.
//   범주 분리(코드 불변식): context이지 forecast가 아니다 — 예측/전망 어휘 금지,
//   Tier0 스크리닝 팩터도 아니다(G4 macro / M12a negative-news와 동일 격리).
//   additive · forward-validate · pure (env/IO/Date.now 없음).
// SoT: docs/superpowers/specs/2026-06-27-reflection-prk-build.md §3.2.

import { DEFAULT_CONTEXT_MAX_PERSONAS } from "@/lib/reflection/config";
import type { ReflectionMetrics } from "@/lib/reflection/types";

// 회고 대상 = 직전 사이클의 **평가 후보 풀 전체**(선정 30 subset 아님 — short_list_30 rolling 교체로
//   period별 선정 subset의 신뢰 historical source 부재. admin-reflection getCyclePanels 주석 참조).
//   라벨을 "평가군"으로 명시해 LLM이 "우리 추천이 X% 났다"로 오독하지 않게 한다(M2).
const HEADER =
  "[직전 사이클 평가군 회고 · AI 컨텍스트 입력(평가 후보 풀 과거 실현 성과 · 예측 아님 · Tier0 스크리닝 팩터 아님)]";

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export function buildReflectionContext(
  metrics: ReflectionMetrics,
  opts?: { maxPersonas?: number },
): string {
  // dormant — 추천 종목 없음 또는 가격 전부 부재(fail-soft) → consumer가 아무것도 append 안 함.
  if (metrics.selectedCount === 0 || metrics.pricedCount === 0) return "";

  const maxPersonas = opts?.maxPersonas ?? DEFAULT_CONTEXT_MAX_PERSONAS;

  const summaryParts: string[] = [];
  if (metrics.overallAvgRealizedReturn !== null) {
    summaryParts.push(`평균 실현 수익률 ${pct(metrics.overallAvgRealizedReturn)}`);
  }
  if (metrics.overallHitRate !== null) {
    // raw 적중 수를 직접 사용(비율×N 재구성 시 numeric 라운딩 off-by-one 위험 회피).
    summaryParts.push(`적중 ${metrics.overallHitCount}/${metrics.pricedCount}`);
  }
  const summary = `직전 평가군(후보 풀) 실현 성과: ${summaryParts.join(" · ")} (평가 종목 ${metrics.pricedCount}/${metrics.selectedCount} 가격확정).`;

  // 강점 페르소나 = convictionWeightedReturn(과거 정렬도) desc. null/표본0 제외.
  const strengths = metrics.perPersona
    .filter((p) => p.convictionWeightedReturn !== null && p.sampleSize > 0)
    .slice()
    .sort((a, b) => b.convictionWeightedReturn! - a.convictionWeightedReturn!)
    .slice(0, maxPersonas)
    .map((p) => `${p.personaId}(가중 ${pct(p.convictionWeightedReturn!)})`);

  const lines = [HEADER, summary];
  if (strengths.length > 0) {
    lines.push(`확신-결과 정렬 강점 페르소나: ${strengths.join(", ")}`);
  }
  return lines.join("\n");
}
