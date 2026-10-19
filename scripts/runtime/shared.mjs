import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const localRoot = join(root, '.local/runtime')

/** Checks registry artifacts without loading historical configuration or source links. */
export function assertInstalledExui(workspace = root) {
  const entries = (value) =>
    typeof value === 'string'
      ? [value]
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(entries)
        : []
  for (const consumer of ['apps/web', 'packages/components', 'packages/sdk']) {
    const directory = join(workspace, consumer, 'node_modules/@exre/exui')
    let packageJson
    try {
      packageJson = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
    } catch {
      throw new Error(`${consumer}: install @exre/exui from the registry.`)
    }
    if (
      packageJson.name !== '@exre/exui' ||
      !packageJson.exports?.['.'] ||
      !packageJson.exports?.['./tokens']
    )
      throw new Error(`${consumer}: @exre/exui public exports missing.`)
    for (const entry of new Set([...entries(packageJson.exports), ...entries(packageJson.types)])) {
      const target = resolve(directory, entry)
      if (!target.startsWith(directory + sep) || !existsSync(target))
        throw new Error(`${consumer}: @exre/exui public artifact missing: ${entry}`)
    }
  }
}
