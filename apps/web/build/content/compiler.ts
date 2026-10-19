import { readdir, readFile, realpath } from 'node:fs/promises'
import { extname, relative, resolve, sep } from 'node:path'
import matter from 'gray-matter'
import { parse } from 'yaml'
import { analyzeMdx, type ContentAnalysis, type Schema } from './syntax.ts'

export interface ContentEntry {
  id: string
  file: string
  collection: string
  draft: boolean
  data: Record<string, unknown>
  analysis: ContentAnalysis
}
export interface ContentDefinition {
  namespace: string
  root: string
  classify(file: string): { collection: string; schema: Schema } | undefined
  components: Record<string, Schema>
  project(entries: ContentEntry[]): unknown
}
export interface ContentResult {
  documents: ContentEntry[]
  data: unknown
  assets: Record<string, string>
}

async function files(root: string): Promise<string[]> {
  const output: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name)
    if (entry.isSymbolicLink())
      throw new Error(`Symbolic content paths are unsupported: ${entry.name}`)
    if (entry.isDirectory()) output.push(...(await files(path)))
    else if (/\.(mdx?|ya?ml|json)$/.test(entry.name)) output.push(path)
  }
  return output.sort()
}
function imageSources(value: unknown, output = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return output
  if (
    'src' in value &&
    'alt' in value &&
    'width' in value &&
    'height' in value &&
    typeof value.src === 'string'
  )
    output.add(value.src)
  for (const child of Object.values(value)) imageSources(child, output)
  return output
}
function contained(parent: string, child: string) {
  const path = relative(parent, child)
  return (
    path !== '' &&
    path !== '..' &&
    !path.startsWith(`..${sep}`) &&
    !path.startsWith(sep) &&
    !/^[a-z]:/i.test(path)
  )
}

export async function readContent(definition: ContentDefinition): Promise<ContentResult> {
  if (!/^[a-z][a-z0-9-]*$/.test(definition.namespace)) throw new Error('Invalid content namespace')
  const root = await realpath(definition.root)
  const entries: ContentEntry[] = []
  for (const file of await files(root)) {
    const id = relative(root, file).replaceAll('\\', '/')
    if (id.startsWith('assets/')) continue
    try {
      const kind = definition.classify(id)
      if (!kind) throw new Error('Unregistered content file')
      // gray-matter leaves a trailing CR in the final frontmatter value on CRLF input.
      const source = (await readFile(file, 'utf8')).replaceAll('\r\n', '\n')
      const isMdx = /\.mdx?$/.test(file)
      const parsed = isMdx
        ? matter(source, {
            engines: { yaml: (text) => parse(text.replace(/\r\n?/g, '\n')) as object },
          })
        : { data: parse(source) as object, content: '' }
      const data = kind.schema.parse(parsed.data) as Record<string, unknown>
      entries.push({
        id,
        file,
        collection: kind.collection,
        draft: data.draft === true,
        data,
        analysis: isMdx
          ? analyzeMdx(parsed.content, definition.components)
          : { links: [], components: [], headings: [] },
      })
    } catch (error) {
      throw new Error(
        `${definition.namespace}/${id}: ${error instanceof Error ? error.message : 'Invalid content'}`,
      )
    }
  }
  const data = definition.project(entries)
  const assets: Record<string, string> = Object.create(null)
  const publicSources = imageSources([
    data,
    ...entries
      .filter((entry) => !entry.draft)
      .flatMap((entry) => entry.analysis.components.map((component) => component.props)),
  ])
  for (const entry of entries) {
    for (const src of imageSources([
      entry.data,
      ...entry.analysis.components.map((component) => component.props),
    ])) {
      if (
        !/^assets\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp|avif|svg)$/i.test(src) ||
        src.split('/').some((part) => ['.', '..', ''].includes(part))
      )
        throw new Error(`${definition.namespace}/${entry.id}: Invalid asset path ${src}`)
      const assetRoot = resolve(root, 'assets')
      const file = resolve(root, src)
      let actual: string
      try {
        actual = await realpath(file)
      } catch {
        throw new Error(`${definition.namespace}/${entry.id}: Missing asset ${src}`)
      }
      if (!contained(assetRoot, actual))
        throw new Error(`${definition.namespace}/${entry.id}: 资源越出 assets: ${src}`)
      if (publicSources.has(src)) assets[src] = actual
    }
  }
  return {
    documents: entries.filter((entry) => !entry.draft && /\.mdx?$/.test(entry.id)),
    data,
    assets,
  }
}
