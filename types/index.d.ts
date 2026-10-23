export interface HourSlot {
  index: number
  name: string
  nameTw: string
  range: string
}

export interface Chart {
  yearGanZhi: string
  monthGanZhi: string
  dayGanZhi: string
  timeGanZhi: string
  dayStem: string
  dayBranch: string
  lunarText: string
  zodiac: string
  yearNaYin: string
  slot: { index: number; name: string; range: string }
  computedAt: string
}

export interface DstWindow {
  year: number
  from: [number, number]
  to: [number, number]
}

export interface TermInSlot {
  name: string
  ymdhms: string
  minutesIntoSlot: number
}

export interface Alternative {
  reason: 'dst' | 'solarTerm'
  hourIndex: number
  chart: Chart
  dstFrom?: [number, number]
  dstTo?: [number, number]
  termName?: string
  termAt?: string
}

export interface AmbiguityReport {
  main: Chart
  dst: DstWindow | null
  term: TermInSlot[]
  ziDay: { school: string; hourIndex: number; chart: Chart } | null
  alternatives: Alternative[]
}

export interface VerifyResult {
  anchor: {
    anchor: string
    anchorDayPillar: string
    anchorOk: boolean
    daysBetween: number
    mod60: number
    expected1900: string
    actual1900: string
    crossCheckOk: boolean
  }
  rats: { rows: Array<{ date: string; dayStem: string; hourPillar: string; expect: string; ok: boolean }>; passed: number; total: number }
  digest: { cases: number; digest: string }
  reproducibilityOk: boolean
  ok: boolean
}

export declare const HOURS: HourSlot[]
export declare const HOUR_CLOCK: number[]
export declare const SLOT_MIDPOINT_MINUTES: number
export declare const ZI_SECT: number
export declare const ZI_SCHOOL: string
export declare const YEAR_BOUNDARY: string
export declare const MONTH_BOUNDARY: string
export declare const DAY_PILLAR_ANCHOR: { year: number; month: number; day: number; ganzhi: string; index: number }
export declare const HOUR_STEM_RULE: string
export declare const CHINA_DST_WINDOWS: DstWindow[]
export declare const CONVENTIONS: {
  slotGranularity: string
  slotMidpointMinute: number
  hourSlots: number
  ziSchool: string
  ziSect: number
  yearBoundary: string
  monthBoundary: string
  dayPillarAnchor: typeof DAY_PILLAR_ANCHOR
  hourStemRule: string
  trueSolarTime: false
  historicalDst: string
  supportedYears: null
}

export declare function paipan(year: number, month: number, day: number, hourIndex: number): Chart
export declare function dayun(year: number, month: number, day: number, hourIndex: number, gender: '男' | '女' | 'male' | 'female'): {
  startYear: number
  list: Array<{ index: number; startAge: number; endAge: number; startYear: number; endYear: number; ganZhi: string }>
}
export declare function monthlyTable(year: number): Array<{ month: number; name: string; ganzhi: string; stem: string; branch: string }>
export declare function lunarToSolar(lunarYear: number, lunarMonth: number, lunarDay: number, isLeap?: boolean): { year: number; month: number; day: number }
export declare function assertSlot(hourIndex: unknown): number
export declare function assertDate(year: unknown, month: unknown, day: unknown): { year: number; month: number; day: number }

export declare function chinaDstWindow(year: number, month: number, day: number): DstWindow | null
export declare function solarTermsInSlot(year: number, month: number, day: number, hourIndex: number): TermInSlot[]
export declare function ambiguityReport(year: number, month: number, day: number, hourIndex: number): AmbiguityReport
export declare function prevSlot(hourIndex: number): number
export declare function nextSlot(hourIndex: number): number
export declare function slotRange(hourIndex: number): [number, number]
export declare function slotName(hourIndex: number, lang?: 'zh' | 'tw'): string | null
export declare function differs(a: Chart, b: Chart): boolean
export declare function pillarsLine(c: Chart): string

export declare function verify(opts?: { expectDigest?: string }): VerifyResult
export declare function checkDayAnchor(): VerifyResult['anchor']
export declare function checkFiveRats(): VerifyResult['rats']
export declare function chartDigest(): VerifyResult['digest']
