// limits-meter: plan limits and context, above the prompt and in a pane.
//
//   band   AbovePrompt: the main thread's model and effort, 5-hour and weekly windows with reset
//          times, context fill, last turn's cache hit rate. Tokens and percent only, never money.
//          `details` opens the pane, `hide` hides the band, and from 85% context `compact` puts
//          /compact in the prompt. The `format`, `cells`, `density`, `warnAt` and `dangerAt`
//          options shape it; below 90 columns each bar shrinks to one cell, and `format: compact`
//          draws one line of numbers.
//   cache  the band's cache cell counts down the prompt cache (⏱ 52:10, warning when it cools, ❄ cold
//          when it lapsed) from the end of the last request and its TTL (`cache_ttl` on a model
//          switch, else inferred from a one-request turn after a gap); without a TTL it shows the
//          last turn's hit rate. Keep-warm (/limits keep-warm on|off, or the band's button) asks, then
//          sends a short message just before the cache goes cold; it stops at the person's next
//          prompt or after 2 h. It is a real turn the transcript draws as one dim row.
//   ctx    the context bar is split by the engine's categories (system, MCP, messages, free), with a
//          legend under the band; the pane lists every category. $.session.usage({ breakdown: 'summary' }).
//   pace   each window's readings since its reset; when their pace reaches 100% before the
//          reset, the pane says when.
//   /limits  opens a pane with the same figures at full width and the last turns' tokens;
//          /limits hide | show toggles the band, and the choice is kept across sessions.
//   toasts once per threshold: a window at 80, 90 and 100%, context at 85%. And once per costly
//          switch (a model up haiku < sonnet < opus < fable, or effort turning to max) with the
//          5-hour window at /limits warn N or more (70 by default): the minutes left at the pace
//          of the last 3 turns, or when the window resets first, or no number without a pace.
//
// Figures come from `session.measure` (pushed by the engine after each turn and when a window
// moves a point), so nothing polls. Reads nothing from disk, runs no process, calls no model.

import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register } from 'claude-code'

import type { CacheClock, ContextGroups, KeepWarm, Samples, Snapshot, Turn, Ttl } from '../types'
import type { Setting } from './meter'
import { addSamples, alerts, bar, barCells, clockOf, contextSpark, effortLevel, gauge, groupContext, heaviest, inferTtl, keepMargin, KEEP_WARM_MAX_MS, KEEP_WARM_TEXT, label, mini, mmss, needsCompact, pace, pct, resetIn, splitOf, summary, switchWarning, toSnapshot, toTurn, tone as toneOf, TTL_MS, TURNS_KEPT } from './meter'
import type { IconStyle, Lang, Verb } from './ui'
import { clip, fillArgs, glyph, langOf, linesOf, shortModel, styleOf, tokens, verbRow } from './ui'
import { switchOf, switchWords } from './switch'
import { COMMAND, WORDS } from './words'

const PANE = 'limits'
const KEY_HIDDEN = 'hidden'
const KEY_SWITCH = 'switchWarnAt'
const SWITCH_AT = 70
/** The thresholds the pane offers for the costly-switch toast; /limits warn takes any 1 to 100. */
const SWITCH_CHOICES = [50, 60, 70, 80, 90]

const EMPTY: Snapshot = { limits: [], contextPercent: null, contextTokens: null, contextWindow: 0 }

const snapshot = atom({ plugin: 'limits-meter', key: 'snapshot' } as const, EMPTY)
const turns = atom({ plugin: 'limits-meter', key: 'turns' } as const, [] as Turn[])
const isHidden = atom({ plugin: 'limits-meter', key: 'isHidden' } as const, false)
/** The `quiet` option, set in every mod by `/pad quiet`: hides what the mod draws by itself, as hide does. `show` does not undo it. */
let isQuiet = false
/** From this share of the 5h window quiet still draws one line: the limit is about to stop the work. */
const QUIET_ALERT_AT = 95
const fired = atom({ plugin: 'limits-meter', key: 'fired' } as const, [] as string[])
const samples = atom({ plugin: 'limits-meter', key: 'samples' } as const, {} as Samples)
const model = atom({ plugin: 'limits-meter', key: 'model' } as const, null as string | null)
const effort = atom({ plugin: 'limits-meter', key: 'effort' } as const, null as string | number | null)
const switchAt = atom({ plugin: 'limits-meter', key: 'switchAt' } as const, SWITCH_AT)
const cache = atom({ plugin: 'limits-meter', key: 'cache' } as const, { lastAt: null, ttl: null } as CacheClock)
const keepWarm = atom({ plugin: 'limits-meter', key: 'keepWarm' } as const, null as KeepWarm | null)
const groups = atom({ plugin: 'limits-meter', key: 'groups' } as const, null as ContextGroups | null)

