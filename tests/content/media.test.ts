import { afterEach, expect, it } from 'vitest'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { aboutDefinition } from '@web/build/about/definition'
import { readContent } from '@web/build/content/compiler'
import type { AboutRegistry } from '@web/src/content/about/types'

const roots: string[] = []
const embedUrl = 'https://embed.music.apple.com/us/playlist/what-are-we-loading/pl.u-e98lM6ESaWXyEK'
const fields = {
  backgroundVideoUrl: 'https://example.com/background.mp4',
  playlist: { embedUrl, title: '我们的歌单', description: '一起听音乐。' },
  videos: { title: '影像记录', description: '一起记录故事。' },
}
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
async function fixture(overrides: Record<string, unknown> = {}) {
  const root = await mkdtemp(join(tmpdir(), 'exwebsite-media-'))
  roots.push(root)
  await cp(aboutDefinition.root, root, { recursive: true })
  const path = join(root, 'media/index.mdx')
  const source = await readFile(path, 'utf8')
  await writeFile(
    path,
    source.replace(
      /^---\r?\n([\s\S]*?)\r?\n---/,
      (_, frontmatter: string) =>
        `---\n${stringify({ ...parse(frontmatter), ...fields, ...overrides })}---`,
    ),
  )
  return { ...aboutDefinition, root }
}
it('publishes a dedicated Media page and its validated presentation through the real compiler', async () => {
  const result = await readContent(await fixture())
  expect(result.documents.find((doc) => doc.id === 'media/index.mdx')?.collection).toBe(
    'aboutMediaPage',
  )
  expect(
    (result.data as AboutRegistry).pages.find((page) => page.section === 'media'),
  ).toMatchObject({ kind: 'media', ...fields })
})
it.each([
  'https://example.com/us/playlist/example/pl.u-test',
  'https://embed.music.apple.com.evil.test/us/playlist/example/pl.u-test',
  'https://embed.music.apple.com:444/us/playlist/example/pl.u-test',
  'https://user:secret@embed.music.apple.com/us/playlist/example/pl.u-test',
  'https://embed.music.apple.com/us/album/example/123',
  'https://embed.music.apple.com/us/playlist/example/pl.u-test?callback=unsafe',
  'javascript:alert(1)',
])('rejects unsupported playlist embeds: %s', async (value) => {
  await expect(
    readContent(await fixture({ playlist: { ...fields.playlist, embedUrl: value } })),
  ).rejects.toThrow('about/media/index.mdx')
})
it('rejects a background URL with credentials', async () => {
  await expect(
    readContent(await fixture({ backgroundVideoUrl: 'https://user:secret@example.com/video.mp4' })),
  ).rejects.toThrow('about/media/index.mdx')
})
it('keeps Media-specific fields out of other sections', async () => {
  const definition = await fixture()
  await writeFile(
    join(definition.root, 'communities/index.mdx'),
    `---\n${stringify({ title: 'Communities', description: 'Intro', ...fields })}---\n`,
  )
  await expect(readContent(definition)).rejects.toThrow('about/communities/index.mdx')
})
