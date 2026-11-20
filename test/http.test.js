import test from 'node:test'
import assert from 'node:assert/strict'
import { createHttpHandler, ROUTE_PATH } from '../src/http.js'
import { SkillsMcpError } from '../src/core.js'

function build() {
  const calls = { skills: [], mcp: [], adds: [], updates: [], removes: [], resets: [], enabled: [], probes: [], restarts: [] }
  const service = {
    async overview() {
      return { workspaces: [], presets: [], capabilities: { skills: true }, warnings: [] }
    },
    async skillsView(request) {
      calls.skills.push(request)
      return { scope: request.scope, cwd: '/w', skills: [], complete: true, warnings: [] }
    },
    async mcpView(request) {
      return { scope: request.scope, servers: [], capabilities: {}, warnings: [] }
    },
    async mcpStatus() {
      return { servers: [], warnings: [] }
    },
    async setSkillDecision(request) {
      calls.skills.push(request)
    },
    async setMcpDecision(request) {
      calls.mcp.push(request)
    },
    mcp: {
      async add(payload) {
        calls.adds.push(payload)
      },
      async update(payload) {
        calls.updates.push(payload)
      },
      async remove(name) {
        calls.removes.push(name)
      },
      async reset(name) {
        calls.resets.push(name)
      },
      async setEnabled(name, enabled) {
        calls.enabled.push({ name, enabled })
      },
      async probe(name) {
        calls.probes.push(name)
        return { server: name, tools: ['one'] }
      },
      async restart(name) {
        calls.restarts.push(name)
      },
    },
  }
  return { handler: createHttpHandler(service), calls }
}

const get = (query) => new Request(`http://localhost${ROUTE_PATH}?${query}`)
const post = (body) => new Request(`http://localhost${ROUTE_PATH}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
})

test('T-H1 GET overview and the two view operations succeed', async () => {
  const { handler } = build()
  const overview = await (await handler(get('op=overview'))).json()
  assert.equal(overview.ok, true)
  assert.equal(overview.data.capabilities.skills, true)

  const skills = await (await handler(get('op=skills&scope=workspace&workspaceId=w1'))).json()
  assert.equal(skills.data.scope, 'workspace')

  const mcp = await (await handler(get('op=mcp&scope=session&sessionId=s1'))).json()
  assert.equal(mcp.data.scope, 'session')

  const status = await (await handler(get('op=mcpStatus'))).json()
  assert.deepEqual(status.data.servers, [])
})

test('T-H2 unknown and malformed operations are refused', async () => {
  const { handler } = build()
  const unknown = await handler(get('op=nope'))
  assert.equal(unknown.status, 400)
  assert.equal((await unknown.json()).error, 'UNKNOWN_OP')

  const badScope = await handler(get('op=skills&scope=everywhere'))
  assert.equal(badScope.status, 422)
  assert.equal((await badScope.json()).error, 'INVALID_SCOPE')

  const method = await handler(new Request(`http://localhost${ROUTE_PATH}`, { method: 'DELETE' }))
  assert.equal(method.status, 405)
})

test('T-H3 a skill decision is validated and forwarded with its metadata', async () => {
  const { handler, calls } = build()
  const response = await handler(post({
    op: 'setSkillDecision', scope: 'global', name: 'dsh-doc', state: 'disabled',
    meta: { description: 'docs', path: '/skills/dsh-doc/SKILL.md', source: 'user-dsh' },
  }))
  assert.equal(response.status, 200)
  assert.equal(calls.skills[0].name, 'dsh-doc')
  assert.equal(calls.skills[0].state, 'disabled')
  assert.equal(calls.skills[0].meta.description, 'docs')

  const inherit = await handler(post({ op: 'setSkillDecision', scope: 'global', name: 'dsh-doc', state: 'inherit' }))
  assert.equal(inherit.status, 200)
  assert.equal(calls.skills[1].state, 'inherit')
})

