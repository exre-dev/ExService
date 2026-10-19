import { lstat, realpath, rm } from 'node:fs/promises'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../apps/server')
const target = join(packageRoot, 'dist')
// This CLI deliberately has no caller-selected deletion target.
if (process.argv.slice(2).length || relative(packageRoot, target) !== 'dist')
  throw new Error('SERVER_BUILD_CLEAN_TARGET_INVALID')
try {
  const parent = await realpath(packageRoot)
  const info = await lstat(target)
  if (
    parent !== packageRoot ||
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (await realpath(target)) !== target
  ) {
    throw new Error('SERVER_BUILD_CLEAN_TARGET_INVALID')
  }
  await rm(target, { recursive: true, force: false })
} catch (error) {
  if (error.code !== 'ENOENT') throw new Error('SERVER_BUILD_CLEAN_FAILED')
}
