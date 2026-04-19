# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-20 (23차 — 🎉 **MVP Stage 1 완료 · Must 19/19 (100%) 달성**)

**목적**: 다음 세션이 "**다음에 무엇을 할지**"만 빠르게 파악.
**원칙**: 미래 지향. 포인터·다음 단계만. 상세는 각 슬라이스 파일이 담당.

> **⚡ 진입**: "@HANDOFF.md 보고 이어서 작업해줘" → 🟢 현재 슬라이스부터 착수. Entry routine은 `CLAUDE.md` 참조.

---

## 🎉 MVP Stage 1 완료 마감 (2026-04-20, 23차)

S0~S6 전체 ✅ 완료. **Must 19/19 (100%)**. 실제 누적 **9세션** (예상 25 대비 **36%**).

### 다음 세션이 선택할 트랙 (사용자 결정 대기)

기획상 Must 19를 모두 mock으로 만족했다. 다음으로 가능한 트랙은 셋 중 하나:

#### A. **실데이터 전환 트랙** (권장)
S0~S6에서 박제된 **`TODO(S5)` · `TODO(S6 M17)` · mock-mode 분기**를 실 Supabase / 실 외부 API로 교체. 흩어진 이월 ~20건을 슬라이스별로 정리 후 1~2 슬라이스로 끊어서 진행.

핵심 이월 (실데이터 전환 대상):
- **S5a**: pipeline_health · news_event · briefing_log · briefing_view_event 실 INSERT
- **S5b**: admin_settings · ticker_alert_pref · intraday_anomaly_event 실 INSERT/UPDATE + KIS WebSocket 실 구독
- **S6**: cost_log 실 INSERT (Anthropic `/messages` wrapper) + heartbeat_log 실 INSERT + override 토글 UI(BL-17 B 대표 1인)
- **공통**: `alert_event` check constraint 확장(news_warning·briefing_failed·intraday_anomaly·cost_warning·cost_hardcap·heartbeat_missing)
- **env**: `RESEND_API_KEY` · `TELEGRAM_BOT_TOKEN`/`CHAT_ID` · `KIS_APP_KEY`/`SECRET` · `NAVER_CLIENT_ID`/`SECRET` · `CRON_SECRET`

#### B. **AI Agent 선정엔진 v2 트랙** (Deferred-Y)
v0(mock) → v1(pykrx + v6 backtest) → **v2 (AI agent 기반)** 진화. Must 19 외 별도 트랙. `Document/Build/Slices/Deferred-AIAgent-Selection.md` 참조.

#### C. **증권사 API + 매뉴얼/자동매매 UI** (Deferred-X)
3경로 집행(주픽 매뉴얼 · 주픽 자동매매 · 외부 바이패스). `Document/Build/Slices/Deferred-Brokerage.md` 참조.

#### D. **멤버 페이지 트랙**
500cap 초대 멤버 UX. `Document/Service/Planning/ServicePlan-Member.md` Research 보강 블로커 선행 필요.

### ⚠️ 즉시 처리 필요 (트랙 무관)

1. **Supabase anon key 갱신** (BLOCKER for `/admin` 브라우저 QA) — 22차 종료 시 발견된 `Invalid API key`. https://supabase.com/dashboard/project/fpriyjykihxhhvqudvdb/settings/api 에서 `anon public`/`Publishable key` 복사 → `.env.local` 교체. Login + Magic Link 동작 확인.
2. **Vercel 배포 환경 변수 세팅** — 실 배포 전 `CRON_SECRET`·이메일/텔/뉴스 키. 배포 플랫폼 = Vercel 확정(BL-15).
3. **법무 자문(Q16)·이용약관·면책(Q17)** — Stage 1 완료 시점부터 처리 가능.

### 🚀 다음 세션 첫 행동 후보

```
사용자가 트랙 선택 (A·B·C·D 중 하나) →
A 선택 시:
  1. 실데이터 전환 슬라이스 파일 신설 (S7 또는 S5-Real / S6-Real)
  2. 우선순위 매트릭스: 외부 API 비용 영향 큰 것부터 (M17 cost_log → M11 briefing → M12 news → M13 intraday)
  3. 슬라이스별 env 키 확보 + Supabase migration 정합성 검증

B/C 선택 시:
  → 해당 Deferred 슬라이스 파일 읽고 새 슬라이스 킥오프

D 선택 시:
  → ServicePlan-Member.md Research 블로커부터 해소
```

