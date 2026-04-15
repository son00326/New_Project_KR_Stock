# CodebaseStatus.md — 현재 구현 스냅샷

> **용도**: 이 문서는 **"지금 코드에 무엇이 있는가"**의 스냅샷이다. 덮어쓰기 중심 — 과거 상태는 git log에 있고 여기는 **현재**만 유지한다.
>
> **HANDOFF.md와의 구분**:
> - `HANDOFF.md` = 미래 지향 ("다음 세션에 무엇을 할지", 🔴 다음 단계 / 🟡 미결·보류 / 📝 최근 세션)
> - `CodebaseStatus.md` = 현재 지향 ("지금 무엇이 있는가", 라우트·파일·연결 상태)
>
> **갱신 트리거**: Build Stage B5(Ship) 완료 시, 또는 라우트/실데이터 연결/환경변수 등 구조적 변화 시 즉시 갱신.

---

## 최근 갱신

**2026-04-14**: Document/ 5-버킷 재구성. BusinessPlan §13에서 본 문서로 이관.

---

## tudal/ 현재 상태 (2026-04-14 기준)

### 규모
- 총 **48개** TypeScript 파일
- **7개** 라우트: 랜딩 / 로그인 / 회원가입 / 요금제(legacy) `[레거시 - B3.1 제거 확정]` / 매크로 / 종목 / 404

### 기술 스택
- Next.js 16.2.3 + React 19 + TypeScript + Tailwind v4
- UI: shadcn(base-nova) + Lucide + Recharts
- 라우팅: App Router, 라우트 그룹 `(auth)` / `(main)`
- 인증: Supabase SSR 미들웨어 (env 미연결)
- 브랜딩: '주픽' 리브랜딩 + KIPRIS 검증 완료
- 화면: 종목 분석 4탭 + 매크로 16지표 + 차트

### 데이터 레이어
- **mock 데이터 기반 MVP 프레임워크 완성** (`tudal/src/lib/data/*`)
- 실데이터: 0 (KRX·한투·DART·pykrx 미연결, BuildPhase B3.2 대기)
- 인증: Supabase SSR 준비, `.env.local` 미세팅 (B2.2 대기)
- 유저: 0

### 레거시 제거 대상
- `constants.ts` 3tier `PLANS`, `(main)/pricing` 라우트 `[레거시 - B3.1 제거 확정]` → BuildPhase **B3.1**에서 제거

### 다음 작업 방향
Option B (선별 재활용 + 대폭 간소화) 기준으로 재정비.

---

## 시스템·백테스트 현황

### 자동화 백테스트 v6.1 FINAL (2026-04-12 확정)
- 파일: `backtest/full_system_backtest_v6.py`
- 성과: CAGR 20.3% · Sharpe 0.99 · Calmar 0.78 · Max DD -25.8%
- 벤치마크: 삼성전자 B&H 위험조정 beat
- 구성: 3축 분화 + Early Warning + 부분 리밸런싱
- 상세 수치·최적화 이력: 프로젝트 메모리 `project_backtest_v6_final.md`

---

## 체크리스트 (변화 시 갱신)

- [ ] TypeScript 파일 수 증감 (±5 이상 시 갱신)
- [ ] 라우트 추가/제거
- [ ] mock → 실데이터 전환 (소스별 on/off)
- [ ] Supabase `.env.local` 세팅 여부
- [ ] 유저 수 (Alpha/Beta 단계 기준)
- [ ] 레거시 코드 제거 완료 여부
