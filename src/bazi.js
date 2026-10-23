/**
 * 四柱排盘核心（确定性，无网络、无随机、无 AI）。
 *
 * 依赖 lunar-javascript（MIT）作为历表；本文件只负责把时段 → 钟点 → 四柱的映射写死并公开。
 * 所有约定集中在 ./conventions.js。
 */
import { Solar, Lunar } from 'lunar-javascript'
import { HOURS, HOUR_CLOCK, ZI_SECT, SLOT_MIDPOINT_MINUTES } from './conventions.js'

export { HOURS, HOUR_CLOCK }

/** 校验时段号；越界直接抛错，不静默取 0（静默取 0 会把半夜的盘排成子时） */
export function assertSlot(hourIndex) {
  const i = Number(hourIndex)
  if (!Number.isInteger(i) || i < 0 || i > 12) {
    throw new RangeError(`hourIndex 必须是 0–12 的整数（13 个时段），收到 ${hourIndex}`)
  }
  return i
}

/** 校验公历年月日 */
export function assertDate(year, month, day) {
  const y = Number(year), m = Number(month), d = Number(day)
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) ||
      m < 1 || m > 12 || d < 1 || d > 31) {
    throw new RangeError(`非法日期：${year}-${month}-${day}`)
  }
  return { year: y, month: m, day: d }
}

/**
 * 排四柱。
 * @param {number} year 公历年
 * @param {number} month 公历月 1–12
 * @param {number} day 公历日
 * @param {number} hourIndex 时段号 0–12（见 HOURS）
 * @returns {{yearGanZhi, monthGanZhi, dayGanZhi, timeGanZhi, dayStem, dayBranch,
 *            lunarText, zodiac, yearNaYin, slot, computedAt}}
 */
export function paipan(year, month, day, hourIndex) {
  const i = assertSlot(hourIndex)
  const d = assertDate(year, month, day)
  const clock = HOUR_CLOCK[i]
  const solar = Solar.fromYmdHms(d.year, d.month, d.day, clock, SLOT_MIDPOINT_MINUTES, 0)
  const lunar = solar.getLunar()
  const ec = lunar.getEightChar()
  ec.setSect(ZI_SECT)
  return {
    yearGanZhi: ec.getYear(),
    monthGanZhi: ec.getMonth(),
    dayGanZhi: ec.getDay(),
    timeGanZhi: ec.getTime(),
    dayStem: ec.getDay()[0],
    dayBranch: ec.getDay()[1],
    lunarText: lunar.toString(),
    zodiac: lunar.getYearShengXiao(),
    yearNaYin: ec.getYearNaYin(),
    slot: { index: i, name: HOURS[i].name, range: HOURS[i].range },
    computedAt: `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')} ${String(clock).padStart(2, '0')}:${SLOT_MIDPOINT_MINUTES}`,
  }
}

/** 农历 → 公历（不做合法性外的额外推断） */
export function lunarToSolar(lunarYear, lunarMonth, lunarDay, isLeap = false) {
  const lunar = Lunar.fromYmd(lunarYear, lunarMonth, lunarDay)
  const solar = lunar.getSolar()
  return { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() }
}

/** 某公历年逐月的月柱（用于流月表） */
export function monthlyTable(year) {
  const names = ['', '正月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '冬月', '腊月']
  const out = []
  for (let m = 1; m <= 12; m++) {
    const lunar = Solar.fromYmd(Number(year), m, 15).getLunar()
    const gz = lunar.getMonthInGanZhi()
    out.push({ month: m, name: names[m], ganzhi: gz, stem: gz[0], branch: gz[1] })
  }
  return out
}

/**
 * 大运序列。起运与四柱使用同一换日规则（ZI_SECT），避免起运与四柱不一致。
 * @returns {{list: Array, startYear?: number, ...}}
 */
export function dayun(year, month, day, hourIndex, gender) {
  const i = assertSlot(hourIndex)
  const d = assertDate(year, month, day)
  if (gender !== '男' && gender !== '女' && gender !== 'male' && gender !== 'female') {
    throw new RangeError(`gender 必须是 男/女（或 male/female），收到 ${gender}`)
  }
  const clock = HOUR_CLOCK[i]
  const lunar = Solar.fromYmdHms(d.year, d.month, d.day, clock, SLOT_MIDPOINT_MINUTES, 0).getLunar()
  const ec = lunar.getEightChar()
  ec.setSect(ZI_SECT)   // 与 paipan 同一换日规则
  const g = (gender === '男' || gender === 'male') ? 1 : 0
  const yun = ec.getYun(g)
  const startYear = yun.getStartYear()
  const list = []
  const daYunArr = yun.getDaYun()
  for (let k = 0; k < daYunArr.length; k++) {
    const dy = daYunArr[k]
    list.push({
      index: k,
      startAge: dy.getStartAge(),
      endAge: dy.getEndAge(),
      startYear: dy.getStartYear(),
      endYear: dy.getEndYear(),
      ganZhi: dy.getGanZhi(),
    })
  }
  return { startYear, list }
}
