import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Window } from 'happy-dom'
import React from 'react'
import * as ReactDOM from 'react-dom'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(here, '..')

// One DOM for the whole file: the client bundle captures window/document when
// it is evaluated, so every test shares the same environment.
const window = new Window({ url: 'http://127.0.0.1:3080/' })
globalThis.window = window
globalThis.document = window.document
for (const key of ['HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'KeyboardEvent', 'MutationObserver']) globalThis[key] = window[key]
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true })
Object.defineProperty(globalThis, 'getComputedStyle', { value: window.getComputedStyle.bind(window), configurable: true })
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)

const source = await readFile(join(projectRoot, 'client.js'), 'utf8')
window.__ModuleLoader__ = { load: (registration) => { globalThis.registration = registration } }
new Function('window', 'document', 'React', 'ReactDOM', source)(window, document, React, ReactDOM)
const plugin = globalThis.registration.factory((name) => (name === 'react' ? React : name === 'react-dom' ? ReactDOM : null))

const components = {}
let menu = null
plugin.apply({
  effect: (fn) => {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  locale: {
    register: () => () => {},
    bind: () => (key) => key,
  },
  slots: {
    inject: (_slot, fn) => fn(),
    register: (options, component) => {
      components[options.name + (options.id ? `#${options.id}` : '')] = { def: options, comp: component }
      return () => {}
    },
  },
  contextMenus: {
    register: (config) => {
      menu = config
      return () => {}
    },
  },
})

const wait = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))
const ok = (data) => ({ ok: true, json: async () => ({ ok: true, data: data ?? {} }) })

let requests = []
function serve(routes) {
  requests = []
  globalThis.fetch = async (url, init) => {
    const target = String(url)
    const body = init?.method === 'POST' ? JSON.parse(init.body) : null
    requests.push({ target, body })
    return ok(await routes(new URL(target, 'http://127.0.0.1:3080'), body))
  }
}

function lastPost(op) {
  return [...requests].reverse().find((request) => request.body?.op === op)?.body
}

function skill(name, overrides = {}) {
  return {
    name,
    description: `${name} description`,
    source: 'user-dsh',
    provider: 'filesystem',
    invocation: { modelInvocable: true, userInvocable: true },
    presets: ['standard'],
    decisions: {},
    effective: { state: 'enabled', scope: 'default' },
    shadowed: [],
    missing: false,
    ...overrides,
  }
}

function server(name, overrides = {}) {
  return {
    name,
    configured: true,
    origin: 'definition',
    status: { state: 'connected' },
    definition: {
      transport: 'stdio', command: 'npx', args: ['-y'], url: '', cwd: '', enabled: true,
      envKeys: ['TOKEN'], headerKeys: [],
    },
    definedIn: 'user',
    hasBase: false,
    userDefined: true,
    tools: [{ name: `mcp__${name}__run` }],
    decisions: {},
    effective: { state: 'enabled', scope: 'default' },
    shadowed: [],
    definitionEnabled: true,
    available: true,
    ...overrides,
  }
}

function skillsView(scope, skills) {
  return { scope, cwd: '/w', live: scope === 'session', complete: true, skills, warnings: [] }
}

function mcpView(scope, servers, capabilities = { mcp: true, settings: true, writable: true, tools: true }) {
  return { scope, namespace: 'mcp-manager', capabilities, servers, warnings: [] }
}

async function mount(component, props) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  root.render(React.createElement(component, props))
  return {
    container,
    async cleanup() {
      const dialog = document.body.querySelector('div[role="dialog"]')
      if (dialog !== null) {
        const close = [...dialog.querySelectorAll('button')].find((button) => button.textContent === '✕')
        close?.click()
        await wait(60)
      }
      root.unmount()
      container.remove()
      await wait(30)
    },
  }
}

function setInput(input, value) {
  input.value = value
  Simulate.change(input)
}

function rowOf(container, name) {
  return container.querySelector(`[data-skill-row="${name}"], [data-mcp-row="${name}"]`)
}

