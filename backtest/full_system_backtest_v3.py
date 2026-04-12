"""
주픽(JooPick) 전체 자동화 시스템 백테스트 v3
=============================================
핵심 변경: 공격적 포지셔닝 (풀 투자 기본, 위기 시에만 축소)
목표: 월간 Win Rate 70%+ / 삼성전자 B&H CAGR beat

v2 대비 변경:
- Crisis Layer: 풀 투자 기본, 실제 위기 시에만 축소
- 레짐 감지: MA+모멘텀 복합 (sideways 과다 분류 해소)
- 축별 완전 분화: 주기/팩터/손절 차별화
- 부분 리밸런싱: 유지 종목 거래 안 함
- 손절 -12% / 익절 +30% (한국시장 변동성 고려)
- 모멘텀+수급 팩터 최적화 (한국시장 Win Rate 검증)
"""

import sys, warnings, time
warnings.filterwarnings('ignore')
from datetime import datetime
import pandas as pd
import numpy as np
from pykrx import stock as krx


# ============================================================
# 1. 데이터 수집
# ============================================================

def fetch_stock_data(ticker: str, start: str, end: str) -> pd.DataFrame:
    try:
        df = krx.get_market_ohlcv(start, end, ticker)
        if len(df) < 60:
            return None

        df.columns = ['open', 'high', 'low', 'close', 'volume', 'change']
        df['return'] = df['close'].pct_change()
        df['ma5'] = df['close'].rolling(5).mean()
        df['ma20'] = df['close'].rolling(20).mean()
        df['ma60'] = df['close'].rolling(60).mean()
        df['ma120'] = df['close'].rolling(120).mean()
        df['ma200'] = df['close'].rolling(200).mean()

        # RSI 14
        delta = df['close'].diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss.replace(0, np.nan)
        df['rsi'] = 100 - (100 / (1 + rs))

        # 변동성
        df['vol_20'] = df['return'].rolling(20).std() * np.sqrt(252) * 100
        df['vol_pct'] = df['vol_20'].rolling(252, min_periods=60).apply(
            lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, raw=False
        )

        # 모멘텀 (복수 기간)
        df['mom_5'] = df['close'].pct_change(5)
        df['mom_10'] = df['close'].pct_change(10)
        df['mom_20'] = df['close'].pct_change(20)
        df['mom_60'] = df['close'].pct_change(60)

        # 볼린저밴드
        df['bb_mid'] = df['close'].rolling(20).mean()
        df['bb_std'] = df['close'].rolling(20).std()
        df['bb_upper'] = df['bb_mid'] + 2 * df['bb_std']
        df['bb_lower'] = df['bb_mid'] - 2 * df['bb_std']
        bw = (df['bb_upper'] - df['bb_lower']).replace(0, 1)
        df['bb_position'] = (df['close'] - df['bb_lower']) / bw

        # 거래량 비율 (수급 proxy)
        df['vol_ma5'] = df['volume'].rolling(5).mean()
        df['vol_ma20'] = df['volume'].rolling(20).mean()
        df['vol_ratio'] = df['vol_ma5'] / df['vol_ma20'].replace(0, 1)

        # 5일 연속 수급 (외국인 proxy)
        df['vol_trend'] = df['volume'].rolling(5).apply(
            lambda x: sum(1 for i in range(1, len(x)) if x.iloc[i] > x.iloc[i-1]) / 4,
            raw=False
        )

        df['ticker'] = ticker
        return df
    except:
        return None


# ============================================================
# 2. 동적 유니버스
# ============================================================

def get_dynamic_universe(date_str: str) -> dict:
    try:
        kospi_caps = krx.get_market_cap(date_str, market="KOSPI")
        kospi_top = kospi_caps.nlargest(25, '시가총액').index.tolist()

        kosdaq_caps = krx.get_market_cap(date_str, market="KOSDAQ")
        kosdaq_top = kosdaq_caps.nlargest(15, '시가총액').index.tolist()

        return {
            'short_term': kosdaq_top[:10] + kospi_top[15:25],
            'mid_term': kospi_top[:20],
            'long_term': kospi_top[:10],
            'all': list(set(kospi_top + kosdaq_top)),
        }
    except:
        return None


# ============================================================
# 3. Factor Scoring (축별 차별화 + 한국시장 최적화)
# ============================================================

