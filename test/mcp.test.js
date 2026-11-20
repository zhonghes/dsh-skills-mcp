import test from 'node:test'
import assert from 'node:assert/strict'
import { createMcpAdapter, maskEntry } from '../src/mcp.js'
import { applyDecision, emptySnapshot, SkillsMcpError } from '../src/core.js'

function makeSettings(initial = {}) {
  const state = {
    value: structuredClone(initial.value ?? {}),
    base: structuredClone(initial.base ?? {}),
    user: structuredClone(initial.user ?? {}),
    revision: initial.revision ?? 1,
    ns: initial.ns ?? 'mcp-manager',
    failOnce: initial.failOnce ?? false,
  }
  const calls = []
  const settings = {
    state,
    calls,
    describe() {
      return [{
        ns: state.ns,
        schema: { properties: { servers: {} } },
        value: { servers: structuredClone(state.value) },
        base: { servers: structuredClone(state.base) },
        user: { servers: structuredClone(state.user) },
        revision: state.revision,
        autoGenerate: false,
        applies: 'live',
        secrets: [],
      }]
    },
    async mutate(ns, ops, revision) {
      calls.push({ ns, ops: structuredClone(ops), revision })
      if (state.failOnce) {
        state.failOnce = false
        throw new Error('settings namespace changed since it was read')
      }
      for (const op of ops) {
        const target = state.user
        if (op.path[0] !== 'servers' || op.path.length < 2) continue
        const name = op.path[1]
        if (op.op === 'unset') {
          delete target[name]
        } else if (op.path.length === 2) {
          target[name] = structuredClone(op.value)
        } else {
          target[name] = { ...(target[name] ?? state.base[name] ?? {}), [op.path[2]]: op.value }
        }
      }
      state.value = { ...structuredClone(state.base), ...structuredClone(state.user) }
      state.revision += 1
    },
  }
  return settings
}

function makeManager(servers = [], options = {}) {
  return {
    list() {
      return servers
    },
    async probe(name) {
      if (options.probeError !== undefined) throw options.probeError
      return { server: name, tools: ['one'] }
    },
    async restart(name) {
      if (options.restartError !== undefined) throw options.restartError
      servers.push({ ...servers[0], name })
      return undefined
    },
  }
}

function makeTools(definitions = []) {
  return { definitions: () => definitions }
}

function build(options = {}) {
  const state = { snapshot: options.snapshot ?? emptySnapshot() }
  const settings = options.settings === null ? undefined : makeSettings(options.settings)
  const manager = options.manager === null ? undefined : makeManager(options.servers ?? [], options.managerOptions)
  const tools = options.tools === null ? undefined : makeTools(options.definitions ?? [])
  const adapter = createMcpAdapter({
    getManager: () => manager,
    getSettings: () => settings,
    getTools: () => tools,
    getSnapshot: () => state.snapshot,
    config: options.config,
  })
  return { adapter, state, settings, manager, tools }
}

const ids = { workspaceId: 'w1', sessionId: 's1' }

test('T-M1 a listed server masks environment and header values', () => {
  const { adapter } = build({
    settings: {
      value: {
        github: { transport: 'stdio', command: 'npx', args: ['-y', 'server'], env: { GITHUB_TOKEN: 'raw-secret-value', LOG: 'debug' }, headers: {} },
      },
    },
    servers: [{ name: 'github', configured: true, status: { state: 'connected', toolCount: 1, connectedAt: 1 } }],
    definitions: [{ name: 'mcp__github__create_issue', description: 'Create an issue' }, { name: 'mcp__web__search' }],
    snapshot: emptySnapshot(),
  })
  const view = adapter.listServers(ids)
  const server = view.servers.find((row) => row.name === 'github')
  assert.deepEqual(server.definition.envKeys, ['GITHUB_TOKEN', 'LOG'])
  assert.deepEqual(server.definition.headerKeys, [])
  assert.equal(server.definition.command, 'npx')
  assert.deepEqual(server.tools.map((tool) => tool.name), ['mcp__github__create_issue'])
  assert.equal(server.origin, 'definition')
  assert.equal(server.definedIn, 'resolved')
  assert.equal(server.available, true)
  const serialized = JSON.stringify(view)
  assert.equal(serialized.includes('raw-secret-value'), false)
  assert.equal(serialized.includes('debug'), false)
})