---

## ✅ 완료 슬라이스

### S6 Hardening (AI 비용 + Silent Health) ✅ (2026-04-20, 23차 · 실제 1세션)

**달성 Must**: M17·M19 (2건 · 누적 19/19 = **100%** 🎉)
**주요 산출**:
- `tudal/supabase/migrations/0008_s6_hardening.sql` — cost_log 확장(ticker·persona_id·section + month_purpose·persona_month 인덱스 2종) + heartbeat_log(date UNIQUE · status check + RLS)
- `tudal/src/lib/cost/anthropic-pricing.ts` — Opus 4.7/Sonnet 4.6/Haiku 4.5 단가 + USD→KRW 환산(1430)
- `tudal/src/lib/cost/dry-run-estimate.ts` — BL-18 견적 박제. BASE_WORKLOAD 가정 + estimateMonthlyCost + buildDryRunReport(low/base/worst 시나리오 + verdict safe/tight/over)
- `tudal/src/lib/cost/aggregate.ts` — aggregateMonthlyCost(월간 SUM·purpose 비중·Top 5 기여) + isHardcapBlocked(40만 가드)
- `tudal/src/lib/health/heartbeat.ts` — classifyHeartbeat(파이프라인 critical 1건 또는 Critical 알림 1건 또는 Warning 5건 → red_alert) + buildHeartbeatMessage + D10 catch-up · heartbeat_missing 페이로드
- `tudal/src/app/(admin)/admin/settings/cost/page.tsx` — M17 대시보드(35만 경보·40만 hardcap·Purpose 비중·Top 5·BL-18 시나리오 비교·시연 영역 2026-03 경보·2026-02 hardcap)
- `tudal/src/app/api/cron/silent-health/route.ts` — Vercel Cron 매일 24:00 KST · 텔+이메일 2채널 · D10 이메일 1회 재시도 · heartbeat_missing AlertEvent 적재
- `tudal/vercel.json` — crons 4건으로 확장
- `tudal/src/app/(admin)/layout.tsx` — Sidebar nav에 "AI 비용 (M17)"·"Health (M18)" 노출
- `tudal/src/app/(admin)/admin/report/[ticker]/regenerate/actions.ts` — isHardcapBlocked 가드 활성 (S4 stub → 실 활성화, mock cost_log 사용)
- `tudal/src/types/admin.ts` — AlertType +cost_warning·cost_hardcap·heartbeat_missing · CostLog·CostMonthlySummary·CostPurpose·HeartbeatLog·HeartbeatStatus · 임계치 상수 5종(WARNING 350k·HARDCAP 400k·USD_TO_KRW 1430·HEARTBEAT_RED_ALERT 임계 2)
- `tudal/src/lib/data/{mock-admin-cost-log.ts·mock-admin-heartbeat.ts}` 신설 (4월 mock 운용 + 3월/2월 stress test seed + 7일 heartbeat 이력 6 ok + 1 red_alert)
- Vitest 3 files: aggregate(11) + dry-run-estimate(11) + heartbeat(10) = 32 tests 추가

**의사결정 (22차 후속, 23차)**:
- BL-16 = **A** (Anthropic `/messages` 응답 usage 실시간 파싱 + per-persona·per-section 태깅) — Next.js 친화·즉시성
- BL-17 = **B** (override 권한 = 대표 1인) — 비용 통제 책임 단일화
- BL-18 = **B** (견적 임계치 — 실 API dry-run 미실시, dry-run-estimate.ts 박제) — verdict safe·tight 영역 확인 후 진입
- G-3 = **B** (cost_log·heartbeat_log 슬라이스 인라인 정의) — S5와 동일 패턴

