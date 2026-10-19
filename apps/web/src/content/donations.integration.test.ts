import { afterEach, expect, it } from 'vitest'
import { cp, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stringify } from 'yaml'
import { build, type Rollup } from 'vite'
import { defineCollections } from 'fumadocs-mdx/config'
import { fumadocsMdx } from 'fumadocs-mdx/vite'
import { aboutCollections, aboutDefinition } from '../../build/about/definition'
import { contentPlugin } from '../../build/content/plugin'
import { contentConfig } from '../../build/content/preset'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
it('builds real About donation metadata without draft donor details or QR assets in any browser chunk', async () => {
  const root = await mkdtemp(join(tmpdir(), 'exwebsite-donations-build-'))
  roots.push(root)
  const content = join(root, 'content')
  await cp(aboutDefinition.root, content, { recursive: true })
  await mkdir(join(content, 'assets'), { recursive: true })
  await writeFile(
    join(content, 'assets/private.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  )
  const data = {
    channels: [
      { id: 'public', name: 'PUBLIC_CHANNEL_SENTINEL', url: 'https://example.com/support' },
      {
        id: 'private',
        name: 'PRIVATE_CHANNEL_SENTINEL',
        draft: true,
        qrCode: { src: 'assets/private.png', alt: 'PRIVATE_QR_SENTINEL', width: 1, height: 1 },
      },
    ],
    donors: [
      { id: 'public', nickname: 'PUBLIC_DONOR_SENTINEL', date: '2026-10-12' },
      { id: 'private', nickname: 'PRIVATE_DONOR_SENTINEL', date: '2026-10-11', draft: true },
    ],
  }
  await writeFile(
    join(content, 'donations.mdx'),
    '---\ntitle: 捐赠\ndescription: 捐赠信息\n---\n\nDONATION_BODY_SENTINEL',
  )
  await mkdir(join(content, 'donations'), { recursive: true })
  await writeFile(join(content, 'donations/items.yaml'), stringify(data))
  await writeFile(
    join(root, 'entry.js'),
    'import {data,assets,loaders} from "virtual:content/about"; globalThis.donationsBuildFixture={data,assets,loaders}',
  )
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
  const forcedConfig = {
    aboutHome: defineCollections({ type: 'doc', dir: content, ...aboutCollections.aboutHome }),
    aboutTeam: defineCollections({ type: 'doc', dir: content, ...aboutCollections.aboutTeam }),
    aboutMediaPage: defineCollections({
      type: 'doc',
      dir: content,
      ...aboutCollections.aboutMediaPage,
    }),
    aboutSections: defineCollections({
      type: 'doc',
      dir: content,
      ...aboutCollections.aboutSections,
    }),
    aboutCommunities: defineCollections({
      type: 'doc',
      dir: content,
      ...aboutCollections.aboutCommunities,
    }),
    aboutMembers: defineCollections({
      type: 'doc',
      dir: content,
      ...aboutCollections.aboutMembers,
    }),
    aboutMedia: defineCollections({ type: 'meta', dir: content, ...aboutCollections.aboutMedia }),
    aboutDonationCatalog: defineCollections({
      type: 'meta',
      dir: content,
      ...aboutCollections.aboutDonationCatalog,
    }),
  }
  const output = (await build({
    configFile: false,
    envDir: false,
    root,
    logLevel: 'error',
    resolve: { alias: { 'react/jsx-runtime': join(webRoot, 'node_modules/react/jsx-runtime.js') } },
    plugins: [
      contentPlugin([{ ...aboutDefinition, root: content }]),
      ...fumadocsMdx({
        macro: false,
        index: false,
        updateViteConfig: false,
        forcedConfig: { ...forcedConfig, default: contentConfig },
      }),
    ],
    build: { write: false, minify: false, rolldownOptions: { input: join(root, 'entry.js') } },
  })) as Rollup.RolldownOutput
  const code = output.output
    .filter((item) => item.type === 'chunk')
    .map((chunk) => chunk.code)
    .join('\n')
  expect(code).toContain('PUBLIC_CHANNEL_SENTINEL')
  expect(code).toContain('PUBLIC_DONOR_SENTINEL')
  expect(code).toContain('DONATION_BODY_SENTINEL')
  expect(/PRIVATE_(CHANNEL|DONOR|QR)_SENTINEL|assets\/private.png/.test(code)).toBe(false)
})
