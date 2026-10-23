import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paipan, dayun, monthlyTable, lunarToSolar, assertSlot, assertDate, HOURS } from '../src/index.js'
import { pillarsLine } from '../src/index.js'

test('13 个时段，名称与区间固定', () => {
  assert.equal(HOURS.length, 13)
  assert.equal(HOURS[0].name, '早子时')
  assert.equal(HOURS[5].name, '巳时')
  assert.equal(HOURS[12].name, '晚子时')
  assert.equal(HOURS[5].range, '09:00-11:00')
})

test('排盘：固定输入 → 固定输出（黄金样本，换版本若变了必须解释）', () => {
  const cases = [
    { args: [1990, 5, 20, 4], expect: '庚午 辛巳 乙酉 庚辰' },   // 辰时 07:30
    { args: [1990, 2, 4, 5], expect: '己巳 丁丑 庚子 辛巳' },    // 巳时 09:30，早于立春 10:14
    { args: [1990, 2, 4, 4], expect: '己巳 丁丑 庚子 庚辰' },    // 辰时 07:30，同侧但时柱不同
    { args: [1990, 2, 4, 6], expect: '庚午 戊寅 庚子 壬午' },    // 午时 11:30，晚于立春 10:14 → 年柱已换
    { args: [1990, 6, 15, 5], expect: '庚午 壬午 辛亥 癸巳' },
    { args: [1949, 10, 1, 6], expect: '己丑 癸酉 甲子 庚午' },   // 日柱锚点
    { args: [2024, 2, 4, 5], expect: null },                    // 只校验可算且结构完整
  ]
  for (const c of cases) {
    const got = pillarsLine(paipan(...c.args))
    if (c.expect) assert.equal(got, c.expect, `${c.args.join('-')} → ${got}`)
    else assert.match(got, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥] /)
  }
})

test('时间粒度：同一时段内，分钟不参与计算（引擎固定取 HH:30）', () => {
  const c = paipan(1990, 5, 20, 4)   // 辰时 → 07:30
  assert.equal(c.computedAt, '1990-05-20 07:30')
  assert.equal(c.slot.index, 4)
  assert.equal(c.slot.name, '辰时')
})

test('时段号越界要抛错，不能静默当子时', () => {
  assert.throws(() => paipan(1990, 5, 20, 13), RangeError)
  assert.throws(() => paipan(1990, 5, 20, -1), RangeError)
  assert.throws(() => paipan(1990, 5, 20, 1.5), RangeError)
  assert.throws(() => assertSlot('x'), RangeError)
})

test('日期越界要抛错', () => {
  assert.throws(() => paipan(1990, 13, 1, 0), RangeError)
  assert.throws(() => paipan(1990, 0, 1, 0), RangeError)
  assert.throws(() => assertDate(1990, 2, 32), RangeError)
})

test('农历转公历', () => {
  const s = lunarToSolar(1990, 1, 1, false)
  assert.deepEqual(Object.keys(s).sort(), ['day', 'month', 'year'])
  assert.ok(s.year === 1990)
})

test('流月表 12 行，每行干支两个字', () => {
  const rows = monthlyTable(1990)
  assert.equal(rows.length, 12)
  for (const r of rows) assert.match(r.ganzhi, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/)
})

test('大运：起运年与序列结构', () => {
  const dy = dayun(1990, 5, 20, 4, '男')
  assert.ok(Number.isFinite(dy.startYear))
  assert.ok(dy.list.length > 0)
  for (const d of dy.list) {
    assert.ok(typeof d.startAge === 'number')
    assert.ok(typeof d.ganZhi === 'string')
  }
})

test('大运：性别非法要抛错', () => {
  assert.throws(() => dayun(1990, 5, 20, 4, '男男'), RangeError)
})