**비블로킹 이월 (실데이터 전환 시)**:
1. cost_log 실 INSERT — Anthropic `/messages` 호출 wrapper에서 응답 usage 파싱 후 INSERT
2. heartbeat_log 실 INSERT — `/api/cron/silent-health` mock-mode 분기 → 실 Supabase
3. override 토글 UI — `ADMIN_OVERRIDE_EMAIL` env 분기 + 토글 시 일시 hardcap 해제 Server Action
4. 실 API dry-run — Anthropic 키 확보 후 30종 × Section 0~8 1회 실측, base 가정 vs 실측 비교 → 임계치 재조정
5. heartbeat 발송 시간 — 현재 15:00 UTC = 24:00 KST. 정확 자정 명시 시 14:00 UTC로 1시간 앞 검토
6. Critical AlertEvent 24h 카운트 — 실 Supabase에서는 `signalSentAt > now() - interval '24 hours'`

**검증**: lint 0 · build 22 routes · test:ci **20 files / 190 tests pass**.

### S5b 장중·토글·Exit ✅ (2026-04-19, 22차 · 실제 1세션)

**달성 Must**: M13·M14·M15 (3건). 상세는 slice 파일.

### S5a 스케줄러·브리핑·뉴스·헬스 ✅ (2026-04-19, 21차 · 실제 1세션)

**달성 Must**: M10·M11·M12·M18 (4건). 상세는 slice 파일.

### S4 가상 포트·성과·Decision Tree ✅ (2026-04-19, 20차 · 실제 1세션)

**달성 Must**: M8·M9·M16 (3건). 상세는 slice 파일.

### S3 승인 워크플로우 (+D15) ✅ (2026-04-17, 19차 · 실제 1세션)

**달성 Must**: M7 (1건). 상세는 slice 파일.

### S2 풀 리포트 + 투심위 ✅ (2026-04-17, 18차 · 실제 1세션)

**달성 Must**: M2·M3 (2건). 상세는 slice 파일.

### S1 Short List 30 홈 ✅ (2026-04-17, 16~17차 · 실제 2세션)

**달성 Must**: M1·M4·M5·M6 (4건).

### S0 Foundation ✅ (2026-04-17, 15차)

Legacy 전면 제거 · Supabase 연결 · 8 AGENTS.md · 11 admin 라우트 · 9엔티티 RLS sketch · 한국 증시 디자인 토큰.

---

## 📊 전체 진행 상황

→ `Document/Build/ProgressDashboard.md` (주간 뷰)

| 슬라이스 | 상태 | 예상 세션 | 실제 |
|---|---|---|---|
| S0 Foundation | ✅ 완료 | 2 | 1 |
| S1 Short List 30 홈 | ✅ 완료 | 4 | 2 |
| S2 풀 리포트·투심위 | ✅ 완료 | 3 | 1 |
| S3 승인 워크플로우 | ✅ 완료 | 4 | 1 |
| S4 성과·Decision Tree | ✅ 완료 | 4 | 1 |
| S5a 스케줄러·브리핑·뉴스·헬스 | ✅ 완료 | 3 | 1 |
| S5b 장중·토글·Exit | ✅ 완료 | 2 | 1 |
| S6 Hardening | ✅ 완료 | 3 | 1 |
| **총** | **MVP Stage 1 ✅** | **25** | **9** |

Must 19 진행률: **19 / 19 (100%) 🎉**

실제 속도 = **예상의 ~36%** (S0~S6 9세션 vs 예상 25세션). 다음 트랙은 사용자 결정.

---

## 🟡 보류 / 사용자 답변 필요

- ~~**BL-3·BL-4·BL-5**~~ ✅ 해소
- ~~**[G-5]·[G-11]**~~ ✅ 해소
- ~~**BL-7·BL-19·BL-20**~~ ✅ 해소 (S3)
- ~~**[G-10]**~~ ✅ 해소 (S3, Vitest 1파일)
- ~~**[S3 hardening]**~~ ✅ 해소 (S4 T4.6 병행)
- ~~**BL-8·BL-9**~~ ✅ 해소 (S4 킥오프)
- ~~**BL-11·BL-13·BL-15**~~ ✅ 해소 (S5a 킥오프)
- ~~**[G-3]·[G-6]**~~ ✅ 해소
- ~~**BL-12·BL-14**~~ ✅ 해소 (S5b 킥오프)
- ~~**BL-16·BL-17·BL-18**~~ ✅ 해소 (S6 킥오프)
- **Q16** 법무 자문 — 처리 가능 시점 (Stage 1 완료)
- **Q17** 이용약관·면책 — 실배포 전 필수
- **Q-OP3·Q-OP4** 재질문 금지 (개발 완료 전 → 이제 다음 트랙 결정 시 재논의 가능)

