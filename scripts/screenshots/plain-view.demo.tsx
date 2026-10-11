import { test } from 'claude-code/testing'
// Frames of the card across a turn, one scenario per test: `FRAME <scenario>|<caption>|<tree>`.
const NOW = Date.parse('2026-10-09T12:00:00Z')
const TASKS = ['Pick the page style and layout', 'Check how the page gets live weather', 'Build the weather dashboard', 'Publish it and share the link']
const CHECKLIST = (marks: string) => marks.split('').map((m, i) => `${i + 1}. [${m}] ${['Read the API docs', 'Define the data source', 'Write the HTML', 'Validate and publish'][i]}`).join('\n')

const scenario = (name: string, run: (s: any) => Promise<void>) =>
  test(name, { options: { enabled: true, language: 'en', icons: 'symbol' } }, async ($, on) => {
    let now = NOW
    let id = 0
    let answer = ''
    on('clock.now', () => ({ value: now }) as never)
    on('config.list', () => ({ value: [{ key: 'theme', value: 'dark' }] }) as never)
    on('command.register', () => ({ value: undefined }) as never)
    on('session.start', () => ({ cwd: '/repo' }) as never)
    on('turn.start', ($: any, e: any) => ({ turnId: e.turnId }) as never)
    on('turn.complete', () => ({ text: 'done' }) as never)
    on('turn.step', async function* ($: any, e: any) { return { turnId: e.turnId, index: e.index, answer, toolUses: [], stopReason: 'end_turn' } } as never)
    on('tool.call', ($: any, e: any) => (e.tool === 'TaskCreate' ? { result: { task: { id: String(++id) } }, text: 'ok' } : { result: 'ok', text: 'ok' }) as never)
    on('ui.render', ($, e) => $.ui.resolve(e).Box({ key: 'engine' }) as never)
    on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }) as never)
    on('agent.list', () => ({ value: [{ id: 'a1', description: 'code-review', type: 'general-purpose', status: 'running' }] }) as never)
    on('command.list', () => ({ value: [] }) as never)
    const s = {
      $,
      at: (ms: number) => { now += ms },
      say: (text: string) => { answer = text },
      call: (tool: string, input: object = {}) => $.tool.call({ tool, ...input } as never),
      frame: async (caption: string) => {
        const ui = await $.ui.mount({ plugin: 'plain-view', surface: 'terminal', component: 'AbovePrompt', props: { bodyColumns: 100, hasSurvey: false, isWorking: true, maxRows: 20 }, viewport: { columns: 100, rows: 40 } } as never)
        console.log(`FRAME ${name}|${caption}|${JSON.stringify(await ui.drawn())}`)
        await ui.unmount()
      },
      press: async (key: string) => {
        const ui = await $.ui.mount({ plugin: 'plain-view', surface: 'terminal', component: 'AbovePrompt', props: { bodyColumns: 100, hasSurvey: false, isWorking: true, maxRows: 20 }, viewport: { columns: 100, rows: 40 } } as never)
        await ui.press({ key })
        await ui.unmount()
      },
      ask: (text: string) => $.turn.start({ text, turnId: 't1' } as never),
      end: (reason: string, ms: number) => $.turn.complete({ answer: 'ok', durationMs: ms, isAborted: reason === 'aborted', turnId: 't1', reason } as never),
      step: async () => { for await (const _ of $.turn.step({ turnId: 't1', index: 0, model: 'claude-opus-5-5', messageCount: 3 } as never)) { /* drain */ } },
    }
    await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true } as never)
    await run(s)
  })

