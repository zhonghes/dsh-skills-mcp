import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFileStore, createMemoryStore } from '../src/store.js'
import { applyDecision, emptySnapshot } from '../src/core.js'

const decision = { domain: 'skills', scope: 'global', name: 'dsh-doc', state: 'disabled' }

test('T-S1 the memory store clones reads and serializes writes', async () => {
  const store = createMemoryStore()
  const empty = await store.read()
  empty.skills.global.decisions.broken = { state: 'enabled' }
  assert.deepEqual((await store.read()).skills.global.decisions, {})

  const snapshot = applyDecision(emptySnapshot(), decision)
  await Promise.all([store.write(snapshot), store.write(snapshot)])
  const read = await store.read()
  assert.equal(read.skills.global.decisions['dsh-doc'].state, 'disabled')
  read.skills.global.decisions['dsh-doc'].state = 'enabled'
  assert.equal((await store.read()).skills.global.decisions['dsh-doc'].state, 'disabled')
})

test('T-S2 the memory store normalizes invalid input', async () => {
  const store = createMemoryStore({ skills: { global: { decisions: { 'Bad Name': { state: 'disabled' } } } } })
  assert.deepEqual((await store.read()).skills.global.decisions, {})
})

test('T-S3 the file store round-trips and creates a missing file as empty state', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skills-mcp-'))
  try {
    const path = join(dir, 'nested', 'state.json')
    const store = createFileStore(path)
    assert.deepEqual(await store.read(), emptySnapshot())
    await store.write(applyDecision(emptySnapshot(), decision))
    const raw = await readFile(path, 'utf8')
    assert.match(raw, /"dsh-doc"/)
    assert.equal((await store.read()).skills.global.decisions['dsh-doc'].state, 'disabled')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('T-S4 the file store reports corrupt JSON with a stable code', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skills-mcp-'))
  try {
    const path = join(dir, 'state.json')
    await writeFile(path, '{ not json', 'utf8')
    await assert.rejects(createFileStore(path).read(), (error) => error.code === 'INVALID_RECORD')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('T-S5 writes are serialized and leave one valid document', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skills-mcp-'))
  try {
    const path = join(dir, 'state.json')
    const store = createFileStore(path)
    for (let index = 0; index < 20; index += 1) {
      await store.write(applyDecision(emptySnapshot(), { ...decision, name: `skill-${index}` }))
    }
    const raw = await readFile(path, 'utf8')
    const parsed = JSON.parse(raw)
    assert.equal(typeof parsed, 'object')
    assert.ok(Object.keys(parsed.skills.global.decisions).length >= 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