function buttonOf(container, text) {
  return [...container.querySelectorAll('button')].find((button) => button.textContent === text)
}

test('T-UI1 the global skills panel groups rows and writes a global decision', async (t) => {
  serve(async (url) => {
    const op = url.searchParams.get('op')
    if (op === 'overview') return { workspaces: [], presets: [], capabilities: {}, warnings: [] }
    if (op === 'skills') return skillsView('global', [skill('dsh-doc'), skill('office', { source: 'bundled', effective: { state: 'disabled', scope: 'global' }, decisions: { global: { state: 'disabled' } } })])
    if (op === 'mcp') return mcpView('global', [])
    if (op === 'mcpStatus') return { servers: [], warnings: [] }
    return null
  })
  const mounted = await mount(components.main.comp, { t: (key) => key })
  t.after(mounted.cleanup)
  await wait(400)

  const beta = mounted.container.querySelector('[data-skill-row="dsh-doc"]')
  assert.ok(beta, 'skill row rendered')
  const info = mounted.container.querySelector('button[aria-label="hint.info"]')
  assert.ok(info, 'scope info button rendered')
  assert.equal(mounted.container.textContent.includes('notice.global.skills'), false, 'the long notice is not always-on text')
  Simulate.click(info)
  await wait(50)
  assert.ok(mounted.container.textContent.includes('notice.global.skills'), 'the info button opens the notice')
  Simulate.click(info)
  assert.ok(mounted.container.textContent.includes('group.user'))
  assert.ok(mounted.container.textContent.includes('group.bundled'))
  assert.equal(beta.textContent.includes('state.overridden'), false, 'global rows do not show a wider-scope badge')
  assert.equal(beta.textContent.includes('state.inherit'), false)
  assert.equal(buttonOf(mounted.container, 'action.resetDefault'), undefined, 'rows only expose the switch')
  assert.equal(buttonOf(mounted.container, 'action.inherit'), undefined, 'rows do not render an inherit action')
  const switchButton = beta.querySelector('button[role="switch"]')
  assert.equal(switchButton.getAttribute('aria-checked'), 'true')
  Simulate.click(switchButton)
  await wait(300)
  const post = lastPost('setSkillDecision')
  assert.equal(post.scope, 'global')
  assert.equal(post.name, 'dsh-doc')
  assert.equal(post.state, 'disabled')
  assert.equal(post.meta.description, 'dsh-doc description')
})

