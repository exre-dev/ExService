import { afterEach, expect, it } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, type Rollup } from 'vite'
import { defineCollections } from 'fumadocs-mdx/config'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { z } from 'zod'
import { contentPlugin } from '../../build/content/plugin'
import { contentConfig } from '../../build/content/preset'
import { readContent, type ContentDefinition } from '../../build/content/compiler'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
it('builds a second collection with real Fumadocs, highlighted chunks and no drafts or Node runtime', async () => {
  const root = await mkdtemp(join(tmpdir(), 'exwebsite-compile-'))
  roots.push(root)
  const content = join(root, 'content')
  await mkdir(join(content, 'assets'), { recursive: true })
  const schema = z.strictObject({
    title: z.string(),
    topic: z.string(),
    draft: z.boolean().default(false),
    image: z
      .strictObject({ src: z.string(), alt: z.string(), width: z.number(), height: z.number() })
      .optional(),
  })
  await writeFile(
    join(content, 'guide.mdx'),
    '---\ntitle: Guide\ntopic: tutorial\n---\n## Start\n```lua\nprint("compiler sentinel")\n```\n\n```custom-language\nunknown language sample\n```',
  )
  await writeFile(
    join(content, 'private.mdx'),
    '---\ntitle: Private\ntopic: internal\ndraft: true\nimage:\n  src: assets/private.svg\n  alt: Private\n  width: 10\n  height: 10\n---\nPRIVATE_BODY_SENTINEL',
  )
  await writeFile(
    join(content, 'assets/private.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg"><text>PRIVATE_ASSET_SENTINEL</text></svg>',
  )
  await writeFile(
    join(root, 'entry.js'),
    'import {data,loaders} from "virtual:content/tutorials"; globalThis.contentFixture = {data,loaders}',
  )
  const definition: ContentDefinition = {
    namespace: 'tutorials',
    root: content,
    classify: (file) => (file.endsWith('.mdx') ? { collection: 'tutorials', schema } : undefined),
    components: {},
    project: (entries) => entries.filter((entry) => !entry.draft).map((entry) => entry.data),
  }
  const result = await readContent(definition)
  expect(result.assets).toEqual({})
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  let modules: string[] = []
  const output = (await build({
    configFile: false,
    envDir: false,
    root,
    logLevel: 'error',
    resolve: { alias: { 'react/jsx-runtime': join(webRoot, 'node_modules/react/jsx-runtime.js') } },
    plugins: [
      contentPlugin([definition]),
      ...fumadocsMdx({
        macro: false,
        index: false,
        updateViteConfig: false,
        forcedConfig: {
          tutorials: defineCollections({ type: 'doc', dir: content, files: ['*.mdx'], schema }),
          default: contentConfig,
        },
      }),
      {
        name: 'capture-modules',
        generateBundle(_, bundle) {
          modules = Object.values(bundle).flatMap((item) =>
            item.type === 'chunk' ? Object.keys(item.modules) : [],
          )
        },
      },
    ],
    build: { write: false, minify: false, rolldownOptions: { input: join(root, 'entry.js') } },
  })) as Rollup.RolldownOutput
  const chunks = output.output.filter((item) => item.type === 'chunk')
  const code = chunks.map((chunk) => chunk.code).join('\n')
  expect(chunks.some((chunk) => chunk.dynamicImports.length > 0)).toBe(true)
  expect(code).toContain('compiler sentinel')
  expect(code).toContain('rawCode')
  expect(code).toContain('--shiki-dark')
  expect(code).toContain('custom-language')
  expect(code).not.toContain('PRIVATE_BODY_SENTINEL')
  expect(code).not.toContain('PRIVATE_ASSET_SENTINEL')
  expect(
    modules.some((id) =>
      /node:fs|fumadocs-mdx|fumadocs-core.*source|[\\/]zod[\\/]|[\\/]shiki[\\/]|@radix-ui/.test(id),
    ),
  ).toBe(false)
})
