// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JoinPage } from '@web/src/pages/JoinPage/Rifling-911/index'

vi.mock('@web/src/join/hero-images', () => ({
  getJoinHeroImages: () => [
    '/images/heros/join/rifling-911/465563.jpg',
    '/images/heros/join/rifling-911/X1.png',
  ],
}))
vi.mock('@paper-design/shaders-react', () => ({
  HalftoneDots: ({ image }: { image: string }) => <img alt="" src={image} />,
}))
afterEach(cleanup)

it('cycles through the local hero images with pointer and keyboard input', async () => {
  render(<JoinPage />)
  const user = userEvent.setup()
  const hero = screen.getByRole('button', { name: '切换背景图片，当前第 1 张，共 2 张' })
  expect(hero.querySelector('img')?.getAttribute('src')).toBe(
    '/images/heros/join/rifling-911/465563.jpg',
  )
  await user.click(hero)
  expect(hero.querySelector('img')?.getAttribute('src')).toBe(
    '/images/heros/join/rifling-911/X1.png',
  )
  await user.keyboard('{Enter}')
  expect(hero.querySelector('img')?.getAttribute('src')).toBe(
    '/images/heros/join/rifling-911/465563.jpg',
  )
})

it('keeps community entrances available without the retired application controls', () => {
  render(<JoinPage />)
  const community = screen.getByRole('region', { name: '社区入口' })
  expect(
    (within(community).getByRole('button', { name: 'QQ 社区' }) as HTMLButtonElement).disabled,
  ).toBe(true)
  expect(
    (within(community).getByRole('button', { name: 'KOOK 社区' }) as HTMLButtonElement).disabled,
  ).toBe(true)
  expect(screen.queryByRole('button', { name: '新玩家申请' })).toBeNull()
  expect(screen.queryByRole('button', { name: '调转申请' })).toBeNull()
  expect(screen.queryByRole('link', { name: '查询申请结果' })).toBeNull()
})