scenario('tasks', async s => {
  await s.ask('Build a weather dashboard for New York City.')
  await s.frame('You send the request: the card starts at once')
  for (const subject of TASKS) await s.call('TaskCreate', { subject, description: subject })
  await s.call('TaskUpdate', { taskId: '1', status: 'in_progress' })
  s.at(4_000)
  await s.frame('The agent keeps a task list: one bar per task')
  for (const f of ['index.html', 'style.css', 'layout.md']) await s.call('Read', { file_path: `/repo/${f}` })
  s.at(9_000)
  await s.frame('Reads and searches run silently; the bar estimates the step')
  await s.call('TaskUpdate', { taskId: '1', status: 'completed' })
  await s.call('TaskUpdate', { taskId: '2', status: 'in_progress' })
  await s.call('WebFetch', { url: 'https://api.open-meteo.com/v1/forecast', prompt: 'x' })
  s.at(12_000)
  await s.frame('Step 2: the card says what it is doing')
  await s.call('TaskUpdate', { taskId: '2', status: 'completed' })
  await s.call('TaskUpdate', { taskId: '3', status: 'in_progress' })
  await s.call('Write', { file_path: '/repo/src/weather.ts' })
  await s.call('Bash', { command: "sed -i '' 's/old/new/' src/Dashboard.tsx", description: 'Patch the dashboard' })
  s.at(30_000)
  await s.frame('Step 3 of 4')
  for (const taskId of ['3', '4']) await s.call('TaskUpdate', { taskId, status: 'completed' })
  s.at(40_000)
  await s.end('answer', 95_000)
  await s.frame('The turn ends: files changed and read, time taken')
})

scenario('checklist', async s => {
  await s.ask('Build a weather dashboard for New York City.')
  s.say(`Plan:\n\n${CHECKLIST('    ')}`)
  await s.step()
  s.at(3_000)
  await s.frame('No task tool: the checklist in the answer is the plan')
  await s.call('Read', { file_path: '/repo/docs/api.md' })
  s.say(`Done with the docs.\n\n${CHECKLIST('x   ')}`)
  await s.step()
  s.at(10_000)
  await s.frame('The agent writes it again: step 1 is ticked')
  s.say('Two steps done.\n\n1. [x] Define the data source\n2. [x] Write the HTML')
  await s.step()
  s.at(10_000)
  await s.frame('A shorter list that names some tasks ticks them and keeps the rest')
  s.say('All done.\n\n' + CHECKLIST('xxxx'))
  await s.step()
  s.at(8_000)
  await s.end('answer', 31_000)
  await s.frame('The turn ends')
})

scenario('interrupted', async s => {
  await s.ask('Refactor the billing module.')
  for (const subject of ['Map the call sites', 'Extract the invoice service', 'Update the tests']) await s.call('TaskCreate', { subject, description: subject })
  await s.call('TaskUpdate', { taskId: '1', status: 'completed' })
  await s.call('TaskUpdate', { taskId: '2', status: 'in_progress' })
  await s.call('Edit', { file_path: '/repo/billing/invoice.ts' })
  s.at(52_000)
  await s.frame('Working on step 2 of 3')
  await s.end('aborted', 52_000)
  await s.frame('Esc: the card turns grey, with the step it left')
})

scenario('agents', async s => {
  await s.ask('Review the code and open the PR')
  await s.call('Agent', { description: 'code-review', prompt: 'review', subagent_type: 'general-purpose', run_in_background: true })
  await s.$.agent.spawn({ tool_use_id: 'tu9', prompt: 'review', description: 'code-review', subagentType: 'general-purpose', provider: { plugin: 'engine', tier: 'core' }, parentModel: 'claude-opus-5-5', background: true, fork: false } as never)
  s.at(5_000)
  await s.frame('A background agent starts: one row, its name and time')
  s.at(25_000)
  await s.end('answer', 30_000)
  s.at(95_000)
  await s.frame('The turn ends, the agent still runs: the card waits for it')
})

scenario('request', async s => {
  await s.ask('1. yes\n2. yes, on the same branch\n3. the default stays line\n\nShip it all in one fix version and open a single PR')
  await s.call('Read', { file_path: '/repo/notes/plan.md' })
  s.at(4_000)
  await s.frame('A request of several lines: its first line and how many are left')
  await s.press('request')
  s.at(2_000)
  await s.frame('show request unfolds it on the card')
  await s.call('Bash', { command: 'git switch -c fix/plain-view-0.1.8', description: 'Create the fix branch' })
  s.at(9_000)
  await s.press('request')
  await s.frame('fold puts it back on one line')
  s.at(6_000)
  await s.end('answer', 21_000)
  await s.frame('The end card keeps the title and the count')
})
