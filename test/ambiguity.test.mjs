import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ambiguityReport, checkDayAnchor, checkFiveRats, chartDigest, differs, pillarsLine,
  solarTermsInSlot, verify,
} from '../src/index.js'

test('节气落在时段内：1990 立春 10:14 命中巳时（09:00–11:00），不命中辰时/午时', () => {
  const hit = solarTermsInSlot(1990, 2, 4, 5)
  assert.equal(hit.length, 1)
  assert.equal(hit[0].name, '立春')
  assert.equal(hit[0].minutesIntoSlot, 74)      // 10:14 − 09:00
  assert.equal(solarTermsInSlot(1990, 2, 4, 4).length, 0)   // 辰时 07:00–09:00
  assert.equal(solarTermsInSlot(1990, 2, 4, 6).length, 0)   // 午时 11:00–13:00
  assert.equal(solarTermsInSlot(1990, 5, 20, 5).length, 0)  // 非节气日
})

test('节气跨段：主盘按中点（立春前），相邻时段给出另一张盘（立春后）', () => {
  const rep = ambiguityReport(1990, 2, 4, 5)
  assert.equal(rep.term.length, 1)
  assert.equal(rep.main.yearGanZhi, '己巳')                    // 09:30 < 10:14
  const alts = rep.alternatives.filter(a => a.reason === 'solarTerm')
  assert.ok(alts.length >= 1)
  for (const a of alts) assert.ok(differs(rep.main, a.chart), `备选必须与主盘不同：${pillarsLine(a.chart)}`)
  const after = alts.find(a => a.hourIndex === 6)
  assert.ok(after, '应给出后移时段（午时）的备选')
  assert.equal(after.chart.yearGanZhi, '庚午')                 // 11:30 > 10:14
})

test('夏令时：命中时给出前移一格的备选盘；不命中时不给', () => {
  const rep = ambiguityReport(1990, 6, 15, 5)
  assert.ok(rep.dst)
  const dstAlts = rep.alternatives.filter(a => a.reason === 'dst')
  assert.equal(dstAlts.length, 1)
  assert.equal(dstAlts[0].hourIndex, 4)
  assert.ok(differs(rep.main, dstAlts[0].chart))
  assert.deepEqual(dstAlts[0].dstFrom, [4, 15])
  assert.deepEqual(dstAlts[0].dstTo, [9, 16])

  const later = ambiguityReport(2020, 6, 15, 5)
  assert.equal(later.dst, null)
  assert.equal(later.alternatives.filter(a => a.reason === 'dst').length, 0)
})

test('子时跨日：早子与晚子日柱不同，报告中标注流派', () => {
  const rep = ambiguityReport(1990, 6, 15, 0)
  assert.ok(rep.ziDay)
  assert.equal(rep.ziDay.school, 'early-zi')
  assert.ok(differs(rep.main, rep.ziDay.chart))
})

test('主盘永不因备选存在而被改动（不改判）', () => {
  const rep = ambiguityReport(1990, 6, 15, 5)
  assert.equal(pillarsLine(rep.main), '庚午 壬午 辛亥 癸巳')
})

test('自检：日柱锚点 与 五鼠遁', () => {
  const a = checkDayAnchor()
  assert.equal(a.anchorDayPillar, '甲子')
  assert.ok(a.anchorOk)
  assert.equal(a.daysBetween, 18140)
  assert.equal(a.mod60, 20)
  assert.equal(a.actual1900, '甲辰')
  assert.ok(a.crossCheckOk)

  const rats = checkFiveRats()
  assert.equal(rats.total, 10)
  assert.equal(rats.passed, 10, JSON.stringify(rats.rows.filter(r => !r.ok)))
})

test('指纹：同一批输入两次算出同一个摘要', () => {
  const d1 = chartDigest()
  const d2 = chartDigest()
  assert.equal(d1.digest, d2.digest)
  assert.equal(d1.cases, 8 * 7 * 6)
  assert.match(d1.digest, /^[0-9a-f]{8}$/)
})

test('指纹黄金值：0.1.0 = 8e0e9dc1（若此断言失败 → 排盘行为变了，先查 lunar-javascript 版本再谈发版）', () => {
  // 这条断言是本包对外的可复算承诺：336 张固定输入的盘必须逐字不变。
  // 升级 lunar-javascript 后如果这里挂了，不要直接改期望值 —— 先把差异逐张打印出来，
  // 判断是历表数据更新（可接受，需写进 CHANGELOG 并升 minor）还是实现回归（不可接受）。
  assert.equal(chartDigest().digest, '8e0e9dc1')
  assert.equal(chartDigest().cases, 336)
  assert.ok(verify({ expectDigest: '8e0e9dc1' }).ok)
})

test('verify() 一把过', () => {
  const v = verify()
  assert.ok(v.ok, JSON.stringify({ anchor: v.anchor, rats: v.rats.passed, digest: v.digest }))
})

test('verify({expectDigest}) 能识别行为变化', () => {
  const good = chartDigest().digest
  assert.ok(verify({ expectDigest: good }).ok)
  const bad = verify({ expectDigest: '00000000' })
  assert.equal(bad.ok, false)
  assert.equal(bad.reproducibilityOk, false)
})
