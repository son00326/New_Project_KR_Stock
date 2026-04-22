#!/usr/bin/env node
// DQ-7 MEK rotation tool — Document/Build/Slices/DQ7-Credentials.md §3.4 + §7.7
//
// Usage:
//   node scripts/rotate-cred-mek.mjs --old <64hex> --new <64hex> [--dry-run]
//
// .env.local 자동 로드 (NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY).
//
// 안전 모델 (pseudo-transaction):
//   1. 모든 row SELECT (read-only)
//   2. 메모리에서 decrypt(old) + encrypt(new) — 실패 시 abort, DB 미변경
//   3. dry-run = 종료. 실 실행 = 'ROTATE' 확인 입력 후 일괄 UPDATE
//
// 한계: Supabase JS는 auto-commit이라 진정한 BEGIN/COMMIT 단일 트랜잭션은 아님.
//      대상 row가 ~30 미만이라 부분 실패 가능성 매우 낮음. 향후 RPC로 업그레이드 가능.

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createClient } from '@supabase/supabase-js';

const IV_LENGTH = 12;
const MEK_BYTE_LENGTH = 32;
const HEX_RE = /^[0-9a-fA-F]+$/;

function printUsage() {
  console.log(`Usage:
  node scripts/rotate-cred-mek.mjs --old <64hex> --new <64hex> [--dry-run]

Behavior:
  - Loads .env.local for NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY
  - Re-encrypts brokerage_connection + exchange_connection rows
  - --dry-run: SELECT + memory verification only (no UPDATE)
  - Without --dry-run: requires typing 'ROTATE' to confirm before UPDATE
`);
}

function parseArgs(argv) {
  let oldHex;
  let newHex;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--old') oldHex = argv[++i];
    else if (a === '--new') newHex = argv[++i];
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${a}`);
      printUsage();
      process.exit(2);
    }
  }
  if (!oldHex || !newHex) {
    console.error('Missing --old or --new');
    printUsage();
    process.exit(2);
  }
  return { oldHex, newHex, dryRun };
}

function validateMek(label, hex) {
  if (hex.length !== MEK_BYTE_LENGTH * 2) {
    throw new Error(
      `${label} must be ${MEK_BYTE_LENGTH * 2} hex chars (=${MEK_BYTE_LENGTH} bytes). Got ${hex.length}`,
    );
  }
  if (!HEX_RE.test(hex)) {
    throw new Error(`${label} must be hex-encoded`);
  }
  return Buffer.from(hex, 'hex');
}

function decryptOne(mek, ciphertext, iv, authTag) {
  const decipher = createDecipheriv('aes-256-gcm', mek, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function encryptOne(mek, plaintext) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', mek, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

function loadDotEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split('\n')) {
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
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(url, key, { auth: { persistSession: false } });
}

function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') {
    if (value.startsWith('\\x')) return Buffer.from(value.slice(2), 'hex');
    return Buffer.from(value, 'base64');
  }
  throw new Error(`Unexpected bytea value type: ${typeof value}`);
}

async function fetchTable(supabase, table, columns) {
  const select = ['id', ...columns.flat()].join(', ');
  const { data, error } = await supabase.from(table).select(select);
  if (error) throw new Error(`${table} SELECT 실패: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    pair1: {
      ciphertext: toBuffer(r[columns[0][0]]),
      iv: toBuffer(r[columns[0][1]]),
      authTag: toBuffer(r[columns[0][2]]),
    },
    pair2: {
      ciphertext: toBuffer(r[columns[1][0]]),
      iv: toBuffer(r[columns[1][1]]),
      authTag: toBuffer(r[columns[1][2]]),
    },
  }));
}

function reencryptAll(rows, oldMek, newMek) {
  return rows.map((r) => {
    const plain1 = decryptOne(oldMek, r.pair1.ciphertext, r.pair1.iv, r.pair1.authTag);
    const plain2 = decryptOne(oldMek, r.pair2.ciphertext, r.pair2.iv, r.pair2.authTag);
    return {
      id: r.id,
      pair1: encryptOne(newMek, plain1),
      pair2: encryptOne(newMek, plain2),
    };
  });
}