test('T-M2 decisions and definition state both gate availability', () => {
  let snapshot = applyDecision(emptySnapshot(), { domain: 'mcp', ...ids, scope: 'global', name: 'github', state: 'disabled' })
  const { adapter, state } = build({
    settings: { value: { github: { transport: 'stdio', command: 'npx', enabled: true } } },
    servers: [{ name: 'github', configured: true, status: { state: 'connected', toolCount: 0, connectedAt: 1 } }],
    snapshot,
  })
  let server = adapter.listServers(ids).servers[0]
  assert.equal(server.effective.state, 'disabled')
  assert.equal(server.available, false)

  state.snapshot = applyDecision(snapshot, { domain: 'mcp', ...ids, scope: 'session', name: 'github', state: 'enabled' })
  server = adapter.listServers(ids).servers[0]
  assert.equal(server.effective.state, 'enabled')
  assert.equal(server.effective.scope, 'session')
  assert.equal(server.available, true)
  assert.equal(server.shadowed[0].scope, 'global')

  state.snapshot = applyDecision(state.snapshot, { domain: 'mcp', ...ids, scope: 'global', name: 'github', state: 'enabled' })
  const disabled = build({
    settings: { value: { github: { transport: 'stdio', command: 'npx', enabled: false } } },
    servers: [{ name: 'github', configured: true, status: { state: 'disabled' } }],
    snapshot: state.snapshot,
  }).adapter.listServers(ids).servers[0]
  assert.equal(disabled.definitionEnabled, false)
  assert.equal(disabled.available, false)
})

test('T-M3 add writes a complete entry and validates the name', async () => {
  const { adapter, settings } = build({ settings: {}, servers: [] })
  await adapter.add({
    name: 'github',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { set: { GITHUB_TOKEN: '${credential:GITHUB_TOKEN}' }, remove: [] },
  })
  assert.equal(settings.calls.length, 1)
  const op = settings.calls[0].ops[0]
  assert.equal(op.op, 'set')
  assert.deepEqual(op.path, ['servers', 'github'])
  assert.equal(op.value.transport, 'stdio')
  assert.equal(op.value.command, 'npx')
  assert.deepEqual(op.value.args, ['-y', '@modelcontextprotocol/server-github'])
  assert.deepEqual(op.value.env, { GITHUB_TOKEN: '${credential:GITHUB_TOKEN}' })
  assert.equal(op.value.enabled, true)
  assert.equal(settings.calls[0].revision, 1)

  await assert.rejects(() => adapter.add({ name: 'bad name', transport: 'stdio', command: 'x' }), (error) => error.code === 'INVALID_NAME')
})

test('T-M4 a name registered by a plugin cannot be added', async () => {
  const { adapter } = build({
    settings: {},
    servers: [{ name: 'github', configured: false, status: { state: 'connected', toolCount: 0, connectedAt: 1 } }],
  })
  await assert.rejects(() => adapter.add({ name: 'github', transport: 'stdio', command: 'npx' }), (error) => error.code === 'MCP_DUPLICATE')
})

