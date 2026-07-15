# 프리즘(PRISM-INSIGHT) 사이드카 벤치마크 트랙 — 설계 스펙

- **날짜**: 2026-07-15
- **상태**: ✅ **v7 Claude↔omxy CONVERGED (2026-07-15, R1~R7)** — 누적 41 catch(R1 13·R2 8·R3 6·R4 5·R5 5·R6 4·R7 0) 전건 반영, R7 omxy "잔여 HIGH/MEDIUM/LOW 없음" SIGNAL: CONVERGED. 다음 = Phase 2 구현(omxy) → Claude 검토
- **프로세스**: Claude 플랜 드래프트 → omxy 교차검증(catch-only) → 수렴 후 omxy 구현 → Claude 적대 검토·게이트·머지 (USER 지시 2026-07-15: 구현=omxy, 최종 검토=Claude)
- **SoT**: 본 문서. 관련 조사 기록 = 세션 워크플로 3회(사이트 실측·저장소 감사·셀프호스트 요구사항, 2026-07-15) + omxy R1(업스트림 HEAD `b8171a4` 직접 대조)

---

## §0 목적 + 용어 구분 (중요)

**목적**: 오픈소스 주식 분석·가상매매 엔진 **PRISM-INSIGHT**(`dragon1086/prism-insight`, AGPL-3.0)를 **원본 그대로** 별도 사이드카(EC2)에서 가동하여, 그 종목 선정·가상 트레이딩·수익률 산출물을 주픽 어드민의 신규 메뉴 **"프리즘 (실험)"** 에서 열람하고 **주픽 자체 방식(Tier0 B++ → Core-11 위원회 30선정 + 가상 포트)과 성과를 forward 비교**한다.

> ⚠️ **용어 구분**: 본 문서의 "프리즘/PRISM-INSIGHT"는 외부 오픈소스 엔진의 사이드카 미러를 뜻한다. `docs/superpowers/specs/2026-06-19-pathA-forward-shadow-sector-layer.md`의 "PRISM식 섹터 레이어"(경로A — 하드게이트 production REJECT된 내부 연구 트랙)와는 **완전히 별개**다. 경로A의 불변식은 본 트랙과 무관하게 계속 유효하다.

**fair-prism caveat 해소 관계**: 2026-06-18 cfg8 박제는 "공정한 PRISM 비교에는 장중 트리거+체결가능 진입/청산+P&L 귀속이 필요하며 offline recall 하네스 범위 밖"이라 비교 불가로 동결했다. 본 트랙은 **실제 엔진의 forward 가동**이므로 그 조건을 정면 충족한다 — 단, 비교 주장은 §8의 면책 규율을 따른다.

## §1 USER 확정 결정 (2026-07-15)

1. **한국 + 미국 둘 다** 가동.
2. **호스트 = EC2** (처음부터 서버 전제; Phase 0 로컬 검증은 선택).
3. **비용 경로 = ChatGPT 구독 OAuth 프록시** (`PRISM_OPENAI_AUTH_MODE=chatgpt_oauth`).
4. UI는 주픽 디자인(D34 토스)에 맞춰 재구현. 원본 대시보드 코드 미사용.
5. 목적 = 방식 비교. 실계좌 연동 없음 — 가상 트레이딩 전용.
6. 프로세스 = omxy 구현 / Claude 최종 검토·머지.

## §2 아키텍처

```
[EC2: prism-insight 원본 Docker 컨테이너 (pin: b8171a4, 설정 주입만)]
  KR: 07:00 종목맵 / 09:30·15:40 분석배치 / 17:00 성과추적 / 11:05·17:10 JSON 생성 (KST, 월–금)
  US: 00:15·06:30 분석배치 / 07:30 성과추적 / 08:00 JSON 생성 (KST, 화–토)
  산출: examples/dashboard/public/{dashboard_data.json, us_dashboard_data.json} (+ SQLite 원천)
        │
  [ingest 스크립트 — Python stdlib 단일 파일, 우리 신규 자작, JSON 파일만 읽음 (AGPL 무접촉)]
  EC2 cron: KR 11:20/17:25, US 08:15 KST · PRISM_INGEST_CONFIRM=1 게이트 · freshness/안정성 검증
        │ Supabase service_role → SECURITY DEFINER RPC
        ▼
[Supabase: 마이그 0051 prism_snapshot (jsonb 전문, market×date×slot, provenance 포함)]
        │ RLS is_admin SELECT
        ▼
[tudal /admin/prism — "프리즘 (실험)" 메뉴, 주픽 토스 UI, 비교 뷰 + stale 배지]
```

