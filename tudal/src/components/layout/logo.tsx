import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  variant?: "default" | "mono" | "white";
  className?: string;
}

const SIZE_MAP = {
  sm: { mark: 24, text: "text-base" },
  md: { mark: 32, text: "text-xl" },
  lg: { mark: 40, text: "text-2xl" },
  xl: { mark: 56, text: "text-4xl" },
};

export function JoopickLogo({
  size = "md",
  showWordmark = true,
  variant = "default",
  className,
}: LogoProps) {
  const { mark, text } = SIZE_MAP[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LogoMark size={mark} variant={variant} />
      {showWordmark && (
        <span className={cn("font-bold tracking-tight", text)}>주픽</span>
      )}
    </div>
  );
}

/**
 * JooPick Logo Mark
 *
 * 컨셉: "여러 종목 중 PICK"
 * - 빨간 배경 (한국 상승장 컬러)
 * - 3개의 상승 캔들 (좌 → 우로 성장)
 * - 가장 큰 우측 캔들 = PICK된 종목
 *   ├ 하이라이트 링으로 강조
 *   └ 상단에 스파클(✦) = 선택된 종목 / 별처럼 빛남
 * - 좌측 2개 캔들은 대비를 위해 낮은 opacity
 */
function LogoMark({
  size,
  variant,
}: {
  size: number;
  variant: "default" | "mono" | "white";
}) {
  const bgColor =
    variant === "mono"
      ? "currentColor"
      : variant === "white"
      ? "#ffffff"
      : "#dc2626"; // red-600 (한국 상승장)

  const candleColor = variant === "white" ? "#dc2626" : "#ffffff";
  const pickedColor = variant === "white" ? "#facc15" : "#facc15"; // yellow-400 (스파클)
  const ringColor = variant === "white" ? "#dc2626" : "#facc15";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="주픽 로고"
    >
      {/* 배경 라운드 사각형 */}
      <rect x="2" y="2" width="36" height="36" rx="9" fill={bgColor} />

      {/* 캔들 1 — 작은 상승 (배경) */}
      <g opacity="0.4">
        <line x1="9.5" y1="20" x2="9.5" y2="22" stroke={candleColor} strokeWidth="1" strokeLinecap="round" />
        <line x1="9.5" y1="28" x2="9.5" y2="30" stroke={candleColor} strokeWidth="1" strokeLinecap="round" />
        <rect x="7.75" y="22" width="3.5" height="6" rx="0.5" fill={candleColor} />
      </g>

      {/* 캔들 2 — 중간 상승 (배경) */}
      <g opacity="0.6">
        <line x1="16" y1="15" x2="16" y2="17" stroke={candleColor} strokeWidth="1" strokeLinecap="round" />
        <line x1="16" y1="27" x2="16" y2="29" stroke={candleColor} strokeWidth="1" strokeLinecap="round" />
        <rect x="14.25" y="17" width="3.5" height="10" rx="0.5" fill={candleColor} />
      </g>

      {/* 캔들 3 — PICK된 종목 (가장 큰 상승, 하이라이트) */}
      <g>
        {/* 하이라이트 링 (노란) */}
        <rect
          x="20.5"
          y="9.5"
          width="9"
          height="21"
          rx="2.5"
          fill="none"
          stroke={ringColor}
          strokeWidth="1.2"
          strokeDasharray="0"
          opacity="0.6"
        />

        {/* 위꼬리 */}
        <line x1="25" y1="11" x2="25" y2="13" stroke={candleColor} strokeWidth="1.2" strokeLinecap="round" />
        {/* 아래꼬리 */}
        <line x1="25" y1="27" x2="25" y2="29" stroke={candleColor} strokeWidth="1.2" strokeLinecap="round" />
        {/* 몸통 */}
        <rect x="22.75" y="13" width="4.5" height="14" rx="0.8" fill={candleColor} />
      </g>

      {/* ✦ 스파클 (PICK 표시) — 우측 상단 */}
      <g transform="translate(30, 9)">
        {/* 4점 별 */}
        <path
          d="M 0 -5 L 1.2 -1.2 L 5 0 L 1.2 1.2 L 0 5 L -1.2 1.2 L -5 0 L -1.2 -1.2 Z"
          fill={pickedColor}
        />
      </g>

      {/* 작은 스파클 2개 */}
      <circle cx="34" cy="14" r="0.9" fill={pickedColor} opacity="0.8" />
      <circle cx="33" cy="6" r="0.7" fill={pickedColor} opacity="0.6" />
    </svg>
  );
}

/**
 * 단독 마크만 사용할 때
 */
export function JoopickMark({
  size = 32,
  variant = "default",
}: {
  size?: number;
  variant?: "default" | "mono" | "white";
}) {
  return <LogoMark size={size} variant={variant} />;
}
