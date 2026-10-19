// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { TeamPage } from './TeamPage'
import type { TeamMember } from '../../config/team'
import type { AboutPage } from '../../content/about/types'
import { parseTeamConfig } from '../../config/team'
import { teamSchema } from '../../../build/about/schema'

vi.mock('./AboutBody', () => ({ AboutBody: () => <p>明确的占位正文</p> }))
vi.mock('./TeamShaderComponents', () => ({
  DotGrid: () => (
    <div>
      <canvas />
    </div>
  ),
  MeshGradient: () => (
    <div>
      <canvas />
    </div>
  ),
}))
const page: Extract<AboutPage, { kind: 'team' }> = {
  id: 'team.mdx',
  url: '/aboutus/team',
  section: 'team',
  kind: 'team',
  title: '团队',
  description: '介绍',
  recruitment: {
    eyebrow: 'BUILD WITH US',
    title: '加入 Exre，一起创造。',
    description: '合作',
    highlights: ['共同开发'],
    entryEyebrow: 'NEXT STEP',
    entryTitle: '从这里开始。',
    entryDescription: '通过招募入口，了解加入方式。',
    buttonLabel: '加入开发团队',
  },
}
const members: TeamMember[] = ['甲', '乙', '丙'].map((name, index) => ({
  id: `member-${index}`,
  name,
  role: `职责${name}`,
  bio: `简介${name}`,
  strengths: [{ title: `能力${name}`, description: `能力说明${name}` }],
  theme: {
    colorBack: '#0868de',
    accent: '#065ed1',
    colorFill: '#ffffff7d',
    colorStroke: '#ffffff',
  },
}))
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})
function show(teams = members, url?: string) {
  return render(
    <MemoryRouter>
      <TeamPage
        page={page}
        state={{ status: 'error', retry: vi.fn() }}
        components={{}}
        config={{ teams, teamRecruitment: { url } }}
      />
    </MemoryRouter>,
  )
}
it('keeps the recruitment background in sync with the selected member, including without WebGL', () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  const second = {
    ...members[1]!,
    theme: { ...members[1]!.theme, colorBack: '#672f90', accent: '#58247d' },
  }
  const view = show([members[0]!, second])
  const background = () =>
    view.container.querySelector<HTMLElement>('[data-team-background="mesh"]')!
  expect(background().style.background).toContain('rgb(8, 104, 222)')
  fireEvent.click(screen.getByRole('button', { name: '选择乙' }))
  expect(background().style.background).toContain('rgb(103, 47, 144)')
})
it('displays members without focus data and omits the removed profile section', () => {
  show(parseTeamConfig({ teams: members }).teams)
  expect(screen.getByRole('heading', { level: 2, name: '甲' })).toBeTruthy()
  expect(screen.getByText('职责甲')).toBeTruthy()
  expect(screen.getByText('简介甲')).toBeTruthy()
  expect(screen.getByText('能力甲')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: '关注领域' })).toBeNull()
})
it('shows full coherent member data and a disabled recruitment entry without a target', () => {
  show()
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('团队')
  expect(screen.getByRole('heading', { level: 2, name: '甲' })).toBeTruthy()
  expect(screen.getByText('职责甲')).toBeTruthy()
  expect(screen.getByRole('button', { name: '选择甲' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: '加入开发团队' }).hasAttribute('disabled')).toBe(true)
  const entry = screen.getByRole('button', { name: '加入开发团队' })
  for (const id of (entry.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)) {
    expect(document.getElementById(id)).not.toBeNull()
  }
  expect(document.getElementById('join')?.tabIndex).toBe(-1)
})
it('interrupts consecutive selection and settles all member data on the latest target', async () => {
  show()
  fireEvent.click(screen.getByRole('button', { name: '选择乙' }))
  fireEvent.click(screen.getByRole('button', { name: '选择丙' }))
  fireEvent.click(screen.getByRole('button', { name: '选择乙' }))
  expect(screen.getByRole('button', { name: '选择乙' }).getAttribute('aria-pressed')).toBe('true')
  await screen.findByRole('heading', { level: 2, name: '乙' })
  expect(screen.getByText('简介乙')).toBeTruthy()
  expect(screen.queryByText('简介丙')).toBeNull()
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300))
  })
  expect(screen.getByText('能力乙')).toBeTruthy()
})
it('preserves stable selection after config updates and falls back when the id is removed', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  const view = show()
  fireEvent.click(screen.getByRole('button', { name: '选择乙' }))
  const redraw = (teams: TeamMember[]) =>
    view.rerender(
      <MemoryRouter>
        <TeamPage
          page={page}
          state={{ status: 'error', retry: vi.fn() }}
          components={{}}
          config={{ teams, teamRecruitment: {} }}
        />
      </MemoryRouter>,
    )
  redraw([members[2]!, members[1]!])
  expect(screen.getByRole('heading', { level: 2, name: '乙' })).toBeTruthy()
  redraw([members[2]!])
  expect(screen.getByRole('heading', { level: 2, name: '丙' })).toBeTruthy()
  redraw([])
  expect(screen.getByText('成员资料仍在整理中')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /选择/ })).toBeNull()
  expect(screen.getByRole('heading', { name: '加入 Exre，一起创造。' })).toBeTruthy()
})
it.each(['/account/profile', 'https://example.com/apply'])(
  'renders the configured recruitment link: %s',
  (url) => {
    show([], url)
    const link = screen.getByRole('link', { name: /加入开发团队/ })
    expect(link.getAttribute('href')).toBe(url)
    if (url.startsWith('https')) {
      expect(link.getAttribute('target')).toBe('_blank')
      expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    }
  },
)
it('opens the QQ chat protocol without creating a blank browser tab', () => {
  const url = 'tencent://message/?uin=554117278&Site=qq&Menu=yes'
  show([], url)
  const link = screen.getByRole('link', { name: /加入开发团队/ })
  expect(link.getAttribute('href')).toBe(url)
  expect(link.getAttribute('target')).toBeNull()
})
it('keeps image space and shows a plain placeholder when a portrait fails', () => {
  show([
    {
      ...members[0]!,
      portrait: { src: '/images/team/photo.png', alt: '真实照片', width: 300, height: 400 },
    },
  ])
  fireEvent.error(screen.getByRole('img', { name: '真实照片' }))
  expect(screen.getByText('人物照片待补充')).toBeTruthy()
})
it('keeps member selection and recruitment usable after asynchronous shader initialization times out', async () => {
  vi.useFakeTimers()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    getExtension: () => null,
  } as never)
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  show()
  await act(async () => {
    await Promise.resolve()
  })
  await act(async () => {
    vi.advanceTimersByTime(3100)
  })
  expect(document.querySelector('canvas')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '选择丙' }))
  expect(screen.getByRole('heading', { level: 2, name: '丙' })).toBeTruthy()
  expect(screen.getByText('明确的占位正文')).toBeTruthy()
  expect(screen.getByRole('button', { name: '加入开发团队' }).hasAttribute('disabled')).toBe(true)
})
it('retains full long configuration tokens in every showcase and recruitment text field', () => {
  const token = (field: string) => `${field}${'A'.repeat(150)}`
  const config = parseTeamConfig({
    teams: [
      {
        ...members[0],
        name: token('NAME'),
        role: token('ROLE'),
        bio: token('BIO'),
        strengths: [{ title: token('STRENGTH'), description: token('DETAIL') }],
      },
    ],
  })
  const recruitment = {
    eyebrow: token('RECRUITMENT'),
    title: token('TITLE'),
    description: token('DESCRIPTION'),
    highlights: [token('HIGHLIGHT')],
    entryEyebrow: token('ENTRY'),
    entryTitle: token('START'),
    entryDescription: token('INSTRUCTION'),
    buttonLabel: token('ACTION'),
  }
  const metadata = teamSchema.parse({
    title: token('PAGE'),
    description: token('SUMMARY'),
    eyebrow: token('EYEBROW'),
    showcase: { headline: token('HEADLINE'), lead: token('LEAD') },
    recruitment,
  })
  render(
    <MemoryRouter>
      <TeamPage
        page={{ ...page, ...metadata }}
        state={{ status: 'error', retry: vi.fn() }}
        components={{}}
        config={config}
      />
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1, name: token('HEADLINE') })).toBeTruthy()
  expect(screen.getByRole('heading', { level: 2, name: token('NAME') })).toBeTruthy()
  expect(screen.getByRole('button', { name: `选择${token('NAME')}` })).toBeTruthy()
  expect(screen.getByRole('button', { name: new RegExp(token('ACTION')) })).toBeTruthy()
  for (const field of [
    'ROLE',
    'BIO',
    'STRENGTH',
    'DETAIL',
    'EYEBROW',
    'LEAD',
    'RECRUITMENT',
    'TITLE',
    'DESCRIPTION',
    'HIGHLIGHT',
    'ENTRY',
    'START',
    'INSTRUCTION',
  ])
    expect(screen.getByText(token(field))).toBeTruthy()
})
