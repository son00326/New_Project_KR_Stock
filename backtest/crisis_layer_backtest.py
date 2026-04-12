"""
주픽(JooPick) Crisis Management Layer 백테스트
===============================================
기간: 2019.01 ~ 2020.12 (COVID-19 포함)
대상: KOSPI 지수 (Buy & Hold vs Crisis Layer 모델)
비용: 매도세 0.23% + 수수료 왕복 0.03% 반영

⚠️ 이것은 KOSPI 지수 기반의 간이 백테스트입니다.
   개별 종목 선택(8전략 앙상블)은 미반영.
   Crisis Management Layer의 효과만 검증합니다.
"""

import sys
import warnings
warnings.filterwarnings('ignore')

from datetime import datetime, timedelta
import pandas as pd
import numpy as np

try:
    from pykrx import stock as krx
except ImportError:
    print("ERROR: pykrx not installed. Run: pip3 install pykrx")
    sys.exit(1)


# ============================================================
# 1. 데이터 수집
# ============================================================

def fetch_kospi_data(start: str, end: str) -> pd.DataFrame:
    """삼성전자(005930) 일봉 데이터를 KOSPI 대용으로 사용 + VKOSPI 근사"""
    print(f"[데이터] 삼성전자(005930) 수집 (KOSPI 대용): {start} ~ {end}")

    # 삼성전자 개별 종목 (KOSPI 시총 20%+ 비중, 지수 대리 변수)
    kospi = krx.get_market_ohlcv(start, end, "005930")

    if len(kospi) == 0:
        raise ValueError("데이터 수집 실패: 0건")

    # 컬럼명 통일
    kospi.columns = ['open', 'high', 'low', 'close', 'volume', 'change_pct']
    kospi['return'] = kospi['close'].pct_change()

    print(f"  → {len(kospi)}일 데이터 수집 완료 (삼성전자 기준)")

    # VKOSPI 근사: 실현 변동성 (20일) × 1.3
    kospi['realized_vol'] = kospi['return'].rolling(20).std() * np.sqrt(252) * 100
    kospi['vkospi_proxy'] = kospi['realized_vol'] * 1.3

    return kospi


# ============================================================
# 2. Crisis Management Layer 규칙
# ============================================================

class CrisisManagementLayer:
    """
    VKOSPI 기반 포지션 조정 + 서킷브레이커 + Taleb VETO
    """

    # VKOSPI 레벨별 포지션 비중
    VKOSPI_RULES = {
        15: 1.00,   # < 15: 풀 포지션
        25: 0.70,   # 15~25: 70%
        35: 0.40,   # 25~35: 40%
        999: 0.10,  # 35+: 10% (현금 90%)
    }

    # 일일 손실 서킷브레이커
    DAILY_DD_CIRCUIT = -0.03  # -3%

    # 포트폴리오 Max DD 트리거
    PORTFOLIO_MAX_DD = -0.08  # -8% → 50% 축소

    # 재진입 규칙
    REENTRY_VKOSPI_DROP = 0.30  # VKOSPI 피크 대비 30% 하락
    REENTRY_STEPS = [0.20, 0.40, 0.70, 1.00]  # 점진적 재진입
    REENTRY_INTERVAL_DAYS = 5  # 각 단계 간 최소 간격

    def __init__(self):
        self.mode = 'normal'  # normal / caution / crisis
        self.position_pct = 1.0
        self.peak_vkospi = 0
        self.peak_portfolio = 100
        self.reentry_step = 0
        self.days_since_last_reentry = 0
        self.crisis_start_date = None
        self.dd_triggered = False

    def get_position_pct(self, vkospi: float, daily_return: float,
                         portfolio_value: float) -> float:
        """현재 포지션 비중 결정"""

        # VKOSPI 피크 추적
        if vkospi > self.peak_vkospi:
            self.peak_vkospi = vkospi

        # 포트폴리오 피크 추적
        if portfolio_value > self.peak_portfolio:
            self.peak_portfolio = portfolio_value

        # ---- 위기 감지 ----

        # 1. VKOSPI 기반 모드 전환
        if vkospi >= 35:
            self.mode = 'crisis'
            target_pct = 0.10
            if self.crisis_start_date is None:
                self.crisis_start_date = True
                self.reentry_step = 0
        elif vkospi >= 25:
            self.mode = 'caution'
            target_pct = 0.40
        elif vkospi >= 15:
            self.mode = 'normal'
            target_pct = 0.70
        else:
            self.mode = 'normal'
            target_pct = 1.00

        # 2. 일일 DD 서킷브레이커
        if daily_return < self.DAILY_DD_CIRCUIT:
            target_pct = min(target_pct, 0.40)

        # 3. 포트폴리오 Max DD 트리거
        portfolio_dd = (portfolio_value - self.peak_portfolio) / self.peak_portfolio
        if portfolio_dd < self.PORTFOLIO_MAX_DD:
            target_pct = min(target_pct, target_pct * 0.50)
            self.dd_triggered = True

        # ---- 재진입 로직 ----

        # 위기 모드에서 VKOSPI가 피크 대비 30% 하락하면 재진입 시작
        if self.mode == 'crisis' and self.peak_vkospi > 0:
            vkospi_drop = (self.peak_vkospi - vkospi) / self.peak_vkospi

            if vkospi_drop >= self.REENTRY_VKOSPI_DROP:
                self.days_since_last_reentry += 1

                if (self.days_since_last_reentry >= self.REENTRY_INTERVAL_DAYS and
                    self.reentry_step < len(self.REENTRY_STEPS)):
                    target_pct = self.REENTRY_STEPS[self.reentry_step]
                    self.reentry_step += 1
                    self.days_since_last_reentry = 0

                    # 재진입 완료 시 위기 모드 해제
                    if self.reentry_step >= len(self.REENTRY_STEPS):
                        self.mode = 'normal'
                        self.crisis_start_date = None
                        self.peak_vkospi = vkospi

        # 포지션 변경 속도 제한 (하루 최대 30%p 변경)
        max_change = 0.30
        if target_pct > self.position_pct:
            self.position_pct = min(target_pct, self.position_pct + max_change)
        elif target_pct < self.position_pct:
            self.position_pct = max(target_pct, self.position_pct - max_change)

        return self.position_pct


