// What plain-view says, in Portuguese and English. The language comes from the `language`
// option, else the system's LANG (ui.tsx's langOf).

import type { SettingKey } from './settings'
import type { Lang } from './ui'

export const COMMAND = 'plain-view'

/** The label the prompt footer shows while the mod is on. */
export const MODE = 'plain view'

/** agent-watch's command: the agents row offers it when agent-watch is installed. */
export const WATCH = 'watch'

type Words = {
  description: string
  /** The two steps the card shows before the agent writes a task list. */
  first: [string, string]
  untitled: string
  /** The title of a turn a notification started (a background agent finished) with no turn before. */
  agentDone: string
  step: (n: number, of: number) => string
  steps: (done: number, of: number) => string
  allDone: string
  turnDone: string
  interrupted: string
  stopped: string
  took: (span: string) => string
  stoppedAt: (span: string) => string
  /** A task's status beside its bar. */
  done: string
  leftOpen: string
  moreBefore: (n: number) => string
  next: string
  later: string
  halted: string
  moreDone: (n: number) => string
  moreAfter: (n: number) => string
  /** A request's lines the title leaves out, `+5 linhas`; a pasted code block, `⟨código · 4 linhas⟩`. */
  moreLines: (n: number) => string
  codeLines: (n: number) => string
  /** The card's button that unfolds the whole request, and folds it back. */
  showRequest: string
  foldRequest: string
  /** What the turn touched: `mudei 2 arquivos · li 3 arquivos`. */
  files: (changed: number, read: number) => string
  /** The badge of the small card a turn with no task list leaves. */
  ready: string
  /** The agents row: `2 agentes rodando`, `1 agente terminou`. */
  agentsRunning: (n: number) => string
  agentsFinished: (n: number) => string
  /** The waiting card, once the main turn ended with an agent running. */
  waiting: (n: number) => string
  /** How many agents ran, on the small end card: `1 agente`. */
  agents: (n: number) => string
  on: string
  off: string
  alreadyOn: string
  alreadyOff: string
  denied: (why: string) => string
  demoStarted: string
  demoBusy: string
  demoTitle: string
  demoTasks: string[]
  demoDoing: string
  palette: string
  paletteNow: (id: string) => string
  paletteSet: (id: string) => string
  paletteUnknown: (name: string, names: string) => string
  paletteAlso: string
  use: string
  answer: string
  using: (tool: string) => string
  usingSkill: (skill: string) => string
  /** The system prompt line the askForTasks option adds when the session has a task tool. */
  askForTasks: string
  /** The line it adds when the session has none: a checklist in the reply, which the card reads. */
  askForChecklist: string
  /** The card's notice when a text list stopped moving, and the row's status with the calls it has made. */
  stale: string
  staleFor: (calls: number) => string
  /** The reminder the model reads after a tool result once its checklist is stale; English in both languages. */
  nudge: (calls: number) => string
  failed: string
  inUse: string
  help: string
  /** The settings pane, /plain-view or /plain-view config. */
  pane: PaneWords
}

type PaneWords = {
  /** The pane's tab label. */
  title: string
  heading: string
  hint: string
  tabs: [string, string, string]
  labels: Record<SettingKey, string>
  yes: string
  no: string
  /** What each value does, by option and value (`true` / `false` for the yes-or-no ones). */
  values: Record<Exclude<SettingKey, 'palette'>, Record<string, string>>
  preview: string
  saved: (label: string, value: string) => string
  denied: (why: string) => string
  locked: string
  lockedWhy: string
  defaults: string
  close: string
  ask: string
  askYes: string
  askNo: string
  reset: string
  resetNone: string
}

// The model reads English best; the same line in both languages.
const ASK_FOR_TASKS =
  'When a request takes more than two steps, keep its plan as a task list with the TodoWrite or TaskCreate tool, and mark each task in progress and completed as you go. The person follows your progress from that list, not from the tool calls.'
const ASK_FOR_CHECKLIST =
  "When a request takes more than two steps, write its plan as a Markdown checklist (`- [ ] step`) in your reply before you start. Each time a step finishes, before the next step's first tool call, write `- [x] <that step>` (one line is enough) or the whole checklist again. These checklist lines are exempt from any brevity or terse-output rule. The person follows your progress from them."
