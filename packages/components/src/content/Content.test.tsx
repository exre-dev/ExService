// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ContentImage } from './Content'
afterEach(cleanup)
it('keeps image dimensions and falls back accessibly, then retries a replacement source', () => {
  const image = {
    src: '/missing.webp',
    alt: '社区合影',
    width: 1200,
    height: 800,
    caption: '活动介绍',
  }
  const view = render(<ContentImage image={image} />)
  const original = screen.getByRole('img', { name: '社区合影' })
  expect(original.getAttribute('width')).toBe('1200')
  expect(original.getAttribute('loading')).toBe('lazy')
  fireEvent.error(original)
  expect(screen.getByText('图片暂不可用')).toBeTruthy()
  expect(screen.getByRole('img', { name: '社区合影' }).tagName).toBe('DIV')
  view.rerender(<ContentImage image={{ ...image, src: '/replacement.webp' }} eager />)
  const replacement = screen.getByRole('img', { name: '社区合影' })
  expect(replacement.tagName).toBe('IMG')
  expect(replacement.getAttribute('loading')).toBe('eager')
  expect(screen.getByText('活动介绍')).toBeTruthy()
})
