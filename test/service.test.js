import test from 'node:test'
import assert from 'node:assert/strict'
import { createMemoryStore } from '../src/store.js'
import { createService } from '../src/service.js'
import { emptySnapshot } from '../src/core.js'

const workspaces = [
  { id: 'w1', title: 'Project', path: '/project', sessionIds: ['s1', 's2'] },
  { id: 'w2', title: 'Other', path: '/other', sessionIds: ['s3'] },
]

const skill = (name, extra = {}) => ({
  name,
  description: `${name} description`,
  source: extra.source ?? 'user-dsh',
  provider: 'filesystem',
  invocation: { modelInvocable: true, userInvocable: true },
  ...(extra.path === undefined ? {} : { path: extra.path }),
  ...(extra.whenToUse === undefined ? {} : { whenToUse: extra.whenToUse }),
})

function build(options = {}) {
  const store = options.store ?? createMemoryStore(options.initial)
  const skills = options.skills ?? {
    async snapshot({ cwd }) {
      if (cwd === '/project/live') return { skills: [skill('session-skill', { source: 'project-dsh' })], complete: true }
      return {
        skills: cwd === '/project'
          ? [skill('project-skill', { source: 'project-dsh' }), skill('shared')]
          : [skill('global-skill', { source: 'user-dsh' })],
        complete: true,
      }
    },
  }
  const presets = options.presets === undefined
    ? { async list() { return [{ id: 'standard' }] }, async acquireScope(id) { return { key: { key: id }, async [Symbol.asyncDispose]() {} } } }
    : options.presets
  const agents = {
    get(id) {
      return options.agent?.session.id === id ? options.agent : undefined
    },
    list() {
      return options.agent === undefined ? [] : [options.agent]
    },
  }
  const mcp = options.mcp ?? {
    listServers(ids) {
      return {
        servers: [{ name: 'github', configured: true, status: { state: 'connected' }, definition: null, tools: [], decisions: {}, effective: { state: 'enabled', scope: 'default' }, shadowed: [], definitionEnabled: true, available: true }],
        namespace: 'mcp-manager',
        capabilities: { mcp: true, settings: true, writable: true, tools: true },
        warnings: [],
      }
    },
  }
  const service = createService({
    store,
    getSkills: () => skills,
    getPresets: () => presets,
    getAgents: () => agents,
    getWorkingDirectory: () => ({ get: () => options.cwd ?? '/project' }),
    getWorkspace: (id) => workspaces.find((workspace) => workspace.id === id),
    listWorkspaces: () => workspaces,
    resolveWorkspaceId: (sessionId) => workspaces.find((workspace) => workspace.sessionIds.includes(sessionId))?.id,
    getTools: () => options.tools,
    getSettings: () => options.settings,
    mcp,
    dshHome: options.dshHome ?? '/dsh',
    logger: { warn: () => {} },
  })
  return { service, store, skills, presets, agents }
}

const agent = { session: { id: 's1' }, ctx: {} }
const withPreset = { ...agent, ctx: {} }

test('T-SV1 the global skill view reads the home cwd and decorates decisions', async () => {
  const { service } = build()
  await service.ready()
  await service.setSkillDecision({ scope: 'global', name: 'global-skill', state: 'disabled', meta: { description: 'g', source: 'user-dsh' } })
  const view = await service.skillsView({ scope: 'global' })
  assert.equal(view.scope, 'global')
  assert.equal(view.cwd, '/dsh')
  assert.equal(view.live, false)
  const row = view.skills.find((entry) => entry.name === 'global-skill')
  assert.equal(row.effective.state, 'disabled')
  assert.equal(row.effective.scope, 'global')
  assert.equal(row.decisions.global.state, 'disabled')
  assert.equal(row.decisions.global.meta.description, 'g')
  assert.deepEqual(row.shadowed, [])
})

test('T-SV2 the workspace view uses the workspace cwd and applies workspace decisions', async () => {
  const { service } = build()
  await service.ready()
  await service.setSkillDecision({ scope: 'workspace', workspaceId: 'w1', name: 'shared', state: 'disabled' })
  const view = await service.skillsView({ scope: 'workspace', workspaceId: 'w1' })
  assert.equal(view.cwd, '/project')
  assert.equal(view.workspaceId, 'w1')
  const row = view.skills.find((entry) => entry.name === 'shared')
  assert.equal(row.effective.state, 'disabled')
  assert.equal(row.effective.scope, 'workspace')
  assert.deepEqual(view.skills.map((entry) => entry.name), ['project-skill', 'shared'])
})

test('T-SV3 the session view uses the live agent cwd, preset, and workspace ids', async () => {
  const presets = {
    async list() { return [{ id: 'standard' }] },
    async acquireScope() { return { key: { key: 'standard' }, async [Symbol.asyncDispose]() {} } },
    composedPreset() { return 'standard' },
  }
  const { service } = build({ presets, agent: withPreset, cwd: '/project/live' })
  await service.ready()
  const view = await service.skillsView({ scope: 'session', sessionId: 's1' })
  assert.equal(view.cwd, '/project/live')
  assert.equal(view.presetId, 'standard')
  assert.equal(view.live, true)
  assert.equal(view.workspaceId, 'w1')
  assert.equal(view.sessionId, 's1')
  assert.deepEqual(view.skills.map((entry) => entry.name), ['session-skill'])
})

