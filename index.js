/**
 * Host half of the skills and MCP bundle: scoped availability decisions in a
 * JSON store, per-agent gating through the skill and tool registries, MCP
 * definition management over Settings, and an authenticated metadata route for
 * the Web client.
 * @module @local/dsh-skills-mcp
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createFileStore } from './src/store.js'
import { createService } from './src/service.js'
import { createMcpAdapter } from './src/mcp.js'
import { createGate } from './src/gate.js'
import { createHttpHandler, ROUTE_PATH } from './src/http.js'

/** Stable Cordis plugin name. */
export const name = 'skills-mcp'

/** Services that must exist before this plugin activates. */
export const inject = ['agents', 'workspaceRegistry', 'skills', 'tools', 'systemPrompt']

/** @param {Record<string, unknown>} config @returns {{ path: string, mcpNamespace: string }} */
function resolveConfig(config) {
  const path = config.path
  if (path !== undefined && (typeof path !== 'string' || path.length === 0)) {
    throw new Error('skills-mcp: path must be a non-empty string')
  }
  const mcpNamespace = config.mcpNamespace
  if (mcpNamespace !== undefined && (typeof mcpNamespace !== 'string' || mcpNamespace.length === 0)) {
    throw new Error('skills-mcp: mcpNamespace must be a non-empty string')
  }
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return {
    path: path ?? join(home, 'storages', 'skills-mcp.json'),
    mcpNamespace: mcpNamespace ?? 'mcp-manager',
  }
}

/**
 * Load the plugin.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {Record<string, unknown>} [config] - optional row configuration.
 * @returns {Promise<void>} activation completion.
 */
export async function apply(ctx, config = {}) {
  const resolved = resolveConfig(config)
  const logger = ctx.logger

  const resolveWorkspaceId = (sessionId) => {
    try {
      const workspace = ctx.workspaceRegistry.list().find((candidate) => (candidate.sessionIds ?? []).includes(sessionId))
      return workspace?.id
    } catch {
      return undefined
    }
  }
  const listWorkspaces = () => {
    try {
      return ctx.workspaceRegistry.list().map((workspace) => ({
        id: workspace.id,
        title: workspace.title,
        path: workspace.path,
        sessionIds: [...(workspace.sessionIds ?? [])],
      }))
    } catch {
      return []
    }
  }
  const getWorkspace = (id) => {
    try {
      return ctx.workspaceRegistry.get(id)
    } catch {
      return undefined
    }
  }

  let service
  const mcp = createMcpAdapter({
    getManager: () => ctx.get('mcpManager'),
    getSettings: () => ctx.get('settings'),
    getTools: () => ctx.get('tools'),
    getSnapshot: () => service.snapshot(),
    config: resolved,
  })

  service = createService({
    store: createFileStore(resolved.path),
    getSkills: () => ctx.get('skills'),
    getPresets: () => ctx.get('agentPresets'),
    getAgents: () => ctx.get('agents'),
    getWorkingDirectory: () => ctx.get('workingDirectory'),
    getWorkspace,
    listWorkspaces,
    resolveWorkspaceId,
    getTools: () => ctx.get('tools'),
    getSettings: () => ctx.get('settings'),
    mcp,
    dshHome: process.env.DSH_HOME ?? join(homedir(), '.dsh'),
    logger,
  })

  const gate = createGate({
    getState: () => service.snapshot(),
    getSkills: () => ctx.get('skills'),
    getTools: () => ctx.get('tools'),
    getSystemPrompt: () => ctx.get('systemPrompt'),
    getSubagents: () => ctx.get('subagents'),
    getAgents: () => ctx.get('agents'),
    resolveWorkspaceId,
    logger,
  })

  ctx.on('agent/created', ({ agent }) => {
    if (agent === undefined || agent === null) return
    try {
      gate.attach(agent)
    } catch (error) {
      try {
        logger?.warn?.('skills-mcp: could not attach an agent', error)
      } catch {
        // Logging must never break agent creation.
      }
    }
  })
  ctx.on('session/disposed', (session) => {
    if (typeof session?.id === 'string') gate.detach(session.id)
  })
  ctx.on('tools/change', () => gate.scheduleRefresh())
  ctx.on('tools/pre-execute', async (exec, next) => {
    const reason = await gate.guard(exec)
    if (reason !== false) return reason
    return next()
  })

  ctx.effect(() => service.subscribe(() => gate.refreshAll()))
  ctx.effect(() => () => gate.dispose())

  ctx.inject(['connection'], (connectionCtx) => {
    connectionCtx.effect(() => {
      const dispose = connectionCtx.connection.fetch.register({
        path: ROUTE_PATH,
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        fetch: createHttpHandler(service, logger),
      })
      return () => {
        void dispose()
      }
    })
  })

  await service.ready()
  gate.attachExisting()
  gate.refreshAll()
}