async function applyUpdates(supabase, table, columns, rows) {
  for (const r of rows) {
    const patch = {
      [columns[0][0]]: r.pair1.ciphertext,
      [columns[0][1]]: r.pair1.iv,
      [columns[0][2]]: r.pair1.authTag,
      [columns[1][0]]: r.pair2.ciphertext,
      [columns[1][1]]: r.pair2.iv,
      [columns[1][2]]: r.pair2.authTag,
    };
    const { error } = await supabase.from(table).update(patch).eq('id', r.id);
    if (error) {
      throw new Error(`${table} UPDATE 실패 id=${r.id}: ${error.message}`);
    }
  }
}

async function confirm() {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(
    "실 실행 모드입니다. 진행하려면 'ROTATE'를 입력하세요: ",
  );
  rl.close();
  return answer.trim() === 'ROTATE';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  loadDotEnvLocal();

  const oldMek = validateMek('--old', args.oldHex);
  const newMek = validateMek('--new', args.newHex);
  if (oldMek.equals(newMek)) {
    console.error('--old와 --new가 동일합니다. 의미 없는 작업입니다.');
    process.exit(2);
  }

  const supabase = getSupabase();

  const brokerageCols = [
    ['ciphertext_app_key', 'iv_app_key', 'auth_tag_app_key'],
    ['ciphertext_app_secret', 'iv_app_secret', 'auth_tag_app_secret'],
  ];
  const exchangeCols = [
    ['ciphertext_api_key', 'iv_api_key', 'auth_tag_api_key'],
    ['ciphertext_api_secret', 'iv_api_secret', 'auth_tag_api_secret'],
  ];

  console.log('[1/4] 전수 SELECT (brokerage_connection + exchange_connection)...');
  const [brokerageRows, exchangeRows] = await Promise.all([
    fetchTable(supabase, 'brokerage_connection', brokerageCols),
    fetchTable(supabase, 'exchange_connection', exchangeCols),
  ]);
  console.log(
    `  brokerage_connection: ${brokerageRows.length} row · exchange_connection: ${exchangeRows.length} row`,
  );

  if (brokerageRows.length === 0 && exchangeRows.length === 0) {
    console.log('대상 row 없음. 종료.');
    return;
  }

  console.log('[2/4] 메모리에서 decrypt(old) → encrypt(new) 검증...');
  let brokerageReencrypted;
  let exchangeReencrypted;
  try {
    brokerageReencrypted = reencryptAll(brokerageRows, oldMek, newMek);
    exchangeReencrypted = reencryptAll(exchangeRows, oldMek, newMek);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('재암호화 실패 — DB 미변경:', msg);
    process.exit(1);
  }
  console.log('  검증 통과 (모든 row decrypt + encrypt 성공)');

  if (args.dryRun) {
    console.log('[3/4] DRY-RUN — UPDATE 생략');
    console.log(
      `[4/4] 완료. 영향 예정 row: brokerage ${brokerageReencrypted.length} · exchange ${exchangeReencrypted.length}`,
    );
    return;
  }

  console.log('[3/4] 확인 프롬프트...');
  const ok = await confirm();
  if (!ok) {
    console.error('확인 거부됨. 중단.');
    process.exit(1);
  }

  console.log('[3/4] UPDATE 적용 중...');
  await applyUpdates(supabase, 'brokerage_connection', brokerageCols, brokerageReencrypted);
  await applyUpdates(supabase, 'exchange_connection', exchangeCols, exchangeReencrypted);
  console.log(
    `[4/4] 완료. 적용 row: brokerage ${brokerageReencrypted.length} · exchange ${exchangeReencrypted.length}`,
  );
  console.log(
    '⚠ 다음 단계: Vercel env API_CRED_MASTER_KEY를 새 값으로 교체 + 재배포 필수',
  );
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error('치명 오류:', msg);
  process.exit(1);
});
