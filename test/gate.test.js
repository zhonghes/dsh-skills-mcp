import test from 'node:test'
import assert from 'node:assert/strict'
import { createGate } from '../src/gate.js'
import { applyDecision, emptySnapshot } from '../src/core.js'

const ids = { workspaceId: 'w1', sessionId: 's1' }

function decide(snapshot, domain, scope, name, state, idsOverride = ids, meta) {
  return applyDecision(snapshot, {
    domain,
    scope,
    ...idsOverride,
    name,
    state,
    ...(meta === undefined ? {} : { meta }),
  })
}

function makeAgent(id = 's1') {
  const calls = { skills: [], restrictions: [], sections: [], failNextRestrict: false }
  const skills = {
    register(definition) {
      const entry = { definition, disposed: false }
      calls.skills.push(entry)
      return () => {
        entry.disposed = true
      }
    },
  }
  const tools = {
    restrict(filter) {
      if (calls.failNextRestrict) {
        calls.failNextRestrict = false
        throw new Error('unknown tool')
      }
      const entry = { filter, disposed: false }
      calls.restrictions.push(entry)
      return () => {
        entry.disposed = true
      }
    },
  }
  const systemPrompt = {
    getSectionOrder(name) {
      assert.equal(name, 'MCP_SERVERS')
      return 700
    },
    section(definition) {
      const entry = { definition, disposed: false }
      calls.sections.push(entry)
      return () => {
        entry.disposed = true
      }
    },
  }
  const ctx = {
    inject(services, callback) {
      const scope = {}
      for (const service of services) {
        if (service === 'skills') scope.skills = skills
        if (service === 'tools') scope.tools = tools
        if (service === 'systemPrompt') scope.systemPrompt = systemPrompt
      }
      callback(scope)
      return { dispose: async () => {} }
    },
  }
  return { session: { id }, ctx, calls }
}

function build(options = {}) {
  const state = { snapshot: options.snapshot ?? emptySnapshot() }
  let definitions = options.definitions ?? []
  const subs = options.subagents
  const gate = createGate({
    getState: () => state.snapshot,
    getSkills: () => undefined,
    getTools: () => ({ definitions: () => definitions }),
    getSystemPrompt: () => undefined,
    getSubagents: () => subs,
    getAgents: () => ({
      list: () => options.agents ?? [],
      get: (id) => (options.agents ?? []).find((agent) => agent.session.id === id),
    }),
    resolveWorkspaceId: options.resolveWorkspaceId ?? (() => 'w1'),
    logger: { warn: () => {} },
  })
  return {
    gate,
    state,
    setDefinitions(next) {
      definitions = next
    },
    makeAgent,
  }
}

test('T-G1 a disabled skill registers a hidden stub and enabling disposes it', () => {
  let snapshot = decide(emptySnapshot(), 'skills', 'global', 'dsh-doc', 'disabled', ids, { description: 'docs', path: '/skills/dsh-doc/SKILL.md', source: 'user-dsh' })
  const { gate, state, makeAgent } = build({ snapshot })
  const agent = makeAgent('s1')
  gate.attach(agent)
  assert.equal(agent.calls.skills.length, 1)
  const installed = agent.calls.skills[0]
  assert.equal(installed.definition.name, 'dsh-doc')
  assert.equal(installed.definition.description, 'docs')
  assert.equal(installed.definition.path, '/skills/dsh-doc/SKILL.md')
  assert.deepEqual(installed.definition.invocation, { modelInvocable: false, userInvocable: false })
  assert.equal(installed.disposed, false)

  state.snapshot = decide(snapshot, 'skills', 'global', 'dsh-doc', 'enabled', ids)
  gate.refreshAll()
  assert.equal(installed.disposed, true)
  assert.equal(agent.calls.skills.length, 1)
})

test('T-G2 a nearer enabled decision leaves a wider disabled skill usable', () => {
  let snapshot = decide(emptySnapshot(), 'skills', 'global', 'dsh-doc', 'disabled', ids)
  snapshot = decide(snapshot, 'skills', 'session', 'dsh-doc', 'enabled', ids)
  const { gate, makeAgent } = build({ snapshot })
  const agent = makeAgent('s1')
  gate.attach(agent)
  assert.equal(agent.calls.skills.length, 0)
})

