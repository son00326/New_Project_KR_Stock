# BigFinance 경쟁사 분석 — Research Handoff

> ⚠️ 이 문서는 `Document/Process/HANDOFF.md`와 **별개**다. BigFinance(bigfinance.co.kr) 경쟁사 리서치 전용 세션 핸드오프.
> 다음 세션은 이 파일 + `Document/Research/BigFinance/` 폴더만 읽어도 이어받을 수 있어야 한다.

**최종 업데이트**: 2026-04-14
**현재 단계**: Stage 0 완료 → **Stage 1 진입 대기 (세션 재시작 필요)**
**상위 문서 연동**: 없음 (BusinessPlan/ServicePlan과 분리된 외부 리서치 트랙)

---

## 0. 분석 대상 & 목표

- **대상 URL**: https://bigfinance.co.kr
- **목표**: spec, API 사용처, API 유무, 데이터 소스(upstream), 화면 구조, 기능 전반을 자세히 분석
- **산출물**: `Document/Research/BigFinance/Competitor-BigFinance.md` (통합 리포트) + Stage별 서브 문서

## 1. 사용자 확정 사항

| 항목 | 결정 |
|---|---|
| 네트워크 레벨 리버스 | **OK** (HAR 캡처, XHR/fetch 엔드포인트 추적 허용) |
| 계정 로그인 후 분석 | **OK** |
| 산출물 위치 | `Document/Research/BigFinance/` 신규 폴더 |
| 구독 등급 | 미확인 (다음 세션에서 사용자에게 재확인) |
| 2FA 여부 | 미확인 (로그인 시도 중 발견되면 수동 개입 요청) |

## 2. 계정 정보 (리서치용)

```
ID: patrick911014
PW: Share!234
```

> 🔐 민감 정보. 리포트·커밋에는 절대 포함 금지. HAR 파일에 세션 토큰 섞일 수 있으니 `_raw/har/`는 `.gitignore` 대상으로 처리 권장 (다음 세션에서 설정).

## 3. 환경 설치 완료 (재시작 후에도 유효)

| 항목 | 상태 | 비고 |
|---|---|---|
| `@playwright/mcp` MCP 서버 | ✅ 등록 완료 (`claude mcp list`에서 ✓ Connected) | user 스코프 |
| Chromium 147.0.7727.15 | ✅ `~/Library/Caches/ms-playwright/chromium-1217` |
| Chrome Headless Shell | ✅ 다운로드 완료 |
| Node | v24.14.1 (`/Users/kevinoh/.nvm/versions/node/v24.14.1/bin/node`) |
| 폴더 구조 | ✅ 생성 완료 (아래 4절 참조) |

**재시작 후 첫 작업**: `claude mcp list`로 playwright MCP가 여전히 ✓ Connected인지 확인. 그 다음 `ToolSearch({query: "+playwright"})` 또는 `+browser navigate`로 MCP 도구 스키마 로드.

## 4. 폴더 구조 (생성 완료)

```
Document/Research/BigFinance/
├── RESEARCH-HANDOFF.md          ← 이 파일
├── Competitor-BigFinance.md     ← Stage 6에서 생성 (아직 없음)
├── 01-sitemap.md                ← Stage 1 산출물 (아직 없음)
├── 02-features.md               ← Stage 2
├── 03-api-endpoints.md          ← Stage 3
├── 04-data-sources.md           ← Stage 4
├── 05-tech-stack.md             ← Stage 5
└── _raw/
    ├── screenshots/             ← 화면 캡처
    ├── har/                     ← Playwright HAR 네트워크 기록
    └── bundle-analysis/         ← JS 번들 힌트 dump
```

## 5. Stage Plan (Stage 0만 완료)