test('T-UI2 the global MCP panel shows status, tools, probes, and adds a server', async (t) => {
  serve(async (url, body) => {
    if (body?.op === 'probeMcp') return { serverInfo: { name: 'GitHub' }, tools: ['mcp__github__run'] }
    const op = url.searchParams.get('op')
    if (op === 'overview') return { workspaces: [], presets: [], capabilities: {}, warnings: [] }
    if (op === 'skills') return skillsView('global', [])
    if (op === 'mcp') {
      return mcpView('global', [
        server('github', { hasBase: true, definedIn: 'user' }),
        server('web', { origin: 'plugin', configured: false, definition: null, definedIn: undefined, hasBase: false, userDefined: false, tools: [] }),
        server('ghost', { origin: 'stored', configured: false, definition: null, definedIn: undefined, hasBase: false, userDefined: false, status: { state: 'removed' }, definitionEnabled: false, available: false, decisions: { global: { state: 'disabled' } }, effective: { state: 'disabled', scope: 'global' } }),
      ])
    }
    if (op === 'mcpStatus') return { servers: [{ name: 'github', configured: true, status: { state: 'connected', toolCount: 1 }, toolCount: 1 }], warnings: [] }
    return null
  })
  const mounted = await mount(components.main.comp, { t: (key) => key })
  t.after(mounted.cleanup)
  await wait(400)

  const mcpTab = [...mounted.container.querySelectorAll('button[role="tab"]')].find((button) => button.textContent.includes('tabs.mcp'))
  Simulate.click(mcpTab)
  await wait(250)
  const info = mounted.container.querySelector('button[aria-label="hint.info"]')
  assert.ok(info, 'MCP scope info button rendered')
  assert.equal(mounted.container.textContent.includes('notice.mcp'), false, 'MCP notices are not always-on text')
  Simulate.click(info)
  await wait(50)
  assert.ok(mounted.container.textContent.includes('notice.mcp'), 'the MCP info button opens the notice')
  Simulate.click(info)

  const github = mounted.container.querySelector('[data-mcp-row="github"]')
  assert.ok(github, 'definition row rendered')
  assert.ok(github.textContent.includes('status.connected'))
  assert.ok(github.textContent.includes('mcp__github__run'))
  assert.ok(github.textContent.includes('mcp.userOverride'))
  assert.equal(github.textContent.includes('state.overridden'), false, 'global MCP rows do not show a wider-scope badge')
  assert.equal(github.textContent.includes('state.inherit'), false)
  assert.ok(mounted.container.querySelector('[data-mcp-row="web"]'), 'plugin row rendered')
  const ghost = mounted.container.querySelector('[data-mcp-row="ghost"]')
  assert.ok(ghost, 'stored row rendered')
  assert.equal(buttonOf(ghost, 'action.resetDefault'), undefined, 'MCP rows only expose the switch')
  assert.equal(buttonOf(ghost, 'action.inherit'), undefined, 'MCP rows do not render an inherit action')

  Simulate.click(buttonOf(github, 'action.probe'))
  await wait(300)
  const probeDialog = document.body.querySelector('div[role="dialog"]')
  assert.ok(probeDialog, 'probe result opens')
  assert.ok(probeDialog.textContent.includes('GitHub'))
  Simulate.click([...probeDialog.querySelectorAll('button')].find((button) => button.textContent === '✕'))
  await wait(120)

  Simulate.click(buttonOf(mounted.container, 'action.add'))
  await wait(150)
  const form = document.body.querySelector('div[role="dialog"]')
  assert.ok(form, 'form opens')
  const nameInput = form.querySelector('input[placeholder="github"]')
  setInput(nameInput, 'new-mcp')
  const commandInput = form.querySelector('input[placeholder="npx"]')
  setInput(commandInput, 'npx')
  await wait(120)
  Simulate.click([...form.querySelectorAll('button')].find((button) => button.textContent === 'action.save'))
  await wait(350)
  const post = lastPost('addMcp')
  assert.equal(post.name, 'new-mcp')
  assert.equal(post.transport, 'stdio')
  assert.equal(post.command, 'npx')
})

