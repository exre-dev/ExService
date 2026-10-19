import { afterEach, expect, it } from 'vitest'
import { cp, mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { parse, stringify } from 'yaml'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { aboutDefinition } from '@web/build/about/definition'
import { readContent } from '@web/build/content/compiler'
import type { AboutRegistry } from '@web/src/content/about/types'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'exwebsite-about-'))
  roots.push(root)
  await cp(aboutDefinition.root, root, { recursive: true })
  return { ...aboutDefinition, root }
}
it('accepts an existing community entrance and rejects retired Join links in metadata and body', async () => {
  const definition = await fixture()
  const path = join(definition.root, 'communities/rifling-911.mdx')
  const metadata = parse((await readFile(path, 'utf8')).split('---')[1]!)
  const write = (joinUrl: string, body: string) =>
    writeFile(path, `---\n${stringify({ ...metadata, status: 'active', joinUrl })}---\n${body}`)
  await write('/communities/rifling-911', '[Community](/communities/rifling-911)')
  const registry = (await readContent(definition)).data as AboutRegistry
  const community = registry.pages.find(
    (page) => page.kind === 'community' && page.slug === 'rifling-911',
  )
  expect(community && 'joinUrl' in community ? community.joinUrl : undefined).toBe(
    '/communities/rifling-911',
  )
  await write('/join/rifling-911', 'Community story')
  await expect(readContent(definition)).rejects.toThrow(/joinUrl/)
  await write('/communities/rifling-911', '[Retired](/join/rifling-911)')
  await expect(readContent(definition)).rejects.toThrow(/Unknown internal link/)
})
it('publishes independent community palettes and rejects unreadable shader colors', async () => {
  const definition = await fixture()
  const path = join(definition.root, 'communities/rifling-911.mdx')
  const source = parse((await readFile(path, 'utf8')).split('---')[1]!)
  const writeTheme = async (color: string) =>
    writeFile(
      path,
      `---\n${stringify({ ...source, theme: { colorBack: color, accent: '#065ed1' } })}---\nCommunity story`,
    )
  await writeTheme('#0868de')
  const result = await readContent(definition)
  const community = (result.data as AboutRegistry).pages.find(
    (page) => page.kind === 'community' && page.slug === 'rifling-911',
  )
  expect(community && 'theme' in community ? community.theme : undefined).toEqual({
    colorBack: '#0868de',
    accent: '#065ed1',
    colorFill: '#ffffff7d',
    colorStroke: '#ffffff',
  })
  await writeTheme('#ffffff')
  await expect(readContent(definition)).rejects.toThrow(/contrast/)
})
it('publishes chapter photo assets and retains milestone references through chapter grouping', async () => {
  const definition = await fixture()
  await mkdir(join(definition.root, 'assets'), { recursive: true })
  await writeFile(
    join(definition.root, 'assets/story.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  )
  await writeFile(
    join(definition.root, 'story.mdx'),
    '---\ntitle: Story\ndescription: Intro\n---\n<Timeline headline="A story"><StoryChapter yearLabel="2016" photos={[{src:"assets/story.png",alt:"Photo",width:1,height:1}]}><Milestone id="creating" title="Event" dateLabel="Example">Story</Milestone></StoryChapter></Timeline>',
  )
  const result = await readContent(definition)
  expect((result.data as AboutRegistry).milestones).toEqual(['creating'])
  expect(Object.keys(result.assets)).toContain('assets/story.png')
})
it.each(['placeholderPhotos={0}', 'placeholderPhotos={3}', 'photos={[]}'])(
  'rejects unsupported chapter photo counts: %s',
  async (props) => {
    const definition = await fixture()
    await writeFile(
      join(definition.root, 'story.mdx'),
      `---\ntitle: Story\ndescription: Intro\n---\n<Timeline><StoryChapter yearLabel="2016" ${props}>Story</StoryChapter></Timeline>`,
    )
    await expect(readContent(definition)).rejects.toThrow(/story.mdx/)
  },
)
it.each([
  '<Milestone id="beginning" title="起点" dateLabel="示例">正文</Milestone>',
  '<Timeline><Callout title="说明" kind="note"><StoryChapter yearLabel="2016"><Milestone id="creating" title="起点" dateLabel="示例">正文</Milestone></StoryChapter></Callout></Timeline>',
  '<Timeline><StoryChapter yearLabel="2016"><Callout title="说明" kind="note"><Milestone id="creating" title="起点" dateLabel="示例">正文</Milestone></Callout></StoryChapter></Timeline>',
])('rejects chapter nesting that the Story renderer cannot display', async (body) => {
  const definition = await fixture()
  await writeFile(
    join(definition.root, 'story.mdx'),
    `---\ntitle: Story\ndescription: Intro\n---\n${body}`,
  )
  await expect(readContent(definition)).rejects.toThrow(/story.mdx/)
})
async function homeFields(definition: typeof aboutDefinition, fields: Record<string, unknown>) {
  const path = join(definition.root, 'index.mdx')
  const source = await readFile(path, 'utf8')
  await writeFile(
    path,
    source.replace(
      /^---\r?\n([\s\S]*?)\r?\n---/,
      (_, frontmatter: string) => `---\n${stringify({ ...parse(frontmatter), ...fields })}---`,
    ),
  )
}
async function donationFields(definition: typeof aboutDefinition, fields: Record<string, unknown>) {
  await writeFile(
    join(definition.root, 'donations.mdx'),
    '---\ntitle: 捐赠\ndescription: 捐赠信息\n---\n\n介绍正文。',
  )
  await mkdir(join(definition.root, 'donations'), { recursive: true })
  await writeFile(join(definition.root, 'donations/items.yaml'), stringify(fields))
}
it('projects a donation route with defaults and resolves donation author links', async () => {
  const definition = await fixture()
  await donationFields(definition, {})
  const home = await readFile(join(definition.root, 'index.mdx'), 'utf8')
  await writeFile(
    join(definition.root, 'index.mdx'),
    home + '\n<AboutLink target="page:donations">捐赠</AboutLink>\n',
  )
  const donation = ((await readContent(definition)).data as AboutRegistry).pages.find(
    (page) => page.section === 'donations',
  )
  expect(donation).toMatchObject({
    kind: 'donations',
    url: '/aboutus/donations',
    channels: [],
    donors: [],
  })
})
it('publishes approved donation channels and donor details while excluding drafts and private QR assets', async () => {
  const definition = await fixture()
  await mkdir(join(definition.root, 'assets'), { recursive: true })
  await writeFile(
    join(definition.root, 'assets/private-qr.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  )
  await donationFields(definition, {
    channels: [
      { id: 'public', name: '渠道', url: 'https://example.com/support' },
      {
        id: 'private',
        name: '未发布渠道',
        draft: true,
        qrCode: { src: 'assets/private-qr.png', alt: '未发布二维码', width: 1, height: 1 },
      },
    ],
    donors: [
      { id: 'first', nickname: '昵称甲', date: '2026-10-12' },
      { id: 'private', nickname: '未发布昵称', date: '2026-10-11', draft: true },
    ],
  })
  const result = await readContent(definition)
  const donation = (result.data as AboutRegistry).pages.find((page) => page.section === 'donations')
  expect(donation).toMatchObject({
    channels: [{ id: 'public', name: '渠道', url: 'https://example.com/support' }],
    donors: [{ id: 'first', nickname: '昵称甲', date: '2026-10-12' }],
  })
  expect(JSON.stringify(result.data)).not.toMatch(/未发布|private-qr/)
  expect(result.assets).toEqual({})
})
it.each([
  { channels: [{ id: 'missing', name: '缺少入口' }] },
  { channels: [{ id: 'unsafe', name: '入口', url: 'javascript:alert(1)' }] },
  { channels: [{ id: 'credentials', name: '入口', url: 'https://user:secret@example.com/' }] },
  { donors: [{ id: 'blank', nickname: ' ', date: '2026-10-12' }] },
  { donors: [{ id: 'date', nickname: '昵称', date: '2026-02-30' }] },
  {
    donors: [
      { id: 'duplicate', nickname: '甲', date: '2026-10-12' },
      { id: 'duplicate', nickname: '乙', date: '2026-10-11' },
    ],
  },
  {
    channels: [
      { id: 'duplicate', name: '甲', url: 'https://example.com/a' },
      { id: 'duplicate', name: '乙', url: 'https://example.com/b' },
    ],
  },
])('rejects invalid donation metadata: %j', async (fields) => {
  const definition = await fixture()
  await donationFields(definition, fields)
  await expect(readContent(definition)).rejects.toThrow('about/donations/items.yaml')
})
it('checks nested QR resources and donation home metadata through the real compiler', async () => {
  const definition = await fixture()
  await homeFields(definition, {
    entryHeadlines: { donations: '感谢支持' },
    entryDescriptions: { donations: '渠道与捐赠者信息' },
  })
  await donationFields(definition, {
    channels: [
      {
        id: 'qr',
        name: '二维码',
        qrCode: { src: 'assets/missing-qr.png', alt: '捐赠二维码', width: 1, height: 1 },
      },
    ],
  })
  await expect(readContent(definition)).rejects.toThrow('Missing asset assets/missing-qr.png')
})
it('keeps the new home fields optional in the real registry projection', async () => {
  const definition = await fixture()
  await homeFields(definition, {
    hero: { headline: 'Headline', summary: 'Summary' },
    entryHeadlines: undefined,
    cardImages: undefined,
  })
  const registry = (await readContent(definition)).data as AboutRegistry
  const home = registry.pages.find((page) => page.kind === 'home')!
  expect(home).toMatchObject({ kind: 'home', hero: { headline: 'Headline', summary: 'Summary' } })
  expect('cardImages' in home).toBe(false)
  expect('entryHeadlines' in home).toBe(false)
})
it('projects the new home metadata and validates nested image resources with the real compiler', async () => {
  const definition = await fixture()
  await mkdir(join(definition.root, 'assets'), { recursive: true })
  await writeFile(
    join(definition.root, 'assets/home.png'),
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=',
      'base64',
    ),
  )
  const image = {
    src: 'assets/home.png',
    alt: 'Community scene',
    width: 1,
    height: 1,
    position: { x: 20, y: 80 },
  }
  await homeFields(definition, {
    hero: { headline: 'Headline', summary: 'Summary', lead: 'Lead' },
    entryHeadlines: { communities: 'Custom headline' },
    cardImages: { communities: image },
  })
  const result = await readContent(definition)
  expect((result.data as AboutRegistry).pages.find((page) => page.kind === 'home')).toMatchObject({
    hero: { lead: 'Lead' },
    entryHeadlines: { communities: 'Custom headline' },
    cardImages: { communities: image },
  })
  expect(result.assets['assets/home.png']).toBe(
    await realpath(join(definition.root, 'assets/home.png')),
  )
})
it.each([
  { entryHeadlines: { belief: 'Not a linked section' } },
  { entryHeadlines: { communities: ' ' } },
  { cardImages: { unknown: { src: 'assets/home.png', alt: 'Image', width: 1, height: 1 } } },
  { cardImages: { belief: { src: 'assets/home.png', alt: 'Image', width: 1, height: 1 } } },
  { hero: { headline: 'Title', summary: 'Summary', lead: ' ' } },
])('rejects invalid home metadata with the source filename: %j', async (fields) => {
  const definition = await fixture()
  await homeFields(definition, fields)
  await expect(readContent(definition)).rejects.toThrow('about/index.mdx')
})
it.each(['assets/missing.png', '../outside.png'])(
  'rejects missing or escaped nested card assets: %s',
  async (src) => {
    const definition = await fixture()
    await homeFields(definition, {
      cardImages: { communities: { src, alt: 'Image', width: 1, height: 1 } },
    })
    await expect(readContent(definition)).rejects.toThrow(/about\/index.mdx.*(asset|资源)/)
  },
)
it('projects the real published pages and keeps member bodies separate from routes', async () => {
  const { data } = await readContent(aboutDefinition)
  const registry = data as { pages: { url: string }[]; members: { id: string }[] }
  expect(registry.pages.map((page) => page.url)).toContain('/aboutus/communities/caep')
  expect(registry.pages.some((page) => page.url.includes('members'))).toBe(false)
  expect(registry.pages.some((page) => page.url.startsWith('/aboutus/projects'))).toBe(false)
  expect(registry.members[0]?.id).toBe('members/example-contributor.mdx')
})
it('rejects a missing fixed page', async () => {
  const definition = await fixture()
  await rm(join(definition.root, 'team.mdx'))
  await expect(readContent(definition)).rejects.toThrow('team.mdx')
})
it('rejects a public reference to a draft member', async () => {
  const definition = await fixture()
  await writeFile(
    join(definition.root, 'members/example-contributor.mdx'),
    '---\ntitle: Private\nslug: example-contributor\nrole: Design\nsummary: Draft\nkind: contributor\ndraft: true\n---\nText',
  )
  await writeFile(
    join(definition.root, 'communities/example-community.mdx'),
    '---\ntitle: Example\ndescription: Intro\nslug: example-community\nstatus: unknown\nrelated:\n  members: [example-contributor]\n---\nText',
  )
  await expect(readContent(definition)).rejects.toThrow('unpublished members:example-contributor')
})
it('rejects duplicate milestone ids', async () => {
  const definition = await fixture()
  await writeFile(
    join(definition.root, 'story.mdx'),
    '---\ntitle: Story\ndescription: Intro\n---\n<Timeline>\n<Milestone id="same" title="A" dateLabel="Unknown">\nA\n</Milestone>\n<Milestone id="same" title="B" dateLabel="Unknown">\nB\n</Milestone>\n</Timeline>',
  )
  await expect(readContent(definition)).rejects.toThrow('Duplicate milestones id: same')
})
it('does not export resources used only by a draft media item', async () => {
  const definition = await fixture()
  const { mkdir } = await import('node:fs/promises')
  await mkdir(join(definition.root, 'assets'))
  await writeFile(
    join(definition.root, 'assets/private.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  )
  await writeFile(
    join(definition.root, 'media/items.yaml'),
    'items:\n  - id: private-video\n    type: video\n    title: Private\n    creator: Unknown\n    usage: Private\n    draft: true\n    cover:\n      src: assets/private.svg\n      alt: Private\n      width: 10\n      height: 10',
  )
  const result = await readContent(definition)
  expect((result.data as { media: unknown[] }).media).toEqual([])
  expect(result.assets).toEqual({})
})
it('rejects unresolved author and markdown links', async () => {
  const definition = await fixture()
  await writeFile(
    join(definition.root, 'communities/example-community.mdx'),
    '---\ntitle: Example\ndescription: Intro\nslug: example-community\nstatus: unknown\n---\n<AboutLink target="community:no-such-community">Read</AboutLink>',
  )
  await expect(readContent(definition)).rejects.toThrow('communities:no-such-community')
  await writeFile(
    join(definition.root, 'communities/example-community.mdx'),
    '---\ntitle: Example\ndescription: Intro\nslug: example-community\nstatus: unknown\n---\n[Read](/aboutus/story#no-such-anchor)',
  )
  await expect(readContent(definition)).rejects.toThrow('Unknown anchor')
})
it.each([
  '<Milestone id="creating" title="Example" dateLabel="Unknown" related={{communities:[" example-community "]}}>Text</Milestone>',
  '<Milestone id=" creating " title="Example" dateLabel="Unknown">Text</Milestone>',
])('rejects non-canonical static slugs before publishing broken links or anchors', async (body) => {
  const definition = await fixture()
  await writeFile(
    join(definition.root, 'story.mdx'),
    `---\ntitle: Story\ndescription: Intro\n---\n<Timeline>${body}</Timeline>`,
  )
  await expect(readContent(definition)).rejects.toThrow(/story.mdx/)
})
it('checks the complete fragment instead of discarding an extra hash', async () => {
  const definition = await fixture()
  await writeFile(
    join(definition.root, 'communities/example-community.mdx'),
    '---\ntitle: Example\ndescription: Intro\nslug: example-community\nstatus: unknown\n---\n[Read](/aboutus/story#milestone-creating#junk)',
  )
  await expect(readContent(definition)).rejects.toThrow('Unknown anchor')
})
it('accepts an encoded fragment using the same decoded anchor as the browser', async () => {
  const definition = await fixture()
  await writeFile(
    join(definition.root, 'story.mdx'),
    '---\ntitle: Story\ndescription: Intro\n---\n## 开始\n\n故事正文',
  )
  await writeFile(
    join(definition.root, 'communities/example-community.mdx'),
    '---\ntitle: Example\ndescription: Intro\nslug: example-community\nstatus: unknown\n---\n[Read](/aboutus/story#%E5%BC%80%E5%A7%8B)',
  )
  await expect(readContent(definition)).resolves.toBeDefined()
})
