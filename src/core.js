/**
 * Pure decision model for scoped skills and MCP availability. No I/O: the
 * service persists the snapshot this module returns, and the gate reads the
 * resolved decisions through it.
 * @module skills-mcp/core
 */

/** Stable decision scopes, nearest first. */
export const DECISION_SCOPES = ['session', 'workspace', 'global']

/** Domains that carry independent decision trees. */
export const DOMAINS = ['skills', 'mcp']

/** Maximum explicit decisions kept per scope. */
export const MAX_DECISIONS_PER_SCOPE = 500

/** Maximum length of one stored metadata string. */
export const MAX_META_LENGTH = 4096

const SKILL_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SERVER_NAME = /^[A-Za-z0-9_-]{1,32}$/
const SCOPE_IDS = new Set(DECISION_SCOPES)
const DOMAIN_IDS = new Set(DOMAINS)
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const META_FIELDS = ['description', 'path', 'source', 'whenToUse']

/** Error with a stable code the HTTP layer maps to a status. */
export class SkillsMcpError extends Error {
  /**
   * @param {string} code - stable error code.
   * @param {string} message - human-readable message.
   */
  constructor(code, message) {
    super(message)
    this.name = 'SkillsMcpError'
    this.code = code
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** @param {string} name @returns {boolean} */
export function isSkillName(name) {
  return typeof name === 'string' && SKILL_NAME.test(name)
}

/** @param {string} name @returns {boolean} */
export function isServerName(name) {
  return typeof name === 'string' && SERVER_NAME.test(name)
}

/** @param {unknown} value @returns {boolean} */
export function isDecisionScope(value) {
  return typeof value === 'string' && SCOPE_IDS.has(value)
}

/** @param {unknown} value @returns {boolean} */
export function isDomain(value) {
  return typeof value === 'string' && DOMAIN_IDS.has(value)
}

/** @param {string} id @returns {boolean} */
export function isScopeId(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && !RESERVED_KEYS.has(id)
}

/** @returns {{ global: { decisions: object }, workspaces: object, sessions: object }} */
function emptyDomain() {
  return { global: { decisions: {} }, workspaces: {}, sessions: {} }
}

/** @returns {{ version: number, skills: object, mcp: object }} */
export function emptySnapshot() {
  return { version: 1, skills: emptyDomain(), mcp: emptyDomain() }
}

/** @param {unknown} value @param {number} max @returns {string|undefined} */
function boundedString(value, max) {
  if (typeof value !== 'string' || value.length === 0) return undefined
  return value.length > max ? value.slice(0, max) : value
}

/**
 * Keep only the routing metadata the stub needs to stay readable in the UI.
 * @param {unknown} meta - caller-supplied metadata.
 * @returns {Record<string, string>|undefined} sanitized metadata.
 */
export function sanitizeMeta(meta) {
  if (!isPlainObject(meta)) return undefined
  const out = {}
  let present = false
  for (const field of META_FIELDS) {
    const value = boundedString(meta[field], MAX_META_LENGTH)
    if (value !== undefined) {
      out[field] = value
      present = true
    }
  }
  return present ? out : undefined
}

/** @param {unknown} value @param {string} domain @returns {string|undefined} */
function sanitizeName(value, domain) {
  if (domain === 'skills') return isSkillName(value) ? value : undefined
  return isServerName(value) ? value : undefined
}

/** @param {unknown} decision @param {string} domain @returns {object|undefined} */
function sanitizeDecision(decision, domain) {
  if (!isPlainObject(decision)) return undefined
  const state = decision.state
  if (state !== 'enabled' && state !== 'disabled') return undefined
  if (domain !== 'skills') return { state }
  const meta = sanitizeMeta(decision.meta)
  return meta === undefined ? { state } : { state, meta }
}

/** @param {unknown} decisions @param {string} domain @returns {Record<string, object>} */
function sanitizeDecisions(decisions, domain) {
  const out = {}
  if (!isPlainObject(decisions)) return out
  let count = 0
  for (const [name, decision] of Object.entries(decisions)) {
    if (count >= MAX_DECISIONS_PER_SCOPE) break
    const validName = sanitizeName(name, domain)
    if (validName === undefined) continue
    const validDecision = sanitizeDecision(decision, domain)
    if (validDecision === undefined) continue
    out[validName] = validDecision
    count += 1
  }
  return out
}

/** @param {object} input @param {string} domain @returns {object} */
function sanitizeDomain(input, domain) {
  const source = isPlainObject(input) ? input : {}
  const global = isPlainObject(source.global) ? source.global : {}
  const out = emptyDomain()
  out.global.decisions = sanitizeDecisions(global.decisions, domain)
  for (const [scope, container] of [['workspaces', source.workspaces], ['sessions', source.sessions]]) {
    if (!isPlainObject(container)) continue
    for (const [id, value] of Object.entries(container)) {
      if (!isScopeId(id)) continue
      if (!isPlainObject(value)) continue
      out[scope][id] = { decisions: sanitizeDecisions(value.decisions, domain) }
    }
  }
  return out
}

/**
 * Normalize persisted or caller-supplied state. Never throws: unknown fields
 * and malformed entries are dropped so a corrupt document cannot break the
 * plugin.
 * @param {unknown} input - raw snapshot.
 * @returns {{ version: number, skills: object, mcp: object }} normalized snapshot.
 */
export function normalizeSnapshot(input) {
  const source = isPlainObject(input) ? input : {}
  return {
    version: 1,
    skills: sanitizeDomain(source.skills, 'skills'),
    mcp: sanitizeDomain(source.mcp, 'mcp'),
  }
}

/**
 * Return one scope's decision map.
 * @param {object} snapshot - normalized snapshot.
 * @param {string} domain - `skills` or `mcp`.
 * @param {string} scope - decision scope.
 * @param {{ workspaceId?: string, sessionId?: string }} [ids] - scope identity.
 * @returns {Record<string, object>} decisions.
 */
export function decisionsAt(snapshot, domain, scope, ids = {}) {
  const tree = snapshot[domain]
  if (tree === undefined) return {}
  if (scope === 'global') return tree.global.decisions
  const id = scope === 'workspace' ? ids.workspaceId : ids.sessionId
  if (typeof id !== 'string') return {}
  const bucket = scope === 'workspace' ? tree.workspaces[id] : tree.sessions[id]
  return bucket?.decisions ?? {}
}

/**
 * Resolve one item's effective decision. The nearest explicit decision wins;
 * an absent decision means enabled.
 * @param {object} snapshot - normalized snapshot.
 * @param {string} domain - `skills` or `mcp`.
 * @param {string} name - skill or server name.
 * @param {{ workspaceId?: string, sessionId?: string }} [ids] - scope identity.
 * @returns {{ state: 'enabled'|'disabled', scope: 'session'|'workspace'|'global'|'default', decision: object|null }}
 */
export function resolveDecision(snapshot, domain, name, ids = {}) {
  for (const scope of DECISION_SCOPES) {
    const decision = decisionsAt(snapshot, domain, scope, ids)[name]
    if (decision !== undefined) return { state: decision.state, scope, decision }
  }
  return { state: 'enabled', scope: 'default', decision: null }
}

/**
 * Every explicit decision for one item, nearest first.
 * @param {object} snapshot - normalized snapshot.
 * @param {string} domain - `skills` or `mcp`.
 * @param {string} name - skill or server name.
 * @param {{ workspaceId?: string, sessionId?: string }} [ids] - scope identity.
 * @returns {Array<{ scope: string, state: string, decision: object }>} explicit decisions.
 */
export function explicitDecisions(snapshot, domain, name, ids = {}) {
  const out = []
  for (const scope of DECISION_SCOPES) {
    const decision = decisionsAt(snapshot, domain, scope, ids)[name]
    if (decision !== undefined) out.push({ scope, state: decision.state, decision })
  }
  return out
}

/**
 * Explicit decisions that lose to a nearer explicit decision (the UI's
 * “overridden” rows).
 * @param {object} snapshot - normalized snapshot.
 * @param {string} domain - `skills` or `mcp`.
 * @param {string} name - skill or server name.
 * @param {{ workspaceId?: string, sessionId?: string }} [ids] - scope identity.
 * @returns {Array<{ scope: string, state: string, decision: object }>} shadowed decisions.
 */
export function shadowedDecisions(snapshot, domain, name, ids = {}) {
  return explicitDecisions(snapshot, domain, name, ids).slice(1)
}

/** @param {string} scope @param {{ workspaceId?: string, sessionId?: string }} ids @returns {string|undefined} */
function scopeIdFor(scope, ids) {
  if (scope === 'workspace') return ids.workspaceId
  if (scope === 'session') return ids.sessionId
  return undefined
}

/** @param {object} snapshot @param {string} domain @returns {object} */
function ensureScopeBucket(snapshot, domain, scope, ids) {
  const tree = snapshot[domain]
  const id = scopeIdFor(scope, ids)
  if (id === undefined || !isScopeId(id)) {
    throw new SkillsMcpError('INVALID_SCOPE', `a valid ${scope} id is required`)
  }
  const key = scope === 'workspace' ? 'workspaces' : 'sessions'
  if (!isPlainObject(tree[key][id])) tree[key][id] = { decisions: {} }
  return tree[key][id]
}

/**
 * Set, clear, or replace one explicit decision and return a new snapshot.
 * `state: 'inherit'` removes the decision.
 * @param {object} snapshot - normalized snapshot.
 * @param {{ domain: string, scope: string, workspaceId?: string, sessionId?: string, name: string, state: string, meta?: object }} input - decision change.
 * @returns {object} new normalized snapshot.
 */
export function applyDecision(snapshot, input) {
  if (!isDomain(input?.domain)) throw new SkillsMcpError('INVALID_INPUT', 'unknown decision domain')
  if (!isDecisionScope(input?.scope)) throw new SkillsMcpError('INVALID_SCOPE', 'unknown decision scope')
  if (input.state !== 'enabled' && input.state !== 'disabled' && input.state !== 'inherit') {
    throw new SkillsMcpError('INVALID_STATE', 'state must be enabled, disabled, or inherit')
  }
  const name = sanitizeName(input.name, input.domain)
  if (name === undefined) throw new SkillsMcpError('INVALID_NAME', `invalid ${input.domain === 'skills' ? 'skill' : 'MCP server'} name`)
  const next = structuredClone(normalizeSnapshot(snapshot))
  const target = input.scope === 'global' ? next[input.domain].global : ensureScopeBucket(next, input.domain, input.scope, input)
  if (input.state === 'inherit') {
    delete target.decisions[name]
  } else {
    const decision = input.domain === 'skills'
      ? { state: input.state, ...(sanitizeMeta(input.meta) === undefined ? {} : { meta: sanitizeMeta(input.meta) }) }
      : { state: input.state }
    target.decisions[name] = decision
  }
  return next
}

/**
 * Return the explicit decisions of one scope (used by the UI's “clear stale”
 * action and by tests).
 * @param {object} snapshot - normalized snapshot.
 * @param {string} domain - `skills` or `mcp`.
 * @param {string} scope - decision scope.
 * @param {{ workspaceId?: string, sessionId?: string }} [ids] - scope identity.
 * @returns {string[]} names with a decision.
 */
export function decisionNames(snapshot, domain, scope, ids = {}) {
  return Object.keys(decisionsAt(snapshot, domain, scope, ids))
}
