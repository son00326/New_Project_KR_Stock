// FULL P3 selection run env bootstrap. Mirrors setup-env.ts (cheap smoke) but gated on a
// DISTINCT confirm flag (P3_FULL_RUN_CONFIRM) so a cheap-smoke confirm can never trigger a
// full real-money run and vice-versa. Only ever loaded by vitest.full-run.config.ts.
//
// vitest sets NODE_ENV=test and does NOT auto-load .env.local, so the confirmed real-money
// path parses it manually (no dotenv dependency bet) and injects the step-0 gate vars that
// are intentionally absent from .env.local.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const fullRunConfirmedByCaller = process.env.P3_FULL_RUN_CONFIRM === '1';

function loadEnvLocal(): void {
  const p = path.resolve(__dirname, '../../.env.local');
  let raw: string;
  try {
    raw = readFileSync(p, 'utf8');
  } catch {
    throw new Error(`[p3-full] .env.local not found at ${p} — cannot run full real run`);
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
    if (key.startsWith('P3_FULL_') && process.env[key] !== undefined) continue;
    process.env[key] = val; // .env.local is the canonical local secret source → override
  }
}

// Step-0 fail-closed gates (tier1-selection-batch-worker.ts:434-451) not present in .env.local.
// Defense-in-depth: only force the two COST gates ON when the full run is explicitly confirmed by
// the caller's process env. A stale flag in .env.local must not turn an accidental
// `--config vitest.full-run.config.ts` into a billing run.
if (fullRunConfirmedByCaller) {
  loadEnvLocal();
  process.env.P3_FULL_RUN_CONFIRM = '1';
  process.env.SELECTION_CRON_AUTO_ENABLED = 'true';
  process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
} else {
  delete process.env.P3_FULL_RUN_CONFIRM;
  delete process.env.SELECTION_CRON_AUTO_ENABLED;
  delete process.env.AI_COST_LOG_REAL_INSERT_ENABLED;
}
// cron-system reserved user (exists in prod auth.users; FK target for cost_log.called_by).
process.env.CRON_SYSTEM_USER_ID ??= '39202d8b-1042-48a6-8da0-df14a52fabea';
// The direct driver loops chunks explicitly — never let the route's self-continue accelerator
// kick in (it cannot here, no HTTP, but be explicit so a stray env can't change behaviour).
delete process.env.SELECTION_CRON_SELF_CONTINUE;
