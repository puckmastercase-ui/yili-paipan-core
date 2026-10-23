// 用**官方 SDK 当客户端**连我们的手写 server —— 证明真客户端能兼容
// 这是「协议实现正确」的最硬证据：不用自己写的客户端自证清白 ✗
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

async function connect() {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [join(ROOT, 'mcp/server.js')],
    cwd: ROOT,
    stderr: 'pipe',
  })
  const client = new Client({ name: 'yilibazi-core-sdk-test', version: '0.0.0' }, { capabilities: {} })
  await client.connect(transport)
  return client
}

test('官方 SDK 客户端：握手成功并拿到 serverInfo', async () => {
  const client = await connect()
  try {
    const v = client.getServerVersion()
    assert.equal(v.name, 'yilibazi-core')
    assert.match(v.version, /^\d+\.\d+\.\d+$/)
  } finally { await client.close() }
})

test('官方 SDK 客户端：listTools 拿到 4 个工具', async () => {
  const client = await connect()
  try {
    const { tools } = await client.listTools()
    assert.equal(tools.length, 4)
    const names = tools.map(t => t.name).sort()
    assert.deepEqual(names, ['bazi_ambiguity', 'bazi_paipan', 'bazi_solar_terms', 'bazi_verify'])
  } finally { await client.close() }
})

test('官方 SDK 客户端：callTool 真能算出四柱与备选盘', async () => {
  const client = await connect()
  try {
    const chart = await client.callTool({
      name: 'bazi_paipan',
      arguments: { year: 1990, month: 2, day: 4, hour_index: 5 },
    })
    assert.ok(!chart.isError)
    const d = JSON.parse(chart.content[0].text)
    assert.equal(d.pillars.line, '己巳 丁丑 庚子 辛巳')

    const amb = await client.callTool({
      name: 'bazi_ambiguity',
      arguments: { year: 1990, month: 2, day: 4, hour_index: 5 },
    })
    const a = JSON.parse(amb.content[0].text)
    assert.equal(a.alternatives.length, 2)

    const ver = await client.callTool({ name: 'bazi_verify', arguments: {} })
    const vd = JSON.parse(ver.content[0].text)
    assert.equal(vd.ok, true)
    assert.equal(vd.chart_digest.digest, '8e0e9dc1')
  } finally { await client.close() }
})

test('官方 SDK 客户端：参数错误以 isError 返回（不是抛协议错误）', async () => {
  const client = await connect()
  try {
    const r = await client.callTool({
      name: 'bazi_paipan',
      arguments: { year: 1990, month: 5, day: 20, hour_index: 13 },
    })
    assert.equal(r.isError, true)
    assert.match(r.content[0].text, /hour_index/)
  } finally { await client.close() }
})
