// 항목4(b) — 홈 "추천 30 섹터 분포" 집계 (순수 로직).
// short_list_30 각 행의 sector 태그를 세어 상위 5개 + "기타"로 압축한다.
// 신규 데이터 파이프라인 없음: 이미 존재하는 sector 문자열만 사용.

export interface SectorCount {
  sector: string;
  count: number;
}

export interface SectorDistribution {
  /** 상위 N개 섹터 (count 내림차순, 동점은 이름 오름차순으로 결정적 정렬) */
  top: SectorCount[];
  /** 상위 N개에 들지 못한 섹터들의 합계 (0이면 표시 생략 판단은 소비자 몫) */
  otherCount: number;
  /** 집계 대상 종목 총 수 */
  total: number;
}

const DEFAULT_TOP_N = 5;
const UNCLASSIFIED = "미분류";

/**
 * sector 태그 목록을 상위 topN + 기타로 집계.
 * - 빈/공백 sector는 "미분류"로 귀속(누락 방지).
 * - 정렬: count 내림차순 → 동점이면 sector 이름 오름차순(결정적).
 * - top 밖 섹터 count 합 = otherCount.
 */
export function aggregateSectorDistribution(
  sectors: readonly (string | null | undefined)[],
  topN: number = DEFAULT_TOP_N,
): SectorDistribution {
  const counts = new Map<string, number>();
  for (const raw of sectors) {
    const sector = raw?.trim() ? raw.trim() : UNCLASSIFIED;
    counts.set(sector, (counts.get(sector) ?? 0) + 1);
  }

  const sorted = [...counts.entries()]
    .map(([sector, count]) => ({ sector, count }))
    .sort((a, b) => b.count - a.count || a.sector.localeCompare(b.sector, "ko"));

  const effectiveTopN = Math.max(0, topN);
  const top = sorted.slice(0, effectiveTopN);
  const otherCount = sorted
    .slice(effectiveTopN)
    .reduce((sum, s) => sum + s.count, 0);
  const total = sorted.reduce((sum, s) => sum + s.count, 0);

  return { top, otherCount, total };
}
