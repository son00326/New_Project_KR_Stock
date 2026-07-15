export type PrismRecord = Readonly<Record<string, unknown>>;

export function readString(
  record: PrismRecord,
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
}

export function readNumber(
  record: PrismRecord,
  keys: readonly string[],
): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function readBoolean(
  record: PrismRecord,
  keys: readonly string[],
): boolean | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return null;
}

export function readRecord(value: unknown): PrismRecord | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is PrismRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readRecordArray(value: unknown): readonly PrismRecord[] | null {
  if (!Array.isArray(value)) return null;
  const records = value.map(readRecord);
  return records.every((record) => record !== null) ? records : null;
}

export function readExtraArray(
  extra: PrismRecord,
  keys: readonly string[],
): readonly PrismRecord[] | null {
  for (const key of keys) {
    const records = readRecordArray(extra[key]);
    if (records !== null) return records;
  }
  return null;
}

export function readExtraRecord(
  extra: PrismRecord,
  keys: readonly string[],
): PrismRecord | null {
  for (const key of keys) {
    const record = readRecord(extra[key]);
    if (record !== null) return record;
  }
  return null;
}

export function tickerOf(record: PrismRecord): string | null {
  return readString(record, ["ticker", "symbol", "code", "stock_code"]);
}

export function nameOf(record: PrismRecord): string {
  return readString(record, ["name", "stock_name", "company_name"]) ?? tickerOf(record) ?? "종목 미상";
}

export function dateOf(record: PrismRecord): string {
  return readString(record, ["date", "trade_date", "created_at", "added_at", "generated_at"]) ?? "날짜 미상";
}
