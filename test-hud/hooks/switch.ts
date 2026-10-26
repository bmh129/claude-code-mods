// The switch every mod answers to: /x on, off, hide and show. The same file in every mod:
// scripts/check-shared.sh keeps the copies equal, so it imports from nothing (launchpad has no
// ui.tsx). Nothing here takes `$`: the mod reads and writes its own option and store key.
//
//   off   the mod is off in every conversation: the `enabled` option, which a reload applies.
//   hide  the mod stays on but draws nothing of its own; its command and pane still open.

type Lang = 'pt-BR' | 'en'

export type Switch = 'on' | 'off' | 'hide' | 'show'

const SWITCHES: readonly string[] = ['on', 'off', 'hide', 'show']

/** The switch an argument line names (its first word), or null for any other verb. */
export const switchOf = (args: string): Switch | null => {
  const word = args.trim().toLowerCase().split(/\s+/)[0] ?? ''
  return SWITCHES.includes(word) ? (word as Switch) : null
}

/** What /x on|off|hide|show answers, for the mod's command. */
export const switchWords = (lang: Lang, command: string) =>
  lang === 'pt-BR'
    ? {
        on: `${command} ligado · /${command} off desliga`,
        off: `${command} desligado em todas as conversas · /${command} on liga`,
        alreadyOn: `${command} já está ligado.`,
        alreadyOff: `${command} já está desligado.`,
        hidden: `${command} oculto, mas ligado · /${command} show mostra`,
        shown: `${command} visível · /${command} hide oculta`,
        denied: (why: string) => `Não deu para mudar a opção: ${why}`,
      }
    : {
        on: `${command} on · /${command} off turns it off`,
        off: `${command} off in every conversation · /${command} on turns it on`,
        alreadyOn: `${command} is already on.`,
        alreadyOff: `${command} is already off.`,
        hidden: `${command} hidden but on · /${command} show brings it back`,
        shown: `${command} shown · /${command} hide hides it`,
        denied: (why: string) => `Could not change the option: ${why}`,
      }
