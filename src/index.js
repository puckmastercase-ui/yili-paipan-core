/**
 * yilibazi-core —— 确定性四柱排盘核心，并把所有边界约定写死、可断言。
 *
 * 与其它排盘库的区别只有一句话：**它不替你判断哪种约定是对的，它把会改变答案的地方指出来，
 * 并把另一张盘一起给你。**
 *
 *   import { paipan, ambiguityReport, CONVENTIONS } from 'yilibazi-core'
 *
 *   paipan(1990, 2, 4, 5)        // 巳时按 09:30 计算
 *   ambiguityReport(1990, 2, 4, 5)  // 立春 10:14 落在此段内 → 同时给出相邻时段的盘
 */
export {
  HOURS,
  HOUR_CLOCK,
  SLOT_MIDPOINT_MINUTES,
  ZI_SECT,
  ZI_SCHOOL,
  YEAR_BOUNDARY,
  MONTH_BOUNDARY,
  DAY_PILLAR_ANCHOR,
  HOUR_STEM_RULE,
  CHINA_DST_WINDOWS,
  CONVENTIONS,
} from './conventions.js'

export {
  paipan,
  dayun,
  monthlyTable,
  lunarToSolar,
  assertSlot,
  assertDate,
} from './bazi.js'

export {
  chinaDstWindow,
  solarTermsInSlot,
  ambiguityReport,
  prevSlot,
  nextSlot,
  slotRange,
  slotName,
  differs,
  pillarsLine,
} from './ambiguity.js'

export { verify, checkDayAnchor, checkFiveRats, chartDigest } from './verify.js'
