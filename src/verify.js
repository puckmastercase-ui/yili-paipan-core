/**
 * 自检：这个包不要求你相信作者，只要求你能复算。
 *
 * 三项检查（全部可在 CI 里跑，不依赖网络）：
 *   ① 日柱锚点：1949-10-01 = 甲子，且 1900-01-31 必须是甲辰（18140 mod 60 = 20）
 *   ② 五鼠遁：十个日干逐一抽查子时时干
 *   ③ 指纹：对一批固定输入算出的四柱做稳定摘要 —— 换版本后摘要变了就说明排盘行为变了
 */
import { paipan } from './bazi.js'
import { DAY_PILLAR_ANCHOR } from './conventions.js'

const GAN = '甲乙丙丁戊己庚辛壬癸'
const RAT = { 甲: '甲', 己: '甲', 乙: '丙', 庚: '丙', 丙: '戊', 辛: '戊', 丁: '庚', 壬: '庚', 戊: '壬', 癸: '壬' }

/** ① 日柱锚点 */
export function checkDayAnchor() {
  const a = paipan(DAY_PILLAR_ANCHOR.year, DAY_PILLAR_ANCHOR.month, DAY_PILLAR_ANCHOR.day, 6)
  const days = Math.round((Date.UTC(1949, 9, 1) - Date.UTC(1900, 0, 31)) / 86400000)
  const idx = ((-days) % 60 + 60) % 60
  const expected = GAN[idx % 10] + '子丑寅卯辰巳午未申酉戌亥'[idx % 12]
  const b = paipan(1900, 1, 31, 6)
  return {
    anchor: `${DAY_PILLAR_ANCHOR.year}-${String(DAY_PILLAR_ANCHOR.month).padStart(2, '0')}-${String(DAY_PILLAR_ANCHOR.day).padStart(2, '0')}`,
    anchorDayPillar: a.dayGanZhi,
    anchorOk: a.dayGanZhi === DAY_PILLAR_ANCHOR.ganzhi,
    daysBetween: days,
    mod60: ((days % 60) + 60) % 60,
    expected1900: expected,
    actual1900: b.dayGanZhi,
    crossCheckOk: expected === b.dayGanZhi,
  }
}

/** ② 五鼠遁：十个日干逐一抽查（取早子时，时干必须等于由日干推出的那个） */
export function checkFiveRats() {
  const rows = []
  // 1990-05-01 起连取 10 天，十天干必然轮一遍
  for (let d = 1; d <= 10; d++) {
    const c = paipan(1990, 5, d, 0)
    const expect = RAT[c.dayStem]
    rows.push({ date: `1990-05-${String(d).padStart(2, '0')}`, dayStem: c.dayStem, hourPillar: c.timeGanZhi, expect, ok: c.timeGanZhi[0] === expect })
  }
  return { rows, passed: rows.filter(r => r.ok).length, total: rows.length }
}

/** ③ 指纹：一批固定输入 → 稳定摘要（FNV-1a 32 位，纯 JS，无依赖） */
export function chartDigest() {
  const parts = []
  for (const y of [1900, 1950, 1989, 1990, 2000, 2024, 2026, 2100]) {
    for (const m of [1, 2, 4, 6, 8, 10, 12]) {
      for (const slot of [0, 2, 5, 8, 11, 12]) {
        const c = paipan(y, m, 15, slot)
        parts.push(`${y}${String(m).padStart(2, '0')}${slot}:${c.yearGanZhi}${c.monthGanZhi}${c.dayGanZhi}${c.timeGanZhi}`)
      }
    }
  }
  const s = parts.join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0
  }
  return { cases: parts.length, digest: ('00000000' + h.toString(16)).slice(-8) }
}

/**
 * 一把跑完全部自检。
 * @param {{expectDigest?: string}} [opts] 传入已知摘要 → 摘要不符则 reproducibilityOk=false
 */
export function verify(opts = {}) {
  const anchor = checkDayAnchor()
  const rats = checkFiveRats()
  const digest = chartDigest()
  const reproducibilityOk = opts.expectDigest ? opts.expectDigest === digest.digest : true
  return {
    anchor, rats, digest,
    reproducibilityOk,
    ok: anchor.anchorOk && anchor.crossCheckOk && rats.passed === rats.total && reproducibilityOk,
  }
}
