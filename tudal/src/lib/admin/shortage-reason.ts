// T1.6 — Short List 30 미달 원인 분류 (pure, server/client 양쪽 import 가능 — no directive).
// W2a 트랙 분리(단기 주1회 / 중장기 월1회) finalize 시차 + short carry-partial을 "스크리닝 미달"로
// 오인하지 않도록, 도달 가능 상태 불변식(아래)에 근거해 0<total<30을 track_pending으로 판정한다.
import type { ShortageReason } from "@/types/admin";
import { SHORTLIST_TARGET_COUNT } from "@/types/admin";

// ⚠️ 도달 가능 상태 불변식 (omxy 76차 R1~R2 적대 재판정으로 정정):
//   persist된 short_list_30에서 mid·long 버킷은 midlong 트랙 직접-write로만 기록되고
//   exactly-10-or-throw로 강제된다(upsertShortListTrack `!==expected throw` +
//   zod `per_active_timeframe_must_be_10`(mid·long 동시 10) + replace_shortlist_track v_expected=20).
//   → **mid == long ∈ {0, 10}** (항상 같이 0 또는 같이 10).
//   short 버킷은 (a) short 직접-write = exactly 10, 또는 (b) carry_short_into_month가
//   직전 월 short를 hold로 복사하되 **midlong과 중복(졸업) ticker를 제외**(0031:494)하므로
//   **short ∈ {0..10}** — overlap 수만큼 9·8… 부분 버킷이 persist 가능(0031 주석: "cross-track
//   total=30 hard-raise 안 함"). 따라서 [9,10,10] 같은 carry-partial은 도달 가능하다.
//   핵심: **직접-write는 partial을 절대 persist 못 한다(throw)** — 즉 0<total<30인 모든 persist
//   상태는 screening 미달이 아니라 "트랙이 아직 갱신 안 됨 / short carry 반영분"인 timing 아티팩트다.
//   (screening이 30을 못 채우면 그 트랙 finalize가 throw → 해당 버킷은 EMPTY로 남지 partial이 아님.)
//
// 30종 미달 원인 판정 (bucketCounts = [short, mid, long], removed 제외):
//   - total ≥ 30 → none
//   - 0 < total < 30 → track_pending (트랙 갱신 시차 또는 short carry-partial — 다음 주기에 30 채움)
//   - total == 0 → screening (전혀 seed 안 됨)
export function resolveShortageReason(bucketCounts: number[]): ShortageReason {
  const total = bucketCounts.reduce((sum, n) => sum + n, 0);
  if (total >= SHORTLIST_TARGET_COUNT) return "none";
  if (total === 0) return "screening";
  return "track_pending";
}
