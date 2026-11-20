/**
 * HTTP-facing application service: owns the decision snapshot, resolves scope
 * contexts, and composes the skill catalog with the MCP adapter. The gate reads
 * the same snapshot synchronously through {@link createService}.
 * @module skills-mcp/service
 */
import {
  applyDecision,
  emptySnapshot,
  explicitDecisions,
  normalizeSnapshot,
  resolveDecision,
  shadowedDecisions,
  SkillsMcpError,
} from './core.js'
import { collectSkillCatalog } from './catalog.js'

/** @param {unknown} value @returns {string|undefined} */
function messageOf(value) {
  if (value instanceof Error) return value.message
  return String(value)
}

/** @param {string} scope @returns {boolean} */
function isScope(scope) {
  return scope === 'global' || scope === 'workspace' || scope === 'session'
}

/** @param {object} input - service dependencies. */
export function createService(input) {
  const {
    store,
    getSkills,
    getPresets,
    getAgents,
    getWorkingDirectory,
    getWorkspace,
    listWorkspaces,
    resolveWorkspaceId,
    getTools,
    getSettings,
    mcp,
    dshHome,
    logger,
  } = input

  let current = emptySnapshot()
  let readyPromise
  let writeChain = Promise.resolve()
  const listeners = new Set()
  const loadWarnings = []

  const report = (message, error) => {
    try {
      logger?.warn?.(`skills-mcp: ${message}`, error)
    } catch {
      // Logging must never break a request.
    }
  }

  async function load() {
    try {
      current = normalizeSnapshot(await store.read())
    } catch (error) {
      loadWarnings.push({ code: 'STORE_UNREADABLE', message: `stored decisions could not be read: ${messageOf(error)}` })
      report('stored decisions could not be read; starting empty', error)
      current = emptySnapshot()
    }
  }

  /** @returns {Promise<void>} resolves after the first read. */
  function ready() {
    readyPromise ??= load()
    return readyPromise
  }

  /** @returns {object} the current snapshot (synchronous for the gate). */
  function snapshot() {
    return current
  }

  /** @param {() => void} listener @returns {() => void} disposer. */
  function subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  /** @param {(snapshot: object) => object} mutate @returns {Promise<object>} the committed snapshot. */
  function commit(mutate) {
    const task = writeChain.then(async () => {
      const next = normalizeSnapshot(mutate(current))
      await store.write(next)
      current = next
      for (const listener of [...listeners]) {
        try {
          listener()
        } catch (error) {
          report('a decision listener failed', error)
        }
      }
      return current
    })
    writeChain = task.catch(() => undefined)
    return task
  }

  /** @param {string} scope @param {string} workspaceId @param {string} sessionId @returns {{ workspaceId?: string, sessionId?: string }} */
  function idsFor(scope, workspaceId, sessionId) {
    if (scope === 'global') return {}
    if (scope === 'workspace') {
      if (typeof workspaceId !== 'string' || workspaceId.length === 0) throw new SkillsMcpError('INVALID_SCOPE', 'workspaceId is required')
      return { workspaceId }
    }
    if (typeof sessionId !== 'string' || sessionId.length === 0) throw new SkillsMcpError('INVALID_SCOPE', 'sessionId is required')
    let resolved = workspaceId
    if (typeof resolved !== 'string' || resolved.length === 0) {
      try {
        resolved = resolveWorkspaceId(sessionId)
      } catch {
        resolved = undefined
      }
    }
    return { ...(typeof resolved === 'string' && resolved.length > 0 ? { workspaceId: resolved } : {}), sessionId }
  }

  /** @param {object} row @param {{ workspaceId?: string, sessionId?: string }} ids @returns {object} */
  function decorateSkill(row, ids) {
    const explicit = explicitDecisions(current, 'skills', row.name, ids)
    const resolved = resolveDecision(current, 'skills', row.name, ids)
    return {
      ...row,
      decisions: Object.fromEntries(explicit.map((entry) => [entry.scope, {
        state: entry.state,
        ...(entry.decision.meta === undefined ? {} : { meta: entry.decision.meta }),
      }])),
      effective: { state: resolved.state, scope: resolved.scope },
      shadowed: explicit.slice(1).map((entry) => ({
        scope: entry.scope,
        state: entry.state,
        ...(entry.decision.meta === undefined ? {} : { meta: entry.decision.meta }),
      })),
    }
  }

  /** @param {{ workspaceId?: string, sessionId?: string }} ids @returns {object[]} */
  function storedSkillRows(ids) {
    const names = new Map()
    const add = (scope, decisions) => {
      for (const [name, decision] of Object.entries(decisions)) {
        if (!names.has(name)) names.set(name, { scope, decision })
      }
    }
    add('global', current.skills.global.decisions)
    if (ids.workspaceId !== undefined) add('workspace', current.skills.workspaces[ids.workspaceId]?.decisions ?? {})
    if (ids.sessionId !== undefined) add('session', current.skills.sessions[ids.sessionId]?.decisions ?? {})
    return [...names.entries()].map(([name, { decision }]) => {
      const meta = decision.meta ?? {}
      return decorateSkill({
        name,
        description: meta.description ?? '',
        ...(meta.whenToUse === undefined ? {} : { whenToUse: meta.whenToUse }),
        ...(meta.path === undefined ? {} : { path: meta.path }),
        source: meta.source ?? 'runtime',
        provider: 'runtime',
        invocation: { modelInvocable: false, userInvocable: false },
        presets: [],
        missing: true,
      }, ids)
    })
  }

  /**
   * Resolve the cwd/preset of one skill view.
   * @param {{ scope: string, workspaceId?: string, sessionId?: string }} request - view request.
   * @returns {{ cwd: string, presetId?: string, workspaceId?: string, sessionId?: string, live: boolean, workspace?: object }}
   */
  function skillContext(request) {
    if (!isScope(request.scope)) throw new SkillsMcpError('INVALID_SCOPE', 'unknown skill scope')
    if (request.scope === 'global') {
      return { cwd: dshHome, live: false }
    }
    if (request.scope === 'workspace') {
      if (typeof request.workspaceId !== 'string' || request.workspaceId.length === 0) {
        throw new SkillsMcpError('INVALID_SCOPE', 'workspaceId is required')
      }
      const workspace = getWorkspace?.(request.workspaceId)
      if (workspace === undefined || workspace === null) throw new SkillsMcpError('NOT_FOUND', `workspace "${request.workspaceId}" was not found`)
      return { cwd: workspace.path ?? dshHome, workspaceId: request.workspaceId, live: false, workspace }
    }
    if (typeof request.sessionId !== 'string' || request.sessionId.length === 0) {
      throw new SkillsMcpError('INVALID_SCOPE', 'sessionId is required')
    }
    const agents = getAgents?.()
    const agent = typeof agents?.get === 'function' ? agents.get(request.sessionId) : undefined
    let workspaceId = request.workspaceId
    if (typeof workspaceId !== 'string' || workspaceId.length === 0) {
      try {
        workspaceId = resolveWorkspaceId(request.sessionId)
      } catch {
        workspaceId = undefined
      }
    }
    const workspace = typeof workspaceId === 'string' ? getWorkspace?.(workspaceId) : undefined
    let cwd = workspace?.path ?? dshHome
    if (agent !== undefined) {
      try {
        cwd = getWorkingDirectory?.()?.get?.(agent.session) ?? cwd
      } catch {
        // A missing working-directory service leaves the workspace path.
      }
    }
    let presetId
    if (agent !== undefined) {
      try {
        presetId = getPresets?.()?.composedPreset?.(agent.ctx)
      } catch {
        presetId = undefined
      }
    }
    return {
      cwd,
      ...(typeof presetId === 'string' && presetId.length > 0 ? { presetId } : {}),
      ...(typeof workspaceId === 'string' && workspaceId.length > 0 ? { workspaceId } : {}),
      sessionId: request.sessionId,
      live: agent !== undefined,
      ...(workspace === undefined ? {} : { workspace }),
    }
  }

  /**
   * Read the effective skill catalog for one scope.
   * @param {{ scope: string, workspaceId?: string, sessionId?: string, signal?: AbortSignal }} request - view request.
   * @returns {Promise<object>} skill view.
   */
  async function skillsView(request) {
    await ready()
    const context = skillContext(request)
    const ids = idsFor(request.scope, context.workspaceId, context.sessionId)
    const catalog = await collectSkillCatalog({
      skills: getSkills?.(),
      presets: getPresets?.(),
      cwd: context.cwd,
      ...(context.presetId === undefined ? {} : { presetId: context.presetId }),
      signal: request.signal,
    })
    const rows = catalog.skills.map((row) => decorateSkill(row, ids))
    const seen = new Set(rows.map((row) => row.name))
    const missing = storedSkillRows(ids).filter((row) => !seen.has(row.name))
    return {
      scope: request.scope,
      ...(context.workspaceId === undefined ? {} : { workspaceId: context.workspaceId }),
      ...(context.sessionId === undefined ? {} : { sessionId: context.sessionId }),
      cwd: context.cwd,
      ...(context.presetId === undefined ? {} : { presetId: context.presetId }),
      live: context.live,
      complete: catalog.complete,
      skills: [...rows, ...missing].sort((left, right) => left.name.localeCompare(right.name)),
      warnings: [...loadWarnings, ...catalog.warnings],
    }
  }

  /**
   * Read the MCP view for one scope.
   * @param {{ scope: string, workspaceId?: string, sessionId?: string }} request - view request.
   * @returns {Promise<object>} MCP view.
   */
  async function mcpView(request) {
    await ready()
    if (!isScope(request.scope)) throw new SkillsMcpError('INVALID_SCOPE', 'unknown MCP scope')
    const ids = idsFor(request.scope, request.workspaceId, request.sessionId)
    const result = mcp.listServers(ids)
    return {
      scope: request.scope,
      ...(ids.workspaceId === undefined ? {} : { workspaceId: ids.workspaceId }),
      ...(ids.sessionId === undefined ? {} : { sessionId: ids.sessionId }),
      ...result,
      warnings: [...loadWarnings, ...(result.warnings ?? [])],
    }
  }

  /**
   * Store one skill decision.
   * @param {{ scope: string, workspaceId?: string, sessionId?: string, name: string, state: string, meta?: object }} request - decision.
   * @returns {Promise<void>} completion.
   */
  async function setSkillDecision(request) {
    await ready()
    if (!isScope(request.scope)) throw new SkillsMcpError('INVALID_SCOPE', 'unknown skill scope')
    idsFor(request.scope, request.workspaceId, request.sessionId)
    await commit((snapshot) => applyDecision(snapshot, {
      domain: 'skills',
      scope: request.scope,
      workspaceId: request.workspaceId,
      sessionId: request.sessionId,
      name: request.name,
      state: request.state,
      meta: request.meta,
    }))
  }

  /**
   * Store one MCP availability decision.
   * @param {{ scope: string, workspaceId?: string, sessionId?: string, name: string, state: string }} request - decision.
   * @returns {Promise<void>} completion.
   */
  async function setMcpDecision(request) {
    await ready()
    if (!isScope(request.scope)) throw new SkillsMcpError('INVALID_SCOPE', 'unknown MCP scope')
    idsFor(request.scope, request.workspaceId, request.sessionId)
    await commit((snapshot) => applyDecision(snapshot, {
      domain: 'mcp',
      scope: request.scope,
      workspaceId: request.workspaceId,
      sessionId: request.sessionId,
      name: request.name,
      state: request.state,
    }))
  }

  /** @returns {Promise<object>} overview data for the panels. */
  async function overview() {
    await ready()
    let workspaces = []
    try {
      const listed = listWorkspaces?.()
      workspaces = Array.isArray(listed) ? listed : []
    } catch (error) {
      report('workspace listing failed', error)
    }
    let presets = []
    try {
      const listed = await getPresets?.()?.list?.()
      presets = Array.isArray(listed)
        ? listed.filter((preset) => preset?.broken === undefined).map((preset) => ({
          id: preset.id,
          ...(preset.name === undefined ? {} : { name: preset.name }),
        }))
        : []
    } catch (error) {
      report('preset listing failed', error)
    }
    return {
      workspaces,
      presets,
      capabilities: {
        skills: getSkills?.() !== undefined,
        presets: getPresets?.() !== undefined,
        mcp: mcp !== undefined,
        tools: getTools?.() !== undefined,
        settings: getSettings?.() !== undefined,
      },
      warnings: [...loadWarnings],
    }
  }

  /** @returns {Promise<object>} status-only MCP view for polling. */
  async function mcpStatus() {
    await ready()
    return { ...mcp.statusOnly(), warnings: [...loadWarnings] }
  }

  return {
    ready,
    snapshot,
    subscribe,
    overview,
    skillsView,
    mcpView,
    mcpStatus,
    setSkillDecision,
    setMcpDecision,
    mcp,
  }
}
