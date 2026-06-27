import {
  buildFunnelReflection,
  type FunnelReflectionInput,
  type FunnelReflectionOutput,
} from "@/lib/reflection/funnel-reflection";
import { isFunnelReflectionEnabled } from "@/lib/reflection/flags";

// G1 Tier0 Reflection Lab orchestrator (계측 scaffold, D33).
// 게이트(isFunnelReflectionEnabled)를 본 진입에서 소비 — off → no-op·제안 생성 0(mutation 0).
// 입력(과거 150 candidates + factor exposures + 실현 수익률)은 DI seam — 깊은 data-loader는
// "완성 늦게"(S9 관찰 중 채움). 본 scaffold = flag gate + buildFunnelReflection + insert 배선.
// mutation: short_list_30/funnel config 무변경 — 제안 로그만(자동 적용 영구 금지).

export interface RunFunnelReflectionDeps {
  insert: (proposal: FunnelReflectionOutput) => Promise<void>;
}

export interface RunFunnelReflectionResult {
  skipped?: "flag_off";
  pricedCount: number;
  challengerMoved: boolean;
}

export async function runFunnelReflectionJob(
  input: FunnelReflectionInput,
  deps: RunFunnelReflectionDeps,
): Promise<RunFunnelReflectionResult> {
  if (!isFunnelReflectionEnabled()) {
    return { skipped: "flag_off", pricedCount: 0, challengerMoved: false };
  }
  const proposal = buildFunnelReflection(input);
  await deps.insert(proposal);
  const challengerMoved = Object.keys(proposal.challengerConfig).some(
    (k) => proposal.challengerConfig[k] !== proposal.championConfig[k],
  );
  return {
    pricedCount: proposal.evidence.pricedCount,
    challengerMoved,
  };
}
