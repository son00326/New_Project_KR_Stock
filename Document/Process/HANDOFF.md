# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-20 (23차 후속 정정 — **Mock Skeleton Stage 1 완료**, MVP 아님)

**목적**: 다음 세션이 이 파일 하나만 보고 즉시 이어갈 수 있게 하는 단일 진입점.
**원칙**: 미래 지향. "다음에 무엇을 할지"와 "아직 무엇이 결정 안 났는지"만 담는다.

> **⚡ 진입**: "@HANDOFF.md 보고 이어서 작업해줘" → §1 현재 상태 확인 → §2 진입 결정 트리 따라 착수. 세부 Entry routine은 `CLAUDE.md` 참조.

---

## §0 용어 정의 (중요 — 매 세션 시작 시 확인)

| 단계 | 정의 | 현재 상태 |
|---|---|---|
| **Mock Skeleton** | UI·라우트·타입·DB 스키마·순수 로직이 mock fixture로 동작. 외부 API·실 AI 호출 없음. | ✅ **Stage 1 완료** (S0~S6) |
| **실데이터 연결** | Supabase 실 SELECT/INSERT + 외부 API(KIS·DART·pykrx·Naver·Resend·Telegram) + Anthropic 실 호출 | ⚪ **0 / 19 Must 연결** |
| **실 운용 검증** | 어드민 3인이 실제 월/일 루틴을 실행해 1개월+ 검증 | ⚪ **0일 운용** |
| **MVP Stage 1** | Mock Skeleton + 실데이터 연결 + 실 운용 검증 **3가지 모두 통과** | ❌ **미달성** |

**🚫 금지 어휘**: "MVP 완료" · "Stage 1 완료(단독)" · "100% 완성" · "🎉 완료"
**✅ 권장 어휘**: "Mock Skeleton 완료" · "Mock 동작 19/19" · "실데이터 0/19" · "운용 0일"

---

## §1 현재 상태 (2026-04-20 기준)

- **Mock Skeleton**: S0~S6 완료 · Must 19 mock 동작 · 실제 누적 **9세션**
- **실데이터 연결**: **0 / 19** (모두 mock fixture)
- **실 AI 호출**: **0** (Anthropic wrapper · cost_log 실 INSERT 0)
- **실 운용 검증**: **0일**
- **법무·이용약관**: **0 / 2** (Q16·Q17 미처리)
- **Git**: working tree clean · 최신 `77ef624` · **origin/main 동기화 완료** (2026-04-20)
- **검증 게이트**: build 22 routes · lint 0 · test:ci **190 pass** (모두 Mock 기반)

---

## §2 다음 세션 진입 결정 트리

```
진입 시 이 순서로 확인:

(1) §3 "사용자 답변 필요 (DQ)" 중 **해소된 게 있는가?**
    → 있음: 해당 DQ의 "해소 시 첫 행동"으로 착수
    → 없음: (2)로

(2) §4 "블로커·크리티컬 (BL-KRIT)" 중 **해소된 게 있는가?**
    → 있음: 해당 BL-KRIT의 "해소 시 첫 행동"으로 착수
    → 없음: (3)로

(3) §5 "자율 진행 가능 작업 (AUTO)" 중 맨 위 항목부터 착수
    (이 작업은 결정 없이 Claude가 바로 수행할 수 있는 것만 담는다)

(4) 위 3단계 모두 없으면 §3 DQ 중 우선순위 1번을 사용자에게 다시 질문
```

---

## §3 사용자 답변 필요 (DQ — Decision Queue)

> **원칙**: 사용자 결정 없이는 Claude가 진행 불가. 우선순위 순.

### DQ-1 🔴 실데이터 전환 로드맵 착수 시점
**질문**: Mock Skeleton 9세션으로 끝냈는데, 실데이터 전환 슬라이스(S7 가칭)를 **지금 착수**할지, **법무·약관 선행(§DQ-3·DQ-4) 이후**에 착수할지?
**옵션**:
- (a) 지금 바로 실데이터 전환 착수 (S7a Anthropic wrapper + cost_log 실 INSERT부터)
- (b) 법무·약관 먼저 확정 후 실데이터 착수
- (c) 일단 origin push + Supabase anon 갱신만 하고 실데이터는 다음 주
**해소 시 첫 행동**: 해당 옵션에 따라 §6 또는 §7로 분기

