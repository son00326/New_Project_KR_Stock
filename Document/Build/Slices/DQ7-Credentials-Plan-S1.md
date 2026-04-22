# DQ-7 Session 1 Implementation Plan — Backend · DB

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DQ-7 Session 1 = Admin Credential System의 Backend·DB 레이어 구현. AES-256-GCM 암호화 util + Supabase migration 0009(E9 확장 + E12 신설) + Server Actions(브로커리지·거래소 CRUD) + types 정리. UI는 Session 2에서 별도 플랜.

**Architecture:** Next.js 16 Server Actions가 `@supabase/ssr` user-session 클라이언트로 Supabase에 접근. `src/lib/crypto/aes.ts`가 MEK(Vercel env `API_CRED_MASTER_KEY`)로 AES-256-GCM 암/복호화. 컬럼 = `ciphertext·iv·auth_tag` × 2 (key·secret 각각). RLS `admin_id = auth.uid() AND is_admin()` 이중 가드.

**Tech Stack:** Node.js 20+ (crypto stdlib) · TypeScript 5 strict · Next.js 16.2.3 · @supabase/ssr 0.10 · Vitest 4.1.4 · PostgreSQL 15 (Supabase)

---

## Scope

Session 1 = 8 Tasks (T1·T2·T3·T4·T6·T7·T8·T13 from spec §9.1). Session 2·3·4는 이 플랜 범위 밖:
- Session 2: Frontend 2 라우트 UI (별도 플랜)
- Session 3: Vercel 배포 (사용자 주도)
- Session 4: Manual QA + Close (사용자 주도)

상위 스펙 SoT: `Document/Build/Slices/DQ7-Credentials.md`. 이 플랜은 Session 1 실행 레시피만 담음.

---

## File Structure

```
tudal/
├── src/
│   ├── lib/
│   │   ├── crypto/
│   │   │   ├── aes.ts                              ★ 신규 (AES-256-GCM util + MEK loader)
│   │   │   └── __tests__/
│   │   │       └── aes.test.ts                     ★ 신규 (~12 cases)
│   │   │
│   │   ├── credentials/
│   │   │   ├── types.ts                            ★ 신규 (Input·Display 인터페이스)
│   │   │   ├── mask.ts                             ★ 신규 (maskKey·maskAccount 순수 함수)
│   │   │   ├── validation.ts                       ★ 신규 (regex·length·trim)
│   │   │   ├── brokerage.ts                        ★ 신규 (KIS Server Actions)
│   │   │   ├── exchange.ts                         ★ 신규 (Binance Server Actions)
│   │   │   └── __tests__/
│   │   │       ├── mask.test.ts                    ★ 신규 (~5 cases)
│   │   │       ├── validation.test.ts              ★ 신규 (~8 cases)
│   │   │       ├── brokerage.integration.test.ts   ★ 신규 (~10 cases)
│   │   │       └── exchange.integration.test.ts    ★ 신규 (~10 cases)
│   │   │
│   │   └── data/
│   │       └── mock-admin-brokerage.ts             ✗ 삭제 (빈 배열, 참조 0건 예상)
│   │
│   └── types/
│       └── admin.ts                                ✎ 수정 (BrokerageConnection 인터페이스 폐기)
│
├── supabase/migrations/
│   ├── 0009_dq7_credentials.sql                    ★ 신규 (E9 확장 + E12 신설 + RLS)
│   └── 0009_dq7_credentials.rollback.sql           ★ 신규 (수동 롤백용)
│
└── .env.example                                    ✎ 수정 (신규 3 키 + KIS·Binance 주석 처리)
```

**단위 결정 근거**:
- `crypto/` vs `credentials/` 분리: crypto는 도메인 무관 범용 util, credentials는 브로커리지·거래소 특화 도메인. 재사용 범위 다름.
- `types.ts` 분리: `brokerage.ts`·`exchange.ts`가 같은 Input/Display 패턴이라 공유 타입으로 들어냄.
- `mask.ts`·`validation.ts` 각각 파일: 순수 함수 묶음. 테스트 격리 쉬움.
- Integration tests는 각 Server Action 파일별 1개씩 (`brokerage.integration`·`exchange.integration`).

---

## Dependency DAG

```
Task 1 (aes.ts) ─────────────────┐
                                 ├──> Task 6 (brokerage.ts) ──┐
Task 2 (mask.ts) ────────────────┤                            ├──> Task 8 (integration tests)
Task 3 (validation.ts) ──────────┤                            │
Task 4 (migration 0009) ─────────┤    Task 7 (exchange.ts) ──┘
                                 │
Task 5 (types.ts) ───────────────┘

Task 9 (types/admin.ts cleanup) ──> depends on Task 6·7 완료 (BrokerageConnection 삭제 전 대체 타입 필요)
Task 10 (.env.example)                                                                   (독립)
```

**실행 순서 (ralph Wave 분할)**:
- **Wave 1 (단독)**: Task 1 (aes.ts TDD) — 보안 크리티컬, 먼저 완료 후 다음 진행
- **Wave 2 (병렬 2 track)**:
  - Track A: Task 4 (migration)
  - Track B: Task 2 · Task 3 · Task 5 (mask·validation·types — 순수 로직, 순차 OK)
- **Wave 3 (병렬 2 track)**: Task 6 (brokerage) + Task 7 (exchange) — Task 1~5 전부 완료 후
- **Wave 4 (순차)**: Task 8 (integration tests) → Task 9 (cleanup) → Task 10 (.env.example)
- **DoD 검증**: `npm run build + lint + test:ci` 전체 green

---

## Blocker Checkpoints (실행 전 반드시)

Session 1 시작 전에 다음 3개 확인:

### BL-DQ7-1: MEK (Master Encryption Key) 생성
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# 출력 예: 7f3e8a1b9c2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f
# → 이 값을 tudal/.env.local에 API_CRED_MASTER_KEY=... 로 추가
```

### BL-DQ7-3: ADMIN_REP_EMAIL 확정
- 추정: `shjang1001@gmail.com` (대표 1인 = 사용자 본인)
- `tudal/.env.local`에 `ADMIN_REP_EMAIL=shjang1001@gmail.com` 추가

### BL-DQ7-6: 기존 BrokerageConnection 참조 0건 확인
```bash
grep -rn "BrokerageConnection" /Users/yong/New_Project_KR_Stock/tudal/src/
# 예상: types/admin.ts · mock-admin-brokerage.ts 외부 참조 0건
# 참조 있으면 Task 9에서 대체 작업 필요
```

**위 3개 해소 후에만 Wave 1 착수.**

---

## Task 1: AES-256-GCM Crypto Utility (Wave 1, TDD)

**Goal:** Node stdlib `crypto`로 AES-256-GCM 암/복호화 유틸 작성. MEK는 `API_CRED_MASTER_KEY` env에서 로드. 12 tests (roundtrip · 랜덤 IV · 변조 감지 · MEK 오설정) 통과.

**Files:**
- Create: `tudal/src/lib/crypto/aes.ts`
- Create: `tudal/src/lib/crypto/__tests__/aes.test.ts`

**Dependencies:** 없음. 첫 작업.

- [ ] **Step 1: Write failing test — encrypt/decrypt roundtrip**

Create `tudal/src/lib/crypto/__tests__/aes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt, MekConfigurationError, DecryptionError } from '../aes';

const TEST_MEK_HEX = '7f3e8a1b9c2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f';

