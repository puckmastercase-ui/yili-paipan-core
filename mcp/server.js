#!/usr/bin/env node
/**
 * yilibazi-core MCP server（stdio · JSON-RPC 2.0 · **运行时零依赖**）
 *
 * 为什么手写而不是用 @modelcontextprotocol/sdk ✗：
 *   本包对外承诺「零网络、零随机、只有一个历表依赖」✓ 引 SDK 会给使用者带进 20+ 个包 ✗
 *   MCP 的 stdio 传输就是「按行分隔的 JSON-RPC 2.0」✓ 协议面很小 ✓
 *   → 用官方 SDK 作为 **devDependency 的客户端**来验证本实现 ✓（见 test/mcp-sdk.test.mjs）
 *
 * 不做什么（与 reports/2026-10-23/public-boundary-v1.0.md 一致）：
 *   · 不做解读、不判旺衰格局、不给吉凶 ✗
 *   · 不联网、不读环境变量、不写任何文件 ✗
 *   · 不做静默兜底：参数越界一律返回错误并提示合法范围 ✓
 *
 * 用法：node mcp/server.js        （或 npx yilibazi-core-mcp / npm exec --package=yilibazi-core yilibazi-core-mcp）
 */
import { createInterface } from 'node:readline'
import { Solar } from 'lunar-javascript'
import {
  paipan, ambiguityReport, solarTermsInSlot, verify, chartDigest,
  CONVENTIONS, HOURS, HOUR_CLOCK, SLOT_MIDPOINT_MINUTES, ZI_SCHOOL,
  DAY_PILLAR_ANCHOR, HOUR_STEM_RULE, CHINA_DST_WINDOWS,
  pillarsLine, slotName, slotRange,
} from '../src/index.js'

const SERVER_NAME = 'yilibazi-core'
const SERVER_VERSION = '0.2.0'
const SUPPORTED_PROTOCOLS = ['2025-06-18', '2025-03-26', '2024-11-05']

// ── 工具定义 ────────────────────────────────────────────────────────────
const SLOT_HELP = HOURS.map(h => `${h.index}=${h.name}(${h.range})`).join(', ')

