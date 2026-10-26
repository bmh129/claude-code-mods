import { expect, mock, test } from 'claude-code/testing'

/** The text of a drawn tree, every node's children joined: a phrase split across a figure and its label reads whole. */
const flat = (n: unknown): string =>
  typeof n === 'string' ? n : Array.isArray(n) ? n.map(flat).join('') : n && typeof n === 'object' ? flat((n as { children?: unknown }).children) : ''

const NOW = Date.parse('2026-10-08T12:00:00Z')
const MIN = 60_000

// A5 (prototype buttons-quiet-a5-a7, variant B): the Buttons of a tree, with the props the variant lives in.
const buttonsOf = (tree: unknown) =>
  [...JSON.stringify(tree).matchAll(/"type":"Button","props":(\{[^{}]*\})/g)].map(m => JSON.parse(m[1]!) as { key: string; variant?: string; plain?: boolean })
const variantOf = (tree: unknown, key: string) => buttonsOf(tree).find(b => b.key === key)?.variant
const PROPS = { title: 'Agents', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} }
const RUN = { command: 'watch', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 160 } }
const SPAWN = { tool_use_id: 'tu1', prompt: 'go', description: 'Map the API routes', subagentType: 'Explore', provider: { plugin: 'engine', tier: 'core' }, parentModel: 'claude-opus-5-5', background: true, fork: false }
const USAGE = { input_tokens: 2000, output_tokens: 1500, cache_read_input_tokens: 40_000, cache_creation_input_tokens: 500, model: 'claude-haiku-4-5' }

