import { resolve, relative, isAbsolute } from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { readContent, type ContentDefinition, type ContentResult } from './compiler.ts'

const virtualPrefix = 'virtual:content/'
export function contentPlugin(definitions: ContentDefinition[]): Plugin {
  const registered = new Map(definitions.map((definition) => [definition.namespace, definition]))
  if (registered.size !== definitions.length) throw new Error('Duplicate content namespace')
  let results = new Map<string, ContentResult>()
  const check = async () => {
    const fresh = new Map<string, ContentResult>()
    for (const definition of definitions)
      fresh.set(definition.namespace, await readContent(definition))
    results = fresh
  }
  const affected = (file: string) =>
    definitions.some((definition) => {
      const path = relative(definition.root, resolve(file))
      return path === '' || (!path.startsWith('..') && !isAbsolute(path))
    })
  let server: ViteDevServer | undefined
  let queue = Promise.resolve()
  const update = () => {
    queue = queue.then(async () => {
      try {
        await check()
        if (!server) return
        for (const definition of definitions) {
          const module = server.moduleGraph.getModuleById(
            `\0${virtualPrefix}${definition.namespace}`,
          )
          if (module) server.moduleGraph.invalidateModule(module)
        }
        server.ws.send({ type: 'full-reload' })
      } catch (error) {
        results.clear()
        const message = error instanceof Error ? error.message : 'Invalid content'
        server?.ws.send({
          type: 'error',
          err: { message, stack: message, plugin: 'website-content' },
        })
      }
    })
  }
  return {
    name: 'website-content',
    enforce: 'pre',
    async buildStart() {
      await check()
    },
    resolveId(id) {
      return id.startsWith(virtualPrefix) && registered.has(id.slice(virtualPrefix.length))
        ? `\0${id}`
        : null
    },
    async load(id) {
      if (!id.startsWith(`\0${virtualPrefix}`)) return null
      const namespace = id.slice(virtualPrefix.length + 1)
      if (!results.has(namespace)) await check()
      const result = results.get(namespace)!
      const assets = Object.entries(result.assets)
      const imports = assets.map(
        ([, file], index) =>
          `import asset${index} from ${JSON.stringify(`${file.replaceAll('\\', '/')}?url`)};`,
      )
      const loaders = result.documents.map(
        (doc) =>
          `${JSON.stringify(doc.id)}:()=>import(${JSON.stringify(`${doc.file.replaceAll('\\', '/')}?collection=${doc.collection}`)})`,
      )
      return `${imports.join('\n')}\nexport const data=${JSON.stringify(result.data)};\nexport const assets={${assets.map(([src], index) => `${JSON.stringify(src)}:asset${index}`).join(',')}};\nexport const loaders={${loaders.join(',')}};`
    },
    configureServer(value) {
      server = value
      server.watcher.add(definitions.map((definition) => definition.root))
      const changed = (file: string) => {
        if (affected(file)) update()
      }
      server.watcher.on('add', changed).on('unlink', changed).on('change', changed)
      server.httpServer?.once('close', () => {
        server?.watcher.off('add', changed).off('unlink', changed).off('change', changed)
        server = undefined
      })
    },
    handleHotUpdate(context) {
      return affected(context.file) ? [] : undefined
    },
  }
}