## §3 AGPL-3.0 경계 불변식 (LOCKED)

- **I-P1**: `dragon1086/prism-insight` 코드(프롬프트 텍스트 포함)를 tudal 저장소에 **한 줄도 반입 금지**. 사이드카는 EC2에서 원본 그대로(설정 파일·compose override 주입만) 가동.
- **I-P2**: ingest 스크립트·마이그·UI는 전부 신규 자작. 참조 가능한 것은 산출 **데이터**(JSON)와 그 스키마 구조뿐.
- **I-P3**: 사이드카 수정이 필요해지면 EC2 쪽 fork에만 반영, tudal과 코드 결합 금지.
- **I-P4**: production 무접촉 — 주픽 기존 테이블·cron·선정 경로 영향 0. **`pipeline_health` 등 기존 운영 테이블에 prism 이벤트 기록 금지**(omxy R1 HIGH-9: 기존 CHECK 계약 위반 + 무접촉 위반). 신규 표면은 전부 additive.

## §4 사이드카 배포 스펙 (EC2)

- **업스트림 pin**: commit **`b8171a4`** (2026-07-15 HEAD) checkout 배포. 업데이트는 의도적 pull + 스키마 계약 재검증 후에만 (§13).
- **인스턴스**: t3.large (2 vCPU/8GB) + 30GB gp3 권장 (~$76/월 서울). 절약: t3.medium + 스왑 4GB.
- **배포**: `docker compose up -d` + **`docker-compose.override.yml`(우리 작성 — 설정이지 코드 아님, AGPL 무관)**. 공식 compose에 없는 필수 마운트/설정(omxy R1 HIGH-1, 업스트림 실파일 대조 확정):
  - `./examples/dashboard/public` 볼륨 (호스트 ingest가 JSON을 읽을 유일한 경로 — 기본 compose 미마운트)
  - `./trading/config/kis_devlp.yaml` 볼륨 (기본 미마운트 → 재빌드 시 모의키 설정 소실)
  - `/root/.config/prism-insight` 볼륨 (OAuth 토큰 — 기본 미마운트 → 재생성 시 소실)
  - **custom crontab 마운트** (`docker/crontab` 교체): 공식 crontab은 `--no-telegram`/`--no-translation` 미전달 → **분석 orchestrator 라인에만 `--no-telegram`, JSON generator 라인에만 `--no-translation`** 적용(omxy R2 HIGH-3: 상호 미지원 인자 — 교차 적용 시 실행 실패). **`PRISM_OPENAI_AUTH_MODE=chatgpt_oauth`를 override environment에 명시**(누락 시 기본 API-key 경로로 폴백). ⚠️ **AGPL 주의(omxy R2 MED-4)**: custom crontab은 업스트림 파일의 수정본 = EC2 PRISM checkout 전용, **tudal 반입 금지**(I-P1). tudal에는 diff 내용의 문서 서술만 보관. `docker-compose.override.yml`은 우리 자작 설정 파일이라 반입 가능.
  - 호스트에서 `touch stock_tracking_db.sqlite` 선행 (미존재 시 Docker가 디렉토리 생성 → 기동 실패)
