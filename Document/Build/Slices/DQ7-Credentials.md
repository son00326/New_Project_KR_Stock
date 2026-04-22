# DQ-7 · Admin Credential System Redesign + Vercel 첫 배포

```
---
slice_id: DQ7
slice_name: 어드민 per-admin API 크레덴셜 저장 체계 + Vercel 배포 환경변수 세팅
architect_id: DQ7 (S7 이전 독립 인프라 트랙, 2026-04-22 brainstorming 확정)
status: ⚪ 대기 (spec 승인 후 writing-plans 단계로 이관)
expected_sessions: 4
current_progress: 0%
---
```

Last updated: 2026-04-22
선행 문서: `Document/Process/HANDOFF.md` §3 DQ-7·§4 BL-KRIT · `Document/Service/Planning/ServicePlan-Admin.md` §D12·§3.13 · `Document/Build/Slices/S8-AutoTrading.md` T8.4·T8.5

> **이 파일은 superpowers:brainstorming 산출물 = 설계 스펙이다.** 다음 단계에서 superpowers:writing-plans가 이 spec을 입력으로 구현 플랜(Wave·Task 세분화)을 작성한다.

---

## §0 목표 (Why)

HANDOFF.md §3 DQ-7 "Vercel 배포 환경변수 세팅 계획"을 구현 가능한 수준으로 구체화한다. 2026-04-22 사용자 결정으로 **바이낸스와 KIS API 키는 어드민 각자 UI로 직접 입력 · DB에 암호화 저장**하는 방향으로 프레임이 확장됐다. 따라서 이 슬라이스는:

1. **per-admin 크레덴셜 저장 체계 신설** (AES-256-GCM 암호화, E9 확장 + E12 신설)
2. **Vercel 첫 프리뷰 배포** (최소 env 7개 + Production Branch 트릭으로 프로덕션 승격 지연)
3. **`/admin/settings/brokerage`·`/admin/settings/binance` 2 라우트 UI** (S8-Scaffold T8.4에서 선행 이관)

완료 기준 = 어드민 3명이 Vercel preview URL에서 Magic Link 로그인 + KIS·Binance 키 저장(UI) + 삭제 + RLS 격리 검증까지 동작.

실 API ping(KIS OAuth·Binance 계좌 조회)은 **S8-Scaffold T8.10 이후** 수행. 이 슬라이스에서는 UI 버튼만 `disabled` 상태로 박는다.

---

## §1 확정된 설계 결정 (2026-04-22 brainstorming)

| # | 결정 | 선택 | 근거 |
|---|---|---|---|
| Q1 | 바이낸스 per-admin DB → KIS도 동일 적용? | (a) 예, 둘 다 per-admin DB | DQ-9 (a) "본인+친구 각자 계정" 정합. 보안 모델 단일 |
| Q2 | 암호화 레이어 선택 | (a) App-layer AES-256-GCM (Node `crypto` stdlib) | Postgres 확장 불필요 · 의존 0 · 3-admin 스케일에 적합 · 나중 envelope·Vault 이전 경로 깨끗 |
| Q3 | Vercel 배포 타이밍 | (a) 이 슬라이스에서 즉시 · 최소 env 3개부터 | Cron 실 실행 검증 즉시 시작 · 친구 2명 원격 UI 접근 가능 · env는 언제든 추가 |
| Q4 | DB 스키마 형태 | (b) 분리 2테이블 (E9 확장 + E12 신설) | 유지보수 우수 · 도메인 발산 대응 · TypeScript 타입 안전성 |
| Q5 | "테스트 연결" 버튼 범위 | (a) UI만 (disabled) · 실 ping은 S8 | 슬라이스 타이트 유지 · BL-KRIT-2/9 블로커에 무관하게 진행 |

---

## §2 아키텍처 개요

### 모듈 맵
```
Browser (어드민)
  ├─ /admin/settings/brokerage  (KIS)
  └─ /admin/settings/binance    (Binance USDT-M)
         │  Server Action POST (plaintext)
         ▼
Next.js Server (Vercel)
  ├─ src/lib/crypto/aes.ts               AES-256-GCM encrypt/decrypt (MEK from env)
  ├─ src/lib/credentials/types.ts        Input·Display 타입
  ├─ src/lib/credentials/validation.ts   format·length regex
  ├─ src/lib/credentials/mask.ts         마스킹 포매터 (공유)
  ├─ src/lib/credentials/brokerage.ts    KIS Server Actions
  └─ src/lib/credentials/exchange.ts     Binance Server Actions
         │  @supabase/ssr (user session 바인딩)
         ▼
Supabase PostgreSQL
  ├─ brokerage_connection   (E9 확장: ciphertext·iv·auth_tag × 2)
  ├─ exchange_connection    (E12 신설: 동일 구조 + testnet_mode)
  └─ RLS: admin_id = auth.uid() AND is_admin()

Vercel Env (Settings → Environment Variables)
  ├─ NEXT_PUBLIC_SUPABASE_URL · ANON_KEY
  ├─ SUPABASE_SERVICE_ROLE_KEY
  ├─ ADMIN_EMAILS
  ├─ ADMIN_REP_EMAIL       ← 신규
  ├─ API_CRED_MASTER_KEY   ← 신규 (32-byte hex, MEK)
  ├─ CRON_SECRET           ← 신규
  └─ (Phase별 추가) ANTHROPIC · NAVER · RESEND · TELEGRAM
```

