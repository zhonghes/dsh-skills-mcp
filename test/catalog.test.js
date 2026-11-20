import test from 'node:test'
import assert from 'node:assert/strict'
import { collectSkillCatalog } from '../src/catalog.js'

const skill = (name, extra = {}) => ({
  name,
  description: `${name} description`,
  source: extra.source ?? 'user-dsh',
  provider: extra.provider ?? 'filesystem',
  invocation: extra.invocation ?? { modelInvocable: true, userInvocable: true },
  ...(extra.path === undefined ? {} : { path: extra.path }),
  ...(extra.whenToUse === undefined ? {} : { whenToUse: extra.whenToUse }),
})

function fakeSkills(byScope) {
  return {
    async snapshot(options) {
      const key = options.scope === undefined ? 'global' : JSON.stringify({ key: options.scope.key })
      const value = byScope[key] ?? (options.scope === undefined ? byScope.global : undefined)
      if (value instanceof Error) throw value
      return value ?? { skills: [], complete: true }
    },
  }
}

function fakePresets(definitions, options = {}) {
  const disposed = []
  return {
    disposed,
    async list() {
      if (options.listError !== undefined) throw options.listError
      return definitions
    },
    async acquireScope(id) {
      if (options.acquireError?.[id] !== undefined) throw options.acquireError[id]
      return {
        key: { key: id },
        async [Symbol.asyncDispose]() {
          disposed.push(id)
        },
      }
    },
  }
}

test('T-CAT1 without presets one global snapshot is read and sorted', async () => {
  const skills = fakeSkills({ global: { skills: [skill('zeta'), skill('alpha')], complete: true } })
  const result = await collectSkillCatalog({ skills, cwd: '/w' })
  assert.deepEqual(result.skills.map((row) => row.name), ['alpha', 'zeta'])
  assert.deepEqual(result.skills[0].presets, [])
  assert.equal(result.complete, true)
  assert.deepEqual(result.warnings, [])
})

test('T-CAT2 mounted presets are unioned, deduped, and attributed', async () => {
  const presets = fakePresets([
    { id: 'standard' },
    { id: 'light' },
  ])
  const skills = fakeSkills({
    '{"key":"standard"}': { skills: [skill('shared', { path: '/standard/shared' }), skill('only-standard')], complete: true },
    '{"key":"light"}': { skills: [skill('shared', { path: '/light/shared' }), skill('only-light', { source: 'bundled' })], complete: true },
  })
  const result = await collectSkillCatalog({ skills, presets, cwd: '/w' })
  assert.deepEqual(result.skills.map((row) => row.name), ['only-light', 'only-standard', 'shared'])
  const shared = result.skills.find((row) => row.name === 'shared')
  assert.deepEqual(shared.presets, ['standard', 'light'])
  assert.equal(shared.path, '/standard/shared')
  assert.equal(shared.source, 'user-dsh')
  assert.deepEqual(presets.disposed.sort(), ['light', 'standard'])
  assert.equal(result.complete, true)
})

test('T-CAT3 a broken preset is skipped and reported', async () => {
  const presets = fakePresets([
    { id: 'standard' },
    { id: 'broken', broken: 'row failed' },
  ])
  const skills = fakeSkills({ '{"key":"standard"}': { skills: [skill('alpha')], complete: true } })
  const result = await collectSkillCatalog({ skills, presets, cwd: '/w' })
  assert.deepEqual(result.skills.map((row) => row.name), ['alpha'])
  assert.equal(result.complete, false)
  assert.equal(result.warnings[0].code, 'PRESET_BROKEN')
  assert.deepEqual(presets.disposed, ['standard'])
})

test('T-CAT4 an acquire failure leaves other presets available', async () => {
  const presets = fakePresets([{ id: 'standard' }, { id: 'light' }], { acquireError: { light: new Error('not mounted') } })
  const skills = fakeSkills({ '{"key":"standard"}': { skills: [skill('alpha')], complete: true } })
  const result = await collectSkillCatalog({ skills, presets, cwd: '/w' })
  assert.deepEqual(result.skills.map((row) => row.name), ['alpha'])
  assert.equal(result.complete, false)
  assert.equal(result.warnings[0].code, 'PRESET_UNAVAILABLE')
  assert.match(result.warnings[0].message, /light/)
})

test('T-CAT5 an incomplete snapshot is reported and keeps readable rows', async () => {
  const presets = fakePresets([{ id: 'standard' }])
  const skills = fakeSkills({ '{"key":"standard"}': { skills: [skill('alpha')], complete: false } })
  const result = await collectSkillCatalog({ skills, presets, cwd: '/w' })
  assert.deepEqual(result.skills.map((row) => row.name), ['alpha'])
  assert.equal(result.complete, false)
  assert.equal(result.warnings[0].code, 'INCOMPLETE')
})

test('T-CAT6 a single preset restricts the read to that preset', async () => {
  const presets = fakePresets([{ id: 'standard' }, { id: 'light' }])
  const skills = fakeSkills({ '{"key":"light"}': { skills: [skill('light-only')], complete: true } })
  const result = await collectSkillCatalog({ skills, presets, cwd: '/w', presetId: 'light' })
  assert.deepEqual(result.skills.map((row) => row.name), ['light-only'])
  assert.deepEqual(result.skills[0].presets, ['light'])
  assert.deepEqual(presets.disposed, ['light'])
})

test('T-CAT7 an absent skill registry yields an explicit warning', async () => {
  const result = await collectSkillCatalog({ cwd: '/w' })
  assert.deepEqual(result.skills, [])
  assert.equal(result.complete, false)
  assert.equal(result.warnings[0].code, 'SKILLS_UNAVAILABLE')
})

test('T-CAT8 a preset list failure yields an empty, incomplete catalog', async () => {
  const presets = fakePresets([], { listError: new Error('boom') })
  const skills = fakeSkills({})
  const result = await collectSkillCatalog({ skills, presets, cwd: '/w' })
  assert.deepEqual(result.skills, [])
  assert.equal(result.complete, false)
  assert.equal(result.warnings[0].code, 'PRESETS_UNAVAILABLE')
})

test('T-CAT9 a provider failure is contained and reported', async () => {
  const presets = fakePresets([{ id: 'standard' }])
  const skills = fakeSkills({ '{"key":"standard"}': new Error('disk failed') })
  const result = await collectSkillCatalog({ skills, presets, cwd: '/w' })
  assert.deepEqual(result.skills, [])
  assert.equal(result.complete, false)
  assert.equal(result.warnings[0].code, 'PRESET_READ_FAILED')
})