test('T-UI3 the project scope shows inherit and override badges', async (t) => {
  serve(async (url, body) => {
    if (body?.op === 'setSkillDecision') return {}
    const op = url.searchParams.get('op')
    const scope = url.searchParams.get('scope')
    if (op === 'overview') return { workspaces: [{ id: 'w1', title: 'dsh', path: '/w1' }], presets: [], capabilities: {}, warnings: [] }
    if (op === 'skills') {
      if (scope === 'global') return skillsView('global', [])
      return skillsView('workspace', [
        skill('dsh-doc', {
          decisions: { global: { state: 'disabled' }, workspace: { state: 'enabled' } },
          effective: { state: 'enabled', scope: 'workspace' },
          shadowed: [{ scope: 'global', state: 'disabled' }],
        }),
        skill('office', { source: 'bundled' }),
      ])
    }
    if (op === 'mcp') return mcpView(scope === 'workspace' ? 'workspace' : 'global', [])
    if (op === 'mcpStatus') return { servers: [], warnings: [] }
    return null
  })
  const mounted = await mount(components.main.comp, { t: (key) => key })
  t.after(mounted.cleanup)
  await wait(400)

  const projectScope = mounted.container.querySelector('button[data-scope="project"]')
  assert.ok(projectScope, 'the page exposes a project scope')
  Simulate.click(projectScope)
  await wait(500)
  assert.equal(projectScope.getAttribute('aria-pressed'), 'true')
  assert.ok(projectScope.getAttribute('style').includes('var(--dsw-alias-state-business-primary)'))
  assert.equal(mounted.container.querySelector('button[data-scope="global"]').getAttribute('aria-pressed'), 'false')

  const workspaceSelect = mounted.container.querySelector('select[aria-label="field.workspace"]')
  const searchInput = mounted.container.querySelector('input[placeholder="search.skills"]')
  assert.ok(workspaceSelect, 'project workspace selector rendered')
  assert.ok(searchInput, 'skills search rendered')
  assert.equal(searchInput.parentElement, workspaceSelect.parentElement.parentElement, 'workspace and search share one row')

  const winner = mounted.container.querySelector('[data-skill-row="dsh-doc"]')
  assert.ok(winner, 'project row rendered')
  assert.equal(winner.querySelector('button[role="switch"]').getAttribute('aria-checked'), 'true')
  assert.equal(winner.querySelector('button[role="switch"]').disabled, false)

  assert.equal(mounted.container.querySelector('[data-shadow-row="dsh-doc"]'), null, 'no extra shadow row')
  const widerBadge = [...winner.querySelectorAll('span')].find((span) => span.textContent === 'state.overridden')
  assert.ok(widerBadge, 'an explicit project decision shows the override badge')
  const inherited = mounted.container.querySelector('[data-skill-row="office"]')
  assert.ok(inherited, 'inherited project row rendered')
  assert.ok(inherited.textContent.includes('state.inherit'), 'an inherited project row shows the inherit badge')
  assert.equal(inherited.textContent.includes('state.overridden'), false)

  Simulate.click(winner.querySelector('button[role="switch"]'))
  await wait(300)
  const post = lastPost('setSkillDecision')
  assert.equal(post.scope, 'workspace')
  assert.equal(post.workspaceId, 'w1')
  assert.equal(post.state, 'disabled')
})

test('T-UI4 the session view filters to enabled entries and toggles the session decision', async (t) => {
  let skillsCalls = 0
  serve(async (url, body) => {
    if (body?.op === 'setSkillDecision') return {}
    const op = url.searchParams.get('op')
    if (op === 'overview') return { workspaces: [], presets: [], capabilities: {}, warnings: [] }
    if (op === 'skills') {
      skillsCalls += 1
      const view = skillsView('session', [
        skill('dsh-doc', {
          decisions: { session: { state: 'disabled' } },
          effective: { state: 'disabled', scope: 'session' },
          shadowed: [{ scope: 'workspace', state: 'enabled' }],
        }),
        skill('office', { source: 'bundled' }),
      ])
      if (skillsCalls > 1) return new Promise((resolve) => setTimeout(() => resolve(view), 300))
      return view
    }
    if (op === 'mcp') return mcpView('session', [])
    if (op === 'mcpStatus') return { servers: [], warnings: [] }
    return null
  })
  const view = components['conversation.view#skills-mcp']
  const mounted = await mount(view.comp, { ...view.def.inject(), sessionId: 's1' })
  t.after(mounted.cleanup)
  await wait(400)
  assert.equal(mounted.container.querySelector('[aria-label="field.scope"]'), null, 'the session view does not repeat a scope marker')
  assert.ok(mounted.container.querySelector('input[placeholder="search.skills"]'), 'the session view reuses the skills toolbar')
  const skillsRequests = () => requests.filter((request) => request.target.includes('op=skills')).length
  const beforeRefresh = skillsRequests()
  Simulate.click(mounted.container.querySelector('button[title="action.refresh"]'))
  await wait(50)
  const spinningButton = mounted.container.querySelector('button[title="action.refresh"]')
  assert.equal(spinningButton.disabled, true, 'refresh is disabled while spinning')
  const refreshIcon = spinningButton.querySelector('svg')
  assert.ok(refreshIcon, 'refresh icon is an svg')
  assert.ok(refreshIcon.getAttribute('style').includes('dsh-skills-mcp-spin'), 'refresh icon spins')
  assert.ok(refreshIcon.getAttribute('style').includes('infinite'), 'refresh keeps spinning until the request finishes')
  await wait(650)
  assert.ok(skillsRequests() > beforeRefresh, 'refresh triggers a new skills request')
  assert.equal(mounted.container.querySelector('button[title="action.refresh"]').disabled, false, 'refresh returns to idle')

  const disabled = mounted.container.querySelector('[data-skill-row="dsh-doc"]')
  assert.equal(disabled.querySelector('button[role="switch"]').getAttribute('aria-checked'), 'false')
  assert.equal(buttonOf(disabled, 'action.inherit'), undefined, 'session rows do not render an inherit action')
  assert.equal(buttonOf(disabled, 'action.resetDefault'), undefined, 'session rows do not render a reset action')
  assert.equal(mounted.container.querySelector('[data-shadow-row="dsh-doc"]'), null, 'no extra shadow row')
  const sessionBadge = [...disabled.querySelectorAll('span')].find((span) => span.textContent === 'state.overridden')
  assert.ok(sessionBadge, 'an explicit session decision shows the override badge')
  const inherited = mounted.container.querySelector('[data-skill-row="office"]')
  assert.ok(inherited, 'inherited session row rendered')
  assert.ok(inherited.textContent.includes('state.inherit'), 'an inherited session row shows the inherit badge')

  const filter = [...mounted.container.querySelectorAll('input[type="checkbox"]')]
    .find((input) => input.parentElement?.textContent?.includes('state.enabledOnly'))
  assert.ok(filter, 'the only-enabled filter uses its own label')
  assert.equal(filter.parentElement.textContent, 'state.enabledOnly')
  Simulate.change(filter, { target: { checked: true } })
  await wait(200)
  assert.equal(mounted.container.querySelector('[data-skill-row="dsh-doc"]'), null)

  Simulate.change(filter, { target: { checked: false } })
  await wait(200)
  const enabled = mounted.container.querySelector('[data-skill-row="office"]')
  Simulate.click(enabled.querySelector('button[role="switch"]'))
  await wait(300)
  const post = lastPost('setSkillDecision')
  assert.equal(post.scope, 'session')
  assert.equal(post.sessionId, 's1')
  assert.equal(post.state, 'disabled')
})