- **ChatGPT OAuth**: 랩탑에서 `python -m cores.chatgpt_proxy.oauth_login` 후 `chatgpt_auth.json` EC2 복사(또는 `ssh -L 1455:localhost:1455`). refresh 자동. `tools/oauth_healthcheck.py` 30분 + `--quota` 3시간 cron.
- **KRX 데이터**: KRX 직접 로그인(`KRX_ID/KRX_PW`, `KRX_LOGIN_METHOD=krx`) — 카카오는 headless 부적합. 세션 ~4h 자동 갱신, FinanceDataReader fallback 내장.
- **KIS 설정**: `kis_devlp.yaml` 존재 필수(import-time 로드; 없으면 트래킹 배치 전체 스킵). **KIS 모의투자 키 + `auto_trading: false`** (placeholder 키는 배치 내 후속 후보 스킵 노이즈).
- **US 모듈**: yahoo-finance-mcp + SEC EDGAR(`SEC_EDGAR_USER_AGENT`). Finnhub 생략(소비 코드 없음). US 크론 EST 고정 — DST(3–11월) 1시간 수동 조정 체크리스트.

## §5 데이터 계약 + 마이그 0051

- **입력**: `dashboard_data.json`(KR) + `us_dashboard_data.json`(US). 스키마 SoT = 원본 `examples/dashboard/types/dashboard.ts`(참조만). `_en` 변형은 **미생성·미ingest**(`--no-translation`).
- **타임스탬프 규율 (omxy R1 HIGH-3)**: 업스트림 `generated_at`은 **timezone-naive `datetime.now()`** → ingest가 **+09:00(KST) 명시 부여** 후 timestamptz로 전달. US JSON은 생성일(KST)이 미국 거래일 다음날 → ingest가 **`market_session_date`**를 별도 계산(KR = KST 당일, US = KST 날짜 −1일)해 전달. `snapshot_date` = KST 생성 날짜.
- **마이그 `0051_prism_snapshot.{sql,rollback.sql}`** — 0039 패턴 미러 + R1 수정:
  - 테이블 `prism_snapshot`: `id`, `market`(`'kr'|'us'` CHECK), `snapshot_date`(date), **`snapshot_slot`(`'am'|'pm'|'daily'` CHECK — KR 11:20=am/17:25=pm, US=daily; omxy R1 HIGH-2: 일 2회 스냅샷 상호 덮어쓰기 방지)**, `market_session_date`(date), `generated_at`(timestamptz), `payload`(jsonb 전문), **provenance: `payload_sha256`(text), `source_commit`(text — env `PRISM_SOURCE_COMMIT`), `contract_version`(int — ingest 검증 스키마 버전)**, **`terminal_performance`(jsonb nullable, 소형 — omxy R4 HIGH-2: ingest가 payload `prism_performance`에서 자기 `market_session_date` 이하 마지막 precomputed point 1개를 추출해 별도 저장; 역사/비교 조회는 payload 전문 대신 이 컬럼만 읽음. **shape 계약(omxy R5 MED-1): 최소 `{date: ISO date, cumulative_realized_profit: finite number, prism_simulator_return: finite number}` RPC 검증 + 추가 필드 허용(open). `prism_performance` 부재/빈 배열 = terminal NULL + 비교 시계열 empty 처리(abort 아님 — 사이드카 초기 부트스트랩 기간 정상 상태)**)**, **`first_ingested_at`(불변) + `last_ingested_at`(UPSERT 갱신) 분리(omxy R5 MED-2)**. **unique(market, snapshot_date, snapshot_slot)**.
  - **불변 벤치마크 메타 (omxy R5 HIGH-1 + R6 MED-2)**: anchor 행 영구 보존만으로는 불충분 — 같은 (market,date,slot) 재ingest UPSERT가 anchor 행의 session date/terminal을 갱신해 파생 시작일이 시변. **별도 소형 테이블 `prism_benchmark_meta`(market PK, `benchmark_session_date` date, **`anchored_snapshot_id` uuid NOT NULL REFERENCES `prism_snapshot(id)` ON DELETE RESTRICT** — 영구 anchor 정책 DB 강제, created_at)**: RPC가 시장별 **최초 스냅샷 INSERT 시 원자 생성(`ON CONFLICT DO NOTHING`), 이후 어떤 경로로도 UPDATE 없음** = PRISM 측 시작일의 불변 SoT. RLS/grant는 prism_snapshot과 동일(is_admin SELECT·write는 RPC 내부만). `prism_snapshot.id`는 uuid PK.
  - **`last_ingested_at` 의미 (omxy R6 MED-3)**: RPC 호출 성공 시각 기준 — `inserted|updated|unchanged_noop` 모두 갱신, **`stale_rejected`는 갱신 금지**(운영 감사: "마지막으로 성공 수신한 시각"). **market×slot 교차 CHECK (omxy R2 MED-1): `(market='kr' AND snapshot_slot IN ('am','pm')) OR (market='us' AND snapshot_slot='daily')` — 테이블 CHECK와 RPC 검증 양쪽에 동일 불변식**.
  - **`market_session_date` 의미 (omxy R2 MED-2)**: 1차 = **payload 내 `max(market_condition[].date)`**(실데이터 기반 — 휴장일 가짜 거래일 방지). 부재/파싱 불가 시 fallback = nominal(KR=KST 당일, US=KST−1일). **`session_date_source`는 정식 테이블 컬럼**(`'payload'|'nominal'` CHECK — omxy R3 MED-1). **신선도 검증 (omxy R4 MED-2): `market_session_date <= snapshot_date` AND nominal 대비 지연 ≤ 7일 — 위반 시 ingest abort(fail-closed, upstream 파이프라인 고장 신호)**. 월말 장기 보존 기준 = `snapshot_date`(KST) 고정.
  - **provenance 실효성 (omxy R3 MED-2)**: `contract_version` 초기값 = **1**(ingest 상수). `source_commit` = **40자 hex SHA 형식 regex 검증 + v1 pin `b8171a4e95314b2fc29b81af0ee74d47e8a705e9` 일치 fail-closed**(불일치 = ingest abort — 업스트림 무단 업데이트 검출).
  - RLS: authenticated `is_admin()` SELECT + anon RESTRICTIVE deny. 테이블 write grant 0.
  - 단일 **SECURITY DEFINER RPC `upsert_prism_snapshot(...)`** (`search_path = public, pg_temp`):
    - **role 게이트 = service_role 단독** (omxy R1 HIGH-4: EXECUTE가 service_role only이므로 `or is_admin` 분기는 도달 불가 죽은 코드 — 제거). revoke 후 service_role EXECUTE only.
    - 전 파라미터 typed-error fail-closed(jsonb_typeof·regex-선행 캐스트·enum CHECK 사전 검증) + `pg_column_size` 8MB 캡.
    - **원자 단조 가드 (omxy R1 HIGH-5)**: 사전 SELECT 금지 — `INSERT ... ON CONFLICT (market, snapshot_date, snapshot_slot) DO UPDATE ... WHERE excluded.generated_at >= prism_snapshot.generated_at` 단일 문. stale 재전송은 조건 불충족으로 무변경, 반환값으로 `inserted|updated|stale_rejected|unchanged_noop` typed 결과. **동일 `payload_sha256` 재전송 = `unchanged_noop`**(미 거래일 재실행·재시도 멱등).
  - **PG smoke (docker-free 선례)**: happy path + slot 분리 보존 + stale_rejected + unchanged_noop + **authenticated/anon EXECUTE denied** + 테이블 직접 DML denied + rollback preflight + **benchmark_meta 불변식 6종 (omxy R6 HIGH-1): ① 첫 snapshot과 meta 원자 생성 ② 재ingest가 meta 미갱신 ③ 시장별 1행 ④ authenticated/anon DML·EXECUTE 차단 ⑤ admin SELECT 허용 ⑥ anchored FK 삭제 차단(ON DELETE RESTRICT)**.
