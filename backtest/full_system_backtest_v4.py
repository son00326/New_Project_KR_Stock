"""
주픽(JooPick) 전체 자동화 시스템 백테스트 v4
=============================================
핵심 전략 변경: 트렌드 팔로잉 + 집중 투자 + 빠른 손절

v3 대비 핵심 변경:
- 집중 투자: 축당 3종목 (최대 9종목)
- 트렌드 엔트리: MA20 이상 + 양의 모멘텀만 매수
- 트렌드 이탈 즉시 매도: 종가 < MA20 시 다음날 청산
- 단기축 5영업일 리밸런싱
- 풀 투자 기본 (Bear에서만 축소)
- 모멘텀 스코어 최적화 (5/10/20일 가중)
"""

import sys, warnings, time
warnings.filterwarnings('ignore')
from datetime import datetime
import pandas as pd
import numpy as np
from pykrx import stock as krx


# ============================================================
# 1. 데이터
# ============================================================

def fetch_stock_data(ticker, start, end):
    try:
        df = krx.get_market_ohlcv(start, end, ticker)
        if len(df) < 60: return None
        df.columns = ['open', 'high', 'low', 'close', 'volume', 'change']
        df['return'] = df['close'].pct_change()
        df['ma5'] = df['close'].rolling(5).mean()
        df['ma10'] = df['close'].rolling(10).mean()
        df['ma20'] = df['close'].rolling(20).mean()
        df['ma60'] = df['close'].rolling(60).mean()
        df['ma120'] = df['close'].rolling(120).mean()
        df['ma200'] = df['close'].rolling(200).mean()

        delta = df['close'].diff()
        gain = delta.where(delta > 0, 0).rolling(14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
        rs = gain / loss.replace(0, np.nan)
        df['rsi'] = 100 - (100 / (1 + rs))

        df['vol_20'] = df['return'].rolling(20).std() * np.sqrt(252) * 100
        df['vol_pct'] = df['vol_20'].rolling(252, min_periods=60).apply(
            lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, raw=False)

        df['mom_5'] = df['close'].pct_change(5)
        df['mom_10'] = df['close'].pct_change(10)
        df['mom_20'] = df['close'].pct_change(20)
        df['mom_60'] = df['close'].pct_change(60)

        df['vol_ma5'] = df['volume'].rolling(5).mean()
        df['vol_ma20'] = df['volume'].rolling(20).mean()
        df['vol_ratio'] = df['vol_ma5'] / df['vol_ma20'].replace(0, 1)
        df['ticker'] = ticker
        return df
    except:
        return None


def get_dynamic_universe(date_str):
    try:
        kospi = krx.get_market_cap(date_str, market="KOSPI")
        kospi_top = kospi.nlargest(25, '시가총액').index.tolist()
        kosdaq = krx.get_market_cap(date_str, market="KOSDAQ")
        kosdaq_top = kosdaq.nlargest(15, '시가총액').index.tolist()
        return {
            'short_term': kosdaq_top[:10] + kospi_top[15:25],
            'mid_term': kospi_top[:20],
            'long_term': kospi_top[:10],
            'all': list(set(kospi_top + kosdaq_top)),
        }
    except:
        return None


# ============================================================
# 2. 모멘텀+수급 스코어링 (한국시장 최적화)
# ============================================================

def score_stocks(stock_data, tickers, date, axis):
    """축별 최적화 스코어링 + 트렌드 필터"""
    records = []
    for ticker in tickers:
        if ticker not in stock_data: continue
        df = stock_data[ticker]
        vd = df.index[df.index <= date]
        if len(vd) == 0: continue
        idx = df.index.get_loc(vd[-1])
        if idx < 120: continue
        row = df.iloc[idx]

        close = row['close']
        ma20 = row.get('ma20', close)
        if pd.isna(ma20): ma20 = close

        # 트렌드 필터: MA20 이상만 매수 후보
        if close < ma20 * 0.98:  # 2% 마진
            continue

        m5 = row.get('mom_5', 0) if not pd.isna(row.get('mom_5', 0)) else 0
        m10 = row.get('mom_10', 0) if not pd.isna(row.get('mom_10', 0)) else 0
        m20 = row.get('mom_20', 0) if not pd.isna(row.get('mom_20', 0)) else 0
        m60 = row.get('mom_60', 0) if not pd.isna(row.get('mom_60', 0)) else 0
        rsi = row.get('rsi', 50) if not pd.isna(row.get('rsi', 50)) else 50
        vr = row.get('vol_ratio', 1) if not pd.isna(row.get('vol_ratio', 1)) else 1

        # 축별 모멘텀 가중
        if axis == 'short_term':
            mom_score = m5 * 0.40 + m10 * 0.35 + m20 * 0.25
            flow_w, mom_w = 0.35, 0.45
        elif axis == 'mid_term':
            mom_score = m10 * 0.30 + m20 * 0.40 + m60 * 0.30
            flow_w, mom_w = 0.30, 0.35
        else:
            mom_score = m20 * 0.30 + m60 * 0.70
            flow_w, mom_w = 0.15, 0.25

        # 수급 (거래량 증가 = 매수세)
        flow_score = (vr - 1) * 2

        # 밸류/퀄리티 (장기축에 더 중요)
        ret_std = df['return'].iloc[max(0,idx-60):idx+1].std()
        quality = 1 / (ret_std * np.sqrt(252) + 0.01)
        low_12m = df['close'].iloc[max(0,idx-252):idx+1].min()
        value = 1 - (close - low_12m) / max(close, 1)

        if axis == 'long_term':
            total = mom_score * mom_w + flow_score * flow_w + quality * 0.30 + value * 0.30
        else:
            total = mom_score * mom_w + flow_score * flow_w + quality * 0.15 + value * 0.05

        records.append({
            'ticker': ticker, 'score': total, 'close': close,
            'rsi': rsi, 'mom_20': m20, 'ma20': ma20,
        })

    if not records:
        return []

    # 점수 상위 정렬
    records.sort(key=lambda x: x['score'], reverse=True)
    return records


# ============================================================
# 3. Quant Board (간소화: 스코어 기반 + 다양성 체크)
# ============================================================

BOARD_STYLES = [
    {'name': 'Momentum',  'mom_w': 1.5, 'flow_w': 1.0, 'val_w': 0.5},
    {'name': 'Flow',      'mom_w': 1.0, 'flow_w': 1.5, 'val_w': 0.5},
    {'name': 'Quality',   'mom_w': 0.8, 'flow_w': 0.8, 'val_w': 1.4},
    {'name': 'Balanced',  'mom_w': 1.0, 'flow_w': 1.0, 'val_w': 1.0},
    {'name': 'Aggressive','mom_w': 1.8, 'flow_w': 1.2, 'val_w': 0.3},
]

def board_select(scored_stocks, top_n=3):
    """Board 투표: 5개 스타일 중 3개 이상 동의 종목"""
    if len(scored_stocks) < 2:
        return scored_stocks[:top_n]

    # 각 스타일별 Top-N 선정
    votes = {}
    for stock in scored_stocks:
        votes[stock['ticker']] = {'stock': stock, 'count': 0}

    for style in BOARD_STYLES:
        # 스타일별 가중 점수 재계산
        for stock in scored_stocks:
            stock['style_score'] = stock['score']  # 이미 축별 최적화됨
        styled = sorted(scored_stocks, key=lambda x: x['style_score'], reverse=True)
        for s in styled[:top_n]:
            if s['ticker'] in votes:
                votes[s['ticker']]['count'] += 1

    # 과반 (3/5 이상) 동의 종목
    selected = [v['stock'] for v in votes.values()
                if v['count'] >= 3]
    selected.sort(key=lambda x: x['score'], reverse=True)

    if not selected:
        # 과반 없으면 점수 상위
        return scored_stocks[:top_n]

    return selected[:top_n]


# ============================================================
# 4. 레짐 + Crisis Layer
# ============================================================

def detect_regime(row):
    close = row['close']
    ma20 = row.get('ma20', close)
    ma60 = row.get('ma60', close)
    ma200 = row.get('ma200', close)
    m20 = row.get('mom_20', 0)
    m60 = row.get('mom_60', 0)

    for v in [ma20, ma60, ma200, m20, m60]:
        if pd.isna(v): return 'sideways'

    bull = 0
    bear = 0
    if close > ma20: bull += 1
    else: bear += 1
    if close > ma60: bull += 1
    else: bear += 1
    if close > ma200: bull += 1
    else: bear += 1
    if ma20 > ma60: bull += 1
    else: bear += 1
    if m20 > 0.01: bull += 1
    elif m20 < -0.01: bear += 1
    if m60 > 0.02: bull += 1
    elif m60 < -0.02: bear += 1

    if bull >= 5: return 'bull'
    if bear >= 5: return 'bear'
    return 'sideways'


class CrisisLayer:
    def __init__(self, cap):
        self.pos = 1.0
        self.peak = cap
        self.in_crisis = False
        self.re_step = 0
        self.re_days = 0
        self.crisis_vol = 0
        self.loss_streak = 0

    def update(self, vol_pct, daily_ret, port_val, regime, rsi=50):
        if pd.isna(vol_pct): vol_pct = 50
        if pd.isna(rsi): rsi = 50
        if port_val > self.peak: self.peak = port_val

        if daily_ret < -0.005: self.loss_streak += 1
        else: self.loss_streak = 0

        # 크래시
        if daily_ret < -0.06:
            self.in_crisis = True
            self.re_step = 0
            self.crisis_vol = vol_pct
            self.pos = 0.15
            return self.pos

        if self.loss_streak >= 5 and daily_ret < -0.015:
            self.in_crisis = True
            self.re_step = 0
            self.crisis_vol = vol_pct
            self.pos = 0.30
            return self.pos

        # 레짐 기반 (공격적)
        base = {'bull': 1.0, 'sideways': 0.95, 'bear': 0.65}
        target = base.get(regime, 0.95)

        # Bear + 고변동성
        if regime == 'bear' and vol_pct > 85:
            target = min(target, 0.40)

        # RSI
        if rsi < 25 and regime != 'bear':
            target = min(target * 1.15, 1.0)
        elif rsi > 82:
            target *= 0.92

        # DD 서킷
        dd = (port_val - self.peak) / self.peak if self.peak > 0 else 0
        if dd < -0.25: target = min(target, 0.30)
        elif dd < -0.18: target = min(target, 0.55)

        # 위기 탈출
        if self.in_crisis:
            vol_drop = (self.crisis_vol - vol_pct) / max(self.crisis_vol, 1)
            speed = 2 if regime == 'bull' else (3 if regime == 'sideways' else 7)
            steps = [0.40, 0.65, 0.85, 1.0]
            if vol_drop > 0.20 or (regime == 'bull' and vol_drop > 0.10):
                self.re_days += 1
                if self.re_days >= speed and self.re_step < len(steps):
                    target = steps[self.re_step]
                    self.re_step += 1
                    self.re_days = 0
                    if self.re_step >= len(steps): self.in_crisis = False
            else:
                target = min(target, 0.20)

        # 속도 제한
        if target < self.pos:
            self.pos = max(target, self.pos - 0.50)
        else:
            self.pos = min(target, self.pos + 0.30)

        self.pos = max(0.10, min(1.0, self.pos))
        return self.pos


# ============================================================
# 5. 포트폴리오
# ============================================================

class Portfolio:
    def __init__(self, cap):
        self.cap = cap
        self.peak = cap
        self.cash = cap
        self.positions = {}
        self.history = []
        self.trades = 0
        self.cost = 0
        self.stops = 0
        self.profits = 0

    def _price(self, sd, ticker, date):
        if ticker not in sd: return None
        df = sd[ticker]
        if date in df.index: return df.loc[date, 'close']
        v = df.index[df.index <= date]
        return df.loc[v[-1], 'close'] if len(v) > 0 else None

    def _sell(self, pk, sd, date):
        p = self.positions[pk]
        price = self._price(sd, p['ticker'], date)
        if price and price > 0:
            val = p['shares'] * price
            c = val * 0.00245
            self.cash += val - c
            self.cost += c
            self.trades += 1
        del self.positions[pk]

    def trend_exit(self, sd, date):
        """MA20 하향 돌파 시 즉시 매도 (트렌드 이탈)"""
        exits = 0
        for pk in list(self.positions.keys()):
            p = self.positions[pk]
            ticker = p['ticker']
            if ticker not in sd: continue
            df = sd[ticker]
            vd = df.index[df.index <= date]
            if len(vd) == 0: continue
            row = df.loc[vd[-1]]
            close = row['close']
            ma20 = row.get('ma20', close)
            if pd.isna(ma20): continue

            # 트렌드 이탈 조건
            axis = p['axis']
            if axis == 'short_term':
                # 단기: MA10 이탈 시 매도
                ma10 = row.get('ma10', close)
                if not pd.isna(ma10) and close < ma10 * 0.97:
                    self._sell(pk, sd, date)
                    exits += 1
            elif axis == 'mid_term':
                # 중기: MA20 이탈 시 매도
                if close < ma20 * 0.97:
                    self._sell(pk, sd, date)
                    exits += 1
            else:
                # 장기: MA60 이탈 시 매도
                ma60 = row.get('ma60', close)
                if not pd.isna(ma60) and close < ma60 * 0.97:
                    self._sell(pk, sd, date)
                    exits += 1

        return exits

    def stop_loss(self, sd, date):
        """하드 손절"""
        stops = {'short_term': -0.08, 'mid_term': -0.10, 'long_term': -0.13}
        for pk in list(self.positions.keys()):
            p = self.positions[pk]
            price = self._price(sd, p['ticker'], date)
            if price and price > 0 and p['cost'] > 0:
                ret = (price - p['cost']) / p['cost']
                if ret < stops.get(p['axis'], -0.10):
                    self._sell(pk, sd, date)
                    self.stops += 1

    def take_profit(self, sd, date):
        takes = {'short_term': 0.15, 'mid_term': 0.25, 'long_term': 0.35}
        for pk in list(self.positions.keys()):
            p = self.positions[pk]
            price = self._price(sd, p['ticker'], date)
            if price and price > 0 and p['cost'] > 0:
                ret = (price - p['cost']) / p['cost']
                take = takes.get(p['axis'], 0.25)
                if ret > take and p['shares'] > 1:
                    sell_n = p['shares'] // 2
                    val = sell_n * price
                    c = val * 0.00245
                    self.cash += val - c
                    self.cost += c
                    self.trades += 1
                    p['shares'] -= sell_n
                    p['cost'] = price
                    self.profits += 1

    def rebalance(self, targets, sd, date, crisis_pct, ax_w, axes):
        total = self.get_value(sd, date)
        if total <= 0: total = self.cash

        for axis in axes:
            picks = targets.get(axis, [])
            target_set = {p['ticker'] for p in picks}

            # 비-타겟만 청산
            for pk in list(self.positions.keys()):
                if self.positions[pk]['axis'] == axis and \
                   self.positions[pk]['ticker'] not in target_set:
                    self._sell(pk, sd, date)

            # 신규 매수
            ax_cap = total * ax_w[axis] * crisis_pct
            exist_val = sum(
                p['shares'] * (self._price(sd, p['ticker'], date) or 0)
                for p in self.positions.values() if p['axis'] == axis
            )
            remain = max(0, ax_cap - exist_val)
            new_picks = [p for p in picks
                         if f"{axis}_{p['ticker']}" not in self.positions]
            if not new_picks or remain < 100000: continue
            per = remain / len(new_picks)

            for pick in new_picks:
                ticker = pick['ticker']
                price = self._price(sd, ticker, date)
                if not price or price <= 0: continue
                shares = int(per / price)
                if shares <= 0: continue
                c = shares * price * 0.00015
                buy_total = shares * price + c
                pk = f"{axis}_{ticker}"
                if buy_total <= self.cash:
                    self.positions[pk] = {
                        'shares': shares, 'cost': price, 'axis': axis,
                        'ticker': ticker, 'entry': date
                    }
                    self.cash -= buy_total
                    self.cost += c
                    self.trades += 1

    def get_value(self, sd, date):
        v = self.cash
        for p in self.positions.values():
            price = self._price(sd, p['ticker'], date)
            if price and price > 0: v += p['shares'] * price
        return v

    def record(self, date, sd, regime, crisis):
        v = self.get_value(sd, date)
        if v > self.peak: self.peak = v
        dd = (v - self.peak) / self.peak
        self.history.append({
            'date': date, 'value': v, 'dd': dd,
            'pos': len(self.positions),
            'cash_pct': self.cash / max(v, 1),
            'regime': regime, 'crisis': crisis,
        })


# ============================================================
# 6. 메인
# ============================================================

def main():
    print("=" * 80)
    print("  주픽 자동화 시스템 백테스트 v4: 트렌드 팔로잉 + 집중 투자")
    print("  실행:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 80)

    START, END = "20190101", "20260410"
    CAP = 1_000_000_000

    print("\n[1] 유니버스...")
    uni = get_dynamic_universe("20190102")
    if not uni:
        KP = ['005930','000660','373220','207940','005380','000270','068270',
              '035420','005490','055550','035720','012330','105560','028260',
              '051910','006400','003550','066570','032830','034730',
              '096770','009150','017670','316140','010130']
        KD = ['247540','086520','091990','196170','263750','035900',
              '293490','041510','112040','328130','036570','251270',
              '145020','095340','403870']
        uni = {'short_term': KD[:10]+KP[15:25], 'mid_term': KP[:20],
               'long_term': KP[:10], 'all': list(set(KP+KD))}

    print(f"  → {len(uni['all'])}종목")

    print("\n[2] 데이터 수집...")
    sd = {}
    ok = 0
    for i, t in enumerate(uni['all']):
        df = fetch_stock_data(t, START, END)
        if df is not None and len(df) > 100:
            sd[t] = df
            ok += 1
        if (i+1) % 10 == 0:
            print(f"  → {i+1}/{len(uni['all'])} ({ok} ok)")
            time.sleep(1)
    print(f"  → {ok}종목 확보")

    ref = sd.get('005930')
    if ref is None: print("❌"); return

    print("\n[3] 백테스트...")
    port = Portfolio(CAP)
    crisis = CrisisLayer(CAP)
    bh_start = ref['close'].iloc[0]
    ax_w = {'short_term': 0.30, 'mid_term': 0.40, 'long_term': 0.30}
    FREQ = {'short_term': 5, 'mid_term': 15, 'long_term': 42}
    last_rb = {'short_term': 0, 'mid_term': 0, 'long_term': 0}
    prev_q = None
    bh_list = []

    for di, date in enumerate(ref.index):
        row = ref.iloc[di]
        regime = detect_regime(row)
        pv = port.get_value(sd, date)
        vpct = row.get('vol_pct', 50)
        dr = row.get('return', 0)
        if pd.isna(dr): dr = 0
        rsi = row.get('rsi', 50)
        if pd.isna(rsi): rsi = 50
        cp = crisis.update(vpct, dr, pv, regime, rsi)

        # 일간: 트렌드 이탈 매도 + 손절 + 익절
        if di > 120 and len(port.positions) > 0:
            port.trend_exit(sd, date)
            port.stop_loss(sd, date)
            port.take_profit(sd, date)

        # 분기 유니버스 갱신
        cq = f"{date.year}Q{(date.month-1)//3+1}"
        if prev_q and cq != prev_q:
            nu = get_dynamic_universe(date.strftime('%Y%m%d'))
            if nu:
                uni = nu
                for t in uni['all']:
                    if t not in sd:
                        df = fetch_stock_data(t, START, END)
                        if df is not None and len(df) > 100: sd[t] = df
        prev_q = cq

        # 리밸런싱
        if di > 120:
            axes = [a for a, f in FREQ.items() if di - last_rb[a] >= f]
            if axes:
                target = {}
                for axis in axes:
                    a_tickers = [t for t in uni.get(axis, []) if t in sd]
                    scored = score_stocks(sd, a_tickers, date, axis)
                    picks = board_select(scored, top_n=3)
                    target[axis] = picks
                    last_rb[axis] = di

                tot = sum(len(v) for v in target.values())
                if tot > 0:
                    port.rebalance(target, sd, date, cp, ax_w, axes)
                    if date.month in [1,4,7,10] and date.day <= 7:
                        ax_s = '+'.join(a[0] for a in axes)
                        pk_s = '/'.join(str(len(target.get(a,[]))) for a in axes)
                        print(f"  [{date.strftime('%Y-%m')}] ({ax_s}): {pk_s}종목 Crisis={cp:.0%} {regime} 포트={pv/1e8:.0f}억")

        port.record(date, sd, regime, cp)
        bh_list.append({'date': date, 'value': 100 * (row['close'] / bh_start)})

    # ---- 결과 ----
    print("\n[4] 결과...")
    mh = pd.DataFrame(port.history)
    bh = pd.DataFrame(bh_list)

    def stats(df, c='value'):
        t = (df[c].iloc[-1]/df[c].iloc[0]-1)*100
        ny = max(len(df)/252, 0.5)
        cagr = ((df[c].iloc[-1]/df[c].iloc[0])**(1/ny)-1)*100
        pk = df[c].cummax()
        dd = ((df[c]-pk)/pk).min()*100
        r = df[c].pct_change().dropna()
        sh = (r.mean()*252-0.035)/(r.std()*np.sqrt(252)) if r.std()>0 else 0
        cal = cagr/abs(dd) if dd!=0 else 0
        wr = (r>0).sum()/(r!=0).sum()*100 if (r!=0).sum()>0 else 0
        dc = df.copy()
        dc['m'] = pd.to_datetime(dc['date']).dt.to_period('M')
        mo = dc.groupby('m')[c].apply(lambda x: x.iloc[-1]/x.iloc[0]-1 if len(x)>1 else 0)
        mwr = (mo>0).sum()/len(mo)*100 if len(mo)>0 else 0
        return {'tot':t,'cagr':cagr,'dd':dd,'sh':sh,'cal':cal,'dwr':wr,'mwr':mwr}

    ms = stats(mh)
    bs = stats(bh)

    print(f"\n{'='*80}")
    print(f"  v4 결과: 2019.01~2026.04 ({len(mh)}일) | 트렌드팔로잉+집중투자")
    print(f"{'='*80}")
    print(f"\n  {'지표':<22} {'B&H(삼성)':>14} {'주픽 v4':>14} {'차이':>12}")
    print(f"  {'-'*62}")
    for l,k in [('총 수익률','tot'),('CAGR','cagr'),('Max DD','dd')]:
        print(f"  {l:<22} {bs[k]:>+13.1f}% {ms[k]:>+13.1f}% {ms[k]-bs[k]:>+11.1f}%p")
    for l,k in [('Sharpe','sh'),('Calmar','cal')]:
        print(f"  {l:<22} {bs[k]:>14.2f} {ms[k]:>14.2f} {ms[k]-bs[k]:>+12.2f}")
    for l,k in [('일간 Win Rate','dwr'),('월간 Win Rate','mwr')]:
        print(f"  {l:<22} {bs[k]:>13.1f}% {ms[k]:>13.1f}%")
    print(f"  {'거래':<22} {'0':>14} {port.trades:>14}")
    print(f"  {'손절/익절':<22} {'':>14} {port.stops:>6}/{port.profits:>6}")
    print(f"  {'비용률':<22} {'':>14} {port.cost/CAP*100:>13.2f}%")

    # 연도별
    print(f"\n{'='*80}")
    mh['y'] = pd.to_datetime(mh['date']).dt.year
    bh['y'] = pd.to_datetime(bh['date']).dt.year
    print(f"  {'연도':<6} {'B&H':>9} {'모델':>9} {'초과':>9} {'B&H DD':>8} {'모델DD':>8} {'월WR':>6} {'Avg투자':>8} {'레짐':>22}")
    print(f"  {'-'*90}")

    for y in sorted(mh['y'].unique()):
        my=mh[mh['y']==y]; by=bh[bh['y']==y]
        if len(my)<10: continue
        mr=(my['value'].iloc[-1]/my['value'].iloc[0]-1)*100
        br=(by['value'].iloc[-1]/by['value'].iloc[0]-1)*100
        mpk=my['value'].cummax(); mdd=((my['value']-mpk)/mpk).min()*100
        bpk=by['value'].cummax(); bdd=((by['value']-bpk)/bpk).min()*100
        mc=my.copy(); mc['m']=pd.to_datetime(mc['date']).dt.to_period('M')
        mo=mc.groupby('m')['value'].apply(lambda x: x.iloc[-1]/x.iloc[0]-1 if len(x)>1 else 0)
        mwr=(mo>0).sum()/len(mo)*100 if len(mo)>0 else 0
        avg_inv = (1-my['cash_pct'].mean())*100
        rc=my['regime'].value_counts()
        rs=', '.join(f"{k}:{v}" for k,v in rc.head(2).items())
        print(f"  {y:<6} {br:>+8.1f}% {mr:>+8.1f}% {mr-br:>+8.1f}% {bdd:>+7.1f}% {mdd:>+7.1f}% {mwr:>5.0f}% {avg_inv:>7.0f}% {rs:>22}")

    # 위기
    print(f"\n  위기 구간 Top 5:")
    for _,r in mh.nsmallest(5,'dd').iterrows():
        print(f"    {str(r['date'])[:10]} DD={r['dd']:>+6.1%} pos={r['pos']} cash={r['cash_pct']:.0%} {r['regime']} crisis={r['crisis']:.0%}")

    print(f"\n{'='*80}")


if __name__ == "__main__":
    main()
