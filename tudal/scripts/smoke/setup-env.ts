// Smoke-only env bootstrap. vitest sets NODE_ENV=test and does NOT auto-load .env.local,
// so we parse it manually (no dotenv dependency bet) and inject the step-0 gate vars that
// are intentionally absent from .env.local. Only ever loaded by vitest.smoke.config.ts.
import { readFileSync } from 'node:fs';
import path from 'node:path';

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

loadEnvLocal();

// Step-0 fail-closed gates (tier1-selection-batch-worker.ts:434-451) not present in .env.local.
// Defense-in-depth (SC-4): only force the two COST gates ON when the real smoke is explicitly
// confirmed. Merely loading this config (e.g. a stray --config without P3_SMOKE_CONFIRM) then
// must NOT flip cost-logging / selection gates in the process env.
if (process.env.P3_SMOKE_CONFIRM === '1') {
  process.env.SELECTION_CRON_AUTO_ENABLED = 'true';
  process.env.AI_COST_LOG_REAL_INSERT_ENABLED = 'true';
}
// cron-system reserved user (exists in prod auth.users; FK target for cost_log.called_by).
process.env.CRON_SYSTEM_USER_ID ??= '39202d8b-1042-48a6-8da0-df14a52fabea';
// A manual smoke must never chain into the next chunk (direct call doesn't self-continue,
// but be explicit so a stray env can't balloon the smoke into a full run).
delete process.env.SELECTION_CRON_SELF_CONTINUE;