### DQ-2 🔴 AI Agent 실행 체제 확정
**질문**: 리포트·브리핑·뉴스 분류에 쓰는 AI 호출 체제를 어떻게 잡을지?
- (a) Anthropic SDK 직접 호출 + prompt cache (CLAUDE.md 기본선)
- (b) **Agent SDK** / Managed Agents 기반 다중 에이전트 구성
- (c) Claude Code의 Task/Agent 러너로 호출 (개발 단계에서만)
- (d) LangChain·LlamaIndex 같은 외부 프레임 경유
**제약**: Must 17(AI 비용 실시간 모니터링)이 Anthropic `/messages` usage 실시간 파싱(BL-16=A)으로 이미 박제됨. 즉 wrapper 1층은 필수.
**해소 시 첫 행동**: `src/lib/ai/` 하위 wrapper 설계 → S7a에서 구현

### DQ-3 🟡 Q16 법무 자문 (투자자문업 경계)
**질문**: 500cap 초대 + 본인 자금 운용이라도 법무 자문 필요 여부·타이밍
**해소 시 첫 행동**: ServicePlan-Admin §법적 제약 갱신 + BusinessPlan.md §7 추가 박제

### DQ-4 🟡 Q17 이용약관·개인정보처리방침·면책
**질문**: 초대 500명에 대한 이용약관·개인정보처리방침·투자 면책 문구(Footer 이상) 작성 담당·타이밍
**해소 시 첫 행동**: `/legal/*` 라우트 신설 + Footer 링크 연결

### DQ-5 🟡 Supabase anon key 갱신 (`/admin` QA 블로커)
**질문**: 22차 종료 시 `Invalid API key` 발견. https://supabase.com/dashboard/project/fpriyjykihxhhvqudvdb/settings/api 에서 `anon public` 복사 → `.env.local` 교체 필요. 본인이 처리 or Claude에 키 전달?
**해소 시 첫 행동**: `.env.local` 교체 + `npm run dev` 후 Login·Magic Link 실제 브라우저 QA

### ~~DQ-6~~ ✅ origin push 완료 (2026-04-20, 23차 후속)
`b762313..77ef624 main -> main` (18 commits 동기화). Repo = `https://github.com/son00326/New_Project_KR_Stock.git`. 이후 세션에서는 commit당 push 가능.

### DQ-7 🟡 Vercel 배포 환경변수 세팅 계획
**질문**: 실 배포 언제? 세팅 필요 키 — `CRON_SECRET` · `RESEND_API_KEY` · `TELEGRAM_BOT_TOKEN`/`CHAT_ID` · `KIS_APP_KEY`/`SECRET` · `NAVER_CLIENT_ID`/`SECRET` · `ANTHROPIC_API_KEY`
**해소 시 첫 행동**: Vercel 프로젝트 생성 + 환경변수 입력 + 첫 프리뷰 배포

### DQ-8 🟢 멤버 페이지 Research (Deferred-D 블로커)
**질문**: 500cap 멤버 UX 설계 전 필요한 경쟁사 리서치 범위·시점
**해소 시 첫 행동**: `ServicePlan-Member.md` Research 블로커 해소

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

### BL-KRIT-3 Naver News API 키
- 소스: DQ-7
- 영향: M12 뉴스 sweep 실 동작 불가 (네이버 뉴스 API + 스크래핑 하이브리드 BL-13=확정)
- 해소: Naver Developers 앱 등록 + `NAVER_CLIENT_ID`/`SECRET` 발급

### BL-KRIT-4 Resend (이메일) 계정
- 소스: DQ-7
- 영향: M11 모닝 브리핑 · D10 catch-up 이메일 발송 불가
- 해소: Resend 계정 + 도메인 인증 + `RESEND_API_KEY`

### BL-KRIT-5 Telegram Bot
- 소스: DQ-7
- 영향: M13·M15 텔레그램 2채널 실 발송 불가
- 해소: BotFather로 bot 생성 + `TELEGRAM_BOT_TOKEN`/`CHAT_ID`

### BL-KRIT-6 Supabase anon 갱신
- 소스: DQ-5
- 영향: `/admin` 브라우저 QA 불가
- 해소: `.env.local` 교체