AXIS_WEIGHTS = {
    'short_term': {  # 모멘텀 + 수급 (한국시장 승률 1위)
        'momentum': 0.35, 'flow': 0.30, 'quality': 0.15,
        'low_vol': 0.10, 'value': 0.10
    },
    'mid_term': {  # 균형 멀티팩터
        'momentum': 0.20, 'flow': 0.25, 'quality': 0.25,
        'value': 0.20, 'low_vol': 0.10
    },
    'long_term': {  # 밸류 + 퀄리티
        'value': 0.35, 'quality': 0.30, 'low_vol': 0.20,
        'momentum': 0.10, 'flow': 0.05
    },
}


def compute_factors(stock_data: dict, date, axis: str) -> pd.DataFrame:
    """축별 최적화된 팩터 계산"""
    records = []
    weights = AXIS_WEIGHTS[axis]

    for ticker, df in stock_data.items():
        if df is None:
            continue

        valid_dates = df.index[df.index <= date]
        if len(valid_dates) == 0:
            continue
        idx = df.index.get_loc(valid_dates[-1])
        if idx < 120:
            continue

        row = df.iloc[idx]

        # 1. Momentum (축별 다른 lookback)
        if axis == 'short_term':
            # 단기: 최근 5-20일 모멘텀 중시
            m5 = row.get('mom_5', 0)
            m10 = row.get('mom_10', 0)
            m20 = row.get('mom_20', 0)
            for v in [m5, m10, m20]:
                if pd.isna(v): v = 0
            if pd.isna(m5): m5 = 0
            if pd.isna(m10): m10 = 0
            if pd.isna(m20): m20 = 0
            momentum = m5 * 0.4 + m10 * 0.35 + m20 * 0.25
        elif axis == 'mid_term':
            # 중기: 20-60일 모멘텀
            m20 = row.get('mom_20', 0)
            m60 = row.get('mom_60', 0)
            if pd.isna(m20): m20 = 0
            if pd.isna(m60): m60 = 0
            momentum = m20 * 0.5 + m60 * 0.5
        else:
            # 장기: 60일 모멘텀 (안정적 상승)
            m60 = row.get('mom_60', 0)
            if pd.isna(m60): m60 = 0
            momentum = m60

        # 2. Value (12M 저점 대비 위치)
        low_12m = df['close'].iloc[max(0, idx-252):idx+1].min()
        val_score = 1 - (row['close'] - low_12m) / max(row['close'], 1)

        # 3. Quality (변동성 안정성)
        ret_std = df['return'].iloc[max(0, idx-60):idx+1].std()
        quality = 1 / (ret_std * np.sqrt(252) + 0.01)

        # 4. Low Volatility
        vol = row.get('vol_20', 30)
        if pd.isna(vol): vol = 30
        low_vol = 1 / (vol + 1)

        # 5. Flow (수급 - 거래량 트렌드 + 비율)
        vol_ratio = row.get('vol_ratio', 1)
        vol_trend = row.get('vol_trend', 0.5)
        if pd.isna(vol_ratio): vol_ratio = 1
        if pd.isna(vol_trend): vol_trend = 0.5
        flow = (vol_ratio - 1) * 0.6 + (vol_trend - 0.5) * 2 * 0.4

        # RSI (필터용)
        rsi = row.get('rsi', 50)
        if pd.isna(rsi): rsi = 50

        records.append({
            'ticker': ticker,
            'momentum': momentum if not pd.isna(momentum) else 0,
            'value': val_score if not pd.isna(val_score) else 0,
            'quality': quality if not pd.isna(quality) else 0,
            'low_vol': low_vol if not pd.isna(low_vol) else 0,
            'flow': flow if not pd.isna(flow) else 0,
            'close': row['close'],
            'rsi': rsi,
            'mom_20': row.get('mom_20', 0) if not pd.isna(row.get('mom_20', 0)) else 0,
        })

    if not records:
        return pd.DataFrame()

    fdf = pd.DataFrame(records)
    for col in ['momentum', 'value', 'quality', 'low_vol', 'flow']:
        if fdf[col].std() > 0:
            fdf[f'{col}_z'] = (fdf[col] - fdf[col].mean()) / fdf[col].std()
        else:
            fdf[f'{col}_z'] = 0

    # 축별 종합 점수
    score = pd.Series(0.0, index=fdf.index)
    for factor, w in weights.items():
        col = f'{factor}_z'
        if col in fdf.columns:
            score += fdf[col] * w
    fdf['total_score'] = score

    return fdf


# ============================================================
# 4. Quant Board 투표 (10명, 적응적 임계값)
# ============================================================

