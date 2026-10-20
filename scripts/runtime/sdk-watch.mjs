import { watch } from 'node:fs'
import { join } from 'node:path'

export function isGeneratedOutput(file) {
  return (
    /(?:^|\/)(?:node_modules|dist|\.source|\.dts-temp|\.vite|\.vite-temp)(?:\/|$)/.test(file) ||
    /\.(?:log|tmp)$/.test(file) ||
    /^(?:packages\/sdk\/src\/generated)(?:\/|$)/.test(file)
  )
}
export function isSdkSourceChange(directory, path) {
  if (!path) return false
  const file = `${directory}/${path}`.replaceAll('\\', '/')
  if (isGeneratedOutput(file) || /(?:^|\/)build(?:\/|$)/.test(file)) return false
  return (
    file === 'apps/php-server/api/generated/openapi.internal.yaml' ||
    /^packages\/sdk\/(?:src(?:\/|$)|package\.json$|tsconfig[^/]*\.json$|vite\.config\.[^/]+$|rollup\.config\.[^/]+$)/.test(
      file,
    )
  )
}
/** The caller owns and closes every watcher; no daemon or generated-output loop. */
export function watchSdkSources(
  workspace,
  onChange,
  {
    watchDirectory = watch,
    onError = (error) => {
      throw error
    },
  } = {},
) {
  const watchers = []
  const close = () => {
    const failures = []
    for (const watcher of watchers) {
      try {
        watcher.close()
      } catch (error) {
        failures.push(error)
      }
    }
    if (failures.length) throw new AggregateError(failures, 'SDK_WATCH_CLEANUP_FAILED')
  }
  try {
    for (const directory of ['apps/php-server/api/generated', 'packages/sdk']) {
      const watcher = watchDirectory(join(workspace, directory), { recursive: true }, (_, path) => {
        if (isSdkSourceChange(directory, path)) onChange()
      })
      watchers.push(watcher)
      watcher.on('error', onError)
    }
    return { close }
  } catch (error) {
    close()
    throw error
  }
}