const NUDGE = (calls: number) =>
  `plain-view: your checklist has not changed for ${calls} tool calls. If a step is done, write \`- [x] <step>\` for it (one line is enough), or the whole checklist again.`

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export const WORDS: Record<Lang, Words> = {
  'pt-BR': {
    description: 'Transcript sem ruído: o plano do agente num cartão acima do prompt',
    first: ['Entender o pedido', 'Planejar os passos'],
    untitled: 'Pedido sem texto',
    agentDone: 'Um agente terminou',
    step: (n, of) => `Passo ${n} de ${of}`,
    steps: (done, of) => `${done} de ${of} passos`,
    allDone: '✓ Tudo pronto',
    turnDone: '✓ Turno pronto',
    interrupted: '■ Interrompido',
    stopped: '■ Parou com erro',
    took: span => `levou ${span}`,
    stoppedAt: span => `parou em ${span}`,
    done: 'Feito',
    leftOpen: 'Ficou aberto',
    moreBefore: n => `○ mais ${n} antes`,
    next: 'Próximo',
    later: 'Depois',
    halted: 'Parado',
    moreDone: n => `✓ mais ${n} ${n === 1 ? 'feito' : 'feitos'}`,
    moreAfter: n => `○ mais ${n} depois`,
    moreLines: n => `+${plural(n, 'linha', 'linhas')}`,
    codeLines: n => `⟨código · ${plural(n, 'linha', 'linhas')}⟩`,
    showRequest: 'ver pedido',
    foldRequest: 'recolher',
    files: (changed, read) =>
      changed > 0 ? `mudei ${plural(changed, 'arquivo', 'arquivos')} · li ${plural(read, 'arquivo', 'arquivos')}` : `li ${plural(read, 'arquivo', 'arquivos')}`,
    ready: '✓ Pronto',
    agentsRunning: n => `${plural(n, 'agente', 'agentes')} rodando`,
    agentsFinished: n => `${plural(n, 'agente', 'agentes')} ${n === 1 ? 'terminou' : 'terminaram'}`,
    waiting: n => `Esperando ${plural(n, 'agente', 'agentes')}`,
    agents: n => plural(n, 'agente', 'agentes'),
    on: 'plain-view ligado · /plain-view off desliga',
    off: 'plain-view desligado · /plain-view on liga',
    alreadyOn: 'plain-view já está ligado.',
    alreadyOff: 'plain-view já está desligado.',
    denied: why => `Não deu para mudar a opção: ${why}`,
    demoStarted: 'Demo no cartão acima do prompt por 12 s. Nada roda de verdade.',
    demoBusy: 'O agente está trabalhando. Rode a demo quando o pedido terminar.',
    demoTitle: 'Demo: monte um painel do tempo',
    demoTasks: ['Escolher o estilo da página', 'Ver como pegar o tempo ao vivo', 'Montar o painel', 'Publicar o link'],
    demoDoing: 'demo',
    palette: 'Paleta das barras',
    paletteNow: id => `agora: ${id}`,
    paletteSet: id => `Paleta ${id} · salva em /config`,
    paletteUnknown: (name, names) => `Não conheço a paleta "${name}". As paletas: ${names}.`,
    paletteAlso: 'Também: /plain-view palette aurora, ou /config → plain-view → palette.',
    use: 'usar',
    answer: 'Resposta: ',
    using: tool => `usando ${tool}`,
    usingSkill: skill => `usando a skill ${skill}`,
    askForTasks: ASK_FOR_TASKS,
    askForChecklist: ASK_FOR_CHECKLIST,
    stale: 'lista parada',
    staleFor: n => `lista parada há ${n} calls`,
    nudge: NUDGE,
    failed: 'Algo falhou no plain-view. O transcript segue como estava.',
    inUse: 'em uso',
    help: [
      '**plain-view** · transcript sem ruído',
      '- `/plain-view` ou `config` abre o painel de configuração',
      '- `on` esconde as linhas de tool; o plano aparece num cartão acima do prompt',
      '- `off` volta o transcript de sempre',
      '- `hide` segue ligado, com as linhas de tool recolhidas, mas sem o cartão acima do prompt; `show` traz o cartão de volta',
      '- `demo` mostra o cartão com um plano de exemplo',
      '- `palette` mostra as 8 paletas e troca a cor das barras',
      '- `help` esta ajuda',
      'Falha de tool, permissão e perguntas sempre aparecem inteiras.',
      'Opções no painel ou em /config → plain-view: agentText, askForTasks, request, palette, animation, language, icons.',
      'agentText: final esconde o que o agente escreve antes de chamar tools e deixa a resposta final (padrão); none, nada; card, a resposta no cartão; all, tudo.',
      'Paleta padrão: claude. /plain-view palette mostra as 8.',
    ].join('\n'),
    pane: {
      title: 'plain-view',
      heading: '✻ plain-view · configuração',
      hint: 'Vale para todas as sessões. Fica salvo em /config → plain-view.',
      tabs: ['Transcript', 'Cartão', 'Geral'],
      labels: { enabled: 'Ligado', agentText: 'Fala do agente', askForTasks: 'Pedir lista de tarefas', request: 'Pedido no cartão', palette: 'Cores das barras', animation: 'Animação', language: 'Idioma', icons: 'Ícones' },
      yes: 'sim',
      no: 'não',
      values: {
        enabled: { true: 'Esconde as linhas de tools; o plano fica no cartão acima do prompt.', false: 'Transcript de sempre. As outras opções valem quando ligar.' },
        agentText: {
          final: 'Esconde o que o agente escreve antes de chamar tools. A resposta final fica. (padrão)',
          none: 'Esconde toda a fala do agente. Fica só o cartão.',
          card: 'Esconde a fala. A primeira frase da resposta vai para o cartão.',
          all: 'Mostra toda a fala do agente.',
        },
        askForTasks: { true: 'Uma linha no system prompt pede uma lista de tarefas. Custa poucos tokens por pedido.', false: 'O cartão lê só a lista que o modelo fizer por conta própria.' },
        request: {
          line: 'A primeira linha do pedido e quantas faltam (+5 linhas). (padrão)',
          joined: 'Todas as linhas numa só, separadas por ·, cortadas na largura do cartão.',
          auto: 'A primeira linha de texto corrido. Itens de lista (1. sim) entram na contagem.',
          all: 'Até 10 linhas do pedido embaixo do título; o resto vira +N linhas.',
        },
        animation: { true: 'Um brilho corre nas barras enquanto o agente trabalha.', false: 'Barras paradas, nas cores do tema.' },
        language: { auto: 'Segue o LANG do sistema.', 'pt-BR': 'Português do Brasil.', en: 'Inglês.' },
        icons: { auto: 'symbol no terminal do JetBrains, emoji nos outros.', emoji: 'Passos como ✅ 🟠 ⚪.', symbol: 'Passos como ✓ ● ○, para terminais que desenham emoji torto.' },
      },
      preview: 'Prévia',
      saved: (label, value) => `✓ Salvo · ${label}: ${value}`,
      denied: why => `Não salvou: ${why}`,
      locked: '🔒 definido pela organização',
      lockedWhy: 'Vem das configurações gerenciadas. Não muda aqui nem no /config.',
      defaults: 'padrões',
      close: 'fechar',
      ask: 'Voltar as opções do plain-view ao padrão?',
      askYes: 'voltar',
      askNo: 'agora não',
      reset: '✓ Opções no padrão',
      resetNone: 'As opções já estão no padrão.',
    },
  },
  en: {
    description: 'A quiet transcript: the agent’s plan in a card above the prompt',
    first: ['Understand your request', 'Plan the steps'],
    untitled: 'Request with no text',
    agentDone: 'An agent finished',
    step: (n, of) => `Step ${n} of ${of}`,
    steps: (done, of) => `${done} of ${of} steps`,
    allDone: '✓ All done',
    turnDone: '✓ Turn done',
    interrupted: '■ Interrupted',
    stopped: '■ Stopped on an error',
    took: span => `took ${span}`,
    stoppedAt: span => `stopped at ${span}`,
    done: 'Done',
    leftOpen: 'Left open',
    moreBefore: n => `○ ${n} more before`,
    next: 'Next',
    later: 'Up next',
    halted: 'Stopped',
    moreDone: n => `✓ ${n} more done`,
    moreAfter: n => `○ ${n} more after`,
    moreLines: n => `+${plural(n, 'line', 'lines')}`,
    codeLines: n => `⟨code · ${plural(n, 'line', 'lines')}⟩`,
    showRequest: 'show request',
    foldRequest: 'fold',
    files: (changed, read) =>
      changed > 0 ? `changed ${plural(changed, 'file', 'files')} · read ${plural(read, 'file', 'files')}` : `read ${plural(read, 'file', 'files')}`,
    ready: '✓ Done',
    agentsRunning: n => `${plural(n, 'agent', 'agents')} running`,
    agentsFinished: n => `${plural(n, 'agent', 'agents')} finished`,
    waiting: n => `Waiting for ${plural(n, 'agent', 'agents')}`,
    agents: n => plural(n, 'agent', 'agents'),
    on: 'plain-view on · /plain-view off turns it off',
    off: 'plain-view off · /plain-view on turns it on',
    alreadyOn: 'plain-view is already on.',
    alreadyOff: 'plain-view is already off.',
    denied: why => `Could not change the option: ${why}`,
    demoStarted: 'Demo in the card above the prompt for 12 s. Nothing really runs.',
    demoBusy: 'The agent is working. Run the demo once the request ends.',
    demoTitle: 'Demo: build a weather dashboard',
    demoTasks: ['Pick the page style', 'Check how to get live weather', 'Build the dashboard', 'Publish the link'],
    demoDoing: 'demo',
    palette: 'Bar palette',
    paletteNow: id => `now: ${id}`,
    paletteSet: id => `Palette ${id} · saved in /config`,
    paletteUnknown: (name, names) => `No palette named "${name}". The palettes: ${names}.`,
    paletteAlso: 'Also: /plain-view palette aurora, or /config → plain-view → palette.',
    use: 'use',
    answer: 'Answer: ',
    using: tool => `using ${tool}`,
    usingSkill: skill => `using the ${skill} skill`,
    askForTasks: ASK_FOR_TASKS,
    askForChecklist: ASK_FOR_CHECKLIST,
    stale: 'list not updated',
    staleFor: n => `list not updated for ${n} calls`,
    nudge: NUDGE,
    failed: 'Something failed in plain-view. The transcript stays as it was.',
    inUse: 'in use',
    help: [
      '**plain-view** · a quiet transcript',
      '- `/plain-view` or `config` opens the settings pane',
      '- `on` hides tool rows; the plan shows in a card above the prompt',
      '- `off` back to the usual transcript',
      '- `hide` stays on, with tool rows folded, but without the card above the prompt; `show` brings the card back',
      '- `demo` shows the card with a sample plan',
      '- `palette` shows the 8 palettes and changes the bar colors',
      '- `help` this help',
      'Tool failures, permissions and questions always show in full.',
      'Options in the pane or in /config → plain-view: agentText, askForTasks, request, palette, animation, language, icons.',
      'agentText: final hides what the agent writes before calling tools and keeps the final answer (default); none, nothing; card, the answer in the card; all, everything.',
      'Default palette: claude. /plain-view palette shows all 8.',
    ].join('\n'),
    pane: {
      title: 'plain-view',
      heading: '✻ plain-view · settings',
      hint: 'Applies to every session. Saved in /config → plain-view.',
      tabs: ['Transcript', 'Card', 'General'],
      labels: { enabled: 'On', agentText: "The agent's words", askForTasks: 'Ask for a task list', request: 'Request on the card', palette: 'Bar colors', animation: 'Animation', language: 'Language', icons: 'Icons' },
      yes: 'yes',
      no: 'no',
      values: {
        enabled: { true: 'Hides tool rows; the plan shows in a card above the prompt.', false: 'The usual transcript. The other options apply once it is on.' },
        agentText: {
          final: 'Hides what the agent writes before calling tools. The final answer stays. (default)',
          none: "Hides all the agent's words. Only the card stays.",
          card: "Hides the words. The answer's first sentence goes to the card.",
          all: "Shows all the agent's words.",
        },
        askForTasks: { true: 'One line in the system prompt asks for a task list. Costs a few tokens per request.', false: 'The card reads only the list the model keeps on its own.' },
        request: {
          line: "The request's first line and how many are left (+5 lines). (default)",
          joined: "All lines in one, joined by ·, cut at the card's width.",
          auto: 'The first line of prose. List items (1. yes) go into the count.',
          all: 'Up to 10 lines of the request under the title; the rest shows as +N lines.',
        },
        animation: { true: 'A shine runs along the bars while the agent works.', false: "Still bars, in the theme's colors." },
        language: { auto: "Follows the system's LANG.", 'pt-BR': 'Brazilian Portuguese.', en: 'English.' },
        icons: { auto: 'symbol in a JetBrains terminal, emoji elsewhere.', emoji: 'Steps as ✅ 🟠 ⚪.', symbol: 'Steps as ✓ ● ○, for terminals that draw emoji at odd widths.' },
      },
      preview: 'Preview',
      saved: (label, value) => `✓ Saved · ${label}: ${value}`,
      denied: why => `Not saved: ${why}`,
      locked: '🔒 set by your organization',
      lockedWhy: 'Comes from managed settings. It does not change here or in /config.',
      defaults: 'defaults',
      close: 'close',
      ask: "Put plain-view's options back to their defaults?",
      askYes: 'reset',
      askNo: 'not now',
      reset: '✓ Options back to defaults',
      resetNone: 'The options are already at their defaults.',
    },
  },
}