test('T-UI5 the MCP editor keeps stored values masked and offers the right actions', async (t) => {
  serve(async (url, body) => {
    if (body?.op === 'updateMcp') return {}
    if (body?.op === 'setMcpEnabled') return {}
    const op = url.searchParams.get('op')
    if (op === 'overview') return { workspaces: [], presets: [], capabilities: {}, warnings: [] }
    if (op === 'skills') return skillsView('global', [])
    if (op === 'mcp') {
      return mcpView('global', [
        server('github', { definedIn: 'user', hasBase: true }),
        server('local', { definedIn: 'user', hasBase: false }),
        server('stopped', { definition: { transport: 'stdio', command: 'npx', args: [], url: '', cwd: '', enabled: false, envKeys: [], headerKeys: [] }, definitionEnabled: false, available: false }),
      ])
    }
    if (op === 'mcpStatus') return { servers: [], warnings: [] }
    return null
  })
  const mounted = await mount(components.main.comp, { t: (key) => key })
  t.after(mounted.cleanup)
  await wait(400)
  Simulate.click([...mounted.container.querySelectorAll('button[role="tab"]')].find((button) => button.textContent.includes('tabs.mcp')))
  await wait(250)

  const github = mounted.container.querySelector('[data-mcp-row="github"]')
  assert.ok(buttonOf(github, 'action.reset'), 'user override over a base entry can reset')
  assert.equal(buttonOf(github, 'action.remove'), undefined, 'inherited base entries are not removable')
  assert.equal(github.querySelector('button[role="switch"]').disabled, false)

  const local = mounted.container.querySelector('[data-mcp-row="local"]')
  assert.ok(buttonOf(local, 'action.remove'), 'user-only entries are removable')
  assert.equal(buttonOf(local, 'action.reset'), undefined)

  const stopped = mounted.container.querySelector('[data-mcp-row="stopped"]')
  assert.equal(stopped.querySelector('button[role="switch"]').disabled, true, 'a stopped definition cannot be enabled by a scope')
  Simulate.click(buttonOf(stopped, 'action.enableDefinition'))
  await wait(300)
  assert.deepEqual(lastPost('setMcpEnabled'), { op: 'setMcpEnabled', name: 'stopped', enabled: true })

  Simulate.click(buttonOf(github, 'action.edit'))
  await wait(150)
  const form = document.body.querySelector('div[role="dialog"]')
  assert.ok(form, 'edit form opens')
  assert.equal(form.querySelector('input[placeholder="github"]').disabled, true, 'the name is immutable')
  const key = form.querySelector('input[value="TOKEN"]')
  assert.ok(key, 'the stored env key is shown')
  const value = key.parentElement.querySelector('input[type="password"]')
  assert.equal(value.value, '')
  assert.equal(value.placeholder, 'form.keepHint')
  const commandInput = form.querySelector('input[placeholder="npx"]')
  setInput(commandInput, 'node')
  await wait(120)
  Simulate.click([...form.querySelectorAll('button')].find((button) => button.textContent === 'action.save'))
  await wait(350)
  const post = lastPost('updateMcp')
  assert.equal(post.name, 'github')
  assert.equal(post.command, 'node')
  assert.deepEqual(post.env, { set: {}, remove: [] })
})