- **보존 정책 (§14-2 확정 + omxy R4 HIGH-1)**: 전량 보존 90일 + 이후 **월말 마지막 pm/daily 스냅샷만 장기 보존**. **예외: 시장별 최초 스냅샷 행(benchmark anchor)은 월말 여부 무관 영구 보존** — 삭제 시 `benchmark_start_date`가 앞으로 이동해 비교 결과가 시변(anchor 불변성). v1은 정책 문서화만(자동 정리 스크립트는 후속 — 수동 삭제 runbook에 anchor 예외 명시). **payload 4MB 초과 시 ingest 경고 로그** (omxy R1 MED-3).

## §6 ingest 스크립트 (EC2 상주, 신규 자작)

- **형태 확정 (§14-1)**: **Python 3 stdlib 단일 파일** `scripts/prism_ingest.py` (omxy 권고 수용 — EC2에 Python 상존, tsx는 node_modules 필요로 부적합). 의존성 0(urllib + json + hashlib). tudal 레포에 보관, EC2에는 파일+env만 배포.
- **동작**: JSON 읽기 → **freshness/안정성 검증 (omxy R1 MED-2: 업스트림은 temp+rename 아닌 직접 overwrite)**: ① mtime이 30초 이상 경과(쓰기 완료 대기) ② mtime이 6시간 이내(전일 stale 방지) ③ 2초 간격 2회 크기 동일 확인 → 구조 envelope 검증(필수 top-level 키 존재 + 크기 상한 + **market 교차검증 concrete 규칙(omxy R3 MED-3): `us` ⇒ `payload.market==='US' && currency==='USD'` / `kr` ⇒ `market` absent|'KR' && `currency` absent|'KRW'** — 파일 경로/CLI market 스왑 차단) → sha256 계산 → `upsert_prism_snapshot` RPC(REST) 호출 → typed 결과 로그. 실패/`stale_rejected` = **exit 1 + stderr 구조화 로그**, 선택적 **Telegram 직접 발송**(EC2 env `PRISM_ALERT_TELEGRAM_*` — tudal 무접촉).
- **게이트**: `PRISM_INGEST_CONFIRM=1` boot 게이트(fail-closed) + `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` + `PRISM_SOURCE_COMMIT`. `@/lib/supabase/service-role` import 금지 경계는 Python이므로 자연 충족.
- **스케줄**: EC2 crontab — KR 11:20/17:25(slot am/pm), US 08:15(slot daily). JSON 생성(11:05/17:10/08:00) +15분.
- **실패 가시화 (§14-5 확정)**: `pipeline_health` **미사용**(I-P4). ① UI stale 배지(§7) — **고정 age 임계 금지 (omxy R2 HIGH-1: KR 금 pm→월 am 66h·US 토→화 72h 정상 주말 오탐)** → **단일 알고리즘 고정 (omxy R3 MED-4): latest snapshot의 슬롯 시각 이후 "첫 예정 슬롯"을 주말 skip하며 walk-forward로 구해, 그 시각 + grace 12h 초과 시에만 stale**. KR 공휴일은 grace로 흡수(배지는 informational). **DoD 테스트: 금 pm→월 am 경계 / 토 daily→화 daily 경계 / KR am 누락 후 pm 성공 3케이스 필수**. ② ingest exit 1 + EC2 cron 메일/Telegram. 전용 health 테이블은 v1 미도입(스냅샷 자체가 heartbeat).