## 🧭 보류 트랙 (Must 19 밖 로드맵)

- **Deferred-X** 증권사 API + 매뉴얼/자동매매 UI → `Document/Build/Slices/Deferred-Brokerage.md`
- **Deferred-Y** AI Agent 기반 선정엔진 v2 → `Document/Build/Slices/Deferred-AIAgent-Selection.md`
  - v0 (mock, S1·S2·S3 완료) → v1 (pykrx+v6 실데이터, S5 M10) → **v2 (AI agent, 본 트랙)**
- **Member Track** — `Document/Service/Planning/ServicePlan-Member.md`

---

## 📂 문서 가이드

| 용도 | 문서 |
|---|---|
| 전체 슬라이스 상태 | `Document/Build/ProgressDashboard.md` |
| 직전 슬라이스 상세 | `Document/Build/Slices/S6-Hardening.md` |
| 개발 방법론 | `Document/Process/ExecutionPlaybook.md` |
| 기획 SoT | `Document/Service/Planning/ServicePlan-Admin.md` v1.3 |
| 리포트 방법론 | `Document/Service/Report/ReportFramework.md` |
| 사업 SoT | `Document/Business/BusinessPlan.md` |
| 코드 스냅샷 | `Document/Process/CodebaseStatus.md` |
| 기획 이력 | `Document/Archive/Phase.md` (참조만, 편집 금지) |

---

## 📝 최근 세션 (이전은 `git log`)

- **2026-04-20 (23차)** **🎉 S6 ✅ 완료 · MVP Stage 1 완료 · Must 19/19 (100%)**. BL-16 A · BL-17 B · BL-18 B · G-3 B 4건 일괄 해소. 0008 마이그레이션(cost_log 확장 ticker·persona_id·section + heartbeat_log + RLS 1종) + T6.1~T6.6 직접 실행 + verification-before-completion. src/lib/cost/{anthropic-pricing,dry-run-estimate,aggregate}.ts (BL-18 견적 박제 + M17 집계 + hardcap 가드) + src/lib/health/heartbeat.ts (M19 분류·메시지·D10 catch-up·heartbeat_missing) + `/admin/settings/cost` 대시보드 + `/api/cron/silent-health` (매일 24:00 KST 텔+이메일 2채널 + D10 재시도) + Sidebar nav 확장 + Vitest 3 files 32 tests. **20 files / 190 tests pass** · build 22 routes · lint 0. 누적 9세션(예상 25 대비 36%).
- **2026-04-19 (22차)** **S5b ✅ 완료.** BL-12 폐기·BL-14 = WebSocket 해소. 0007 마이그레이션 + M13·M14·M15 + Vitest 2 files 30 tests. Must 17/19 (89%).
- **2026-04-19 (21차)** **S5a ✅ 완료.** BL-11·BL-13·BL-15 해소. M10·M11·M12·M18. Must 14/19 (74%).
- **2026-04-19 (20차)** **S4 ✅ 완료.** BL-8·BL-9 + S3 hardening 해소. M8·M9·M16. Must 10/19 (53%).
- **2026-04-17 (19차)** **S3 ✅ 완료.** Must 7/19 (37%).
- **2026-04-17 (18차)** **S2 ✅ 완료.** Must 6/19 (32%).
- **2026-04-17 (17차)** **S1 ✅ 완료.** Must 4/19 (21%).
- **2026-04-17 (15차)** S0 Foundation 완료.

---

**단일 진입 규칙**: HANDOFF + (트랙 결정 후) 새 슬라이스 파일 읽으면 즉시 착수. 배경은 ServicePlan-Admin.md 참조.
