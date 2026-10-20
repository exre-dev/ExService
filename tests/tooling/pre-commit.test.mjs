import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, test } from 'node:test'

const project = fileURLToPath(new URL('../../', import.meta.url))
const installer = join(project, '.husky/install.mjs')
const fixtures = []
const environment = {
  ...process.env,
  PATH: `${join(project, 'node_modules/.bin')}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`,
  CI: '',
  NODE_ENV: 'development',
  HUSKY: '',
}

function command(cwd, program, args, overrides = {}) {
  return spawnSync(program, args, {
    cwd,
    encoding: 'utf8',
    env: { ...environment, ...overrides },
  })
}

function git(cwd, ...args) {
  const result = command(cwd, 'git', args)
  assert.equal(result.status, 0, result.stderr || result.stdout)
  return result.stdout.trim()
}

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'exwebsite-formatting-'))
  fixtures.push(cwd)
  git(cwd, 'init', '-b', 'main')
  git(cwd, 'config', 'user.name', 'Formatting Test')
  git(cwd, 'config', 'user.email', 'formatting-test@example.invalid')
  git(cwd, 'config', 'commit.gpgsign', 'false')
  git(cwd, 'config', 'core.autocrlf', 'false')
  return cwd
}

function write(cwd, path, content) {
  const target = join(cwd, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content)
}

function install(cwd, overrides = {}) {
  return command(cwd, process.execPath, [installer], overrides)
}

function commitFixture() {
  const cwd = fixture()
  for (const path of [
    '.gitattributes',
    '.prettierrc.json',
    '.prettierignore',
    '.lintstagedrc.json',
    '.husky/pre-commit',
  ]) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true })
    copyFileSync(join(project, path), join(cwd, path))
  }
  write(cwd, 'package.json', '{"private":true,"packageManager":"pnpm@11.9.0"}\n')
  git(
    cwd,
    'add',
    '.gitattributes',
    '.prettierrc.json',
    '.prettierignore',
    '.lintstagedrc.json',
    '.husky/pre-commit',
    'package.json',
  )
  git(cwd, 'commit', '-m', 'test: initialize formatting fixture')
  const result = install(cwd)
  assert.equal(result.status, 0, result.stderr)
  return cwd
}

