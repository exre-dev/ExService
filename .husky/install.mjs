import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

// Production installs and CI do not need developer Git hooks or Husky's dev dependency.
if (process.env.HUSKY === '0' || process.env.CI || process.env.NODE_ENV === 'production') {
  process.exit(0)
}

function git(args, optional = false) {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (optional && result.status === 1) return ''
  if (result.status !== 0) throw new Error(result.stderr || 'Git is unavailable')
  return result.stdout.trim()
}

const inside = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], { encoding: 'utf8' })
if (inside.status !== 0 || inside.stdout.trim() !== 'true') process.exit(0)

const existingHooks = git(['config', '--get', 'core.hooksPath'], true)
if (existingHooks && existingHooks !== '.husky/_') {
  throw new Error('Existing core.hooksPath must be integrated explicitly before installing Husky')
}

const gitDirectory = resolve(git(['rev-parse', '--absolute-git-dir']))
const commonDirectory = resolve(git(['rev-parse', '--git-common-dir']))
let worktreeConfig = git(['config', '--type=bool', '--get', 'extensions.worktreeConfig'], true)
if (gitDirectory !== commonDirectory && worktreeConfig !== 'true') {
  // Git requires these checkout-specific values to be migrated before enabling this extension.
  if (
    git(['config', '--local', '--get', 'core.worktree'], true) ||
    git(['config', '--local', '--type=bool', '--get', 'core.bare'], true) === 'true'
  ) {
    throw new Error('Migrate core.worktree/core.bare before enabling worktree-specific hooks')
  }
  git(['config', '--local', 'extensions.worktreeConfig', 'true'])
  worktreeConfig = 'true'
}

// Husky invokes `git config` internally. Scope that write to this checkout's config file.
process.env.GIT_CONFIG = join(
  gitDirectory,
  worktreeConfig === 'true' ? 'config.worktree' : 'config',
)
const { default: install } = await import('husky')
const error = install()
if (error) throw new Error(error)
