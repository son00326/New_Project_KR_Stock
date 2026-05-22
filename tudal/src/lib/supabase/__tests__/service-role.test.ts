import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  createServiceRoleClient,
  __resetServiceRoleClientForTests,
} from '../service-role';

const ORIGINAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe('createServiceRoleClient', () => {
  beforeEach(() => {
    __resetServiceRoleClientForTests();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_KEY;
    __resetServiceRoleClientForTests();
  });

  it('throws service_role_key_missing when SUPABASE_SERVICE_ROLE_KEY is unset', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => createServiceRoleClient()).toThrow(/service_role_key_missing/);
  });

  it('throws supabase_url_missing when NEXT_PUBLIC_SUPABASE_URL is unset', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
    expect(() => createServiceRoleClient()).toThrow(/supabase_url_missing/);
  });

  it('returns SupabaseClient + caches same instance across calls', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'fake-key';
    const c1 = createServiceRoleClient();
    const c2 = createServiceRoleClient();
    expect(c1).toBe(c2);
  });

  // B11+B22 fix (omxy R3+R9) — source contains import "server-only" marker.
  // Next.js 빌드타임에 client import 차단 보장 (주석/grep gate 보조 검증).
  it('source file contains server-only import marker', () => {
    const source = readFileSync(
      path.resolve(__dirname, '../service-role.ts'),
      'utf8',
    );
    expect(source).toMatch(/import ['"]server-only['"]/);
  });
});
