import { createRequire } from 'node:module'
import type { FastifyInstance } from 'fastify'
import { expect, it, vi } from 'vitest'
import { startApplication, APPLICATION_CLEANUP_FAILED } from '@server/src/start-application'

const require = createRequire(new URL('../../apps/server/package.json', import.meta.url))
const Fastify: () => FastifyInstance = require('fastify')
function fixture() {
  const app = Fastify(),
    database = { close: vi.fn(async () => {}) },
    stop = vi.fn()
  return {
    app,
    database,
    stop,
    options: {
      createApp: () => app,
      database,
      listen: { port: 0, host: '127.0.0.1' },
      startProjection: vi.fn(() => stop),
      reportCleanupFailure: vi.fn(),
    },
  }
}

it('starts workers only after listening and closes runtime-owned resources once', async () => {
  const { app, database, stop, options } = fixture()
  options.startProjection.mockImplementation(() => {
    expect(app.server.listening).toBe(true)
    return stop
  })
  expect(await startApplication(options)).toBe(app)
  await app.close()
  await app.close()
  expect(database.close).toHaveBeenCalledTimes(1)
  expect(stop).toHaveBeenCalledTimes(1)
})

it.each(['create', 'ready', 'listen'])(
  'cleans %s failure without starting workers',
  async (stage) => {
    const { app, database, options } = fixture(),
      original = new Error(`SECRET_${stage}`)
    if (stage === 'create')
      options.createApp = () => {
        throw original
      }
    if (stage === 'ready')
      app.register(async () => {
        throw original
      })
    if (stage === 'listen') vi.spyOn(app, 'listen').mockRejectedValue(original)
    await expect(startApplication(options)).rejects.toBe(original)
    expect(database.close).toHaveBeenCalledTimes(1)
    expect(options.startProjection).not.toHaveBeenCalled()
    expect(app.server.listening).toBe(false)
    if (stage === 'create') await app.close()
  },
)

it('stops the first worker and listener when the second worker fails', async () => {
  const { app, database, stop, options } = fixture(),
    original = new Error('SECRET_WORKER')
  await expect(
    startApplication({
      ...options,
      startOutbox: () => {
        throw original
      },
    }),
  ).rejects.toBe(original)
  expect(stop).toHaveBeenCalledTimes(1)
  expect(database.close).toHaveBeenCalledTimes(1)
  expect(app.server.listening).toBe(false)
})

it('tries every cleanup step, preserves the startup error and reports only a fixed message', async () => {
  const { app, database, stop, options } = fixture(),
    original = new Error('SECRET_STARTUP')
  stop.mockImplementation(() => {
    throw new Error('SECRET_STOP')
  })
  database.close.mockRejectedValue(new Error('SECRET_DATABASE'))
  await expect(
    startApplication({
      ...options,
      startOutbox: () => {
        throw original
      },
    }),
  ).rejects.toBe(original)
  expect(database.close).toHaveBeenCalledTimes(1)
  expect(options.reportCleanupFailure.mock.calls).toEqual([
    [APPLICATION_CLEANUP_FAILED],
    [APPLICATION_CLEANUP_FAILED],
  ])
  expect(app.server.listening).toBe(false)
})

it('cleans even if close hook installation or app.close fails', async () => {
  const { app, database, options } = fixture(),
    original = new Error('SECRET_HOOK')
  vi.spyOn(app, 'addHook').mockImplementation(() => {
    throw original
  })
  vi.spyOn(app, 'close').mockRejectedValue(new Error('SECRET_CLOSE'))
  options.reportCleanupFailure.mockImplementation(() => {
    throw new Error('SECRET_REPORT')
  })
  await expect(startApplication(options)).rejects.toBe(original)
  expect(database.close).toHaveBeenCalledTimes(1)
})
