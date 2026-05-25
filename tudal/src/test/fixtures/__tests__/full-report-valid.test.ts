// PR4 Step 1.0.7.2 (B12 + B15 fix omxy R3+R4): fixture schema 정합 sanity test.
// validFullReportSections()의 각 section이 실제 zod schema를 통과하는지 9 schemas 검증.
// fixture 변경 시 회귀 자동 catch (T6 impl 진입 시 변경 위험 0 보장).
import { describe, it, expect } from 'vitest';
import { validFullReportSections } from '../full-report-valid';
import {
  reportSection0Schema,
  reportSection1Schema,
  reportSection2Schema,
  reportSection3Schema,
  reportSection4Schema,
  reportSection5Schema,
  reportSection6Schema,
  reportSection7Schema,
  reportAppendixSchema,
} from '@/lib/data/report-section-schemas';

describe('validFullReportSections fixture — schema 정합 (B12 sanity)', () => {
  const sections = validFullReportSections();

  it('section_0 parses successfully', () => {
    expect(() => reportSection0Schema.parse(sections.section_0)).not.toThrow();
  });
  it('section_1 parses', () => {
    expect(() => reportSection1Schema.parse(sections.section_1)).not.toThrow();
  });
  it('section_2 parses', () => {
    expect(() => reportSection2Schema.parse(sections.section_2)).not.toThrow();
  });
  it('section_3 parses', () => {
    expect(() => reportSection3Schema.parse(sections.section_3)).not.toThrow();
  });
  it('section_4 parses', () => {
    expect(() => reportSection4Schema.parse(sections.section_4)).not.toThrow();
  });
  it('section_5 parses', () => {
    expect(() => reportSection5Schema.parse(sections.section_5)).not.toThrow();
  });
  it('section_6 parses', () => {
    expect(() => reportSection6Schema.parse(sections.section_6)).not.toThrow();
  });
  it('section_7 parses', () => {
    expect(() => reportSection7Schema.parse(sections.section_7)).not.toThrow();
  });
  it('appendix parses', () => {
    expect(() => reportAppendixSchema.parse(sections.appendix)).not.toThrow();
  });
});