const TOOLS = [
  {
    name: 'bazi_paipan',
    description:
      'Compute the Four Pillars (BaZi / 八字) for a birth date and one of 13 two-hour slots. ' +
      'Deterministic and offline. Conventions: month and year pillars switch at the EXACT solar-term instants ' +
      '(jie / Lichun, not calendar or Lunar New Year dates); the chart is computed at the MIDPOINT of the chosen ' +
      'slot (HH:30), so the exact minute is not used; a 23:00-24:00 birth advances the day pillar (early-Zi school) ' +
      'and the hour stem follows the next day. Returns pillars plus the computed timestamp so the result can be ' +
      `checked by hand. Does NOT interpret the chart. Slot index: ${SLOT_HELP}.`,
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: 'Gregorian year, e.g. 1990' },
        month: { type: 'integer', minimum: 1, maximum: 12, description: 'Gregorian month 1-12' },
        day: { type: 'integer', minimum: 1, maximum: 31, description: 'Gregorian day 1-31' },
        hour_index: { type: 'integer', minimum: 0, maximum: 12, description: `Slot index: ${SLOT_HELP}` },
      },
      required: ['year', 'month', 'day', 'hour_index'],
      additionalProperties: false,
    },
  },
  {
    name: 'bazi_ambiguity',
    description:
      'Given the same birth input as bazi_paipan, report every place where a boundary convention would change the ' +
      'answer, and return the ALTERNATIVE chart(s) alongside the primary one. Three sources: (1) China daylight ' +
      'saving 1986-1991, when recorded clock times were one hour ahead; (2) a solar-term instant falling INSIDE the ' +
      'selected two-hour slot, so births in the other half of that slot belong to a different month/year pillar; ' +
      '(3) the day-rollover school for zi-hour births. Use this whenever a birth time is near a boundary, and when ' +
      'someone asks why two calculators disagree. The primary chart is never silently altered.',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer' },
        month: { type: 'integer', minimum: 1, maximum: 12 },
        day: { type: 'integer', minimum: 1, maximum: 31 },
        hour_index: { type: 'integer', minimum: 0, maximum: 12, description: `Slot index: ${SLOT_HELP}` },
      },
      required: ['year', 'month', 'day', 'hour_index'],
      additionalProperties: false,
    },
  },
  {
    name: 'bazi_solar_terms',
    description:
      'Solar-term (节气) instants. With only `year`: the 12 jie boundaries of that year with exact UTC+8 timestamps — ' +
      'use these to verify that a month/year pillar switches at the right moment. With year+month+day+hour_index: ' +
      'the term (if any) that falls INSIDE that two-hour slot, and how many minutes into the slot it occurs.',
    inputSchema: {
      type: 'object',
      properties: {
        year: { type: 'integer', description: 'Gregorian year, e.g. 1990' },
        month: { type: 'integer', minimum: 1, maximum: 12 },
        day: { type: 'integer', minimum: 1, maximum: 31 },
        hour_index: { type: 'integer', minimum: 0, maximum: 12, description: `Optional. ${SLOT_HELP}` },
      },
      required: ['year'],
      additionalProperties: false,
    },
  },
  {
    name: 'bazi_verify',
    description:
      'Run this library\'s own offline self-checks and return the evidence: the day-pillar anchor ' +
      '(1949-10-01 = 甲子) with its cross-check (1900-01-31 must be 甲辰), the Five Rats (五鼠遁) hour-stem check ' +
      'across all ten day stems, and a digest over 336 fixed charts. Also returns the declared conventions and the ' +
      'known gaps (no true-solar-time correction, no automatic DST adjustment, no declared supported year range). ' +
      'Use it to state what the engine does and does not guarantee, rather than asserting accuracy.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
]

// ── 工具实现 ────────────────────────────────────────────────────────────
function needNumber(args, key, { min, max, int = true } = {}) {
  const raw = args?.[key]
  const n = typeof raw === 'string' ? Number(raw) : raw
  if (n === undefined || n === null || n === '') throw new Error(`缺少参数 ${key}`)
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error(`参数 ${key} 必须是数字，收到 ${JSON.stringify(raw)}`)
  if (int && !Number.isInteger(n)) throw new Error(`参数 ${key} 必须是整数，收到 ${n}`)
  if (min !== undefined && n < min) throw new Error(`参数 ${key} 不能小于 ${min}，收到 ${n}`)
  if (max !== undefined && n > max) throw new Error(`参数 ${key} 不能大于 ${max}，收到 ${n}`)
  return n
}

function toolPaipan(args) {
  const year = needNumber(args, 'year')
  const month = needNumber(args, 'month', { min: 1, max: 12 })
  const day = needNumber(args, 'day', { min: 1, max: 31 })
  const h = needNumber(args, 'hour_index', { min: 0, max: 12 })
  const c = paipan(year, month, day, h)
  return {
    pillars: {
      year: c.yearGanZhi, month: c.monthGanZhi, day: c.dayGanZhi, hour: c.timeGanZhi,
      line: pillarsLine(c),
    },
    day_master: c.dayStem,
    slot: { index: c.slot.index, name: c.slot.name, name_tw: slotName(c.slot.index, 'tw'), range: c.slot.range },
    computed_at: `${c.computedAt} (UTC+8)`,
    lunar: c.lunarText,
    zodiac: c.zodiac,
    year_nayin: c.yearNaYin,
    conventions: {
      slot_granularity: `midpoint (HH:${String(SLOT_MIDPOINT_MINUTES).padStart(2, '0')})`,
      zi_school: ZI_SCHOOL,
      year_boundary: 'exact Lichun instant',
      month_boundary: 'exact jie instants, UTC+8',
      hour_stem_rule: HOUR_STEM_RULE,
    },
    not_interpretation: 'This is a calendar conversion, not a reading. No strength, structure or luck judgement is made.',
  }
}

