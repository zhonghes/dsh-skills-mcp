/**
 * Authenticated JSON route for the Web client. Reads return effective skill and
 * MCP views; writes store decisions or edit MCP definitions through the
 * Settings service. Responses never carry environment/header values.
 * @module skills-mcp/http
 */
import { SkillsMcpError, isServerName, isSkillName } from './core.js'

/** Exact shared-channel path: the connection service matches the full pathname. */
export const ROUTE_PATH = '/api/skills-mcp'

const MAX_BODY_BYTES = 262_144

/** @param {number} status @param {unknown} body @returns {Response} */
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** @param {SkillsMcpError} error @returns {number} */
function statusOf(error) {
  switch (error.code) {
    case 'INVALID_NAME':
    case 'INVALID_INPUT':
    case 'INVALID_STATE':
    case 'INVALID_SCOPE':
    case 'VALIDATION':
      return 422
    case 'NOT_FOUND':
      return 404
    case 'MCP_DUPLICATE':
    case 'MCP_INHERITED':
    case 'MCP_REGISTERED':
      return 409
    case 'UNAVAILABLE':
      return 503
    case 'MCP_PROBE_FAILED':
    case 'MCP_RESTART_FAILED':
      return 502
    case 'UNKNOWN_OP':
      return 400
    default:
      return 500
  }
}

/** @param {unknown} error @returns {Response} */
function failure(error) {
  if (error instanceof SkillsMcpError) {
    return json(statusOf(error), { ok: false, error: error.code, message: error.message })
  }
  return json(500, { ok: false, error: 'INTERNAL', message: 'skills-mcp request failed' })
}

/** @param {unknown} value @param {string} field @returns {string} */
function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new SkillsMcpError('INVALID_INPUT', `${field} is required`)
  return value
}

/** @param {unknown} value @param {string} field @returns {string|undefined} */
function optionalString(value, field) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string' || value.length === 0) throw new SkillsMcpError('INVALID_INPUT', `${field} must be a non-empty string`)
  return value
}

/** @param {URLSearchParams|object} container @param {string} key @returns {string|null|undefined} */
function readParam(container, key) {
  return container instanceof URLSearchParams ? container.get(key) : container[key]
}

/** @param {URLSearchParams|object} container @returns {{ scope: string, workspaceId?: string, sessionId?: string }} */
function readScope(container) {
  const scope = readParam(container, 'scope')
  if (scope !== 'global' && scope !== 'workspace' && scope !== 'session') {
    throw new SkillsMcpError('INVALID_SCOPE', 'scope must be global, workspace, or session')
  }
  const workspaceId = optionalString(readParam(container, 'workspaceId'), 'workspaceId')
  const sessionId = optionalString(readParam(container, 'sessionId'), 'sessionId')
  if (scope === 'workspace' && workspaceId === undefined) {
    throw new SkillsMcpError('INVALID_SCOPE', 'workspaceId is required for workspace scope')
  }
  if (scope === 'session' && sessionId === undefined) {
    throw new SkillsMcpError('INVALID_SCOPE', 'sessionId is required for session scope')
  }
  return {
    scope,
    ...(workspaceId === undefined ? {} : { workspaceId }),
    ...(sessionId === undefined ? {} : { sessionId }),
  }
}

/** @param {unknown} value @returns {string} */
function readState(value) {
  if (value !== 'enabled' && value !== 'disabled' && value !== 'inherit') {
    throw new SkillsMcpError('INVALID_STATE', 'state must be enabled, disabled, or inherit')
  }
  return value
}

/**
 * Read and parse a size-capped JSON body.
 * @param {Request} request - incoming request.
 * @returns {Promise<object>} parsed object.
 */
