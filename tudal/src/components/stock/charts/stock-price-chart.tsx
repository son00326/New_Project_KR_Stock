"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { LineChart as LineChartIcon, CandlestickChart, AreaChart as AreaChartIcon } from "lucide-react";
import { SAMSUNG_OHLCV, calcMA, calcBollingerBands } from "@/lib/data/mock-ohlcv";
import { chartColor, CHART_UP, CHART_DOWN, CHART_GRID, CHART_AXIS, CHART_LABEL } from "@/lib/chart-colors";

interface StockPriceChartProps {
  ticker: string;
}

type Period = "1m" | "3m" | "6m" | "1y";
type ChartType = "line" | "candle" | "area";

const PERIOD_LABELS: Record<Period, string> = { "1m": "1개월", "3m": "3개월", "6m": "6개월", "1y": "1년" };
const PERIOD_DAYS: Record<Period, number> = { "1m": 22, "3m": 65, "6m": 130, "1y": 250 };
const CHART_TYPE_LABELS: Record<ChartType, { label: string; icon: typeof LineChartIcon }> = {
  candle: { label: "캔들", icon: CandlestickChart },
  line: { label: "라인", icon: LineChartIcon },
  area: { label: "영역", icon: AreaChartIcon },
};

interface Indicator { key: string; label: string; active: boolean; }

