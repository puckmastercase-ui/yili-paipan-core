# yilibazi-core

Deterministic Four Pillars (BaZi / 八字) core where **every boundary convention is written down and testable** — and where a convention that would change the answer produces an *alternative chart* instead of a silent guess.

Zero network. Zero randomness. Zero AI. Same input → same chart, forever.

```bash
npm install yilibazi-core
```

```js
import { paipan, ambiguityReport } from 'yilibazi-core'

paipan(1990, 2, 4, 5)          // 巳时 → computed at 09:30
// → { yearGanZhi: '己巳', monthGanZhi: '丁丑', dayGanZhi: '庚子', timeGanZhi: '辛巳', ... }

ambiguityReport(1990, 2, 4, 5)
// 立春 that year falls at 10:14 — inside the 巳 slot (09:00–11:00), so the primary chart
// uses the PREVIOUS year pillar. The report also returns the neighbouring slots' charts:
//   辰时 07:30 → 己巳 丁丑 庚子 庚辰
//   午时 11:30 → 庚午 戊寅 庚子 壬午   ← year pillar has switched
```

## Why another BaZi library

Most calculators pick a convention and stay silent about it, so two tools disagree and neither says why. This one:

- **Publishes the conventions** as exported constants (`CONVENTIONS`) — midpoint time granularity, exact solar terms, early-Zi rollover, day-pillar anchor, hour-stem rule.
- **Reports the ambiguity** (`ambiguityReport`) whenever a historical clock change, a solar term inside the selected slot, or a day-rollover school would change a pillar — returning **both** charts. It never silently corrects your chart.
- **Proves itself offline** (`verify()`): the day-pillar anchor, the 五鼠遁 hour-stem rule, and a digest over 336 fixed charts so a dependency upgrade cannot quietly change results.

## Conventions (the complete list)

| Item | This package |
|---|---|
| Time granularity | Birth time is one of **13 two-hour slots**; the chart is computed at the slot **midpoint (HH:30)**. Exact minutes are not used. |
| Month boundary | The **exact instant** of the 12 *jie* (節) solar terms (定气法), from the `lunar-javascript` ephemeris — not a calendar date |
| Year boundary | The **exact Lichun (立春) instant** — not Lunar New Year, not 1 January |
| Time zone basis | Solar-term instants and input are both treated as **UTC+8** |
| Day pillar anchor | **1949-10-01 = 甲子** (cycle index 0); the 60-day cycle runs unbroken from there |
| Hour stem | **Five Rats (五鼠遁)** — derived from the day stem |
| Zi-hour school | **Early-Zi (早子)**: the day pillar advances to the next day at 23:00 **and** the hour stem comes from that next day's stem. Not split-Zi (day pillar stays), not pure late-Zi (both stay). |
| Day rollover | 23:00–24:00 births take the **next** day's pillar |

## What this package does **not** do

Stated here rather than discovered later:

| Gap | Status |
|---|---|
| **True solar time** (longitude + equation of time) | Not implemented. No birthplace input, no correction. |
| **Historical daylight saving (China, 1986–1991)** | Not applied. `chinaDstWindow()` tells you whether a date falls in one of the six windows; `ambiguityReport()` gives the shifted chart. Deciding is left to you. |
| **Supported date range** | Not declared. The underlying ephemeris returns a chart for dates far outside the range it is validated for (1600 and 2200 both return a chart, no error). Treat far-from-modern charts as unvalidated. |
| **Interpretation** | Out of scope. This package converts a date and a slot into four pillars and nothing else — no strength assessment, no luck-cycle readings, no predictions. |

## API

```js
import {
  paipan, dayun, monthlyTable, lunarToSolar,     // 排盘
  HOURS, HOUR_CLOCK, CONVENTIONS,                // 约定
  chinaDstWindow, solarTermsInSlot,              // 判定
  ambiguityReport, prevSlot, nextSlot, slotRange, slotName,
  verify, checkDayAnchor, checkFiveRats, chartDigest,
} from 'yilibazi-core'
```

### `paipan(year, month, day, hourIndex)`

