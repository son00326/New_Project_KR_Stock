# HANDOFF — 주픽 (JooPick)

Last updated: 2026-05-08 (33차 — **DQ-7 Session 3 Smoke Test #2 PASS — KIS 키 UI 저장 + AES-256-GCM ciphertext bytea 평문 노출 0 검증(MCP `execute_sql`)**)

**목적**: 다음 세션이 이 파일 하나만 보고 즉시 이어갈 수 있게 하는 단일 진입점.
**원칙**: 미래 지향. "다음에 무엇을 할지"와 "아직 무엇이 결정 안 났는지"만 담는다.
**2026-04-22 프레임 변경 요약**: DQ-7이 원래 "Vercel 배포 환경변수 세팅 계획"이었으나, 바이낸스·KIS 키를 어드민이 UI로 직접 입력·DB 암호화 저장하는 방향으로 확장됨. brainstorming 결과 Q1~Q5 확정 + spec 작성 완료 → `Slices/DQ7-Credentials.md`. DQ-7이 **S7a보다 선행**하며, 구현 4 세션 + 마이그레이션 번호 0009 선점(BL-KRIT-7은 0010으로 재배정). 상세: `Slices/DQ7-Credentials.md §1` 결정 박제.

> **⚡ 진입**: "@HANDOFF.md 보고 이어서 작업해줘" → §1 현재 상태 확인 → §2 진입 결정 트리 따라 착수. 세부 Entry routine은 `CLAUDE.md` 참조.

---

## §0 용어 정의 (중요 — 매 세션 시작 시 확인)

| 단계 | 정의 | 현재 상태 |
|---|---|---|
| **Mock Skeleton** | UI·라우트·타입·DB 스키마·순수 로직이 mock fixture로 동작. 외부 API·실 AI 호출 없음. | ✅ **완료** (S0~S6, Must 19 mock) |
| **S7 실데이터 전환** | Supabase 실 SELECT/INSERT + 외부 API(KIS·DART·pykrx·Naver·Resend·Telegram) + Anthropic 실 호출 | ⚪ **미착수** (0 / 19 Must 연결) |
| **S8 자동매매 프레임** | 주식(KIS 모의→실계좌) + 코인(바이낸스 USDT-M 선물 테스트넷→메인넷) + Strategy drop-in + AI 어댑터 embed 인터페이스 + 리스크 가드레일 | ⚪ **미착수** (2026-04-21 D16으로 승격) |
| **S9 운용 검증** | 어드민 3인이 실제 월/일 루틴을 실행해 1개월+ 검증(주식+코인 양쪽, 모의부터) | ⚪ **0일 운용** |
| **어드민 내부 도구 완성** | S0~S6 + S7 + S8 + S9 통과 | ❌ **미달성** |

**🚫 금지 어휘**: "MVP 완료" · "MVP Stage 1 완료" · "Stage 1 완료(단독)" · "100% 완성" · "🎉 완료"
**🚫 폐기 어휘 (2026-04-21)**: "트레이딩 Stage 1/2/3 (매뉴얼 → API → AI 자율)" · "MVP Stage 2" · "Friends & Family Beta"(현 진행 플랜에서 분리)
**✅ 권장 어휘**: "Mock Skeleton 완료" · "Mock 동작 19/19" · "실데이터 0/19" · "S8 자동매매 미착수" · "운용 0일"

---

## §1 현재 상태 (2026-05-08 33차 기준)

- **Mock Skeleton**: S0~S6 완료 · Must 19 mock 동작
- **Supabase 신 프로젝트**: `rbrpcynhphrpljbjirfo` (son00326 Org · Seoul · Free). 이전 `fpriyjykihxhhvqudvdb` (Kevin 계정 접속 불가) 폐기. **0002~0010 마이그 9건 적용 완료** · admin_emails 3 row + kr_business_days 2557 row seed.
- **DQ-7 Session 3**: 🟢 **~97% 완료** · 0009 마이그·Vercel env 8 교체·Production 재배포·T16 URL Config·Smoke #1/#2/#6 ✅. **잔여 = Smoke Test #3~#5**.
- **brokerage_connection 1행** (33차 Smoke #2): admin_id=son00326 슬롯 · account `64601905-01` · mockMode=true · ⚠️ 실데이터 의미상 친구 장세현(shjang1001)의 실전투자 키이지만 테스트 편의로 son00326/모의 슬롯에 박제됨. Smoke #4(RLS 격리) 진입 전 친구 비번 세팅 + 친구 슬롯으로 재등록 필요.
- **Vercel Production**: ✅ https://tudal-tawny.vercel.app · `dpl_3FfP5ZU9uz7MqKYc4DD6MfomRJTY` · 새 Supabase 연결.
- **Supabase MCP**: ✅ user-scope (`~/.claude.json`) HTTP+PAT bearer · `✓ Connected`. 향후 세션 자동 로드 (`mcp__supabase__apply_migration`·`execute_sql`·`list_tables` 등).
- **로그인 경로 (중요)**: ⚠ **Magic Link UI는 작동 X** (Gmail/메일 클라이언트가 token pre-fetch로 즉시 invalidate 추정). 임시 우회로 **이메일 + 비밀번호** 사용 — son00326@gmail.com / `Test1234!`. 친구 2명(shjang1001·kevinoh816)은 비밀번호 미설정 (필요 시 32차 admin API 패턴 재사용 또는 본인이 비밀번호 재설정 메일 받기). Magic Link 근본 해결은 별도 디버깅 필요(시크릿 창 테스트 또는 Email Template 점검).
- **실데이터 연결**: **0 / 19** · **실 AI 호출 0** · **자동매매(S8) 미착수** · **운용 검증 0일**
- **법무·이용약관**: ⏸ Deferred-D 멤버 오픈까지 유예
- **검증 게이트 (32차 신 환경)**: build 24 routes · lint 0 · test:ci **306 pass / 38 files**
- **마이그레이션 번호 (신 DB)**: 0001 sketch skip · 0002~0010 적용 (9건) · 다음 추가는 **0011** (BL-KRIT-8 S8 자동매매)
- **Git**: HEAD `9c8d3fb` (32차 docs+supabase init), origin/main ahead 2+ (사용자 push 권한)
- **Vercel project deviation (불변)**: rootDirectory=`tudal` · Production Branch=`main` · `vercel.json` news-sweep=`0 0 * * *`

---

## §2 다음 세션 진입 결정 트리

```
진입 시 이 순서로 확인:

(0) Git: `git status --short --branch` · `git rev-parse --short HEAD` 먼저.

(1) **DQ-7 Session 3 잔여 = Smoke Test #3~#5** (33차 #2 PASS 후). MCP `mcp__supabase__*`는 세션 시작 시 OAuth 재인증 필요할 수 있음 (`mcp__supabase__authenticate` → 사용자 브라우저 Authorize).
    로그인: 사용자가 https://tudal-tawny.vercel.app/login 에서 son00326@gmail.com / Test1234! (비밀번호 탭) 사용. Magic Link UI는 32차 시점 작동 X (별도 디버깅 필요).

    **~~Smoke Test #2~~** ✅ 33차 PASS — `64601905-01` · `PSe3…9W7Q` · mockMode=true 저장. AES-256-GCM ct(36/180) + iv(12) + tag(16) 무결성 ✓ · 평문 APP_KEY/SECRET이 ciphertext에 위치 0 (`position(plaintext IN ct) = 0`) 검증.

    **Smoke Test #3 — Binance 키 저장 + 암호화 검증** (동일 패턴, /admin/settings/binance)
    - 필요: API_KEY 64자 + API_SECRET 64자, testnetMode=true 권장 (대표 일자에만 메인넷 라디오 활성)
    - Claude: `mcp__supabase__execute_sql` 로 exchange_connection SELECT → ciphertext bytea 평문 노출 0 검증

    **Smoke Test #4 — RLS 격리** (사용자가 다른 어드민 계정 로그인 후 0건 확인)
    - 친구 2명(shjang1001·kevinoh816) 비밀번호 미설정 → 32차 admin API 패턴 재사용해 Test1234! 같은 임시 비번 설정 후 사용자가 로그인 전환

    **Smoke Test #5 — 대표 가드** (친구 계정으로 /admin/settings/binance 메인넷 라디오 시도 → 403)

    **Smoke Test #6 — cron 인증** ✅ 32차 PASS (HTTP 200 · 401 · 401)

    완료 후 → DQ-7 Session 4 (QA · Close): T18 Manual QA 30항 · T19 Security probes · T20 문서 갱신.

(1b) **Magic Link 디버깅 (선택)** — 시간 여유 있으면:
    - 시크릿 창에서 /login → 이메일 받기 → 클릭 (Gmail prefetch 우회 가설 검증)
    - 안 되면 `/auth/callback` PKCE flow + Supabase email template 점검
    - S9 진입 전엔 비밀번호 로그인으로 충분

(2) DQ-7 완료 → S7a (Anthropic wrapper, BL-KRIT-1 Anthropic Key 필요)
    진입점: `Document/Build/Slices/S7-RealData.md` Phase S7a Tasks · 첫 파일 `src/lib/ai/client.ts`

(3) §5 AUTO·§3 DQ — 모두 흡수 또는 유예 (DQ-8 멤버 Research만 Deferred-D 시점 재개)

(4) **보안 — 32차 채팅 노출 시크릿 rotate 권장**:
    - Supabase anon JWT · service_role JWT · DB password (Dashboard → Settings → API/Database)
    - Supabase PAT `sbp_...` (https://supabase.com/dashboard/account/tokens) — 가장 권한 큰 키. rotate 시 ~/.claude.json `Authorization: Bearer ...` 값 교체
```

---

## §3 사용자 답변 필요 (DQ — Decision Queue)

> **원칙**: 사용자 결정 없이는 Claude가 진행 불가. 우선순위 순.

### ~~DQ-1~~ ✅ 실데이터 전환 착수 순서 — **2026-04-21 확정**
**결정**: **S7 주도 + S8 병행**. 실데이터 연결이 먼저, 자동매매 프레임은 S7a·S7e 끝난 시점에 스캐폴드 착수.
**집행 순서**:
1. S7a Anthropic wrapper + cost_log 실 INSERT (M17) — 비용 통제 최우선
2. S7e Supabase 실 SELECT/INSERT 전면 전환 (M1·M4~M9·M16)
3. [여기서부터] S8 스캐폴드(UI·스키마·Vault 훅·Strategy 폴더·AI 어댑터 인터페이스) 병행
4. S7b 뉴스+브리핑 실 연결 (M11·M12)
5. S7c 장중+Exit 2채널 (M13·M14·M15)
6. S7d Silent Health 실 INSERT + override UI (M18·M19)
7. S8 실 체결 연결 (KIS 모의→실계좌, 바이낸스 테스트넷→메인넷)
8. S9 운용 검증 (본인+친구 3명, 모의부터)

### ~~DQ-2~~ ✅ AI 호출 체제 — **2026-04-21 확정**
**결정**: **(a) Anthropic SDK 직접 호출 + prompt cache**를 S7a에서 구현. 단, **S8에서는 AI 어댑터 인터페이스만 박고 본체는 어드민 drop-in**(여러 agent/skill 검토 후 선택).
**제약**: Must 17 monitoring은 Anthropic `/messages` usage 파싱으로 처리.
**첫 행동**: `src/lib/ai/` wrapper + `src/lib/trading/ai/` 어댑터 skel 작성 → S7a·S8 양쪽에서 재사용.

### ~~DQ-3~~ ⏸ Q16 법무 자문 — **멤버 오픈(Deferred-D) 시점까지 유예** (2026-04-20 확정)
**근거**: 어드민 3명 = 대표 본인·관계자 내부 운용. 500cap 멤버 초대 시점부터 투자자문업 경계·개인정보처리 법무 자문 필요. 그 전까지는 Footer 면책 문구로 충분.
**재개 트리거**: Deferred-D 멤버 트랙 킥오프 시

### ~~DQ-4~~ ⏸ Q17 이용약관·개인정보처리방침 — **멤버 오픈(Deferred-D) 시점까지 유예** (2026-04-20 확정)
**근거**: 어드민 3명 내부 운용 단계에서는 이용약관·개인정보처리방침 불필요. Footer "정보 제공, 투자 자문 아님" 면책만 유지.
**재개 트리거**: Deferred-D 멤버 트랙 킥오프 시 `/legal/*` 라우트 신설 + 약관 초안 작성

### ~~DQ-5~~ ✅ Supabase anon key 갱신 — **2026-04-21 해소**
**해소 내역**: 사용자가 Dashboard에서 새 anon public JWT + publishable key(`sb_publishable_...`) 제공 → `tudal/.env.local`의 `NEXT_PUBLIC_SUPABASE_ANON_KEY`를 `iat=1776314666` (service_role과 동일 키 세트)로 교체. publishable key는 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`로 참고 보관.
**검증**: Supabase `/auth/v1/settings` 직접 REST 호출 200 OK (더 이상 Invalid API key 없음). `npm run dev` → `/login` 200 · `/admin` 200. `npm run lint` 0.
**남은 QA**: 실제 브라우저에서 Magic Link 로그인·로그아웃 플로우 (어드민 본인 eager-test, 세션별).
**보안 주의**: 이 키는 채팅 기록에 노출되었으므로 외부 유출이 확인되면 Dashboard에서 rotate 권장.
**해당 BL-KRIT**: ~~BL-KRIT-6~~ ✅ 해소.

### ~~DQ-6~~ ✅ origin push 완료 (2026-04-20, 23차 후속)
`b762313..77ef624 main -> main` (18 commits 동기화). Repo = `https://github.com/son00326/New_Project_KR_Stock.git`. 이후 세션에서는 commit당 push 가능.

### ~~DQ-7~~ 🟡 Admin Credential System — **30차 Session 3 부분 진행 (사용자 다음 세션 잔여 3건)**
**결정 내역 (Q1~Q5, `Slices/DQ7-Credentials.md §1`)**: 그대로 유지
**30차 진행 결과**:
- ✅ BL-DQ7-1·2·3: MEK + CRON_SECRET 생성 + ADMIN_REP_EMAIL=`son00326@gmail.com` 확정 + `.env.local` 투입
- ✅ T14: `tudal/scripts/rotate-cred-mek.mjs` (271 lines, .ts→.mjs deviation 박제 in spec §17)
- ✅ T15 부분: Vercel CLI v52 업그레이드 + 프로젝트 생성 `son326s-projects/tudal` + GitHub repo 연결 + env 18 entries (REST API로 누락 7개 보정)
- ✅ T15 부분: 첫 production 배포 https://tudal-tawny.vercel.app (24 routes, build 48s, READY)
- ⏳ T16: Supabase Redirect URL — 다음 세션 사용자 주도
- ⏳ 0009 마이그레이션 실 DB 적용 — 다음 세션 사용자 주도 (Supabase Dashboard SQL Editor)
- ⏳ T17: Cron 4건 dashboard 확인 + Smoke Test §6.7 — 다음 세션 사용자 주도

### ~~DQ-7-d1~~ ✅ Vercel Hobby plan cron daily 제약 — **2026-04-22 30차 해소**
**문제**: `vercel.json` `news-sweep` `*/15 * * * *` (15분마다 = 96회/일)이 Hobby plan 거부됨.
**해소 (옵션 B 채택)**: `0 0 * * *` (UTC 자정 = KST 09:00) — M12 빈도 임시 강등.
**원복 트리거**: Pro 업그레이드($20/월) 또는 외부 cron 서비스(cron-job.org 무료) 도입 시.
**박제**: spec §17, CodebaseStatus 환경 섹션, 이 문서 §1.

### DQ-8 🟢 멤버 페이지 Research (Deferred-D 블로커)
**질문**: 500cap 멤버 UX 설계 전 필요한 경쟁사 리서치 범위·시점
**해소 시 첫 행동**: `ServicePlan-Member.md` Research 블로커 해소
**2026-04-21 주석**: 어드민 내부 도구 완성 전까지 자동 유예.

### ~~DQ-9~~ ✅ S8 주식 자동매매 — KIS API 계정 발급 범위 — **2026-04-22 해소 (29차)**
**결정**: **(a) 본인 + 친구 2명 각자 계정 등록 · 동시 진행** (친구 ordering 없음, 3명 모두 시작 시점부터 실계좌 사용).
**행동**: 사용자 + 친구 2명이 KIS OpenAPI 3명분 신청 진행 중. 승인 리드타임 수일~2주. 완료 시 사용자가 별도 보고.
**관련 BL-KRIT**: BL-KRIT-2 (KIS 신청 진행 중 — 승인 대기).
**구현 반영**: `/admin/settings/brokerage` UI는 DQ-7 Session 2에서 이미 per-admin 3인 모델로 완성. 마이그레이션 0009 실 DB 적용은 Session 3.

### ~~DQ-10~~ ✅ S8 코인 자동매매 — 바이낸스 선물 가용성 — **2026-04-22 해소 (29차)**
**결정**: **(a) 전원 계정 + API 보유 · 한국 IP/KYC 이슈 없음** (사용자 확인 — 다른 프로그램·프로젝트 운영 경험 기반). **추가**: S8-Live에서 **testnet + mainnet 양쪽 모두 구현** (테스트넷 검증 후 메인넷 전환은 대표 1인 토글).
**관련 BL-KRIT**: ~~BL-KRIT-9~~ ✅ 해소 (§4 참조).
**구현 반영**: `/admin/settings/binance` UI는 DQ-7 Session 2에서 이미 testnetMode 기본값 true + 메인넷 radio 대표 1인 권한 gate 완성. S8-Live에서 양쪽 경로 연결.

### ~~DQ-11~~ ✅ S8 리스크 가드레일 기본값 — **2026-04-22 해소 (29차)**
**결정**: **(a) 그대로 박제** — 레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 ≤ 20회. 실 운용 중 필요 시 `/admin/settings/risk` UI에서 조정.
**S8-Scaffold 구현 시 첫 행동**: 마이그레이션 0011 `risk_policy` 테이블 DEFAULT 값에 이 3개 박제 + Policy Engine 단위 테스트 케이스 포함.
**알고리즘 튜닝 (추가 박제)**: 사용자가 S8 구현 후 여러 소스 투입해서 자동매매 알고리즘·AI 에이전트·전략 수정·튜닝 예정. Strategy drop-in(`src/lib/trading/strategies/{stock,crypto}/*.ts`) + AI 어댑터 embed(`src/lib/trading/ai/decide-order.ts`) 이중 경로 설계 그대로 유지.

---

## §4 블로커·크리티컬 (BL-KRIT — 실데이터 전환 착수 전 반드시 해소)

### BL-KRIT-1 Anthropic API Key 확보
- 소스: DQ-2 · DQ-7
- 영향: 실 AI 호출 불가 → M17·M11·M12·M19 실 동작 불가
- 해소: `.env.local`에 `ANTHROPIC_API_KEY` 투입

### BL-KRIT-2 KIS (한국투자증권) API 계정 발급
- 소스: DQ-7
- 영향: M13 장중 이상 감지 WebSocket 실 구독 불가
- 해소: 한투 Open API 신청 + `KIS_APP_KEY`/`SECRET` 발급

### ~~BL-KRIT-3~~ 🟡 Naver News API 키 — **2026-04-30 부분 해소 (31차)**
- 소스: DQ-7
- 영향: M12 뉴스 sweep 실 동작 불가 (네이버 뉴스 API + 스크래핑 하이브리드 BL-13=확정)
- 해소 내역: `tudal/.env.local`에 `NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET` 투입 완료 (2026-04-30)
- 잔여: Vercel env 투입은 S7b 진입 시점. 채팅 히스토리 노출 키이므로 Vercel 투입 전 Naver Developers 콘솔에서 1회 rotate 권장 (DQ-5 Supabase anon 패턴 동일)

### BL-KRIT-4 Resend (이메일) 계정
- 소스: DQ-7
- 영향: M11 모닝 브리핑 · D10 catch-up 이메일 발송 불가
- 해소: Resend 계정 + 도메인 인증 + `RESEND_API_KEY`

### BL-KRIT-5 Telegram Bot
- 소스: DQ-7
- 영향: M13·M15 텔레그램 2채널 실 발송 불가
- 해소: BotFather로 bot 생성 + `TELEGRAM_BOT_TOKEN`/`CHAT_ID`

### ~~BL-KRIT-6~~ ✅ Supabase anon 갱신 — **2026-04-21 해소**
- 소스: DQ-5
- 해소 내역: `.env.local` `NEXT_PUBLIC_SUPABASE_ANON_KEY` 새 JWT로 교체 + publishable key 참고 보관. auth settings 200 OK · dev 서버 `/login`·`/admin` 200 OK.

### BL-KRIT-7 alert_event CHECK constraint 확장 (번호 **0010으로 재배정**, 2026-04-22)
- 소스: 코드
- 영향: 실 INSERT 시 새 AlertType(`news_warning`·`briefing_failed`·`intraday_anomaly`·`cost_warning`·`cost_hardcap`·`heartbeat_missing`) 삽입 거부됨
- 해소: 마이그레이션 **0010**으로 CHECK 재정의 (DQ-7이 0009 선점, 2026-04-22 결정)
- 해소 시점: S7e (Supabase 실 SELECT/INSERT) 킥오프 시 선행

### BL-KRIT-8 S8 자동매매 신규 엔티티 마이그레이션
- 소스: S8 D16
- 영향: 자동매매 기능 전체(주문 큐·체결 이력·포지션·리스크 이벤트·코인 거래소 연결)
- 해소: 마이그레이션 **0011**로 E13 OrderQueue · E14 TradeExecution · E15 RiskPolicy · E16 RiskViolationEvent · E17 StrategyRegistration 추가 (E12 ExchangeConnection은 DQ-7 0009에서 선행 생성)
- 상세: `Document/Build/Slices/S8-AutoTrading.md`

### ~~BL-KRIT-9~~ ✅ 바이낸스 IP 제한·KYC — **2026-04-22 해소 (29차, DQ-10 답)**
- 사용자 확인: 전원 계정 + API 보유, 한국 IP 이슈 없음 (다른 프로그램·프로젝트 실 운영 경험 기반)
- VPS 경유·대체 거래소 검토 **불필요** 판정
- S8-Live 구현 방향: testnet + mainnet 양쪽 모두 작동. 메인넷 전환 토글은 대표 1인(`ADMIN_REP_EMAIL`) 권한 (DQ-7 Session 2에서 이미 UI gate 완성).

---

## §5 자율 진행 가능 작업 (AUTO — 결정 없이 Claude가 바로 수행 가능)

> 다음 세션이 §3·§4에 막혔을 때 대기 대신 이 순서로 처리.

### AUTO-1 ✅ 문서 용어 정정 (완료, 이번 세션)
- HANDOFF · ProgressDashboard · CodebaseStatus에서 "MVP 완료" 어휘 제거
- "Mock Skeleton" 용어 일관 적용

### AUTO-2 `.env.example` 문서화
- 현재 `.env.local`만 있고 실 배포 시 필요한 키 목록이 레포에 박제 안 됨
- 해소: `tudal/.env.example` 작성 (값은 placeholder, 키 이름만)

### AUTO-3 `Document/Process/CodebaseStatus.md` "체크리스트" 섹션 갱신
- [ ] 실데이터 연결 (0/19) 항목 명시
- [ ] 실 AI 호출 (0) 항목 추가
- [ ] 실 운용 검증 (0일) 항목 추가

### ~~AUTO-4~~ ✅ 슬라이스 파일 S7 스켈레톤 생성 — **2026-04-21 완료**
- `Document/Build/Slices/S7-RealData.md` placeholder 작성 완료. S7a~e 5 Phase Tasks 초안 이식.

### AUTO-5 Global Blocker 대시보드에 BL-KRIT-1~9 추가
- `ProgressDashboard.md` §5에 신규 "실데이터 전환 + S8 자동매매 BL-KRIT" 섹션

### ~~AUTO-6~~ ✅ `tudal/.env.example` 작성 — **2026-04-21 완료**
- Supabase·Anthropic·Naver·Resend·Telegram·KIS·바이낸스·Cron 키 전체 placeholder + 섹션별 주석 + Phase 매핑 포함.

### ~~AUTO-7~~ ✅ S8-AutoTrading.md 스켈레톤 — **2026-04-21 완료**
- `Document/Build/Slices/S8-AutoTrading.md` 신규 작성 완료. S8-Scaffold 9 + S8-Live 9 Tasks · DoD · 리스크 6종 박제.

---

## §6 실데이터 전환 + 자동매매 프레임 로드맵 **v2** (2026-04-22 재조정, 29차)

> **v1 → v2 변경 요약**: 사용자 Q1~Q5 해소 결과 **자동매매 최단 경로**로 재조정. **S7b(뉴스+브리핑)는 Short List 30 재조정 필수 의사결정 입력**이므로 S8 선결 유지. **S7c(장중·Exit) · S7d(Silent Health)**는 S8 자동매매 리스크 관리와 결합되지 않으므로 **강등 큐**로 이관 (S9 운용 중 체감 시 1세션씩 삽입, 기본 미수행). 자동매매 실체결 도달 = 기존 14세션 → **9세션**. DQ-9·10·11 해소로 S8-Live 블로커 정리됨.

### v2 진행 순서 다이어그램

```
DQ-7 잔여(S3·S4) → S7a → S7e → S7b → S8-Scaffold → S8-Live → S9 최소 운용
                                                                   ↑
                                    S7c·S7d 강등 큐 (S9 중 체감 시 1세션씩 · 기본 폐기 성격)
```

### v2 세션 표

| ID | 이름 | 포함 Must / 신규 기능 | 외부 의존 | 예상 세션 | 선행 BL-KRIT |
|---|---|---|---|---|---|
| **DQ-7 잔여** | Vercel 배포(Session 3) + QA·Close(Session 4) | 인프라 | Vercel · Supabase | 2 | BL-DQ7-1~6 (사용자 실행) |
| **S7a** | Anthropic wrapper + cost_log 실 INSERT + S8 AI 어댑터 skel 선행 박기 | M17 | Anthropic | 1 | BL-KRIT-1 (Anthropic Key) |
| **S7e** | Supabase 실 SELECT/INSERT 전면 전환 (11 mock 교체) | M1·M4·M5·M6·M7·M8·M9·M16 | Supabase | 2 | 마이그레이션 **0010** (BL-KRIT-7) |
| **S7b** | 뉴스+브리핑 실 연결 (**Short List 30 재조정 필수 입력**) | M11·M12 | Naver · Resend · Anthropic | 2 | BL-KRIT-1·3·4 |
| **S8-Scaffold** | 자동매매 스키마(마이그 **0011** E13~E17) · Strategy drop-in · AI 어댑터 embed · Policy Engine (mock 체결) · 4 라우트 `/risk`·`/strategy`·`/trading/*` | 신규 E13~E17 | (없음) | 2 | BL-KRIT-8 (마이그 0011) · DQ-11 ✅ |
| **S8-Live** | KIS 모의→실계좌 **3명 동시** · Binance **testnet + mainnet 양쪽** · Strategy 샘플 2건 검증 | 집행 레이어 | KIS · Binance | 2 | BL-KRIT-2 (KIS 신청) · DQ-9·10 ✅ · ~~BL-KRIT-9~~ ✅ |
| **S9** | 어드민 3인 최소 운용 (testnet·모의 위주 → 실계좌·메인넷 점진) | 전체 | — | **2주** (세션 단위 아님) | 상위 phase 완료 |

**총 예상**: 9 세션 + 2주 운용 = 어드민 내부 도구 완성 · **자동매매 실체결 도달 = 9세션 후 S8-Live 진입 시점**

### 강등 큐 (S9 운용 중 체감 시 삽입, 기본 미수행)

| ID | 이름 | 포함 Must | 유예 근거 | 재활성 트리거 |
|---|---|---|---|---|
| S7c | 장중 이상 감지 + Exit 2채널 | M13·M14·M15 | S8 자동매매 리스크 관리는 S8 자체 Policy Engine + 킬스위치 담당. M15 Exit 시그널(R3.5-5)은 AI 가상 포트 경로라 S8 자동매매와 직접 결합 없음. | S9 중 수동 텔레그램 체크로 커버 안 되면 1세션 |
| S7d | Silent Health 일간 하트비트 + override UI | M18·M19 | Cron 4건 실 실행 검증은 Vercel Dashboard 로그로 대체 가능. | 조용한 장애 체감 시 1세션 |

### 병행 트랙 — 외부 신청 (DQ-7 Session 3과 동시 시작 권장)

| 항목 | 리드타임 | 상태 |
|---|---|---|
| **KIS OpenAPI 3명분** (DQ-9 해소에 따라) | 수일~2주 (영업일 심사) | 🟡 진행 중 — 사용자 완료 시 별도 보고 |
| **Anthropic API Key** | 5분 | ❓ 사용자 상태 확인 필요 |
| **Naver News Open API** | 5분 | 🟡 2026-04-30 31차 .env.local 투입 (Vercel env + rotate는 S7b 직전) |
| **Resend** (도메인 인증) | 3~7일 | ❓ S7b 진입 전 확보 필요 — 도메인 보유 여부 확인 |
| **Binance API** (testnet + mainnet) | 즉시 | 🟢 보유 (DQ-10 해소) |
| ~~Telegram Bot~~ | (즉시) | ⏸ 강등 큐 소속 — S7c 재활성 시 확보 |

> **다음 세션 킥오프 가이드**: origin push 먼저 → **DQ-7 Session 3 Vercel 배포**(사용자 주도). `Slices/DQ7-Credentials.md §9.2 Session 3 + §6 Vercel 배포 플랜` 체크리스트 따라 진행. 이후 세션별 진입점 = **S7a → S7e → S7b → S8-Scaffold → S8-Live**. 각 슬라이스 파일: `Slices/S7-RealData.md`(phase별 Tasks) · `Slices/S8-AutoTrading.md`(마이그 0011·4 라우트·Strategy drop-in 상세).

---

## §7 (폐기) 선행 법무 트랙

~~DQ-3 Q16·DQ-4 Q17 선행~~ → **2026-04-20 유예 확정**, 2026-04-21 재확인. 어드민 내부 도구는 Footer 면책으로 충분. Deferred-D 멤버 오픈 시점까지 재개하지 않음.

---

## §8 ✅ 완료 슬라이스 (Mock Skeleton 기준만)

모두 **Mock 동작만** 완료. 실데이터·실 AI·운용 검증 **0**.

| 슬라이스 | Mock 상태 | 실데이터 상태 | 세션 | 슬라이스 파일 |
|---|---|---|---|---|
| S0 Foundation | ✅ Mock | ⚪ 실 인프라 세팅 완료 (Supabase URL만, 키 블로커) | 1 | `S0-Foundation.md` |
| S1 Short List 30 홈 | ✅ Mock | ⚪ | 2 | `S1-ShortList30.md` |
| S2 풀 리포트·투심위 | ✅ Mock | ⚪ | 1 | `S2-FullReport.md` |
| S3 승인 워크플로우 | ✅ Mock | ⚪ | 1 | `S3-Approval.md` |
| S4 성과·Decision Tree | ✅ Mock | ⚪ (cost_log stub) | 1 | `S4-Performance.md` |
| S5a 스케줄러·브리핑·뉴스·헬스 | ✅ Mock | ⚪ | 1 | `S5-Automation.md` |
| S5b 장중·토글·Exit | ✅ Mock | ⚪ | 1 | `S5-Automation.md` |
| S6 Hardening | ✅ Mock | ⚪ | 1 | `S6-Hardening.md` |

Mock 진행률: **19 / 19 Must (100% mock 동작)**
실데이터 진행률: **0 / 19 Must (0% 실 연결)**
실 운용 검증: **0일**

---

## §9 미완료 체크리스트 (어드민 내부 도구 완성까지)

- [ ] 실데이터 연결 0/19
  - [ ] Supabase 실 SELECT/INSERT 전면 전환
  - [ ] KRX/pykrx 영업일·시세 seed
  - [ ] Naver 뉴스 API + 스크래핑
  - [ ] KIS WebSocket 실 구독
  - [ ] DART 공시 연결
- [ ] 실 AI 호출 0
  - [ ] Anthropic SDK wrapper (BL-16=A per-persona·per-section)
  - [ ] cost_log 실 INSERT
  - [ ] M17 dashboard 실 데이터 렌더
  - [ ] M11 브리핑 실 LLM 생성
  - [ ] M12 뉴스 분류 실 LLM
- [ ] 2채널 알림 0
  - [ ] Resend 도메인 인증 + 발송
  - [ ] Telegram bot 가동
- [ ] 배포 0
  - [ ] Vercel 프로젝트 생성
  - [ ] 환경변수 세팅
  - [ ] 첫 프리뷰 → 프로덕션
  - [ ] Cron 4건 실 실행 검증
- [⏸] 법무 0 / 2 (Q16 자문 · Q17 약관) — **Deferred-D 멤버 오픈 시점까지 유예** (어드민 3명 내부 도구만이므로 완성 기준에서 제외)
- [ ] 어드민 운용 검증 0일 (목표 1개월+)
- [x] origin push ✅ (2026-04-20, 77ef624까지 동기화)

### DQ-7 Admin Credential System (2026-04-22 신설, S7a 선행) — 4 세션 분해

#### Session 1 — Backend · DB ✅ **완료 (2026-04-22, 26차)**
- [x] **T1** `src/lib/crypto/aes.ts` + **14 tests** (roundtrip · IV uniqueness 100회 · UTF-8·empty·10KB · tamper 4 · MEK config 3) · TDD red→green
- [x] **T4** 마이그레이션 **0009** (E9 재설계 + E12 신설 + RLS `*_admin_self`) + `0009_dq7_credentials.rollback.sql`. 실 DB 적용은 Session 3
- [x] **T2** `src/lib/credentials/mask.ts` + 5 tests
- [x] **T3** `src/lib/credentials/validation.ts` + **18 tests** (KIS·Binance regex + label + cleanInput)
- [x] **T7** `src/lib/credentials/{types,brokerage,exchange}.ts` Server Actions (rep guard · 23505 매핑 · testStub `pending-s8`)
- [x] **T8** Integration tests **20 cases** (`vi.hoisted` Supabase mock)
- [x] **T6** `types/admin.ts` cleanup — `BrokerageConnection`·`BrokerageScope` 제거 · `mock-admin-brokerage.ts` 삭제
- [x] **T13** `.env.example` 갱신 — `API_CRED_MASTER_KEY`·`ADMIN_REP_EMAIL` 신규 · KIS·Binance 블록 주석화
- [x] **S1 DoD**: build 22 routes · lint 0 · test:ci **248 pass** (190 + 58 신규, 목표 ~220 초과) ✅

#### Session 2 — Frontend ✅ **완료 (2026-04-22, 27차, /ralph 자율)**
- [x] **T11** `components/admin/credentials/secret-input.tsx` 공유 컴포넌트 (commit 04d1116 · 98줄)
- [x] **T9** `/admin/settings/brokerage` UI (page · form · delete-button · commit 289820e) · 병렬 executor sonnet
- [x] **T10** `/admin/settings/binance` UI (commit 289820e 동반 · T9과 파일 겹침 0) · 병렬 executor sonnet
- [x] **T12** Sidebar nav 2 item 추가 (`증권사 키`·`거래소 키` · commit 240e7dc · Flat)
- [x] **S2 DoD**: build **24 routes**(+brokerage·binance) · lint 0 · test:ci 248/248 · architect(opus) APPROVED · ai-slop-cleaner CLEAN

#### Session 3 — Deploy (30차 + 32차)
- [x] **30차**: MEK · CRON_SECRET · ADMIN_REP_EMAIL · T14 rotate 스크립트 · Vercel 프로젝트/env/배포 · vercel.json news-sweep daily
- [x] **32차**: Supabase 계정 마이그(Kevin → son00326 `rbrpcynhphrpljbjirfo`) · 0002~0010 마이그 9건 · admin_emails 3 row + kr_business_days 2557 row · auth.users 3명 생성 · son00326 비밀번호 `Test1234!` 임시 설정 · Vercel env 8 entries 교체 · Production 재배포 `dpl_3FfP5ZU9uz7MqKYc4DD6MfomRJTY` · 회귀 3-gate green · Supabase MCP 등록 · T16 URL Config ✅
- [x] **Smoke Test #1** (login + /admin 렌더) ✅ — 비밀번호 로그인 우회로 검증
- [x] **Smoke Test #6** (cron 인증 가드) ✅ — 401/401/200
- [x] **Smoke Test #2** ✅ 33차 — KIS 키 (`64601905-01` · `PS**···9W7Q` (마스킹) · mockMode=true · 친구 장세현 실전투자 키이나 son00326 슬롯에 임시 박제) AES-256-GCM 암호화 검증 PASS. ct=36/180, iv=12B, tag=16B(GCM 표준), `position(plaintext IN ciphertext) = 0` 양쪽 모두. row id `f35566e9-45aa-490b-a440-fc6ded482c68`.
- [ ] **Smoke Test #3** Binance 키 저장 + 동일 검증
- [ ] **Smoke Test #4** RLS 격리 (다른 어드민 로그인 후 0건) — 친구 2명 비밀번호 사전 설정 필요
- [ ] **Smoke Test #5** 대표 가드 (친구 계정 메인넷 라디오 → 403)
- [ ] **Magic Link 근본 디버깅** (선택, S9 전까지) — 32차 시점 token 즉시 invalidate 현상
- [ ] **S3 DoD**: Smoke Test #2~#5 완료 시 Session 3 종결

#### Session 4 — QA · Close (사용자 주도)
- [ ] **T18** Layer 3 Manual QA 30항 (spec §8.4)
- [ ] **T19** Layer 4 Security probes dry-run 4항 (spec §8.5)
- [ ] **W11** `/review` (gstack) + `/security-review` (claude-plugins-official) + `superpowers:verification-before-completion`
- [ ] **T5** BL-KRIT-7 번호 재배정(0009→0010) 문서 반영 재확인
- [ ] **T20** HANDOFF · ProgressDashboard · CodebaseStatus 갱신 + atomic 커밋
- [ ] **S4 DoD**: DQ-7 전체 완료 → 다음 진입점 = S7a (BL-KRIT-1 해소 후)

### S8 자동매매 프레임 (2026-04-21 D16 신규, DQ-7 완료 후)
- [x] `tudal/.env.example` 작성 (AUTO-6 완료, 2026-04-21)
- [ ] 마이그레이션 **0011** (BL-KRIT-8) — E13 OrderQueue · E14 TradeExecution · E15 RiskPolicy(DEFAULT 5x/-3%/20회, DQ-11 ✅) · E16 RiskViolationEvent · E17 StrategyRegistration (E12 ExchangeConnection은 **DQ-7에서 선행 생성**)
- [ ] ~~`/admin/settings/{brokerage,binance}` 라우트~~ **DQ-7에서 선행 이관**
- [ ] `/admin/settings/{risk,strategy}` 2개 라우트
- [ ] `/admin/trading/{stock,crypto}` 2개 라우트 + mock 주문 큐 + 체결 로그
- [ ] Strategy 폴더 규약 (`src/lib/trading/strategies/{stock,crypto}/*.ts`) + 샘플 전략 2건
- [ ] AI 어댑터 인터페이스 (`src/lib/trading/ai/decide-order.ts`) + 빈 훅
- [ ] Policy Engine 기본값 (≤5x / -3% / ≤20회) + `test:ci` 케이스
- [ ] 모의↔실 토글 대표 1인 권한 가드 (DQ-7과 동일 패턴 재사용)
- [ ] 주식 KIS 모의 체결 연결 → 검증 후 실계좌
- [ ] 바이낸스 선물 테스트넷 연결 → 검증 후 메인넷
- [ ] AI agent·skill 본체 drop-in (어드민 직접, 나중)

---

## §10 보류 트랙 (어드민 현 플랜 밖)

- ~~**Deferred-X** 증권사 API + 매뉴얼/자동매매 UI~~ → **2026-04-21 S8로 승격**. `Slices/Deferred-Brokerage.md`는 승격 표기만 남김.
- ~~**Deferred-Y** AI Agent 기반 선정엔진 v2~~ → **2026-04-21 S8 AI 어댑터에 흡수 예정**. `Slices/Deferred-AIAgent-Selection.md`는 포인터만 남김. (v0 mock ✅ → v1 pykrx+v6 ⚪ → v2 AI agent ⚪은 어드민이 drop-in으로 단계 확장)
- **Deferred-D Member** 페이지 → `Document/Service/Planning/ServicePlan-Member.md` (Research 블로커 DQ-8) · 현 어드민 플랜과 분리

---

## §11 문서 가이드

| 용도 | 문서 |
|---|---|
| 전체 슬라이스 상태 | `Document/Build/ProgressDashboard.md` |
| **DQ-7 슬라이스 (다음 진입점)** | **`Document/Build/Slices/DQ7-Credentials.md` (Session 3 부분 진행 · T16/0009/T17 잔여)** |
| S7 실데이터 슬라이스 | `Document/Build/Slices/S7-RealData.md` (DQ-7 다음) |
| 자동매매 슬라이스 | `Document/Build/Slices/S8-AutoTrading.md` (S7a·S7e 후 병행) |
| 직전 완료 슬라이스 | `Document/Build/Slices/S6-Hardening.md` (Mock Skeleton 종점) |
| 개발 방법론 | `Document/Process/ExecutionPlaybook.md` |
| 기획 SoT (어드민) | `Document/Service/Planning/ServicePlan-Admin.md` **v1.3** (2026-04-22 D17) |
| 기획 SoT (멤버) | `Document/Service/Planning/ServicePlan-Member.md` |
| 리포트 방법론 | `Document/Service/Report/ReportFramework.md` |
| 사업 SoT | `Document/Business/BusinessPlan.md` |
| 코드 스냅샷 | `Document/Process/CodebaseStatus.md` |
| 기획 이력 | `Document/Archive/Phase.md` (참조만, 편집 금지) |

---

## §12 최근 세션 (이전은 `git log`)

- **2026-05-08 (33차, DQ-7 Smoke Test #2 PASS — KIS 암호화 검증)** — 사용자가 친구 장세현(shjang1001@gmail.com) 명의 KIS 실전투자계좌 키(APP_KEY `PSe3…9W7Q` 36자 / APP_SECRET 180자)를 채팅으로 제공. 코드 점검(`tudal/src/lib/credentials/validation.ts:8-10` regex + `form.tsx:93,159` 폼 제약)에서 3 블로커 식별: (a) 화면의 8자리 계좌번호는 폼 `\d{8}-\d{2}` 규칙에 끝 2자리 누락 (b) 친구 명의지만 son00326만 RLS·대표 게이트로 등록 가능 (c) APP_SECRET 채팅 노출. AskUserQuestion으로 사용자가 "son00326 대표로 모의투자 등록 + 계좌 suffix `01`" 결정 → 사용자가 https://tudal-tawny.vercel.app/admin/settings/brokerage UI로 `64601905-01` · 모의투자 라디오 + 전략 라벨 "테스트" 직접 입력 → 12:21:01 KST 저장 성공 + 마스킹 행 노출 (`PS**···9W7Q · 시크릿 저장됨 ✓`). Supabase MCP는 32차 박제 contrary로 OAuth 재인증 필요 → `mcp__supabase__authenticate` → 사용자 브라우저 Authorize → "Authentication Successful" 화면 → ToolSearch로 `execute_sql` 스키마 로드. **검증 SQL 2건**: (1) `information_schema.columns`에서 `ciphertext_app_key` · `iv_app_key` · `auth_tag_app_key` · `ciphertext_app_secret` · `iv_app_secret` · `auth_tag_app_secret` 6개 모두 bytea 확인 (2) 행 SELECT + `octet_length` + `position(convert_to(plaintext) IN ct)` 검증 → ct 36/180바이트 · iv 12B · tag 16B (AES-256-GCM 표준) · 평문 APP_KEY/SECRET이 ciphertext에 포함된 위치 모두 `0` (= 평문 노출 없음). row id `f35566e9-45aa-490b-a440-fc6ded482c68`, admin_id `f9c08fa2-…` (son00326). HANDOFF §1 + §2 (1) + §9 Session 3 + §12 갱신. **데이터 의미상 불일치** (친구 실전투자 키가 son00326 슬롯에 mockMode=true로 박제됨)는 Smoke #4(RLS 격리) 진입 전 정리 필요 — 친구 비번 세팅 후 친구 슬롯으로 재등록. 다음 진입점 = **Smoke #3 Binance** (사용자 API_KEY/SECRET 64자 + testnetMode 권장).
- **2026-05-05 (32차, Supabase 계정 마이그 + Smoke #1·#6 PASS)** — Kevin 계정 접속 불가로 son00326 신 프로젝트(`rbrpcynhphrpljbjirfo`) 전환. Supabase CLI(GitHub binary v2.98.1) + MCP(HTTP+PAT, user-scope) 설치. MCP `apply_migration`로 0002~0010 9건 적용 · admin_emails 3 row + kr_business_days 2557 row + auth.users 3명 생성. Vercel env 8 entries 교체(REST API Preview 보정) + Production 재배포 `dpl_3FfP5ZU9uz7MqKYc4DD6MfomRJTY`. 회귀 3-gate green (build 24 / lint 0 / test:ci 306). T16 Auth URL Config ✅. **Magic Link UI 작동 안 함** (token 즉시 invalidate, Gmail prefetch 추정) → son00326 비밀번호 `Test1234!` 임시 설정으로 우회 · /admin 진입 확인 (Smoke #1 PASS). cron 인증 가드 검증 PASS (Smoke #6, 401/401/200). 잔여 = Smoke #2~#5 (KIS·Binance 저장 + RLS + 대표 가드). 보안 노출 시크릿 4종(anon JWT · service_role JWT · DB password · PAT) rotate 작업 종료 후. HEAD `9c8d3fb`.
- **2026-04-30 (31차, A 문서 갱신 + Naver API 키 투입)** — 사용자 BL-KRIT-3 해소용 Naver Developers Client ID/Secret 제공 → `tudal/.env.local`에 NAVER_CLIENT_ID·NAVER_CLIENT_SECRET 2줄 투입 (line 27-28). 후속 사용자 질의 "내가 알려주지 않고 자율 진행 가능 항목" → A(문서 갱신) / B(S8-Scaffold) / C(S7a wrapper skeleton) / D(검증) 4트랙 제시, A 채택. **A 범위**: (1) BL-KRIT-3 부분 해소 박제 (HANDOFF §4·§6 외부 신청 표 + ProgressDashboard §5 BL-KRIT-3) · (2) **T5 stale 정정**: ProgressDashboard §5 BL-KRIT-7 "마이그레이션 0009"→"0010" (28차에 0010으로 재배정됐으나 미정정) + CodebaseStatus 체크리스트 "[x] 마이그레이션 0010 파일 생성" → 0010은 BL-KRIT-7 해소 시 생성될 파일이므로 **[ ] 미생성**으로 정정 (잘못 체크된 stale 1건) · (3) CodebaseStatus 환경변수 섹션에 NAVER 추가 + 31차 엔트리 · (4) HANDOFF §12 31차. 코드 변경 0건 (env 1줄 추가 외). 검증: build/lint/test:ci 회귀 0 (env 변경만이므로 회귀 없음). 채팅 히스토리 키 노출 보안 주의 박제 (Vercel env 투입 전 Naver 콘솔 rotate 권장). 다음 진입점 불변 = **DQ-7 Session 3 잔여 3건 사용자 주도** (T16 + 0009 + T17).
- **2026-04-22 (30차, DQ-7 Session 3 부분 진행 — Vercel 첫 production 배포 도달)** — 사용자 지시로 Session 3 Deploy 착수. 흐름: 11 commits push(`3c91194..84fc7e2`) → BL-DQ7-1·2·3 시크릿 생성 자동화(Claude가 `node -e crypto.randomBytes` + `openssl rand` 직접 실행) + `.env.local` Edit 투입 + ADMIN_REP_EMAIL=`son00326@gmail.com` 확정 → T14 `tudal/scripts/rotate-cred-mek.mjs` 작성(.ts→.mjs deviation, tsconfig include `**/*.ts` strict 컴파일 회피 + tsx 의존성 제거 · 271 lines · pseudo-transaction 안전 모델 · `--help`·dry-run 동작 검증) → atomic commit `78dc54b` + push. **Vercel 자동화**: CLI v41.3.0 미인증 발견 → `vercel login --github` deprecated changelog 리디렉션 → CLI v41→v52 업그레이드 → 새 OAuth 2.0 Device Flow로 사용자 brower Authorize 완료(WSKQ-XHFB code, Seongnam-si IP 검증) → `vercel link --yes` 신규 프로젝트 `son326s-projects/tudal` 생성 → `vercel git connect` GitHub repo 연결 → `vercel env add` × 11 Production+Development 성공 / Preview 7개 누락(`git_branch_required` non-interactive 거부) → REST API `POST /v10/projects/:id/env?upsert=true` 일괄 보정 7개(`created:7 failed:0`) → rootDirectory=`tudal` PATCH → `vercel deploy --prod`가 path 중첩(`tudal/tudal`) 실패 → `.vercel/`을 repo root로 mv + rootDirectory 재설정 → `vercel deploy --prod` from repo root → **Hobby plan cron daily 제약**(`*/15 * * * *` 거부) 발견 → vercel.json `news-sweep` `*/15`→`0 0` 변경(옵션 B 사용자 권장 채택) + atomic commit `4c6f0e2` + push → 재배포 성공 https://tudal-tawny.vercel.app (`dpl_397UrMfZET9XLbzxsEDShZmCPZQ4`, READY, 24 routes, build 48s). **Production Branch deviation**: `link.productionBranch` PATCH 거부(`should NOT have additional property "link"`) → `main` 유지(dashboard 수동 변경만 가능) · spec §6.2 트릭은 S9 진입 전 사용자 dashboard에서 적용 권장. **사용자 다음 세션 잔여 3건**: T16 Supabase Redirect URL · 0009 마이그레이션 실 DB 적용 · T17 Cron dashboard 확인 + Smoke Test. **root .gitignore에 `.vercel/` 추가** (보안 핫픽스, repo root에 .vercel 생성됐는데 root .gitignore는 .vercel 패턴 없었음). 코드 변경: vercel.json 1줄 + scripts/rotate-cred-mek.mjs(신규 271줄) + .env.local 3줄(gitignored) + .gitignore 1줄. 검증: build/lint/test:ci 3-gate green · Vercel build exit 0. HEAD `4c6f0e2`, origin/main 동기화 (이 문서 갱신 commit 전).
- **2026-04-22 (29차, Step 2 로드맵 재조정 — HANDOFF만 반영)** — 28차 cleanup에 이어 사용자와 Q1~Q5 논의 후 로드맵 v2 확정. 사용자 결정: **(Q1)** 자동매매 실체결 최단 경로 + **S7b는 Short List 30 재조정 필수 입력이므로 강등 취소**(제 초안 오류 정정) · **S7c·S7d만 강등 큐** · **(Q2)** KIS 3명 각자 계정 · 동시 진행 · **(Q3)** 바이낸스 testnet+mainnet 양쪽 구현 · IP/KYC 이슈 없음(사용자 실 운영 경험) · **(Q4)** 리스크 5배 그대로 박제 · **(Q5)** KIS 신청 사용자 진행 중(완료 시 별도 보고). 자동매매 알고리즘 튜닝은 S8 구현 후 사용자가 여러 소스 투입해서 수정(Strategy drop-in + AI 어댑터 embed 경로 그대로). **자동매매 실체결 도달 = 기존 14세션 → 9세션**(총 11 세션: DQ-7 잔여 2 + S7a 1 + S7e 2 + S7b 2 + S8-Scaffold 2 + S8-Live 2). **편집 범위 = HANDOFF만**(사용자 지시 "우선 문서만 HANDOFF에 전부 반영") — ProgressDashboard §2 "Deferred-X 건너뜀" 잔여 스테일 1건은 다음 기회에. 편집: §1 Last updated · §2 진입 결정 트리 (3) DQ-8만 남음 반영 · §3 DQ-9·10·11 해소 박제 · §4 BL-KRIT-9 해소 · §6 전면 재작성 (v2 다이어그램 · 세션 표 · 강등 큐 · 외부 신청 병행 트랙) · §9 S8 마이그 0011 명시 · §12 29차 엔트리. 1 atomic 커밋. 다음 세션 진입점 불변 = **DQ-7 Session 3 Vercel 배포**.
- **2026-04-22 (28차, 문서 정합 cleanup — 로드맵 재조정 미수행)** — DQ-7 Session 2 완료 후 사용자 지시로 전체 문서 정독 + 스테일 포인터·구조 불일치 전수 정리. 2단계 분리 채택: Step 1 = 문서 cleanup(지금) · Step 2 = 로드맵 재조정(추후 HANDOFF §6·§2만). **이번 세션 범위 = Step 1만**. 6 User Stories / 5 atomic commits / 코드 0건 · 로드맵 편집 0건 · 보존 라인 6군데 불변. 주요 편집: (a) Archive 이관 — `AutoTrading.md`·`AutoTrading-AI구조설계.md` → `Document/Archive/` + ⚠️ 경고 prefix (D11 이전 "자동매매 독립 트랙" 가정 기반 리서치 원자료, S8 AI 어댑터 drop-in 시 참조 보존). (b) `S8-AutoTrading.md` 구조 불일치 3곳 — T8.1 마이그 번호 **0010→0011** 정정(E12는 DQ-7 0009 선행 생성) · §엔티티 신규 E12 축소(S8 신규는 E13~E17만) · 선행 문서 경로 Archive/ 반영. (c) HANDOFF §1 line 35 "이관 예정"→"이관 완료" · §4 BL-KRIT-8 "0010 E12~E16"→"0011 E13~E17 (E12 DQ-7 선행)" · §11 문서 가이드 ServicePlan-Admin v1.2→v1.3 + §12 28차 엔트리 추가. (d) ProgressDashboard 상단 메타·DQ-7 행·BL-KRIT-8 행 갱신. (e) CodebaseStatus 최근 갱신에 26차·27차 엔트리 + tudal 현재 상태 22→24 routes·190→248 tests 반영. (f) CLAUDE.md + ServicePlan.md + BusinessPlan.md + Deferred-Brokerage.md 포인터 v1.2→v1.3 · AutoTrading 참조 경로 Archive/ 반영. 검증: build 24 routes · lint 0 · test:ci 248/248 (코드 변경 0이므로 회귀 없음). dead link grep 0. 다음 진입 = **Step 2 로드맵 재조정 논의** (Q1~Q5 결정 → HANDOFF §6·§2만 수정). HEAD (cleanup 종료 시), origin/main 여러 commits ahead (push 대기).
- **2026-04-22 (27차, DQ-7 Session 2 Frontend UI 완료)** — 실행 방식 옵션 B(`/ralph` 자율 루프). 4 Task 3 Wave 분해: **Wave 5** T11 `secret-input.tsx` 공유 컴포넌트 (inline 구현, 98줄, `useRef` unmount cleanup + `autoComplete="new-password"` + maxLength counter — architect가 "not over-engineered" 명시 승인) → **Wave 6** T9·T10 병렬 디스패치 (executor sonnet × 2, 파일 겹침 0, 각 ~3분 · `/admin/settings/{brokerage,binance}` page + form + delete-button 6 파일 780줄) → **Wave 7** T12 `layout.tsx` sidebar nav +2 item(+3줄). Wave별 build + lint + test:ci 3-gate green 확인 후 atomic commit: `04d1116` T11 → `289820e` T9+T10 → `240e7dc` T12. **Ralph Step 7** architect(opus) APPROVED + optimality 통과 (spec §5.1 추상화 억제 유지 타당, 임박한 S8 divergence 대비). **Step 7.5** `ai-slop-cleaner` CLEAN verdict(0 edits). **Step 7.6** regression 3-gate 재확인 green. **Step 8** `/oh-my-claudecode:cancel` 클린 종료. 라우트 22 → 24 (+`/admin/settings/brokerage`·`binance`). tests 248/248 (UI component test infra 미도입이라 신규 테스트 없음, 회귀 없음). 사소한 수동 개입 1건: `binance/page.tsx` 배지 스타일 Tailwind v4 위반 `hsl(var(--muted))` → `var(--muted)` + `color-mix(...)` 정규화(Wave 6 inline fix). HEAD `240e7dc`, origin/main 14 ahead(push 대기, Session 3 직전 권장). HANDOFF 최소 갱신 §1·§2·§9·§12 — ProgressDashboard·CodebaseStatus는 Session 4 T20 일괄 기조 유지. 다음 진입 = **Session 3 Deploy (사용자 주도)**: BL-DQ7-1 MEK 생성 → T14 rotate 스크립트 → T15~T17 Vercel 배포.
- **2026-04-22 (26차, DQ-7 Session 1 Backend·DB 구현 완료)** — 실행 전략 옵션 A 조정(/ralph 대신 inline TDD — crypto 보안 크리티컬 특성상 red→green 사이클 직접 관찰 필요). 11 Task 순차 완료: T1 aes(14 tests, IV uniqueness 100회·tamper 4·MEK config 3) → T2 migration 0009(E9 재설계 + E12 신설 + RLS + rollback.sql, 실 DB 적용은 Session 3) → T3 mask(5) → T4 validation(18) → T5 types(ActionResult discriminated union) → T6 brokerage.ts(rep guard · 23505 매핑 · testStub pending-s8) → T7 exchange.ts(Binance 평행 구조) → T8 integration(vi.hoisted 20 cases) → T9 cleanup(BrokerageConnection·BrokerageScope·mock 삭제) → T10 .env.example(API_CRED_MASTER_KEY·ADMIN_REP_EMAIL 신규 + KIS/Binance 주석화) → lint fix(_prefix 제거, eslint config 미변경). **DoD 3게이트 green**: build 22 routes · lint 0 · test:ci 248 pass(+58). HEAD `3a6a348`, origin/main 11 ahead(push 대기). HANDOFF 최소 갱신(§1·§9 Session 1 체크박스·§12) — ProgressDashboard·CodebaseStatus는 Session 4 T20 일괄 기조 유지. 다음 진입 = Session 2 Wave 5 `secret-input.tsx` 공유 컴포넌트.
- **2026-04-22 (25차, DQ-7 brainstorming + spec 작성 + 문서 정합 + 실행 전략 확정)** — `superpowers:brainstorming` 스킬로 DQ-7 재설계 진행. 사용자 확정 축 Q1~Q5: (Q1=a) 바이낸스·KIS 모두 per-admin DB 저장 · (Q2=a) App-layer AES-256-GCM · (Q3=a) 이 슬라이스에서 즉시 Vercel 배포 · (Q4=b) 분리 2테이블 (E9 확장 + E12 신설) · (Q5=a) 테스트 버튼 UI만(disabled). 설계 8 섹션 사용자 승인 → `Document/Build/Slices/DQ7-Credentials.md` 신규 작성(858 줄, 17 섹션, 20 Tasks, 4 세션, 12 Wave, task별 agent·skill 매핑). §13에 자동매매·주식 분석 알고리즘 언어 확장성 박제. 마이그레이션 번호 재배정: DQ-7=0009 선점, BL-KRIT-7=0010. **문서 정합성 2 pass**: (1차) HANDOFF·ProgressDashboard·CLAUDE.md·S8 slice · DQ7 §9.1 Task 표 agent/skill 열 추가. (2차) S7-RealData·CodebaseStatus·ServicePlan-Admin(v1.3 + D17)·Deferred-Brokerage 스테일 포인터 전수 수정. **실행 전략 확정 (25차 후반)**: 옵션 A = writing-plans 짧게 → `/ralph` Session 1(8 Tasks) → 사용자 주도 Session 3·4. 이번 세션 범위 = Session 1 DoD까지 · HANDOFF §9 Session 1/2/3/4 재그룹화 박제. 커밋 이력 `962840a → da7ca38 → 6fd6f72 → (Session 1 시작)`.
- **2026-04-21 (24차, 어드민 프레임 재정의 + DQ-5 해소)** — 사용자 지시로 (a) 어드민 = 본인+친구 3명 내부 투자 도구로 범위 재정의, 멤버·MVP Stage·Friends & Family 어휘 분리. (b) 구 트레이딩 3-Stage(매뉴얼→API→AI 자율) 어휘 폐기, 자동매매 = S8 단일 슬라이스로 통합. (c) S8 범위 확정: 주식(KIS 모의→실계좌) + 코인(바이낸스 USDT-M 선물 테스트넷→메인넷) + Strategy drop-in + AI 어댑터 embed. AI agent·skill 본체는 어드민 추후 drop-in. (d) 리스크 가드레일 기본값 박제: 레버리지 ≤5x · 일일 -3% 정지 · AI 일 주문 ≤20회. (e) BusinessPlan §Q1·§5·§9·§10.5·§10.8·§11·§12 · ServicePlan-Admin §0·§1.5·§1.6·§1A.0·§2·§3.1·§3.4·§3.13(신설)·§1A.5 D16 · ServicePlan §1·§2 Revision · HANDOFF §0·§1·§3·§4·§5·§6·§7·§9·§10 전면 정리. Slices/S8-AutoTrading.md 신규 작성, Deferred-Brokerage·Deferred-AIAgent-Selection는 승격 표기. 코드 변경 없음(docs only). **(f) DQ-5 Supabase anon key 갱신 해소** — 새 JWT + publishable key로 `.env.local` 교체, auth/v1/settings REST 200 OK, `/login`·`/admin` 200 OK. BL-KRIT-6 해소. 커밋 `9385e97` + `1e9e116`, origin 미푸시 2 ahead.
- **2026-04-20 (23차 후속, HANDOFF 정정)** — 23차 종료 시 HANDOFF·ProgressDashboard·CodebaseStatus에 박힌 "🎉 MVP Stage 1 완료" 어휘를 "Mock Skeleton 완료 · 실데이터 0/19 · 운용 0일"로 전면 정정. feedback_mvp_framing.md 규칙을 문서 본문에 반영. 다음 세션 진입 결정 트리(§2)·DQ 리스트(§3)·BL-KRIT(§4)·자율 작업(§5)·실데이터 로드맵(§6)으로 재구성.
- **2026-04-20 (23차)** S6 Mock 완료 — M17·M19 mock 동작. cost_log·heartbeat_log 실 INSERT는 이월. 190 tests pass.
- **2026-04-19 (22차)** S5b Mock 완료 — M13·M14·M15 mock. KIS WebSocket·Telegram 실 연결 이월.
- **2026-04-19 (21차)** S5a Mock 완료 — M10·M11·M12·M18 mock. Naver·Resend·Anthropic 실 연결 이월.
- **2026-04-19 (20차)** S4 Mock 완료 — M8·M9·M16 mock.
- **2026-04-17 (19차)** S3 Mock 완료 — M7 + D15 게이팅 + BL-20 자동 바이패스 mock.
- **2026-04-17 (18차)** S2 Mock 완료 — M2·M3 mock + report_view_log 파이프.
- **2026-04-17 (17차)** S1 Mock 완료 — M1·M4·M5·M6 mock.
- **2026-04-17 (15차)** S0 Foundation — 레거시 제거·Supabase 연결·라우트 17·디자인 토큰.

---

**단일 진입 규칙**: 이 파일 §2 결정 트리만 따르면 다음 세션이 즉시 이어갈 수 있다. 막히면 §3 DQ 우선순위 1번을 사용자에게 묻는다.
