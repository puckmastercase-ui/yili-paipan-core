import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CHINA_DST_WINDOWS, CONVENTIONS, DAY_PILLAR_ANCHOR, HOURS, ZI_SECT, ZI_SCHOOL,
  chinaDstWindow, prevSlot, nextSlot, slotRange, slotName,
} from '../src/index.js'

test('公开约定齐备且自洽', () => {
  assert.equal(CONVENTIONS.slotGranularity, 'midpoint')
  assert.equal(CONVENTIONS.slotMidpointMinute, 30)
  assert.equal(CONVENTIONS.ziSchool, 'early-zi')
  assert.equal(CONVENTIONS.ziSect, 1)
  assert.equal(ZI_SECT, 1)
  assert.equal(ZI_SCHOOL, 'early-zi')
  assert.equal(CONVENTIONS.yearBoundary, 'lichun-exact')
  assert.equal(CONVENTIONS.monthBoundary, 'jie-exact-utc+8')
  assert.equal(CONVENTIONS.hourStemRule, 'five-rats')
  // 未实现的两项必须如实写明，不能是 true
  assert.equal(CONVENTIONS.trueSolarTime, false)
  assert.equal(CONVENTIONS.historicalDst, 'not-applied')
  assert.equal(CONVENTIONS.supportedYears, null)
})

test('日柱锚点常量：1949-10-01 = 甲子', () => {
  assert.deepEqual(DAY_PILLAR_ANCHOR, { year: 1949, month: 10, day: 1, ganzhi: '甲子', index: 0 })
})

test('夏令时：六段区间、起止精确，端点包含', () => {
  assert.equal(CHINA_DST_WINDOWS.length, 6)
  assert.deepEqual(CHINA_DST_WINDOWS[0], { year: 1986, from: [5, 4], to: [9, 14] })
  assert.deepEqual(CHINA_DST_WINDOWS[5], { year: 1991, from: [4, 14], to: [9, 15] })
  // 命中
  assert.ok(chinaDstWindow(1990, 6, 15))
  assert.ok(chinaDstWindow(1986, 5, 4))     // 首日
  assert.ok(chinaDstWindow(1991, 9, 15))    // 末日
  // 不命中
  assert.equal(chinaDstWindow(1990, 3, 1), null)
  assert.equal(chinaDstWindow(1991, 9, 16), null)
  assert.equal(chinaDstWindow(1992, 6, 15), null)   // 已停止
  assert.equal(chinaDstWindow(1985, 6, 15), null)   // 尚未开始
})

test('时段几何：区间与前后移位', () => {
  assert.deepEqual(slotRange(5), [540, 660])      // 巳时 09:00–11:00
  assert.deepEqual(slotRange(0), [1380, 1500])    // 早子时 23:00–25:00 跨日
  assert.deepEqual(slotRange(12), [1380, 1440])   // 晚子时 23:00–24:00
  assert.equal(prevSlot(0), 11)
  assert.equal(prevSlot(12), 11)
  assert.equal(nextSlot(0), 1)
  assert.equal(nextSlot(12), 0)
})

test('时段名支持繁体', () => {
  assert.equal(slotName(5), '巳时')
  assert.equal(slotName(5, 'tw'), '巳時')
  assert.equal(slotName(0, 'tw'), '早子時')
  assert.equal(slotName(12, 'tw'), '晚子時')
  assert.equal(slotName(99), null)
  // 13 个名称的繁体形式都必须以「時」结尾
  for (let i = 0; i < HOURS.length; i++) assert.match(slotName(i, 'tw'), /時$/)
})
