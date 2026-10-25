import { expect, mock, test } from 'claude-code/testing'

const NOW = Date.parse('2026-10-08T12:00:00Z')
const LIMITS = [
  { kind: 'five_hour', percentUsed: 64, resetsAt: '2026-10-08T13:12:00Z' },
  { kind: 'seven_day', percentUsed: 31, resetsAt: '2026-10-11T16:00:00Z' },
]
const MEASURE = { context: { tokens: 116_000, window: 200_000, percent: 58 }, rateLimits: LIMITS, changed: ['context', 'rateLimits'] }
const FULL = { context: { tokens: 172_000, window: 200_000, percent: 86 }, rateLimits: LIMITS, changed: ['context'] }
const turn = (n: number) => ({
  answer: 'done',
  durationMs: 12_000,
  isAborted: false,
  turnId: `t${n}`,
  reason: 'answer',
  usage: { input_tokens: 1000, output_tokens: 1300, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 2000, model: 'claude-opus-5-5' },
})

// The window by the engine's categories at 116k of 200k: system 23k, MCP 14k (github 9k, notion 5k), messages 79k.
const BREAKDOWN = {
  categories: [
    { name: 'System prompt', tokens: 6000, kind: 'used' },
    { name: 'System tools', tokens: 12_000, kind: 'used' },
    { name: 'MCP tools', tokens: 14_000, kind: 'used' },
    { name: 'Memory files', tokens: 3000, kind: 'used' },
    { name: 'Skills', tokens: 2000, kind: 'used' },
    { name: 'Messages', tokens: 79_000, kind: 'used' },
    { name: 'Free space', tokens: 51_000, kind: 'free' },
    { name: 'Autocompact buffer', tokens: 33_000, kind: 'buffer' },
  ],
  maxTokens: 200_000,
  mcpTools: [
    { name: 'mcp__github__a', serverName: 'github', tokens: 9000, isLoaded: true },
    { name: 'mcp__notion__a', serverName: 'notion', tokens: 5000, isLoaded: true },
  ],
}
const SWITCH = { from_model: 'claude-sonnet-5-5', to_model: 'claude-opus-5-5', requested_model: 'opus', source: 'command', context_tokens: 0, prompt_cache_warm: false, cache_ttl: '1h', estimated_cache_write_usd: 0, pricing: 'catalog' }
const MIN = 60_000

type World = {
  toasts: string[]
  fills: string[]
  logs: string[]
  opened: string[]
  closed: string[]
  submits: string[]
  origins: string[]
  asked: string[]
  /** What the person picks when asked; null dismisses the question. */
  answer: string | null
  clock: ReturnType<typeof mock.clock>
}