const step = async ($: any, agentId?: string) => {
  const stream = $.turn.step({ turnId: 't1', index: 0, model: 'claude-haiku-4-5', messageCount: 3, ...(agentId ? { agentId } : {}) })
  for await (const _ of stream) {
    // drain
  }
  return stream.result
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`tokens, stall toast and run summary on ${surface}`, async ($, on) => {
    const clock = mock.clock(on, { now: NOW })
    let status = 'running'
    const toasts: string[] = []
    const statuses: (string | undefined)[] = []
    on('ui.open', () => ({ value: { isPlaced: true } }) as never)
    on('ui.toast', (_$, e: any) => (toasts.push(e.text), { value: undefined }) as never)
    on('ui.status', (_$, e: any) => (statuses.push(e.text), { value: undefined }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    on('session.start', () => ({ cwd: '/repo' }) as never)
    on('agent.list', () => ({ value: [{ id: 'a1', description: 'Map the API routes', type: 'Explore', status }] }) as never)
    on('agent.spawn', () => ({ model: 'claude-haiku-4-5', agentId: 'a1' }) as never)
    on('turn.step', async function* () {
      return { turnId: 't1', index: 0, answer: '', toolUses: [], stopReason: 'end_turn', usage: USAGE }
    } as never)
    on('tool.call', () => ({ result: 'ok', text: 'ok' }) as never)
    on('turn.complete', () => ({ text: 'done' }) as never)

    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    await step($) // the lead's request
    await $.agent.spawn(SPAWN as never)
    await step($, 'a1')
    await $.tool.call({ tool: 'Read', file_path: '/repo/src/routes.ts', agentId: 'a1', tool_use_id: 'tu2' } as never)
    await $.command.run(RUN as never)

    const pane = await $.ui.mount({ plugin: 'agent-watch', surface, component: 'Pane', requestId: 'agent-watch', props: PROPS, viewport: { columns: 102, rows: 40 } } as never)
    let drawn = JSON.stringify(await pane.drawn())
    expect(drawn).toContain('Map the API routes')
    expect(drawn).toContain('haiku 4.5')
    expect(drawn).toContain('44k') // 2000 + 1500 + 40000 + 500
    expect(flat(JSON.parse(drawn))).toContain('1 tool')
    expect(drawn).toContain('lead')
    expect(statuses.at(-1)).toBe('◇ 1 agent · 44k')

    // Six quiet minutes: one stall toast, flagged in the pane and the status line.
    await clock.advance(6 * MIN)
    expect(toasts.filter(t => t.includes('looks stalled')).length).toBe(1)
    expect(toasts.find(t => t.includes('looks stalled'))).toContain('quiet for 5m')
    expect(statuses.at(-1)).toContain('⚠ 1 stalled')
    drawn = JSON.stringify(await pane.drawn())
    expect(drawn).toContain('stalled')
    await clock.advance(MIN)
    expect(toasts.filter(t => t.includes('looks stalled')).length).toBe(1)

    // The agent ends: summary toast, status line cleared, last run in the pane.
    status = 'completed'
    await $.turn.complete({ answer: 'done', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'a1' } as never)
    await clock.advance(5000)
    const done = toasts.find(t => t.startsWith('Agents done'))
    expect(done).toContain('1 agent, 44k tokens')
    expect(done).toContain('Heaviest: Map the API routes 44k (100%)')
    expect(statuses.at(-1)).toBe(undefined)
    drawn = JSON.stringify(await pane.drawn())
    expect(drawn).toContain('Last run')
    // Finished agents fold into one line, which opens them.
    expect(drawn).toContain('1 finished ▸')
    expect(drawn).not.toContain('open:a1')
    await pane.press({ key: 'done' })
    drawn = JSON.stringify(await pane.drawn())
    expect(drawn).toContain('1 finished ▾')
    expect(drawn).toContain('open:a1')
    expect(drawn).toContain(' ✓ ')
    await pane.press({ key: 'clear-done' })
    drawn = JSON.stringify(await pane.drawn())
    expect(drawn).toContain('No subagents yet')
    await pane.unmount()
  })
}

test('demo seeds a stalled agent; clear done and clear demo drop one kind each', async ($, on) => {
  mock.clock(on, { now: NOW })
  const toasts: string[] = []
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', (_$, e: any) => (toasts.push(e.text), { value: undefined }) as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('agent.list', () => ({ value: [] }) as never)
  await $.command.run({ ...RUN, args: 'demo' } as never)
  expect(toasts.some(t => t.startsWith('Fix the flaky test looks stalled: running npm test for'))).toBe(true)
  const pane = await $.ui.mount({ plugin: 'agent-watch', surface: 'terminal', component: 'Pane', requestId: 'agent-watch', props: PROPS, viewport: { columns: 102, rows: 40 } } as never)
  let drawn = JSON.stringify(await pane.drawn())
  expect(drawn).toContain('Fix the flaky test')
  expect(drawn).toContain('demo')
  expect(drawn).not.toContain('open:demo-3')
  await pane.press({ key: 'done' })
  expect(JSON.stringify(await pane.drawn())).toContain('open:demo-3')

  expect((await $.command.run({ ...RUN, args: 'clear done' } as never)).text).toBe('Finished agents cleared.')
  drawn = JSON.stringify(await pane.drawn())
  expect(drawn).not.toContain('Check sources')
  expect(drawn).toContain('open:demo-2')
  await pane.press({ key: 'clear-demo' })
  expect(JSON.stringify(await pane.drawn())).toContain('No subagents yet')
  await pane.unmount()
})

test('the pane footer: clear waits in the prompt, help writes to the transcript, Close closes', async ($, on) => {
  mock.clock(on, { now: NOW })
  const fills: string[] = []
  const logs: string[] = []
  const closed: string[] = []
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('ui.log', (_$, e: any) => (logs.push(e.text), { value: undefined }) as never)
  on('ui.close', (_$, e: any) => (closed.push(e.id), { value: undefined }) as never)
  on('prompt.fill', (_$, e: any) => (fills.push(e.text), { isFilled: true, text: e.text, cursor: e.text.length }) as never)
  on('agent.list', () => ({ value: [] }) as never)
  const pane = await $.ui.mount({ plugin: 'agent-watch', surface: 'terminal', component: 'Pane', requestId: 'agent-watch', props: PROPS, viewport: { columns: 102, rows: 40 } } as never)
  expect(JSON.stringify(await pane.drawn())).toContain('/watch demo shows what this looks like')
  await pane.press({ key: 'verb:clear' })
  expect(fills).toEqual(['/watch clear'])
  await pane.press({ key: 'verb:help' })
  expect(logs).toHaveLength(8)
  expect(logs[1]).toContain('/watch demo')
  await pane.press({ key: 'close' })
  expect(closed).toEqual(['agent-watch'])
  await pane.unmount()
  expect((await $.command.run({ ...RUN, args: 'nope' } as never)).text).toContain('/watch clear done')
})

test('Portuguese from LANG, and ! for the warning in a JetBrains terminal', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const toasts: string[] = []
  const statuses: (string | undefined)[] = []
  const env: Record<string, string> = { LANG: 'pt_BR.UTF-8', TERMINAL_EMULATOR: 'JetBrains-JediTerm' }
  on('env.get', (_$, e: any) => ({ value: env[e.name] }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', (_$, e: any) => (toasts.push(e.text), { value: undefined }) as never)
  on('ui.status', (_$, e: any) => (statuses.push(e.text), { value: undefined }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', () => ({ cwd: '/repo' }) as never)
  on('agent.list', () => ({ value: [] }) as never)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ ...RUN, args: 'demo' } as never)
  expect(toasts.some(t => t.startsWith('Corrigir o teste instável parece travado: rodando npm test há'))).toBe(true)
  expect(statuses.at(-1)).toBe('◇ 2 agentes · 365k · ! 1 travado')
  const pane = await $.ui.mount({ plugin: 'agent-watch', surface: 'terminal', component: 'Pane', requestId: 'agent-watch', props: PROPS, viewport: { columns: 102, rows: 40 } } as never)
  const drawn = JSON.stringify(await pane.drawn())
  expect(flat(JSON.parse(drawn))).toContain('2 rodando · 1 concluído')
  expect(drawn).toContain('1 concluído ▸')
  expect(flat(JSON.parse(drawn))).toContain('9 ferramentas (2 com erro)')
  expect(drawn).toContain('limpar demo')
  expect(drawn).toContain('Fechar')
  await clock.advance(5000)
  await pane.unmount()
})

test('share bar, an opened row with its tool calls, and investigate on a stalled agent', async ($, on) => {
  mock.clock(on, { now: NOW })
  const fills: string[] = []
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('prompt.fill', (_$, e: any) => (fills.push(e.text), { isFilled: true, text: e.text, cursor: e.text.length }) as never)
  on('agent.list', () => ({ value: [] }) as never)
  await $.command.run({ ...RUN, args: 'demo' } as never)
  const pane = await $.ui.mount({ plugin: 'agent-watch', surface: 'terminal', component: 'Pane', requestId: 'agent-watch', props: PROPS, viewport: { columns: 102, rows: 40 } } as never)
  let drawn = JSON.stringify(await pane.drawn())
  expect(drawn).toContain('Fix the flaky test 56%')
  expect(drawn).toContain('Map the API routes 32%')
  expect(variantOf(JSON.parse(drawn), 'investigate:demo-2')).toBe('primary')
  expect(buttonsOf(JSON.parse(drawn)).filter(b => b.variant === 'primary')).toHaveLength(1)
  expect(variantOf(JSON.parse(drawn), 'sort')).toBe('secondary')
  expect(variantOf(JSON.parse(drawn), 'close')).toBe('secondary')
  for (const b of buttonsOf(JSON.parse(drawn)).filter(b => b.variant)) expect(b.plain).toBeUndefined()

  await pane.press({ key: 'open:demo-2' })
  drawn = JSON.stringify(await pane.drawn())
  expect(drawn).toContain('recent tools')
  expect(drawn).toContain('no tool calls yet')
  expect(drawn).toContain('Fix the flaky test ▾')

  await pane.press({ key: 'investigate:demo-2' })
  expect(fills).toEqual(['The agent "Fix the flaky test" looks stalled: running npm test, for 6m 00s. Check what happened and tell me what to do.'])
  expect(drawn).not.toContain('investigate:demo-1')
  await pane.unmount()
})

test('a long agent list scrolls', async ($, on) => {
  mock.clock(on, { now: NOW })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', () => ({ value: undefined }) as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('agent.list', () => ({ value: Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, description: `Task ${i}`, type: 'Explore', status: 'running' })) }) as never)
  await $.command.run(RUN as never)
  const pane = await $.ui.mount({ plugin: 'agent-watch', surface: 'terminal', component: 'Pane', requestId: 'agent-watch', props: { ...PROPS, scroll: { offset: 0, bodyRows: 30 } }, viewport: { columns: 102, rows: 30 } } as never)
  // 30 rows: 16 for the rest of the pane, then two rows an agent: 7 agents.
  expect(JSON.stringify(await pane.drawn())).toContain('1–7 of 8')
  await ($ as any).ui.scroll({ component: 'Pane', requestId: 'agent-watch', by: 5 })
  const drawn = JSON.stringify(await pane.drawn())
  expect(drawn).toContain('2–8 of 8')
  expect(drawn).not.toContain('open:a0')
  await pane.unmount()
})

test('the summary says how much of the 5h window the wave used', async ($, on) => {
  const clock = mock.clock(on, { now: NOW })
  const toasts: string[] = []
  let status = 'running'
  let fiveHour = 40
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', (_$, e: any) => (toasts.push(e.text), { value: undefined }) as never)
  on('ui.status', () => ({ value: undefined }) as never)
  on('session.usage', () => ({ value: { context: { window: 200_000 }, rateLimits: [{ kind: 'five_hour', percentUsed: fiveHour }] } }) as never)
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'Map the API routes', type: 'Explore', status }] }) as never)
  on('agent.spawn', () => ({ model: 'claude-haiku-4-5', agentId: 'a1' }) as never)
  on('turn.complete', () => ({ text: 'done' }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', () => ({ cwd: '/repo' }) as never)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await $.agent.spawn(SPAWN as never)
  await clock.advance(5000)
  fiveHour = 46
  status = 'completed'
  await $.turn.complete({ answer: 'done', durationMs: 1000, isAborted: false, turnId: 't1', reason: 'answer', agentId: 'a1' } as never)
  await clock.advance(5000)
  expect(toasts.find(t => t.startsWith('Agents done'))).toContain('. Used ~6% of the 5h window. /watch')
})

