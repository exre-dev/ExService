import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  renameSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, expect, it } from 'vitest'
import { buildSpecifications } from '../../scripts/runtime/build.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const owned = join(root, 'apps/server/.local')
mkdirSync(owned, { recursive: true })
const workspace = mkdtempSync(join(owned, 'build-autoload-'))
const server = join(workspace, 'apps/server'),
  source = join(server, 'src'),
  dist = join(server, 'dist')
const require = createRequire(new URL('../../apps/server/package.json', import.meta.url))
const compiler = require.resolve('typescript/bin/tsc'),
  tsx = pathToFileURL(require.resolve('tsx')).href
const runner = join(root, 'tests/server-plugins/fixtures/boot-in-environment.mjs')
cpSync(join(root, 'apps/server/src'), source, { recursive: true })
mkdirSync(join(workspace, 'scripts'), { recursive: true })
for (const file of [
  'clean-server-build.mjs',
  'rewrite-server-imports.mjs',
  'support-field-definition.mjs',
  'support-field-definition.d.mts',
])
  cpSync(join(root, 'scripts', file), join(workspace, 'scripts', file))
cpSync(join(root, 'apps/server/package.json'), join(server, 'package.json'))
cpSync(join(root, 'tsconfig.base.json'), join(workspace, 'tsconfig.base.json'))
cpSync(join(root, 'apps/server/tsconfig.json'), join(server, 'tsconfig.json'))
symlinkSync(join(root, 'apps/server/node_modules'), join(server, 'node_modules'), 'junction')
symlinkSync(join(root, 'node_modules'), join(workspace, 'node_modules'), 'junction')
mkdirSync(join(workspace, 'api/generated'), { recursive: true })
cpSync(join(root, 'api/generated/openapi.json'), join(workspace, 'api/generated/openapi.json'))
mkdirSync(join(server, 'data'))
writeFileSync(join(server, 'data/sentinel'), 'PERSISTENT_DATA')
writeFileSync(join(workspace, '.env.local'), 'ENVIRONMENT_SENTINEL')

function run(args: string[], cwd = server) {
  // Strip application settings so child boot can only use its fake services.
  return spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    timeout: 30_000,
    env: Object.fromEntries(
      Object.entries(process.env).filter(([key]) =>
        /^(?:PATH|SYSTEMROOT|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMFILES(?:\(X86\))?)$/i.test(
          key,
        ),
      ),
    ),
  })
}
function pass(result: ReturnType<typeof run>) {
  expect(result.error, result.stderr).toBeUndefined()
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
}
function build() {
  pass(run([join(workspace, 'scripts/clean-server-build.mjs')]))
  pass(run([compiler, '-p', join(server, 'tsconfig.json')]))
  pass(run([join(workspace, 'scripts/rewrite-server-imports.mjs')]))
}
function probe(name: string) {
  const folder = join(source, 'modules', name)
  mkdirSync(folder)
  writeFileSync(
    join(folder, 'plugin.ts'),
    `import fp from 'fastify-plugin';\nimport { requireBusinessServices } from '@server/src/business-plugin-errors.js';\nexport default fp(async (app, options: {authServices: unknown}) => { requireBusinessServices('business-${name}',{authServices:options.authServices}); app.decorate('${name}',true); },{name:'business-${name}'});`,
  )
}
afterAll(() => {
  if (resolve(workspace, '..') !== resolve(owned)) throw new Error('invalid build cleanup')
  rmSync(workspace, { recursive: true, force: true })
})

it('keeps cleanup before compilation in the Server build and invokes it from the root build', () => {
  const steps = JSON.parse(
    readFileSync(join(root, 'apps/server/package.json'), 'utf8'),
  ).scripts.build.split('&&') as string[]
  const cleanup = steps.findIndex((step) => /\bclean-server-build\.mjs\b/.test(step))
  expect(cleanup).toBeGreaterThanOrEqual(0)
  expect(steps.findIndex((step) => /\btsc\b/.test(step))).toBeGreaterThan(cleanup)
  const specs = buildSpecifications({ workspace, inherited: { INTEGRATION_COREPACK_JS: compiler } })
  expect(
    specs.some((spec) => spec.args.slice(1).join(' ') === 'pnpm --filter @workspace/server build'),
  ).toBe(true)
})

