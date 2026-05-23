import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('마이그 0022 update_report_sections_0_7 — contract pins (omxy R1~R5 CONVERGED)', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../../../supabase/migrations/0022_update_report_sections_0_7.sql'),
    'utf-8',
  );

  it('함수명 + parameter 시그너처 박제 — 9 jsonb params + p_ticker text + p_month text', () => {
    expect(sql).toMatch(/create or replace function public\.update_report_sections_0_7/);
    expect(sql).toContain('p_ticker text');
    expect(sql).toContain('p_month text');
    expect(sql).toContain('p_section_0 jsonb');
    expect(sql).toContain('p_section_7 jsonb');
    expect(sql).toContain('p_appendix jsonb');
  });

  // B13 fix: search_path = public, pg_temp (0017/0021 패턴)
  it('B13 fix — set search_path = public, pg_temp', () => {
    expect(sql).toMatch(/set\s+search_path\s*=\s*public\s*,\s*pg_temp/);
  });

  // R1 P0 #2 + B12 fix: is_admin() OR service_role guard
  it('B12 fix — SECURITY DEFINER + auth_unavailable + admin_required + service_role bypass', () => {
    expect(sql).toContain('security definer');
    expect(sql).toMatch(/raise exception 'auth_unavailable'/);
    expect(sql).toMatch(/raise exception 'admin_required'/);
    expect(sql).toMatch(/service_role/);
  });

  // B12 fix: 4-grant
  it('B12 fix — 4-grant (revoke public/anon + grant authenticated + grant service_role)', () => {
    expect(sql).toMatch(/revoke (all|execute) on function public\.update_report_sections_0_7.*from public/i);
    expect(sql).toMatch(/revoke (all|execute) on function public\.update_report_sections_0_7.*from anon/i);
    expect(sql).toMatch(/grant execute on function public\.update_report_sections_0_7.*to authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.update_report_sections_0_7.*to service_role/i);
  });

  // B14 fix (R3 [0-9] portability)
  it('B14 fix — input regex guard (ticker ^[0-9]{6}$ + month ^[0-9]{4}-[0-9]{2}$)', () => {
    expect(sql).toMatch(/p_ticker\s*!~\s*'\^\[0-9\]\{6\}\$'/);
    expect(sql).toMatch(/p_month\s*!~\s*'\^\[0-9\]\{4\}-\[0-9\]\{2\}\$'/);
    expect(sql).toMatch(/raise exception 'invalid_ticker'/);
    expect(sql).toMatch(/raise exception 'invalid_month'/);
  });

  // R1 P0 #1: month = to_date
  it("R1 P0 #1 — month = to_date(p_month || '-01', 'YYYY-MM-DD')", () => {
    expect(sql).toMatch(/month\s*=\s*to_date\(p_month\s*\|\|\s*'-01',\s*'YYYY-MM-DD'\)/);
  });

  it('UPDATE 대상 = (ticker, month, is_latest=true)', () => {
    expect(sql).toMatch(/update public\.stock_reports/i);
    expect(sql).toMatch(/is_latest\s*=\s*true/i);
  });

  // 3-track CR-1 fix: generated_at bump
  it('CR-1 — UPDATE에 generated_at = now() 박제 (3-track Track 2 I3 + Track 3 Angle 3)', () => {
    expect(sql).toMatch(/generated_at\s*=\s*now\(\)/);
  });

  // 3-track W7 fix: coalesce auth.role()
  it('W7 — auth.role() coalesce defensive (null edge case 안전)', () => {
    expect(sql).toMatch(/coalesce\(\s*\(\s*select\s+auth\.role\(\)\s*\)\s*,\s*''\s*\)/);
  });

  it('row 부재 시 report_not_found_for_section_0_7_update raise (errcode P0002)', () => {
    expect(sql).toContain('report_not_found_for_section_0_7_update');
    expect(sql).toMatch(/errcode\s*=\s*'P0002'/);
  });

  it('return shape = json {success, report_id}', () => {
    expect(sql).toMatch(/returns json/i);
    expect(sql).toContain("'success', true");
    expect(sql).toContain("'report_id'");
  });
});