const subscribeNoop = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function StockPriceChart({ ticker }: StockPriceChartProps) {
  const mounted = useSyncExternalStore(
    subscribeNoop,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [period, setPeriod] = useState<Period>("3m");
  const [chartType, setChartType] = useState<ChartType>("candle");
  const [indicators, setIndicators] = useState<Indicator[]>([
    { key: "ma5", label: "MA5", active: true },
    { key: "ma20", label: "MA20", active: true },
    { key: "ma60", label: "MA60", active: false },
    { key: "ma120", label: "MA120", active: false },
    { key: "bb", label: "볼린저밴드", active: true },
  ]);

  const allData = useMemo(() => (ticker === "005930" ? SAMSUNG_OHLCV : []), [ticker]);

  const data = useMemo(() => {
    const days = PERIOD_DAYS[period];
    const sliced = allData.slice(-days);
    const ma5 = calcMA(allData, 5).slice(-days);
    const ma20 = calcMA(allData, 20).slice(-days);
    const ma60 = calcMA(allData, 60).slice(-days);
    const ma120 = calcMA(allData, 120).slice(-days);
    const bb = calcBollingerBands(allData, 20, 2).slice(-days);

    return sliced.map((d, i) => ({
      date: d.date.slice(5),
      fullDate: d.date,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
      isUp: d.close >= d.open,
      // 캔들 바용: [low, high]
      candleRange: [d.low, d.high],
      ma5: ma5[i], ma20: ma20[i], ma60: ma60[i], ma120: ma120[i],
      bbUpper: bb[i].upper, bbMiddle: bb[i].middle, bbLower: bb[i].lower,
      bbRange: bb[i].upper && bb[i].lower ? [bb[i].lower, bb[i].upper] : undefined,
    }));
  }, [allData, period]);

  function toggleIndicator(key: string) {
    setIndicators((prev) => prev.map((ind) => (ind.key === key ? { ...ind, active: !ind.active } : ind)));
  }
  const isActive = (key: string) => indicators.find((i) => i.key === key)?.active ?? false;

  if (allData.length === 0) {
    return <div className="text-center py-8 text-sm text-muted-foreground">차트 데이터는 연동 후 제공됩니다.</div>;
  }

  const latestPrice = data[data.length - 1]?.close ?? 0;
  const firstPrice = data[0]?.close ?? 0;
  const priceChange = latestPrice - firstPrice;
  const priceChangePercent = ((priceChange / firstPrice) * 100).toFixed(2);

  const allPrices = data.flatMap((d) => [d.high, d.low, d.bbUpper, d.bbLower].filter(Boolean) as number[]);
  const yMin = Math.floor(Math.min(...allPrices) * 0.98 / 1000) * 1000;
  const yMax = Math.ceil(Math.max(...allPrices) * 1.02 / 1000) * 1000;

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-full rounded bg-muted/30" />
        <div className="h-6 w-2/3 rounded bg-muted/30" />
        <div className="h-[400px] rounded bg-muted/20" />
        <div className="h-[100px] rounded bg-muted/20" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 컨트롤 바 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          {/* 차트 타입 */}
          <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
            {(Object.keys(CHART_TYPE_LABELS) as ChartType[]).map((ct) => {
              const { label, icon: Icon } = CHART_TYPE_LABELS[ct];
              return (
                <button
                  key={ct}
                  onClick={() => setChartType(ct)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    chartType === ct ? "bg-background text-foreground shadow-toss-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={label}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              );
            })}
          </div>

          {/* 기간 */}
          <div className="flex items-center gap-0.5">
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  period === p ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>

        {/* 기간 수익률 */}
        <span className={`text-sm font-semibold tabular-nums ${priceChange >= 0 ? "text-market-up" : "text-market-down"}`}>
          {PERIOD_LABELS[period]} {priceChange >= 0 ? "+" : ""}{priceChange.toLocaleString()}원 ({priceChange >= 0 ? "+" : ""}{priceChangePercent}%)
        </span>
      </div>

      {/* 보조지표 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">보조지표:</span>
        {indicators.map((ind) => {
          const colors: Record<string, string> = { ma5: "bg-market-up", ma20: "bg-market-down", ma60: "bg-chart-3", ma120: "bg-chart-4", bb: "bg-chart-5" };
          return (
            <button
              key={ind.key}
              onClick={() => toggleIndicator(ind.key)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                ind.active ? "bg-muted text-foreground ring-1 ring-primary/30" : "bg-muted/50 text-muted-foreground"
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${colors[ind.key]} ${ind.active ? "opacity-100" : "opacity-30"}`} />
              {ind.label}
            </button>
          );
        })}
      </div>

      {/* 메인 차트 */}
      <div className="h-[400px] min-h-[400px] min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <ComposedChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: CHART_AXIS }} tickLine={false} interval={Math.floor(data.length / 8)} />
            <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10, fill: CHART_AXIS }} tickLine={false} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} width={45} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]?.payload;
                if (!d) return null;
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-toss-md text-xs space-y-1">
                    <p className="font-semibold">{d.fullDate}</p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
                      <span className="text-muted-foreground">시가</span><span className="text-right">{d.open?.toLocaleString()}</span>
                      <span className="text-muted-foreground">고가</span><span className="text-right text-market-up">{d.high?.toLocaleString()}</span>
                      <span className="text-muted-foreground">저가</span><span className="text-right text-market-down">{d.low?.toLocaleString()}</span>
                      <span className="text-muted-foreground">종가</span><span className={`text-right font-semibold ${d.isUp ? "text-market-up" : "text-market-down"}`}>{d.close?.toLocaleString()}</span>
                      <span className="text-muted-foreground">거래량</span><span className="text-right">{d.volume?.toLocaleString()}</span>
                    </div>
                    {d.bbUpper && isActive("bb") && (
                      <div className="border-t pt-1 mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 tabular-nums">
                        <span className="text-muted-foreground">BB상단</span><span className="text-right">{d.bbUpper?.toLocaleString()}</span>
                        <span className="text-muted-foreground">BB하단</span><span className="text-right">{d.bbLower?.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* 볼린저밴드 영역 */}
            {isActive("bb") && (
              <Area type="monotone" dataKey="bbRange" fill={chartColor(4)} fillOpacity={0.08} stroke="none" />
            )}
            {isActive("bb") && (
              <>
                <Line type="monotone" dataKey="bbUpper" stroke={chartColor(4)} strokeWidth={1} strokeDasharray="4 2" dot={false} />
                <Line type="monotone" dataKey="bbLower" stroke={chartColor(4)} strokeWidth={1} strokeDasharray="4 2" dot={false} />
              </>
            )}

            {/* 이동평균선 */}
            {isActive("ma5") && <Line type="monotone" dataKey="ma5" stroke={CHART_UP} strokeWidth={1.2} dot={false} />}
            {isActive("ma20") && <Line type="monotone" dataKey="ma20" stroke={CHART_DOWN} strokeWidth={1.2} dot={false} />}
            {isActive("ma60") && <Line type="monotone" dataKey="ma60" stroke={chartColor(2)} strokeWidth={1.2} dot={false} />}
            {isActive("ma120") && <Line type="monotone" dataKey="ma120" stroke={chartColor(3)} strokeWidth={1.2} dot={false} />}

            {/* 캔들 차트 */}
            {chartType === "candle" && (
              <Bar dataKey="candleRange" barSize={Math.max(3, Math.min(10, 400 / data.length))} isAnimationActive={false}>
                {data.map((entry, index) => (
                  <Cell
                    key={`candle-${index}`}
                    fill={entry.isUp ? CHART_UP : CHART_DOWN}
                    stroke={entry.isUp ? CHART_UP : CHART_DOWN}
                    strokeWidth={1}
                  />
                ))}
              </Bar>
            )}

            {/* 라인 차트 */}
            {chartType === "line" && (
              <Line type="monotone" dataKey="close" stroke={CHART_LABEL} strokeWidth={1.8} dot={false} />
            )}

            {/* 영역 차트 */}
            {chartType === "area" && (
              <Area
                type="monotone"
                dataKey="close"
                stroke={CHART_LABEL}
                strokeWidth={1.5}
                fill={CHART_LABEL}
                fillOpacity={0.08}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 거래량 차트 */}
      <div className="h-[100px] min-h-[100px] min-w-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          <ComposedChart data={data} margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
            <XAxis dataKey="date" tick={false} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 9, fill: CHART_AXIS }} tickLine={false} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`} width={45} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="rounded-lg border bg-background px-2 py-1 shadow-toss-sm text-xs tabular-nums">
                    {d.fullDate} 거래량: {d.volume?.toLocaleString()}주
                  </div>
                );
              }}
            />
            <Bar dataKey="volume" radius={[1, 1, 0, 0]} isAnimationActive={false}>
              {data.map((entry, index) => (
                <Cell key={`vol-${index}`} fill={entry.isUp ? CHART_UP : CHART_DOWN} fillOpacity={0.5} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 범례 */}
      <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground border-t pt-3">
        {chartType === "candle" && (
          <>
            <span className="flex items-center gap-1"><span className="h-3 w-2 bg-market-up inline-block rounded-sm" /> 양봉 (상승)</span>
            <span className="flex items-center gap-1"><span className="h-3 w-2 bg-market-down inline-block rounded-sm" /> 음봉 (하락)</span>
          </>
        )}
        {chartType === "line" && <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-foreground inline-block" /> 종가</span>}
        {chartType === "area" && <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-foreground inline-block" /> 종가 영역</span>}
        {isActive("ma5") && <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-market-up inline-block" /> MA5</span>}
        {isActive("ma20") && <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-market-down inline-block" /> MA20</span>}
        {isActive("ma60") && <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-chart-3 inline-block" /> MA60</span>}
        {isActive("ma120") && <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-chart-4 inline-block" /> MA120</span>}
        {isActive("bb") && <span className="flex items-center gap-1"><span className="h-0.5 w-4 bg-chart-5 inline-block" /> BB(20,2)</span>}
      </div>
    </div>
  );
}
