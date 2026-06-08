import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SQL = readFileSync(
  resolve(__dirname, '../../../../supabase/migrations/0036_commit_persona_eval_cron.sql'),
  'utf-8',
);

describe('P2 0036 Section8 cron RPC migration contract', () => {
  it('cron RPCs are executable by service_role only, not authenticated', () => {
    expect(SQL).toMatch(
      /grant execute on function public\.commit_persona_eval_cron\(text, text, jsonb, jsonb, text, uuid\) to service_role/i,
    );
    expect(SQL).toMatch(
      /grant execute on function public\.reset_section8_eligible_jobs\(text\) to service_role/i,
    );
    expect(SQL).not.toMatch(
      /grant execute on function public\.commit_persona_eval_cron\(text, text, jsonb, jsonb, text, uuid\) to authenticated/i,
    );
    expect(SQL).not.toMatch(
      /grant execute on function public\.reset_section8_eligible_jobs\(text\) to authenticated/i,
    );
  });

  // ⚠️ Supabase default-privilege: 신규 public 함수에 authenticated EXECUTE 자동 부여 →
  //   grant 생략만으로는 부족, 명시 revoke 필수 (production 검증서 잡힌 갭, feedback_supabase_security_definer_pattern).
  it('cron RPCs explicitly revoke EXECUTE from authenticated (default-privilege gap guard)', () => {
    expect(SQL).toMatch(
      /revoke all on function public\.commit_persona_eval_cron\(text, text, jsonb, jsonb, text, uuid\) from authenticated/i,
    );
    expect(SQL).toMatch(
      /revoke all on function public\.reset_section8_eligible_jobs\(text\) from authenticated/i,
    );
  });

  it('reset only re-pends done rows and section8_not_ready deferred rows', () => {
    expect(SQL).toMatch(
      /\(\s*j\.status\s*=\s*'done'\s+or\s*\(\s*j\.status\s*=\s*'deferred'\s+and\s+j\.last_error\s*=\s*'section8_not_ready'\s*\)\s*\)/i,
    );
    expect(SQL).not.toMatch(
      /j\.status\s+in\s*\(\s*'done'\s*,\s*'deferred'\s*\)/i,
    );
  });
});
