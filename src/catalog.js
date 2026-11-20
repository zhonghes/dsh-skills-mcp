/**
 * Skill catalog aggregation across agent presets. Each preset owns its own
 * skill-filesystem provider, so a plain workspace read must union every mounted
 * preset's snapshot. Read-only and dependency-free.
 * @module skills-mcp/catalog
 */

/** @param {unknown} value @returns {string|undefined} */
function messageOf(value) {
  if (value instanceof Error) return value.message
  return String(value)
}

/**
 * Build one row from a registry summary.
 * @param {object} skill - skill summary from `ctx.skills.snapshot()`.
 * @param {string|undefined} presetId - owning preset, if the read was per-preset.
 * @returns {object} catalog row.
 */
function toRow(skill, presetId) {
  return {
    name: skill.name,
    description: skill.description,
    ...(skill.whenToUse === undefined ? {} : { whenToUse: skill.whenToUse }),
    ...(skill.path === undefined ? {} : { path: skill.path }),
    source: skill.source,
    provider: skill.provider,
    invocation: { ...skill.invocation },
    presets: presetId === undefined ? [] : [presetId],
  }
}

/**
 * Read one preset's catalog using an exclusive revision lease.
 * @param {object} input - preset read inputs.
 * @param {object} input.presets - agent preset registry.
 * @param {object} input.skills - skill registry.
 * @param {string} input.presetId - preset identity.
 * @param {string|undefined} input.cwd - workspace cwd.
 * @param {AbortSignal|undefined} input.signal - caller lifetime.
 * @returns {Promise<{ rows: object[], complete: boolean, warning?: object }>} one preset's rows.
 */
async function readPreset(input) {
  const { presets, skills, presetId, cwd, signal } = input
  let lease
  try {
    lease = await presets.acquireScope(presetId)
  } catch (error) {
    return {
      rows: [],
      complete: false,
      warning: { code: 'PRESET_UNAVAILABLE', presetId, message: `preset "${presetId}" is not available: ${messageOf(error)}` },
    }
  }
  try {
    const snapshot = await skills.snapshot({ cwd, scope: lease.key, signal })
    const rows = Array.isArray(snapshot?.skills) ? snapshot.skills.map((skill) => toRow(skill, presetId)) : []
    const warning = snapshot?.complete === false
      ? { code: 'INCOMPLETE', presetId, message: `skill discovery in preset "${presetId}" was incomplete` }
      : undefined
    return { rows, complete: snapshot?.complete !== false, ...(warning === undefined ? {} : { warning }) }
  } catch (error) {
    if (signal?.aborted === true) throw error
    return {
      rows: [],
      complete: false,
      warning: { code: 'PRESET_READ_FAILED', presetId, message: `preset "${presetId}" skill discovery failed: ${messageOf(error)}` },
    }
  } finally {
    try {
      await lease?.[Symbol.asyncDispose]?.()
    } catch {
      // The revision lease is a read guard; a disposal failure cannot invalidate rows.
    }
  }
}

/**
 * Collect the effective skill catalog for one cwd.
 *
 * With a preset registry the read unions every mounted preset (or exactly
 * `presetId` when supplied). Without one it reads the global registry once.
 * @param {object} input - catalog inputs.
 * @param {object} [input.skills] - `ctx.skills`, optional in degraded compositions.
 * @param {object} [input.presets] - `ctx.agentPresets`, optional.
 * @param {string} input.cwd - working directory the providers scan.
 * @param {string} [input.presetId] - restrict the read to one preset.
 * @param {AbortSignal} [input.signal] - caller lifetime.
 * @returns {Promise<{ skills: object[], complete: boolean, warnings: object[] }>} merged catalog.
 */
export async function collectSkillCatalog(input) {
  const { skills, presets, cwd, presetId, signal } = input
  if (skills === undefined || skills === null || typeof skills.snapshot !== 'function') {
    return {
      skills: [],
      complete: false,
      warnings: [{ code: 'SKILLS_UNAVAILABLE', message: 'the skill registry is not mounted' }],
    }
  }

  const warnings = []
  const merged = new Map()
  let complete = true

  const merge = (rows) => {
    for (const row of rows) {
      const existing = merged.get(row.name)
      if (existing === undefined) {
        merged.set(row.name, row)
        continue
      }
      for (const id of row.presets) if (!existing.presets.includes(id)) existing.presets.push(id)
    }
  }

  if (presets === undefined || presets === null) {
    try {
      const snapshot = await skills.snapshot({ cwd, signal })
      merge(Array.isArray(snapshot?.skills) ? snapshot.skills.map((skill) => toRow(skill)) : [])
      if (snapshot?.complete === false) {
        complete = false
        warnings.push({ code: 'INCOMPLETE', message: 'skill discovery was incomplete' })
      }
    } catch (error) {
      if (signal?.aborted === true) throw error
      return {
        skills: [],
        complete: false,
        warnings: [{ code: 'SKILLS_READ_FAILED', message: `skill discovery failed: ${messageOf(error)}` }],
      }
    }
    return { skills: [...merged.values()].sort((left, right) => left.name.localeCompare(right.name)), complete, warnings }
  }

  let presetIds
  if (presetId !== undefined) {
    presetIds = [presetId]
  } else {
    try {
      const listed = await presets.list()
      presetIds = (Array.isArray(listed) ? listed : [])
        .filter((preset) => preset?.broken === undefined && typeof preset?.id === 'string')
        .map((preset) => preset.id)
      for (const preset of Array.isArray(listed) ? listed : []) {
        if (preset?.broken !== undefined) {
          complete = false
          warnings.push({ code: 'PRESET_BROKEN', presetId: preset.id, message: `preset "${preset.id}" is broken: ${preset.broken}` })
        }
      }
    } catch (error) {
      if (signal?.aborted === true) throw error
      complete = false
      warnings.push({ code: 'PRESETS_UNAVAILABLE', message: `agent preset registry failed: ${messageOf(error)}` })
      presetIds = []
    }
  }

  for (const id of presetIds) {
    const result = await readPreset({ presets, skills, presetId: id, cwd, signal })
    merge(result.rows)
    if (!result.complete) complete = false
    if (result.warning !== undefined) warnings.push(result.warning)
  }

  return {
    skills: [...merged.values()].sort((left, right) => left.name.localeCompare(right.name)),
    complete,
    warnings,
  }
}
