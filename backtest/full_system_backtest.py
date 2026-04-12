"""
주픽(JooPick) 전체 자동화 시스템 백테스트
==========================================
3축: 단기 Quant (30%) + 중기 혼합 (40%) + 장기 Fundamental (30%)
Board: 10명 Quant Board 투표 시뮬레이션
Crisis: Management Layer v2
기간: 2019.01 ~ 2026.04
유니버스: KOSPI 시총 상위 30 + KOSDAQ 시총 상위 20 = 50종목
"""

import sys, warnings, time
warnings.filterwarnings('ignore')
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from pykrx import stock as krx


# ============================================================
# 1. 유니버스 구성
# ============================================================

def get_universe(date_str: str) -> dict:
    """시총 상위 종목 유니버스 (KOSPI 30 + KOSDAQ 20)"""
    try:
        # KOSPI 시총 상위
        kospi_caps = krx.get_market_cap(date_str, market="KOSPI")
        kospi_top = kospi_caps.nlargest(30, '시가총액').index.tolist()

        # KOSDAQ 시총 상위
        kosdaq_caps = krx.get_market_cap(date_str, market="KOSDAQ")
        kosdaq_top = kosdaq_caps.nlargest(20, '시가총액').index.tolist()

        return {
            'short_term': kosdaq_top[:15] + kospi_top[10:20],  # 중소형 모멘텀 대상
            'mid_term': kospi_top[:20],                         # 우량주
            'long_term': kospi_top[:10],                        # 대형 가치주 (삼성, SK 등)
            'all': list(set(kospi_top + kosdaq_top)),
        }
    except:
        return None


def fetch_stock_data(ticker: str, start: str, end: str) -> pd.DataFrame:
    """개별 종목 데이터 수집 + 기술 지표"""
    try:
        df = krx.get_market_ohlcv(start, end, ticker)
        if len(df) < 60:
            return None

        df.columns = ['open', 'high', 'low', 'close', 'volume', 'change']
        df['return'] = df['close'].pct_change()
        df['ma20'] = df['close'].rolling(20).mean()
        df['ma60'] = df['close'].rolling(60).mean()
        df['ma120'] = df['close'].rolling(120).mean()

        # RSI
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
        df['mom_20'] = df['close'].pct_change(20)
        df['mom_60'] = df['close'].pct_change(60)

        df['ticker'] = ticker
        return df
    except:
        return None


# ============================================================
# 2. Factor Scoring (5-Factor)
# ============================================================

def compute_factors(stock_data: dict, date) -> pd.DataFrame:
    """각 종목의 5-Factor Score 계산"""
    records = []

    for ticker, df in stock_data.items():
        if df is None:
            continue

        # 가장 가까운 날짜 찾기 (정확 매칭 실패 대비)
        valid_dates = df.index[df.index <= date]
        if len(valid_dates) == 0:
            continue
        nearest_date = valid_dates[-1]

        idx = df.index.get_loc(nearest_date)
        if idx < 120:  # 최소 120일 데이터 필요 (60일 모멘텀 + 여유)
            continue

        row = df.iloc[idx]

        # 1. Momentum (3M return 사용, 60일 데이터 부족 시)
        mom = row.get('mom_60', 0)
        if pd.isna(mom):
            mom = row.get('mom_20', 0)
        if pd.isna(mom): mom = 0

        # 2. Value (저PBR 근사 — 변동률 기반, 가중 15%)
        # PBR 데이터 없으므로 "최근 12개월 최저 대비 위치"로 대체
        low_12m = df['close'].iloc[max(0,idx-252):idx+1].min()
        val_score = 1 - (row['close'] - low_12m) / max(row['close'], 1)  # 저점 근접 = 높은 점수

        # 3. Quality (수익률 안정성, 가중 20%)
        ret_std = df['return'].iloc[max(0,idx-60):idx+1].std()
        quality = 1 / (ret_std * np.sqrt(252) + 0.01)  # 낮은 변동성 = 높은 품질

        # 4. Low Volatility (가중 10%)
        vol = row.get('vol_20', 30)
        if pd.isna(vol): vol = 30
        low_vol = 1 / (vol + 1)

        # 5. Foreign Flow 근사 (거래량 변화, 가중 25%)
        vol_ma20 = df['volume'].iloc[max(0,idx-20):idx+1].mean()
        vol_today = row['volume']
        flow_proxy = vol_today / max(vol_ma20, 1) - 1  # 거래량 급증 = 수급 유입 신호

        records.append({
            'ticker': ticker,
            'momentum': mom,
            'value': val_score if not pd.isna(val_score) else 0,
            'quality': quality if not pd.isna(quality) else 0,
            'low_vol': low_vol if not pd.isna(low_vol) else 0,
            'flow': flow_proxy if not pd.isna(flow_proxy) else 0,
            'close': row['close'],
            'rsi': row.get('rsi', 50),
            'vol_pct': row.get('vol_pct', 50),
        })

    if not records:
        return pd.DataFrame()

    fdf = pd.DataFrame(records)

    # Z-score 정규화
    for col in ['momentum', 'value', 'quality', 'low_vol', 'flow']:
        if fdf[col].std() > 0:
            fdf[f'{col}_z'] = (fdf[col] - fdf[col].mean()) / fdf[col].std()
        else:
            fdf[f'{col}_z'] = 0

    return fdf


