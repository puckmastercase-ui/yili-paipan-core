/**
 * 「同一个输入，换约定会得到不同的盘」—— 把不确定算出来，并把另一张盘一并给出。
 *
 * 本包不替调用方改判：主盘始终是按声明约定算出的那张，备选盘单独列在 alternatives 里。
 * 三类不确定（与 https://www.yilibazi.com/method.html 公开的口径一一对应）：
 *   ① 历史夏令时（我国 1986–1991）：出生记录写的是夏令时钟表时间
 *   ② 节气时刻落在所选时段内部：按时段中点计算，同段另一侧出生会得到不同的柱
 *   ③ 子时跨日：早子派（本包）与分子派／纯粹晚子派的日柱不同
 */
import { Solar } from 'lunar-javascript'
import { paipan } from './bazi.js'
import { HOURS, CHINA_DST_WINDOWS, ZI_SCHOOL } from './conventions.js'

export { CHINA_DST_WINDOWS }

/** 该公历日期是否落在夏令时区间内（含端点）；返回区间或 null */
export function chinaDstWindow(year, month, day) {
  const w = CHINA_DST_WINDOWS.find(x => x.year === Number(year))
  if (!w) return null
  const md = Number(month) * 100 + Number(day)
  const from = w.from[0] * 100 + w.from[1]
  const to = w.to[0] * 100 + w.to[1]
  return md >= from && md <= to ? w : null
}

/** 时段往前挪一格（-1 小时）；早子时（0）往前是亥时 */
export function prevSlot(hourIndex) {
  const i = Number(hourIndex)
  return i === 0 ? 11 : i - 1
}

/** 时段往后挪一格（+1 小时）；晚子时（12）之后回到早子时 */
export function nextSlot(hourIndex) {
  const i = Number(hourIndex)
  return i === 12 ? 0 : i + 1
}

/** 时段的钟表区间（分钟，左闭右开；跨日时段右端可大于 1440） */
export function slotRange(hourIndex) {
  const i = Number(hourIndex)
  if (i === 0) return [23 * 60, 25 * 60]    // 早子时 23:00–01:00
  if (i === 12) return [23 * 60, 24 * 60]   // 晚子时 23:00–24:00
  const start = i * 2 - 1                    // 丑时 01:00 起
  return [start * 60, (start + 2) * 60]
}

function jieQiNear(year, month, day) {
  try {
    return Solar.fromYmd(Number(year), Number(month), Number(day)).getLunar().getJieQiTable() || {}
  } catch (e) {
    return {}
  }
}

function isPrevDay(s, y, m, d) {
  const t = new Date(Number(y), Number(m) - 1, Number(d))
  t.setDate(t.getDate() - 1)
  return s.getYear() === t.getFullYear() && s.getMonth() === t.getMonth() + 1 && s.getDay() === t.getDate()
}

/**
 * 落在所选时段**内部**的节气（十二节与十二气都算，凡可能改变月柱/年柱的）。
 * @returns {Array<{name, ymdhms, minutesIntoSlot}>}
 */
export function solarTermsInSlot(year, month, day, hourIndex) {
  const i = Number(hourIndex)
  const [from, to] = slotRange(i)
  const out = []
  const seen = new Set()
  for (const t of [jieQiNear(year, month, day - 1), jieQiNear(year, month, day), jieQiNear(year, month, day + 1)]) {
    for (const [name, s] of Object.entries(t)) {
      if (!s || typeof s.getYear !== 'function') continue
      const key = name + s.toYmdHms()
      if (seen.has(key)) continue
      seen.add(key)
      const minutes = s.getHour() * 60 + s.getMinute()
      const sameDay = s.getYear() === Number(year) && s.getMonth() === Number(month) && s.getDay() === Number(day)
      if (i === 0 || i === 12) {
        // 跨日时段：[23:00, 次日 01:00 / 24:00)
        if (sameDay && minutes >= from) out.push({ name, ymdhms: s.toYmdHms(), minutesIntoSlot: minutes - from })
      } else if (sameDay && minutes >= from && minutes < to) {
        out.push({ name, ymdhms: s.toYmdHms(), minutesIntoSlot: minutes - from })
      }
      void isPrevDay
    }
  }
  return out.sort((a, b) => a.minutesIntoSlot - b.minutesIntoSlot)
}

/** 两张盘的四柱是否不同 */
export function differs(a, b) {
  return a.yearGanZhi !== b.yearGanZhi || a.monthGanZhi !== b.monthGanZhi ||
         a.dayGanZhi !== b.dayGanZhi || a.timeGanZhi !== b.timeGanZhi
}

/** 四柱一行显示 */
export function pillarsLine(c) {
  return `${c.yearGanZhi} ${c.monthGanZhi} ${c.dayGanZhi} ${c.timeGanZhi}`
}

/**
 * 汇总报告：主盘 + 每一处「换约定就会变」的备选盘（不改判）。
 * @returns {{main, dst, term, ziDay, alternatives: Array<{reason, hourIndex, chart, ...}>}}
 */
export function ambiguityReport(year, month, day, hourIndex) {
  const i = Number(hourIndex)
  const main = paipan(year, month, day, i)
  const alternatives = []

  // ① 夏令时：记录时间是夏令时钟表时间 → 标准时 = 记录 − 1 小时
  const dst = chinaDstWindow(year, month, day)
  if (dst) {
    const alt = prevSlot(i)
    const chart = paipan(year, month, day, alt)
    if (differs(main, chart)) {
      alternatives.push({ reason: 'dst', hourIndex: alt, chart, dstFrom: dst.from, dstTo: dst.to })
    }
  }

  // ② 节气落在所选时段内
  const term = solarTermsInSlot(year, month, day, i)
  if (term.length) {
    for (const alt of [prevSlot(i), nextSlot(i)]) {
      const chart = paipan(year, month, day, alt)
      if (differs(main, chart)) {
        alternatives.push({ reason: 'solarTerm', hourIndex: alt, chart, termName: term[0].name, termAt: term[0].ymdhms })
      }
    }
  }

  // ③ 子时跨日
  let ziDay = null
  if (i === 0 || i === 12) {
    const alt = paipan(year, month, day, i === 0 ? 12 : 0)
    if (differs(main, alt)) ziDay = { school: ZI_SCHOOL, hourIndex: i === 0 ? 12 : 0, chart: alt }
  }

  return { main, dst, term, ziDay, alternatives }
}

/** 时段名（可按语言取繁体） */
export function slotName(hourIndex, lang = 'zh') {
  const h = HOURS[Number(hourIndex)]
  if (!h) return null
  return lang === 'tw' ? h.nameTw : h.name
}