function engine(on: any, env: Record<string, string> = {}, beneath?: string, breakdown: boolean | object = false): World {
  const world: World = { toasts: [], fills: [], logs: [], opened: [], closed: [], submits: [], origins: [], asked: [], answer: 'yes, keep warm', clock: mock.clock(on, { now: NOW }) }
  mock.store(on)
  on('env.get', ($: any, e: any) => ({ value: env[e.name] }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', ($: any, e: any) => ({ cwd: e.cwd }) as never)
  on('ui.open', ($: any, e: any) => (world.opened.push(e.id), { value: { isPlaced: true } }) as never)
  on('ui.close', ($: any, e: any) => (world.closed.push(e.id), { value: undefined }) as never)
  on('ui.toast', ($: any, e: any) => (world.toasts.push(e.text), { value: undefined }) as never)
  on('ui.log', ($: any, e: any) => (world.logs.push(e.text), { value: undefined }) as never)
  on('prompt.fill', ($: any, e: any) => (world.fills.push(e.text), { isFilled: true, text: e.text, cursor: e.text.length }) as never)
  on('session.measure', () => ({ changed: ['context', 'rateLimits'] }) as never)
  if (breakdown) on('session.usage', () => ({ value: { context: { ...MEASURE.context, breakdown: breakdown === true ? BREAKDOWN : breakdown }, rateLimits: [] } }) as never)
  on('prompt.submit', ($: any, e: any) => (world.submits.push(e.text), world.origins.push(JSON.stringify(e.origin)), { text: e.text }) as never)
  on('tool.call', ($: any, e: any) => {
    if (e.tool !== 'AskUserQuestion') return { result: 'ok', text: 'ok' } as never
    const question = String(e.questions[0].question)
    world.asked.push(question)
    if (world.answer === null) return { deny: 'dismissed' } as never
    return { result: { questions: e.questions, answers: { [question]: world.answer } } } as never
  })
  on('turn.complete', () => ({ text: 'done' }) as never)
  on('turn.step', async function* () {
    return { turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' }
  } as never)
  on('classic.PostModelSwitch', () => ({}) as never)
  on('classic.Stop', () => ({}) as never)
  on('classic.PostToolUse', () => ({}) as never)
  // What is beneath on the same line: empty, or another mod's row.
  on('ui.render', ($: any, e: any) => {
    const { Box, Text } = $.ui.resolve(e)
    return (beneath ? Box({ key: 'beneath', children: Text({ children: beneath }) }) : Box({ key: 'engine' })) as never
  })
  return world
}

const start = ($: any, surface = 'terminal') => $.session.start({ cwd: '/repo', surface, isInteractive: true } as never)
const run = ($: any, args: string) => $.command.run({ command: 'limits', args, origin: { kind: 'composer' } } as never) as Promise<{ text?: string }>
const band = ($: any, surface = 'terminal') =>
  $.ui.mount({ plugin: 'limits-meter', surface, component: 'AbovePrompt', props: { bodyColumns: 140, hasSurvey: false }, viewport: { columns: 140, rows: 40 } } as never)
const pane = ($: any, surface = 'terminal', bodyRows = 40) =>
  $.ui.mount({ plugin: 'limits-meter', surface, component: 'Pane', requestId: 'limits', props: { title: 'Limits & context', isFocused: true, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows }, view: {} }, viewport: { columns: 82, rows: 40 } } as never)

for (const surface of ['terminal', 'desktop'] as const) {
  test(`band and pane show limits, context and turns on ${surface}`, async ($, on) => {
    const world = engine(on)
    await start($, surface)
    await $.session.measure(MEASURE as never)
    await $.turn.complete(turn(1) as never)

    const b = await band($, surface)
    const drawn = JSON.stringify(await b.drawn())
    expect(drawn).toContain('64%')
    expect(drawn).toContain('↻1h12')
    expect(drawn).toContain('58%')
    expect(drawn).toContain('cache')
    expect(drawn).toContain('details')
    expect(drawn).not.toContain('compact')
    await b.press({ key: 'details' })
    expect(world.opened).toEqual(['limits'])
    await b.unmount()

    expect(await run($, '')).toEqual({})
    const p = await pane($, surface)
    const shown = JSON.stringify(await p.drawn())
    expect(shown).toContain('Figures the engine reports after each turn')
    expect(shown).toContain('resets in 1h12')
    expect(shown).toContain('116k of 200k')
    expect(shown).toContain('\"    1.3k\"')
    expect(shown).toContain('model')
    expect(shown).toContain('opus 5.5')
    expect(shown).toContain('Close')
    await p.unmount()
  })
}

test('from 85% context the band and the pane offer compact, which only fills the prompt', async ($, on) => {
  const world = engine(on)
  await start($)
  await $.session.measure(FULL as never)
  expect(world.toasts).toEqual(['Context 86% full: a good moment for /compact with a focus'])

  const b = await band($)
  expect(JSON.stringify(await b.drawn())).toContain('compact')
  await b.press({ key: 'compact' })
  expect(world.fills).toEqual(['/compact [focus]'])
  await b.unmount()

  const p = await pane($)
  await p.press({ key: 'compact' })
  expect(world.fills).toEqual(['/compact [focus]', '/compact [focus]'])
  expect(world.logs).toEqual([])
  await p.unmount()
})

test('hide is kept for the next session, and show brings the band back', async ($, on) => {
  engine(on)
  await start($)
  await $.session.measure(MEASURE as never)

  const b = await band($)
  await b.press({ key: 'hide' })
  expect(JSON.stringify(await b.drawn())).not.toContain('64%')
  await b.unmount()

  await start($) // a new session reads the store
  const again = await band($)
  expect(JSON.stringify(await again.drawn())).not.toContain('64%')
  expect((await run($, 'show')).text).toBe('Band shown.')
  expect(JSON.stringify(await again.drawn())).toContain('64%')
  await again.unmount()

  await start($)
  const shown = await band($)
  expect(JSON.stringify(await shown.drawn())).toContain('64%')
  await shown.unmount()
})

test('the pane footer: hide and show run, help writes to the transcript, Close closes', async ($, on) => {
  const world = engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  const p = await pane($)
  await p.press({ key: 'verb:help' })
  expect(world.logs[0]).toContain('/limits          open the pane')
  expect(world.logs).toHaveLength(5)
  await p.press({ key: 'verb:hide' })
  expect(world.logs.at(-1)).toBe('Band hidden. /limits show brings it back.')
  const b = await band($)
  expect(JSON.stringify(await b.drawn())).not.toContain('64%')
  await p.press({ key: 'verb:show' })
  expect(JSON.stringify(await b.drawn())).toContain('64%')
  await b.unmount()
  await p.press({ key: 'close' })
  expect(world.closed).toEqual(['limits'])
  await p.unmount()
  expect((await run($, 'nope')).text).toContain('/limits hide')
})

test('the pane fits the turns to its rows', async ($, on) => {
  engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  for (let i = 1; i <= 20; i++) await $.turn.complete(turn(i) as never)
  // 30 rows: 25 for the rest of the pane with two plan windows, the cache section, the trend line
  // and the costly-switch section, 5 turns.
  const p = await pane($, 'terminal', 30)
  const shown = JSON.stringify(await p.drawn())
  expect(shown).toContain('#20')
  expect(shown).toContain('#16')
  expect(shown).not.toContain('#15')
  await p.unmount()
})

test('Portuguese from LANG: band, pane, toasts and answers', async ($, on) => {
  const world = engine(on, { LANG: 'pt_BR.UTF-8' })
  await start($)
  await $.session.measure({ ...FULL, rateLimits: [{ kind: 'five_hour', percentUsed: 92, resetsAt: '2026-10-08T13:12:00Z' }, LIMITS[1]] } as never)
  expect(world.toasts).toEqual(['Janela 5h em 92%, reinicia em 1h12', 'Contexto 86% cheio: bom momento para /compact com um foco'])

  const b = await band($)
  const drawn = JSON.stringify(await b.drawn())
  expect(drawn).toContain('sem ')
  expect(drawn).toContain('detalhes')
  expect(drawn).toContain('ocultar')
  await b.press({ key: 'compact' })
  expect(world.fills).toEqual(['/compact [foco]'])
  await b.unmount()

  const p = await pane($)
  const shown = JSON.stringify(await p.drawn())
  expect(shown).toContain('Janelas do plano')
  expect(shown).toContain('reinicia em 1h12')
  expect(shown).toContain('172k de 200k')
  expect(shown).toContain('Fechar')
  await p.unmount()
  expect((await run($, 'hide')).text).toBe('Banda oculta. /limits show traz de volta.')
})

const at = (percent: number, minutes: number) => ({
  context: { tokens: 116_000, window: 200_000, percent: 58 },
  rateLimits: [{ kind: 'five_hour', percentUsed: percent, resetsAt: '2026-10-08T15:00:00Z' }],
  changed: ['rateLimits'],
  minutes,
})

test('the pane says when a window reaches 100% at the current pace, before it resets', async ($, on) => {
  const { clock } = engine(on)
  await start($)
  // 40% to 70% in 30 minutes: 100% about 30 minutes later, well before the 15:00 reset.
  for (const [percent, minutes] of [[40, 0], [50, 10], [60, 20], [70, 30]] as const) {
    await clock.advance(minutes === 0 ? 0 : 10 * 60_000)
    await $.session.measure(at(percent, minutes) as never)
  }
  const p = await pane($)
  expect(JSON.stringify(await p.drawn())).toContain('at this pace, 5h reaches 100% in ~30m, before it resets')
  await p.unmount()
})

test('no pace line when the window resets first', async ($, on) => {
  const { clock } = engine(on)
  await start($)
  for (const percent of [10, 11, 12, 13]) {
    await $.session.measure(at(percent, 0) as never)
    await clock.advance(10 * 60_000)
  }
  const p = await pane($)
  expect(JSON.stringify(await p.drawn())).not.toContain('at this pace')
  await p.unmount()
})

test('the context trend and the heaviest turn', async ($, on) => {
  engine(on)
  await start($)
  for (const percent of [20, 35, 58]) {
    await $.session.measure({ ...MEASURE, context: { tokens: 1000, window: 200_000, percent } } as never)
    await $.turn.complete({ ...turn(percent), usage: { ...turn(0).usage, input_tokens: percent * 1000 } } as never)
  }
  const p = await pane($)
  const shown = JSON.stringify(await p.drawn())
  expect(shown).toContain('▂▃▅')
  expect(shown).toContain('context at the end of the last 3 turns')
  expect(shown).toContain('{\"color\":\"claude\",\"bold\":true},\"children\":[\"    100k\"]')
  await p.unmount()
})

test('cells and density shape the band', { options: { cells: 'ctx, cache', density: 'numbers' } }, async ($, on) => {
  engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await $.turn.complete(turn(1) as never)
  const b = await band($)
  const drawn = JSON.stringify(await b.drawn())
  expect(drawn).not.toContain('64%')
  expect(drawn).toContain('58%')
  expect(drawn).toContain('cache')
  expect(drawn).not.toContain('█')
  await b.unmount()
})

test('below 90 columns each bar is one cell, and warnAt sets the warning color', { options: { warnAt: 50 } }, async ($, on) => {
  engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  const b = await $.ui.mount({ plugin: 'limits-meter', surface: 'terminal', component: 'AbovePrompt', props: { bodyColumns: 80, hasSurvey: false }, viewport: { columns: 80, rows: 40 } } as never)
  const drawn = JSON.stringify(await b.drawn())
  expect(drawn).toContain('\"▅\"')
  expect(drawn).not.toContain('█')
  expect(drawn).toContain('{\"color\":\"warning\",\"bold\":true},\"children\":[\"58%\"]')
  await b.unmount()
})

test('the band stacks over the rows of the mods beneath it, never in their place', async ($, on) => {
  engine(on, {}, 'other mod row')
  await start($)
  await $.session.measure(MEASURE as never)
  const b = await band($)
  const drawn = JSON.stringify(await b.drawn())
  expect(drawn).toContain('64%')
  expect(drawn).toContain('other mod row')
  expect(drawn.indexOf('64%')).toBeLessThan(drawn.indexOf('other mod row'))
  await run($, 'hide')
  const hidden = JSON.stringify(await b.drawn())
  expect(hidden).not.toContain('64%')
  expect(hidden).toContain('other mod row')
  await b.unmount()
})

// 0.4.0: model and effort on the band, format compact, the costly-switch toast and its threshold.
// Test names follow the prototype's tabs (notes/prototypes/limits-meter-0.4.0.html).

const SONNET = 'claude-sonnet-5-5'
const OPUS = 'claude-opus-5-5'
const step = async ($: any, model: string, effort?: string | number, agentId?: string) => {
  const stream = $.turn.step({ turnId: 't1', index: 0, model, messageCount: 3, ...(effort !== undefined ? { effort } : {}), ...(agentId ? { agentId } : {}) })
  for await (const _ of stream) {
    // drain
  }
}
const switchTo = ($: any, from: string, to: string, source = 'command') =>
  $.classic.PostModelSwitch({ from_model: from, to_model: to, requested_model: null, source, context_tokens: 1000, cache_warm: true } as never)
/** The 5-hour window at `percent`, resetting at 15:00. */
const fiveAt = (percent: number, resetsAt = '2026-10-08T15:00:00Z') => ({
  context: { tokens: 82_000, window: 200_000, percent: 41 },
  rateLimits: [{ kind: 'five_hour', percentUsed: percent, resetsAt }, LIMITS[1]],
  changed: ['rateLimits'],
})
/** Three turns, 6 minutes apart, the 5-hour window rising from `from` by 6 points each. */
const climb = async ($: any, clock: any, from: number, resetsAt?: string) => {
  for (const [i, percent] of [from, from + 6, from + 12].entries()) {
    if (i > 0) await clock.advance(6 * 60_000)
    await $.session.measure(fiveAt(percent, resetsAt) as never)
    await $.turn.complete(turn(i) as never)
  }
}
const modelIs = (on: any, id: string) => on('session.model', () => ({ value: id }) as never)

for (const surface of ['terminal', 'desktop'] as const) {
  test(`normal: the full band leads with model and effort on ${surface}`, async ($, on) => {
    engine(on)
    modelIs(on, SONNET)
    await start($, surface)
    await $.session.measure(MEASURE as never)
    let drawn = JSON.stringify(await (await band($, surface)).drawn())
    expect(drawn).toContain('sonnet 5.5')
    expect(drawn.indexOf('sonnet 5.5')).toBeLessThan(drawn.indexOf('64%'))
    expect(drawn).toContain('█')
    await step($, SONNET, 'high')
    drawn = JSON.stringify(await (await band($, surface)).drawn())
    expect(drawn).toContain('\"high\"')
  })
}

test('effort max on the band is in the warning color; a subagent step changes nothing', async ($, on) => {
  engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await step($, OPUS, 'max')
  await step($, 'claude-haiku-4-5', 'low', 'agent-1')
  const drawn = JSON.stringify(await (await band($)).drawn())
  expect(drawn).toContain('opus 5.5')
  expect(drawn).toContain('{\"color\":\"warning\",\"dimColor\":false},\"children\":[\"▰▰▰▰▰ \"]')
  expect(drawn).toContain('{\"color\":\"warning\",\"bold\":true},\"children\":[\"max\"]')
  expect(drawn).toContain('{\"color\":\"claude\",\"bold\":true},\"children\":[\"opus 5.5\"]')
  expect(drawn).not.toContain('haiku')
})

test('cells without model hide model and effort', { options: { cells: '5h, ctx' } }, async ($, on) => {
  engine(on)
  modelIs(on, SONNET)
  await start($)
  await $.session.measure(MEASURE as never)
  const drawn = JSON.stringify(await (await band($)).drawn())
  expect(drawn).not.toContain('sonnet')
  expect(drawn).toContain('64%')
})

for (const columns of [80, 140]) {
  test(`compact: one line of numbers at ${columns} columns`, { options: { format: 'compact' } }, async ($, on) => {
    engine(on)
    modelIs(on, SONNET)
    await start($)
    await $.session.measure(MEASURE as never)
    await step($, SONNET, 'high')
    await $.turn.complete(turn(1) as never)
    const b = await $.ui.mount({ plugin: 'limits-meter', surface: 'terminal', component: 'AbovePrompt', props: { bodyColumns: columns, hasSurvey: false }, viewport: { columns, rows: 40 } } as never)
    const drawn = JSON.stringify(await b.drawn())
    const order = ['sonnet 5.5', 'high', 'ctx ', '58%', '5h ', '64%', 'wk ', '31%'].map(x => drawn.indexOf(x))
    expect(order.every(i => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(drawn).toContain(' · ')
    expect(drawn).not.toContain('█')
    expect(drawn).not.toContain('↻')
    expect(drawn).not.toContain('cache')
    expect(drawn).toContain('details')
    await b.press({ key: 'hide' })
    expect(JSON.stringify(await b.drawn())).not.toContain('64%')
    await b.unmount()
  })
}

test('compact stacks over the rows beneath it and offers compact from 85% context', { options: { format: 'compact' } }, async ($, on) => {
  const world = engine(on, {}, 'other mod row')
  await start($)
  await $.session.measure(FULL as never)
  const b = await band($)
  const drawn = JSON.stringify(await b.drawn())
  expect(drawn.indexOf('86%')).toBeLessThan(drawn.indexOf('other mod row'))
  await b.press({ key: 'compact' })
  expect(world.fills).toEqual(['/compact [focus]'])
  await b.unmount()
})

test('costly switch with pace: one toast with the minutes left', async ($, on) => {
  const world = engine(on)
  await start($)
  await climb($, world.clock, 70) // 70, 76, 82 over 12 minutes: 18 minutes to 100%
  world.toasts.length = 0
  await switchTo($, SONNET, OPUS)
  expect(world.toasts).toEqual(['5h at 82%: at this pace the window runs out in ~18 min · /limits'])
  expect(JSON.stringify(await (await band($)).drawn())).toContain('opus 5.5')
})

test('costly switch with no pace: no number', async ($, on) => {
  const world = engine(on, { LANG: 'pt_BR.UTF-8' })
  await start($)
  await $.session.measure(fiveAt(82) as never)
  world.toasts.length = 0
  await switchTo($, SONNET, 'claude-fable-5-1')
  expect(world.toasts).toEqual(['5h em 82%: fable gasta a janela mais rápido · /limits'])
})

test('effort max: the toast comes with the first request at max, once', async ($, on) => {
  const world = engine(on)
  await start($)
  await step($, SONNET, 'high')
  await climb($, world.clock, 70)
  world.toasts.length = 0
  await step($, SONNET, 'max')
  expect(world.toasts).toEqual(['5h at 82%: at this pace the window runs out in ~18 min · /limits'])
  await step($, SONNET, 'max')
  expect(world.toasts).toHaveLength(1)
})

test('switch below the threshold, to a cheaper model, or on resume: no toast', async ($, on) => {
  const world = engine(on)
  await start($)
  await $.session.measure(fiveAt(45) as never)
  await switchTo($, SONNET, OPUS)
  await $.session.measure(fiveAt(92) as never)
  world.toasts.length = 0
  await switchTo($, OPUS, SONNET)
  await switchTo($, SONNET, OPUS, 'resume')
  expect(world.toasts).toEqual([])
})

test('resets first: the toast says when the window resets', async ($, on) => {
  const world = engine(on, { LANG: 'pt_BR.UTF-8' })
  await start($)
  // 73, 79, 85 over 12 minutes: 15 minutes to 100%, and the window resets 12 minutes after.
  await climb($, world.clock, 73, '2026-10-08T12:24:00Z')
  world.toasts.length = 0
  await switchTo($, SONNET, OPUS)
  expect(world.toasts).toEqual(['5h em 85%: reinicia em 12m, antes de acabar · /limits'])
})

test('no plan (API key): model and context, no windows, no toast', { options: { format: 'compact' } }, async ($, on) => {
  const world = engine(on)
  modelIs(on, SONNET)
  await start($)
  await $.session.measure({ context: { tokens: 16_000, window: 200_000, percent: 8 }, rateLimits: [], changed: ['context'] } as never)
  await switchTo($, SONNET, OPUS)
  expect(world.toasts).toEqual([])
  const drawn = JSON.stringify(await (await band($)).drawn())
  expect(drawn).toContain('opus 5.5')
  expect(drawn).toContain('8%')
  expect(drawn).not.toContain('5h ')
})

test('/limits pane: model, effort and the threshold; a click sets it for later sessions', async ($, on) => {
  const world = engine(on)
  modelIs(on, SONNET)
  await start($)
  await $.session.measure(fiveAt(75) as never)
  await step($, SONNET, 'high')
  const p = await pane($)
  let shown = JSON.stringify(await p.drawn())
  expect(shown).toContain('Model')
  expect(shown).toContain('{\"color\":\"claude\",\"bold\":true},\"children\":[\"sonnet 5.5\"]')
  expect(shown).toContain('▰▰▰▱▱ ')
  expect(shown).toContain('Costly switch warning')
  expect(shown).toContain('{\"color\":\"claude\",\"bold\":true},\"children\":[\"70%\"]')
  expect(shown).toContain('order: haiku < sonnet < opus < fable')
  await p.press({ key: 'warn:80' })
  expect(world.toasts.at(-1)).toBe('Costly switch warning from 80%. Kept for later sessions.')
  shown = JSON.stringify(await p.drawn())
  expect(shown).toContain('{\"color\":\"claude\",\"bold\":true},\"children\":[\"80%\"]')
  await p.unmount()

  // 75% is now under the threshold: no toast.
  world.toasts.length = 0
  await switchTo($, SONNET, OPUS)
  expect(world.toasts).toEqual([])

  await start($) // a new session reads the store
  expect((await run($, 'warn')).text).toBe('Costly switch warning from 80%. /limits warn N changes it (1 to 100).')
})

test('/limits warn N: any whole percent from 1 to 100, shown in the pane in order', async ($, on) => {
  const world = engine(on)
  await start($)
  expect((await run($, 'warn 75')).text).toBe('Costly switch warning from 75%. Kept for later sessions.')
  expect((await run($, 'warn 0')).text).toContain('/limits warn N')
  expect((await run($, 'warn abc')).text).toContain('/limits warn N')
  const shown = JSON.stringify(await (await pane($)).drawn())
  expect(shown.indexOf('70%')).toBeLessThan(shown.indexOf('75%'))
  expect(shown.indexOf('75%')).toBeLessThan(shown.indexOf('80%'))
  await $.session.measure(fiveAt(76) as never)
  world.toasts.length = 0
  await switchTo($, SONNET, OPUS)
  expect(world.toasts).toEqual(['5h at 76%: opus uses the window faster · /limits'])
})

test('hidden: the band goes, the toast still comes', async ($, on) => {
  const world = engine(on)
  await start($)
  await $.session.measure(fiveAt(82) as never)
  await run($, 'hide')
  world.toasts.length = 0
  await switchTo($, SONNET, OPUS)
  expect(world.toasts).toEqual(['5h at 82%: opus uses the window faster · /limits'])
})

// Effort, from wherever the engine gives it: a request may carry none (seen live, 2026-10-09).

test('effort: a request with none keeps the known one; the turn end brings it', async ($, on) => {
  engine(on)
  modelIs(on, OPUS)
  await start($)
  await $.session.measure(MEASURE as never)
  await step($, OPUS) // no effort on the request
  let drawn = JSON.stringify(await (await band($)).drawn())
  expect(drawn).toContain('opus 5.5')
  expect(drawn).not.toContain('high')
  await $.classic.Stop({ stop_hook_active: false, effort: { level: 'high' } } as never)
  drawn = JSON.stringify(await (await band($)).drawn())
  expect(drawn).toContain('\"high\"')
  await step($, OPUS)
  drawn = JSON.stringify(await (await band($)).drawn())
  expect(drawn).toContain('\"high\"')
})

test('effort: a turn end never overwrites a request, so max does not flip to its downgrade', async ($, on) => {
  const world = engine(on)
  await start($)
  await step($, SONNET, 'high')
  await climb($, world.clock, 70)
  world.toasts.length = 0
  await step($, SONNET, 'max')
  await $.classic.Stop({ stop_hook_active: false, effort: { level: 'high' } } as never) // downgraded
  await step($, SONNET, 'max')
  await $.classic.Stop({ stop_hook_active: false, effort: { level: 'high' } } as never)
  expect(world.toasts).toEqual(['5h at 82%: at this pace the window runs out in ~18 min · /limits'])
  expect(JSON.stringify(await (await band($)).drawn())).toContain('\"max\"')
})

test('effort: a turn end on a subagent is not the main thread', async ($, on) => {
  engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await $.classic.Stop({ stop_hook_active: false, agent_id: 'a1', effort: { level: 'low' } } as never)
  expect(JSON.stringify(await (await band($)).drawn())).not.toContain('low')
})

test('effort: turn ends alone (no request carries one) still warn on max', async ($, on) => {
  const world = engine(on)
  await start($)
  await $.classic.Stop({ stop_hook_active: false, effort: { level: 'high' } } as never)
  await climb($, world.clock, 70)
  world.toasts.length = 0
  await $.classic.Stop({ stop_hook_active: false, effort: { level: 'max' } } as never)
  expect(world.toasts).toEqual(['5h at 82%: at this pace the window runs out in ~18 min · /limits'])
})

test('effort: a switch to a model clears it, so haiku shows no stale gauge', async ($, on) => {
  engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await step($, SONNET, 'high')
  await switchTo($, SONNET, 'claude-haiku-4-5')
  const drawn = JSON.stringify(await (await band($)).drawn())
  expect(drawn).toContain('haiku 4.5')
  expect(drawn).not.toContain('high')
  expect(drawn).not.toContain('▰')
})

test('effort: the /config row gives the first reading; a row with no level is skipped', async ($, on) => {
  engine(on)
  on('config.list', () => ({
    value: [
      { key: 'showEffortIndicator', label: 'Show effort', kind: 'boolean', value: true },
      { key: 'effortLevel', label: 'Effort', kind: 'choice', value: 'xhigh' },
    ],
  }) as never)
  await start($)
  await $.session.measure(MEASURE as never)
  expect(JSON.stringify(await (await band($)).drawn())).toContain('xhigh')
})

test('effort: a first request that differs from /config is no switch', async ($, on) => {
  const world = engine(on)
  on('config.list', () => ({ value: [{ key: 'effortLevel', label: 'Effort', kind: 'choice', value: 'high' }] }) as never)
  await start($)
  await $.session.measure(fiveAt(90) as never)
  world.toasts.length = 0
  await step($, SONNET, 'max')
  expect(world.toasts).toEqual([])
  expect(JSON.stringify(await (await band($)).drawn())).toContain('\"max\"')
})

test('/limits pane: effort with no model still has its section', async ($, on) => {
  engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await $.classic.Stop({ stop_hook_active: false, effort: { level: 'medium' } } as never)
  const shown = JSON.stringify(await (await pane($)).drawn())
  expect(shown).toContain('Model')
  expect(shown).toContain('▰▰▱▱▱ ')
})

test('effort max from the turn end warns once, as from a request', async ($, on) => {
  const world = engine(on)
  await start($)
  await step($, SONNET, 'high')
  await climb($, world.clock, 70)
  world.toasts.length = 0
  await $.classic.Stop({ stop_hook_active: false, effort: { level: 'max' } } as never)
  await step($, SONNET, 'max')
  expect(world.toasts).toEqual(['5h at 82%: at this pace the window runs out in ~18 min · /limits'])
})

// ---- cache clock, keep-warm and the context groups (0.5.0)

/** A model switch brings the TTL; the turn after it gives the end of the last request (NOW). */
const warm = async ($: any, ttl = '1h') => {
  await $.classic.PostModelSwitch({ ...SWITCH, cache_ttl: ttl } as never)
  await $.turn.complete(turn(1) as never)
}
const drawnBand = async ($: any, surface = 'terminal') => {
  const b = await band($, surface)
  const drawn = JSON.stringify(await b.drawn())
  await b.unmount()
  return drawn
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`cache clock: warm counts down in the success color on ${surface}`, async ($, on) => {
    const world = engine(on)
    await start($, surface)
    await $.session.measure(MEASURE as never)
    await warm($)
    await world.clock.advance(8 * MIN)
    const drawn = await drawnBand($, surface)
    expect(drawn).toMatch(/"color":"success","bold":true[^}]*\},"children":\["⏱ 52:00"/)
    expect(drawn).not.toContain('"cache "},{"type":"Text","children":["93%"')
    expect(drawn).not.toContain('keep warm')
  })
}

test('cache clock: cooling turns warning and offers keep warm; cold says so with one toast', async ($, on) => {
  const world = engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await warm($)
  await world.clock.advance(52 * MIN)
  const cooling = await drawnBand($)
  expect(cooling).toMatch(/"color":"warning","bold":true[^}]*\},"children":\["⏱ 08:00"/)
  expect(cooling).toContain('keep warm')
  await world.clock.advance(9 * MIN)
  const cold = await drawnBand($)
  expect(cold).toMatch(/"color":"error","bold":true[^}]*\},"children":\["❄ cold"/)
  expect(cold).not.toContain('keep warm')
  await world.clock.advance(5 * MIN)
  expect(world.toasts.filter(t => t.startsWith('Cache cold'))).toEqual(['Cache cold: the next reply re-reads 116k tokens with no cache'])
})

