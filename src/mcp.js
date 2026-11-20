/**
 * MCP management over `ctx.mcpManager` and the Settings form service. Reads
 * live status, masks environment/header values, validates entries, and writes
 * through the same persisted profile layer the official Settings page uses.
 * @module skills-mcp/mcp
 */
import {
  explicitDecisions,
  isServerName,
  resolveDecision,
  shadowedDecisions,
  SkillsMcpError,
} from './core.js'

/** Shared resource tools owned by `dsh-mcp-resources`, not by one server. */
export const RESOURCE_TOOLS = ['list_mcp_resources', 'list_mcp_resource_templates', 'read_mcp_resource']

const MAX_ARGS = 64
const MAX_ARG_LENGTH = 4096
const MAX_ENV = 64
const MAX_ENV_VALUE = 8192
const MAX_TIMEOUT = 2_147_483_647
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** @param {unknown} value @returns {string|undefined} */
function messageOf(value) {
  if (value instanceof Error) return value.message
  return String(value)
}

/** @param {unknown} value @returns {Record<string, unknown>} */
function asMap(value) {
  return isPlainObject(value) ? value : {}
}

/** @param {string} name @param {string} prefix @returns {boolean} */
function hasToolPrefix(name, prefix) {
  return typeof name === 'string' && name.startsWith(prefix)
}

/** @param {unknown} value @param {number} max @returns {boolean} */
function isTimeout(value, max = MAX_TIMEOUT) {
  return Number.isInteger(value) && value >= 1 && value <= max
}

/** @param {unknown} record @param {number} max @returns {Record<string,string>|undefined} */
function stringMap(record, max) {
  if (!isPlainObject(record)) return undefined
  const entries = Object.entries(record)
  if (entries.length > max) throw new SkillsMcpError('VALIDATION', `no more than ${max} entries are allowed`)
  const out = {}
  for (const [key, value] of entries) {
    if (RESERVED_KEYS.has(key)) throw new SkillsMcpError('VALIDATION', `invalid key "${key}"`)
    if (typeof key !== 'string' || key.length === 0 || key.length > 256) throw new SkillsMcpError('VALIDATION', 'entry keys must be non-empty strings')
    if (typeof value !== 'string') throw new SkillsMcpError('VALIDATION', `value for "${key}" must be a string`)
    if (value.length > MAX_ENV_VALUE) throw new SkillsMcpError('VALIDATION', `value for "${key}" is too long`)
    out[key] = value
  }
  return out
}

/**
 * Mask one resolved entry for the browser. Environment and header values never
 * leave the Host; only their keys are returned.
 * @param {object} entry - resolved mcp-manager entry.
 * @returns {object} safe definition view.
 */
export function maskEntry(entry) {
  const env = asMap(entry?.env)
  const headers = asMap(entry?.headers)
  return {
    transport: entry?.transport === 'streamable-http' ? 'streamable-http' : 'stdio',
    command: typeof entry?.command === 'string' ? entry.command : '',
    args: Array.isArray(entry?.args) ? entry.args.filter((arg) => typeof arg === 'string') : [],
    url: typeof entry?.url === 'string' ? entry.url : '',
    cwd: typeof entry?.cwd === 'string' ? entry.cwd : '',
    enabled: entry?.enabled !== false,
    ...(isTimeout(entry?.startupTimeoutMs) ? { startupTimeoutMs: entry.startupTimeoutMs } : {}),
    ...(isTimeout(entry?.toolCallTimeoutMs) ? { toolCallTimeoutMs: entry.toolCallTimeoutMs } : {}),
    ...(isTimeout(entry?.closeTimeoutMs) ? { closeTimeoutMs: entry.closeTimeoutMs } : {}),
    envKeys: Object.keys(env).sort(),
    headerKeys: Object.keys(headers).sort(),
  }
}

/** @param {object} descriptor @returns {boolean} */
function looksLikeMcpDescriptor(descriptor) {
  const schema = descriptor?.schema
  const value = descriptor?.value
  if (isPlainObject(value) && isPlainObject(value.servers)) return true
  return isPlainObject(schema) && isPlainObject(schema.properties) && isPlainObject(schema.properties.servers)
}

