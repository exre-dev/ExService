import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readContent, type ContentDefinition } from '@web/build/content/compiler'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), 'exwebsite-content-'))
  roots.push(root)
  for (const [file, value] of Object.entries(files)) {
    await mkdir(join(root, file, '..'), { recursive: true })
    await writeFile(join(root, file), value)
  }
  const definition: ContentDefinition = {
    namespace: 'guides',
    root,
    classify: (file) =>
      file.endsWith('.mdx')
        ? {
            collection: 'guides',
            schema: {
              parse: (value) => {
                const data = value as Record<string, unknown>
                if (
                  typeof data.title !== 'string' ||
                  Object.keys(data).some((key) => !['title', 'draft'].includes(key))
                )
                  throw new Error('title or unknown field')
                return { title: data.title, draft: data.draft === true }
              },
            },
          }
        : undefined,
    components: {},
    project: (entries) => ({
      titles: entries.filter((entry) => !entry.draft).map((entry) => entry.data.title),
    }),
  }
  return definition
}

describe('generic collection compilation', () => {
  it.each(['\n', '\r\n'])(
    'preserves a numeric final frontmatter field with %j line endings',
    async (newline) => {
      const definition = await fixture({
        'intro.mdx': ['---', 'title: Guide', 'order: 1', '---', '## Start', 'Readable guide'].join(
          newline,
        ),
      })
      definition.classify = () => ({ collection: 'guides', schema: { parse: (value) => value } })
      const result = await readContent(definition)
      expect(result.documents[0]?.data).toEqual({ title: 'Guide', order: 1 })
      expect(result.documents[0]?.analysis.headings).toEqual(['start'])
    },
  )
  it.each(['\n', '\r\n'])(
    'excludes a draft with a final boolean frontmatter field and %j line endings',
    async (newline) => {
      const definition = await fixture({
        'private.mdx': ['---', 'title: Secret', 'draft: true', '---', 'Private sentinel'].join(
          newline,
        ),
      })
      const result = await readContent(definition)
      expect(result.documents).toEqual([])
      expect(result.data).toEqual({ titles: [] })
    },
  )
  it.each(['\n', '\r\n'])(
    'preserves numeric and boolean frontmatter types with %j line endings',
    async (newline) => {
      const source = [
        '---',
        'title: Guide',
        'draft: false',
        'order: 1',
        '---',
        '## Body',
        '[Exact](https://example.com/path?x=1)',
      ].join(newline)
      const definition = await fixture({ 'intro.mdx': source })
      definition.classify = () => ({
        collection: 'guides',
        schema: {
          parse: (value) => {
            const data = value as Record<string, unknown>
            if (typeof data.order !== 'number' || typeof data.draft !== 'boolean')
              throw Error('strict frontmatter types')
            return data
          },
        },
      })
      const [document] = (await readContent(definition)).documents
      expect(document?.data).toEqual({ title: 'Guide', draft: false, order: 1 })
      expect(document?.analysis.headings).toEqual(['body'])
      expect(document?.analysis.links).toEqual(['https://example.com/path?x=1'])
      expect(await readFile(join(definition.root, 'intro.mdx'), 'utf8')).toBe(source)
    },
  )
  it.each(['\n', '\r\n'])(
    'rejects quoted numeric frontmatter with %j line endings',
    async (newline) => {
      const definition = await fixture({
        'intro.mdx': ['---', 'title: Guide', 'order: "1"', '---', 'Body'].join(newline),
      })
      definition.classify = () => ({
        collection: 'guides',
        schema: {
          parse: (value) => {
            if (typeof (value as Record<string, unknown>).order !== 'number')
              throw Error('order must be a number')
            return value
          },
        },
      })
      await expect(readContent(definition)).rejects.toThrow('order must be a number')
    },
  )
  it('accepts a non-About collection and removes draft body imports', async () => {
    const definition = await fixture({
      'intro.mdx': '---\ntitle: Guide\n---\n## Start\nReadable guide',
      'private.mdx': '---\ntitle: Secret\ndraft: true\n---\nPrivate sentinel',
    })
    const result = await readContent(definition)
    expect(result.documents.map((doc) => doc.id)).toEqual(['intro.mdx'])
    expect(result.data).toEqual({ titles: ['Guide'] })
  })
  it('rejects invalid fields with the source filename', async () => {
    await expect(
      readContent(await fixture({ 'intro.mdx': '---\ntitle: Guide\nunknown: true\n---\nText' })),
    ).rejects.toThrow(/intro.mdx/)
  })
  it('does not confuse a business source URL with an image asset', async () => {
    const definition = await fixture({
      'intro.mdx': '---\ntitle: Guide\nsrc: https://example.com/source\n---\nSource reference',
    })
    definition.classify = () => ({ collection: 'guides', schema: { parse: (value) => value } })
    definition.project = (entries) => entries.map((entry) => entry.data)
    expect((await readContent(definition)).assets).toEqual({})
  })
  it.each([
    'import X from "x"',
    '{alert("x")}',
    '<Unknown />',
    '<div onClick={() => alert(1)}>x</div>',
    '# Duplicate page heading',
  ])('rejects unsupported author syntax: %s', async (body) => {
    await expect(
      readContent(await fixture({ 'intro.mdx': `---\ntitle: Guide\n---\n${body}` })),
    ).rejects.toThrow(/intro.mdx/)
  })
  it('checks static props without executing them', async () => {
    const definition = await fixture({
      'intro.mdx': '---\ntitle: Guide\n---\n<Callout kind="note">Text</Callout>',
    })
    definition.components = {
      Callout: {
        parse: (props) => {
          if ((props as { kind?: string }).kind !== 'note') throw new Error('kind')
          return props
        },
      },
    }
    expect((await readContent(definition)).documents[0]?.analysis.components[0]?.props).toEqual({
      kind: 'note',
    })
    await writeFile(
      join(definition.root, 'intro.mdx'),
      '---\ntitle: Guide\n---\n<Callout kind={process.env.SECRET}>Text</Callout>',
    )
    await expect(readContent(definition)).rejects.toThrow(/static|静态/)
  })
  it('rejects missing assets and directory traversal', async () => {
    const definition = await fixture({
      'intro.mdx':
        '---\ntitle: Guide\n---\n<ContentImage image={{src: "assets/missing.png", alt: "Example", width: 10, height: 10}} />',
    })
    definition.components = { ContentImage: { parse: (value) => value } }
    await expect(readContent(definition)).rejects.toThrow(/missing.png/)
    await writeFile(
      join(definition.root, 'intro.mdx'),
      '---\ntitle: Guide\n---\n<ContentImage image={{src: "../secret.png", alt: "Example", width: 10, height: 10}} />',
    )
    await expect(readContent(definition)).rejects.toThrow(/asset|资源/)
  })
})
