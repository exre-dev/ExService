import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(import.meta.url)
const compiler = require.resolve('typescript/bin/tsc')
const configuration = join(root, 'tests/server-types/tsconfig.json')
const compilerPath = (path: string) => path.replaceAll('\\', '/')

it('rejects conflicting service fields in the full declaration graph', () => {
  // A child of the Server package resolves its direct Fastify dependency.
  const owned = join(root, 'apps/server/.local')
  mkdirSync(owned, { recursive: true })
  const directory = mkdtempSync(join(owned, 'server-type-conflict-'))
  try {
    writeFileSync(
      join(directory, 'conflict.d.ts'),
      [
        "import type {} from 'fastify'",
        "declare module 'fastify' { interface FastifyInstance { authServices: string } }",
        'export {}',
      ].join('\n'),
    )
    writeFileSync(
      join(directory, 'tsconfig.json'),
      JSON.stringify({
        extends: compilerPath(configuration),
        include: [
          compilerPath(join(root, 'tests/server-types/types.fixture.ts')),
          compilerPath(join(root, 'apps/server/src/**/*.d.ts')),
          compilerPath(join(directory, 'conflict.d.ts')),
        ],
      }),
    )
    const files = spawnSync(
      process.execPath,
      [compiler, '--listFilesOnly', '-p', join(directory, 'tsconfig.json')],
      { cwd: root, encoding: 'utf8' },
    )
    expect(files.error).toBeUndefined()
    expect(files.status).toBe(0)
    for (const declaration of [
      'modules/auth/fastify.d.ts',
      'modules/auth/api/fastify.d.ts',
      'modules/profile/fastify.d.ts',
      'modules/identity/fastify.d.ts',
      'modules/identity/api/fastify.d.ts',
      'modules/storage/fastify.d.ts',
      'modules/notifications/fastify.d.ts',
      'domains/join/fastify.d.ts',
    ]) {
      expect(compilerPath(files.stdout)).toContain(
        compilerPath(join(root, 'apps/server/src', declaration)),
      )
    }
    const result = spawnSync(
      process.execPath,
      [compiler, '--noEmit', '-p', join(directory, 'tsconfig.json')],
      { cwd: root, encoding: 'utf8' },
    )
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(2)
    expect(result.stdout).toMatch(/TS2717:[^\r\n]*'authServices'/)
    expect(result.stdout).not.toContain("Cannot find module 'fastify'")
  } finally {
    if (dirname(resolve(directory)) !== resolve(owned))
      throw new Error('Invalid owned type-test cleanup path')
    rmSync(directory, { recursive: true, force: true })
  }
}, 60_000)