| Stage | 상태 | Agent / Skill | 계정 필요 | Output |
|---|---|---|---|---|
| 0. 스코프 확정 | ✅ 완료 | `planner` + `/oh-my-claudecode:omc-plan` | — | 이 문서 |
| 1. 사이트맵 & 화면 구조 | ⏳ 대기 | `explore` + `qa-tester` + `/browse` (gstack) | ✅ (로그인 후 포함) | `01-sitemap.md` + `_raw/screenshots/` |
| 2. 기능 인벤토리 | ⏳ 대기 | Claude 직접 + gstack `/qa-only` (2026-06-11: 구 `/oh-my-claudecode:visual-verdict` 대체) | ✅ | `02-features.md` |
| 3. API / 네트워크 리버스 | ⏳ 대기 | Claude 직접 + gstack `/investigate` + `/browse` (2026-06-11: 구 `/oh-my-claudecode:trace` 대체) | ✅ | `03-api-endpoints.md` + `_raw/har/` |
| 4. 데이터 소스 추적 | ⏳ 대기 | Claude 직접 + `superpowers-dispatching-parallel-agents` (2026-06-11: 구 `/oh-my-claudecode:external-context` 대체) | ❌ | `04-data-sources.md` |
| 5. 기술 스펙 프로파일링 | ⏳ 대기 | `explore` + `/browse` | ❌ | `05-tech-stack.md` |
| 6. 통합 리포트 | ⏳ 대기 | `writer` (Sonnet) | — | `Competitor-BigFinance.md` |
| 7. 검증 & 독립 리뷰 | ⏳ 대기 | `critic` (Opus) + `verifier` + gstack `/codex` (선택, 2026-06-11: 구 `/oh-my-claudecode:ccg` 대체) | — | 리뷰 코멘트 반영 |

### 병렬 디스패치 순서

1. Stage 0 ✅
2. **Stage 4, 5 동시 시작** (계정 불필요 — 공개 정보/스택 감지)
3. **Stage 1** (사이트맵 먼저) — 로그인 플로우 구성 후 실행
4. Stage 1 결과 기반 → **Stage 2, 3 동시 시작**
5. Stage 6 (통합) → Stage 7 (검증)

## 6. Stage별 실행 가이드 (다음 세션 바로 사용)

### Stage 1 — 사이트맵 & 화면 구조
- Playwright MCP로 bigfinance.co.kr 진입 → robots.txt, sitemap.xml 먼저 조회
- 공개 페이지 BFS 크롤 (depth 3) → URL 트리 작성
- 로그인 (`patrick911014` / `Share!234`) → 인증 후 접근 가능 페이지 크롤
- 각 페이지 스크린샷 → `_raw/screenshots/{slug}.png`
- 모바일 뷰포트(375×812) + 데스크톱(1440×900) 2종 캡처

### Stage 2 — 기능 인벤토리
- Stage 1의 스크린샷 묶음을 gstack `/qa-only` 스킬로 판독 (2026-06-11: 구 `visual-verdict` 대체)
- 각 화면 × 제공 기능 × 접근 권한(무료/유료/로그인) 매트릭스화

### Stage 3 — API 리버스
- Playwright context에 HAR recording 켜고 주요 화면 순회
- `page.on('request')` / `page.on('response')` 훅으로 XHR/fetch 로그 → JSONL 저장
- WebSocket은 `page.on('websocket')` 훅으로 별도 캡처
- 엔드포인트 클러스터링: method × path pattern × 응답 스키마 → 표로 정리
- 인증 방식 식별 (Authorization 헤더, 쿠키 세션, CSRF 토큰)

### Stage 4 — 데이터 소스 추적 (계정 불필요 → 먼저 시작 가능)
- 공시 시스템 DART에서 bigfinance 운영사 IR/공시 조회
- 채용공고 사이트(원티드·잡코리아·사람인)에서 기술 스택·데이터 파트너 힌트
- JS 번들의 hostname 힌트 (krx, koscom, koreainvestment, kiwoom, fnguide, wise.fn, dataguide 류)
- 응답 헤더에 X-Data-Source / X-Provider 류 있는지
- 시세 지연 여부 (실시간 vs T+1)로 역추정
- 신뢰도 상/중/하 라벨링 필수

