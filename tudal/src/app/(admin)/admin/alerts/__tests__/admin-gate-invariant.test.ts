// PR-A (c) — alerts page is_admin 게이트 + '0건=정상' 단정 정직화 source-static invariant.
//
// 배경: AdminAlertsPage는 async server component(force-dynamic)라 RTL 직접 test 어려움
// (partA-render-invariant.test.ts와 동일 제약). 대안 = source-level static invariant:
// page.tsx 소스에 (1) rpc('is_admin') 호출 + (2) adminErr||!isAdmin fail-closed boolean +
// (3) adminVerified ? (기존 '0건=정상' 캡션) : (권한 미확인 배너) 분기 + (4) 기존 empty-state
// 문구 보존 토큰이 존재함을 assert. 회귀(게이트 삭제 / 단정 캡션 무조건 렌더 / 배너 누락) 시 fail.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PAGE_PATH = path.resolve(__dirname, '..', 'page.tsx');

describe('PR-A (c) — alerts page is_admin gate + 0건=정상 정직화 (source-static invariant)', () => {
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

  it("adminVerified ? (기존 '0건=실제 미발생' 캡션) : (권한 미확인 배너) 분기 — 단정 제거", () => {
    // 회귀: 기존 단정 캡션을 무조건 렌더(분기 삭제)하면 fail.
    // adminVerified 삼항 분기 안에 '0건 = 실제 미발생' 캡션이 위치해야 함.
    expect(source).toMatch(/\{\s*adminVerified\s*\?/);
    expect(source).toContain('0건 = 실제 미발생');
    expect(source).toContain('권한 미확인');
    expect(source).toContain('admin_emails 등록 확인');
  });

  it('단정 캡션은 adminVerified=true 가지(분기 true-branch)에만 — source 순서 invariant', () => {
    // adminVerified ? ... 0건 = 실제 미발생 ... : ... 권한 미확인 ...
    // 토큰 순서: adminVerified? < '0건 = 실제 미발생' < '권한 미확인'.
    const ternaryIdx = source.search(/\{\s*adminVerified\s*\?/);
    expect(ternaryIdx).toBeGreaterThanOrEqual(0);
    const okCaptionIdx = source.indexOf('0건 = 실제 미발생', ternaryIdx);
    const bannerIdx = source.indexOf('권한 미확인', ternaryIdx);
    expect(okCaptionIdx).toBeGreaterThan(ternaryIdx);
    expect(bannerIdx).toBeGreaterThan(okCaptionIdx);
  });

  it('alert_event/news_event SELECT에 동일 session client DI 재사용 (client: supabase)', () => {
    expect(source).toMatch(
      /getRecentAlertEvents\(\s*\{[^}]*limit:\s*ALERT_LIMIT[^}]*client:\s*supabase[^}]*\}\s*\)/,
    );
    expect(source).toMatch(
      /getRecentNewsEvents\(\s*\{[\s\S]*severity:\s*["']critical["'][\s\S]*limit:\s*NEWS_LIMIT_PER_SEVERITY[\s\S]*client:\s*supabase[\s\S]*\}\s*\)/,
    );
    expect(source).toMatch(
      /getRecentNewsEvents\(\s*\{[\s\S]*severity:\s*["']warning["'][\s\S]*limit:\s*NEWS_LIMIT_PER_SEVERITY[\s\S]*client:\s*supabase[\s\S]*\}\s*\)/,
    );
  });

  it('권한 미확인 배너는 role=status + aria-live=polite로 노출', () => {
    expect(source).toContain('role="status"');
    expect(source).toContain('aria-live="polite"');
  });

  it('기존 empty-state 문구 보존 — 무회귀 (알림 없음 / Critical 뉴스 없음 / Warning 뉴스 없음)', () => {
    expect(source).toContain('알림 없음.');
    expect(source).toContain('Critical 뉴스 없음.');
    expect(source).toContain('Warning 뉴스 없음.');
  });

  it('표시-정직성: is_admin false라도 throw/return deny 없이 캡션 분기만 (crash 금지)', () => {
    expect(source).not.toContain("'admin_required'");
  });
});