## §7 UI — `/admin/prism` "프리즘 (실험)"

- **네비**: `admin-nav.ts` "실험·연구" collapsible 그룹에 추가 (D35 위계 — R&D 화면. 은어 0, 한글 라벨).
- **파싱 규율 (omxy R1 MED-4)**: 단일 전문 zod 금지 — **envelope(최상위 키·market)만 fail-closed**, 이하 **뷰별 섹션 safeParse + `SectionFallback`**(report-section-schemas / transformStockReportRow 선례). optional drift 1건이 전체 6뷰를 죽이지 않게 격리. 크기 상한(.max) 포함.
- **슬롯 조회 계약 (omxy R2 HIGH-2)**: ① 현재 상태(대시보드·보유·관심종목·인사이트) = **시장별 최신 `generated_at` 스냅샷 1건**. ② 역사·비교 시계열 = **KR은 pm 슬롯만 / US는 daily만** (일중 중복 차단). ③ 해당일 KR pm 부재 시 am을 fallback으로 사용하되 데이터 포인트에 `slot: 'am'` 대체 표기. 전 화면 동일 계약 — `admin-prism.ts`에 단일 selector 헬퍼로 고정.
- **조회 비용 계약 (omxy R4 HIGH-2)**: 역사/비교 selector는 **`market, snapshot_date, snapshot_slot, market_session_date, terminal_performance`만 SELECT** — payload 전문 다건 SELECT **금지**(90일×2~8MB 전송·파싱 폭탄). payload 전문 읽기는 "현재 상태" 조회(최신 1건)에서만 허용. **금지 계약을 테스트로 박제**(selector가 payload 컬럼을 요구하지 않음 assert).
- **권한·상태 계약 (omxy R2 MED-5)**: RLS deny는 빈 배열로 위장되므로 data layer에서 **명시 `is_admin` fail-closed 게이트**([[feedback_rls_cost_select_isadmin_gate]] 선례) + 각 라우트 loading/error/empty 3-상태 명시 + `layout-nav-invariant.test.ts` nav 항목 갱신 = **Phase 3 DoD 포함**.
- **뷰 구성**:
  1. `/admin/prism` **대시보드** — 시뮬레이터 성과 요약·벤치마크 대비 차트·보유 표. KR/US 토글. **stale 배지**.
  2. `/admin/prism/holdings` **AI 보유 분석** — holding_decisions(현재 0건 — 빈 상태 + zod optional 방어).
  3. `/admin/prism/trades` **거래 내역** — 통계 + 건별 카드(AI 근거 확장). 페이지네이션.
  4. `/admin/prism/watchlist` **관심 종목** — 후보 카드(점수·Skip 사유).
  5. `/admin/prism/insights` **인사이트** — 트리거 신뢰도·원칙·저널·직관.
  6. `/admin/prism/compare` **주픽 vs 프리즘 비교** (§8).
