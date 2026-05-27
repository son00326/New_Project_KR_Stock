// admin-settings.test.ts — 58차 Mock cleanup Step 2.2
//
// admin_settings 테이블 SELECT helper 단위 테스트.
// - transformAdminSettingsRow: snake → camel 매핑 + boolean 검증
// - getCurrentAdminSettings: hit / null (maybeSingle no row) / error

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCurrentAdminSettings,
  transformAdminSettingsRow,
  type AdminSettingsDbRow,
} from "@/lib/data/admin-settings";

interface SelectChain {
  select: (...args: unknown[]) => SelectChain;
  maybeSingle: () => Promise<{
    data: AdminSettingsDbRow | null;
    error: { code?: string; message?: string } | null;
  }>;
}

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  resolvedSingle: {
    data: null as AdminSettingsDbRow | null,
    error: null as { code?: string; message?: string } | null,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: mocks.from,
  })),
}));

const baseRow: AdminSettingsDbRow = {
  admin_id: "11111111-1111-1111-1111-111111111111",
  intraday_mode: true,
  updated_at: "2026-05-27T04:00:00.000Z",
};

describe("transformAdminSettingsRow", () => {
  it("maps snake_case columns to camelCase AdminSettings", () => {
    const settings = transformAdminSettingsRow(baseRow);
    expect(settings.adminId).toBe(baseRow.admin_id);
    expect(settings.intradayMode).toBe(true);
    expect(settings.updatedAt).toBe(baseRow.updated_at);
  });

  it("preserves false intraday_mode", () => {
    const settings = transformAdminSettingsRow({
      ...baseRow,
      intraday_mode: false,
    });
    expect(settings.intradayMode).toBe(false);
  });

  it("throws when intraday_mode is not boolean", () => {
    expect(() =>
      transformAdminSettingsRow({
        ...baseRow,
        intraday_mode: "true" as unknown as boolean,
      }),
    ).toThrow(/admin_settings_invalid_intraday_mode/);
    expect(() =>
      transformAdminSettingsRow({
        ...baseRow,
        intraday_mode: null as unknown as boolean,
      }),
    ).toThrow(/admin_settings_invalid_intraday_mode/);
  });
});

describe("getCurrentAdminSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolvedSingle = { data: null, error: null };
    const chain: SelectChain = {
      select: vi.fn(() => chain),
      maybeSingle: vi.fn(() => Promise.resolve(mocks.resolvedSingle)),
    };
    mocks.from.mockImplementation(() => chain);
  });

  it("returns null when 0 rows (maybeSingle returns null data)", async () => {
    mocks.resolvedSingle = { data: null, error: null };
    const result = await getCurrentAdminSettings();
    expect(result).toBeNull();
  });

  it("returns transformed AdminSettings when row exists", async () => {
    mocks.resolvedSingle = { data: baseRow, error: null };
    const result = await getCurrentAdminSettings();
    expect(result).not.toBeNull();
    expect(result?.adminId).toBe(baseRow.admin_id);
    expect(result?.intradayMode).toBe(true);
    expect(result?.updatedAt).toBe(baseRow.updated_at);
  });

  it("throws on DB error", async () => {
    mocks.resolvedSingle = {
      data: null,
      error: { code: "PGRST301", message: "permission denied" },
    };
    await expect(getCurrentAdminSettings()).rejects.toThrow(
      /admin_settings_select_failed/,
    );
  });

  it("selects only the expected columns", async () => {
    const selectSpy = vi.fn(() => ({
      maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    }));
    mocks.from.mockImplementation(() => ({ select: selectSpy }));
    await getCurrentAdminSettings();
    expect(selectSpy).toHaveBeenCalledWith(
      "admin_id, intraday_mode, updated_at",
    );
  });
});
