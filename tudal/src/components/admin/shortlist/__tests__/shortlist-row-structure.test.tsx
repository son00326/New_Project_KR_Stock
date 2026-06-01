// PR4 Task 9 omxy R5 B45 fix — ShortlistRow 구조 invariant.
//
// 배경: omxy R4 B43에서 action을 <summary> OUT으로 이동 (HTML5 nesting violation 해소).
// R5에서 catch: trigger-full-report-button 단독 stopPropagation test만으로는 action이
// 다시 <summary> 내부로 회귀 시 silent pass 가능.
//
// 본 test = ShortlistRow render 후 DOM 구조 invariant:
//   (1) action은 <summary> descendant 아님
//   (2) action은 <details>의 sibling (nextElementSibling 또는 같은 wrapper 내)
//   (3) <summary> 내부에는 interactive <button> 없음 (HTML5 valid)

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ShortlistRow } from '../shortlist-row';
import type { ShortListItem } from '@/types/admin';

const fixture: ShortListItem = {
  id: 'sl-1',
  month: '2026-04-01',
  ticker: '005930',
  name: '삼성전자',
  sector: '반도체',
  bucket: 'short',
  rank: 1,
  compositeScore: 85,
  trendScore: 75,
  momentumScore: 80,
  volatilityScore: 30,
  divergencePct: 2.5,
  sparkline7d: [100, 101, 102, 101, 103, 104, 105],
  signalLabel: 'breakout',
  deltaStatus: 'hold',
  deltaReason: '',
  summary3Line: 'Test summary',
  suggestedWeight: 0.034,
  createdAt: '2026-04-01T00:00:00Z',
};

describe('ShortlistRow 구조 invariant (PR4 Task 9 omxy R5 B45)', () => {
  it('action prop은 <summary> descendant 아님 (HTML5 nesting valid)', () => {
    const { container } = render(
      <ShortlistRow
        item={fixture}
        action={<button type="button">리포트 생성</button>}
      />,
    );

    const summary = container.querySelector('summary');
    const actionButton = screen.getByRole('button', { name: /리포트 생성/ });

    expect(summary).not.toBeNull();
    expect(actionButton).not.toBeNull();
    // 핵심 invariant: <summary>가 action button을 contain 안 함.
    // 회귀: action을 다시 <summary> 내부에 렌더하면 fail.
    expect(summary).not.toContainElement(actionButton);
  });

  it('action은 <details> sibling (action 영역이 details의 nextElementSibling)', () => {
    const { container } = render(
      <ShortlistRow
        item={fixture}
        action={<button type="button">리포트 생성</button>}
      />,
    );

    const details = container.querySelector('details');
    const actionButton = screen.getByRole('button', { name: /리포트 생성/ });

    expect(details).not.toBeNull();
    // action button이 details 내부에 있지 않은지 verify.
    expect(details).not.toContainElement(actionButton);
    // details의 sibling element가 action을 포함 (B43 구조 박제).
    const detailsSibling = details!.nextElementSibling;
    expect(detailsSibling).not.toBeNull();
    expect(detailsSibling).toContainElement(actionButton);
  });

  it('action 없을 때 wrapper 구조 정상 (no orphan div)', () => {
    const { container } = render(<ShortlistRow item={fixture} />);
    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    // action 없으면 sibling 없음 (B43 fix의 조건부 렌더 invariant).
    expect(details!.nextElementSibling).toBeNull();
  });
});

describe('ShortlistRow PR-F AI 섹션 (ADR D-7)', () => {
  it('AI 데이터 있으면 합의 배지 + 🤖 점수 + AI 코멘트 렌더', () => {
    const aiItem: ShortListItem = {
      ...fixture,
      consensusBadge: '🟢',
      aiScore: 78,
      aiCommentKr: '강력한 장기 매수 신호.',
      winningTimeframe: 'long',
      conviction: 82,
    };
    render(<ShortlistRow item={aiItem} />);
    // 요약 행 합의 배지 (aria-label)
    expect(screen.getByLabelText(/합의 배지 강한 합의/)).toBeInTheDocument();
    // expanded AI 코멘트 (details collapsed여도 DOM에 존재)
    expect(screen.getByText('강력한 장기 매수 신호.')).toBeInTheDocument();
    expect(screen.getByText(/AI 코멘트/)).toBeInTheDocument();
  });

  it('AI 데이터 없으면(Tier 0 fallback) AI 대기 pill + 크래시 없음 + AI 코멘트 미렌더', () => {
    render(<ShortlistRow item={fixture} />); // fixture에 AI 필드 없음(undefined)
    expect(screen.getByTitle(/AI 분석 대기/)).toBeInTheDocument();
    expect(screen.queryByText(/AI 코멘트/)).not.toBeInTheDocument();
  });

  it('⚪ 배지는 AI 대기로 취급 (점수 미표시)', () => {
    const waitItem: ShortListItem = {
      ...fixture,
      consensusBadge: '⚪',
      aiScore: null,
    };
    render(<ShortlistRow item={waitItem} />);
    expect(screen.getByTitle(/AI 분석 대기/)).toBeInTheDocument();
  });
});
