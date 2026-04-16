# Deferred-X 증권사 API + 매뉴얼/자동매매 UI

> originally architect ID: S3 (`.omc/research/must-19-slice-mapping.md` §5 S3 블록 — **Must 19 밖으로 이관**)

---

```
slice_id: Deferred-X
slice_name: 증권사 API + 매뉴얼/자동매매 UI
architect_id: S3
status: ⏸ 보류 (Must 19 범위 외 — 옵션 A 채택)
expected_sessions: — (Must 19 이후 별도 로드맵)
current_progress: 0%
```

---

## 왜 Must 19 밖으로 이관했는가

architect §3 §5 감사 결과, 초안의 "S3 집행 3경로"는 Must 번호 매핑이 전면 오류였다.

| 초안 가정 | 실제 §3 Must |
|---|---|
| M5 = 매뉴얼 트레이딩 | M5 = 편입/유지/제외 **Delta 뷰** |
| M6 = 자동매매 UI | M6 = 선정 **근거 요약 카드 3줄** |
| M7 = 외부 바이패스 | M7 = **승인 워크플로우** |

**엔티티 확인**: Must 19 항목 중 E9 BrokerageConnection을 사용하는 항목 = **0건**.

**D11 해석**: 3경로 집행(주픽 매뉴얼·자동매매·외부 바이패스)은 어드민이 증권사 앱을 직접 사용하는 "외부 바이패스"로도 MVP 성립. 주픽 시스템은 집행하지 않고 **AI 가상 포트 본체**(Accept=성능 측정용 확정)만 추적. ServicePlan-Admin.md §1A.0 SoT 참조.

**권장 옵션**: 옵션 A — Must 19 범위에서 완전 제거. Should/AutoTrading 별도 로드맵으로 이관.

---

## 재활성 조건

아래 조건이 모두 충족될 때 Must 19 밖 Should 로드맵으로 착수:

1. Must 19 전원 가동 완료 (선행: S6 완료)
2. 사용자가 매뉴얼 트레이딩 UI 필요성을 재확인 (현재: 외부 바이패스로 충분)
3. BL-10 Vault/Secrets 솔루션 선택 완료 (Supabase Vault vs 외부 KMS)
4. `AutoTrading.md` 별도 설계 문서 작성 완료

---

## 포함 예정 범위 (재활성 시)

- **E9 BrokerageConnection**: 증권사 API 키 저장 (Vault 참조, 평문 금지), 전략 라벨 자유 텍스트, scope 토글(manual/auto/both)
- **매뉴얼 트레이딩 입력 폼**: Short List 종목 선택 → 수량·가격 입력 → 주문 확인
- **자동매매 UI**: `AutoTrading.md` 설계 기반 (현재 미확정, 재검토 대기)
- **라우트**: `/admin/settings/brokerage` (신규 — IA 결정 필요)
- **예상 세션**: 2세션 (Should 범위, 옵션 B 채택 시)

---

## 관련 문서 포인터

- `Document/Service/Planning/AutoTrading.md` — 자동매매 트랙 설계 (미확정, 재검토 대기)
- `ServicePlan-Admin.md §1A.0` — D11 3경로 집행 SoT
- `.omc/research/must-19-slice-mapping.md` §5 S3 블록 — architect 감사 전문

---

## 블로커

- **BL-10** (S3 옵션 B 채택 시만 필요): Vault/Secrets 솔루션 선택 — Supabase Vault vs 외부 KMS. 옵션 A 채택 시 해소 불필요.

---

## 리스크

- **R6** (architect §8): 초안 S3 Must 매핑 오류가 혼선을 주어 집행 UI로 잘못 구현 시 Must 19 밖 범위 폭주. Must 19 범위는 AI 가상 포트 본체 전담임을 이 문서에 박제.

---

## 의사결정 로그

- 2026-04-16: 슬라이스 파일 생성. architect 감사(R6·§5 S3 블록) 기반으로 Must 19 밖 이관. 옵션 A 권장. AutoTrading.md 포인터 추가.

---

## 이슈·발견

- (없음)

---

## 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-16 | 초기 생성. architect S3 블록 기반. Must 19 밖 이관 이유 명시. 재활성 조건 4가지 박제. |
