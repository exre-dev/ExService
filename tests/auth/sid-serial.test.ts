import { expect, it } from 'vitest'
import { withSidSerial } from '@server/src/modules/identity/sid-serial'

it('keeps protocol logout ahead of queued cleanup for one sid while allowing another sid', async () => {
  const steps: string[] = []
  let release!: () => void
  const first = withSidSerial('same-sid', async () => {
    steps.push('accept-start')
    await new Promise<void>((resolve) => {
      release = resolve
    })
    steps.push('accept-end')
  })
  await Promise.resolve()
  const second = withSidSerial('same-sid', async () => {
    steps.push('cleanup')
  })
  await withSidSerial('other-sid', async () => {
    steps.push('other')
  })
  expect(steps).toEqual(['accept-start', 'other'])
  release()
  await Promise.all([first, second])
  expect(steps).toEqual(['accept-start', 'other', 'accept-end', 'cleanup'])
})
