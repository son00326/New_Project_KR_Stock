// PR-K Reflection 주입 source seam — selection 진입 시 호출(track별).
//   - flag off(REFLECTION_ENABLED) 또는 fetcher 미주입 → "" (dormant → 선정 프롬프트 byte-identical, DB read 0).
//   - flag on + fetcher 주입 + row 존재 시: 저장된 회고 컨텍스트 snapshot 반환.
//   getMacroContextString(G4) / getNegativeNewsContextString(M12a)와 동일 패턴. 별개 범주(전체 회고).
//
// ⚠️ LIVE selection-worker 경로 배선 — fetchLatest는 getLatestReflectionLog(track) 주입(dangling 금지,
//   [[feedback_ai_context_seam_live_path]]). flag off면 fetchLatest 미호출(DB read 0)이라 무회귀.
// SoT: docs/superpowers/specs/2026-06-27-reflection-prk-build.md §1·§5.

import { isReflectionEnabled } from "@/lib/reflection/flags";
import type { ReflectionTrack } from "@/lib/reflection/types";

export interface ReflectionContextRow {
  injectedContextSnapshot: string | null;
}

export interface GetReflectionLearningContextOptions {
  track: ReflectionTrack;
  fetchLatest?: (track: ReflectionTrack) => Promise<ReflectionContextRow | null>;
}

export async function getReflectionLearningContextString(
  opts: GetReflectionLearningContextOptions,
): Promise<string> {
  // flag off → DB read 없이 즉시 "" (선정 byte-identical 보장).
  if (!isReflectionEnabled() || !opts.fetchLatest) return "";
  const row = await opts.fetchLatest(opts.track);
  return row?.injectedContextSnapshot ?? "";
}
