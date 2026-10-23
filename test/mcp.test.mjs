// MCP server 的协议级测试：spawn 真子进程，按行发 JSON-RPC 2.0
// 覆盖：握手 / 通知不回包 / 工具清单 / 四个工具的真实结果 / 三类错误（参数错、未知工具、未知方法、坏 JSON）
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function makeClient() {
  const p = spawn(process.execPath, [join(ROOT, 'mcp/server.js')], {
    cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'],
  })
  let buf = ''
  const pending = new Map()
  let nextId = 1
  const stderr = []
  p.stderr.setEncoding('utf8')
  p.stderr.on('data', d => stderr.push(d))

  p.stdout.setEncoding('utf8')
  p.stdout.on('data', (d) => {
    buf += d
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i)
      buf = buf.slice(i + 1)
      if (!line.trim()) continue
      let msg
      try { msg = JSON.parse(line) } catch { continue }
      const r = pending.get(msg.id)
      if (r) { pending.delete(msg.id); r(msg) }
    }
  })

  const req = (method, params) => new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, resolve)
    p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n')
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error(`超时：${method}`)) }
    }, 15000)
  })
  const raw = (text) => p.stdin.write(text + '\n')
  return { p, req, raw, stderr }
}

let c
before(() => { c = makeClient() })
after(() => { try { c.p.kill() } catch {} })

test('initialize：协议版本回显 + serverInfo', async () => {
  const r = await c.req('initialize', {
    protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' },
  })
  assert.equal(r.jsonrpc, '2.0')
  assert.equal(r.result.protocolVersion, '2025-06-18')
  assert.equal(r.result.serverInfo.name, 'yilibazi-core')
  assert.match(r.result.serverInfo.version, /^\d+\.\d+\.\d+$/)
  assert.ok(r.result.capabilities.tools)
  assert.ok(r.result.instructions.includes('bazi_ambiguity'), 'instructions 应引导 agent 在边界情形调用歧义工具')
})

test('initialize：不支持的协议版本回落到我们支持的版本', async () => {
  const r = await c.req('initialize', { protocolVersion: '1999-01-01', capabilities: {} })
  assert.ok(['2025-06-18', '2025-03-26', '2024-11-05'].includes(r.result.protocolVersion))
})

test('通知（无 id）不回包', async () => {
  c.raw(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }))
  const r = await c.req('ping')
  assert.deepEqual(r.result, {})   // 上一条通知若回了包，会先被 ping 的解析吃掉并错位
})

test('tools/list：4 个工具，schema 完整且参数说明里写明时段范围', async () => {
  const r = await c.req('tools/list')
  const tools = r.result.tools
  assert.equal(tools.length, 4)
  const names = tools.map(t => t.name).sort()
  assert.deepEqual(names, ['bazi_ambiguity', 'bazi_paipan', 'bazi_solar_terms', 'bazi_verify'])
  for (const t of tools) {
    assert.equal(t.inputSchema.type, 'object', `${t.name} schema`)
    assert.ok(t.description.length > 80, `${t.name} 描述太短，agent 读不懂`)
  }
  const paipan = tools.find(t => t.name === 'bazi_paipan')
  assert.deepEqual(paipan.inputSchema.required, ['year', 'month', 'day', 'hour_index'])
  assert.equal(paipan.inputSchema.properties.hour_index.maximum, 12)
  assert.match(paipan.inputSchema.properties.hour_index.description, /早子时/)
})

test('bazi_paipan：1990-02-04 巳时 → 己巳 丁丑 庚子 辛巳（与站点一致）', async () => {
  const r = await c.req('tools/call', {
    name: 'bazi_paipan', arguments: { year: 1990, month: 2, day: 4, hour_index: 5 },
  })
  assert.ok(!r.result.isError)
  const d = JSON.parse(r.result.content[0].text)
  assert.equal(d.pillars.line, '己巳 丁丑 庚子 辛巳')
  assert.equal(d.day_master, '庚')
  assert.equal(d.slot.name, '巳时')
  assert.match(d.computed_at, /09:30/)
  assert.equal(d.conventions.zi_school, 'early-zi')
  assert.match(d.not_interpretation, /not a reading/)
})

test('bazi_ambiguity：同一输入给出 2 张节气备选盘，主盘不改判', async () => {
  const r = await c.req('tools/call', {
    name: 'bazi_ambiguity', arguments: { year: 1990, month: 2, day: 4, hour_index: 5 },
  })
  const d = JSON.parse(r.result.content[0].text)
  assert.equal(d.primary.line, '己巳 丁丑 庚子 辛巳')
  assert.equal(d.alternatives.length, 2)
  assert.ok(d.alternatives.every(a => a.reason === 'solarTerm'))
  assert.ok(d.alternatives.some(a => a.pillars.year === '庚午'), '应有跨到立春之后的备选')
  assert.match(d.alternatives[0].term_at, /1990-02-04 10:14:00/)
  assert.match(d.note, /never applied automatically/)
})

