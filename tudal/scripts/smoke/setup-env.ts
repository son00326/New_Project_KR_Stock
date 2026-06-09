// Smoke-only env bootstrap. vitest sets NODE_ENV=test and does NOT auto-load .env.local,
// so the confirmed real-money path parses it manually (no dotenv dependency bet) and
// injects the step-0 gate vars that are intentionally absent from .env.local.
// Only ever loaded by vitest.smoke.config.ts.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const smokeConfirmedByCaller = process.env.P3_SMOKE_CONFIRM === '1';

function loadEnvLocal(): void {
  const p = path.resolve(__dirname, '../../.env.local');
  let raw: string;
  try {
    raw = readFileSync(p, 'utf8');
  } catch {
    throw new Error(`[p3-smoke] .env.local not found at ${p} — cannot run real smoke`);
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
    process.env[key] = val; // .env.local is the canonical local secret source → override
  }
}

// Step-0 fail-closed gates (tier1-selection-batch-worker.ts:434-451) not present in .env.local.
// Defense-in-depth (SC-4): only force the two COST gates ON when the real smoke is explicitly
// confirmed by the caller's process env. A stale P3_SMOKE_CONFIRM or cost gate in .env.local
// must not turn an accidental `--config vitest.smoke.config.ts` into a billing run.
if (smokeConfirmedByCaller) {
  loadEnvLocal();
  process.env.P3_SMOKE_CONFIRM = '1';
  process.env.SELECTION_CRON_AUTO_ENABLED = 'true';
  process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
} else {
  delete process.env.P3_SMOKE_CONFIRM;
  delete process.env.SELECTION_CRON_AUTO_ENABLED;
  delete process.env.AI_COST_LOG_REAL_INSERT_ENABLED;
}
// cron-system reserved user (exists in prod auth.users; FK target for cost_log.called_by).
process.env.CRON_SYSTEM_USER_ID ??= '39202d8b-1042-48a6-8da0-df14a52fabea';
// A manual smoke must never chain into the next chunk (direct call doesn't self-continue,
// but be explicit so a stray env can't balloon the smoke into a full run).
delete process.env.SELECTION_CRON_SELF_CONTINUE;
