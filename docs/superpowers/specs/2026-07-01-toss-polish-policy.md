# 토스 심화 폴리시 (1페이지) — 2026-07-01

> D34 토스 디자인 시스템(`globals.css` 토큰) **위에 얹는 출시 전 사용 규칙**. **신규 토큰·폰트·컴포넌트 체계 재작업 금지**(OMXY 가드레일). 변경/신규 컴포넌트에만 적용 → 마지막 `/gstack-design-review` 전역 QA.

## 원칙: 정보 위계 = 큰 숫자 + 작은 라벨 + 넉넉한 여백

## 규칙

**색상 의미 (토큰만 사용, raw hex 금지)**
- `primary` = 주요 액션/링크/선택 상태. `market-up`(빨강)=상승·`market-down`(파랑)=하락(한국 관례). `warning/success/info` = 상태 배지. `muted-foreground` = 보조 텍스트. `destructive` = 위험 액션.
- 수익률/등락 숫자는 반드시 `market-up`/`market-down`/`market-neutral`.

**카드**
- `bg-card` + `rounded-2xl` + `shadow-toss-sm`(기본)/`shadow-toss-md`(강조) + `border border-border/70`. 내부 패딩 `p-4 md:p-5`. 카드 간 `space-y-4`, 섹션 간 `space-y-6`.
- 카드 헤더 = 작은 `text-sm font-medium text-muted-foreground` 라벨 + 필요 시 우측 메타(기준월 등 `text-xs text-muted-foreground`).

**숫자 강조**
- 금액·비중·수익률·점수 = `text-lg~2xl font-bold tabular-nums`. 옆 라벨 = `text-xs text-muted-foreground`. 금액 formatter(조/억/만)는 기존 `@/lib/constants` 사용.

**뱃지**
- `rounded-full px-2 py-0.5 text-xs font-medium`. 은은한 톤: 상태색 `/10~/15` 배경 + 상태색 텍스트(예: 보유 중 = `bg-primary/10 text-primary`). **내부 상태어(accepted/active/portfolio/shadow) 금지 — 평이한 한국어("보유 중")만.**

**표/리스트**
- 행 `hover:bg-muted/50 transition-colors`, 구분선 `border-border/60`, 라벨-값 좌우 정렬, 숫자 `tabular-nums`. 밀도는 `py-2.5~3`.

**빈 상태**
- 중앙 정렬 `text-sm text-muted-foreground`, "아직 준비 중입니다" 톤. **운영/디버그 안내(마이그·flag·키·청크) 노출 금지** — 그런 상태는 시스템 상태 화면에만.

**버튼**
- 기본 `Button`(shadcn) variant 유지. 주요 액션 = `default`(primary), 보조 = `secondary`/`outline`, 위험 = `destructive`. 비활성은 반드시 `disabled`(회색·클릭 불가) — "사용 필요" 같은 클릭 가능한 죽은 버튼 금지.

**모션**
- `transition-colors`/`transition-all` + `ease-toss`. 과한 애니메이션 금지.

## 실험/연구 화면 톤
- 실험·연구 그룹 화면(선정 방식 비교·AI 학습)은 상단에 **은은한 info 배너 1줄**("참고용 실험 화면입니다 — 실제 추천/운영에 자동 반영되지 않습니다") + 평이한 설명. 제품 화면 대비 채도 낮게.

## 적용 대상(이번 정리)
사이드바 3구역 · 홈 대시보드(현재 운영 중 카드·추천 30·섹터 분포 칩·보유 뱃지) · 포트폴리오 운영 뷰 · 섹터 비교 재작성 · 빈 상태/은어 카피. **로직·라우팅·토큰 불변.**
