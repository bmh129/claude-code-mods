import type { CacheClock, ContextGroups, ContextRow, Limit, Samples, Snapshot, Ttl, Turn } from '../types'
import type { Lang } from './ui'
import { bar } from './ui'
import { WORDS } from './words'

export const LIMIT_ALERTS = [80, 90, 100]
export const CONTEXT_ALERT = 85
/** Below this the context alert re-arms (after a compaction or /clear). */
export const CONTEXT_REARM = 50
export const TURNS_KEPT = 20
/** Readings kept per plan window for the pace, and how far apart they need to be. */
export const SAMPLES_KEPT = 60
const SAMPLE_GAP_MS = 60_000
/** The pace needs readings over this long before it says anything. */
const PACE_SPAN_MS = 10 * 60_000

export const label = (kind: string, lang: Lang = 'en') => WORDS[lang].labels[kind] ?? kind

/** Context full enough that the band and the pane offer /compact. */
export const needsCompact = (s: Snapshot) => s.contextPercent !== null && s.contextPercent >= CONTEXT_ALERT

type RateLimitIn = { kind: string; percentUsed: number; resetsAt?: string }
type ContextIn = { tokens?: number; window: number; percent?: number }

export const toSnapshot = (context: ContextIn, rateLimits: readonly RateLimitIn[]): Snapshot => ({
  limits: rateLimits.map(r => {
    const at = r.resetsAt ? Date.parse(r.resetsAt) : NaN
    return { kind: r.kind, percent: r.percentUsed, resetsAt: Number.isFinite(at) ? at : null }
  }),
  contextPercent: context.percent ?? null,
  contextTokens: context.tokens ?? null,
  contextWindow: context.window,
})

