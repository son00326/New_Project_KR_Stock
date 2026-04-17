<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-17 | Updated: 2026-04-17 -->

# types — Domain TypeScript Types

## Purpose
도메인별 TypeScript 인터페이스·타입 정의. 컴포넌트 props와 구분 — 여기에는 **데이터 shape**만 둔다.

## Key Files
| File | Description |
|------|-------------|
| `stock.ts` | `Stock`·`FinancialData`·`RevenueSegment`·`Multiples`·`PeerCompany`·`PeerComparison`·`FundamentalReport` |
| `corporate.ts` | 거버넌스·경영진·사업 부문 타입 |
| `macro.ts` | 매크로 지표·Fear & Greed·이벤트 캘린더 타입 |

## For AI Agents

### 타입 추가 규칙
- 새 엔티티는 **도메인별 파일에 추가**. 파일 분할 기준은 업무 도메인.
- **Admin 전용 타입**은 `admin.ts` (S0 T0.7에서 신규 생성 예정)에 격리 — 기존 `stock.ts`에 섞지 않음.
- `interface` vs `type`: 구조체는 `interface`, 유니온·alias·mapped는 `type`.

### 제거된 타입 (돌아오지 않음)
- `SubscriptionTier` · `UserProfile` · `PlanKey` — 서비스 정책상 구독 모델 폐기 (2026-04 S0).
- 유저 모델은 향후 Supabase Auth `User` 직접 사용 또는 `admin.ts`의 `AdminProfile` 신규 정의로 대체.

### Zod · Runtime Validation
- 현재 없음. Server Action 반환 검증이 필요 시 도입 검토 (사용자 확인 필요).

## Dependencies
### Internal
- 이 디렉토리의 타입이 `src/` 전역(`components`·`lib`·`app`)에서 사용됨.

<!-- MANUAL: -->