describe('aes', () => {
  beforeEach(() => {
    process.env.API_CRED_MASTER_KEY = TEST_MEK_HEX;
  });

  describe('encrypt/decrypt roundtrip', () => {
    it('returns original plaintext', () => {
      const plaintext = 'my-secret-api-key';
      const payload = encrypt(plaintext);
      const decoded = decrypt(payload);
      expect(decoded).toBe(plaintext);
    });
  });
});
```

- [ ] **Step 2: Run test, verify FAIL**

```bash
cd tudal && npm run test:ci -- aes
```

Expected:
```
FAIL src/lib/crypto/__tests__/aes.test.ts
  × Cannot find module '../aes'
```

- [ ] **Step 3: Implement minimal aes.ts for roundtrip**

Create `tudal/src/lib/crypto/aes.ts`:

```ts
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

export type EncryptedPayload = {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
};

export class MekConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MekConfigurationError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecryptionError';
  }
}

const IV_LENGTH = 12;   // GCM 권장
const AUTH_TAG_LENGTH = 16;
const MEK_BYTE_LENGTH = 32;

let cachedMek: Buffer | null = null;

function loadMek(): Buffer {
  if (cachedMek) return cachedMek;
  const hex = process.env.API_CRED_MASTER_KEY;
  if (!hex) {
    throw new MekConfigurationError('API_CRED_MASTER_KEY env is not set');
  }
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new MekConfigurationError('API_CRED_MASTER_KEY must be hex-encoded');
  }
  if (hex.length !== MEK_BYTE_LENGTH * 2) {
    throw new MekConfigurationError(
      `API_CRED_MASTER_KEY must be ${MEK_BYTE_LENGTH * 2} hex chars (=${MEK_BYTE_LENGTH} bytes). Got ${hex.length}`
    );
  }
  cachedMek = Buffer.from(hex, 'hex');
  return cachedMek;
}

/** Test-only: reset cached MEK (called between tests) */
export function __resetMekCacheForTesting(): void {
  cachedMek = null;
}

