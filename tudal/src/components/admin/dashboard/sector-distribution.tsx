import {
  aggregateSectorDistribution,
  type SectorCount,
} from "@/lib/portfolio/sector-distribution";

// 항목4(b) — 홈 "이번 달 추천 30" 섹션 안 compact 1줄 섹터 분포 (Server Component).
// 라벨 고정 "추천 30 섹터 분포"(보유 섹터 분포로 오해 방지) + 상위 5개 + 기타.
// short_list_30 각 행 sector 태그로 집계(신규 파이프라인 불필요).

interface SectorDistributionLineProps {
  /** short_list_30 활성 종목의 sector 태그 목록 */
  sectors: readonly (string | null | undefined)[];
}

function Chip({ item }: { item: SectorCount }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <span className="font-medium text-foreground">{item.sector}</span>
      <span className="font-mono tabular-nums">{item.count}</span>
    </span>
  );
}

export function SectorDistributionLine({
  sectors,
}: SectorDistributionLineProps) {
  const dist = aggregateSectorDistribution(sectors, 5);
  if (dist.total === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">
        추천 30 섹터 분포
      </span>
      {dist.top.map((item) => (
        <Chip key={item.sector} item={item} />
      ))}
      {dist.otherCount > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">기타</span>
          <span className="font-mono tabular-nums">{dist.otherCount}</span>
        </span>
      ) : null}
    </div>
  );
}