# ============================================================
# 3. Quant Board 투표 (10명)
# ============================================================

# 10명의 Board 멤버, 각자 다른 팩터 가중치
QUANT_BOARD = [
    {'name': 'Simons', 'style': '통계패턴',      'weights': {'momentum_z': 0.35, 'flow_z': 0.30, 'quality_z': 0.15, 'low_vol_z': 0.10, 'value_z': 0.10}},
    {'name': 'Asness', 'style': '멀티팩터',       'weights': {'momentum_z': 0.25, 'value_z': 0.25, 'quality_z': 0.25, 'low_vol_z': 0.15, 'flow_z': 0.10}},
    {'name': 'Harding', 'style': '트렌드',        'weights': {'momentum_z': 0.50, 'flow_z': 0.20, 'low_vol_z': 0.10, 'quality_z': 0.10, 'value_z': 0.10}},
    {'name': 'Thorp', 'style': '통계차익',        'weights': {'value_z': 0.30, 'quality_z': 0.30, 'low_vol_z': 0.20, 'momentum_z': 0.10, 'flow_z': 0.10}},
    {'name': 'Griffin', 'style': '멀티전략',       'weights': {'momentum_z': 0.30, 'flow_z': 0.25, 'quality_z': 0.20, 'value_z': 0.15, 'low_vol_z': 0.10}},
    {'name': 'Taleb', 'style': '꼬리리스크',      'weights': {'low_vol_z': 0.40, 'quality_z': 0.25, 'value_z': 0.20, 'momentum_z': 0.10, 'flow_z': 0.05}},
    {'name': 'Dalio', 'style': '리스크패리티',    'weights': {'low_vol_z': 0.30, 'quality_z': 0.25, 'momentum_z': 0.20, 'value_z': 0.15, 'flow_z': 0.10}},
    {'name': 'Lo', 'style': '적응적시장',         'weights': {'momentum_z': 0.25, 'flow_z': 0.25, 'quality_z': 0.20, 'low_vol_z': 0.15, 'value_z': 0.15}},
    {'name': 'Brown', 'style': 'NLP패턴',        'weights': {'flow_z': 0.35, 'momentum_z': 0.30, 'quality_z': 0.15, 'value_z': 0.10, 'low_vol_z': 0.10}},
    {'name': '문병로', 'style': '한국PBR',        'weights': {'value_z': 0.40, 'quality_z': 0.25, 'low_vol_z': 0.15, 'momentum_z': 0.10, 'flow_z': 0.10}},
]


def board_vote(factors_df: pd.DataFrame, top_n: int = 10) -> list:
    """10명 Board가 독립적으로 스코어링 → 투표 → 컨센서스 종목 선정"""
    if factors_df.empty:
        return []

    # 각 멤버가 종목별 점수 부여
    all_scores = pd.DataFrame(index=factors_df.index)

    for member in QUANT_BOARD:
        score = sum(factors_df[col] * w for col, w in member['weights'].items()
                    if col in factors_df.columns)
        all_scores[member['name']] = score

    # 각 멤버의 Top N 종목에 "BUY" 투표 (1), 나머지 "HOLD" (0)
    votes = pd.DataFrame(0, index=factors_df.index, columns=[m['name'] for m in QUANT_BOARD])

    for member_name in votes.columns:
        top_idx = all_scores[member_name].nlargest(top_n).index
        votes.loc[top_idx, member_name] = 1

    # 컨센서스: 70% 이상 찬성 (10명 중 7명 이상 BUY)
    vote_pct = votes.sum(axis=1) / len(QUANT_BOARD)
    consensus = vote_pct[vote_pct >= 0.70]

    # 컨센서스 종목의 평균 스코어로 최종 순위
    selected_tickers = []
    for idx in consensus.index:
        ticker = factors_df.loc[idx, 'ticker']
        avg_score = all_scores.loc[idx].mean()
        vote_rate = vote_pct.loc[idx]
        selected_tickers.append({
            'ticker': ticker,
            'score': avg_score,
            'vote_pct': vote_rate,
            'close': factors_df.loc[idx, 'close'],
        })

    # 스코어 상위 정렬
    selected_tickers.sort(key=lambda x: x['score'], reverse=True)
    return selected_tickers[:top_n]


