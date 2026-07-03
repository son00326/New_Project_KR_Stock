# scripts/worker — 외부 상시 프로세스 (Vercel 앱 라우트 아님)

## intraday-ws-worker.ts — S7c 장중 연속 WS 워커

KIS OpenAPI 실시간 WebSocket(H0STCNT0)을 연속 구독해 보유+active Short List 종목의
장중 이상(±5% / 거래량 3배)을 감지하고 `runIntradayMonitorPass`로 durable alert +
텔레그램을 발행하는 **외부 tsx 프로세스**다 (Vercel Hobby는 sub-daily cron 불가 —
spec 2026-07-03 §3 D-7). 어드민 Mac/임의 호스트에서 상시 실행한다.

### 게이트 (이중)

| 게이트 | 의미 |
|---|---|
| `INTRADAY_WORKER_CONFIRM=1` | 프로세스 기동 fail-closed 게이트. 없으면 즉시 종료. |
| `INTRADAY_MONITOR_ENABLED=true` | pass 내부 소비. off면 pass가 no-op(writes 0) — tick 흐름만 로그하는 shadow 관찰 모드. |

### 필수 env

```
SUPABASE_URL                # 또는 NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY   # RLS 우회 (cron/worker 컨텍스트)
KIS_APP_KEY / KIS_APP_SECRET
```

### 선택 env

```
KRX_OPENAPI_KEY            # 전일 종가 + 20거래일 평균 거래량 컨텍스트 (없으면 전 tick skip)
TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID   # 없으면 durable alert만 (텔레그램 mock-mode)
KIS_WS_MOCK=true           # 모의투자 도메인 (openapivts:29443 / ops:31000)
INTRADAY_MONITOR_ENABLED=true
```

### 수동 실행

```bash
cd tudal
INTRADAY_WORKER_CONFIRM=1 npx tsx scripts/worker/intraday-ws-worker.ts
```

tsx는 devDependency (tsconfig `@/*` paths 해석 내장 — tsconfig-paths 불필요, 2026-07-04
프로브 검증). 장외(주말/휴장/09:00 이전/15:30 이후)에는 WS 미연결 유휴 대기하므로
상시 띄워도 안전하다. 종료는 Ctrl-C(SIGINT) — WS close 후 정상 종료.

### 동작 요약

1. KST 09:00–15:30 평일 + KRX 휴장 게이트 (`market-hours.ts`, 캘린더 실패 시 평일 fallback).
2. 세션 시작 시 컨텍스트 조립 (`worker-context.ts`): universe = 보유 ∪ active 30
   (KIS 등록 상한 41 cap), 전일 종가 + 20거래일 거래량 백필(일당 KRX 2콜), prefs any-ON 집계.
3. `subscribeKisTicks` 실모드: approval_key 발급 → WS 연결 → H0STCNT0 구독 →
   PINGPONG echo → 끊기면 지수백오프(≤60s) 재연결+재구독.
4. tick 버퍼(종목당 최신 1건) 20초 주기 flush → dedup 사전 억제(1분 bucket, alert/telegram
   중복 발송 차단) → `runIntradayMonitorPass`.
5. SIGINT/SIGTERM graceful shutdown.

### pm2 예시

```bash
cd tudal
INTRADAY_WORKER_CONFIRM=1 INTRADAY_MONITOR_ENABLED=true \
pm2 start "npx tsx scripts/worker/intraday-ws-worker.ts" --name intraday-ws-worker
pm2 logs intraday-ws-worker
pm2 stop intraday-ws-worker
```

(env를 pm2 ecosystem 파일로 관리해도 된다 — 키 값은 파일 커밋 금지.)

### launchd 예시 (macOS)

`~/Library/LaunchAgents/com.joopick.intraday-ws-worker.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.joopick.intraday-ws-worker</string>
  <key>WorkingDirectory</key><string>/PATH/TO/New_Project_KR_Stock/tudal</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/env</string>
    <string>npx</string>
    <string>tsx</string>
    <string>scripts/worker/intraday-ws-worker.ts</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>INTRADAY_WORKER_CONFIRM</key><string>1</string>
    <key>INTRADAY_MONITOR_ENABLED</key><string>true</string>
    <!-- SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / KIS_APP_KEY / KIS_APP_SECRET /
         KRX_OPENAPI_KEY / TELEGRAM_* 는 여기 채우되 plist를 리포에 커밋하지 말 것 -->
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/intraday-ws-worker.log</string>
  <key>StandardErrorPath</key><string>/tmp/intraday-ws-worker.err.log</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.joopick.intraday-ws-worker.plist
launchctl list | grep joopick
```

### 보안 박제

- `@/lib/supabase/service-role` import 금지 — `server-only` 가드(Next 전용) + B17
  boundary(cron allowlist) 오염 방지. 워커는 `@supabase/supabase-js` `createClient` 직생성.
- KIS/KRX/Supabase/Telegram 키 값은 로그·에러 메시지·리포 파일에 절대 미출력
  (`kis-ws-client.ts` 오류 문자열은 status 코드만 포함).
- H0STCNT0 필드 인덱스는 공식 repo(koreainvestment/open-trading-api) 기준 pin —
  KIS 키 주입 후 실 스모크로 실측 재검증(WATCH, kis-ws-client.ts 상단 주석).