/**
 * @param {object} input - adapter dependencies.
 * @param {() => object|undefined} input.getManager - `ctx.mcpManager`.
 * @param {() => object|undefined} input.getSettings - `ctx.settings`.
 * @param {() => object|undefined} input.getTools - `ctx.tools`.
 * @param {() => object} input.getSnapshot - current decisions snapshot.
 * @param {{ mcpNamespace?: string }} [input.config] - plugin config.
 * @returns {object} MCP adapter.
 */
export function createMcpAdapter(input) {
  const { getManager, getSettings, getTools, getSnapshot } = input
  const preferredNamespace = input.config?.mcpNamespace ?? 'mcp-manager'
  let cachedNamespace

  /** @returns {object|null} the MCP settings descriptor. */
  function descriptor() {
    const settings = getSettings()
    if (settings === undefined || settings === null || typeof settings.describe !== 'function') return null
    let descriptors
    try {
      descriptors = settings.describe()
    } catch {
      return null
    }
    if (!Array.isArray(descriptors)) return null
    if (cachedNamespace !== undefined) {
      const cached = descriptors.find((row) => row.ns === cachedNamespace)
      if (cached !== undefined) return cached
      cachedNamespace = undefined
    }
    const selected = descriptors.find((row) => row.ns === preferredNamespace) ?? descriptors.find(looksLikeMcpDescriptor)
    if (selected === undefined) return null
    cachedNamespace = selected.ns
    return selected
  }

  /** @returns {{ value: object, base: object, user: object, revision: number, ns: string }|null} */
  function readConfig() {
    const current = descriptor()
    if (current === null) return null
    return {
      ns: current.ns,
      revision: typeof current.revision === 'number' ? current.revision : 0,
      value: asMap(asMap(current.value).servers),
      base: asMap(asMap(current.base).servers),
      user: asMap(asMap(current.user).servers),
    }
  }

  /** @returns {Array<{name:string, configured:boolean, status:object}>} */
  function managerList() {
    const manager = getManager()
    if (manager === undefined || manager === null || typeof manager.list !== 'function') return []
    try {
      const rows = manager.list()
      return Array.isArray(rows) ? rows.filter((row) => typeof row?.name === 'string') : []
    } catch {
      return []
    }
  }

  /** @returns {Array<object>} */
  function toolDefinitions() {
    const tools = getTools()
    if (tools === undefined || tools === null || typeof tools.definitions !== 'function') return []
    try {
      const rows = tools.definitions()
      return Array.isArray(rows) ? rows : []
    } catch {
      return []
    }
  }

  /** @param {string} name @param {Array<object>} definitions @returns {Array<{name:string,description?:string}>} */
  function toolsOf(name, definitions) {
    const prefix = `mcp__${name}__`
    return definitions
      .filter((tool) => hasToolPrefix(tool?.name, prefix))
      .map((tool) => ({
        name: tool.name,
        ...(typeof tool.description === 'string' ? { description: tool.description.slice(0, 240) } : {}),
      }))
      .sort((left, right) => left.name.localeCompare(right.name))
  }

  /** @param {string} name @param {{ workspaceId?: string, sessionId?: string }} ids @returns {object} */
  function decisionView(name, ids) {
    const snapshot = getSnapshot()
    const explicit = explicitDecisions(snapshot, 'mcp', name, ids)
    const resolved = resolveDecision(snapshot, 'mcp', name, ids)
    return {
      decisions: Object.fromEntries(explicit.map((row) => [row.scope, { state: row.state }])),
      effective: { state: resolved.state, scope: resolved.scope },
      shadowed: shadowedDecisions(snapshot, 'mcp', name, ids).map((row) => ({ scope: row.scope, state: row.state })),
    }
  }

  /**
   * List every server with status, masked definition, tools, and decisions.
   * @param {{ workspaceId?: string, sessionId?: string }} [ids] - scope identity.
   * @returns {{ servers: object[], namespace: string|null, capabilities: object, warnings: object[] }}
   */
  function listServers(ids = {}) {
    const config = readConfig()
    const definitions = toolDefinitions()
    const managed = managerList()
    const warnings = []
    if (getManager() === undefined) warnings.push({ code: 'MCP_UNAVAILABLE', message: 'the MCP manager is not mounted' })
    if (config === null) warnings.push({ code: 'SETTINGS_UNAVAILABLE', message: 'MCP definition editing is unavailable because the Settings service is not mounted' })

    const rows = new Map()
    const definitionNames = config === null
      ? []
      : [...new Set([...Object.keys(config.value), ...Object.keys(config.base), ...Object.keys(config.user)])]

    for (const server of managed) {
      const definition = config?.value[server.name]
      const definedIn = config?.user[server.name] !== undefined
        ? 'user'
        : config?.base[server.name] !== undefined ? 'base' : definition === undefined ? undefined : 'resolved'
      rows.set(server.name, {
        name: server.name,
        configured: server.configured !== false,
        origin: server.configured === false ? 'plugin' : 'definition',
        status: server.status ?? { state: 'unknown' },
        definition: definition === undefined ? null : maskEntry(definition),
        definedIn,
        hasBase: config?.base[server.name] !== undefined,
        userDefined: config?.user[server.name] !== undefined,
        tools: toolsOf(server.name, definitions),
        ...decisionView(server.name, ids),
      })
    }

    for (const name of definitionNames) {
      if (rows.has(name)) continue
      const definition = config.value[name] ?? config.base[name] ?? config.user[name]
      rows.set(name, {
        name,
        configured: true,
        origin: 'definition',
        status: { state: 'missing' },
        definition: definition === undefined ? null : maskEntry(definition),
        definedIn: config.user[name] !== undefined ? 'user' : config.base[name] !== undefined ? 'base' : 'resolved',
        hasBase: config.base[name] !== undefined,
        userDefined: config.user[name] !== undefined,
        tools: managed.length === 0 ? [] : toolsOf(name, definitions),
        ...decisionView(name, ids),
      })
    }

    const snapshot = getSnapshot()
    const storedNames = new Set([
      ...Object.keys(snapshot.mcp.global.decisions),
      ...(ids.workspaceId === undefined ? [] : Object.keys(snapshot.mcp.workspaces[ids.workspaceId]?.decisions ?? {})),
      ...(ids.sessionId === undefined ? [] : Object.keys(snapshot.mcp.sessions[ids.sessionId]?.decisions ?? {})),
    ])
    for (const name of storedNames) {
      if (rows.has(name)) continue
      rows.set(name, {
        name,
        configured: false,
        origin: 'stored',
        status: { state: 'removed' },
        definition: null,
        definedIn: undefined,
        hasBase: false,
        userDefined: false,
        tools: [],
        ...decisionView(name, ids),
      })
    }

    const servers = [...rows.values()]
      .map((row) => {
        const definitionEnabled = row.status.state !== 'disabled' && row.status.state !== 'missing' && row.status.state !== 'removed'
        const available = definitionEnabled && row.effective.state === 'enabled'
        return { ...row, definitionEnabled, available }
      })
      .sort((left, right) => {
        const rank = (row) => row.origin === 'definition' ? 0 : row.origin === 'plugin' ? 1 : 2
        return rank(left) - rank(right) || left.name.localeCompare(right.name)
      })

    return {
      servers,
      namespace: config?.ns ?? null,
      capabilities: {
        mcp: getManager() !== undefined,
        settings: getSettings() !== undefined,
        writable: config !== null,
        tools: getTools() !== undefined,
      },
      warnings,
    }
  }

  /** @returns {{ servers: Array<object>, capabilities: object }} status-only view for polling. */
  function statusOnly() {
    const definitions = toolDefinitions()
    const servers = managerList().map((server) => ({
      name: server.name,
      configured: server.configured !== false,
      status: server.status ?? { state: 'unknown' },
      toolCount: toolsOf(server.name, definitions).length,
    }))
    return {
      servers,
      capabilities: { mcp: getManager() !== undefined },
    }
  }

  /** @param {unknown} value @param {string} field @returns {string} */
  function requireString(value, field) {
    if (typeof value !== 'string' || value.length === 0) throw new SkillsMcpError('VALIDATION', `${field} is required`)
    return value
  }

  /** @param {unknown} value @param {string} field @returns {number|undefined} */
  function optionalTimeout(value, field) {
    if (value === undefined || value === null || value === '') return undefined
    if (!isTimeout(value)) throw new SkillsMcpError('VALIDATION', `${field} must be a positive integer`)
    return value
  }

  /** @param {unknown} value @param {string} field @returns {{ set: object, remove: string[] }} */
  function secretPatch(value, field) {
    if (value === undefined || value === null) return { set: {}, remove: [] }
    if (!isPlainObject(value)) throw new SkillsMcpError('VALIDATION', `${field} must be an object`)
    const set = value.set === undefined ? {} : stringMap(value.set, MAX_ENV)
    if (!Array.isArray(value.remove) || value.remove.some((key) => typeof key !== 'string')) {
      throw new SkillsMcpError('VALIDATION', `${field}.remove must be an array of strings`)
    }
    return { set: set ?? {}, remove: value.remove }
  }

  /**
   * Validate one add/update payload and return the normalized shape.
   * @param {object} payload - caller payload.
   * @param {{ requireName?: boolean }} [options] - add requires a name.
   * @returns {object} normalized payload.
   */
  function validatePayload(payload, options = {}) {
    if (!isPlainObject(payload)) throw new SkillsMcpError('VALIDATION', 'payload must be an object')
    const name = options.requireName === true ? requireString(payload.name, 'name') : payload.name
    if (options.requireName === true && !isServerName(name)) {
      throw new SkillsMcpError('INVALID_NAME', 'MCP server names must match [A-Za-z0-9_-]{1,32}')
    }
    const transport = payload.transport
    if (transport !== 'stdio' && transport !== 'streamable-http') {
      throw new SkillsMcpError('VALIDATION', 'transport must be stdio or streamable-http')
    }
    const command = typeof payload.command === 'string' ? payload.command : ''
    const url = typeof payload.url === 'string' ? payload.url : ''
    const cwd = typeof payload.cwd === 'string' ? payload.cwd : ''
    if (transport === 'stdio') {
      if (command.trim().length === 0) throw new SkillsMcpError('VALIDATION', 'a stdio server requires a command')
      if (url.length > 0 || payload.headers !== undefined) throw new SkillsMcpError('VALIDATION', 'a stdio server cannot set url or headers')
    } else {
      let parsed
      try {
        parsed = new URL(url)
      } catch {
        throw new SkillsMcpError('VALIDATION', 'an HTTP server requires a valid URL')
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new SkillsMcpError('VALIDATION', 'the URL must be http(s)')
      if (command.length > 0 || payload.args !== undefined || payload.env !== undefined || cwd.length > 0) {
        throw new SkillsMcpError('VALIDATION', 'an HTTP server cannot set command, args, env, or cwd')
      }
    }
    const args = payload.args === undefined ? [] : payload.args
    if (!Array.isArray(args) || args.length > MAX_ARGS || args.some((arg) => typeof arg !== 'string' || arg.length > MAX_ARG_LENGTH)) {
      throw new SkillsMcpError('VALIDATION', `args must be an array of at most ${MAX_ARGS} strings`)
    }
    const env = transport === 'stdio' ? secretPatch(payload.env, 'env') : { set: {}, remove: [] }
    const headers = transport === 'streamable-http' ? secretPatch(payload.headers, 'headers') : { set: {}, remove: [] }
    const startupTimeoutMs = optionalTimeout(payload.startupTimeoutMs, 'startupTimeoutMs')
    const toolCallTimeoutMs = optionalTimeout(payload.toolCallTimeoutMs, 'toolCallTimeoutMs')
    const closeTimeoutMs = optionalTimeout(payload.closeTimeoutMs, 'closeTimeoutMs')
    if (payload.enabled !== undefined && typeof payload.enabled !== 'boolean') {
      throw new SkillsMcpError('VALIDATION', 'enabled must be a boolean')
    }
    return {
      name,
      transport,
      command,
      args,
      url,
      cwd,
      env,
      headers,
      ...(payload.enabled === undefined ? {} : { enabled: payload.enabled }),
      ...(startupTimeoutMs === undefined ? {} : { startupTimeoutMs }),
      ...(toolCallTimeoutMs === undefined ? {} : { toolCallTimeoutMs }),
      ...(closeTimeoutMs === undefined ? {} : { closeTimeoutMs }),
    }
  }

  /** @param {object} normalized @param {object|undefined} existing @returns {object} */
  function buildEntry(normalized, existing) {
    if (normalized.transport === 'stdio') {
      return {
        ...(existing ?? {}),
        transport: 'stdio',
        command: normalized.command,
        args: normalized.args,
        cwd: normalized.cwd,
        env: mergeMap(asMap(existing?.env), normalized.env),
        url: '',
        headers: {},
        enabled: normalized.enabled ?? existing?.enabled ?? true,
        ...(normalized.startupTimeoutMs === undefined ? {} : { startupTimeoutMs: normalized.startupTimeoutMs }),
        ...(normalized.toolCallTimeoutMs === undefined ? {} : { toolCallTimeoutMs: normalized.toolCallTimeoutMs }),
        ...(normalized.closeTimeoutMs === undefined ? {} : { closeTimeoutMs: normalized.closeTimeoutMs }),
      }
    }
    return {
      ...(existing ?? {}),
      transport: 'streamable-http',
      command: '',
      args: [],
      cwd: '',
      env: {},
      url: normalized.url,
      headers: mergeMap(asMap(existing?.headers), normalized.headers),
      enabled: normalized.enabled ?? existing?.enabled ?? true,
      ...(normalized.startupTimeoutMs === undefined ? {} : { startupTimeoutMs: normalized.startupTimeoutMs }),
      ...(normalized.toolCallTimeoutMs === undefined ? {} : { toolCallTimeoutMs: normalized.toolCallTimeoutMs }),
      ...(normalized.closeTimeoutMs === undefined ? {} : { closeTimeoutMs: normalized.closeTimeoutMs }),
    }
  }

  /** @param {object} current @param {{ set: object, remove: string[] }} patch @returns {object} */
  function mergeMap(current, patch) {
    const next = { ...current }
    for (const key of patch.remove) delete next[key]
    for (const [key, value] of Object.entries(patch.set)) next[key] = value
    return next
  }

  /**
   * Write one path-addressed settings change, retrying once after a revision
   * conflict or a transient descriptor change.
   * @param {(ns: string, revision: number) => Promise<void>} apply - write body.
   * @returns {Promise<void>} completion.
   */
  async function writeWithRetry(apply) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const config = readConfig()
      if (config === null) throw new SkillsMcpError('UNAVAILABLE', 'MCP definition editing is unavailable')
      try {
        await apply(config.ns, config.revision)
        return
      } catch (error) {
        if (attempt === 1) throw error
        cachedNamespace = undefined
      }
    }
  }

  /**
   * Add one configured server.
   * @param {object} payload - add payload.
   * @returns {Promise<object>} refreshed server list.
   */
  async function add(payload) {
    const normalized = validatePayload(payload, { requireName: true })
    const config = readConfig()
    if (config === null) throw new SkillsMcpError('UNAVAILABLE', 'MCP definition editing is unavailable')
    if (config.value[normalized.name] !== undefined) {
      throw new SkillsMcpError('MCP_DUPLICATE', `"${normalized.name}" already exists in the MCP configuration`)
    }
    if (managerList().some((server) => server.name === normalized.name)) {
      throw new SkillsMcpError('MCP_DUPLICATE', `"${normalized.name}" is already registered by a plugin or another row`)
    }
    const entry = buildEntry(normalized, undefined)
    await writeWithRetry(async (ns, revision) => {
      await requireSettings().mutate(ns, [{ op: 'set', path: ['servers', normalized.name], value: entry }], revision)
    })
    return listServers()
  }

  /**
   * Update one configured server. Environment/header values absent from the
   * payload keep their stored values.
   * @param {object} payload - update payload.
   * @returns {Promise<object>} refreshed server list.
   */
  async function update(payload) {
    const name = requireString(payload?.name, 'name')
    if (!isServerName(name)) throw new SkillsMcpError('INVALID_NAME', 'invalid MCP server name')
    const config = readConfig()
    if (config === null) throw new SkillsMcpError('UNAVAILABLE', 'MCP definition editing is unavailable')
    const existing = config.value[name] ?? config.base[name]
    if (existing === undefined) throw new SkillsMcpError('NOT_FOUND', `MCP server "${name}" is not configured`)
    if (managerList().some((server) => server.name === name && server.configured === false)) {
      throw new SkillsMcpError('MCP_REGISTERED', `MCP server "${name}" is registered by a plugin and cannot be edited`)
    }
    const normalized = validatePayload({ ...payload, name })
    const entry = buildEntry(normalized, existing)
    await writeWithRetry(async (ns, revision) => {
      await requireSettings().mutate(ns, [{ op: 'set', path: ['servers', name], value: entry }], revision)
    })
    return listServers()
  }

  /**
   * Remove a user-added server. Inherited entries must be reset instead.
   * @param {string} name - server name.
   * @returns {Promise<object>} refreshed server list.
   */
  async function remove(name) {
    const config = readConfig()
    if (config === null) throw new SkillsMcpError('UNAVAILABLE', 'MCP definition editing is unavailable')
    if (managerList().some((server) => server.name === name && server.configured === false)) {
      throw new SkillsMcpError('MCP_REGISTERED', `MCP server "${name}" is registered by a plugin and cannot be removed`)
    }
    if (config.base[name] !== undefined) {
      throw new SkillsMcpError('MCP_INHERITED', `MCP server "${name}" is inherited from the composition; reset it instead`)
    }
    if (config.user[name] === undefined) throw new SkillsMcpError('NOT_FOUND', `MCP server "${name}" is not user-defined`)
    await writeWithRetry(async (ns, revision) => {
      await requireSettings().mutate(ns, [{ op: 'unset', path: ['servers', name] }], revision)
    })
    return listServers()
  }

  /** @param {string} name @returns {Promise<object>} refreshed server list. */
  async function reset(name) {
    const config = readConfig()
    if (config === null) throw new SkillsMcpError('UNAVAILABLE', 'MCP definition editing is unavailable')
    if (config.base[name] === undefined) throw new SkillsMcpError('NOT_FOUND', `MCP server "${name}" has no inherited definition`)
    await writeWithRetry(async (ns, revision) => {
      await requireSettings().mutate(ns, [{ op: 'unset', path: ['servers', name] }], revision)
    })
    return listServers()
  }

  /** @param {string} name @param {boolean} enabled @returns {Promise<object>} refreshed server list. */
  async function setEnabled(name, enabled) {
    if (typeof enabled !== 'boolean') throw new SkillsMcpError('VALIDATION', 'enabled must be a boolean')
    const config = readConfig()
    if (config === null) throw new SkillsMcpError('UNAVAILABLE', 'MCP definition editing is unavailable')
    if (config.value[name] === undefined && config.base[name] === undefined) {
      throw new SkillsMcpError('NOT_FOUND', `MCP server "${name}" is not configured`)
    }
    if (managerList().some((server) => server.name === name && server.configured === false)) {
      throw new SkillsMcpError('MCP_REGISTERED', `MCP server "${name}" is registered by a plugin and cannot be toggled`)
    }
    await writeWithRetry(async (ns, revision) => {
      await requireSettings().mutate(ns, [{ op: 'set', path: ['servers', name, 'enabled'], value: enabled }], revision)
    })
    return listServers()
  }

  /** @param {string} name @param {AbortSignal} [signal] @returns {Promise<object>} probe result. */
  async function probe(name, signal) {
    const manager = getManager()
    if (manager === undefined || typeof manager.probe !== 'function') throw new SkillsMcpError('UNAVAILABLE', 'the MCP manager is not mounted')
    if (!isServerName(name)) throw new SkillsMcpError('INVALID_NAME', 'invalid MCP server name')
    try {
      return await manager.probe(name, { signal })
    } catch (error) {
      throw new SkillsMcpError('MCP_PROBE_FAILED', messageOf(error))
    }
  }

  /** @param {string} name @returns {Promise<void>} completion. */
  async function restart(name) {
    const manager = getManager()
    if (manager === undefined || typeof manager.restart !== 'function') throw new SkillsMcpError('UNAVAILABLE', 'the MCP manager is not mounted')
    if (!isServerName(name)) throw new SkillsMcpError('INVALID_NAME', 'invalid MCP server name')
    try {
      await manager.restart(name)
    } catch (error) {
      throw new SkillsMcpError('MCP_RESTART_FAILED', messageOf(error))
    }
  }

  /** @returns {object} the settings service, throwing when absent. */
  function requireSettings() {
    const settings = getSettings()
    if (settings === undefined || settings === null || typeof settings.mutate !== 'function') {
      throw new SkillsMcpError('UNAVAILABLE', 'MCP definition editing is unavailable')
    }
    return settings
  }

  return {
    listServers,
    statusOnly,
    add,
    update,
    remove,
    reset,
    setEnabled,
    probe,
    restart,
    maskEntry,
  }
}