QUANT_BOARD = [
    # 모멘텀/추세 (3)
    {'name': 'Simons',  'w': {'momentum_z': 0.40, 'flow_z': 0.25, 'quality_z': 0.15, 'low_vol_z': 0.10, 'value_z': 0.10}},
    {'name': 'Harding', 'w': {'momentum_z': 0.50, 'flow_z': 0.20, 'quality_z': 0.10, 'low_vol_z': 0.10, 'value_z': 0.10}},
    {'name': 'Brown',   'w': {'flow_z': 0.35, 'momentum_z': 0.30, 'quality_z': 0.15, 'value_z': 0.10, 'low_vol_z': 0.10}},
    # 밸류/품질 (3)
    {'name': 'Thorp',   'w': {'value_z': 0.35, 'quality_z': 0.30, 'low_vol_z': 0.15, 'momentum_z': 0.10, 'flow_z': 0.10}},
    {'name': '문병로',  'w': {'value_z': 0.40, 'quality_z': 0.25, 'low_vol_z': 0.15, 'momentum_z': 0.10, 'flow_z': 0.10}},
    {'name': 'Asness',  'w': {'momentum_z': 0.25, 'value_z': 0.25, 'quality_z': 0.25, 'low_vol_z': 0.15, 'flow_z': 0.10}},
    # 리스크 (2)
    {'name': 'Taleb',   'w': {'low_vol_z': 0.40, 'quality_z': 0.30, 'value_z': 0.15, 'momentum_z': 0.10, 'flow_z': 0.05}},
    {'name': 'Dalio',   'w': {'low_vol_z': 0.30, 'quality_z': 0.25, 'momentum_z': 0.20, 'value_z': 0.15, 'flow_z': 0.10}},
    # 적응적 (2)
    {'name': 'Lo',      'w': {'flow_z': 0.25, 'momentum_z': 0.25, 'quality_z': 0.20, 'low_vol_z': 0.15, 'value_z': 0.15}},
    {'name': 'Griffin', 'w': {'momentum_z': 0.30, 'flow_z': 0.25, 'quality_z': 0.20, 'value_z': 0.15, 'low_vol_z': 0.10}},
]


def board_vote(factors_df: pd.DataFrame, top_n: int = 5) -> list:
    if factors_df.empty or len(factors_df) < 3:
        return []

    fdf = factors_df.copy()
    n_candidates = len(fdf)
    pick_n = min(top_n, n_candidates)

    # Board 투표
    votes = pd.DataFrame(0, index=fdf.index,
                         columns=[m['name'] for m in QUANT_BOARD])
    for member in QUANT_BOARD:
        score = sum(fdf[col] * w for col, w in member['w'].items()
                    if col in fdf.columns)
        top_idx = score.nlargest(pick_n).index
        votes.loc[top_idx, member['name']] = 1

    vote_pct = votes.sum(axis=1) / len(QUANT_BOARD)

    # 적응적 임계값: 후보 적으면 완화
    threshold = 0.70
    consensus = vote_pct[vote_pct >= threshold]
    if consensus.empty:
        threshold = 0.60
        consensus = vote_pct[vote_pct >= threshold]

    selected = []
    for idx in consensus.index:
        row = fdf.loc[idx]
        rsi = row.get('rsi', 50)
        # 과매수(>78) 단기 진입 제한
        selected.append({
            'ticker': row['ticker'],
            'score': row['total_score'],
            'vote_pct': vote_pct.loc[idx],
            'close': row['close'],
            'rsi': rsi,
        })

    selected.sort(key=lambda x: x['score'], reverse=True)
    return selected[:top_n]


# ============================================================
# 5. 레짐 감지 (개선: 복합 신호)
# ============================================================

def detect_regime(row):
    """복합 레짐 감지: MA 다중 + 모멘텀 + RSI"""
    close = row['close']
    ma20 = row.get('ma20', close)
    ma60 = row.get('ma60', close)
    ma200 = row.get('ma200', close)
    mom20 = row.get('mom_20', 0)
    mom60 = row.get('mom_60', 0)
    rsi = row.get('rsi', 50)

    for v in [ma20, ma60, ma200, mom20, mom60, rsi]:
        if pd.isna(v): return 'sideways'

    bull_signals = 0
    bear_signals = 0

    # MA 구조
    if close > ma20: bull_signals += 1
    else: bear_signals += 1
    if close > ma60: bull_signals += 1
    else: bear_signals += 1
    if close > ma200: bull_signals += 1
    else: bear_signals += 1
    if ma20 > ma60: bull_signals += 1
    else: bear_signals += 1

    # 모멘텀
    if mom20 > 0.02: bull_signals += 1
    elif mom20 < -0.02: bear_signals += 1
    if mom60 > 0.03: bull_signals += 1
    elif mom60 < -0.03: bear_signals += 1

    # RSI
    if rsi > 55: bull_signals += 0.5
    elif rsi < 40: bear_signals += 0.5

    if bull_signals >= 5:
        return 'bull'
    elif bear_signals >= 5:
        return 'bear'
    return 'sideways'