### 핵심 흐름

- **Write**: form → Server Action → validation → `encrypt(secret, MEK)` → `{ciphertext, iv, auth_tag}` + `admin_id` INSERT → `router.refresh()`
- **Read (list)**: Server Component가 `SELECT` (RLS로 본인 row만) → `ciphertext 디코드 안 함` → 마스킹 표시(`AK**···ab12`)
- **Edit**: "편집" 버튼 없음 → **삭제 후 재등록**만 허용. secret 중간 상태 배제
- **Test connection**: DQ-7 시점 = UI 버튼 `disabled` · tooltip "S8에서 활성화". S8-Scaffold 때 Server Action이 `broker.ping(decrypted)`로 라우팅

### 보안 경계

- **MEK는 단일 실패점**: Vercel env 유출 = 모든 row 복호화 가능
- **완화**: (i) admin_id RLS로 blast radius를 "한 어드민 row"로 제한 (ii) secret은 한 번도 클라이언트로 리턴 안 됨 (iii) Vercel env 접근 권한 Admin only (iv) MEK 로테이션 스크립트 준비 · 1Password 이중 보관
- **Envelope(MEK+DEK) 미채택**: 3-admin·≤10건 스케일에 과잉. 필요 시 컬럼 1개 추가 + 마이그레이션으로 업그레이드

### YAGNI — 지금 안 하는 것

- 환경변수 secrets manager (AWS Secrets Manager 등) — Vercel env면 충분
- Per-admin KEK (envelope 암호화)
- 키 유효성 실 ping — S8로 이관
- Audit log 테이블 신설 — 기존 `alert_event`에 타입 확장 or 나중

---

## §3 Backend 설계

### §3.1 `src/lib/crypto/aes.ts` (신규, TDD 대상)

```ts
// Node stdlib only — zero dependency
type EncryptedPayload = {
  ciphertext: Buffer;  // Postgres bytea로 저장
  iv: Buffer;          // 12 bytes (GCM 권장)
  authTag: Buffer;     // 16 bytes
};

function loadMek(): Buffer;                // process.env.API_CRED_MASTER_KEY hex → 32-byte Buffer
function encrypt(plaintext: string): EncryptedPayload;
function decrypt(payload: EncryptedPayload): string;

// Errors
class MekConfigurationError extends Error {}
class DecryptionError extends Error {}
```

**설계 포인트**:
- **IV 매 encrypt마다 랜덤** (`crypto.randomBytes(12)`)
- **MEK lazy singleton**: 미설정 시 첫 호출에서 throw (빌드 시점엔 영향 없음)
- **MEK 생성**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **로그 금지**: MEK·plaintext·ciphertext hex를 `console.log`/`Error.message`에 포함 금지

### §3.2 `src/lib/credentials/types.ts` (신규)

```ts
export interface BrokerageCredentialInput {
  broker: 'kis';
  accountNo: string;
  appKey: string;
  appSecret: string;
  mockMode: boolean;
  strategyLabel: string | null;
}

export interface BrokerageCredentialDisplay {
  id: string;
  broker: 'kis';
  accountNoMasked: string;   // '12345678-**'
  appKeyMasked: string;       // 'PS**···ab12'
  mockMode: boolean;
  strategyLabel: string | null;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  // secret은 절대 응답에 포함하지 않음
}

export interface ExchangeCredentialInput {
  exchange: 'binance_futures';
  label: string;          // 'main-futures' 등
  apiKey: string;
  apiSecret: string;
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

### §3.3 Server Actions — `brokerage.ts`·`exchange.ts` (신규)

```ts
'use server';

// KIS (exchange.ts는 Binance로 동일 구조)
export async function upsertBrokerageCredential(input: BrokerageCredentialInput)
  : Promise<ActionResult<{ id: string }>>;

export async function deleteBrokerageCredential(id: string)
  : Promise<ActionResult<void>>;

export async function listBrokerageCredentials()
  : Promise<BrokerageCredentialDisplay[]>;

export async function testBrokerageConnection(id: string)
  : Promise<ActionResult<{ pong: boolean }>>;
  // DQ-7 시점 = { success: false, error: 'pending-s8' } 하드코드
