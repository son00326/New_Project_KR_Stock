// PR4 Task 3 Step 3.2 — TrackRecordTabs component tests (jsdom env, Step 1.0 infra).
// SoT plan: docs/superpowers/plans/2026-05-25-pr4-ui-caller-wire.md §Step 3.2 (lines 1067-1094).
//
// 9 tests:
//   (1) 2 tab triggers visible with Korean labels (누적 성과 / 월별 아카이브)
//   (2) defaultValue='cumulative' — 누적 content visible by default
//   (3) Click archive tab → archive content visible
//   (4) Empty cumulative bundle → empty state in cumulative tab
//   (5) Empty archives → empty state in archive tab
//   (6) ApprovalBadge: accept+final → '승인 확정' + null → '미승인'
//   (7) ApprovalBadge: accept+!final → '승인 (미확정)' (B34 omxy R1 fix)
//   (8) ApprovalBadge: reject+!final → '반려' (B34 omxy R1 fix)
//   (9) ApprovalBadge: reject+final → '반려 확정' (B34 omxy R1 fix)
//
// scope: tab switching + empty state + ApprovalBadge 5 variants invariant.

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TrackRecordTabs } from '../track-record-tabs';
import type {
  TrackRecordCumulative,
  TrackRecordArchiveEntry,
} from '../actions';

const emptyCumulative: TrackRecordCumulative = {
  summary: null,
  monthly: [],
  buckets: [],
  counterfactual: null,
  capMonths: 0,
};

const filledCumulative: TrackRecordCumulative = {
  summary: {
    cumulativeReturn: 0.05,
    cumulativeKospi: 0.03,
    cumulativeAlpha: 0.02,
    cumulativeSharpe: 1.2,
    cumulativeMdd: -0.05,
    currentCapMonths: 0,
    dailyReturns: [],
    cumulativeValues: [],
  },
  monthly: [
    {
      month: '2026-04-01',
      portfolioReturn: 0.05,
      kospiReturn: 0.03,
      alpha: 0.02,
      sharpe: 1.2,
      capStreak: 1,
    },
  ],
  buckets: [
    { bucket: 'short', cumulativeReturn: 0.04, sharpe: 1.1, tickerCount: 10 },
  ],
  counterfactual: null,
  capMonths: 1,
};

const sampleArchive: TrackRecordArchiveEntry[] = [
  {
    month: '2026-04-01',
    reports: [
      { ticker: '005930', name: '삼성전자', sector: '반도체', bucket: 'short' },
      { ticker: '035420', name: 'NAVER', sector: 'IT/SW', bucket: 'mid' },
    ],
    approval: { approvalType: 'accept', isFinal: true, approvedAt: '2026-04-02T10:00:00Z' },
  },
  {
    month: '2026-03-01',
    reports: [{ ticker: '005930', name: '삼성전자', sector: '반도체', bucket: 'short' }],
    approval: null,
  },
];

