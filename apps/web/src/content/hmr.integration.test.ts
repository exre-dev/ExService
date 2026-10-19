import { expect, it, vi } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createServer } from 'vite'
import { z } from 'zod'
import { contentPlugin } from '../../build/content/plugin'
import type { ContentDefinition } from '../../build/content/compiler'

it('revalidates metadata in real Vite and recovers after a broken content edit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'exwebsite-hmr-'))
  const file = join(root, 'guide.mdx')
  const schema = z.strictObject({ title: z.string() })
  const definition: ContentDefinition = {
    namespace: 'tutorials',
    root,
    classify: () => ({ collection: 'tutorials', schema }),
    components: {},
    project: (entries) => entries.map((entry) => entry.data),
  }
  await writeFile(file, '---\ntitle: First\n---\nContent')
  const server = await createServer({
    configFile: false,
    envDir: false,
    root,
    logLevel: 'silent',
    plugins: [contentPlugin([definition])],
    server: { host: '127.0.0.1', port: 0 },
    optimizeDeps: { noDiscovery: true },
  })
  try {
    await server.listen()
    const send = vi.spyOn(server.ws, 'send')
    const sent = (type: string) =>
      send.mock.calls.some((call) => {
        const message: unknown = call[0]
        return (
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === type
        )
      })
    const first = await server.environments.client.pluginContainer.load(
      '\0virtual:content/tutorials',
    )
    expect(first).toContain('First')
    await writeFile(file, '---\ntitle: Second\n---\nChanged')
    await expect.poll(() => sent('full-reload'), { timeout: 5000 }).toBe(true)
    const second = await server.environments.client.pluginContainer.load(
      '\0virtual:content/tutorials',
    )
    expect(second).toContain('Second')
    send.mockClear()
    await writeFile(file, '---\nunknown: Invalid\n---\nBroken')
    await expect.poll(() => sent('error'), { timeout: 5000 }).toBe(true)
    send.mockClear()
    await writeFile(file, '---\ntitle: Recovered\n---\nFixed')
    await expect.poll(() => sent('full-reload'), { timeout: 5000 }).toBe(true)
    const recovered = await server.environments.client.pluginContainer.load(
      '\0virtual:content/tutorials',
    )
    expect(recovered).toContain('Recovered')
    send.mockRestore()
  } finally {
    await server.close()
    await rm(root, { recursive: true, force: true })
  }
})
