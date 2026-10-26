// Tests for hooks/switch.ts. The same file in every mod: scripts/check-shared.sh keeps the
// copies equal.

import { expect, test } from 'claude-code/testing'

import { switchOf, switchWords } from '../hooks/switch'

test('switchOf: the first word names the switch, in any case and spacing', () => {
  expect(switchOf('on')).toBe('on')
  expect(switchOf('  OFF ')).toBe('off')
  expect(switchOf('hide')).toBe('hide')
  expect(switchOf('Show now')).toBe('show')
})

test('switchOf: any other verb, or none, is not a switch', () => {
  expect(switchOf('')).toBeNull()
  expect(switchOf('help')).toBeNull()
  expect(switchOf('warn 80')).toBeNull()
  expect(switchOf('online')).toBeNull()
})

test('switchWords: both languages name the command and the way back', () => {
  const pt = switchWords('pt-BR', 'watch')
  const en = switchWords('en', 'watch')
  expect(pt.off).toContain('/watch on')
  expect(en.off).toContain('/watch on')
  expect(pt.hidden).toContain('/watch show')
  expect(en.shown).toContain('/watch hide')
  expect(pt.denied('x')).toContain('x')
  expect(en.denied('x')).toContain('x')
})