# ============================================================
# 6. Crisis Layer v3 (공격적 기본, 위기 시에만 축소)
# ============================================================

class CrisisLayer:
    """
    v3 핵심: 풀 투자가 기본. 위기 시에만 포지션 축소.
    - Bull: 100% (변동성 높아도 유지)
    - Sideways: 90%
    - Bear: 70% (변동성에 따라 추가 축소)
    - Crash: 즉시 15%로 축소, 점진 복귀
    """

    def __init__(self, initial_capital):
        self.position = 1.0
        self.peak = initial_capital
        self.in_crisis = False
        self.reentry_step = 0
        self.crisis_peak_vol = 0
        self.days_reentry = 0
        self.consecutive_loss_days = 0

    def update(self, vol_pct, daily_ret, port_val, regime, rsi=50):
        if pd.isna(vol_pct): vol_pct = 50
        if pd.isna(rsi): rsi = 50
        if port_val > self.peak: self.peak = port_val

        # 연속 하락일 추적
        if daily_ret < -0.005:
            self.consecutive_loss_days += 1
        else:
            self.consecutive_loss_days = 0

        # === 크래시 감지 ===
        if daily_ret < -0.06:
            self.in_crisis = True
            self.reentry_step = 0
            self.crisis_peak_vol = vol_pct
            self.position = 0.15
            return self.position

        # 5일 연속 하락 + 큰 폭
        if self.consecutive_loss_days >= 5 and daily_ret < -0.02:
            self.in_crisis = True
            self.reentry_step = 0
            self.crisis_peak_vol = vol_pct
            self.position = 0.30
            return self.position

        # === 기본 포지셔닝: 레짐 기반 ===
        regime_base = {'bull': 1.0, 'sideways': 0.90, 'bear': 0.70}
        target = regime_base.get(regime, 0.90)

        # Bear에서만 변동성 추가 감쇄
        if regime == 'bear':
            if vol_pct > 90: target = min(target, 0.40)
            elif vol_pct > 80: target = min(target, 0.55)

        # RSI 보조
        if rsi < 25 and regime != 'bear':
            target = min(target * 1.15, 1.0)
        elif rsi > 82:
            target = target * 0.90

        # DD 서킷 (매우 보수적 트리거)
        dd = (port_val - self.peak) / self.peak if self.peak > 0 else 0
        if dd < -0.25:
            target = min(target, 0.30)
        elif dd < -0.18:
            target = min(target, 0.50)

        # === 위기 탈출 ===
        if self.in_crisis:
            if self.crisis_peak_vol > 0:
                vol_drop = (self.crisis_peak_vol - vol_pct) / self.crisis_peak_vol
            else:
                vol_drop = 0

            speed = 2 if regime == 'bull' else (4 if regime == 'sideways' else 8)
            steps = [0.35, 0.60, 0.85, 1.00]

            if vol_drop > 0.25 or (regime == 'bull' and vol_drop > 0.15):
                self.days_reentry += 1
                if self.days_reentry >= speed and self.reentry_step < len(steps):
                    target = steps[self.reentry_step]
                    self.reentry_step += 1
                    self.days_reentry = 0
                    if self.reentry_step >= len(steps):
                        self.in_crisis = False
            else:
                target = min(target, 0.20)

        # 변경 속도 제한
        if target < self.position:
            self.position = max(target, self.position - 0.50)  # 빠른 축소
        else:
            self.position = min(target, self.position + 0.25)  # 빠른 복귀

        self.position = max(0.10, min(1.0, self.position))
        return self.position


# ============================================================
# 7. 포트폴리오 (부분 리밸런싱 + 손절/익절)
# ============================================================