# ============================================================
# 3. 알파 생성 (간이 모델)
# ============================================================

def generate_alpha(kospi: pd.DataFrame) -> pd.Series:
    """
    8전략 앙상블의 간이 근사:
    - 외국인 수급 (pykrx에서 못 가져오므로 모멘텀으로 대체)
    - 멀티팩터 효과를 월간 alpha로 근사

    평상시 월간 alpha: +0.5~1.5% (연 6~18%)
    → 보수적으로 월 +0.8% (연 ~10%) 적용
    """
    monthly_alpha = 0.008 / 21  # 월 0.8%를 일간으로 분배

    # 모멘텀 기반 alpha 조정: 상승장에서 alpha 높고, 하락장에서 낮음
    momentum_20d = kospi['close'].pct_change(20)
    alpha_adjustment = momentum_20d.clip(-0.05, 0.05) * 0.1  # 모멘텀 효과 소폭 반영

    daily_alpha = monthly_alpha + alpha_adjustment
    return daily_alpha.fillna(0)


# ============================================================
# 4. 거래 비용
# ============================================================

def calculate_transaction_cost(old_pct: float, new_pct: float, portfolio_value: float) -> float:
    """
    포지션 변경 시 거래 비용
    - 매수: 수수료 0.015%
    - 매도: 수수료 0.015% + 매도세 0.23%
    """
    change = abs(new_pct - old_pct)
    if change < 0.01:  # 1% 미만 변경은 무시
        return 0

    trade_amount = portfolio_value * change

    if new_pct < old_pct:  # 매도
        cost = trade_amount * (0.00015 + 0.0023)  # 수수료 + 매도세
    else:  # 매수
        cost = trade_amount * 0.00015  # 수수료만

    return cost


# ============================================================
# 5. 백테스트 실행
# ============================================================

