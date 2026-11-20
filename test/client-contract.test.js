import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const client = await readFile(join(root, 'client.js'), 'utf8')
const zh = JSON.parse(await readFile(join(root, 'locale', 'zh.json'), 'utf8'))
const en = JSON.parse(await readFile(join(root, 'locale', 'en.json'), 'utf8'))

const registration = await (async () => {
  let captured
  const window = { __ModuleLoader__: { load: (value) => { captured = value } } }
  const React = await import('react')
  const ReactDOM = await import('react-dom')
  new Function('window', 'document', 'React', 'ReactDOM', client)(window, { body: {} }, React, ReactDOM)
  return captured
})()
const plugin = registration.factory((name) => name === 'react' ? { createElement: () => null } : {})

const slots = new Map()
const dictionaries = {}
plugin.apply({
  effect: (fn) => {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  locale: {
    register: (namespace, dictionary) => {
      dictionaries[namespace] = dictionary
      return () => {}
    },
    bind: () => (key) => key,
  },
  slots: {
    inject: (_slot, fn) => fn(),
    register: (options) => {
      slots.set(options.name + (options.id === undefined ? '' : `#${options.id}`), options)
      return () => {}
    },
  },
})

test('T-U1 the client registers the sidebar, main page, and session view', () => {
  assert.ok(slots.has('sidebar.panellist#skills-mcp'))
  assert.ok(slots.has('main'))
  assert.ok(slots.has('conversation.view#skills-mcp'))
  assert.equal(slots.get('sidebar.panellist#skills-mcp').label(), 'panel.title')
  assert.equal(slots.get('conversation.view#skills-mcp').label(), 'view.title')
})

test('T-U2 the workspace dialog and context menu are gone; scoping lives in the page', () => {
  assert.equal(slots.has('shell.overlay#skills-mcp.workspace'), false)
  assert.equal(slots.has('contextMenu.icon'), false)
  assert.equal(client.includes('contextMenus'), false)
  assert.match(client, /'data-scope': 'global'/u)
  assert.match(client, /'data-scope': 'project'/u)
  assert.match(client, /useResource\(\(\) => request\('\?op=overview'\)/u)
  assert.match(client, /scope === 'project' && workspaceId !== null \? \{ workspaceId \} : \{\}/u)
})

test('T-U3 both dictionaries exist and name every scope, source, and group', () => {
  const dictionary = dictionaries['skills-mcp']
  assert.ok(dictionary.zh)
  assert.ok(dictionary.en)
  const expected = ['panel.title', 'view.title', 'tabs.skills', 'tabs.mcp', 'scope.global', 'scope.workspace', 'scope.session',
    'source.user', 'source.project', 'source.userDsh', 'source.userAgents', 'source.projectDsh', 'source.projectAgents', 'source.bundled', 'source.plugin', 'state.enabled', 'state.enabledOnly', 'state.disabled', 'state.overridden',
    'group.user', 'group.definitions', 'group.plugins', 'action.add', 'action.enableAll', 'action.disableAll', 'action.resetAll',
    'hint.resetAll', 'hint.info', 'bulk.label', 'action.restoreInherit', 'action.resetRow', 'action.probe', 'form.envHint', 'notice.token',
    'field.workspace', 'field.scope', 'search.skills', 'filter.all', 'count.shown', 'notice.mcp.project',
    'empty.workspace', 'form.modeForm', 'form.modeJson', 'form.jsonHint', 'form.jsonInvalid', 'form.jsonObject',
    'state.inherit']
  for (const key of expected) {
    assert.equal(typeof dictionary.zh[key], 'string', `zh ${key}`)
    assert.equal(typeof dictionary.en[key], 'string', `en ${key}`)
  }
  assert.deepEqual(Object.keys(dictionary.zh).sort(), Object.keys(dictionary.en).sort())
  assert.equal(dictionary.zh['scope.workspace'], '项目')
  assert.equal(dictionary.en['scope.workspace'], 'Project')
  assert.equal(dictionary.zh['source.userAgents'], '用户 · AGENTS')
  assert.equal(dictionary.en['source.userAgents'], 'User · AGENTS')
  assert.equal(dictionary.zh['state.overridden'], '覆盖')
  assert.equal(dictionary.en['state.overridden'], 'Overridden')
})

test('T-U4 the client uses the scoped decision API and masks existing values', () => {
  assert.match(client, /op: 'setSkillDecision'/u)
  assert.match(client, /op: 'setMcpDecision'/u)
  assert.match(client, /addMcp/u)
  assert.match(client, /updateMcp/u)
  assert.match(client, /op: 'probeMcp'/u)
  assert.match(client, /op: 'setMcpEnabled'/u)
  assert.match(client, /envKeys/u)
  assert.match(client, /headerKeys/u)
  assert.match(client, /type: 'password'/u)
  assert.equal(client.includes('@deepseek-ai/'), false)
})

test('T-U5 rows show two decision states: inherit or override', () => {
  assert.match(client, /function decisionBadge/u)
  assert.match(client, /state\.overridden/u)
  assert.match(client, /state\.inherit/u)
  assert.equal(client.includes("'data-shadow-row'"), false)
  assert.equal(client.includes('shadowedEntries'), false)
  assert.equal(client.includes('opacity: 0.6'), false)
})

test('T-U6 the MCP form covers both transports and a definition switch', () => {
  for (const label of ['field.transport', 'field.command', 'field.url', 'field.args', 'field.env', 'field.headers',
    'field.startupTimeoutMs', 'field.toolCallTimeoutMs', 'field.enabled', 'action.enableDefinition', 'action.disableDefinition']) {
    assert.ok(client.includes(`'${label}'`), label)
  }
  assert.match(client, /transport === 'stdio'/u)
  assert.match(client, /transport === 'streamable-http'/u)
  assert.match(client, /op: editing \? 'updateMcp' : 'addMcp'/u)
})

test('T-U7 locale resources describe the panel for the plugin manager', () => {
  assert.equal(zh.meta.title, '技能与 MCP')
  assert.equal(en.meta.title, 'Skills & MCP')
  assert.equal(zh.panel.title, '技能与 MCP')
  assert.equal(en.view.title, 'Skills & MCP')
})