class Portfolio:
    def __init__(self, capital):
        self.capital = capital
        self.peak = capital
        self.cash = capital
        self.positions = {}
        self.history = []
        self.trades = 0
        self.total_cost = 0
        self.stop_loss_count = 0
        self.take_profit_count = 0

    def _get_price(self, stock_data, ticker, date):
        if ticker not in stock_data:
            return None
        df = stock_data[ticker]
        if date in df.index:
            return df.loc[date, 'close']
        valid = df.index[df.index <= date]
        if len(valid) == 0:
            return None
        return df.loc[valid[-1], 'close']

    def _sell_position(self, pos_key, stock_data, date):
        """포지션 매도"""
        pos = self.positions[pos_key]
        price = self._get_price(stock_data, pos['ticker'], date)
        if price and price > 0:
            sell_val = pos['shares'] * price
            cost = sell_val * (0.00015 + 0.0023)
            self.cash += sell_val - cost
            self.total_cost += cost
            self.trades += 1
        del self.positions[pos_key]

    def check_stop_loss(self, stock_data, date):
        """손절: 축별 차별화"""
        stop_pcts = {'short_term': -0.10, 'mid_term': -0.12, 'long_term': -0.15}
        to_sell = []
        for pk, pos in self.positions.items():
            price = self._get_price(stock_data, pos['ticker'], date)
            if price and price > 0 and pos['cost'] > 0:
                ret = (price - pos['cost']) / pos['cost']
                stop = stop_pcts.get(pos['axis'], -0.12)
                if ret < stop:
                    to_sell.append(pk)

        for pk in to_sell:
            self._sell_position(pk, stock_data, date)
            self.stop_loss_count += 1

    def check_take_profit(self, stock_data, date):
        """익절: 단기만 적극적, 중장기는 트레일링"""
        take_pcts = {'short_term': 0.20, 'mid_term': 0.30, 'long_term': 0.40}
        for pk in list(self.positions.keys()):
            pos = self.positions[pk]
            price = self._get_price(stock_data, pos['ticker'], date)
            if price and price > 0 and pos['cost'] > 0:
                ret = (price - pos['cost']) / pos['cost']
                take = take_pcts.get(pos['axis'], 0.30)
                if ret > take and pos['shares'] > 1:
                    # 50% 부분 익절
                    sell_shares = pos['shares'] // 2
                    sell_val = sell_shares * price
                    cost = sell_val * (0.00015 + 0.0023)
                    self.cash += sell_val - cost
                    self.total_cost += cost
                    self.trades += 1
                    pos['shares'] -= sell_shares
                    pos['cost'] = price
                    self.take_profit_count += 1

    def rebalance(self, target_tickers: dict, stock_data: dict, date,
                  crisis_pct: float, axis_weights: dict, axes: list):
        """부분 리밸런싱: 변경분만 거래"""
        total_val = self.get_total_value(stock_data, date)
        if total_val <= 0:
            total_val = self.cash

        for axis in axes:
            tickers = target_tickers.get(axis, [])
            target_set = {(t['ticker'] if isinstance(t, dict) else t) for t in tickers}

            # 해당 축의 비-타겟 포지션만 청산
            for pk in list(self.positions.keys()):
                pos = self.positions[pk]
                if pos['axis'] != axis:
                    continue
                if pos['ticker'] not in target_set:
                    self._sell_position(pk, stock_data, date)

            # 신규 진입
            axis_capital = total_val * axis_weights[axis] * crisis_pct
            existing_val = sum(
                pos['shares'] * (self._get_price(stock_data, pos['ticker'], date) or 0)
                for pos in self.positions.values()
                if pos['axis'] == axis
            )
            remaining = max(0, axis_capital - existing_val)
            new_tickers = [t for t in tickers
                           if f"{axis}_{t['ticker'] if isinstance(t, dict) else t}"
                           not in self.positions]
            if not new_tickers or remaining < 100000:
                continue

            per_stock = remaining / len(new_tickers)

            for t_info in new_tickers:
                ticker = t_info['ticker'] if isinstance(t_info, dict) else t_info
                price = self._get_price(stock_data, ticker, date)
                if price is None or price <= 0:
                    continue

                shares = int(per_stock / price)
                if shares <= 0:
                    continue

                cost = shares * price * 0.00015
                total_buy = shares * price + cost
                pk = f"{axis}_{ticker}"

                if total_buy <= self.cash:
                    self.positions[pk] = {
                        'shares': shares, 'cost': price, 'axis': axis,
                        'ticker': ticker, 'entry_date': date
                    }
                    self.cash -= total_buy
                    self.total_cost += cost
                    self.trades += 1

    def get_total_value(self, stock_data, date):
        val = self.cash
        for pk, pos in self.positions.items():
            price = self._get_price(stock_data, pos['ticker'], date)
            if price and price > 0:
                val += pos['shares'] * price
        return val

    def update_history(self, date, stock_data, regime, crisis_pct):
        val = self.get_total_value(stock_data, date)
        if val > self.peak: self.peak = val
        dd = (val - self.peak) / self.peak
        self.history.append({
            'date': date, 'value': val, 'dd': dd,
            'positions': len(self.positions),
            'cash_pct': self.cash / max(val, 1),
            'regime': regime, 'crisis_pct': crisis_pct,
        })


