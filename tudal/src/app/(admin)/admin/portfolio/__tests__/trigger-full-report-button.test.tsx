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

  // PR4 Task 9 Track 2 C-1 + omxy R4 B44 fix — silent-regression: button click이 parent click 발화 차단.
  // ShortlistRow에서 button을 <summary> 밖 sibling으로 옮겼지만 (B43 fix) wrapper stopPropagation도 보강.
  // 본 test = button onClick이 parent click handler를 발화시키지 않음 검증 (regression catch).
  it('button click does NOT propagate to parent click handler (C-1 fix — stopPropagation)', async () => {
    const parentClick = vi.fn();
    const { triggerFullReport } = await import('../actions');
    (triggerFullReport as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      data: { reportId: 'rpt-test' },
    });
    const { TriggerFullReportButton } = await import('../trigger-full-report-button');
    render(
      <div onClick={parentClick}>
        <TriggerFullReportButton {...baseProps} />
      </div>,
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    // button click은 처리되지만 parent click handler는 발화 안 함.
    await waitFor(() => {
      expect(triggerFullReport).toHaveBeenCalledTimes(1);
    });
    expect(parentClick).not.toHaveBeenCalled();
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

  it('shows korean success feedback + payload 4-field invariant (B25 fix omxy R1)', async () => {
    // OMXY R1 B25 fix: success feedback 외에 triggerFullReport call payload 4-field invariant 고정.
    // sector/month/name 누락 또는 plan drift {ticker,month,name} 3-field 회귀 silent pass 차단.
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
    // B25 invariant: triggerFullReport는 4-field {ticker, name, sector, month} 정확 전파.
    expect(triggerFullReport).toHaveBeenCalledWith(baseProps);
  });

  it('shows korean error feedback (formatErrorMessage 매핑 + B26 fix omxy R1)', async () => {
    // OMXY R1 B26 fix: formatErrorMessage 매핑 invariant 고정 — raw 'auth_unavailable' 표시
    // 회귀 silent pass 차단. format-error.ts:13 정합 ('auth_unavailable' → '로그인이 필요합니다').
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
      // B26 invariant: 한국어 매핑 확인 (raw 'auth_unavailable' 회귀 시 fail).
      expect(status).toHaveTextContent('로그인이 필요합니다');
      // 색상 visual cue 보조 검증.
      expect(status.className).toContain('text-rose');
    });
  });
});
