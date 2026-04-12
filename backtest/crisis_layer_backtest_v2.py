"""
주픽(JooPick) Crisis Management Layer 백테스트 v2
==================================================
기간: 2019.01 ~ 2026.04 (전 기간)
대상: 삼성전자(005930) — KOSPI 대용
개선: VKOSPI 보정 + Bull/Bear 레짐 감지 + Alpha 모델 강화

v1 대비 개선점:
- VKOSPI proxy: 절대값 → 2년 백분위 기반 (과대추정 보정)
- 레짐 감지: 200일 MA 기반 Bull/Bear/Sideways 분류
- Alpha: 모멘텀(20/60일) + 평균회귀(RSI) + 변동성 조정
- 재진입: Bull 레짐에서 빠른 복귀, Bear에서 느린 복귀
- 비용: 매도세 0.23% + 수수료 0.015% (편도)
"""

import sys, warnings
warnings.filterwarnings('ignore')
from datetime import datetime
import pandas as pd
import numpy as np

try:
    from pykrx import stock as krx
except ImportError:
    print("ERROR: pip3 install pykrx"); sys.exit(1)


# ============================================================
# 1. 데이터 수집
# ============================================================

def fetch_data(start: str, end: str, ticker: str = "005930") -> pd.DataFrame:
    print(f"[데이터] {ticker} 수집: {start} ~ {end}")
    df = krx.get_market_ohlcv(start, end, ticker)
    if len(df) == 0:
        raise ValueError("데이터 0건")
    df.columns = ['open','high','low','close','volume','change_pct']
    df['return'] = df['close'].pct_change()
    df['log_return'] = np.log(df['close'] / df['close'].shift(1))

    # 기술 지표
    df['ma20'] = df['close'].rolling(20).mean()
    df['ma60'] = df['close'].rolling(60).mean()
    df['ma120'] = df['close'].rolling(120).mean()
    df['ma200'] = df['close'].rolling(200).mean()

    # RSI (14일)
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    df['rsi'] = 100 - (100 / (1 + rs))

    # 변동성 (20일, 60일)
    df['vol_20'] = df['return'].rolling(20).std() * np.sqrt(252) * 100
    df['vol_60'] = df['return'].rolling(60).std() * np.sqrt(252) * 100

    # 변동성 백분위 (252일 = 1년 기준)
    df['vol_percentile'] = df['vol_20'].rolling(252).apply(
        lambda x: pd.Series(x).rank(pct=True).iloc[-1] * 100, raw=False
    )

    # 모멘텀
    df['mom_20'] = df['close'].pct_change(20)
    df['mom_60'] = df['close'].pct_change(60)

    # 볼린저밴드 (20,2)
    df['bb_mid'] = df['close'].rolling(20).mean()
    df['bb_std'] = df['close'].rolling(20).std()
    df['bb_upper'] = df['bb_mid'] + 2 * df['bb_std']
    df['bb_lower'] = df['bb_mid'] - 2 * df['bb_std']
    df['bb_position'] = (df['close'] - df['bb_lower']) / (df['bb_upper'] - df['bb_lower'])

    print(f"  → {len(df)}일 데이터 수집 완료")
    return df


# ============================================================
# 2. 레짐 감지 (Bull / Bear / Sideways)
# ============================================================

def detect_regime(row) -> str:
    """200일 MA + 60일 모멘텀 기반 레짐 판단"""
    close = row['close']
    ma200 = row.get('ma200', close)
    mom_60 = row.get('mom_60', 0)

    if pd.isna(ma200) or pd.isna(mom_60):
        return 'sideways'

    if close > ma200 and mom_60 > 0.05:
        return 'bull'
    elif close < ma200 and mom_60 < -0.05:
        return 'bear'
    else:
        return 'sideways'


# ============================================================
# 3. Crisis Management Layer v2
# ============================================================