# ============================================================
# 8. 메인 백테스트
# ============================================================

def main():
    print("=" * 80)
    print("  주픽(JooPick) 전체 자동화 시스템 백테스트 v3")
    print("  공격적 포지셔닝 + 3축 완전 분화 + 부분 리밸런싱")
    print("  목표: 월간 WR 70%+ / 삼성전자 B&H beat")
    print("  실행:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 80)

    START = "20190101"
    END = "20260410"
    INITIAL_CAPITAL = 1_000_000_000

    # ---- Step 1: 유니버스 ----
    print("\n[Step 1] 유니버스 구성 중...")
    universe = get_dynamic_universe("20190102")
    if universe is None:
        KOSPI_TOP = ['005930','000660','373220','207940','005380','000270','068270',
                     '035420','005490','055550','035720','012330','105560','028260',
                     '051910','006400','003550','066570','032830','034730',
                     '096770','009150','017670','316140','010130']
        KOSDAQ_TOP = ['247540','086520','091990','196170','263750','035900',
                      '293490','041510','112040','328130','036570','251270',
                      '145020','095340','403870']
        universe = {
            'short_term': KOSDAQ_TOP[:10] + KOSPI_TOP[15:25],
            'mid_term': KOSPI_TOP[:20],
            'long_term': KOSPI_TOP[:10],
            'all': list(set(KOSPI_TOP + KOSDAQ_TOP)),
        }

    all_tickers = universe['all']
    print(f"  → 유니버스: {len(all_tickers)}종목")

    # ---- Step 2: 데이터 ----
    print(f"\n[Step 2] 데이터 수집 중...")
    stock_data = {}
    success = 0
    for i, ticker in enumerate(all_tickers):
        df = fetch_stock_data(ticker, START, END)
        if df is not None and len(df) > 100:
            stock_data[ticker] = df
            success += 1
        if (i + 1) % 10 == 0:
            print(f"  → {i+1}/{len(all_tickers)} 완료 ({success} 성공)")
            time.sleep(1)

    print(f"  → 최종 {success}/{len(all_tickers)} 종목 데이터 확보")

    if success < 10:
        print("❌ 데이터 부족")
        return

    ref = stock_data.get('005930')
    if ref is None:
        print("❌ 삼성전자 데이터 없음")
        return

    # ---- Step 3: 실행 ----
    print("\n[Step 3] 백테스트 실행 중...")

    port = Portfolio(INITIAL_CAPITAL)
    crisis = CrisisLayer(INITIAL_CAPITAL)
    bh_start = ref['close'].iloc[0]

    axis_weights = {'short_term': 0.30, 'mid_term': 0.40, 'long_term': 0.30}
    REBAL_FREQ = {'short_term': 10, 'mid_term': 21, 'long_term': 63}
    last_rebal = {'short_term': 0, 'mid_term': 0, 'long_term': 0}

    prev_quarter = None
    bh_hist = []

    for day_idx, date in enumerate(ref.index):
        row = ref.iloc[day_idx]

        regime = detect_regime(row)
        port_val = port.get_total_value(stock_data, date)
        vol_pct = row.get('vol_pct', 50)
        daily_ret = row.get('return', 0) if not pd.isna(row.get('return', 0)) else 0
        rsi = row.get('rsi', 50) if not pd.isna(row.get('rsi', 50)) else 50
        crisis_pct = crisis.update(vol_pct, daily_ret, port_val, regime, rsi)

        # 일간 손절/익절
        if day_idx > 120 and len(port.positions) > 0:
            port.check_stop_loss(stock_data, date)
            port.check_take_profit(stock_data, date)

        # 분기별 유니버스 재구성
        cq = f"{date.year}Q{(date.month-1)//3+1}"
        if prev_quarter and cq != prev_quarter:
            new_uni = get_dynamic_universe(date.strftime('%Y%m%d'))
            if new_uni:
                universe = new_uni
                for t in universe['all']:
                    if t not in stock_data:
                        df = fetch_stock_data(t, START, END)
                        if df is not None and len(df) > 100:
                            stock_data[t] = df
        prev_quarter = cq

        # 축별 리밸런싱
        if day_idx > 120:
            axes_to_rebal = []
            for axis, freq in REBAL_FREQ.items():
                if day_idx - last_rebal[axis] >= freq:
                    axes_to_rebal.append(axis)

            if axes_to_rebal:
                target = {}
                for axis in axes_to_rebal:
                    axis_uni = universe.get(axis, [])
                    # 해당 유니버스에 있는 종목만 필터
                    axis_tickers = {t for t in axis_uni if t in stock_data}
                    if not axis_tickers:
                        target[axis] = []
                        continue

                    # 축별 팩터 계산
                    factors = compute_factors(
                        {t: stock_data[t] for t in axis_tickers},
                        date, axis
                    )
                    if factors.empty:
                        target[axis] = []
                        continue

                    top_n = {'short_term': 5, 'mid_term': 7, 'long_term': 5}[axis]
                    picks = board_vote(factors, top_n=top_n)

                    # RSI 과매수 필터 (단기만)
                    if axis == 'short_term':
                        picks = [p for p in picks if p.get('rsi', 50) < 78]

                    target[axis] = picks
                    last_rebal[axis] = day_idx

                total_picks = sum(len(v) for v in target.values())
                if total_picks > 0:
                    port.rebalance(target, stock_data, date,
                                   crisis_pct, axis_weights, axes_to_rebal)

                    if date.month in [1, 4, 7, 10] and date.day <= 7:
                        ax_str = '+'.join(a[0] for a in axes_to_rebal)
                        pk_str = '/'.join(str(len(target.get(a, []))) for a in axes_to_rebal)
                        print(f"  [{date.strftime('%Y-%m')}] 리밸런싱({ax_str}): {pk_str} 종목, Crisis {crisis_pct:.0%}, 레짐 {regime}, 포트 {port_val/1e8:.0f}억")

        port.update_history(date, stock_data, regime, crisis_pct)
        bh_hist.append({'date': date, 'value': 100 * (row['close'] / bh_start)})

    # ---- Step 4: 결과 ----
    print("\n[Step 4] 결과 분석 중...")

    mh = pd.DataFrame(port.history)
    bh = pd.DataFrame(bh_hist)

    if mh.empty:
        print("❌ 결과 없음")
        return

    def calc_stats(df, col='value'):
        tot = (df[col].iloc[-1] / df[col].iloc[0] - 1) * 100
        ny = max(len(df) / 252, 0.5)
        cagr = ((df[col].iloc[-1] / df[col].iloc[0]) ** (1/ny) - 1) * 100
        pk = df[col].cummax()
        dd = ((df[col] - pk) / pk).min() * 100
        dr = df[col].pct_change().dropna()
        sharpe = (dr.mean() * 252 - 0.035) / (dr.std() * np.sqrt(252)) if dr.std() > 0 else 0
        calmar = cagr / abs(dd) if dd != 0 else 0
        wr = (dr > 0).sum() / (dr != 0).sum() * 100 if (dr != 0).sum() > 0 else 0
        dc = df.copy()
        dc['m'] = pd.to_datetime(dc['date']).dt.to_period('M')
        mo = dc.groupby('m')[col].apply(lambda x: x.iloc[-1]/x.iloc[0]-1 if len(x) > 1 else 0)
        mwr = (mo > 0).sum() / len(mo) * 100 if len(mo) > 0 else 0
        return {'total': tot, 'cagr': cagr, 'dd': dd, 'sharpe': sharpe,
                'calmar': calmar, 'dwr': wr, 'mwr': mwr}

    ms = calc_stats(mh)
    bs = calc_stats(bh)

    print(f"\n{'='*80}")
    print(f"  3축 통합 백테스트 v3: 2019.01 ~ 2026.04 ({len(mh)}일)")
    print(f"  동적 유니버스 | Board 10명 | Crisis v3 (공격적)")
    print(f"{'='*80}")

    print(f"\n  {'지표':<22} {'B&H(삼성)':>16} {'주픽 v3':>16} {'차이':>14}")
    print(f"  {'-'*68}")
    for label, k, u in [('총 수익률','total','%'),('CAGR','cagr','%'),('Max DD','dd','%')]:
        print(f"  {label:<22} {bs[k]:>+15.1f}{u} {ms[k]:>+15.1f}{u} {ms[k]-bs[k]:>+13.1f}%p")
    for label, k in [('Sharpe','sharpe'),('Calmar','calmar')]:
        print(f"  {label:<22} {bs[k]:>16.2f} {ms[k]:>16.2f} {ms[k]-bs[k]:>+14.2f}")
    for label, k in [('일간 Win Rate','dwr'),('월간 Win Rate','mwr')]:
        print(f"  {label:<22} {bs[k]:>15.1f}% {ms[k]:>15.1f}%")

    print(f"  {'거래 횟수':<22} {'0':>16} {port.trades:>16}")
    print(f"  {'손절 횟수':<22} {'':>16} {port.stop_loss_count:>16}")
    print(f"  {'익절 횟수':<22} {'':>16} {port.take_profit_count:>16}")
    print(f"  {'총 비용':<22} {'':>16} {port.total_cost/1e4:>13,.0f}만원")
    print(f"  {'비용률':<22} {'':>16} {port.total_cost/INITIAL_CAPITAL*100:>15.2f}%")

    # 연도별
    print(f"\n{'='*80}")
    print(f"  연도별 성과")
    print(f"{'='*80}")

    mh['year'] = pd.to_datetime(mh['date']).dt.year
    bh['year'] = pd.to_datetime(bh['date']).dt.year

    print(f"\n  {'연도':<6} {'B&H':>9} {'모델':>9} {'초과':>9} {'B&H DD':>8} {'모델DD':>8} {'월WR':>6} {'Crisis평균':>9} {'레짐':>20}")
    print(f"  {'-'*88}")

    for y in sorted(mh['year'].unique()):
        my = mh[mh['year'] == y]
        by = bh[bh['year'] == y]
        if len(my) < 10: continue

        mr = (my['value'].iloc[-1] / my['value'].iloc[0] - 1) * 100
        br = (by['value'].iloc[-1] / by['value'].iloc[0] - 1) * 100
        mpk = my['value'].cummax()
        mdd = ((my['value'] - mpk) / mpk).min() * 100
        bpk = by['value'].cummax()
        bdd = ((by['value'] - bpk) / bpk).min() * 100

        mc = my.copy()
        mc['m'] = pd.to_datetime(mc['date']).dt.to_period('M')
        mo = mc.groupby('m')['value'].apply(lambda x: x.iloc[-1]/x.iloc[0]-1 if len(x)>1 else 0)
        mwr = (mo > 0).sum() / len(mo) * 100 if len(mo) > 0 else 0
        avg_crisis = my['crisis_pct'].mean() * 100

        rc = my['regime'].value_counts()
        rs = ', '.join(f"{k}:{v}" for k, v in rc.head(2).items())

        print(f"  {y:<6} {br:>+8.1f}% {mr:>+8.1f}% {mr-br:>+8.1f}% {bdd:>+7.1f}% {mdd:>+7.1f}% {mwr:>5.0f}% {avg_crisis:>8.0f}% {rs:>20}")

    # 위기 구간
    print(f"\n{'='*80}")
    print(f"  위기 방어 분석 (주요 하락 구간)")
    print(f"{'='*80}")
    worst = mh.nsmallest(5, 'dd')
    print(f"\n  {'날짜':<12} {'DD':>8} {'포지션':>6} {'현금':>6} {'레짐':>10} {'Crisis':>8}")
    print(f"  {'-'*55}")
    for _, r in worst.iterrows():
        print(f"  {str(r['date'])[:10]:<12} {r['dd']:>+7.1%} {r['positions']:>6} {r['cash_pct']:>5.0%} {r['regime']:>10} {r['crisis_pct']:>7.0%}")

    print(f"\n{'='*80}")
    print(f"  v3 핵심 변경:")
    print(f"  ✓ 공격적 Crisis Layer (Bull 100%, Sideways 90%, Bear 70%)")
    print(f"  ✓ 위기 시에만 축소 (크래시 -6% / 연속하락 5일)")
    print(f"  ✓ 빠른 복귀 (Bull 2일, Sideways 4일 간격)")
    print(f"  ✓ 복합 레짐 감지 (MA4종 + 모멘텀2종 + RSI)")
    print(f"  ✓ 축별 손절 차별화 (단기-10% / 중기-12% / 장기-15%)")
    print(f"  ✓ 축별 팩터 최적화 (단기=모멘텀+수급 / 장기=밸류+퀄리티)")
    print(f"  ✓ 적응적 Board 임계값 (70% → 후보 부족 시 60%)")
    print(f"{'='*80}")


if __name__ == "__main__":
    main()