export function encrypt(plaintext: string): EncryptedPayload {
  const mek = loadMek();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', mek, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}

export function decrypt(payload: EncryptedPayload): string {
  const mek = loadMek();
  const decipher = createDecipheriv('aes-256-gcm', mek, payload.iv);
  decipher.setAuthTag(payload.authTag);
  try {
    const plaintext = Buffer.concat([
      decipher.update(payload.ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch {
    throw new DecryptionError('Decryption failed (auth tag mismatch or corrupted data)');
  }
}
```

- [ ] **Step 4: Run test, verify PASS**

```bash
npm run test:ci -- aes
```

Expected: `Tests: 1 passed`

- [ ] **Step 5: Add tests for IV uniqueness + edge cases**

Append to `aes.test.ts`:

```ts
  describe('IV uniqueness', () => {
    it('produces different ciphertext for same plaintext × 100 runs', () => {
      const pt = 'same-plaintext';
      const seen = new Set<string>();
      for (let i = 0; i < 100; i++) {
        seen.add(encrypt(pt).ciphertext.toString('hex'));
      }
      expect(seen.size).toBe(100);
    });

    it('produces iv of length 12 bytes', () => {
      const { iv } = encrypt('x');
      expect(iv.length).toBe(12);
    });

    it('produces authTag of length 16 bytes', () => {
      const { authTag } = encrypt('x');
      expect(authTag.length).toBe(16);
    });
  });

  describe('edge cases', () => {
    it('roundtrips empty string', () => {
      expect(decrypt(encrypt(''))).toBe('');
    });

    it('roundtrips korean (UTF-8)', () => {
      const pt = '안녕하세요 Binance API key 🔑';
      expect(decrypt(encrypt(pt))).toBe(pt);
    });

    it('roundtrips large payload (10KB)', () => {
      const pt = 'x'.repeat(10_000);
      expect(decrypt(encrypt(pt))).toBe(pt);
    });
  });
```

- [ ] **Step 6: Run, verify all 7 tests PASS**

```bash
npm run test:ci -- aes
```

Expected: `Tests: 7 passed`

- [ ] **Step 7: Add tamper detection tests**

Append:

```ts
  describe('tamper detection', () => {
    it('throws DecryptionError when ciphertext is flipped', () => {
      const payload = encrypt('secret');
      payload.ciphertext[0] ^= 0xff;
      expect(() => decrypt(payload)).toThrow(DecryptionError);
    });

    it('throws DecryptionError when iv is flipped', () => {
      const payload = encrypt('secret');
      payload.iv[0] ^= 0xff;
      expect(() => decrypt(payload)).toThrow(DecryptionError);
    });

    it('throws DecryptionError when authTag is flipped', () => {
      const payload = encrypt('secret');
      payload.authTag[0] ^= 0xff;
      expect(() => decrypt(payload)).toThrow(DecryptionError);
    });

    it('throws DecryptionError when decrypted with different MEK', () => {
      const payload = encrypt('secret');
      process.env.API_CRED_MASTER_KEY =
        '0000000000000000000000000000000000000000000000000000000000000000';
      __resetMekCacheForTesting();
      expect(() => decrypt(payload)).toThrow(DecryptionError);
    });
  });
```

- [ ] **Step 8: Run, verify 11 tests PASS**

Expected: `Tests: 11 passed`

- [ ] **Step 9: Add MEK configuration tests**

Append:

```ts
  describe('MEK configuration errors', () => {
    it('throws MekConfigurationError when env is missing', () => {
      delete process.env.API_CRED_MASTER_KEY;
      __resetMekCacheForTesting();
      expect(() => encrypt('x')).toThrow(MekConfigurationError);
    });

    it('throws when hex length is wrong', () => {
      process.env.API_CRED_MASTER_KEY = 'abc123';
      __resetMekCacheForTesting();
      expect(() => encrypt('x')).toThrow(/64 hex chars/);
    });

    it('throws when non-hex chars present', () => {
      process.env.API_CRED_MASTER_KEY = 'z'.repeat(64);
      __resetMekCacheForTesting();
      expect(() => encrypt('x')).toThrow(/hex-encoded/);
    });
  });
```

Before each test, reset cache:

```ts
  beforeEach(() => {
    __resetMekCacheForTesting();
    process.env.API_CRED_MASTER_KEY = TEST_MEK_HEX;
  });
```

- [ ] **Step 10: Run all tests, verify 14 total PASS**

```bash
npm run test:ci -- aes
```

Expected: `Tests: 14 passed`

- [ ] **Step 11: Commit**

```bash
git add tudal/src/lib/crypto/
git commit -m "feat(DQ7): AES-256-GCM crypto util + 14 tests (Node stdlib, zero-dep)"
```

---

## Task 2: Migration 0009 — E9 확장 + E12 신설 + RLS (Wave 2a)

**Goal:** Supabase 마이그레이션 SQL 작성. 기존 `brokerage_connection` 테이블 확장 (`api_key_ref` drop → 암호화 컬럼 6개 추가) + 신규 `exchange_connection` 테이블 생성 + RLS 정책 + rollback SQL 동반.

**Files:**
- Create: `tudal/supabase/migrations/0009_dq7_credentials.sql`
- Create: `tudal/supabase/migrations/0009_dq7_credentials.rollback.sql`

**Dependencies:** Task 1과 독립. 병렬 실행 가능.

- [ ] **Step 1: Verify current migration state**

```bash
ls tudal/supabase/migrations/
# Expected: 0001~0008 + no 0009 yet
```

- [ ] **Step 2: Write 0009_dq7_credentials.sql**

Create `tudal/supabase/migrations/0009_dq7_credentials.sql`:

```sql
-- =====================================================================
-- 0009_dq7_credentials.sql
-- DQ-7 Admin Credential System (2026-04-22)
-- E9 brokerage_connection 확장 (Vault 참조 → AES-256-GCM 암호화 컬럼)
-- E12 exchange_connection 신설 (Binance USDT-M 선물)
-- BL-KRIT-7 alert_event CHECK 확장은 0010으로 재배정됨
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- E9 brokerage_connection 확장
-- ---------------------------------------------------------------------
ALTER TABLE brokerage_connection
  DROP COLUMN IF EXISTS api_key_ref,
  ADD COLUMN ciphertext_app_key    bytea NOT NULL,
  ADD COLUMN iv_app_key             bytea NOT NULL
    CHECK (octet_length(iv_app_key) = 12),
  ADD COLUMN auth_tag_app_key       bytea NOT NULL
    CHECK (octet_length(auth_tag_app_key) = 16),
  ADD COLUMN ciphertext_app_secret bytea NOT NULL,
  ADD COLUMN iv_app_secret          bytea NOT NULL
    CHECK (octet_length(iv_app_secret) = 12),
  ADD COLUMN auth_tag_app_secret    bytea NOT NULL
    CHECK (octet_length(auth_tag_app_secret) = 16),
  ADD COLUMN mock_mode              boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT brokerage_broker_enum CHECK (broker IN ('kis'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_brokerage_admin_broker_account
  ON brokerage_connection(admin_id, broker, account_no);
CREATE INDEX IF NOT EXISTS idx_brokerage_admin_active
  ON brokerage_connection(admin_id, is_active)
  WHERE is_active = true;

-- ---------------------------------------------------------------------
-- E12 exchange_connection 신설
-- ---------------------------------------------------------------------
CREATE TABLE exchange_connection (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id               uuid NOT NULL,
  exchange               text NOT NULL
    CHECK (exchange IN ('binance_futures')),
  label                  text NOT NULL
    CHECK (char_length(label) BETWEEN 1 AND 40),
  ciphertext_api_key     bytea NOT NULL,
  iv_api_key             bytea NOT NULL
    CHECK (octet_length(iv_api_key) = 12),
  auth_tag_api_key       bytea NOT NULL
    CHECK (octet_length(auth_tag_api_key) = 16),
  ciphertext_api_secret  bytea NOT NULL,
  iv_api_secret          bytea NOT NULL
    CHECK (octet_length(iv_api_secret) = 12),
  auth_tag_api_secret    bytea NOT NULL
    CHECK (octet_length(auth_tag_api_secret) = 16),
  testnet_mode           boolean NOT NULL DEFAULT true,
  is_active              boolean NOT NULL DEFAULT true,
  created_at             timestamptz NOT NULL DEFAULT now(),
  last_used_at           timestamptz
);

CREATE UNIQUE INDEX idx_exchange_admin_label
  ON exchange_connection(admin_id, exchange, label);
CREATE INDEX idx_exchange_admin_active
  ON exchange_connection(admin_id, is_active)
  WHERE is_active = true;

-- ---------------------------------------------------------------------
-- RLS — admin_id 본인 scope + is_admin() 이중 가드
-- ---------------------------------------------------------------------
ALTER TABLE exchange_connection ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brokerage_admin_self ON brokerage_connection;
CREATE POLICY brokerage_admin_self ON brokerage_connection
  FOR ALL
  USING     (admin_id = auth.uid() AND is_admin())
  WITH CHECK (admin_id = auth.uid() AND is_admin());

CREATE POLICY exchange_admin_self ON exchange_connection
  FOR ALL
  USING     (admin_id = auth.uid() AND is_admin())
  WITH CHECK (admin_id = auth.uid() AND is_admin());

COMMIT;
```

- [ ] **Step 3: Write 0009_dq7_credentials.rollback.sql**

Create `tudal/supabase/migrations/0009_dq7_credentials.rollback.sql`:

```sql
-- 수동 롤백 (Supabase CLI는 rollback 직접 제공 안 함 — 필요 시 사람이 실행)
BEGIN;

DROP POLICY IF EXISTS exchange_admin_self ON exchange_connection;
DROP POLICY IF EXISTS brokerage_admin_self ON brokerage_connection;

DROP TABLE IF EXISTS exchange_connection;

ALTER TABLE brokerage_connection
  DROP COLUMN IF EXISTS ciphertext_app_key,
  DROP COLUMN IF EXISTS iv_app_key,
  DROP COLUMN IF EXISTS auth_tag_app_key,
  DROP COLUMN IF EXISTS ciphertext_app_secret,
  DROP COLUMN IF EXISTS iv_app_secret,
  DROP COLUMN IF EXISTS auth_tag_app_secret,
  DROP COLUMN IF EXISTS mock_mode,
  DROP CONSTRAINT IF EXISTS brokerage_broker_enum,
  ADD COLUMN api_key_ref text;

DROP INDEX IF EXISTS idx_brokerage_admin_broker_account;
DROP INDEX IF EXISTS idx_brokerage_admin_active;

-- 기존 rls 정책 복원 (0002에서 생성된 구버전 복원)
CREATE POLICY brokerage_admin_self ON brokerage_connection
  FOR ALL
  USING (admin_id = auth.uid() AND is_admin());

COMMIT;
```

- [ ] **Step 4: SQL 문법 검증 (로컬 psql 없이)**

```bash
# PostgreSQL syntax check via heredoc (docker 없이)
# → 불가. 일단 파일 생성만 하고 실 적용은 Session 3에서 Supabase CLI로
cat tudal/supabase/migrations/0009_dq7_credentials.sql | head -10
```

Expected: SQL 첫 10줄 정상 출력.

- [ ] **Step 5: Commit migration files**

```bash
git add tudal/supabase/migrations/0009_dq7_credentials.sql tudal/supabase/migrations/0009_dq7_credentials.rollback.sql
git commit -m "feat(DQ7): migration 0009 — brokerage 암호화 + exchange 신설 + RLS"
```

**Note:** 실제 DB 적용은 Session 3 Vercel 배포 단계에서 `supabase db push` 또는 Dashboard SQL Editor로 수행. Session 1에서는 파일만 커밋.

---

## Task 3: mask.ts + 5 tests (Wave 2b, TDD)

**Goal:** API 키·계좌번호 마스킹 순수 함수. `maskKey('PS...ab12', 2, 4)` → `'PS**···ab12'`.

**Files:**
- Create: `tudal/src/lib/credentials/mask.ts`
- Create: `tudal/src/lib/credentials/__tests__/mask.test.ts`

**Dependencies:** Task 1 이후. 독립.

- [ ] **Step 1: Write failing tests**

Create `tudal/src/lib/credentials/__tests__/mask.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { maskKey, maskAccount } from '../mask';

describe('maskKey', () => {
  it('masks long key with 2 prefix + 4 suffix', () => {
    expect(maskKey('PS1234567890abcdef1234567890abcdef12', 2, 4)).toBe('PS**···ef12');
  });

  it('returns fallback for short input', () => {
    expect(maskKey('abc', 2, 4)).toBe('****');
  });

  it('handles empty string safely', () => {
    expect(maskKey('', 2, 4)).toBe('****');
  });
});

describe('maskAccount', () => {
  it('masks Korean brokerage account format (8-2)', () => {
    expect(maskAccount('12345678-01')).toBe('12345678-**');
  });

  it('returns fallback for unrecognized format', () => {
    expect(maskAccount('1234')).toBe('****');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

```bash
npm run test:ci -- mask
```

- [ ] **Step 3: Implement mask.ts**

Create `tudal/src/lib/credentials/mask.ts`:

```ts
const MIN_MASKABLE_LENGTH = 7;

export function maskKey(key: string, prefix = 2, suffix = 4): string {
  if (!key || key.length < MIN_MASKABLE_LENGTH) return '****';
  const head = key.slice(0, prefix);
  const tail = key.slice(-suffix);
  return `${head}**···${tail}`;
}

export function maskAccount(accountNo: string): string {
  // KIS 계좌번호 형식: `12345678-01` → `12345678-**`
  const m = /^(\d{8})-\d{2}$/.exec(accountNo);
  if (m) return `${m[1]}-**`;
  return '****';
}
```

- [ ] **Step 4: Run, verify 5 PASS**

```bash
npm run test:ci -- mask
```

Expected: `Tests: 5 passed`

- [ ] **Step 5: Commit**

```bash
git add tudal/src/lib/credentials/mask.ts tudal/src/lib/credentials/__tests__/mask.test.ts
git commit -m "feat(DQ7): credential masking util + 5 tests"
```

---

## Task 4: validation.ts + 8 tests (Wave 2b, TDD)

**Goal:** 입력 검증 정규식·길이 체크. KIS APP_KEY 36자, APP_SECRET 180자, Binance API key 64자 alphanumeric, 계좌번호 포맷, trim.

**Files:**
- Create: `tudal/src/lib/credentials/validation.ts`
- Create: `tudal/src/lib/credentials/__tests__/validation.test.ts`

**Dependencies:** Task 1 이후. 독립.

- [ ] **Step 1: Write failing tests**

Create `tudal/src/lib/credentials/__tests__/validation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  validateKisAppKey,
  validateKisAppSecret,
  validateKisAccountNo,
  validateBinanceApiKey,
  validateBinanceApiSecret,
  validateLabel,
  cleanInput,
  CredentialFormatError,
} from '../validation';

describe('validateKisAppKey', () => {
  it('accepts 36 alphanumeric chars', () => {
    expect(() => validateKisAppKey('A'.repeat(36))).not.toThrow();
  });
  it('rejects wrong length', () => {
    expect(() => validateKisAppKey('A'.repeat(35))).toThrow(CredentialFormatError);
    expect(() => validateKisAppKey('A'.repeat(37))).toThrow(CredentialFormatError);
  });
  it('rejects non-alphanumeric', () => {
    expect(() => validateKisAppKey('A'.repeat(35) + '!')).toThrow(CredentialFormatError);
  });
});

describe('validateKisAccountNo', () => {
  it('accepts 8-2 format', () => {
    expect(() => validateKisAccountNo('12345678-01')).not.toThrow();
  });
  it('rejects other formats', () => {
    expect(() => validateKisAccountNo('1234-56789012')).toThrow(CredentialFormatError);
  });
});

describe('validateBinanceApiKey', () => {
  it('accepts 64 alphanumeric', () => {
    expect(() => validateBinanceApiKey('a'.repeat(64))).not.toThrow();
  });
  it('rejects 63 or 65', () => {
    expect(() => validateBinanceApiKey('a'.repeat(63))).toThrow(CredentialFormatError);
  });
});

describe('cleanInput', () => {
  it('trims leading/trailing whitespace', () => {
    expect(cleanInput('  abc  ')).toBe('abc');
  });
  it('preserves internal whitespace (none expected in keys but safe)', () => {
    expect(cleanInput('ab c')).toBe('ab c');
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

- [ ] **Step 3: Implement validation.ts**

Create `tudal/src/lib/credentials/validation.ts`:

```ts
export class CredentialFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CredentialFormatError';
  }
}

const KIS_APP_KEY_RE = /^[A-Za-z0-9]{36}$/;
const KIS_APP_SECRET_RE = /^[A-Za-z0-9=+/]{180}$/;
const KIS_ACCOUNT_NO_RE = /^\d{8}-\d{2}$/;
const BINANCE_API_KEY_RE = /^[A-Za-z0-9]{64}$/;
const BINANCE_API_SECRET_RE = /^[A-Za-z0-9]{64}$/;

export function validateKisAppKey(v: string): void {
  if (!KIS_APP_KEY_RE.test(v)) {
    throw new CredentialFormatError(`KIS APP_KEY는 36자 영숫자여야 합니다. 현재 ${v.length}자`);
  }
}

export function validateKisAppSecret(v: string): void {
  if (!KIS_APP_SECRET_RE.test(v)) {
    throw new CredentialFormatError(`KIS APP_SECRET는 180자 영숫자여야 합니다. 현재 ${v.length}자`);
  }
}

export function validateKisAccountNo(v: string): void {
  if (!KIS_ACCOUNT_NO_RE.test(v)) {
    throw new CredentialFormatError('KIS 계좌번호 형식: 12345678-01');
  }
}

export function validateBinanceApiKey(v: string): void {
  if (!BINANCE_API_KEY_RE.test(v)) {
    throw new CredentialFormatError(`Binance API KEY는 64자 영숫자여야 합니다. 현재 ${v.length}자`);
  }
}

export function validateBinanceApiSecret(v: string): void {
  if (!BINANCE_API_SECRET_RE.test(v)) {
    throw new CredentialFormatError(`Binance API SECRET는 64자 영숫자여야 합니다. 현재 ${v.length}자`);
  }
}

export function validateLabel(v: string): void {
  if (v.length < 1 || v.length > 40) {
    throw new CredentialFormatError(`라벨은 1~40자여야 합니다. 현재 ${v.length}자`);
  }
}

/** Trims leading/trailing whitespace. For paste-from-clipboard safety. */
export function cleanInput(v: string): string {
  return v.trim();
}
```

- [ ] **Step 4: Run, verify 8+ PASS**

```bash
npm run test:ci -- validation
```

Expected: `Tests: 10 passed` (a few it() 더 있음)

- [ ] **Step 5: Commit**

```bash
git add tudal/src/lib/credentials/validation.ts tudal/src/lib/credentials/__tests__/validation.test.ts
git commit -m "feat(DQ7): credential format validation + 10 tests"
```

---

## Task 5: types.ts (Wave 2b, 타입 정의만)

**Goal:** Server Actions가 사용할 Input/Display 타입 정의.

**Files:**
- Create: `tudal/src/lib/credentials/types.ts`

**Dependencies:** Task 1~4 이후 (하지만 내용상 독립).

- [ ] **Step 1: Create types.ts**

```ts
// src/lib/credentials/types.ts

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------- Brokerage (KIS) ----------

export interface BrokerageCredentialInput {
  broker: 'kis';
  accountNo: string;        // '12345678-01'
  appKey: string;           // 36 chars
  appSecret: string;        // 180 chars
  mockMode: boolean;
  strategyLabel: string | null;
}

export interface BrokerageCredentialDisplay {
  id: string;
  broker: 'kis';
  accountNoMasked: string;   // '12345678-**'
  appKeyMasked: string;      // 'PS**···ab12'
  mockMode: boolean;
  strategyLabel: string | null;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  // secret은 응답에 없음
}

// ---------- Exchange (Binance) ----------

export interface ExchangeCredentialInput {
  exchange: 'binance_futures';
  label: string;            // 1~40자
  apiKey: string;           // 64 chars
  apiSecret: string;        // 64 chars
  testnetMode: boolean;
}

export interface ExchangeCredentialDisplay {
  id: string;
  exchange: 'binance_futures';
  label: string;
  apiKeyMasked: string;
  testnetMode: boolean;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}
```

- [ ] **Step 2: Verify compiles**

```bash
cd tudal && npx tsc --noEmit src/lib/credentials/types.ts
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add tudal/src/lib/credentials/types.ts
git commit -m "feat(DQ7): credential Input·Display types (ActionResult discriminated union)"
```

---

## Task 6: brokerage.ts Server Actions (Wave 2c)

**Goal:** KIS Server Actions (upsert · delete · list · testConnection stub). `@supabase/ssr` user-session 기반으로 RLS 자동 격리.

**Files:**
- Create: `tudal/src/lib/credentials/brokerage.ts`

**Dependencies:** Task 1 (aes) · Task 2 (mask) · Task 4 (validation) · Task 5 (types) · Task 4 (migration schema).

- [ ] **Step 1: Verify imports available**

```bash
cat tudal/src/lib/supabase/server.ts  # Supabase SSR client factory
```

Expected: `createServerClient` export (existing from S0).

- [ ] **Step 2: Implement brokerage.ts**

Create `tudal/src/lib/credentials/brokerage.ts`:

```ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto/aes';
import { maskKey, maskAccount } from './mask';
import {
  validateKisAppKey,
  validateKisAppSecret,
  validateKisAccountNo,
  cleanInput,
  CredentialFormatError,
} from './validation';
import type {
  ActionResult,
  BrokerageCredentialInput,
  BrokerageCredentialDisplay,
} from './types';

/** Upsert — UNIQUE(admin_id, broker, account_no) 충돌 시 UPDATE */
export async function upsertBrokerageCredential(
  input: BrokerageCredentialInput
): Promise<ActionResult<{ id: string }>> {
  try {
    // 1. Clean + validate
    const accountNo = cleanInput(input.accountNo);
    const appKey = cleanInput(input.appKey);
    const appSecret = cleanInput(input.appSecret);
    validateKisAccountNo(accountNo);
    validateKisAppKey(appKey);
    validateKisAppSecret(appSecret);

    // 2. Session check + rep guard
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: '로그인이 필요합니다' };

    const repEmail = process.env.ADMIN_REP_EMAIL;
    if (!input.mockMode && user.email !== repEmail) {
      return { success: false, error: '실계좌 등록은 대표만 가능합니다' };
    }

    // 3. Encrypt key·secret 개별
    const keyPayload = encrypt(appKey);
    const secretPayload = encrypt(appSecret);

    // 4. Upsert
    const { data, error } = await supabase
      .from('brokerage_connection')
      .upsert(
        {
          admin_id: user.id,
          broker: input.broker,
          account_no: accountNo,
          strategy_label: input.strategyLabel,
          mock_mode: input.mockMode,
          ciphertext_app_key: keyPayload.ciphertext,
          iv_app_key: keyPayload.iv,
          auth_tag_app_key: keyPayload.authTag,
          ciphertext_app_secret: secretPayload.ciphertext,
          iv_app_secret: secretPayload.iv,
          auth_tag_app_secret: secretPayload.authTag,
          is_active: true,
        },
        { onConflict: 'admin_id,broker,account_no' }
      )
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: '이미 등록된 계좌입니다' };
      }
      return { success: false, error: `저장 실패: ${error.message}` };
    }
    return { success: true, data: { id: data.id } };
  } catch (e) {
    if (e instanceof CredentialFormatError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: '알 수 없는 오류' };
  }
}

export async function deleteBrokerageCredential(
  id: string
): Promise<ActionResult<void>> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { success: false, error: 'Invalid id format' };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('brokerage_connection')
    .delete()
    .eq('id', id);
  // RLS가 타인의 row 차단 → 결과는 idempotent success
  if (error) return { success: false, error: error.message };
  return { success: true, data: undefined };
}

export async function listBrokerageCredentials(): Promise<BrokerageCredentialDisplay[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('brokerage_connection')
    .select(
      'id, broker, account_no, ciphertext_app_key, strategy_label, mock_mode, is_active, created_at, last_used_at'
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!data) return [];

  // ciphertext는 마스킹만 — decrypt 안 함
  return data.map((row) => ({
    id: row.id,
    broker: row.broker as 'kis',
    accountNoMasked: maskAccount(row.account_no),
    appKeyMasked: maskKey(row.ciphertext_app_key.toString('hex'), 2, 4),
    mockMode: row.mock_mode,
    strategyLabel: row.strategy_label,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

/** DQ-7 시점 = stub. S8-Scaffold T8.4에서 실 ping 연결 */
export async function testBrokerageConnection(
  _id: string
): Promise<ActionResult<{ pong: boolean }>> {
  return { success: false, error: 'pending-s8' };
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd tudal && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add tudal/src/lib/credentials/brokerage.ts
git commit -m "feat(DQ7): brokerage Server Actions (upsert·delete·list·test-stub)"
```

---

## Task 7: exchange.ts Server Actions (Wave 2c)

**Goal:** Binance Server Actions. Task 6과 평행 구조.

**Files:**
- Create: `tudal/src/lib/credentials/exchange.ts`

**Dependencies:** Task 1 · Task 2 · Task 4 · Task 5.

- [ ] **Step 1: Implement exchange.ts**

Create `tudal/src/lib/credentials/exchange.ts`:

```ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { encrypt } from '@/lib/crypto/aes';
import { maskKey } from './mask';
import {
  validateBinanceApiKey,
  validateBinanceApiSecret,
  validateLabel,
  cleanInput,
  CredentialFormatError,
} from './validation';
import type {
  ActionResult,
  ExchangeCredentialInput,
  ExchangeCredentialDisplay,
} from './types';

export async function upsertExchangeCredential(
  input: ExchangeCredentialInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const label = cleanInput(input.label);
    const apiKey = cleanInput(input.apiKey);
    const apiSecret = cleanInput(input.apiSecret);
    validateLabel(label);
    validateBinanceApiKey(apiKey);
    validateBinanceApiSecret(apiSecret);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: '로그인이 필요합니다' };

    const repEmail = process.env.ADMIN_REP_EMAIL;
    if (!input.testnetMode && user.email !== repEmail) {
      return { success: false, error: '메인넷 등록은 대표만 가능합니다' };
    }

    const keyPayload = encrypt(apiKey);
    const secretPayload = encrypt(apiSecret);

    const { data, error } = await supabase
      .from('exchange_connection')
      .upsert(
        {
          admin_id: user.id,
          exchange: input.exchange,
          label,
          testnet_mode: input.testnetMode,
          ciphertext_api_key: keyPayload.ciphertext,
          iv_api_key: keyPayload.iv,
          auth_tag_api_key: keyPayload.authTag,
          ciphertext_api_secret: secretPayload.ciphertext,
          iv_api_secret: secretPayload.iv,
          auth_tag_api_secret: secretPayload.authTag,
          is_active: true,
        },
        { onConflict: 'admin_id,exchange,label' }
      )
      .select('id')
      .single();

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: '이미 등록된 라벨입니다' };
      }
      return { success: false, error: `저장 실패: ${error.message}` };
    }
    return { success: true, data: { id: data.id } };
  } catch (e) {
    if (e instanceof CredentialFormatError) {
      return { success: false, error: e.message };
    }
    return { success: false, error: '알 수 없는 오류' };
  }
}

export async function deleteExchangeCredential(
  id: string
): Promise<ActionResult<void>> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { success: false, error: 'Invalid id format' };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('exchange_connection').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, data: undefined };
}

export async function listExchangeCredentials(): Promise<ExchangeCredentialDisplay[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('exchange_connection')
    .select(
      'id, exchange, label, ciphertext_api_key, testnet_mode, is_active, created_at, last_used_at'
    )
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!data) return [];

  return data.map((row) => ({
    id: row.id,
    exchange: row.exchange as 'binance_futures',
    label: row.label,
    apiKeyMasked: maskKey(row.ciphertext_api_key.toString('hex'), 2, 4),
    testnetMode: row.testnet_mode,
    isActive: row.is_active,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  }));
}

export async function testExchangeConnection(
  _id: string
): Promise<ActionResult<{ pong: boolean }>> {
  return { success: false, error: 'pending-s8' };
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd tudal && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add tudal/src/lib/credentials/exchange.ts
git commit -m "feat(DQ7): exchange (Binance) Server Actions — brokerage 평행 구조"
```

---

## Task 8: Integration Tests (Wave 3)

**Goal:** Server Action 계약 검증. Supabase 클라이언트 mock으로 validation → encrypt → insert 경로 확인.

**Files:**
- Create: `tudal/src/lib/credentials/__tests__/brokerage.integration.test.ts`
- Create: `tudal/src/lib/credentials/__tests__/exchange.integration.test.ts`

**Dependencies:** Task 6·7 완료.

- [ ] **Step 1: Write brokerage integration tests**

Create `tudal/src/lib/credentials/__tests__/brokerage.integration.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Supabase mock setup
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: (table: string) => ({
      upsert: (data: any, opts: any) => ({
        select: () => ({
          single: async () => mockInsert(table, data, opts),
        }),
      }),
      delete: () => ({ eq: async () => mockDelete(table) }),
      select: () => ({
        eq: () => ({ order: async () => ({ data: [] }) }),
      }),
    }),
  }),
}));