// Set by register from the options, and by session.start from the system's LANG.
let lang: Lang = 'en'
/** The `enabled` option; off, only the command answers. */
let isOn = true
let warnAt = 70
let dangerAt = 90
/** The band's cells by id (5h, wk, spend, ctx, cache); null shows them all. */
let cells: Set<string> | null = null
let density: 'auto' | 'bars' | 'mini' | 'numbers' = 'auto'
/** `full`, the band with bars, or `compact`, one line of numbers. */
let format: 'full' | 'compact' = 'full'
let style: IconStyle = 'emoji'
/** The cache cell's glyphs: ⏱ counting, ❄ cold, ♻ kept warm; one cell each in the symbol style. */
const ICONS = {
  clock: { emoji: '⏱', symbol: '◷' },
  cold: { emoji: '❄', symbol: '*' },
  keep: { emoji: '♻', symbol: '↺' },
}
/** Model requests so far in the main thread's running turn: a turn of one has a hit rate the TTL can be read from. */
let steps = 0
/** A keep-warm message is on its way: the turn that ends next is its own, not the person's. */
let keepSending = false
let ticker: { cancel: () => void } | null = null

const tone = (percent: number | null) => toneOf(percent, warnAt, dangerAt)

const CELL_IDS: Record<string, string> = { five_hour: '5h', seven_day: 'wk', spend_limit: 'spend' }
const shows = (id: string) => cells === null || cells.has(id)

/** The `cells` option: names from model, 5h, wk, spend, ctx, cache, comma-separated; `all` or nothing known shows them all. */
const cellsOf = (option: unknown): Set<string> | null => {
  const names = String(option ?? '')
    .toLowerCase()
    .split(/[\s,]+/)
    .filter(n => ['model', '5h', 'wk', 'spend', 'ctx', 'cache'].includes(n))
  return names.length ? new Set(names) : null
}

/** Bar cells for the band: by the terminal's width on `auto`, 0 for one cell, -1 for none. */
const barWidth = (columns: number) =>
  density === 'bars' ? 10 : density === 'mini' ? 0 : density === 'numbers' ? -1 : columns >= 120 ? 10 : columns >= 90 ? 6 : 0

const take = async ($: EngineInterface, next: Snapshot) => {
  await update($, snapshot, () => next)
  const now = await $.clock.now()
  await update($, samples, list => addSamples(list, next, now))
  const result = alerts(next, await read($, fired), now, lang)
  if (result.raised.length === 0) return
  await update($, fired, () => result.fired)
  for (const a of result.raised) $.ui.toast(a.text, { timeoutMs: 8000 })
}

/** Hides or shows the band, and keeps the choice for later sessions. */
const setHidden = async ($: EngineInterface, hidden: boolean) => {
  await update($, isHidden, () => hidden)
  await $.store.set(KEY_HIDDEN, hidden)
}

/** Changes the mod's `enabled` option as /config would; the engine reloads the mod with it. */
const setEnabled = async ($: EngineInterface, value: boolean): Promise<string | null> => {
  const result = await $.config.set({ key: 'limits-meter.enabled', value } as never)
  return result && 'deny' in result && result.deny !== undefined ? String(result.deny) : null
}

/** /limits on|off: the option, in every conversation. hide and show are the band's own, below. */
const runEnabled = async ($: EngineInterface, want: boolean): Promise<{ text?: string }> => {
  const s = switchWords(lang, COMMAND)
  if (want === isOn) return { text: want ? s.alreadyOn : s.alreadyOff }
  const deny = await setEnabled($, want)
  return { text: deny ? s.denied(deny) : want ? s.on : s.off }
}

/** Sets the costly-switch threshold, and keeps it for later sessions. */
const setSwitchAt = async ($: EngineInterface, percent: number) => {
  await update($, switchAt, () => percent)
  await $.store.set(KEY_SWITCH, percent)
}

/** The window by the engine's categories, grouped for the band; null when the engine gives none. */
const takeGroups = async ($: EngineInterface) => {
  try {
    const b = (await $.session.usage({ breakdown: 'summary' })).context.breakdown
    await update($, groups, () => (b ? groupContext(b) : null))
  } catch {
    // No breakdown: the band keeps its single bar.
  }
}

/** When the last keep-warm message went out, or null: until that turn ends the next one is its own. */
let keepSentAt: number | null = null
/** The last request for which the cold toast fired, so it comes once per lapse. */
let coldFor: number | null = null
/** Seconds a sent keep-warm may wait for its turn to end before the next one is tried. */
const KEEP_PATIENCE_MS = 120_000

const stopTicker = () => {
  ticker?.cancel()
  ticker = null
}

/** Ends keep-warm; every reason but the person's own stop says why in a toast. */
const stopKeep = async ($: EngineInterface, why: 'prompt' | 'time' | 'cold' | 'failed' | 'manual') => {
  if ((await read($, keepWarm)) === null) return
  await update($, keepWarm, () => null)
  if (why !== 'manual') $.ui.toast(WORDS[lang].keepStopped(why), { timeoutMs: 8000 })
}

/** Sends the keep-warm message: a real turn, once the session is idle; the turn's end refreshes the clock. */
const sendKeep = async ($: EngineInterface) => {
  keepSentAt = await $.clock.now()
  try {
    await $.prompt.submit({ text: KEEP_WARM_TEXT }).catch(() => {
      keepSentAt = null
      return stopKeep($, 'failed')
    })
  } catch {
    keepSentAt = null
    await stopKeep($, 'failed')
  }
}

