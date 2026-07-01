// PR4 Task 4 (PR3a OOS RT#1) — partA 14 rows render invariant (omxy R2 B36 fix).
//
// 배경: schema-level test는 render regression을 못 잡는다 (omxy R2 B36).
//   - JSX 전체 삭제 / 분기 오타 / 미표시 / fallback 문구 삭제 / PersonaVoteChip 매핑 파손 ⇒ 통과 가능.
// Section8ModernView는 page.tsx 내부 함수이고 Server Component 의존으로 RTL 직접 test 어려움.
// 대안: source-level static invariant — 본 file이 page.tsx 소스에 partA 렌더 핵심 토큰들이 존재함을 assert.
// 회귀 시 fail. 못생겼지만 실제 Task 4 산출물 (partA UI render) silent regression 차단.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = path.resolve(
  __dirname,
  '..',
  'page.tsx',
);

describe('PR4 Task 4 (PR3a OOS RT#1) — partA render invariant (omxy R2 B36 + R3 B37 source-static)', () => {
  const source = fs.readFileSync(PAGE_PATH, 'utf8');

  it('page.tsx contains 14-row branch + 0 fallback (data.partA.length === 14/0)', () => {
    expect(source).toMatch(/data\.partA\.length\s*===\s*14/);
    expect(source).toMatch(/data\.partA\.length\s*===\s*0/);
  });

  it('page.tsx contains 한국어 section header "섹터 패널 의견"', () => {
    expect(source).toContain('섹터 패널 의견');
  });

  it('page.tsx renders partA row fields scoped to data.partA.map block (B37 fix omxy R3)', () => {
    // file-wide contains 우회 차단 — data.partA.map { ... } block 내부에서 매핑 토큰 박제.
    // partA map은 14-row branch에서만 등장하므로 scoped regex로 검증.
    const partAMapMatch = source.match(/data\.partA\.map\([^)]*\)\s*=>\s*\([\s\S]*?\)\)\}/);
    expect(partAMapMatch).not.toBeNull();
    const block = partAMapMatch![0];
    expect(block).toContain('key={p.persona_id}');
    expect(block).toContain('p.label');
    expect(block).toContain('p.background');
    expect(block).toContain('p.one_line');
    expect(block).toMatch(/<PersonaVoteChip\s+vote=\{p\.vote\}\s*\/>/);
  });

  it('page.tsx contains Tier 2 inactive fallback text "섹터 전문가 패널 미포함"', () => {
    expect(source).toContain('섹터 전문가 패널 미포함');
  });


  it('page.tsx renders partD Core 11 row fields (ReportFramework §8 Part D)', () => {
    const partDMapMatch = source.match(/data\.partD\.map\([^)]*\)\s*=>\s*\([\s\S]*?\)\)\}/);
    expect(partDMapMatch).not.toBeNull();
    const block = partDMapMatch![0];
    expect(source).toContain('핵심 위원 개별 의견');
    expect(block).toContain('key={p.persona_id}');
    expect(block).toContain('p.label');
    expect(block).toContain('p.philosophy');
    expect(block).toContain('p.one_line');
    expect(block).toMatch(/<PersonaVoteChip\s+vote=\{p\.vote\}\s*\/>/);
  });

  it('PersonaVoteChip branch-label association 박제 — indexOf 순서 (B37+B38 fix omxy R3+R4)', () => {
    // B37 fix: file-wide contains 우회 차단 (function-scoped).
    // B38 fix: branch-label association 잠금 — BUY/SELL/HOLD branch와 매수/매도/관망 label 1:1 순서 검증.
    //   회귀: BUY branch label을 '매도'로 변경 + SELL branch label을 '매수'로 변경 → 함수 body에 모든 토큰
    //   여전히 존재하지만 의미 반전. indexOf 순서로 association catch.
    const fnMatch = source.match(
      /function PersonaVoteChip\([\s\S]*?(?=\nfunction )/,
    );
    expect(fnMatch).not.toBeNull();
    const fn = fnMatch![0];

    // PersonaVoteChip 구조 (page.tsx):
    //   if (vote === 'BUY') { return ...매수... }
    //   if (vote === 'SELL') { return ...매도... }
    //   return (... 관망 ...)  // HOLD fallback
    // 토큰 순서 invariant: buyIf < 매수 < sellIf < 매도 < (final return) < 관망.
    const buyIfIdx = fn.indexOf("vote === 'BUY'");
    expect(buyIfIdx).toBeGreaterThanOrEqual(0);

    // 매수 label은 buyIf BLOCK 내부 (sellIf 전)
    const buyLabelIdx = fn.indexOf('매수', buyIfIdx);
    expect(buyLabelIdx).toBeGreaterThan(buyIfIdx);

    const sellIfIdx = fn.indexOf("vote === 'SELL'", buyLabelIdx);
    expect(sellIfIdx).toBeGreaterThan(buyLabelIdx);

    // 매도 label은 sellIf BLOCK 내부 (HOLD return 전)
    const sellLabelIdx = fn.indexOf('매도', sellIfIdx);
    expect(sellLabelIdx).toBeGreaterThan(sellIfIdx);

    // 관망은 SELL branch 이후 final return (else fallback) 내부
    const holdLabelIdx = fn.indexOf('관망', sellLabelIdx);
    expect(holdLabelIdx).toBeGreaterThan(sellLabelIdx);

    // 추가 swap 차단: 매수가 sellIf 이전 (BUY branch에 있어야 함) +
    //                매도가 sellIf 이후 (SELL branch에 있어야 함).
    expect(buyLabelIdx).toBeLessThan(sellIfIdx);
    expect(sellLabelIdx).toBeGreaterThan(sellIfIdx);
  });
});
