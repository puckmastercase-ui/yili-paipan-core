/**
 * 全部公开约定 —— 这个包存在的理由就是把这些写死并可以被断言。
 *
 * 每一项都对应 yilibazi.com/method.html 上公开的一句话；改实现必须同步改这里，
 * 否则 test/conventions.test.mjs 会失败。
 */

/** 13 个可选时段（与站点表单一一对应） */
export const HOURS = [
  { index: 0, name: '早子时', nameTw: '早子時', range: '23:00-01:00' },
  { index: 1, name: '丑时', nameTw: '丑時', range: '01:00-03:00' },
  { index: 2, name: '寅时', nameTw: '寅時', range: '03:00-05:00' },
  { index: 3, name: '卯时', nameTw: '卯時', range: '05:00-07:00' },
  { index: 4, name: '辰时', nameTw: '辰時', range: '07:00-09:00' },
  { index: 5, name: '巳时', nameTw: '巳時', range: '09:00-11:00' },
  { index: 6, name: '午时', nameTw: '午時', range: '11:00-13:00' },
  { index: 7, name: '未时', nameTw: '未時', range: '13:00-15:00' },
  { index: 8, name: '申时', nameTw: '申時', range: '15:00-17:00' },
  { index: 9, name: '酉时', nameTw: '酉時', range: '17:00-19:00' },
  { index: 10, name: '戌时', nameTw: '戌時', range: '19:00-21:00' },
  { index: 11, name: '亥时', nameTw: '亥時', range: '21:00-23:00' },
  { index: 12, name: '晚子时', nameTw: '晚子時', range: '23:00-24:00' },
]

/** 每个时段用于计算的钟点（排盘一律取时段中点 = 该小时 +30 分） */
export const HOUR_CLOCK = [0, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23]

/**
 * 排盘时间粒度：一律取所选时段的**中点**（HH:30），不使用用户输入的分钟数。
 * 后果：节气时刻落在所选时段内部时，同段另一侧的出生会得到不同的柱 —— 用
 * ambiguityReport() 把另一张盘一起取出来，不要自行纠正。
 */
export const SLOT_MIDPOINT_MINUTES = 30

/** 换日流派：早子派（日柱进次日，时干取次日日干）。对应 lunar-javascript 的 sect = 1 */
export const ZI_SECT = 1
export const ZI_SCHOOL = 'early-zi'

/** 换年：立春的**精确时刻**（非正月初一、非公历 1 月 1 日） */
export const YEAR_BOUNDARY = 'lichun-exact'

/** 换月：十二「节」的**精确时刻**（定气法），按东八区计 */
export const MONTH_BOUNDARY = 'jie-exact-utc+8'

/** 日柱锚点：1949-10-01 = 甲子（干支序 0）。六十甲子日序不间断 */
export const DAY_PILLAR_ANCHOR = { year: 1949, month: 10, day: 1, ganzhi: '甲子', index: 0 }

/** 时干推法：五鼠遁 */
export const HOUR_STEM_RULE = 'five-rats'

/**
 * 我国实行夏令时的六个年度，起止均为当地钟表日期（含端点）。
 * 本包**不**自动回拨 —— 用 chinaDstWindow() 判定后由调用方决定，或用 ambiguityReport() 取备选盘。
 */
export const CHINA_DST_WINDOWS = [
  { year: 1986, from: [5, 4], to: [9, 14] },
  { year: 1987, from: [4, 12], to: [9, 13] },
  { year: 1988, from: [4, 10], to: [9, 11] },
  { year: 1989, from: [4, 16], to: [9, 17] },
  { year: 1990, from: [4, 15], to: [9, 16] },
  { year: 1991, from: [4, 14], to: [9, 15] },
]

/** 结构化汇总：便于调用方一次性打印/校验本站口径 */
export const CONVENTIONS = {
  slotGranularity: 'midpoint',
  slotMidpointMinute: SLOT_MIDPOINT_MINUTES,
  hourSlots: HOURS.length,
  ziSchool: ZI_SCHOOL,
  ziSect: ZI_SECT,
  yearBoundary: YEAR_BOUNDARY,
  monthBoundary: MONTH_BOUNDARY,
  dayPillarAnchor: DAY_PILLAR_ANCHOR,
  hourStemRule: HOUR_STEM_RULE,
  trueSolarTime: false,      // 未实现：不做经度/均时差校正
  historicalDst: 'not-applied', // 只报告，不自动回拨
  supportedYears: null,       // 未声明：底层历表会静默外推
}