- **지표 규율 (omxy R1 HIGH-6)**: JSON에 MDD·Sharpe **precomputed 필드 없음**(원본 UI의 클라 계산) → v1은 **precomputed 지표만 표시**(누적수익률·승률·PF·평균 수익/손실·보유일). MDD/Sharpe 등 파생 재계산은 v1 제외 — 도입 시 "주픽 자체 계산" 라벨 필수(원본 수치 사칭 금지).
- **제외**: 원본 "🧪 실험실(전인구)" 탭 — payload 내 `jeoningu_lab`은 **raw 저장되나 UI 미구현** (§14-3 확정).
- 전부 read-only 서버 컴포넌트(`force-dynamic`) + `src/lib/data/admin-prism.ts` 데이터 레이어.

## §8 비교 뷰 규율

- **forward 비교 기준일 (omxy R3 HIGH-1 + R4 H1/M1)**: PRISM `prism_performance`는 사이드카 가동 전(2025~)의 upstream 전체 시즌 이력을 포함 — 그대로 그리면 forward 비교가 아니라 과거 성과 혼입. **PRISM 측 시작일 = `prism_benchmark_meta.benchmark_session_date`(불변 SoT, §5)**. **KR `benchmark_start_date` = max(meta.benchmark_session_date[kr], 주픽 첫 유효 portfolio_snapshot date)** — 두 불변 입력의 max(omxy R5 MED-3 정정: PRISM 최초일만 meta 파생, KR 최종일은 max 결합). **US `benchmark_start_date` = meta.benchmark_session_date[us]**(주픽 US 트랙 부재 — omxy R4 MED-1). 그 이전 PRISM 데이터는 비교 차트에서 제외. baseline subtraction 허용하되 **"기간 정렬용 변환, 원본 재계산 아님" 라벨 필수**. (upstream 과거 이력은 비교 축과 분리된 참고 섹션만.)
- **시계열 추출 계약 (omxy R3 HIGH-2 + R4 HIGH-2)**: 각 payload의 `prism_performance`는 누적 전체 배열 → **최신 payload 하나의 과거 배열 사용 금지**(사후 수정·look-ahead 검출 불가). 비교 시계열 관측치 = **각 아카이브 스냅샷의 `terminal_performance` 컬럼**(ingest 시점에 자기 `market_session_date` 이하 마지막 precomputed point 1개를 추출·박제, 스냅샷당 1 관측치) — forward 무결성 + 조회 비용 동시 해결. RPC의 `terminal_performance` 검증 = §5 shape 계약과 동일(최소 3필드·ISO date·finite number, NULL이면 검증 생략 — omxy R6 MED-1 모순 해소); 값 재계산은 없음.
- **주픽 측 데이터 소스 (§14-4 확정)**: KR = `portfolio_snapshot`(가상 포트) 시계열. **단위 변환 명시 (omxy R1 HIGH-7): 주픽 수익률 = fractional(소수), 프리즘 = percent — 변환 헬퍼 단일화 + 단위 테스트 필수**(100배 오류 차단).
- **US = 프리즘 단독 표시** (주픽 US 트랙 부재 — "주픽 비교 대상 없음" 명시). ⚠️ USER-decision 항목: 주픽 US 트랙 신설 여부는 본 트랙 범위 밖, 원하면 별도 결정.
- **픽 오버랩 정의 (omxy R1 HIGH-8 + R2 MED-3)**: 프리즘 픽 = **시뮬레이터 실제 진입 종목**(trading_history + 현재 holdings; watchlist 후보 아님). 주픽 cohort: `short_list_30`에 period_key가 없고 단기 주간·중장기 월간이 혼재하므로 **v1 = 기존 `getActiveShortList()` 계약(최신 month의 현재 저장 30행)을 그대로 사용** (omxy R4 MED-3: "bucket별 최신 created_at 배치"는 행별 timestamp 상이로 결정적 그룹화 불가 — 기존 헬퍼 재사용이 유일하게 구현 가능·정합). 교집합 라벨 = "현재 활성 30 기준". 과거 사이클 귀속은 v1 범위 밖.
- **면책 고정 문구**: ① 호라이즌 상이(프리즘 ~5일 스윙+장중 / 주픽 주간·월간) — "상이한 방법론의 참고 병렬 비교" 라벨, 우열 단정 금지. ② 프리즘 수치 = 외부 엔진 산출물 그대로(precomputed 우선, 재계산 시 별도 라벨). ③ "정보 제공, 투자 자문 아님" Footer. ④ 통계적 우열 claim은 forward 축적 전 금지(D30 규율 정합).