test('T-UI6 the add dialog offers a JSON mode that posts a single entry', async (t) => {
  serve(async (url, body) => {
    if (body?.op === 'addMcp') return {}
    const op = url.searchParams.get('op')
    if (op === 'overview') return { workspaces: [], presets: [], capabilities: {}, warnings: [] }
    if (op === 'skills') return skillsView('global', [])
    if (op === 'mcp') return mcpView('global', [])
    if (op === 'mcpStatus') return { servers: [], warnings: [] }
    return null
  })
  const mounted = await mount(components.main.comp, { t: (key) => key })
  t.after(mounted.cleanup)
  await wait(400)

  Simulate.click([...mounted.container.querySelectorAll('button[role="tab"]')].find((button) => button.textContent.includes('tabs.mcp')))
  await wait(250)
  Simulate.click(buttonOf(mounted.container, 'action.add'))
  await wait(150)

  const form = document.body.querySelector('div[role="dialog"]')
  assert.ok(form, 'add form opens')
  const jsonMode = [...form.querySelectorAll('button')].find((button) => button.textContent === 'form.modeJson')
  assert.ok(jsonMode, 'JSON mode is available for add')
  Simulate.click(jsonMode)
  await wait(150)

  const textarea = form.querySelector('textarea')
  assert.ok(textarea, 'JSON editor rendered')
  setInput(textarea, JSON.stringify({
    name: 'json-mcp',
    transport: 'stdio',
    command: 'node',
    args: ['-y', 'server'],
    env: { TOKEN: 'abc' },
    enabled: false,
  }))
  await wait(120)
  Simulate.click([...form.querySelectorAll('button')].find((button) => button.textContent === 'action.save'))
  await wait(350)

  const post = lastPost('addMcp')
  assert.equal(post.name, 'json-mcp')
  assert.equal(post.transport, 'stdio')
  assert.equal(post.command, 'node')
  assert.deepEqual(post.args, ['-y', 'server'])
  assert.deepEqual(post.env, { set: { TOKEN: 'abc' }, remove: [] })
  assert.equal(post.enabled, false)
})

