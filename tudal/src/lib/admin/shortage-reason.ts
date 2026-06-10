// T1.6 — Short List 30 미달 원인 분류 (pure, server/client 양쪽 import 가능 — no directive).
// 버킷별 활성 카운트로 원인을 판정한다. 단순 total 비교는 W2a 트랙 분리(단기 주1회 / 중장기 월1회)
// finalize 시차를 "스크리닝 미달"로 오인하므로, per-bucket 카운트로 track_pending을 구분한다.
import type { ShortageReason } from "@/types/admin";
import { SHORTLIST_TARGET_COUNT } from "@/types/admin";

const BUCKET_TARGET = SHORTLIST_TARGET_COUNT / 3; // 단·중·장 각 10종

// 버킷별 활성 카운트(removed 제외)에서 30종 미달 원인을 결정.
//  - total ≥ 30 → none
//  - total < 30 이고 (한 버킷 이상 full==10) AND (한 버킷 이상 empty==0) → track_pending
//    (트랙 분리 finalize 시차 — 직전 갱신분 참조, 스크리닝 미달 아님)
//  - 그 외 미달 → screening (M10 연결 후 scheduler_fail 판정 추가)
export function resolveShortageReason(bucketCounts: number[]): ShortageReason {
  const total = bucketCounts.reduce((sum, n) => sum + n, 0);
  if (total >= SHORTLIST_TARGET_COUNT) return "none";

  const hasFull = bucketCounts.some((n) => n === BUCKET_TARGET);
  const hasEmpty = bucketCounts.some((n) => n === 0);
  if (hasFull && hasEmpty) return "track_pending";

  return "screening";
}
