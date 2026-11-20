import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_DECISIONS_PER_SCOPE,
  MAX_META_LENGTH,
  applyDecision,
  decisionNames,
  emptySnapshot,
  explicitDecisions,
  isServerName,
  isSkillName,
  normalizeSnapshot,
  resolveDecision,
  sanitizeMeta,
  shadowedDecisions,
  SkillsMcpError,
} from '../src/core.js'

const ids = { workspaceId: 'w1', sessionId: 's1' }
const skill = { domain: 'skills', scope: 'global', name: 'dsh-doc', state: 'disabled' }

test('T-C1 an absent decision is enabled at the default scope', () => {
  const resolved = resolveDecision(emptySnapshot(), 'skills', 'dsh-doc', ids)
  assert.deepEqual(resolved, { state: 'enabled', scope: 'default', decision: null })
})

test('T-C2 a workspace decision resolves and keeps its metadata', () => {
  const snapshot = applyDecision(emptySnapshot(), {
    ...skill,
    ...ids,
    scope: 'workspace',
    state: 'disabled',
    meta: { description: 'docs', path: '/tmp/SKILL.md', source: 'user-dsh' },
  })
  const resolved = resolveDecision(snapshot, 'skills', 'dsh-doc', ids)
  assert.equal(resolved.state, 'disabled')
  assert.equal(resolved.scope, 'workspace')
  assert.equal(resolved.decision.meta.description, 'docs')
  assert.equal(decisionNames(snapshot, 'skills', 'workspace', ids).length, 1)
})

test('T-C3 a nearer enabled decision overrides a farther disabled decision', () => {
  let snapshot = applyDecision(emptySnapshot(), { ...skill, ...ids, scope: 'workspace', state: 'disabled' })
  snapshot = applyDecision(snapshot, { ...skill, ...ids, scope: 'session', state: 'enabled' })
  const resolved = resolveDecision(snapshot, 'skills', 'dsh-doc', ids)
  assert.equal(resolved.state, 'enabled')
  assert.equal(resolved.scope, 'session')
  assert.deepEqual(explicitDecisions(snapshot, 'skills', 'dsh-doc', ids).map(row => row.scope), ['session', 'workspace'])
  assert.deepEqual(shadowedDecisions(snapshot, 'skills', 'dsh-doc', ids).map(row => row.scope), ['workspace'])
})

test('T-C4 a nearer disabled decision overrides a farther enabled decision', () => {
  let snapshot = applyDecision(emptySnapshot(), { ...skill, scope: 'global', state: 'enabled' })
  snapshot = applyDecision(snapshot, { ...skill, ...ids, scope: 'session', state: 'disabled' })
  assert.equal(resolveDecision(snapshot, 'skills', 'dsh-doc', ids).state, 'disabled')
  assert.deepEqual(shadowedDecisions(snapshot, 'skills', 'dsh-doc', ids).map(row => row.scope), ['global'])
})

test('T-C5 inherit removes only the targeted decision and leaves a snapshot untouched', () => {
  let snapshot = applyDecision(emptySnapshot(), { ...skill, scope: 'global', state: 'disabled' })
  snapshot = applyDecision(snapshot, { ...skill, ...ids, scope: 'workspace', state: 'disabled' })
  const before = structuredClone(snapshot)
  const next = applyDecision(snapshot, { ...skill, ...ids, scope: 'workspace', state: 'inherit' })
  assert.deepEqual(snapshot, before)
  assert.equal(decisionNames(next, 'skills', 'workspace', ids).length, 0)
  assert.equal(resolveDecision(next, 'skills', 'dsh-doc', ids).scope, 'global')
})

