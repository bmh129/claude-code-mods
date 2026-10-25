/** One rate-limit window as the meter draws it. */
export type Limit = {
  /** `five_hour`, `seven_day`, or a gateway's `spend_limit`. */
  kind: string
  /** 0 to 100, past 100 on an exceeded spend limit. */
  percent: number
  /** When the window resets, in epoch milliseconds; null when unknown. */
  resetsAt: number | null
}

/** The live figures the band draws, pushed by `session.measure`. */
export type Snapshot = {
  limits: Limit[]
  /** Context window fill, 0 to 100; null before the first response. */
  contextPercent: number | null
  /** Input tokens the last response was answered over. */
  contextTokens: number | null
  /** The model's context window in tokens. */
  contextWindow: number
}

/** One finished main-thread turn. */
export type Turn = {
  /** Input tokens: uncached, cache-read and cache-written together. */
  input: number
  output: number
  /** Share of input the prompt cache served, 0 to 1; null when no input. */
  cacheHit: number | null
  model: string
  durationMs: number
  /** Context fill when the turn ended, 0 to 100; null when unknown. */
  contextPercent?: number | null
  /** When the turn ended, in epoch milliseconds: the costly-switch pace spans the last turns. */
  endedAt?: number
  /** Model requests the turn made; 1 means its cache hit rate is its first request's, which the cache TTL inference needs. */
  steps?: number
}

/** How long the prompt cache lives after a request: `cache_ttl` on a model switch, or inferred from the turns. */
export type Ttl = '5m' | '1h'

/** When the main thread's last request ended, and the TTL of the cache it refreshed; null while unknown. */
export type CacheClock = { lastAt: number | null; ttl: Ttl | null }

/** Keep-warm is on until this time (epoch ms), or at the person's next prompt. */
export type KeepWarm = { until: number }

/** One row of the window's breakdown, in the group the band draws it in. */
export type ContextRow = { name: string; tokens: number; group: 'system' | 'mcp' | 'messages' }

/** The context window by the engine's categories (`$.session.usage({ breakdown: 'summary' })`), grouped for the band. */
export type ContextGroups = { window: number; system: number; mcp: number; messages: number; rows: ContextRow[] }

/** Readings of each plan window since it last reset, for the pace: [epoch ms, percent]. */
export type Samples = Record<string, { resetsAt: number; points: [number, number][] }>

declare module 'claude-code' {
  interface PluginState {
    'limits-meter': {
      snapshot: Snapshot
      turns: Turn[]
      isHidden: boolean
      fired: string[]
      samples: Samples
      /** The main thread's model id, from session.model, PostModelSwitch and turn.step. */
      model: string | null
      /** The main thread's effort, from the best source seen; null when unknown or the model has none. */
      effort: string | number | null
      /** The 5-hour percent from which a costly switch raises a toast; kept in $.store. */
      switchAt: number
      /** The cache clock: last request end and TTL. */
      cache: CacheClock
      /** Keep-warm while on; null when off. */
      keepWarm: KeepWarm | null
      /** The latest context breakdown, grouped; null before the first or when the engine gives none. */
      groups: ContextGroups | null
    }
  }
}