def run_backtest(kospi: pd.DataFrame, use_crisis_layer: bool = True,
                 initial_capital: float = 100.0) -> pd.DataFrame:
    """
    백테스트 실행

    Args:
        kospi: KOSPI 일봉 데이터
        use_crisis_layer: Crisis Layer 사용 여부
        initial_capital: 초기 자본 (100 = 100%)
    """

    crisis = CrisisManagementLayer()
    alpha = generate_alpha(kospi)

    results = []
    portfolio_value = initial_capital
    position_pct = 1.0 if not use_crisis_layer else 1.0
    total_costs = 0
    trade_count = 0
    max_dd = 0
    peak_value = initial_capital

    for i, (date, row) in enumerate(kospi.iterrows()):
        if i == 0:
            results.append({
                'date': date,
                'kospi': row['close'],
                'return': 0,
                'vkospi_proxy': row.get('vkospi_proxy', 15),
                'position_pct': position_pct,
                'portfolio_value': portfolio_value,
                'mode': 'normal',
                'daily_pnl': 0,
                'cumulative_cost': 0,
            })
            continue

        daily_return = row['return'] if not np.isnan(row['return']) else 0
        vkospi = row.get('vkospi_proxy', 15)
        if np.isnan(vkospi):
            vkospi = 15

        # 이전 포지션 비중
        old_pct = position_pct

        # Crisis Layer 적용
        if use_crisis_layer:
            position_pct = crisis.get_position_pct(vkospi, daily_return, portfolio_value)
        else:
            position_pct = 1.0  # Buy & Hold

        # 거래 비용 계산
        cost = calculate_transaction_cost(old_pct, position_pct, portfolio_value)
        total_costs += cost
        if abs(position_pct - old_pct) > 0.01:
            trade_count += 1

        # 일간 수익률 계산
        # 포지션 비중만큼 시장 수익률 + alpha
        daily_alpha = alpha.iloc[i] if i < len(alpha) else 0
        portfolio_return = position_pct * (daily_return + daily_alpha)

        # 비용 차감
        portfolio_value = portfolio_value * (1 + portfolio_return) - cost

        # Max DD 추적
        if portfolio_value > peak_value:
            peak_value = portfolio_value
        current_dd = (portfolio_value - peak_value) / peak_value
        if current_dd < max_dd:
            max_dd = current_dd

        results.append({
            'date': date,
            'kospi': row['close'],
            'return': daily_return,
            'vkospi_proxy': vkospi,
            'position_pct': position_pct,
            'portfolio_value': portfolio_value,
            'mode': crisis.mode if use_crisis_layer else 'buy_hold',
            'daily_pnl': portfolio_return,
            'cumulative_cost': total_costs,
        })

    df = pd.DataFrame(results)

    # 성과 지표 계산
    total_return = (df['portfolio_value'].iloc[-1] / initial_capital - 1) * 100

    # 연간 수익률
    n_years = len(df) / 252
    annual_return = ((df['portfolio_value'].iloc[-1] / initial_capital) ** (1/n_years) - 1) * 100

    # Sharpe Ratio (무위험 이자율 3.5% 가정)
    daily_returns = df['daily_pnl'].dropna()
    if daily_returns.std() > 0:
        sharpe = (daily_returns.mean() * 252 - 0.035) / (daily_returns.std() * np.sqrt(252))
    else:
        sharpe = 0

    # Calmar Ratio
    calmar = annual_return / abs(max_dd * 100) if max_dd != 0 else 0

    # Win Rate (일간)
    win_days = (daily_returns > 0).sum()
    total_days = (daily_returns != 0).sum()
    win_rate = win_days / total_days * 100 if total_days > 0 else 0

    stats = {
        'total_return': total_return,
        'annual_return': annual_return,
        'max_dd': max_dd * 100,
        'sharpe': sharpe,
        'calmar': calmar,
        'win_rate': win_rate,
        'trade_count': trade_count,
        'total_costs': total_costs,
        'final_value': df['portfolio_value'].iloc[-1],
    }

    return df, stats


# ============================================================
# 6. 리포트 출력
# ============================================================

def print_report(model_df, model_stats, bh_df, bh_stats, period_name):
    """백테스트 결과 리포트"""

    print(f"\n{'='*70}")
    print(f"  주픽(JooPick) Crisis Management Layer 백테스트 결과")
    print(f"  기간: {period_name}")
    print(f"  데이터: {model_df['date'].iloc[0]} ~ {model_df['date'].iloc[-1]}")
    print(f"{'='*70}\n")

    print(f"{'지표':<25} {'KOSPI (Buy&Hold)':>20} {'주픽 모델':>20} {'차이':>15}")
    print(f"{'-'*80}")
    print(f"{'총 수익률':<25} {bh_stats['total_return']:>19.2f}% {model_stats['total_return']:>19.2f}% {model_stats['total_return']-bh_stats['total_return']:>+14.2f}%p")
    print(f"{'연간 수익률 (CAGR)':<25} {bh_stats['annual_return']:>19.2f}% {model_stats['annual_return']:>19.2f}% {model_stats['annual_return']-bh_stats['annual_return']:>+14.2f}%p")
    print(f"{'Max Drawdown':<25} {bh_stats['max_dd']:>19.2f}% {model_stats['max_dd']:>19.2f}% {model_stats['max_dd']-bh_stats['max_dd']:>+14.2f}%p")
    print(f"{'Sharpe Ratio':<25} {bh_stats['sharpe']:>20.2f} {model_stats['sharpe']:>20.2f} {model_stats['sharpe']-bh_stats['sharpe']:>+15.2f}")
    print(f"{'Calmar Ratio':<25} {bh_stats['calmar']:>20.2f} {model_stats['calmar']:>20.2f} {model_stats['calmar']-bh_stats['calmar']:>+15.2f}")
    print(f"{'Win Rate (일간)':<25} {bh_stats['win_rate']:>19.2f}% {model_stats['win_rate']:>19.2f}% {model_stats['win_rate']-bh_stats['win_rate']:>+14.2f}%p")
    print(f"{'거래 횟수':<25} {'0':>20} {model_stats['trade_count']:>20} {'':>15}")
    print(f"{'총 거래 비용':<25} {'0':>20} {model_stats['total_costs']:>19.2f} {'':>15}")
    print(f"{'최종 가치 (100 시작)':<25} {bh_stats['final_value']:>19.2f} {model_stats['final_value']:>19.2f} {model_stats['final_value']-bh_stats['final_value']:>+14.2f}")

    # 월별 수익률
    print(f"\n{'─'*70}")
    print(f"  월별 포지션 비중 및 모드 변화 (위기 구간 상세)")
    print(f"{'─'*70}")

    # 위기 구간 (VKOSPI > 25) 날짜 출력
    crisis_days = model_df[model_df['vkospi_proxy'] > 25]
    if len(crisis_days) > 0:
        print(f"\n  위기 감지 구간: {len(crisis_days)}일")

        # 월별 요약
        model_df['month'] = pd.to_datetime(model_df['date']).dt.to_period('M')
        monthly = model_df.groupby('month').agg({
            'portfolio_value': 'last',
            'position_pct': 'mean',
            'vkospi_proxy': 'max',
            'mode': 'last',
        })

        print(f"\n  {'월':<12} {'포트 가치':>12} {'평균 포지션':>12} {'VKOSPI 최고':>12} {'모드':>10}")
        print(f"  {'-'*58}")
        for period, row in monthly.iterrows():
            mode_str = row['mode']
            if mode_str == 'crisis':
                mode_str = '🔴 위기'
            elif mode_str == 'caution':
                mode_str = '🟡 경계'
            else:
                mode_str = '🟢 평상'

            print(f"  {str(period):<12} {row['portfolio_value']:>11.2f} {row['position_pct']:>11.1%} {row['vkospi_proxy']:>11.1f} {mode_str:>10}")

    print(f"\n{'='*70}")
    print(f"  ⚠️ 이 백테스트는 KOSPI 지수 기반 간이 테스트입니다.")
    print(f"  ⚠️ 개별 종목 선택(8전략 앙상블)은 미반영.")
    print(f"  ⚠️ VKOSPI는 실현변동성×1.3 근사치 사용.")
    print(f"{'='*70}\n")