class CrisisLayerV2:
    """
    v2 개선점:
    - 변동성 백분위 기반 (절대값 아닌 상대 기준)
    - 레짐별 동적 파라미터
    - 빠른 재진입 (Bull 시장)
    """

    # 변동성 백분위 기반 포지션 (v1의 VKOSPI 절대값 대체)
    VOL_PERCENTILE_RULES = {
        50: 1.00,   # 하위 50%: 풀 포지션
        70: 0.80,   # 50~70%: 80%
        85: 0.50,   # 70~85%: 50%
        95: 0.25,   # 85~95%: 25%
        100: 0.10,  # 95~100%: 10% (극단)
    }

    # 레짐별 조정
    REGIME_MULTIPLIER = {
        'bull': 1.3,      # Bull: 포지션 30% 확대
        'sideways': 1.0,  # Sideways: 기본
        'bear': 0.7,      # Bear: 포지션 30% 축소
    }

    # 레짐별 재진입 속도
    REENTRY_SPEED = {
        'bull': 3,        # Bull: 3일마다 재진입
        'sideways': 5,    # Sideways: 5일
        'bear': 10,       # Bear: 10일
    }

    DAILY_DD_CIRCUIT = -0.03
    PORTFOLIO_MAX_DD = -0.08
    CRASH_DAILY = -0.07  # 일간 -7% = 크래시 (즉시 10%로)

    def __init__(self):
        self.position_pct = 1.0
        self.peak_portfolio = 100
        self.in_crisis = False
        self.reentry_step = 0
        self.reentry_steps = [0.25, 0.50, 0.75, 1.00]
        self.days_since_reentry = 0
        self.crisis_peak_vol = 0

    def get_position(self, vol_pct, daily_ret, portfolio_val, regime, rsi) -> float:
        if pd.isna(vol_pct):
            vol_pct = 50

        # 포트폴리오 피크 추적
        if portfolio_val > self.peak_portfolio:
            self.peak_portfolio = portfolio_val

        # ---- 위기 감지 ----

        # 1. 크래시 감지 (일간 -7% 이상)
        if daily_ret < self.CRASH_DAILY:
            self.in_crisis = True
            self.reentry_step = 0
            self.crisis_peak_vol = vol_pct
            self.position_pct = 0.10
            return self.position_pct

        # 2. 변동성 백분위 기반 포지션
        base_pct = 1.0
        for threshold, pct in sorted(self.VOL_PERCENTILE_RULES.items()):
            if vol_pct <= threshold:
                base_pct = pct
                break

        # 3. 레짐 조정
        regime_mult = self.REGIME_MULTIPLIER.get(regime, 1.0)
        target_pct = min(base_pct * regime_mult, 1.0)

        # 4. DD 서킷브레이커
        if daily_ret < self.DAILY_DD_CIRCUIT:
            target_pct = min(target_pct, 0.50)

        portfolio_dd = (portfolio_val - self.peak_portfolio) / self.peak_portfolio
        if portfolio_dd < self.PORTFOLIO_MAX_DD:
            target_pct = min(target_pct, 0.25)

        # 5. RSI 기반 보조 (과매도 시 약간 공격적)
        if not pd.isna(rsi):
            if rsi < 25 and regime != 'bear':
                target_pct = min(target_pct * 1.2, 1.0)  # 과매도 반등 기대
            elif rsi > 80:
                target_pct = target_pct * 0.85  # 과매수 경계

        # ---- 위기 탈출 / 재진입 ----
        if self.in_crisis:
            # 변동성이 위기 피크 대비 40% 하락하면 재진입 시작
            if self.crisis_peak_vol > 0:
                vol_drop = (self.crisis_peak_vol - vol_pct) / self.crisis_peak_vol
            else:
                vol_drop = 0

            reentry_speed = self.REENTRY_SPEED.get(regime, 5)

            if vol_drop > 0.40 or (regime == 'bull' and vol_drop > 0.25):
                self.days_since_reentry += 1
                if (self.days_since_reentry >= reentry_speed and
                    self.reentry_step < len(self.reentry_steps)):
                    target_pct = self.reentry_steps[self.reentry_step]
                    self.reentry_step += 1
                    self.days_since_reentry = 0

                    if self.reentry_step >= len(self.reentry_steps):
                        self.in_crisis = False
                        self.crisis_peak_vol = 0
            else:
                target_pct = min(target_pct, 0.15)
        else:
            if vol_pct > 95:
                self.crisis_peak_vol = vol_pct

        # 포지션 변경 속도 제한 (축소는 빠르게, 확대는 느리게)
        if target_pct < self.position_pct:
            self.position_pct = max(target_pct, self.position_pct - 0.40)  # 빠른 축소
        else:
            self.position_pct = min(target_pct, self.position_pct + 0.15)  # 느린 확대

        self.position_pct = max(0.05, min(1.0, self.position_pct))
        return self.position_pct