# ============================================================
# 4. Crisis Management Layer v2
# ============================================================

class CrisisLayer:
    VOL_RULES = {50: 1.0, 70: 0.80, 85: 0.50, 95: 0.25, 100: 0.10}
    REGIME_MULT = {'bull': 1.3, 'sideways': 1.0, 'bear': 0.7}

    def __init__(self, initial_capital=1_000_000_000):
        self.position = 1.0
        self.peak = initial_capital
        self.in_crisis = False
        self.reentry_step = 0
        self.crisis_peak_vol = 0
        self.days_reentry = 0

    def update(self, vol_pct, daily_ret, port_val, regime):
        if pd.isna(vol_pct): vol_pct = 50
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

        # DD 서킷
        if daily_ret < -0.03: target = min(target, 0.50)
        dd = (port_val - self.peak) / self.peak if self.peak > 0 else 0
        if dd < -0.15: target = min(target, 0.25)
        elif dd < -0.10: target = min(target, 0.50)

        # 위기 재진입
        if self.in_crisis and self.crisis_peak_vol > 0:
            vol_drop = (self.crisis_peak_vol - vol_pct) / self.crisis_peak_vol
            speed = 3 if regime == 'bull' else (5 if regime == 'sideways' else 10)
            steps = [0.25, 0.50, 0.75, 1.00]
            if vol_drop > 0.35:
                self.days_reentry += 1
                if self.days_reentry >= speed and self.reentry_step < len(steps):
                    target = steps[self.reentry_step]
                    self.reentry_step += 1
                    self.days_reentry = 0
                    if self.reentry_step >= len(steps):
                        self.in_crisis = False
            else:
                target = min(target, 0.15)

        # 변경 속도 제한
        if target < self.position:
            self.position = max(target, self.position - 0.40)
        else:
            self.position = min(target, self.position + 0.25)

        self.position = max(0.05, min(1.0, self.position))
        return self.position


def detect_regime(close, ma200, mom60):
    if pd.isna(ma200) or pd.isna(mom60): return 'sideways'
    if close > ma200 and mom60 > 0.05: return 'bull'
    elif close < ma200 and mom60 < -0.05: return 'bear'
    return 'sideways'


# ============================================================
# 5. 포트폴리오 관리
# ============================================================