after(() => {
  for (const cwd of fixtures) {
    // Only remove directories created by this test, after checking their absolute boundaries.
    assert.equal(dirname(resolve(cwd)), resolve(tmpdir()))
    assert.ok(basename(cwd).startsWith('exwebsite-formatting-'))
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('installs Git hooks in an ordinary checkout', () => {
  const cwd = fixture()
  const result = install(cwd)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(git(cwd, 'config', '--get', 'core.hooksPath'), '.husky/_')
  assert.ok(existsSync(join(cwd, '.husky/_/pre-commit')))
})

test('installing in a linked worktree preserves the primary checkout hook configuration', () => {
  const cwd = fixture()
  git(cwd, 'commit', '--allow-empty', '-m', 'test: initialize fixture')
  const linked = join(cwd, 'linked')
  git(cwd, 'worktree', 'add', '-b', 'hook-test', linked)
  const result = install(linked)
  assert.equal(result.status, 0, result.stderr)
  assert.equal(git(linked, 'config', '--get', 'core.hooksPath'), '.husky/_')
  assert.equal(command(cwd, 'git', ['config', '--get', 'core.hooksPath']).status, 1)
  assert.ok(existsSync(join(linked, '.husky/_/pre-commit')))
})

test('preserves a pre-existing hook manager instead of replacing its checks', () => {
  const cwd = fixture()
  git(cwd, 'config', 'core.hooksPath', 'existing-hooks')
  const result = install(cwd)
  assert.notEqual(result.status, 0)
  assert.equal(git(cwd, 'config', '--get', 'core.hooksPath'), 'existing-hooks')
  assert.ok(!existsSync(join(cwd, '.husky/_/pre-commit')))
})

for (const overrides of [{ HUSKY: '0' }, { CI: 'true' }, { NODE_ENV: 'production' }]) {
  test(`skips development hooks with ${JSON.stringify(overrides)}`, () => {
    const cwd = fixture()
    const before = readFileSync(join(cwd, '.git/config'), 'utf8')
    const result = install(cwd, overrides)
    assert.equal(result.status, 0, result.stderr)
    assert.equal(readFileSync(join(cwd, '.git/config'), 'utf8'), before)
    assert.ok(!existsSync(join(cwd, '.husky/_/pre-commit')))
  })
}

test('Git preserves LF in hook scripts even when automatic CRLF checkout is enabled', () => {
  const cwd = commitFixture()
  git(cwd, 'config', 'core.autocrlf', 'true')
  git(cwd, 'checkout-index', '--force', '--', '.husky/pre-commit')
  assert.equal(readFileSync(join(cwd, '.husky/pre-commit'), 'utf8'), 'pnpm exec lint-staged\n')
})

test('signed-off Git commits format staged files and preserve generated and unrelated files', () => {
  const cwd = commitFixture()
  write(cwd, 'src/space path.ts', 'export const greeting={name:"example"};\n')
  write(cwd, 'apps/php-server/api/generated/openapi.internal.yaml', 'generator-owned bytes\n')
  const generatedSdkTypes = 'packages/sdk/src/generated/schema.d.ts'
  write(cwd, generatedSdkTypes, 'generator-owned type bytes\n')
  const generatedFont = 'packages/components/src/tiptap/fonts/maple-mono-cn'
  const fontStyles = '// Generated by the font builder.\n@font-face{font-family:"Maple Mono CN";}\n'
  write(cwd, `${generatedFont}/font.scss`, fontStyles)
  write(cwd, `${generatedFont}/manifest.json`, '{"generated":true}\n')
  write(cwd, `${generatedFont}/README.md`, '#    Font notes\n')
  write(cwd, 'manual.ts', 'export const manual={untouched:true};\n')
  git(
    cwd,
    'add',
    'src/space path.ts',
    'apps/php-server/api/generated/openapi.internal.yaml',
    generatedSdkTypes,
    generatedFont,
  )
  git(cwd, 'commit', '-s', '-m', 'test: format staged files')
  assert.equal(
    git(cwd, 'show', 'HEAD:src/space path.ts'),
    "export const greeting = { name: 'example' }",
  )
  assert.equal(
    git(cwd, 'show', 'HEAD:apps/php-server/api/generated/openapi.internal.yaml'),
    'generator-owned bytes',
  )
  assert.equal(git(cwd, 'show', `HEAD:${generatedSdkTypes}`), 'generator-owned type bytes')
  assert.equal(git(cwd, 'show', `HEAD:${generatedFont}/font.scss`), fontStyles.trim())
  assert.equal(git(cwd, 'show', `HEAD:${generatedFont}/manifest.json`), '{"generated":true}')
  assert.equal(git(cwd, 'show', `HEAD:${generatedFont}/README.md`), '# Font notes')
  assert.equal(
    readFileSync(join(cwd, 'manual.ts'), 'utf8'),
    'export const manual={untouched:true};\n',
  )
  assert.match(git(cwd, 'log', '-1', '--format=%B'), /Signed-off-by: Formatting Test/)
})

test('partially staged files keep unstaged edits outside the resulting commit', () => {
  const cwd = commitFixture()
  const middle = Array.from({ length: 40 }, (_, index) => `// separation ${index}`).join('\n')
  const baseline = `export const staged = { value: 0 }\n${middle}\nexport const manual = { value: 0 }\n`
  write(cwd, 'partial.ts', baseline)
  git(cwd, 'add', 'partial.ts')
  git(cwd, 'commit', '-m', 'test: add partial staging fixture')
  const staged = baseline.replace(
    'export const staged = { value: 0 }',
    'export const staged={value:1};',
  )
  write(cwd, 'partial.ts', staged)
  git(cwd, 'add', 'partial.ts')
  write(
    cwd,
    'partial.ts',
    staged.replace('export const manual = { value: 0 }', 'export const manual={value:2};'),
  )
  git(cwd, 'commit', '-s', '-m', 'test: preserve unstaged edits')
  assert.equal(
    git(cwd, 'show', 'HEAD:partial.ts'),
    baseline.replace('staged = { value: 0 }', 'staged = { value: 1 }').trim(),
  )
  assert.equal(
    readFileSync(join(cwd, 'partial.ts'), 'utf8'),
    baseline
      .replace('staged = { value: 0 }', 'staged = { value: 1 }')
      .replace('manual = { value: 0 }', 'manual={value:2};'),
  )
})

test('invalid staged syntax blocks the commit and preserves the index and working tree', () => {
  const cwd = commitFixture()
  const before = git(cwd, 'rev-parse', 'HEAD')
  write(cwd, 'invalid.ts', 'export const = ;\n')
  git(cwd, 'add', 'invalid.ts')
  const result = command(cwd, 'git', ['commit', '-s', '-m', 'test: reject invalid syntax'])
  assert.notEqual(result.status, 0)
  assert.equal(git(cwd, 'rev-parse', 'HEAD'), before)
  assert.equal(git(cwd, 'show', ':invalid.ts'), 'export const = ;')
  assert.equal(readFileSync(join(cwd, 'invalid.ts'), 'utf8'), 'export const = ;\n')
})