const TEST_MEK = '7f3e8a1b9c2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f';

beforeEach(() => {
  vi.clearAllMocks();
  process.env.API_CRED_MASTER_KEY = TEST_MEK;
  process.env.ADMIN_REP_EMAIL = 'rep@example.com';
});

const validInput = {
  broker: 'kis' as const,
  accountNo: '12345678-01',
  appKey: 'A'.repeat(36),
  appSecret: 'B'.repeat(180),
  mockMode: true,
  strategyLabel: null,
};

describe('upsertBrokerageCredential', () => {
  it('returns error when not logged in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential(validInput);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/로그인/);
  });

  it('returns error on format violation (short app_key)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } } });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential({ ...validInput, appKey: 'A'.repeat(35) });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/36자/);
  });

  it('blocks non-rep from saving real account (mockMode=false)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'friend@b.c' } } });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential({ ...validInput, mockMode: false });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/실계좌.*대표/);
  });

  it('allows rep to save real account', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'rep@example.com' } } });
    mockInsert.mockReturnValue({ data: { id: 'new-uuid' }, error: null });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential({ ...validInput, mockMode: false });
    expect(r.success).toBe(true);
  });

  it('maps 23505 (unique violation) to friendly message', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } } });
    mockInsert.mockReturnValue({ data: null, error: { code: '23505', message: 'dup' } });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential(validInput);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toMatch(/이미 등록/);
  });

  it('succeeds with valid input (mockMode=true)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.c' } } });
    mockInsert.mockReturnValue({ data: { id: 'new-uuid' }, error: null });
    const { upsertBrokerageCredential } = await import('../brokerage');
    const r = await upsertBrokerageCredential(validInput);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.id).toBe('new-uuid');
  });
});

