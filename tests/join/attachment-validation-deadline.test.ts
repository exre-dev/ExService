import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'

const serverRequire = createRequire(new URL('../../apps/server/package.json', import.meta.url))
const loader = pathToFileURL(serverRequire.resolve('tsx')).href
const validator = new URL(
  '../../apps/server/src/domains/join/applications/attachment-validation.ts',
  import.meta.url,
).href

const cases = [
  ['many BOMs then non-SVG', "'\\uFEFF'.repeat(50000)+'<html/>'", 'rejected'],
  ['many comments then non-SVG', "'<!--x-->'.repeat(50000)+'<html/>'", 'rejected'],
  [
    'many comments then an unterminated comment',
    "'<!--x-->'.repeat(50000)+'<!--unfinished'",
    'rejected',
  ],
  [
    'many comments then an unterminated XML declaration',
    "'<!--x-->'.repeat(50000)+'<?xml version=\"1.0\"'",
    'rejected',
  ],
  ['large comment prefix then a self-closing SVG', "'<!--x-->'.repeat(50000)+'<svg/>'", 'accepted'],
] as const

it('validates hostile SVG prefixes within a bounded child process', () => {
  // Keep an OS deadline for hangs, but measure validation separately from Node/tsx startup.
  const source = `import { validateJoinProofs } from ${JSON.stringify(validator)};
    const cases = [${cases.map(([name, expression]) => `[${JSON.stringify(name)}, ${expression}]`).join(',')}];
    const results = cases.map(([name, content]) => {
      const bytes = Buffer.from(content), started = performance.now();
      let result = 'accepted';
      try { validateJoinProofs([{ originalName: 'proof.svg', bytes }], 'experienced') }
      catch (error) { if (error.code !== 'JOIN_UNSUPPORTED_MEDIA_TYPE') throw error; result = 'rejected' }
      return { name, result, duration: performance.now() - started };
    });
    console.log(JSON.stringify(results));`
  const result = spawnSync(
    process.execPath,
    ['--import', loader, '--input-type=module', '-e', source],
    {
      encoding: 'utf8',
      timeout: 30_000,
      killSignal: 'SIGKILL',
      maxBuffer: 64 * 1024,
    },
  )
  expect(
    result.error,
    `child process exceeded its startup and execution deadline: ${result.stderr}`,
  ).toBeUndefined()
  expect(result.status, result.stderr).toBe(0)
  const results = JSON.parse(result.stdout) as Array<{
    name: string
    result: string
    duration: number
  }>
  expect(results.map(({ name, result }) => [name, result])).toEqual(
    cases.map(([name, , expected]) => [name, expected]),
  )
  for (const { name, duration } of results) expect(duration, name).toBeLessThan(3000)
}, 45_000)
