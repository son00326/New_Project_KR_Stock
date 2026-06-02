// PR-A (a) — health page is_admin 게이트 + 권한 미확인 배너 source-static invariant.
//
// 배경: AdminHealthPage는 server component(no 'use client', force-dynamic)라 RTL 직접 test 어려움
// (partA-render-invariant.test.ts와 동일 제약). 대안 = source-level static invariant:
// page.tsx 소스에 (1) rpc('is_admin') 호출 + (2) adminErr||!isAdmin fail-closed boolean +
// (3) !adminVerified 배너 분기 + (4) 기존 empty-state/안내 문구 보존 토큰이 존재함을 assert.
// 회귀(게이트 삭제 / boolean 반전 / 배너 누락 / 기존 문구 삭제) 시 fail.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = path.resolve(__dirname, '..', 'page.tsx');

describe('PR-A (a) — health page is_admin gate + 권한 미확인 배너 (source-static invariant)', () => {
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
    // 회귀: boolean 반전(!(...) 제거) 또는 adminErr drop 차단.
    expect(source).toMatch(
      /const\s+adminVerified\s*=\s*!\(\s*adminErr\s*\|\|\s*!isAdmin\s*\)/,
    );
  });

  it('!adminVerified 분기로 권한 미확인 배너 조건부 렌더', () => {
    expect(source).toMatch(/\{\s*!adminVerified\s*&&/);
    expect(source).toContain('권한 미확인');
    expect(source).toContain('admin_emails 등록 확인');
  });

  it('getRecentPipelineHealth에 동일 session client DI 재사용 (client: supabase)', () => {
    expect(source).toMatch(
      /getRecentPipelineHealth\(\s*\{[^}]*client:\s*supabase[^}]*\}\s*\)/,
    );
  });

  it('기존 empty-state/안내 문구 보존 — 무회귀 (전체 상태 배너 + 실패 트레이스 + 적재 안내)', () => {
    expect(source).toContain('전체 상태:');
    expect(source).toContain('최근 실패 기록 없음.');
    expect(source).toContain('production pipeline_health 적재 전에는 빈 위젯');
  });

  it('표시-정직성: is_admin false라도 throw 없이 배너만 (return/throw deny 부재 — 데이터는 RLS 게이트)', () => {
    // server component에서 admin_required return-string deny 패턴이 들어오지 않았는지 확인.
    // (cost 아니라 표시라 crash 금지 — 배너만.)
    expect(source).not.toContain("'admin_required'");
    expect(source).not.toContain('throw new Error(\'admin');
  });
});