// /watch on, off, hide and show

const switchWorld = (on: any) => {
  const w = { toasts: [] as string[], statuses: [] as (string | undefined)[], sets: [] as { key: string; value: unknown }[], deny: '' }
  mock.clock(on, { now: NOW })
  mock.store(on)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', (_$: any, e: any) => (w.toasts.push(e.text), { value: undefined }) as never)
  on('ui.status', (_$: any, e: any) => (w.statuses.push(e.text), { value: undefined }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('session.start', () => ({ cwd: '/repo' }) as never)
  on('agent.list', () => ({ value: [] }) as never)
  on('config.set', (_$: any, e: any) => {
    if (w.deny) return { deny: w.deny } as never
    w.sets.push({ key: e.key, value: e.value })
    return { value: e.value } as never
  })
  return w
}

test('hide: on but silent, so the demo stall raises no toast, and show brings the toast back', async ($, on) => {
  const w = switchWorld(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  expect((await $.command.run({ ...RUN, args: 'hide' } as never)).text).toBe('watch hidden but on · /watch show brings it back')
  await $.command.run({ ...RUN, args: 'demo' } as never)
  expect(w.toasts).toEqual([])
  expect((await $.command.run({ ...RUN, args: 'show' } as never)).text).toBe('watch shown · /watch hide hides it')
  await $.command.run({ ...RUN, args: 'clear demo' } as never)
  await $.command.run({ ...RUN, args: 'demo' } as never)
  expect(w.toasts.some(t => t.includes('looks stalled'))).toBe(true)
})

test('hide is kept for the next session', async ($, on) => {
  const w = switchWorld(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ ...RUN, args: 'hide' } as never)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ ...RUN, args: 'demo' } as never)
  expect(w.toasts).toEqual([])
})

