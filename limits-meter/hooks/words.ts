// What limits-meter says, in Portuguese and English. The language comes from the `language`
// option, else the system's LANG (ui.tsx's langOf).

import type { Lang } from './ui'

export const COMMAND = 'limits'

type Words = {
  description: string
  pane: string
  hint: string
  /** Short names of the plan windows, for the band and the pane's first column. */
  labels: Record<string, string>
  now: string
  resetsIn: (reset: string) => string
  /** Toasts, once per threshold. */
  windowAlert: (label: string, percent: string, reset: string) => string
  contextAlert: (percent: string) => string
  /** The one-line answer where no pane can open. */
  context: string
  noReadings: string
  planWindows: string
  noWindows: string
  contextHeading: string
  ofWindow: (used: string, window: string) => string
  turns: string
  noTurns: string
  /** The turns table's column heads: input, output, cache, time, model. */
  columns: readonly [string, string, string, string, string]
  /** Under a plan window: when it reaches 100% at the current pace, before it resets. */
  pace: (label: string, span: string) => string
  /** After the context sparkline. */
  trend: (turns: number) => string
  /** Band and pane buttons. */
  compact: string
  /** What `compact` puts in the prompt, its blank marked to replace. */
  compactFill: string
  details: string
  hide: string
  close: string
  hidden: string
  shown: string
  help: string
  failedToRun: (what: string) => string
  /** Toasts on a costly switch: with a pace, with the window resetting first, with no pace. */
  switchPace: (percent: string, span: string) => string
  switchResets: (percent: string, reset: string) => string
  switchFaster: (percent: string, what: string) => string
  /** The pane's model section. */
  modelHeading: string
  effort: string
  /** The pane's costly-switch section and /limits warn. */
  warnHeading: string
  warnHint: string
  warnOrder: string
  warnSet: (percent: number) => string
  warnIs: (percent: number) => string
  /** The cache clock: pane section, the sentence of each state, the unknown TTL and the hit rate. */
  cacheHeading: string
  cacheOf: (ttl: string) => string
  cacheWarm: (tokens: string) => string
  cacheCooling: (tokens: string) => string
  cacheCold: (tokens: string) => string
  cacheKeeping: (until: string) => string
  cacheUnknown: string
  hitRate: (percent: string) => string
  coldWord: string
  coldToast: (tokens: string) => string
  /** Keep-warm: buttons, the question and its answers, why it stopped, the transcript row. */
  keepWarm: string
  keepStop: string
  keepAsk: (tokens: string) => string
  keepYes: string
  keepNo: string
  keepOn: string
  keepOff: string
  keepNeedsTtl: string
  keepStopped: (why: 'prompt' | 'time' | 'cold' | 'failed') => string
  keepRow: string
  /** The context groups on the band's legend and in the pane's table. */
  ctxLabel: string
  groups: { system: string; mcp: string; messages: string; free: string }
  breakdownHead: string
  breakdownNote: string
}

