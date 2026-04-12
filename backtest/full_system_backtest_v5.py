"""
주픽(JooPick) 전체 자동화 시스템 백테스트 v5
=============================================
핵심 원칙: "풀 투자 유지 + 위기에만 현금화"

삼성전자 B&H CAGR 26.6%를 이기는 유일한 방법:
→ 삼성전자의 -45% DD를 회피하면, 동일 종목으로도 복리로 이김
→ 거래 최소화 (비용률 < 3%)
→ 위기 회피 + 빠른 복귀가 진짜 알파

v4 대비 변경:
- 트렌드 이탈 매도 제거 (비용 폭탄)
- 월간 리밸런싱만 (단기도 월간)
- 투자율 기본 100% (Crisis 시에만 축소)
- 집중 투자 유지 (축당 3-4종목)
- Crisis Layer 초보수적: 크래시 시에만 발동
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
        kp = krx.get_market_cap(date_str, market="KOSPI")
        kp_top = kp.nlargest(25, '시가총액').index.tolist()
        kd = krx.get_market_cap(date_str, market="KOSDAQ")
        kd_top = kd.nlargest(15, '시가총액').index.tolist()
        return {
            'short_term': kd_top[:10] + kp_top[15:25],
            'mid_term': kp_top[:20],
            'long_term': kp_top[:10],
            'all': list(set(kp_top + kd_top)),
        }
    except:
        return None


# ============================================================
# 2. 종목 선정 (모멘텀+수급 스코어, MA20 필터)
# ============================================================

def select_stocks(stock_data, tickers, date, axis, top_n=3):
    """점수 상위 + MA20 이상 필터"""
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

        # MA20 필터 (트렌드 진입)
        if close < ma20 * 0.98 and axis != 'long_term':
            continue

        # 모멘텀 (축별)
        m5 = row.get('mom_5', 0); m10 = row.get('mom_10', 0)
        m20 = row.get('mom_20', 0); m60 = row.get('mom_60', 0)
        for v_name in ['m5', 'm10', 'm20', 'm60']:
            v = locals()[v_name]
            if pd.isna(v): locals()[v_name] = 0
        if pd.isna(m5): m5 = 0
        if pd.isna(m10): m10 = 0
        if pd.isna(m20): m20 = 0
        if pd.isna(m60): m60 = 0

        if axis == 'short_term':
            mom = m5 * 0.4 + m10 * 0.35 + m20 * 0.25
        elif axis == 'mid_term':
            mom = m10 * 0.25 + m20 * 0.40 + m60 * 0.35
        else:
            mom = m20 * 0.3 + m60 * 0.7

        # 수급
        vr = row.get('vol_ratio', 1)
        if pd.isna(vr): vr = 1
        flow = (vr - 1) * 2

        # 퀄리티
        ret_std = df['return'].iloc[max(0, idx-60):idx+1].std()
        quality = 1 / (ret_std * np.sqrt(252) + 0.01) if ret_std > 0 else 1

        # RSI (과매수 경계)
        rsi = row.get('rsi', 50)
        if pd.isna(rsi): rsi = 50

        # 축별 가중 종합
        if axis == 'short_term':
            score = mom * 0.45 + flow * 0.35 + quality * 0.20
        elif axis == 'mid_term':
            score = mom * 0.35 + flow * 0.30 + quality * 0.35
        else:
            score = mom * 0.25 + flow * 0.15 + quality * 0.60

        records.append({
            'ticker': ticker, 'score': score, 'close': close, 'rsi': rsi,
        })

    records.sort(key=lambda x: x['score'], reverse=True)
    # RSI 과매수 필터 (단기만)
    if axis == 'short_term':
        records = [r for r in records if r['rsi'] < 78]
    return records[:top_n]


# ============================================================
# 3. 레짐 감지
# ============================================================

def detect_regime(row):
    c = row['close']
    ma20 = row.get('ma20', c); ma60 = row.get('ma60', c)
    ma200 = row.get('ma200', c); m20 = row.get('mom_20', 0)
    for v in [ma20, ma60, ma200, m20]:
        if pd.isna(v): return 'sideways'

    bull = bear = 0
    if c > ma20: bull += 1
    else: bear += 1
    if c > ma60: bull += 1
    else: bear += 1
    if c > ma200: bull += 1
    else: bear += 1
    if ma20 > ma60: bull += 1
    else: bear += 1
    if m20 > 0.01: bull += 1
    elif m20 < -0.01: bear += 1

    if bull >= 4: return 'bull'
    if bear >= 4: return 'bear'
    return 'sideways'


# ============================================================
# 4. Crisis Layer v5 (초보수적: 크래시에만 발동)
# ============================================================

class CrisisLayer:
    """
    기본 100%. 크래시에만 축소.
    - 일간 -6% 이상: 즉시 15%
    - 5일 연속하락 + -2%: 30%
    - Bear+고변동성(>90%ile): 65%
    - 그 외: 100% (bull), 95% (sideways), 65% (bear)
    """

    def __init__(self, cap):
        self.pos = 1.0
        self.peak = cap
        self.in_crisis = False
        self.re_step = 0
        self.re_days = 0
        self.crisis_vol = 0
        self.streak = 0

    def update(self, vol_pct, dr, pv, regime, rsi=50):
        if pd.isna(vol_pct): vol_pct = 50
        if pd.isna(rsi): rsi = 50
        if pv > self.peak: self.peak = pv

        if dr < -0.005: self.streak += 1
        else: self.streak = 0

        # 크래시
        if dr < -0.06:
            self.in_crisis = True
            self.re_step = 0
            self.crisis_vol = vol_pct
            self.pos = 0.15
            return self.pos

        if self.streak >= 5 and dr < -0.015:
            self.in_crisis = True
            self.re_step = 0
            self.crisis_vol = vol_pct
            self.pos = 0.30
            return self.pos

        # 기본: 풀 투자
        target = {'bull': 1.0, 'sideways': 0.95, 'bear': 0.70}.get(regime, 0.95)

        # Bear 고변동성
        if regime == 'bear' and vol_pct > 90:
            target = min(target, 0.45)

        # DD 서킷 (매우 보수적)
        dd = (pv - self.peak) / self.peak if self.peak > 0 else 0
        if dd < -0.25: target = min(target, 0.30)
        elif dd < -0.18: target = min(target, 0.55)

        # RSI
        if rsi < 22 and regime != 'bear':
            target = min(target * 1.15, 1.0)

        # 위기 탈출 (빠른 복귀)
        if self.in_crisis:
            vd = (self.crisis_vol - vol_pct) / max(self.crisis_vol, 1)
            speed = 2 if regime == 'bull' else (3 if regime == 'sideways' else 6)
            steps = [0.40, 0.70, 0.90, 1.0]
            if vd > 0.15 or (regime == 'bull' and vd > 0.05):
                self.re_days += 1
                if self.re_days >= speed and self.re_step < len(steps):
                    target = steps[self.re_step]
                    self.re_step += 1
                    self.re_days = 0
                    if self.re_step >= len(steps): self.in_crisis = False
            else:
                target = min(target, 0.20)

        # 속도
        if target < self.pos:
            self.pos = max(target, self.pos - 0.60)
        else:
            self.pos = min(target, self.pos + 0.35)

        self.pos = max(0.10, min(1.0, self.pos))
        return self.pos


# ============================================================
# 5. 포트폴리오 (최소 거래)
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
            c = val * 0.00245  # 매도세+수수료
            self.cash += val - c
            self.cost += c
            self.trades += 1
        del self.positions[pk]

    def rebalance(self, targets, sd, date, crisis_pct, ax_w):
        """월간 부분 리밸런싱"""
        total = self.get_value(sd, date)
        if total <= 0: total = self.cash

        for axis, picks in targets.items():
            target_set = {p['ticker'] for p in picks}

            # 비-타겟만 청산
            for pk in list(self.positions.keys()):
                if self.positions[pk]['axis'] == axis and \
                   self.positions[pk]['ticker'] not in target_set:
                    self._sell(pk, sd, date)

            # 신규 매수
            ax_cap = total * ax_w[axis] * crisis_pct
            exist = sum(
                p['shares'] * (self._price(sd, p['ticker'], date) or 0)
                for p in self.positions.values() if p['axis'] == axis
            )
            remain = max(0, ax_cap - exist)
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
                buy = shares * price + c
                pk = f"{axis}_{ticker}"
                if buy <= self.cash:
                    self.positions[pk] = {
                        'shares': shares, 'cost': price, 'axis': axis,
                        'ticker': ticker
                    }
                    self.cash -= buy
                    self.cost += c
                    self.trades += 1

    def crisis_liquidate(self, sd, date, keep_pct=0.15):
        """위기 시 대량 청산: keep_pct만 남기고 전부 매도"""
        total = self.get_value(sd, date)
        invested = total - self.cash
        target_invested = total * keep_pct
        to_sell = invested - target_invested

        if to_sell <= 0:
            return

        # 손실 큰 순서로 매도
        pos_list = []
        for pk, p in self.positions.items():
            price = self._price(sd, p['ticker'], date)
            if price and price > 0:
                ret = (price - p['cost']) / p['cost']
                pos_list.append((pk, ret, p['shares'] * price))
        pos_list.sort(key=lambda x: x[1])

        sold = 0
        for pk, ret, val in pos_list:
            if sold >= to_sell:
                break
            self._sell(pk, sd, date)
            sold += val

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
    print("  주픽 자동화 백테스트 v5: 풀투자 + 위기회피 = 복리알파")
    print("  실행:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 80)

    START, END = "20190101", "20260410"
    CAP = 1_000_000_000

    # 유니버스
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

    # 데이터
    print("\n[2] 데이터...")
    sd = {}
    ok = 0
    for i, t in enumerate(uni['all']):
        df = fetch_stock_data(t, START, END)
        if df is not None and len(df) > 100:
            sd[t] = df; ok += 1
        if (i+1) % 10 == 0:
            print(f"  → {i+1}/{len(uni['all'])} ({ok})")
            time.sleep(1)
    print(f"  → {ok}종목")

    ref = sd.get('005930')
    if ref is None: print("❌"); return

    # 실행
    print("\n[3] 백테스트...")
    port = Portfolio(CAP)
    crisis = CrisisLayer(CAP)
    bh_start = ref['close'].iloc[0]
    ax_w = {'short_term': 0.30, 'mid_term': 0.40, 'long_term': 0.30}
    # 축별 리밸런싱 주기 (영업일)
    FREQ = {'short_term': 21, 'mid_term': 42, 'long_term': 63}
    last_rb = {'short_term': 0, 'mid_term': 0, 'long_term': 0}
    prev_q = None
    bh_list = []
    prev_crisis = 1.0

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

        # 위기 진입 감지: crisis가 급락하면 즉시 청산
        if cp < 0.35 and prev_crisis >= 0.50 and len(port.positions) > 0:
            port.crisis_liquidate(sd, date, keep_pct=cp)

        prev_crisis = cp

        # 분기 유니버스
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

        # 리밸런싱 (월간 기본)
        if di > 120:
            axes = [a for a, f in FREQ.items() if di - last_rb[a] >= f]
            if axes and cp >= 0.50:  # Crisis < 50% 일 때는 리밸런싱 안 함
                target = {}
                for axis in axes:
                    a_tickers = [t for t in uni.get(axis, []) if t in sd]
                    top_n = {'short_term': 4, 'mid_term': 5, 'long_term': 4}[axis]
                    picks = select_stocks(sd, a_tickers, date, axis, top_n)
                    target[axis] = picks
                    last_rb[axis] = di

                if sum(len(v) for v in target.values()) > 0:
                    port.rebalance(target, sd, date, cp, ax_w)

                    if date.month in [1,4,7,10] and date.day <= 10:
                        pk_str = '/'.join(f"{len(target.get(a,[]))}" for a in axes)
                        invested = (1 - port.cash / max(pv, 1)) * 100
                        print(f"  [{date.strftime('%Y-%m')}] ({'+'.join(a[0] for a in axes)}): {pk_str}종목 Crisis={cp:.0%} {regime} 투자={invested:.0f}% 포트={pv/1e8:.0f}억")

        port.record(date, sd, regime, cp)
        bh_list.append({'date': date, 'value': 100 * (row['close'] / bh_start)})

    # 결과
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
    print(f"  v5 결과: 2019.01~2026.04 ({len(mh)}일)")
    print(f"  풀투자 기본 | 월간 리밸런싱 | 위기에만 현금화 | 비용 최소화")
    print(f"{'='*80}")

    print(f"\n  {'지표':<22} {'B&H(삼성)':>14} {'주픽 v5':>14} {'차이':>12}")
    print(f"  {'-'*62}")
    for l,k in [('총 수익률','tot'),('CAGR','cagr'),('Max DD','dd')]:
        print(f"  {l:<22} {bs[k]:>+13.1f}% {ms[k]:>+13.1f}% {ms[k]-bs[k]:>+11.1f}%p")
    for l,k in [('Sharpe','sh'),('Calmar','cal')]:
        print(f"  {l:<22} {bs[k]:>14.2f} {ms[k]:>14.2f} {ms[k]-bs[k]:>+12.2f}")
    for l,k in [('일간 Win Rate','dwr'),('월간 Win Rate','mwr')]:
        print(f"  {l:<22} {bs[k]:>13.1f}% {ms[k]:>13.1f}%")
    print(f"  {'거래 횟수':<22} {'0':>14} {port.trades:>14}")
    print(f"  {'비용률':<22} {'0%':>14} {port.cost/CAP*100:>13.2f}%")

    # 연도별
    print(f"\n{'='*80}")
    print(f"  연도별 성과")
    print(f"{'='*80}")
    mh['y'] = pd.to_datetime(mh['date']).dt.year
    bh['y'] = pd.to_datetime(bh['date']).dt.year
    print(f"\n  {'연도':<6} {'B&H':>9} {'모델':>9} {'초과':>9} {'B&H DD':>8} {'모델DD':>8} {'월WR':>6} {'Avg투자':>8} {'레짐':>22}")
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
        avg_inv=(1-my['cash_pct'].mean())*100
        rc=my['regime'].value_counts()
        rs=', '.join(f"{k}:{v}" for k,v in rc.head(2).items())
        print(f"  {y:<6} {br:>+8.1f}% {mr:>+8.1f}% {mr-br:>+8.1f}% {bdd:>+7.1f}% {mdd:>+7.1f}% {mwr:>5.0f}% {avg_inv:>7.0f}% {rs:>22}")

    # 위기 구간
    print(f"\n  위기 방어 Top 5:")
    for _,r in mh.nsmallest(5,'dd').iterrows():
        print(f"    {str(r['date'])[:10]} DD={r['dd']:>+6.1%} pos={r['pos']} cash={r['cash_pct']:.0%} {r['regime']} crisis={r['crisis']:.0%}")

    # 위기 회피 효과
    print(f"\n  위기 회피 효과:")
    covid = mh[(mh['date'] >= '2020-02-01') & (mh['date'] <= '2020-04-30')]
    bh_covid = bh[(bh['date'] >= '2020-02-01') & (bh['date'] <= '2020-04-30')]
    if len(covid) > 0 and len(bh_covid) > 0:
        m_covid_dd = ((covid['value'] - covid['value'].cummax()) / covid['value'].cummax()).min() * 100
        b_covid_dd = ((bh_covid['value'] - bh_covid['value'].cummax()) / bh_covid['value'].cummax()).min() * 100
        print(f"    COVID (2020.02~04): B&H DD {b_covid_dd:.1f}% → 모델 DD {m_covid_dd:.1f}% (회피 {abs(b_covid_dd-m_covid_dd):.1f}%p)")

    print(f"\n{'='*80}")
    print(f"  설계 원칙: 풀투자 유지 + 크래시에만 현금화 + 빠른 복귀 = 복리 알파")
    print(f"{'='*80}")


if __name__ == "__main__":
    main()
