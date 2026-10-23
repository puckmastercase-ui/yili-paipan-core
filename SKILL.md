---
name: yilibazi-core
description: Use when a task needs a BaZi (八字 / Four Pillars) chart computed from a birth date and time, or needs to explain why two BaZi calculators disagree. Deterministic and offline — no interpretation, no predictions.
---

# yilibazi-core

Deterministic Four Pillars (BaZi) conversion for a Gregorian birth date + one of 13 two-hour slots.
**It computes pillars. It does not read charts** — no strength, no structure, no luck, no prediction.

## When to use it

| Situation | Use |
|---|---|
| "What are the four pillars for someone born 1990-02-04 around 9am?" | `bazi_paipan` |
| The birth is near a **solar term**, **midnight**, or in **1986–1991** (China DST) | `bazi_paipan` **and** `bazi_ambiguity` — report both charts |
| "Why do two calculators give different pillars for the same birth?" | `bazi_ambiguity` (the answer is almost always a boundary convention) |
| "When exactly does the month pillar change in 2024?" | `bazi_solar_terms` with only `year` |
| You are about to state what this engine does or does not guarantee | `bazi_verify` |

## How to call it

```jsonc
// bazi_paipan / bazi_ambiguity
{ "year": 1990, "month": 2, "day": 4, "hour_index": 5 }
```

`hour_index` is **0–12**, not a clock hour:

| 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 早子时 23–01 | 丑 01–03 | 寅 03–05 | 卯 05–07 | 辰 07–09 | 巳 09–11 | 午 11–13 | 未 13–15 | 申 15–17 | 酉 17–19 | 戌 19–21 | 亥 21–23 | 晚子时 23–24 |

If the user gives a **clock time**, convert it to a slot yourself and say which slot you used. If a time sits on a slot boundary, say so and call `bazi_ambiguity`.

## Rules that keep the answer honest

1. **Never present a chart as certain when a convention could change it.** If `bazi_ambiguity` returns alternatives, show them. The primary chart is not "the right one" — it is "the one under this declared convention".
2. **Quote the conventions when the answer turns on them.** Month/year pillars switch at the **exact** solar-term instants (not calendar dates, not Lunar New Year); the chart is computed at the **midpoint** of the slot (HH:30), so the exact minute is ignored; a 23:00–24:00 birth advances the day pillar (**early-Zi** school) with the hour stem from the next day.
3. **No interpretation.** Do not extend a chart into personality, career, wealth, health, marriage or event timing as if the engine produced it. If the user wants a reading, that is a different product — say the engine gives the calendar facts only.
4. **Never claim measured accuracy.** `bazi_verify` reports interval-level self-checks (anchor, Five Rats, a digest over 336 charts) and the known gaps (no true-solar-time correction, no automatic DST adjustment, no declared supported year range). Do not translate those into "accurate to ±X".
5. **The chart is a cultural/computational artifact.** Keep the framing descriptive, not predictive.

## What it will refuse or fail at

- `hour_index` outside 0–12, or a missing/invalid date → the tool returns `isError: true` with the valid range in the message. Do not retry blindly; fix the input.
- Births where the exact minute matters (within minutes of a solar term) → the engine cannot resolve it, because the input is a two-hour slot. Say so plainly.
- True solar time, historical DST correction, and out-of-range years → declared gaps, not silent behaviours.

## Same conventions in prose

<https://www.yilibazi.com/method.html> — the human-readable method page, including the measured solar-term comparison against an independent ephemeris.
