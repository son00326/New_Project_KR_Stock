import type { NewsCandidate } from "@/lib/news/classifier";

// ---------------------------------------------------------------------------
// 어드민 지정 매체 스크래핑 어댑터 (BL-13 하이브리드 2차, S5a T5a.3)
//
// 현 단계: 스텁. 실 스크래핑(headless·robots.txt·ToS 준수)은 S6 컴플라이언스 정비 이후.
// 본 함수는 인터페이스만 정의하고, 호출자는 네이버 API 1차 결과 + 스크래핑 결과를 합쳐
// classifier → dedupeByUrl 순으로 처리.
// ---------------------------------------------------------------------------

export interface ScrapeTarget {
  source: string; // 매체명
  url: string; // index/RSS URL
  enabled: boolean;
}

export async function scrapeSources(
  targets: ScrapeTarget[],
): Promise<NewsCandidate[]> {
  // S6 컴플라이언스 정비(robots.txt·ToS·rate-limit 후) 전까지 빈 배열 반환.
  void targets;
  return [];
}
