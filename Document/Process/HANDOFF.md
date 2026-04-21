# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-21 (24차 — **어드민 내부 도구 재정의 + 자동매매 S8 승격 + Stage 어휘 폐기 반영**)

**목적**: 다음 세션이 이 파일 하나만 보고 즉시 이어갈 수 있게 하는 단일 진입점.
**원칙**: 미래 지향. "다음에 무엇을 할지"와 "아직 무엇이 결정 안 났는지"만 담는다.
**2026-04-21 프레임 변경 요약**: 어드민 = 본인+친구 3명 **투자 내부 도구**. 멤버·MVP Stage·Friends & Family 어휘는 이 파일에서 강제 게이트로 쓰지 않는다. 자동매매는 **S8 단일 슬라이스**로 통합되며 주식(KIS) + 바이낸스 선물 포함. 상세: BusinessPlan §12 2026-04-21 행 · ServicePlan-Admin §1A.5 D16 · Slices/S8-AutoTrading.md.

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

## §1 현재 상태 (2026-04-21 기준)

- **Mock Skeleton**: S0~S6 완료 · Must 19 mock 동작 · 실제 누적 **9세션**
- **실데이터 연결**: **0 / 19** (모두 mock fixture)
- **실 AI 호출**: **0** (Anthropic wrapper · cost_log 실 INSERT 0)
- **자동매매 프레임(S8)**: ⚪ **미착수** (2026-04-21 D16 승격). 구 Deferred-X는 S8로 이관·폐기.
- **실 운용 검증(S9)**: **0일**
- **법무·이용약관**: ⏸ **Deferred-D 멤버 오픈까지 유예** (2026-04-20 확정, 2026-04-21 재확인). 어드민 내부 도구는 Footer 면책으로 충분.
- **Git**: working tree clean · 최신 `782e4a8` 기반 + 2026-04-21 docs 편집 · origin/main 동기화
- **검증 게이트**: build 22 routes · lint 0 · test:ci **190 pass** (모두 Mock 기반)
- **어드민 범위**: 본인 + 친구 2명 = 3명(ADMIN_EMAILS 3명). 친구 추가는 나중 작업.

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
**2026-04-21 주석**: 어드민 내부 도구 완성 전까지 자동 유예.

### DQ-9 🟡 S8 주식 자동매매 — KIS API 계정 발급 범위
**질문**: KIS OpenAPI 어떻게 조달할지?
- (a) 본인 계정 1개 + 친구 2명도 각자 본인 계정 등록 (권장, D12 1:N 모델 맞음)
- (b) 본인 계정 1개만 등록하고 친구는 모의만 허용
- (c) 모의투자 전용으로 시작 (실계좌는 S9 운용 검증 후)
**해소 시 첫 행동**: `.env.example`에 KIS 키 슬롯 추가 + `/admin/settings/brokerage` UI 확정.

### DQ-10 🟡 S8 코인 자동매매 — 바이낸스 선물 가용성
**질문**: 바이낸스 선물 사용 환경은?
- (a) 본인·친구 각자 바이낸스 계정 있음 → API 키만 발급
- (b) KYC·IP 제한·한국 IP 이슈 등 점검 필요
- (c) 테스트넷(`testnet.binancefuture.com`) 먼저 쓰고 메인넷은 나중
**해소 시 첫 행동**: `.env.example`에 `BINANCE_API_KEY/SECRET`·`BINANCE_TESTNET` 슬롯 추가 + `/admin/settings/binance` UI 확정.

### DQ-11 🟡 S8 리스크 가드레일 기본값 최종 확인
**현재 기본값**: 레버리지 ≤ 5x · 일일 손실 -3% 자동 정지 · AI 일 주문 횟수 ≤ 20회.
**질문**: Claude 판단 기본값 그대로 박제 OK? 아니면 조정?
- (a) 그대로 박제 (어드민이 `/admin/settings/risk`에서 실운용 전 조정)
- (b) 더 보수적 (예: 레버리지 ≤3x · 일일 -2%)
- (c) 사용자가 값 지정
**해소 시 첫 행동**: S8 슬라이스 파일의 Policy Engine 기본값 확정 + 마이그레이션 DEFAULT 값 박제.

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

### BL-KRIT-8 S8 자동매매 신규 엔티티 마이그레이션
- 소스: S8 D16
- 영향: 자동매매 기능 전체(주문 큐·체결 이력·포지션·리스크 이벤트·코인 거래소 연결)
- 해소: 마이그레이션 0010(or S7 이후 번호)로 E12 ExchangeConnection · E13 OrderQueue · E14 TradeExecution · E15 RiskPolicy · E16 RiskViolationEvent 추가
- 상세: `Document/Build/Slices/S8-AutoTrading.md`

### BL-KRIT-9 바이낸스 IP 제한·KYC
- 소스: DQ-10
- 영향: 한국 IP 바이낸스 선물 거래 가능 여부. VPS(해외 IP) 경유 또는 BFLEX/코인거래소 대체 검토 필요
- 해소: DQ-10 답 확정 후 S8 킥오프에서 확인

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

### AUTO-5 Global Blocker 대시보드에 BL-KRIT-1~9 추가
- `ProgressDashboard.md` §5에 신규 "실데이터 전환 + S8 자동매매 BL-KRIT" 섹션

