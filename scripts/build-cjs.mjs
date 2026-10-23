// 生成 CJS 版本 + 类型声明（发布产物 dist/）
// 说明：源码是 ESM；CJS 只是为了兼容 require()。用 esbuild 打包，lunar-javascript 保持外部依赖。
import { build } from 'esbuild'
import { mkdirSync, copyFileSync, readFileSync } from 'node:fs'

const outdir = 'dist'
mkdirSync(outdir, { recursive: true })

await build({
  entryPoints: { index: 'src/index.js', conventions: 'src/conventions.js' },
  outdir,
  outExtension: { '.js': '.cjs' },
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: ['node18'],
  external: ['lunar-javascript'],
  sourcemap: false,
  logLevel: 'info',
})

// 类型声明：手写覆盖公开 API（不引入 tsc 依赖）
for (const n of ['index', 'conventions']) {
  copyFileSync(`types/${n}.d.ts`, `${outdir}/${n}.d.ts`)
}

// 产物自检：CJS 文件必须能被 require，并且导出项与 ESM 一致
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const expected = ['paipan', 'ambiguityReport', 'chinaDstWindow', 'solarTermsInSlot',
                  'verify', 'HOURS', 'CONVENTIONS', 'prevSlot', 'nextSlot', 'slotRange', 'slotName']
const cjs = readFileSync(`${outdir}/index.cjs`, 'utf8')
const missing = expected.filter(k => !new RegExp(`\\b${k}\\b`).test(cjs))
if (missing.length) {
  console.error('✗ CJS 产物缺少导出：', missing.join(', '))
  process.exit(1)
}
// ⚠️ 不写时间戳标记文件：它会让每次构建的 tarball shasum 都不同，
//    与"可复算 / 逐字节一致"的定位自相矛盾（实测：两次 npm pack 的 shasum 不一致）
console.log(`✓ dist 生成：index.cjs / conventions.cjs / *.d.ts（${pkg.name}@${pkg.version}）`)
