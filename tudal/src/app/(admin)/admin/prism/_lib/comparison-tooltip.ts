export function formatPrismTooltipName(name: unknown, item: unknown): string {
  const label = typeof name === "string" ? name : "성과";
  if (label !== "프리즘" || typeof item !== "object" || item === null || !("payload" in item)) {
    return label;
  }
  const payload = item.payload;
  const isAmFallback = typeof payload === "object"
    && payload !== null
    && "slot" in payload
    && payload.slot === "am";
  return isAmFallback ? "프리즘 (AM 대체)" : label;
}
