// calendar.ts — Supabase kr_business_days 조회 헬퍼 + mock fallback (S3 US-T3.5)
// 현재 단계: mock 리턴만 허용.
// TODO(S5 M10): Supabase 실 SELECT로 전환 (pykrx 배치 seed 후).

import type { KrBusinessDay } from "@/types/kr-business-days";

// ---------------------------------------------------------------------------
// 2026년 영업일 캘린더 — 0004_s3_approval.sql §4 2026년 블록과 100% 동기화
// ---------------------------------------------------------------------------
// 생성 규칙:
//   - 주말(토=6, 일=0) → isBusinessDay: false, holidayName: null
//   - 공휴일(평일) → isBusinessDay: false, holidayName: "이름"
//   - 나머지 평일 → isBusinessDay: true, holidayName: null

function buildYear2026Calendar(): KrBusinessDay[] {
  // 공휴일 맵 (0004 §4 2026 블록과 동기화)
  const holidays: Record<string, string> = {
    "2026-01-01": "신정",
    "2026-02-16": "설날 연휴",
    "2026-02-17": "설날",
    "2026-02-18": "설날 연휴",
    "2026-03-02": "대체공휴일(삼일절)",
    "2026-05-05": "어린이날",
    "2026-05-25": "대체공휴일(석가탄신일)",
    "2026-06-03": "제9회 전국동시지방선거",
    "2026-08-17": "대체공휴일(광복절)",
    "2026-09-24": "추석 연휴",
    "2026-09-25": "추석",
    "2026-09-26": "추석 연휴", // 토요일 — §3에서 이미 주말. holidayName만 부여.
    "2026-10-05": "대체공휴일(개천절)",
    "2026-10-09": "한글날",
    "2026-12-25": "크리스마스",
    "2026-12-31": "연말 휴장",
  };

  const result: KrBusinessDay[] = [];
  const start = new Date("2026-01-01T00:00:00");
  const end = new Date("2026-12-31T00:00:00");

  const current = new Date(start);
  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;

    const dow = current.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;
    const holidayName = holidays[dateKey] ?? null;

    let isBusinessDay: boolean;
    if (isWeekend) {
      isBusinessDay = false;
    } else if (holidayName !== null) {
      // 2026-09-26 은 토요일이므로 이미 isWeekend=true — 평일 공휴일만 여기 도달
      isBusinessDay = false;
    } else {
      isBusinessDay = true;
    }

    result.push({ date: dateKey, isBusinessDay, holidayName });

    current.setDate(current.getDate() + 1);
  }

  return result;
}

export const MOCK_KR_BUSINESS_DAYS_2026: KrBusinessDay[] = buildYear2026Calendar();

// ---------------------------------------------------------------------------
// loadKrBusinessDays — 서버 사이드 헬퍼
// 현재 단계: Supabase 실 SELECT 미구현 — mock 리턴만.
// TODO(S5 M10): Supabase createServerClient SELECT 추가.
// ---------------------------------------------------------------------------
export async function loadKrBusinessDays(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _from: Date,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _to: Date
): Promise<KrBusinessDay[]> {
  // NOTE: 실 Supabase connect는 S3 마감 후 S5 M10 배치 전환 슬라이스에서 수행.
  // 현재 단계에서는 항상 MOCK_KR_BUSINESS_DAYS_2026 리턴.
  return MOCK_KR_BUSINESS_DAYS_2026;
}
