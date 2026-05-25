// PR4 Step 1.0.7.1 (B8 + B12 fix omxy R2+R3): Section 0~7 + Appendix schema-valid JSON fixture.
// `tudal/src/lib/data/report-section-schemas.ts:12-114` 실제 필드와 1:1 정합.
// validFullReportSections() = 객체, validFullReportJson() = JSON.stringify.
// caller DI test (full-report-writer-caller-di.test.ts 등)에서 import해 parseAndValidate → RPC 도달 검증에 사용.
// Section 8은 별도 (modern dual-shape) — 본 fixture에서는 제외.

export function validFullReportSections() {
  return {
    section_0: {
      headline: '근거 부족',
      thesis: ['근거 부족'],
      conviction: 50, // score0to100 (number 0~100, finite)
      committeeMini: {
        core: { approve: 0, reject: 0, abstain: 0 },
        sector: { approve: 0, reject: 0, abstain: 0 },
      },
      priceBands: { bear: '근거 부족', base: '근거 부족', bull: '근거 부족' },
    },
    section_1: {
      description: '근거 부족',
      segments: [], // {name,share}[]
      keyFacts: [], // {label,value}[]
    },
    section_2: {
      summary: '근거 부족',
      revenue: [], // {fy,value,yoy}[]
      margins: { operating: '근거 부족', net: '근거 부족' },
      balance: { debtRatio: '근거 부족', cash: '근거 부족' },
    },
    section_3: {
      summary: '근거 부족',
      multiples: [], // {metric,value,peer}[]
    },
    section_4: {
      summary: '근거 부족',
      drivers: [], // string[]
      tam: '근거 부족',
    },
    section_5: {
      summary: '근거 부족',
      risks: [], // {title,severity,detail}[]
    },
    section_6: {
      summary: '근거 부족',
      signals: [], // {name,state:'on'|'watch'|'off',note}[]
      axis: { trend: 50, momentum: 50, volatility: 50 }, // score0to100
      divergencePct: 0, // number (음수 허용, finite)
    },
    section_7: {
      summary: '근거 부족',
      triggers: [], // string[]
      alternatives: [], // {label,detail}[]
    },
    appendix: {
      technicals: [], // {name,value}[]
      dataSources: [], // string[]
    },
  };
}

export function validFullReportJson(): string {
  return JSON.stringify(validFullReportSections());
}