test('T-G3 a nearer disabled decision hides a wider enabled skill', () => {
  let snapshot = decide(emptySnapshot(), 'skills', 'global', 'dsh-doc', 'enabled', ids)
  snapshot = decide(snapshot, 'skills', 'session', 'dsh-doc', 'disabled', ids)
  const { gate, makeAgent } = build({ snapshot })
  const agent = makeAgent('s1')
  gate.attach(agent)
  assert.equal(agent.calls.skills.length, 1)
  assert.deepEqual(agent.calls.skills[0].definition.invocation, { modelInvocable: false, userInvocable: false })
})

test('T-G4 a disabled MCP server restricts only its own tool names', () => {
  let snapshot = decide(emptySnapshot(), 'mcp', 'global', 'github', 'disabled')
  const { gate, state, makeAgent } = build({
    snapshot,
    definitions: [
      { name: 'mcp__github__create_issue' },
      { name: 'mcp__github__search' },
      { name: 'mcp__web__search' },
      { name: 'read_file' },
    ],
  })
  const agent = makeAgent('s1')
  gate.attach(agent)
  assert.equal(agent.calls.restrictions.length, 1)
  assert.deepEqual(agent.calls.restrictions[0].filter.deny, ['mcp__github__create_issue', 'mcp__github__search'])

  gate.refreshAll()
  assert.equal(agent.calls.restrictions.length, 1, 'an unchanged set must not churn the registry')

  state.snapshot = decide(snapshot, 'mcp', 'global', 'github', 'enabled')
  gate.refreshAll()
  assert.equal(agent.calls.restrictions[0].disposed, true)
})

test('T-G5 tools appearing after attach are denied on the next refresh', () => {
  const snapshot = decide(emptySnapshot(), 'mcp', 'session', 'github', 'disabled')
  const { gate, setDefinitions, makeAgent } = build({ snapshot, definitions: [] })
  const agent = makeAgent('s1')
  gate.attach(agent)
  assert.equal(agent.calls.restrictions.length, 0)

  setDefinitions([{ name: 'mcp__github__one' }])
  gate.refreshAll()
  assert.equal(agent.calls.restrictions.length, 1)
  assert.deepEqual(agent.calls.restrictions[0].filter.deny, ['mcp__github__one'])

  setDefinitions([{ name: 'mcp__github__one' }, { name: 'mcp__github__two' }])
  gate.refreshAll()
  assert.equal(agent.calls.restrictions.length, 2)
  assert.deepEqual(agent.calls.restrictions[1].filter.deny, ['mcp__github__one', 'mcp__github__two'])
  assert.equal(agent.calls.restrictions[0].disposed, true)
})

test('T-G6 a disabled MCP server shadows its instruction section and releases it on enable', () => {
  let snapshot = decide(emptySnapshot(), 'mcp', 'global', 'github', 'disabled')
  const { gate, state, makeAgent } = build({ snapshot })
  const agent = makeAgent('s1')
  gate.attach(agent)
  assert.equal(agent.calls.sections.length, 1)
  assert.equal(agent.calls.sections[0].definition.name, 'mcp:github')
  assert.equal(agent.calls.sections[0].definition.order, 700)
  assert.equal(agent.calls.sections[0].definition.text(), '')
  assert.equal(agent.calls.sections[0].disposed, false)

  state.snapshot = decide(snapshot, 'mcp', 'global', 'github', 'enabled')
  gate.refreshAll()
  assert.equal(agent.calls.sections[0].disposed, true)
})

test('T-G7 the pre-execute guard denies disabled servers and leaves enabled ones alone', async () => {
  const snapshot = decide(emptySnapshot(), 'mcp', 'global', 'github', 'disabled')
  const { gate, makeAgent } = build({ snapshot, definitions: [{ name: 'mcp__github__x' }, { name: 'mcp__web__x' }] })
  const agent = makeAgent('s1')
  gate.attach(agent)

  assert.deepEqual(await gate.guard({ name: 'read_mcp_resource', args: { server: 'github' }, agent }), {
    kind: 'deny',
    reason: 'MCP server "github" is disabled for this scope',
  })
  assert.equal(await gate.guard({ name: 'read_mcp_resource', args: { server: 'web' }, agent }), false)
  assert.equal(await gate.guard({ name: 'mcp__github__x', args: {}, agent }).then((value) => value?.kind), 'deny')
  assert.equal(await gate.guard({ name: 'mcp__web__x', args: {}, agent }), false)
  assert.equal(await gate.guard({ name: 'bash', args: { command: 'ls' }, agent }), false)
  assert.equal(await gate.guard({ name: 'mcp__github__x', args: {} }), false, 'a call without an agent is left to the registry')
})