function toolAmbiguity(args) {
  const year = needNumber(args, 'year')
  const month = needNumber(args, 'month', { min: 1, max: 12 })
  const day = needNumber(args, 'day', { min: 1, max: 31 })
  const h = needNumber(args, 'hour_index', { min: 0, max: 12 })
  const r = ambiguityReport(year, month, day, h)
  const [from, to] = slotRange(h)
  const mm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return {
    primary: { hour_index: h, slot: slotName(h), line: pillarsLine(r.main), pillars: {
      year: r.main.yearGanZhi, month: r.main.monthGanZhi, day: r.main.dayGanZhi, hour: r.main.timeGanZhi,
    } },
    slot_window: `${mm(from)}-${mm(to)} (computed at midpoint)`,
    alternatives: r.alternatives.map(a => ({
      reason: a.reason,
      hour_index: a.hourIndex,
      slot: slotName(a.hourIndex),
      pillars: { year: a.chart.yearGanZhi, month: a.chart.monthGanZhi, day: a.chart.dayGanZhi, hour: a.chart.timeGanZhi },
      line: pillarsLine(a.chart),
      ...(a.reason === 'solarTerm'
        ? { term: a.termName, term_at: `${a.termAt} (UTC+8)`, why: '这一节气的精确时刻落在你所选时段内部；按时段中点计算，同段另一侧出生会得到不同的柱' }
        : { dst_window: `${a.dstFrom[0]}月${a.dstFrom[1]}日-${a.dstTo[0]}月${a.dstTo[1]}日`, why: '1986–1991 我国夏令时期间，出生记录是夏令时钟表时间（+1 小时）' }),
    })),
    zi_day: r.ziDay ? { school: r.ziDay.school, alternative_hour_index: r.ziDay.hourIndex, line: pillarsLine(r.ziDay.chart) } : null,
    note: 'Primary chart is unchanged. Alternatives are shown, never applied automatically.',
  }
}

function toolSolarTerms(args) {
  const year = needNumber(args, 'year')
  const hasFull = args?.month !== undefined && args?.day !== undefined && args?.hour_index !== undefined
  if (!hasFull) {
    // 整年十二「节」
    const out = []
    const JIE = [['立春', 2], ['惊蛰', 3], ['清明', 4], ['立夏', 5], ['芒种', 6], ['小暑', 7],
                 ['立秋', 8], ['白露', 9], ['寒露', 10], ['立冬', 11], ['大雪', 12], ['小寒', 1]]
    for (const [name, mh] of JIE) {
      const term = findTerm(year, name, mh)
      if (term) out.push({ term: name, at: `${term} (UTC+8)` })
    }
    return { year, basis: 'UTC+8', terms: out, note: '月柱在此刻切换；年柱在立春这一刻切换（均为精确时刻，非日期）' }
  }
  const month = needNumber(args, 'month', { min: 1, max: 12 })
  const day = needNumber(args, 'day', { min: 1, max: 31 })
  const h = needNumber(args, 'hour_index', { min: 0, max: 12 })
  const hits = solarTermsInSlot(year, month, day, h)
  return {
    slot: { index: h, name: slotName(h) },
    terms_in_slot: hits.map(t => ({
      term: t.name, at: `${t.ymdhms} (UTC+8)`, minutes_into_slot: t.minutesIntoSlot,
    })),
    verdict: hits.length
      ? '有节气落在此时段内部 → 同段另一侧的出生会得到不同的月柱/年柱，建议连同 bazi_ambiguity 一起看'
      : '此时段内没有节气切换 → 该时段的柱不受节气边界影响',
  }
}

// 从历表取某个节气的精确时刻（与排盘同一数据源 lunar-javascript）
function findTerm(year, name, monthHint) {
  try {
    const t = Solar.fromYmd(year, monthHint, 15).getLunar().getJieQiTable()
    const s = t[name]
    return s ? s.toYmdHms() : null
  } catch (e) {
    return null
  }
}

