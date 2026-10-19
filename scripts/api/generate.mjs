import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdir, mkdtemp, readFile, writeFile, rename, rm, stat, utimes } from 'node:fs/promises'
import { dirname, join, resolve, relative, isAbsolute } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { resolvePathItem, validateContract } from './read-contract.mjs'

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url))
const require = createRequire(import.meta.url)
const redoclyCli = join(dirname(require.resolve('@redocly/cli/package.json')), 'bin/cli.js')
const typesCli = join(dirname(require.resolve('openapi-typescript')), '../bin/cli.js')

async function existing(path) {
  try {
    return { content: await readFile(path), metadata: await stat(path) }
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw error
  }
}

/** Stage all bytes before changing destinations; restore every changed destination on failure. */
export async function publishArtifacts(artifacts, io = { rename }) {
  const staged = []
  const published = []
  try {
    for (const { path, content } of artifacts) {
      const before = await existing(path)
      const bytes = Buffer.from(content)
      if (before?.content.equals(bytes)) continue
      await mkdir(dirname(path), { recursive: true })
      const temporary = `${path}.${randomUUID()}.tmp`
      staged.push({ path, temporary, before })
      await writeFile(temporary, bytes, { flag: 'wx', mode: before?.metadata.mode })
    }
    for (const artifact of staged) {
      await io.rename(artifact.temporary, artifact.path)
      published.push(artifact)
    }
  } catch (error) {
    const rollbackErrors = []
    for (const artifact of published.reverse()) {
      try {
        if (artifact.before) {
          await writeFile(artifact.temporary, artifact.before.content, {
            mode: artifact.before.metadata.mode,
          })
          await rename(artifact.temporary, artifact.path)
          await utimes(
            artifact.path,
            artifact.before.metadata.atime,
            artifact.before.metadata.mtime,
          )
        } else await rm(artifact.path, { force: true })
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }
    if (rollbackErrors.length)
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Contract publication and rollback failed',
      )
    throw error
  } finally {
    await Promise.all(staged.map(({ temporary }) => rm(temporary, { force: true })))
  }
}

function run(cli, args, workspace) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: workspace,
      stdio: 'inherit',
      windowsHide: true,
      env: { ...process.env, REDOCLY_TELEMETRY: 'off' },
    })
    child.once('error', reject)
    child.once('close', (code) =>
      code === 0
        ? resolveRun()
        : reject(new Error(`Contract command failed (${code}): ${args[0]}`)),
    )
  })
}

export async function generate(mode = 'generate') {
  return generateContract({ mode })
}

export async function generateContract({ workspace = repositoryRoot, mode = 'generate' } = {}) {
  workspace = resolve(workspace)
  const contractSource = join(workspace, 'api/openapi.yaml')
  const jsonOutput = join(workspace, 'api/generated/openapi.json')
  const typesOutput = join(workspace, 'packages/sdk/src/generated/schema.d.ts')
  if (!['lint', 'bundle', 'generate', 'check'].includes(mode))
    throw new Error(`Unknown API generation mode: ${mode}`)
  const configArgs = ['--config', join(repositoryRoot, 'redocly.yaml')]
  await run(redoclyCli, ['lint', contractSource, ...configArgs], workspace)
  if (mode === 'lint') return
  const taskRoot = join(workspace, '.local')
  await mkdir(taskRoot, { recursive: true })
  const temporary = await mkdtemp(join(taskRoot, 'api-generation-'))
  // Only this freshly-created owned directory may be recursively removed.
  const ownedPath = relative(taskRoot, temporary)
  if (!ownedPath || ownedPath.startsWith('..') || isAbsolute(ownedPath))
    throw new Error('Invalid Contract generation temporary directory')
  try {
    const bundlePath = join(temporary, 'openapi.json')
    await run(
      redoclyCli,
      [
        'bundle',
        contractSource,
        '--output',
        bundlePath,
        '--ext',
        'json',
        '--component-renaming-conflicts-severity',
        'error',
        ...configArgs,
      ],
      workspace,
    )
    const document = validateContract(JSON.parse(await readFile(bundlePath, 'utf8')))
    for (const [path, item] of Object.entries(document.paths))
      document.paths[path] = resolvePathItem(document, item)
    validateContract(document)
    const json = `${JSON.stringify(document, null, 2)}\n`
    await writeFile(bundlePath, json)
    const artifacts = [{ path: jsonOutput, content: json }]
    if (mode !== 'bundle') {
      const generatedTypes = join(temporary, 'schema.d.ts')
      await run(
        typesCli,
        [bundlePath, '--output', generatedTypes, '--redocly', join(repositoryRoot, 'redocly.yaml')],
        workspace,
      )
      artifacts.push({ path: typesOutput, content: await readFile(generatedTypes, 'utf8') })
    }
    if (mode === 'check') {
      const stale = []
      for (const { path, content } of artifacts) {
        if (!(await existing(path))?.content.equals(Buffer.from(content)))
          stale.push(relative(workspace, path).replaceAll('\\', '/'))
      }
      if (stale.length)
        throw new Error(
          `Generated API artifacts are missing or stale: ${stale.join(', ')}. Run pnpm api:generate.`,
        )
    } else await publishArtifacts(artifacts)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  generate(process.argv[2] ?? 'generate').catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
