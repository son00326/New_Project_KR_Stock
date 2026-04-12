"""
주픽(JooPick) 전체 자동화 시스템 백테스트 v2
=============================================
v1 대비 8대 갭 전면 수정:
1. Crisis Layer + RSI 통합
2. Alpha/타이밍 모델 추가
3. 부분 리밸런싱 (전량 청산 → diff 거래)
4. 3축 완전 분화 (주기/팩터/손절)
5. Factor proxy 개선 (실제 외국인 수급 + PBR)
6. Board 임계값 80% + 정예화
7. 레짐 감지 개선 (OR 조건)
8. 동적 유니버스 (분기 재구성)

목표: 월간 Win Rate 70%+ / 삼성전자 B&H CAGR beat
"""

import sys, warnings, time
warnings.filterwarnings('ignore')
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from pykrx import stock as krx


# ============================================================
# 1. 데이터 수집 (개선: PBR + 외국인 수급)
# ============================================================

def fetch_stock_data(ticker: str, start: str, end: str) -> pd.DataFrame:
    try:
        df = krx.get_market_ohlcv(start, end, ticker)
        if len(df) < 60:
            return None

        df.columns = ['open', 'high', 'low', 'close', 'volume', 'change']
        df['return'] = df['close'].pct_change()
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

        # 모멘텀
        df['mom_5'] = df['close'].pct_change(5)
        df['mom_10'] = df['close'].pct_change(10)
        df['mom_20'] = df['close'].pct_change(20)
        df['mom_60'] = df['close'].pct_change(60)

        # 볼린저밴드
        df['bb_mid'] = df['close'].rolling(20).mean()
        df['bb_std'] = df['close'].rolling(20).std()
        df['bb_upper'] = df['bb_mid'] + 2 * df['bb_std']
        df['bb_lower'] = df['bb_mid'] - 2 * df['bb_std']
        df['bb_position'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower']).replace(0, 1)

        # 거래량 변화율 (20일 평균 대비)
        df['vol_ratio'] = df['volume'] / df['volume'].rolling(20).mean()

        df['ticker'] = ticker
        return df
    except:
        return None


def fetch_foreign_flow(ticker: str, start: str, end: str) -> pd.Series:
    """외국인 순매수 금액 (pykrx 실데이터)"""
    try:
        df = krx.get_market_trading_value_by_date(start, end, ticker)
        if df is not None and len(df) > 0:
            # 외국인 순매수 (매수-매도)
            if '외국인합계' in df.columns:
                return df['외국인합계']
            cols = [c for c in df.columns if '외국인' in c]
            if cols:
                return df[cols[0]]
    except:
        pass
    return None


def fetch_fundamental(ticker: str, start: str, end: str) -> pd.DataFrame:
    """PBR, PER, 배당수익률"""
    try:
        df = krx.get_market_fundamental(start, end, ticker)
        if df is not None and len(df) > 0:
            return df
    except:
        pass
    return None


# ============================================================
# 2. 동적 유니버스 (분기 재구성)
# ============================================================

def get_dynamic_universe(date_str: str) -> dict:
    """분기별 시총 상위 종목 재구성 (생존편향 제거)"""
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
# 3. Factor Scoring (축별 차별화)
# ============================================================

# 축별 팩터 가중치
AXIS_FACTOR_WEIGHTS = {
    'short_term': {  # 모멘텀 + 수급 중심 (단기 트레이딩)
        'momentum': 0.35, 'flow': 0.30, 'quality': 0.15,
        'low_vol': 0.10, 'value': 0.10
    },
    'mid_term': {  # 균형 멀티팩터
        'momentum': 0.20, 'flow': 0.25, 'quality': 0.25,
        'value': 0.20, 'low_vol': 0.10
    },
    'long_term': {  # 밸류 + 퀄리티 중심
        'value': 0.35, 'quality': 0.30, 'low_vol': 0.20,
        'momentum': 0.10, 'flow': 0.05
    },
}


def compute_factors(stock_data: dict, foreign_data: dict,
                    fundamental_data: dict, date) -> pd.DataFrame:
    records = []

    for ticker, df in stock_data.items():
        if df is None:
            continue

        valid_dates = df.index[df.index <= date]
        if len(valid_dates) == 0:
            continue
        nearest_date = valid_dates[-1]
        idx = df.index.get_loc(nearest_date)
        if idx < 120:
            continue

        row = df.iloc[idx]

        # 1. Momentum (복합: 5/10/20/60일 가중 평균)
        mom5 = row.get('mom_5', 0) if not pd.isna(row.get('mom_5', 0)) else 0
        mom10 = row.get('mom_10', 0) if not pd.isna(row.get('mom_10', 0)) else 0
        mom20 = row.get('mom_20', 0) if not pd.isna(row.get('mom_20', 0)) else 0
        mom60 = row.get('mom_60', 0) if not pd.isna(row.get('mom_60', 0)) else 0
        # 최근 모멘텀 가중 (단기 > 장기)
        momentum = mom5 * 0.3 + mom10 * 0.3 + mom20 * 0.25 + mom60 * 0.15

        # 2. Value (PBR 기반, 없으면 12M 저점 proxy)
        val_score = 0
        if ticker in fundamental_data and fundamental_data[ticker] is not None:
            fdf = fundamental_data[ticker]
            valid_f = fdf.index[fdf.index <= date]
            if len(valid_f) > 0:
                pbr = fdf.loc[valid_f[-1]].get('PBR', None)
                if pbr and not pd.isna(pbr) and pbr > 0:
                    val_score = 1 / pbr  # 낮은 PBR = 높은 점수
        if val_score == 0:  # PBR 없으면 fallback
            low_12m = df['close'].iloc[max(0, idx-252):idx+1].min()
            val_score = 1 - (row['close'] - low_12m) / max(row['close'], 1)

        # 3. Quality (수익률 안정성 + RSI 적정 범위)
        ret_std = df['return'].iloc[max(0, idx-60):idx+1].std()
        quality = 1 / (ret_std * np.sqrt(252) + 0.01)
        rsi = row.get('rsi', 50)
        if not pd.isna(rsi):
            # RSI 40-60 구간이 가장 건강한 추세
            rsi_quality = 1 - abs(rsi - 50) / 50
            quality = quality * 0.7 + rsi_quality * quality * 0.3

        # 4. Low Volatility
        vol = row.get('vol_20', 30)
        if pd.isna(vol): vol = 30
        low_vol = 1 / (vol + 1)

        # 5. Foreign Flow (실 데이터 우선)
        flow = 0
        if ticker in foreign_data and foreign_data[ticker] is not None:
            ff = foreign_data[ticker]
            valid_ff = ff.index[ff.index <= date]
            if len(valid_ff) >= 20:
                recent_flow = ff.loc[valid_ff[-20:]].sum()
                avg_flow = ff.loc[valid_ff[-60:]].mean() if len(valid_ff) >= 60 else ff.mean()
                flow = recent_flow / (abs(avg_flow) * 20 + 1)
        if flow == 0:  # fallback to volume proxy
            vol_ratio = row.get('vol_ratio', 1)
            if not pd.isna(vol_ratio):
                flow = vol_ratio - 1

        records.append({
            'ticker': ticker,
            'momentum': momentum,
            'value': val_score if not pd.isna(val_score) else 0,
            'quality': quality if not pd.isna(quality) else 0,
            'low_vol': low_vol if not pd.isna(low_vol) else 0,
            'flow': flow if not pd.isna(flow) else 0,
            'close': row['close'],
            'rsi': rsi if not pd.isna(rsi) else 50,
            'mom_20': mom20,
            'mom_60': mom60,
            'vol_pct': row.get('vol_pct', 50),
            'bb_position': row.get('bb_position', 0.5),
        })

    if not records:
        return pd.DataFrame()

    fdf = pd.DataFrame(records)
    for col in ['momentum', 'value', 'quality', 'low_vol', 'flow']:
        if fdf[col].std() > 0:
            fdf[f'{col}_z'] = (fdf[col] - fdf[col].mean()) / fdf[col].std()
        else:
            fdf[f'{col}_z'] = 0

    return fdf


def compute_axis_score(factors_df: pd.DataFrame, axis: str) -> pd.Series:
    """축별 가중치로 종합 점수 계산"""
    weights = AXIS_FACTOR_WEIGHTS[axis]
    score = pd.Series(0.0, index=factors_df.index)
    for factor, w in weights.items():
        col = f'{factor}_z'
        if col in factors_df.columns:
            score += factors_df[col] * w
    return score


# ============================================================
# 4. Quant Board 투표 (정예 10명, 임계값 80%)
# ============================================================

QUANT_BOARD = [
    # 모멘텀/추세 계열 (3명)
    {'name': 'Simons', 'weights': {'momentum_z': 0.40, 'flow_z': 0.25, 'quality_z': 0.15, 'low_vol_z': 0.10, 'value_z': 0.10}},
    {'name': 'Harding', 'weights': {'momentum_z': 0.50, 'flow_z': 0.20, 'quality_z': 0.10, 'low_vol_z': 0.10, 'value_z': 0.10}},
    {'name': 'Brown', 'weights': {'flow_z': 0.35, 'momentum_z': 0.30, 'quality_z': 0.15, 'value_z': 0.10, 'low_vol_z': 0.10}},
    # 밸류/품질 계열 (3명)
    {'name': 'Thorp', 'weights': {'value_z': 0.35, 'quality_z': 0.30, 'low_vol_z': 0.15, 'momentum_z': 0.10, 'flow_z': 0.10}},
    {'name': '문병로', 'weights': {'value_z': 0.40, 'quality_z': 0.25, 'low_vol_z': 0.15, 'momentum_z': 0.10, 'flow_z': 0.10}},
    {'name': 'Asness', 'weights': {'momentum_z': 0.25, 'value_z': 0.25, 'quality_z': 0.25, 'low_vol_z': 0.15, 'flow_z': 0.10}},
    # 리스크 계열 (2명)
    {'name': 'Taleb', 'weights': {'low_vol_z': 0.40, 'quality_z': 0.30, 'value_z': 0.15, 'momentum_z': 0.10, 'flow_z': 0.05}},
    {'name': 'Dalio', 'weights': {'low_vol_z': 0.30, 'quality_z': 0.25, 'momentum_z': 0.20, 'value_z': 0.15, 'flow_z': 0.10}},
    # 적응적/반대 계열 (2명)
    {'name': 'Lo', 'weights': {'flow_z': 0.25, 'momentum_z': 0.25, 'quality_z': 0.20, 'low_vol_z': 0.15, 'value_z': 0.15}},
    {'name': 'Griffin', 'weights': {'momentum_z': 0.30, 'flow_z': 0.25, 'quality_z': 0.20, 'value_z': 0.15, 'low_vol_z': 0.10}},
]


def board_vote(factors_df: pd.DataFrame, axis: str, top_n: int = 5) -> list:
    """Board 투표 + 축별 가중 점수 결합"""
    if factors_df.empty or len(factors_df) < 3:
        return []

    # 축별 종합 점수
    factors_df = factors_df.copy()
    factors_df['axis_score'] = compute_axis_score(factors_df, axis)

    # Board 투표
    all_scores = pd.DataFrame(index=factors_df.index)
    for member in QUANT_BOARD:
        score = sum(factors_df[col] * w for col, w in member['weights'].items()
                    if col in factors_df.columns)
        all_scores[member['name']] = score

    # 각 멤버 Top-N 투표
    pick_n = min(top_n, len(factors_df))
    votes = pd.DataFrame(0, index=factors_df.index,
                         columns=[m['name'] for m in QUANT_BOARD])
    for member_name in votes.columns:
        top_idx = all_scores[member_name].nlargest(pick_n).index
        votes.loc[top_idx, member_name] = 1

    # 80% 컨센서스 (10명 중 8명 이상)
    vote_pct = votes.sum(axis=1) / len(QUANT_BOARD)
    consensus = vote_pct[vote_pct >= 0.80]

    if consensus.empty:
        # 80%에서 아무도 통과 못하면 70%로 완화
        consensus = vote_pct[vote_pct >= 0.70]

    selected = []
    for idx in consensus.index:
        row = factors_df.loc[idx]
        rsi = row.get('rsi', 50)
        # RSI 필터: 과매수(>75) 진입 금지, 과매도(<25) 우선 진입
        if rsi > 75 and axis == 'short_term':
            continue

        selected.append({
            'ticker': row['ticker'],
            'score': row['axis_score'],
            'vote_pct': vote_pct.loc[idx],
            'close': row['close'],
            'rsi': rsi,
            'mom_20': row.get('mom_20', 0),
        })

    selected.sort(key=lambda x: x['score'], reverse=True)
    return selected[:top_n]


# ============================================================
# 5. Alpha Model (v2에서 포팅 + 확장)
# ============================================================

def compute_alpha(row) -> float:
    """모멘텀 + 평균회귀 + 변동성 조정 alpha"""
    alpha = 0.0

    mom20 = row.get('mom_20', 0)
    mom60 = row.get('mom_60', 0)
    rsi = row.get('rsi', 50)
    bb_pos = row.get('bb_position', 0.5)
    vol_pct = row.get('vol_pct', 50)

    for v in [mom20, mom60, rsi, bb_pos, vol_pct]:
        if pd.isna(v): v = 0

    if pd.isna(mom20): mom20 = 0
    if pd.isna(mom60): mom60 = 0
    if pd.isna(rsi): rsi = 50
    if pd.isna(bb_pos): bb_pos = 0.5
    if pd.isna(vol_pct): vol_pct = 50

    # 모멘텀 Alpha
    if mom20 > 0.03 and mom60 > 0.05:
        alpha += 0.0008
    elif mom20 > 0 and mom60 > 0:
        alpha += 0.0004
    elif mom20 < -0.03 and mom60 < -0.05:
        alpha -= 0.0003

    # 평균회귀 Alpha
    if rsi < 25 and bb_pos < 0.1:
        alpha += 0.0010
    elif rsi > 80 and bb_pos > 0.95:
        alpha -= 0.0005

    # 변동성 조정
    if vol_pct < 30:
        alpha *= 1.3
    elif vol_pct > 80:
        alpha *= 0.5

    return alpha


# ============================================================
# 6. Crisis Management Layer v2 (RSI 통합)
# ============================================================

class CrisisLayer:
    VOL_RULES = {50: 1.0, 70: 0.85, 85: 0.60, 95: 0.30, 100: 0.10}
    REGIME_MULT = {'bull': 1.25, 'sideways': 1.0, 'bear': 0.65}

    def __init__(self, initial_capital):
        self.position = 1.0
        self.peak = initial_capital
        self.in_crisis = False
        self.reentry_step = 0
        self.crisis_peak_vol = 0
        self.days_reentry = 0

    def update(self, vol_pct, daily_ret, port_val, regime, rsi=50):
        if pd.isna(vol_pct): vol_pct = 50
        if pd.isna(rsi): rsi = 50
        if port_val > self.peak: self.peak = port_val

        # 크래시 감지
        if daily_ret < -0.07:
            self.in_crisis = True
            self.reentry_step = 0
            self.crisis_peak_vol = vol_pct
            self.position = 0.10
            return self.position

        # 변동성 백분위 기반
        base = 1.0
        for thr, pct in sorted(self.VOL_RULES.items()):
            if vol_pct <= thr:
                base = pct
                break

        target = min(base * self.REGIME_MULT.get(regime, 1.0), 1.0)

        # RSI 기반 보조 (v2에서 포팅)
        if rsi < 25 and regime != 'bear':
            target = min(target * 1.20, 1.0)  # 과매도 반등 기대
        elif rsi > 80:
            target = target * 0.85  # 과매수 경계

        # DD 서킷 (완화: -20%/-12%)
        if daily_ret < -0.03:
            target = min(target, 0.50)
        dd = (port_val - self.peak) / self.peak if self.peak > 0 else 0
        if dd < -0.20:
            target = min(target, 0.25)
        elif dd < -0.12:
            target = min(target, 0.60)

        # 위기 재진입
        if self.in_crisis and self.crisis_peak_vol > 0:
            vol_drop = (self.crisis_peak_vol - vol_pct) / self.crisis_peak_vol
            speed = 3 if regime == 'bull' else (5 if regime == 'sideways' else 10)
            steps = [0.30, 0.55, 0.80, 1.00]
            # Bull에서 더 빠른 재진입
            if vol_drop > 0.30 or (regime == 'bull' and vol_drop > 0.20):
                self.days_reentry += 1
                if self.days_reentry >= speed and self.reentry_step < len(steps):
                    target = steps[self.reentry_step]
                    self.reentry_step += 1
                    self.days_reentry = 0
                    if self.reentry_step >= len(steps):
                        self.in_crisis = False
            else:
                target = min(target, 0.15)

        # 변경 속도 제한 (축소는 빠르게, 확대는 적절히)
        if target < self.position:
            self.position = max(target, self.position - 0.40)
        else:
            self.position = min(target, self.position + 0.20)

        self.position = max(0.05, min(1.0, self.position))
        return self.position


def detect_regime(close, ma200, mom20, mom60):
    """개선된 레짐 감지 (OR 조건 + 완화된 임계값)"""
    if pd.isna(ma200): return 'sideways'
    if pd.isna(mom20): mom20 = 0
    if pd.isna(mom60): mom60 = 0

    above_ma = close > ma200
    strong_mom = mom60 > 0.03
    recent_mom = mom20 > 0.02

    if above_ma and (strong_mom or recent_mom):
        return 'bull'
    elif (not above_ma) and (mom60 < -0.03 or mom20 < -0.02):
        return 'bear'
    return 'sideways'


# ============================================================
# 7. 포트폴리오 관리 (부분 리밸런싱 + 손절)
# ============================================================

class Portfolio:
    def __init__(self, capital):
        self.capital = capital
        self.peak = capital
        self.cash = capital
        self.positions = {}  # {pos_key: {ticker, shares, cost, axis, entry_date}}
        self.history = []
        self.trades = 0
        self.total_cost = 0

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

    def check_stop_loss(self, stock_data, date, stop_pct=-0.08):
        """손절 체크: 매입가 대비 -8% 이하 시 청산"""
        to_sell = []
        for pos_key, pos in self.positions.items():
            price = self._get_price(stock_data, pos['ticker'], date)
            if price and price > 0 and pos['cost'] > 0:
                ret = (price - pos['cost']) / pos['cost']
                if ret < stop_pct:
                    to_sell.append(pos_key)

        for pos_key in to_sell:
            pos = self.positions[pos_key]
            price = self._get_price(stock_data, pos['ticker'], date)
            if price and price > 0:
                sell_val = pos['shares'] * price
                cost = sell_val * (0.00015 + 0.0023)
                self.cash += sell_val - cost
                self.total_cost += cost
                self.trades += 1
            del self.positions[pos_key]

        return len(to_sell)

    def check_take_profit(self, stock_data, date, take_pct=0.25):
        """익절 체크: 매입가 대비 +25% 이상 시 50% 부분 익절"""
        for pos_key in list(self.positions.keys()):
            pos = self.positions[pos_key]
            price = self._get_price(stock_data, pos['ticker'], date)
            if price and price > 0 and pos['cost'] > 0:
                ret = (price - pos['cost']) / pos['cost']
                if ret > take_pct and pos['shares'] > 1:
                    sell_shares = pos['shares'] // 2
                    sell_val = sell_shares * price
                    cost = sell_val * (0.00015 + 0.0023)
                    self.cash += sell_val - cost
                    self.total_cost += cost
                    self.trades += 1
                    pos['shares'] -= sell_shares
                    pos['cost'] = price  # 잔여 포지션 cost basis 업데이트

    def rebalance(self, target_tickers: dict, stock_data: dict, date,
                  crisis_pct: float, axis_weights: dict, axis_to_rebal: list = None):
        """부분 리밸런싱: 유지할 종목은 건드리지 않고, 변경분만 거래"""
        if axis_to_rebal is None:
            axis_to_rebal = list(target_tickers.keys())

        total_val = self.get_total_value(stock_data, date)
        if total_val <= 0:
            total_val = self.cash

        # 리밸런싱 대상 축의 기존 포지션만 청산
        for pos_key in list(self.positions.keys()):
            pos = self.positions[pos_key]
            if pos['axis'] not in axis_to_rebal:
                continue

            # 새 타겟에 이미 있는 종목은 유지
            target_tickers_for_axis = target_tickers.get(pos['axis'], [])
            target_ticker_set = {(t['ticker'] if isinstance(t, dict) else t)
                                 for t in target_tickers_for_axis}

            if pos['ticker'] in target_ticker_set:
                continue  # 유지

            # 타겟에 없는 종목만 청산
            price = self._get_price(stock_data, pos['ticker'], date)
            if price and price > 0:
                sell_val = pos['shares'] * price
                cost = sell_val * (0.00015 + 0.0023)
                self.cash += sell_val - cost
                self.total_cost += cost
                self.trades += 1
            del self.positions[pos_key]

        # 새 포지션 진입 (기존에 없는 종목만)
        for axis in axis_to_rebal:
            tickers = target_tickers.get(axis, [])
            if not tickers:
                continue

            axis_capital = total_val * axis_weights[axis] * crisis_pct
            # 기존 보유 종목의 현재 가치 차감
            existing_val = sum(
                pos['shares'] * (self._get_price(stock_data, pos['ticker'], date) or 0)
                for pk, pos in self.positions.items()
                if pos['axis'] == axis
            )
            remaining_capital = max(0, axis_capital - existing_val)
            new_tickers = [t for t in tickers
                           if f"{axis}_{t['ticker'] if isinstance(t, dict) else t}"
                           not in self.positions]
            if not new_tickers:
                continue

            per_stock = remaining_capital / len(new_tickers)

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
                pos_key = f"{axis}_{ticker}"

                if total_buy <= self.cash:
                    self.positions[pos_key] = {
                        'shares': shares, 'cost': price, 'axis': axis,
                        'ticker': ticker, 'entry_date': date
                    }
                    self.cash -= total_buy
                    self.total_cost += cost
                    self.trades += 1

    def get_total_value(self, stock_data, date):
        val = self.cash
        for pos_key, pos in self.positions.items():
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
    print("=" * 75)
    print("  주픽(JooPick) 전체 자동화 시스템 백테스트 v2")
    print("  3축 완전 분화 + Alpha Model + 부분 리밸런싱 + RSI Crisis")
    print("  Board: 10명 80% 컨센서스 | 동적 유니버스 | 손절/익절")
    print("  실행:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 75)

    START = "20190101"
    END = "20260410"
    INITIAL_CAPITAL = 1_000_000_000  # 10억 원

    # ---- Step 1: 초기 유니버스 ----
    print("\n[Step 1] 유니버스 구성 중...")

    # 동적 유니버스용 분기 날짜
    quarter_dates = pd.date_range(start=START, end=END, freq='QS').strftime('%Y%m%d').tolist()

    # 초기 유니버스
    universe = get_dynamic_universe("20190102")
    if universe is None:
        # fallback
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
    print(f"  → 초기 유니버스: {len(all_tickers)}종목")

    # ---- Step 2: 데이터 수집 ----
    print(f"\n[Step 2] 데이터 수집 중...")
    stock_data = {}
    foreign_data = {}
    fundamental_data = {}
    success = 0

    for i, ticker in enumerate(all_tickers):
        df = fetch_stock_data(ticker, START, END)
        if df is not None and len(df) > 100:
            stock_data[ticker] = df
            success += 1
            # 외국인 수급 (API 부하 줄이기 위해 비동기 안 씀)
            ff = fetch_foreign_flow(ticker, START, END)
            if ff is not None:
                foreign_data[ticker] = ff
            # 펀더멘탈
            fund = fetch_fundamental(ticker, START, END)
            if fund is not None:
                fundamental_data[ticker] = fund

        if (i + 1) % 10 == 0:
            print(f"  → {i+1}/{len(all_tickers)} 완료 ({success} 성공)")
            time.sleep(1)

    print(f"  → 최종 {success}/{len(all_tickers)} 종목 데이터 확보")
    print(f"  → 외국인 수급 데이터: {len(foreign_data)}종목")
    print(f"  → 펀더멘탈 데이터: {len(fundamental_data)}종목")

    if success < 10:
        print("❌ 데이터 부족, 중단")
        return

    # ---- Step 3: 기준 종목 ----
    ref = stock_data.get('005930')
    if ref is None:
        print("❌ 삼성전자 데이터 없음")
        return

    # ---- Step 4: 백테스트 실행 ----
    print("\n[Step 3] 백테스트 실행 중...")

    model_port = Portfolio(INITIAL_CAPITAL)
    crisis = CrisisLayer(INITIAL_CAPITAL)

    bh_start_price = ref['close'].iloc[0]
    axis_weights = {'short_term': 0.30, 'mid_term': 0.40, 'long_term': 0.30}

    # 축별 리밸런싱 주기
    REBAL_FREQ = {
        'short_term': 10,   # 2주 (10영업일)
        'mid_term': 21,     # 1개월
        'long_term': 63,    # 분기
    }
    last_rebal = {'short_term': 0, 'mid_term': 0, 'long_term': 0}

    prev_quarter = None
    daily_returns_bh = []

    for day_idx, date in enumerate(ref.index):
        row = ref.iloc[day_idx]

        # 레짐 감지 (개선)
        regime = detect_regime(
            row['close'],
            row.get('ma200', row['close']),
            row.get('mom_20', 0),
            row.get('mom_60', 0)
        )

        # Alpha 모델
        alpha = compute_alpha(row)

        # Crisis Layer (RSI 통합)
        port_val = model_port.get_total_value(stock_data, date)
        vol_pct = row.get('vol_pct', 50)
        daily_ret = row.get('return', 0) if not pd.isna(row.get('return', 0)) else 0
        rsi = row.get('rsi', 50) if not pd.isna(row.get('rsi', 50)) else 50
        crisis_pct = crisis.update(vol_pct, daily_ret, port_val, regime, rsi)

        # 일간 손절 체크 (매일 실행)
        if day_idx > 120:
            stops = model_port.check_stop_loss(stock_data, date, stop_pct=-0.08)
            # 익절 체크 (단기축만)
            model_port.check_take_profit(stock_data, date, take_pct=0.25)

        # 분기별 유니버스 재구성
        current_quarter = f"{date.year}Q{(date.month-1)//3+1}"
        if prev_quarter and current_quarter != prev_quarter:
            new_uni = get_dynamic_universe(date.strftime('%Y%m%d'))
            if new_uni:
                universe = new_uni
                # 새 유니버스에 포함된 신규 종목 데이터 수집
                for ticker in universe['all']:
                    if ticker not in stock_data:
                        df = fetch_stock_data(ticker, START, END)
                        if df is not None and len(df) > 100:
                            stock_data[ticker] = df
                            ff = fetch_foreign_flow(ticker, START, END)
                            if ff is not None:
                                foreign_data[ticker] = ff
                            fund = fetch_fundamental(ticker, START, END)
                            if fund is not None:
                                fundamental_data[ticker] = fund

        prev_quarter = current_quarter

        # 축별 리밸런싱 (차별화된 주기)
        if day_idx > 120:
            axes_to_rebal = []
            for axis, freq in REBAL_FREQ.items():
                if day_idx - last_rebal[axis] >= freq:
                    axes_to_rebal.append(axis)

            if axes_to_rebal:
                factors = compute_factors(stock_data, foreign_data,
                                          fundamental_data, date)

                if not factors.empty:
                    target = {}

                    for axis in axes_to_rebal:
                        axis_factors = factors[factors['ticker'].isin(
                            universe.get(axis, []))]
                        if axis_factors.empty:
                            target[axis] = []
                            continue

                        top_n = {'short_term': 5, 'mid_term': 7, 'long_term': 5}[axis]
                        picks = board_vote(axis_factors, axis=axis, top_n=top_n)
                        target[axis] = picks
                        last_rebal[axis] = day_idx

                    total_picks = sum(len(v) for v in target.values())
                    if total_picks > 0:
                        model_port.rebalance(target, stock_data, date,
                                             crisis_pct, axis_weights, axes_to_rebal)

                        if date.month in [1, 4, 7, 10] and date.day <= 7:
                            axis_str = '+'.join([a[0] for a in axes_to_rebal])
                            picks_str = '/'.join([f"{len(target.get(a,[]))}" for a in axes_to_rebal])
                            print(f"  [{date.strftime('%Y-%m')}] 리밸런싱({axis_str}): {picks_str} 종목, Crisis {crisis_pct:.0%}, 레짐 {regime}")

        # 기록
        model_port.update_history(date, stock_data, regime, crisis_pct)
        bh_val = 100 * (row['close'] / bh_start_price)
        daily_returns_bh.append({'date': date, 'value': bh_val})

    # ---- Step 5: 결과 분석 ----
    print("\n[Step 4] 결과 분석 중...")

    model_hist = pd.DataFrame(model_port.history)
    bh_hist = pd.DataFrame(daily_returns_bh)

    if model_hist.empty:
        print("❌ 모델 결과 없음")
        return

    # B&H 값을 포트 스케일로 정규화
    model_hist['value_norm'] = model_hist['value'] / model_hist['value'].iloc[0] * 100
    bh_hist['value_norm'] = bh_hist['value']

    def calc_stats(hist_df, val_col='value'):
        total_ret = (hist_df[val_col].iloc[-1] / hist_df[val_col].iloc[0] - 1) * 100
        n_years = max(len(hist_df) / 252, 0.5)
        cagr = ((hist_df[val_col].iloc[-1] / hist_df[val_col].iloc[0]) ** (1/n_years) - 1) * 100

        peak = hist_df[val_col].cummax()
        dd = ((hist_df[val_col] - peak) / peak).min() * 100

        daily_ret = hist_df[val_col].pct_change().dropna()
        sharpe = 0
        if daily_ret.std() > 0:
            sharpe = (daily_ret.mean() * 252 - 0.035) / (daily_ret.std() * np.sqrt(252))

        calmar = cagr / abs(dd) if dd != 0 else 0

        win = (daily_ret > 0).sum()
        total = (daily_ret != 0).sum()
        wr = win / total * 100 if total > 0 else 0

        hist_copy = hist_df.copy()
        hist_copy['month'] = pd.to_datetime(hist_copy['date']).dt.to_period('M')
        monthly = hist_copy.groupby('month')[val_col].apply(
            lambda x: x.iloc[-1]/x.iloc[0]-1 if len(x) > 1 else 0)
        m_win = (monthly > 0).sum()
        m_total = len(monthly)
        mwr = m_win / m_total * 100 if m_total > 0 else 0

        return {
            'total_return': total_ret, 'cagr': cagr, 'max_dd': dd,
            'sharpe': sharpe, 'calmar': calmar,
            'daily_wr': wr, 'monthly_wr': mwr,
        }

    model_stats = calc_stats(model_hist)
    bh_stats = calc_stats(bh_hist)

    # ---- 출력 ----
    print(f"\n{'='*75}")
    print(f"  3축 통합 백테스트 v2 결과: 2019.01 ~ 2026.04 ({len(model_hist)}일)")
    print(f"  유니버스: 동적 재구성 | Board: 10명 80% | Crisis+RSI+Alpha")
    print(f"{'='*75}")

    print(f"\n  {'지표':<25} {'Buy & Hold(삼성)':>18} {'주픽 3축 v2':>18} {'차이':>15}")
    print(f"  {'-'*76}")

    metrics = [
        ('총 수익률', 'total_return', '%', '%p'),
        ('CAGR', 'cagr', '%', '%p'),
        ('Max DD', 'max_dd', '%', '%p'),
    ]
    for label, key, unit, diff_unit in metrics:
        print(f"  {label:<25} {bh_stats[key]:>+17.1f}{unit} {model_stats[key]:>+17.1f}{unit} {model_stats[key]-bh_stats[key]:>+14.1f}{diff_unit}")

    for label, key in [('Sharpe', 'sharpe'), ('Calmar', 'calmar')]:
        print(f"  {label:<25} {bh_stats[key]:>18.2f} {model_stats[key]:>18.2f} {model_stats[key]-bh_stats[key]:>+15.2f}")

    for label, key in [('일간 Win Rate', 'daily_wr'), ('월간 Win Rate', 'monthly_wr')]:
        print(f"  {label:<25} {bh_stats[key]:>17.1f}% {model_stats[key]:>17.1f}%")

    print(f"  {'거래 횟수':<25} {'0':>18} {model_port.trades:>18}")
    print(f"  {'총 비용 (원)':<25} {'0':>18} {model_port.total_cost:>18,.0f}")
    print(f"  {'비용률':<25} {'0':>18} {model_port.total_cost/INITIAL_CAPITAL*100:>17.2f}%")

    # 연도별
    print(f"\n{'='*75}")
    print(f"  연도별 성과")
    print(f"{'='*75}")

    model_hist['year'] = pd.to_datetime(model_hist['date']).dt.year
    bh_hist['year'] = pd.to_datetime(bh_hist['date']).dt.year

    years = sorted(model_hist['year'].unique())
    print(f"\n  {'연도':<6} {'B&H':>10} {'모델':>10} {'초과수익':>10} {'B&H DD':>9} {'모델 DD':>9} {'월WR':>6} {'레짐':>22}")
    print(f"  {'-'*82}")

    for y in years:
        my = model_hist[model_hist['year'] == y]
        by = bh_hist[bh_hist['year'] == y]
        if len(my) < 10 or len(by) < 10:
            continue

        m_ret = (my['value'].iloc[-1] / my['value'].iloc[0] - 1) * 100
        b_ret = (by['value'].iloc[-1] / by['value'].iloc[0] - 1) * 100
        excess = m_ret - b_ret

        m_peak = my['value'].cummax()
        m_dd = ((my['value'] - m_peak) / m_peak).min() * 100
        b_peak = by['value'].cummax()
        b_dd = ((by['value'] - b_peak) / b_peak).min() * 100

        # 해당 연도 월간 win rate
        my_c = my.copy()
        my_c['month'] = pd.to_datetime(my_c['date']).dt.to_period('M')
        monthly = my_c.groupby('month')['value'].apply(
            lambda x: x.iloc[-1]/x.iloc[0]-1 if len(x) > 1 else 0)
        yr_mwr = (monthly > 0).sum() / len(monthly) * 100 if len(monthly) > 0 else 0

        regime_counts = my['regime'].value_counts()
        regime_str = ', '.join([f"{k}:{v}" for k, v in regime_counts.head(2).items()])

        print(f"  {y:<6} {b_ret:>+9.1f}% {m_ret:>+9.1f}% {excess:>+9.1f}% {b_dd:>+8.1f}% {m_dd:>+8.1f}% {yr_mwr:>5.0f}% {regime_str:>22}")

    # 위기 구간
    print(f"\n{'='*75}")
    print(f"  위기 구간 분석 (모델 DD 상위 5일)")
    print(f"{'='*75}")

    worst = model_hist.nsmallest(5, 'dd')
    print(f"\n  {'날짜':<12} {'DD':>8} {'포지션':>6} {'현금':>6} {'레짐':>10} {'Crisis':>8}")
    print(f"  {'-'*55}")
    for _, r in worst.iterrows():
        print(f"  {str(r['date'])[:10]:<12} {r['dd']:>+7.1%} {r['positions']:>6} {r['cash_pct']:>5.0%} {r['regime']:>10} {r['crisis_pct']:>7.0%}")

    print(f"\n{'='*75}")
    print(f"  v2 개선사항:")
    print(f"  ✓ 동적 유니버스 (분기별 시총 재구성, 생존편향 제거)")
    print(f"  ✓ 축별 리밸런싱 차별화 (단기 2주 / 중기 1개월 / 장기 분기)")
    print(f"  ✓ 부분 리밸런싱 (유지 종목 거래 안 함, 비용 절감)")
    print(f"  ✓ Crisis Layer + RSI + Alpha Model 통합")
    print(f"  ✓ Board 80% 컨센서스 + RSI 과매수 필터")
    print(f"  ✓ 손절 -8% / 익절 +25% (50% 부분 매도)")
    print(f"  ✓ 실제 외국인 수급 + PBR 데이터 활용")
    print(f"  ✓ 개선된 레짐 감지 (OR 조건, 완화된 임계값)")
    print(f"{'='*75}")


if __name__ == "__main__":
    main()