### AUTO-6 `tudal/.env.example` 작성 (2026-04-21 D16)
- 현재 `.env.local`만 있고 S7·S8에서 쓸 키 목록이 레포에 박제 안 됨
- 포함 키(placeholder만): `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` · `ADMIN_EMAILS` · `ANTHROPIC_API_KEY` · `NAVER_CLIENT_ID/SECRET` · `RESEND_API_KEY` · `TELEGRAM_BOT_TOKEN/CHAT_ID` · `KIS_APP_KEY/SECRET` · `KIS_ACCOUNT_NO` · `KIS_MOCK_MODE` · `BINANCE_API_KEY/SECRET` · `BINANCE_TESTNET` · `CRON_SECRET`

### AUTO-7 S8-AutoTrading.md 스켈레톤 (2026-04-21 D16)
- `Document/Build/Slices/S8-AutoTrading.md` 신규 작성
- SliceTemplate 기반 + 본 HANDOFF §6 S8 블록과 정합

---

## §6 실데이터 전환 + 자동매매 프레임 로드맵 (2026-04-21 확정)

> DQ-1·DQ-2 확정 결과: **S7 주도 + S8 병행**. S7a·S7e 끝난 시점에 S8 스캐폴드 병행 착수, S7 완료 후 S8 실 체결 전환.

```
S7a → S7e → [여기서 S8 스캐폴드 병행 시작]
           → S7b → S7c → S7d → [여기서 S8 실 체결 전환] → S9 운용 검증
```

| ID | 이름 | 포함 Must / 신규 기능 | 외부 의존 | 예상 세션 | 선행 BL-KRIT |
|---|---|---|---|---|---|
| **S7a** | Anthropic wrapper + cost_log 실 INSERT | M17 | Anthropic | 1 | BL-KRIT-1 |
| **S7e** | Supabase 실 SELECT/INSERT 전면 전환 | M1·M4·M5·M6·M7·M8·M9·M16 | Supabase | 2 | BL-KRIT-6 + 0009 migration |
| **S7b** | 뉴스 + 브리핑 실 연결 | M11·M12 | Naver · Resend · Anthropic | 2 | BL-KRIT-1·3·4 |
| **S7c** | 장중 + Exit 2채널 실 연결 | M13·M14·M15 | KIS WebSocket · Telegram · Resend | 2 | BL-KRIT-2·4·5 |
| **S7d** | Silent Health 실 INSERT + override UI | M18·M19 + BL-17 B | Supabase · Telegram · Resend | 1 | BL-KRIT-4·5 |
| **S8 스캐폴드** | 자동매매 UI·스키마·Vault 훅·Strategy 폴더·AI 어댑터 인터페이스·Policy Engine (mock 체결) | 신규 E12~E16 · 6 라우트 | (아직 없음) | 2 | BL-KRIT-8 · DQ-11 |
| **S8 실 체결** | KIS 모의→실계좌 + 바이낸스 테스트넷→메인넷 전환 | Strategy 샘플 2건 검증 | KIS · 바이낸스 | 2 | DQ-9·DQ-10 · BL-KRIT-9 |
| **S9** | 어드민 3인 운용 검증 (Mock→Mock+실 혼합 1~2주 → 실계좌 전환) | 전체 | — | 4~8주 (세션 단위 아님) | S7a~e + S8 완료 |

**총 예상**: 12 세션 + 4~8주 운용 = 어드민 내부 도구 완성 기준

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

### S8 자동매매 프레임 (2026-04-21 D16 신규)
- [ ] `tudal/.env.example` 작성 (KIS·바이낸스·Anthropic 키 슬롯 + placeholder)
- [ ] E12 ExchangeConnection · E13 OrderQueue · E14 TradeExecution · E15 RiskPolicy · E16 RiskViolationEvent 마이그레이션
- [ ] `/admin/settings/{brokerage,binance,risk,strategy}` 4개 라우트
- [ ] `/admin/trading/{stock,crypto}` 2개 라우트 + mock 주문 큐 + 체결 로그
- [ ] Strategy 폴더 규약 (`src/lib/trading/strategies/{stock,crypto}/*.ts`) + 샘플 전략 2건
- [ ] AI 어댑터 인터페이스 (`src/lib/trading/ai/decide-order.ts`) + 빈 훅
- [ ] Policy Engine 기본값 (≤5x / -3% / ≤20회) + `test:ci` 케이스
- [ ] 모의↔실 토글 대표 1인 권한 가드
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

- **2026-04-21 (24차, 어드민 프레임 재정의)** — 사용자 지시로 (a) 어드민 = 본인+친구 3명 내부 투자 도구로 범위 재정의, 멤버·MVP Stage·Friends & Family 어휘 분리. (b) 구 트레이딩 3-Stage(매뉴얼→API→AI 자율) 어휘 폐기, 자동매매 = S8 단일 슬라이스로 통합. (c) S8 범위 확정: 주식(KIS 모의→실계좌) + 코인(바이낸스 USDT-M 선물 테스트넷→메인넷) + Strategy drop-in + AI 어댑터 embed. AI agent·skill 본체는 어드민 추후 drop-in. (d) 리스크 가드레일 기본값 박제: 레버리지 ≤5x · 일일 -3% 정지 · AI 일 주문 ≤20회. (e) BusinessPlan §Q1·§5·§9·§10.5·§10.8·§11·§12 · ServicePlan-Admin §0·§1.5·§1.6·§1A.0·§2·§3.1·§3.4·§3.13(신설)·§1A.5 D16 · ServicePlan §1·§2 Revision · HANDOFF §0·§1·§3·§4·§5·§6·§7·§9·§10 전면 정리. Slices/S8-AutoTrading.md 신규 작성, Deferred-Brokerage·Deferred-AIAgent-Selection는 승격 표기. 코드 변경 없음(docs only).
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