/** Once a second while a clock counts: redraws the band, sends keep-warm when due, toasts when the cache lapses. */
const tick = async ($: EngineInterface) => {
  const now = await $.clock.now()
  const c = await read($, cache)
  const clock = clockOf(c, now)
  const kept = await read($, keepWarm)
  const waiting = keepSentAt !== null && now - keepSentAt < KEEP_PATIENCE_MS
  if (kept && now >= kept.until) await stopKeep($, 'time')
  else if (kept && clock && c.ttl && !waiting) {
    if (clock.state === 'cold') await stopKeep($, 'cold')
    else if (clock.left <= keepMargin(c.ttl)) await sendKeep($)
  }
  if (clock?.state === 'cold' && coldFor !== c.lastAt) {
    coldFor = c.lastAt
    $.ui.toast(WORDS[lang].coldToast(tokens((await read($, snapshot)).contextTokens ?? 0)), { timeoutMs: 8000 })
  }
  if (!clock || clock.state === 'cold') stopTicker()
  $.ui.invalidate('ui.render')
}

/** Starts the one-second tick while a clock is counting. */
const ensureTicker = ($: EngineInterface) => {
  if (ticker === null) ticker = $.clock.every(1000, () => void tick($).catch(() => undefined))
}

/** Asks, then turns keep-warm on; the answer is the line to show. It spends plan, so it waits for a yes. */
const startKeep = async ($: EngineInterface): Promise<string> => {
  const w = WORDS[lang]
  if ((await read($, keepWarm)) !== null) return w.keepOn
  if ((await read($, cache)).ttl === null) return w.keepNeedsTtl
  const re = (await read($, snapshot)).contextTokens ?? 0
  const answer = await $.ui.ask(w.keepAsk(tokens(re)), [w.keepYes, w.keepNo]).catch(() => w.keepNo)
  if (answer !== w.keepYes) return w.keepOff
  const now = await $.clock.now()
  await update($, keepWarm, () => ({ until: now + KEEP_WARM_MAX_MS }))
  ensureTicker($)
  return w.keepOn
}

/** A costly switch with the 5-hour window at the threshold or more raises one toast. */
const warnIfCostly = async ($: EngineInterface, from: Setting, to: Setting) => {
  const s = await read($, snapshot)
  const five = s.limits.find(l => l.kind === 'five_hour')
  const readings = five && five.resetsAt !== null ? (await read($, samples))[five.kind] : undefined
  const points = readings && five && readings.resetsAt === five.resetsAt ? readings.points : []
  const text = switchWarning(from, to, five, await read($, switchAt), points, await read($, turns), await $.clock.now(), lang)
  if (text) $.ui.toast(text, { timeoutMs: 8000 })
}

/**
 * Where the effort came from, best first: a request (`turn.step`, the setting it asks for), the
 * turn's end (`classic.Stop`, after any downgrade for the model), /config (the stored setting).
 * The sources can disagree, so a weaker one never overwrites a stronger one, and only a change
 * within one source counts as a switch: the band does not flip between a request's max and the
 * high it was downgraded to, and no toast fires for it. A module variable: a reload starts over.
 */
const SOURCES = { request: 2, turnEnd: 1, config: 0 } as const
let effortFrom: keyof typeof SOURCES | null = null

/**
 * An effort seen on the main thread, from `source`: kept for the band when no stronger source
 * gave one, and a change within the same source to max may warn (never from /config). A source
 * with no effort (a request that carries none) keeps the one known.
 */
const seeEffort = async ($: EngineInterface, level: string | number | null | undefined, source: keyof typeof SOURCES, id?: string | null) => {
  if (level == null || level === '') return
  if (effortFrom !== null && SOURCES[source] < SOURCES[effortFrom]) return
  const was = effortFrom === source ? await read($, effort) : null
  effortFrom = source
  if (was === level) return
  await update($, effort, () => level)
  if (was !== null && source !== 'config') {
    const current = id ?? (await read($, model))
    await warnIfCostly($, { model: current, effort: was }, { model: current, effort: level })
  }
}

/** The session's effort from /config: the first row named for effort whose value is a level. */
const effortOfConfig = (rows: readonly { key: string; label: string; value: unknown }[]) => {
  for (const r of rows) {
    if (!/effort/i.test(r.key) && !/^(effort|esforço)/i.test(r.label)) continue
    const level = effortLevel(r.value)
    if (level) return level
  }
  return null
}

/** The effort drawn, band and pane alike: its gauge and its name, max in the warning color. */
const effortView = (Text: Elements[keyof Elements]['Text'], level: string | number) => {
  const max = level === 'max'
  return [
    ...(gauge(level) !== '' ? [<Text key="gauge" color={max ? 'warning' : undefined} dimColor={!max}>{`${gauge(level)} `}</Text>] : []),
    <Text key="level" color={max ? 'warning' : undefined} bold={max}>{String(level)}</Text>,
  ]
}

/** A threshold from /limits warn: a whole number from 1 to 100, else null. */
const percentOf = (arg: string) => (/^\d{1,3}%?$/.test(arg) && Number.parseInt(arg, 10) >= 1 && Number.parseInt(arg, 10) <= 100 ? Number.parseInt(arg, 10) : null)