## §9 운영·비용

| 항목 | 월 비용 | 비고 |
|---|---|---|
| EC2 t3.large + EBS 30GB | ~$64–79 | t3.medium 절약 옵션 ~$40 |
| OpenAI | ₩0 | ChatGPT 구독 프록시 + 쿼터 healthcheck cron |
| Perplexity | §10 | 권장 A: 직접 키(당 규모 ~$5–15 추정) |
| Firecrawl | ~$19 이하 | 무료 티어부터 가능 |
| Anthropic | ₩0 | 코어 배치 미사용(텔레그램 봇 전용 — OFF) |

- **hardcap 50만원과 별도 회계**(cost_log 미기록) — USER 확인 항목.

## §10 Perplexity — OpenRouter 대체 불가 판정 (실측 2026-07-15)

- 원본은 공식 `@perplexity-ai/mcp-server`로 api.perplexity.ai 직결. `PERPLEXITY_BASE_URL` override는 존재하나 **OpenRouter로 못 돌린다**: ① `perplexity_search` 툴이 쓰는 Perplexity 전용 Search API가 OpenRouter에 없음 ② 모델 슬러그 불일치(`sonar-pro` vs `perplexity/sonar-pro`).
- **옵션**: (A) 직접 키 발급(권장 — Pro 구독자는 월 $5 API 크레딧 포함 가능성 확인) / (B) 미장착 시작(구동 확인됨, 뉴스 리서치 품질 저하) / (C) 변환 프록시 자작(비권장). **기본값 = A**, 키 발급 전 B 가동 가능.