test('T-UI7 the project MCP tab controls availability but not definitions', async (t) => {
  serve(async (url, body) => {
    if (body?.op === 'setMcpDecision') return {}
    const op = url.searchParams.get('op')
    const scope = url.searchParams.get('scope')
    if (op === 'overview') return { workspaces: [{ id: 'w1', title: 'dsh', path: '/w1' }], presets: [], capabilities: {}, warnings: [] }
    if (op === 'skills') return skillsView(scope === 'workspace' ? 'workspace' : 'global', [])
    if (op === 'mcp') {
      return scope === 'workspace'
        ? mcpView('workspace', [server('github', {
          definedIn: 'base',
          hasBase: true,
          userDefined: false,
          decisions: { global: { state: 'disabled' }, workspace: { state: 'enabled' } },
          effective: { state: 'enabled', scope: 'workspace' },
          shadowed: [{ scope: 'global', state: 'disabled' }],
        })])
        : mcpView('global', [])
    }
    if (op === 'mcpStatus') return { servers: [{ name: 'github', configured: true, status: { state: 'connected', toolCount: 1 }, toolCount: 1 }], warnings: [] }
    return null
  })
  const mounted = await mount(components.main.comp, { t: (key) => key })
  t.after(mounted.cleanup)
  await wait(400)
  Simulate.click(mounted.container.querySelector('button[data-scope="project"]'))
  await wait(500)
  Simulate.click([...mounted.container.querySelectorAll('button[role="tab"]')].find((button) => button.textContent.includes('tabs.mcp')))
  await wait(250)

  const row = mounted.container.querySelector('[data-mcp-row="github"]')
  assert.ok(row, 'project MCP row rendered')
  assert.equal(row.querySelector('button[role="switch"]').disabled, false)
  assert.ok(row.textContent.includes('state.overridden'), 'project MCP row carries the wider-scope badge')
  assert.ok(buttonOf(row, 'action.probe'), 'probe stays available')
  assert.ok(buttonOf(row, 'action.restart'), 'restart stays available')
  assert.equal(buttonOf(row, 'action.edit'), undefined, 'definitions are edited in the Global tab only')
  assert.equal(buttonOf(row, 'action.enableDefinition'), undefined)
  assert.equal(buttonOf(row, 'action.disableDefinition'), undefined)
  assert.equal(buttonOf(mounted.container, 'action.add'), undefined, 'the Project tab cannot add definitions')
})

test('T-UI8 the skills tab filters by search and source', async (t) => {
  serve(async (url) => {
    const op = url.searchParams.get('op')
    if (op === 'overview') return { workspaces: [], presets: [], capabilities: {}, warnings: [] }
    if (op === 'skills') {
      return skillsView('global', [
        skill('dsh-doc', { source: 'user-dsh' }),
        skill('agents-skill', { source: 'user-agents' }),
        skill('project-review', { source: 'project-dsh' }),
        skill('office', { source: 'bundled' }),
      ])
    }
    if (op === 'mcp') return mcpView('global', [])
    if (op === 'mcpStatus') return { servers: [], warnings: [] }
    return null
  })
  const mounted = await mount(components.main.comp, { t: (key) => key })
  t.after(mounted.cleanup)
  await wait(400)

  const search = mounted.container.querySelector('input[placeholder="search.skills"]')
  assert.ok(search, 'search input rendered')
  setInput(search, 'office')
  await wait(150)
  assert.ok(mounted.container.querySelector('[data-skill-row="office"]'))
  assert.equal(mounted.container.querySelector('[data-skill-row="dsh-doc"]'), null)

  setInput(search, '')
  await wait(150)
  const source = mounted.container.querySelector('select[aria-label="field.source"]')
  assert.ok(source, 'source filter rendered')
  source.value = 'user-dsh'
  Simulate.change(source)
  await wait(150)
  assert.ok(mounted.container.querySelector('[data-skill-row="dsh-doc"]'))
  assert.equal(mounted.container.querySelector('[data-skill-row="office"]'), null)

  source.value = 'user-agents'
  Simulate.change(source)
  await wait(150)
  const agentsRow = mounted.container.querySelector('[data-skill-row="agents-skill"]')
  assert.ok(agentsRow, 'user-agents filters the AGENTS root')
  assert.ok(agentsRow.textContent.includes('source.userAgents'), 'the row names the exact AGENTS source')
  assert.equal(mounted.container.querySelector('[data-skill-row="dsh-doc"]'), null)
})

