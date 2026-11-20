/**
 * Snapshot persistence for scoped skill and MCP decisions. The memory store
 * serves tests and pathless compositions; the file store keeps one JSON
 * document with serialized atomic replaces.
 * @module skills-mcp/store
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { emptySnapshot, normalizeSnapshot } from './core.js'

/** @param {unknown} value @returns {object} */
function clone(value) {
  return structuredClone(value)
}

/**
 * In-memory store.
 * @param {unknown} [initial] - optional starting snapshot.
 * @returns {{ read(): Promise<object>, write(snapshot: object): Promise<void> }}
 */
export function createMemoryStore(initial) {
  let state = initial === undefined ? emptySnapshot() : normalizeSnapshot(initial)
  let chain = Promise.resolve()
  return {
    async read() {
      await chain
      return clone(state)
    },
    write(snapshot) {
      const next = normalizeSnapshot(snapshot)
      chain = chain.then(() => {
        state = clone(next)
      })
      return chain
    },
  }
}

/**
 * JSON file store: one document, atomic replace, owner-only permissions.
 * A missing file is valid empty state; unreadable JSON fails with
 * `code: 'INVALID_RECORD'` so the service can fall back and warn.
 * @param {string} filePath - absolute document path.
 * @returns {{ read(): Promise<object>, write(snapshot: object): Promise<void> }}
 */
export function createFileStore(filePath) {
  let chain = Promise.resolve()
  return {
    async read() {
      await chain
      let raw
      try {
        raw = await readFile(filePath, 'utf8')
      } catch (error) {
        if (error !== null && typeof error === 'object' && error.code === 'ENOENT') return emptySnapshot()
        const failure = new Error(`cannot read ${filePath}: ${String(error)}`)
        failure.code = 'IO'
        throw failure
      }
      let parsed
      try {
        parsed = JSON.parse(raw)
      } catch {
        const failure = new Error(`stored snapshot is not JSON: ${filePath}`)
        failure.code = 'INVALID_RECORD'
        throw failure
      }
      return normalizeSnapshot(parsed)
    },
    write(snapshot) {
      const next = normalizeSnapshot(snapshot)
      chain = chain.then(async () => {
        await mkdir(dirname(filePath), { recursive: true, mode: 0o700 })
        const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`
        await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
        await rename(temporary, filePath)
      })
      return chain
    },
  }
}
