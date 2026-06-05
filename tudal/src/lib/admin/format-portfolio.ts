// W3b-3 (T1) — portfolio_proposal 디스플레이 포맷 헬퍼 (pure, client/server 양쪽 import 가능 — no directive).
// format-error.ts(에러 코드→한국어 메시지, policy)와 분리: 본 파일은 숫자/enum→표시 문자열(utility).
import type { BucketKind } from "@/types/admin";

/** 비중(0~1) → 소수 1자리 % (0.3 → "30.0%"). */
export function formatProposalWeightPct(weight: number): string {
  return `${(weight * 100).toFixed(1)}%`;
}

const TIMEFRAME_LABEL: Record<BucketKind, string> = {
  short: "단기",
  mid: "중기",
  long: "장기",
};

/** timeframe(short/mid/long) → 한국어 라벨. */
export function formatTimeframeLabel(tf: BucketKind): string {
  return TIMEFRAME_LABEL[tf];
}
