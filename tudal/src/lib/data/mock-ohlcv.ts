// 삼성전자 OHLCV 일봉 데이터 (최근 120일)
export interface OHLCV {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// 시드 기반 간단한 랜덤 생성 (재현 가능)
function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateOHLCV(ticker: string, basePrice: number, days: number): OHLCV[] {
  const data: OHLCV[] = [];
  let price = basePrice;
  const startDate = new Date("2025-11-01");

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    // 주말 건너뛰기
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const seed = i * 137 + ticker.charCodeAt(0);
    const change = (seededRandom(seed) - 0.48) * price * 0.03;
    const volatility = seededRandom(seed + 1) * price * 0.02;

    const open = Math.round(price);
    price = price + change;
    const close = Math.round(price);
    const high = Math.round(Math.max(open, close) + volatility);
    const low = Math.round(Math.min(open, close) - volatility * 0.8);
    const volume = Math.round(8_000_000 + seededRandom(seed + 2) * 15_000_000);

    data.push({
      date: date.toISOString().slice(0, 10),
      open,
      high,
      low,
      close: Math.max(close, 1000),
      volume,
    });

    price = Math.max(price, basePrice * 0.6);
    price = Math.min(price, basePrice * 1.5);
  }

  return data;
}

export const SAMSUNG_OHLCV = generateOHLCV("005930", 55000, 180);

// 이동평균 계산
export function calcMA(data: OHLCV[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return Math.round(slice.reduce((sum, d) => sum + d.close, 0) / period);
  });
}

// 볼린저밴드 계산
export function calcBollingerBands(data: OHLCV[], period: number = 20, multiplier: number = 2) {
  const ma = calcMA(data, period);
  return data.map((_, i) => {
    if (i < period - 1 || ma[i] === null) return { upper: null, middle: null, lower: null };
    const slice = data.slice(i - period + 1, i + 1);
    const mean = ma[i]!;
    const variance = slice.reduce((sum, d) => sum + Math.pow(d.close - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    return {
      upper: Math.round(mean + multiplier * stdDev),
      middle: mean,
      lower: Math.round(mean - multiplier * stdDev),
    };
  });
}
