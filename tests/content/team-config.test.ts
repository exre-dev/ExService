import { afterEach, expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, rm, writeFile, symlink, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { build, createServer } from 'vite'
import { parseTeamConfig, registeredRoutePaths } from '@web/src/config/team'
import { teamConfigPlugin, validateTeamConfig } from '@web/build/team-config'

const member = {
  id: 'member-one',
  name: '成员',
  role: '职责',
  bio: '占位',
  strengths: [],
  theme: { colorBack: '#0868de', accent: '#065ed1' },
}
const roots: string[] = []
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})
it('accepts member data without the removed focus concept', () => {
  const parsed = parseTeamConfig({ teams: [member] })
  expect(parsed.teams[0]).toMatchObject({
    id: 'member-one',
    name: '成员',
    role: '职责',
    bio: '占位',
  })
  expect(parsed.teams[0]).not.toHaveProperty('focus')
})
it('rejects a legacy focus property through the strict member contract', () => {
  expect(() => parseTeamConfig({ teams: [{ ...member, focus: ['技术'] }] })).toThrow(/focus/)
})
it('derives literal registered destinations and excludes wildcard destinations', () => {
  expect(
    registeredRoutePaths(
      '<Route path="/login" /><Route path="/aboutus/*" /><Route path="*" /><Route path="/account/profile" />',
    ),
  ).toEqual(['/login', '/account/profile'])
})
it('rejects invalid configuration during a real Vite build', async () => {
  const root = await mkdtemp(join(tmpdir(), 'exwebsite-team-build-'))
  roots.push(root)
  await mkdir(join(root, 'public'), { recursive: true })
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(join(root, 'src/App.tsx'), '<Route path="/account/profile" />')
  await writeFile(
    join(root, 'public/config.json'),
    JSON.stringify({ teamRecruitment: { url: '/unknown' } }),
  )
  await writeFile(
    join(root, 'entry.js'),
    'import routes from "virtual:team-routes"; globalThis.routes=routes',
  )
  await expect(
    build({
      configFile: false,
      envDir: false,
      root,
      logLevel: 'silent',
      plugins: [teamConfigPlugin(root)],
      build: { write: false, rolldownOptions: { input: join(root, 'entry.js') } },
    }),
  ).rejects.toThrow(/config.json/)
})
it('reports invalid JSON HMR edits and recovers to a native JSON update after repair', async () => {
  // Vite denies Windows 8.3 temp paths even when allow-listed.
  const root = await realpath(await mkdtemp(join(tmpdir(), 'exwebsite-team-hmr-')))
  roots.push(root)
  await mkdir(join(root, 'public'), { recursive: true })
  await mkdir(join(root, 'src'), { recursive: true })
  await writeFile(join(root, 'src/App.tsx'), '<Route path="/account/profile" />')
  const file = join(root, 'public/config.json')
  await writeFile(file, JSON.stringify({ teams: [member] }))
  await writeFile(
    join(root, 'entry.js'),
    'import config from "./public/config.json"; globalThis.config=config; import.meta.hot.accept("./public/config.json",()=>{})',
  )
  const server = await createServer({
    configFile: false,
    envDir: false,
    root,
    logLevel: 'silent',
    plugins: [teamConfigPlugin(root)],
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
    optimizeDeps: { noDiscovery: true },
  })
  try {
    await server.listen()
    await server.transformRequest('/entry.js')
    await server.transformRequest('/public/config.json?import')
    const send = vi.spyOn(server.ws, 'send')
    const sent = (type: string) =>
      send.mock.calls.some(
        ([message]) =>
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === type,
      )
    await writeFile(file, JSON.stringify({ teams: [{ ...member, unknown: true }] }))
    await expect.poll(() => sent('error'), { timeout: 5000 }).toBe(true)
    expect(sent('update')).toBe(false)
    send.mockClear()
    await writeFile(file, JSON.stringify({ teams: [] }))
    await expect.poll(() => sent('update'), { timeout: 5000 }).toBe(true)
    send.mockRestore()
  } finally {
    await server.close()
  }
})
it('defaults missing team data without rejecting unrelated public settings', () => {
  expect(parseTeamConfig({ community: { existing: true }, other: 'keep' })).toEqual({
    teams: [],
    teamRecruitment: {},
  })
  expect(parseTeamConfig({ teams: [member] }).teams[0]?.theme).toMatchObject({
    colorFill: '#ffffff7d',
    colorStroke: '#ffffff',
  })
})
it('accepts ordinary nested public image filenames without imposing an unrelated naming scheme', () => {
  const avatar = { src: '/images/team/人物/photo.v2.png', alt: '照片', width: 20, height: 30 }
  expect(parseTeamConfig({ teams: [{ ...member, avatar }] }).teams[0]?.avatar).toEqual(avatar)
})
it.each([
  { teams: [member, member] },
  { teams: [{ ...member, message: 'extra' }] },
  { teams: [{ ...member, focus: [] }] },
  { teams: [{ ...member, theme: { colorBack: '#ffffff', accent: '#065ed1' } }] },
  { teams: [{ ...member, strengths: [{ title: 'x', description: 'x', score: 1 }] }] },
  ...[
    '/images/team/../secret.png',
    '/images/team/%2e%2e/secret.png',
    '/images/team/photo.png?q=x',
    '//example.com/a',
  ].map((src) => ({ teams: [{ ...member, avatar: { src, alt: '照片', width: 10, height: 10 } }] })),
])('rejects unsafe or malformed team data: %j', (value) => {
  expect(() => parseTeamConfig(value)).toThrow()
})
it('accepts only the QQ chat protocol shape alongside ordinary recruitment destinations', () => {
  const url = 'tencent://message/?uin=554117278&Site=qq&Menu=yes'
  expect(parseTeamConfig({ teamRecruitment: { url } }).teamRecruitment.url).toBe(url)
  for (const invalid of [
    'tencent://message/?uin=abc&Site=qq&Menu=yes',
    'tencent://message/?uin=554117278&Site=qq&Menu=yes&redirect=https://example.com',
    'tencent://file/?path=example',
    'javascript:alert(1)',
  ]) {
    expect(() => parseTeamConfig({ teamRecruitment: { url: invalid } })).toThrow()
  }
})
it('allows only credential-free HTTPS or registered internal recruitment destinations', () => {
  expect(parseTeamConfig({ teamRecruitment: { url: '  ' } }).teamRecruitment).toEqual({})
  expect(
    parseTeamConfig({ teamRecruitment: { url: '/account/profile' } }, ['/account/profile'])
      .teamRecruitment.url,
  ).toBe('/account/profile')
  expect(
    parseTeamConfig({ teamRecruitment: { url: 'https://example.com/apply' } }).teamRecruitment.url,
  ).toBe('https://example.com/apply')
  for (const url of [
    '/unknown',
    '/aboutus/team#join',
    '//example.com',
    'http://example.com',
    'https://user:pass@example.com',
    'https://example.com\n',
    '/account\\profile',
    '/account/%2e%2e/profile',
  ])
    expect(() => parseTeamConfig({ teamRecruitment: { url } }, ['/aboutus/team'])).toThrow()
})
it.each(['https://example.com/application%20form', 'https://example.com/apply/%E5%BC%80%E5%8F%91'])(
  'accepts ordinary encoded external HTTPS path: %s',
  (url) => {
    expect(parseTeamConfig({ teamRecruitment: { url } }).teamRecruitment.url).toBe(url)
  },
)
it('checks image existence and real public resource containment with source-field diagnostics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'exwebsite-team-config-'))
  roots.push(root)
  await mkdir(join(root, 'images/team'), { recursive: true })
  const config = {
    teams: [
      { ...member, avatar: { src: '/images/team/photo.png', alt: '照片', width: 10, height: 10 } },
    ],
  }
  await writeFile(join(root, 'config.json'), JSON.stringify(config))
  await expect(validateTeamConfig(root, [])).rejects.toThrow(/config.json.*teams.0.avatar.src/)
  await writeFile(join(root, 'images/team/photo.png'), 'image')
  await expect(validateTeamConfig(root, [])).resolves.toBeTruthy()
  await writeFile(join(root, 'outside.png'), 'outside')
  await symlink(join(root, 'outside.png'), join(root, 'images/team/link.png'))
  config.teams[0]!.avatar.src = '/images/team/link.png'
  await writeFile(join(root, 'config.json'), JSON.stringify(config))
  await expect(validateTeamConfig(root, [])).rejects.toThrow(/resource boundary/)
})
