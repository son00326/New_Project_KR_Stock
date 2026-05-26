// PR4 Task 8 (W7 verification) — orchestrator enriched/input drift invariant (omxy R1 watch).
//
// 배경: enrichInput은 현재 identity transform (analyst.ts). 미래 enrichInput 확장 (ticker normalize /
// month 형식 변환 / financialsSummary 파싱 등) 시 silent drift 위험. 본 static grep test가 회귀 차단.
//
// invariant: full-report-orchestrator.ts 본문에서 `input.*` 사용은 `input.adminUserId`로만 제한.
// 다른 `input.<field>` 접근 회귀 시 fail → enriched.* drift catch.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ORCH_PATH = path.resolve(
  __dirname,
  '..',
  'full-report-orchestrator.ts',
);

describe('PR4 Task 8 (W7) — orchestrator enriched/input drift invariant (omxy R1 watch)', () => {
  const source = fs.readFileSync(ORCH_PATH, 'utf8');

  it('input.* access는 input.adminUserId만 허용 (non-comment / non-test)', () => {
    // 주석 라인 제거 + input.<field> 패턴 grep.
    const nonCommentLines = source
      .split('\n')
      .filter((line) => {
        const trimmed = line.trim();
        return !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
      });
    const inputAccessRegex = /\binput\.([a-zA-Z_]+)/g;
    const offenders: Array<{ field: string; line: string }> = [];
    for (const line of nonCommentLines) {
      let match: RegExpExecArray | null;
      while ((match = inputAccessRegex.exec(line)) !== null) {
        const field = match[1];
        if (field !== 'adminUserId') {
          offenders.push({ field, line: line.trim() });
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('enriched 변수가 적어도 1회 정의되고 데이터 path에서 사용됨', () => {
    // const enriched = enrichInput(input) 패턴 존재 invariant.
    expect(source).toMatch(/const enriched\s*=\s*enrichInput\(input\)/);
    // enriched.ticker / enriched.month / enriched.sector 최소 사용 보장.
    expect(source).toMatch(/enriched\.ticker/);
    expect(source).toMatch(/enriched\.month/);
    expect(source).toMatch(/enriched\.sector/);
  });
});