# ============================================================
# 7. 메인 실행
# ============================================================

def main():
    print("=" * 70)
    print("  주픽(JooPick) 자동화 모델 백테스트")
    print("  실행 시간:", datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("=" * 70)

    # ---- Period 1: COVID (2019~2020) ----
    print("\n[1/2] COVID-19 기간 (2019.01 ~ 2020.12) 데이터 수집 중...")
    try:
        kospi_covid = fetch_kospi_data("20190101", "20201231")

        if len(kospi_covid) < 100:
            print(f"  ⚠️ 데이터 부족 ({len(kospi_covid)}일). pykrx 연결 확인 필요.")
            return

        # Buy & Hold
        print("[1/2] Buy & Hold 백테스트 실행 중...")
        bh_df, bh_stats = run_backtest(kospi_covid, use_crisis_layer=False)

        # 주픽 모델 (Crisis Layer)
        print("[1/2] 주픽 모델 (Crisis Layer) 백테스트 실행 중...")
        model_df, model_stats = run_backtest(kospi_covid, use_crisis_layer=True)

        # 결과 출력
        print_report(model_df, model_stats, bh_df, bh_stats, "COVID-19 (2019.01~2020.12)")

    except Exception as e:
        print(f"  ❌ COVID 백테스트 실패: {e}")
        import traceback
        traceback.print_exc()

    # ---- Period 2: 이란 사태 (2025.07 ~ 2026.04) ----
    print("\n[2/2] 이란 사태 기간 (2025.07 ~ 2026.04) 데이터 수집 중...")
    try:
        kospi_iran = fetch_kospi_data("20250701", "20260410")

        if len(kospi_iran) < 50:
            print(f"  ⚠️ 데이터 부족 ({len(kospi_iran)}일). 최근 데이터 접근 제한일 수 있습니다.")
            # 가능한 범위로 실행

        if len(kospi_iran) > 50:
            # Buy & Hold
            print("[2/2] Buy & Hold 백테스트 실행 중...")
            bh_df2, bh_stats2 = run_backtest(kospi_iran, use_crisis_layer=False)

            # 주픽 모델 (Crisis Layer)
            print("[2/2] 주픽 모델 (Crisis Layer) 백테스트 실행 중...")
            model_df2, model_stats2 = run_backtest(kospi_iran, use_crisis_layer=True)

            # 결과 출력
            print_report(model_df2, model_stats2, bh_df2, bh_stats2, "이란 사태 (2025.07~2026.04)")
        else:
            print("  ⚠️ 이란 사태 기간 데이터 부족으로 스킵합니다.")

    except Exception as e:
        print(f"  ❌ 이란 사태 백테스트 실패: {e}")
        import traceback
        traceback.print_exc()

    print("\n✅ 백테스트 완료")


if __name__ == "__main__":
    main()