class Portfolio:
    def __init__(self, capital=100.0):
        self.capital = capital
        self.peak = capital
        self.positions = {}  # {ticker: {'shares': n, 'cost': p, 'axis': 'short/mid/long'}}
        self.cash = capital
        self.history = []
        self.trades = 0
        self.total_cost = 0

    def _get_price(self, stock_data, ticker, date):
        """날짜 매칭 헬퍼: 정확 매칭 실패 시 가장 가까운 날짜 사용"""
        if ticker not in stock_data:
            return None
        df = stock_data[ticker]
        if date in df.index:
            return df.loc[date, 'close']
        valid = df.index[df.index <= date]
        if len(valid) == 0:
            return None
        return df.loc[valid[-1], 'close']

    def rebalance(self, target_tickers: dict, stock_data: dict, date,
                  crisis_pct: float, axis_weights: dict):
        total_val = self.get_total_value(stock_data, date)
        if total_val <= 0:
            total_val = self.cash

        # 기존 포지션 청산
        for pos_key in list(self.positions.keys()):
            pos = self.positions[pos_key]
            price = self._get_price(stock_data, pos['ticker'], date)
            if price and price > 0:
                sell_val = pos['shares'] * price
                cost = sell_val * (0.00015 + 0.0023)
                self.cash += sell_val - cost
                self.total_cost += cost
                self.trades += 1
            del self.positions[pos_key]

        # 새 포지션 진입
        for axis, tickers in target_tickers.items():
            axis_capital = total_val * axis_weights[axis] * crisis_pct
            if not tickers:
                continue
            per_stock = axis_capital / len(tickers)

            for t_info in tickers:
                ticker = t_info['ticker'] if isinstance(t_info, dict) else t_info
                price = self._get_price(stock_data, ticker, date)
                if price is None or price <= 0:
                    continue

                shares = int(per_stock / price)
                if shares <= 0:
                    continue

                cost = shares * price * 0.00015  # 매수 수수료
                total_buy = shares * price + cost

                pos_key = f"{axis}_{ticker}"
                if total_buy <= self.cash:
                    self.positions[pos_key] = {
                        'shares': shares, 'cost': price, 'axis': axis, 'ticker': ticker
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
# 6. 메인 백테스트
# ============================================================

def main():
    print("=" * 75)
    print("  주픽(JooPick) 전체 자동화 시스템 백테스트")
    print("  3축: 단기 Quant + 중기 혼합 + 장기 Fundamental")
    print("  Board: 10명 Quant Board 투표 시뮬레이션")
    print("  Crisis: Management Layer v2")
    print("  실행:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 75)

    START = "20190101"
    END = "20260410"

    # ---- Step 1: 유니버스 구성 ----
    print("\n[Step 1] 유니버스 구성 중...")

    # 고정 유니버스 (시총 상위, 2024 기준)
    KOSPI_TOP = [
        '005930',  # 삼성전자
        '000660',  # SK하이닉스
        '373220',  # LG에너지솔루션
        '207940',  # 삼성바이오로직스
        '005380',  # 현대차
        '000270',  # 기아
        '068270',  # 셀트리온
        '035420',  # NAVER
        '005490',  # POSCO홀딩스
        '055550',  # 신한지주
        '035720',  # 카카오
        '012330',  # 현대모비스
        '105560',  # KB금융
        '028260',  # 삼성물산
        '051910',  # LG화학
        '006400',  # 삼성SDI
        '003550',  # LG
        '066570',  # LG전자
        '032830',  # 삼성생명
        '034730',  # SK
    ]

    KOSDAQ_TOP = [
        '247540',  # 에코프로비엠
        '086520',  # 에코프로
        '091990',  # 셀트리온헬스케어
        '196170',  # 알테오젠
        '263750',  # 펄어비스
        '035900',  # JYP엔터
        '293490',  # 카카오게임즈
        '041510',  # 에스엠
        '112040',  # 위메이드
        '328130',  # 루닛
    ]

    universe = {
        'short_term': KOSDAQ_TOP + KOSPI_TOP[10:20],  # 중소형 + KOSPI 중위
        'mid_term': KOSPI_TOP[:20],                     # KOSPI 상위 20
        'long_term': KOSPI_TOP[:10],                    # 대형 가치주
    }
    all_tickers = list(set(KOSPI_TOP + KOSDAQ_TOP))
    print(f"  → 유니버스: KOSPI {len(KOSPI_TOP)}종목 + KOSDAQ {len(KOSDAQ_TOP)}종목 = {len(all_tickers)}종목")

    # ---- Step 2: 데이터 수집 ----
    print(f"\n[Step 2] {len(all_tickers)}종목 데이터 수집 중...")
    stock_data = {}
    success = 0
    for i, ticker in enumerate(all_tickers):
        df = fetch_stock_data(ticker, START, END)
        if df is not None and len(df) > 100:
            stock_data[ticker] = df
            success += 1
        if (i + 1) % 10 == 0:
            print(f"  → {i+1}/{len(all_tickers)} 완료 ({success} 성공)")
            time.sleep(1)  # API 부하 방지

    print(f"  → 최종 {success}/{len(all_tickers)} 종목 데이터 확보")

    if success < 10:
        print("❌ 데이터 부족, 중단")
        return

    # ---- Step 3: 기준 종목 (삼성전자) 레짐 감지용 ----
    ref = stock_data.get('005930')
    if ref is None:
        print("❌ 삼성전자 데이터 없음")
        return

    # MA200 추가 (레짐 감지)
    ref['ma200'] = ref['close'].rolling(200).mean()

    # ---- Step 4: 백테스트 실행 ----
    print("\n[Step 3] 백테스트 실행 중...")

    # 모델 포트폴리오
    INITIAL_CAPITAL = 1_000_000_000  # 10억 원
    model_port = Portfolio(INITIAL_CAPITAL)
    crisis = CrisisLayer(INITIAL_CAPITAL)

    # Buy & Hold (삼성전자)
    bh_start_price = ref['close'].iloc[0]

    # 월간 리밸런싱 날짜
    rebal_dates = ref.resample('ME').last().index  # 월말

    axis_weights = {'short_term': 0.30, 'mid_term': 0.40, 'long_term': 0.30}

    prev_month = None
    daily_returns_model = []
    daily_returns_bh = []

    for date in ref.index:
        # 레짐 감지
        idx = ref.index.get_loc(date)
        row = ref.iloc[idx]
        regime = detect_regime(row['close'], row.get('ma200', row['close']),
                              row.get('mom_60', 0))

        # 일간 수익률 (포트폴리오)
        port_val = model_port.get_total_value(stock_data, date)

        # Crisis Layer 업데이트
        vol_pct = row.get('vol_pct', 50)
        daily_ret = row.get('return', 0) if not pd.isna(row.get('return', 0)) else 0
        crisis_pct = crisis.update(vol_pct, daily_ret, port_val, regime)

        # 월간 리밸런싱
        current_month = date.month
        if prev_month is not None and current_month != prev_month:
            # Factor 스코어링
            factors = compute_factors(stock_data, date)

            if not factors.empty:
                # Board 투표 — 단기용
                short_factors = factors[factors['ticker'].isin(universe['short_term'])]
                short_picks = board_vote(short_factors, top_n=5)

                # 중기용 (멀티팩터 스코어 상위)
                mid_factors = factors[factors['ticker'].isin(universe['mid_term'])]
                mid_picks = board_vote(mid_factors, top_n=7)

                # 장기용 (밸류+퀄리티 상위, 안정적 보유)
                long_factors = factors[factors['ticker'].isin(universe['long_term'])]
                if not long_factors.empty:
                    long_factors['long_score'] = (
                        long_factors.get('value_z', 0) * 0.4 +
                        long_factors.get('quality_z', 0) * 0.3 +
                        long_factors.get('low_vol_z', 0) * 0.3
                    )
                    long_picks = [{'ticker': r['ticker']} for _, r in
                                  long_factors.nlargest(5, 'long_score').iterrows()]
                else:
                    long_picks = []

                target = {
                    'short_term': short_picks,
                    'mid_term': mid_picks,
                    'long_term': long_picks,
                }

                total_picks = len(short_picks) + len(mid_picks) + len(long_picks)
                if total_picks > 0:
                    pre_val = model_port.get_total_value(stock_data, date)
                    pre_cash = model_port.cash
                    pre_pos = len(model_port.positions)
                    model_port.rebalance(target, stock_data, date, crisis_pct, axis_weights)
                    post_val = model_port.get_total_value(stock_data, date)
                    post_cash = model_port.cash
                    post_pos = len(model_port.positions)
                    if date.year <= 2019 or date.month in [1, 4, 7, 10]:
                        print(f"  [{date.strftime('%Y-%m')}] 리밸런싱: 단기 {len(short_picks)} / 중기 {len(mid_picks)} / 장기 {len(long_picks)} 종목, Crisis {crisis_pct:.0%}")
                        print(f"    전: 총액 {pre_val/1e8:.1f}억 현금 {pre_cash/1e8:.1f}억 포지션 {pre_pos} → 후: 총액 {post_val/1e8:.1f}억 현금 {post_cash/1e8:.1f}억 포지션 {post_pos}")

        prev_month = current_month

        # 기록
        model_port.update_history(date, stock_data, regime, crisis_pct)

        # B&H 수익률
        bh_val = 100 * (row['close'] / bh_start_price)
        daily_returns_bh.append({'date': date, 'value': bh_val})

    # ---- Step 5: 결과 분석 ----
    print("\n[Step 4] 결과 분석 중...")

    model_hist = pd.DataFrame(model_port.history)
    bh_hist = pd.DataFrame(daily_returns_bh)

    if model_hist.empty:
        print("❌ 모델 결과 없음")
        return

    # 통계
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

        # Win Rate
        win = (daily_ret > 0).sum()
        total = (daily_ret != 0).sum()
        wr = win / total * 100 if total > 0 else 0

        # Monthly Win Rate
        hist_copy = hist_df.copy()
        hist_copy['month'] = pd.to_datetime(hist_copy['date']).dt.to_period('M')
        monthly = hist_copy.groupby('month')[val_col].apply(lambda x: x.iloc[-1]/x.iloc[0]-1 if len(x)>1 else 0)
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
    print(f"  3축 통합 백테스트 결과: 2019.01 ~ 2026.04 ({len(model_hist)}일)")
    print(f"  유니버스: {success}종목 | Board: 10명 Quant | Crisis Layer v2")
    print(f"{'='*75}")

    print(f"\n  {'지표':<25} {'Buy & Hold(삼성)':>18} {'주픽 3축 모델':>18} {'차이':>15}")
    print(f"  {'-'*76}")
    print(f"  {'총 수익률':<25} {bh_stats['total_return']:>+17.1f}% {model_stats['total_return']:>+17.1f}% {model_stats['total_return']-bh_stats['total_return']:>+14.1f}%p")
    print(f"  {'CAGR':<25} {bh_stats['cagr']:>+17.1f}% {model_stats['cagr']:>+17.1f}% {model_stats['cagr']-bh_stats['cagr']:>+14.1f}%p")
    print(f"  {'Max DD':<25} {bh_stats['max_dd']:>+17.1f}% {model_stats['max_dd']:>+17.1f}% {model_stats['max_dd']-bh_stats['max_dd']:>+14.1f}%p")
    print(f"  {'Sharpe':<25} {bh_stats['sharpe']:>18.2f} {model_stats['sharpe']:>18.2f} {model_stats['sharpe']-bh_stats['sharpe']:>+15.2f}")
    print(f"  {'Calmar':<25} {bh_stats['calmar']:>18.2f} {model_stats['calmar']:>18.2f} {model_stats['calmar']-bh_stats['calmar']:>+15.2f}")
    print(f"  {'일간 Win Rate':<25} {bh_stats['daily_wr']:>17.1f}% {model_stats['daily_wr']:>17.1f}%")
    print(f"  {'월간 Win Rate':<25} {bh_stats['monthly_wr']:>17.1f}% {model_stats['monthly_wr']:>17.1f}%")
    print(f"  {'거래 횟수':<25} {'0':>18} {model_port.trades:>18}")
    print(f"  {'총 비용':<25} {'0':>18} {model_port.total_cost:>17.1f}")

    # 연도별
    print(f"\n{'='*75}")
    print(f"  연도별 성과")
    print(f"{'='*75}")

    model_hist['year'] = pd.to_datetime(model_hist['date']).dt.year
    bh_hist['year'] = pd.to_datetime(bh_hist['date']).dt.year

    years = sorted(model_hist['year'].unique())
    print(f"\n  {'연도':<8} {'B&H 수익률':>12} {'모델 수익률':>12} {'B&H DD':>10} {'모델 DD':>10} {'레짐':>20}")
    print(f"  {'-'*72}")

    for y in years:
        my = model_hist[model_hist['year'] == y]
        by = bh_hist[bh_hist['year'] == y]

        if len(my) < 10 or len(by) < 10:
            continue

        m_ret = (my['value'].iloc[-1] / my['value'].iloc[0] - 1) * 100
        b_ret = (by['value'].iloc[-1] / by['value'].iloc[0] - 1) * 100

        m_peak = my['value'].cummax()
        m_dd = ((my['value'] - m_peak) / m_peak).min() * 100

        b_peak = by['value'].cummax()
        b_dd = ((by['value'] - b_peak) / b_peak).min() * 100

        regime_counts = my['regime'].value_counts()
        regime_str = ', '.join([f"{k}:{v}" for k, v in regime_counts.head(2).items()])

        print(f"  {y:<8} {b_ret:>+11.1f}% {m_ret:>+11.1f}% {b_dd:>+9.1f}% {m_dd:>+9.1f}% {regime_str:>20}")

    # 위기 구간
    print(f"\n{'='*75}")
    print(f"  위기 구간 분석 (모델 DD 상위 5일)")
    print(f"{'='*75}")

    worst = model_hist.nsmallest(5, 'dd')
    print(f"\n  {'날짜':<15} {'DD':>10} {'포지션수':>10} {'현금비중':>10} {'레짐':>10} {'Crisis':>10}")
    print(f"  {'-'*65}")
    for _, r in worst.iterrows():
        print(f"  {str(r['date'])[:10]:<15} {r['dd']:>+9.1%} {r['positions']:>10} {r['cash_pct']:>9.0%} {r['regime']:>10} {r['crisis_pct']:>9.0%}")

    print(f"\n{'='*75}")
    print(f"  ⚠️ 30종목 유니버스 기반 실제 자동화 시스템 시뮬레이션")
    print(f"  ⚠️ Quant Board 10명 투표 + Crisis Layer v2 반영")
    print(f"  ⚠️ 외국인 수급은 거래량 proxy, PBR은 12M 저점 proxy")
    print(f"{'='*75}")


if __name__ == "__main__":
    main()
