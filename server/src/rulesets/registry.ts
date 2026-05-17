import type { Ruleset } from 'shared'

const registry = new Map<string, Ruleset>()

export function register(ruleset: Ruleset): void {
  registry.set(ruleset.id, ruleset)
}

export function get(id: string): Ruleset {
  const r = registry.get(id)
  if (!r) throw new Error(`Unknown ruleset: ${id}`)
  return r
}