test('T-SV4 decisions stored for names outside the catalog become missing rows', async () => {
  const { service } = build()
  await service.ready()
  await service.setSkillDecision({ scope: 'global', name: 'removed-skill', state: 'disabled', meta: { description: 'gone', path: '/gone/SKILL.md' } })
  const view = await service.skillsView({ scope: 'global' })
  const row = view.skills.find((entry) => entry.name === 'removed-skill')
  assert.equal(row.missing, true)
  assert.equal(row.description, 'gone')
  assert.equal(row.path, '/gone/SKILL.md')
  assert.equal(row.effective.state, 'disabled')
})

test('T-SV5 setSkillDecision persists, notifies, and is visible to the snapshot', async () => {
  const { service } = build()
  await service.ready()
  let notified = 0
  const dispose = service.subscribe(() => { notified += 1 })
  await service.setSkillDecision({ scope: 'global', name: 'global-skill', state: 'disabled' })
  assert.equal(notified, 1)
  assert.equal(service.snapshot().skills.global.decisions['global-skill'].state, 'disabled')
  await service.setSkillDecision({ scope: 'global', name: 'global-skill', state: 'inherit' })
  assert.equal(service.snapshot().skills.global.decisions['global-skill'], undefined)
  dispose()
  await service.setSkillDecision({ scope: 'global', name: 'global-skill', state: 'disabled' })
  assert.equal(notified, 2)
})

test('T-SV6 a corrupt store starts empty and surfaces a warning', async () => {
  const store = {
    async read() {
      const error = new Error('bad json')
      error.code = 'INVALID_RECORD'
      throw error
    },
    async write() {},
  }
  const { service } = build({ store })
  await service.ready()
  const view = await service.skillsView({ scope: 'global' })
  assert.ok(view.warnings.some((warning) => warning.code === 'STORE_UNREADABLE'))
  assert.deepEqual(service.snapshot(), emptySnapshot())
})

test('T-SV7 the MCP view forwards the resolved workspace and session ids', async () => {
  let seen
  const mcp = {
    listServers(ids) {
      seen = ids
      return { servers: [], namespace: 'mcp-manager', capabilities: {}, warnings: [] }
    },
  }
  const { service } = build({ mcp })
  await service.ready()
  const view = await service.mcpView({ scope: 'session', sessionId: 's1' })
  assert.deepEqual(seen, { sessionId: 's1', workspaceId: 'w1' })
  assert.equal(view.scope, 'session')
  assert.equal(view.workspaceId, 'w1')
  assert.equal(view.sessionId, 's1')
})

test('T-SV8 overview reports workspaces, presets, and capabilities', async () => {
  const { service } = build({ tools: {}, settings: {} })
  await service.ready()
  const view = await service.overview()
  assert.deepEqual(view.workspaces.map((workspace) => workspace.id), ['w1', 'w2'])
  assert.deepEqual(view.presets, [{ id: 'standard' }])
  assert.deepEqual(view.capabilities, { skills: true, presets: true, mcp: true, tools: true, settings: true })
})

test('T-SV9 invalid scopes and missing ids are rejected', async () => {
  const { service } = build()
  await service.ready()
  await assert.rejects(() => service.skillsView({ scope: 'nope' }), (error) => error.code === 'INVALID_SCOPE')
  await assert.rejects(() => service.skillsView({ scope: 'workspace' }), (error) => error.code === 'INVALID_SCOPE')
  await assert.rejects(() => service.skillsView({ scope: 'workspace', workspaceId: 'missing' }), (error) => error.code === 'NOT_FOUND')
  await assert.rejects(() => service.skillsView({ scope: 'session' }), (error) => error.code === 'INVALID_SCOPE')
  await assert.rejects(() => service.setSkillDecision({ scope: 'workspace', name: 'shared', state: 'disabled' }), (error) => error.code === 'INVALID_SCOPE')
})

test('T-SV10 a session without a live agent still reads its workspace', async () => {
  const { service } = build()
  await service.ready()
  const view = await service.skillsView({ scope: 'session', sessionId: 's2' })
  assert.equal(view.live, false)
  assert.equal(view.workspaceId, 'w1')
  assert.equal(view.cwd, '/project')
  assert.equal(view.presetId, undefined)
})

test('T-SV11 concurrent decision writes serialize without losing updates', async () => {
  const { service } = build()
  await service.ready()
  await Promise.all([
    service.setSkillDecision({ scope: 'global', name: 'global-skill', state: 'disabled' }),
    service.setSkillDecision({ scope: 'global', name: 'project-skill', state: 'disabled' }),
  ])
  const decisions = service.snapshot().skills.global.decisions
  assert.equal(decisions['global-skill'].state, 'disabled')
  assert.equal(decisions['project-skill'].state, 'disabled')
})

test('T-SV12 a failed write leaves the previous state in place and rejects', async () => {
  const store = {
    async read() { return emptySnapshot() },
    async write() { throw new Error('disk full') },
  }
  const { service } = build({ store })
  await service.ready()
  await assert.rejects(() => service.setSkillDecision({ scope: 'global', name: 'global-skill', state: 'disabled' }), /disk full/)
  assert.deepEqual(service.snapshot().skills.global.decisions, {})
})
