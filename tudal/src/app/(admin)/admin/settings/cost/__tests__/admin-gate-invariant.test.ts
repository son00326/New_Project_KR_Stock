// PR-A follow-up — cost page is_admin 게이트 + totalKrw=0/미도달 정직화 source-static invariant.
//
// 배경: AdminCostPage는 async server component(force-dynamic)라 RTL 직접 test 대신
// source-level static invariant로 회귀를 잡는다. cost_log SELECT는 RLS using(is_admin())로
// non-admin/env↔DB drift 시 0 rows silent-filter가 가능하므로, totalKrw=0 (정상) 단정은
// is_admin diagnostic 성공 true-branch에만 남아야 한다.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = path.resolve(__dirname, '..', 'page.tsx');

describe('PR-A follow-up — cost page is_admin gate + totalKrw=0 정직화 (source-static invariant)', () => {
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

  it('getMonthlyCostLog에 동일 session client DI 재사용 (client: supabase)', () => {
    expect(source).toMatch(
      /getMonthlyCostLog\(\s*month\s*,\s*\{\s*client:\s*supabase\s*\}\s*\)/,
    );
  });

  it("adminVerified ? (기존 'totalKrw=0 정상' 캡션) : (권한 미확인 배너) 분기 — 단정 제거", () => {
    expect(source).toMatch(/\{\s*adminVerified\s*\?/);
    expect(source).toContain('totalKrw=0 (정상)');
    expect(source).toContain('권한 미확인');
    expect(source).toContain('admin_emails 등록 확인');
    expect(source).toContain('권한 검증 실패(RLS deny)');
  });

  it('단정 캡션은 adminVerified=true 가지(분기 true-branch)에만 — source 순서 invariant', () => {
    const ternaryIdx = source.search(/\{\s*adminVerified\s*\?/);
    expect(ternaryIdx).toBeGreaterThanOrEqual(0);
    const okCaptionIdx = source.indexOf('totalKrw=0 (정상)', ternaryIdx);
    const bannerIdx = source.indexOf('권한 미확인', ternaryIdx);
    expect(okCaptionIdx).toBeGreaterThan(ternaryIdx);
    expect(bannerIdx).toBeGreaterThan(okCaptionIdx);
  });

  it('권한 미확인 배너는 role=status + aria-live=polite로 노출', () => {
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
  });
});