test('T-UI9 global bulk actions enable and disable without a reset action', async (t) => {
  serve(async (url, body) => {
    if (body?.op === 'setSkillDecision' || body?.op === 'setMcpDecision') return {}
    const op = url.searchParams.get('op')
    if (op === 'overview') return { workspaces: [], presets: [], capabilities: {}, warnings: [] }
    if (op === 'skills') return skillsView('global', [skill('alpha'), skill('beta')])
    if (op === 'mcp') return mcpView('global', [server('one'), server('two')])
    if (op === 'mcpStatus') {
      return {
        servers: [
          { name: 'one', configured: true, status: { state: 'connected', toolCount: 1 }, toolCount: 1 },
          { name: 'two', configured: true, status: { state: 'connected', toolCount: 1 }, toolCount: 1 },
        ],
        warnings: [],
      }
    }
    return null
  })
  const mounted = await mount(components.main.comp, { t: (key) => key })
  t.after(mounted.cleanup)
  await wait(400)
  const action = (text) => buttonOf(mounted.container, text)
  const skillPosts = () => requests.filter((request) => request.body?.op === 'setSkillDecision')
  const mcpPosts = () => requests.filter((request) => request.body?.op === 'setMcpDecision')
  assert.equal(action('action.resetAll'), undefined, 'global has no reset concept')

  Simulate.click(action('action.enableAll'))
  await wait(300)
  assert.equal(skillPosts().length, 2)
  assert.ok(skillPosts().every((request) => request.body.state === 'enabled'))
  assert.ok(skillPosts().every((request) => request.body.scope === 'global'))

  Simulate.click(action('action.disableAll'))
  await wait(300)
  assert.equal(skillPosts().length, 4)
  assert.ok(skillPosts().slice(2).every((request) => request.body.state === 'disabled'))

  const mcpTab = [...mounted.container.querySelectorAll('button[role="tab"]')].find((button) => button.textContent.includes('tabs.mcp'))
  Simulate.click(mcpTab)
  await wait(250)

  assert.ok(action('action.enableAll'), 'MCP group has the bulk bar')
  Simulate.click(action('action.enableAll'))
  await wait(300)
  assert.equal(mcpPosts().length, 2)
  assert.ok(mcpPosts().every((request) => request.body.state === 'enabled'))

  Simulate.click(action('action.disableAll'))
  await wait(300)
  assert.equal(mcpPosts().length, 4)
  assert.ok(mcpPosts().slice(2).every((request) => request.body.state === 'disabled'))

  assert.equal(action('action.resetAll'), undefined, 'global MCP has no reset concept')
})


test('T-UI10 project bulk reset clears the current workspace decisions', async (t) => {
  serve(async (url, body) => {
    if (body?.op === 'setSkillDecision') return {}
    const op = url.searchParams.get('op')
    const scope = url.searchParams.get('scope')
    if (op === 'overview') return { workspaces: [{ id: 'w1', title: 'dsh', path: '/w1' }], presets: [], capabilities: {}, warnings: [] }
    if (op === 'skills') return skillsView(scope === 'workspace' ? 'workspace' : 'global', scope === 'workspace' ? [skill('alpha'), skill('beta')] : [])
    if (op === 'mcp') return mcpView(scope === 'workspace' ? 'workspace' : 'global', [])
    if (op === 'mcpStatus') return { servers: [], warnings: [] }
    return null
  })
  const mounted = await mount(components.main.comp, { t: (key) => key })
  t.after(mounted.cleanup)
  await wait(400)
  Simulate.click(mounted.container.querySelector('button[data-scope="project"]'))
  await wait(500)
  const reset = buttonOf(mounted.container, 'action.resetAll')
  assert.ok(reset, 'project scope exposes bulk reset')
  Simulate.click(reset)
  await wait(300)
  const posts = requests.filter((request) => request.body?.op === 'setSkillDecision')
  assert.equal(posts.length, 2)
  assert.ok(posts.every((request) => request.body.state === 'inherit'))
  assert.ok(posts.every((request) => request.body.scope === 'workspace'))
  assert.ok(posts.every((request) => request.body.workspaceId === 'w1'))
})