function toolVerify() {
  const v = verify()
  return {
    ok: v.ok,
    day_pillar_anchor: {
      value: `${v.anchor.anchor} = ${v.anchor.anchorDayPillar}`,
      cross_check: {
        date: '1900-01-31', days_before: v.anchor.daysBetween, mod60: v.anchor.mod60,
        expected: v.anchor.expected1900, actual: v.anchor.actual1900, ok: v.anchor.crossCheckOk,
      },
    },
    five_rats: { passed: v.rats.passed, total: v.rats.total },
    chart_digest: { cases: v.digest.cases, digest: v.digest.digest },
    conventions: CONVENTIONS,
    known_gaps: {
      true_solar_time: '未实现：不做经度与均时差校正',
      historical_dst: '不自动回拨：只判定与给备选盘（1986–1991）',
      supported_year_range: '未声明：历表对范围外年份仍会出盘，应视为未经校验',
      interpretation: '不提供：无旺衰、无格局、无吉凶、无预测',
    },
    dst_windows: CHINA_DST_WINDOWS.map(w => `${w.year}: ${w.from[0]}月${w.from[1]}日-${w.to[0]}月${w.to[1]}日`),
    hour_slots: HOURS.map(h => ({ index: h.index, name: h.name, range: h.range, clock: `${String(HOUR_CLOCK[h.index]).padStart(2, '0')}:${SLOT_MIDPOINT_MINUTES}` })),
  }
}

const HANDLERS = {
  bazi_paipan: toolPaipan,
  bazi_ambiguity: toolAmbiguity,
  bazi_solar_terms: toolSolarTerms,
  bazi_verify: toolVerify,
}

// ── JSON-RPC over stdio ─────────────────────────────────────────────────
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n')
}
function ok(id, result) { send({ jsonrpc: '2.0', id, result }) }
function err(id, code, message, data) { send({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } }) }

function handle(msg) {
  const id = msg.id
  const method = msg.method
  const isNotification = id === undefined || id === null

  try {
    if (method === 'initialize') {
      const want = msg.params?.protocolVersion
      const version = SUPPORTED_PROTOCOLS.includes(want) ? want : SUPPORTED_PROTOCOLS[0]
      return ok(id, {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        instructions:
          '确定性四柱排盘（离线、无解读）。凡是需要「算出某人的四柱」都可用 bazi_paipan；' +
          '凡出生时刻靠近节气或跨日边界，必须同时调用 bazi_ambiguity 把另一张盘一并给出，不要替用户选一种约定。' +
          '本服务不提供旺衰、格局、吉凶或预测。',
      })
    }
    if (method === 'notifications/initialized' || isNotification) return   // 通知不回包
    if (method === 'ping') return ok(id, {})
    if (method === 'tools/list') return ok(id, { tools: TOOLS })
    if (method === 'tools/call') {
      const name = msg.params?.name
      const args = msg.params?.arguments || {}
      const fn = HANDLERS[name]
      if (!fn) return err(id, -32602, `未知工具：${name}`, { available: Object.keys(HANDLERS) })
      try {
        const result = fn(args)
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] })
      } catch (e) {
        // 工具级错误：按 MCP 约定放在 result 里并标 isError ✓（不是协议错误 ✗）
        return ok(id, {
          content: [{ type: 'text', text: `参数错误：${e.message}\n可用时段：${SLOT_HELP}` }],
          isError: true,
        })
      }
    }
    if (method === 'resources/list') return ok(id, { resources: [] })
    if (method === 'prompts/list') return ok(id, { prompts: [] })
    return err(id, -32601, `不支持的方法：${method}`)
  } catch (e) {
    return err(id, -32603, `内部错误：${e.message}`)
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
rl.on('line', (line) => {
  const s = line.trim()
  if (!s) return
  let msg
  try { msg = JSON.parse(s) } catch (e) {
    return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: '解析失败（JSON 无效）' } })
  }
  handle(msg)
})
rl.on('close', () => process.exit(0))