/** The group colors: system and MCP have their own, messages take the context's tone. */
const groupColor = (group: 'system' | 'mcp' | 'messages', percent: number | null) => (group === 'system' ? 'suggestion' : group === 'mcp' ? 'claude' : tone(percent))

/** The cache cell's figure: the countdown, or `cold`; kept warm draws it in the accent. */
const clockView = (Text: Elements[keyof Elements]['Text'], clock: { left: number; state: 'warm' | 'cooling' | 'cold' }, kept: boolean) => {
  const w = WORDS[lang]
  if (clock.state === 'cold') {
    return (
      <Text key="clock" color="error" bold>
        {`${glyph(style, ICONS.cold)} ${w.coldWord}`}
      </Text>
    )
  }
  const color = kept ? 'claude' : clock.state === 'cooling' ? 'warning' : 'success'
  return (
    <Text key="clock" color={color} bold>
      {`${glyph(style, kept ? ICONS.keep : ICONS.clock)} ${mmss(clock.left)}`}
    </Text>
  )
}

/** Presses of the keep-warm buttons: ask and say the answer, or stop. */
const pressKeep = ($: EngineInterface) => startKeep($).then(text => $.ui.toast(text, { timeoutMs: 6000 }), () => $.ui.toast(WORDS[lang].failedToRun(`/${COMMAND} keep-warm on`)))

const open = ($: EngineInterface) => $.ui.open({ id: PANE, title: WORDS[lang].pane, focus: true, closeOnEscape: true }).catch(() => null)

/** /limits and its arguments: what the command answers, and what the pane's verbs run. */
const runCommand = async ($: EngineInterface, args: string): Promise<{ text?: string }> => {
  const w = WORDS[lang]
  const choice = switchOf(args)
  if (choice === 'on' || choice === 'off') return runEnabled($, choice === 'on')
  const [verb = '', arg = ''] = args.trim().toLowerCase().split(/\s+/)
  if (verb === 'warn') {
    if (arg === '') return { text: w.warnIs(await read($, switchAt)) }
    const percent = percentOf(arg)
    if (percent === null) return { text: w.help }
    await setSwitchAt($, percent)
    return { text: w.warnSet(percent) }
  }
  if (verb === 'keep-warm') {
    if (arg === 'on') return { text: await startKeep($) }
    if (arg === 'off') {
      await stopKeep($, 'manual')
      return { text: w.keepOff }
    }
    return { text: (await read($, keepWarm)) ? w.keepOn : w.keepOff }
  }
  switch (args.trim().toLowerCase()) {
    case 'hide':
      await setHidden($, true)
      return { text: w.hidden }
    case 'show':
      await setHidden($, false)
      return { text: w.shown }
    case 'help':
      return { text: w.help }
    case '': {
      const opened = await open($)
      if (opened?.isPlaced) return {}
      const list = await read($, turns)
      return { text: summary(await read($, snapshot), list[list.length - 1], await $.clock.now(), lang) }
    }
    default:
      return { text: w.help }
  }
}

/** Puts a text in the prompt for the person to send; runs nothing. */
const fill = async ($: EngineInterface, text: string) => {
  await $.prompt.fill(fillArgs(text))
}

/** The pane's verbs: each one is undone by another, so all of them run. */
const VERBS: readonly Verb[] = [{ verb: 'hide' }, { verb: 'show' }, { verb: 'keep-warm on' }, { verb: 'keep-warm off' }, { verb: 'help' }]

/** A verb pressed in the pane: runs and writes its answer to the transcript. */
const pressVerb = async ($: EngineInterface, v: Verb) => {
  try {
    if (v.fill) return await fill($, v.fill)
    const { text } = await runCommand($, v.verb)
    for (const line of linesOf(text)) $.ui.log(line)
  } catch {
    $.ui.toast(WORDS[lang].failedToRun(`/${COMMAND} ${v.verb}`))
  }
}