test('on and off write the enabled option; on says it is already on', async ($, on) => {
  const w = switchWorld(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  expect((await $.command.run({ ...RUN, args: 'on' } as never)).text).toBe('watch is already on.')
  expect((await $.command.run({ ...RUN, args: 'off' } as never)).text).toBe('watch off in every conversation · /watch on turns it on')
  expect(w.sets).toEqual([{ key: 'agent-watch.enabled', value: false }])
})

test('off: only the command answers, and on writes the option back', { options: { enabled: false, language: 'pt-BR' } }, async ($, on) => {
  const w = switchWorld(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  expect((await $.command.run({ ...RUN, args: 'off' } as never)).text).toBe('watch já está desligado.')
  expect((await $.command.run({ ...RUN, args: 'on' } as never)).text).toBe('watch ligado · /watch off desliga')
  expect(w.sets).toEqual([{ key: 'agent-watch.enabled', value: true }])
})

test('a refused option says why', async ($, on) => {
  const w = switchWorld(on)
  w.deny = 'managed by policy'
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  expect((await $.command.run({ ...RUN, args: 'off' } as never)).text).toBe('Could not change the option: managed by policy')
})

// The quiet option, set in every mod by /pad quiet: silent like hide, and `show` does not undo it.
test('quiet: no toast from the demo stall, and show does not undo it', { options: { quiet: true } }, async ($, on) => {
  const w = switchWorld(on)
  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
  await $.command.run({ ...RUN, args: 'demo' } as never)
  expect(w.toasts).toEqual([])
  expect((await $.command.run({ ...RUN, args: 'show' } as never)).text).toBe('watch shown · /watch hide hides it')
  await $.command.run({ ...RUN, args: 'clear demo' } as never)
  await $.command.run({ ...RUN, args: 'demo' } as never)
  expect(w.toasts).toEqual([])
})
