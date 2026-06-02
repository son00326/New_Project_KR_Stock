// PR-A follow-up — alert detail page is_admin 게이트 + 404 ambiguity 정직화 source-static invariant.
//
// alert_event RLS using(is_admin())는 권한 미확인 caller에게 row를 silent-filter한다.
// 단일 row 상세에서 null을 바로 notFound()로 처리하면 실제 부재와 RLS deny가 모두 404로 보인다.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = path.resolve(__dirname, '..', 'page.tsx');

describe('PR-A follow-up — alert detail is_admin gate + notFound ambiguity guard', () => {
  const source = fs.readFileSync(PAGE_PATH, 'utf8');

  it('createClient를 @/lib/supabase/server에서 import', () => {
    expect(source).toMatch(
      /import\s*\{\s*createClient\s*\}\s*from\s*["']@\/lib\/supabase\/server["']/,
    );
  });

  it('explicit supabase.rpc("is_admin") 호출 존재', () => {
    expect(source).toMatch(/supabase\.rpc\(\s*["']is_admin["']\s*\)/);
  });

  it('adminErr || !isAdmin fail-closed boolean (adminVerified) 박제', () => {
    expect(source).toMatch(
      /const\s+adminVerified\s*=\s*!\(\s*adminErr\s*\|\|\s*!isAdmin\s*\)/,
    );
  });

  it('notFound는 alert 부재 + adminVerified=true일 때만 호출', () => {
    expect(source).toMatch(/if\s*\(\s*!alert\s*&&\s*adminVerified\s*\)\s*notFound\(\)/);
    expect(source).not.toMatch(/if\s*\(\s*!alert\s*\)\s*notFound\(\)/);
  });

  it('권한 미확인 시 404 대신 RLS deny 가능성 배너를 렌더', () => {
    expect(source).toContain('권한 미확인');
    expect(source).toContain('표시된 404/알림 부재');
    expect(source).toContain('권한 검증 실패(RLS deny)');
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
  });
});
