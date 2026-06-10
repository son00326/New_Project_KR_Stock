// P4 FULL report run env bootstrap. Mirrors setup-env-p2b.ts / setup-env-full.ts but gated on a
// DISTINCT confirm flag (P4_FULL_RUN_CONFIRM) so a P2b/P3 confirm can never trigger the 27-report
// completion run and vice-versa. Only ever loaded by vitest.p4-run.config.ts.
//
// vitest sets NODE_ENV=test and does NOT auto-load .env.local, so the confirmed real-money
// path parses it manually (no dotenv dependency bet) and injects the worker step-0 gate vars
// (full-report-batch-worker.ts:187-207) + Section8 flag that are intentionally absent from .env.local.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const runConfirmedByCaller = process.env.P4_FULL_RUN_CONFIRM === '1';

function loadEnvLocal(): void {
  const p = path.resolve(__dirname, '../../.env.local');
  let raw: string;
  try {
    raw = readFileSync(p, 'utf8');
  } catch {
    throw new Error(`[p4-run] .env.local not found at ${p} — cannot run full report run`);
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
    if (key.startsWith('P4_') && process.env[key] !== undefined) continue;
    process.env[key] = val; // .env.local is the canonical local secret source → override
  }
}

// Defense-in-depth (SC-4 pattern): only force the billing/flag gates ON when the run is
// explicitly confirmed by the caller's process env. A stale flag in .env.local must not turn
// an accidental `--config vitest.p4-run.config.ts` into a billing run.
if (runConfirmedByCaller) {
  loadEnvLocal();
  process.env.P4_FULL_RUN_CONFIRM = '1';
  process.env.PR5_CRON_AUTO_ENABLED = 'true';
  process.env.PR5B_SECTION8_ENABLED = 'true';
  process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
  // cron-system reserved user (exists in prod auth.users; FK target for cost_log.called_by).
  // Inside the confirm gate: the unconfirmed path stays fully env-neutral. The test additionally
  // pre-verifies this UUID against auth.users side-effect-free BEFORE the worker step-0 check.
  process.env.CRON_SYSTEM_USER_ID ??= '39202d8b-1042-48a6-8da0-df14a52fabea';
} else {
  delete process.env.P4_FULL_RUN_CONFIRM;
  delete process.env.PR5_CRON_AUTO_ENABLED;
  delete process.env.PR5B_SECTION8_ENABLED;
  delete process.env.AI_COST_LOG_REAL_INSERT_ENABLED;
}
// The driver loops chunks explicitly — self-continue is a route-level accelerator (cannot fire
// here, no HTTP), but be explicit so a stray env can't change behaviour.
delete process.env.PR5_CRON_SELF_CONTINUE;