test('T-H4 invalid states, names, scopes, and bodies have no side effect', async () => {
  const { handler, calls } = build()
  for (const body of [
    { op: 'setSkillDecision', scope: 'global', name: 'dsh-doc', state: 'maybe' },
    { op: 'setSkillDecision', scope: 'global', name: 'Bad Name', state: 'disabled' },
    { op: 'setSkillDecision', scope: 'workspace', name: 'dsh-doc', state: 'disabled' },
    { op: 'setMcpDecision', scope: 'global', name: 'bad name', state: 'disabled' },
  ]) {
    const response = await handler(post(body))
    assert.equal(response.status, 422, JSON.stringify(body))
  }
  assert.equal(calls.skills.length, 0)
  assert.equal(calls.mcp.length, 0)

  const notJson = await handler(post('{ nope'))
  assert.equal(notJson.status, 422)
  const array = await handler(post('[]'))
  assert.equal(array.status, 422)
})

test('T-H5 MCP definition operations are dispatched with their arguments', async () => {
  const { handler, calls } = build()
  const add = await handler(post({ op: 'addMcp', name: 'github', transport: 'stdio', command: 'npx' }))
  assert.equal(add.status, 200)
  assert.equal(calls.adds[0].command, 'npx')

  const update = await handler(post({ op: 'updateMcp', name: 'github', transport: 'stdio', command: 'npx' }))
  assert.equal(update.status, 200)
  assert.equal(calls.updates[0].name, 'github')

  await handler(post({ op: 'removeMcp', name: 'github' }))
  await handler(post({ op: 'resetMcp', name: 'github' }))
  await handler(post({ op: 'setMcpEnabled', name: 'github', enabled: false }))
  assert.equal(calls.removes[0], 'github')
  assert.equal(calls.resets[0], 'github')
  assert.deepEqual(calls.enabled[0], { name: 'github', enabled: false })

  const probe = await (await handler(post({ op: 'probeMcp', name: 'github' }))).json()
  assert.deepEqual(probe.data, { server: 'github', tools: ['one'] })
  assert.deepEqual(calls.probes, ['github'])
  await handler(post({ op: 'restartMcp', name: 'github' }))
  assert.deepEqual(calls.restarts, ['github'])
})

test('T-H6 unknown POST operations and bad booleans are refused', async () => {
  const { handler } = build()
  const unknown = await handler(post({ op: 'nope' }))
  assert.equal(unknown.status, 400)
  const badBool = await handler(post({ op: 'setMcpEnabled', name: 'github', enabled: 'yes' }))
  assert.equal(badBool.status, 422)
})

test('T-H7 stable host errors map to HTTP statuses', async () => {
  const service = {
    async mcpStatus() {
      return {}
    },
    async skillsView() {
      throw new SkillsMcpError('NOT_FOUND', 'missing')
    },
    async mcpView() {
      throw new SkillsMcpError('UNAVAILABLE', 'no manager')
    },
    async setSkillDecision() {},
    async setMcpDecision() {},
    async overview() {
      throw new Error('boom')
    },
    mcp: {
      async add() {
        throw new SkillsMcpError('VALIDATION', 'bad entry')
      },
      async update() {
        throw new SkillsMcpError('MCP_REGISTERED', 'registered')
      },
      async remove() {
        throw new SkillsMcpError('MCP_INHERITED', 'inherited')
      },
      async reset() {},
      async setEnabled() {},
      async probe() {
        throw new SkillsMcpError('MCP_PROBE_FAILED', 'probe failed')
      },
      async restart() {},
    },
  }
  const handler = createHttpHandler(service)
  assert.equal((await handler(get('op=skills&scope=global'))).status, 404)
  assert.equal((await handler(get('op=mcp&scope=global'))).status, 503)
  assert.equal((await handler(get('op=overview'))).status, 500)
  assert.equal((await handler(post({ op: 'addMcp', name: 'x', transport: 'stdio', command: 'x' }))).status, 422)
  assert.equal((await handler(post({ op: 'updateMcp', name: 'x', transport: 'stdio', command: 'x' }))).status, 409)
  assert.equal((await handler(post({ op: 'removeMcp', name: 'x' }))).status, 409)
  assert.equal((await handler(post({ op: 'probeMcp', name: 'x' }))).status, 502)
})

test('T-H8 a body over the size cap is refused before dispatch', async () => {
  const { handler, calls } = build()
  const body = JSON.stringify({ op: 'addMcp', name: 'github', transport: 'stdio', command: 'x'.repeat(300_000) })
  const response = await handler(post(body))
  assert.equal(response.status, 422)
  assert.equal(calls.adds.length, 0)
})
