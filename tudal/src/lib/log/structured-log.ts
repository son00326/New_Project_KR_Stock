// 구조화 로그 헬퍼 — serverless(Vercel)는 stdout/stderr 라인을 그대로 캡처하므로,
// 단일 JSON 라인으로 emit하면 로그 드레인/쿼리에서 event·필드 단위로 추출·집계할 수 있다.
// 비정형 console.warn 문자열이 production에서 묻히는 blind spot(예: 리포트 섹션
// silent null drop)을 격상하기 위한 분리 지점.
// (admin-reports.ts §91-94 + report-section-schemas.ts §123 후속 — "PR1 cron 가동 시점 격상".)

export type StructuredLogLevel = "warn" | "error";

/**
 * 한 줄짜리 machine-parseable JSON 로그를 해당 console 채널로 emit한다.
 * `level`·`event`는 예약 키로, caller 필드가 덮어쓰지 못하도록 항상 마지막에 강제된다.
 */
export function logStructured(
  level: StructuredLogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({ ...fields, level, event });
  if (level === "error") {
    console.error(line);
  } else {
    console.warn(line);
  }
}