it('boots source and rebuilt JavaScript from arbitrary cwd, then safely closes failed boots', () => {
  probe('removed')
  probe('old-probe')
  // Initial build proves the plugin was emitted; subsequent boots reject any stale decorator.
  build()
  expect(existsSync(join(dist, 'modules/removed/plugin.js'))).toBe(true)
  expect(existsSync(join(dist, 'modules/old-probe/plugin.js'))).toBe(true)
  rmSync(join(source, 'modules/removed'), { recursive: true })
  renameSync(join(source, 'modules/old-probe'), join(source, 'modules/new-probe'))
  const renamed = join(source, 'modules/new-probe/plugin.ts')
  writeFileSync(renamed, readFileSync(renamed, 'utf8').replaceAll('old-probe', 'new-probe'))
  // --import tsx uses the production source path resolution and @server aliases.
  pass(run(['--import', tsx, runner, source, 'ts', 'new-probe'], workspace))
  build()
  expect(existsSync(join(dist, 'modules/removed/plugin.js'))).toBe(false)
  expect(existsSync(join(dist, 'modules/old-probe/plugin.js'))).toBe(false)
  writeFileSync(join(dist, 'ignored.ts'), "throw new Error('EXCLUDED_TYPESCRIPT_SENTINEL')")
  writeFileSync(
    join(dist, 'modules/new-probe/ignored.ts'),
    "throw new Error('EXCLUDED_CANDIDATE_TYPESCRIPT_SENTINEL')",
  )
  const compiled = run(
    ['--no-experimental-strip-types', runner, dist, 'js', 'new-probe'],
    workspace,
  )
  pass(compiled)
  expect(compiled.stdout).toContain('"closes":1,"starts":1,"status":"ok"')
  expect(readFileSync(join(server, 'data/sentinel'), 'utf8')).toBe('PERSISTENT_DATA')
  expect(readFileSync(join(workspace, '.env.local'), 'utf8')).toBe('ENVIRONMENT_SENTINEL')

  // These failure probes use this scenario's build, not another test's output.
  const folder = join(dist, 'modules/new-probe')
  const entry = join(folder, 'plugin.js'),
    original = readFileSync(entry, 'utf8')
  for (const [body, code] of [
    ["throw new Error('SECRET_IMPORT')", 'BUSINESS_PLUGIN_IMPORT_FAILED'],
    [
      original.replace("app.decorate('new-probe', true)", "throw new Error('SECRET_BOOT')"),
      'BUSINESS_PLUGIN_BOOT_FAILED',
    ],
    [original.replaceAll('business-new-probe', 'business-auth'), 'BUSINESS_PLUGIN_DUPLICATE_NAME'],
    [
      original.replace(
        "name: 'business-new-probe'",
        "name: 'business-new-probe', dependencies: ['business-absent']",
      ),
      'BUSINESS_PLUGIN_MISSING_DEPENDENCY',
    ],
  ]) {
    expect(body, code).not.toBe(original)
    writeFileSync(entry, body)
    const result = run([runner, dist, 'js'], workspace)
    expect(result.error).toBeUndefined()
    expect(result.status, result.stdout + result.stderr).toBe(1)
    expect(result.stderr).toContain(code)
    expect(result.stderr).not.toContain('SECRET')
    expect(result.stdout).toContain('"closes":1,"starts":0')
  }
  writeFileSync(entry, original)
}, 120_000)

it('rejects a linked dist, extra CLI targets and a non-directory dist without deleting sentinels', () => {
  rmSync(dist, { recursive: true, force: true })
  symlinkSync(join(server, 'data'), dist, 'junction')
  const clean = join(workspace, 'scripts/clean-server-build.mjs')
  expect(run([clean]).status).toBe(1)
  expect(readFileSync(join(server, 'data/sentinel'), 'utf8')).toBe('PERSISTENT_DATA')
  rmSync(dist)
  writeFileSync(dist, 'NOT_A_DIRECTORY')
  expect(run([clean]).status).toBe(1)
  expect(readFileSync(dist, 'utf8')).toBe('NOT_A_DIRECTORY')
  expect(run([clean, join(server, 'data')]).status).toBe(1)
  rmSync(dist)
  pass(run([clean]))
})