```

**설계 포인트**:
- **Supabase 클라이언트 = user session 기반** (`createServerClient` from `@supabase/ssr`) — **service_role 사용 금지**. RLS가 `admin_id = auth.uid()`로 자동 격리
- **Format validation → encrypt → INSERT 순서** (가비지 row 차단)
  - KIS APP_KEY 36자 alphanumeric / APP_SECRET 180자 / account_no `\d{8}-\d{2}`
  - Binance API_KEY 64자 alphanumeric / SECRET 64자 / label 20자 이내
- **키·시크릿 개별 암호화**: `ciphertext_key·iv_key·auth_tag_key` + `ciphertext_secret·iv_secret·auth_tag_secret` 2 세트
- **반환 규약**: `{success: true, data} | {success: false, error: string}` (G-2 준수)
- **Idempotency**: upsert는 `UNIQUE(admin_id, broker, account_no)` 충돌 시 UPDATE

### §3.4 `scripts/rotate-cred-mek.ts` (신규, 일회성)

```
사용: node scripts/rotate-cred-mek.ts --old <hex> --new <hex> [--dry-run]
1. brokerage_connection + exchange_connection 전수 SELECT (service_role)
2. old MEK로 복호화 → new MEK로 재암호화 → UPDATE (단일 트랜잭션)
3. dry-run 모드: row count만 출력, UPDATE 실행 X
```

### §3.5 공유 유틸

- `src/lib/credentials/mask.ts` — `maskKey(s, 2, 4)` · `maskAccount(s)` 순수 함수
- `src/lib/credentials/validation.ts` — 정규식·길이·trim 공통 검증
- 기존 `@/lib/supabase/server` 재사용

### §3.6 에러 타입 매트릭스

| 타입 | 발생 시점 | UI 처리 |
|---|---|---|
| `MekConfigurationError` | 서버 기동 후 첫 암호화 호출 시 MEK 미설정 | 500 + 운영 경보 (S7c 이후 Telegram) |
| `CredentialFormatError` | 입력 검증 실패 | 400 + form field 에러 메시지 |
| `DecryptionError` | auth tag 실패 (row 조작됨) | 500 + 해당 row 자동 격리(`is_active=false`) + 경보 |
| `CredentialNotFoundError` | id로 조회 실패 / 본인 row 아님 | 404 (idempotent delete 제외) |

---

## §4 DB 설계

### §4.1 마이그레이션 번호 배정 — 충돌 해소

**BL-KRIT-7 재배정**: HANDOFF §4에서 0009로 예약돼 있던 `alert_event CHECK 확장`을 **0010으로 밀어둠**. DQ-7이 S7 이전 독립 트랙이므로 0009를 선점.

### §4.2 `supabase/migrations/0009_dq7_credentials.sql`

```sql
BEGIN;

