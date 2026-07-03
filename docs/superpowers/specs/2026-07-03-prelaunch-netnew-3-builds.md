# 출시 전 net-new 3건 빌드 spec — 주간 Tier0 producer · G1 Funnel Reflection 러너 · S7c Intraday WS 워커

> **작성**: 2026-07-03 · **상태**: 구현 중 → omxy 교차검증 대상
> **목표**: HANDOFF [CURRENT] 출시 키스톤 중 CLAUDE-buildable net-new 3건을 전부 빌드해 "실제 생성 가능" 상태로 만든다. 전부 shadow-first/dormant — USER 활성 게이트(§7) 전까지 production 무접촉.
> **불변**: MVP 3종 불변 · NO-CONFIG-PASSES(상승 예측 claim 금지) 유지 · funnel 자동 적용 영구 금지 · 이메일/Resend 전역 금지 · Vercel Hobby cron = daily만.

---

## §1 Build 1 — 주간 Tier0 producer (`.github/workflows/tier0-weekly-producer.yml`)

**전제(스코핑 확증)**: `scripts/screen_shortlist_tier0.py`에 D30 토큰 게이트(`--apply-approval-basis USER_PRODUCTION_FUNNEL_DIAGNOSTIC` fail-fast 이중 차단)·강제 disclosure·provenance sidecar(diagnostic_funnel:true)·쓰기 직전 자동 rollback JSON 백업·B89 sector strict block(exit 2)·Gate C smoke·KRX throttle>10% abort가 전부 내장. 모든 abort는 DB write 이전(fail-closed·부분쓰기 0). cfg1(bpp)은 foreign/DART 생략 → 필요 env = `KRX_OPENAPI_KEY`+`SUPABASE_URL`+`SUPABASE_SERVICE_ROLE_KEY` 3개, AI 비용 0.

**net-new 산출물**:
1. `.github/workflows/tier0-weekly-producer.yml` (리포 첫 워크플로)
   - schedule: `0 22 * * 0` (일 22:00 UTC = **월 07:00 KST** — selection-worker daily 11:00 KST의 선행) + `0 0 1 * *` (매월 1일 09:00 KST — midlong m:YYYY-MM 시딩 지연 최소화) + `workflow_dispatch`(inputs: mode=dry-run|apply, month override).
   - **dormant 게이트**: job `if: vars.TIER0_PRODUCER_ENABLED == 'true'` — repo variable 미설정 시 skip(green no-op). 변수/secrets 주입 = USER-only.
   - **mode 게이트**: `vars.TIER0_PRODUCER_MODE`(미설정 = dry-run). `apply`일 때만 `--apply --apply-approval-basis USER_PRODUCTION_FUNNEL_DIAGNOSTIC`, 아니면 `--dry-run`.
   - month 계산 = 실행 시점 KST 날짜의 `YYYY-MM-01`(dispatch override 가능). `--scoring bpp --emit-candidates --csv-backup scripts/out/bpp_cfg1_<YYYY-MM>.csv`.
   - 아티팩트 업로드(항상): CSV + provenance sidecar + rollback JSON(`scripts/out/*.prod-rollback-*.json`) — rollback 가능성 보존.
   - `timeout-minutes: 90`(KRX ~670콜) · concurrency group 직렬화 · 실패 시 GH 기본 알림(+Telegram secrets 존재 시 best-effort curl, 없으면 skip).
   - 어휘: 워크플로 이름/로그/아티팩트 전부 "diagnostic funnel / candidate shortlist"만. 예측 어휘 금지.
2. `scripts/requirements-ci.txt` — cfg1 최소 의존 핀(supabase·requests·pandas·numpy 등 실제 import 기준; pykrx는 cfg1 경로 lazy import 미도달이면 제외).
3. (Build 2 연계) `--emit-factor-ranks` opt-in — §2 참조. 워크플로에선 `vars.TIER0_EMIT_FACTOR_RANKS == 'true'`일 때만 전달(마이그 0050 apply 후 USER가 활성).

**리스크 박제**: mid-period 덮어쓰기 drift(미finalize midlong run 도중 주간 150 교체 → 신규 ticker 추가 enqueue) = SELF_CONTINUE ON으로 보통 당일 finalize·위험 낮음, 워크플로 주석+본 spec에 박제. B89 strict block은 자동 self-heal 불가 → 실패 시 `scripts/sector_override.json` 커밋으로 해소(runbook 주석).

## §2 Build 2 — G1 Funnel Reflection 러너 (cron route + 입력 로더 + factor exposure 계측)

**전제(스코핑 확증)**: `buildFunnelReflection`(순수, Spearman + ±0.05 bounded nudge)·`runFunnelReflectionJob`(flag 게이트 내장)·`insertFunnelReflectionProposal`(23505 idempotent)·UI·마이그 0047(applied)은 전부 존재. net-new = **입력 조립 로더 + 진입점 + factor exposure 계측**.

