import { mock, test } from 'claude-code/testing'
// Frames of the README's GIFs: `FRAME <name>|<caption>|{"tree": <tree>, "prompt": <text>}`.
// demo: the band through one request, the /limits pane, and the toast on a switch to opus near the limit.
// cache: the cache countdown, keep-warm, and the context bar by group.
const NOW = Date.parse('2026-10-08T12:00:00Z')
const FIVE = '2026-10-08T13:12:00Z'
const WEEK = '2026-10-11T16:00:00Z'
const INSTALL = '/plugin install limits-meter --marketplace ice-lfernandes/claude-code-mods'

const drain = async (stream: any) => {
  for await (const _ of stream) {
    // drain
  }
}

test('demo', async ($, on) => {
  let now = NOW
  let model = 'claude-sonnet-5-5'
  const toasts: string[] = []
  on('clock.now', () => ({ value: now }) as never)
  on('session.model', () => ({ value: model }) as never)
  on('turn.step', async function* () {
    return { turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' }
  } as never)
  on('classic.PostModelSwitch', () => ({}) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', (_$, e: any) => (toasts.push(e.text), { value: undefined }) as never)
  on('session.measure', () => ({ changed: [] }) as never)
  on('turn.complete', () => ({ text: 'done' }) as never)
  on('ui.render', ($, e) => $.ui.resolve(e).Box({ key: 'engine' }) as never)

  const step = (effort = 'high') => drain($.turn.step({ turnId: 't1', index: 0, model, effort, messageCount: 3 } as never))
  const measure = (context: number, five: number) =>
    $.session.measure({ context: { tokens: context * 2000, window: 200_000, percent: context }, rateLimits: [{ kind: 'five_hour', percentUsed: five, resetsAt: FIVE }, { kind: 'seven_day', percentUsed: 31, resetsAt: WEEK }], changed: ['context'] } as never)
  const turn = (i: number, o: number, r: number, w: number, d: number) =>
    $.turn.complete({ answer: 'x', durationMs: d, isAborted: false, turnId: 't', reason: 'answer', usage: { input_tokens: i, output_tokens: o, cache_read_input_tokens: r, cache_creation_input_tokens: w, model } } as never)
  const band = async () => {
    const ui = await $.ui.mount({ plugin: 'limits-meter', surface: 'terminal', component: 'AbovePrompt', props: { bodyColumns: 112, hasSurvey: false }, viewport: { columns: 112, rows: 40 } } as never)
    const drawn = await ui.drawn()
    await ui.unmount()
    return drawn
  }
  const pane = async () => {
    const ui = await $.ui.mount({ plugin: 'limits-meter', surface: 'terminal', component: 'Pane', requestId: 'limits', props: { title: 'Limits & context', isFocused: true, bodyColumns: 96, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} }, viewport: { columns: 98, rows: 40 } } as never)
    const drawn: any = await ui.drawn()
    await ui.unmount()
    // The GIF keeps the pane's plan windows, context, turns and commands; the full pane is in limits-meter.svg.
    const kept = { ...drawn, children: drawn.children.filter((_: unknown, i: number) => [1, 2, 5, 6].includes(i)) }
    return { type: 'Box', props: { borderStyle: 'round', paddingX: 1, flexDirection: 'column' }, children: [{ type: 'Text', props: { bold: true }, children: ['Limits & context'] }, kept] }
  }
  const toast = (text: string) => ({ type: 'Box', props: { borderStyle: 'round', borderColor: 'cyan', paddingX: 1 }, children: [{ type: 'Text', props: {}, children: [text] }] })
  // Lines of the transcript above the band: what was asked, dim, and the answer.
  const said = (ask: string, ...answer: string[]) => ({ type: 'Box', props: { flexDirection: 'column' }, children: [{ type: 'Text', props: { dimColor: true }, children: [`> ${ask}`] }, ...answer.map((a, i) => ({ type: 'Text', props: {}, children: [`${i ? ' ' : '●'} ${a}`] }))] })
  const before = said('fix the flaky date test in OrderServiceTest', 'Fixed: the test now pins the clock. 14 of 14 passing.')
  const repo = said('explain this repo in 3 lines', 'A marketplace of six Claude Code plugins ("mods") for everyday UX.', 'Each mod is a set of TypeScript hooks: bands, panes, status line entries and toasts.', 'Every mod ships its own tests and speaks English and pt-BR.')
  const column = (...children: unknown[]) => ({ type: 'Box', props: { flexDirection: 'column', gap: 1 }, children })
  const frame = (caption: string, tree: unknown, prompt = '') => console.log(`FRAME demo|${caption}|${JSON.stringify({ tree, prompt })}`)

  // Earlier turns this session, a minute apart: the pace the toast counts from.
  for (const [i, o, r, w, d] of [[1000, 1300, 40_000, 2000, 12_000], [800, 2600, 52_000, 900, 31_000], [1200, 900, 61_000, 300, 8_000]]) {
    now += 60_000
    await turn(i, o, r, w, d)
  }
  await step()
  await measure(41, 68)
  frame('Plan limits and context, above the prompt', column(before, await band()))
  frame('Ask as usual', column(before, await band()), 'explain this repo in 3 lines')
  now += 60_000
  await turn(3000, 4100, 18_000, 22_000, 24_000)
  await measure(48, 71)
  frame('Each response updates the band', column(before, repo, await band()))
  frame('/limits opens the pane', column(await band(), await pane()), '/limits')
  model = 'claude-opus-5-5'
  await $.classic.PostModelSwitch({ from_model: 'claude-sonnet-5-5', to_model: model, requested_model: 'opus', source: 'command', context_tokens: 96_000, cache_warm: true } as never)
  await step()
  frame('A costly switch near the limit raises a toast', column(before, repo, await band(), ...toasts.slice(-1).map(toast)), '/model opus')
  frame('Install', column(before, repo, await band()), INSTALL)
})

// The window by the engine's categories at 116k of 200k: system 23k, MCP 14k, messages 79k.
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
const MIN = 60_000

// The symbol icon style: one-cell glyphs the painter's font has, where the emoji style draws a box.
test('cache', { options: { icons: 'symbol' } }, async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  mock.store(on)
  const toasts: string[] = []
  let answer = 'yes, keep warm'
  on('env.get', () => ({ value: undefined }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', (_$, e: any) => ({ cwd: e.cwd }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.close', () => ({ value: undefined }) as never)
  on('ui.toast', (_$, e: any) => (toasts.push(e.text), { value: undefined }) as never)
  on('ui.log', () => ({ value: undefined }) as never)
  on('session.measure', () => ({ changed: ['context', 'rateLimits'] }) as never)
  on('session.usage', () => ({ value: { context: { tokens: 116_000, window: 200_000, percent: 58, breakdown: BREAKDOWN }, rateLimits: [] } }) as never)
  on('prompt.submit', (_$, e: any) => ({ text: e.text }) as never)
  on('tool.call', (_$, e: any) => {
    const question = String(e.questions[0].question)
    return { result: { questions: e.questions, answers: { [question]: answer } } } as never
  })
  on('turn.complete', () => ({ text: 'done' }) as never)
  on('turn.step', async function* () {
    return { turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn' }
  } as never)
  on('classic.PostModelSwitch', () => ({}) as never)
  on('classic.Stop', () => ({}) as never)
  on('classic.PostToolUse', () => ({}) as never)
  on('ui.render', ($, e) => $.ui.resolve(e).Box({ key: 'engine' }) as never)

  const mountBand = () => $.ui.mount({ plugin: 'limits-meter', surface: 'terminal', component: 'AbovePrompt', props: { bodyColumns: 112, hasSurvey: false }, viewport: { columns: 112, rows: 40 } } as never)
  const band = async () => {
    const ui = await mountBand()
    const drawn = await ui.drawn()
    await ui.unmount()
    return drawn
  }
  const pane = async () => {
    const ui = await $.ui.mount({ plugin: 'limits-meter', surface: 'terminal', component: 'Pane', requestId: 'limits', props: { title: 'Limits & context', isFocused: true, bodyColumns: 96, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} }, viewport: { columns: 98, rows: 40 } } as never)
    const drawn: any = await ui.drawn()
    await ui.unmount()
    return { type: 'Box', props: { borderStyle: 'round', paddingX: 1, flexDirection: 'column' }, children: [{ type: 'Text', props: { bold: true }, children: ['Limits & context'] }, drawn] }
  }
  const toast = (text: string) => ({ type: 'Box', props: { borderStyle: 'round', borderColor: 'cyan', paddingX: 1 }, children: [{ type: 'Text', props: {}, children: [text] }] })
  const said = (ask: string, ...answer: string[]) => ({ type: 'Box', props: { flexDirection: 'column' }, children: [{ type: 'Text', props: { dimColor: true }, children: [`> ${ask}`] }, ...answer.map((a, i) => ({ type: 'Text', props: {}, children: [`${i ? ' ' : '●'} ${a}`] }))] })
  const before = said('fix the flaky date test in OrderServiceTest', 'Fixed: the test now pins the clock. 14 of 14 passing.')
  const column = (...children: unknown[]) => ({ type: 'Box', props: { flexDirection: 'column', gap: 1 }, children })
  const frame = (caption: string, tree: unknown, prompt = '') => console.log(`FRAME cache|${caption}|${JSON.stringify({ tree, prompt })}`)

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await $.session.measure({ context: { tokens: 116_000, window: 200_000, percent: 58 }, rateLimits: [{ kind: 'five_hour', percentUsed: 64, resetsAt: '2026-10-08T13:12:00Z' }, { kind: 'seven_day', percentUsed: 31, resetsAt: '2026-10-11T16:00:00Z' }], changed: ['context', 'rateLimits'] } as never)
  await $.classic.PostModelSwitch({ from_model: 'claude-sonnet-5-5', to_model: 'claude-opus-5-5', requested_model: 'opus', source: 'command', context_tokens: 0, prompt_cache_warm: false, cache_ttl: '1h', estimated_cache_write_usd: 0, pricing: 'catalog' } as never)
  await $.turn.complete({ answer: 'x', durationMs: 12_000, isAborted: false, turnId: 't1', reason: 'answer', usage: { input_tokens: 1000, output_tokens: 1300, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 2000, model: 'claude-opus-5-5' } } as never)

  await clock.advance(8 * MIN)
  frame('The reply starts a countdown, and the context bar is split by group', column(before, await band()))
  frame('/limits explains the clock and what a reply would read from cache', column(await band(), await pane()), '/limits')
  await clock.advance(44 * MIN)
  frame('Cooling: the band offers keep warm', column(before, await band()))
  const ui = await mountBand()
  await ui.press({ key: 'keep' })
  const kept = await ui.drawn()
  await ui.unmount()
  frame('Keep warm asks first, then pings before the cache goes cold', column(before, kept, ...toasts.slice(-1).map(toast)))
  await clock.advance(3 * MIN + 1000)
  frame('Each ping restarts the clock; your next prompt stops it', column(before, await band()))
})