`hourIndex` is `0–12` (`0` = 早子时 23:00–01:00 … `12` = 晚子时 23:00–24:00). Out-of-range input **throws** — it never falls back to a default, because a silent fallback turns a midnight birth into the wrong pillar.

Returns `{ yearGanZhi, monthGanZhi, dayGanZhi, timeGanZhi, dayStem, dayBranch, lunarText, zodiac, yearNaYin, slot, computedAt }`.

### `ambiguityReport(year, month, day, hourIndex)`

Returns `{ main, dst, term, ziDay, alternatives }`. `main` is always the chart for the declared conventions; every entry in `alternatives` carries a `reason` (`'dst'` | `'solarTerm'`), the `hourIndex` it used, and the full `chart`.

### `verify({ expectDigest })`

Runs offline. `ok` is true when the anchor, the 五鼠遁 checks (10/10) and — if you pass a digest from a previous release — the chart digest all agree.

```js
import { chartDigest, verify } from 'yilibazi-core'

chartDigest()   // → { cases: 336, digest: '8e0e9dc1' }   ← 0.1.0 的期望值
verify({ expectDigest: chartDigest().digest })            // → { ok: true, ... }
```

Pin the digest in your own test suite: if a future release changes how any of 336 fixed charts come out, `verify({ expectDigest })` returns `ok: false` instead of quietly producing different pillars.

## MCP server (agent-callable)

The package ships a **zero-dependency** MCP server (stdio, JSON-RPC 2.0), so an agent can compute a chart instead of guessing one:

```bash
npx yilibazi-core-mcp        # or: npm exec --package=yilibazi-core yilibazi-core-mcp
```

| Tool | Use it when |
|---|---|
| `bazi_paipan` | You need the four pillars for a date + one of 13 slots |
| `bazi_ambiguity` | The birth sits near a solar term, midnight, or inside China's 1986–1991 DST — returns the alternative chart(s) instead of letting a convention pick silently |
| `bazi_solar_terms` | You need the exact *jie* instants for a year, or need to know whether a term falls inside a given slot |
| `bazi_verify` | You are about to state what this engine does or does not guarantee — returns the offline self-checks **and** the declared gaps |

Client configuration (any MCP client):

```json
{
  "mcpServers": {
    "yilibazi-core": { "command": "npx", "args": ["yilibazi-core-mcp"] }
  }
}
```

The server is hand-written on purpose: pulling the protocol SDK into a package that promises "one calendar dependency" would be a poor trade. Compatibility is therefore proven the other way round — the **official SDK client** connects to this server in the test suite (`test/mcp-sdk.test.mjs`), so "it works with real clients" is a test result, not a claim.

Agent-facing usage rules (when to call, how to read results, what never to assert): [`SKILL.md`](./SKILL.md).

## Reproducing the day pillar by hand

1. **1949-10-01 = 甲子** (index 0).
2. Count days forward (or backward) and take the result mod 60.
3. Cross-check: 1900-01-31 is 18,140 days earlier; 18,140 mod 60 = 20 → that day must be **甲辰**, which is what this package returns.

Some calculators publish `1900-01-31 = 甲子` as their anchor. That is irreconcilable with `1949-10-01 = 甲子`, because the two dates are not a whole number of 60-day cycles apart.

## Accuracy — what has and has not been measured

The upstream ephemeris and an independent astronomical computation (`astronomy-engine`, searching the Sun's apparent ecliptic longitude) were compared across **2,412 jie-term instants** (12 terms × 201 years, 1900–2100): **mean difference 12.7 s, maximum 62.4 s**, exactly one boundary above 60 s.

That number is the **difference between two models**, not the error of either. Both depend on long-term extrapolation of the Earth's rotation (ΔT), and neither is ground truth — so read it as "two independent computations agree to within about a minute". Confirmation against a published almanac or observatory table is still outstanding.

## License

MIT. Ephemeris data from [lunar-javascript](https://github.com/6tail/lunar-javascript) (MIT, © 6tail).

Method page with the same conventions in prose: <https://www.yilibazi.com/method.html>
