import { expect, it } from 'vitest'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { build, type Rollup } from 'vite'
import { defineCollections } from 'fumadocs-mdx/config'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { ContentImage, ContentProse } from '@components/src/content/Content'
import { CodeBlock } from '@components/src/content/CodeBlock'
import { supportDefinition, supportCollections } from '../../build/support/definition'
import { contentDefinitions } from '../../build/collections'
import { contentPlugin } from '../../build/content/plugin'
import { contentConfig } from '../../build/content/preset'
import type { ContentStore } from './store'
import type { ContentImageData, SupportRegistry } from './support/types'

it('registers Support without browser meta collections', async () => {
  expect(contentDefinitions.some((definition) => definition === supportDefinition)).toBe(true)
  const source = await readFile(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../source.config.ts'),
    'utf8',
  )
  expect(source).toContain('export const supportErrors = defineCollections')
  expect(source).not.toMatch(/export const support(?:Contacts|Settings)/)
})

it('compiles and renders Support through real Fumadocs, virtual registry and store while excluding drafts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'exwebsite-support-compile-'))
  try {
    const content = join(root, 'content')
    await mkdir(join(content, 'errors'), { recursive: true })
    await mkdir(join(content, 'assets'))
    await writeFile(
      join(content, 'settings.yaml'),
      'categories:\n  - id: setup\n    label: Setup\nclickup: null',
    )
    await writeFile(
      join(content, 'contacts.yaml'),
      'items:\n  - id: private-person\n    name: PRIVATE_CONTACT_SENTINEL\n    role: Support\n    draft: true\n    avatar:\n      src: assets/private.svg\n      alt: Private\n      width: 20\n      height: 20',
    )
    await writeFile(
      join(content, 'assets/public.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"><text>PUBLIC_ASSET_SENTINEL</text></svg>',
    )
    await writeFile(
      join(content, 'assets/private.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg"><text>PRIVATE_ASSET_SENTINEL</text></svg>',
    )
    const metadata =
      'title: Guide\ndescription: Setup guide\ncategory: setup\nquickAnswer: Start here'
    await writeFile(
      join(content, 'errors/guide.mdx'),
      `---\nslug: guide\n${metadata}\nfeaturedOrder: 1\n---\n## 开始\n正文 sentinel\n\n### Next step\n[Start](#%E5%BC%80%E5%A7%8B)\n\n<ContentImage image={{src:"assets/public.svg",alt:"Diagram",width:20,height:20}} />\n\n\`\`\`lua\nprint("support compiler sentinel")\n\`\`\``.replaceAll(
        '\n',
        '\r\n',
      ),
    )
    await writeFile(
      join(content, 'errors/private.mdx'),
      `---\nslug: private\n${metadata}\ndraft: true\n---\nPRIVATE_BODY_SENTINEL\n<ContentImage image={{src:"assets/private.svg",alt:"Private",width:20,height:20}} />`,
    )
    const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
    const registryPath = join(webRoot, 'src/content/support/registry.ts').replaceAll('\\', '/')
    await writeFile(
      join(root, 'entry.js'),
      `export {supportRegistry,supportStore,supportImage} from ${JSON.stringify(registryPath)}`,
    )
    let modules: string[] = []
    const outputs = (await build({
      configFile: false,
      envDir: false,
      root,
      logLevel: 'error',
      resolve: {
        alias: { 'react/jsx-runtime': join(webRoot, 'node_modules/react/jsx-runtime.js') },
      },
      plugins: [
        contentPlugin([{ ...supportDefinition, root: content }]),
        ...fumadocsMdx({
          macro: false,
          index: false,
          updateViteConfig: false,
          forcedConfig: {
            supportErrors: defineCollections({
              type: 'doc',
              dir: content,
              ...supportCollections.supportErrors,
            }),
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
      build: {
        outDir: join(root, 'dist'),
        minify: false,
        modulePreload: false,
        assetsInlineLimit: 0,
        lib: { entry: join(root, 'entry.js'), formats: ['es'], fileName: () => 'entry.mjs' },
        rolldownOptions: { output: { chunkFileNames: '[name]-[hash].mjs' } },
      },
    })) as Rollup.RolldownOutput[]
    const output = outputs[0]!
    const code = output.output
      .filter((item) => item.type === 'chunk')
      .map((chunk) => chunk.code)
      .join('\n')
    expect(code).toContain('support compiler sentinel')
    expect(code).toContain('--shiki-dark')
    expect(code).not.toContain('PRIVATE_BODY_SENTINEL')
    expect(code).not.toContain('PRIVATE_CONTACT_SENTINEL')
    expect(code).not.toContain('PRIVATE_ASSET_SENTINEL')
    expect(
      output.output
        .filter((item) => item.type === 'asset')
        .some((asset) => asset.name?.startsWith('private')),
    ).toBe(false)
    expect(
      modules.some((id) =>
        /node:fs|fumadocs-mdx|fumadocs-core.*source|[\\/]zod[\\/]|[\\/]shiki[\\/]/.test(id),
      ),
    ).toBe(false)
    expect(modules.some((id) => /(?:contacts|settings)\.yaml/.test(id))).toBe(false)
    const fixture = (await import(
      /* @vite-ignore */ pathToFileURL(join(root, 'dist/entry.mjs')).href
    )) as {
      supportRegistry: SupportRegistry
      supportStore: ContentStore
      supportImage: (image: ContentImageData) => ContentImageData
    }
    expect(fixture.supportRegistry.featured).toEqual(['guide'])
    await expect(fixture.supportStore.load('errors/private.mdx')).rejects.toThrow('Unknown content')
    const body = await fixture.supportStore.load('errors/guide.mdx')
    const html = renderToStaticMarkup(
      createElement(
        ContentProse,
        {},
        createElement(body.default, {
          components: {
            pre: CodeBlock,
            ContentImage: ({ image }: { image: ContentImageData }) =>
              createElement(ContentImage, { image: fixture.supportImage(image) }),
          },
        }),
      ),
    )
    expect(html).toMatch(/<h2[^>]*id="开始"/)
    expect(html).toMatch(/<h3[^>]*id="next-step"/)
    expect(html).toContain('href="#%E5%BC%80%E5%A7%8B"')
    const src = html.match(/<img[^>]*src="([^"]+)"/)?.[1] ?? ''
    expect(src).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(Buffer.from(src.split(',')[1]!, 'base64').toString('utf8')).toContain(
      'PUBLIC_ASSET_SENTINEL',
    )
    expect(html).toContain('alt="Diagram"')
    expect(html).toContain('正文 sentinel')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
