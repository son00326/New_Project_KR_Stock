import "server-only";

// 구조화 로그 헬퍼 — serverless(Vercel)는 stdout/stderr 라인을 그대로 캡처하므로,
// 단일 JSON 라인으로 emit하면 로그 드레인/쿼리에서 event·필드 단위로 추출·집계할 수 있다.
// 비정형 console.warn 문자열이 production에서 묻히는 blind spot(예: 리포트 섹션
// silent null drop)을 격상하기 위한 분리 지점.
// (admin-reports.ts §91-94 + report-section-schemas.ts §123 후속 — "PR1 cron 가동 시점 격상".)

export type StructuredLogLevel = "warn" | "error";

type StructuredLogValue =
  | string
  | number
  | boolean
  | null
  | StructuredLogValue[]
  | { [key: string]: StructuredLogValue };

const RESERVED_FIELD_KEYS = new Set(["level", "event", "toJSON"]);

/**
 * 한 줄짜리 machine-parseable JSON 로그를 해당 console 채널로 emit한다.
 * `level`·`event`는 예약 키로, caller 필드가 덮어쓰지 못하도록 항상 마지막에 강제된다.
 */
export function logStructured(
  level: StructuredLogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const payload = buildPayload(level, event, fields);
  const line = stringifyPayload(payload, level, event);

  try {
    if (level === "error") {
      console.error(line);
    } else {
      console.warn(line);
    }
  } catch {
    return;
  }
}

function buildPayload(
  level: StructuredLogLevel,
  event: string,
  fields: Record<string, unknown>,
): Record<string, StructuredLogValue> {
  const payload: Record<string, StructuredLogValue> = {};
  const seen = new WeakSet<object>();

  for (const [key, descriptor] of readEnumerableDescriptors(fields)) {
    if (RESERVED_FIELD_KEYS.has(key)) continue;

    payload[key] =
      "value" in descriptor
        ? sanitizeLogValue(descriptor.value, seen)
        : "[Getter]";
  }

  payload.level = level;
  payload.event = event;
  return payload;
}

function sanitizeLogValue(
  value: unknown,
  seen: WeakSet<object>,
): StructuredLogValue {
  if (value === null) return null;

  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return value;
    case "bigint":
      return value.toString();
    case "undefined":
      return null;
    case "symbol":
      return value.description ? `[Symbol(${value.description})]` : "[Symbol]";
    case "function":
      return "[Function]";
  }

  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (value instanceof Date) {
    seen.delete(value);
    return Number.isNaN(value.getTime()) ? value.toString() : value.toISOString();
  }

  if (value instanceof Error) {
    const errorPayload: Record<string, StructuredLogValue> = {
      name: value.name,
      message: value.message,
    };
    if (value.stack) errorPayload.stack = value.stack;
    seen.delete(value);
    return errorPayload;
  }

  if (Array.isArray(value)) {
    const arrayPayload = Array.from(value, (item) =>
      sanitizeLogValue(item, seen),
    );
    seen.delete(value);
    return arrayPayload;
  }

  const objectPayload: Record<string, StructuredLogValue> = {};
  for (const [key, descriptor] of readEnumerableDescriptors(value)) {
    if (key === "toJSON") continue;

    objectPayload[key] =
      "value" in descriptor
        ? sanitizeLogValue(descriptor.value, seen)
        : "[Getter]";
  }

  seen.delete(value);
  return objectPayload;
}

function readEnumerableDescriptors(
  value: object,
): Array<[string, PropertyDescriptor]> {
  try {
    return Object.entries(Object.getOwnPropertyDescriptors(value)).filter(
      ([, descriptor]) => descriptor.enumerable,
    );
  } catch {
    return [];
  }
}

function stringifyPayload(
  payload: Record<string, StructuredLogValue>,
  level: StructuredLogLevel,
  event: string,
): string {
  try {
    return (
      JSON.stringify(payload) ??
      JSON.stringify({ level, event, logError: "structured_log_empty_payload" })
    );
  } catch {
    return JSON.stringify({
      level,
      event,
      logError: "structured_log_serialize_failed",
    });
  }
}
