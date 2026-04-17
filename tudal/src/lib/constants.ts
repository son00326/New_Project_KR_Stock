// 주픽 서비스 상수

export const SITE_NAME = "주픽";
export const SITE_NAME_EN = "JooPick";
export const SITE_DESCRIPTION = "똑똑한 주식 픽 - AI 기반 주식 분석 플랫폼";
export const SITE_URL = "https://joopick.com";

// 포맷 유틸
export function formatKRW(value: number): string {
  if (value >= 1_0000_0000_0000) {
    return `${(value / 1_0000_0000_0000).toFixed(1)}조`;
  }
  if (value >= 1_0000_0000) {
    return `${(value / 1_0000_0000).toFixed(0)}억`;
  }
  if (value >= 1_0000) {
    return `${(value / 1_0000).toFixed(0)}만`;
  }
  return value.toLocaleString("ko-KR");
}

export function formatPrice(value: number): string {
  return value.toLocaleString("ko-KR") + "원";
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
