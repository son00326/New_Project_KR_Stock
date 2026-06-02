// PR3b STEP-1 — 리포트 UI sweep render invariant (source-level static).
//
// page.tsx는 Server Component + 비동기 데이터 의존으로 RTL 직접 render가 어려움
//   (partA-render-invariant.test.ts 동일 사유). 따라서 source 문자열 invariant로 회귀 차단.
// 커버리지:
//   (a) SectionFallback stale future-PR 문구 0.
//   (b) Section8View null 분기 = '🤖 Tier 1 평가 대기' pill / section_8 존재 시 modern·legacy 분기 유지.
//   (c) Section 0 요약 1행 — ReportSummaryAiRow: 🔢 숫자 + 🤖 AI + 합의 배지, aiScore null → 'AI 대기'.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = path.resolve(__dirname, '..', 'page.tsx');
const SHORTLIST_ROW_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
  'components',
  'admin',
  'shortlist',
  'shortlist-row.tsx',
);
const staleFuturePrText = [
  '후속 PR3b (writer Section 0~7 본문 구현)',
  '에서 ',
  '채워집니다',
].join('');
const staleFillPattern = new RegExp(['에서 ', '채워집니다'].join(''));

describe('PR3b STEP-1 — 리포트 UI sweep render invariant', () => {
  const source = fs.readFileSync(PAGE_PATH, 'utf8');
  const shortlistRowSource = fs.readFileSync(SHORTLIST_ROW_PATH, 'utf8');

  // ── (a) SectionFallback stale 문구 0 ──────────────────────────────────────
  it('(a) SectionFallback에서 stale future-PR fill 문구가 제거됨', () => {
    expect(source).not.toContain(staleFuturePrText);
    expect(source).not.toMatch(staleFillPattern);
  });

  it('(a) SectionFallback 본문은 jsonb 미생성/validation 실패 의미만 서술', () => {
    const fnMatch = source.match(/function SectionFallback\([\s\S]*?(?=\nfunction )/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('본문 미작성');
    expect(fn).toMatch(/생성되지 않았거나 validation에 실패/);
    // 미래 PR 참조 어휘 잔존 0
    expect(fn).not.toContain('PR3b');
  });

  // ── (b) Section 8 absent → Tier 1 평가 대기 pill ──────────────────────────
  it('(b) Section8View가 data null 분기에서 "🤖 Tier 1 평가 대기" pill을 렌더', () => {
    const fnMatch = source.match(/function Section8View\([\s\S]*?(?=\nfunction )/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    // data null 분기 = if (!data) { ... } block 내부에 Tier 1 평가 대기 토큰 존재
    const nullBranch = fn.match(/if \(!data\)\s*\{[\s\S]*?\n  \}/);
    expect(nullBranch).not.toBeNull();
    const block = nullBranch![0];
    expect(block).toContain('Tier 1 평가 대기');
    expect(block).toContain('🤖');
    expect(block).toMatch(/생성되지 않았거나 validation에 실패/);
    // generic SectionFallback로 fallthrough 하지 않음 (Section 8 전용 pill)
    expect(block).not.toContain('SectionFallback');
  });

  it('(b) Section8View가 data 존재 시 modern/legacy 분기를 유지 (pill 미렌더)', () => {
    const fnMatch = source.match(/function Section8View\([\s\S]*?(?=\nfunction )/);
    const fn = fnMatch![0];
    // null 분기 이후 modern/legacy 분기가 그대로 존재 → section_8 존재 시 Tier1 pill 미도달.
    const pillIdx = fn.indexOf('Tier 1 평가 대기');
    const modernIdx = fn.indexOf("data.shape === \"modern\"");
    expect(pillIdx).toBeGreaterThanOrEqual(0);
    expect(modernIdx).toBeGreaterThan(pillIdx);
    expect(fn).toContain('Section8ModernView');
    expect(fn).toContain('Section8LegacyView');
  });

  // ── (c) Section 0 요약 AI 1행 ─────────────────────────────────────────────
  it('(c) header가 ReportSummaryAiRow를 shortListRow AI 필드로 렌더', () => {
    // header 스코프에서 추가 fetch 없이 shortListRow 필드 직접 전달.
    expect(source).toMatch(/<ReportSummaryAiRow[\s\S]*?compositeScore=\{shortListRow\.compositeScore\}/);
    expect(source).toMatch(/aiScore=\{shortListRow\.aiScore\}/);
    expect(source).toMatch(/consensusBadge=\{shortListRow\.consensusBadge\}/);
  });

  it('(c) ReportSummaryAiRow가 🔢 숫자 + 🤖 AI + 합의 배지 1행을 구성', () => {
    const fnMatch = source.match(/function ReportSummaryAiRow\([\s\S]*?(?=\nfunction )/);
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];
    expect(fn).toContain('🔢');
    expect(fn).toContain('🤖');
    expect(fn).toContain('BADGE_LABEL[badge]');
  });

  it('(c) ReportSummaryAiRow가 pending 또는 aiScore null 시 "AI 대기"로 분기 (0과 구분)', () => {
    const fnMatch = source.match(/function ReportSummaryAiRow\([\s\S]*?(?=\nfunction )/);
    const fn = fnMatch![0];
    expect(fn).toMatch(/pending \|\| aiScore == null \?[\s\S]*?AI 대기/);
  });

  it('(c) consensusBadge null/⚪ 가드 — isAiPending + ⚪ fallback', () => {
    const fnMatch = source.match(/function ReportSummaryAiRow\([\s\S]*?(?=\nfunction )/);
    const fn = fnMatch![0];
    expect(fn).toContain('isAiPending(consensusBadge)');
    expect(fn).toMatch(/consensusBadge \?\? "⚪"/);
  });

  // ── 공용 상수 ─────────────────────────────────────────────────────────────
  it('BADGE_LABEL 5종 한국어 라벨 + isAiPending(null||⚪) 게이트 존재', () => {
    expect(source).toMatch(/const BADGE_LABEL: Record<ConsensusBadge, string>/);
    expect(source).toContain('강한 합의');
    expect(source).toContain('AI 분석 대기');
    expect(source).toMatch(/function isAiPending\(badge\?: ConsensusBadge \| null\)/);
    expect(source).toMatch(/badge == null \|\| badge === "⚪"/);
  });

  it('BADGE_LABEL/isAiPending mirror가 shortlist-row.tsx와 lockstep', () => {
    const badgeBlockRe = /const BADGE_LABEL: Record<ConsensusBadge, string> = \{[\s\S]*?\};/;
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim();
    const reportBadgeBlock = source.match(badgeBlockRe)?.[0];
    const shortlistBadgeBlock = shortlistRowSource.match(badgeBlockRe)?.[0];
    expect(reportBadgeBlock).toBeTruthy();
    expect(normalize(reportBadgeBlock!)).toBe(normalize(shortlistBadgeBlock!));
    expect(source).toMatch(/return badge == null \|\| badge === "⚪";/);
    expect(shortlistRowSource).toMatch(/return badge == null \|\| badge === "⚪";/);
  });
});