test('T-M5 update preserves untouched env values and removes explicit ones', async () => {
  const { adapter, settings } = build({
    settings: {
      value: {
        github: {
          transport: 'stdio', command: 'npx', args: [], cwd: '', url: '', headers: {},
          env: { TOKEN: 'keep-this-secret', REMOVE_ME: 'bye' }, enabled: true, startupTimeoutMs: 30000,
        },
      },
    },
    servers: [{ name: 'github', configured: true, status: { state: 'connected', toolCount: 0, connectedAt: 1 } }],
  })
  await adapter.update({
    name: 'github', transport: 'stdio', command: 'npx',
    args: ['-y'], env: { set: { NEW_ONE: 'new-value' }, remove: ['REMOVE_ME'] },
  })
  const entry = settings.calls[0].ops[0].value
  assert.deepEqual(entry.env, { TOKEN: 'keep-this-secret', NEW_ONE: 'new-value' })
  assert.deepEqual(entry.args, ['-y'])
  assert.equal(entry.enabled, true)
  const view = JSON.stringify(adapter.listServers(ids))
  assert.equal(view.includes('keep-this-secret'), false)
  assert.equal(view.includes('new-value'), false)
})

test('T-M6 remove, reset, and definition toggles follow the user/base split', async () => {
  const userOnly = build({ settings: { user: { github: { transport: 'stdio', command: 'npx' } } } })
  await userOnly.adapter.remove('github')
  assert.deepEqual(userOnly.settings.calls[0].ops[0], { op: 'unset', path: ['servers', 'github'] })

  const inherited = build({ settings: { base: { github: { transport: 'stdio', command: 'npx' } } } })
  await assert.rejects(() => inherited.adapter.remove('github'), (error) => error.code === 'MCP_INHERITED')
  await inherited.adapter.reset('github')
  assert.deepEqual(inherited.settings.calls[0].ops[0], { op: 'unset', path: ['servers', 'github'] })

  const toggle = build({ settings: { value: { github: { transport: 'stdio', command: 'npx', enabled: true } } } })
  await toggle.adapter.setEnabled('github', false)
  assert.deepEqual(toggle.settings.calls[0].ops[0], { op: 'set', path: ['servers', 'github', 'enabled'], value: false })
})

test('T-M7 invalid entries are refused before a write', async () => {
  const { adapter, settings } = build({ settings: {} })
  const cases = [
    { payload: { name: 'github', transport: 'stdio' }, code: 'VALIDATION' },
    { payload: { name: 'github', transport: 'streamable-http', command: 'npx' }, code: 'VALIDATION' },
    { payload: { name: 'github', transport: 'streamable-http', url: 'ftp://example.com' }, code: 'VALIDATION' },
    { payload: { name: 'github', transport: 'stdio', command: 'npx', args: 'nope' }, code: 'VALIDATION' },
    { payload: { name: 'github', transport: 'stdio', command: 'npx', startupTimeoutMs: 0 }, code: 'VALIDATION' },
    { payload: { name: 'github', transport: 'stdio', command: 'npx', env: { set: { ['__proto__']: 'x' } } }, code: 'VALIDATION' },
  ]
  for (const { payload, code } of cases) {
    await assert.rejects(() => adapter.add(payload), (error) => error instanceof SkillsMcpError && error.code === code, JSON.stringify(payload))
  }
  assert.equal(settings.calls.length, 0)
})

test('T-M8 missing settings still lists servers but refuses edits', async () => {
  const { adapter } = build({
    settings: null,
    servers: [{ name: 'github', configured: false, status: { state: 'connected', toolCount: 0, connectedAt: 1 } }],
  })
  const view = adapter.listServers(ids)
  assert.equal(view.capabilities.settings, false)
  assert.equal(view.capabilities.writable, false)
  assert.ok(view.warnings.some((warning) => warning.code === 'SETTINGS_UNAVAILABLE'))
  await assert.rejects(() => adapter.add({ name: 'x', transport: 'stdio', command: 'x' }), (error) => error.code === 'UNAVAILABLE')
})