**설계 결정**:
- **D-1 factorExposures 소스 = (a)+(b) 하이브리드**: 신규 dormant 마이그 **0050** `tier0_candidates_150.factor_ranks jsonb NULL`(+rollback+pg_smoke) + Python producer `--emit-factor-ranks` opt-in flag(default off — 컬럼 부재 환경에서 upsert 실패 방지, 마이그 apply 후 USER가 GH var로 활성). 로더는 `factor_ranks` 존재 행 = per-factor exposure 사용, 부재(과거 월) = `tier0_score` 단일 pseudo-factor fallback(fail-soft, rationale에 명시). "계측 먼저·완성 늦게"(HANDOFF §다음할일 6) 정합 — S9 첫날부터 데이터 축적.
- **D-2 championConfig SoT**: 신규 TS 상수(`lib/reflection/funnel-champion-config.ts`) = B++ cfg1 rank ensemble mirror(`{trend: 0.5, size: 0.5}`, equal-weight rank combine) + provenance 주석(Python cfg1 lock이 SoT, TS는 mirror) + drift-pin 테스트.
- **D-3 period = 월간만(YYYY-MM) scaffold**: 회고 대상 = 직전 완료 월(과거 월 150은 month 키로 보존). 주간(YYYY-Wnn)은 후속. `getPriorFinalizedCycle` 앵커 재사용, `m:YYYY-MM` → `YYYY-MM` 매핑(0047 CHECK 준수 — 위반 시 23514).
- **D-4 실현수익률 창**: 대상 월 첫 거래일 종가 → (월 완료 시) 말일 거래일 종가 / (진행 중) 최신 완료 거래일 종가. KRX EOD 2콜(`fetchEodCloseMap` 날짜당 전종목 1콜)·비용 0·`resolveReflectionPrices` 패턴 재사용. KRX 키 부재 → fail-soft(빈 Map → skip/표본부족).
- **D-5 진입점**: 신규 `/api/cron/funnel-reflection/route.ts`(reflection-job 클론: CRON_SECRET auth → flag 200-skip을 service-role 생성 **전에** → per-unit fail-soft → 구조화 로그) + **vercel.json daily 슬롯 +1**(`0 3 * * *` = 12:00 KST, selection-worker 후) — #129 선례(dormant flag OFF cron 사전 등록) 답습, flag OFF → 200 skip·spend 0.
- **D-6 30 postmortem(recall)**: 이번 scaffold 범위 밖(S9 "완성 늦게"). tier0 150 factor↔return 상관 + bounded nudge 제안만.

**산출물**: `lib/reflection/funnel-reflection-source.ts`(로더, DI·fail-soft) · `funnel-champion-config.ts` · `/api/cron/funnel-reflection/route.ts` + `__tests__` · 마이그 `0050_tier0_factor_ranks.{sql,rollback.sql}` + `scripts/pg_smoke_0050.sh` · Python `--emit-factor-ranks` + unittest · vercel.json +1 · service-role.ts B17 allowlist 주석 · (1줄) UI `formatPeriodLabel` regex를 0047 CHECK 포맷과 정합화.

**가드레일(기존 박제 유지)**: 자동 적용 영구 금지(insert만·decide=status 기록만) · retro-only CHECK · NUDGE_DELTA=0.05 clamp[0,1] 재조정 금지 · PR-K reflectionLearningContext/선정 prompt 경로 배선 금지 · UNIQUE(period_key) 재실행 안전.

## §3 Build 3 — S7c Intraday 연속 WS 워커 (외부 프로세스)

**전제(스코핑 확증)**: `monitor.ts`(순수)→`run-monitor.ts`(flag 게이트 내장 단발 pass, DI: insertAnomalies/insertAlerts/sendTelegram)→`admin-intraday.ts`(dedup_key UNIQUE ignoreDuplicates)→telegram까지 완결. net-new 본체 = **KIS WS 실클라이언트**(현 stub) + **컨텍스트 조립** + **워커 셸**. spec 2026-06-27이 "외부 프로세스가 runIntradayMonitorPass 호출" 형태로 박제.