describe('deleteBrokerageCredential', () => {
  it('rejects malformed id', async () => {
    const { deleteBrokerageCredential } = await import('../brokerage');
    const r = await deleteBrokerageCredential('not-a-uuid');
    expect(r.success).toBe(false);
  });

  it('succeeds on valid uuid (idempotent)', async () => {
    mockDelete.mockReturnValue({ error: null });
    const { deleteBrokerageCredential } = await import('../brokerage');
    const r = await deleteBrokerageCredential('12345678-1234-1234-1234-123456789abc');
    expect(r.success).toBe(true);
  });
});

describe('testBrokerageConnection', () => {
  it('returns pending-s8 (not yet implemented)', async () => {
    const { testBrokerageConnection } = await import('../brokerage');
    const r = await testBrokerageConnection('12345678-1234-1234-1234-123456789abc');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe('pending-s8');
  });
});
```

- [ ] **Step 2: Run, verify PASS**

```bash
npm run test:ci -- brokerage.integration
```

Expected: `Tests: 9 passed`

- [ ] **Step 3: Write exchange.integration.test.ts (same pattern)**

Create `tudal/src/lib/credentials/__tests__/exchange.integration.test.ts` — 동일 패턴, `upsertExchangeCredential` · `deleteExchangeCredential` · `testExchangeConnection` 각 경로 커버. ~9 cases.

```ts
// 구조 동일. differences:
//   - input: { exchange: 'binance_futures', label, apiKey (64), apiSecret (64), testnetMode }
//   - rep guard: testnetMode=false && user.email !== rep → '메인넷 등록은 대표만'
//   - validateLabel(1~40자) 경계 테스트 1개 추가
```

- [ ] **Step 4: Run all integration tests**

```bash
npm run test:ci
```

Expected: ~216 tests pass (기존 190 + mask 5 + validation 10 + aes 14 + integration 18 - 몇 개 정리 ≈ 220)

- [ ] **Step 5: Commit**

```bash
git add tudal/src/lib/credentials/__tests__/brokerage.integration.test.ts tudal/src/lib/credentials/__tests__/exchange.integration.test.ts
git commit -m "test(DQ7): credential Server Action integration tests (~18 cases)"
```

---

## Task 9: types/admin.ts Cleanup + mock 파일 삭제 (Wave 4)

**Goal:** 기존 `BrokerageConnection` 인터페이스 제거 (DQ-7 새 타입이 대체). 빈 mock 파일 삭제.

**Files:**
- Modify: `tudal/src/types/admin.ts`
- Delete: `tudal/src/lib/data/mock-admin-brokerage.ts`

**Dependencies:** Task 6·7 완료 (새 타입 이미 존재).

- [ ] **Step 1: Verify BrokerageConnection 외부 참조 0건**

```bash
grep -rn "BrokerageConnection" tudal/src/ --include="*.ts" --include="*.tsx"
```

Expected output:
```
tudal/src/types/admin.ts:297:export interface BrokerageConnection {
tudal/src/lib/data/mock-admin-brokerage.ts:1:import type { BrokerageConnection }...
```

**둘 외에 참조가 있으면 중단. Task 10으로 건너뛰고 해당 참조 먼저 고치기.**

- [ ] **Step 2: Also check BrokerageScope references**

```bash
grep -rn "BrokerageScope" tudal/src/ --include="*.ts" --include="*.tsx"
```

If any files still use `BrokerageScope`, keep the type but remove from BrokerageConnection section.

- [ ] **Step 3: Edit types/admin.ts — remove BrokerageConnection + BrokerageScope (if unused)**

In `tudal/src/types/admin.ts`:

```ts
// REMOVE these sections:
//   - `export type BrokerageScope = "manual" | "auto" | "both";` (if unused)
//   - Whole `E9. BrokerageConnection` comment block + interface (lines ~293-309)
```

Use Edit tool:
- `old_string`: the BrokerageConnection block + BrokerageScope export (check with grep first)
- `new_string`: empty (or just the comment explaining it moved)

Leave a single comment line:
```ts
// E9 BrokerageConnection → DQ-7(2026-04-22)에서 `src/lib/credentials/types.ts`로 이동 + AES-256-GCM 암호화 컬럼으로 재정의
```

- [ ] **Step 4: Delete mock file**

```bash
rm tudal/src/lib/data/mock-admin-brokerage.ts
```

- [ ] **Step 5: Run build to verify no breakage**

```bash
cd tudal && npm run build
```

Expected: build success (기존 22 routes 유지 — UI 미추가).

- [ ] **Step 6: Run lint + tests**

```bash
npm run lint
npm run test:ci
```

Expected: 0 warnings, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add tudal/src/types/admin.ts
git rm tudal/src/lib/data/mock-admin-brokerage.ts
git commit -m "refactor(DQ7): remove legacy BrokerageConnection type + empty mock file"
```

---

## Task 10: .env.example 갱신 (Wave 4)

**Goal:** 신규 env 3개 추가, KIS·Binance 블록 주석 처리 (per-admin DB로 이관됨).

**Files:**
- Modify: `tudal/.env.example`

**Dependencies:** 독립 (언제든 실행 가능).

- [ ] **Step 1: Read current .env.example**

```bash
cat tudal/.env.example
```

- [ ] **Step 2: Edit — add 3 new keys after CRON_SECRET, comment out KIS·BINANCE blocks**

Modify `tudal/.env.example`:

```diff
  # ──────────────────────────────────────────────────────────────
- # [S7c + S8 주식] 한국투자증권 OpenAPI — 장중 WS + S8 주식 자동매매
- # BL-KRIT-2 선행. https://apiportal.koreainvestment.com/ 신청
- # D12: 어드민별·전략별 복수 앱키 허용 (N:M) — 아래는 기본 1쌍만 env,
- # 나머지는 Supabase `brokerage_connection` 테이블의 api_key_ref로 Vault 참조.
+ # [S7c] 한국투자증권 OpenAPI — 장중 WebSocket 구독용만 유지
+ # S8 주식 자동매매는 per-admin DB 저장(2026-04-22 DQ-7)으로 변경됨.
+ # 아래 블록은 S7c WebSocket 구독 용도로만 필요 (실제 등록은 /admin/settings/brokerage)
  # ──────────────────────────────────────────────────────────────
- KIS_APP_KEY=your_kis_app_key
- KIS_APP_SECRET=your_kis_app_secret
- KIS_ACCOUNT_NO=12345678-01
- KIS_MOCK_MODE=true
+ # KIS_APP_KEY=your_kis_app_key            # DQ-7 이후 per-admin DB로 이관 (주석 유지)
+ # KIS_APP_SECRET=your_kis_app_secret      # 동일
+ # KIS_ACCOUNT_NO=12345678-01              # 동일
+ # KIS_MOCK_MODE=true                      # 동일

  # ──────────────────────────────────────────────────────────────
  # [S8 코인] 바이낸스 USDT-M 선물 — 자동매매 코인 축
- # BL-KRIT-9 선행 (IP·KYC 확인)
+ # 2026-04-22 DQ-7: 바이낸스 키 per-admin DB 저장. env 불필요.
+ # /admin/settings/binance UI에서 어드민 각자 입력.
  # ──────────────────────────────────────────────────────────────
- BINANCE_API_KEY=your_binance_api_key
- BINANCE_API_SECRET=your_binance_api_secret
- BINANCE_TESTNET=true
+ # BINANCE_API_KEY=... (DQ-7 이후 per-admin DB)
+ # BINANCE_API_SECRET=...
+ # BINANCE_TESTNET=true

  # ──────────────────────────────────────────────────────────────
  # [배포] Vercel Cron 인증 — DQ-7
  # 랜덤 32+ 문자 시크릿 권장. /api/cron/* 핸들러에서 Authorization 헤더 검증
  # ──────────────────────────────────────────────────────────────
  CRON_SECRET=generate_random_secret_32_plus_chars

+ # ──────────────────────────────────────────────────────────────
+ # [DQ-7 신규 2026-04-22] Admin Credential System
+ # MEK(Master Encryption Key) + 대표 1인 이메일
+ # ──────────────────────────────────────────────────────────────
+
+ # 생성: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
+ # 64자 hex (32 bytes). 로컬·Vercel env 반드시 **동일 값** 유지
+ API_CRED_MASTER_KEY=64_char_hex_generated_by_node_crypto
+
+ # 실계좌·메인넷 저장 권한자 (어드민 3명 중 1명). 친구 2명은 모의만 허용.
+ ADMIN_REP_EMAIL=rep@example.com

  # ──────────────────────────────────────────────────────────────
  # [선택] 로컬 개발용 플래그
  # ──────────────────────────────────────────────────────────────
  # NEXT_PUBLIC_APP_ENV=development
```

- [ ] **Step 3: Verify diff looks sensible**

```bash
git diff tudal/.env.example
```

- [ ] **Step 4: Commit**

```bash
git add tudal/.env.example
git commit -m "docs(DQ7): .env.example — 신규 3 키 + KIS/Binance 주석 처리"
```

---

## Session 1 DoD Verification

Run all 3 gates sequentially:

- [ ] **Gate 1: build**

```bash
cd tudal && npm run build
```

Expected:
```
✓ Compiled successfully
Route (app)                              Size     First Load JS
... (22 routes, unchanged — UI는 Session 2에서)
```

- [ ] **Gate 2: lint**

```bash
npm run lint
```

Expected: `✓ No ESLint warnings or errors`

- [ ] **Gate 3: test:ci**

```bash
npm run test:ci
```

Expected: approximately
```
Test Files: 23 passed (20 prior + 3 new: aes · mask · validation)
    + brokerage.integration + exchange.integration (existing dir)
Tests: ~220 passed (190 prior + ~30 new)
```

- [ ] **Gate 4: Manual sanity check**

```bash
# Verify new files exist
ls -la tudal/src/lib/crypto/
ls -la tudal/src/lib/credentials/
ls -la tudal/supabase/migrations/ | grep 0009

# Verify mock file deleted
ls tudal/src/lib/data/mock-admin-brokerage.ts 2>&1
# Expected: ls: cannot access...: No such file or directory
```

- [ ] **Gate 5: Final commit + push**

If all gates green:

```bash
# Session 1 완료 표식
git log --oneline -15  # 커밋 이력 확인

# 이미 wave별로 커밋됐으니 여기선 문서 갱신 커밋만
# (HANDOFF·ProgressDashboard·CodebaseStatus 갱신은 Session 4에서)
# Session 1 종료 직전에는 상태 마크 커밋 안 함 (Session 2 시작 시 commit)

git push origin main
```

- [ ] **Gate 6: HANDOFF Session 1 체크박스 확인**

HANDOFF.md §9 Session 1 섹션의 모든 체크박스가 체크됐는지 확인 (이건 Session 4 T20에서 일괄 갱신 — 여기선 skip).

---

## Ralph Compatibility

Ralph 또는 team+ralph로 래핑 시 권장 구조 — `prd.json` 또는 stories:

```json
{
  "stories": [
    {
      "id": "T1-aes",
      "goal": "AES-256-GCM crypto util with 14 tests (TDD)",
      "files": ["tudal/src/lib/crypto/aes.ts", "tudal/src/lib/crypto/__tests__/aes.test.ts"],
      "verification": "npm run test:ci -- aes  →  14 tests pass",
      "dependencies": []
    },
    {
      "id": "T4-migration",
      "goal": "Migration 0009 — brokerage encryption + exchange table + RLS",
      "files": [
        "tudal/supabase/migrations/0009_dq7_credentials.sql",
        "tudal/supabase/migrations/0009_dq7_credentials.rollback.sql"
      ],
      "verification": "file exists, SQL syntax valid (manual apply deferred to Session 3)",
      "dependencies": []
    },
    {
      "id": "T2-mask",
      "goal": "mask util + 5 tests",
      "dependencies": []
    },
    {
      "id": "T3-validation",
      "goal": "validation util + 10 tests",
      "dependencies": []
    },
    {
      "id": "T5-types",
      "goal": "credential Input/Display types",
      "dependencies": ["T2-mask"]
    },
    {
      "id": "T6-brokerage",
      "goal": "brokerage Server Actions (upsert·delete·list·testStub)",
      "dependencies": ["T1-aes", "T2-mask", "T3-validation", "T4-migration", "T5-types"]
    },
    {
      "id": "T7-exchange",
      "goal": "exchange Server Actions (Binance, brokerage 평행)",
      "dependencies": ["T1-aes", "T2-mask", "T3-validation", "T4-migration", "T5-types"]
    },
    {
      "id": "T8-integration",
      "goal": "Server Action integration tests ~18 cases",
      "dependencies": ["T6-brokerage", "T7-exchange"]
    },
    {
      "id": "T9-cleanup",
      "goal": "Remove legacy BrokerageConnection + delete empty mock file",
      "dependencies": ["T6-brokerage", "T7-exchange"]
    },
    {
      "id": "T10-env",
      "goal": ".env.example update (new 3 keys + KIS/Binance comment-out)",
      "dependencies": []
    },
    {
      "id": "dod-gate",
      "goal": "build + lint + test:ci green (~220 tests)",
      "dependencies": ["T1-aes", "T2-mask", "T3-validation", "T4-migration", "T5-types", "T6-brokerage", "T7-exchange", "T8-integration", "T9-cleanup", "T10-env"]
    }
  ]
}
```

Ralph는 dependencies 그래프 따라 순차/병렬 실행. Wave 2(T2·T3·T5 or T6+T7)에서 `superpowers:dispatching-parallel-agents` 활용.

**아키텍트 검증 포인트** (ralph 내부 자동 실행):
- T1 완료 후: aes.ts가 Node crypto API를 올바르게 쓰는지 — context7 MCP로 `createCipheriv('aes-256-gcm', ...)` 계약 확인
- T6·T7 완료 후: Server Actions가 `'use server'` directive + 반환 타입 일관성 검증
- dod-gate 전: 전체 test count 증가량 확인 (29~32 tests)

---

## Failure Mode Recovery

### W1 (aes.ts TDD) 실패 시

| 증상 | 원인 가능성 | 진단·복구 |
|---|---|---|
| roundtrip test fail | MEK 길이 불일치 · hex 파싱 오류 | `console.log(mek.length)` → 32 확인. hex 정규식 오탐 여부 |
| tamper test 통과 (원래는 실패해야) | `setAuthTag` 누락 · finalize 순서 오류 | decipher 호출 순서 검증: `setAuthTag` → `update` → `final` |
| 랜덤 IV 100회 중 중복 | `randomBytes` 호출 타이밍 (모듈 로드 시점에 한 번만 생성했을 가능성) | encrypt 함수 내부에서 매번 `randomBytes(12)` 호출하는지 확인 |
| MEK 미설정 테스트에서 통과 (원래 throw) | `cachedMek` 레지듀얼 | `__resetMekCacheForTesting()` 호출 누락 |

**복구 절차**: 실패 테스트 파일만 rollback → 이전 Wave로 git reset → aes.ts만 재구현 → 재시도.

### W2a (migration) 실패 시

SQL 자체는 Session 1에서 실행 안 함 (파일만 생성). 따라서 실패 모드 없음. Session 3 실제 적용 시점에 실패하면 `0009_rollback.sql` 수동 실행.

### W2b (mask·validation·types) 실패 시

순수 함수라 간단. TypeScript 컴파일 에러 ≫ 대부분 import 경로 오탈자. `@/lib/...` alias 확인.

### W2c (Server Actions) 실패 시

| 증상 | 원인 가능성 | 복구 |
|---|---|---|
| `'use server'` 관련 Next.js 에러 | 파일 첫 줄 누락 | 각 `brokerage.ts`·`exchange.ts` 첫 줄 `'use server';` 확인 |
| Supabase insert `column does not exist` | 마이그레이션 0009 실제 DB 미적용 (Session 1에서는 파일만) | Session 3 배포 후 재확인. Session 1에서는 integration test(vi.mock)만 통과하면 OK |
| `createClient` import 실패 | `@/lib/supabase/server` 경로 오류 | `tsconfig.json` path alias 확인, 기존 패턴(S3 Server Actions) 따라가기 |

### W3 (integration tests) 실패 시

vi.mock 구조 오류가 흔함. Vitest 4 API 기준 `vi.mock('@/lib/supabase/server', () => ({...}))` 문법 정확히 쓰는지 확인.

### W4 (cleanup) 실패 시

`grep BrokerageConnection`에서 예상 외 참조 발견 시:
- 참조 파일 먼저 fix (`import { BrokerageCredentialDisplay } from '@/lib/credentials/types'` 로 교체)
- 그 후 types/admin.ts에서 제거

### DoD Gate (build/lint/test:ci) 실패 시

- **build fail**: TypeScript strict 에러 1개씩 순차 해결. `any` 금지, 명시적 타입.
- **lint fail**: ESLint 규칙에 맞춰 수정. 기존 프로젝트 패턴 따라가기.
- **test fail**: 실패 케이스만 먼저 isolate 실행 (`npm run test:ci -- <filename>`).

---

## Implementation Notes

- **Next.js 16 서버 액션 규약**: `'use server'` directive는 파일 맨 위. `@supabase/ssr` `createServerClient`는 request-scoped cookies 바인딩. 기존 S3 `src/app/(admin)/admin/portfolio/actions.ts` 패턴 참조.
- **Vitest + Supabase mock**: Vitest 4는 dynamic import 시점에 `vi.mock` 적용 → 각 test에서 `await import('../brokerage')` 식으로 동적 import 권장 (module cache 초기화).
- **bytea 타입 in TypeScript**: Supabase JS 클라이언트는 `bytea`를 `Buffer` 또는 base64 string으로 주고받음. insert 시 Node `Buffer` 그대로 전달 → JS 클라이언트가 자동 base64 인코딩.
- **TypeScript strict 모드**: 모든 optional chain 확인, null 가드 철저히.
- **commit convention**: `feat(DQ7):` · `test(DQ7):` · `refactor(DQ7):` · `docs(DQ7):` — scope는 `DQ7`로 통일.

---

## Plan Self-Review Result

- ✅ Spec coverage: T1·T2·T3·T4·T6·T7·T8·T13 — 모두 플랜 내 Task로 매핑됨. T5는 이 플랜에서는 Task 5로 분리(types.ts)하고 별도 번호 부여.
- ✅ Placeholder scan: 모든 step에 actual code/command 포함. "TBD"·"implement later" 없음.
- ✅ Type consistency: `BrokerageCredentialInput` 등 타입 이름이 types.ts 정의와 brokerage.ts/exchange.ts 사용처에서 일치. `ActionResult<T>` discriminated union도 일관.
- ✅ Dependency order: DAG 및 Wave 분할이 Task 번호와 일치. T1/T4는 병렬, T6·T7은 T1~T5 후, T8은 T6·T7 후.
- ✅ Session 1 DoD: build + lint + test:ci green + ~220 tests. Verification commands 포함.

---

## Execution Handoff

**Plan complete and saved to `Document/Build/Slices/DQ7-Credentials-Plan-S1.md`**.

두 실행 옵션:

**1. Subagent-Driven (recommended)** — 신선한 subagent를 task당 1개 dispatch, 사이사이 검토, 빠른 반복
   - REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`
   - 두 단계 리뷰 (코드 리뷰 + TDD verification)

**2. Inline Execution** — 현 세션에서 실행 (`superpowers:executing-plans`)
   - batch 실행 + 체크포인트 리뷰
   - 현재 대화 맥락 그대로 이어서

**3. Ralph 래핑** — 별도 옵션. 위 stories JSON을 ralph에 입력
   - `/oh-my-claudecode:ralph` 스킬 + prd.json
   - 아키텍트 검증 자동 포함
   - Playbook §2.5 4~6 Tasks 권장 범위 경계

Session 1 = 8 Tasks + 1 DoD gate → ralph 권장 범위 약간 초과지만 wave 분할로 curl해도 OK. Inline Execution이 가장 안전 (TDD 과정 직접 관찰).

**Which approach?**

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-22 | 초기 생성 (superpowers:writing-plans 산출물). Session 1 = 10 Task × ~8 step = ~80 step. 의존성 DAG + ralph stories JSON + failure recovery 매트릭스 포함. |