-- =========================================================
-- E9 brokerage_connection 확장 (Vault 참조 → 실 암호화 컬럼)
-- =========================================================
ALTER TABLE brokerage_connection
  DROP COLUMN IF EXISTS api_key_ref,
  ADD COLUMN ciphertext_app_key     bytea NOT NULL,
  ADD COLUMN iv_app_key              bytea NOT NULL
    CHECK (octet_length(iv_app_key) = 12),
  ADD COLUMN auth_tag_app_key        bytea NOT NULL
    CHECK (octet_length(auth_tag_app_key) = 16),
  ADD COLUMN ciphertext_app_secret  bytea NOT NULL,
  ADD COLUMN iv_app_secret           bytea NOT NULL
    CHECK (octet_length(iv_app_secret) = 12),
  ADD COLUMN auth_tag_app_secret     bytea NOT NULL
    CHECK (octet_length(auth_tag_app_secret) = 16),
  ADD COLUMN mock_mode               boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT brokerage_broker_enum CHECK (broker IN ('kis'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_brokerage_admin_broker_account
  ON brokerage_connection(admin_id, broker, account_no);
CREATE INDEX IF NOT EXISTS idx_brokerage_admin_active
  ON brokerage_connection(admin_id, is_active)
  WHERE is_active = true;

-- =========================================================
-- E12 exchange_connection 신설 (코인 거래소)
-- =========================================================
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

-- =========================================================
-- RLS — admin_id 본인 scope + is_admin() 이중 가드
-- =========================================================
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

**롤백 SQL**: `0009_dq7_credentials.rollback.sql` 동반 작성.

### §4.3 타입 정리

- `types/admin.ts`의 기존 `BrokerageConnection` 인터페이스 폐기 (빈 배열 mock만 참조)
- grep으로 사용처 0건 확인 후 삭제
- `src/lib/data/mock-admin-brokerage.ts` 파일 삭제

### §4.4 RLS 테스트 (수동 QA)

- **브라우저**: A 로그인 → credential 저장 → B 로그인 → 0건 조회 확인
- **Supabase Studio SQL**: `set request.jwt.claim.sub to '<non-admin_uuid>';` → `SELECT * FROM exchange_connection;` → 0건 (`is_admin()` false)

---

## §5 Frontend 설계

### §5.1 라우트 구조 (신규 2건)

```
src/app/(admin)/admin/settings/
  brokerage/               # ✨ 신규 — KIS 계좌·API 키
    page.tsx               # Server Component
    form.tsx               # Client
    delete-button.tsx      # Client
  binance/                 # ✨ 신규 — Binance USDT-M 선물
    page.tsx
    form.tsx
    delete-button.tsx

src/components/admin/credentials/    # ✨ 신규 공유
  secret-input.tsx         # password input + show/hide + hygiene
  masked-row.tsx           # list row 공통
```

**추상화 억제**: `/brokerage`·`/binance`는 UI 레이블 차이만 있지만 **generic 컨테이너로 합치지 않음**. 도메인 발산 예정(선물 레버리지 상한 등) · duplicate가 싸다.

### §5.2 Sidebar nav 확장

기존 7 flat nav에 2 item 평행 추가:
```
/admin/settings/brokerage  증권사 키    ✨
/admin/settings/binance    거래소 키    ✨
```
그룹화는 S8(`/risk`·`/strategy`·`/trading/*`) 이후 재편.

### §5.3 UX 결정 매트릭스

| 결정 | 값 | 근거 |
|---|---|---|
| Edit 허용? | ❌ 삭제 후 재등록 | UI 단순 · secret 중간 상태 없음 |
| Secret 표시 | 절대 안 보임 (응답·UI 모두) | 복호화 경로 최소화 |
| Secret 입력 | `type=password` + 눈 아이콘 toggle · `autocomplete=new-password` | 복붙 허용 · autofill 차단 |
| 저장 시 기본값 | `mock_mode=true` / `testnet_mode=true` | 안전 기본값 |
| 실계좌·메인넷 저장 권한 | `ADMIN_REP_EMAIL`만 (env 신설) | 친구 2명은 radio disabled + tooltip "대표 전용" |
| DQ-7 테스트 버튼 | UI는 있으나 `disabled` + tooltip "S8에서 활성화" | Q5 (a) |
| Delete 확인 | Base UI Dialog 2-step | S3 Dialog 재사용 |

### §5.4 마스킹 포맷

| 필드 | 표시 |
|---|---|
| KIS APP_KEY | `PS**···ab12` (prefix 2 + suffix 4) |
| KIS APP_SECRET | 표시 안 함 · "시크릿 저장됨" 체크 아이콘 |
| KIS account_no | `12345678-**` |
| Binance API_KEY | `8c**···ef90` |
| Binance API_SECRET | 표시 안 함 |
| Binance label | 평문 (`main-futures`) |

### §5.5 페이지 구성 (예시: `/admin/settings/brokerage`)

```
┌─────────────────────────────────────────┐
│ 증권사 계좌                              │
│                                         │
│ [등록된 KIS 계좌]                        │
│  ┌─────────────────────────────────┐    │
│  │ KIS 모의투자                    │    │
│  │ 계좌: 12345678-**               │    │
│  │ 키: PS**···ab12 · 시크릿 저장됨  │    │
│  │ 등록: 2026-04-22 · 마지막: —    │    │
│  │ [🔌 테스트 (disabled)] [🗑 삭제] │    │
│  └─────────────────────────────────┘    │
│                                         │
│ [새 KIS 계좌 추가]                       │
│  증권사: KIS (현재 유일)                 │
│  계좌번호: [12345678-01]                 │
│  APP_KEY: [●●●●●●●●●●●●●●] 👁 (0/36)    │
│  APP_SECRET: [●●●●●●●●●●] 👁 (0/180)    │
│  ○ 모의투자  ○ 실계좌 (대표 전용)       │
│  전략 라벨(선택): [단기 모멘텀]          │
│  [저장]                                 │
└─────────────────────────────────────────┘
```

### §5.6 상태·로딩·에러 ([G-1]·[G-2] 준수)

- **Loading**: Server Component 즉시 렌더 · submit 시 `useTransition` pending + 버튼 disabled
- **Error (validation)**: form field 하단 red 메시지
- **Error (server)**: form 상단 banner · 코드 참조 (예: `ENC-001`)
- **Empty**: "등록된 KIS 계좌 없음. 아래에서 추가하세요."
- **Success**: form reset + `router.refresh()` + toast 3s

### §5.7 클라이언트 보안 hygiene

- `secret-input.tsx` unmount 시 `inputRef.current.value = ''`
- Server Action 호출 직후 state 변수 `setSecret('')`
- `autocomplete="new-password"` (password manager 충돌 방지)
- Paste 후 실시간 길이 validation 표시

---

## §6 Vercel 배포 플랜

### §6.1 사전 준비 (로컬)

```bash
# 1. MEK 생성 (64자 hex = 32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. CRON_SECRET 생성
openssl rand -hex 32

# 3. .env.local에 신규 3 키 추가
#    API_CRED_MASTER_KEY · CRON_SECRET · ADMIN_REP_EMAIL

# 4. npm run build + lint + test:ci 3 게이트 green 확인
```

**운영 룰**: 로컬 dev와 Vercel preview는 같은 Supabase 프로젝트를 공유 → **MEK 값 반드시 동일**. 다르면 암호문 갈라짐.

### §6.2 Vercel 프로젝트 초기화

| 설정 | 값 |
|---|---|
| GitHub repo | `son00326/New_Project_KR_Stock` |
| Root Directory | `tudal` |
| Framework | Next.js (auto) |
| **Production Branch** | `production` (존재 안 해도 OK) |
| Preview Branches | `main` + 모든 브랜치 |

**Production Branch 트릭**: `main`을 Preview only로 묶어두고 S9 검증 후 `git push origin main:production`으로 승격.

### §6.3 Vercel env (DQ-7 시점 필수 7개)

| 키 | Environments | 출처 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | All | 기존 `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | DQ-5 갱신값 |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod+Preview | 기존 |
| `ADMIN_EMAILS` | All | 기존 (3명) |
| `ADMIN_REP_EMAIL` | All | ✨ 신규 (대표 1인) |
| `API_CRED_MASTER_KEY` | Prod+Preview | ✨ 신규 MEK |
| `CRON_SECRET` | Prod+Preview | ✨ 신규 |

**Phase별 점진 추가 (DQ-7 밖)**: S7a → ANTHROPIC / S7b → NAVER·RESEND / S7c·d → TELEGRAM.
**영구 미추가**: ~~KIS_*~~·~~BINANCE_*~~ (per-admin DB로 이관).

### §6.4 `.env.example` 갱신

- 신규 3 키 추가
- KIS·Binance 블록은 **주석 처리 + 이관 안내** (완전 삭제보다 이력 가시성↑)
- S8 착수 시 주석도 제거

### §6.5 Supabase Dashboard 설정

| 항목 | 값 |
|---|---|
| Authentication → URL Configuration → Site URL | Preview URL (예: `https://new-project-kr-stock-xxx.vercel.app`) |
| Redirect URLs | Preview URL + 추후 프로덕션 URL (`/auth/callback` 포함) |

Magic Link redirect 필수.

### §6.6 첫 배포 절차

```bash
# 현재 2 commits ahead 상태 (9385e97 · 1e9e116) → Vercel 세팅 완료 후 push
git push origin main
# → Vercel 자동 빌드 → Preview URL 발급

# Smoke test 수행 (다음 섹션)
```

### §6.7 Smoke Test 체크리스트

- [ ] Preview URL 로드 (200)
- [ ] `/login` Magic Link 발송 → 클릭 → `/admin` 렌더
- [ ] 어드민 3명 모두 로그인 가능
- [ ] `/admin/settings/brokerage` 접속 → 빈 상태
- [ ] KIS 계좌 1개 저장 → 목록 + DB row
- [ ] Supabase Studio에서 `ciphertext_app_key` 열기 → plaintext 불가
- [ ] A가 저장한 row B 로그인 조회 → 0건 (RLS)
- [ ] 친구 계정 실계좌 저장 시도 → 403 (대표 전용)
- [ ] `/admin/settings/binance` 동일 시나리오
- [ ] Vercel Cron Jobs Dashboard 4건 노출
- [ ] `/api/cron/monthly-batch` curl + `Authorization: Bearer <CRON_SECRET>` → 200

### §6.8 MEK 보안 운영 룰

1. **저장 이중화**: Vercel env + 1Password/Bitwarden (Vercel만 알면 로스트 시 복구 불가)
2. **접근 권한**: Vercel Admin 롤만
3. **로테이션 트리거**: MEK 유출 의심 시 즉시 `rotate-cred-mek.ts` → Vercel env 갱신 → 재배포
4. **로컬·Vercel MEK 동기화**: 운영 룰 위반 시 credential 갈라짐 (카테고리 1 에러 경로)

### §6.9 프로덕션 승격 기준 (DQ-7 밖, S9 이후)

- [ ] 어드민 3명 2주+ preview 운용
- [ ] Cron 4건 1주+ 실 실행 에러 없음
- [ ] credential CRUD 3인 교차 검증
- [ ] `cost_log` 정상 집계 (S7a 후)
- [ ] → `git push origin main:production`

---

## §7 Error Handling · Edge Cases

### §7.1 암호화 레이어

| 케이스 | 감지 | 처리 |
|---|---|---|
| MEK env 미설정 | `loadMek()` throw | `MekConfigurationError` → 500 + 경보 |
| MEK hex 깨짐 | `loadMek()` 파싱 실패 | 동일 |
| MEK 변경 후 이전 row | decrypt auth tag fail | `DecryptionError` → row `is_active=false` + `alert_event` |
| ciphertext/iv/auth_tag 바이트 변조 | auth tag fail | 동일 격리 경로 |

### §7.2 Form Validation

| 케이스 | 감지 | UI |
|---|---|---|
| APP_KEY 길이 ≠ 36 | `/^[A-Za-z0-9]{36}$/` | "36자 영숫자 필요. 현재 N자" |
| account_no 포맷 오류 | `/^\d{8}-\d{2}$/` | "형식: 12345678-01" |
| 공백 복붙 | client·server `trim()` | 자동 정리 |
| UNIQUE 중복 | DB `23505` catch | "이미 등록된 계좌입니다" |

### §7.3 권한·세션

| 케이스 | 감지 | 처리 |
|---|---|---|
| 세션 만료 | `auth.uid()` null | redirect `/login` |
| ADMIN_EMAILS 밖 | middleware 가드 | `/` redirect (S0) |
| 친구가 `mock_mode=false` 시도 | `session.email !== ADMIN_REP_EMAIL && !input.mockMode` | 403 |
| 타 어드민 row delete | RLS 0 affected | idempotent success (정보 누설 방지) |

### §7.4 동시성

| 케이스 | 처리 |
|---|---|
| 같은 row 두 번 delete | 두 번째 `affected=0` → idempotent success |
| 2 탭 upsert 동시 | UNIQUE로 한쪽 성공 |
| 버튼 연타 | `useTransition` pending 중 disabled |

### §7.5 데이터 무결성

| 케이스 | 처리 |
|---|---|
| DB row 수동 삭제 | `router.refresh()`로 UI 사라짐 |
| 컬럼 부분 훼손 | DecryptionError 경로 |
| 마이그레이션 0009 롤백 | `0009_dq7_credentials.rollback.sql` 수동 실행 |

### §7.6 Vercel 배포 특수

| 케이스 | 처리 |
|---|---|
| `API_CRED_MASTER_KEY` 누락 배포 | 빌드는 성공, 런타임 500 → Smoke Test로 감지 |
| `CRON_SECRET` 불일치 | `/api/cron/*` 401 |
| Redirect URL 미등록 | Magic Link Supabase 에러 페이지 |
| 로컬·Vercel MEK 불일치 | 카테고리 1 경로 경보 폭주 |

### §7.7 MEK 로테이션

| 케이스 | 처리 |
|---|---|
| 스크립트 중간 실패 | 단일 트랜잭션 `BEGIN/COMMIT` — all-or-nothing |
| Vercel env만 교체 | 기존 row 복호화 실패 → 경보 폭주 |
| dry-run 없이 실행 | `--dry-run` 첫 호출 강제 or confirm 프롬프트 |

### §7.8 UX hygiene 실패

| 케이스 | 처리 |
|---|---|
| show 상태 스크린 녹화 | UI 책임 밖 · 입력 완료 후 즉시 hide 복귀 default |
| autofill이 secret 채움 | `autocomplete="new-password"` 차단 |
| Secret DOM 잔여 | unmount cleanup |
| 클립보드 잔여 | "저장 후 클립보드를 비우세요" 안내 문구 |

### §7.9 Observability (DQ-7 시점)

- **Vercel 로그만** (Logtail/Datadog 미도입)
- `console.error('[CRED]', ...)` prefix로 필터
- S7c Telegram 연결 후 카테고리 1·7 자동 경보 추가

---

## §8 Testing 전략

### §8.1 레이어 구조

```
Layer 1  Unit (Vitest, CI)                   — 순수 로직 (aes·mask·validation)
Layer 2  Integration (Vitest, Supabase mock) — Server Action 계약
Layer 3  Manual QA (브라우저)                 — RLS·UI·플로우
Layer 4  Security probes (수동, 1회성)       — 변조·MEK·DB inspect
```

### §8.2 Layer 1 — Unit

| 파일 | cases | 핵심 |
|---|---|---|
| `src/lib/crypto/__tests__/aes.test.ts` | ~12 | encrypt/decrypt roundtrip · 변조 감지 · MEK 오설정 |
| `src/lib/credentials/__tests__/mask.test.ts` | ~5 | 포맷 · 짧은 입력 fallback · null 방어 |
| `src/lib/credentials/__tests__/validation.test.ts` | ~8 | 정규식·길이·trim |

### §8.3 Layer 2 — Integration

| 파일 | cases |
|---|---|
| `src/lib/credentials/__tests__/brokerage.integration.test.ts` | ~10 |
| `src/lib/credentials/__tests__/exchange.integration.test.ts` | ~10 |

**한계**: Supabase RLS 자체는 Vitest에서 미검증. Layer 3으로 커버.

### §8.4 Layer 3 — Manual QA 체크리스트 (~30 항)

- 인증·라우팅 3항
- CRUD 기본 5항
- Validation 3항
- RLS 격리 3항
- 대표 권한 3항
- Binance 동일 반복 10항
- 클라이언트 hygiene 4항
- Vercel Smoke 4항

### §8.5 Layer 4 — Security Probes

- DB bytea inspect (plaintext 탐색 실패 확인)
- Tamper detection (ciphertext 1 byte flip → 격리)
- `rotate-cred-mek.ts --dry-run` (row count 확인만, UPDATE 0)
- Env 누락 시뮬레이션 (Vercel env에서 `API_CRED_MASTER_KEY` 임시 제거 → 500 확인 → 복원)
- RLS 우회 시도 (B 세션으로 A의 row direct call → 0건)
- **실 MEK 로테이션은 DQ-7 스코프 밖** (staging 환경 없음 · 실 rotation 필요 시 S9 이후 프로덕션에서 단일 트랜잭션으로)

### §8.6 실행 게이트

| 게이트 | 기준 |
|---|---|
| Pre-commit | build + lint + test:ci green |
| Wave 완료 | ~220 tests pass (현재 190 + 신규 ~30) |
| 수동 QA | Layer 3 30항 통과 |
| Security probes | Layer 4 dry-run 4항 통과 |
| 코드 리뷰 | `/review` 통과 · RLS·ciphertext·MEK 로그 4축 검증 |
| 보안 리뷰 | `/security-review` OWASP 기준 |

---

## §9 세션 분해 + 에이전트·스킬 매핑

### §9.1 Task 인벤토리 (20 Tasks)

| # | Task | 영역 |
|---|---|---|
| T1 | `aes.ts` + 12 tests (TDD) | Backend |
| T2 | `mask.ts` + 5 tests | Backend |
| T3 | `validation.ts` + 8 tests | Backend |
| T4 | 마이그레이션 0009 + rollback | DB |
| T5 | BL-KRIT-7 번호 재배정 0009 → 0010 (문서) | Doc |
| T6 | `types/admin.ts` cleanup (BrokerageConnection 폐기) | Types |
| T7 | `credentials/{types,brokerage,exchange}.ts` Server Actions | Backend |
| T8 | Integration tests ~20 cases | Tests |
| T9 | `/admin/settings/brokerage` UI | Frontend |
| T10 | `/admin/settings/binance` UI | Frontend |
| T11 | `secret-input.tsx` 공유 | Frontend |
| T12 | Sidebar nav 2 item | Frontend |
| T13 | `.env.example` 갱신 | Config |
| T14 | `scripts/rotate-cred-mek.ts` dry-run | Ops |
| T15 | Vercel 프로젝트 + env + Production Branch | Deploy |
| T16 | Supabase Redirect URL | Deploy |
| T17 | 첫 preview 배포 + Cron 확인 | Deploy |
| T18 | Layer 3 Manual QA 30항 | QA |
| T19 | Layer 4 Security probes dry-run 4항 | QA |
| T20 | HANDOFF·Dashboard·CodebaseStatus 갱신 + 커밋 | Close |

### §9.2 세션 분해

```
Session 1 — Backend · DB 기반
  Wave 1: T1 aes.ts TDD                         [순차]
  Wave 2: T4 migration · T2+T3+T7 skel           [병렬 2]
  Wave 3: T8 integration tests                   [순차]
  Wave 4: T6·T13 cleanup                         [순차]

Session 2 — Frontend
  Wave 5: T11 secret-input                       [순차]
  Wave 6: T9 brokerage · T10 binance             [병렬 2]
  Wave 7: T12 sidebar                            [순차]

Session 3 — Deploy · Rotate
  Wave 8: T14 rotate script                      [순차]
  Wave 9: T15·T16·T17 (사용자 수동 + 가이드)     [수동]

Session 4 — QA · Close
  Wave 10: T18·T19 QA (사용자 수동)              [수동]
  Wave 11: /review + /security-review + verifier [순차]
  Wave 12: T5·T20 문서·커밋                      [순차]
```

### §9.3 에이전트·스킬 매핑

| Wave | Primary | Skill/MCP | Source |
|---|---|---|---|
| 1 | executor(opus) | `superpowers:test-driven-development` + context7 (Node crypto) | superpowers · context7 |
| 2a | executor(sonnet) | context7 (Supabase RLS) | context7 |
| 2b | executor(opus) | — | OMC |
| 3 | executor(opus) | — | OMC |
| 4 | executor(sonnet) | — | OMC |
| 5 | executor(sonnet) | — | OMC |
| 6 | executor(sonnet) ×2 | `superpowers:dispatching-parallel-agents` | superpowers |
| 7 | executor(haiku) | — | OMC |
| 8 | executor(opus) | context7 | context7 |
| 9 | (사용자) | Claude 가이드 | — |
| 10 | (사용자) | 체크리스트 안내 | — |
| 11 | code-reviewer 에이전트 | `/review` + `/security-review` + `superpowers:verification-before-completion` | gstack · claude-plugins-official · superpowers |
| 12 | writer 에이전트 | `commit-commands:commit` | commit-commands |

**Ralph 래핑**: ExecutionPlaybook §2.5 규칙상 7+ Tasks → `team + ralph` 또는 `ralph`. 외부 API 통합 0 · 순수 Next.js/Postgres 작업이라 **`ralph` 단독**으로 Session 1·2 래핑. Session 3·4는 사용자 상호작용이 많아 **직접 실행 + `superpowers:verification-before-completion`**.

**조건부 개입**:
- Wave 1 중 crypto 로직 의심 → `/ccg`로 Codex·Gemini 교차 자문
- Wave 11에서 보안 치명 결함 → `/investigate` root cause

---

## §10 블로커 / 사용자 결정 필요

### §10.1 DQ-7 고유 블로커

| ID | 내용 | 해소 |
|---|---|---|
| **BL-DQ7-1** | MEK 32-byte hex 생성 | Session 3 직전 · `node -e "..."` |
| **BL-DQ7-2** | `CRON_SECRET` 생성 | 동일 · `openssl rand -hex 32` |
| **BL-DQ7-3** | `ADMIN_REP_EMAIL` 확정 | 추정: `shjang1001@gmail.com` · 사용자 확인 |
| **BL-DQ7-4** | Vercel 계정·팀 준비 | Session 3 직전 · 무료 tier 충분 |
| **BL-DQ7-5** | 번호 재배정 승인 (0009 DQ-7 / 0010 alert_event) | spec 승인에 포함 |
| **BL-DQ7-6** | `BrokerageConnection` 타입 사용처 grep | Session 1 Wave 4 · 0건 예상 |

### §10.2 Pre-resolved

- BL-KRIT-6 ✅ · DQ-5 ✅ (Supabase anon 갱신, 2026-04-21)

### §10.3 DQ-7 밖 (이후 슬라이스 블로커)

- BL-KRIT-1·2·3·4·5 (S7 각 Phase), BL-KRIT-8·9 (S8)

---

## §11 리스크

| ID | 리스크 | 가능성 | 영향 | 완화 |
|---|---|---|---|---|
| R-DQ7-1 | MEK 유출 → 전 credential 복호화 | 낮음 | 치명 | Vercel env 접근 제한 · RLS blast radius · 로테이션 스크립트 · 1Password 이중 보관 |
| R-DQ7-2 | 마이그레이션 0009 실패 | 낮음 | 중 | prod row=0 확인 · 단일 트랜잭션 · rollback SQL |
| R-DQ7-3 | Magic Link 실패 (Redirect URL 미등록) | 중 | 저 | T16 체크리스트 · Smoke Test 첫 항목 |
| R-DQ7-4 | 로컬/Vercel MEK 불일치 | 중 | 중 | 운영 룰 박제 · `.env.example` 경고 |
| R-DQ7-5 | 슬라이스 범위 초과 (테스트 버튼 실 ping 끌어당김) | 중 | 중 | §5 경계 표 · 리뷰에서 `src/lib/trading/broker/*.ts` 존재 시 flag |
| R-DQ7-6 | 친구 2명 키 입력 준비 안 됨 | 높음 | 저 | DQ-7 완료 기준 = "시스템 준비"만. 실제 입력은 본인 smoke 후 자연 이어짐 |

---

## §12 Uncertainty 표기

| 축 | 수준 | 근거 |
|---|---|---|
| 암호화 로직 | 낮 | AES-GCM 잘 알려진 · TDD 검증 |
| DB 스키마 · RLS | 낮 | 기존 0002 패턴 재사용 |
| Server Action 구조 | 낮 | S3·S4·S5 패턴 확립 |
| UI 라우트 | 낮 | 기존 `/admin/settings/*` 복제 |
| Vercel Production Branch 트릭 | 중 | 실 동작 확인 필요 · fallback(수동 promote) |
| Supabase Redirect URL 동작 | 중 | Magic Link 실 환경 첫 검증 |
| `BrokerageConnection` 사용처 | 중 | grep 결과에 따라 cleanup 범위 변동 |
| MEK 로테이션 실측 | 높 | dry-run만 DQ-7 수행 · 실 rotate S9 이후 |
| 첫 Vercel 배포 성공률 | 중 | env 누락·빌드 차이 가능성 · Smoke Test 즉시 감지 |

---

## §13 알고리즘·언어 확장성 참고 (사용자 질문 답변 박제)

S8 자동매매·주식 분석 알고리즘 추가 관련:

| "나중에" 가능한가? | 답 | 위치 |
|---|---|---|
| Strategy 파일 추가·교체 | ✅ 언제든 | `src/lib/trading/strategies/{stock,crypto}/*.ts` drop-in |
| AI 본체 (agent·skill) 교체 | ✅ 언제든 | `src/lib/trading/ai/decide-order.ts` |
| 주식 분석 v1 (pykrx + v6) | ✅ | S7e Mock 교체 |
| 주식 분석 v2 (AI Agent 기반) | ✅ | S8 AI 어댑터 drop-in (Deferred-Y 흡수) |

**언어 선택지**:

| 범주 | 실행 환경 | 옵션 |
|---|---|---|
| 1. 같은 프로세스 (Vercel Node) | TS/JS만 | LangChain JS · Anthropic SDK · OpenAI SDK · TensorFlow.js · ONNX runtime |
| 2. 외부 서비스 (HTTP microservice) | 자유 | Python FastAPI + PyTorch·scikit·LangChain Python · Go · Rust · Cloud ML endpoint |
| 3. 사전 계산 + Supabase 읽기 | 자유 | Python batch cron → DB INSERT → Next SELECT (기존 `backtest/v6` 포팅 없이 활용) |

**인터페이스 고정**: `TradingStrategy.decide(state)` 함수 서명만 TS. 그 안에서 뭘 호출하든 자유.

**DQ-7 산출물은 알고리즘을 전혀 참조하지 않음** — 알고리즘 추가는 DQ-7 코드를 한 줄도 안 건드림.

---

## §14 DoD (Definition of Done)

- [ ] Layer 1·2 tests 전부 pass (예상 ~220 tests 누적, +30)
- [ ] `npm run build + lint + test:ci` 3게이트 green
- [ ] Layer 3 Manual QA 30항 통과
- [ ] Layer 4 Security probes dry-run 4항 통과
- [ ] Vercel preview URL 접속 200 · 3명 Magic Link 로그인 성공
- [ ] Cron 4건 Vercel Dashboard 표시
- [ ] credentials 저장·조회·삭제 3 Admin 교차 RLS 검증
- [ ] `/review` + `/security-review` 승인
- [ ] HANDOFF · ProgressDashboard · CodebaseStatus 갱신
- [ ] atomic 커밋 per wave + push origin main (preview-only, Production Branch 미지정)
- [ ] 다음 진입점 = S7a Anthropic wrapper (BL-KRIT-1 해소 시)

---

## §15 의사결정 로그

- **2026-04-22**: brainstorming 세션. Q1~Q5 5개 축 확정 (Section §1 매트릭스). S8 slice에서 T8.4·T8.5(settings/brokerage·binance UI)를 DQ-7으로 선행 이관 · S8 Scaffold는 T8.3 Strategy·broker·AI 어댑터 stub부터 시작하도록 조정 예정 (S8 slice 파일은 S8 킥오프 시 동시 갱신).
- **2026-04-22**: BL-KRIT-7 마이그레이션 번호 재배정 결정 (0009 → 0010). DQ-7이 0009 선점.
- **2026-04-22**: `types/admin.ts BrokerageConnection` 폐기 방향 (빈 배열 mock만 참조). Session 1 Wave 4에서 grep 후 확정.
- **2026-04-22**: `ADMIN_REP_EMAIL` env 신설 — 실계좌·메인넷 저장 권한자. 추정값 `shjang1001@gmail.com` (사용자 확인 대기).

---

## §16 이슈·발견

- (스펙 작성 시점에는 없음. Session 1 Wave 1 시작 후 추가)

---

## §17 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-22 | 초기 생성. superpowers:brainstorming 산출물. Q1~Q5 5축 확정 · 8 섹션 설계 · 20 Tasks · 4 세션 예상 · 에이전트·스킬 매핑 · BL-DQ7-1~6 · R-DQ7-1~6. S8-AutoTrading.md T8.4·T8.5 선행 이관 표기는 S8 킥오프 시 동기화 예정. |