**설계 결정**:
- **D-7 호스팅 = 외부 tsx 프로세스**(어드민 Mac/임의 호스트). `tudal/scripts/worker/intraday-ws-worker.ts` + `INTRADAY_WORKER_CONFIRM=1` env fail-closed 게이트(P3/P4 full-run 선례) + `INTRADAY_MONITOR_ENABLED` 이중 게이트(pass 내부 소비 유지). GH Actions는 6h job 한도로 부적합(기각). launchd/pm2 예시는 runbook 주석.
- **D-8 KIS 키 소싱 = 워커 호스트 env** `KIS_APP_KEY`/`KIS_APP_SECRET`(기존 어댑터 계약 정합). per-admin vault decrypt read-path 신설은 범위 밖(현 미배선 유지). 키 부재 → `isKisWebSocketConfigured()=false` → mock-mode no-op fail-soft 유지.
- **D-9 KIS WS 실클라이언트**: 신규 `lib/intraday/kis-ws-client.ts` — approval_key 발급(POST /oauth2/Approval) → WS 연결(실전 :21000/모의 :31000, env `KIS_WS_MOCK`) → H0STCNT0 구독(연결당 등록 상한 ~41 내 universe = 보유+active30 수용) → PINGPONG echo → pipe-delimited 프레임 파서(**순수 export·필드 인덱스 상수화·test:ci 커버**) → 지수백오프 재연결+재구독. 기존 `subscribeKisTicks` 계약(KisSubscribeOptions/KisSubscription) 구현체로 끼움(호출부 계약 불변). 공식 필드 레이아웃은 KIS 공식 문서(github koreainvestment/open-trading-api) 기준으로 구현 시 verify — 실 스모크는 KIS 키 주입 후(USER 게이트).
- **D-10 컨텍스트 조립**: 신규 `lib/intraday/worker-context.ts` — universe = `getCurrentHoldings`+`getActiveShortList`({client} DI, exit-signal 패턴) · referencePrice = `fetchEodCloseMap`(전일 종가) · **avg20dVolume = krx-eod additive 확장**(ACC_TRDVOL 파싱 신규 함수 — 기존 consumer 무변경) + 기동 시 20거래일 백필(~20콜, KRX 키 부재/실패 → 해당 ticker 거래량 트리거 skip fail-soft).
- **D-11 prefs 집계**: service-role 읽기 신설(`{client}` seam) — 멀티어드민 규칙 = **어느 한 어드민이라도 ON이거나 pref row 없음 = enabled**(default ON 보존·공용 채팅 1개 전제). M14 의미(장중 감지 skip·Exit 우회) 보존.
- **D-12 런타임 정책**: KST 09:00–15:30 평일 + KRX 휴장일 게이트(`loadKrBusinessDays` 재사용) — 장외엔 유휴 대기(연결 미유지). tick 축적 버퍼 20초 주기 flush → `runIntradayMonitorPass`(1분 dedup bucket이 중복 흡수). graceful shutdown(SIGINT/SIGTERM → WS close). Supabase client = 워커 전용 직생성(`server-only` 가드 회피) — service-role.ts boundary 오염 방지.

**Vercel 앱 경로 영향 = 0**(순수 additive; vercel.json 무변경 — intraday cron 없음이 의도). 순수 로직(파서·백오프 상태기계·market-hours·집계 규칙·flush 배치)은 전부 vitest test:ci 편입. 실 WS 연결 = CONFIRM-gated 수동 스모크(KIS 키 = USER 게이트 ③ 이후).

## §4 공통

- `.gitignore` 보강: `tudal/scripts/out/`(untracked 산출물, 커밋 금지 — 기존 백업 JSON은 로컬 보존).
- 검증 게이트: `npm run build`+`lint`+`test:ci`+`tsc --noEmit` ALL GREEN + python unittest(scripts) + 신규 pg_smoke(0050).
- 테스트 컨벤션: vi.hoisted + service-role 생성 카운트 dormancy 단언 + env save/restore + typed Supabase chain mock(any 금지).
- 커밋: 디렉토리 단위 add(sibling __tests__ 누락 방지).

## §5 워크스트림/커밋 순서 (파일 교집합 0으로 분리)

1. **Lane A(Build 2)**: 마이그 0050 + Python `--emit-factor-ranks` + champion config + 로더 + cron route + vercel.json + 테스트.
2. **Lane B(Build 1)**: GH 워크플로 yml + requirements-ci.txt (+ Lane A의 factor-ranks var 배선).
3. **Lane C(Build 3)**: kis-ws-client + krx-eod volume 확장 + worker-context + prefs seam + 워커 셸 + 테스트.

## §6 리뷰 계획

Claude 다층 적대 리뷰(정확성·dormancy 불변식·연결포인트·보안/키·테스트 vacuous 여부) → fix → §2.0a 4-step omxy 교차검증(orchestrator=Claude, catch-only) → CONVERGED → merge.

## §7 USER 활성 게이트 (빌드 후 잔여 — 본 PR은 전부 dormant 출고)

| 항목 | USER 액션 |
|---|---|
| 마이그 0050 apply | Supabase production apply(+pg_smoke_0050) |
| tier0 producer 활성 | GH secrets(`KRX_OPENAPI_KEY`·`SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`[+`TELEGRAM_*` 선택]) + repo vars(`TIER0_PRODUCER_ENABLED=true`·`TIER0_PRODUCER_MODE=apply`·0050 후 `TIER0_EMIT_FACTOR_RANKS=true`) — dry-run 1회 검증 후 apply 권장 |
| funnel reflection 활성 | Vercel `FUNNEL_REFLECTION_ENABLED=true`(+`KRX_OPENAPI_KEY` 기주입 ✅) |
| intraday 워커 가동 | KIS 키(B-10) 발급 → 워커 호스트 env(`KIS_APP_KEY/SECRET`·`SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`·`TELEGRAM_*`·`INTRADAY_MONITOR_ENABLED=true`·`INTRADAY_WORKER_CONFIRM=1`) + 프로세스 상시 실행(launchd/pm2) |
| Telegram(B-9) | 봇 생성 + `TELEGRAM_BOT_TOKEN`+chat_id — Vercel env + 워커 host + GH secrets(선택) |
| 매달 자동화 | `SELECTION_CRON_AUTO_ENABLED=true` + Vercel env `SELECTION_CRON_SELF_CONTINUE` 삭제(producer 가동 검증 후) |
