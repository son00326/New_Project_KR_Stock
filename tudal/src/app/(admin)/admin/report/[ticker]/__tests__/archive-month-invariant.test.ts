// Frontend bridge-gap audit — 월별 아카이브 report deep-link invariant.
//
// ServicePlan-Admin §2 defines Track Record monthly archive links as
// /admin/report/[ticker]?month=YYYY-MM (or modal). The report page must consume
// the month query, otherwise archive entries silently open the active month.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = path.resolve(__dirname, '..', 'page.tsx');
const TRACK_RECORD_TABS_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  'track-record',
  'track-record-tabs.tsx',
);

describe('admin report monthly archive deep-link invariant', () => {
  const reportSource = fs.readFileSync(PAGE_PATH, 'utf8');
  const trackRecordSource = fs.readFileSync(TRACK_RECORD_TABS_PATH, 'utf8');

  it('track-record archive links include ?month=YYYY-MM', () => {
    expect(trackRecordSource).toContain('function archiveReportHref');
    expect(trackRecordSource).toContain('?month=${month.slice(0, 7)}');
    expect(trackRecordSource).toContain('archiveReportHref(r.ticker, entry.month)');
  });

  it('report page consumes searchParams.month and scopes getActiveShortList to requested month', () => {
    expect(reportSource).toContain('searchParams?: Promise<{ month?: string | string[] | undefined }>');
    expect(reportSource).toContain('normalizeReportMonthParam((await searchParams)?.month)');
    expect(reportSource).toContain('requestedMonth ? { month: requestedMonth } : undefined');
  });

  it('report neighbor links preserve month query while archive browsing', () => {
    expect(reportSource).toContain('function reportHref');
    expect(reportSource).toContain('?month=${month.slice(0, 7)}');
    expect(reportSource).toContain('reportHref(neighbors.prev.ticker, requestedMonth)');
    expect(reportSource).toContain('reportHref(neighbors.next.ticker, requestedMonth)');
  });

  it('report regenerate link preserves month query while archive browsing', () => {
    expect(reportSource).toContain('function regenerateHref');
    expect(reportSource).toContain('regenerate?month=${month.slice(0, 7)}');
    expect(reportSource).toContain('regenerateHref(ticker, requestedMonth)');
  });
});
