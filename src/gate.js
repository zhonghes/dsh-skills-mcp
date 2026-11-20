/**
 * Per-agent projection of the decision snapshot. Per-agent contributions are
 * registered through `agent.ctx.inject(...)`, which gives a child scope that can
 * see the host services and files its registrations in the agent's layer.
 * @module skills-mcp/gate
 */
import { resolveDecision } from './core.js'

/** Shared resource tools owned by `dsh-mcp-resources`. */
const RESOURCE_TOOLS = new Set(['list_mcp_resources', 'list_mcp_resource_templates', 'read_mcp_resource'])

/** @param {string} name @param {string} server @returns {boolean} */
function belongsToServer(name, server) {
  return name.startsWith(`mcp__${server}__`)
}

/**
 * @param {object} input - gate dependencies.
 * @param {() => object} input.getState - synchronous decision snapshot.
 * @param {() => object|undefined} input.getTools - host tool registry (global reads).
 * @param {() => object|undefined} input.getSubagents - `ctx.subagents`.
 * @param {() => object|undefined} input.getAgents - `ctx.agents`.
 * @param {(sessionId: string) => string|undefined} input.resolveWorkspaceId - workspace lookup.
 * @param {object} [input.logger] - host logger.
 * @returns {object} gate.
 */
export function createGate(input) {
  const { getState, getTools, getSubagents, getAgents, resolveWorkspaceId, logger } = input
  const records = new Map()
  let scheduled = false
  let disposed = false

  const warn = (message, error) => {
    try {
      logger?.warn?.(`skills-mcp: ${message}`, error)
    } catch {
      // Logging must never break a turn.
    }
  }

  /** @param {object} agent @returns {string} */
  function rootSessionId(agent) {
    let current = agent
    const seen = new Set()
    while (current !== undefined && current !== null && !seen.has(current.session.id)) {
      seen.add(current.session.id)
      const parentId = current.session.header?.parentSession
      if (typeof parentId !== 'string' || parentId.length === 0) return current.session.id
      const parent = getAgents?.()?.get?.(parentId)
      if (parent === undefined) {
        try {
          const root = getSubagents?.()?.rootOf?.(agent)
          if (root !== undefined && root !== null && root.session?.id !== agent.session.id) return root.session.id
        } catch {
          // A root lookup failure falls back to the direct parent.
        }
        return parentId
      }
      current = parent
    }
    return agent.session.id
  }

  /** @param {object} agent @returns {{ sessionId: string, workspaceId?: string }} */
  function idsFor(agent) {
    const sessionId = rootSessionId(agent)
    let workspaceId
    try {
      workspaceId = resolveWorkspaceId?.(sessionId)
    } catch {
      workspaceId = undefined
    }
    return { sessionId, ...(typeof workspaceId === 'string' && workspaceId.length > 0 ? { workspaceId } : {}) }
  }

  /**
   * @param {object} snapshot @param {string} domain
   * @param {{ sessionId: string, workspaceId?: string }} ids
   * @returns {Map<string, 'enabled'|'disabled'>}
   */
  function decisionsOf(snapshot, domain, ids) {
    const names = new Set()
    const tree = snapshot[domain]
    for (const name of Object.keys(tree.global.decisions)) names.add(name)
    if (ids.workspaceId !== undefined) {
      for (const name of Object.keys(tree.workspaces[ids.workspaceId]?.decisions ?? {})) names.add(name)
    }
    for (const name of Object.keys(tree.sessions[ids.sessionId]?.decisions ?? {})) names.add(name)
    const out = new Map()
    for (const name of names) out.set(name, resolveDecision(snapshot, domain, name, ids).state)
    return out
  }

  /** @param {object} record @returns {void} */
  function applySkills(record) {
    let snapshot
    try {
      snapshot = getState()
    } catch (error) {
      warn('skill decision snapshot unavailable', error)
      return
    }
    const decisions = decisionsOf(snapshot, 'skills', record.ids)
    const target = new Map()
    for (const [name, state] of decisions) {
      if (state !== 'disabled') continue
      const resolved = resolveDecision(snapshot, 'skills', name, record.ids)
      target.set(name, resolved.decision?.meta ?? null)
    }
    for (const [name, entry] of record.skills) {
      if (target.has(name)) continue
      try {
        entry.dispose?.()
      } catch (error) {
        warn(`could not release skill stub "${name}"`, error)
      }
      record.skills.delete(name)
    }
    if (typeof record.skillRegister !== 'function') return
    for (const [name, meta] of target) {
      const key = JSON.stringify(meta)
      const existing = record.skills.get(name)
      if (existing !== undefined && existing.key === key) continue
      if (existing !== undefined) {
        try {
          existing.dispose?.()
        } catch (error) {
          warn(`could not replace skill stub "${name}"`, error)
        }
        record.skills.delete(name)
      }
      try {
        const dispose = record.skillRegister({
          name,
          description: typeof meta?.description === 'string' && meta.description.length > 0
            ? meta.description
            : 'Disabled for this scope',
          content: '',
          ...(typeof meta?.path === 'string' && meta.path.length > 0 ? { path: meta.path } : {}),
          ...(typeof meta?.source === 'string' && meta.source.length > 0 ? { source: meta.source } : {}),
          ...(typeof meta?.whenToUse === 'string' && meta.whenToUse.length > 0 ? { whenToUse: meta.whenToUse } : {}),
          invocation: { modelInvocable: false, userInvocable: false },
        })
        record.skills.set(name, { dispose, key })
      } catch (error) {
        warn(`could not register the disabled skill stub "${name}"`, error)
      }
    }
  }

  /** @param {object} record @returns {Set<string>} */
  function deniedToolNames(record) {
    let snapshot
    try {
      snapshot = getState()
    } catch {
      return new Set()
    }
    const decisions = decisionsOf(snapshot, 'mcp', record.ids)
    const servers = [...decisions.entries()].filter(([, state]) => state === 'disabled').map(([name]) => name)
    if (servers.length === 0) return new Set()
    let definitions
    try {
      definitions = getTools?.()?.definitions?.()
    } catch (error) {
      warn('tool definitions unavailable for MCP gating', error)
      return new Set()
    }
    if (!Array.isArray(definitions)) return new Set()
    const names = new Set()
    for (const tool of definitions) {
      if (typeof tool?.name !== 'string') continue
      for (const server of servers) {
        if (belongsToServer(tool.name, server)) {
          names.add(tool.name)
          break
        }
      }
    }
    return names
  }

  /** @param {object} record @returns {void} */
  function applyMcpRestriction(record) {
    const target = deniedToolNames(record)
    const previous = record.mcp.denied
    if (previous !== undefined && previous.size === target.size && [...target].every((name) => previous.has(name))) return
    if (typeof record.toolRestrict !== 'function') return
    if (target.size === 0) {
      try {
        record.mcp.dispose?.()
      } catch (error) {
        warn('could not release the MCP tool restriction', error)
      }
      record.mcp.dispose = undefined
      record.mcp.denied = target
      return
    }
    let dispose
    try {
      dispose = record.toolRestrict({ deny: [...target].sort() })
    } catch (error) {
      // A tool may have vanished between the definitions read and the call;
      // the next tools/change retries with the current set.
      warn('could not apply the MCP tool restriction', error)
      return
    }
    try {
      record.mcp.dispose?.()
    } catch (error) {
      warn('could not release the previous MCP tool restriction', error)
    }
    record.mcp.dispose = dispose
    record.mcp.denied = target
  }

  /** @param {object} record @returns {void} */
  function applyMcpSections(record) {
    let snapshot
    try {
      snapshot = getState()
    } catch {
      return
    }
    const decisions = decisionsOf(snapshot, 'mcp', record.ids)
    const target = new Set([...decisions.entries()].filter(([, state]) => state === 'disabled').map(([name]) => name))
    for (const [server, entry] of record.mcp.sections) {
      if (target.has(server)) continue
      try {
        entry.dispose?.()
      } catch (error) {
        warn(`could not release the MCP instruction shadow for "${server}"`, error)
      }
      record.mcp.sections.delete(server)
    }
    if (typeof record.promptSection !== 'function') return
    for (const server of target) {
      if (record.mcp.sections.has(server)) continue
      try {
        const order = typeof record.promptOrder === 'function' ? record.promptOrder('MCP_SERVERS') : undefined
        const dispose = record.promptSection({
          name: `mcp:${server}`,
          ...(order === undefined ? {} : { order }),
          interpolate: false,
          text: () => '',
        })
        record.mcp.sections.set(server, { dispose })
      } catch (error) {
        warn(`could not shadow MCP instructions for "${server}"`, error)
      }
    }
  }

  /** @param {object} record @returns {void} */
  function apply(record) {
    applySkills(record)
    applyMcpRestriction(record)
    applyMcpSections(record)
  }

  /**
   * Install one inject child per service. The child context inherits the agent
   * scope, so registrations land in the agent's layer, and its own `inject`
   * declaration makes the service reachable.
   * @param {object} record @returns {void}
   */
  function mountScopes(record) {
    const agent = record.agent
    const alive = () => records.get(agent.session.id) === record && !disposed

    try {
      record.fibers.push(agent.ctx.inject(['skills'], (scope) => {
        if (!alive()) return
        const skills = scope.skills
        record.skillRegister = (definition) => skills.register(definition)
        applySkills(record)
      }))
    } catch (error) {
      warn('could not install the skill-scope bridge', error)
    }
    try {
      record.fibers.push(agent.ctx.inject(['tools'], (scope) => {
        if (!alive()) return
        const tools = scope.tools
        record.toolRestrict = (filter) => tools.restrict(filter)
        applyMcpRestriction(record)
      }))
    } catch (error) {
      warn('could not install the tool-scope bridge', error)
    }
    try {
      record.fibers.push(agent.ctx.inject(['systemPrompt'], (scope) => {
        if (!alive()) return
        const prompt = scope.systemPrompt
        record.promptSection = (section) => prompt.section(section)
        record.promptOrder = (name) => prompt.getSectionOrder(name)
        applyMcpSections(record)
      }))
    } catch (error) {
      warn('could not install the prompt-scope bridge', error)
    }
  }

  /** @param {object} agent @returns {object} */
  function attach(agent) {
    if (disposed) return undefined
    const key = agent.session.id
    detach(key)
    const ids = idsFor(agent)
    const record = {
      agent,
      ids,
      skills: new Map(),
      mcp: { dispose: undefined, denied: undefined, sections: new Map() },
      skillRegister: undefined,
      toolRestrict: undefined,
      promptSection: undefined,
      promptOrder: undefined,
      fibers: [],
    }
    records.set(key, record)
    mountScopes(record)
    apply(record)
    return record
  }

  /** @param {string} sessionId @returns {void} */
  function detach(sessionId) {
    const record = records.get(sessionId)
    if (record === undefined) return
    records.delete(sessionId)
    for (const entry of record.skills.values()) {
      try {
        entry.dispose?.()
      } catch (error) {
        warn('could not release a skill stub', error)
      }
    }
    try {
      record.mcp.dispose?.()
    } catch (error) {
      warn('could not release the MCP tool restriction', error)
    }
    for (const entry of record.mcp.sections.values()) {
      try {
        entry.dispose?.()
      } catch (error) {
        warn('could not release an MCP instruction shadow', error)
      }
    }
    for (const fiber of record.fibers) {
      try {
        void fiber?.dispose?.()?.catch?.((error) => {
          warn('could not release an agent-scope bridge', error)
        })
      } catch (error) {
        warn('could not release an agent-scope bridge', error)
      }
    }
    record.skills.clear()
    record.mcp.sections.clear()
    record.fibers.length = 0
  }

  /** @returns {void} */
  function refreshAll() {
    if (disposed) return
    for (const record of records.values()) apply(record)
  }

  /** @returns {void} */
  function scheduleRefresh() {
    if (disposed || scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      if (!disposed) refreshAll()
    })
  }

  /** @returns {void} */
  function attachExisting() {
    let agents
    try {
      agents = getAgents?.()?.list?.()
    } catch (error) {
      warn('existing agents could not be listed', error)
      return
    }
    if (!Array.isArray(agents)) return
    for (const agent of agents) {
      try {
        attach(agent)
      } catch (error) {
        warn('an existing agent could not be attached', error)
      }
    }
  }

  /** @param {object} agent @param {string} name @returns {boolean} */
  function isDisabled(agent, name) {
    try {
      const ids = idsFor(agent)
      const snapshot = getState()
      return resolveDecision(snapshot, 'mcp', name, ids).state === 'disabled'
    } catch {
      return false
    }
  }

  /** @param {object} exec @returns {Promise<object|false>} */
  async function guard(exec) {
    const name = exec?.name
    if (typeof name !== 'string' || exec?.agent === undefined) return false
    try {
      if (RESOURCE_TOOLS.has(name)) {
        const server = exec?.args?.server
        if (typeof server === 'string' && isDisabled(exec.agent, server)) {
          return { kind: 'deny', reason: `MCP server "${server}" is disabled for this scope` }
        }
        return false
      }
      if (!name.startsWith('mcp__')) return false
      const snapshot = getState()
      const ids = idsFor(exec.agent)
      for (const [server, state] of decisionsOf(snapshot, 'mcp', ids)) {
        if (state === 'disabled' && belongsToServer(name, server)) {
          return { kind: 'deny', reason: `MCP server "${server}" is disabled for this scope` }
        }
      }
      return false
    } catch (error) {
      warn('MCP call guard failed open', error)
      return false
    }
  }

  /** @returns {void} */
  function dispose() {
    disposed = true
    for (const key of [...records.keys()]) detach(key)
  }

  return {
    attach,
    detach,
    refreshAll,
    scheduleRefresh,
    attachExisting,
    guard,
    dispose,
    records,
    rootSessionId,
    idsFor,
    isDisabled,
  }
}
