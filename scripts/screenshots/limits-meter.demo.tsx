import { test } from 'claude-code/testing'
// Frames of the README's opening GIF: `FRAME demo|<caption>|{"tree": <tree>, "prompt": <text>}`.
// The band through one request, the /limits pane, and the toast on a switch to opus near the limit.
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
