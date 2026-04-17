import type { BrokerageConnection } from "@/types/admin";

// MVP용 mock 데이터 — 추후 어드민 등록 액션 + Vault 시크릿 참조로 교체 (Deferred-X 증권사 API)
// E9 BrokerageConnection (어드민별 N:1 증권사·거래소 연결, D12 신설).
// D12 보안: api_key_ref는 평문 금지 — Vault/Secrets 참조 키만. 본인 admin_id만 조회 가능.
export const MOCK_ADMIN_BROKERAGE: BrokerageConnection[] = [];
