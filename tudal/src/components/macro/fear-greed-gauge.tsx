"use client";

interface FearGreedGaugeProps {
  value: number; // 0~100
}

function getZoneInfo(value: number) {
  if (value <= 20) return { label: "극단적 공포", color: "text-market-down", bg: "bg-market-down" };
  if (value <= 40) return { label: "공포", color: "text-market-down", bg: "bg-chart-1" };
  if (value <= 60) return { label: "중립", color: "text-warning", bg: "bg-chart-5" };
  if (value <= 80) return { label: "탐욕", color: "text-market-up", bg: "bg-market-up" };
  return { label: "극단적 탐욕", color: "text-market-up", bg: "bg-destructive" };
}

export function FearGreedGauge({ value }: FearGreedGaugeProps) {
  const zone = getZoneInfo(value);

  return (
    <div className="flex flex-col items-center">
      {/* 게이지 */}
      <div className="relative w-full max-w-[240px] h-[130px]">
        <svg viewBox="0 0 240 130" className="w-full h-full">
          {/* 배경 아크 구간 */}
          <path
            d="M 20 120 A 100 100 0 0 1 60 37"
            fill="none"
            stroke="var(--market-down)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M 63 35 A 100 100 0 0 1 110 22"
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M 113 21 A 100 100 0 0 1 140 21"
            fill="none"
            stroke="var(--chart-5)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M 143 22 A 100 100 0 0 1 185 38"
            fill="none"
            stroke="var(--market-up)"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d="M 188 40 A 100 100 0 0 1 220 120"
            fill="none"
            stroke="var(--destructive)"
            strokeWidth="16"
            strokeLinecap="round"
          />

          {/* 바늘 */}
          {(() => {
            const angle = -180 + (value / 100) * 180;
            const rad = (angle * Math.PI) / 180;
            const cx = 120;
            const cy = 120;
            const needleLen = 75;
            const nx = cx + needleLen * Math.cos(rad);
            const ny = cy + needleLen * Math.sin(rad);
            return (
              <>
                <line
                  x1={cx}
                  y1={cy}
                  x2={nx}
                  y2={ny}
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="text-foreground"
                />
                <circle cx={cx} cy={cy} r="6" className="fill-foreground" />
              </>
            );
          })()}
        </svg>
      </div>

      {/* 수치 */}
      <div className="text-center mt-2">
        <span className={`text-4xl font-bold tabular-nums ${zone.color}`}>{value}</span>
        <p className={`text-sm font-semibold mt-1 ${zone.color}`}>
          {zone.label}
        </p>
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-1 mt-4 text-xs text-muted-foreground tabular-nums">
        <span>0</span>
        <div className="flex flex-1 h-2 rounded-full overflow-hidden">
          <div className="flex-1 bg-market-down" />
          <div className="flex-1 bg-chart-1" />
          <div className="flex-1 bg-chart-5" />
          <div className="flex-1 bg-market-up" />
          <div className="flex-1 bg-destructive" />
        </div>
        <span>100</span>
      </div>
      <div className="flex justify-between w-full text-xs text-muted-foreground mt-1 px-2">
        <span>극단적 공포</span>
        <span>극단적 탐욕</span>
      </div>
    </div>
  );
}