test('bazi_ambiguity：夏令时年份给出 dst 备选并标注区间', async () => {
  const r = await c.req('tools/call', {
    name: 'bazi_ambiguity', arguments: { year: 1990, month: 6, day: 15, hour_index: 5 },
  })
  const d = JSON.parse(r.result.content[0].text)
  const dst = d.alternatives.find(a => a.reason === 'dst')
  assert.ok(dst, '1990-06-15 应命中夏令时')
  assert.match(dst.dst_window, /4月15日-9月16日/)
})

test('bazi_solar_terms：整年 12 个节，立春 = 1990-02-04 10:14:00', async () => {
  const r = await c.req('tools/call', { name: 'bazi_solar_terms', arguments: { year: 1990 } })
  const d = JSON.parse(r.result.content[0].text)
  assert.equal(d.terms.length, 12)
  const lc = d.terms.find(t => t.term === '立春')
  assert.match(lc.at, /1990-02-04 10:14:00/)
})

test('bazi_solar_terms：指定时段时判定"节气是否落在段内"', async () => {
  const hit = JSON.parse((await c.req('tools/call', {
    name: 'bazi_solar_terms', arguments: { year: 1990, month: 2, day: 4, hour_index: 5 },
  })).result.content[0].text)
  assert.equal(hit.terms_in_slot.length, 1)
  assert.equal(hit.terms_in_slot[0].minutes_into_slot, 74)

  const miss = JSON.parse((await c.req('tools/call', {
    name: 'bazi_solar_terms', arguments: { year: 1990, month: 2, day: 4, hour_index: 4 },
  })).result.content[0].text)
  assert.equal(miss.terms_in_slot.length, 0)
  assert.match(miss.verdict, /没有节气/)
})

test('bazi_verify：自检通过且给出已知缺口（不含 accuracy 声明）', async () => {
  const r = await c.req('tools/call', { name: 'bazi_verify', arguments: {} })
  const d = JSON.parse(r.result.content[0].text)
  assert.equal(d.ok, true)
  assert.equal(d.day_pillar_anchor.value, '1949-10-01 = 甲子')
  assert.equal(d.day_pillar_anchor.cross_check.actual, '甲辰')
  assert.equal(d.five_rats.passed, 10)
  assert.equal(d.chart_digest.digest, '8e0e9dc1')
  assert.equal(d.chart_digest.cases, 336)
  assert.ok(d.known_gaps.true_solar_time && d.known_gaps.historical_dst && d.known_gaps.supported_year_range)
  assert.equal(d.hour_slots.length, 13)
})

test('反例：参数越界 → isError（工具级错误，不是协议错误）', async () => {
  const r = await c.req('tools/call', {
    name: 'bazi_paipan', arguments: { year: 1990, month: 5, day: 20, hour_index: 13 },
  })
  assert.equal(r.result.isError, true)
  assert.match(r.result.content[0].text, /hour_index/)
  assert.match(r.result.content[0].text, /早子时/)
})

test('反例：缺参数 → isError', async () => {
  const r = await c.req('tools/call', { name: 'bazi_paipan', arguments: { year: 1990 } })
  assert.equal(r.result.isError, true)
})

test('反例：未知工具 → -32602', async () => {
  const r = await c.req('tools/call', { name: 'nope', arguments: {} })
  assert.equal(r.error.code, -32602)
  assert.ok(Array.isArray(r.error.data.available))
})

test('反例：未知方法 → -32601', async () => {
  const r = await c.req('foo/bar', {})
  assert.equal(r.error.code, -32601)
})

test('反例：坏 JSON → -32700', async () => {
  // 直接写一行坏 JSON，然后 ping 一个正常请求；坏行应产生 id:null 的解析错误
  const got = []
  const onData = (d) => { for (const l of String(d).split('\n')) if (l.trim()) { try { got.push(JSON.parse(l)) } catch {} } }
  c.p.stdout.on('data', onData)
  c.raw('{not json')
  await c.req('ping')
  await new Promise(r => setTimeout(r, 300))
  c.p.stdout.off('data', onData)
  const parseErr = got.find(m => m.error && m.error.code === -32700)
  assert.ok(parseErr, '应返回 -32700 解析错误')
  assert.equal(parseErr.id, null)
})