### BL-KRIT-7 alert_event CHECK constraint 확장
- 소스: 코드
- 영향: 실 INSERT 시 새 AlertType(`news_warning`·`briefing_failed`·`intraday_anomaly`·`cost_warning`·`cost_hardcap`·`heartbeat_missing`) 삽입 거부됨
- 해소: 신규 마이그레이션 0009로 CHECK 재정의

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

### AUTO-4 슬라이스 파일 S7 스켈레톤 생성 (사용자 DQ-1 결정 후 실 내용 채움)
- `Document/Build/Slices/S7-RealData.md` placeholder (템플릿만, 미완성 표기)

### AUTO-5 Global Blocker 대시보드에 BL-KRIT-1~7 추가
- `ProgressDashboard.md` §5에 신규 "실데이터 전환 BL-KRIT" 섹션

---

## §6 실데이터 전환 로드맵 (DQ-1 = a 채택 시 이 경로로)

> Mock Skeleton이 이미 끝났으므로 실데이터 연결은 **기능 단위가 아니라 외부 의존성 단위로 묶어 비용 영향 큰 순서**로 진행.

| ID | 이름 | 포함 Must | 외부 의존 | 예상 세션 | 선행 BL-KRIT |
|---|---|---|---|---|---|
| **S7a** | Anthropic wrapper + cost_log 실 INSERT | M17 | Anthropic | 1 | BL-KRIT-1 |
| **S7b** | 뉴스 + 브리핑 실 연결 | M11·M12 | Naver · Resend · Anthropic | 2 | BL-KRIT-1·3·4 |
| **S7c** | 장중 + Exit 2채널 실 연결 | M13·M14·M15 | KIS WebSocket · Telegram · Resend | 2 | BL-KRIT-2·4·5 |
| **S7d** | Silent Health 실 INSERT + override UI | M18·M19 + BL-17 B | Supabase · Telegram · Resend | 1 | BL-KRIT-4·5 |
| **S7e** | Supabase 실 SELECT/INSERT 전면 전환 | M1·M4·M5·M6·M7·M8·M9·M16 | Supabase | 2 | BL-KRIT-6 + 0009 migration |
| **S7f** | 한 달 운용 검증 + 버그 수정 | 전체 | — | 4~8주 (세션 단위 아님) | S7a~e 완료 |

**총 예상**: 8 세션 + 4~8주 운용 = 진짜 MVP Stage 1 완료 기준

---

## §7 선행 트랙 (DQ-1 = b 채택 시)

1. DQ-3 Q16 법무 자문 착수
2. DQ-4 Q17 이용약관·면책 작성
3. 위 2개 통과 후 §6로 진입

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

## §9 미완료 체크리스트 (진짜 MVP Stage 1까지)

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
- [ ] 법무 0 / 2 (Q16 자문 · Q17 약관)
- [ ] 어드민 운용 검증 0일 (목표 1개월+)
- [x] origin push ✅ (2026-04-20, 77ef624까지 동기화)

---

## §10 보류 트랙 (Must 19 밖 로드맵)

- **Deferred-X** 증권사 API + 매뉴얼/자동매매 UI → `Document/Build/Slices/Deferred-Brokerage.md`
- **Deferred-Y** AI Agent 기반 선정엔진 v2 → `Document/Build/Slices/Deferred-AIAgent-Selection.md` (v0 mock ✅ → v1 pykrx+v6 ⚪ → v2 AI agent ⚪)
- **Deferred-D Member** 페이지 → `Document/Service/Planning/ServicePlan-Member.md` (Research 블로커 DQ-8)

---

## §11 문서 가이드

| 용도 | 문서 |
|---|---|
| 전체 슬라이스 상태 | `Document/Build/ProgressDashboard.md` |
| 직전 슬라이스 상세 | `Document/Build/Slices/S6-Hardening.md` |
| 개발 방법론 | `Document/Process/ExecutionPlaybook.md` |
| 기획 SoT (어드민) | `Document/Service/Planning/ServicePlan-Admin.md` v1.3 |
| 기획 SoT (멤버) | `Document/Service/Planning/ServicePlan-Member.md` |
| 리포트 방법론 | `Document/Service/Report/ReportFramework.md` |
| 사업 SoT | `Document/Business/BusinessPlan.md` |
| 코드 스냅샷 | `Document/Process/CodebaseStatus.md` |
| 기획 이력 | `Document/Archive/Phase.md` (참조만, 편집 금지) |

---

## §12 최근 세션 (이전은 `git log`)

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