# ============================================================
# 4. Alpha 모델 (8전략 앙상블 근사)
# ============================================================

def compute_alpha(row, prev_rows=None) -> float:
    """
    8전략 앙상블의 간이 근사:
    1. 모멘텀 시그널 (20일/60일)
    2. 평균회귀 시그널 (RSI + 볼린저)
    3. 변동성 조정
    """
    alpha = 0.0

    mom20 = row.get('mom_20', 0)
    mom60 = row.get('mom_60', 0)
    rsi = row.get('rsi', 50)
    bb_pos = row.get('bb_position', 0.5)
    vol_pct = row.get('vol_percentile', 50)

    if pd.isna(mom20): mom20 = 0
    if pd.isna(mom60): mom60 = 0
    if pd.isna(rsi): rsi = 50
    if pd.isna(bb_pos): bb_pos = 0.5
    if pd.isna(vol_pct): vol_pct = 50

    # 1. 모멘텀 Alpha (추세 추종)
    if mom20 > 0.03 and mom60 > 0.05:  # 강한 상승 추세
        alpha += 0.0008  # 일간 +0.08%
    elif mom20 > 0 and mom60 > 0:
        alpha += 0.0004  # 약한 상승
    elif mom20 < -0.03 and mom60 < -0.05:
        alpha -= 0.0003  # 강한 하락 (숏 못하니 축소)

    # 2. 평균회귀 Alpha
    if rsi < 25 and bb_pos < 0.1:  # 극단 과매도
        alpha += 0.0010  # 반등 기대
    elif rsi > 80 and bb_pos > 0.95:  # 극단 과매수
        alpha -= 0.0005  # 차익실현

    # 3. 변동성 조정 (저변동성에서 alpha 높음)
    if vol_pct < 30:
        alpha *= 1.3  # 안정적 시장에서 전략 효과 ↑
    elif vol_pct > 80:
        alpha *= 0.5  # 혼란 시장에서 전략 효과 ↓

    return alpha


# ============================================================
# 5. 거래 비용
# ============================================================

def calc_cost(old_pct, new_pct, port_val):
    change = abs(new_pct - old_pct)
    if change < 0.02:
        return 0
    amount = port_val * change
    if new_pct < old_pct:  # 매도
        return amount * (0.00015 + 0.0023)
    else:  # 매수
        return amount * 0.00015


# ============================================================
# 6. 백테스트 실행
# ============================================================