### Stage 5 — 기술 스펙 (계정 불필요 → 먼저 시작 가능)
- `view-source:` 로 meta generator, Next.js `__NEXT_DATA__`, React/Vue 힌트
- 응답 헤더: Server, X-Powered-By, CF-Ray(Cloudflare), Vercel 헤더
- `/_next/static/`, `/static/js/main.*.js` 번들 경로
- Wappalyzer / BuiltWith 수동 조회
- Analytics(GA·Amplitude·Mixpanel), 에러추적(Sentry), 인증(Auth0/Firebase/Cognito/자체) 식별

### Stage 6 — 통합 리포트 (`Competitor-BigFinance.md`)
구성 제안:
1. Executive Summary (한 페이지)
2. 화면맵
3. 기능 매트릭스
4. API 인벤토리
5. 데이터 파이프라인(upstream)
6. 기술 스택
7. 우리 서비스(tudal) 대비 시사점 — 법적 제약(§7 BusinessPlan) 하에 벤치마크 가능한 부분만

### Stage 7 — 검증
- `critic` (Opus)으로 증거 체인 검토 (특히 데이터 소스 추정이 근거 있는지)
- 선택: gstack `/codex`로 Codex·Gemini 교차 검증 (2026-06-11: 구 `/oh-my-claudecode:ccg` 대체)

## 7. 제약·주의사항

- **법적 원칙**: Scraping은 robots.txt 존중 + rate limit 준수 (요청 간 1초 이상 간격). 공개 API가 없으면 리버스한 엔드포인트는 "분석 목적 기록"일 뿐 재사용 금지.
- **민감 정보**: HAR 파일의 Authorization 헤더·쿠키는 커밋 금지. `_raw/` 전체를 `.gitignore`에 추가 고려.
- **본 분석은 tudal 서비스와 분리**: BusinessPlan/ServicePlan/Phase/BuildPhase/HANDOFF.md 5문서 체계에 편입시키지 않음. 단, Stage 6 결론 중 tudal에 적용 가능한 시사점은 별도로 ServicePlan §3 또는 BusinessPlan §"의사결정 기록"에 전달 고려.

## 8. 다음 세션 첫 액션 (체크리스트)

세션 시작 직후 순서대로 수행:

- [ ] 이 파일(`Document/Research/BigFinance/RESEARCH-HANDOFF.md`) 읽기
- [ ] `claude mcp list`로 playwright MCP ✓ Connected 확인
- [ ] `ToolSearch({query: "+playwright browser"})` 또는 `+browser navigate`로 Playwright MCP 도구 스키마 로드
- [ ] 사용자에게 확인: "BigFinance 리서치 이어서 진행합니다. 구독 등급은 무료/유료 중 어느 쪽인가요? 2FA 설정되어 있나요?"
- [ ] Stage 4 + Stage 5 병렬 백그라운드 디스패치 (계정 불필요)
- [ ] Stage 1 착수 — 비로그인 크롤 → 로그인 플로우 → 인증 후 크롤
- [ ] 각 Stage 완료 시 이 파일 §5 상태 컬럼 업데이트 + §9 로그 append

## 9. 세션 로그

### 2026-04-14 (세션 1)
- **시도**: bigfinance.co.kr 경쟁사 분석 플랜 수립, 환경 설치
- **성공**:
  - 8단계 Stage Plan 수립 (사용자 승인 완료)
  - Playwright MCP + Chromium 설치
  - 폴더 구조 생성
  - 계정 수령
- **실패/블로커**: 없음. 단, MCP 도구는 현 세션에 미노출 → 세션 재시작 필요
- **다음 단계**: 세션 재시작 후 §8 체크리스트부터
