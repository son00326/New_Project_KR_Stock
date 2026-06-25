import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';

import { extractIssueDebates } from '../writer';
import { section8Schema } from '../section-8-schema';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import type { CallPersonaResult } from '@/lib/ai/anthropic-client';

// ---------------------------------------------------------------------------
// B-PARTB ₩0 in-place backfill (live, prod Supabase write; USER 승인 후).
//
// 목적: 기존 30 리포트(2026-06)의 Part B(쟁점)는 옛 stub/raw-JSON. 신규 writer
//   extractIssueDebates를 DB에 이미 있는 persona 데이터(section_8.partD.one_line +
//   committee_votes.argument_excerpt)로 재실행 → partB만 교체. AI 호출 0원.
//
// 충실성: 생성 시점 writer가 받은 {vote, one_line, argument_excerpt}를 partD(one_line/vote) +
//   committee_votes core(argument_excerpt)로 정확히 재구성. partD 배열 순서 = 원 personaIds 순서
//   (buildSection8AndVotes가 personaIds.map으로 partD 생성) → extractIssueDebates의 idx tie-break
//   동일. 따라서 산출 partB = 신규 writer가 생성 시점에 냈을 partB와 동일.
//
// 안전: (1) 2-phase — dry-run(CONFIRM only)은 read+compute+validate+백업파일만, DB write 0.
//   apply(CONFIRM+APPLY)만 UPDATE. (2) write 전 전체 section_8 백업 파일. (3) section_8의 partB만
//   교체({...old, partB:new}) — partA/partC/partD/section_0~7/appendix 무변경. (4) month 2026-06-01 한정.
//   (5) write 후 30행 재검증(schema + no stub/JSON/빈문자열).
//
// 실행:
//   cd tudal && set -a && source .env.local && set +a
//   # phase 1 dry-run (₩0, no write):
//   B_PARTB_BACKFILL_CONFIRM=true npx vitest run --disable-console-intercept \
//     src/lib/report/__tests__/b-partb-backfill.live.test.ts
//   # phase 2 apply (prod write, 백업 후):
//   B_PARTB_BACKFILL_CONFIRM=true B_PARTB_BACKFILL_APPLY=true npx vitest run --disable-console-intercept \
//     src/lib/report/__tests__/b-partb-backfill.live.test.ts
//
// CI/test:ci에서는 항상 skip (CONFIRM 미설정). idempotent (partD/votes 불변 → 재실행 동일 partB).
// ---------------------------------------------------------------------------

const CONFIRM = process.env.B_PARTB_BACKFILL_CONFIRM === 'true';
const APPLY = process.env.B_PARTB_BACKFILL_APPLY === 'true';
const MONTH_DATE = '2026-06-01';
const EXPECTED_REPORTS = 30;
const CORE_COUNT = 11;

interface PartDRow {
  persona_id: string;
  vote: 'BUY' | 'HOLD' | 'SELL';
  one_line: string;
}

function assertQuoteClean(q: string): void {
  expect(q).not.toBe('');
  expect(q).not.toBe('stub');
  expect(q.includes('{')).toBe(false);
  expect(q.includes('"vote"')).toBe(false);
  expect(q.includes('"one_line"')).toBe(false);
}