/** "3d4h", "1h12", "7m", "now"; "" when unknown. */
export const resetIn = (at: number | null, now: number, lang: Lang = 'en') => {
  if (at === null) return ''
  const minutes = Math.max(0, Math.round((at - now) / 60_000))
  if (minutes === 0) return WORDS[lang].now
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h${String(minutes % 60).padStart(2, '0')}`
  return `${Math.floor(hours / 24)}d${hours % 24}h`
}

export const pct = (n: number | null) => (n === null ? '–' : `${Math.round(n)}%`)

export { bar }

/** The theme's colors: error from `dangerAt` (90%), warning from `warnAt` (70%), success below. */
export const tone = (percent: number | null, warnAt = 70, dangerAt = 90) =>
  percent === null ? undefined : percent >= dangerAt ? 'error' : percent >= warnAt ? 'warning' : 'success'

const CELLS = '▁▂▃▄▅▆▇█'

/** One cell for a percent, ▁ empty to █ full: the bar of a narrow terminal. */
export const mini = (percent: number) => CELLS[Math.round((Math.max(0, Math.min(100, percent)) / 100) * 7)]!

/** Context fill per turn, oldest first, on the 0 to 100 scale; a turn with no reading is a space. */
export const contextSpark = (turns: readonly Turn[]) => turns.map(t => (t.contextPercent == null ? ' ' : mini(t.contextPercent))).join('')

/** The turn with the most input, the one to look at first; undefined with no turns. */
export const heaviest = (turns: readonly Turn[]) => turns.reduce<Turn | undefined>((top, t) => (!top || t.input > top.input ? t : top), undefined)

/**
 * The readings with the snapshot's added: one per window a minute apart at least, dropped when
 * the window resets (its reset time moves), at most SAMPLES_KEPT.
 */
export const addSamples = (samples: Samples, s: Snapshot, now: number): Samples => {
  const next: Samples = { ...samples }
  for (const l of s.limits) {
    if (l.resetsAt === null) continue
    const was = samples[l.kind]
    const points = was && was.resetsAt === l.resetsAt ? was.points : []
    const last = points[points.length - 1]
    if (last && now - last[0] < SAMPLE_GAP_MS && last[1] === l.percent) continue
    const kept = last && now - last[0] < SAMPLE_GAP_MS ? points.slice(0, -1) : points
    next[l.kind] = { resetsAt: l.resetsAt, points: [...kept, [now, l.percent] as [number, number]].slice(-SAMPLES_KEPT) }
  }
  return next
}

/**
 * Milliseconds until the window reaches 100% at the pace of its readings (a least-squares
 * line), or null: too few readings, too short a span, a flat or falling pace, or a window that
 * resets first.
 */
export const pace = (points: readonly (readonly [number, number])[], now: number, resetsAt: number): number | null => {
  if (points.length < 3) return null
  const first = points[0]![0]
  const last = points[points.length - 1]!
  if (last[0] - first < PACE_SPAN_MS) return null
  const n = points.length
  const mx = points.reduce((a, p) => a + (p[0] - first), 0) / n
  const my = points.reduce((a, p) => a + p[1], 0) / n
  const sxx = points.reduce((a, p) => a + (p[0] - first - mx) ** 2, 0)
  const sxy = points.reduce((a, p) => a + (p[0] - first - mx) * (p[1] - my), 0)
  const slope = sxx > 0 ? sxy / sxx : 0
  if (slope <= 0) return null
  const at = first + mx + (100 - my) / slope
  const left = Math.max(0, at - now)
  return now + left < resetsAt ? left : null
}

export const toTurn = (
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number; model: string },
  durationMs: number,
): Turn => {
  const input = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
  return {
    input,
    output: usage.output_tokens,
    cacheHit: input > 0 ? usage.cache_read_input_tokens / input : null,
    model: usage.model,
    durationMs,
  }
}

export type Alert = { key: string; text: string }

/**
 * Alerts the snapshot raises that have not fired yet. A limit alert is keyed by its window's
 * reset time, so a new window re-arms it; the context alert re-arms once the fill drops below
 * CONTEXT_REARM. Returns the alerts and the fired list to store.
 */
export const alerts = (s: Snapshot, fired: readonly string[], now: number, lang: Lang = 'en'): { raised: Alert[]; fired: string[] } => {
  const w = WORDS[lang]
  let next = [...fired]
  const raised: Alert[] = []
  for (const limit of s.limits) {
    const hit = LIMIT_ALERTS.filter(t => limit.percent >= t)
    const top = hit[hit.length - 1]
    if (top === undefined) continue
    const keys = hit.map(t => `${limit.kind}:${limit.resetsAt ?? '-'}:${t}`)
    if (keys.every(k => next.includes(k))) continue
    next = [...next, ...keys.filter(k => !next.includes(k))]
    raised.push({ key: keys[keys.length - 1]!, text: w.windowAlert(label(limit.kind, lang), pct(limit.percent), resetIn(limit.resetsAt, now, lang)) })
  }
  const contextKey = `context:${CONTEXT_ALERT}`
  if (s.contextPercent !== null && s.contextPercent < CONTEXT_REARM) next = next.filter(k => k !== contextKey)
  if (s.contextPercent !== null && s.contextPercent >= CONTEXT_ALERT && !next.includes(contextKey)) {
    next = [...next, contextKey]
    raised.push({ key: contextKey, text: w.contextAlert(pct(s.contextPercent)) })
  }
  return { raised, fired: next }
}

/** One-line text summary, for the command's answer where no pane can open. */
export const summary = (s: Snapshot, last: Turn | undefined, now: number, lang: Lang = 'en') => {
  const w = WORDS[lang]
  const parts = s.limits.map(l => `${label(l.kind, lang)} ${pct(l.percent)}${l.resetsAt !== null ? ` (${w.resetsIn(resetIn(l.resetsAt, now, lang))})` : ''}`)
  parts.push(`${w.context} ${pct(s.contextPercent)}`)
  if (last?.cacheHit != null) parts.push(`cache ${pct(last.cacheHit * 100)}`)
  if (s.limits.length === 0) parts.push(w.noReadings)
  return parts.join(' · ')
}

/** Effort levels from least to most thinking, the gauge's five steps. */
export const EFFORT_LEVELS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

/** The level an effort value names, or null: a string from EFFORT_LEVELS, any case. */
export const effortLevel = (v: unknown) => {
  const level = typeof v === 'string' ? v.toLowerCase() : ''
  return (EFFORT_LEVELS as readonly string[]).includes(level) ? level : null
}

/** Effort as a five-step gauge, low ▰▱▱▱▱ to max ▰▰▰▰▰; "" for a level outside the list. */
export const gauge = (level: string | number | null | undefined) => {
  const n = EFFORT_LEVELS.indexOf(String(level) as (typeof EFFORT_LEVELS)[number]) + 1
  return n > 0 ? '▰'.repeat(n) + '▱'.repeat(EFFORT_LEVELS.length - n) : ''
}

/** Models from cheapest to costliest; a switch up this list is a costly one. */
export const MODEL_ORDER = ['haiku', 'sonnet', 'opus', 'fable'] as const

/** A model's place in MODEL_ORDER, or -1 for a model it does not name. */
export const rankOf = (model: string | null | undefined) => {
  const name = (model ?? '').toLowerCase()
  return MODEL_ORDER.findIndex(family => name.includes(family))
}

/** Whether going from one model to another climbs MODEL_ORDER; an unknown model never does. */
export const isCostlier = (from: string | null | undefined, to: string | null | undefined) => {
  const a = rankOf(from)
  const b = rankOf(to)
  return a >= 0 && b > a
}

/** Turns the toast's pace reads: the last few, as the plan item says. */
export const PACE_TURNS = 3

/**
 * Minutes until the 5-hour window reaches 100% at the pace of the last PACE_TURNS main-thread
 * turns, or null: fewer turns than that, or no rise. The pace comes from the window's own
 * timestamped readings (`points`, as addSamples keeps them) since the first of those turns
 * started; the turns only bound the span, so a reading that lands after its turn still counts.
 */
export const minutesLeft = (five: Limit, points: readonly (readonly [number, number])[], recentTurns: readonly Turn[]): number | null => {
  const ended = recentTurns.filter(t => t.endedAt != null)
  if (ended.length < PACE_TURNS) return null
  const first = ended[ended.length - PACE_TURNS]!
  const since = first.endedAt! - first.durationMs
  const span = points.filter(p => p[0] >= since)
  if (span.length < 2) return null
  const [t0, p0] = span[0]!
  const [t1, p1] = span[span.length - 1]!
  if (t1 <= t0 || p1 <= p0) return null
  return Math.max(0, Math.round(((100 - five.percent) * (t1 - t0)) / (p1 - p0) / 60_000))
}

/** What the session runs: a model id and the effort of its last request. */
export type Setting = { model: string | null; effort: string | number | null }

/**
 * The toast for a costly switch (a model up MODEL_ORDER, or effort turning to max) with the
 * 5-hour window at `threshold` or more, or null when there is nothing to say. With a pace, the
 * minutes left; when the window resets before that, its reset time; with no pace, no number.
 */
export const switchWarning = (
  from: Setting,
  to: Setting,
  five: Limit | undefined,
  threshold: number,
  points: readonly (readonly [number, number])[],
  recentTurns: readonly Turn[],
  now: number,
  lang: Lang = 'en',
): string | null => {
  const toModel = isCostlier(from.model, to.model)
  const toMax = to.effort === 'max' && from.effort !== 'max'
  if (!toModel && !toMax) return null
  if (!five || five.percent < threshold) return null
  const w = WORDS[lang]
  const percent = pct(five.percent)
  const minutes = minutesLeft(five, points, recentTurns)
  if (minutes !== null) {
    const runsOutAt = now + minutes * 60_000
    if (five.resetsAt !== null && runsOutAt >= five.resetsAt) return w.switchResets(percent, resetIn(five.resetsAt, now, lang))
    return w.switchPace(percent, minutes < 60 ? `${minutes} min` : resetIn(runsOutAt, now, lang))
  }
  return w.switchFaster(percent, toModel ? MODEL_ORDER[rankOf(to.model)]! : 'effort max')
}

/** How long each cache lives after the request that refreshed it. */
export const TTL_MS: Record<Ttl, number> = { '5m': 5 * 60_000, '1h': 60 * 60_000 }

/** The cache is "cooling" this long before it goes cold: 10 minutes of the hour, a fifth of the 5 minutes. */
export const coolMs = (ttl: Ttl) => Math.min(10 * 60_000, TTL_MS[ttl] / 5)

export type Clock = { left: number; state: 'warm' | 'cooling' | 'cold' }

/** Time left on the cache and its state; null while the last request or the TTL is unknown. */
export const clockOf = (c: CacheClock, now: number): Clock | null => {
  if (c.lastAt === null || c.ttl === null) return null
  const left = Math.max(0, c.lastAt + TTL_MS[c.ttl] - now)
  return { left, state: left === 0 ? 'cold' : left <= coolMs(c.ttl) ? 'cooling' : 'warm' }
}

/** 52:10; the seconds round up, so a cache with 1 ms left still reads 00:01. */
export const mmss = (ms: number) => {
  const s = Math.ceil(Math.max(0, ms) / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** Keep-warm sends this long before the cache goes cold: 5 minutes of the hour, 30 seconds of the 5 minutes. */
export const keepMargin = (ttl: Ttl) => Math.min(5 * 60_000, TTL_MS[ttl] / 10)

/** Keep-warm stops by itself after this long. */
export const KEEP_WARM_MAX_MS = 2 * 60 * 60_000

/** What keep-warm sends. The model reads it framed as a plugin's message; the transcript draws a dim row instead. */
export const KEEP_WARM_TEXT = 'Keep-warm ping from limits-meter. Reply with a single "." and nothing else.'

/**
 * The TTL a turn shows, or null. Only a turn of one request counts (its hit rate is that
 * request's own): after more than 5 minutes idle, a high hit means the cache lived past 5
 * minutes (1h); a near-zero hit within the hour means it lapsed (5m). A compaction or a changed
 * prompt also reads near zero, so a later `cache_ttl` or turn overrides it.
 */
export const inferTtl = (prev: Turn | undefined, cur: Turn): Ttl | null => {
  if (prev?.endedAt == null || cur.endedAt == null || cur.steps !== 1 || cur.cacheHit === null) return null
  const gap = cur.endedAt - cur.durationMs - prev.endedAt
  if (gap <= TTL_MS['5m'] + 30_000) return null
  if (cur.cacheHit >= 0.5) return '1h'
  return gap < TTL_MS['1h'] - 60_000 && cur.cacheHit < 0.2 ? '5m' : null
}

/** Whole numbers from `weights` that add up to `total` (largest remainder); a weight above 0 gets 1 at least when `total` allows. */
export const apportion = (total: number, weights: readonly number[]): number[] => {
  const sum = weights.reduce((a, b) => a + b, 0)
  if (sum <= 0 || total <= 0) return weights.map(() => 0)
  const exact = weights.map(w => (w / sum) * total)
  const out = exact.map(Math.floor)
  let left = total - out.reduce((a, b) => a + b, 0)
  for (const [, i] of exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0])) {
    if (left <= 0) break
    out[i]!++
    left--
  }
  if (total >= weights.filter(w => w > 0).length) {
    weights.forEach((w, i) => {
      if (w > 0 && out[i] === 0) {
        out[out.indexOf(Math.max(...out))]!--
        out[i] = 1
      }
    })
  }
  return out
}

type CategoryIn = { name: string; tokens: number; kind: string }
type McpToolIn = { serverName: string; tokens: number; isLoaded: boolean }

/**
 * The engine's breakdown rows in the band's groups: MCP (one row per server with a loaded tool),
 * messages, and everything else in use as system. Free space, the compaction buffer and deferred
 * schemas are not in use. Null without a window to measure against.
 */
export const groupContext = (b: { categories: readonly CategoryIn[]; maxTokens: number; mcpTools?: readonly McpToolIn[] }): ContextGroups | null => {
  if (!(b.maxTokens > 0)) return null
  const servers = new Map<string, number>()
  for (const t of b.mcpTools ?? []) if (t.isLoaded) servers.set(t.serverName, (servers.get(t.serverName) ?? 0) + t.tokens)
  const rows: ContextRow[] = []
  for (const c of b.categories) {
    if (c.kind !== 'used' || c.tokens <= 0) continue
    if (/mcp/i.test(c.name)) {
      if (servers.size === 0) rows.push({ name: c.name, tokens: c.tokens, group: 'mcp' })
      else for (const [server, tokens] of servers) rows.push({ name: `MCP · ${server}`, tokens, group: 'mcp' })
      continue
    }
    rows.push({ name: c.name, tokens: c.tokens, group: /^messages$/i.test(c.name) ? 'messages' : 'system' })
  }
  const sum = (g: ContextRow['group']) => rows.filter(r => r.group === g).reduce((a, r) => a + r.tokens, 0)
  return { window: b.maxTokens, system: sum('system'), mcp: sum('mcp'), messages: sum('messages'), rows }
}

export type Split = { system: number; mcp: number; messages: number; free: number }

/** The window's percent in groups: the groups share `percent` by their tokens, free is the rest; whole numbers adding to 100. */
export const splitOf = (percent: number, g: ContextGroups): Split => {
  const used = Math.max(0, Math.min(100, Math.round(percent)))
  const [system = 0, mcp = 0, messages = 0] = apportion(used, [g.system, g.mcp, g.messages])
  return { system, mcp, messages: g.system + g.mcp + g.messages === 0 ? used : messages, free: 100 - used }
}

/** Bar cells per group for a bar `width` cells wide: the used share of it, split by the groups; the rest is free. */
export const barCells = (width: number, split: Split): Split => {
  const used = Math.round(((100 - split.free) / 100) * width)
  const [system = 0, mcp = 0, messages = 0] = apportion(used, [split.system, split.mcp, split.messages])
  return { system, mcp, messages, free: width - used }
}