test('cache clock: a 5-minute TTL cools in its last minute', async ($, on) => {
  const world = engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await warm($, '5m')
  await world.clock.advance(3 * MIN)
  expect(await drawnBand($)).toContain('⏱ 02:00')
  expect(await drawnBand($)).not.toContain('keep warm')
  await world.clock.advance(90_000)
  expect(await drawnBand($)).toMatch(/"color":"warning","bold":true[^}]*\},"children":\["⏱ 00:30"/)
})

test('cache clock: with no TTL the band keeps the hit rate, and the pane says why', async ($, on) => {
  engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await $.turn.complete(turn(1) as never)
  const drawn = await drawnBand($)
  expect(drawn).toContain('"cache "')
  expect(drawn).toContain('93%')
  expect(drawn).not.toContain('⏱')
  const p = await pane($)
  const shown = JSON.stringify(await p.drawn())
  expect(shown).toContain('Cache TTL unknown')
  expect(shown).toContain('last turn hit rate: 93%')
  await p.unmount()
})

test('cache clock: a model switch empties the clock until the next request, and keeps the new TTL', async ($, on) => {
  engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await warm($)
  expect(await drawnBand($)).toContain('⏱ 60:00')
  await $.classic.PostModelSwitch({ ...SWITCH, cache_ttl: '5m' } as never)
  expect(await drawnBand($)).not.toContain('⏱')
  await $.turn.complete(turn(2) as never)
  expect(await drawnBand($)).toContain('⏱ 05:00')
})

