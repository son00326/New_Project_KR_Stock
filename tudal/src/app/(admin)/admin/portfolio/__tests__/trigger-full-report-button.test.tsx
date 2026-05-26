// PR4 Task 1 Step 1.3.2 — TriggerFullReportButton component tests (jsdom env, Step 1.0 infra).
// SoT plan: docs/superpowers/plans/2026-05-25-pr4-ui-caller-wire.md §Step 1.3.2 (lines 831-854).
//
// 4 tests:
//   (1) shows ticker name on button (이름 표시)
//   (2) disables button + shows '생성 중…' on click (loading)
//   (3) shows korean success feedback on commit success
//   (4) shows korean error feedback on commit failure
//
// scope: button UI invariant만. triggerFullReport 본체는 server action test에서 검증 (Step 1.2).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('./../actions', () => ({
  triggerFullReport: vi.fn(),
}));

describe('TriggerFullReportButton (PR4 Task 1 Step 1.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseProps = {
    ticker: '005930',
    name: '삼성전자',
    sector: '반도체',
    month: '2026-06',
  };

  it('shows ticker name on button (이름 표시)', async () => {
    const { TriggerFullReportButton } = await import('../trigger-full-report-button');
    render(<TriggerFullReportButton {...baseProps} />);
    expect(screen.getByRole('button')).toHaveTextContent('삼성전자 리포트 생성');
  });

  it('disables button + shows "생성 중…" on click (loading)', async () => {
    const { triggerFullReport } = await import('../actions');
    // Hold the promise to keep pending state observable.
    let resolveAction: (v: { success: true; data: { reportId: string } }) => void;
    (triggerFullReport as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve as never;
        }),
    );
    const { TriggerFullReportButton } = await import('../trigger-full-report-button');
    render(<TriggerFullReportButton {...baseProps} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent('생성 중…');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });
    // Cleanup — resolve the pending promise.
    resolveAction!({ success: true, data: { reportId: 'rpt-cleanup' } });
  });

  it('shows korean success feedback on commit success', async () => {
    const { triggerFullReport } = await import('../actions');
    (triggerFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      data: { reportId: 'rpt-abc12345' },
    });
    const { TriggerFullReportButton } = await import('../trigger-full-report-button');
    render(<TriggerFullReportButton {...baseProps} />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('리포트 생성 완료');
      expect(status).toHaveTextContent('rpt-abc1'); // first 8 chars
    });
  });

  it('shows korean error feedback on commit failure (formatErrorMessage 매핑)', async () => {
    const { triggerFullReport } = await import('../actions');
    (triggerFullReport as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: false,
      error: 'auth_unavailable',
    });
    const { TriggerFullReportButton } = await import('../trigger-full-report-button');
    render(<TriggerFullReportButton {...baseProps} />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => {
      const status = screen.getByRole('status');
      // formatErrorMessage이 한국어 매핑 — text-rose 색상 + 에러 메시지 있음.
      expect(status).toBeInTheDocument();
      expect(status.className).toContain('text-rose');
    });
  });
});
