<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-17 | Updated: 2026-04-17 -->

# data — Mock Data Sources

## Purpose
**MVP mock 데이터 레이어**. 전 종목·재무·매크로 데이터가 여기서 export된다. 실데이터(KRX·한투·DART·pykrx) 전환은 **슬라이스별 "실데이터 연결" 단계**에서 mock 모듈을 통째로 교체하는 방식.

## Key Files
| File | Description |
|------|-------------|
| `mock-stocks.ts` | `MOCK_STOCKS: Stock[]` + `getStockByTicker(ticker)` |
| `mock-financials-extended.ts` | 재무 3표 확장 데이터 (연간) |
| `mock-quarterly.ts` | 분기 재무 데이터 |
| `mock-ohlcv.ts` | 일봉 OHLCV 시계열 |
| `mock-corporate.ts` | 거버넌스·경영진·사업 부문 |
| `mock-macro.ts` | 16 매크로 지표 + Fear & Greed |

## For AI Agents

### Mock 파일 작성 규칙
- 타입은 `@/types/*`에서 import하여 강제. `any` 금지.
- 한 줄 주석: `// MVP용 mock 데이터 — 추후 {DART/KRX/한투/pykrx} API로 교체`.
- Named export 사용 (`export const MOCK_XXX = [...]`). default export 금지.

### Admin mock (S0 T0.7에서 추가 예정)
- 파일 prefix `mock-admin-*.ts` 사용 (`mock-admin-shortlist.ts`, `mock-admin-reports.ts` 등).
- 엔티티 타입은 `@/types/admin.ts` (S0 신규)에 정의. 빈 배열이어도 **TypeScript export shape는 확정** 필요.

### 실데이터 전환 시
- mock 파일 한 개가 교체 단위. **파일 분해 금지** — 호출부(`import from "@/lib/data/mock-stocks"`)는 그대로 유지하고 내부 구현만 교체.
- 슬라이스 내부 "실데이터 연결" 단계에서 **data 하네스**를 평가 (S1 또는 S5에서 1회, `ExecutionPlaybook.md` §2.5 참조).

## Dependencies
### Internal
- `@/types/stock` · `@/types/macro` · `@/types/corporate`

<!-- MANUAL: -->