test('cache clock: the symbol icon style draws one-cell glyphs', { options: { icons: 'symbol' } }, async ($, on) => {
  const world = engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await warm($)
  expect(await drawnBand($)).toContain('◷ 60:00')
  await world.clock.advance(61 * MIN)
  expect(await drawnBand($)).toContain('* cold')
})

test('cache clock: the pane counts, says what it means and offers keep warm', async ($, on) => {
  const world = engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await warm($)
  await world.clock.advance(8 * MIN)
  const p = await pane($)
  let shown = JSON.stringify(await p.drawn())
  expect(shown).toContain('⏱ 52:00')
  expect(shown).toContain('of 1 h (TTL of the last reply)')
  expect(shown).toContain('Reply now and 116k tokens come from cache')
  expect(shown).toContain('keep warm')
  await world.clock.advance(46 * MIN)
  shown = JSON.stringify(await p.drawn())
  expect(shown).toContain('Cooling: reply or keep it warm')
  await world.clock.advance(10 * MIN)
  expect(JSON.stringify(await p.drawn())).toContain('Cache cold: the next reply re-reads 116k tokens with no cache')
  await p.unmount()
})

test('keep warm: asks first, then sends before the cache goes cold, and the turn refreshes the clock', async ($, on) => {
  const world = engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await warm($)
  await world.clock.advance(52 * MIN)
  const b = await band($)
  await b.press({ key: 'keep' })
  expect(world.asked).toHaveLength(1)
  expect(world.asked[0]).toContain('re-reads 116k tokens from cache and spends plan')
  expect(world.toasts.at(-1)).toBe('Keep-warm on. Stops at your next prompt or in 2 h.')
  const kept = JSON.stringify(await b.drawn())
  expect(kept).toContain('↺ 08:00'.replace('↺', '♻'))
  expect(kept).toContain('stop')
  expect(kept).not.toContain('keep warm')
  expect(world.submits).toEqual([])
  await world.clock.advance(3 * MIN + 1000)
  expect(world.submits).toHaveLength(1)
  expect(world.submits[0]).toContain('Keep-warm ping from limits-meter')
  // The ping's turn ends: the clock restarts and the turn stays out of the table.
  await $.turn.complete(turn(2) as never)
  expect(JSON.stringify(await b.drawn())).toContain('♻ 60:00')
  const p = await pane($)
  expect(JSON.stringify(await p.drawn())).not.toContain('#2')
  await p.unmount()
  await b.unmount()
})