describe.skipIf(!CONFIRM)('B-PARTB ₩0 in-place backfill (live, USER 승인 후)', () => {
  it('reconstruct partB → extractIssueDebates → backup → (apply) UPDATE → verify', async () => {
    const client = createServiceRoleClient();

    // 1. 30 리포트 읽기 (id, ticker, section_8)
    const { data: reports, error } = await client
      .from('stock_reports')
      .select('id, ticker, section_8')
      .eq('month', MONTH_DATE)
      .order('ticker');
    if (error) throw new Error(`read reports failed: ${error.code ?? error.message}`);
    if (!reports) throw new Error('read reports failed:null_data');
    expect(reports.length).toBe(EXPECTED_REPORTS);

    // 2. 해당 리포트의 core committee_votes (persona_id → argument_excerpt)
    const ids = reports.map((r) => r.id as string);
    const { data: votes, error: vErr } = await client
      .from('committee_votes')
      .select('report_id, persona_id, argument_excerpt')
      .in('report_id', ids)
      .eq('persona_layer', 'core');
    if (vErr) throw new Error(`read votes failed: ${vErr.code ?? vErr.message}`);
    if (!votes) throw new Error('read votes failed:null_data');
    expect(votes.length).toBe(EXPECTED_REPORTS * CORE_COUNT);
    const argByReport = new Map<string, Map<string, string>>();
    for (const v of votes) {
      const rid = v.report_id as string;
      const pid = v.persona_id as string;
      let reportArgs = argByReport.get(rid);
      if (!reportArgs) {
        reportArgs = new Map<string, string>();
        argByReport.set(rid, reportArgs);
      }
      if (reportArgs.has(pid)) throw new Error(`duplicate core vote: report=${rid}, persona=${pid}`);
      reportArgs.set(pid, (v.argument_excerpt as string) ?? '');
    }

    // 3. compute newPartB + 검증 + 백업 수집
    const backup: Array<{ id: string; ticker: string; old_section_8: unknown }> = [];
    const updates: Array<{ id: string; ticker: string; newSection8: Record<string, unknown> }> = [];
    for (const r of reports) {
      const id = r.id as string;
      const ticker = r.ticker as string;
      const s8 = r.section_8 as Record<string, unknown>;
      const parsedSection8 = section8Schema.safeParse(s8);
      expect(parsedSection8.success).toBe(true);
      if (!parsedSection8.success) throw new Error(`invalid section_8 before backfill: ${ticker}`);
      const partD: PartDRow[] = parsedSection8.data.partD;
      expect(partD.length).toBe(CORE_COUNT);

      const argMap = argByReport.get(id);
      if (!argMap) throw new Error(`missing core votes for report: ${ticker}`);
      expect(argMap.size).toBe(CORE_COUNT);
      // partD 배열 순서 = 원 personaIds 순서 (충실성 핵심)
      const personaIds = partD.map((d) => d.persona_id);
      for (const personaId of personaIds) {
        if (!argMap.has(personaId)) throw new Error(`missing core vote: ticker=${ticker}, persona=${personaId}`);
      }
      const personaResults: CallPersonaResult[] = partD.map((d) => ({
        content: JSON.stringify({
          vote: d.vote,
          one_line: d.one_line,
          argument_excerpt: argMap.get(d.persona_id),
        }),
        usage: { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 },
        costKrw: 0,
        promptCacheEnabled: false,
      }));

      const newPartB = extractIssueDebates(personaResults, personaIds);

      // validate: schema + clean quotes + 3~5 + distinct titles
      expect(section8Schema.shape.partB.safeParse(newPartB).success).toBe(true);
      expect(newPartB.length).toBeGreaterThanOrEqual(3);
      expect(newPartB.length).toBeLessThanOrEqual(5);
      expect(new Set(newPartB.map((b) => b.issue)).size).toBe(newPartB.length);
      for (const b of newPartB) {
        assertQuoteClean(b.pro_quote);
        assertQuoteClean(b.con_quote);
        if (typeof b.arbiter_quote === 'string') assertQuoteClean(b.arbiter_quote);
      }

      backup.push({ id, ticker, old_section_8: s8 });
      // partB만 교체 — 나머지(partA/partC/partD) 무변경
      updates.push({ id, ticker, newSection8: { ...s8, partB: newPartB } });
    }
    expect(updates.length).toBe(EXPECTED_REPORTS);

    // 4. write 전 백업 파일 (항상)
    mkdirSync('scripts/out', { recursive: true });
    const backupPath = `scripts/out/b-partb-backfill-backup-${MONTH_DATE}.json`;
    writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`[backfill] backed up ${backup.length} reports' section_8 → ${backupPath}`);

    if (!APPLY) {
      console.log(
        `[backfill] DRY RUN (B_PARTB_BACKFILL_APPLY!=true) — 30 reports computed+validated+backed up, NO DB write.\n` +
          `[backfill] sample (${updates[0].ticker}) newPartB:\n` +
          JSON.stringify(updates[0].newSection8.partB, null, 2),
      );
      return;
    }

    // 5. APPLY — section_8 UPDATE (partB만 교체된 전체 section_8)
    let applied = 0;
    for (const u of updates) {
      const { error: uErr } = await client
        .from('stock_reports')
        .update({ section_8: u.newSection8 })
        .eq('id', u.id)
        .eq('month', MONTH_DATE)
        .select('id')
        .single();
      if (uErr) throw new Error(`update ${u.ticker} failed: ${uErr.code ?? uErr.message}`);
      applied++;
    }
    expect(applied).toBe(EXPECTED_REPORTS);
    console.log(`[backfill] APPLIED ${applied} section_8.partB updates.`);

    // 6. write 후 재검증
    const { data: after, error: aErr } = await client
      .from('stock_reports')
      .select('ticker, section_8')
      .eq('month', MONTH_DATE);
    if (aErr) throw new Error(`reverify read failed: ${aErr.code ?? aErr.message}`);
    if (!after) throw new Error('reverify read failed:null_data');
    expect(after.length).toBe(EXPECTED_REPORTS);
    for (const r of after) {
      const pb = (r.section_8 as Record<string, unknown>).partB as Array<Record<string, unknown>>;
      expect(section8Schema.shape.partB.safeParse(pb).success).toBe(true);
      expect(pb.length).toBeGreaterThanOrEqual(3);
      expect(pb.length).toBeLessThanOrEqual(5);
      expect(new Set(pb.map((b) => b.issue)).size).toBe(pb.length);
      for (const b of pb) {
        assertQuoteClean(b.pro_quote as string);
        assertQuoteClean(b.con_quote as string);
        if (typeof b.arbiter_quote === 'string') assertQuoteClean(b.arbiter_quote);
      }
    }
    console.log(`[backfill] post-write verify OK: ${after.length} reports, partB schema-valid + clean.`);
  }, 180_000);
});
