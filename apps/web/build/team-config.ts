import { readFile, realpath, stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'
import { parseTeamConfig, registeredRoutePaths } from '../src/config/team.ts'
import { readContent } from './content/compiler.ts'
import { aboutDefinition } from './about/definition.ts'
import type { AboutRegistry } from '../src/content/about/types.ts'

export async function validateTeamConfig(publicRoot: string, routes: readonly string[]) {
  const file = resolve(publicRoot, 'config.json')
  let config
  try {
    config = parseTeamConfig(JSON.parse(await readFile(file, 'utf8')), routes)
  } catch (error) {
    throw new Error(`${file}: ${error instanceof Error ? error.message : String(error)}`)
  }
  for (const [index, member] of config.teams.entries())
    for (const field of ['avatar', 'portrait'] as const) {
      const image = member[field]
      if (!image) continue
      const location = `${file}: teams.${index}.${field}.src`
      try {
        const boundary = await realpath(resolve(publicRoot, 'images/team'))
        const target = await realpath(resolve(publicRoot, image.src.slice(1)))
        const path = relative(boundary, target)
        if (path.startsWith('..') || isAbsolute(path) || !(await stat(target)).isFile())
          throw new Error('Image crosses resource boundary or is not a file')
      } catch (error) {
        throw new Error(`${location}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  return config
}
export function teamConfigPlugin(webRoot: string): Plugin {
  const publicRoot = resolve(webRoot, 'public')
  const source = resolve(webRoot, 'src/App.tsx')
  const virtualId = '\0virtual:team-routes'
  let routes: string[] = []
  const check = async () => {
    const content = await readContent(aboutDefinition)
    routes = [
      ...registeredRoutePaths(await readFile(source, 'utf8')),
      ...(content.data as AboutRegistry).pages.map((page) => page.url),
    ]
    await validateTeamConfig(publicRoot, routes)
  }
  const relevant = (file: string) => {
    const path = relative(publicRoot, file).replaceAll('\\', '/')
    return (
      file === source ||
      path === 'config.json' ||
      path.startsWith('images/team/') ||
      !relative(aboutDefinition.root, file).startsWith('..')
    )
  }
  const errorMessage = (error: unknown, file: string) => ({
    type: 'error' as const,
    err: {
      message: error instanceof Error ? error.message : String(error),
      stack: '',
      plugin: 'team-config',
      id: file,
    },
  })
  return {
    name: 'team-config',
    async buildStart() {
      await check()
    },
    resolveId(id) {
      return id === 'virtual:team-routes' ? virtualId : undefined
    },
    load(id) {
      return id === virtualId ? `export default ${JSON.stringify(routes)}` : undefined
    },
    async handleHotUpdate({ file, server }) {
      if (!relevant(file)) return
      try {
        await check()
        const module = server.moduleGraph.getModuleById(virtualId)
        if (module) server.moduleGraph.invalidateModule(module)
      } catch (error) {
        server.ws.send(errorMessage(error, file))
        return []
      }
      return undefined
    },
    configureServer(server) {
      server.watcher.add([
        resolve(publicRoot, 'config.json'),
        resolve(publicRoot, 'images/team'),
        source,
      ])
      const changed = async (file: string) => {
        const path = relative(publicRoot, file).replaceAll('\\', '/')
        if (file !== source && path !== 'config.json' && !path.startsWith('images/team/')) return
        try {
          await check()
          const module = server.moduleGraph.getModuleById(virtualId)
          if (module) server.moduleGraph.invalidateModule(module)
          // JSON uses native HMR; image and route changes need refreshed consumers.
          if (path !== 'config.json') server.ws.send({ type: 'full-reload' })
        } catch (error) {
          server.ws.send(errorMessage(error, file))
        }
      }
      server.watcher.on('add', changed).on('change', changed).on('unlink', changed)
      server.httpServer?.once('close', () => {
        server.watcher.off('add', changed).off('change', changed).off('unlink', changed)
      })
    },
  }
}