test('keep warm: sends again for each lap, and stops by itself after 2 h', async ($, on) => {
  const world = engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await warm($)
  expect((await run($, 'keep-warm on')).text).toBe('Keep-warm on. Stops at your next prompt or in 2 h.')
  await world.clock.advance(56 * MIN)
  expect(world.submits).toHaveLength(1)
  await $.turn.complete(turn(2) as never)
  await world.clock.advance(56 * MIN)
  expect(world.submits).toHaveLength(2)
  await $.turn.complete(turn(3) as never)
  await world.clock.advance(10 * MIN)
  expect(world.toasts.at(-1)).toBe('Keep-warm stopped: 2 h passed.')
  await world.clock.advance(60 * MIN)
  expect(world.submits).toHaveLength(2)
})

test('keep warm: a no, a dismissed question, or no TTL turns nothing on', async ($, on) => {
  const world = engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  expect((await run($, 'keep-warm on')).text).toContain('cache TTL is not known yet')
  expect(world.asked).toHaveLength(0)
  await warm($)
  world.answer = 'no'
  expect((await run($, 'keep-warm on')).text).toBe('Keep-warm off.')
  world.answer = null
  expect((await run($, 'keep-warm on')).text).toBe('Keep-warm off.')
  await world.clock.advance(58 * MIN)
  expect(world.submits).toEqual([])
  expect((await run($, 'keep-warm')).text).toBe('Keep-warm off.')
})