test('T-M9 a missing manager lists definitions as missing rows', () => {
  const { adapter } = build({
    manager: null,
    settings: { value: { github: { transport: 'stdio', command: 'npx' } } },
  })
  const view = adapter.listServers(ids)
  assert.equal(view.capabilities.mcp, false)
  assert.ok(view.warnings.some((warning) => warning.code === 'MCP_UNAVAILABLE'))
  assert.equal(view.servers[0].name, 'github')
  assert.equal(view.servers[0].status.state, 'missing')
  assert.equal(view.servers[0].available, false)
})

test('T-M10 probe and restart report manager failures with stable codes', async () => {
  const { adapter } = build({
    servers: [{ name: 'github', configured: true, status: { state: 'connected', toolCount: 0, connectedAt: 1 } }],
    managerOptions: { probeError: new Error('boom'), restartError: new Error('nope') },
  })
  await assert.rejects(() => adapter.probe('github'), (error) => error.code === 'MCP_PROBE_FAILED')
  await assert.rejects(() => adapter.restart('github'), (error) => error.code === 'MCP_RESTART_FAILED')
  await assert.rejects(() => adapter.probe('bad name'), (error) => error.code === 'INVALID_NAME')
})

test('T-M11 the namespace is discovered by name before schema shape', () => {
  const { adapter, settings } = build({ settings: {} })
  settings.describe = () => [
    { ns: 'other', schema: { properties: { servers: {} } }, value: { servers: {} }, base: {}, user: {}, revision: 1 },
    { ns: 'mcp-manager', schema: { properties: { servers: {} } }, value: { servers: {} }, base: {}, user: {}, revision: 2 },
  ]
  assert.equal(adapter.listServers(ids).namespace, 'mcp-manager')

  settings.describe = () => [
    { ns: 'renamed-mcp', schema: { properties: { servers: {} } }, value: { servers: {} }, base: {}, user: {}, revision: 3 },
  ]
  assert.equal(adapter.listServers(ids).namespace, 'renamed-mcp')
})

test('T-M12 status-only rows carry a tool count and no definitions', () => {
  const { adapter } = build({
    settings: null,
    servers: [{ name: 'github', configured: true, status: { state: 'connected', toolCount: 1, connectedAt: 1 } }],
    definitions: [{ name: 'mcp__github__a' }, { name: 'mcp__github__b' }, { name: 'mcp__web__c' }],
  })
  const view = adapter.statusOnly()
  assert.deepEqual(view.servers, [{
    name: 'github',
    configured: true,
    status: { state: 'connected', toolCount: 1, connectedAt: 1 },
    toolCount: 2,
  }])
})

test('T-M13 a revision conflict retries once against a fresh descriptor', async () => {
  const { adapter, settings } = build({ settings: { failOnce: true } })
  await adapter.add({ name: 'github', transport: 'stdio', command: 'npx' })
  assert.equal(settings.calls.length, 2)
  assert.equal(settings.calls[0].revision, 1)
  assert.equal(settings.calls[1].revision, 1)
})

test('T-M14 stored decisions without a definition become stored rows', () => {
  const snapshot = applyDecision(emptySnapshot(), { domain: 'mcp', ...ids, scope: 'global', name: 'ghost', state: 'disabled' })
  const { adapter } = build({ settings: {}, servers: [], snapshot })
  const server = adapter.listServers(ids).servers[0]
  assert.equal(server.name, 'ghost')
  assert.equal(server.origin, 'stored')
  assert.equal(server.status.state, 'removed')
  assert.equal(server.effective.state, 'disabled')
})

test('T-M15 maskEntry never exposes secret map values', () => {
  const masked = maskEntry({
    transport: 'streamable-http', url: 'https://example.com/mcp', headers: { Authorization: 'Bearer abc' },
    env: { TOKEN: 'def' }, args: [], command: '', cwd: '', enabled: true,
  })
  assert.deepEqual(masked.headerKeys, ['Authorization'])
  assert.deepEqual(masked.envKeys, ['TOKEN'])
  assert.equal(JSON.stringify(masked).includes('Bearer abc'), false)
  assert.equal(JSON.stringify(masked).includes('def'), false)
})
