// P2b Section8 live canary env bootstrap. Mirrors setup-env.ts / setup-env-full.ts but gated
// on a DISTINCT confirm flag (P2B_CANARY_CONFIRM) so a selection-smoke confirm can never
// trigger a report-path billing run and vice-versa. Only ever loaded by vitest.p2b.config.ts.
//
// vitest sets NODE_ENV=test and does NOT auto-load .env.local, so the confirmed real-money
// path parses it manually (no dotenv dependency bet) and injects the worker step-0 gate vars
// (full-report-batch-worker.ts:187-207) that are intentionally absent from .env.local.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const canaryConfirmedByCaller = process.env.P2B_CANARY_CONFIRM === '1';

function loadEnvLocal(): void {
  const p = path.resolve(__dirname, '../../.env.local');
  let raw: string;
  try {
    raw = readFileSync(p, 'utf8');
  } catch {
    throw new Error(`[p2b-canary] .env.local not found at ${p} — cannot run live canary`);
  }
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key.startsWith('P2B_') && process.env[key] !== undefined) continue;
    process.env[key] = val; // .env.local is the canonical local secret source → override
  }
}

// Worker step-0 fail-closed gates (full-report-batch-worker.ts:187-207) + Section8 flag
// (orchestrator/worker PR5B_SECTION8_ENABLED) are not present in .env.local.
// Defense-in-depth (SC-4 pattern): only force the billing/flag gates ON when the canary is
// explicitly confirmed by the caller's process env. A stale flag in .env.local must not turn
// an accidental `--config vitest.p2b.config.ts` into a billing run.
if (canaryConfirmedByCaller) {
  loadEnvLocal();
  process.env.P2B_CANARY_CONFIRM = '1';
  process.env.PR5_CRON_AUTO_ENABLED = 'true';
  process.env.PR5B_SECTION8_ENABLED = 'true';
  process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
} else {
  delete process.env.P2B_CANARY_CONFIRM;
  delete process.env.PR5_CRON_AUTO_ENABLED;
  delete process.env.PR5B_SECTION8_ENABLED;
  delete process.env.AI_COST_LOG_REAL_INSERT_ENABLED;
}
// cron-system reserved user (exists in prod auth.users; FK target for cost_log.called_by).
process.env.CRON_SYSTEM_USER_ID ??= '39202d8b-1042-48a6-8da0-df14a52fabea';
// The canary drives exactly one guarded chunk — self-continue is a route-level accelerator
// (cannot fire here, no HTTP), but be explicit so a stray env can't change behaviour.
delete process.env.PR5_CRON_SELF_CONTINUE;