test('keep warm: /limits keep-warm off stops it quietly', async ($, on) => {
  const world = engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await warm($)
  await run($, 'keep-warm on')
  expect((await run($, 'keep-warm')).text).toBe('Keep-warm on. Stops at your next prompt or in 2 h.')
  const before = world.toasts.length
  expect((await run($, 'keep-warm off')).text).toBe('Keep-warm off.')
  expect(world.toasts).toHaveLength(before)
  await world.clock.advance(58 * MIN)
  expect(world.submits).toEqual([])
})

test("keep warm: the person's own prompt stops it, with a toast", async ($, on) => {
  const world = engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  await warm($)
  await run($, 'keep-warm on')
  await $.prompt.submit({ text: 'and now the tests' } as never)
  expect(world.toasts.at(-1)).toBe('Keep-warm stopped: your prompt already refreshes the cache.')
  await world.clock.advance(58 * MIN)
  expect(world.submits).toEqual(['and now the tests'])
})

test('keep warm: the transcript draws the ping as one dim row, and leaves other messages alone', async ($, on) => {
  engine(on)
  await start($)
  const row = async (origin: unknown, text: string) => {
    const m = await $.ui.mount({ plugin: 'limits-meter', surface: 'terminal', component: 'UserMessage', props: { text, origin, isExpanded: false }, viewport: { columns: 80, rows: 40 } } as never)
    const drawn = JSON.stringify(await m.drawn())
    await m.unmount()
    return drawn
  }
  const ping = await row({ kind: 'plugin', name: 'limits-meter' }, 'Keep-warm ping from limits-meter. Reply with a single "." and nothing else.')
  expect(ping).toContain('"dimColor":true')
  expect(ping).toContain('♻ keep-warm (message from limits-meter)')
  expect(ping).not.toContain('Reply with')
  expect(await row({ kind: 'composer' }, 'hello')).not.toContain('keep-warm')
})