def run_backtest(df, use_model=True, initial=100.0):
    crisis = CrisisLayerV2()
    port = initial
    peak = initial
    max_dd = 0
    costs = 0
    trades = 0
    pos = 1.0

    results = []

    for i, (date, row) in enumerate(df.iterrows()):
        ret = row['return'] if not pd.isna(row['return']) else 0
        vol_pct = row.get('vol_percentile', 50)
        rsi = row.get('rsi', 50)

        regime = detect_regime(row)

        old_pos = pos

        if use_model:
            pos = crisis.get_position(vol_pct, ret, port, regime, rsi)
            alpha = compute_alpha(row)
        else:
            pos = 1.0
            alpha = 0

        cost = calc_cost(old_pos, pos, port)
        costs += cost
        if abs(pos - old_pos) > 0.02:
            trades += 1

        daily_pnl = pos * (ret + alpha)
        port = port * (1 + daily_pnl) - cost

        if port > peak:
            peak = port
        dd = (port - peak) / peak
        if dd < max_dd:
            max_dd = dd

        results.append({
            'date': date, 'close': row['close'], 'return': ret,
            'vol_pct': vol_pct, 'regime': regime,
            'position': pos, 'portfolio': port,
            'daily_pnl': daily_pnl, 'dd': dd,
        })

    rdf = pd.DataFrame(results)

    # 통계
    total_ret = (rdf['portfolio'].iloc[-1] / initial - 1) * 100
    n_years = max(len(rdf) / 252, 0.5)
    cagr = ((rdf['portfolio'].iloc[-1] / initial) ** (1/n_years) - 1) * 100

    daily_pnls = rdf['daily_pnl'].dropna()
    sharpe = 0
    if daily_pnls.std() > 0:
        sharpe = (daily_pnls.mean() * 252 - 0.035) / (daily_pnls.std() * np.sqrt(252))

    calmar = cagr / abs(max_dd * 100) if max_dd != 0 else 0

    win_days = (daily_pnls > 0).sum()
    total_active = (daily_pnls != 0).sum()
    win_rate = win_days / total_active * 100 if total_active > 0 else 0

    # 월간 수익률 (Win Rate)
    rdf['month'] = pd.to_datetime(rdf['date']).dt.to_period('M')
    monthly = rdf.groupby('month')['daily_pnl'].sum()
    monthly_win = (monthly > 0).sum()
    monthly_total = len(monthly)
    monthly_win_rate = monthly_win / monthly_total * 100 if monthly_total > 0 else 0

    stats = {
        'total_return': total_ret,
        'cagr': cagr,
        'max_dd': max_dd * 100,
        'sharpe': sharpe,
        'calmar': calmar,
        'daily_win_rate': win_rate,
        'monthly_win_rate': monthly_win_rate,
        'trades': trades,
        'costs': costs,
        'final': rdf['portfolio'].iloc[-1],
    }
    return rdf, stats


# ============================================================
# 7. 연도별 분석
# ============================================================

def annual_breakdown(rdf, stats_label):
    rdf['year'] = pd.to_datetime(rdf['date']).dt.year
    years = sorted(rdf['year'].unique())

    print(f"\n  {'연도':<8} {'수익률':>10} {'Max DD':>10} {'Win Rate(월)':>12} {'레짐 분포':>30}")
    print(f"  {'-'*70}")

    for y in years:
        ydf = rdf[rdf['year'] == y]
        if len(ydf) < 10:
            continue

        yr_ret = (ydf['portfolio'].iloc[-1] / ydf['portfolio'].iloc[0] - 1) * 100
        yr_peak = ydf['portfolio'].cummax()
        yr_dd = ((ydf['portfolio'] - yr_peak) / yr_peak).min() * 100

        # 월간 Win Rate
        ydf_copy = ydf.copy()
        ydf_copy['month'] = pd.to_datetime(ydf_copy['date']).dt.to_period('M')
        monthly = ydf_copy.groupby('month')['daily_pnl'].sum()
        m_win = (monthly > 0).sum()
        m_total = len(monthly)
        m_wr = m_win / m_total * 100 if m_total > 0 else 0

        # 레짐 분포
        regime_counts = ydf['regime'].value_counts()
        regime_str = ', '.join([f"{k}:{v}" for k, v in regime_counts.items()])

        print(f"  {y:<8} {yr_ret:>+9.1f}% {yr_dd:>+9.1f}% {m_wr:>10.0f}% ({m_win}/{m_total})  {regime_str}")


# ============================================================
# 8. 메인
# ============================================================

