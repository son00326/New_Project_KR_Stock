# HANDOFF — 주픽 (JooPick)

Last updated: 2026-04-16 (14차 — Waterfall→Slice 전환, 문서 재편)

**목적**: 다음 세션이 "**다음에 무엇을 할지**"만 빠르게 파악.
**원칙**: 미래 지향. 포인터·다음 단계만. 상세는 각 슬라이스 파일이 담당.

> **⚡ 진입**: "@HANDOFF.md 보고 이어서 작업해줘" → 🟢 현재 슬라이스부터 착수. Entry routine은 `CLAUDE.md` 참조.

---

## 🟢 현재 슬라이스

**S0 Foundation** → `Document/Build/Slices/S0-Foundation.md`
상태: ⚪ 대기 (BL-1·BL-2 해소 필요)

### 🔴 S0 착수 전 필수
1. **BL-1**: Supabase 프로젝트 생성 + `.env.local` 키 확보 (사용자)
2. **BL-2**: admin role 정의 — email allowlist vs Supabase role claim (사용자)
3. **BL-6**: `/admin/health` 라우트를 §2 공식 11번째로 승격 vs `/admin/settings/health` 서브라우트 (S5 진입 전까지 결정)

### 🚀 S0 착수 시 첫 행동
```
S0-Foundation.md Tasks 순서대로:
T0.1 Legacy 제거 (pricing 라우트·subscription-gate·PLANS)
T0.2 Admin 라우트 그룹 생성 (10 라우트 빈 페이지)
T0.3 Supabase .env.local + RLS sketch
T0.4 디자인 토큰 seed (color 6·spacing 4·type 3)
T0.5 /admin 홈 대표 화면 목업+구현
T0.6 DoD: npm run build + lint 통과
```

---

## 📊 전체 진행 상황

→ `Document/Build/ProgressDashboard.md` (주간 뷰)

| 슬라이스 | 상태 | 예상 세션 |
|---|---|---|
| S0 Foundation | ⚪ 대기 | 2 |
| S1 Short List 30 홈 | ⚪ 대기 | 4 |
| S2 풀 리포트·투심위 | ⚪ 대기 | 3 |
| S3 승인 워크플로우 | ⚪ 대기 | 4 |
| S4 성과·Decision Tree | ⚪ 대기 | 4 |
| S5 스케줄러·알림 +M18 | ⚪ 대기 | 5 |
| S6 Hardening | ⚪ 대기 | 3 |
| **총** | | **25세션** |

---

## 🟡 보류 / 사용자 답변 필요

- **Q13** 기존 코드베이스 재활용 → **(B) 선별 재활용 확정** (2026-04-16)
- **Q16** 법무 자문 (S3 완료 이후)
- **Q17** 이용약관·면책 (S6 이전)
- **Q-OP3·Q-OP4** 재질문 금지 (개발 완료 전)

---

## 📝 최근 세션 (이전은 `git log`)

- **2026-04-16 (14차)** Waterfall→Slice 전환 — Phase/BuildPhase 폐기→Archive 이관, ExecutionPlaybook·ProgressDashboard·Slice 7종 신설, CLAUDE.md Entry routine 재작성, HANDOFF 경량화. architect Must 19 감사 + critic 정합성 감사(Critical 2·Major 6 해소). 재활용 방식 (B) 확정, S0 Foundation 다음 세션 착수 예정.
- **2026-04-15 (13차 후속2)** Q-OP1·Q-OP2 해소 → v1.1 — D14 Must 16→19, D15 승인 Holding 24h
- **2026-04-15 (13차)** P5 검증 3병렬 → v1.0 — D10~D13 확정. Critical 3+Major 10 해소.

---

## 📂 문서 가이드

| 용도 | 문서 |
|---|---|
| 전체 슬라이스 상태 | `Document/Build/ProgressDashboard.md` |
| 현재 슬라이스 상세 | `Document/Build/Slices/S0-Foundation.md` |
| 개발 방법론 | `Document/Process/ExecutionPlaybook.md` |
| 기획 SoT | `Document/Service/Planning/ServicePlan-Admin.md` v1.1 |
| 사업 SoT | `Document/Business/BusinessPlan.md` |
| 기획 이력 | `Document/Archive/Phase.md` (참조만, 편집 금지) |

---

**단일 진입 규칙**: HANDOFF + 현재 슬라이스 파일 읽으면 즉시 착수. 배경은 ServicePlan-Admin.md 참조.