test('keep warm: Portuguese from LANG', async ($, on) => {
  const world = engine(on, { LANG: 'pt_BR.UTF-8' })
  await start($)
  await $.session.measure(MEASURE as never)
  await warm($)
  world.answer = 'sim, manter'
  expect((await run($, 'keep-warm on')).text).toBe('Manter quente ligado. Para no seu próximo prompt ou em 2 h.')
  expect(world.asked[0]).toContain('Manter o cache quente?')
  await $.prompt.submit({ text: 'e agora os testes' } as never)
  expect(world.toasts.at(-1)).toBe('Manter quente parou: o seu prompt já renova o cache.')
})

test('context groups: the band bar is split and a legend names each color', async ($, on) => {
  engine(on, {}, undefined, true)
  await start($)
  await $.session.measure(MEASURE as never)
  const drawn = await drawnBand($)
  // 58% of the window: 23k system, 14k MCP, 79k messages share it by tokens (12, 7, 39), 42% is free.
  expect(drawn).toContain('"color":"suggestion"')
  expect(drawn).toContain('"color":"claude"')
  expect(drawn).toMatch(/"ctx  "[\s\S]*█ system 12%[\s\S]*█ MCP 7%[\s\S]*█ messages 39%[\s\S]*░ free 42%/)
  expect(drawn).toContain('░░░░░')
})