test('T-C6 normalization drops malformed entries, keeps valid metadata, and caps a scope', () => {
  const decisions = {
    'valid-name': { state: 'disabled', meta: { description: 'x'.repeat(MAX_META_LENGTH + 10), path: '/p', source: 'user-dsh', whenToUse: 'w', extra: 'drop' } },
    'Bad Name': { state: 'disabled' },
    'good-but-bad-state': { state: 'maybe' },
    '__proto__': { state: 'disabled' },
    'another-valid': { state: 'enabled' },
  }
  for (let index = 0; index < MAX_DECISIONS_PER_SCOPE + 10; index += 1) decisions[`bulk-${index}`] = { state: 'enabled' }
  const snapshot = normalizeSnapshot({
    version: 99,
    skills: { global: { decisions }, workspaces: { w1: { decisions } }, sessions: {} },
    mcp: { global: { decisions: { 'bad name': { state: 'enabled' }, ok: { state: 'disabled' } } } },
    extra: true,
  })
  assert.equal(snapshot.version, 1)
  assert.equal(snapshot.extra, undefined)
  assert.ok(Object.keys(snapshot.skills.global.decisions).length <= MAX_DECISIONS_PER_SCOPE)
  assert.equal(snapshot.skills.global.decisions['Bad Name'], undefined)
  assert.equal(snapshot.skills.global.decisions['good-but-bad-state'], undefined)
  assert.equal(snapshot.skills.global.decisions['valid-name'].meta.description.length, MAX_META_LENGTH)
  assert.equal(snapshot.skills.global.decisions['valid-name'].meta.extra, undefined)
  assert.equal(snapshot.mcp.global.decisions['bad name'], undefined)
  assert.equal(snapshot.mcp.global.decisions.ok.state, 'disabled')
})

test('T-C7 prototype-shaped ids and names are rejected rather than assigned', () => {
  const snapshot = normalizeSnapshot({
    skills: {
      global: { decisions: { ['__proto__']: { state: 'disabled' } } },
      workspaces: { ['__proto__']: { decisions: { 'valid-name': { state: 'disabled' } } } },
      sessions: { constructor: { decisions: {} } },
    },
  })
  assert.deepEqual(Object.keys(snapshot.skills.global.decisions), [])
  assert.deepEqual(Object.keys(snapshot.skills.workspaces), [])
  assert.deepEqual(Object.keys(snapshot.skills.sessions), [])
  assert.equal(Object.getPrototypeOf(snapshot.skills.global.decisions), Object.prototype)
})

test('T-C8 invalid writes fail with stable codes and leave the input unchanged', () => {
  const snapshot = emptySnapshot()
  const before = structuredClone(snapshot)
  assert.throws(() => applyDecision(snapshot, { ...skill, scope: 'workspace', state: 'disabled' }), (error) => error instanceof SkillsMcpError && error.code === 'INVALID_SCOPE')
  assert.throws(() => applyDecision(snapshot, { ...skill, name: 'Bad Name' }), (error) => error.code === 'INVALID_NAME')
  assert.throws(() => applyDecision(snapshot, { ...skill, state: 'maybe' }), (error) => error.code === 'INVALID_STATE')
  assert.throws(() => applyDecision(snapshot, { ...skill, domain: 'nope' }), (error) => error.code === 'INVALID_INPUT')
  assert.deepEqual(snapshot, before)
})

test('T-C9 empty snapshots are independent and normalization accepts any shape', () => {
  const one = emptySnapshot()
  one.skills.global.decisions.x = { state: 'enabled' }
  assert.deepEqual(emptySnapshot().skills.global.decisions, {})
  assert.deepEqual(normalizeSnapshot(null), emptySnapshot())
  assert.deepEqual(normalizeSnapshot('nope'), emptySnapshot())
  assert.deepEqual(normalizeSnapshot({ skills: [] }), emptySnapshot())
})

test('T-C10 skill and server name grammars are exported and enforced', () => {
  assert.equal(isSkillName('dsh-doc'), true)
  assert.equal(isSkillName('Dsh-Doc'), false)
  assert.equal(isSkillName('a--b'), false)
  assert.equal(isServerName('github'), true)
  assert.equal(isServerName('my_server-2'), true)
  assert.equal(isServerName('has space'), false)
  assert.equal(isServerName('x'.repeat(33)), false)
})

test('T-C11 sanitizeMeta keeps only known non-empty strings', () => {
  assert.equal(sanitizeMeta(null), undefined)
  assert.equal(sanitizeMeta({}), undefined)
  assert.deepEqual(sanitizeMeta({ description: 'd', path: '', source: 3, whenToUse: 'w' }), { description: 'd', whenToUse: 'w' })
})

test('T-C12 decisionsAt returns an empty map for a missing scope id', () => {
  const snapshot = applyDecision(emptySnapshot(), { ...skill, ...ids, scope: 'workspace', state: 'disabled' })
  assert.deepEqual(Object.keys(snapshot.skills.workspaces.w1.decisions), ['dsh-doc'])
  assert.deepEqual(resolveDecision(snapshot, 'skills', 'dsh-doc', {}), { state: 'enabled', scope: 'default', decision: null })
})