test('T-G8 subagents inherit the root session and workspace decisions', () => {
  const snapshot = decide(emptySnapshot(), 'mcp', 'session', 'github', 'disabled', { workspaceId: 'w1', sessionId: 'root' })
  const root = makeAgent('root')
  const child = makeAgent('child')
  child.session.header = { id: 'child', parentSession: 'root' }
  const { gate } = build({
    snapshot,
    definitions: [{ name: 'mcp__github__x' }],
    agents: [root, child],
    subagents: { rootOf: (agent) => (agent === child ? root : agent) },
  })
  gate.attach(root)
  gate.attach(child)
  assert.equal(root.calls.restrictions.length, 1)
  assert.equal(child.calls.restrictions.length, 1)
  assert.deepEqual(child.calls.restrictions[0].filter.deny, ['mcp__github__x'])
})

test('T-G9 detach and dispose release every contribution', () => {
  const snapshot = decide(emptySnapshot(), 'mcp', 'global', 'github', 'disabled')
  const withSkill = decide(snapshot, 'skills', 'global', 'dsh-doc', 'disabled')
  const { gate, makeAgent } = build({ snapshot: withSkill, definitions: [{ name: 'mcp__github__x' }] })
  const agent = makeAgent('s1')
  gate.attach(agent)
  assert.equal(agent.calls.skills[0].disposed, false)
  assert.equal(agent.calls.restrictions[0].disposed, false)
  assert.equal(agent.calls.sections[0].disposed, false)

  gate.detach('s1')
  assert.equal(agent.calls.skills[0].disposed, true)
  assert.equal(agent.calls.restrictions[0].disposed, true)
  assert.equal(agent.calls.sections[0].disposed, true)

  const second = makeAgent('s2')
  gate.attach(second)
  gate.dispose()
  assert.equal(second.calls.skills[0].disposed, true)
})

test('T-G10 an agent without skill, tool, or prompt services is left alone', () => {
  const snapshot = decide(emptySnapshot(), 'mcp', 'global', 'github', 'disabled')
  const { gate } = build({ snapshot })
  const agent = { session: { id: 's1' }, ctx: {} }
  assert.doesNotThrow(() => gate.attach(agent))
  assert.doesNotThrow(() => gate.refreshAll())
  assert.doesNotThrow(() => gate.detach('s1'))
})

test('T-G11 a restriction whose name vanished retries on the next refresh', () => {
  const snapshot = decide(emptySnapshot(), 'mcp', 'global', 'github', 'disabled')
  const { gate, setDefinitions, makeAgent } = build({ snapshot, definitions: [] })
  const agent = makeAgent('s1')
  gate.attach(agent)
  assert.equal(agent.calls.restrictions.length, 0)

  setDefinitions([{ name: 'mcp__github__x' }])
  agent.calls.failNextRestrict = true
  gate.refreshAll()
  assert.equal(agent.calls.restrictions.length, 0)
  gate.refreshAll()
  assert.equal(agent.calls.restrictions.length, 1)
  assert.deepEqual(agent.calls.restrictions[0].filter.deny, ['mcp__github__x'])
})

test('T-G12 a scheduled refresh coalesces into one application', async () => {
  const snapshot = decide(emptySnapshot(), 'mcp', 'global', 'github', 'disabled')
  const { gate, makeAgent } = build({ snapshot, definitions: [{ name: 'mcp__github__x' }] })
  const agent = makeAgent('s1')
  gate.attach(agent)
  assert.equal(agent.calls.restrictions.length, 1)
  gate.scheduleRefresh()
  gate.scheduleRefresh()
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(agent.calls.restrictions.length, 1)
})

test('T-G13 changed skill metadata replaces the stub', () => {
  let snapshot = decide(emptySnapshot(), 'skills', 'global', 'dsh-doc', 'disabled', ids, { description: 'old' })
  const { gate, state, makeAgent } = build({ snapshot })
  const agent = makeAgent('s1')
  gate.attach(agent)
  assert.equal(agent.calls.skills.length, 1)

  state.snapshot = decide(snapshot, 'skills', 'global', 'dsh-doc', 'disabled', ids, { description: 'new' })
  gate.refreshAll()
  assert.equal(agent.calls.skills.length, 2)
  assert.equal(agent.calls.skills[0].disposed, true)
  assert.equal(agent.calls.skills[1].definition.description, 'new')
})