test('context groups: at 87% the messages take the warning color, and below 90 columns the legend still names them', async ($, on) => {
  engine(on, {}, undefined, true)
  await start($)
  await $.session.measure({ ...FULL, context: { tokens: 174_000, window: 200_000, percent: 87 } } as never)
  const b = await $.ui.mount({ plugin: 'limits-meter', surface: 'terminal', component: 'AbovePrompt', props: { bodyColumns: 80, hasSurvey: false }, viewport: { columns: 80, rows: 40 } } as never)
  const drawn = JSON.stringify(await b.drawn())
  expect(drawn).toContain('"color":"warning"},"children":["█ messages')
  expect(drawn).toContain('░ free 13%')
  await b.unmount()
})

test('context groups: no breakdown from the engine keeps the single bar and no legend', async ($, on) => {
  engine(on)
  await start($)
  await $.session.measure(MEASURE as never)
  const drawn = await drawnBand($)
  expect(drawn).not.toContain('"color":"suggestion"')
  expect(drawn).not.toContain('█ system')
})

test('context groups: a session with no MCP tools leaves MCP out of the legend', async ($, on) => {
  engine(on, {}, undefined, { ...BREAKDOWN, categories: BREAKDOWN.categories.filter(c => c.name !== 'MCP tools'), mcpTools: [] })
  await start($)
  await $.session.measure(MEASURE as never)
  const drawn = await drawnBand($)
  expect(drawn).toContain('█ system')
  expect(drawn).not.toContain('█ MCP')
})

test('context groups: the compact format keeps its numbers only', { options: { format: 'compact' } }, async ($, on) => {
  engine(on, {}, undefined, true)
  await start($)
  await $.session.measure(MEASURE as never)
  const drawn = await drawnBand($)
  expect(drawn).not.toContain('█')
  expect(drawn).not.toContain('system')
})

test('context groups: the pane lists every category, each MCP server and the free space', async ($, on) => {
  engine(on, {}, undefined, true)
  await start($)
  await $.session.measure(MEASURE as never)
  const p = await pane($)
  const shown = JSON.stringify(await p.drawn())
  for (const name of ['System prompt', 'System tools', 'Memory files', 'Skills', 'MCP · github', 'MCP · notion', 'Messages']) expect(shown).toContain(name)
  expect(shown).not.toContain('MCP tools')
  expect(shown).toContain('79k')
  expect(shown).toContain('40%')
  expect(shown).toContain('free')
  expect(shown).toContain('≈ local engine estimate, the same figures as /context')
  await p.unmount()
})
