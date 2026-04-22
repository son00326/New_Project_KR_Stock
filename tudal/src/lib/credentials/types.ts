export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ─── Brokerage (KIS) ─────────────────────────────────────────────────

export interface BrokerageCredentialInput {
  broker: 'kis';
  accountNo: string;
  appKey: string;
  appSecret: string;
  mockMode: boolean;
  strategyLabel: string | null;
}

export interface BrokerageCredentialDisplay {
  id: string;
  broker: 'kis';
  accountNoMasked: string;
  appKeyMasked: string;
  mockMode: boolean;
  strategyLabel: string | null;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

// ─── Exchange (Binance USDT-M Futures) ───────────────────────────────

export interface ExchangeCredentialInput {
  exchange: 'binance_futures';
  label: string;
  apiKey: string;
  apiSecret: string;
  testnetMode: boolean;
}

export interface ExchangeCredentialDisplay {
  id: string;
  exchange: 'binance_futures';
  label: string;
  apiKeyMasked: string;
  testnetMode: boolean;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}