export const register: Register = (on, options) => {
  lang = langOf(options.language)
  const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Math.max(1, Math.min(100, Number(v))) : d)
  warnAt = num(options.warnAt, 70)
  dangerAt = Math.max(warnAt, num(options.dangerAt, 90))
  cells = cellsOf(options.cells)
  density = options.density === 'bars' || options.density === 'mini' || options.density === 'numbers' ? options.density : 'auto'
  format = options.format === 'compact' ? 'compact' : 'full'
  style = styleOf(options.icons)
  isOn = options.enabled !== false
  isQuiet = options.quiet === true

  on('session.start', async ($, e, next) => {
    const result = await next(e)
    lang = langOf(options.language, await $.env.get('LANG').catch(() => undefined))
    style = styleOf(options.icons, await $.env.get('TERMINAL_EMULATOR').catch(() => undefined))
    steps = 0
    keepSentAt = null
    await $.command.register({
      name: COMMAND,
      description: WORDS[lang].description,
      argumentHint: '[on|off|hide|show|keep-warm on|off|warn N|help]',
      immediate: true,
    })
    if (!isOn) return result
    const hidden = (await $.store.get(KEY_HIDDEN).catch(() => undefined)) === true
    await update($, isHidden, () => hidden)
    const kept = await $.store.get(KEY_SWITCH).catch(() => undefined)
    await update($, switchAt, () => (typeof kept === 'number' && kept >= 1 && kept <= 100 ? kept : SWITCH_AT))
    try {
      const id = await $.session.model()
      await update($, model, () => id || null)
    } catch {
      // The first turn.step brings it.
    }
    try {
      await seeEffort($, effortOfConfig(await $.config.list()), 'config')
    } catch {
      // The first request or turn end brings it.
    }
    try {
      const usage = await $.session.usage()
      await update($, snapshot, () => toSnapshot(usage.context, usage.rateLimits))
    } catch {
      // No figures yet; the first session.measure brings them.
    }
    await takeGroups($)
    return result
  })

  on('command.run', { command: COMMAND }, ($, e) => runCommand($, e.args))

  // Off: only the command above answers, so `/limits on` can bring the rest back.
  if (!isOn) return

  on('session.measure', async ($, e, next) => {
    const result = await next(e)
    await take($, toSnapshot(e.context, e.rateLimits))
    await takeGroups($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (!e.agentId && e.usage) {
      const now = await $.clock.now()
      // A keep-warm turn refreshes the cache but is no turn of the person's: it stays out of the table.
      const kept = keepSentAt !== null
      keepSentAt = null
      const turn = { ...toTurn(e.usage, e.durationMs), contextPercent: (await read($, snapshot)).contextPercent, endedAt: now, steps }
      steps = 0
      const ttl = kept ? null : inferTtl((await read($, turns)).at(-1), turn)
      await update($, cache, c => ({ lastAt: now, ttl: ttl ?? c.ttl }))
      if (!kept) await update($, turns, list => [...list, turn].slice(-TURNS_KEPT))
      if ((await read($, cache)).ttl !== null) ensureTicker($)
    }
    return result
  })

  // A switch to a costlier model: the band's model and, near the 5-hour limit, a toast. A resumed
  // session restores its model, which is no switch. The new model may take no effort, or another
  // default: the effort starts over and the next source fills it. Fail-open: the switch goes on.
  on('classic.PostModelSwitch', async ($, e, next) => {
    const result = await next(e)
    await update($, model, () => e.to_model)
    // The new model has no cache yet; the TTL is what the engine says it will use.
    await update($, cache, c => ({ lastAt: null, ttl: e.cache_ttl ?? c.ttl }))
    if (e.source !== 'resume') {
      const now = await read($, effort)
      await warnIfCostly($, { model: e.from_model, effort: now }, { model: e.to_model, effort: now })
    }
    if (e.from_model !== e.to_model) {
      effortFrom = null
      await update($, effort, () => null)
    }
    return result
  }).catch(($, e, next) => next(e))

  // The main loop's model and effort as each request goes out; effort turning to max warns here,
  // on the first request at max, since a /effort command raises no event of its own.
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) {
      steps += 1
      try {
        await update($, model, () => e.model)
        await seeEffort($, e.effort, 'request', e.model)
      } catch {
        // The band keeps what it had; the request goes on.
      }
    }
    return yield* next(e)
  })

  // The turn's end carries its effort too (`effort.level`), where the requests carry none. One a
  // turn on main, in order: unlike PostToolUse, which may run in parallel and toast twice.
  on('classic.Stop', async ($, e, next) => {
    const result = await next(e)
    if (!e.agent_id) await seeEffort($, e.effort?.level, 'turnEnd')
    return result
  }).catch(($, e, next) => next(e))

  // The person's own prompt refreshes the cache, so keep-warm has nothing left to do.
  on('prompt.submit', async ($, e, next) => {
    if (e.origin?.kind !== 'plugin') await stopKeep($, 'prompt')
    return next(e)
  })

  // The keep-warm message is a real turn; the transcript draws it as one dim row.
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (e.props.origin.kind !== 'plugin' || !e.props.text.includes('Keep-warm ping from limits-meter')) return next(e)
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{WORDS[lang].keepRow}</Text>
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)
    const s = await read($, snapshot)
    if (isQuiet) {
      const five = s.limits.find(l => l.kind === 'five_hour')
      if (!five || five.percent < QUIET_ALERT_AT) return next(e)
      const { Box, Text } = $.ui.resolve(e)
      const line = <Text key="quiet-alert" color="error" bold>{`! ${WORDS[lang].windowAlert(label(five.kind, lang), pct(five.percent), resetIn(five.resetsAt, await $.clock.now(), lang))}`}</Text>
      const theirs = await next(e)
      return theirs ? <Box key="quiet" flexDirection="column">{theirs}{line}</Box> : line
    }
    if (s.limits.length === 0 && s.contextPercent === null) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const w = WORDS[lang]
    const now = await $.clock.now()
    const list = await read($, turns)
    const last = list[list.length - 1]
    const clock = clockOf(await read($, cache), now)
    const kept = (await read($, keepWarm)) !== null
    const g = await read($, groups)
    const parts = g && s.contextPercent !== null ? splitOf(s.contextPercent, g) : null
    const columns = e.props.bodyColumns || e.viewport?.columns || 80
    const width = barWidth(columns)
    const meter = (percent: number) =>
      width > 0 ? <Text color={tone(percent)}>{`${bar(width, percent)} `}</Text> : width === 0 ? <Text color={tone(percent)}>{mini(percent)}</Text> : null
    // The context bar split by group when the engine gave a breakdown: solid cells per group, free shaded.
    const ctxMeter = (percent: number) => {
      if (!parts || width <= 0) return meter(percent)
      const c = barCells(width, parts)
      return (
        <Text>
          <Text color={groupColor('system', percent)}>{'█'.repeat(c.system)}</Text>
          <Text color={groupColor('mcp', percent)}>{'█'.repeat(c.mcp)}</Text>
          <Text color={groupColor('messages', percent)}>{'█'.repeat(c.messages)}</Text>
          <Text dimColor>{`${'░'.repeat(c.free)} `}</Text>
        </Text>
      )
    }
    const id = await read($, model)
    const level = await read($, effort)
    // The model in the accent color; the effort as a five-step gauge and its name, max in warning.
    const setting =
      (id || level !== null) && shows('model') ? (
        <Text key="model">
          {id && <Text color="claude" bold>{shortModel(id)}</Text>}
          {id && level !== null && <Text> </Text>}
          {level !== null && effortView(Text, level)}
        </Text>
      ) : null

    const verbs = [
      ...(clock?.state === 'cooling' && !kept ? [<Button key="keep" label={w.keepWarm} plain color="warning" onPress={() => void pressKeep($)} />] : []),
      ...(kept ? [<Button key="keep-stop" label={w.keepStop} plain dimColor onPress={() => void stopKeep($, 'manual')} />] : []),
      ...(needsCompact(s) ? [<Button key="compact" label={w.compact} plain color="warning" onPress={() => fill($, w.compactFill)} />] : []),
      <Button key="details" label={w.details} plain dimColor onPress={() => open($)} />,
      <Button key="hide" label={w.hide} plain dimColor onPress={() => setHidden($, true)} />,
    ]

    if (format === 'compact') {
      // model · effort · ctx 8% · 5h 34% · wk 31%: numbers only, one line.
      const cell = (key: string, name: string, percent: number | null) => (
        <Text key={key}>
          <Text dimColor>{`${name} `}</Text>
          <Text color={tone(percent)} bold>{pct(percent)}</Text>
        </Text>
      )
      const parts = [
        ...(setting ? [setting] : []),
        ...(shows('ctx') ? [cell('ctx', 'ctx', s.contextPercent)] : []),
        ...s.limits.filter(l => shows(CELL_IDS[l.kind] ?? l.kind)).map(l => cell(l.kind, label(l.kind, lang), l.percent)),
      ]
      const line = (
        <Box key="limits-meter" flexDirection="row" flexWrap="wrap" gap={2} paddingX={1}>
          <Text key="numbers">{parts.flatMap((p, i) => (i > 0 ? [<Text key={`sep-${i}`} dimColor> · </Text>, p] : [p]))}</Text>
          {verbs}
        </Box>
      )
      const beneath = await next(e)
      return beneath ? (
        <Box flexDirection="column">
          {line}
          {beneath}
        </Box>
      ) : (
        line
      )
    }

    const band = [
      ...(setting ? [setting] : []),
      ...s.limits
        .filter(l => shows(CELL_IDS[l.kind] ?? l.kind))
        .map(l => {
          const reset = resetIn(l.resetsAt, now, lang)
          return (
            <Text key={l.kind}>
              <Text dimColor>{`${label(l.kind, lang)} `}</Text>
              {meter(l.percent)}
              <Text color={tone(l.percent)} bold>{pct(l.percent)}</Text>
              {reset !== '' && <Text dimColor>{` ↻${reset}`}</Text>}
            </Text>
          )
        }),
      ...(shows('ctx')
        ? [
            <Text key="ctx">
              <Text dimColor>ctx </Text>
              {s.contextPercent !== null && ctxMeter(s.contextPercent)}
              <Text color={tone(s.contextPercent)} bold>{pct(s.contextPercent)}</Text>
            </Text>,
          ]
        : []),
      ...((clock || last?.cacheHit != null) && shows('cache')
        ? [
            <Text key="cache">
              <Text dimColor>cache </Text>
              {clock ? clockView(Text, clock, kept) : <Text>{pct(last!.cacheHit! * 100)}</Text>}
            </Text>,
          ]
        : []),
    ]

    // The legend under the cells: which color is which group, with its share of the window.
    const legend =
      parts && g && shows('ctx') ? (
        <Box key="legend" flexDirection="row" paddingX={1}>
          <Text>
            <Text dimColor>{`${w.ctxLabel}  `}</Text>
            <Text color={groupColor('system', s.contextPercent)}>{`█ ${w.groups.system} ${parts.system}%`}</Text>
            {g.mcp > 0 && <Text dimColor> · </Text>}
            {g.mcp > 0 && <Text color={groupColor('mcp', s.contextPercent)}>{`█ ${w.groups.mcp} ${parts.mcp}%`}</Text>}
            <Text dimColor> · </Text>
            <Text color={groupColor('messages', s.contextPercent)}>{`█ ${w.groups.messages} ${parts.messages}%`}</Text>
            <Text dimColor>{` · ░ ${w.groups.free} ${parts.free}%`}</Text>
          </Text>
        </Box>
      ) : null

    const row = (
      <Box key="band" flexDirection="row" flexWrap="wrap" gap={2} paddingX={1}>
        {band}
        {verbs}
      </Box>
    )
    const mine = legend ? (
      <Box key="limits-meter" flexDirection="column">
        {row}
        {legend}
      </Box>
    ) : (
      row
    )
    const theirs = await next(e)
    return theirs ? (
      <Box flexDirection="column">
        {mine}
        {theirs}
      </Box>
    ) : (
      mine
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const w = WORDS[lang]
    const s = await read($, snapshot)
    const list = await read($, turns)
    const readings = await read($, samples)
    const now = await $.clock.now()
    const columns = Math.max(30, (e.props.bodyColumns || e.viewport?.columns || 80) - 2)
    const width = Math.max(10, Math.min(40, columns - 30))
    const paces = s.limits.map(l => {
      const points = readings[l.kind]
      return l.resetsAt !== null && points && points.resetsAt === l.resetsAt ? pace(points.points, now, l.resetsAt) : null
    })
    const trend = list.filter(t => t.contextPercent != null)
    const top = heaviest(list)
    const id = await read($, model)
    const level = await read($, effort)
    const at = await read($, switchAt)
    const choices = [...new Set([...SWITCH_CHOICES, at])].sort((a, b) => a - b)
    const c = await read($, cache)
    const clock = clockOf(c, now)
    const keep = await read($, keepWarm)
    const g = await read($, groups)
    const parts = g && s.contextPercent !== null ? splitOf(s.contextPercent, g) : null
    const lastTurn = list[list.length - 1]
    const re = tokens(s.contextTokens ?? 0)
    // The cache sentence of the state: kept warm, or warm, cooling or cold.
    const sentence = keep ? w.cacheKeeping(resetIn(keep.until, now, lang)) : clock?.state === 'cold' ? w.cacheCold(re) : clock?.state === 'cooling' ? w.cacheCooling(re) : w.cacheWarm(re)
    const share = (n: number) => `${((n / (g?.window || 1)) * 100).toFixed(n / (g?.window || 1) < 0.1 ? 1 : 0)}%`
    const usedTokens = g ? g.system + g.mcp + g.messages : 0
    // Rows besides the turns: the hint, three headings, the context row, the table head, the
    // footer, the gaps, a pace line per window that has one and the trend line; then the
    // costly-switch section (heading, hint, choices, order, gap) and the model's (heading, row, gap).
    const fixed = 12 + (g ? g.rows.length + 4 : 0) + 5 + Math.max(1, s.limits.length) + paces.filter(p => p !== null).length + (trend.length > 1 ? 1 : 0) + 5 + (id || level !== null ? 3 : 0)
    const room = Math.max(3, (e.props.scroll?.bodyRows ?? e.viewport?.rows ?? 30) - fixed)
    const [cIn, cOut, cCache, cTime, cModel] = w.columns

    return (
      <Box flexDirection="column" paddingX={1} gap={1}>
        <Text dimColor>{w.hint}</Text>

        <Box flexDirection="column">
          <Text bold>{w.planWindows}</Text>
          {s.limits.length === 0 && <Text dimColor>{w.noWindows}</Text>}
          {s.limits.map((l, i) => {
            const left = paces[i]
            return (
              <Box key={l.kind} flexDirection="column">
                <Text>
                  <Text dimColor>{label(l.kind, lang).padEnd(6)}</Text>
                  <Text color={tone(l.percent)}>{bar(width, l.percent)}</Text>
                  <Text bold color={tone(l.percent)}>{` ${pct(l.percent).padStart(4)}`}</Text>
                  <Text dimColor>{l.resetsAt !== null ? `  ${w.resetsIn(resetIn(l.resetsAt, now, lang))}` : ''}</Text>
                </Text>
                {left != null && <Text color="warning">{`      ${w.pace(label(l.kind, lang), resetIn(now + left, now, lang))}`}</Text>}
              </Box>
            )
          })}
        </Box>

        <Box flexDirection="column">
          <Text bold>{w.cacheHeading}</Text>
          {clock && c.ttl ? (
            <Box flexDirection="column">
              <Box flexDirection="row" flexWrap="wrap" gap={2}>
                <Text>
                  {clockView(Text, clock, keep !== null)}
                  <Text dimColor>{`  ${w.cacheOf(c.ttl === '1h' ? '1 h' : '5 min')}`}</Text>
                </Text>
                {keep === null && clock.state !== 'cold' && <Button key="keep" label={w.keepWarm} plain color="warning" onPress={() => void pressKeep($)} />}
                {keep !== null && <Button key="keep-stop" label={w.keepStop} plain dimColor onPress={() => void stopKeep($, 'manual')} />}
              </Box>
              <Text dimColor>{sentence}</Text>
            </Box>
          ) : (
            <Text dimColor>{w.cacheUnknown}</Text>
          )}
          {lastTurn?.cacheHit != null && <Text dimColor>{w.hitRate(pct(lastTurn.cacheHit * 100))}</Text>}
        </Box>

        <Box flexDirection="column">
          <Text bold>{w.contextHeading}</Text>
          <Box flexDirection="row" flexWrap="wrap" gap={2}>
            <Text>
              <Text dimColor>{'ctx   '}</Text>
              {parts && s.contextPercent !== null ? (
                <Text>
                  <Text color={groupColor('system', s.contextPercent)}>{'█'.repeat(barCells(width, parts).system)}</Text>
                  <Text color={groupColor('mcp', s.contextPercent)}>{'█'.repeat(barCells(width, parts).mcp)}</Text>
                  <Text color={groupColor('messages', s.contextPercent)}>{'█'.repeat(barCells(width, parts).messages)}</Text>
                  <Text dimColor>{'░'.repeat(barCells(width, parts).free)}</Text>
                </Text>
              ) : (
                <Text color={tone(s.contextPercent)}>{bar(width, s.contextPercent ?? 0)}</Text>
              )}
              <Text bold>{` ${pct(s.contextPercent).padStart(4)}`}</Text>
              <Text dimColor>{s.contextTokens !== null ? `  ${w.ofWindow(tokens(s.contextTokens), tokens(s.contextWindow))}` : ''}</Text>
            </Text>
            {needsCompact(s) && <Button key="compact" label={w.compact} plain color="warning" onPress={() => fill($, w.compactFill)} />}
          </Box>
          {trend.length > 1 && (
            <Text>
              <Text dimColor>{'      '}</Text>
              <Text color={tone(s.contextPercent)}>{contextSpark(list.slice(-width))}</Text>
              <Text dimColor>{`  ${w.trend(Math.min(list.length, width))}`}</Text>
            </Text>
          )}
          {g && (
            <Box flexDirection="column">
              <Text dimColor>{`      ${w.breakdownHead}`}</Text>
              {g.rows.map(r => (
                <Text key={`row-${r.name}`}>
                  <Text color={groupColor(r.group, s.contextPercent)}>{'      █ '}</Text>
                  <Text>{clip(r.name, 22).padEnd(22)}</Text>
                  <Text>{tokens(r.tokens).padStart(6)}</Text>
                  <Text dimColor>{share(r.tokens).padStart(7)}</Text>
                </Text>
              ))}
              <Text dimColor>{`      ░ ${w.groups.free.padEnd(22)}${tokens(Math.max(0, g.window - usedTokens)).padStart(6)}${share(Math.max(0, g.window - usedTokens)).padStart(7)}`}</Text>
              <Text dimColor>{`      ${w.breakdownNote}`}</Text>
            </Box>
          )}
        </Box>

        {(id || level !== null) && (
          <Box flexDirection="column">
            <Text bold>{w.modelHeading}</Text>
            <Text>
              {id && <Text color="claude" bold>{shortModel(id)}</Text>}
              {level !== null && <Text dimColor>{`${id ? '   ' : ''}${w.effort} `}</Text>}
              {level !== null && effortView(Text, level)}
            </Text>
          </Box>
        )}

        <Box flexDirection="column">
          <Text bold>{w.warnHeading}</Text>
          <Text dimColor>{w.warnHint}</Text>
          <Box flexDirection="row" flexWrap="wrap">
            {choices.map((n, i) => (
              <Box key={`warn-${n}`} flexDirection="row">
                {i > 0 && <Text dimColor> · </Text>}
                {n === at ? (
                  <Text color="claude" bold>{`${n}%`}</Text>
                ) : (
                  <Button key={`warn:${n}`} plain dimColor label={`${n}%`} onPress={() => setSwitchAt($, n).then(() => $.ui.toast(w.warnSet(n)), () => $.ui.toast(w.failedToRun(`/${COMMAND} warn ${n}`)))} />
                )}
              </Box>
            ))}
          </Box>
          <Text dimColor>{w.warnOrder}</Text>
        </Box>

        <Box flexDirection="column">
          <Text bold>{w.turns}</Text>
          {list.length === 0 && <Text dimColor>{w.noTurns}</Text>}
          {list.length > 0 && <Text dimColor>{`    ${cIn.padStart(8)}${cOut.padStart(8)}${cCache.padStart(7)}${cTime.padStart(7)}  ${cModel}`}</Text>}
          {list.slice(-room).map((t, i, shown) => {
            const isTop = list.length > 1 && t === top
            return (
              <Text key={`turn-${list.length - shown.length + i}`}>
                <Text dimColor>{`#${list.length - shown.length + i + 1}`.padEnd(4)}</Text>
                <Text color={isTop ? 'claude' : undefined} bold={isTop}>{tokens(t.input).padStart(8)}</Text>
                <Text>{tokens(t.output).padStart(8)}</Text>
                <Text color={t.cacheHit !== null && t.cacheHit < 0.5 ? 'warning' : undefined}>{pct(t.cacheHit === null ? null : t.cacheHit * 100).padStart(7)}</Text>
                <Text dimColor>{`${`${Math.round(t.durationMs / 1000)}s`.padStart(7)}  ${shortModel(t.model)}`}</Text>
              </Text>
            )
          })}
        </Box>

        <Box flexDirection="row" flexWrap="wrap" gap={2}>
          {verbRow({ Box, Text, Button }, COMMAND, VERBS, v => pressVerb($, v))}
          <Button key="close" role="dismiss" label={w.close} onPress={() => $.ui.close({ id: PANE })} />
        </Box>
      </Box>
    )
  })
}
