import { afterEach, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stringify } from 'yaml'
import { supportDefinition } from '@web/build/support/definition'
import { isAllowedClickUpUrl } from '@web/build/support/clickup-policy'
import { readContent } from '@web/build/content/compiler'
import type { SupportRegistry } from '@web/src/content/support/types'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
async function fixture(categories: unknown[] = [{ id: 'setup', label: 'Setup' }]) {
  const root = await mkdtemp(join(tmpdir(), 'exwebsite-support-'))
  roots.push(root)
  await mkdir(join(root, 'errors'))
  await writeFile(join(root, 'settings.yaml'), stringify({ categories, clickup: null }))
  await writeFile(join(root, 'contacts.yaml'), 'items: []')
  return { ...supportDefinition, root }
}
async function error(
  root: string,
  name = 'example',
  fields: Record<string, unknown> = {},
  body = '## Start\nBody',
) {
  await writeFile(
    join(root, `errors/${name}.mdx`),
    `---\n${stringify({ slug: name, title: name, description: 'Summary', category: 'setup', quickAnswer: 'Quick answer', ...fields })}---\n${body}`,
  )
}
it('publishes the three supplied ClickUp views without inventing contacts or errors', async () => {
  const result = await readContent(supportDefinition)
  expect(result.data).toEqual({
    errors: [],
    featured: [],
    contacts: [],
    categories: [],
    clickup: {
      game: {
        title: '游戏开发进度',
        embedUrl: 'https://sharing.clickup.com/90181517066/b/h/2kzktfra-9618/b4986a415558c76',
        publicUrl: 'https://sharing.clickup.com/90181517066/b/h/2kzktfra-9618/b4986a415558c76',
      },
      community: {
        title: '社区开发进度',
        embedUrl: 'https://sharing.clickup.com/90181517066/b/h/2kzktfra-9638/d3bb70a716dd61d',
        publicUrl: 'https://sharing.clickup.com/90181517066/b/h/2kzktfra-9638/d3bb70a716dd61d',
      },
      requestBucket: {
        title: '需求桶',
        embedUrl: 'https://sharing.clickup.com/90181517066/l/h/2kzktfra-8598/c454f2386b70b2c',
        publicUrl: 'https://sharing.clickup.com/90181517066/l/h/2kzktfra-8598/c454f2386b70b2c',
      },
    },
  })
  expect(result.documents).toEqual([])
  expect(result.assets).toEqual({})
})
it.each(['order: 1', 'featuredOrder: 1', 'draft: true'])(
  'parses the final Windows CRLF scalar correctly: %s',
  async (lastField) => {
    const definition = await fixture()
    const source =
      `---\nslug: windows\ntitle: Windows\ndescription: Summary\ncategory: setup\nquickAnswer: Answer\n${lastField}\n---\n## Start\nBody`.replaceAll(
        '\n',
        '\r\n',
      )
    await writeFile(join(definition.root, 'errors/windows.mdx'), source)
    const result = await readContent(definition)
    const registry = result.data as SupportRegistry
    if (lastField === 'draft: true') expect(registry.errors).toEqual([])
    else
      expect(registry.errors[0]?.[lastField.startsWith('order') ? 'order' : 'featuredOrder']).toBe(
        1,
      )
  },
)
it.each(['order: 2', 'draft: false'])(
  'preserves multiline quickAnswer semantics across LF and CRLF with final %s',
  async (lastField) => {
    const definition = await fixture()
    const source = `---\nslug: windows\ntitle: Windows\ndescription: Summary\ncategory: setup\nquickAnswer: |\n  First step\n  Second step\n${lastField}\n---\n## Start\nBody`
    const file = join(definition.root, 'errors/windows.mdx')
    await writeFile(file, source)
    const lf = await readContent(definition)
    await writeFile(file, source.replaceAll('\n', '\r\n'))
    const crlf = await readContent(definition)
    expect(crlf.data).toEqual(lf.data)
    expect((crlf.data as SupportRegistry).errors[0]?.quickAnswer).toBe('First step\nSecond step')
    expect(crlf.documents[0]?.analysis).toEqual(lf.documents[0]?.analysis)
  },
)
it('projects sorted published entries, stable ids and featured slugs without draft metadata', async () => {
  const definition = await fixture([
    { id: 'later', label: 'Later', order: 2 },
    { id: 'setup', label: 'Setup' },
  ])
  await error(definition.root, 'beta', { order: 2, featuredOrder: 1 })
  await error(definition.root, 'alpha', { featuredOrder: 3 })
  await error(definition.root, 'private', { draft: true, featuredOrder: 2 })
  await writeFile(
    join(definition.root, 'contacts.yaml'),
    stringify({
      items: [
        { id: 'beta', name: 'Beta', role: 'Support', qq: '001234', order: 1 },
        { id: 'alpha', name: 'Alpha', role: 'Support', email: 'alpha@example.test' },
        { id: 'private', name: 'Private', role: 'Support', draft: true },
      ],
    }),
  )
  const result = await readContent(definition)
  const registry = result.data as SupportRegistry
  expect(registry.errors.map((item) => [item.id, item.url])).toEqual([
    ['errors/alpha.mdx', '/support/errors/alpha'],
    ['errors/beta.mdx', '/support/errors/beta'],
  ])
  expect(registry.featured).toEqual(['beta', 'alpha'])
  expect(registry.contacts.map((item) => item.id)).toEqual(['alpha', 'beta'])
  expect(registry.contacts[1]?.qq).toBe('001234')
  expect(registry.categories.map((item) => item.id)).toEqual(['setup', 'later'])
  expect(JSON.stringify(registry)).not.toContain('draft')
  expect(result.documents.map((item) => item.id)).toEqual(['errors/alpha.mdx', 'errors/beta.mdx'])
})
it.each(['settings.yaml', 'contacts.yaml'])('requires %s even for empty content', async (file) => {
  const definition = await fixture([])
  await rm(join(definition.root, file))
  await expect(readContent(definition)).rejects.toThrow(file)
})
it.each([
  { slug: ' other ' },
  { slug: 'other' },
  { order: -1 },
  { order: 0.5 },
  { order: Number.MAX_SAFE_INTEGER + 1 },
  { featuredOrder: 0 },
  { featuredOrder: 4 },
  { featuredOrder: 1.5 },
  { category: 'missing' },
  { unknown: true },
  { title: '' },
  { quickAnswer: '' },
  { draft: 'true' },
])('rejects invalid error fields %j through real readContent', async (fields) => {
  const definition = await fixture()
  await error(definition.root, 'example', fields)
  await expect(readContent(definition)).rejects.toThrow('errors/example.mdx')
})
it('rejects repeated featured positions including unpublished drafts', async () => {
  const definition = await fixture()
  await error(definition.root, 'one', { featuredOrder: 1 })
  await error(definition.root, 'two', { featuredOrder: 1, draft: true })
  await expect(readContent(definition)).rejects.toThrow('Duplicate featuredOrder')
})
it('accepts safe integer boundaries and uses stable slug/id tie-breakers', async () => {
  const definition = await fixture([
    { id: 'beta', label: 'Beta' },
    { id: 'alpha', label: 'Alpha' },
    { id: 'setup', label: 'Setup', order: Number.MAX_SAFE_INTEGER },
  ])
  await error(definition.root, 'beta')
  await error(definition.root, 'alpha')
  await error(definition.root, 'last', { order: Number.MAX_SAFE_INTEGER })
  await writeFile(
    join(definition.root, 'contacts.yaml'),
    stringify({
      items: [
        { id: 'beta', name: 'Beta', role: 'Support' },
        { id: 'alpha', name: 'Alpha', role: 'Support' },
      ],
    }),
  )
  const result = await readContent(definition)
  const registry = result.data as SupportRegistry
  expect(registry.errors.map((item) => item.slug)).toEqual(['alpha', 'beta', 'last'])
  expect(registry.contacts.map((item) => item.id)).toEqual(['alpha', 'beta'])
  expect(registry.categories.map((item) => item.id)).toEqual(['alpha', 'beta', 'setup'])
})
it.each([
  ['settings.yaml', { categories: [], clickup: null, extra: true }],
  ['settings.yaml', { categories: [], clickup: '' }],
  ['settings.yaml', { categories: [] }],
  ['contacts.yaml', { items: [], extra: true }],
])('rejects unknown or incomplete top-level metadata %s %j', async (file, data) => {
  const definition = await fixture([])
  await writeFile(join(definition.root, file), stringify(data))
  await expect(readContent(definition)).rejects.toThrow(file)
})
it.each(['errors/nested/entry.mdx', 'errors/entry.md', 'unexpected.yaml'])(
  'rejects unregistered content paths %s',
  async (file) => {
    const definition = await fixture()
    await mkdir(join(definition.root, file, '..'), { recursive: true })
    await writeFile(join(definition.root, file), 'title: Invalid')
    await expect(readContent(definition)).rejects.toThrow('Unregistered content file')
  },
)
it.each(
  [
    [
      { id: 'same', label: 'One' },
      { id: 'same', label: 'Two' },
    ],
    [{ id: ' setup ', label: 'Setup' }],
    [{ id: 'setup', label: 'Setup', unknown: true }],
    [{ id: 'setup', label: 'Setup', order: -1 }],
  ].map((categories) => ({ categories })),
)('rejects invalid or repeated category records %j', async ({ categories }) => {
  const definition = await fixture(categories)
  await expect(readContent(definition)).rejects.toThrow('settings.yaml')
})
it.each([
  { qq: 123 },
  { qq: '１２３' },
  { qq: '' },
  { qq: '123 456' },
  { email: 'a@example.test\nb@example.test' },
  { email: 'a@example.test,b@example.test' },
  { email: 'a@example.test?subject=hello' },
  { email: 'a@example.test\u0000' },
  { email: 'bad' },
  { unknown: true },
  { id: ' invalid ' },
  { order: Number.MAX_SAFE_INTEGER + 1 },
])('rejects invalid contact fields %j', async (fields) => {
  const definition = await fixture()
  await writeFile(
    join(definition.root, 'contacts.yaml'),
    stringify({ items: [{ id: 'person', name: 'Person', role: 'Support', ...fields }] }),
  )
  await expect(readContent(definition)).rejects.toThrow('contacts.yaml')
})
it('rejects duplicate contact ids even when one is a draft', async () => {
  const definition = await fixture()
  await writeFile(
    join(definition.root, 'contacts.yaml'),
    stringify({
      items: [
        { id: 'same', name: 'One', role: 'Support' },
        { id: 'same', name: 'Two', role: 'Support', draft: true },
      ],
    }),
  )
  await expect(readContent(definition)).rejects.toThrow('Duplicate contact id')
})
it('checks all draft resources while exporting only published resources', async () => {
  const definition = await fixture()
  await mkdir(join(definition.root, 'assets'))
  for (const name of ['shared', 'private'])
    await writeFile(
      join(definition.root, `assets/${name}.svg`),
      '<svg xmlns="http://www.w3.org/2000/svg"/>',
    )
  const image = (name: string) => ({ src: `assets/${name}.svg`, alt: name, width: 10, height: 10 })
  await error(
    definition.root,
    'private',
    { draft: true },
    `<ContentImage image={${JSON.stringify(image('private'))}} />`,
  )
  await writeFile(
    join(definition.root, 'contacts.yaml'),
    stringify({
      items: [
        { id: 'public', name: 'Public', role: 'Support', avatar: image('shared') },
        { id: 'private', name: 'Private', role: 'Support', draft: true, avatar: image('private') },
      ],
    }),
  )
  const result = await readContent(definition)
  expect(Object.keys(result.assets)).toEqual(['assets/shared.svg'])
  expect(result.documents).toEqual([])
  await rm(join(definition.root, 'assets/private.svg'))
  await expect(readContent(definition)).rejects.toThrow('Missing asset')
})
it('accepts only registered support routes and real decoded heading anchors', async () => {
  const definition = await fixture()
  await error(definition.root, 'target', {}, '## 开始\n### Next')
  await error(
    definition.root,
    'example',
    {},
    '[Home](/support) [List](/support/errors) [Target](/support/errors/target#%E5%BC%80%E5%A7%8B) [Self](#start) [External](https://example.test)\n## Start',
  )
  await expect(readContent(definition)).resolves.toBeDefined()
})
it.each([
  '/aboutus',
  '/support#contacts',
  '/support/errors#start',
  '/support/errors/missing',
  '/support/errors/target#missing',
  '#start#extra',
  '#%XX',
  'http://example.test',
  'https://user:pass@example.test',
])('rejects unresolved or unsafe link %s', async (url) => {
  const definition = await fixture()
  await error(definition.root, 'target')
  await error(definition.root, 'example', {}, `## Start\n[Link](${url})`)
  await expect(readContent(definition)).rejects.toThrow(/link|anchor/i)
})
it('rejects published references to drafts and checks draft references too', async () => {
  const definition = await fixture()
  await error(definition.root, 'target', { draft: true })
  await error(definition.root, 'example', {}, '[Draft](/support/errors/target)')
  await expect(readContent(definition)).rejects.toThrow('unpublished')
  await error(definition.root, 'example', { draft: true }, '[Missing](/support/errors/missing)')
  await expect(readContent(definition)).rejects.toThrow('Unknown internal link')
})
it.each([
  '# Repeated page heading',
  '<AboutLink target="page:home">Home</AboutLink>',
  'export const secret = true',
  '<iframe src="https://example.test" />',
])('rejects unsupported Support author syntax %s', async (body) => {
  const definition = await fixture()
  await error(definition.root, 'example', {}, body)
  await expect(readContent(definition)).rejects.toThrow('errors/example.mdx')
})
it('accepts approved ClickUp hosts in all named views through real content compilation', async () => {
  const definition = await fixture([])
  await writeFile(
    join(definition.root, 'settings.yaml'),
    stringify({
      categories: [],
      clickup: {
        game: { title: 'Game', embedUrl: 'https://sharing.clickup.com/game?embed=true' },
        community: { title: 'Community', embedUrl: 'https://sharing.clickup.com/community' },
        requestBucket: { title: 'Requests', embedUrl: 'https://sharing.clickup.com/requests' },
      },
    }),
  )
  const registry = (await readContent(definition)).data as SupportRegistry
  expect(registry.clickup).toEqual({
    game: { title: 'Game', embedUrl: 'https://sharing.clickup.com/game?embed=true' },
    community: { title: 'Community', embedUrl: 'https://sharing.clickup.com/community' },
    requestBucket: { title: 'Requests', embedUrl: 'https://sharing.clickup.com/requests' },
  })
})
it('preserves the request bucket iframe and its optional external fallback', async () => {
  const definition = await fixture([])
  await writeFile(
    join(definition.root, 'settings.yaml'),
    stringify({
      categories: [],
      clickup: {
        game: { title: 'Game', embedUrl: 'https://sharing.clickup.com/game' },
        community: { title: 'Community', embedUrl: 'https://sharing.clickup.com/community' },
        requestBucket: {
          title: 'Requests',
          embedUrl: 'https://sharing.clickup.com/requests',
          publicUrl: 'https://sharing.clickup.com/requests-open',
        },
      },
    }),
  )
  const registry = (await readContent(definition)).data as SupportRegistry
  expect(registry.clickup?.requestBucket).toEqual({
    title: 'Requests',
    embedUrl: 'https://sharing.clickup.com/requests',
    publicUrl: 'https://sharing.clickup.com/requests-open',
  })
})
it.each([
  'http://sharing.clickup.com/requests',
  'https://sharing.clickup.com.evil.test/requests',
  'https://user:pass@sharing.clickup.com/requests',
  'https://sharing.clickup.com:8443/requests',
  'https://sharing.clickup.com/requests\n',
])('rejects unsafe request bucket URLs through real content validation: %s', async (embedUrl) => {
  const definition = await fixture([])
  await writeFile(
    join(definition.root, 'settings.yaml'),
    stringify({
      categories: [],
      clickup: {
        game: { title: 'Game', embedUrl: 'https://sharing.clickup.com/game' },
        community: { title: 'Community', embedUrl: 'https://sharing.clickup.com/community' },
        requestBucket: { title: 'Requests', embedUrl },
      },
    }),
  )
  await expect(readContent(definition)).rejects.toThrow('settings.yaml')
})
it.each([
  { game: { title: 'Game', embedUrl: 'https://sharing.clickup.com/game' } },
  {
    game: { title: 'Game', embedUrl: 'https://board.example.test/game' },
    community: { title: 'Community', embedUrl: 'https://sharing.clickup.com/community' },
  },
  {
    game: { title: 'Game', embedUrl: 'https://sharing.clickup.com/game' },
    community: { title: 'Community', embedUrl: 'https://sharing.clickup.com.evil.test/community' },
  },
  {
    game: { title: 'Game', embedUrl: 'https://sharing.clickup.com/game' },
    community: {
      title: 'Community',
      embedUrl: 'https://sharing.clickup.com/community',
      publicUrl: 'https://other.example.test/community',
    },
  },
  {
    game: { title: 'Game', embedUrl: 'https://sharing.clickup.com/game' },
    community: { title: 'Community', embedUrl: 'https://sharing.clickup.com/community' },
    hosts: ['other.example.test'],
  },
])('rejects incomplete views or unapproved sources in either view: %j', async (clickup) => {
  const definition = await fixture([])
  await writeFile(
    join(definition.root, 'settings.yaml'),
    stringify({
      categories: [],
      clickup: {
        ...clickup,
        requestBucket: { title: 'Requests', embedUrl: 'https://sharing.clickup.com/requests' },
      },
    }),
  )
  await expect(readContent(definition)).rejects.toThrow('settings.yaml')
})
it('rejects a configured development panel without its request bucket view', async () => {
  const definition = await fixture([])
  await writeFile(
    join(definition.root, 'settings.yaml'),
    stringify({
      categories: [],
      clickup: {
        game: { title: 'Game', embedUrl: 'https://sharing.clickup.com/game' },
        community: { title: 'Community', embedUrl: 'https://sharing.clickup.com/community' },
      },
    }),
  )
  await expect(readContent(definition)).rejects.toThrow('settings.yaml')
})
it('preserves valid official URL paths and parameters using an explicit test policy', () => {
  expect(
    isAllowedClickUpUrl('https://board.example.test:443/view/123?embed=true&theme=dark', [
      'board.example.test',
    ]),
  ).toBe(true)
})
it.each([
  'http://board.example.test',
  '//board.example.test',
  'https://other.example.test',
  'https://board.example.test.evil.test',
  'https://user:pass@board.example.test',
  'https://board.example.test:8443',
  'https://board.example.test\n/view',
  'https://board.example.test https://board.example.test',
  'https://board.example.test/https://other.example.test',
  'https://board.example.test\\@evil.test',
  ' https://board.example.test',
])('rejects unsafe ClickUp URL %s with a fixed test policy', (value) => {
  expect(isAllowedClickUpUrl(value, ['board.example.test'])).toBe(false)
})