## §11 빌드 순서 + 역할 분담

| Phase | 내용 | 산출물 | 오너 |
|---|---|---|---|
| 0 (선택) | 로컬 Docker 1~2일 가동 검증 | 검증 로그 | Claude 가이드 + USER 키 |
| 1 | EC2 + Docker(override 포함) + OAuth 이전 + cron | 러닝 사이드카 | **USER** + Claude 체크리스트 |
| 2 | 마이그 0051 + `prism_ingest.py` + **`test_prism_ingest.py`(python3 -m unittest, stdlib — freshness/market 교차검증/terminal 추출/HTTP 오류/confirm 게이트 커버, omxy R5 HIGH-2)** + PG smoke | 코드 + unittest + smoke PASS | **omxy 구현** → Claude 검토 |
| 3 | `admin-prism.ts` + zod 섹션 스키마 + 6뷰 + nav + 비교 | 코드 + 게이트 GREEN | **omxy 구현** → Claude 검토 |
| 4 | E2E(실 스냅샷→UI→비교) + 문서 sync | 검증 기록 | Claude + USER canary |

- 게이트: build+lint+test:ci+tsc+PG smoke+**`python3 -m unittest scripts/test_prism_ingest.py`**(omxy R5 HIGH-2). 머지 책임 = Claude. 마이그 apply·EC2·키 = USER-only.

## §12 USER-only 체크리스트

1. EC2 생성(outbound only) + Docker.
2. KRX 마켓플레이스 계정(ID/PW).
3. ChatGPT OAuth 로그인 1회 + 토큰 EC2 복사.
4. Perplexity 키(A 선택 시) + Firecrawl 키.
5. KIS 모의투자 키 — demo 모드, `auto_trading: false`.
6. `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/`PRISM_SOURCE_COMMIT`/`PRISM_INGEST_CONFIRM=1`/**`PRISM_OPENAI_AUTH_MODE=chatgpt_oauth`** EC2 주입.
7. 마이그 0051 production apply.
8. hardcap 별도 회계 승인.
9. (3·11월) US 크론 DST 조정.

## §13 리스크

| 리스크 | 심각도 | 대응 |
|---|---|---|
| 업스트림 스키마 drift | MED | **pin `b8171a4` 고정 배포** + 의도적 pull 시 contract_version 재검증 + envelope fail-closed + provenance(source_commit·payload_sha256) 저장 |
| 부분/stale JSON ingest | MED | mtime·크기 안정성·freshness 3중 검증(§6) + RPC 단조 가드 + UI stale 배지 |
| OAuth 토큰 소실/쿼터 | MED | 볼륨 마운트 + healthcheck cron + 429 알림 |
| KRX 로그인 깨짐 | MED | FinanceDataReader fallback + 업스트림 추적 |
| US watchlist 누적 → cap | MED | 4MB 경고(§5) + 보존 정책 + 임계 도달 시 정책 재결정 |
| US DST 수동 조정 누락 | LOW | §12-9 체크리스트 |
| 비교 오독(호라이즌·단위) | MED | §8 면책 + 단위 변환 헬퍼 단일화 + 단위 테스트 |

## §14 Open Questions — 해소 현황

1. ~~ingest 형태~~ → **Python stdlib 단일 파일** (R1 확정).
2. ~~보존 정책~~ → **90일 전량 + 월말본 장기** (R1 확정, 자동화는 후속).
3. ~~_en/jeoningu_lab~~ → **_en 미생성·미ingest / jeoningu raw 저장·UI 제외** (R1 확정).
4. ~~비교 주픽측 소스~~ → **KR=portfolio_snapshot(단위 변환) / US=프리즘 단독** (R1 확정; 주픽 US 트랙 신설은 USER-decision으로 잔존).
5. ~~실패 가시화~~ → **UI stale 배지 + ingest exit 1 + 선택적 EC2 Telegram, pipeline_health 미사용** (R1 확정).