export const WORDS: Record<Lang, Words> = {
  'pt-BR': {
    description: 'Limites do plano, relógio do cache e contexto: /limits abre o painel; hide, show, keep-warm, warn, help',
    pane: 'Limites e contexto',
    hint: 'Números que o engine informa a cada turno. Tokens e percentual, nunca dinheiro.',
    labels: { five_hour: '5h', seven_day: 'sem', spend_limit: 'gasto' },
    now: 'agora',
    resetsIn: reset => `reinicia em ${reset}`,
    windowAlert: (label, percent, reset) => `Janela ${label} em ${percent}${reset ? `, reinicia em ${reset}` : ''}`,
    contextAlert: percent => `Contexto ${percent} cheio: bom momento para /compact com um foco`,
    context: 'contexto',
    noReadings: 'sem leituras de limite do plano (chave de API, ou antes da primeira resposta)',
    planWindows: 'Janelas do plano',
    noWindows: 'Sem leituras: uma chave de API não tem janelas do plano, e uma assinatura as mostra depois da primeira resposta.',
    contextHeading: 'Contexto',
    ofWindow: (used, window) => `${used} de ${window}`,
    turns: 'Turnos (thread principal)',
    noTurns: 'Nenhum turno terminado ainda.',
    columns: ['entrada', 'saída', 'cache', 'tempo', 'modelo'],
    pace: (label, span) => `no ritmo atual, ${label} chega a 100% em ~${span}, antes de reiniciar`,
    trend: n => `contexto ao fim ${n === 1 ? 'do último turno' : `dos últimos ${n} turnos`}`,
    compact: 'compactar',
    compactFill: '/compact [foco]',
    details: 'detalhes',
    hide: 'ocultar',
    close: 'Fechar',
    hidden: 'Banda oculta. /limits show traz de volta.',
    shown: 'Banda visível.',
    help: [
      '/limits          abre o painel: janelas do plano, contexto em tokens, os últimos 20 turnos',
      '/limits hide     oculta a banda acima do prompt, também nas próximas sessões',
      '/limits show     traz a banda de volta',
      '/limits keep-warm on|off  mantém o cache quente (gasta plano; pergunta antes)',
      '/limits warn N   avisa na troca cara com a janela de 5h a partir de N% (padrão 70)',
    ].join('\n'),
    failedToRun: what => `Não deu para rodar: ${what}`,
    switchPace: (percent, span) => `5h em ${percent}: neste ritmo a janela acaba em ~${span} · /limits`,
    switchResets: (percent, reset) => `5h em ${percent}: reinicia em ${reset}, antes de acabar · /limits`,
    switchFaster: (percent, what) => `5h em ${percent}: ${what} gasta a janela mais rápido · /limits`,
    modelHeading: 'Modelo',
    effort: 'effort',
    warnHeading: 'Aviso de troca cara',
    warnHint: 'Toast ao trocar para modelo maior ou effort max com 5h a partir de:',
    warnOrder: 'ordem: haiku < sonnet < opus < fable',
    warnSet: percent => `Aviso de troca cara a partir de ${percent}%. Vale nas próximas sessões.`,
    warnIs: percent => `Aviso de troca cara a partir de ${percent}%. /limits warn N muda (1 a 100).`,
    cacheHeading: 'Cache',
    cacheOf: ttl => `de ${ttl} (TTL da última resposta)`,
    cacheWarm: tokens => `Responda agora e ${tokens} tokens saem do cache: ~10% do que custaria reler a frio.`,
    cacheCooling: tokens => `Esfriando: responda ou mantenha quente. Frio, ${tokens} tokens são relidos sem cache.`,
    cacheCold: tokens => `Cache frio: a próxima resposta relê ${tokens} tokens sem cache. /compact antes gasta menos.`,
    cacheKeeping: until => `Mantendo quente: uma mensagem curta antes de esfriar. Para no seu próximo prompt ou em ${until}.`,
    cacheUnknown: 'TTL do cache desconhecido. Ele aparece depois de uma troca de modelo, ou de um turno de uma só chamada depois de mais de 5 min parado.',
    hitRate: percent => `taxa de acerto do último turno: ${percent}`,
    coldWord: 'frio',
    coldToast: tokens => `Cache frio: a próxima resposta relê ${tokens} tokens sem cache`,
    keepWarm: 'manter quente',
    keepStop: 'parar',
    keepAsk: tokens => `Manter o cache quente? Cada envio relê ${tokens} tokens do cache e gasta plano (sem estimativa em %: depende do contexto). Para no seu próximo prompt ou em 2 h.`,
    keepYes: 'sim, manter',
    keepNo: 'não',
    keepOn: 'Manter quente ligado. Para no seu próximo prompt ou em 2 h.',
    keepOff: 'Manter quente desligado.',
    keepNeedsTtl: 'Ainda não sei o TTL do cache, então não dá para saber quando enviar. Tente depois do próximo turno.',
    keepStopped: why =>
      ({
        prompt: 'Manter quente parou: o seu prompt já renova o cache.',
        time: 'Manter quente parou: passaram 2 h.',
        cold: 'Manter quente parou: o cache esfriou antes do envio.',
        failed: 'Manter quente parou: o envio falhou.',
      })[why],
    keepRow: '♻ manter quente (mensagem do limits-meter)',
    ctxLabel: 'ctx',
    groups: { system: 'sistema', mcp: 'MCP', messages: 'mensagens', free: 'livre' },
    breakdownHead: 'categoria                tokens  janela',
    breakdownNote: '≈ estimativa local do engine, os mesmos números do /context',
  },
  en: {
    description: 'Plan limits, cache clock and context: /limits opens the pane; hide, show, keep-warm, warn, help',
    pane: 'Limits & context',
    hint: 'Figures the engine reports after each turn. Tokens and percent, never money.',
    labels: { five_hour: '5h', seven_day: 'wk', spend_limit: 'spend' },
    now: 'now',
    resetsIn: reset => `resets in ${reset}`,
    windowAlert: (label, percent, reset) => `${label} window at ${percent}${reset ? `, resets in ${reset}` : ''}`,
    contextAlert: percent => `Context ${percent} full: a good moment for /compact with a focus`,
    context: 'context',
    noReadings: 'no plan-limit readings (API key, or before the first response)',
    planWindows: 'Plan windows',
    noWindows: 'No readings: an API key has no plan windows, and a subscription shows them after the first response.',
    contextHeading: 'Context',
    ofWindow: (used, window) => `${used} of ${window}`,
    turns: 'Turns (main thread)',
    noTurns: 'No finished turns yet.',
    columns: ['in', 'out', 'cache', 'time', 'model'],
    pace: (label, span) => `at this pace, ${label} reaches 100% in ~${span}, before it resets`,
    trend: n => `context at the end of the last ${n} turn${n === 1 ? '' : 's'}`,
    compact: 'compact',
    compactFill: '/compact [focus]',
    details: 'details',
    hide: 'hide',
    close: 'Close',
    hidden: 'Band hidden. /limits show brings it back.',
    shown: 'Band shown.',
    help: [
      '/limits          open the pane: plan windows, context in tokens, the last 20 turns',
      '/limits hide     hide the band above the prompt, in later sessions too',
      '/limits show     bring the band back',
      '/limits keep-warm on|off  keep the cache warm (spends plan; asks first)',
      '/limits warn N   warn on a costly switch with the 5-hour window from N% (default 70)',
    ].join('\n'),
    failedToRun: what => `Could not run: ${what}`,
    switchPace: (percent, span) => `5h at ${percent}: at this pace the window runs out in ~${span} · /limits`,
    switchResets: (percent, reset) => `5h at ${percent}: resets in ${reset}, before it runs out · /limits`,
    switchFaster: (percent, what) => `5h at ${percent}: ${what} uses the window faster · /limits`,
    modelHeading: 'Model',
    effort: 'effort',
    warnHeading: 'Costly switch warning',
    warnHint: 'Toast on a switch to a bigger model or effort max with 5h from:',
    warnOrder: 'order: haiku < sonnet < opus < fable',
    warnSet: percent => `Costly switch warning from ${percent}%. Kept for later sessions.`,
    warnIs: percent => `Costly switch warning from ${percent}%. /limits warn N changes it (1 to 100).`,
    cacheHeading: 'Cache',
    cacheOf: ttl => `of ${ttl} (TTL of the last reply)`,
    cacheWarm: tokens => `Reply now and ${tokens} tokens come from cache: ~10% of what a cold re-read would cost.`,
    cacheCooling: tokens => `Cooling: reply or keep it warm. Cold, ${tokens} tokens are re-read with no cache.`,
    cacheCold: tokens => `Cache cold: the next reply re-reads ${tokens} tokens with no cache. /compact first spends less.`,
    cacheKeeping: until => `Keeping warm: a short message before it cools. Stops at your next prompt or in ${until}.`,
    cacheUnknown: 'Cache TTL unknown. It shows after a model switch, or after a one-request turn that follows more than 5 min idle.',
    hitRate: percent => `last turn hit rate: ${percent}`,
    coldWord: 'cold',
    coldToast: tokens => `Cache cold: the next reply re-reads ${tokens} tokens with no cache`,
    keepWarm: 'keep warm',
    keepStop: 'stop',
    keepAsk: tokens => `Keep the cache warm? Each send re-reads ${tokens} tokens from cache and spends plan (no estimate in %: it depends on the context). Stops at your next prompt or in 2 h.`,
    keepYes: 'yes, keep warm',
    keepNo: 'no',
    keepOn: 'Keep-warm on. Stops at your next prompt or in 2 h.',
    keepOff: 'Keep-warm off.',
    keepNeedsTtl: 'The cache TTL is not known yet, so there is no telling when to send. Try after the next turn.',
    keepStopped: why =>
      ({
        prompt: 'Keep-warm stopped: your prompt already refreshes the cache.',
        time: 'Keep-warm stopped: 2 h passed.',
        cold: 'Keep-warm stopped: the cache went cold before the send.',
        failed: 'Keep-warm stopped: the send failed.',
      })[why],
    keepRow: '♻ keep-warm (message from limits-meter)',
    ctxLabel: 'ctx',
    groups: { system: 'system', mcp: 'MCP', messages: 'messages', free: 'free' },
    breakdownHead: 'category                 tokens  window',
    breakdownNote: '≈ local engine estimate, the same figures as /context',
  },
}