describe('TrackRecordTabs (PR4 Task 3 Step 3.2)', () => {
  it('renders 2 tab triggers with Korean labels', () => {
    render(<TrackRecordTabs cumulative={emptyCumulative} archives={[]} />);
    expect(screen.getByRole('tab', { name: '누적 성과' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '월별 아카이브' })).toBeInTheDocument();
  });

  it('default tab is "cumulative" — 누적 content visible (capMonths card 검출)', () => {
    render(<TrackRecordTabs cumulative={filledCumulative} archives={sampleArchive} />);
    // capMonths 카드 ("0/12개월 진행 중") visible
    expect(screen.getByText(/CAP Months/i)).toBeInTheDocument();
    expect(screen.getByText('1/12개월 진행 중')).toBeInTheDocument();
  });

  it('clicking archive tab → archive content visible (월 헤더 + ticker links)', () => {
    render(<TrackRecordTabs cumulative={filledCumulative} archives={sampleArchive} />);
    const archiveTab = screen.getByRole('tab', { name: '월별 아카이브' });
    fireEvent.click(archiveTab);

    // 월 헤더 + ticker 표시
    expect(screen.getByText('2026년 4월')).toBeInTheDocument();
    expect(screen.getByText('2026년 3월')).toBeInTheDocument();
    // ticker links present (use getAllByText since 005930 appears in both months)
    const ticker005930s = screen.getAllByText('005930');
    expect(ticker005930s.length).toBeGreaterThanOrEqual(2);
  });

  it('empty cumulative bundle → cumulative tab shows "운용 데이터 누적 후 산출" empty state', () => {
    render(<TrackRecordTabs cumulative={emptyCumulative} archives={[]} />);
    expect(screen.getByText('운용 데이터 누적 후 산출')).toBeInTheDocument();
  });

  it('empty archives → archive tab shows "월별 아카이브 없음" empty state', () => {
    render(<TrackRecordTabs cumulative={emptyCumulative} archives={[]} />);
    const archiveTab = screen.getByRole('tab', { name: '월별 아카이브' });
    fireEvent.click(archiveTab);
    expect(screen.getByText('월별 아카이브 없음')).toBeInTheDocument();
  });

  it('archive entry — approval badge for accept-final + null approval (미승인)', () => {
    render(<TrackRecordTabs cumulative={emptyCumulative} archives={sampleArchive} />);
    const archiveTab = screen.getByRole('tab', { name: '월별 아카이브' });
    fireEvent.click(archiveTab);

    // 2026-04 → accept final badge
    expect(screen.getByText('승인 확정')).toBeInTheDocument();
    // 2026-03 → null approval → 미승인 badge
    expect(screen.getByText('미승인')).toBeInTheDocument();
  });

  it('ApprovalBadge — accept+!final → "승인 (미확정)" (B34 omxy R1 fix)', () => {
    const archives: TrackRecordArchiveEntry[] = [
      {
        month: '2026-04-01',
        reports: [{ ticker: '005930', name: '삼성전자', sector: '반도체', bucket: 'short' }],
        approval: { approvalType: 'accept', isFinal: false, approvedAt: '2026-04-02T10:00:00Z' },
      },
    ];
    render(<TrackRecordTabs cumulative={emptyCumulative} archives={archives} />);
    fireEvent.click(screen.getByRole('tab', { name: '월별 아카이브' }));
    expect(screen.getByText('승인 (미확정)')).toBeInTheDocument();
  });

  it('ApprovalBadge — reject+!final → "반려" (B34 omxy R1 fix)', () => {
    const archives: TrackRecordArchiveEntry[] = [
      {
        month: '2026-04-01',
        reports: [{ ticker: '005930', name: '삼성전자', sector: '반도체', bucket: 'short' }],
        approval: { approvalType: 'reject', isFinal: false, approvedAt: '2026-04-02T10:00:00Z' },
      },
    ];
    render(<TrackRecordTabs cumulative={emptyCumulative} archives={archives} />);
    fireEvent.click(screen.getByRole('tab', { name: '월별 아카이브' }));
    // reject+!final: textContent = '반려' (확정 suffix 없음).
    // 정확한 text match — '반려 확정'은 매치 안 함.
    const badge = screen.getByText('반려', { exact: true });
    expect(badge).toBeInTheDocument();
  });

  it('ApprovalBadge — reject+final → "반려 확정" (B34 omxy R1 fix)', () => {
    const archives: TrackRecordArchiveEntry[] = [
      {
        month: '2026-04-01',
        reports: [{ ticker: '005930', name: '삼성전자', sector: '반도체', bucket: 'short' }],
        approval: { approvalType: 'reject', isFinal: true, approvedAt: '2026-04-02T10:00:00Z' },
      },
    ];
    render(<TrackRecordTabs cumulative={emptyCumulative} archives={archives} />);
    fireEvent.click(screen.getByRole('tab', { name: '월별 아카이브' }));
    expect(screen.getByText('반려 확정')).toBeInTheDocument();
  });
});
