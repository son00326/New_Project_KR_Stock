// T1.6 — Short List 30 미달 원인 분류 (pure, server/client 양쪽 import 가능 — no directive).
// 버킷별 활성 카운트로 원인을 판정한다. 단순 total 비교는 W2a 트랙 분리(단기 주1회 / 중장기 월1회)
// finalize 시차를 "스크리닝 미달"로 오인하므로, per-bucket 카운트로 track_pending을 구분한다.
import type { ShortageReason } from "@/types/admin";
import { SHORTLIST_TARGET_COUNT } from "@/types/admin";

const BUCKET_TARGET = SHORTLIST_TARGET_COUNT / 3; // 단·중·장 각 10종

// ⚠️ 불변식 (omxy 76차 리뷰 적대 재판정): 이 판정은 persist된 short_list_30 버킷 카운트가
//   항상 정확히 0 또는 10이라는 전제에 의존한다 — replace_shortlist_track(0031, active bucket당
//   v_expected=10 hard check) + midlong 트랙 schema refine(per_active_timeframe_must_be_10:
//   mid·long 동시 10) + carry_short_into_month(버킷 empty일 때만 실행 → 전체 10 복사 or no-op).
//   즉 9 같은 부분 버킷은 persist 불가다(incumbent 풀 카운트[9/10 가능]와 혼동 금지 —
//   그건 AI 평가 입력일 뿐 UI가 읽는 테이블 카운트가 아님). 이 커플링이 완화되면(예: per-bucket
//   finalize) [0,10,0] 등이 track_pending로 오분류될 수 있으니 본 규칙도 함께 갱신해야 한다.
// 버킷별 활성 카운트(removed 제외)에서 30종 미달 원인을 결정.
//  - total ≥ 30 → none
//  - total < 30 이고 (한 버킷 이상 full==10) AND (한 버킷 이상 empty==0) → track_pending
//    (트랙 분리 finalize 시차 — 빈 트랙은 다음 주기에 갱신, 스크리닝 미달 아님)
//  - 그 외 미달 → screening (M10 연결 후 scheduler_fail 판정 추가)
export function resolveShortageReason(bucketCounts: number[]): ShortageReason {
  const total = bucketCounts.reduce((sum, n) => sum + n, 0);
  if (total >= SHORTLIST_TARGET_COUNT) return "none";

  const hasFull = bucketCounts.some((n) => n === BUCKET_TARGET);
  const hasEmpty = bucketCounts.some((n) => n === 0);
  if (hasFull && hasEmpty) return "track_pending";

  return "screening";
}