def main():
    print("=" * 75)
    print("  주픽(JooPick) Crisis Management Layer 백테스트 v2")
    print("  개선: 변동성 백분위 + Bull/Bear 레짐 + Alpha 모델")
    print("  실행:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 75)

    # 전 기간 데이터 수집 (2019~2026)
    try:
        df = fetch_data("20190101", "20260410")
    except Exception as e:
        print(f"❌ 데이터 수집 실패: {e}")
        return

    # Buy & Hold
    print("\n[1/2] Buy & Hold 실행 중...")
    bh_df, bh_stats = run_backtest(df, use_model=False)

    # 주픽 모델 v2
    print("[2/2] 주픽 모델 v2 실행 중...")
    model_df, model_stats = run_backtest(df, use_model=True)

    # ============ 결과 출력 ============

    print(f"\n{'='*75}")
    print(f"  전체 기간 성과: 2019.01 ~ 2026.04 ({len(df)}일)")
    print(f"{'='*75}")

    print(f"\n  {'지표':<25} {'Buy & Hold':>15} {'주픽 v2':>15} {'차이':>15}")
    print(f"  {'-'*70}")
    print(f"  {'총 수익률':<25} {bh_stats['total_return']:>+14.1f}% {model_stats['total_return']:>+14.1f}% {model_stats['total_return']-bh_stats['total_return']:>+14.1f}%p")
    print(f"  {'CAGR (연간)':<25} {bh_stats['cagr']:>+14.1f}% {model_stats['cagr']:>+14.1f}% {model_stats['cagr']-bh_stats['cagr']:>+14.1f}%p")
    print(f"  {'Max Drawdown':<25} {bh_stats['max_dd']:>+14.1f}% {model_stats['max_dd']:>+14.1f}% {model_stats['max_dd']-bh_stats['max_dd']:>+14.1f}%p")
    print(f"  {'Sharpe Ratio':<25} {bh_stats['sharpe']:>15.2f} {model_stats['sharpe']:>15.2f} {model_stats['sharpe']-bh_stats['sharpe']:>+15.2f}")
    print(f"  {'Calmar Ratio':<25} {bh_stats['calmar']:>15.2f} {model_stats['calmar']:>15.2f} {model_stats['calmar']-bh_stats['calmar']:>+15.2f}")
    print(f"  {'일간 Win Rate':<25} {bh_stats['daily_win_rate']:>14.1f}% {model_stats['daily_win_rate']:>14.1f}%")
    print(f"  {'월간 Win Rate':<25} {bh_stats['monthly_win_rate']:>14.1f}% {model_stats['monthly_win_rate']:>14.1f}%")
    print(f"  {'거래 횟수':<25} {'0':>15} {model_stats['trades']:>15}")
    print(f"  {'총 비용':<25} {'0':>15} {model_stats['costs']:>14.1f}%")

    # 연도별 분석
    print(f"\n{'='*75}")
    print(f"  Buy & Hold 연도별 성과")
    print(f"{'='*75}")
    annual_breakdown(bh_df, "Buy & Hold")

    print(f"\n{'='*75}")
    print(f"  주픽 v2 모델 연도별 성과")
    print(f"{'='*75}")
    annual_breakdown(model_df, "주픽 v2")

    # 위기 구간 분석
    print(f"\n{'='*75}")
    print(f"  위기 구간 분석 (Max DD 상위 5)")
    print(f"{'='*75}")

    model_df['cum_dd'] = model_df['dd']
    worst_dd = model_df.nsmallest(5, 'dd')
    print(f"\n  {'날짜':<15} {'KOSPI':>10} {'DD':>10} {'포지션':>10} {'레짐':>10} {'포트가치':>12}")
    print(f"  {'-'*67}")
    for _, row in worst_dd.iterrows():
        print(f"  {str(row['date'])[:10]:<15} {row['close']:>10,.0f} {row['dd']:>+9.1%} {row['position']:>9.0%} {row['regime']:>10} {row['portfolio']:>11.1f}")

    print(f"\n{'='*75}")
    print(f"  ⚠️ 삼성전자(005930) 단일 종목 기반 간이 백테스트")
    print(f"  ⚠️ 개별 종목 선택(8전략 앙상블)은 Alpha 모델로 근사")
    print(f"  ⚠️ VKOSPI는 변동성 백분위로 정규화 (v1 대비 보정)")
    print(f"{'='*75}")


if __name__ == "__main__":
    main()
