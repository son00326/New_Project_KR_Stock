// E11 KrBusinessDays — 한국 영업일 캘린더 (S3 BL-19 D 옵션, 2026-04-17 신설)
// 목적: D+5 영업일 카운터 + D15 R3.3-9 연휴 우회 계산.
// 소스: supabase/migrations/0004 · scripts/seed_kr_holidays.py
// 관계: Supabase `public.kr_business_days` 테이블 → 서버 컴포넌트 SELECT.

export interface KrBusinessDay {
  date: string; // YYYY-MM-DD
  isBusinessDay: boolean;
  holidayName: string | null;
}
