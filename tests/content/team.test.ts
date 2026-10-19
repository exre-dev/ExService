import { afterEach, expect, it } from 'vitest'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readContent } from '@web/build/content/compiler'
import { aboutDefinition } from '@web/build/about/definition'

const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'exwebsite-team-'))
  roots.push(root)
  await cp(aboutDefinition.root, root, { recursive: true })
  return { ...aboutDefinition, root }
}
it('projects the dedicated team collection with recruitment content and keeps legacy members', async () => {
  const result = await readContent(aboutDefinition)
  expect(result.documents.find((doc) => doc.id === 'team.mdx')?.collection).toBe('aboutTeam')
  const data = result.data as { pages: Record<string, unknown>[]; members: unknown[] }
  expect(data.pages.find((page) => page.kind === 'team')).toMatchObject({
    section: 'team',
    recruitment: { title: '加入 Exre，一起创造。' },
  })
  expect(data.members.length).toBeGreaterThan(0)
})
it('accepts the team template join anchor but rejects unknown template anchors', async () => {
  const definition = await fixture()
  const path = join(definition.root, 'story.mdx')
  const body = await readFile(path, 'utf8')
  await writeFile(path, body + '\n[加入团队](/aboutus/team#join)\n')
  await expect(readContent(definition)).resolves.toBeTruthy()
  await writeFile(path, body + '\n[未知](/aboutus/team#missing)\n')
  await expect(readContent(definition)).rejects.toThrow(/Unknown anchor/)
})
it('requires a public fixed team page and rejects recruitment fields on other sections', async () => {
  const definition = await fixture()
  const path = join(definition.root, 'team.mdx')
  const body = await readFile(path, 'utf8')
  await writeFile(path, body.replace('title:', 'draft: true\ntitle:'))
  await expect(readContent(definition)).rejects.toThrow(/Fixed page/)
  const story = join(definition.root, 'story.mdx')
  await writeFile(path, body)
  await writeFile(
    story,
    (await readFile(story, 'utf8')).replace('title:', 'recruitment: {}\ntitle:'),
  )
  await expect(readContent(definition)).rejects.toThrow(/story.mdx/)
})