async function readBody(request) {
  const declared = request.headers.get('content-length')
  if (declared !== null && Number(declared) > MAX_BODY_BYTES) {
    throw new SkillsMcpError('INVALID_INPUT', 'request body is too large')
  }
  const text = await request.text()
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    throw new SkillsMcpError('INVALID_INPUT', 'request body is too large')
  }
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new SkillsMcpError('INVALID_INPUT', 'request body must be JSON')
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new SkillsMcpError('INVALID_INPUT', 'request body must be an object')
  }
  return body
}

/**
 * Build the Fetch handler mounted by the connection service.
 * @param {object} service - the skills/MCP service.
 * @param {{ warn?: Function }} [logger] - optional host logger.
 * @returns {(request: Request) => Promise<Response>} route handler.
 */
export function createHttpHandler(service, logger) {
  return async function handle(request) {
    try {
      if (request.method === 'GET') {
        const url = new URL(request.url)
        const op = url.searchParams.get('op')
        switch (op) {
          case 'overview':
            return json(200, { ok: true, data: await service.overview() })
          case 'skills':
            return json(200, { ok: true, data: await service.skillsView({ ...readScope(url.searchParams), signal: request.signal }) })
          case 'mcp':
            return json(200, { ok: true, data: await service.mcpView(readScope(url.searchParams)) })
          case 'mcpStatus':
            return json(200, { ok: true, data: await service.mcpStatus() })
          default:
            throw new SkillsMcpError('UNKNOWN_OP', `unknown operation ${String(op)}`)
        }
      }

      if (request.method === 'POST') {
        const body = await readBody(request)
        switch (body.op) {
          case 'setSkillDecision': {
            const scope = readScope(body)
            const name = requireString(body.name, 'name')
            if (!isSkillName(name)) throw new SkillsMcpError('INVALID_NAME', 'skill names must be kebab-case')
            await service.setSkillDecision({
              ...scope,
              name,
              state: readState(body.state),
              ...(body.meta === undefined ? {} : { meta: body.meta }),
            })
            return json(200, { ok: true, data: {} })
          }
          case 'setMcpDecision': {
            const scope = readScope(body)
            const name = requireString(body.name, 'name')
            if (!isServerName(name)) throw new SkillsMcpError('INVALID_NAME', 'MCP server names must match [A-Za-z0-9_-]{1,32}')
            await service.setMcpDecision({ ...scope, name, state: readState(body.state) })
            return json(200, { ok: true, data: {} })
          }
          case 'addMcp': {
            await service.mcp.add(body)
            return json(200, { ok: true, data: {} })
          }
          case 'updateMcp': {
            await service.mcp.update(body)
            return json(200, { ok: true, data: {} })
          }
          case 'removeMcp': {
            await service.mcp.remove(requireString(body.name, 'name'))
            return json(200, { ok: true, data: {} })
          }
          case 'resetMcp': {
            await service.mcp.reset(requireString(body.name, 'name'))
            return json(200, { ok: true, data: {} })
          }
          case 'setMcpEnabled': {
            const name = requireString(body.name, 'name')
            if (typeof body.enabled !== 'boolean') throw new SkillsMcpError('INVALID_INPUT', 'enabled must be a boolean')
            await service.mcp.setEnabled(name, body.enabled)
            return json(200, { ok: true, data: {} })
          }
          case 'probeMcp': {
            const name = requireString(body.name, 'name')
            return json(200, { ok: true, data: await service.mcp.probe(name, request.signal) })
          }
          case 'restartMcp': {
            await service.mcp.restart(requireString(body.name, 'name'))
            return json(200, { ok: true, data: {} })
          }
          default:
            throw new SkillsMcpError('UNKNOWN_OP', `unknown operation ${String(body.op)}`)
        }
      }

      return json(405, { ok: false, error: 'METHOD_NOT_ALLOWED', message: 'only GET and POST are supported' })
    } catch (error) {
      if (!(error instanceof SkillsMcpError)) {
        try {
          logger?.warn?.('skills-mcp: request failed', error)
        } catch {
          // Logging must never break the response.
        }
      }
      return failure(error)
    }
  }
}
